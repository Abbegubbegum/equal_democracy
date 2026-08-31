#!/usr/bin/env node
/**
 * Integration test for lib/bankid/settle.ts — the only code that writes a
 * verified vote.
 *
 *   pnpm settle-test
 *
 * `settleVerification` takes the completed BankID session as a parameter, so
 * every branch is reachable without spending a real signature. That matters:
 * there is no GrandID sandbox, so the alternative would be paying for a
 * signature per scenario and still being unable to produce an under-16 or a
 * protected identity on demand.
 *
 * Runs against the development database (MONGODB_URI) and deletes everything it
 * creates, including on failure.
 */

import { config as loadEnv } from "dotenv";
import { register } from "module";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

loadEnv({ path: fileURLToPath(new URL("../.env.local", import.meta.url)) });
process.env.LOG_LEVEL = process.argv.includes("--verbose") ? "debug" : "error";
// The rules under test are the real ones. A developer with the residency
// override enabled in .env.local would otherwise see the Göteborg case pass,
// which is exactly the assertion that must not quietly flip.
process.env.BANKID_ALLOW_ANY_KOMMUN = "false";
register(new URL("./ts-resolve-hooks.mjs", import.meta.url));

// The subject check needs a pepper, and a throwaway one is right here: every
// subject this run derives is compared inside this same process and deleted
// again at the end. Using the configured value instead would make the fixtures
// depend on a production secret being present to run at all.
//
// It does NOT substitute for setting LOGIN_ID_PEPPER for real — without that,
// nobody can log in.
if (!process.env.LOGIN_ID_PEPPER) {
  process.env.LOGIN_ID_PEPPER = (await import("crypto"))
    .randomBytes(32)
    .toString("hex");
}

const { Question, QuestionVote, User, VoteVerification } =
  await import("../lib/models.ts");
const { settleVerification } = await import("../lib/bankid/settle.ts");
const { runtimeEnv } = await import("../lib/bankid/config.ts");
const { loginSubject } = await import("../lib/bankid/subject.ts");
const { votePseudonym } = await import("../lib/bankid/pseudonym.ts");

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

const RUNTIME = runtimeEnv();
const oid = () => new mongoose.Types.ObjectId();

/** The personnummer every fixture signs with unless it says otherwise. */
const DEFAULT_PNR = "200405257577";

/** A completed BankID session, shaped exactly like getBankIdSession returns. */
function session({
  personalNumber = "200405257577",
  orderType = "Signing",
  lanKod = "01",
  kommunKod = "15",
  birthDate = "1990-01-01",
  spar = true,
} = {}) {
  return {
    state: "complete",
    personalNumber,
    name: "Test Testsson",
    userAttributes: spar
      ? {
          personalNumber,
          SPARv2: {
            ns4PersonId: {
              ns4IdNummer: personalNumber,
              ns4Typ: "PERSONNUMMER",
            },
            ns5Sekretessmarkering: "NEJ",
            ns5SkyddadFolkbokforing: "NEJ",
            ns10Persondetaljer: {
              ns2DatumTill: "9999-12-31",
              ns10Fodelsedatum: birthDate,
            },
            ns14Folkbokforing: {
              ns2DatumTill: "9999-12-31",
              ns14FolkbokfordLanKod: lanKod,
              ns14FolkbokfordKommunKod: kommunKod,
            },
          },
        }
      : { personalNumber },
    evidence: {
      orderType,
      signature: "PD94bWwgdmVyc2lvbj0iMS4wIj8+PHNpZ25hdHVyZS8+",
      ocspResponse: "MIIH",
      bankIdIssueDate: "2024-03-28Z",
      notBefore: "1711580400000",
      notAfter: "1869343199000",
      ipAddress: "127.0.0.1",
    },
  };
}

const created = { questions: [], verifications: [], votes: [], users: [] };

async function makeQuestion(status = "active") {
  const q = await Question.create({
    text: "Testfråga för settle-testet",
    status,
    deadline: new Date(Date.now() + 86400000),
    createdBy: oid(),
  });
  created.questions.push(q._id);
  return q;
}

/**
 * A real account for the voter.
 *
 * settleVerification now checks that the personnummer doing the signing derives
 * the same `bankidSubject` as the account casting the vote, so a fixture cannot
 * use a bare ObjectId any more — the User has to exist and carry the subject the
 * signature will produce.
 */
async function makeVoter(personalNumber = DEFAULT_PNR) {
  const bankidSubject = loginSubject(personalNumber);

  // Reused rather than recreated, because that is now the truth: one
  // personnummer is one account, enforced by a unique index. Several fixtures
  // sign with the same default identity, and each one asking for "the account
  // for this person" must get the same account.
  const existing = await User.findOne({ bankidSubject }).select("_id").lean();
  if (existing) return existing._id;

  const u = await User.create({
    name: "Testperson",
    email: null,
    authMethod: "bankid",
    bankidSubject,
    bankidLinkedAt: new Date(),
    eligibility: { eligible: true, code: "ELIGIBLE", checkedAt: new Date() },
  });
  created.users.push(u._id);
  return u._id;
}

