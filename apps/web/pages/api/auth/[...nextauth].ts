import NextAuth, { type NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "../../../lib/mongodb";
import { User, LoginCode } from "../../../lib/models";
import { consumeVerification } from "../../../lib/bankid/login";
import { createLogger } from "../../../lib/logger";

const log = createLogger("Auth");

export const authOptions: NextAuthOptions = {
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
            throw new Error("To many failed attemps, request a new code.");
          }

          const ok = await bcrypt.compare(code, rec.codeHash);
          if (!ok) {
            rec.attempts += 1;
            await rec.save();
            throw new Error("Code is invalid");
          }

          // One-time: consume code
          await LoginCode.deleteMany({ email });

          const user = await User.findOne({ email });

          // Accounts are not created here any more. BankID is the only way to
          // become a user; this provider survives solely so a legacy email
          // account can be signed into once, to reach the link gate.
          if (!user) {
            throw new Error(
              "Det finns inget konto med den e-postadressen. Logga in med BankID.",
            );
          }

          // **C1 — no ID-växling.** Once an account carries a BankID identity,
          // that is the only thing that may open a session for it. Its email is
          // a contact channel from then on, and letting a code sent to it log in
          // would be exactly the credential-issuing this rule forbids.
          if (user.authMethod === "bankid" || user.bankidSubject) {
            throw new Error(
              "Det här kontot loggar in med BankID. Använd BankID-knappen.",
            );
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
    CredentialsProvider({
      id: "bankid",
      name: "BankID",
      credentials: {
        pollToken: { label: "Poll token", type: "text" },
      },
      /**
       * Turns a settled BankID identification into a session.
       *
       * It verifies nothing about the person — that already happened in
       * `settleLogin`, against GrandID, minutes ago. All this does is spend the
       * row exactly once, and `consumeVerification` makes that atomic: the
       * `consumedAt: null` predicate is part of the update, so two racing
       * requests cannot both come away with a session.
       *
       * A settled row is therefore a credential until it is spent, which is why
       * `pollToken` is 32 random bytes and never the row's own ObjectId.
       */
      async authorize(credentials) {
        await connectDB();

        const pollToken = credentials?.pollToken?.trim();
        if (!pollToken) throw new Error("Inloggningen kunde inte slutföras.");

        const spent = await consumeVerification(pollToken);
        if (!spent) {
          // Either it was never verified, or it has already been used. Both mean
          // "start again", and saying which would tell an attacker whether a
          // guessed token exists.
          throw new Error("Inloggningen har gått ut. Försök igen.");
        }

        const user = await User.findById(spent.userId);
        if (!user) throw new Error("Kontot kunde inte hittas.");

        log.info("BankID session established", { userId: spent.userId });

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          isAdmin: !!user.isAdmin,
          isSuperAdmin: !!user.isSuperAdmin,
          adminStatus: user.adminStatus || "none",
        };
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
      } else if (
        !token.lastRefreshed ||
        Date.now() - token.lastRefreshed > 5 * 60 * 1000
      ) {
        // Refresh from DB every 5 minutes
        try {
          await connectDB();
          const dbUser = await User.findById(token.id);
          if (!dbUser) {
            return {} as JWT;
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
