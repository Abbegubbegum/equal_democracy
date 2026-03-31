import mongoose from "mongoose";

export const validateObjectId = (id: string): boolean => {
	if (!id || typeof id !== "string") {
		return false;
	}
	return mongoose.Types.ObjectId.isValid(id);
};

export const toObjectId = (id: string): mongoose.Types.ObjectId => {
	if (!validateObjectId(id)) {
		throw new Error("Invalid ObjectId format");
	}
	return new mongoose.Types.ObjectId(id);
};

export const validateEmail = (email: string): boolean => {
	if (!email || typeof email !== "string") {
		return false;
	}
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

export const sanitizeString = (str: string, maxLength = 1000): string => {
	if (!str || typeof str !== "string") {
		return "";
	}
	return str.trim().substring(0, maxLength);
};
