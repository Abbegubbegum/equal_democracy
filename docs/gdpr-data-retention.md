# GDPR — what we store, what we delete, and why

Written while building the BankID vote verification (see
[bankid-integration-plan.md](bankid-integration-plan.md) §3a). It covers the
whole app, not just BankID, because the questions BankID raised turned out to
have answers the existing collections were already relying on implicitly.

Not legal advice. The reasoning below is the engineering rationale and the
citations that back it; a lawyer should sign off before the election.

---

## 1. The three questions, answered

### Does a hash of a personnummer count as storing the personnummer?

**Yes.** Pseudonymised data is personal data — GDPR says so directly:

> Art. 4(5): "pseudonymisation" means processing personal data in such a manner
> that it can no longer be attributed to a specific data subject **without the
> use of additional information**, provided that such additional information is
> kept separately…

> Recital 26: "Personal data which have undergone pseudonymisation, which could
> be attributed to a natural person by the use of additional information, should
> be considered to be information on an identifiable natural person."

Only **anonymous** data falls outside the GDPR, and anonymisation has to be
irreversible. `pnrHash` is not: we hold the pepper, so we can recompute any
person's hash and match it. And even without the pepper a personnummer has only
~10^10 plausible values, which is a seconds-long brute force for anyone who gets
both the hashes and the key.

So `pnrHash` **is personal data**. It must be declared in the privacy policy,
included in a data-access request, and erased on request unless an exemption
applies.

What per-question salting buys is _not_ an exemption — it is a security and
minimisation measure under Art. 5(1)(c) and Art. 32: it stops the hash acting as
a cross-question identifier, so a database leak reveals "two rows are the same
person on this question" rather than a complete voting history.

### If we store the signature for a limited time, is that the same as storing it?

**Yes.** Retention period does not change _whether_ you are processing personal
data; it changes whether the retention is _lawful_ under the storage-limitation
principle, Art. 5(1)(e). A TTL is a compliance measure, not an exemption.

So the BankID signature must be disclosed, must appear in an access request
while it exists, and must be deletable on request. It is also the most
identifying thing in the whole system: the signed XML embeds the signer's
certificate, which carries the personnummer and the name. It is strictly more
sensitive than `pnrHash`.

### Should we delete someone's votes when they delete their account?

This is the genuinely hard one — see §4. Short version: **we currently delete
them, and that is probably the wrong default for a voting platform.**

---

## 2. What BankID adds

| Field                                               | Personal data?                 | Why we have it                                          | Retention        |
| --------------------------------------------------- | ------------------------------ | ------------------------------------------------------- | ---------------- |
| `QuestionVote.pnrHash`                              | **Yes** — pseudonymous         | One person, one vote per question, across accounts      | Life of the vote |
| `QuestionVote.verifiedAt`                           | No, on its own                 | Lets results state honestly which are BankID-backed     | Life of the vote |
| `VoteVerification.evidence.signature`               | **Yes** — directly identifying | Proof the ballot was signed, if a vote is disputed      | 30 days (TTL)    |
| `VoteVerification.evidence.ocspResponse`            | Yes                            | Certificate validity at signing time                    | 30 days (TTL)    |
| `VoteVerification.userId` + `questionId` + `choice` | Yes                            | Ballot intent, so the choice cannot be swapped mid-flow | 30 days (TTL)    |
| `VoteVerification.reasonCode`                       | No                             | Why an attempt failed (`WRONG_KOMMUN`, `userCancel`)    | 30 days (TTL)    |
| `VoteVerification.grandIdSession`                   | Indirectly                     | Idempotency and polling                                 | 30 days (TTL)    |

**Deliberately never stored:** the raw personnummer, name, address, kommun,
birth date, or any other SPAR field. Eligibility is computed at settle time and
only the _verdict_ survives — we keep "this vote was cast by an eligible voter",
never "this voter lives at this address".

That is a real minimisation win worth stating plainly in the privacy policy: the
app performs a full folkbokföring check on every ballot and retains none of the
data it checked.

### The 30-day window is the part to think about

For 30 days, `VoteVerification` holds `userId` + `questionId` + `choice` +
a signature containing the personnummer. That is a fully identified voting
record, and it is the most sensitive dataset the app has ever held.

Three defensible positions:

1. **Keep it (current).** Strongest audit story: for a month, any disputed vote
   can be proven signed. Cost: the window exists at all.
2. **Store `sha256(signature)` instead.** Proves we saw _a_ signature and that it
   matches one presented later, reveals nothing by itself. Loses the ability to
   re-verify the signature independently.
3. **Store no evidence.** Minimal. "Verified" then rests entirely on our own
   assertion, with nothing to show a sceptic.

