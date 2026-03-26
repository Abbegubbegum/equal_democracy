import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import Pusher from "pusher";
import { createLogger } from "../../../lib/logger";

const log = createLogger("PusherAuth");

/**
 * Pusher authentication endpoint for presence channels
 * This endpoint authorizes users to join the presence channel
 * and provides user info (id, name) for the presence roster
 */
export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	// Get the authenticated user session
	const session = await getServerSession(req, res, authOptions);

	if (!session || !session.user) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	// Initialize Pusher
	const pusher = new Pusher({
		appId: process.env.PUSHER_APP_ID,
		key: process.env.PUSHER_KEY,
		secret: process.env.PUSHER_SECRET,
		cluster: process.env.PUSHER_CLUSTER,
		useTLS: true,
	});

	const { socket_id, channel_name } = req.body;

	// Only authorize presence channels
	if (!channel_name.startsWith("presence-")) {
		return res.status(403).json({ error: "Forbidden" });
	}

	// Define the user data that will be visible in the presence channel
	// Only expose anonymous user_id for privacy - no names or other PII
	const presenceData = {
		user_id: session.user.id,
		user_info: {
			// Removed name for anonymity
		},
	};

	try {
		const authResponse = pusher.authorizeChannel(
			socket_id,
			channel_name,
			presenceData
		);
		res.status(200).json(authResponse);
	} catch (error) {
		log.error("Channel authorization failed", { channel: channel_name, error: error.message });
		res.status(500).json({ error: "Authentication failed" });
	}
}
