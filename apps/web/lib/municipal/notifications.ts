/**
 * Municipal Meeting Notification System
 * Send notifications to users based on their interested categories
 */

import { User } from "../models";
import { sendEmail } from "../email";
import { sendSMS, formatPhoneNumber } from "../sms";
import { createLogger } from "../logger";

const log = createLogger("Notifications");

/**
 * Send notifications for a new municipal meeting
 * @param {Object} meeting - MunicipalMeeting document
 * @returns {Promise<Object>} - Notification results
 */
export async function sendMunicipalMeetingNotifications(meeting) {
  try {
    // Collect all unique categories from all items
    const allCategories = new Set();
    for (const item of meeting.items) {
      for (const cat of item.categories || []) {
        allCategories.add(cat);
      }
    }

    const categoriesArray = Array.from(allCategories);

    log.info("Sending notifications", {
      meetingName: meeting.name,
      categories: categoriesArray,
    });

    // Find all users interested in these categories — item.categories are
    // already ALL_CATEGORIES strings, the same format as User.interests.
    const interestedUsers = await User.find({
      interests: { $in: categoriesArray },
      notificationPreference: { $ne: "none" }, // Skip users who disabled notifications
    });

    log.debug("Found interested users", { count: interestedUsers.length });

    const results = {
      totalUsers: interestedUsers.length,
      emailsSent: 0,
      smsSent: 0,
      errors: [],
    };

    // Send notifications to each user
    for (const user of interestedUsers) {
      // Find which items match this user's interests
      const relevantItems = meeting.items.filter((item) =>
        (item.categories || []).some((cat) =>
          (user.interests || []).includes(cat),
        ),
      );

      if (relevantItems.length === 0) continue;

      // Create notification message
      const meetingDate = new Date(meeting.meetingDate).toLocaleDateString(
        "sv-SE",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        },
      );

      const itemsList = relevantItems
        .map((item) => `• ${item.title}`)
        .slice(0, 5)
        .join("\n");

      const moreText =
        relevantItems.length > 5
          ? `\n...och ${relevantItems.length - 5} till`
          : "";

      // Email notification (skipped for users who opted out of
      // non-essential emails)
      if (
        !user.emailOptOut &&
        (user.notificationPreference === "email" ||
          user.notificationPreference === "both")
      ) {
        const emailSubject = `${meeting.meetingType} ${meetingDate} - Frågor i dina intresseområden`;

        const emailBody = `
Hej ${user.name}!

${meeting.meetingType} ska hålla möte ${meetingDate}.

Det finns ${relevantItems.length} frågor som berör dina intresseområden:

${itemsList}${moreText}

Du kan debattera och rösta på dessa frågor på vallentuna.app

Dina intresseområden: ${(user.interests || []).join(", ")}

Med vänliga hälsningar,
Vallentuna Framåt Vallentuna
				`.trim();

        try {
          await sendEmail(user.email, emailSubject, emailBody, emailBody);
          results.emailsSent++;
        } catch (error) {
          log.error("Failed to send email", {
            email: user.email,
            error: error.message,
          });
          results.errors.push({
            userId: user._id,
            type: "email",
            error: error.message,
          });
        }
      }

      // SMS notification
      if (
        user.notificationPreference === "sms" ||
        user.notificationPreference === "both"
      ) {
        if (!user.phoneNumber) {
          continue;
        }

        const smsBody = `${meeting.meetingType} ${new Date(meeting.meetingDate).toLocaleDateString("sv-SE")}: ${relevantItems.length} frågor i dina intresseområden. Rösta på vallentuna.app`;

        const formattedPhone = formatPhoneNumber(user.phoneNumber);

        if (!formattedPhone) {
          results.errors.push({
            userId: user._id,
            type: "sms",
            error: "Invalid phone number",
          });
          continue;
        }

        try {
          const smsResult = await sendSMS(formattedPhone, smsBody);
          if (smsResult.success) {
            results.smsSent++;
          } else {
            results.errors.push({
              userId: user._id,
              type: "sms",
              error: smsResult.error,
            });
          }
        } catch (error) {
          log.error("Failed to send SMS", {
            phone: formattedPhone,
            error: error.message,
          });
          results.errors.push({
            userId: user._id,
            type: "sms",
            error: error.message,
          });
        }
      }

      // Small delay between users to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    log.info("Notifications completed", {
      emails: results.emailsSent,
      sms: results.smsSent,
      errors: results.errors.length,
    });

    return results;
  } catch (error) {
    log.error("Failed to send notifications", { error: error.message });
    throw error;
  }
}
