import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { Question, QuestionVote } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
import { createLogger } from "../../../../lib/logger";
import { PRE_ELECTION_LIMIT, QUOTA_MESSAGE } from "../../../../lib/vote-quota";

const log = createLogger("MobileQuestionVote");

/**
 * POST /api/mobile/questions/vote
 *
 * ⚠️ **The unverified path, kept alive only for app builds already on phones.**
 * Current builds vote through `/api/mobile/vote-verification`, which requires a
 * BankID signature and a SPAR residency check; votes written here carry no
 * `verifiedAt` and no `pnrHash`, so they are neither attributable to a real
 * person nor deduplicated across accounts.
 *
 * It cannot simply be deleted: installed builds call it, and a 404 would leave
 * them unable to vote with no explanation. Retire it in the same change that
 * raises `MIN_SUPPORTED_MOBILE_VERSION` — see docs/bankid-go-live-checklist.md.
 * The web equivalent had no such constraint and is already gone.
 *
 * A brand-new vote is gated by the question being active and the pre-election
 * quota; changing an existing vote is always free.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { questionId, choice } = req.body;
  if (!questionId) return res.status(400).json({ message: "questionId krävs" });
  if (!["ja", "nej"].includes(choice))
    return res.status(400).json({ message: "Ogiltigt val" });

  try {
    await connectDB();

    const existingVote = await QuestionVote.findOne({
      questionId,
      userId: user.id,
    }).lean();

    if (!existingVote) {
      const question: any = await Question.findById(questionId)
        .select("status")
        .lean();
      if (!question || question.status !== "active") {
        return res
          .status(403)
          .json({ message: "Den här frågan är stängd för röstning." });
      }

      const used = await QuestionVote.countDocuments({ userId: user.id });
      if (used >= PRE_ELECTION_LIMIT) {
        return res.status(403).json({ message: QUOTA_MESSAGE });
      }
    }

    await QuestionVote.findOneAndUpdate(
      { questionId, userId: user.id },
      { choice },
      { upsert: true, new: true },
    );

    const allVotes = await QuestionVote.find({ questionId }).lean();
    return res.status(200).json({
      voteCounts: {
        ja: allVotes.filter((v) => v.choice === "ja").length,
        nej: allVotes.filter((v) => v.choice === "nej").length,
      },
      userVote: choice,
    });
  } catch (error) {
    log.error("Failed to save question vote", { error: error.message });
    return res.status(500).json({ message: "Röstning misslyckades" });
  }
}
