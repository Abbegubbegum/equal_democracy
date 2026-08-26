# BankID vote verification — implementation plan

Provider: **Svensk E-identitet (GrandID / eID API)**, docs at <https://docs.grandid.com>.
Mode: **BankID signing via GrandID's hosted UI.** Established by live testing on
2026-08-24/25 (§2): service key `…69dc` with `gui=true` returns a real signature
(`funcId: Signing`) _and_ the SPAR folkbokföring block in one transaction. Both
halves of that sentence were wrong in earlier drafts.

Model: **verification per vote, not per login.** A user's app account stays email+OTP.
Every ballot cast triggers one BankID signature whose result must show
(a) age ≥ 16 and (b) folkbokförd in Vallentuna kommun. Only then does the
`QuestionVote` row get written. The vote's existence _is_ the proof — nothing
about the person is kept beyond what section 3a decides.

Same working style as the Swish integration: small stages, each independently
verifiable before the next one starts.

---

## 1. Facts from the GrandID spec that constrain the design

Everything here is from `docs.grandid.com` (BankID V3 + SPAR pages, read 2026-08-24).

**Transport.** Plain HTTPS with `multipart/form-data` — **no mTLS**, no client
certificate. Auth is two form fields on every call: `apiKey` and
`authenticateServiceKey`. This is much simpler than Swish; `lib/bankid/client.ts`
can use global `fetch`, not `node:https`.

| Env  | Base URL                          |
| ---- | --------------------------------- |
| test | `https://client-test.grandid.com` |
| prod | `https://client.grandid.com`      |

**Two endpoints matter.**

- `POST /json1.1/FederatedLogin` — starts a session. With `gui=false` it returns
  `{ sessionId, autoStartToken, QRCode? }`. With GUI it returns
  `{ sessionId, redirectUrl }` pointing at `login.grandid.com`.
- `POST /json1.1/GetSession` — takes `sessionId`, returns the outcome.
  Also `GET /json1.1/Logout` with `cancelBankID=true` to abort an in-flight order.

**Polling, not callbacks.** Unlike Swish there is no server-to-server callback.
In `gui=false` mode we poll `GetSession` — the docs mandate **no more often than
every 2 seconds**. `callbackUrl` only controls where the _end-user's browser_ is
redirected (with `?grandidsession={id}` appended), which is a GUI-mode concept.
Consequence: **no new unauthenticated endpoint** in this integration. Good.

**GetSession response shapes** (all four must be handled):

```jsonc
// still running
{ "grandidObject": { "code": "BANKID_MSG",
    "message": { "status": "pending", "hintCode": "outstandingTransaction" },
    "sessionId": "…", "autoStartToken": "…", "QRCode": "…" } }

// failed  (hintCode: userCancel | startFailed | expiredTransaction | …)
{ "grandidObject": { "code": "BANKID_MSG",
    "message": { "status": "failed", "hintCode": "userCancel" }, "sessionId": "…" } }

// completed
{ "sessionId": "…", "username": "YYYYMMDDXXXX",
  "userAttributes": { "personalNumber": "YYYYMMDDXXXX", "name": "…",
    "givenName": "…", "surname": "…", "ipAddress": "…",
    "notBefore": "…", "notAfter": "…", "signature": "…", "ocspResponse": "…",
    "bankIdIssueDate": "…" } }

// not started / unknown session
{ "errorObject": { "code": "NOTLOGGEDIN", "message": "…" } }
```

A completed session is identified by the **absence** of `grandidObject`/`errorObject`
and the presence of `userAttributes.personalNumber` — there is no `status: "complete"`
field. Code accordingly.

**SPAR is an add-on to the auth service, not a separate call.** Both SPAR pages say
it is "initiated automatically after an e-legitimation authentication and added to
the response". So one FederatedLogin + GetSession gives us personnummer _and_
folkbokföring. Two possible shapes depending on which version our service key has:

```jsonc
// SPAR v1 — flat
"userAttributes": { "SPAR": {
    "spakoFolkbokfordLanKod": "01", "spakoFolkbokfordKommunKod": "15",
    "spakoPostNr": "18600", "spakoPostort": "VALLENTUNA",
    "spakoSekretessmarkering": "N" } }

// SPAR v2 — nested, SPAR's own ns-prefixed names
"userAttributes": { "SPARv2": {
    "ns4PersonId": { "ns4IdNummer": "…", "ns4Typ": "PERSONNUMMER" },
    "ns5Sekretessmarkering": "NEJ",
    "ns14Folkbokforing": { "ns14FolkbokfordLanKod": "01",
                           "ns14FolkbokfordKommunKod": "15",
                           "ns14Folkbokforingsdatum": "2003-01-01",
                           "ns14Hemvist": "Skriven på adressen" },
    "ns10Persondetaljer": { "ns10Fodelsedatum": "1957-04-13",
                            "ns9Avlidendatum": "…",
                            "ns9AvregistreringsorsakKod": "UV" } } }
```

**The v2 spec's own disclaimer is load-bearing** and the parser must obey it:

> Your implementation **MUST** be able to handle any of the documented properties
> being excluded … **MUST** be able to handle a property documented as an object,
> being returned as a list of said object.

So: never assume a field exists, and normalise object-or-array on every
`*Collection` property (`ns14Folkbokforing`, `ns10Persondetaljer`, addresses).
Where a list is returned, pick the entry whose `ns2DatumTill` is `9999-12-31`
(the currently valid one), not `[0]`.

