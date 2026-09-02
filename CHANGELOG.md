# Changelog

All notable changes to Equal Democracy (Jämlik Demokrati) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Conventions**

- The canonical product version is `expo.version` in [`apps/mobile/app.json`](apps/mobile/app.json).
  That is the number `pnpm release` bumps, the number the stores show, and the number
  [`apps/web/lib/app-version.ts`](apps/web/lib/app-version.ts) compares an installed build
  against. The root and `apps/web` `package.json` versions trail it and are not authoritative;
  `apps/mobile/package.json` is not versioned at all.
- Mobile store **build numbers** (`versionCode` / `buildNumber`) are auto-incremented by EAS and
  tracked separately from this human-facing version.
- **A released version is not necessarily a public one.** EAS submitting a build only puts it in
  TestFlight / the internal track. See the "reached the public stores" note on each entry below,
  and [docs/release-notes.md](docs/release-notes.md) for the user-facing store copy.
- Add changes under `[Unreleased]` as you go; on release, rename it to the new version + date and
  start a fresh `[Unreleased]`.

> **Backfill note (2026-08-22).** Versions 1.1.0 through 1.2.3 were reconstructed from git history
> after the changelog went unmaintained for ~3 months. They are accurate as to what shipped but
> are grouped after the fact, so they are coarser than an entry written at the time.

## [Unreleased]

## [1.3.0] - 2026-08-26

### Added

- **BankID signing on every vote (Vallentuna residency check).** A vote is now a BankID
  _signature_ over the ballot text — "Du röstar JA på: …" — rather than an authentication, so the
  voter is bound to what they approved. The same transaction returns SPAR folkbokföring, which is
  checked for age (16+) and residency in Vallentuna (kommunkod 0115) before the vote is recorded.
  Nothing about the person is kept: no personnummer, name, address, kommun or birth date, only the
  verdict.
- One person, one vote per question, across accounts. Each vote carries a per-question pseudonym —
  `HMAC(pepper, personnummer + ":" + questionId)` — under a unique index. Salting per question is
  what stops it doubling as a cross-question voting profile.
- Votes are anonymised when their question closes: `userId` and the pseudonym are unset and the
  question's verification rows deleted, so a closed result is anonymous data rather than
  pseudonymous, and a published tally can no longer shift when someone deletes their account.
- `pnpm grandid`, `pnpm eligibility` and `pnpm settle-test` — a live connection diagnostic, 25
  eligibility fixtures, and 22 settle checks that exercise every branch without spending a real
  BankID signature (there is no GrandID sandbox).
- [docs/gdpr-data-retention.md](docs/gdpr-data-retention.md) — what is stored, what is deleted, and
  why; including that a hashed personnummer is still personal data and a TTL is a compliance
  measure rather than an exemption.
- BankID signing on the **web** too. `/rosta` was voting through a session-only endpoint into the
  same tallies, so requiring BankID in the app alone would have left the browser as an unverified
  path. Both surfaces now share one settle step. The unverified web endpoint is deleted outright —
  unlike mobile, the web has no installed clients to break.
- A rate limit of 10 BankID orders per user per hour. Every accepted order is a billable signature
  and there is no sandbox, so this is a cost control as much as an abuse one.
- The admin question list shows how many of a tally's votes carry a BankID signature, so a signed
  result is distinguishable from one an older app build produced.
- `BANKID_ALLOW_ANY_KOMMUN`, a development-only override that skips the Vallentuna residency check.
  Without it the _eligible_ path cannot be reached by anyone not actually folkbokförd there, since
  there is no GrandID sandbox and no synthetic identities. It waives residency and nothing else —
  age, protected identity and samordningsnummer still reject — and three code-level guards keep it
  off every deployment.

- **BankID login, and the end of email accounts.** BankID is now the only way to create or open
  an account. The login screen offers nothing else on either surface: an email button could not
  lead anywhere different — someone without BankID loses account access either way, and someone
  with it authenticates with BankID regardless — so it only added a second door onto the same room.
  Login runs the _authentication_ service (`funcId: Identification`), never the signing one:
  logging in is not agreeing to anything, and the service key rather than the request decides which
  of the two BankID actually ran.
- **The whole app is readable without an account.** Questions, tallies, debates, proposals, budgets
  and council agendas are public on both surfaces; only acting needs an account. Store reviewers
  can therefore see everything without a Swedish BankID.