async function makeVerification(
  question,
  { choice = "ja", runtime = RUNTIME, userId = null, personalNumber } = {},
) {
  const v = await VoteVerification.create({
    userId: userId || (await makeVoter(personalNumber)),
    questionId: question._id,
    choice,
    grandIdSession: `test-${oid().toString()}`,
    redirectUrl: "https://login.grandid.com/?sessionid=test",
    status: "PENDING",
    runtime,
  });
  created.verifications.push(v._id);
  return v;
}

let failures = 0;
const check = (name, actual, expected) => {
  const pass = actual === expected;
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? green("✓") : red("✗")} ${name.padEnd(48)} ${
      pass ? dim(actual) : red(`${actual} — expected ${expected}`)
    }`,
  );
};

try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(
    `\n  ${bold("settleVerification")} ${dim(`(runtime ${RUNTIME})`)}\n`,
  );

  // --- happy path -----------------------------------------------------------
  {
    const q = await makeQuestion();
    const v = await makeVerification(q);
    const r = await settleVerification(v, session());
    check("eligible Vallentuna voter", r.status, "VERIFIED");

    const vote = await QuestionVote.findOne({ questionId: q._id });
    created.votes.push(vote?._id);
    check("  vote written", vote ? "yes" : "no", "yes");
    check("  choice recorded", vote?.choice, "ja");
    check("  verifiedAt set", vote?.verifiedAt ? "yes" : "no", "yes");
    check("  pnrHash set", vote?.pnrHash ? "yes" : "no", "yes");
    check("  signatureHash set", vote?.signatureHash ? "yes" : "no", "yes");
    check(
      "  raw signature NOT stored",
      v.evidence?.signature === undefined ? "absent" : "present",
      "absent",
    );

    // Replaying a settled verification must not write a second vote.
    const again = await settleVerification(v, session());
    check("replay is a no-op", again.changed, false);
    check(
      "  still one vote",
      await QuestionVote.countDocuments({ questionId: q._id }),
      1,
    );
  }

  // --- one person, two accounts --------------------------------------------
  {
    const q = await makeQuestion();
    const a = await makeVerification(q);
    await settleVerification(a, session());

    // This used to be a settle-time defence: two accounts, one personnummer, and
    // pnrHash refusing the second vote. It is refused a layer earlier now — the
    // unique bankidSubject means the second account cannot exist at all.
    let refused = "no";
    try {
      // Deliberately User.create rather than makeVoter, which reuses: the point
      // is that a *second row* for one person is impossible.
      await User.create({
        name: "Testperson igen",
        email: null,
        authMethod: "bankid",
        bankidSubject: loginSubject(DEFAULT_PNR),
      });
    } catch (error) {
      refused = error?.code === 11000 ? "yes" : "other error";
    }
    check("a second account for one person", refused, "yes");

    // pnrHash is kept regardless, and this is why: a vote cast before the
    // subject existed carries an account that cannot be compared, and a question
    // may still hold one.
    const legacyPnr = "199001019876";
    const legacyVote = await QuestionVote.create({
      questionId: q._id,
      userId: oid(),
      choice: "ja",
      verifiedAt: new Date(),
      pnrHash: votePseudonym(legacyPnr, q._id.toString()),
    });
    created.votes.push(legacyVote._id);

    const b = await makeVerification(q, {
      choice: "nej",
      personalNumber: legacyPnr,
    });
    const r = await settleVerification(
      b,
      session({ personalNumber: legacyPnr }),
    );
    check("same person, legacy vote on record", r.reasonCode, "ALREADY_VOTED");
    check(
      "  second vote not written",
      await QuestionVote.countDocuments({ questionId: q._id }),
      2,
    );

    // A different person on the same question is unaffected.
    const thirdPnr = "198203047575";
    const c = await makeVerification(q, {
      choice: "nej",
      personalNumber: thirdPnr,
    });
    const other = await settleVerification(
      c,
      session({ personalNumber: thirdPnr }),
    );
    check("different person, same question", other.status, "VERIFIED");
    for (const vote of await QuestionVote.find({ questionId: q._id })) {
      created.votes.push(vote._id);
    }
  }

  // --- guards ---------------------------------------------------------------
  {
    const q = await makeQuestion();
    const v = await makeVerification(q);
    const r = await settleVerification(
      v,
      session({ orderType: "Identification" }),
    );
    check("BankID identified instead of signing", r.reasonCode, "NOT_SIGNED");
    check(
      "  no vote written",
      await QuestionVote.countDocuments({ questionId: q._id }),
      0,
    );
  }
  {
    const q = await makeQuestion("closed");
    const v = await makeVerification(q);
    const r = await settleVerification(v, session());
    check("question closed mid-signing", r.reasonCode, "QUESTION_CLOSED");
    check(
      "  no vote written",
      await QuestionVote.countDocuments({ questionId: q._id }),
      0,
    );
  }
  {
    const q = await makeQuestion();
    const v = await makeVerification(q, {
      runtime: RUNTIME === "production" ? "development" : "production",
    });
    const r = await settleVerification(v, session());
    check("started by a different runtime", r.reasonCode, "RUNTIME_MISMATCH");
  }
  {
    const q = await makeQuestion();
    const v = await makeVerification(q);
    const r = await settleVerification(v, session({ spar: false }));
    check("SPAR block missing", r.reasonCode, "SPAR_MISSING");
    check("  fails, not rejects", r.status, "FAILED");
  }
  {
    const q = await makeQuestion();
    const v = await makeVerification(q);
    const r = await settleVerification(
      v,
      session({ lanKod: "14", kommunKod: "80" }),
    );
    check("folkbokförd in Göteborg", r.reasonCode, "WRONG_KOMMUN");
  }
  {
    const q = await makeQuestion();
    const v = await makeVerification(q, { personalNumber: "201501017577" });
    const r = await settleVerification(
      v,
      session({ birthDate: "2015-01-01", personalNumber: "201501017577" }),
    );
    check("under 16", r.reasonCode, "UNDERAGE");
  }

  // --- signing with a BankID that is not the account's ----------------------
  {
    const q = await makeQuestion();
    // The account belongs to one person; the signature comes from another.
    // Before this check, both were genuine and the vote was written.
    const v = await makeVerification(q);
    const r = await settleVerification(
      v,
      session({ personalNumber: "199001019876" }),
    );
    check("signed by a different person", r.reasonCode, "SUBJECT_MISMATCH");
    check("  rejects, not fails", r.status, "REJECTED");
    check(
      "  no vote written",
      await QuestionVote.countDocuments({ questionId: q._id }),
      0,
    );
  }

  // --- the development residency override -----------------------------------
  {
    const q = await makeQuestion();
    const v = await makeVerification(q);
    process.env.BANKID_ALLOW_ANY_KOMMUN = "true";
    const r = await settleVerification(
      v,
      session({ lanKod: "14", kommunKod: "80" }),
    );
    process.env.BANKID_ALLOW_ANY_KOMMUN = "false";
    check("override: Göteborg is accepted", r.status, "VERIFIED");
    check(
      "  vote written",
      await QuestionVote.countDocuments({ questionId: q._id }),
      1,
    );
  }

  // --- the pre-election quota ------------------------------------------------
  {
    // Its own person: five votes are cast against this account, and any fixture
    // sharing it would carry them into the quota.
    const quotaPnr = "197712245588";
    const voter = await makeVoter(quotaPnr);
    // Five first-time votes already cast, on other questions.
    for (let i = 0; i < 5; i += 1) {
      const q = await makeQuestion();
      await QuestionVote.create({
        questionId: q._id,
        userId: voter,
        choice: "ja",
      });
    }

    const sixth = await makeQuestion();
    const v = await makeVerification(sixth, { userId: voter });
    const r = await settleVerification(
      v,
      session({ personalNumber: quotaPnr }),
    );
    check("sixth first-time vote", r.reasonCode, "QUOTA_REACHED");
    check(
      "  no vote written",
      await QuestionVote.countDocuments({ questionId: sixth._id }),
      0,
    );

    // Changing a vote already cast consumes no slot, so it must still work at
    // the limit.
    const already = await QuestionVote.findOne({ userId: voter });
    const change = await makeVerification(
      { _id: already.questionId },
      { userId: voter, choice: "nej" },
    );
    const changed = await settleVerification(
      change,
      session({ personalNumber: quotaPnr }),
    );
    check("changing an existing vote at the limit", changed.status, "VERIFIED");
    check(
      "  choice updated",
      (await QuestionVote.findById(already._id)).choice,
      "nej",
    );
  }

  console.log(
    `\n  ${failures ? red(`${failures} failed`) : green("all passed")}\n`,
  );
} finally {
  await QuestionVote.deleteMany({ questionId: { $in: created.questions } });
  await VoteVerification.deleteMany({ _id: { $in: created.verifications } });
  await Question.deleteMany({ _id: { $in: created.questions } });
  await User.deleteMany({ _id: { $in: created.users } });
  await mongoose.disconnect();
}

process.exit(failures ? 1 : 0);
