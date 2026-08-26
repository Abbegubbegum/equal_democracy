# App store privacy disclosure — what Vallentuna Framåt collects

Source of truth for Apple's **App Privacy** questionnaire (App Store Connect) and Google Play's
**Data safety** form. Derived from `apps/web/lib/models.ts` and the API routes, not from memory —
re-check it against the schema whenever a model changes.

Last verified: 2026-08-21.

---

## 1. What we actually store

| Data                          | Where                                                                                                                              | Linked to the user? | Why                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------ |
| Email address                 | `User.email`                                                                                                                       | Yes                 | The only login credential — one-time codes are emailed |
| Name                          | `User.name`                                                                                                                        | Yes                 | Shown in the app                                       |
| Phone number                  | `User.phoneNumber`                                                                                                                 | Yes                 | Optional, for SMS reminders                            |
| Interest areas                | `User.interests`                                                                                                                   | Yes                 | Filters content and notification targeting             |
| Push token                    | `User.expoPushToken`                                                                                                               | Yes                 | Delivering notifications                               |
| Membership status and period  | `User.membershipStatus`, `membershipPaidUntil`, `membershipFirstPaidAt`                                                            | Yes                 | Whether the fee is paid and for which years            |
| Payment records               | `Payment` — amount, currency, status, timestamps, Swish `paymentReference`, `payerAlias` (the paying phone number)                 | Yes                 | Taking and bookkeeping the membership fee              |
| Votes                         | `QuestionVote`, `FinalVote`, `BudgetVote`                                                                                          | Yes                 | Democratic participation                               |
| Written content               | `Proposal`, `Comment`, `QuestionComment`, `CitizenProposal`, `BudgetArgument`                                                      | Yes                 | The user's own contributions                           |
| Ratings                       | `ProposalRating`, `CommentRating`, `QuestionCommentRating`, `CitizenProposalRating`, `BudgetCategoryRating`, `MunicipalItemRating` | Yes                 | Ranking proposals and comments                         |
| Photos                        | Vercel Blob, referenced by `CitizenProposal.imageUrl`                                                                              | Yes                 | Images attached to citizen proposals                   |
| Personnummer (**not stored**) | Checked live during a vote via BankID + SPAR; only the verdict is kept                                                             | No — discarded      | Confirming age 16+ and Vallentuna residency            |
| Voter pseudonym               | `QuestionVote.pnrHash` — HMAC of the personnummer, salted per question                                                             | Pseudonymously      | One person, one vote per question, across accounts     |
| Signature record              | `VoteVerification` — a sha256 of the BankID signature and its dates, **30-day TTL**                                                | Yes, until purged   | Evidence a ballot was signed                           |
| One-time login codes          | `LoginCode` (bcrypt-hashed, 10 min TTL)                                                                                            | By email            | Authentication                                         |
| IP address                    | Vercel request logs                                                                                                                | Transiently         | Security and debugging                                 |
| Usage analytics               | Expo Insights, Vercel Analytics                                                                                                    | No — aggregate      | App opens and traffic                                  |

**We do NOT collect:** precise or coarse location, contacts, health data, advertising identifiers,
browsing history, or bank/card details. Swish and the payer's bank handle account
details; we never see them.

**No tracking.** Nothing is shared with data brokers, no advertising SDKs, and nothing is used to
track users across other companies' apps or websites. Both stores ask this explicitly — the answer
is no.

---

## 2. Apple — App Privacy answers

Choose "Data Linked to You" for everything except analytics.

| Apple category | Collected | Types                                                                              | Purposes                                  |
| -------------- | --------- | ---------------------------------------------------------------------------------- | ----------------------------------------- |
| Contact Info   | Yes       | Email address, Name, Phone number                                                  | App Functionality                         |
| Financial Info | Yes       | **Purchase History** (membership fee: amount, date, reference)                     | App Functionality                         |
| User Content   | Yes       | Photos, Customer Support, Other User Content (votes, proposals, comments, ratings) | App Functionality                         |
| Identifiers    | Yes       | User ID, **Government ID** (personnummer, checked live and not retained)           | App Functionality                         |
| Usage Data     | Yes       | Product Interaction                                                                | Analytics — **Not Linked to You**         |
| Diagnostics    | Yes       | Crash Data, Performance Data                                                       | App Functionality — **Not Linked to You** |

**Tracking:** No. Do not enable "Used to Track You" for any category.

Note on **Identifiers → Government ID**: voting requires a BankID signature, and the personnummer
it returns is used to check age and folkbokföring. It is **never stored** — only the eligibility
verdict and a per-question salted hash survive the request. Apple asks whether data is _collected_,
which processing-in-transit counts as, so declare it rather than relying on the fact that nothing
is retained.

Note on **Financial Info → Purchase History**: this covers the Swish membership fee. Apple's
definition is about purchase records, which we do hold. We do _not_ hold "Payment Info" (card or
account numbers) — leave that unchecked.

---

## 3. Google Play — Data safety answers

| Play category            | Type                                   | Collected | Shared | Linked | Optional     | Purpose            |
| ------------------------ | -------------------------------------- | --------- | ------ | ------ | ------------ | ------------------ |
| Personal info            | Email address                          | Yes       | No     | Yes    | Required     | Account management |
| Personal info            | Name                                   | Yes       | No     | Yes    | Required     | App functionality  |
| Personal info            | Phone number                           | Yes       | No     | Yes    | **Optional** | App functionality  |
| Personal info            | **Other personal info** (personnummer) | Yes       | No     | Yes    | Required     | App functionality  |
| Financial info           | Purchase history                       | Yes       | No     | Yes    | Optional     | App functionality  |
| Photos and videos        | Photos                                 | Yes       | No     | Yes    | Optional     | App functionality  |
| App activity             | Other user-generated content           | Yes       | No     | Yes    | Required     | App functionality  |
| App activity             | App interactions                       | Yes       | No     | No     | Required     | Analytics          |
| App info and performance | Crash logs, Diagnostics                | Yes       | No     | No     | Required     | App functionality  |

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
