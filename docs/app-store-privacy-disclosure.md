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
| MAJ chat messages                   | Sent to Claude and returned; **we** log and store nothing. Anthropic's own retention is governed by their API terms                | Not retained by us                | The in-app assistant                                                      |
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

Checked against Apple's actual data-type list (App Store Connect, 2026-08-27). **Two categories
this document previously named do not exist** — there is no "Government ID" under Identifiers and
no "Purchase History" under Financial Info. The mapping below uses only real types.

Choose "Data Linked to You" for everything except Usage Data and Diagnostics.

| Apple category | Type                | Collected | What it is here                                                             |
| -------------- | ------------------- | --------- | --------------------------------------------------------------------------- |
| Contact Info   | Name                | **Yes**   | `User.name`, first name + surname from BankID                               |
| Contact Info   | Email Address       | **Yes**   | `User.email` — optional contact, not a credential                           |
| Contact Info   | Phone Number        | **Yes**   | `User.phoneNumber`, and `Payment.payerAlias` (the paying number)            |
| Sensitive Info | —                   | **Yes**   | **Political opinion**: party membership, and votes while a question is open |
| User Content   | Photos or Videos    | **Yes**   | Images attached to citizen proposals                                        |
| User Content   | Other User Content  | **Yes**   | Votes, proposals, comments, ratings                                         |
| Identifiers    | User ID             | **Yes**   | `User._id`, and `User.bankidSubject` — an account-level ID                  |
| Identifiers    | Device ID           | **Yes**   | `User.expoPushToken` is a device-level identifier                           |
| Purchases      | —                   | **Yes**   | Membership fee: amount, date, reference                                     |
| Usage Data     | Product Interaction | **Yes**   | Analytics — **Not Linked to You**                                           |
| Diagnostics    | Crash Data          | **Yes**   | **Not Linked to You**                                                       |
| Diagnostics    | Performance Data    | **Yes**   | **Not Linked to You**                                                       |
| **Other Data** | —                   | **Yes**   | **The personnummer** — see below                                            |

Everything else is **No**: Physical Address, Other User Contact Info, Health, Fitness, Payment
Info, Credit Info, Other Financial Info, Precise Location, Coarse Location, Contacts, Emails or
Text Messages, Audio Data, Gameplay Content, **Customer Support**, Browsing History, Search
History, Advertising Data, Other Usage Data, Other Diagnostic Data, Environment Scanning, Hands,
Head.

**Tracking:** No. Do not enable "Used to Track You" for any category.

### The personnummer goes under "Other Data"

Apple has no government-identifier type. The list runs Contact Info, Health & Fitness, Financial
Info, Location, Sensitive Info, Contacts, User Content, Browsing/Search History, Identifiers,
Purchases, Usage Data, Diagnostics, Surroundings, Body, **Other Data** — and a personnummer is none
of the first fourteen. Declare it as **Other Data**, described as a national identity number read
via BankID.

Its two derived hashes are a different question and belong under **Identifiers → User ID**:
`bankidSubject` is literally an account-level ID, and Apple's definition explicitly covers an
"assigned user ID … or other user- or account-level ID".

Apple asks whether data is _collected_, and processing in transit counts, so the raw number is
declared even though only hashes are retained.

### Two corrections worth remembering

- **Financial Info is entirely "No".** Apple's own note: if payment information is entered outside
  your app and the developer never has access to it, it is not Collected. Swish is exactly that —
  we never see a card or account number. The fee record itself is **Purchases**, which is its own
  top-level category, not a Financial Info subtype. The paying phone number is Contact Info →
  Phone Number.
- **Customer Support is "No".** The "Anmäl MAJ" button stores nothing and sends nothing — it sets
  two pieces of local state and shows a checkmark. Declaring it would over-report. (That the
  button also tells the user their report was sent is a separate problem, noted in §6.)

### Location: judged "No", deliberately

Arguable, so here is the reasoning rather than a bare answer. We never determine where a user or
their device is. We ask a civil registry whether a person is folkbokförd in Vallentuna and keep the
verdict; the kommun itself is discarded. A stored `ELIGIBLE` does imply residence in one
municipality, which is a coarse fact about where someone lives — but Apple's Location types are
about locating a user or device, and declaring them would tell users the app tracks their position,
which is the more misleading answer of the two. Revisit if the eligibility verdict is ever widened
to store the kommun itself.

---

## 3. Google Play — Data safety answers

