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
register(new URL("./ts-resolve-hooks.mjs", import.meta.url));

const { Question, QuestionVote, VoteVerification } =
  await import("../lib/models.ts");
const { settleVerification } = await import("../lib/bankid/settle.ts");
const { getGrandIdConfig } = await import("../lib/bankid/config.ts");

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

const RUNTIME_ENV = getGrandIdConfig().env;
const oid = () => new mongoose.Types.ObjectId();

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

const created = { questions: [], verifications: [], votes: [] };

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

async function makeVerification(
  question,
  { choice = "ja", env = RUNTIME_ENV, userId = oid() } = {},
) {
  const v = await VoteVerification.create({
    userId,
    questionId: question._id,
    choice,
    grandIdSession: `test-${oid().toString()}`,
    redirectUrl: "https://login.grandid.com/?sessionid=test",
    status: "PENDING",
    env,
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
    `\n  ${bold("settleVerification")} ${dim(`(env ${RUNTIME_ENV})`)}\n`,
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

    const b = await makeVerification(q, { choice: "nej" });
    const r = await settleVerification(b, session()); // same personnummer
    check("same person, second account", r.reasonCode, "ALREADY_VOTED");
    check(
      "  second vote not written",
      await QuestionVote.countDocuments({ questionId: q._id }),
      1,
    );

    // A different person on the same question is unaffected.
    const c = await makeVerification(q, { choice: "nej" });
    const other = await settleVerification(
      c,
      session({ personalNumber: "199001019876" }),
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
      env: RUNTIME_ENV === "production" ? "test" : "production",
    });
    const r = await settleVerification(v, session());
    check("environment mismatch", r.reasonCode, "ENV_MISMATCH");
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
    const v = await makeVerification(q);
    const r = await settleVerification(
      v,
      session({ birthDate: "2015-01-01", personalNumber: "201501017577" }),
    );
    check("under 16", r.reasonCode, "UNDERAGE");
  }

  console.log(
    `\n  ${failures ? red(`${failures} failed`) : green("all passed")}\n`,
  );
} finally {
  await QuestionVote.deleteMany({ questionId: { $in: created.questions } });
  await VoteVerification.deleteMany({ _id: { $in: created.verifications } });
  await Question.deleteMany({ _id: { $in: created.questions } });
  await mongoose.disconnect();
}

process.exit(failures ? 1 : 0);