- **A capability model replaces "is there a session?".** A signed-in user can now be exactly as
  unable to act as an anonymous one, so every consumer route resolves one of four states —
  `anonymous`, `needs_bankid`, `restricted`, `participant` — and only the last may vote, comment,
  rate or propose. Capability is always read from the database, never from the token: access tokens
  live seven days, so a cached one would leave someone who just linked BankID blocked for a week.
  `isAdmin` is orthogonal — an admin who is not folkbokförd in Vallentuna can still manage
  questions and still cannot vote in them.
- **Eligibility is decided at login** and cached on the account, so an ineligible person is told
  why on the login screen instead of discovering it after paying for a signature. It is never
  authoritative at vote time — `settleVerification` re-checks against the SPAR block that arrives
  with the signature, because a cached verdict goes stale in exactly the way that matters: someone
  moves out of Vallentuna and keeps voting for the rest of their session.
- **The signing identity must match the voting account.** Nothing checked this before: the account
  was trusted and the signature only had to be valid, so A could sign a ballot cast from B's
  account and every check downstream passed. Now that an account carries a BankID identity, it is
  one comparison.
- **A link gate for accounts that predate BankID.** A legacy email account keeps its session and is
  blocked at startup with two ways out: link BankID, or log out to anonymous browsing. It blocks
  the account, never the app.
- **Claiming an old account by email.** Asked once right after BankID creates an account, and
  available from the settings sheet whenever a typed address turns out to belong to a legacy
  account. A six-digit code proves the mailbox, then the old account's votes, proposals and
  membership move across. Only a legacy, email-only account can be claimed — an address on another
  BankID account, or already on this one, is refused before a code is sent.
- **Email is now a contact field, not a credential** — optional, unverified and removable, exactly
  like the phone number. That is what keeps offering both a BankID login and an email address on
  one account clear of BankID's ID-växling rule, which forbids using a BankID identification to
  issue or use any other electronic identity. Merging is verified while the plain field is not,
  because absorbing an account has to prove the mailbox and storing a contact address does not.
- Membership requires a verified identity and a way to reach the member: BankID, an email address
  and a phone number, enforced server-side as well as in the UI.
- `scripts/bankid-login-migration.js` — index surgery and the `authMethod` backfill, dry-run by
  default. It also reports how many accounts are reachable only by email, which is the number that
  decides when email login can be switched off.

### Changed

- `/legal` now describes what BankID signing does: what is signed, what SPAR is asked, that no SPAR
  data is retained, what the per-question code can and cannot do, and that votes are anonymised
  when a question closes.
- The store privacy disclosure no longer claims we do not collect personnummer, and was checked
  against Apple's real data-type list: there is no "Government ID" type, so the personnummer is
  declared under **Other Data**, and the two hashes derived from it under **Identifiers → User ID**.
  Membership makes **Sensitive Info → political opinion** unavoidable on Apple and **Personal info →
  Political or religious beliefs** on Play. Financial Info is "No" throughout — Swish is entered
  outside the app, so the fee record is **Purchases** and the paying number is Contact Info.
  **Both store consoles still need the answers transcribed by hand.**
- The email OTP flow no longer creates accounts, and refuses any account that has BankID. It
  survives only so a legacy account can be signed into once, from an app build old enough to still
  offer the form, and reach the link gate. `/api/auth/request-code` silently declines to send to an
  unknown address or a BankID account — the response is unchanged either way, so it still reveals
  nothing about who is registered.
- A display name from BankID is the first name and surname, not every registered given name.
  Structured attributes are preferred where GrandID sends them; the fallback keeps nobiliary
  particles attached, so "Anna Maria von Sydow" becomes "Anna von Sydow" rather than "Anna Sydow".
- Settings save on change rather than behind a "Spara" button, and the sheet lifts its own content
  above the keyboard instead of sliding the whole modal up off the screen behind it.
- The **Hem** feed is a windowed `FlatList` rather than a `ScrollView`, so card images load as
  they come into view instead of starting one download per active question at once.
- React Compiler lint rules `react-hooks/immutability` and `react-hooks/refs` are enforced as
  errors again after the code they flagged was fixed.

### Fixed