Checked against the live form, 2026-08-27. Play asks **four** things per data type, and "linked to
the user" is **not** one of them — that is Apple's vocabulary and an earlier version of this
document wrongly used it here. The four are:

1. **Samlas in / Delas.** _Collected_ = leaves the device, to us or to a third party — including
   data only held in memory. _Shared_ = transferred to a third party. **Everything below is
   Delas: Nej** — see the section after this list, because that answer is not self-evident and is
   worth being able to defend.
2. **Behandlas temporärt?** Only in memory, kept no longer than the request needs. Data declared
   ephemeral still has to be reported but is not shown to users in the store listing.
3. **Krävs eller valfritt.** "Valfritt" if the user can use the app without it.
4. **Syften** — one or more of: Appfunktioner, Analyser, Kommunikation från utvecklaren,
   Annonsering, Säkerhet/efterlevnad/bedrägeri, Anpassning, Kontohantering. **Annonsering is never
   ticked.**

| Datatyp                                                    | Samlas in | Delas | Temporärt | Krävs/valfritt          | Syften                                              |
| ---------------------------------------------------------- | --------- | ----- | --------- | ----------------------- | --------------------------------------------------- |
| Personlig info → **Namn**                                  | Ja        | Nej   | Nej       | Går inte att välja bort | Appfunktioner, Kontohantering                       |
| Personlig info → **E-postadress**                          | Ja        | Nej   | Nej       | **Valfritt**            | Appfunktioner, Kommunikation från utvecklaren       |
| Personlig info → **Telefonnummer**                         | Ja        | Nej   | Nej       | **Valfritt**            | Appfunktioner, Kommunikation från utvecklaren       |
| Personlig info → **Användar-id**                           | Ja        | Nej   | Nej       | Går inte att välja bort | Appfunktioner, Kontohantering, Säkerhet/bedrägeri   |
| Personlig info → **Politiska eller religiösa åsikter**     | Ja        | Nej   | Nej       | **Valfritt**            | Appfunktioner                                       |
| Personlig info → **Övriga personuppgifter** (personnummer) | Ja        | Nej   | **Ja**    | Går inte att välja bort | Appfunktioner, Kontohantering, Säkerhet/efterlevnad |
| Ekonomisk info → **Köphistorik**                           | Ja        | Nej   | Nej       | **Valfritt**            | Appfunktioner, Säkerhet/efterlevnad                 |
| Foton och videor → **Foton**                               | Ja        | Nej   | Nej       | **Valfritt**            | Appfunktioner                                       |
| Meddelanden → **Andra meddelanden i appen**                | Ja        | Nej   | **Ja**    | **Valfritt**            | Appfunktioner                                       |
| Appaktivitet → **Annat användargenererat innehåll**        | Ja        | Nej   | Nej       | **Valfritt**            | Appfunktioner                                       |
| Appaktivitet → **Appinteraktioner**                        | Ja        | Nej   | Nej       | Går inte att välja bort | Analyser                                            |
| App-info och prestanda → **Kraschloggar**                  | Ja        | Nej   | Nej       | Går inte att välja bort | Analyser                                            |
| App-info och prestanda → **Diagnostik**                    | Ja        | Nej   | Nej       | Går inte att välja bort | Analyser                                            |
| **Enhets- eller andra id:n**                               | Ja        | Nej   | Nej       | **Valfritt**            | Appfunktioner, Kommunikation från utvecklaren       |

Everything not listed is **not collected**: address, race/ethnicity, sexual orientation, contacts,
calendar, location (see §2), health, fitness, SMS/MMS, e-post (the _content_ of messages), web
browsing history, installed apps, audio, files, and any advertising identifier.

### Why every row says "Delas: Nej"

The obvious objection: MAJ messages go to Anthropic, photos go to Vercel Blob, SMS goes to Twilio,
email goes to Resend. Those are third parties — so surely that is sharing?

Not under Play's definition. Google's exclusions from "sharing" cover **transfer to a service
provider that processes the data on your behalf**. Every third party here is in that category: they
act on our instructions, for our purposes, under our contract, and do not use the data for their
own ends. In GDPR terms they are processors, not controllers. It is the same reason nobody declares
"shared with my database host" for MongoDB Atlas.

