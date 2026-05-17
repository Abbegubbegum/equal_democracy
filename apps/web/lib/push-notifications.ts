import { createLogger } from "./logger";
import connectDB from "./mongodb";
import { User } from "./models";

const log = createLogger("push-notifications");
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: "default" | null;
}

export async function sendPushNotifications(
  messages: PushMessage[],
): Promise<void> {
  if (messages.length === 0) return;

  // Expo push API accepts up to 100 messages per request
  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        log.error("Expo push API error", { status: res.status });
      }
    } catch (error) {
      log.error("Failed to send push notifications", { error: error.message });
    }
  }
}

/**
 * Returns push tokens for users whose interests overlap with the given categories.
 * Users with no interests set receive all notifications (opt-in model — filter only after preferences are saved).
 * If categories is empty, all users with tokens are returned.
 */
export async function getTokensForCategories(
  categories: string[],
): Promise<string[]> {
  await connectDB();
  const query =
    categories.length > 0
      ? {
          expoPushToken: { $exists: true, $ne: null },
          $or: [
            { interests: { $size: 0 } },
            { interests: { $in: categories } },
          ],
        }
      : { expoPushToken: { $exists: true, $ne: null } };

  const users = await User.find(query, "expoPushToken").lean();
  return (users as any[]).map((u) => u.expoPushToken).filter(Boolean);
}

export async function notifyNewVotingQuestion(
  question: string,
  tokens: string[],
): Promise<void> {
  const valid = tokens.filter((t) => t?.startsWith("ExponentPushToken["));
  if (valid.length === 0) return;

  const messages: PushMessage[] = valid.map((token) => ({
    to: token,
    title: "Ny fråga! 🗳️",
    body: question,
    data: { screen: "vote" },
    badge: 1,
    sound: "default",
  }));

  await sendPushNotifications(messages);
  log.info("Sent voting question notifications", { count: valid.length });
}