- **A stuck BankID signature is no longer a dead end.** The same-device hand-off to the BankID app
  does not complete on every Android device — the order sits at `NOTLOGGEDIN` indefinitely while the
  app shows a spinner and nothing else. Signing from a second device works reliably, so after 35
  seconds without progress both the vote sheet and the login screen now say so and offer to reopen
  the page: "Öppna BankID-sidan igen och välj **BankID på annan enhet**." Deliberately additive —
  polling continues underneath, so a slow signer is never cut off and a late signature still lands.
- **The browser half of a BankID flow is now visible in the server logs.** The app posts its trace to
  `POST /api/mobile/bankid-trace`, so what the browser did — opened, closed with which result,
  whether a deep link ever fired — interleaves with the server's own view of the same order. A
  developer with the device in their hand could always read this from the console; the point is
  every other device, where "it just hangs" was the entire available diagnosis. Authorised by
  knowing the order's own id rather than by a session, since the login flow has no token yet.

- **BankID never completed on Android — the app was told to skip the browser.** Every BankID order
  set both `callbackUrl` (where GrandID sends the _browser_ once its hosted page finishes) and
  `appRedirect` (where the _BankID app_ sends the user the moment it is done) to the same deep link.
  On iOS the second one is required: `ASWebAuthenticationSession` is its own browser instance, so
  without it BankID returns to a Safari tab with none of the flow's state. On Android it is fatal —
  the Chrome Custom Tab is what drives GrandID's hosted page to completion, and that page is what
  finalises the session, so short-circuiting BankID straight back to the app left the tab parked
  mid-flow and the order stuck at `NOTLOGGEDIN` permanently, even though the signature itself had
  succeeded. Measured before the fix: thirty polls over 82 seconds after a successful signing, with
  no state change at all. The choice now lives in one place, `appRedirectFor()`, and applies to
  login and to both vote-signing endpoints — the same defect was present in all three.
- **BankID auth endpoints are now traceable.** An order that hangs used to be invisible: the poll
  loop logged nothing at all, so "the user is taking their time" and "GrandID never saw the browser
  come back" looked identical. Polls now log on state _change_ plus a warning heartbeat every ~20 s
  carrying what GrandID actually answered, how many polls it has cost and how long it has run;
  starts log both halves of the return trip; the GrandID transport line carries the `errorCode` that
  an HTTP 200 hides. Every line is tagged with the platform, inferred from the User-Agent rather
  than sent by the client, so a bug that only reproduces on one of them is readable. The app traces
  the half the server cannot see — what the browser did — under `[BankIdLogin]`.

- **Mobile API latency.** Serverless functions had no `regions` pin, so Vercel ran them in `iad1`
  (Washington DC) while the MongoDB Atlas cluster sits in Europe — every database round trip
  crossed the Atlantic twice and `/api/mobile/*` sat at ~1.3s. Pinned to `arn1` (Stockholm).
- `GET /api/mobile/questions` no longer loads every `QuestionVote` row into the function to count
  them in JavaScript; vote tallies come from a `$group` aggregation. Added a standalone index on
  `QuestionVote.userId`, which the existing compound index could not serve for the quota count.
- The mobile **Rösta** tab no longer refetches the whole question list to display the single
  question the **Hem** tab just handed it. Both screens share an in-memory cache and revalidate
  behind the rendered screen instead of behind a full-screen loading state.
- Account deletion gaps closed, and what the app stores is now documented; added `robots.txt`.
- **`User.email` and `User.bankidSubject` are partial indexes, not sparse ones.** A sparse unique
  index skips documents where the field is _missing_, not where it is explicitly `null` — and both
  fields default to `null`. Either would have accepted the first account without an email or a
  BankID and rejected the second, i.e. failed at the second signup rather than the first. The
  migration drops the old indexes first, because Mongoose only ever adds indexes and never replaces
  them.
- Polled endpoints send `Cache-Control: no-store`. Next.js puts an ETag on API responses by
  default, so a client polling a BankID order got 304s — either a body-less response or, worse, the
  platform HTTP cache transparently replaying the previous answer — and never saw the order settle.
- A BankID order is no longer cancelled when the component that started it unmounts. Opening the
  hosted page backgrounds the app, and any remount in that window killed an order the user was
  still signing. Cancelling is now a button.
- Duplicate requests on `/rosta`. NextAuth hands back a fresh session _object_ on every
  revalidation, so `session` in an effect's dependency array re-ran the whole load for an identity
  change. Effects that need auth depend on the `status` string instead.
