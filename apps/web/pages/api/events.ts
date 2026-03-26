/**
 * Pusher configuration endpoint
 * Returns Pusher public key and cluster for client-side connection
 *
 * NOTE: This endpoint is optional. You can also hardcode NEXT_PUBLIC_PUSHER_KEY
 * and NEXT_PUBLIC_PUSHER_CLUSTER in your .env.local file and access them
 * directly in the client code. This endpoint provides a way to dynamically
 * fetch the config if needed.
 */
export default async function handler(req, res) {
	// Only allow GET requests
	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	// Return Pusher public configuration
	res.status(200).json({
		key: process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY,
		cluster:
			process.env.NEXT_PUBLIC_PUSHER_CLUSTER ||
			process.env.PUSHER_CLUSTER,
	});
}
