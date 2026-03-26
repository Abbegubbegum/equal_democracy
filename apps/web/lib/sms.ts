/**
 * SMS Notification Helper using Twilio
 * Sends SMS notifications to users based on their preferences
 */

import { createLogger } from "./logger";

const log = createLogger("SMS");

/**
 * Send SMS using Twilio
 * @param {string} to - Phone number to send to (E.164 format: +46701234567)
 * @param {string} message - Message text
 * @returns {Promise<Object>} - Twilio message object
 */
export async function sendSMS(to, message) {
	// Check if Twilio is configured
	if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
		log.warn("Twilio not configured");
		return { success: false, error: "Twilio not configured" };
	}

	try {
		// Lazy load Twilio to avoid errors if not configured
		const twilio = require("twilio");
		const client = twilio(
			process.env.TWILIO_ACCOUNT_SID,
			process.env.TWILIO_AUTH_TOKEN
		);

		// Validate phone number format
		if (!to.startsWith("+")) {
			return { success: false, error: "Invalid phone number format" };
		}

		const twilioMessage = await client.messages.create({
			body: message,
			from: process.env.TWILIO_PHONE_NUMBER,
			to: to,
		});

		log.debug("SMS sent", { to, sid: twilioMessage.sid });

		return {
			success: true,
			sid: twilioMessage.sid,
			status: twilioMessage.status,
		};
	} catch (error) {
		log.error("Failed to send SMS", { to, error: error.message });
		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Format Swedish phone number to E.164 format
 * @param {string} phoneNumber - Phone number in various formats
 * @returns {string|null} - E.164 formatted number or null if invalid
 */
export function formatPhoneNumber(phoneNumber) {
	if (!phoneNumber) return null;

	// Remove all non-digit characters
	const cleaned = phoneNumber.replace(/\D/g, "");

	// Handle Swedish numbers
	if (cleaned.startsWith("46")) {
		// Already has country code
		return "+" + cleaned;
	} else if (cleaned.startsWith("0")) {
		// Remove leading 0 and add +46
		return "+46" + cleaned.substring(1);
	} else if (cleaned.length === 9) {
		// Assume Swedish number without leading 0
		return "+46" + cleaned;
	}

	// If it doesn't match Swedish format, return null
	return null;
}

/**
 * Send SMS to multiple recipients
 * @param {Array<{phone: string, message: string}>} recipients - Array of recipients
 * @returns {Promise<Array>} - Array of results
 */
export async function sendBulkSMS(recipients) {
	const results = [];

	for (const recipient of recipients) {
		const formattedPhone = formatPhoneNumber(recipient.phone);

		if (!formattedPhone) {
			results.push({
				phone: recipient.phone,
				success: false,
				error: "Invalid phone number format",
			});
			continue;
		}

		const result = await sendSMS(formattedPhone, recipient.message);
		results.push({
			phone: recipient.phone,
			...result,
		});

		// Add small delay to avoid rate limiting (Twilio has rate limits)
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	return results;
}

/**
 * Validate Twilio configuration
 * @returns {boolean} - True if Twilio is configured
 */
export function isTwilioConfigured() {
	return !!(
		process.env.TWILIO_ACCOUNT_SID &&
		process.env.TWILIO_AUTH_TOKEN &&
		process.env.TWILIO_PHONE_NUMBER
	);
}
