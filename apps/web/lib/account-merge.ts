/**
 * Folding one account's history into another.
 *
 * Needed because a person can arrive holding two accounts: a legacy email one
 * created before BankID login, and a BankID one created after. Both are really
 * them, and `User.bankidSubject` is unique, so the two have to become one before
 * either can carry the BankID identity.
 *
 * **Direction is always "into the account holding the session."** Both merge
 * paths in docs/bankid-login-plan.md converge on that rule:
 *
 *   §7.4  signed in on the legacy email account, links BankID → the BankID
 *         account that already existed is folded into the one they are using
 *   §7.5  signed in on the new BankID account, claims their old email → the
 *         legacy account is folded into the one they are using
 *
 * The alternative — picking a "better" survivor by age or richness — would mean
 * handing the browser a session for an account it did not authenticate as, on
 * both surfaces, for no gain.
 *
 * Everything runs in a transaction. A half-merged pair is worse than a failed
 * merge: the loser's rows would point at a user that no longer exists, and the
 * account-deletion invariant ("no collection still contains that user's id")
 * would already be broken before anyone noticed.
 */

import mongoose from "mongoose";
import {
  BudgetArgument,
  BudgetCategoryRating,
  BudgetVote,
  CitizenProposal,
  CitizenProposalRating,
  Comment,
  CommentRating,
  FinalVote,
  MunicipalItemRating,
  Payment,
  Proposal,
  ProposalRating,
  QuestionComment,
  QuestionCommentRating,
  QuestionVote,
  Session,
  SessionRequest,
  User,
} from "./models";
import { createLogger } from "./logger";

const log = createLogger("AccountMerge");

/**
 * Collections that simply change owner, with no chance of collision.
 *
 * Authored content: two proposals by the same person are two proposals, and
 * both should survive the merge.
 */
const REASSIGN: Array<[any, string]> = [
  [Proposal, "authorId"],
  [Comment, "userId"],
  [CitizenProposal, "authorId"],
  [QuestionComment, "userId"],
  [BudgetArgument, "userId"],
  [SessionRequest, "userId"],
  [Payment, "userId"],
];

/**
 * Collections with a unique index on (target, user) — one row per person per
 * thing. A straight `updateMany` here would throw a duplicate-key error the
 * moment the person had touched the same proposal from both accounts, which is
 * exactly what someone with two accounts is likely to have done.
 *
 * Each entry names the field identifying *what* was rated or voted on, so the
 * loser's rows can be checked against the winner's before being moved.
 */
const DEDUPED: Array<{ model: any; target: string | string[]; label: string }> =
  [
    { model: ProposalRating, target: "proposalId", label: "ProposalRating" },
    { model: CommentRating, target: "commentId", label: "CommentRating" },
    {
      model: CitizenProposalRating,
      target: "proposalId",
      label: "CitizenProposalRating",
    },
    {
      model: QuestionCommentRating,
      target: "commentId",
      label: "QuestionCommentRating",
    },
    {
      model: MunicipalItemRating,
      target: "itemId",
      label: "MunicipalItemRating",
    },
    {
      model: BudgetCategoryRating,
      target: ["sessionId", "categoryId"],
      label: "BudgetCategoryRating",
    },
    { model: BudgetVote, target: "sessionId", label: "BudgetVote" },
    { model: FinalVote, target: "proposalId", label: "FinalVote" },
  ];

export interface MergeResult {
  movedByCollection: Record<string, number>;
  droppedByCollection: Record<string, number>;
}

function keyOf(doc: any, target: string | string[]): string {
  const fields = Array.isArray(target) ? target : [target];
  return fields.map((f) => String(doc[f])).join("|");
}

/**
 * Moves everything belonging to `fromId` onto `intoId`, then deletes `fromId`.
 *
 * Both ids must exist and be different. Returns what moved, for the log — a
 * merge is irreversible, so it needs to leave a record of what it did.
 */