Recommendation: **(2)** unless someone wants the stronger audit trail, because
the dispute it protects against ("I never cast that vote") is answerable by the
hash just as well — we would be comparing against a signature the _disputant_
produces, not reconstructing one ourselves.

---

## 3. What account deletion does today

`DELETE /api/account/delete`, verbatim from the code.

**Hard-deleted** — the row is gone:

`Proposal` · `ProposalRating` · `Comment` · `CommentRating` · `FinalVote` ·
`QuestionVote` · `VoteVerification` · `QuestionComment` ·
`QuestionCommentRating` · `CitizenProposal` (+ its blob images) ·
`CitizenProposalRating` · `BudgetVote` · `BudgetArgument` ·
`BudgetCategoryRating` · `MunicipalItemRating` · `SessionRequest` · `LoginCode` ·
`User`

**Severed** — the content survives, the personal link is set to null:

`Session.createdBy` · `Question.createdBy` · `BudgetSession.createdBy` ·
`MunicipalMeeting.createdBy` / `closedBy` · `SessionRequest.processedBy` ·
`Session.activeUsers` (pulled)

Rationale in the code: this content carries other people's votes and comments,
so deleting it would destroy their contributions too.

**Pseudonymised** — kept deliberately:

`Payment` — `payerAlias` and `rawCallback` cleared, `userDeletedAt` stamped,
`userId` left pointing at a User that no longer exists. Justified by
bokföringslagen 7:2 (seven years) and GDPR Art. 17(3)(b), and disclosed in
`/legal` §4.

The invariant the code maintains: **after deletion no collection still contains
that user's id** — except `Payment`, intentionally.

---

## 4. The votes problem

Deleting votes on account deletion has a consequence nobody has written down:
**it retroactively changes published results.** A question that closed 47–12 can
become 46–12 a month later because someone deleted their account. Anyone who
screenshotted the result now holds a figure the database contradicts.

For ordinary content that is the right trade — a deleted comment is nobody
else's contribution. A vote is different: it has been _counted_, and the count
was published.

### Options

|                                                            | Results stable?  | Erasure honoured? | Dedup survives? |
| ---------------------------------------------------------- | ---------------- | ----------------- | --------------- |
| **A. Delete the vote** (current)                           | ❌ tallies shift | ✅ fully          | ❌ resets       |
| **B. Anonymise: drop `userId` + `pnrHash`, keep `choice`** | ✅               | ✅                | ❌ resets       |
| **C. Anonymise but keep `pnrHash`**                        | ✅               | ⚠️ partial        | ✅              |

**Recommendation: B, refined into the close-time anonymisation in §5.** The vote row stops being personal data — no `userId`, no
pseudonym, just "a ja on question X, verified at time T" — so it is genuinely
anonymised rather than merely pseudonymised, and Recital 26 puts it outside the
GDPR entirely. Meanwhile the tally that was published stays true.

**C is tempting and should be resisted** without advice. Keeping the pseudonym
means refusing an erasure request for personal data, which needs an Art. 17(3)
exemption. The plausible one is 17(3)(d) — archiving in the public interest —
but we are an association, not an authority with an electoral mandate, so that
is a stretch. The residual risk of B is that someone deletes their account and
votes again on the same question; that costs them a full re-registration and
another BankID signature each time, which is a poor attack for the effort.

### This is not only a BankID question

`FinalVote` and `BudgetVote` are hard-deleted today and have exactly the same
problem — the budget median and session results shift retroactively. Whatever is
decided for `QuestionVote` should apply to all three. Deliberately left alone in
Stage 3 rather than widened without a decision.

---

## 5. Can votes be anonymous _and_ deduplicated?

Yes — by noticing that the two requirements never apply at the same time.

Everything that needs `userId` on a vote only matters **while the question is
open**: counting the quota, changing a vote, showing "you voted ja", and finding
the row to erase. Once a question closes, none of them can happen again. And
deduplication is likewise only meaningful while votes can still be cast.

So the identity on a vote has a natural expiry, and the design follows it.

### While a question is open

```
QuestionVote { questionId, userId, pnrHash, choice, verifiedAt, signatureHash }
   unique (questionId, userId)     — one vote per account
   unique (questionId, pnrHash)    — one vote per person, across accounts
```

**Account deletion during this window deletes the whole vote**, pseudonym
included — it does not anonymise it. That looks like the weaker option and is
actually the safer one:

- Anonymising but keeping `pnrHash` means refusing an erasure request for
  personal data.
- Anonymising and dropping `pnrHash` leaves the ballot in the tally _and_ frees
  the person to register again and cast a second one.
- Deleting the row means a delete-then-revote ends with exactly **one** vote.
  The tally loses one, but nothing is double-counted.

The tally shifting is acceptable here precisely because the question is still
open: no result has been published yet.

### When the question closes

Unset `userId` and `pnrHash` on every vote, and delete that question's
`VoteVerification` rows:

```
QuestionVote { questionId, choice, verifiedAt, signatureHash }
```

Deleting the verification rows is not optional. One of them holds `userId`,
`questionId` and `choice` together, so a single survivor reconstructs exactly
the link the `$unset` just removed — the anonymisation would be cosmetic. They
are TTL-purged after 30 days anyway; closing simply brings that forward.

Nothing in the remaining row identifies anyone and no key reconstructs the link,
so this is anonymous data rather than pseudonymous — outside the GDPR under
Recital 26. The tally is then permanent: an account deleted afterwards cannot
reach these votes, because `deleteMany({ userId })` no longer matches them.

`signatureHash` survives because it identifies nobody. See §2 for the honest
limits of what it proves.

### The indexes have to be partial, not sparse

This is the part that fails silently if you get it wrong, so it was tested
against MongoDB rather than reasoned about:

| index                                                            | result                                   |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `unique + sparse`, `pnrHash: null`                               | E11000 on the **second unverified vote** |
| `unique + sparse`, `pnrHash` absent                              | E11000 anyway                            |
| `unique + partialFilterExpression: {pnrHash: {$type: "string"}}` | works                                    |
| `unique` (plain), then `$unset userId`                           | E11000 **while anonymising**             |
| `unique + partialFilterExpression: {userId: {$exists: true}}`    | works                                    |

A _compound_ sparse index only skips a document when every indexed field is
missing, and `questionId` is always present — so sparse buys nothing. The first
row would have broken ordinary voting the moment two unverified votes landed on
one question; the fourth would have thrown at close time.

### What it costs

**Users lose the ability to see how they voted on closed questions.** Rösta and
the archive currently show `userVote` for closed questions; after anonymisation
the server genuinely cannot answer. Keeping that history on the device was
considered and **deliberately dropped** — not worth the effort for what it buys.
Closed questions simply stop showing a personal vote.

The quota count (`countDocuments({ userId })`) also stops seeing closed
questions. That is fine: it is the pre-election quota being retired in Stage 6
anyway, but the two changes have to land in the right order.

### What it does not fix

- **Small-N inference.** A question with three votes and three known
  participants is not anonymised by removing names. Nothing short of not
  publishing the result fixes that, and it is inherent to small electorates.
- **Timing correlation before close.** While the question is open the rows are
  still linked, so a leak or backup taken during that window is unaffected. This
  is forward secrecy, not retroactive.
- **A leak of the pepper while a question is open** still exposes that
  question's voters. The pepper remains the critical secret until close.

Genuine cryptographic ballot secrecy — blind signatures, mixnets, homomorphic
tallying — would remove even those. It is also a research-grade amount of work
and the wrong risk to take on before an election. This design gets most of the
benefit for a schema change and a close-time job.

### Implementation sketch

1. Anonymise at close, in the same place questions already close: the daily cron
   in `/api/check-session-timeout` and the manual `/api/admin/close-question`.
   One `updateMany` with `$unset`.
2. Make it idempotent and never let it run on an active question.
3. `/api/account/delete` unsets `userId` on votes instead of deleting them.
4. Mobile keeps its own vote history locally.
5. Backfill: existing votes have no `pnrHash`, so closing an old question simply
   unsets `userId`. That is strictly an improvement over today.

Note the same reasoning applies to `FinalVote` and `BudgetVote` (§4).

---

## 6. What has to change before BankID goes live

- [ ] **`docs/app-store-privacy-disclosure.md` §1 currently says "We do NOT
      collect: personnummer".** That becomes false. Both Apple's App Privacy
      answers and Google Play's Data safety form need updating, and a wrong
      answer there is a store-review problem as well as a legal one.
- [ ] **`/legal` §4** promises everything is deleted with one exception for
      payments. It needs the BankID paragraph: what is checked, what is kept,
      for how long, and the fact that no SPAR data is retained.
- [ ] **Decide §5** (close-time anonymisation) and implement it for
      `QuestionVote`, `FinalVote` and `BudgetVote` together, along with the
      `/api/account/delete` change from §4.
- [ ] **Accepted, not fixed:** the quota is avoidable with multiple accounts
      (one vote per person per _question_, but the per-account quota counts
      separately), and anonymised votes stop counting toward it at all. Both are
      Stage 6 problems, recorded here so they are not rediscovered as bugs.
- [ ] **Decide §2** (which form the signature evidence takes).
- [ ] **Data-access requests**: there is no export endpoint today. Art. 15 gives
      a right to a copy; `/radera` covers erasure but not access. Worth knowing
      before someone asks.
- [ ] **`VOTE_ID_PEPPER` is a key, not a config value.** Anyone with the database
      and the pepper can identify every voter. It should live only in Vercel's
      Production scope, and never in a preview environment sharing a database
      with production data.