**Vallentuna is kommunkod 0115** → `LanKod === "01" && KommunKod === "15"`.
A real capture reads `lan=14 kommun=80` (Göteborg, 1480), which confirms the
field semantics and the two-part split. A true positive still needs a signature
from an actual Vallentuna resident.

**GUI mode returns no QR and no `autoStartToken`** — just a `redirectUrl`. (For
the record, in the non-GUI flow the `QRCode` field is a base64 **SVG**, not the
PNG the docs' `"BASE64_QR_CODE_DATA"` placeholder implies. Irrelevant now that
the flow is settled, but it is the kind of thing the docs get wrong.)

**Requests must come from our backend.** The Mobile Integrations page is explicit:
FederatedLogin and GetSession **MUST NOT** be called from inside the app. The RN
app only ever talks to `/api/mobile/*`, exactly like the Swish flow.

**Signing vs authenticating** is decided by which field carries the text:
`userVisibleData` produces a signature, `authMessage` merely displays text during
an authentication. See section 2 — we sign.

**There is no sandbox.** Both service keys are rejected by
`client-test.grandid.com` with `APIKEYNOTVALID01` and accepted by
`client.grandid.com`. Every test is therefore a real BankID transaction against a
real identity. See section 8.

---

## 2. What the live runs proved (2026-08-24/25)

### 2a. The service key decides sign vs authenticate — not the request

The docs say `userVisibleData` is what turns a call into a signature. That is
not how this provider behaves, and believing it cost two wrong conclusions in a
row. `funcId`, read out of the completed signature, tracks the **service key**
and ignores the payload entirely:

| service | request payload      | `funcId`                            |
| ------- | -------------------- | ----------------------------------- |
| `…7c8c` | `authMessage`        | `Identification`                    |
| `…7c8c` | `userVisibleData`    | `Identification`                    |
| `…7c8c` | no text at all       | `Identification`                    |
| `…69dc` | `userVisibleData`    | `Signing`                           |
| `…69dc` | no `userVisibleData` | refused — `BANKID_AUTH_NOT_ALLOWED` |

So `…7c8c` is an **authentication service** and `…69dc` is a **signing
service**, and each does only its own thing. A signing service cannot
authenticate, which is why omitting `userVisibleData` there is an error rather
than a fallback.

**What this means for us.** `…69dc` is the service a vote must use, and it is
what `.env.local` points at. The danger is not a request being downgraded — it
is pointing `GRANDID_SERVICE_KEY` at the wrong service. Do that and every vote
returns a perfectly ordinary success carrying `funcId: Identification`: BankID
identified the voter, signed nothing, bound them to no ballot, and reported no
error anywhere in the response. The only symptom is the BankID app saying
_"verifiering"_ instead of _"signering"_ — which is exactly how this was caught.

`readOrderType()` in `lib/bankid/session.ts` therefore exists to answer "which
service did we actually reach?", and Stage 4's settle step **must reject
anything that is not `Signing`** before writing a vote.

### 2b. SPAR requires GUI mode — and that decides the delivery mechanism

SPAR is attached, but only the hosted-UI flow returns it. All four combinations
were completed with a real BankID:

|             | `gui=false` | `gui=true`                       |
| ----------- | ----------- | -------------------------------- |
| **`…7c8c`** | no SPAR     | SPAR ✓ (`funcId Identification`) |
| **`…69dc`** | no SPAR     | SPAR ✓ (`funcId Signing`)        |

Nothing else differed between the runs — the `--no-gui` control in the
diagnostic shares the entire parameter set and flips only `gui` (it must also
force `qr`/`thisDevice`, since with `gui=false` nothing would drive BankID).

**The production configuration is therefore `…69dc` + `gui=true` + sign mode.**
One transaction yields all three things a vote needs, verified in the capture:

- `funcId: Signing` — confirming we reached the signing service, not the
  authentication one (§2a)
- `usrVisibleData` + `usrNonVisibleData` — the ballot text signed, and our own
  identifiers bound into the same signature
- `userAttributes.SPARv2` — folkbokföring, so residency is decidable

An earlier draft of this section claimed SPAR was attached to neither service and
called it a blocker. That was wrong: it was measured only against `gui=false`,
which was the one variable that mattered.

### 2c. Consequence: the app-switch design is out

This is the real cost of the finding. `gui=true` returns a `redirectUrl` to
`login.grandid.com` and **no `autoStartToken` and no QR** — GrandID's page drives
BankID itself. So the clean `swish://`-style app-switch sketched in §7 cannot be
used, and neither can the terminal QR.

The QR-rendering helper written for the app-switch flow has been deleted with it.

The mobile flow becomes: open `redirectUrl` in the **system browser** via
`WebBrowser.openAuthSessionAsync` (expo-web-browser), and keep polling our own
endpoint exactly as before. Deliberately _not_ a WebView: GrandID's Mobile
Integrations page warns that a WebView breaks when the hosted page launches
`bankid://` (`ERR_UNKNOWN_URL_SCHEME`) and that the app must intercept the
navigation itself. The system browser lets the OS handle the scheme, which is the
same reason OAuth flows use it.