| Third party              | What reaches them                         | Why it is not "sharing"                                   |
| ------------------------ | ----------------------------------------- | --------------------------------------------------------- |
| **Vercel** (host + Blob) | Everything, including proposal images     | Our hosting and storage — infrastructure, not a recipient |
| **MongoDB Atlas**        | The database                              | Same                                                      |
| **Anthropic**            | MAJ messages; comment text for moderation | Processes on our behalf and returns a result              |
| **Twilio**               | Phone number + message text               | Delivers SMS we compose                                   |
| **Resend**               | Email address + message text              | Delivers email we compose                                 |
| **Expo**                 | Push token + notification text            | Delivers pushes we compose                                |

Two more are a different shape, because neither is a transfer _outward from us_:

- **Svensk e-identitet** — the personnummer flows _to_ us, not from us. The user authenticates in
  the BankID app and we receive the result. There is nothing we are sending out.
- **Getswish** — we send an amount and our own payment reference, not personal data about the user.
  The payer authenticates in the Swish app directly, and a user-initiated transfer is itself a
  second Play exclusion.

**What this answer depends on.** The service-provider exclusion holds only while these parties
genuinely act on our behalf and do not use the data for their own purposes. That is a contractual
fact, not a technical one. Each needs a data-processing agreement, and this section should be
re-checked if any of them changes terms — particularly Anthropic, since MAJ sends free-text user
questions rather than mechanical payloads. Anthropic's API offers a **zero-data-retention**
configuration; if MAJ content ever needs stronger guarantees than the default commercial terms,
that is the lever to reach for.

### Why the personnummer is the only "temporärt: Ja"

It is used in memory to derive two hashes and to check age and folkbokföring, then discarded — the
textbook case of Play's ephemeral definition. What survives is `bankidSubject`, which is declared
separately as **Användar-id** and is emphatically _not_ ephemeral. Splitting them this way is what
makes both answers true; declaring the personnummer as retained would be wrong, and declaring the
account id as ephemeral would be worse.

### Messages: the MAJ chat

Anything typed to MAJ leaves the device — to us, and on to Anthropic as a processor. So
**Meddelanden → Andra meddelanden i appen: Samlas in = Ja, Delas = Nej**.

**Temporärt: Ja.** The message is held in memory, forwarded to Claude, and the reply returned —
nothing is written down **on our side**, which is what Play's ephemeral question asks about. That was not true until 2026-08-27, when `xai.ts` still logged a
120-character preview of every message, and 200 characters of every reply, which routinely quotes
the question back. Both were removed: what people ask MAJ is what they are unsure about in local
politics, often phrased personally, and it does not belong in log aggregation. Lengths and timings
are still logged and answer the same diagnostic questions.

**If anyone re-adds content logging to that route this answer becomes "Nej"**, and Messages starts
appearing in the store listing.

The other two Messages types are **Nej**: we send email and SMS, we never collect the user's own.
Collecting an email _address_ is Personlig info → E-postadress, which is a different thing.

### If you are asked whether data is "linked to the user"

Play's per-type questions do not include it, but Apple's do, and some of Play's newer flows echo the
wording. The answer for this app is: **everything is linked to the user except Appinteraktioner,
Kraschloggar and Diagnostik**, which are aggregate and not tied to an account.

### Also declare at app level

- **Data is encrypted in transit** — yes (HTTPS/TLS throughout; Swish additionally uses mTLS).
- **Users can request data deletion** — yes: `https://www.vallentuna.app/radera`.
- **Independent security review** — no.
- **Account creation methods** — **Övrigt**. Not username+password, not username+other auth, not
  OAuth: no username of any kind is entered. Accounts are created from a BankID identity via Svensk
  e-identitet. Suggested description: _"Konto skapas med svenskt BankID via
  e-legitimationsleverantören Svensk e-identitet. Användaren anger varken användarnamn eller
  lösenord."_

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

## 6. Open questions before the public release

### The "Anmäl MAJ" button reports nothing

`report()` in `apps/mobile/lib/XAIModal.tsx` sets two pieces of local state and shows a checkmark.
Nothing is sent and nothing is stored. That keeps Customer Support out of the privacy declaration,
which is accurate — but the button tells the user their report was delivered when it was not. Note
this is the _opposite_ problem from the MAJ request log, which was fixed by deleting it: here the
fix is either to store something or to stop claiming we did.
Either wire it to an endpoint (and then declare **User Content → Customer Support**) or change the
copy so it does not claim delivery. Not a privacy problem; a truthfulness one.

### In-app purchase

The membership fee is collected via Swish rather than in-app purchase. Whether that is acceptable
depends on the voting-rights benefit — see §9b of
[swish-integration-plan.md](swish-integration-plan.md). Resolve that before submitting for review;
it does not affect internal TestFlight.
