import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { User, MunicipalMeeting, Question } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { createLogger } from "../../../lib/logger";
import { anonymiseQuestionVotes } from "../../../lib/vote-anonymisation";
import { notifyQuestionResult } from "../../../lib/question-result-notify";

const log = createLogger("CloseItem");

/**
 * POST /api/municipal/close-item
 * Close a specific item in a municipal meeting
 * Super admins only
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await connectDB();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: "You must be logged in" });
  }

  const user = await User.findById(session.user.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Only super admins may close items
  if (!user.isSuperAdmin) {
    return res.status(403).json({
      message: "You do not have permission to close questions.",
    });
  }

  if (!csrfProtection(req, res)) {
    return;
  }

  try {
    const { meetingId, itemId } = req.body;

    if (!meetingId || !itemId) {
      return res
        .status(400)
        .json({ message: "Meeting ID and item ID required" });
    }

    const meeting = await MunicipalMeeting.findById(meetingId);

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Find the item
    const item = meeting.items.id(itemId);

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (item.status === "closed") {
      return res.status(400).json({ message: "Item is already closed" });
    }

    // Close the item
    item.status = "closed";
    item.closedAt = new Date();
    item.closedBy = user._id;

    // Also close the corresponding Question. Fetched (not
    // findByIdAndUpdate) because notifying and anonymising both need the
    // document, and because a question can outlive the item that spawned it
    // being re-closed (defensive against a double-close of the same item).
    if (item.questionId) {
      const question = await Question.findById(item.questionId);
      if (question && question.status !== "closed") {
        question.status = "closed";
        question.closedAt = new Date();
        await question.save();

        // Must run before anonymisation below strips the userId that ties a
        // vote back to a person. A notification failure must not block the
        // close itself.
        try {
          await notifyQuestionResult(question);
        } catch (error) {
          log.error("Failed to send question-result notifications", {
            questionId: question._id.toString(),
            error: error.message,
          });
        }

        // This step was missing entirely before — every other question-close
        // path anonymises (see lib/vote-anonymisation.ts), and a
        // municipal-item close is a question close like any other.
        try {
          await anonymiseQuestionVotes(question._id.toString());
        } catch (error) {
          log.error("Failed to anonymise votes for a closed question", {
            questionId: question._id.toString(),
            error: error.message,
          });
        }
      }
    }

    await meeting.save();

    log.info("Item closed", { itemId, title: item.title, closedBy: user.name });

    return res.status(200).json({
      message: "Item closed successfully",
      item: {
        _id: item._id,
        title: item.title,
        status: item.status,
        closedAt: item.closedAt,
      },
    });
  } catch (error) {
    log.error("Failed to close item", {
      itemId: req.body?.itemId,
      error: error.message,
    });
    return res.status(500).json({
      message: "Failed to close item",
      error: error.message,
    });
  }
}
