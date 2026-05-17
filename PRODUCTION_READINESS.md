# Production Readiness — Vercel Deployment

Audit of patterns in the codebase that work in local development but will break, silently fail, or behave incorrectly when deployed to Vercel (serverless functions, read-only filesystem, no built-in scheduler).

Last audited: 2026-05-17.

---

## 🔴 Critical — broken on Vercel

### 1. Filesystem writes to `public/`

Vercel's runtime filesystem is **read-only outside `/tmp`**. Anything written to `public/` will throw `EROFS`. Even if writes succeeded, `public/` is baked at build time and served from the CDN — new files would never be visible to clients.

| File | What it does | Fix |
|------|--------------|-----|
| [apps/web/pages/api/admin/session-image.ts:26-49](apps/web/pages/api/admin/session-image.ts#L26-L49) | Admin uploads session backgrounds via `fs.renameSync` into `public/session-images/` | Vercel Blob / S3 / R2; store returned URL in `Session.imageUrl` |
| [apps/web/pages/api/mobile/citizen-proposals/index.ts:36,92,119](apps/web/pages/api/mobile/citizen-proposals/index.ts#L36) | Mobile uploads citizen-proposal images via `fs.renameSync` into `public/citizen-proposal-images/`; failure path uses `fs.unlink` against same dir | Vercel Blob / S3 / R2; mirror cleanup path to the blob `delete` call |

[apps/web/pages/api/budget/upload-pdf.ts](apps/web/pages/api/budget/upload-pdf.ts) is **OK** — it only writes to `formidable`'s OS temp directory, which Vercel routes to `/tmp` (writable within a single invocation).

**Recommendation:** `@vercel/blob` is the lowest-friction migration — same field shape, no CORS setup, no signed URLs. Two small endpoints, ~20 lines each.

---

### 2. No scheduler exists, but the app assumes one

No `vercel.json` or any other cron configuration is checked in. The following endpoints are designed to be called periodically, but only fire when a client happens to trigger them. If no client polls, **the action never happens**.

| Endpoint | What stops working without cron |
|----------|-------------------------------|
| [apps/web/pages/api/check-session-timeout.ts](apps/web/pages/api/check-session-timeout.ts) | Sessions exceeding `Settings.sessionLimitHours` (default 24h) never auto-close. Stale sessions accumulate indefinitely. |
| [apps/web/pages/api/sessions/execute-scheduled-transition.ts](apps/web/pages/api/sessions/execute-scheduled-transition.ts) | The 90-second Phase 1 → Phase 2 transition only fires if a user has the session page open and is polling. If everyone closes their tab, the session is frozen in phase1 with `phase1TransitionScheduled` set in the past. |
| [apps/web/pages/api/admin/execute-scheduled-termination.ts](apps/web/pages/api/admin/execute-scheduled-termination.ts) | Same issue for the 60-second Phase 2 termination. |
| [apps/web/pages/api/sessions/check-archive.ts](apps/web/pages/api/sessions/check-archive.ts) | Closed sessions never auto-archive without polling. |

**Fix:** Add `vercel.json` at the repo root:

```jsonc
{
  "crons": [
    { "path": "/api/sessions/execute-scheduled-transition", "schedule": "* * * * *" },
    { "path": "/api/admin/execute-scheduled-termination",   "schedule": "* * * * *" },
    { "path": "/api/check-session-timeout",                 "schedule": "*/5 * * * *" },
    { "path": "/api/sessions/check-archive",                "schedule": "*/5 * * * *" }
  ]
}
```

Vercel Cron only invokes `GET` and only allows authenticated calls via the `Authorization: Bearer <CRON_SECRET>` header (Vercel injects `CRON_SECRET` automatically when configured in project env vars). Add a guard at the top of each endpoint:

```ts
if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  return res.status(401).end();
}
```

Note: `execute-scheduled-transition` and `execute-scheduled-termination` currently require `POST`. Either accept `GET` for cron, or wire a Vercel Cron-compatible wrapper.

Vercel Hobby plan limits crons to **daily**. Schedules above the per-minute rate require Pro.

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

### 4. Expo push notification fan-out is fire-and-forget inside admin requests

`POST /api/admin/sessions` calls `notifyNewVotingQuestion()` ([apps/web/lib/push-notifications.ts](apps/web/lib/push-notifications.ts)). The admin's HTTP request blocks until Expo's push API responds for all chunks of 100 tokens. No retry on failure; no dead-letter queue.

Acceptable for MVP. As the user base grows past ~500 push-enabled users, consider:
- Move fan-out into a background job (return 200 to admin immediately, queue the push).
- Persist Expo "tickets" so you can poll receipts and prune dead tokens.

---

### 5. Same-process state across lambdas

[apps/web/lib/pusher-broadcaster.ts:84](apps/web/lib/pusher-broadcaster.ts#L84) and [apps/web/lib/mongodb.ts:11](apps/web/lib/mongodb.ts#L11) cache instances on `global`. Each lambda instance has its own copy.

- **MongoDB:** fine. Connection reuse within a warm lambda is the point.
- **Pusher broadcaster:** fine — Pusher itself is the source of truth.
- **Caveat:** any future feature that tries to keep counters / sets / rate-limit state on `global` will silently desync across lambdas. Use Redis (Upstash) or the DB instead.

---

## 🟡 Lower-risk / cosmetic

### 6. CORS allow-list is dev-only by default

[apps/web/middleware.ts:5-9](apps/web/middleware.ts#L5-L9) hard-codes `localhost:8081` and `localhost:19006`. The `ALLOWED_ORIGINS` env var extends it but must be set in Vercel project settings or mobile-web hits CORS errors with no local symptom.

**Deployment checklist:** set `ALLOWED_ORIGINS=https://app.example.com,https://expo-web.example.com` in Vercel env.

### 7. `output: "standalone"` in next.config.mjs is unused on Vercel

[apps/web/next.config.mjs:4](apps/web/next.config.mjs#L4) — `output: "standalone"` is for self-hosted Node/Docker. Vercel ignores it. Not broken, but signals confusion about deployment target. Safe to delete unless you also plan to deploy via Docker.

### 8. `pdf-parse` dependency is unused

[apps/web/package.json](apps/web/package.json#L34) lists `pdf-parse@^2.4.5`, but [apps/web/lib/budget/ai-extractor.ts:4](apps/web/lib/budget/ai-extractor.ts#L4) explicitly notes Claude reads PDFs directly. Safe to remove from dependencies.

---

## Deployment checklist

Before the first Vercel deploy:

- [ ] Migrate `public/session-images` and `public/citizen-proposal-images` to Vercel Blob (or S3/R2).
- [ ] Add `vercel.json` with cron entries + `CRON_SECRET` guards.
- [ ] Set Vercel env: `MONGODB_URI_PRODUCTION`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (production URL), `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `PUSHER_*`, `NEXT_PUBLIC_PUSHER_*`, `TWILIO_*` (if used), `ALLOWED_ORIGINS`, `CRON_SECRET`.
- [ ] Set `EXPO_PUBLIC_API_URL` in mobile build to the production domain.
- [ ] Confirm `apps/web/turbo.json` `build.env[]` lists every env var consumed at build time (Vercel requires the declaration).
- [ ] Rotate any secrets that were ever committed to `.env` (check git history).

### Post-deploy smoke tests

- Admin can create a "voting" session and the image actually appears for clients.
- Mobile can submit a citizen proposal with an image and the URL is reachable.
- A session left running past `sessionLimitHours` auto-closes (verify via cron logs).
- Phase 2 termination fires when all users close their tabs (verify by manually triggering, then closing all clients).
