import mongoose from "mongoose";
import { Session } from "./models";

export async function getActiveSession(sessionId: string | null = null) {
	if (sessionId) {
		const session = await Session.findOne({ _id: sessionId, status: "active" });
		return session;
	}
	const activeSession = await Session.findOne({ status: "active" });
	return activeSession;
}

export async function getAllActiveSessions() {
	const activeSessions = await Session.find({ status: "active" }).sort({ startDate: -1 });
	return activeSessions;
}

export async function registerActiveUser(userId: string, sessionId: string | null = null): Promise<boolean> {
	const activeSession = await getActiveSession(sessionId);

	if (!activeSession) {
		return false;
	}

	if (!activeSession.activeUsers) {
		activeSession.activeUsers = [];
	}

	const isAlreadyActive = activeSession.activeUsers.some(
		(id) => id.toString() === userId.toString()
	);

	if (!isAlreadyActive) {
		activeSession.activeUsers.push(userId as unknown as mongoose.Types.ObjectId);
		await activeSession.save();
		return true;
	}

	return false;
}