export async function mergeAccounts(
  fromId: string,
  intoId: string,
): Promise<MergeResult> {
  if (String(fromId) === String(intoId)) {
    throw new Error("mergeAccounts: refusing to merge an account into itself");
  }

  const from: any = await User.findById(fromId);
  const into: any = await User.findById(intoId);
  if (!from) throw new Error(`mergeAccounts: source ${fromId} does not exist`);
  if (!into) throw new Error(`mergeAccounts: target ${intoId} does not exist`);

  const movedByCollection: Record<string, number> = {};
  const droppedByCollection: Record<string, number> = {};

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const [model, field] of REASSIGN) {
        const result = await model.updateMany(
          { [field]: from._id },
          { $set: { [field]: into._id } },
          { session },
        );
        if (result.modifiedCount) {
          movedByCollection[model.modelName] = result.modifiedCount;
        }
      }

      for (const { model, target, label } of DEDUPED) {
        const mine: any[] = await model
          .find({ userId: from._id })
          .session(session)
          .lean();
        if (!mine.length) continue;

        const theirs: any[] = await model
          .find({ userId: into._id })
          .session(session)
          .lean();
        const taken = new Set(theirs.map((doc) => keyOf(doc, target)));

        const movable = mine.filter((doc) => !taken.has(keyOf(doc, target)));
        const colliding = mine.filter((doc) => taken.has(keyOf(doc, target)));

        if (movable.length) {
          await model.updateMany(
            { _id: { $in: movable.map((d) => d._id) } },
            { $set: { userId: into._id } },
            { session },
          );
          movedByCollection[label] = movable.length;
        }

        // The surviving account's own row wins. Not a coin toss: it is the
        // account this person is signed in as, so it is the opinion they most
        // recently expressed as themselves. Verified votes cannot collide here
        // anyway — the unique {questionId, pnrHash} index already made a second
        // verified vote on one question impossible, so anything that does
        // collide is a legacy unverified row, which should lose.
        if (colliding.length) {
          await model.deleteMany(
            { _id: { $in: colliding.map((d) => d._id) } },
            { session },
          );
          droppedByCollection[label] = colliding.length;
        }
      }

      // QuestionVote is deduped like the rest but keyed on questionId, and is
      // listed separately because of that pnrHash subtlety worth stating once.
      const myVotes: any[] = await QuestionVote.find({ userId: from._id })
        .session(session)
        .lean();
      if (myVotes.length) {
        const theirVotes: any[] = await QuestionVote.find({ userId: into._id })
          .session(session)
          .lean();
        const voted = new Set(theirVotes.map((v) => String(v.questionId)));
        const movable = myVotes.filter((v) => !voted.has(String(v.questionId)));
        const colliding = myVotes.filter((v) =>
          voted.has(String(v.questionId)),
        );
        if (movable.length) {
          await QuestionVote.updateMany(
            { _id: { $in: movable.map((v) => v._id) } },
            { $set: { userId: into._id } },
            { session },
          );
          movedByCollection.QuestionVote = movable.length;
        }
        if (colliding.length) {
          await QuestionVote.deleteMany(
            { _id: { $in: colliding.map((v) => v._id) } },
            { session },
          );
          droppedByCollection.QuestionVote = colliding.length;
        }
      }

      // Creator references on shared content are pointers, not ownership, and
      // there is nothing to deduplicate.
      for (const [model, field] of [
        [Session, "createdBy"],
        [Session, "closedBy"],
        [SessionRequest, "processedBy"],
      ] as Array<[any, string]>) {
        await model.updateMany(
          { [field]: from._id },
          { $set: { [field]: into._id } },
          { session },
        );
      }
      await Session.updateMany(
        { activeUsers: from._id },
        { $pull: { activeUsers: from._id } },
        { session },
      );

      // Account-level fields the survivor should inherit rather than lose.
      const updates: Record<string, unknown> = {};
      if (from.isAdmin && !into.isAdmin) updates.isAdmin = true;
      if (from.isSuperAdmin && !into.isSuperAdmin) updates.isSuperAdmin = true;
      // Membership: whichever runs longer. Losing paid-for months to a merge is
      // the failure this whole flow exists to prevent.
      const fromUntil = from.membershipPaidUntil
        ? new Date(from.membershipPaidUntil).getTime()
        : 0;
      const intoUntil = into.membershipPaidUntil
        ? new Date(into.membershipPaidUntil).getTime()
        : 0;
      if (fromUntil > intoUntil) {
        updates.membershipPaidUntil = from.membershipPaidUntil;
        updates.membershipStatus = from.membershipStatus;
      }
      // …and the earlier of the two first-payment dates, since that is what
      // founding-member status is read from.
      const fromFirst = from.membershipFirstPaidAt
        ? new Date(from.membershipFirstPaidAt).getTime()
        : Infinity;
      const intoFirst = into.membershipFirstPaidAt
        ? new Date(into.membershipFirstPaidAt).getTime()
        : Infinity;
      if (fromFirst < intoFirst) {
        updates.membershipFirstPaidAt = from.membershipFirstPaidAt;
      }
      // Contact details only fill gaps — never overwrite what the surviving
      // account already has, since that is the more recent statement of intent.
      if (from.phoneNumber && !into.phoneNumber) {
        updates.phoneNumber = from.phoneNumber;
      }
      if (from.email && !into.email) updates.email = from.email;
      if (from.interests?.length && !into.interests?.length) {
        updates.interests = from.interests;
      }

      // The loser's email has to go before the winner can take it, or the
      // partial unique index rejects the update.
      await User.updateOne(
        { _id: from._id },
        { $set: { email: null, bankidSubject: null } },
        { session },
      );
      if (Object.keys(updates).length) {
        await User.updateOne({ _id: into._id }, { $set: updates }, { session });
      }
      await User.deleteOne({ _id: from._id }, { session });
    });
  } finally {
    await session.endSession();
  }

  log.info("Accounts merged", {
    fromId: String(fromId),
    intoId: String(intoId),
    moved: movedByCollection,
    dropped: droppedByCollection,
  });

  return { movedByCollection, droppedByCollection };
}
