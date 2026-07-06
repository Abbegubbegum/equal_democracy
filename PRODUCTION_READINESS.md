# Production Readiness — Vercel Deployment

Audit of patterns in the codebase that work in local development but will break, silently fail, or behave incorrectly when deployed to Vercel (serverless functions, read-only filesystem, no built-in scheduler).

Last audited: 2026-05-17.

---

## 🔴 Critical — broken on Vercel

### 1. ~~Filesystem writes to `public/`~~ ✅ Fixed (2026-05-20)

Migrated both endpoints to `@vercel/blob`:

- [apps/web/pages/api/admin/session-image.ts](apps/web/pages/api/admin/session-image.ts) — `put()` to `session-images/<sessionId>-<ts>.<ext>`, public access. Deletes the previous blob (read from `Session.imageUrl`) before overwriting, so replacing a session image no longer accumulates orphans.
- [apps/web/pages/api/mobile/citizen-proposals/index.ts](apps/web/pages/api/mobile/citizen-proposals/index.ts) — `put()` to `citizen-proposal-images/<id>.<ext>`. Failure path now calls `del()` instead of `fs.unlink`.

`imageUrl` is now a full HTTPS URL (e.g. `https://<hash>.public.blob.vercel-storage.com/...`). All consumers either already handled absolute URLs (`startsWith("http")` branches in [vote.tsx](<apps/mobile/app/(app)/vote.tsx>), [sessions.tsx](<apps/mobile/app/(app)/sessions.tsx>), [admin/index.tsx](apps/web/pages/admin/index.tsx)) or use the URL verbatim in an `<img src>` (which works for both). [apps/mobile/app/(app)/proposals.tsx](<apps/mobile/app/(app)/proposals.tsx>) was updated to add the same `startsWith("http")` check.

**Vercel setup required before deploy:**

1. Dashboard → Storage → Create Database → Blob → "Create".
2. Connect the store to the project. Vercel will inject `BLOB_READ_WRITE_TOKEN` automatically into the production environment (also pull it into Preview if you want previews to upload). Run `vercel env pull` locally for dev uploads, or set `BLOB_READ_WRITE_TOKEN` in `apps/web/.env.local`.
3. No bucket / CORS / signed-URL config is needed — `access: "public"` returns a CDN-fronted public URL.

[apps/web/pages/api/budget/upload-pdf.ts](apps/web/pages/api/budget/upload-pdf.ts) is still **OK** — it only writes to `formidable`'s OS temp directory, which Vercel routes to `/tmp` (writable within a single invocation).

---

### 2. ~~No scheduler exists~~ ✅ Resolved for Hobby tier (2026-05-20)

The Hobby plan caps crons at **once per day**, which rules out the per-minute / 5-minute crons originally planned for phase transitions. After auditing each endpoint, only one of them genuinely needs to run on a schedule on Hobby. The rest are self-healing (lazy-fired by clients) or pure cosmetic housekeeping.