- Merging into an account no longer reverts it. The surviving account was read before the merge and
  written back after, silently undoing the membership, admin flags and contact details the merge
  had just moved across.
- Long citizen proposals are readable again. On mobile the text card is height-capped and scrolls
  internally (with a white custom indicator — the native one is dark and uncolourable on Android),
  instead of a long title being clipped and an expanded description spilling off both ends of the
  screen. On the web listing, the card body clears the rank badge it used to collide with, and the
  two-line description now has a "Läs mer" toggle that appears only when text is actually hidden.

### Removed

- `output: "standalone"` from the Next config (a self-hosted setting Vercel ignores) and the
  unused `pdf-parse` dependency.
- `/api/debug-user`, an unreferenced endpoint whose POST granted superadmin to two hardcoded email
  addresses. Harmless-ish while email was a credential nobody could change; a privilege-escalation
  path the moment email became a user-editable contact field.
- "Bli admin" and the vote-quota line from the web home page.

### Infrastructure

- Two new environment variables, both **production-scope and required**:
  `GRANDID_AUTH_SERVICE_KEY` (the authentication service — login; the signing key was renamed to
  `GRANDID_SIGN_SERVICE_KEY`) and `LOGIN_ID_PEPPER`, which salts the BankID account identity.
  Like `VOTE_ID_PEPPER`, `LOGIN_ID_PEPPER` can **never be rotated** — rotating it orphans every
  account on the platform. Both are declared in `turbo.json`'s `env[]`, without which a changed
  value can serve a stale cached build.
- `scripts/bankid-login-migration.js` must run against production before the deploy, and it is not
  optional: the old unique index on `email` rejects the second account created without one.

### Docs

- [docs/bankid-login-plan.md](docs/bankid-login-plan.md) — the ID-växling rule that shapes the whole
  design, the capability model, the two merge paths and why one is verified and the other is not,
  and the release sequencing against app builds already on phones.
- `PRODUCTION_READINESS.md` rewritten as [SCALING.md](SCALING.md) — where the app stops working
  as it grows, with headroom measured against the production database rather than estimated.
- Line endings pinned to LF via `.gitattributes`, so `pnpm format` no longer rewrites every file
  in the repo.

## [1.2.3] - 2026-08-21

Reached the public stores. Users upgrading from 1.2.1 get 1.2.2's changes in this release too.

### Added

- **Update prompts.** The app asks the server whether its build is current and renders the
  verdict: a dismissable sheet for a new version, an undismissable wall for one that is too old
  to work. The policy, store links and copy all live server-side, because a build already on a
  phone can only be reached by a web deploy.

### Fixed

- Crash on returning from Swish. The `callbackurl` named a route that does not exist, and the
  root layout had no navigator able to present it.

### Infrastructure

- Swish environment variables declared in `turbo.json`; the Vercel Corepack requirement
  documented.

## [1.2.2] - 2026-08-21

**Never reached the public stores** — builds 6, 7 and 8 were TestFlight / internal only.

### Added

- **Swish membership payments.** Pay the membership fee in-app over the Swish Commerce API:
  mTLS client certificates from base64 environment variables, an unauthenticated callback that
  re-fetches the payment from Swish rather than trusting the POST body, and a daily reconcile
  cron as the safety net beneath both.
- Tapping a push notification about a new question now opens that question directly under
  **Rösta**, including from a cold start.

### Changed

- Membership rules text clarified (do not repeat an existing proposal).

### Infrastructure

- Migrated to pnpm 11; Node baseline raised to 22.13.

## [1.2.1] - 2026-07-15

### Added

- **MAJ writing help.** Before posting a citizen proposal or a debate argument, MAJ offers a
  corrected and a shortened version and warns if the same point already exists — same-stance
  duplicate detection for arguments, whole-stack detection for proposals.
- The web app harmonized with mobile: the Förslag stack, the Hem/Rösta flow, and shared category
  definitions.
- Image compression on admin upload routes.
- Back-to-top as a permanent last card on Hem and Förslag.

### Fixed

- The monthly motion is gated to the 1st and to post-election; questions are ordered by turnout.

## [1.2.0] - 2026-07-07

### Changed

