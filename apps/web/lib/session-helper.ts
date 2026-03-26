import { Session } from "./models";

/**
 * Get an active session
 * @param {string} [sessionId] - Optional session ID. If provided, fetches that specific session.
 *                               If not provided, returns the first active session (backward compatible).
 * @returns {Promise<Object|null>} The active session or null
 */
export async function getActiveSession(sessionId = null) {
	if (sessionId) {
		// Fetch specific session by ID and verify it's active
		const session = await Session.findOne({ _id: sessionId, status: "active" });
		return session;
	}
	// Backward compatible: return first active session
	const activeSession = await Session.findOne({ status: "active" });
	return activeSession;
}

/**
 * Get all active sessions
 * @returns {Promise<Array>} Array of active sessions
 */
export async function getAllActiveSessions() {
	const activeSessions = await Session.find({ status: "active" }).sort({ startDate: -1 });
	return activeSessions;
}

/**
 * Register a user as active in a session
 * Only called when user performs an action (creates proposal, rates, votes, comments)
 * @param {string} userId - The user's ID
 * @param {string} [sessionId] - Optional session ID. If not provided, uses first active session.
 * @returns {Promise<boolean>} True if user was added, false if already active
 */
export async function registerActiveUser(userId, sessionId = null) {
	const activeSession = await getActiveSession(sessionId);

	if (!activeSession) {
		return false;
	}

	// Initialize activeUsers array if it doesn't exist
	if (!activeSession.activeUsers) {
		activeSession.activeUsers = [];
	}

	// Check if user is already in activeUsers array
	const isAlreadyActive = activeSession.activeUsers.some(
		(id) => id.toString() === userId.toString()
	);

	if (!isAlreadyActive) {
		// Add user to activeUsers array
		activeSession.activeUsers.push(userId);
		await activeSession.save();
		return true;
	}

	return false;
}
