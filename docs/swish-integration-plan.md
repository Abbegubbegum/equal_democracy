# Swish integration — implementation plan

Status: **planning**. Target: Swish Commerce API, **sandbox (MSS) first**, m-commerce
(app-switch) from the mobile app, for the 250 kr membership fee on the Info tab.

Sources: Swish Merchant Integration Guide 2.6 + developer.swish.nu API reference.

---

## 1. Facts from the Swish spec that constrain the design

| Thing                  | Value                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Sandbox (MSS) base     | `https://mss.cpc.getswish.net/swish-cpcapi`                                                                                  |
| Production base        | `https://cpc.getswish.net/swish-cpcapi`                                                                                      |
| Create payment request | `PUT /api/v2/paymentrequests/{instructionUUID}`                                                                              |
| `instructionUUID`      | 32 uppercase hex chars, **no dashes** — e.g. `11A86BE70EA346E4B1C39C874173F088`. We generate it.                             |
| Read status            | `GET /api/v1/paymentrequests/{instructionUUID}`                                                                              |
| Cancel                 | `PATCH /api/v1/paymentrequests/{id}`, `Content-Type: application/json-patch+json`, `[{op,path:"/status",value:"cancelled"}]` |
| Success                | `201 Created` + `Location` header + `PaymentRequestToken` header                                                             |
| App switch             | `swish://paymentrequest?token=<token>&callbackurl=<urlencoded return url>`                                                   |
| Prod Swish source IP   | `213.132.115.94:443` (optional IP allowlist on our callback)                                                                 |
| Server TLS root        | DigiCert Global Root CA (already in Node's trust store)                                                                      |
| Client auth            | mTLS, 4096-bit RSA client cert issued via portal.swish.nu                                                                    |

**Request body** (v2 create):

- required: `callbackUrl` (HTTPS only), `payeeAlias` (our Swish number), `amount`, `currency: "SEK"`
- optional: `payeePaymentReference` (1–36 chars, `a-z A-Z 0-9 -_.+*/`), `payerAlias`, `payerSSN`,
  `ageLimit`, `message` (max 50 chars, `a-öA-Ö0-9` and `:;.,?!()"`), `callbackIdentifier`

**m-commerce vs e-commerce:** omit `payerAlias` → Swish returns `PaymentRequestToken` and we
app-switch. Send `payerAlias` (the payer's phone, `46…`) → no token, Swish pushes the request to
that phone. **We do m-commerce on mobile.** E-commerce is what a future web checkout would use.

**Callback:** Swish POSTs the full Payment Request object to `callbackUrl` on `PAID` / `DECLINED` /
`ERROR` / `CANCELLED`. Retried up to 10 times (5s, 10s, 20s, 40s, 60s…) until we return `200`.
It is **unauthenticated** — the only verification mechanism is `callbackIdentifier` (32–36 chars
matching `^[0-9a-zA-Z-]{32,36}$`), which we send on create and Swish echoes back as a header.

**Timeouts:** consumer has 3 min to sign; backend gives up at 5–5.5 min and sends `ERROR` with
`errorCode: TM01`. So our UI's polling window is ~6 minutes, not indefinite.

**Statuses:** `CREATED` → `PAID` | `DECLINED` | `ERROR` | `CANCELLED`.
Notable error codes: `ACMT03` payer not enrolled, `RF07` declined (payer's Swish limit),
`BANKIDCL` payer cancelled BankID, `TM01` timeout, `DS24` timeout _after_ payment started
(**outcome unknown — we must tell the user to check with their bank**), `RP06` a payment request
already exists for that payer.

---

## 2. Certificates — where they live

**Never in git.** `*.pem` is already gitignored; we add `*.p12`, `*.key` and `apps/web/certs/`.

### Local staging dir (gitignored)

```
apps/web/certs/            # gitignored via apps/web/.gitignore `/certs`, never committed
├── Swish_Merchant_TestCertificate_1234679304.pem   # client cert + 2 intermediates (3-cert chain)
├── Swish_Merchant_TestCertificate_1234679304.key   # 4096-bit RSA private key, unencrypted PKCS#8
├── Swish_Merchant_TestCertificate_1234679304.p12   # same material bundled; unused by us
├── Swish_Merchant_TestCertificate_1234679304.csr   # the signing request; unused by us
└── Swish_TLS_RootCA.pem                            # DigiCert Global Root G2 — the *server* root; unused (see below)
```

Swish ships the `.pem` and `.key` alongside the `.p12`, so **no openssl extraction is needed** —
the `.pem` is already the full chain (leaf `CN=1234679304` → Nordea Customer CA1 → Nordea Root CA
→ Swish Root CA v2 Test), which is exactly what Swish requires. The conversion commands below are
only relevant if you are ever handed a bare `.p12`.

`Swish_TLS_RootCA.pem` is DigiCert Global Root G2 — the root for verifying **Swish's server**
certificate, not our client one. Node already trusts it, so `SWISH_CA_BASE64` stays unset. Setting
it would _replace_ Node's trust store rather than extend it, which pins us to that one root and
breaks if Swish ever rotates.

### Runtime: base64 env vars (identical local + Vercel — one code path)

```env
SWISH_ENV=mss                 # mss | production
SWISH_PAYEE_ALIAS=1234679304  # MSS test merchant number; real Swish number in prod
SWISH_CERT_BASE64=<base64 of swish-mss.crt.pem>
SWISH_KEY_BASE64=<base64 of swish-mss.key.pem>
SWISH_CA_BASE64=              # optional; empty = Node's default trust store
SWISH_CALLBACK_BASE_URL=https://www.vallentuna.app
```

Vercel env vars are **environment-scoped**: MSS cert in Development + Preview, the real cert only in
Production. Vercel caps total env var size at 64 KB — a 4096-bit key + chain base64s to roughly
10–14 KB, so it fits, but that's worth sanity-checking before the prod deploy.

### Conversion commands (only needed for a bare .p12)

```bash
openssl pkcs12 -in Swish_Merchant_TestCertificate_1234679304.p12 -clcerts -nokeys -out swish-mss.crt.pem -passin pass:swish
openssl pkcs12 -in Swish_Merchant_TestCertificate_1234679304.p12 -nocerts -nodes  -out swish-mss.key.pem -passin pass:swish
```

Plus a helper `apps/web/scripts/swish-cert-to-env.mjs` that prints ready-to-paste
`SWISH_CERT_BASE64=…` / `SWISH_KEY_BASE64=…` lines, so nobody has to remember the incantation.

### How Node does mTLS here

Node 22's `fetch` can't attach a client certificate. We use `node:https` `request()` with
`{cert, key, ca}` on a **module-level cached `https.Agent`** — same rationale as `connectDB()`'s
cached connection: one agent per lambda instance, TLS handshakes reused. Pages API routes are Node
runtime, not Edge; they must stay that way.

---

## 3. New files — `apps/web`

| File                            | Responsibility                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/swish/config.ts`           | Reads env, decodes base64 certs once, exports `SWISH_BASE_URL`, `payeeAlias`, `callbackUrl`, and the cached `https.Agent`. Loud descriptive error if a var is missing. |
| `lib/swish/client.ts`           | `swishRequest(method, path, body, headers)` → low-level mTLS call returning `{status, headers, body}`. Owns timeouts + error normalisation. No business logic.         |
| `lib/swish/payments.ts`         | `createPaymentRequest()`, `getPaymentRequest()`, `cancelPaymentRequest()`. Typed wrappers; maps the 422 validation array to readable messages.                         |
| `lib/membership.ts`             | `applyPaidPayment(payment)` — the single place that flips a `User` to member and sets `membershipPaidUntil`. Idempotent.                                               |
| `scripts/swish-cert-to-env.mjs` | p12/pem → base64 env lines.                                                                                                                                            |

### Model changes — `lib/models.ts`

New `Payment` collection:

| Field                                    | Notes                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `userId`                                 | ref User, indexed                                                           |
| `instructionId`                          | 32-hex uppercase, unique — what we PUT to Swish                             |
| `callbackIdentifier`                     | uuid v4 with dashes (36 chars), our callback shared secret                  |
| `payeePaymentReference`                  | the `Payment._id` as hex — lets us find the doc from any Swish object       |
| `paymentReference`                       | from Swish, only on PAID                                                    |
| `amount`, `currency`, `message`          |                                                                             |
| `status`                                 | `CREATED \| PAID \| DECLINED \| ERROR \| CANCELLED`                         |
| `errorCode`, `errorMessage`              |                                                                             |
| `payerAlias`                             | returned by Swish once the payer signs                                      |
| `purpose`                                | `"membership"` — leaves room for future donations/other payments            |
| `membershipYears`                        | `[2026, 2027]` for the founding-member deal                                 |
| `env`                                    | `"mss" \| "production"` — so sandbox rows are never mistaken for real money |
| `dateCreated`, `datePaid`, `rawCallback` |                                                                             |

`User` gains `membershipStatus`, `membershipPaidUntil`, `membershipFirstPaidAt`.

⚠️ `User` currently uses `safeModel()` — adding fields requires switching it to the
delete-then-`mongoose.model()` force-refresh pattern, or Mongoose strict mode silently drops the new
fields during HMR. (See the "Mongoose Model Cache" note in CLAUDE.md.)

`packages/types/src/payment.ts` gets the matching `Payment` / `PaymentStatus` types.

---

## 4. API endpoints

| Route                                   | Auth          | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/mobile/payments/swish`       | Bearer        | Create the m-commerce payment request. Creates the `Payment` doc first (so `_id` can be the `payeePaymentReference`), generates `instructionUUID` + `callbackIdentifier`, PUTs to Swish, stores the token. Returns `{ paymentId, token, amount, resumed }` — the app builds the `swish://` URL itself, since only it knows its own return scheme. Rejects if the user already has a `CREATED` payment younger than 6 min (Swish answers `RP06` anyway) or is already a member. |
| `GET /api/mobile/payments/[id]`         | Bearer        | Poll **our** DB, not Swish. If still `CREATED` and older than ~20 s, do one on-demand `GET` against Swish and persist the result — the belt-and-braces path for when the callback is slow, or when we're on localhost where callbacks can't reach us. Returns `{ status, errorCode, message }`.                                                                                                                                                                                |
| `POST /api/swish/callback`              | **none**      | Swish → us. Verifies the `callbackIdentifier` header against the stored one, only transitions `CREATED` → terminal, never trusts the callback's `amount` (compares to stored), calls `applyPaidPayment()` on `PAID`, always returns `200` fast. **Must be excluded from CSRF.**                                                                                                                                                                                                |
| `POST /api/mobile/payments/[id]/cancel` | Bearer        | User backed out — PATCH-cancels at Swish so the request doesn't linger. Phase 2.                                                                                                                                                                                                                                                                                                                                                                                               |
| `GET /api/admin/payments`               | admin         | List payments with status/user/amount, for reconciliation and member counting. Phase 2.                                                                                                                                                                                                                                                                                                                                                                                        |
| `POST /api/payments/reconcile-swish`    | `CRON_SECRET` | Daily cron: any `CREATED` payment older than 10 min gets a `GET` against Swish and is closed out. Guards against dropped callbacks. Added to `apps/web/vercel.json`.                                                                                                                                                                                                                                                                                                           |

---

## 5. Files — `apps/mobile`

| File                        | Change                                                                                                                                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/swish.ts`              | New. `startSwishPayment()`: POST create → `Linking.openURL(appSwitchUrl)` → returns `paymentId`. Plus `pollPaymentStatus(paymentId, onUpdate)` with a ~6 min ceiling, 2 s interval, resuming on app foreground (`AppState`).                                   |
| `lib/SwishPaymentSheet.tsx` | New. Modal, same shape as `MajReviewSheet` / `CelebrationModal`. States: `idle → creating → awaiting` (spinner + "Öppna Swish igen" retry) `→ paid / declined / error`, all copy in Swedish. On `PAID` → `CelebrationModal`.                                   |
| `app/(app)/membership.tsx`  | Enable the currently `disabled` "Betala med Swish" button; add a member badge / "Medlem till 2027" state; remove "Betalning aktiveras snart".                                                                                                                  |
| `lib/auth-context.tsx`      | Expose `membershipStatus` on the user so the Info tab renders without an extra fetch.                                                                                                                                                                          |
| `app.json`                  | `ios.infoPlist.LSApplicationQueriesSchemes: ["swish"]` so `canOpenURL("swish://")` works. Android package-visibility (`<queries>` for `se.bankgirot.swish`) needs a small local config plugin — or we skip the installed-check on Android and catch `openURL`. |

Return-from-Swish deep link uses the app's existing scheme: `vallentunaframat://`. The guide's own
example shows the `callbackurl` **double-URL-encoded** (`merchant%253A%252F%252F`) — a sandbox
detail to verify empirically rather than guess at.

---

## 6. Flow

```
Mobile                    Our API                     Swish
  │  tap "Betala"           │                           │
  ├────────────────────────>│  create Payment(CREATED)  │
  │                         ├── PUT v2/paymentrequests ─>│
  │                         │<── 201 + token ───────────┤
  │<── {paymentId, token} ──┤                           │
  │  openURL swish://…      │                           │
  │  ── user signs w/ BankID in Swish app ────────────>│
  │                         │<── POST /api/swish/callback (PAID)
  │                         │    applyPaidPayment()     │
  │  poll GET /payments/id  │                           │
  │<── {status: PAID} ──────┤                           │
  │  celebration + member   │                           │
```

---

## 7. Sandbox / local-dev reality check

- MSS **validates and simulates** — it returns correctly-formatted responses and fires callbacks,
  but the token does not drive a real Swish app switch and no money moves. Sandbox proves the API
  plumbing, the callback handling and our state machine; the actual app-switch UX can only be
  verified on production credentials with a real (small) payment.
- MSS callbacks still go to a **public HTTPS URL** — they cannot reach `localhost`. Two options:
  point `SWISH_CALLBACK_BASE_URL` at a tunnel (cloudflared/ngrok), or lean on the polling path in
  `GET /api/mobile/payments/[id]` during local dev and exercise the callback only on a deployed
  preview. The polling fallback is worth building either way, so option B costs us nothing.
- Native testing needs an **EAS dev client**, not Expo Go, _if_ we add the iOS
  `LSApplicationQueriesSchemes` entry or an Android config plugin — those are native manifest
  changes. A plain `Linking.openURL` without the installed-check works in Expo Go.

---

## 8. Security / production-readiness checklist

- [x] Callback route excluded from CSRF (opt-in per route in this codebase — simply never added).
- [x] Callback settled from an authoritative Swish re-fetch, not the POST body; `callbackIdentifier` checked when present.
- [x] Amount never taken from the callback; compared against the stored amount.
- [x] Status transitions are one-way (`CREATED` → terminal); replayed callbacks are no-ops.
- [x] `applyPaidPayment()` idempotent — Swish retries up to 10×.
- [x] `env` recorded on every `Payment`; sandbox rows can never count as real membership in prod.
- [ ] Cert env vars scoped per Vercel environment; prod cert never in Preview.
- [x] Cached `https.Agent` at module level (cold-start friendly, no per-request handshake).
- [x] Reconcile cron registered in `vercel.json` (03:30 daily) and scoped to `SWISH_ENV`.
- [ ] Optional: IP allowlist `213.132.115.94` on the callback in production.
- [x] `.gitignore`: `*.p12`, `*.key`, `*.csr` at the root; `/certs` in `apps/web`.

---

## 9. Build order (small reviewable chunks)

1. ~~**Certs + config + client**~~ — ✅ **done 2026-08-21.** `lib/swish/{config,client}.ts`,
   `scripts/swish-cert-to-env.mjs`, `scripts/test-swish-connection.mjs`, gitignore hardening,
   `SWISH_*` vars in `.env.local`. Verified: mTLS handshake against MSS succeeds and Swish accepts
   the client certificate (`GET` for an unknown payment request → `404 RP04` in ~170 ms).
2. ~~**Model + types**~~ — ✅ **done 2026-08-21.** `Payment` model in `lib/models.ts` (force-refresh
   pattern), `membershipStatus` / `membershipPaidUntil` / `membershipFirstPaidAt` on `User`,
   `packages/types/src/payment.ts` with the membership constants. Verified against the dev DB:
   all six indexes build, the `instructionId` unique constraint rejects duplicates with `E11000`,
   and the `status` enum rejects bad values.

   Two notes from building it: (a) `payeePaymentReference` is **not** a stored field — the doc's
   own `_id` is what we send, so the `Payment` row must be created _before_ the Swish call;
   (b) index builds race the first write on a brand-new collection, so the very first payment in
   production may be written before the unique index exists. Harmless here, since `instructionId`
   is a random 32-hex UUID, but it is why a duplicate slipped through on the first smoke test.

3. ~~**`lib/swish/payments.ts`** + the create endpoint~~ — ✅ **done 2026-08-21.**
   `POST /api/mobile/payments/swish` verified end-to-end against MSS: `201` with a real
   `PaymentRequestToken`, resume path returns the same token with `resumed: true`, `401`/`405`
   correct.

   Findings that change later chunks:
   - **MSS auto-pays.** A created request flips to `PAID` about 4 seconds later, with a simulated
     `payerAlias` (`46464646464`) and a real `paymentReference`. So the full happy path _is_
     testable in sandbox — chunks 4 and 5 can be verified for real, not just mocked.
   - **`å` is fine.** MSS stored `"Medlemsavgift Vallentuna Framåt"` verbatim; no RP02.
   - **Amount:** we send `"250.00"` (string, as the Swish examples do) and MSS stores `250`.
   - **`payeePaymentReference` round-trips** as our `Payment._id` exactly.
   - **MSS really does call the callback URL**, which currently points at production where
     `/api/swish/callback` does not exist yet — expect 404s in the prod log until chunk 4 ships.
   - `CreatePaymentResult` had to become a flat interface instead of a discriminated union: with
     `strict` off, TS will not narrow on a boolean-literal discriminant.
   - The mobile app builds the `swish://` URL itself rather than the server returning an
     `appSwitchUrl` — the return scheme differs between Expo Go (`exp://`) and a standalone build,
     so only the app knows it. The server returns just the `token`.

4. ~~**Callback endpoint** + `lib/membership.ts`~~ — ✅ **done 2026-08-21.** `POST /api/swish/callback`,
   `lib/membership.ts`, and `lib/swish/settle.ts` (extracted so chunks 5 and 7 settle identically).
   19/19 assertions pass against MSS.

   The design changed in one important way from the plan: **the callback body is never trusted at
   all.** Rather than verifying the body and reading the amount from it, the route re-fetches the
   payment from Swish over mTLS and settles from that. Forgery is then pointless regardless of
   headers, and it removes the dependence on `callbackIdentifier` being present — which matters
   because a missing header would otherwise block every genuine callback. The identifier is still
   checked when present, as defence in depth, and a mismatch is a `403`.

   Verified: forged identifier → `403` and payment untouched; a body claiming `amount: 99999` still
   settles at 250; replay claiming `ERROR/TM01` after `PAID` leaves the payment `PAID`; unknown and
   malformed callbacks → `200` (so Swish stops retrying); `GET` → `405`; and a payment marked
   `env: "production"` settles but is **refused** membership by an `mss` runtime.

   Note `payments.deleteMany` / membership reset ran afterwards — no test data left in the dev DB.

5. ~~**Status/polling endpoint**~~ — ✅ **done 2026-08-21.** `GET /api/mobile/payments/[id]`.
   19/19 assertions pass. **A payment now settles end-to-end with no callback whatsoever**, which
   is the thing that makes local development work — the polling-only decision is validated, not
   just assumed.

   Added a `lastPolledAt` field to `Payment`: the app polls every ~2 s, so without a throttle each
   poll would become an mTLS round trip to Swish. It now asks Swish at most once per 5 s per
   payment. A Swish outage during that check is swallowed — the UI keeps showing "waiting" and the
   reconcile cron closes it out — rather than surfacing as a failed poll.

   Also verified: another user's payment id returns `404` (not the payment); a malformed id returns
   `404` rather than a `CastError` 500; and terminal states map to Swedish text without ever
   leaking a raw Swish error code (`BANKIDCL` → "Du avbröt signeringen med BankID.", `DS24` → tells
   the user to check with their bank, unknown codes → a generic message).

6. ~~**Mobile:** `lib/swish.ts` → `SwishPaymentSheet.tsx` → wire into `membership.tsx`~~ —
   ✅ **done 2026-08-21.** Type-check and lint clean. **Not yet run on a device** — see below.

   One endpoint was added that the plan did not anticipate: `GET /api/mobile/user/membership`.
   Without it a paying member would see "Betala med Swish" again on every launch, because the
   stored auth user never changes and access tokens live for 7 days. The plan's idea of putting
   `membershipStatus` on the auth context was dropped for the same reason — it would go stale.

   **Bug found and fixed during testing:** the member badge read "Du är medlem till och med
   **2028**" for a membership running through 2027. `membershipPaidUntil` is stored as UTC
   end-of-year (`2027-12-31T23:59:59.999Z`) and Sweden is UTC+1/+2, so `getFullYear()` rolls into
   the next year. `paidUntilYear()` now uses `getUTCFullYear()`. This only surfaced because the
   test asserted on the _rendered_ year rather than the raw value.

   Other decisions: joining awards **5 stars** (matching a citizen proposal — `MEMBERSHIP_STARS`,
   one line to change) because `CelebrationModal` renders an empty star burst at 0; the
   `useEffect` in the sheet is deliberately keyed on `visible` alone with an eslint-disable, since
   including `start` would create a new payment request on every render.

   Still unverified on hardware: the `swish://` app switch, whether `callbackurl` needs single or
   double URL-encoding (the Swish guide's example shows it double-encoded), and the return trip
   into the app. None of these can be tested against MSS — its tokens do not open the real Swish
   app.

7. ~~**Reconcile cron + admin list**~~ — ✅ **done 2026-08-21.**
   `POST /api/payments/reconcile-swish` (registered in `vercel.json` at 03:30) and
   `GET /api/admin/payments`. 19/19 assertions pass.

   The cron is **scoped to the deployment's own `SWISH_ENV`** — without that filter, a production
   run would look up sandbox payments against the production API, fail to find them, and mark them
   abandoned. Two age thresholds rather than one: at 10 minutes a `CREATED` payment is settled from
   Swish (its backend gives up at 5.5, so an outcome exists by then), but a payment Swish has never
   heard of is only abandoned after 24 hours — long enough that a slow or partially-failed create
   is not written off prematurely.

   Verified: fresh payments untouched; a backdated one settles and **the cron itself grants
   membership**; a `production` row is invisible to an `mss` run; an 11-minute ghost is held as
   `stillPending` while a 25-hour ghost becomes `ERROR`/`UNKNOWN_AT_SWISH`; cron auth rejects a
   missing and a wrong secret; the admin ledger is `403` without a super-admin session.

   ⚠️ **Schedule needs your decision.** It is set to daily to match the existing cron and stay
   within Vercel Hobby's once-a-day cron limit. If you are on Pro, make it hourly — on daily, a
   user whose callback is lost _and_ who closes the app stays a non-member for up to 24 hours
   despite having paid. Polling covers the common case, so this only affects that narrow overlap.

   `CRON_SECRET` was missing from `.env.local` and was added with a local-only dev value.

8. **Production switch** — written up as a step-by-step checklist:
   [swish-go-live-checklist.md](swish-go-live-checklist.md). Production cert → Vercel Production env
   vars → `MEMBERSHIP_FEE_SEK=1` → EAS build → **internal** TestFlight (no App Review) → live 1 kr
   test → flip to 250 with a redeploy, no new app build.

---

## 9b. App Store / Play in-app-purchase exposure (researched 2026-08-21)

**The risk is real and concentrated in one benefit.** Apple guideline 3.1.1: _"If you want to
unlock features or functionality within your app … you must use in-app purchase."_ The membership
benefit **"Utökad rösträtt till en röst varje månad"** — and the product rule behind it (1 vote per
fullmäktige for paying members vs 2 per year for non-members) — means paying unlocks in-app
functionality. The other three benefits (candidacy, funding the party, event invitations) are
real-world.

**The two rules conflict while the benefits are bundled.** Guideline 3.1.3(e) says apps selling
goods/services _consumed outside the app_ **must use a method other than IAP** — so for the
real-world benefits, Swish is not merely allowed but required. For the in-app voting benefit, IAP
is required. One 250 kr fee cannot satisfy both; the product has to land on one side.

**Internal TestFlight skips App Review**, which unblocks the live test. Up to 100 internal testers
(App Store Connect users) receive builds with no Beta App Review; only external TestFlight and the
public release are reviewed. So the 1 kr production test can run before this is resolved — it only
gates the public release.

Options, best first:

1. **Decouple voting rights from payment** — tie extended voting to BankID-verified Vallentuna
   residency (already planned) rather than to paying. Membership then buys candidacy, events and
   funding: all real-world, 3.1.3(e) applies cleanly. Also a better fit for a party whose pitch is
   equal influence.
2. **Argue party governance, not digital goods** — members of an ideell förening hold governance
   rights by law and the app only reflects them. Worth stating in review notes, but it depends on a
   reviewer accepting a nuance.
3. **Ask App Review in writing before submitting** — slow, but beats a rejection on a live app.
4. **IAP on iOS / Swish on Android** — compliant, 15–30% commission, significant work. The EU DMA
   external-link route is worse: 5%+ fees and you may not offer IAP and external payment for
   digital goods in the same EU app.

Google Play's payments policy is structurally the same, so the decision should cover both stores.
(Guidelines read, not legal advice; review outcomes vary.)

---

## 10. Decisions taken

- **Local dev callback: polling only.** No tunnel. `GET /api/mobile/payments/[id]` does the
  on-demand Swish status check; the real callback path is exercised on a deployed Vercel preview.
- **Scope: mobile only.** m-commerce app-switch from the Info tab. A web checkout (e-commerce with
  a `payerAlias` phone input) is a later chunk, not part of this work.
- **Pricing: hardcoded constants.** `MEMBERSHIP_FEE_SEK = 250`, `MEMBERSHIP_YEARS = [2026, 2027]`,
  same pattern as `PRE_ELECTION_LIMIT` / `CITIZEN_PROPOSAL_LIMIT`. No `Settings` plumbing.

### Still open

- Stars/celebration on a successful payment, consistent with the rest of the app's gamification?