Unchanged by this: the server still polls `GetSession`, the vote is still
written only by settle, and there is still no unauthenticated callback endpoint.
The app learns the outcome by polling — never from the redirect.

The `callbackUrl` is nonetheless set, to the app's own deep link, because the
browser has to hand control back. `WebBrowser.dismissBrowser()` is **iOS-only**,
so without it an Android voter would sign, land back on GrandID's completion
page, and have to press back to discover their vote had counted. Accepted forms,
verified against the live API:

| callbackUrl                       |                                              |
| --------------------------------- | -------------------------------------------- |
| `vallentunaframat://vote`         | accepted                                     |
| `exp://192.168.1.10:8081/--/vote` | accepted (Expo Go)                           |
| `https://www.vallentuna.app/…`    | accepted                                     |
| `vallentunaframat:///vote`        | **rejected** — `INCORRECT_CALLBACK_URL_DATA` |

The three-slash form is the trap, and it is what `Linking.createURL` can emit, so
both sides collapse it. The server allowlists the prefix rather than passing it
through: GrandID appends `?grandidsession=…` to whatever it is given.

## 3. Decisions that need answers before code (see §12)

Two of them change the data model, so they gate Stage 3.

### 3a. Double-voting across accounts ✅ decided

**Signing does not solve this.** A signature proves the voter approved that
ballot; it says nothing about whether the same human already voted from a second
app account. Both signatures would be genuine, both votes would verify, and
nothing would link them — and unlike most integrity bugs this one leaves no
trace anyone could audit afterwards.

Decision: store a **per-question voter pseudonym** on the vote.

```
pnrHash = HMAC-SHA256(VOTE_ID_PEPPER, personnummer + ":" + questionId)
```

with a unique sparse index on `{questionId, pnrHash}`.

**Correcting an earlier claim in this document.** It said a per-vote hash avoids
building a voting profile. That was wrong: with a single global pepper the same
person's hash is identical on every question, so anyone with database access
could trace their whole record. Mixing the question into the salt is what
actually delivers the property — dedup still works within a question, and two
rows from the same person are unlinkable across questions.

Note the votes were never anonymous to begin with: `QuestionVote` already stores
`userId`. The pseudonym adds the ability to spot one _person_ behind two
_accounts_, which is precisely its job.

The pepper is the whole protection: a personnummer has ~10^10 plausible values,
so anyone holding both the hashes and the pepper could brute force every voter
in seconds. Treat it like `NEXTAUTH_SECRET`, and never rotate it — every
existing hash would stop matching and the duplicate protection would silently
reset.

**Accepted residual risk:** deleting an account deletes its votes, pseudonym
included, so the same person could re-register and vote again on a question they
had already voted on. Retaining the pseudonym past erasure has no legal basis of
the kind that lets us keep `Payment` rows, and each repeat costs another BankID
signature, so this is documented rather than solved.

### 3b. Age rule ✅ decided

`≥ 16`, measured **at the moment of voting**. `AGE_REFERENCE_DATE` in
`lib/bankid/eligibility.ts` is `null` for that; set it to `"2026-09-13"` to
measure against election day instead. Birth date comes from SPAR's
`ns10Fodelsedatum`, falling back to the personnummer.

### 3c. Edge cases the eligibility function must rule on

Each needs a yes/no now, because each is a branch in Stage 2:

- **Sekretessmarkering / skyddad folkbokföring** (`JA` / `"J"`): SPAR returns
  limited data — the kommun field may be absent, so eligibility is undecidable.
  Proposal: **reject with a specific message** telling the user to contact us,
  rather than a generic "du är inte röstberättigad". Never silently pass.
- **Samordningsnummer** (`ns4Typ !== "PERSONNUMMER"`): not folkbokförd. Reject.
- **Avliden / avregistrerad** (`ns9Avlidendatum`, `ns9AvregistreringsorsakKod`
  e.g. `UV` = utvandrad): reject.
- **SPAR block missing entirely**: this means the add-on is not attached to the
  service key, i.e. a **configuration failure, not an ineligible user**.
  Must fail closed with a distinct error code and an alert-worthy log line —
  never fall through to "eligible".

---

## 4. New files

### `apps/web/lib/bankid/`

| File             | Purpose                                                                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.ts`      | `getGrandIdConfig()` — env → `{ env, baseUrl, apiKey, serviceKey }`, cached at module level. Mirrors `swish/config.ts` minus the cert handling.                                                                                                            |
| `client.ts`      | `grandIdRequest(endpoint, fields)` — multipart POST via global `fetch`, 15 s timeout, structured logging. Returns the parsed body; throws only on transport failure.                                                                                       |
| `session.ts`     | `startAuth({ authMessage, returnUrl, deviceData })` → `{ sessionId, autoStartToken }`; `getSession(sessionId)` → discriminated result; `cancelAuth(sessionId)`. Owns the four-shaped response parsing.                                                     |
| `eligibility.ts` | **Pure functions, zero I/O.** `parseSparAttributes(userAttributes)` (handles v1/v2 + object-or-array) and `checkEligibility(attrs)` → `{ eligible, reason, code }`. Unit-testable against fixtures.                                                        |
| `settle.ts`      | `settleVerification(verification, sessionResult)` — the single place a verification row moves out of `PENDING`, **and the only place a verified `QuestionVote` is written.** Same one-way-transition contract as `swish/settle.ts`, so replays are no-ops. |

### `apps/web/scripts/test-grandid-connection.mjs`

Diagnostic that proves the credentials work before any app code exists — the
equivalent of `test-swish-connection.mjs`. Starts a real test-env session,
prints `autoStartToken` + the QR, polls `GetSession`, dumps the full
`userAttributes` on completion. **This is also how we discover which SPAR shape
we actually get**, which section 1 leaves open.

### `apps/mobile/`

| File                      | Purpose                                                                                                                                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/bankid.ts`           | `startVoteVerification` / `openHostedLogin` / `watchVerification`. Same AppState-foreground re-poll and cancel-on-unmount contract as `lib/swish.ts`, but it opens GrandID's hosted page with `WebBrowser.openAuthSessionAsync` rather than app-switching to a scheme URL (§2c). Adds `expo-web-browser`. |
| `lib/BankIdVoteSheet.tsx` | Twin of `SwishPaymentSheet.tsx`: `starting → awaiting (+ "Öppna BankID igen") → ineligible → failed`, all Swedish.                                                                                                                                                                                        |

