import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import { User } from "../../lib/models";
import { createLogger } from "@/lib/logger";

const log = createLogger("DebugUser");

export default async function handler(req, res) {
	await connectDB();

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	try {
		// Find the user in the database
		const user = await User.findById(session.user.id);

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		// If this is a POST request and the email is authorized, set superadmin
		const authorizedEmails = ["peer.norback@gmail.com", "albin.nojback@gmail.com"];
		if (req.method === "POST" && authorizedEmails.includes(user.email)) {
			user.isSuperAdmin = true;
			user.isAdmin = true;
			await user.save();

			return res.status(200).json({
				message: "Superadmin status set",
				user: {
					email: user.email,
					name: user.name,
					isAdmin: user.isAdmin,
					isSuperAdmin: user.isSuperAdmin,
				},
			});
		}

		// GET request - if user is superadmin, allow checking other users by email query param
		if (req.method === "GET" && req.query.email && user.isSuperAdmin) {
			const checkUser = await User.findOne({ email: req.query.email.toLowerCase() });

			if (!checkUser) {
				return res.status(404).json({ message: "User not found" });
			}

			return res.status(200).json({
				database: {
					email: checkUser.email,
					name: checkUser.name,
					isAdmin: checkUser.isAdmin,
					isSuperAdmin: checkUser.isSuperAdmin,
					adminStatus: checkUser.adminStatus,
				},
			});
		}

		// GET request - just return user data
		return res.status(200).json({
			session: session.user,
			database: {
				email: user.email,
				name: user.name,
				isAdmin: user.isAdmin,
				isSuperAdmin: user.isSuperAdmin,
				adminStatus: user.adminStatus,
			},
		});
	} catch (error) {
		log.error("Debug user error", { error: error.message });
		return res.status(500).json({ message: "An error occurred", error: error.message });
	}
}
