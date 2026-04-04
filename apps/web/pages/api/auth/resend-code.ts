import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import connectDB from "../../../lib/mongodb";
import { LoginCode, Settings } from "../../../lib/models";
import { sendLoginCode } from "../../../lib/email";
import { createLogger } from "../../../lib/logger";
import { random6 } from "./request-code";

const log = createLogger("Auth");

const RESEND_COOLDOWN_SECONDS = 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST")
		return res.status(405).json({ message: "Method not allowed" });

	const { email } = req.body || {};
	if (!email) return res.status(400).json({ message: "Email is required" });

	await connectDB();

	// Delete stale codes
	await LoginCode.deleteMany({
		email: email.toLowerCase(),
		expiresAt: { $lte: new Date() },
	});

	// Enforce cooldown: reject if a code was created less than 60s ago
	const existingActive = await LoginCode.findOne({
		email: email.toLowerCase(),
		expiresAt: { $gt: new Date() },
	});
	if (existingActive) {
		const secondsSinceCreated = (Date.now() - new Date(existingActive.createdAt).getTime()) / 1000;
		if (secondsSinceCreated < RESEND_COOLDOWN_SECONDS) {
			const retryAfter = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceCreated);
			return res.status(429).json({
				message: `Please wait ${retryAfter} seconds before resending`,
				retryAfter,
			});
		}
		// Cooldown passed — invalidate the old code
		await LoginCode.deleteMany({ email: email.toLowerCase() });
	}

	const settings = await Settings.findOne();
	const language = settings?.language || "sv";

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
		await LoginCode.deleteMany({
			email: email.toLowerCase(),
			expiresAt: { $gt: new Date() },
		});
		log.error("Failed to resend login code", { error: e.message });
		return res.status(500).json({ message: "Could not send code" });
	}

	return res.status(200).json({ ok: true });
}
