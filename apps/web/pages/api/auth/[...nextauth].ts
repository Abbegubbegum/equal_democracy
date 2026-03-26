import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "../../../lib/mongodb";
import { User, LoginCode } from "../../../lib/models";
import { createLogger } from "../../../lib/logger";

const log = createLogger("Auth");

export const authOptions = {
	providers: [
		CredentialsProvider({
			name: "Email Code",
			credentials: {
				email: { label: "Email", type: "email" },
				code: { label: "Code", type: "text" },
			},
			async authorize(credentials) {
				try {
					await connectDB();

					const email = credentials?.email?.toLowerCase();
					const code = credentials?.code?.trim();

					if (!email || !code) {
						throw new Error("Please enter an email and code");
					}

					// Find active code
					const rec = await LoginCode.findOne({
						email,
						expiresAt: { $gt: new Date() },
					});

					if (!rec) {
						throw new Error("Code is invalid or expired");
					}

					// throttle attempts
					if (rec.attempts >= 5) {
						await LoginCode.deleteMany({ email });
						throw new Error(
							"To many failed attemps, request a new code."
						);
					}

					const ok = await bcrypt.compare(code, rec.codeHash);
					if (!ok) {
						rec.attempts += 1;
						await rec.save();
						throw new Error("Code is invalid");
					}

					// One-time: consume code
					await LoginCode.deleteMany({ email });

					let user = await User.findOne({ email });

					if (!user) {
						const name =
							email
								.split("@")[0]
								.replace(/[._-]/g, " ")
								.replace(/\b\w/g, (c) => c.toUpperCase())
								.slice(0, 60) || "Citizen";

						user = await User.create({
							name: name,
							email,
							// no password
						});
					}

					return {
						id: user._id.toString(),
						email: user.email,
						name: user.name,
						isAdmin: !!user.isAdmin,
						isSuperAdmin: !!user.isSuperAdmin,
						adminStatus: user.adminStatus || "none",
					};
				} catch (error) {
					log.error("Authentication failed", { error: error.message });
					throw error;
				}
			},
		}),
	],
	pages: {
		signIn: "/login",
		signOut: "/login",
		error: "/login",
	},
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				// Initial sign-in: store all user data in the token
				token.id = user.id;
				token.email = user.email;
				token.name = user.name;
				token.isAdmin = !!user.isAdmin;
				token.isSuperAdmin = !!user.isSuperAdmin;
				token.adminStatus = user.adminStatus || "none";
				token.lastRefreshed = Date.now();
			} else if (!token.lastRefreshed || Date.now() - token.lastRefreshed > 5 * 60 * 1000) {
				// Refresh from DB every 5 minutes
				try {
					await connectDB();
					const dbUser = await User.findById(token.id);
					if (!dbUser) {
						return {};
					}
					token.email = dbUser.email;
					token.name = dbUser.name;
					token.isAdmin = !!dbUser.isAdmin;
					token.isSuperAdmin = !!dbUser.isSuperAdmin;
					token.adminStatus = dbUser.adminStatus || "none";
					token.lastRefreshed = Date.now();
				} catch (error) {
					log.error("JWT refresh failed", { error: error.message });
				}
			}
			return token;
		},
		async session({ session, token }) {
			if (token && session.user) {
				if (!token.id) {
					return null;
				}
				session.user.id = token.id;
				session.user.email = token.email;
				session.user.name = token.name;
				session.user.isAdmin = !!token.isAdmin;
				session.user.isSuperAdmin = !!token.isSuperAdmin;
				session.user.adminStatus = token.adminStatus || "none";
			}
			return session;
		},
	},
	session: {
		strategy: "jwt",
		maxAge: 30 * 24 * 60 * 60, // 30 days
	},
	secret: process.env.NEXTAUTH_SECRET,
	debug: process.env.NODE_ENV === "development",
};

export default NextAuth(authOptions);
