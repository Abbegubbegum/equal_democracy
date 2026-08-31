# BankID login, anonymous browsing, and the account model — implementation plan

Companion to [bankid-integration-plan.md](bankid-integration-plan.md), which
covers vote **signing** and is shipped. This plan covers the four changes decided
for 1.3.0:

1. **Anonymous browsing.** The whole app is readable without an account. Voting,
   commenting, rating and proposing are disabled.
2. **BankID login.** The only option on the login screen. Email OTP stops creating
   accounts and survives only underneath, as a migration path for sessions that
   already exist.
3. **Membership requires contact details.** Email _and_ phone before a Swish
   payment can be started.
4. **Eligibility moves to login.** The SPAR check decides what a person may do
   the moment they authenticate, not after they have paid for a signature.

Vote signing itself is unchanged: every vote is still an individual BankID
signature over the ballot text, settled by `settleVerification()`.

---

## 1. The BankID rule this design is built around

The constraint identified is real, and it is worth stating precisely because a
loose reading would over-restrict the design:

> Identification via BankID may not be used as the basis for **issuing or using
> another electronic identity** for the end user, in any form. This is
> "ID-växling".

What it does **not** forbid: offering several login methods side by side. That is
explicitly fine.

What it **does** forbid, and this is the exact shape of the thing we would
otherwise have built: a user signs in with BankID, and during or after that
session we hand them a second credential — a password, a username, an email OTP —
that logs into the same account afterwards. The penalty for getting it wrong is
that the certificate is blocked with immediate effect, i.e. voting stops working
with no notice.

Three consequences, and they are the spine of the whole plan:

- **C1. Once `bankidSubject` is set on a User, no other method may open a session
  for it.** Not NextAuth credentials, not `/api/mobile/auth/verify-code`, not the
  Google Play review bypass. Enforced at the token-issuing entry points, not in
  the UI.
- **C2. An email address on a BankID account is a contact field, exactly like
  `phoneNumber`.** Never a credential. That is what makes "let users add and
  remove their email" safe — and it is why `User` can stop requiring one.
- **C3. Merging a legacy account into a BankID account has to be built so that
  no code path can turn the email proof into a session.** See §7.5 — the merge
  code is a separate collection with its own purpose, not a `LoginCode`. Setting
  a contact address needs no proof at all, because it grants nothing.

## 2. What is already proven, so login is not a research problem

From the live runs recorded in [bankid-integration-plan.md §2](bankid-integration-plan.md):

|             | `gui=false` | `gui=true`                       |
| ----------- | ----------- | -------------------------------- |
| **`…7c8c`** | no SPAR     | SPAR ✓ (`funcId Identification`) |
| **`…69dc`** | no SPAR     | SPAR ✓ (`funcId Signing`)        |

We already hold both service keys, and both were measured returning the SPAR
folkbokföring block in GUI mode. So:

- **Login = `…7c8c` + `gui=true`** → `funcId: Identification`, plus SPAR. This is
  the semantically correct service for login: BankID identifies, it does not sign,
  because the user is not agreeing to anything.
- **Voting = `…69dc` + `gui=true`** → `funcId: Signing`, unchanged.

The eligibility rules already work off `userAttributes`, and
`checkEligibilityFromAttributes()` is pure — it does not care which service
produced the block. **Nothing in `eligibility.ts` changes.**

