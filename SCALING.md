# Scaling

Where this app stops working as it grows, what the current headroom actually is, and what to do when each limit gets close.

This is deliberately **not** a to-do list. Most entries here are fine right now and should be left alone; the point is to know the trigger point before it arrives, so a limit becomes a scheduled change rather than an outage. Each entry states what breaks, how much room is left (measured, not guessed), and the cheapest fix at that point.

Last measured against the production database: **2026-08-22**.

---

## Where we are today

|                                                 | Count                                                           |
| ----------------------------------------------- | --------------------------------------------------------------- |
| Users                                           | **135** (30 with a push token, 0 with a phone number, 5 admins) |
| Questions / votes / debate comments             | 47 / 147 / 28                                                   |
| Session proposals / comments                    | 59 / 9                                                          |
| Citizen proposals                               | 32                                                              |
| Sessions / municipal meetings / budget sessions | 20 / 1 / 2                                                      |
| Swish payments                                  | 3                                                               |
| Database size                                   | 0.2 MB data, 0.8 MB storage                                     |

Every headroom figure below is relative to those numbers — re-measure before trusting them.

Two platform limits set most of the ceilings:

- **Function duration.** Hobby caps a serverless function at 60s, Pro at 300s. Without an explicit `export const maxDuration`, a route gets Vercel's default instead, which is far lower (historically 10s on Hobby, 15s on Pro — confirm in the dashboard). **No route in this repo sets `maxDuration`.** Every long-running route below therefore runs on the default, not the ceiling.
- **Cron granularity.** Hobby runs crons once per day. `apps/web/vercel.json` has two, both daily.

---

## 1. `/api/admin/clean-content` — probably already over the limit

[apps/web/pages/api/admin/clean-content.ts](apps/web/pages/api/admin/clean-content.ts) sends **every** comment, proposal, and citizen proposal to Claude Haiku at concurrency 5.

Today that is 9 + 59 + 32 = **100 items**, roughly 40s of wall time. The route sets no `maxDuration`, so it runs on Vercel's default — which is very likely below that. Expect this button to time out already; it is worth clicking once to find out, since nothing in the code would tell you.

Three separate problems, in order of severity:

- **Deletes are inline.** `deleteOne` runs per item as it is judged. A timeout leaves content deleted with no response listing what went, so the admin cannot tell what happened.
- **No `moderatedAt` field.** Every run re-checks everything, re-billing the Anthropic API for content that was already approved.
- **It only grows.** The work is proportional to total content ever written, not to recent activity.

**Fix when you want it (~30 min):** add a `moderatedAt` timestamp to the three models, only scan items where it is unset or older than the last edit, and set `export const maxDuration = 300`. That makes the button idempotent and safely re-runnable. Longer term, moderating at write time (`POST /api/moderate` already exists and is called by the composer) turns this into a one-off backfill script rather than a standing button.

---

## 2. Bulk email and SMS fan-out — about 4× headroom

