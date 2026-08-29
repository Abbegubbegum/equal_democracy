# App store privacy disclosure — what Vallentuna Framåt collects

Source of truth for Apple's **App Privacy** questionnaire (App Store Connect) and Google Play's
**Data safety** form. Derived from `apps/web/lib/models.ts` and the API routes, not from memory —
re-check it against the schema whenever a model changes.

Last verified: 2026-08-27, against the BankID-login schema.

---

## 1. What we actually store

**Reading the app collects nothing.** Questions, results, debates, proposals, budgets and agendas
are public; everything below applies only once someone signs in.

| Data                                | Where                                                                                                                              | Linked to the user?               | Why                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| **BankID account identity**         | `User.bankidSubject` — HMAC of the personnummer under its own, never-rotated pepper                                                | **Yes** — it _is_ the account key | Matching a returning user to their account; one person, one account       |
| Name                                | `User.name` — first name + surname, from BankID                                                                                    | Yes                               | Shown in the app                                                          |
| Eligibility verdict                 | `User.eligibility` — the code only (`ELIGIBLE`, `WRONG_KOMMUN`, `UNDERAGE`, `PROTECTED_IDENTITY`, …) and when it was checked       | Yes                               | Deciding what someone may do without re-running BankID                    |
| Email address                       | `User.email` — optional, unverified, removable                                                                                     | Yes                               | Contact only. **Not a login credential**                                  |
| Phone number                        | `User.phoneNumber`                                                                                                                 | Yes                               | Optional, for SMS reminders                                               |
| Interest areas                      | `User.interests`                                                                                                                   | Yes                               | Filters content and notification targeting                                |
| Push token                          | `User.expoPushToken`                                                                                                               | Yes                               | Delivering notifications                                                  |
| **Membership of a political party** | `User.membershipStatus`, `membershipPaidUntil`, `membershipFirstPaidAt`                                                            | Yes                               | Whether the fee is paid and for which years — see the sensitive-data note |
| Payment records                     | `Payment` — amount, currency, status, timestamps, Swish `paymentReference`, `payerAlias` (the paying phone number)                 | Yes                               | Taking and bookkeeping the membership fee                                 |
| Votes                               | `QuestionVote`, `FinalVote`, `BudgetVote`                                                                                          | Yes, until the question closes    | Democratic participation                                                  |
| Written content                     | `Proposal`, `Comment`, `QuestionComment`, `CitizenProposal`, `BudgetArgument`                                                      | Yes                               | The user's own contributions                                              |
| Ratings                             | `ProposalRating`, `CommentRating`, `QuestionCommentRating`, `CitizenProposalRating`, `BudgetCategoryRating`, `MunicipalItemRating` | Yes                               | Ranking proposals and comments                                            |
| Photos                              | Vercel Blob, referenced by `CitizenProposal.imageUrl`                                                                              | Yes                               | Images attached to citizen proposals                                      |
| Personnummer (**not stored raw**)   | Read live from BankID + SPAR at login and at every vote; only verdicts and the two hashes below survive                            | No — discarded                    | Confirming identity, age 16+ and Vallentuna residency                     |
| Voter pseudonym                     | `QuestionVote.pnrHash` — HMAC of the personnummer, salted **per question**                                                         | Pseudonymously                    | One person, one vote per question, across accounts                        |
| Signature record                    | `VoteVerification` — a sha256 of the BankID signature and its dates, **30-day TTL**                                                | Yes, until purged                 | Evidence a ballot was signed                                              |
| Login attempt record                | `LoginVerification` — purpose, status, reason code, and a **sha256 of the caller's IP**, **7-day TTL**                             | Yes, until purged                 | Completing a login, and throttling billable BankID orders                 |
| One-time codes                      | `LoginCode` and `MergeCode` (bcrypt-hashed, 10 min TTL)                                                                            | By email                          | Legacy sign-in; proving a mailbox when claiming an old account            |
| IP address                          | Vercel request logs                                                                                                                | Transiently                       | Security and debugging                                                    |
| Usage analytics                     | Expo Insights, Vercel Analytics                                                                                                    | No — aggregate                    | App opens and traffic                                                     |

**We do NOT collect:** precise or coarse location, contacts, health data, advertising identifiers,
browsing history, or bank/card details. Swish and the payer's bank handle account details; we never
see them.

**No tracking.** Nothing is shared with data brokers, no advertising SDKs, and nothing is used to
track users across other companies' apps or websites. Both stores ask this explicitly — the answer
is no.

### The two personnummer-derived hashes are not the same thing

Worth stating precisely, because "we do not store your personnummer" is true of both but means
something different in each case:

- `QuestionVote.pnrHash` is salted **per question**, so two votes by one person are unlinkable. It
  exists to stop double voting and cannot build a voting profile.
- `User.bankidSubject` is **globally stable** — it has to be, it is how a returning user finds
  their account. That makes it a permanent pseudonymous identifier for a natural person, and
  therefore personal data in the ordinary sense even though it cannot be reversed without the
  pepper.

Anyone holding both the database and a pepper could brute-force a personnummer out of either hash
— there are only ~10^10 candidates. The peppers are the entire protection. They live only in
production scope and are deliberately separate, so one leak does not compromise both.

### Sensitive data: political opinion

**This is the answer most likely to be got wrong, and it changed with membership and BankID login.**
Two things we store reveal political opinion in the GDPR Art. 9 sense:

- **Membership of a political party** — `membershipStatus` is exactly that.
- **Votes on political questions**, while a question is open and the vote is still linked to the
  account. They are anonymised when the question closes, but the open window is real.