---

## 5. Model changes — `apps/web/lib/models.ts`

New `VoteVerification`, deliberately shaped like `Payment`:

```
userId          ref User, indexed
questionId      ref Question              ← the ballot intent, captured at start
choice          "ja" | "nej"              ←   …so the vote can only be written by settle
grandIdSession  String, unique            ← sessionId from FederatedLogin
status          PENDING | VERIFIED | REJECTED | FAILED | CANCELLED   (default PENDING)
reasonCode      String|null               ← UNDERAGE | WRONG_KOMMUN | PROTECTED_IDENTITY |
                                            NOT_PERSONNUMMER | DECEASED | SPAR_MISSING |
                                            userCancel | startFailed | expiredTransaction
voteId          ref QuestionVote, null    ← set on VERIFIED
evidence        { notBefore, notAfter, bankIdIssueDate, ocspResponse, signature } | null
runtime         "development" | "production"  ← which runtime created the row, NOT
                                            which GrandID host it used. The host is
                                            production everywhere; this is what stops a
                                            dev server settling a row through dev:web:live
lastPolledAt    Date                      ← enforces the ≥2 s poll floor server-side
createdAt/updatedAt
```

`VoteVerificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: … })` — a
TTL that purges rows some time after they settle. **What the TTL must not do is
delete the row before the vote is written**; set it well beyond the 3-minute
BankID window (proposal: 30 days, long enough to debug an incident, short enough
to be a real minimisation story for the privacy disclosure).

`Question` / `QuestionVote` changes:

- `QuestionVote.verifiedAt: Date | null` — cheap, no PII, and it is what lets us
  report honestly which results are BankID-backed. Pre-BankID votes simply have
  `null`. (Answers the "mixes up previous votes" concern: it stops being a mix
  and becomes a labelled distinction.)
- `QuestionVote.pnrHash` + the unique sparse compound index, **if 3a lands on B**.

Both models already use the force-refresh pattern; `VoteVerification` must too,
per the Mongoose-cache rule in `CLAUDE.md`.

`packages/types/src/question.ts` gains `VoteVerification`, `VerificationStatus`.

---

## 6. API endpoints

All Bearer-auth, for the app. The web has its own equivalent at
`pages/api/questions/vote-verification.ts` — session auth instead of a Bearer
token, and resolved on return from the redirect rather than polled throughout —
sharing the same `settleVerification`. (An earlier draft of this section claimed
there was no web voting page; there is, see Stage 6.)

| Route                                            | Does                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/mobile/vote-verification`             | `{ questionId, choice }` → validates the question is active and the choice legal **before** spending a BankID transaction, creates the `VoteVerification` row, calls FederatedLogin, returns `{ verificationId, autoStartToken }`. Resumes an existing `PENDING` row younger than ~3 min instead of starting a second order (the RP06 lesson from Swish). |
| `GET /api/mobile/vote-verification/[id]`         | Scoped to the caller (another user's id → **404, not 403**). Calls `GetSession` when `lastPolledAt` is older than 2 s, otherwise returns the stored state. On a completed session calls `settleVerification`. Returns `{ status, message, reasonCode, voteCounts?, userVote? }` — `message` always user-facing Swedish, never a raw hintCode.             |
| `POST /api/mobile/vote-verification/[id]/cancel` | Calls `Logout?cancelBankID=true` and marks the row `CANCELLED`, so a user who backs out does not leave an order blocking their next attempt.                                                                                                                                                                                                              |

`POST /api/mobile/questions/vote` — **keep it**, but it becomes the unverified
path. Once BankID goes live it is either removed or restricted (see Stage 6).
Deciding that at Stage 6 rather than now is deliberate: it stays working while
the new path is being proven.

---

## 7. Flow

```
Rösta: user picks Ja/Nej, taps "Rösta med BankID"
  │
  ├─► POST /api/mobile/vote-verification { questionId, choice }
  │     server: question active? choice legal? quota? → create row (PENDING)
  │             → FederatedLogin(gui=true, mode=sign, callbackUrl=<app deep link>,
  │                              userVisibleData=<ballot>, userNonVisibleData=<ids>)
  │     ← { verificationId, redirectUrl }
  │
  ├─► app opens redirectUrl with WebBrowser.openAuthSessionAsync
  │     GrandID's page drives BankID; the OS handles the bankid:// hand-off
  │     user sees the ballot text and signs
  │     GrandID redirects to the deep link → the app comes back to the front
  │
  ├─► watchVerification polls GET /api/mobile/vote-verification/[id] every 2 s
  │     (and immediately on AppState → active, since OS timers were suspended)
  │
  └─► server, on a completed GetSession:
        assert evidence.orderType === "Signing"      ← else reject (§2a)
        parseSparAttributes → checkEligibility        ← userAttributes.SPARv2
          ├─ eligible   → write QuestionVote (verifiedAt, pnrHash) → VERIFIED
          └─ ineligible → REJECTED + reasonCode, no vote written