[apps/web/lib/sms.ts:116](apps/web/lib/sms.ts#L116) and [apps/web/lib/municipal/notifications.ts:172](apps/web/lib/municipal/notifications.ts#L172) both sleep 100 ms between recipients inside a sequential loop.

At 135 recipients that is ~14s — comfortably inside a 60s function, but only about 4× clear. The wall is roughly **600 recipients** on Hobby and **3000** on Pro, and when it hits, the lambda is killed mid-loop: the back half of the list silently never receives anything, and there is no resume.

Note the SMS path currently has **zero** recipients — no user has saved a phone number — so it has never run against real traffic. Treat its first real send as untested.

**Trigger:** ~500 users, or the first time phone numbers are collected in volume.
**Fix:** replace the sleep with `Promise.allSettled` over a bounded concurrency of ~10, which buys 10× without introducing a queue, and set `maxDuration` at the same time. A real queue (QStash, Vercel Queues) is the answer past a few thousand.

---

## 3. Expo push fan-out — blocking, about 16× headroom

[apps/web/lib/push-notifications.ts](apps/web/lib/push-notifications.ts) batches tokens 100 at a time, and `POST /api/admin/questions` awaits the whole fan-out before responding — so the admin's "create question" request is held open for its duration.

30 push tokens is a single batch. Fine.

**Trigger:** ~500 push-enabled users, when creating a question starts feeling slow.
**Fix:** return 200 to the admin immediately and move the fan-out to a background job. Separately, nothing persists Expo's delivery "tickets", so receipts are never polled and dead tokens are never pruned — that is a correctness gap that shows up as quietly declining delivery long before it is a performance one.

---

## 4. Atlas connection pool — the limit that has actually bitten

This one already caused a production incident (2026-07-06), so it is the pattern to watch hardest.

`connectDB()` in [apps/web/lib/mongodb.ts](apps/web/lib/mongodb.ts) caches the connection on `global` and sets `maxPoolSize: 10`. The driver's default is **100 per lambda instance**, and each concurrent lambda holds its own pool. Without the cap, a handful of instances exhausted Atlas's shared-tier limit of 500 connections, and Atlas began rejecting TLS handshakes with `SSL alert number 80` / "connection pool was cleared".

The cap alone is not enough. What actually triggered it was an N+1 `Promise.all` — one query per document — in the admin live panel, which forces the driver to expand its pool toward the cap on _every_ request. **Keep per-request query parallelism bounded**: batch with an aggregation or `distinct` rather than a query per row.

The same class of fix landed in `/api/mobile/questions` in August 2026 (see Resolved).

**Trigger:** any new endpoint that loops queries over a result set. This is a code-review rule, not a headroom number.

---

## 5. List endpoints with no upper bound

Several endpoints return their entire collection:

- `GET /api/mobile/citizen-proposals` — every active proposal (32 today)
- `GET /api/admin/users` — every user (135)
- `GET /api/admin/citizen-proposals` — every proposal, with author names and rating aggregates joined

Harmless at present size, and premature to paginate now. They become a problem in the low thousands, where the payload cost lands on a mobile connection rather than on the server.

`GET /api/mobile/questions` was the worst of these and is now bounded: closed questions are capped at 100, and vote counts come from an aggregation rather than loading every vote row.

**Trigger:** any of these collections passing ~1000 rows.

---

## 6. Anything cached on `global`

[apps/web/lib/pusher-broadcaster.ts](apps/web/lib/pusher-broadcaster.ts) and [apps/web/lib/mongodb.ts](apps/web/lib/mongodb.ts) both cache instances on `global`. Each lambda instance gets its own copy, and instances come and go freely.

Both current uses are fine — a Mongo connection is per-instance by nature, and Pusher itself is the source of truth. The hazard is future code: **any counter, set, rate limit, or dedupe cache kept on `global` will silently desync across instances**, and will look perfectly correct in local development, where there is only one process. Use Redis (Upstash) or the database.

---

## 7. Daily-only cron

Hobby runs crons once per day. `apps/web/vercel.json` has two, both daily:

| Route                           | Purpose                                                      |
| ------------------------------- | ------------------------------------------------------------ |
| `/api/check-session-timeout`    | Closes any `Session` or `Question` past its own `deadline`   |
| `/api/payments/reconcile-swish` | Settles `CREATED` Swish payments the callback never resolved |

Everything else that could be scheduled is instead lazy — triggered by a client visiting a page. `sessions/execute-scheduled-transition` and `admin/execute-scheduled-termination` are both polled by [session/[id].tsx](apps/web/pages/session/[id].tsx) and [manage-sessions.tsx](apps/web/pages/manage-sessions.tsx).

**The accepted edge case:** if nobody at all visits a session page after phase 2 expires, `closeSession({ sendEmails: true })` never runs and the participant result emails never go out. Accepted since the Hobby decision — a real hole, not a theoretical one.

**Fix:** Pro allows sub-daily crons. Both routes are `POST`-only, so they would need a `GET` branch or a thin wrapper to be cron-callable.

---

## 8. Orphaned blobs

Every image endpoint deletes the previous blob when an image is _replaced_, and `DELETE /api/account/delete` removes a user's citizen-proposal images. But **deleting the owning entity does not delete its image** — removing a question, session, municipal item, or budget category leaves its blob behind.

Negligible now (a handful of images, and Blob storage is cheap), but it is unbounded growth, so it wants a sweep eventually rather than never.

---

## Deliberately not doing yet

The function-timeout family — items 1, 2, and 3 — is **knowingly deferred** (decision: 2026-08-22). At 135 users the arithmetic gives items 2 and 3 real headroom, and item 1 affects one admin-only button. Revisit as user count approaches ~500, or sooner if `clean-content` is actually needed.

What that costs in the meantime: `clean-content` may be unusable, and the first large broadcast will silently truncate. Both are recoverable, and neither affects a normal user.

---

## Resolved

Kept because the reasoning still applies to new code.

- **Filesystem writes to `public/`** (2026-05-20) — Vercel's filesystem is read-only outside `/tmp`, so all uploads moved to `@vercel/blob` and `imageUrl` is now a full HTTPS CDN URL. `upload-pdf.ts` is still fine: it writes only to formidable's temp dir, which Vercel routes to `/tmp`. **Never write to `public/` at runtime.**
- **No scheduler** (2026-05-20) — `vercel.json` crons plus a `CRON_SECRET` bearer guard on each cron route. See item 7 for what was deliberately left lazy.
- **Functions ran in the wrong hemisphere** (2026-08-22) — no `regions` key meant Vercel defaulted to `iad1` (Washington DC) while Atlas sits in Europe, so every database round trip crossed the Atlantic twice and `/api/mobile/*` sat at ~1.3s. Pinned to `arn1`. **If the Atlas cluster ever moves, move this with it.**
- **`/api/mobile/questions` loaded every vote row** (2026-08-22) — replaced with a `$group` aggregation, and `QuestionVote.userId` got its own index (the `{questionId, userId}` compound index cannot serve a `userId`-only quota count — it was a collection scan).
- **`output: "standalone"`** (2026-08-22) — a self-hosted/Docker setting that Vercel ignores; removed to stop implying a deployment target that was never used. `serverExternalPackages: ["sharp"]` stays and is unrelated — `sharp` is a native module used by [lib/image.ts](apps/web/lib/image.ts).
- **`pdf-parse` dependency** (2026-08-22) — never imported; Claude reads PDF base64 directly. Removed.
- **CORS allow-list** (2026-08-22) — this used to describe a `middleware.ts` pinning `localhost:8081` / `localhost:19006`, with an `ALLOWED_ORIGINS` env override. That middleware no longer exists and nothing reads `ALLOWED_ORIGINS`; the entry was stale advice to set a variable that does nothing. The mobile app is native-only (no browser origin) and the web app is same-origin, so no CORS layer is needed. **Do not set `ALLOWED_ORIGINS` in Vercel.**

---

## Environment variables

The full annotated list lives in [CLAUDE.md](CLAUDE.md). Two things that are easy to get wrong:

- `NEXTAUTH_URL` is **per-environment** and must match the URL the browser actually hits — it is the base for auth callbacks and for links inside OTP emails. Production is `https://www.vallentuna.app` (www is canonical; the apex 308-redirects). Do not set one unscoped value across all Vercel environments.
- Adding a variable in Vercel is not enough: `turbo.json`'s `build.env[]` must list it too. Turbo hashes the declared set, so an undeclared variable can serve a stale cached build after its value changes.
