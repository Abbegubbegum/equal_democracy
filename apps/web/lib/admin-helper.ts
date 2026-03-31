import { User } from "./models";
import { createLogger } from "./logger";
import type { AuthUser } from "@repo/types";

const log = createLogger("AdminHelper");

export async function checkAdminSessionLimit(userId: string) {
	try {
		const user = await User.findById(userId);

		if (!user) {
			return {
				canCreate: false,
				remaining: 0,
				total: 0,
				message: "User not found",
			};
		}

		if (user.isSuperAdmin) {
			return {
				canCreate: true,
				remaining: Infinity,
				total: Infinity,
			};
		}

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

		return {
			canCreate: false,
			remaining: 0,
			total: 0,
			message: "User is not an approved admin",
		};
	} catch (error) {
		log.error("Failed to check admin session limit", { userId, error: (error as Error).message });
		return {
			canCreate: false,
			remaining: 0,
			total: 0,
			message: "An error occurred while checking session limits",
		};
	}
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
	return user?.isAdmin === true && (user as AuthUser & { adminStatus?: string })?.adminStatus === "approved";
}

export function isSuperAdmin(user: AuthUser | null | undefined): boolean {
	return user?.isSuperAdmin === true;
}

export function hasAdminAccess(user: AuthUser | null | undefined): boolean {
	return isSuperAdmin(user) || isAdmin(user);
}