| Endpoint                                                                                                | Self-heals lazily?                                                                      | Decision on Hobby                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [check-session-timeout.ts](apps/web/pages/api/check-session-timeout.ts)                                 | No client trigger — would never fire without cron.                                      | **Daily cron, 03:00 UTC.** Sweeps any session past `Settings.sessionLimitHours`.                                                                                                                           |
| [sessions/execute-scheduled-transition.ts](apps/web/pages/api/sessions/execute-scheduled-transition.ts) | Yes — [session/[id].tsx:241](apps/web/pages/session/[id].tsx#L241) polls it.            | No cron. Lazy.                                                                                                                                                                                             |
| [admin/execute-scheduled-termination.ts](apps/web/pages/api/admin/execute-scheduled-termination.ts)     | Yes — same page + [manage-sessions.tsx:1185](apps/web/pages/manage-sessions.tsx#L1185). | No cron. Lazy. **Edge case:** if _nobody_ visits the session page after phase 2 expires, the participant result emails (sent inside `closeSession({ sendEmails: true })`) never go out. Accepted on Hobby. |
| [sessions/check-archive.ts](apps/web/pages/api/sessions/check-archive.ts)                               | No client trigger.                                                                      | No cron. Pure housekeeping for survey sessions — archive state isn't user-visible.                                                                                                                         |

**What's wired up:**

- [apps/web/vercel.json](apps/web/vercel.json) — one cron entry, `0 3 * * *`.
- [apps/web/pages/api/check-session-timeout.ts](apps/web/pages/api/check-session-timeout.ts) is now gated by `Authorization: Bearer ${CRON_SECRET}` and returns 401 to anything else.

**Vercel setup required before deploy:**

1. Project → **Settings** → **Environment Variables** → add `CRON_SECRET` (any long random string). Vercel injects it into the cron invocation's `Authorization` header automatically.
2. Confirm the cron shows up under **Settings** → **Cron Jobs** after the next deploy.

**Upgrade path to Pro:** if you ever want sub-daily reliability for the lazy endpoints (e.g. always send result emails even if nobody visits), upgrade to Pro and add `execute-scheduled-transition`, `execute-scheduled-termination`, and `check-archive` to `vercel.json` at the schedules you want. All three already accept `POST`, so they'd need a `GET` branch or a wrapper — but that's a Pro-tier concern, not blocking deploy on Hobby.

---

## 🟠 Important — silent functional gaps

### 3. Bulk notification loops can be cut off mid-send

[apps/web/lib/sms.ts:116](apps/web/lib/sms.ts#L116) and [apps/web/lib/municipal/notifications.ts:170](apps/web/lib/municipal/notifications.ts#L170) sleep 100 ms between each recipient inside a sequential `for` loop. Vercel function timeouts are:

- **Hobby:** 60 seconds → ~600 recipients max before the lambda is killed mid-loop.
- **Pro:** 300 seconds → ~3000 recipients.

If the lambda is killed, the second half of the recipient list silently never receives the email/SMS, and there is no resume mechanism.

**Fix options:**

- Use `Promise.allSettled` with bounded concurrency (e.g. 10 parallel sends) — gets you ~10x throughput without queueing.
- Push to a queue (Upstash QStash, Vercel Queues, Trigger.dev) and let the worker handle pacing.
- At minimum, set `export const maxDuration = 300` on broadcast endpoints and document the recipient cap.

---

### 4. `POST /api/admin/clean-content` re-scans the entire DB on every call

[apps/web/pages/api/admin/clean-content.ts](apps/web/pages/api/admin/clean-content.ts) iterates **all** comments + proposals + citizen proposals and calls Claude Haiku on each at concurrency 5 (~0.4s per item amortized). No `export const maxDuration`, so it inherits Vercel's default (10s on Hobby, 15s on Pro) — times out at roughly 25-50 items.

Worse: `Comment.deleteOne` / `Proposal.deleteOne` / `CitizenProposal.deleteOne` are called inline. If the lambda is killed mid-loop:

- Already-deleted items stay deleted, but the admin never sees the response listing them.
- There is no `moderatedAt` field, so re-running re-checks everything — **double-billing the Anthropic API** and re-evaluating items that were already approved.

| Total items | Time at concurrency 5 | Verdict                                   |
| ----------- | --------------------- | ----------------------------------------- |
| 100         | ~40s                  | OK on Hobby if `maxDuration` raised       |
| 500         | ~200s                 | Dies on Hobby (60s cap), OK on Pro (300s) |
| 2,000       | ~800s                 | Dies even on Pro at default `maxDuration` |
| 10,000+     | hours                 | Impossible inside a single lambda         |

**Fix options (in order of effort):**

- **A. Incremental + idempotent (~30 min).** Add `moderatedAt` timestamp on each model. Only check items where `moderatedAt < createdAt` (never checked, or content edited since). Set `export const maxDuration = 300`. Admin can repeatedly click the button without re-billing.
- **B. Queue-based.** Enqueue per-item jobs (Upstash QStash / Vercel Queues / Inngest); a worker route processes one item per invocation. Admin polls status. Right answer for scale.
- **C. Moderate at write-time.** Already partially done via `POST /api/moderate` — extend it to reject flagged content before it's saved. `clean-content` then becomes a one-off migration script, not a button.

Recommended path: **A** as the production fix; **C** is the longer-term architecture.

---

### 5. Expo push notification fan-out is fire-and-forget inside admin requests

`POST /api/admin/sessions` calls `notifyNewVotingQuestion()` ([apps/web/lib/push-notifications.ts](apps/web/lib/push-notifications.ts)). The admin's HTTP request blocks until Expo's push API responds for all chunks of 100 tokens. No retry on failure; no dead-letter queue.

Acceptable for MVP. As the user base grows past ~500 push-enabled users, consider:

- Move fan-out into a background job (return 200 to admin immediately, queue the push).
- Persist Expo "tickets" so you can poll receipts and prune dead tokens.

---

### 6. Same-process state across lambdas

[apps/web/lib/pusher-broadcaster.ts:84](apps/web/lib/pusher-broadcaster.ts#L84) and [apps/web/lib/mongodb.ts:11](apps/web/lib/mongodb.ts#L11) cache instances on `global`. Each lambda instance has its own copy.

- **MongoDB:** fine, but pool size must stay capped. `connectDB()` sets `maxPoolSize: 10` (driver default is 100 **per lambda instance**) — without the cap, a few concurrent instances exhausted Atlas's shared-tier limit of 500 connections in production (2026-07-06), and Atlas rejected new TLS handshakes with `SSL alert number 80` / "connection pool was cleared". Keep per-request query parallelism bounded too: an N+1 `Promise.all` (one query per document) forces the driver to expand the pool toward its cap on every request — batch with `distinct`/aggregation instead (this was the live-panel bug that triggered the incident).
- **Pusher broadcaster:** fine — Pusher itself is the source of truth.
- **Caveat:** any future feature that tries to keep counters / sets / rate-limit state on `global` will silently desync across lambdas. Use Redis (Upstash) or the DB instead.

---

## 🟡 Lower-risk / cosmetic

### 7. CORS allow-list is dev-only by default

[apps/web/middleware.ts:5-9](apps/web/middleware.ts#L5-L9) hard-codes `localhost:8081` and `localhost:19006`. The `ALLOWED_ORIGINS` env var extends it but must be set in Vercel project settings or mobile-web hits CORS errors with no local symptom.

**Deployment checklist:** set `ALLOWED_ORIGINS=https://app.example.com,https://expo-web.example.com` in Vercel env.

### 8. `output: "standalone"` in next.config.mjs is unused on Vercel

[apps/web/next.config.mjs:4](apps/web/next.config.mjs#L4) — `output: "standalone"` is for self-hosted Node/Docker. Vercel ignores it. Not broken, but signals confusion about deployment target. Safe to delete unless you also plan to deploy via Docker.

### 9. `pdf-parse` dependency is unused

[apps/web/package.json](apps/web/package.json#L34) lists `pdf-parse@^2.4.5`, but [apps/web/lib/budget/ai-extractor.ts:4](apps/web/lib/budget/ai-extractor.ts#L4) explicitly notes Claude reads PDFs directly. Safe to remove from dependencies.

---

## Deployment checklist

Before the first Vercel deploy:

- [x] ~~Migrate `public/session-images` and `public/citizen-proposal-images` to Vercel Blob~~ — done 2026-05-20. Still need to **create the Blob store in the Vercel dashboard** and confirm `BLOB_READ_WRITE_TOKEN` is set in project env.
- [x] ~~Add `vercel.json` with cron entries + `CRON_SECRET` guards~~ — done 2026-05-20. Still need to **set `CRON_SECRET` in Vercel project env** so the daily sweep can authenticate.
- [ ] Set Vercel env: `MONGODB_URI_PRODUCTION`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (production URL), `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `PUSHER_*`, `NEXT_PUBLIC_PUSHER_*`, `TWILIO_*` (if used), `ALLOWED_ORIGINS`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN` (auto-set when you connect a Blob store, but verify).
- [ ] Set `EXPO_PUBLIC_API_URL` in mobile build to the production domain.
- [ ] Confirm `apps/web/turbo.json` `build.env[]` lists every env var consumed at build time (Vercel requires the declaration).
- [ ] Rotate any secrets that were ever committed to `.env` (check git history).

### Post-deploy smoke tests

- Admin can create a "voting" session and the image actually appears for clients.
- Mobile can submit a citizen proposal with an image and the URL is reachable.
- A session left running past `sessionLimitHours` auto-closes within 24h (verify via Vercel Cron logs at **Settings** → **Cron Jobs** → last invocation).
- Phase 2 termination fires when _anyone_ loads the session or manage-sessions page after the 60s window. On Hobby, "nobody visits ever" means the result email never sends — accepted.
