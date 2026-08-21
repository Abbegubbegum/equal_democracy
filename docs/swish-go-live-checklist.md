# Swish go-live checklist (chunk 8)

Work through this in order. Each phase ends with something you can verify, so a failure tells you
which step broke rather than leaving you guessing.

The plan: put the **production certificate** in place, charge **1 kr**, test the whole chain for
real from an **internal TestFlight** build (no App Review needed), then raise the fee to 250 kr
without a new app build.

Background and rationale: [swish-integration-plan.md](swish-integration-plan.md).

---

## Phase 0 — Prerequisites

- [ ] Bank agreement for Swish Handel signed, and the merchant **Swish number** known.
- [ ] **Production certificate** generated at [portal.swish.nu](https://portal.swish.nu) for that
      Swish number (requires Mobile BankID as the registered signatory). You need the certificate
      **chain** `.pem` and the private `.key`.
- [ ] You are an App Store Connect user on the account, so you can be an internal TestFlight tester.

> The MSS test certificate (`CN=1234679304`) must never be used against production — it is a shared
> credential published by Swish for everyone.

---

## Phase 1 — Certificate → env vars, verified locally first

Do this before touching Vercel: it is far easier to debug a certificate on your own machine.

1. [ ] Drop the production `.pem` and `.key` into `apps/web/certs/` (gitignored — confirm with
       `git status`, they must not appear).
2. [ ] Generate the env lines and **read the output**:

   ```bash
   cd apps/web
   node scripts/swish-cert-to-env.mjs --cert certs/<prod>.pem --key certs/<prod>.key
   ```

   Check: `leaf` CN is your real Swish number, `valid` has not expired, `match: private key matches
the certificate ✓`, and the chain has **more than one** certificate.

3. [ ] Prove mTLS against production, temporarily, in `apps/web/.env.local`:

   ```env
   SWISH_ENV=production
   SWISH_PAYEE_ALIAS=<your real Swish number>
   SWISH_CERT_BASE64=<from the script>
   SWISH_KEY_BASE64=<from the script>
   ```

   ```bash
   node scripts/test-swish-connection.mjs
   ```

   **Expected:** `✓ mTLS handshake succeeded`, with a `404` for the unknown payment request.
   A `401` means Swish did not accept the certificate or the number is not enrolled.

4. [ ] **Restore the MSS values in `.env.local`** so local development stays on the simulator.
       Nothing local should be able to move real money.

---

## Phase 2 — Vercel environment variables (Production scope only)

Set these on the **Production** environment. Leave Preview and Development on MSS.

| Variable                  | Value                                                  |
| ------------------------- | ------------------------------------------------------ |
| `SWISH_ENV`               | `production`                                           |
| `SWISH_PAYEE_ALIAS`       | your real Swish number (must equal the certificate CN) |
| `SWISH_CERT_BASE64`       | production chain, base64                               |
| `SWISH_KEY_BASE64`        | production key, base64                                 |
| `SWISH_CALLBACK_BASE_URL` | `https://www.vallentuna.app`                           |
| `MEMBERSHIP_FEE_SEK`      | `1` ← the live-test value                              |
| `SWISH_CA_BASE64`         | **leave unset**                                        |

- [ ] Confirm `CRON_SECRET` exists in Production. It was missing from `.env.local`; if it is also
      missing on Vercel then **both** crons are returning 401 — including the existing
      session-timeout one, which is unrelated to Swish.
- [ ] Sanity-check total env var size is under Vercel's 64 KB cap (the cert and key are ~10–14 KB
      of it).

---

## Phase 3 — Deploy and verify the server before involving the app

- [ ] Deploy.
- [ ] **Verify the callback endpoint is publicly reachable.** Do this now — otherwise, if the live
      payment later fails, you cannot tell a broken callback from a lost one:

  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://www.vallentuna.app/api/swish/callback \
    -H "Content-Type: application/json" \
    -d '{"id":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","status":"PAID"}'
  ```

  **Expected: `200`.** That is the deliberate "unknown payment, stop retrying" path.
  A `404` means the route did not deploy; a `403` means something is wrong with CSRF.

- [ ] Confirm the fee is live: open the app against production (or call
      `GET /api/mobile/user/membership` with a bearer token) and check `feeSek` is `1`.

---

## Phase 4 — Build and distribute to internal TestFlight

- [ ] `eas.json`'s `production` profile already sets
      `EXPO_PUBLIC_API_URL=https://www.vallentuna.app`, which overrides the LAN IP in
      `apps/mobile/.env`. Confirm it is still there before building.
