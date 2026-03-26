import mongoose from "mongoose";

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid ObjectId format
 */
export const validateObjectId = (id) => {
	if (!id || typeof id !== "string") {
		return false;
	}
	return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Converts a string to MongoDB ObjectId with validation
 * @param {string} id - The ID to convert
 * @returns {mongoose.Types.ObjectId} - MongoDB ObjectId
 * @throws {Error} - If ID format is invalid
 */
export const toObjectId = (id) => {
	if (!validateObjectId(id)) {
		throw new Error("Invalid ObjectId format");
	}
	return new mongoose.Types.ObjectId(id);
};

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
export const validateEmail = (email) => {
	if (!email || typeof email !== "string") {
		return false;
	}
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

/**
 * Sanitizes string input by trimming and limiting length
 * @param {string} str - String to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized string
 */
export const sanitizeString = (str, maxLength = 1000) => {
	if (!str || typeof str !== "string") {
		return "";
	}
	return str.trim().substring(0, maxLength);
};
