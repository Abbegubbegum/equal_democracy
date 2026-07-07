#!/usr/bin/env node

/**
 * One-shot DB restructure: sessions cleanup (2026-07).
 *
 * 1. Backs up all survey data to a JSON file, then deletes it
 *    (surveys, surveyvotes, survey-type sessions + their proposals/ratings/comments).
 * 2. Converts "voting"-type sessions into the new `questions` collection
 *    (same _id), moving quickvotes -> questionvotes and their comments ->
 *    questioncomments (+ ratings -> questioncommentratings).
 * 3. Renames `municipalsessions` -> `municipalmeetings` and converts each
 *    spawned municipal-type session into a Question (same _id, meetingId set),
 *    moving finalvotes (yes/no -> ja/nej) and comments across. Meeting items
 *    get `questionId` instead of `sessionId`/`proposalId`.
 * 4. Renames municipalitemratings.municipalSessionId -> meetingId and
 *    citizenproposals.selectedForMunicipalSession -> selectedForMeeting.
 * 5. Field cleaning (2026-07 audit): strips unused User fields (isMember,
 *    userType, bankId*, lastCitizenVoteDate, votesUsedInCurrentYear,
 *    canCloseQuestions), moves Settings.sessionLimitHours onto each active
 *    session as a concrete `deadline`, removes denormalized aggregates
 *    (proposal thumbsUpCount/averageRating, comment averageRating,
 *    citizenproposal totalStars/ratingCount/averageRating, municipal meeting
 *    items totalStars/ratingCount/averageRating) and authorName snapshots
 *    (proposals, comments, citizenproposals, topproposals), drops the unused
 *    citizenproposal selectedForMunicipalSession/selectedAt/
 *    submittedAsMotionAt/motionNumber fields, removes the QuestionVote
 *    "abstar" choice (ja/nej only), renames thumbsups -> proposalratings and
 *    topproposals -> winningproposals, renames proposal status "top3" ->
 *    "finalist", and drops the redundant sessionId from
 *    comments/commentratings/proposalratings.
 * 6. Unsets sessionType/surveyDurationDays/archiveDate on remaining (now
 *    purely standard) sessions and drops quickvotes/surveys/surveyvotes.
 * 7. Drops any remaining collection not backed by a model currently exported
 *    from lib/models.ts (checked against a manually-maintained whitelist —
 *    catches stale collections left over from any earlier, unrelated schema
 *    iteration, not just this restructure).
 *
 * Usage:
 *   node scripts/restructure-db.js               # dry run against MONGODB_URI
 *   node scripts/restructure-db.js --apply       # execute against MONGODB_URI
 *   node scripts/restructure-db.js --production  # dry run against MONGODB_URI_PRODUCTION
 *   node scripts/restructure-db.js --production --apply
 *
 * Run `npm run backup` first when targeting production.
 */

import { MongoClient, ObjectId, BSON } from "mongodb";
const { EJSON } = BSON;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, "..", ".env") });
}

const APPLY = process.argv.includes("--apply");
const PRODUCTION = process.argv.includes("--production");
const URI = PRODUCTION
  ? process.env.MONGODB_URI_PRODUCTION
  : process.env.MONGODB_URI;

if (!URI) {
  console.error(
    `\n❌ ${PRODUCTION ? "MONGODB_URI_PRODUCTION" : "MONGODB_URI"} not set in .env.local\n`,
  );
  process.exit(1);
}

const MODE = APPLY ? "APPLY" : "DRY RUN";
const dbName = URI.split("/").pop().split("?")[0];