- **The restructure.** Surveys removed entirely, voting sessions replaced by the
  `Question` / `QuestionVote` / `QuestionComment` family, `MunicipalSession` renamed to
  `MunicipalMeeting`, and the global `Settings.sessionLimitHours` replaced by a per-session
  `deadline`. Unused `User` fields and every denormalized aggregate were dropped in the same pass.

### Fixed

- **Atlas connection exhaustion (production incident).** Capped the MongoDB pool size — the
  driver defaults to 100 connections _per lambda instance_, which exhausted the shared-tier limit
  of 500 — and removed the N+1 query burst in the admin live panel that was forcing the pool to
  expand on every request.
- Stopped the live-panel polling storm caused by long-lived voting sessions.

### Added

- Licensed under AGPL-3.0, with the §13 network-use source-code link surfaced in the app.
- `pnpm release` — one command to bump, build and submit a mobile release.

## [1.1.0] - 2026-07-02

The bulk of the post-launch work: app-store compliance, GDPR, and the pre-election voting flow.

### Added

- **Pre-election Ja/Nej voting flow** with an inline för/emot debate and a 5-vote quota per user
  ahead of BankID verification.
- Admin panel restructured into **Mina frågor / Rösta / Förslag** tabs.
- `/support` page (required by the App Store) and `/radera`, the GDPR account-deletion flow,
  with its API.
- Privacy policy and terms of service; About page redesigned.
- Google Play review login bypass, so reviewers can get past the email OTP wall.
- `dev:live` launchers: the web dev server against the production database, and Expo Go against
  the production API.
- EAS Insights analytics; logout in the settings sheet; images on citizen proposals after
  submission; CSRF protection on the proposal and citizen-proposal admin APIs.

### Changed

- **XAI assistant rebranded to MAJ**; login screen redesigned to match the web (blue background,
  Vallentuna Framåt branding, amber CTA, Swedish throughout).
- Archive moved out of the tab swipe to a button on the Info tab.
- Citizen-proposal categories migrated from numeric ids to `ALL_CATEGORIES` strings.

### Removed

- Web-target support from the native mobile app — `react-native-pager-view` has no web
  implementation and the target never worked.

### Fixed

- Archive links and a municipality 404 guard, so the dynamic route stops matching arbitrary slugs.
- Interests now actually save to the database; markdown code fences stripped from AI category
  responses; Swedish characters restored on `/support`; PNG favicon replacing the broken `.ico`.

## [1.0.0] - 2026-05-31

Initial release — the platform as deployed for Vallentuna kommun.

### Added

- **Voting sessions** — phase-based proposal submission, 1–5 star ratings, for/against/neutral
  debate, and final yes/no votes; archive of winning proposals.
- **Participatory budget** — citizens allocate the municipal budget; results computed by median,
  with a per-category debate. AI extracts budget data from uploaded PDFs.
- **Citizen proposals (medborgarförslag)** — submit, rate, and track proposals, with image upload
  to Vercel Blob.
- **Municipal council meetings** — agenda items parsed from PDFs via AI; targeted notifications.
- **Mobile app (Expo / React Native)** — Hem, Sessioner, Rösta, Förslag, Arkiv, and Info tabs;
  JWT auth; the Claude-backed XAI assistant; a local star/gamification system; and **push
  notifications** (FCM V1 on Android via an EAS dev/production build).
- **Platform** — NextAuth email-OTP auth, Pusher real-time, Resend email, Twilio SMS, Claude
  content moderation, 5-language i18n, and 4 theme color schemes.

### Infrastructure

- EAS build profiles (development dev-client + production) with `EXPO_PUBLIC_API_URL` baked per
  profile and auto-incremented mobile build numbers.
- Serverless-ready on Vercel: image uploads on Vercel Blob, a daily session-timeout cron, and a
  documented production deploy checklist (since rewritten as [SCALING.md](SCALING.md)).

[Unreleased]: https://github.com/Abbegubbegum/equal_democracy/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/Abbegubbegum/equal_democracy/compare/v1.2.3...v1.3.0
[1.2.3]: https://github.com/Abbegubbegum/equal_democracy/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/Abbegubbegum/equal_democracy/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/Abbegubbegum/equal_democracy/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Abbegubbegum/equal_democracy/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Abbegubbegum/equal_democracy/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Abbegubbegum/equal_democracy/releases/tag/v1.0.0
