import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { User } from "../../../lib/models";
import { createLogger } from "../../../lib/logger";

const log = createLogger("SessionLimit");

export default async function handler(req, res) {
	await connectDB();

	if (req.method !== "GET") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	try {
		const user = await User.findById(session.user.id);

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		// Superadmins have unlimited sessions
		if (user.isSuperAdmin) {
			return res.status(200).json({
				remaining: Infinity,
				total: Infinity,
				isSuperAdmin: true,
			});
		}

		// Regular admins
		if (user.isAdmin && user.adminStatus === "approved") {
			return res.status(200).json({
				remaining: user.remainingSessions || 0,
				total: user.sessionLimit || 0,
				isSuperAdmin: false,
			});
		}

		return res.status(403).json({ message: "Not an admin" });
	} catch (error) {
		log.error("Failed to fetch session limit", { error: error.message });
		return res.status(500).json({ message: "An error occurred" });
	}
}
