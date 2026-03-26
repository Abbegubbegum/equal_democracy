import { User } from "./models";
import { createLogger } from "./logger";

const log = createLogger("AdminHelper");

/**
 * Check if admin can create more sessions
 * @param {string} userId - The admin's user ID
 * @returns {Promise<{canCreate: boolean, currentCount: number, limit: number, message?: string}>}
 */
export async function checkAdminSessionLimit(userId) {
	try {
		// Get user to check their session limit and admin status
		const user = await User.findById(userId);

		if (!user) {
			return {
				canCreate: false,
				remaining: 0,
				total: 0,
				message: "User not found",
			};
		}

		// Superadmins have unlimited sessions
		if (user.isSuperAdmin) {
			return {
				canCreate: true,
				remaining: Infinity,
				total: Infinity,
			};
		}

		// Regular admins have limits based on remainingSessions
		if (user.isAdmin && user.adminStatus === "approved") {
			const remaining = user.remainingSessions || 0;
			const total = user.sessionLimit || 10;
			const canCreate = remaining > 0;

			return {
				canCreate,
				remaining,
				total,
				message: canCreate
					? undefined
					: `You have used all your sessions (${total} total). Please contact a superadmin to get more sessions.`,
			};
		}

		// Not an admin
		return {
			canCreate: false,
			remaining: 0,
			total: 0,
			message: "User is not an approved admin",
		};
	} catch (error) {
		log.error("Failed to check admin session limit", { userId, error: error.message });
		return {
			canCreate: false,
			remaining: 0,
			total: 0,
			message: "An error occurred while checking session limits",
		};
	}
}

/**
 * Check if user has admin or superadmin privileges
 * @param {Object} user - The user object from session
 * @returns {boolean}
 */
export function isAdmin(user) {
	return user?.isAdmin === true && user?.adminStatus === "approved";
}

/**
 * Check if user is a superadmin
 * @param {Object} user - The user object from session
 * @returns {boolean}
 */
export function isSuperAdmin(user) {
	return user?.isSuperAdmin === true;
}

/**
 * Check if user has at least admin privileges (admin or superadmin)
 * @param {Object} user - The user object from session
 * @returns {boolean}
 */
export function hasAdminAccess(user) {
	return isSuperAdmin(user) || isAdmin(user);
}