```

The vote is written **by the server, inside settle** — the client never gets to
say "I verified". The ballot intent is captured at start, so the choice cannot be
swapped after the BankID prompt showed one thing.

---

## 8. There is no test environment

The plan assumed a test env with synthetic SPAR data. There isn't one: both
service keys are rejected by `client-test.grandid.com` (`APIKEYNOTVALID01`) and
accepted by `client.grandid.com`. Consequences, in order of how much they hurt:

1. **Every test is a real BankID transaction** on a real identity, billed, with a
   real signature attached. No demo.bankid.com test identities — those only work
   against the test host.
2. **The good news**: the thing hardest to test in a sandbox is now the easiest.
   A real Vallentuna resident's BankID exercises the real SPAR path and returns
   real folkbokföring, so `WRONG_KOMMUN` vs eligible is provable today rather
   than being deferred to production.
3. **The bad news**: there is no safe place to exercise the _ineligible_ branches.
   Under-16, wrong kommun, sekretessmarkering and samordningsnummer can only be
   covered by fixtures in Stage 2, never end to end.
4. `BANKID_ALLOW_ANY_KOMMUN` **exists after all**, for the opposite reason to the
   one originally planned. It was meant to work around synthetic test data; there
   is none. But because there is none, the _eligible_ path cannot be reached by
   anyone not actually folkbokförd in Vallentuna — so the override skips the
   residency check and nothing else. Three guards keep it out of production, only
   one of which is a setting: `NODE_ENV !== "production"` (not configurable, and
   every Vercel build sets it), the flag set to exactly `"true"`, and the database
   not being the production one — `pnpm dev:web:live` runs a _development_ server
   against production data and would otherwise slip through. See
   `allowAnyKommun()` in `lib/bankid/config.ts`; eligibility itself stays pure and
   takes the decision as an option.

**Worth asking Svensk E-identitet for test credentials anyway.** Not a blocker,
but without them every CI-style rerun costs a transaction and a signature.

No mTLS and no public HTTPS callback are needed, so `pnpm dev:web` reaches
GrandID from localhost with no tunnel — polling, not callbacks, is what makes
that true.

## 9. Build order

Each stage ends at something you can look at and sign off before the next starts.

### Stage 0 — Confirm with e-identitet ✅ answered by probing, not by asking

The questions below were going to be an email. Running
`pnpm grandid --probe --csv certs/e-identitet.csv` answered most of them in about
a minute, and contradicted two assumptions:

- **Signing is allowed** on both service keys (§2) — the plan had assumed auth only.
- **There is no test environment** for these credentials (§8).
- **`gui=false` works**: FederatedLogin returned an `autoStartToken` and a QR, not
  a `redirectUrl`, so we drive the flow and GrandID's hosted UI stays out of it.

Still worth asking them:

1. **Is SPAR attached to this service key?** Unanswerable by probing — it only
   shows up in a _completed_ transaction's `userAttributes`. The first live
   signature settles it, and `--probe` cannot.
2. **Test credentials**, so reruns stop costing real signatures.
3. **Per-transaction pricing for signatures**, which is the mode we now use and
   is typically dearer than authentication. One per ballot, not one per login.

The original list, for reference:

1. Is **SPAR attached to our authenticate service key**, and is it **v1 or v2**?
   Without it we cannot check folkbokföring at all and this design does not work.
2. Is the service configured for **`gui=false`** (custom UI / "For apps")? Our
   design polls; GUI mode would force a WebView.
3. Test vs production **service keys** — one of each, and are they separate
   services or one service with an env switch?
4. Is the test service pointed at **BankID test certificates** (demo.bankid.com)?
5. Any **test person folkbokförd in Vallentuna (0115)** available?
6. **Per-transaction pricing** — this design spends one BankID transaction per
   ballot, not per login. Confirm the cost model before we ship it.
7. Do they support `authMessage` on our service (BankID V3 feature)?

### Stage 1 — Transport + diagnostic ✅ complete

Shipped: `lib/bankid/config.ts`, `lib/bankid/client.ts`, `lib/bankid/session.ts`,
`scripts/test-grandid-connection.mjs`, `scripts/ts-resolve-hooks.mjs`, the
`pnpm grandid` script, and the three `GRANDID_*` vars in `.env.local` +
`turbo.json`.

Unlike the Swish diagnostic, this one **imports the real lib** rather than
re-implementing the transport. Swish's risk was the mTLS handshake, so isolating
it from app code was the point; here there are no certificates and the risk is
entirely in parsing GetSession's four undiscriminated shapes, so testing anything
but the real parser would prove the wrong thing. Node strips the types natively;
`scripts/ts-resolve-hooks.mjs` bridges its stricter ESM resolver to the repo's
extensionless imports.

`pnpm grandid` now runs the production configuration by default (GUI + sign on
the configured service) and `--no-gui` is the control. The live runs answered
everything Stage 1 existed to answer: SPAR is present and is **v2**, the
signature is a real one, and the completed response is written whole to a JSON
file — which is the Stage 2 fixture.

### Stage 2 — `eligibility.ts` + fixtures ✅ complete

`lib/bankid/eligibility.ts` (pure, no I/O) and `scripts/test-eligibility.mjs`
(`pnpm eligibility`) — 25 cases printed as a table of input → verdict, exiting
non-zero on any mismatch. `--fixture <path>` additionally judges a real capture,
which stays out of the repo because it carries a personal number.

Two things the live data changed:

- **`ns14Folkbokforing` really is a list.** The capture holds three historical
  registrations — Göteborg (current), Boden, and an older one. `[0]` happened to
  be correct there, which is exactly how that bug would have survived review, so
  `current()` selects the entry with `ns2DatumTill = 9999-12-31` and falls back
  to the latest-ending one. Two fixtures cover both orderings.
- **Check order matters.** Protected identity is evaluated _before_ residency,
  because SPAR withholds a protected person's address — their kommun reads as
  missing, and they would otherwise be told they live in the wrong municipality.

Age uses `AGE_REFERENCE_DATE = "2026-09-13"` (decision 3b: measured on election
day, matching the electoral roll). Set that one constant to `null` to measure at
vote time instead.

### Stage 3 — Models + types ✅ complete

`VoteVerification` and the two new `QuestionVote` fields are in
`lib/models.ts`; `lib/bankid/pseudonym.ts` computes the per-question hash;
`packages/types` exports `VoteVerification` / `VerificationStatus`; and
`/api/account/delete` deletes the new collection (the invariant is that no
collection still holds a deleted user's id).

**What is actually stored, and for how long:**

| Where              | Field                                                  | Lifetime                                         |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------ |
| `QuestionVote`     | `verifiedAt`                                           | forever — labels which results are BankID-backed |
| `QuestionVote`     | `pnrHash`                                              | forever — per-question pseudonym, the dedup key  |
| `VoteVerification` | ballot intent, status, reasonCode, runtime, poll clock | 30 days (TTL)                                    |
| `VoteVerification` | `evidence.signature` + OCSP                            | 30 days (TTL)                                    |

**Never stored anywhere:** personnummer, name, address, kommun, birth date. The
eligibility verdict is computed at settle and only its _outcome_ is kept.

`QuestionVote` moved from `safeModel` to the force-refresh pattern, because
`safeModel` keeps serving the previously registered schema across a hot reload
and Mongoose's strict mode would silently drop both new fields.

Retention, lawful basis and the erasure questions are worked through in
[gdpr-data-retention.md](gdpr-data-retention.md).

**One thing worth a second look:** `evidence.signature` is BankID's signed XML,
which embeds the signer's certificate — so it is identifying personal data, not
a hash. Keeping it is what would let us answer "was this ballot really signed?"
if a vote were disputed; the 30-day TTL is what stops it accumulating. Dropping
it entirely, or storing only a SHA-256 of it, are both defensible — this is the
one retention choice in Stage 3 that is a judgement call rather than a
consequence.

### Stage 4 — Server endpoints + `settle.ts` ✅ complete

`lib/bankid/settle.ts` plus three routes under
`pages/api/mobile/vote-verification/`: `index.ts` (start), `[id]/index.ts`
(poll + settle), `[id]/cancel.ts`.

`scripts/test-vote-settle.mjs` (`pnpm settle-test`) covers every branch against
the dev database and cleans up after itself. This is possible because
`settleVerification` takes the completed session as a parameter — without that
seam each scenario would cost a real signature, and an under-16 or a protected
identity could not be produced at all. 22 checks: happy path, replay, one person
across two accounts, a second person on the same question, `NOT_SIGNED`,
`QUESTION_CLOSED`, `RUNTIME_MISMATCH`, `SPAR_MISSING`, `WRONG_KOMMUN`,
`UNDERAGE`, `QUOTA_REACHED`, and the development residency override.

Decisions made while building:

- **The route is `[id]/index.ts`, not `[id].ts`.** A sibling `[id].ts` file and
  `[id]/` directory probably resolve correctly in the Pages Router, but nothing
  else in this repo does it and a routing mistake surfaces at deploy. The
  unambiguous form costs nothing.
- **`redirectUrl` is stored on the verification row.** The resume path first
  rebuilt it from the session id and a hardcoded `login.grandid.com`, which is
  wrong in the test environment and breaks if GrandID changes the format.
- **Resume only matches the same ballot.** An in-flight order for a different
  question or the opposite choice must not be handed back: it is displaying text
  the user did not just agree to.
- **The poll endpoint answers 200 with `PENDING` when GrandID errors.** The app
  polls this every two seconds; a transient upstream hiccup should leave the
  sheet waiting rather than tear it down.
- **`NOTLOGGEDIN` is the waiting state**, not an error, because the voter is
  still on the hosted page.

### Stage 5 — Mobile client + sheet ✅ built, needs a device

`apps/mobile/lib/bankid.ts` and `lib/BankIdVoteSheet.tsx`, wired into
`app/(app)/vote.tsx`. Adds `expo-web-browser` (~15.0.11), which is bundled in
Expo Go — no new dev-client build needed to try it.

**`handleVote` no longer writes anything.** It opens the sheet; the server
records the vote when the signature comes back, and `handleVerified` folds the
result into local state and the shared questions cache exactly as the old POST
did. `submitting` was deleted — the sheet owns that window now.

Decisions worth knowing:

- **`openAuthSessionAsync` with the app's deep link as `callbackUrl`.** An
  earlier draft used `openBrowserAsync` and a blank callback, relying on
  `dismissBrowser()` to close the tab. That is **iOS-only**: on Android the
  Custom Tab would have stayed open after signing and the voter would have had
  to press back. The auth session handles both — iOS closes itself, Android is
  brought forward by the deep link.
- **Closing the browser is not an outcome.** `openBrowserAsync` resolves when the
  tab closes, which a user may well do straight after signing successfully. That
  resolution is ignored entirely — only the poll decides.
- **`rejected` is a separate phase from `failed`.** A rejection is a verdict
  about the voter (wrong kommun, under 16, already voted) where "Försök igen"
  would be both useless and unkind; it shows "Jag förstår" instead.
- **Cancelling releases the order.** Closing the sheet mid-flight calls the
  cancel endpoint, so the next attempt is not refused as one already ongoing.

#### iOS: BankID returns to Safari, not to the app that started the flow

Found on a real iPhone, and it is the failure this integration is most likely to
hit again. The flow reached BankID, the signature completed, and then Safari
opened on a blank `login.grandid.com` page and nothing came back.

`ASWebAuthenticationSession` is a **separate browser instance**. When GrandID's
hosted page launches `bankid://`, BankID's return-to-browser targets Safari
proper — which has none of the auth session's state, so the page renders empty
and its `callbackUrl` redirect never fires. `callbackUrl` alone therefore cannot
get an iOS voter home.

