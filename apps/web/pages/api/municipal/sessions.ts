import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import {
  User,
  MunicipalMeeting,
  Question,
  QuestionComment,
} from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { sendMunicipalMeetingNotifications } from "../../../lib/municipal/notifications";
import { createLogger } from "../../../lib/logger";

const log = createLogger("MunicipalSessions");

/**
 * GET/PATCH/DELETE /api/municipal/sessions
 * Manage municipal meetings
 * GET: Requires login
 * PATCH/DELETE: Superadmin only
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await connectDB();

  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: "You must be logged in" });
  }

  const user = await User.findById(session.user.id);

  // GET - List all municipal meetings (any logged-in user)
  if (req.method === "GET") {
    try {
      const { status, limit, municipality } = req.query;

      const query: Record<string, unknown> = {};
      if (status) {
        query.status = String(status);
      }
      if (municipality) {
        const m = String(municipality);
        query.municipality = m.charAt(0).toUpperCase() + m.slice(1);
      }

      const meetings = await MunicipalMeeting.find(query)
        .populate("createdBy", "name email")
        .sort({ meetingDate: -1 })
        .limit(limit ? parseInt(String(limit)) : 50);

      return res.status(200).json({ sessions: meetings });
    } catch (error) {
      log.error("Failed to fetch meetings", { error: error.message });
      return res.status(500).json({ message: "Failed to fetch meetings" });
    }
  }

  // PATCH - Update meeting (or publish it) - Superadmin only
  if (req.method === "PATCH") {
    if (!user || !user.isSuperAdmin) {
      return res.status(403).json({ message: "Superadmin access required" });
    }

    if (!csrfProtection(req, res)) {
      return;
    }

    try {
      const { sessionId, action, updates } = req.body;

      if (!sessionId) {
        return res.status(400).json({ message: "Meeting ID required" });
      }

      const meeting = await MunicipalMeeting.findById(sessionId);

      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      // Action: Publish (spawn a Question for each item)
      if (action === "publish") {
        if (meeting.status !== "draft") {
          return res
            .status(400)
            .json({ message: "Only draft meetings can be published" });
        }

        // Questions close when the council meets, unless that date has
        // already passed (shouldn't normally happen for a fresh publish).
        const meetingDate = new Date(meeting.meetingDate);
        meetingDate.setHours(23, 59, 59, 999);
        const now = new Date();
        const deadline =
          meetingDate.getTime() > now.getTime()
            ? meetingDate
            : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        for (let i = 0; i < meeting.items.length; i++) {
          const item = meeting.items[i];

          const question = new Question({
            text: item.title,
            status: "active",
            deadline,
            imageUrl: item.imageUrl || null,
            categories: item.categories || [],
            createdBy: user._id,
            meetingId: meeting._id,
          });

          await question.save();

          // Create initial arguments as QuestionComments
          for (const arg of item.initialArguments || []) {
            const comment = new QuestionComment({
              questionId: question._id,
              userId: user._id,
              text: arg.text,
              type: arg.type,
            });

            await comment.save();
          }

          // Update the item with a reference to the spawned Question
          item.questionId = question._id;
          item.status = "active";
        }

        meeting.status = "active";
        await meeting.save();

        log.info("Meeting published", {
          sessionId,
          itemCount: meeting.items.length,
        });

        // Send notifications to users based on categories
        try {
          const notificationResults =
            await sendMunicipalMeetingNotifications(meeting);
          log.info("Notifications sent", {
            sessionId,
            emails: notificationResults.emailsSent,
            sms: notificationResults.smsSent,
          });
          meeting.notificationsSent = true;
          await meeting.save();
        } catch (error) {
          log.error("Failed to send notifications", {
            sessionId,
            error: error.message,
          });
          // Don't fail the entire publish if notifications fail
        }

        return res.status(200).json({
          message: "Meeting published successfully",
          session: meeting,
        });
      }

      // Action: Update items or meeting details
      if (action === "update") {
        if (updates.name) meeting.name = updates.name;
        if (updates.meetingDate)
          meeting.meetingDate = new Date(updates.meetingDate);
        if (updates.meetingType) meeting.meetingType = updates.meetingType;
        if (updates.items) {
          // Merge by _id instead of replacing wholesale — preserves
          // imageUrl (set via the dedicated image-upload endpoint) and
          // questionId when an admin only edits an item's text or
          // categories here.
          const existingById = new Map<string, any>(
            meeting.items.map((it) => [String(it._id), it]),
          );
          meeting.items = updates.items.map(
            (incoming: Record<string, unknown>) => {
              const existing =
                incoming._id && existingById.get(String(incoming._id));
              if (existing) {
                return {
                  ...existing.toObject(),
                  title: incoming.title,
                  description: incoming.description,
                  categories: incoming.categories,
                  initialArguments: incoming.initialArguments,
                };
              }
              return {
                originalNumber: incoming.originalNumber,
                title: incoming.title,
                description: incoming.description,
                categories: incoming.categories,
                initialArguments: incoming.initialArguments,
                status: incoming.status || "draft",
              };
            },
          );
        }

        await meeting.save();

        return res.status(200).json({
          message: "Meeting updated successfully",
          session: meeting,
        });
      }

      return res.status(400).json({ message: "Invalid action" });
    } catch (error) {
      log.error("Failed to update meeting", { error: error.message });
      return res.status(500).json({
        message: "Failed to update meeting",
        error: error.message,
      });
    }
  }

  // DELETE - Delete meeting - Superadmin only
  if (req.method === "DELETE") {
    if (!user || !user.isSuperAdmin) {
      return res.status(403).json({ message: "Superadmin access required" });
    }

    if (!csrfProtection(req, res)) {
      return;
    }

    try {
      const { sessionId } = req.query;

      if (!sessionId) {
        return res.status(400).json({ message: "Meeting ID required" });
      }

      const meeting = await MunicipalMeeting.findById(sessionId);

      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      // Only allow deletion of draft meetings
      if (meeting.status !== "draft") {
        return res
          .status(400)
          .json({ message: "Only draft meetings can be deleted" });
      }

      await MunicipalMeeting.findByIdAndDelete(sessionId);

      return res.status(200).json({ message: "Meeting deleted successfully" });
    } catch (error) {
      log.error("Failed to delete meeting", { error: error.message });
      return res.status(500).json({ message: "Failed to delete meeting" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
