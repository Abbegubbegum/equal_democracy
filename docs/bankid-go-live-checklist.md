# BankID go-live checklist

The production switch, step by step. Companion to
[bankid-integration-plan.md](bankid-integration-plan.md) (design and findings)
and [gdpr-data-retention.md](gdpr-data-retention.md) (what is stored and why).

**There is no GrandID sandbox.** Every step below that involves a signature
costs a real one against a real identity. Budget for that rather than
discovering it mid-rollout.

---

## 1. Before anything ships

- [x] **Confirm signature pricing with Svensk E-identitet.** One signature per
      ballot, not per login. This is the only item that could change the design
      after the fact, so settle it first.
- [x] Ask again for **test credentials**. Not a blocker — everything works
      without them — but every rehearsal currently costs money.
- [x] Have a **Vallentuna resident** complete one vote. The eligible path is the
      one branch never exercised end to end: all live runs so far ended in
      `WRONG_KOMMUN`, which proves the rejection path only. Verify afterwards
      that the vote row carries `verifiedAt`, `pnrHash` and `signatureHash`.

## 2. Environment

- [x] `GRANDID_ENV=production`, `GRANDID_API_KEY`, `GRANDID_SIGN_SERVICE_KEY` set in
      Vercel **Production scope only**. The service key must be the signing one
      (`…69dc`); the other is an authentication service and would silently
      produce `Identification` transactions that bind nobody to a ballot.
- [x] `VOTE_ID_PEPPER` set in Production, and **nowhere else**. Anyone holding
      both the database and the pepper can identify every voter. It must never
      exist in a preview environment that shares a database with production.
- [x] Confirm all four are declared in `turbo.json`'s `env[]`, or a changed value
      can serve a stale cached build.
- [x] **`BANKID_ALLOW_ANY_KOMMUN` must not exist in Vercel at all.** It skips the
      residency check. Three code-level guards make it inert on a deployment, but
      it has no business being set there — if it appears in the Vercel dashboard,
      someone has misunderstood it.
- [x] `NEXTAUTH_URL` must match the origin the browser actually reaches —
      the web callback is built from it (`${getBaseUrl()}/rosta`).

## 3. Legal and store disclosures

These are the items most likely to be forgotten, and the most damaging to miss.

- [x] **`docs/app-store-privacy-disclosure.md`** updated: the false "we do NOT
      collect personnummer" line is gone, the inventory gains the three BankID
      rows, Apple gains **Other Data** (there is no Government ID type) and Play gains
      **Personal info → Other personal info**.
- [x] **Transcribe those answers into the store consoles.** The document is only
      the source of truth; Apple's App Privacy and Play's Data safety forms are
      filled in by hand and neither is updated by a release.
- [x] **`/legal`** §2 and §4 rewritten: what is signed, what is checked, that no
      SPAR data is kept, what the per-question code is for, the 30-day purge and
      the anonymisation at close.
- [x] Say **"varje röst signeras med BankID"**, never "verifieras" — it is a
      signature, and the distinction is the whole point of using the signing
      service.

## 4. Releasing the app

Order matters here. The web and the app cannot switch at the same instant, and
getting the sequence wrong either breaks voting or leaves an unverified path
open.

1. [x] **Deploy the web** with both paths live. Current app builds keep using
       `/api/mobile/questions/vote`; nothing breaks.
2. [x] **Release the app** (`pnpm release`) and wait until it is actually live in
       **both** stores.
3. [x] **Bump `LATEST_MOBILE_VERSION`** in `lib/app-version.ts` — only now, or
       users are nagged about a version the store does not have.
4. [ ] **Retire the unverified path**: delete
       `pages/api/mobile/questions/vote.ts` and `PRE_ELECTION_LIMIT`, and raise
       `MIN_SUPPORTED_MOBILE_VERSION` to the BankID release **in the same
       change**. Until this step, an old build can still cast unverified votes.
5. [ ] **Rotate `NEXTAUTH_SECRET`** — here, and deliberately not earlier.

   It currently has the same value in `.env.local` as in Vercel, which means a
   development machine can mint tokens the production API accepts. That is the
   thing being fixed; rotating production while dev keeps the old value achieves
   nothing, so **set a different value in each**.

   Rotating logs everyone out: it signs the mobile access (7 d) and refresh
   (30 d) tokens, so both fail and `apiClient`'s silent refresh cannot save the
   session — every app user redoes email→OTP. Web sessions drop too, and
   in-flight CSRF tokens fail one request until the page refetches.

   Doing it in the same step as the forced update is what keeps that to a single
   disruption: those users are already being made to update, so they log in once
   rather than once for the update and again for the rotation. (A zero-logout
   rotation is possible — verify against a previous secret for 31 days while
   signing with the new one — but it is code for a one-time event, and was
   deliberately not written.)

   ⚠️ **Do not rotate `VOTE_ID_PEPPER` at the same time**, or at all. It is not
   the same kind of secret: old vote pseudonyms would stop matching new ones and
   the duplicate-vote protection would silently reset.

Note the web needed none of this: it has no installed clients, so
`/api/questions/vote` was simply deleted.

## 5. After the switch

- [ ] Watch for `SPAR_MISSING` in the logs. It means the add-on stopped
      arriving, which is a configuration failure on our side, not an ineligible
      voter — and it fails closed, so votes stop rather than slip through.
- [ ] Watch for `RUNTIME_MISMATCH`. It means a verification started by a
      development server reached the deployment — most likely someone running
      `pnpm dev:web:live` against production data.
- [ ] Watch for `NOT_SIGNED`. It means `GRANDID_SIGN_SERVICE_KEY` is pointing at the
      authentication service.
- [ ] Check that closing a question anonymises its votes: `userId` and `pnrHash`
      unset, `VoteVerification` rows for it gone.
- [ ] Confirm the daily cron still closes questions — anonymisation now runs
      inside it, and a failure there is caught per-question so one bad row
      cannot abort the sweep.

## 6. Known gaps, accepted deliberately

Recorded so they are not rediscovered as bugs:

- The per-account **quota is avoidable** with several accounts: one person votes
  once per _question_ (enforced by `pnrHash`), but the 5-vote quota counts per
  account, so several accounts mean several quotas.
- **Anonymised votes stop counting** toward the quota, since it is a `userId`
  predicate and closing a question unsets exactly that field. A voter's quota
  therefore recovers as the questions they voted in close.
- **Deleting an account frees the pseudonym**, so someone could re-register and
  vote again on a question they had already voted on. Each attempt costs another
  signature, and retaining the pseudonym past erasure has no legal basis.
- **Rejected attempts store no evidence** — `orderType` and `signatureHash` are
  written only on the verified path, so there is no record that an ineligible
  person did complete a signature.