// Renaming into a target name that a live Mongoose connection has already
// auto-created (empty, via schema/model registration) fails with
// "target namespace exists". Drop the target first — but only if it's
// genuinely empty; a non-empty target means real data already landed there
// (e.g. a previous --apply got further than we think) and must not be
// silently destroyed.
async function dropEmptyTarget(db, name) {
  const collNames = (await db.listCollections().toArray()).map((c) => c.name);
  if (!collNames.includes(name)) return;
  const count = await db.collection(name).countDocuments();
  if (count > 0) {
    throw new Error(
      `Refusing to rename into "${name}": it already has ${count} doc(s). Investigate before proceeding.`,
    );
  }
  await db.collection(name).drop();
}

async function main() {
  console.log(`\n🔧 DB restructure — ${MODE} against "${dbName}"\n`);

  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  const sessions = db.collection("sessions");
  const proposals = db.collection("proposals");
  const thumbsups = db.collection("thumbsups");
  const comments = db.collection("comments");
  const commentratings = db.collection("commentratings");
  const finalvotes = db.collection("finalvotes");
  const topproposals = db.collection("topproposals");
  const quickvotes = db.collection("quickvotes");
  const questions = db.collection("questions");
  const questionvotes = db.collection("questionvotes");
  const questioncomments = db.collection("questioncomments");
  const questioncommentratings = db.collection("questioncommentratings");
  const citizenproposals = db.collection("citizenproposals");
  const municipalitemratings = db.collection("municipalitemratings");

  const summary = [];
  const warnings = [];

  // ── 1. Survey data: backup, then delete ────────────────────────────────
  const surveyDocs = await db.collection("surveys").find().toArray();
  const surveyVoteDocs = await db.collection("surveyvotes").find().toArray();
  const surveySessions = await sessions
    .find({ sessionType: "survey" })
    .toArray();
  const surveySessionIds = surveySessions.map((s) => s._id);
  const bySurveySession = { sessionId: { $in: surveySessionIds } };
  const surveyProposals = await proposals.find(bySurveySession).toArray();
  const surveyThumbs = await thumbsups.find(bySurveySession).toArray();
  const surveyComments = await comments.find(bySurveySession).toArray();
  const surveyCommentRatings = await commentratings
    .find(bySurveySession)
    .toArray();
  const surveyTopProposals = await topproposals.find(bySurveySession).toArray();

  const backup = {
    exportedAt: new Date().toISOString(),
    database: dbName,
    surveys: surveyDocs,
    surveyvotes: surveyVoteDocs,
    surveySessions,
    surveyProposals,
    surveyThumbsUps: surveyThumbs,
    surveyComments,
    surveyCommentRatings,
    surveyTopProposals,
  };
  const backupDir = path.join(__dirname, "backups");
  const backupFile = path.join(
    backupDir,
    `survey-backup-${dbName}-${Date.now()}.json`,
  );

  summary.push(
    `Survey backup: ${surveyDocs.length} surveys, ${surveyVoteDocs.length} survey votes, ` +
      `${surveySessions.length} survey sessions (${surveyProposals.length} proposals, ` +
      `${surveyThumbs.length} thumbs, ${surveyComments.length} comments)`,
  );

  if (APPLY) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(backupFile, EJSON.stringify(backup, { relaxed: false }));
    console.log(`💾 Survey data backed up to ${backupFile}`);

    await proposals.deleteMany(bySurveySession);
    await thumbsups.deleteMany(bySurveySession);
    await comments.deleteMany(bySurveySession);
    await commentratings.deleteMany(bySurveySession);
    await topproposals.deleteMany(bySurveySession);
    await sessions.deleteMany({ _id: { $in: surveySessionIds } });
  }

  // ── 2. Voting sessions -> questions ────────────────────────────────────
  const votingSessions = await sessions
    .find({ sessionType: "voting" })
    .toArray();
  let votingVotes = 0;
  let votingComments = 0;
  let skippedVotes = 0;

  for (const s of votingSessions) {
    const question = {
      _id: s._id, // keep _id so image blobs / external links stay valid
      text: s.place,
      status: s.status,
      deadline: s.deadline ?? s.endDate ?? new Date(),
      imageUrl: s.imageUrl ?? null,
      categories: s.categories ?? [],
      createdBy: s.createdBy ?? null,
      meetingId: null,
      closedAt: s.endDate ?? null,
      createdAt: s.startDate ?? s.createdAt ?? new Date(),
      updatedAt: s.updatedAt ?? new Date(),
    };
    if (!s.deadline) {
      warnings.push(
        `Voting session ${s._id} ("${s.place}") had no deadline — used endDate/now`,
      );
    }

    const votes = await quickvotes.find({ sessionId: s._id }).toArray();
    const qVotes = [];
    for (const v of votes) {
      if (!ObjectId.isValid(v.userId)) {
        skippedVotes++;
        warnings.push(
          `QuickVote ${v._id} skipped — userId "${v.userId}" is not a valid ObjectId`,
        );
        continue;
      }
      if (v.choice !== "ja" && v.choice !== "nej") {
        skippedVotes++;
        warnings.push(
          `QuickVote ${v._id} skipped — choice "${v.choice}" is no longer valid (abstar removed)`,
        );
        continue;
      }
      qVotes.push({
        _id: v._id,
        questionId: s._id,
        userId: new ObjectId(v.userId),
        choice: v.choice,
        createdAt: v.createdAt ?? new Date(),
        updatedAt: v.updatedAt ?? v.createdAt ?? new Date(),
      });
    }

    const sessionComments = await comments.find({ sessionId: s._id }).toArray();
    const qComments = sessionComments.map((c) => ({
      _id: c._id, // keep _id so comment ratings keep pointing correctly
      questionId: s._id,
      userId: c.userId,
      text: c.text,
      type: c.type ?? "neutral",
      createdAt: c.createdAt ?? new Date(),
      updatedAt: c.updatedAt ?? c.createdAt ?? new Date(),
    }));
    const ratings = await commentratings
      .find({ commentId: { $in: sessionComments.map((c) => c._id) } })
      .toArray();
    const qRatings = ratings.map((r) => ({
      _id: r._id,
      commentId: r.commentId,
      userId: r.userId,
      rating: r.rating,
      createdAt: r.createdAt ?? new Date(),
      updatedAt: r.updatedAt ?? r.createdAt ?? new Date(),
    }));

    votingVotes += qVotes.length;
    votingComments += qComments.length;

    if (APPLY) {
      await questions.insertOne(question);
      if (qVotes.length) await questionvotes.insertMany(qVotes);
      if (qComments.length) await questioncomments.insertMany(qComments);
      if (qRatings.length) await questioncommentratings.insertMany(qRatings);
      await commentratings.deleteMany({
        commentId: { $in: sessionComments.map((c) => c._id) },
      });
      await comments.deleteMany({ sessionId: s._id });
      await quickvotes.deleteMany({ sessionId: s._id });
      await sessions.deleteOne({ _id: s._id });
    }
  }
  summary.push(
    `Voting sessions -> questions: ${votingSessions.length} questions, ` +
      `${votingVotes} votes, ${votingComments} comments` +
      (skippedVotes ? ` (${skippedVotes} votes skipped, see warnings)` : ""),
  );

  // ── 3. municipalsessions -> municipalmeetings + item sessions -> questions ──
  const collNames = (await db.listCollections().toArray()).map((c) => c.name);
  // Real data lives in "municipalsessions" if that collection still exists —
  // "municipalmeetings" may already exist as an EMPTY collection auto-created
  // by Mongoose the moment any dev server registered the MunicipalMeeting
  // model, so its mere existence must never be used to decide the read source.
  const oldMunicipalExists = collNames.includes("municipalsessions");
  if (oldMunicipalExists) {
    if (APPLY) {
      await dropEmptyTarget(db, "municipalmeetings");
      await db.renameCollection("municipalsessions", "municipalmeetings");
    }
    summary.push("Renamed collection municipalsessions -> municipalmeetings");
  } else if (!collNames.includes("municipalmeetings")) {
    warnings.push("No municipalsessions/municipalmeetings collection found");
  }
  const meetings = db.collection(
    oldMunicipalExists ? "municipalsessions" : "municipalmeetings",
  );

  // Map spawned sessionId -> meeting/item for every activated agenda item
  const meetingDocs = await meetings.find().toArray();
  const itemBySessionId = new Map();
  for (const m of meetingDocs) {
    for (const item of m.items ?? []) {
      if (item.sessionId) {
        itemBySessionId.set(String(item.sessionId), { meeting: m, item });
      }
    }
  }

  const municipalSessions = await sessions
    .find({ sessionType: "municipal" })
    .toArray();
  let municipalVotes = 0;
  let municipalComments = 0;

  for (const s of municipalSessions) {
    const linked = itemBySessionId.get(String(s._id));
    if (!linked) {
      warnings.push(
        `Municipal session ${s._id} ("${s.place}") is not linked from any meeting item — converted without meetingId`,
      );
    }
    const item = linked?.item;

    const question = {
      _id: s._id,
      text: item?.title ?? s.place,
      status: s.status,
      deadline: s.endDate ?? item?.closedAt ?? new Date(),
      imageUrl: item?.imageUrl ?? s.imageUrl ?? null,
      categories: item?.categories ?? s.categories ?? [],
      createdBy: s.createdBy ?? null,
      meetingId: linked?.meeting._id ?? null,
      closedAt: s.endDate ?? item?.closedAt ?? null,
      createdAt: s.startDate ?? s.createdAt ?? new Date(),
      updatedAt: s.updatedAt ?? new Date(),
    };
    if (s.status === "active") {
      // Active municipal sessions have no natural deadline — give them a week
      question.deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      warnings.push(
        `Active municipal session ${s._id} ("${s.place}") given deadline ${question.deadline.toISOString().slice(0, 10)} — adjust in admin if needed`,
      );
    }

    const votes = await finalvotes.find({ sessionId: s._id }).toArray();
    const qVotes = votes.map((v) => ({
      _id: v._id,
      questionId: s._id,
      userId: v.userId,
      choice: v.choice === "yes" ? "ja" : "nej",
      createdAt: v.createdAt ?? new Date(),
      updatedAt: v.updatedAt ?? v.createdAt ?? new Date(),
    }));

    const sessionComments = await comments.find({ sessionId: s._id }).toArray();
    const qComments = sessionComments.map((c) => ({
      _id: c._id,
      questionId: s._id,
      userId: c.userId,
      text: c.text,
      type: c.type ?? "neutral",
      createdAt: c.createdAt ?? new Date(),
      updatedAt: c.updatedAt ?? c.createdAt ?? new Date(),
    }));
    const ratings = await commentratings
      .find({ commentId: { $in: sessionComments.map((c) => c._id) } })
      .toArray();
    const qRatings = ratings.map((r) => ({
      _id: r._id,
      commentId: r.commentId,
      userId: r.userId,
      rating: r.rating,
      createdAt: r.createdAt ?? new Date(),
      updatedAt: r.updatedAt ?? r.createdAt ?? new Date(),
    }));

    municipalVotes += qVotes.length;
    municipalComments += qComments.length;

    if (APPLY) {
      await questions.insertOne(question);
      if (qVotes.length) await questionvotes.insertMany(qVotes);
      if (qComments.length) await questioncomments.insertMany(qComments);
      if (qRatings.length) await questioncommentratings.insertMany(qRatings);

      if (linked) {
        await meetings.updateOne(
          { _id: linked.meeting._id, "items.sessionId": s._id },
          {
            $set: { "items.$.questionId": s._id },
            $unset: { "items.$.sessionId": "", "items.$.proposalId": "" },
          },
        );
      }

      await commentratings.deleteMany({
        commentId: { $in: sessionComments.map((c) => c._id) },
      });
      await comments.deleteMany({ sessionId: s._id });
      await finalvotes.deleteMany({ sessionId: s._id });
      await thumbsups.deleteMany({ sessionId: s._id });
      await topproposals.deleteMany({ sessionId: s._id });
      await proposals.deleteMany({ sessionId: s._id });
      await sessions.deleteOne({ _id: s._id });
    }
  }
  summary.push(
    `Municipal sessions -> questions: ${municipalSessions.length} questions, ` +
      `${municipalVotes} votes (yes/no -> ja/nej), ${municipalComments} comments`,
  );

  // Any never-activated items keep only their embedded fields — nothing to do.

  // ── 4. Field renames ────────────────────────────────────────────────────
  const ratingRename = await (APPLY
    ? municipalitemratings.updateMany(
        { municipalSessionId: { $exists: true } },
        { $rename: { municipalSessionId: "meetingId" } },
      )
    : municipalitemratings.countDocuments({
        municipalSessionId: { $exists: true },
      }));
  summary.push(
    `municipalitemratings.municipalSessionId -> meetingId: ${
      APPLY ? ratingRename.modifiedCount : ratingRename
    } docs`,
  );

  // selectedForMunicipalSession/selectedAt/submittedAsMotionAt/motionNumber
  // are unused (2026-07 audit) — dropped outright rather than renamed.
  const cpUnusedFields = {
    selectedForMunicipalSession: "",
    selectedAt: "",
    submittedAsMotionAt: "",
    motionNumber: "",
  };
  const cpTouched = await citizenproposals.countDocuments({
    $or: Object.keys(cpUnusedFields).map((f) => ({ [f]: { $exists: true } })),
  });
  if (APPLY) {
    await citizenproposals.updateMany({}, { $unset: cpUnusedFields });
  }
  summary.push(
    `citizenproposals stripped of selectedForMunicipalSession/selectedAt/submittedAsMotionAt/motionNumber: ${cpTouched} docs`,
  );

  // ── 5. Field cleaning (2026-07 audit) ───────────────────────────────────
  const users = db.collection("users");
  const settingsColl = db.collection("settings");
  const dropIndexSafe = async (coll, name) => {
    try {
      await coll.dropIndex(name);
    } catch {
      /* index may not exist */
    }
  };

  // 5a. Unused User fields
  const userUnset = {
    isMember: "",
    userType: "",
    bankIdVerified: "",
    bankIdPersonalNumber: "",
    lastCitizenVoteDate: "",
    votesUsedInCurrentYear: "",
    canCloseQuestions: "",
  };
  const usersTouched = await users.countDocuments({
    $or: Object.keys(userUnset).map((f) => ({ [f]: { $exists: true } })),
  });
  if (APPLY) {
    await users.updateMany({}, { $unset: userUnset });
  }
  summary.push(`Users stripped of unused fields: ${usersTouched} docs`);

  // 5b. Settings.sessionLimitHours -> per-session deadline
  const settingsDoc = await settingsColl.findOne({});
  const limitHours = settingsDoc?.sessionLimitHours ?? 24;
  const activeStandard = await sessions.countDocuments({
    status: "active",
    sessionType: { $in: [null, "standard"] },
  });
  if (APPLY) {
    const activeDocs = await sessions
      .find({ status: "active", sessionType: { $in: [null, "standard"] } })
      .toArray();
    for (const s of activeDocs) {
      const start = s.startDate ?? s.createdAt ?? new Date();
      await sessions.updateOne(
        { _id: s._id },
        {
          $set: {
            deadline: new Date(start.getTime() + limitHours * 60 * 60 * 1000),
          },
        },
      );
    }
    await settingsColl.updateMany({}, { $unset: { sessionLimitHours: "" } });
  }
  summary.push(
    `Active standard sessions given deadline (start + ${limitHours}h): ${activeStandard} docs; Settings.sessionLimitHours removed`,
  );

  // 5c. Proposals: drop denormalized fields, rename top3 -> finalist
  const top3Count = await proposals.countDocuments({ status: "top3" });
  const propTouched = await proposals.countDocuments({
    $or: [
      { authorName: { $exists: true } },
      { thumbsUpCount: { $exists: true } },
      { averageRating: { $exists: true } },
    ],
  });
  if (APPLY) {
    await proposals.updateMany(
      { status: "top3" },
      { $set: { status: "finalist" } },
    );
    await proposals.updateMany(
      {},
      { $unset: { authorName: "", thumbsUpCount: "", averageRating: "" } },
    );
  }
  summary.push(
    `Proposals: ${top3Count} "top3" -> "finalist", ${propTouched} stripped of authorName/thumbsUpCount/averageRating`,
  );

  // topproposals -> winningproposals: stays a denormalized snapshot by
  // design, but drops authorName
  const topAuthorNames = await topproposals.countDocuments({
    authorName: { $exists: true },
  });
  if (APPLY) {
    await topproposals.updateMany({}, { $unset: { authorName: "" } });
    if (collNames.includes("topproposals")) {
      await dropEmptyTarget(db, "winningproposals");
      await db.renameCollection("topproposals", "winningproposals");
    }
  }
  summary.push(
    `topproposals -> winningproposals: renamed, ${topAuthorNames} docs stripped of authorName`,
  );

  // 5d. thumbsups -> proposalratings (drop redundant sessionId)
  const thumbsCount = await thumbsups.countDocuments();
  if (APPLY) {
    await thumbsups.updateMany({}, { $unset: { sessionId: "" } });
    await dropIndexSafe(thumbsups, "sessionId_1");
    if (collNames.includes("thumbsups")) {
      await dropEmptyTarget(db, "proposalratings");
      await db.renameCollection("thumbsups", "proposalratings");
    }
  }
  summary.push(`thumbsups -> proposalratings: ${thumbsCount} docs`);

  // 5e. Comments + comment ratings: drop authorName/sessionId/averageRating
  const commentsTouched = await comments.countDocuments();
  if (APPLY) {
    await comments.updateMany(
      {},
      { $unset: { authorName: "", sessionId: "", averageRating: "" } },
    );
    await dropIndexSafe(comments, "sessionId_1");
    await dropIndexSafe(comments, "averageRating_-1_createdAt_-1");
    await comments.createIndex({ proposalId: 1 });
    await commentratings.updateMany({}, { $unset: { sessionId: "" } });
    await dropIndexSafe(commentratings, "sessionId_1");
  }
  summary.push(
    `Comments cleaned (authorName/sessionId/averageRating removed): ${commentsTouched} docs`,
  );

  // 5f. CitizenProposal: drop authorName + denormalized rating aggregates
  const cpAggTouched = await citizenproposals.countDocuments({
    $or: [
      { authorName: { $exists: true } },
      { totalStars: { $exists: true } },
      { ratingCount: { $exists: true } },
      { averageRating: { $exists: true } },
    ],
  });
  if (APPLY) {
    await citizenproposals.updateMany(
      {},
      {
        $unset: {
          authorName: "",
          totalStars: "",
          ratingCount: "",
          averageRating: "",
        },
      },
    );
    await dropIndexSafe(citizenproposals, "totalStars_1");
  }
  summary.push(
    `CitizenProposals stripped of authorName/totalStars/ratingCount/averageRating: ${cpAggTouched} docs`,
  );

  // 5g. MunicipalMeeting items[]: drop denormalized rating aggregates
  const meetingsWithAgg = await meetings.countDocuments({
    $or: [
      { "items.totalStars": { $exists: true } },
      { "items.ratingCount": { $exists: true } },
      { "items.averageRating": { $exists: true } },
    ],
  });
  if (APPLY) {
    await meetings.updateMany(
      {},
      {
        $unset: {
          "items.$[].totalStars": "",
          "items.$[].ratingCount": "",
          "items.$[].averageRating": "",
        },
      },
    );
  }
  summary.push(
    `MunicipalMeeting items stripped of totalStars/ratingCount/averageRating: ${meetingsWithAgg} meetings`,
  );

  // ── 6. Cleanup: remaining sessions are all standard now ─────────────────
  const remaining = await sessions.countDocuments({
    $or: [
      { sessionType: { $exists: true } },
      { surveyDurationDays: { $exists: true } },
      { archiveDate: { $exists: true } },
    ],
  });
  if (APPLY) {
    await sessions.updateMany(
      {},
      {
        $unset: {
          sessionType: "",
          surveyDurationDays: "",
          archiveDate: "",
        },
      },
    );
    for (const name of ["quickvotes", "surveys", "surveyvotes"]) {
      if (collNames.includes(name)) await db.collection(name).drop();
    }
    // Unique indexes the new models rely on (raw inserts don't create them)
    await questionvotes.createIndex(
      { questionId: 1, userId: 1 },
      { unique: true },
    );
    await questioncommentratings.createIndex(
      { commentId: 1, userId: 1 },
      { unique: true },
    );
  }
  summary.push(
    `Sessions stripped of type fields: ${remaining} docs; dropped quickvotes/surveys/surveyvotes`,
  );

  // ── 7. Drop any collection no longer backed by a model in lib/models.ts ──
  // Whitelist is the complete, manually-verified set of collection names
  // Mongoose's default pluralization produces for every model currently
  // exported from lib/models.ts (cross-checked against the file directly,
  // not derived at runtime, since this plain-JS script can't import the
  // TypeScript models module without a build step). Update this list
  // whenever a model is added, renamed, or removed.
  const KNOWN_COLLECTIONS = new Set([
    "users",
    "logincodes",
    "proposals",
    "proposalratings",
    "comments",
    "commentratings",
    "finalvotes",
    "sessions",
    "winningproposals",
    "sessionrequests",
    "budgetsessions",
    "budgetvotes",
    "budgetresults",
    "budgetarguments",
    "budgetcategoryratings",
    "citizenproposals",
    "citizenproposalratings",
    "municipalmeetings",
    "municipalitemratings",
    "settings",
    "questions",
    "questionvotes",
    "questioncomments",
    "questioncommentratings",
  ]);
  const finalCollNames = (await db.listCollections().toArray()).map(
    (c) => c.name,
  );
  const orphanNames = finalCollNames.filter(
    (n) => !n.startsWith("system.") && !KNOWN_COLLECTIONS.has(n),
  );
  const orphans = [];
  for (const name of orphanNames) {
    orphans.push({ name, count: await db.collection(name).countDocuments() });
  }
  if (APPLY) {
    for (const { name } of orphans) {
      await db.collection(name).drop();
    }
  }
  if (orphans.length > 0) {
    summary.push(
      `Dropped ${orphans.length} orphaned collection(s) not backed by any model: ` +
        orphans.map((o) => `${o.name} (${o.count} docs)`).join(", "),
    );
  } else {
    summary.push(
      "No orphaned collections found — every collection maps to a current model",
    );
  }

  // ── Report ──────────────────────────────────────────────────────────────
  console.log(`\n📋 Summary (${MODE}):`);
  for (const line of summary) console.log(`   • ${line}`);
  if (warnings.length) {
    console.log(`\n⚠️  Warnings:`);
    for (const w of warnings) console.log(`   • ${w}`);
  }
  if (!APPLY) {
    console.log(`\nDry run only — re-run with --apply to execute.\n`);
  } else {
    console.log(`\n✅ Restructure applied to "${dbName}".\n`);
  }

  await client.close();
}

main().catch((err) => {
  console.error("\n❌ Restructure failed:", err);
  process.exit(1);
});
