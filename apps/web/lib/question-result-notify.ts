/**
 * The automated "omröstningen är avslutad" SMS/email, sent to everyone who
 * voted on a Question the moment it closes.
 *
 * Must run BEFORE anonymiseQuestionVotes() (lib/vote-anonymisation.ts) — that
 * is what strips the userId that ties a QuestionVote back to a person, and
 * once it has run there is no way to find these recipients again. All three
 * places that close a question (pages/api/admin/close-question.ts,
 * pages/api/check-session-timeout.ts, pages/api/municipal/close-item.ts) call
 * this first, then anonymise.
 *
 * Channel selection deliberately mirrors sendMunicipalMeetingNotifications
 * (lib/municipal/notifications.ts): email in "email"/"both" and not
 * emailOptOut, sms in "sms"/"both" with a usable phoneNumber. Fails open per
 * recipient — one bad phone number or a Resend/Twilio error must not stop the
 * rest of the voters from being notified, and must never block the close
 * itself.
 */

import { QuestionVote, User } from "./models";
import { sendEmail } from "./email";
import { sendSMS, formatPhoneNumber } from "./sms";
import { createLogger } from "./logger";

const log = createLogger("QuestionResultNotify");

export interface QuestionResultNotifyResult {
  totalVoters: number;
  emailsSent: number;
  smsSent: number;
  errors: number;
}

interface ClosedQuestionLike {
  _id: unknown;
  text: string;
}

/**
 * Reads the still-identified votes on a just-closed question, works out the
 * majority result, and notifies every voter who left a phone number or email.
 */
export async function notifyQuestionResult(
  question: ClosedQuestionLike,
): Promise<QuestionResultNotifyResult> {
  const questionId = question._id;

  const votes = await QuestionVote.find({ questionId })
    .select("userId choice")
    .lean();

  const result: QuestionResultNotifyResult = {
    totalVoters: votes.length,
    emailsSent: 0,
    smsSent: 0,
    errors: 0,
  };

  if (votes.length === 0) return result;

  const ja = votes.filter((v) => v.choice === "ja").length;
  const nej = votes.length - ja;
  const total = votes.length;
  const majority: "ja" | "nej" | "tie" =
    ja === nej ? "tie" : ja > nej ? "ja" : "nej";
  const majorityLabel =
    majority === "ja" ? "Ja" : majority === "nej" ? "Nej" : "Oavgjort";
  const percentage =
    majority === "tie" ? 50 : Math.round((Math.max(ja, nej) / total) * 100);

  const message = `Omröstningen "${question.text}" är avslutad. Resultatet blev ${majorityLabel} med ${percentage}% av rösterna. Tack för ditt engagemang.`;

  const userIds = votes.map((v) => v.userId).filter(Boolean);
  const voters = await User.find({ _id: { $in: userIds } })
    .select("email phoneNumber notificationPreference emailOptOut")
    .lean();

  for (const voter of voters) {
    if (
      voter.email &&
      !voter.emailOptOut &&
      (voter.notificationPreference === "email" ||
        voter.notificationPreference === "both")
    ) {
      try {
        await sendEmail(
          voter.email,
          "Omröstningsresultat",
          message,
          `<p style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1e293b">${message}</p>`,
        );
        result.emailsSent++;
      } catch (error: any) {
        log.error("Failed to send result email", {
          userId: voter._id,
          error: error.message,
        });
        result.errors++;
      }
    }

    if (
      voter.phoneNumber &&
      (voter.notificationPreference === "sms" ||
        voter.notificationPreference === "both")
    ) {
      const phone = formatPhoneNumber(voter.phoneNumber);
      if (!phone) {
        result.errors++;
        continue;
      }
      try {
        const smsResult = await sendSMS(phone, message);
        if (smsResult.success) {
          result.smsSent++;
        } else {
          result.errors++;
        }
      } catch (error: any) {
        log.error("Failed to send result SMS", {
          userId: voter._id,
          error: error.message,
        });
        result.errors++;
      }
    }
  }

  log.info("Sent question-close result notifications", {
    questionId: (questionId as any)?.toString?.() ?? questionId,
    ja,
    nej,
    ...result,
  });

  return result;
}
