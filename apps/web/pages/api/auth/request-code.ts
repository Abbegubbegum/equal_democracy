import bcrypt from "bcryptjs";
import connectDB from "../../../lib/mongodb";
import { LoginCode, Settings } from "../../../lib/models";
import { sendLoginCode } from "../../../lib/email";
import { createLogger } from "../../../lib/logger";

const log = createLogger("Auth");

function random6() {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
	if (req.method !== "POST")
		return res.status(405).json({ message: "Method not allowed" });

	const { email } = req.body || {};
	if (!email) return res.status(400).json({ message: "Email is required" });

	await connectDB();

	// Get current language setting
	const settings = await Settings.findOne();
	const language = settings?.language || "sv";

	// Basic rate-limit: at most 1 active code per email; also delete stale codes
	await LoginCode.deleteMany({
		email: email.toLowerCase(),
		expiresAt: { $lte: new Date() },
	});
	const existingActive = await LoginCode.findOne({
		email: email.toLowerCase(),
		expiresAt: { $gt: new Date() },
	});
	if (existingActive) {
		return res.status(200).json({
			ok: true,
			message: "Code sent (check you email)",
		});
	}

	const code = random6();
	const codeHash = await bcrypt.hash(code, 10);
	const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

	await LoginCode.create({
		email: email.toLowerCase(),
		codeHash,
		expiresAt,
	});

	try {
		await sendLoginCode(email, code, language);
	} catch (e) {
		// Clean up if email fails
		await LoginCode.deleteMany({
			email: email.toLowerCase(),
			expiresAt: { $gt: new Date() },
		});
		log.error("Failed to send login code", { error: e.message });
		return res.status(500).json({ message: "Could not send code" });
	}

	return res.status(200).json({ ok: true, message: "code sent" });
}