- [ ] **Delete `apps/mobile/android/`** before building — EAS bundles the local folder and stray
      generated files cause baffling Kotlin errors (see CLAUDE.md).
- [ ] Build and submit:

  ```bash
  cd apps/mobile
  pnpm release patch --platform ios      # or --platform all for Play internal testing too
  ```

- [ ] In App Store Connect → TestFlight, add yourself as an **internal tester**. Internal testers
      get the build immediately with **no Beta App Review** — this is what lets the live test happen
      before the in-app-purchase question (plan §9b) is settled. Do **not** add external testers or
      submit for release yet.

---

## Phase 5 — The live test (real money, 1 kr)

On a real phone with the real Swish app and BankID installed:

- [ ] Info tab shows **1 kr**, not 250 — proves the fee is server-driven.
- [ ] Tap "Betala med Swish".
- [ ] **The Swish app opens.** ⚠️ This is the first time this is exercised — MSS tokens cannot open
      the real app, so it has never been verified.
- [ ] Sign with BankID.
- [ ] **You are returned to the app automatically.** ⚠️ Also unverified. If you land back on the
      home screen instead, the `callbackurl` encoding in `buildSwishUrl()` is the suspect — the
      Swish guide's example shows it double-encoded (`merchant%253A%252F%252F`) and we send it
      single-encoded. The payment still completes; only the return trip is affected, and polling
      recovers the status once you reopen the app.
- [ ] The sheet flips to paid and the celebration appears.
- [ ] The pay button is replaced by **"Du är medlem till och med 2027"**.
- [ ] Force-quit and reopen the app — still a member (this reads server state, not local).

---

## Phase 6 — Verify from the server side

- [ ] `GET /api/admin/payments?env=production` as a super admin → one `PAID` row, `amount: 1`, with
      a `paymentReference` and your `payerAlias`.
- [ ] **Check the Vercel logs to see which path settled it** — this is the one diagnostic worth
      doing carefully:
  - `SwishCallback` … `Callback processed` → the callback works end to end. Ideal.
  - only `MobilePaymentStatus` → polling settled it and **the callback never arrived**. The user
    experience is fine, but investigate before relying on it: check the callback URL, and whether
    anything upstream of Vercel blocks Swish's IP (`213.132.115.94`).

---

## Phase 7 — Flip to the real fee

- [ ] In Vercel Production, either set `MEMBERSHIP_FEE_SEK=250` or **delete the variable** — with it
      unset the code falls back to `MEMBERSHIP_FEE_SEK` from `@repo/types`, which is 250. Deleting
      is cleaner: one source of truth again.
- [ ] **Redeploy.** Vercel bakes environment variables at deploy time, so the change does not take
      effect until you hit "Redeploy" — no code change and no app build, but it is not zero-action.
- [ ] Confirm the app now shows **250 kr** without being reinstalled. That is the proof the whole
      server-driven-amount design works.

---

## Before going public

- [ ] Settle the in-app-purchase question — plan §9b. Internal TestFlight avoided it; external
      TestFlight and the App Store release will not.
- [ ] Decide whether to keep the 1 kr test payment on the books or write it off (there is no refund
      endpoint — `cancelPaymentRequest()` only cancels _unsigned_ requests).

---

## If something goes wrong

There is currently **no kill switch**. Reverting `SWISH_ENV` would make payment creation fail with a
configuration error rather than degrade gracefully. If you want one before taking real money, a
`MEMBERSHIP_PAYMENTS_ENABLED=false` flag that makes the create endpoint return a friendly Swedish
message — and hides the button via the membership endpoint — is about 20 lines. Worth having if the
fee is going public soon.

Known unknowns going in: the app-switch and return trip (Phase 5), and whether Swish's callback
reaches production (Phase 6). Both have a fallback — polling — so neither can lose a payment.
