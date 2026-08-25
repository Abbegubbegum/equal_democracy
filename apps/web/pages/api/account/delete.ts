import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import {
  User,
  Proposal,
  ProposalRating,
  Comment,
  CommentRating,
  FinalVote,
  QuestionVote,
  VoteVerification,
  QuestionComment,
  QuestionCommentRating,
  CitizenProposal,
  CitizenProposalRating,
  BudgetVote,
  BudgetArgument,
  BudgetCategoryRating,
  MunicipalItemRating,
  SessionRequest,
  Session,
  MunicipalMeeting,
  BudgetSession,
  Question,
  Payment,
  LoginCode,
} from "../../../lib/models";
import { del } from "@vercel/blob";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await connectDB();

  const user = await User.findOne({ email: session.user.email });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const userId = user._id;

  // Delete blob images from citizen proposals authored by this user
  const ownProposals = await CitizenProposal.find({ authorId: userId }).select(
    "imageUrl",
  );
  for (const p of ownProposals) {
    if (p.imageUrl) {
      try {
        await del(p.imageUrl);
      } catch {
        // Non-fatal — blob may already be gone
      }
    }
  }

  // Delete all user-linked data in parallel
  await Promise.all([
    Proposal.deleteMany({ authorId: userId }),
    ProposalRating.deleteMany({ userId }),
    Comment.deleteMany({ userId }),
    CommentRating.deleteMany({ userId }),
    FinalVote.deleteMany({ userId }),
    // Votes on questions that are still open are deleted outright, pnrHash and
    // all. Anonymising them instead would be worse: keeping the pseudonym means
    // refusing an erasure request, and dropping it while keeping the ballot
    // would let the same person register again and cast a second one. Deleting
    // the whole row means a delete-then-revote yields exactly one vote.
    //
    // Votes on *closed* questions are already anonymous — anonymiseQuestionVotes
    // unset their userId — so this query cannot see them, which is what keeps a
    // published tally from shifting after the fact.
    QuestionVote.deleteMany({ userId }),
    VoteVerification.deleteMany({ userId }),
    QuestionComment.deleteMany({ userId }),
    QuestionCommentRating.deleteMany({ userId }),
    CitizenProposal.deleteMany({ authorId: userId }),
    CitizenProposalRating.deleteMany({ userId }),
    BudgetVote.deleteMany({ userId }),
    BudgetArgument.deleteMany({ userId }),
    BudgetCategoryRating.deleteMany({ userId }),
    MunicipalItemRating.deleteMany({ userId }),
    SessionRequest.deleteMany({ userId }),
    LoginCode.deleteMany({ email: session.user.email }),
  ]);

  // Presence lists are a direct personal reference and are stale the moment the
  // account is gone.
  await Session.updateMany(
    { activeUsers: userId },
    { $pull: { activeUsers: userId } },
  );

  // Content this user created as an admin — sessions, meetings, budgets,
  // questions — is deliberately NOT deleted: other people have voted and
  // commented on it, and removing it would destroy their contributions too.
  // The personal link is severed instead, so no collection still points at the
  // deleted user.
  await Promise.all([
    Session.updateMany({ createdBy: userId }, { $set: { createdBy: null } }),
    Question.updateMany({ createdBy: userId }, { $set: { createdBy: null } }),
    BudgetSession.updateMany(
      { createdBy: userId },
      { $set: { createdBy: null } },
    ),
    MunicipalMeeting.updateMany(
      { createdBy: userId },
      { $set: { createdBy: null } },
    ),
    MunicipalMeeting.updateMany(
      { closedBy: userId },
      { $set: { closedBy: null } },
    ),
    SessionRequest.updateMany(
      { processedBy: userId },
      { $set: { processedBy: null } },
    ),
  ]);

  // Payments are NOT deleted. A membership fee is räkenskapsinformation under
  // bokföringslagen (7 kap. 2 §), which requires it to be kept for seven years —
  // and GDPR art. 17.3 b exempts erasure where retention is a legal obligation.
  //
  // What we can drop is the personal data the accounts do not need: the payer's
  // phone number and the verbatim Swish callback that also contains it. The
  // amount, dates, status and payment reference stay, and the userId is left
  // pointing at a User that no longer exists, so the row is pseudonymised
  // rather than identifying.
  await Payment.updateMany(
    { userId },
    {
      $set: {
        payerAlias: null,
        rawCallback: null,
        userDeletedAt: new Date(),
      },
    },
  );

  // Delete the user record last
  await User.deleteOne({ _id: userId });

  return res.status(200).json({ ok: true });
}
