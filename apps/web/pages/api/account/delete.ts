import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import {
  User,
  Proposal,
  ThumbsUp,
  Comment,
  CommentRating,
  FinalVote,
  QuickVote,
  CitizenProposal,
  CitizenProposalRating,
  BudgetVote,
  BudgetArgument,
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
  const userIdStr = userId.toString();

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
    ThumbsUp.deleteMany({ userId }),
    Comment.deleteMany({ userId }),
    CommentRating.deleteMany({ userId }),
    FinalVote.deleteMany({ userId }),
    QuickVote.deleteMany({ userId: userIdStr }),
    CitizenProposal.deleteMany({ authorId: userId }),
    CitizenProposalRating.deleteMany({ userId }),
    BudgetVote.deleteMany({ userId }),
    BudgetArgument.deleteMany({ userId }),
    LoginCode.deleteMany({ email: session.user.email }),
  ]);

  // Delete the user record last
  await User.deleteOne({ _id: userId });

  return res.status(200).json({ ok: true });
}