The mechanism is spelled out in GrandID's
[Mobile Integrations](https://docs.grandid.com/mobileintegrations) page: the
hosted page decides how to launch BankID and where to send it back by sniffing
the user agent, and it warns that a non-unique one causes "incorrect flagging of
webbrowser and operating system" — pointing from that caveat straight at the
`appRedirect` section as the remedy. An auth session presents a stock Safari user
agent, so GrandID flags it as Safari and builds the `bankid://` launch with a
Safari return target. BankID then does exactly what it was told.

The fix is **`appRedirect`**, which is a different journey from `callbackUrl`:

| parameter     | who it redirects                               |
| ------------- | ---------------------------------------------- |
| `callbackUrl` | the **browser**, after GrandID's page finishes |
| `appRedirect` | the **BankID app**, after signing              |

Both are now set to the app's deep link, so BankID skips the browser on the way
back. This is the documented remedy, not a workaround — the same page describes
`appRedirect` as the parameter "you can use to show the application to the user"
when the OS prevents the normal return. (Its one exclusion, that BankID needs the
launch URI built by hand instead, applies to the no-GUI flow where the app owns
the `autoStartToken`; we are in GUI mode.) Note GrandID **does not validate `appRedirect`** — every form tried was
accepted, including nonsense — so a wrong value fails silently at the worst
moment rather than at request time.

The app also polls on the deep link itself, not only on `AppState`: on iOS it can
come back with the auth-session sheet still on top and report `inactive` rather
than `active`, which would otherwise delay the result by a poll interval.

**Remaining: a device run.** Everything up to the hosted page is verifiable in
Expo Go; what needs a phone is the browser hand-off, the `bankid://` launch from
GrandID's page, and the return. Expect the first attempt to cost a real
signature — there is no sandbox (§8).

### Stage 6 — Quota transition and the web voting path ✅ complete

Stage 6 turned out to be twice the job, because this document was wrong about
something load-bearing.

**Correction to §6.** It said "There is no public web voting page for
`Question`s, so `apps/web` needs no UI work in this integration." There is:
`/rosta`, linked from the homepage nav and from municipal board pages, voting
through `POST /api/questions/vote` on nothing but a NextAuth session. Stages 4
and 5 were built on that false premise. Left alone, the website would have
remained an unverified path into the same `QuestionVote` collection — the app
would require BankID while the browser did not, which defeats the integration
rather than merely limiting it.

**The web now verifies too**, through `pages/api/questions/vote-verification.ts`
(session auth + CSRF) and the same `settleVerification`, so both surfaces write
votes through identical rules. Web is the easier platform: a real `https`
callback, no deep links, no `appRedirect` quirks.

The shape differs from mobile in one way. The browser _leaves_ for GrandID, so
nothing can poll while the signature happens. GrandID returns the voter to
`/rosta?grandidsession=…` and the page resolves the outcome from there — keyed by
GrandID's session id rather than ours, because that is what the redirect carries.
It keeps polling briefly while `PENDING`, since the redirect can beat GrandID
registering the signature.

**`/api/questions/vote` is deleted outright.** The web has no installed clients,
so the unverified path could go immediately — unlike mobile, where it has to
survive until the store release.

**The quota stays.** The 5-vote pre-election limit applies to verified voting
too — a signature proves _who_ you are, not how many times you may vote before
the election. What changed is that it is now enforced in one place rather than
copy-pasted: `lib/vote-quota.ts` holds the constant and the two helpers, used by
both verification start endpoints, `settleVerification`, the legacy mobile
endpoint, and the two list endpoints that report it. Start endpoints check it so
a doomed signature is never paid for; settle re-checks, because that is where the
vote is written and minutes pass in between.

`PRE_ELECTION_LIMIT` in `/api/mobile/questions/*` continues to serve app builds
already on phones, and is retired with that endpoint per
[bankid-go-live-checklist.md](bankid-go-live-checklist.md) §4.

### Stage 7 — Hardening ✅ complete

- **Rate limit on starting orders** (`lib/bankid/rate-limit.ts`): 10 per user per
  hour, counted in the database because a Vercel deployment runs many lambdas and
  an in-process counter would be per-instance and reset on every cold start.
  This is a cost control as much as an abuse one — every accepted order is a
  billable signature and there is no sandbox to absorb a loop. `retryAfter` is
  measured from when the oldest order in the window ages out, not a flat hour.
- **Admin visibility**: `/api/admin/questions` reports `verifiedCount` per
  question, and `/manage-questions` shows "N av M signerade med BankID" whenever
  the two differ. Both verified and unverified votes land in the same tally, so
  without this an admin cannot tell a signed result from one an older app build
  produced. Hidden when everything is verified, which is the steady state once
  the legacy endpoint is retired.
- **Store disclosure corrected**: the inventory said "We do NOT collect:
  personnummer", which the release makes false. Apple gains **Identifiers →
  Government ID**, Play gains **Personal info → Other personal info**. Declared
  even though nothing is retained, because both stores ask whether data is
  _collected_, and processing in transit counts.
- **`/legal` rewritten** (§2 and §4): what is signed, what SPAR is asked, that no
  SPAR data is kept, what the per-question code is and is not capable of, the
  30-day purge, and the anonymisation at close.
- **Go-live checklist**: [bankid-go-live-checklist.md](bankid-go-live-checklist.md).

Deliberately not done: the TTL purge cannot be observed without waiting 30 days,
so it rests on the index being present. Structured logging was already in place
from Stage 4.

### Stage 8 — Production switch

Production service key, production BankID certs, `GRANDID_ENV=production`,
`env`-guard verified, real vote with a real BankID in Vallentuna. Then release.

---

## 10. Environment variables

```env
GRANDID_ENV=test                 # test | production
GRANDID_API_KEY=
GRANDID_SERVICE_KEY=             # the authenticateServiceKey
VOTE_ID_PEPPER=                  # HMAC pepper (decision 3a). Never rotate.
```

`GRANDID_ENV` is `production` even locally, because the test host rejects these
credentials (§8). `BANKID_ALLOW_ANY_KOMMUN` from the original draft is dropped —
it existed to work around synthetic test data that does not exist.

All of these must also be added to `turbo.json`'s `env[]` **in the same change** —
turbo hashes the declared set, and a missing entry silently serves a stale build.

---

## 11. Security checklist

- [ ] Ballot intent (`questionId`, `choice`) captured **at start**, not accepted at settle.
- [ ] The vote is written only by `settleVerification`, never by a request handler.
- [ ] Transitions one-way out of `PENDING` — a replayed poll cannot double-write.
- [ ] `env` on the row checked against runtime `GRANDID_ENV` before writing a vote.
- [ ] `GET .../[id]` scoped to the caller; another user's id returns 404.
- [ ] Server-side ≥2 s poll floor (`lastPolledAt`), independent of client behaviour.
- [ ] `evidence.orderType === "Signing"` verified before a vote is written — an
      `Identification` must never be accepted as a signed ballot (§2a).
- [ ] `SPAR_MISSING` fails **closed** and logs loudly — never reads as "eligible".
- [ ] Settle **re-checks the question is still active** before writing. A
      signature completing seconds after close would otherwise land an
      identified vote among already-anonymised ones — uniquely re-identifying
      its author. Reject with `QUESTION_CLOSED`.
- [ ] Settle handles a duplicate-key error on `{questionId, pnrHash}` as a
      user-facing "you have already voted", not a 500.
- [ ] Personnummer never logged, never returned to the client, never stored raw.
- [ ] Rate limit on verification starts (cost + BankID abuse).
- [ ] `/api/account/delete` handles `VoteVerification`.

---

## 12. Open decisions

0. ~~**Blocking**: get SPAR attached to service key `…69dc`.~~ **Resolved** — it
   is attached; GUI mode was the missing variable (§2b).

1. ~~**3a** — store nothing (A), per-vote HMAC (B), or account binding (C)?~~
   **Decided: B**, per-vote HMAC of the personnummer with a server-side pepper.
2. **3b** — age 16 measured at vote time or at 2026-09-13?
3. **3c** — the sekretessmarkering / samordningsnummer / avliden verdicts.
4. **Stage 6** — what happens to the unverified vote endpoint once this is live?
5. **Cost** — one BankID **signature** per ballot. Signatures usually cost more
   than authentications, and there is no free sandbox to rehearse in, so this
   needs a number from e-identitet before Stage 4 spends them in bulk.
6. **UX of the hosted page** (§2c). The voter leaves the app for a
   GrandID-branded page on every ballot. Acceptable, or worth asking Svensk
   E-identitet whether SPAR can be enabled for `gui=false` so the app-switch
   flow becomes possible again?