One thing genuinely does change: `lib/bankid/session.ts` currently refuses on
purpose to be parameterised ("the alternatives … are deliberately not exposed.
They were explored, they lost"). That comment was right when there was one
configuration. There are now two legitimate ones, so the module must take a
`service: "auth" | "sign"` discriminator — with the same guard rail applied in
both directions: `readOrderType()` must assert `Identification` for a login and
`Signing` for a vote, so pointing an env var at the wrong key fails loudly
instead of producing transactions that bind nobody.

**Every BankID transaction is billable, login included.** Sessions must therefore
stay long-lived (30-day refresh on mobile, matching NextAuth on web); the app must
never re-authenticate on cold start.

## 3. The capability model

Today the code asks "is there a session?". That question stops being sufficient —
a signed-in user may now be as unable to act as an anonymous one. Replace it
everywhere with one derived value:

```ts
type Capability =
  | "anonymous" //  no account
  | "needs_bankid" //  legacy email account, BankID not linked yet
  | "restricted" //  BankID-verified, not eligible to vote here
  | "participant"; //  BankID-verified and eligible
```

`participant` is the **only** state that may vote, comment, rate, or submit a
citizen proposal.

**`restricted` means exactly one thing: ineligible.** The SPAR verdict was not
`ELIGIBLE` — wrong kommun, under 16, samordningsnummer, deregistered, protected
identity. It is a durable state: the user browses in it, and may never leave it.
So it carries the message explaining why, looked up from the stored
`EligibilityCode`.

**`needs_bankid` is transient and never browsed in.** The link gate (§7.4) blocks
the account at startup and offers exactly two ways out — link BankID, or log out
to anonymous browsing — so no screen ever renders this state and there is no copy
to write for it. It exists as a state anyway because the **server** cannot assume
the client ran that gate: an older app build holding a valid token would
otherwise be able to vote without ever having proved who it is. The gate owns the
words; `viewer.ts` owns the refusal.

The practical consequence is that only two states need user-facing wording —
`anonymous` ("log in with BankID") and `restricted` (the eligibility reason).

Two things are deliberately _not_ rungs on this ladder:

- **`isAdmin` is orthogonal.** An admin managing questions is not participating in
  the democratic process, and admin rights must not depend on being folkbokförd in
  Vallentuna. Admin surfaces stay gated on `isAdmin` alone. But an admin posting a
  _comment_ goes through the same `participant` gate as anyone else.
- **Membership is a further step**, not a rung: `participant` **+** email **+**
  phone (§8).

### Where capability is computed

New `apps/web/lib/viewer.ts`, one function used by both surfaces:

```ts
getViewer(req, res): Promise<{ userId, capability, user }>
```

It resolves a NextAuth session **or** a Bearer token, then reads the capability
**from the database, never from the token**. This is load-bearing: access tokens
live 7 days, so a token-embedded capability would leave a user who just linked
BankID blocked for a week — the same mistake `/api/mobile/user/membership`
already exists to avoid.

`requireParticipant(req, res)` wraps it and refuses with a code the client
switches on: `401 ANONYMOUS` ("sign in and try again"), or `403 NEEDS_BANKID` /
`403 RESTRICTED` (signing in again will not help — show the link gate, or show
the reason). `message` is Swedish and renderable as-is, and is deliberately empty
for `NEEDS_BANKID`.

`requireAccount(req, res)` is the weaker gate for routes a blocked user still
needs: reading their own membership, editing contact details, linking BankID.
That last one is how `needs_bankid` stops being true, so it must not sit behind
`requireParticipant`.

## 4. Model changes — `apps/web/lib/models.ts`

### `User`

| Field             | Change                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `email`           | **No longer required.** Unique becomes a **partial** index (`{ email: { $type: "string" } }`) — a plain `unique` over many nulls collides |
| `bankidSubject`   | **New.** `HMAC(LOGIN_ID_PEPPER, "login:" + pnr)`, unique + sparse. The account identity                                                   |
| `bankidLinkedAt`  | **New.** When BankID was first attached                                                                                                   |
| `eligibility`     | **New.** `{ code, eligible, checkedAt }` — the cached SPAR verdict (`EligibilityCode` reused verbatim)                                    |
| `authMethod`      | **New.** `"email" \| "bankid"`. Set to `"bankid"` the moment `bankidSubject` lands; this is what C1 checks                                |
| `emailVerifiedAt` | **New.** Contact email confirmed; null for an unconfirmed one                                                                             |
| `name`            | Stays required, now filled from BankID's `userAttributes.name` for new accounts                                                           |

`User` already uses the force-refresh pattern, so no HMR work.

### `LoginVerification` (new)

Shaped exactly like `VoteVerification`, for the same reason: it holds intent while
an external party works, then settles exactly once from an authoritative answer.

```
purpose: "login" | "link" | "reverify"
userId?          // set for link/reverify, absent for login
grandIdSession   // unique
redirectUrl
status           // PENDING | VERIFIED | REJECTED | FAILED | CANCELLED
reasonCode       // EligibilityCode or a BankID hintCode
resultUserId     // which account the login resolved to
runtime          // same development/production guard as VoteVerification
lastPolledAt
```

TTL 30 days, like `VoteVerification`. **No personnummer, ever** — only the derived
`bankidSubject` reaches the database, and only on `User`.

### `MergeCode` (new)

Separate from `LoginCode` on purpose (C3). Same bcrypt-hashed, 10-minute-TTL
shape, but carries `userId` (who is merging) and is redeemable at exactly one
endpoint. There is deliberately no code path from a `MergeCode` to a session.

### `bankidSubject` vs. the existing `pnrHash`

They are different pseudonyms and must stay different:

- `pnrHash` is salted **per question** so two votes by the same person are
  unlinkable. That property is the point of it.
- `bankidSubject` is **globally stable** — it has to be, it is how we find the
  account again.

Use a separate `LOGIN_ID_PEPPER` with its own domain-separation prefix, so a
subject hash can never collide with or be derived from a vote hash. Both peppers
inherit `VOTE_ID_PEPPER`'s rule: **never rotate** — rotating `LOGIN_ID_PEPPER`
orphans every account.

Keep `pnrHash` even though a unique `bankidSubject` now makes one-person-one-account
structurally true. It costs nothing and it is the backstop if account linking ever
has a bug.

## 5. New and changed files

### New

```
apps/web/lib/viewer.ts                          getViewer / requireParticipant
apps/web/lib/bankid/login.ts                    start + settle a login/link/reverify
apps/web/lib/bankid/subject.ts                  loginSubject(personalNumber)
apps/web/lib/account-merge.ts                   mergeAccounts(fromId, intoId)
apps/web/pages/api/auth/bankid/index.ts         POST start (web, unauthenticated)
apps/web/pages/api/auth/bankid/[id].ts          GET poll + settle → NextAuth session
apps/web/pages/api/mobile/auth/bankid/index.ts  POST start (mobile)
apps/web/pages/api/mobile/auth/bankid/[id].ts   GET poll + settle → JWT pair
apps/web/pages/api/user/link-email.ts           request + confirm a contact email
apps/web/pages/api/mobile/user/me.ts            capability + contact details
apps/web/scripts/bankid-login-migration.js      index surgery + backfill
apps/mobile/lib/bankid-login.ts                 client twin of lib/bankid.ts
apps/mobile/lib/BankIdLoginSheet.tsx            starting → awaiting → rejected | failed
apps/mobile/lib/RestrictedNotice.tsx            the one component every gated action renders
apps/mobile/lib/LinkGate.tsx                    blocking BankID-link modal for legacy email sessions (§7.4)
```

### Changed, with the reason

| File                                                                                   | Change                                                                                                                                        |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/bankid/session.ts`                                                                | Take `service: "auth" \| "sign"`; assert the matching `funcId`                                                                                |
| `lib/bankid/config.ts`                                                                 | Second service key; `getGrandIdConfig({ service })`; drop the single module-level `cached`                                                    |
| `lib/bankid/settle.ts`                                                                 | **Add a subject match.** The signing personnummer must derive the same `bankidSubject` as the account voting. Without it, A can sign B's vote |
| `lib/mobile-jwt.ts`                                                                    | `email` becomes nullable in the payload; add `optionalBearerToken()`                                                                          |
| `pages/api/auth/[...nextauth].ts`                                                      | Stop auto-creating users; refuse any email whose account has `authMethod: "bankid"` (C1)                                                      |
| `pages/api/mobile/auth/verify-code.ts`                                                 | Same two changes; the review bypass keeps working but lands on a `needs_bankid` account (§12 D3)                                              |
| `pages/login.tsx`, `apps/mobile/app/(auth)/login.tsx`                                  | Email/OTP form deleted; BankID is the only option (§7.4, D1/D3)                                                                               |
| `pages/api/mobile/payments/swish.ts`                                                   | Refuse without email + phone (§8)                                                                                                             |
| ~25 mobile API routes                                                                  | `verifyBearerToken` → `optionalBearerToken` on GETs, `requireParticipant` on mutations                                                        |
| ~20 web API routes                                                                     | Same split on the session-gated non-admin routes                                                                                              |
| `lib/municipal/notifications.ts`, `lib/session-close.ts`, `lib/forslag-maintenance.ts` | Skip users with no email rather than sending to `undefined`                                                                                   |
| `pages/api/account/delete.ts`                                                          | Clear `bankidSubject`, delete `LoginVerification`/`MergeCode` rows. The invariant is unchanged: no collection may still hold the id           |
| `packages/types/src/user.ts`                                                           | New fields, `email?`, `Capability`                                                                                                            |
| `turbo.json`                                                                           | `GRANDID_AUTH_SERVICE_KEY`, `LOGIN_ID_PEPPER` in `env[]` — same change, or the build hash is wrong                                            |

## 6. API endpoints

```
POST /api/auth/bankid                 { purpose, returnUrl? } → { verificationId, redirectUrl }
GET  /api/auth/bankid/[id]            poll; on VERIFIED establishes the NextAuth session
POST /api/auth/bankid/[id]/cancel

POST /api/mobile/auth/bankid          { purpose, returnUrl }  → { verificationId, redirectUrl }
GET  /api/mobile/auth/bankid/[id]     poll; on VERIFIED → { accessToken, refreshToken, user, capability }
POST /api/mobile/auth/bankid/[id]/cancel

GET  /api/mobile/user/me              { capability, eligibility, email, phone, membership }
POST /api/user/link-email             { action: "request" | "confirm" | "remove", email?, code? }
```

The start endpoints for `purpose: "login"` are the only **unauthenticated** BankID
endpoints in the system. They need the same `checkStartThrottle()` treatment
`vote-verification` has, keyed on IP rather than userId, because every accepted
order is billable and there is no account to rate-limit against.

## 7. Flows

### 7.1 Anonymous

No token. Every GET works, returning `userVote: null`, `quota: null`,
`canSubmit: false`. Every mutation is `403 RESTRICTED`. The mobile
`(app)/_layout.tsx` guard is removed; `(auth)/login` becomes a pushed route
reachable from a "Logga in" affordance and from `RestrictedNotice`.

### 7.2 New user, BankID

`POST /api/…/auth/bankid` (`purpose: "login"`) → hosted GrandID page → poll →
`Identification` confirmed → `loginSubject(pnr)` → no `User` matches → create one
with `authMethod: "bankid"`, `name` from BankID, **no email**, and the SPAR verdict
cached in `eligibility`. Session issued.

Then the prompt: _"Hade du redan ett konto med e-post? Koppla ihop dem."_ → §7.5.

### 7.3 Returning user

Same call; `bankidSubject` matches → session issued, `eligibility` refreshed from
the SPAR block that arrived with this login. Nothing else happens.

### 7.4 Legacy email account, session still alive — the link gate

**The login screen offers BankID and nothing else.** Email is not a second button,
not a tab, not a fallback. The reasoning is that it cannot lead anywhere different:
a legacy user without BankID loses account access either way, and one with BankID
ends up authenticating with BankID regardless — so the email field only adds a
path that terminates in the same place, plus the confusion of looking like a
choice when it is not one.

That makes the population who matter the ones who **already hold a session**: a
mobile JWT (7-day access, 30-day refresh, persisted in SecureStore) or a NextAuth
cookie. Most active users are in this group, and it is the only group that can
reach their old account without a merge.

They keep the session and land `needs_bankid`. A **link gate** then blocks the
account — not the app:

- Mounted like `UpdateGate.tsx`, but inside the `(app)` layout: a modal that
  cannot be dismissed into an authenticated state.
- One primary action: start `purpose: "link"`.
- One secondary action: **"Fortsätt utan konto"**, which logs out to anonymous
  browsing. This is the escape the brief calls for — an account must never become
  a trap, and the whole app is readable without one.

The gate keys on `capability === "needs_bankid"`. That is the whole reason the
state is separate from `restricted`: a BankID user who is ineligible because they
live in Vallsta rather than Vallentuna has nothing to link, and showing them a
link prompt would be a dead end. Because the gate is the only thing that ever
renders for `needs_bankid`, it is also the only place that state's copy lives.

On a successful link:

- no other account holds that subject → attach it, flip `authMethod: "bankid"`,
  keep the email as a **contact** field with `emailVerifiedAt` set. Email login is
  dead for this account from that moment (C1).
- another account already holds that subject → `mergeAccounts()`, authorised by
  both factors at once. This is the strongest merge path we have, and it is free:
  the user proved the mailbox by already being signed in with it.

The OTP endpoints stay alive underneath, unreferenced by any new UI, because
installed app builds still call `/api/mobile/auth/verify-code`. They are deleted in
the same change that raises `MIN_SUPPORTED_MOBILE_VERSION` (§11 Stage 7). That is
also a quiet migration path in its own right: a legacy user on an old build signs in
by email, updates the app, and arrives at the link gate with their session intact.

### 7.5 Legacy email account, session expired — claim by email

This is the path §7.4 leaves behind. A logged-out legacy user signing in with
BankID gets a fresh account (§7.2) and their old one is invisible: BankID returns
a personnummer, a name and SPAR, never an email, so there is nothing to match the
old account on automatically. What is stranded is not trivia — the five-vote
quota, the one-per-user proposal slot, and a **paid membership**.

So the address is asked for, from the two places it can come up:

1. **Right after signup.** `settleLogin` reports `createdAccount`, the app stores
   a one-shot flag, and the tab layout asks once: _"Hade du ett konto med
   e-post?"_ Skipping is a real answer; the same flow stays in the settings
   sheet.
2. **From the settings field.** Typing an address that a legacy account holds
   gets `409 MERGE_AVAILABLE` rather than a refusal, and the app offers the
   merge.

Both end in the same two steps — a six-digit code to the address, then confirm —
and both merge _into the account holding the session_ (§7.6).

**Setting an address is unverified; absorbing an account is not.** That
asymmetry is the design, not an inconsistency:

- Storing where to reach someone is harmless, so the contact field behaves like
  `phoneNumber`: typed, stored, removable.
- Moving votes, proposals and a paid membership between accounts on nothing but
  a typed string would be an account takeover with extra steps — so that path
  sends a `MergeCode` first.

The compliance argument, accepted on our own judgement rather than confirmed
(§12 D1): the session already exists and was created by BankID; the code proves
control of a _communications channel_, not the identity of a person; and nothing
is issued. Three properties carry it, and they are requirements:

1. `MergeCode` is its own collection, never `LoginCode`.
2. It carries the `userId` it was issued to, and is only valid inside that
   session.
3. **No endpoint anywhere exchanges a `MergeCode` for a token.**

An address held by another **BankID** account is refused outright at every step,
including a re-check at confirm time — minutes pass while someone reads their
inbox, and it could change hands in between.

### 7.6 `mergeAccounts(fromId, intoId)`

Reassign everything keyed to `fromId` — proposals, comments, all six rating
collections, votes, citizen proposals, budget votes and arguments, session
requests, payments, `Session.activeUsers` — then delete the source user. Two
collisions must be handled rather than left to a duplicate-key error:

- **Votes on the same question from both accounts.** Keep the verified one; if both
  are verified the `{questionId, pnrHash}` index already made that impossible, so it
  can only happen with a legacy unverified vote, which loses.
- **Ratings on the same target from both accounts.** Keep the newer.

Admin flags merge with OR. Membership takes the later `membershipPaidUntil`. Run it
in a transaction; a half-merged account is worse than a failed merge.

### 7.7 Ineligible

The login itself succeeds — they are a real, verified person, they just may not act
here. Session issued, `capability: "restricted"`, `eligibility.code` stored so the
UI can say _why_ ("Du är folkbokförd i en annan kommun än Vallentuna"). This is
strictly better than today, where the same person discovers it only after paying
for a signing transaction.

`SPAR_MISSING` is **not** an ineligibility verdict — it is our configuration
failing. Fail the login with a retry message rather than restricting the user, and
log at error, exactly as `settle.ts` already does.

## 8. Membership

Server-side in `POST /api/mobile/payments/swish`: refuse with a typed error unless
the caller is `participant` **and** has a verified email **and** a phone number.
Client-side, `membership.tsx` renders the missing fields as a short form before the
pay button appears — the check exists in both places because the server one is the
real gate and the client one is the reason nobody hits it.

Note for the privacy disclosure: membership of a political party is a special
category of personal data under GDPR art. 9. It already was, but a BankID-verified
identity attached to it strengthens the linkage — `docs/app-store-privacy-disclosure.md`
and `/legal` both need review before this ships.

## 9. Eligibility — what moves and what stays

**Moves to login:** the user-facing decision. It is what sets `capability`, what the
UI reads, and what stops a wasted signature.

**Stays at settle:** the SPAR re-check in `settleVerification()`. Do not remove it.
It arrives free with a signature that is happening anyway, and a cached verdict goes
stale in exactly the way that matters — somebody moves out of Vallentuna and keeps
voting for the rest of their 30-day session. Login sets the gate; settle keeps it
honest.

**Added at settle:** the subject match (§5). Today nothing checks that the person
signing a vote is the person logged in; the account is trusted and the signature is
merely required to be valid. Once accounts carry a `bankidSubject`, that is a
one-line comparison and it closes a real hole.

## 10. Migration — `scripts/bankid-login-migration.js`

Dry-run by default, `--apply` to write, `--production` to target prod, matching
`restructure-db.js`.

1. `dropIndex("email_1")` — a Mongoose schema change does **not** replace an
   existing index, and the old unique non-sparse index will reject the second
   emailless user. This step is the one that breaks production if skipped.
2. Create the partial unique index on `email`, and the sparse unique index on
   `bankidSubject`.
3. Backfill `authMethod: "email"`, `emailVerifiedAt: null` on every existing user.
4. Report how many accounts have no `expoPushToken` and no phone — those are the
   users who, after email login is switched off, are reachable only by email and
   must be told to link BankID before it goes away.

## 11. Build order

Sequencing is what keeps installed app builds working. Web-and-API-only stages ship
freely; the app can only be fixed by a store release.

**Stage 0 — Probe the auth service key.** ☑ `--auth` built; needs one real BankID run. One real login through
`scripts/test-grandid-connection.mjs`, extended with `--auth`. Confirm
`funcId: Identification` _and_ a SPAR block from `…7c8c`. The table in §2 says it
works; do not build on a table.

**Stage 1 — Capability model.** ✅ built; migration written, not yet applied. `viewer.ts`, User fields, migration. No behaviour
change: everyone is `participant`, because everyone has an account.

**Stage 2 — Open the read tier.** ✅ API layer (25 mobile + ~30 web routes) and
clients. GETs public on both surfaces, mutations behind `requireParticipant`,
own-account routes behind `requireAccount`. Web pages render read-only instead
of redirecting to `/login`; the mobile `(app)` auth guard is gone, and gated
actions go through `useActionGate` (`lib/RestrictedNotice.tsx`).

⚠️ **This stage cannot be deployed on its own**, and an earlier draft of this plan
said it could. From Stage 1 onward an account with no `bankidSubject` is
`needs_bankid`, and nobody has one until Stage 4 exists to give it to them — so
deploying stages 1–2 alone would take every existing user's ability to vote,
comment and rate away with no route to get it back. Stages 1–6 land as **one** web
deploy (Stage 7 step 1). Everything before that runs on a development server only.

**Stage 3 — BankID login server-side.** ✅ built. `lib/bankid/login.ts`,
`lib/bankid/subject.ts`, `LoginVerification`, the four endpoints, and the
`bankid` NextAuth provider. C1 is enforced at all three token-issuing entry
points. Testable with `curl` before any UI exists.

**Stage 4 — Login UI.** ✅ Web `/login` and mobile `(auth)/login` are **BankID
only** — the email/OTP form is deleted from both (§12 D3), and both offer
"Fortsätt utan konto". Mobile gained `lib/bankid-login.ts` rather than a sheet:
the login screen is the sheet. The OTP endpoints, including the review bypass,
stay live and unreferenced; they are removed at Stage 7 step 4.

**Stage 5 — Linking and merging.** ✅ `lib/account-merge.ts`, `lib/email-claim.ts`,
`MergeCode`, `purpose: "link"`, `LinkGate` on both surfaces (§7.4), and the
claim flow (§7.5) from both entry points — the post-signup prompt and the
`MERGE_AVAILABLE` offer, sharing `lib/EmailClaimSheet.tsx`. Contact details are
an ordinary editable field beside `/phone` in the settings sheet.

Stage 5 cannot lag Stage 4 by a release. The moment the email form disappears, a
legacy user's only routes are the link gate and the claim prompt — ship them
together or not at all.

**Stage 6 — Eligibility at login ✅ (settled in `settleLogin`), membership gate
✅ (`/api/mobile/payments/swish` refuses without BankID + verified email +
phone). **Still to do: the settle subject match** — `settleVerification` must
check that the personnummer signing a vote derives the same `bankidSubject` as
the account casting it.

**Stage 7 — Release, in this order and not another:**

1. Deploy web (stages 1–6). Old app builds keep working: they log in by email, and
   their users are `needs_bankid` until they link — which they cannot do from an old
   build, so the web must be able to do the linking too.
2. `pnpm release` → both stores. Do **not** bump `LATEST_MOBILE_VERSION` until it is
   actually live in both.
3. Wait for rollout; watch how many users are still on old builds.
4. **Then** raise `MIN_SUPPORTED_MOBILE_VERSION` to the new version and switch off
   email account creation. This is precisely the situation that constant exists for —
   an old build that can no longer create an account must be told why rather than
   failing opaquely.

## 12. Decisions

All six were settled 2026-08-27. Kept here rather than folded into the prose
because each one is a place a future reader will otherwise re-derive the wrong
answer.

- **D1. The §7.5 claim-by-email path ships without asking Svensk e-identitet. ✅**
  We are going with our own reading: the session is already BankID's, the code
  proves control of a mailbox rather than the identity of a person, and nothing is
  issued. The safeguards that make that argument true are not optional decoration —
  `MergeCode` is a separate collection from `LoginCode`, it carries a `userId`, it
  is redeemable at exactly one endpoint, and **no endpoint anywhere exchanges one
  for a token**. If a future refactor blurs any of those, the argument stops
  holding. If Svensk e-identitet ever raises it, the fallback is D3's R1.
- **D2. Admins link BankID like everyone else; admin rights stay independent of
  eligibility. ✅** As designed in §3. A non-resident admin can manage questions and
  cannot post comments, and that is the correct outcome rather than a compromise.
- **D3. R2 — no email UI at all. ✅** The login screen is BankID and nothing else.
  Store reviewers get the whole app through anonymous browsing (§7.1), which is
  most of what the bypass was ever for. The `REVIEW_TEST_EMAIL` /
  `REVIEW_TEST_CODE` bypass stays in the **server** — unreachable from the new UI,
  still live for old builds — so if a reviewer asks to see an authenticated state
  we can restore a route to it without a code change. Revisit if either store
  actually asks; do not pre-build R1 or R3 for a rejection that has not happened.
  **Put a line in the review notes** saying the app is fully browsable without an
  account and that login requires a Swedish BankID.
- **D4. MAJ stays authenticated. ✅** `/api/mobile/xai` is Anthropic-billed per
  call; anonymous access would make it an open endpoint on a public URL.
- **D5. Store the name from BankID. ✅** A party member roll needs a name and
  asking for it twice is worse. It does not reach the consumer UI — comments stay
  anonymised. `/legal` and the privacy disclosure need the inventory line (§8).
- **D6. Eligibility refreshes at login, i.e. roughly every 30 days. ✅** No
  scheduled re-verification: it would cost one billable transaction per user per
  period to close a gap that `settleVerification()`'s SPAR re-check already closes
  at the only moment it matters (§9). The `reverify` purpose stays in the model as
  the seam if that judgement changes.