Apple's **Sensitive Info** category explicitly lists "political opinion", and Google Play has
**Personal info → Political or religious beliefs**. Both should be declared — see §2 and §3.

---

## 2. Apple — App Privacy answers

Choose "Data Linked to You" for everything except analytics and diagnostics.

| Apple category     | Collected | Types                                                                              | Purposes                                  |
| ------------------ | --------- | ---------------------------------------------------------------------------------- | ----------------------------------------- |
| Contact Info       | Yes       | Email address, Name, Phone number                                                  | App Functionality                         |
| Financial Info     | Yes       | **Purchase History** (membership fee: amount, date, reference)                     | App Functionality                         |
| User Content       | Yes       | Photos, Customer Support, Other User Content (votes, proposals, comments, ratings) | App Functionality                         |
| Identifiers        | Yes       | User ID, **Government ID** (personnummer, read live; a derived hash is retained)   | App Functionality                         |
| **Sensitive Info** | **Yes**   | **Political opinion** (party membership; votes while a question is open)           | App Functionality                         |
| Usage Data         | Yes       | Product Interaction                                                                | Analytics — **Not Linked to You**         |
| Diagnostics        | Yes       | Crash Data, Performance Data                                                       | App Functionality — **Not Linked to You** |

**Tracking:** No. Do not enable "Used to Track You" for any category.

Note on **Identifiers → Government ID**: both signing in and voting require BankID, and the
personnummer it returns is used to check identity, age and folkbokföring. The raw number is never
stored — but `User.bankidSubject`, a hash of it, is kept for the life of the account. Apple asks
whether data is _collected_, which processing in transit counts as, so declare it either way.

Note on **Sensitive Info**: added 2026-08-27. Before membership existed this was arguably
avoidable; it is not now. Apple's definition names political opinion outright, and a party
membership register is the clearest case of it there is.

Note on **Financial Info → Purchase History**: this covers the Swish membership fee. Apple's
definition is about purchase records, which we do hold. We do _not_ hold "Payment Info" (card or
account numbers) — leave that unchecked.

---

## 3. Google Play — Data safety answers

| Play category            | Type                                           | Collected | Shared | Linked | Optional     | Purpose            |
| ------------------------ | ---------------------------------------------- | --------- | ------ | ------ | ------------ | ------------------ |
| Personal info            | Name                                           | Yes       | No     | Yes    | Required     | App functionality  |
| Personal info            | Email address                                  | Yes       | No     | Yes    | **Optional** | App functionality  |
| Personal info            | Phone number                                   | Yes       | No     | Yes    | **Optional** | App functionality  |
| Personal info            | User IDs                                       | Yes       | No     | Yes    | Required     | Account management |
| Personal info            | **Political or religious beliefs**             | Yes       | No     | Yes    | **Optional** | App functionality  |
| Personal info            | **Other personal info** (personnummer, hashed) | Yes       | No     | Yes    | Required     | App functionality  |
| Financial info           | Purchase history                               | Yes       | No     | Yes    | Optional     | App functionality  |
| Photos and videos        | Photos                                         | Yes       | No     | Yes    | Optional     | App functionality  |
| App activity             | Other user-generated content                   | Yes       | No     | Yes    | Required     | App functionality  |
| App activity             | App interactions                               | Yes       | No     | No     | Required     | Analytics          |
| App info and performance | Crash logs, Diagnostics                        | Yes       | No     | No     | Required     | App functionality  |

"Political or religious beliefs" is marked **Optional** because membership is optional — reading
and voting do not require it. Email and phone are optional for the same reason: an account has
neither until the user adds them, and membership is the only thing that needs them.

Also declare:

- **Data is encrypted in transit** — yes (HTTPS/TLS throughout; the Swish API additionally uses mTLS).
- **Users can request data deletion** — yes. Give the URL `https://www.vallentuna.app/radera`.
- **Independent security review** — no.

---

## 4. Account deletion (both stores require a documented route)

- **In-app / web:** `https://www.vallentuna.app/radera` — a three-step flow that calls
  `DELETE /api/account/delete`.
- **What is deleted:** the `User` record and every row keyed to that user — proposals, comments,
  all six rating collections, votes (question / final / budget), citizen proposals _and their
  uploaded images in Vercel Blob_, budget arguments, session requests, and login codes.
- **What is retained, and why:** `Payment` rows are kept. A paid membership fee is
  räkenskapsinformation under bokföringslagen 7 kap. 2 §, which requires seven years of retention,
  and GDPR art. 17.3 b exempts erasure required by a legal obligation. The row is **pseudonymised**
  on deletion — `payerAlias` (the paying phone number) and the raw Swish callback are cleared, and
  `userDeletedAt` is stamped. What remains is amount, timestamps, status and payment reference.

Both stores accept "some data is retained for legal/accounting reasons" as long as it is disclosed.
It is disclosed in the privacy policy under _Hur länge sparar vi uppgifterna_.

---

## 5. Links to give the stores

| Field            | URL                                           |
| ---------------- | --------------------------------------------- |
| Privacy policy   | `https://www.vallentuna.app/legal#integritet` |
| Terms of use     | `https://www.vallentuna.app/legal#villkor`    |
| Support          | `https://www.vallentuna.app/support`          |
| Account deletion | `https://www.vallentuna.app/radera`           |

---

## 6. Open question before the public release

The membership fee is collected via Swish rather than in-app purchase. Whether that is acceptable
depends on the voting-rights benefit — see §9b of
[swish-integration-plan.md](swish-integration-plan.md). Resolve that before submitting for review;
it does not affect internal TestFlight.
