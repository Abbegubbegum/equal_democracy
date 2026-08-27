/**
 * Who is asking, and what they are allowed to do.
 *
 * This replaces "is there a session?" everywhere, because that question stopped
 * being sufficient: a signed-in user can now be exactly as unable to act as an
 * anonymous one. Four states, and only the last may act:
 *
 *   anonymous     no account at all — the whole app is still readable
 *   needs_bankid  a legacy email account that has not linked BankID yet
 *   restricted    BankID-verified, but not eligible to vote in Vallentuna
 *   participant   BankID-verified and eligible
 *
 * `restricted` means exactly one thing — ineligible — and carries the wording
 * explaining why, because that is a durable state the user browses in and may
 * never leave.
 *
 * `needs_bankid` is transient and, in the UI, unreachable: the link gate blocks
 * the account at startup and offers only "link BankID" or "log out", so nobody
 * browses in this state and there is no message to write for it. It exists here
 * anyway because the **server** cannot assume the client ran that gate — an
 * older app build holding a valid token would otherwise vote without ever having
 * proved who it is. Client-side copy belongs to the gate; this is the refusal.
 *
 * One rule holds this together: **capability is read from the database, never
 * from the token.** Access tokens live seven days, so a capability baked into
 * one would leave a user who just linked BankID locked out for a week — the same
 * mistake `/api/mobile/user/membership` already exists to avoid.
 *
 * See docs/bankid-login-plan.md §3.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import connectDB from "./mongodb";
import { User } from "./models";
import { verifyBearerToken } from "./mobile-jwt";
import { eligibilityMessage } from "./bankid/eligibility";

export type Capability =
  "anonymous" | "needs_bankid" | "restricted" | "participant";

/**
 * Why a viewer may not act. `null` when they can.
 *
 * For `restricted` this is an `EligibilityCode` passed straight through, so the
 * client can render the exact reason without us inventing a parallel vocabulary
 * for it. The other two states have one cause each and reuse their own name.
 */
export type BlockedReason = "NO_ACCOUNT" | "NEEDS_BANKID" | string;

export interface Viewer {
  userId: string | null;
  capability: Capability;
  /** The full user document, or null when anonymous. Lean, not hydrated. */
  user: any | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  reason: BlockedReason | null;
  /**
   * Swedish, safe to show. Empty for a participant, and empty for
   * `needs_bankid` — the link gate owns that screen's copy, and a second
   * sentence written here would only ever be shown by mistake.
   */
  message: string;
}

const ANONYMOUS: Viewer = {
  userId: null,
  capability: "anonymous",
  user: null,
  isAdmin: false,
  isSuperAdmin: false,
  reason: "NO_ACCOUNT",
  message: "Logga in med BankID för att delta.",
};

/**
 * The capability of a user document.
 *
 * Exported so the login and link endpoints can report the outcome they just
 * produced without a second database round trip.
 *
 * Note what is *not* consulted here: `isAdmin`. Admin rights are orthogonal to
 * participation — an admin who is not folkbokförd in Vallentuna must still be
 * able to manage questions, and must still not be able to vote in them
 * (docs/bankid-login-plan.md §3, D2).
 */
export function capabilityOf(user: any): {
  capability: Capability;
  reason: BlockedReason | null;
  message: string;
} {
  if (!user) {
    return {
      capability: "anonymous",
      reason: ANONYMOUS.reason,
      message: ANONYMOUS.message,
    };
  }

  // No BankID on the account. In practice the link gate has already caught this
  // at startup and the user is choosing between linking and logging out, so
  // nothing renders a message for it — but the refusal has to exist here
  // regardless, because the server cannot assume any client ran that gate.
  if (!user.bankidSubject) {
    return { capability: "needs_bankid", reason: "NEEDS_BANKID", message: "" };
  }

  const eligibility = user.eligibility || {};
  if (!eligibility.eligible) {
    // The code is the whole record of the verdict — the SPAR data behind it was
    // never stored — so the wording is looked up from it rather than kept
    // alongside it. A missing code means an account linked before the verdict
    // was recorded; treat that as "we do not know", which is restrictive and
    // recoverable at the next login rather than a claim about the person.
    return {
      capability: "restricted",
      reason: eligibility.code || "SPAR_MISSING",
      message: eligibilityMessage(eligibility.code),
    };
  }

  return { capability: "participant", reason: null, message: "" };
}

/**
 * Resolves the caller from either surface.
 *
 * The web sends a NextAuth cookie, the app sends a Bearer token, and every
 * consumer route now has to serve both plus nobody at all. Neither credential
 * failing is an error here — "no valid credential" is just `anonymous`, which is
 * a supported way to use this app.
 */
export async function getViewer(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<Viewer> {
  let userId: string | null = null;

  // Bearer first: it is unambiguous, and it lets a route be called from the app
  // even in a browser context that happens to carry a stale session cookie.
  if (req.headers.authorization) {
    try {
      userId = verifyBearerToken(req.headers.authorization).id;
    } catch {
      // Expired or forged. The app refreshes on its own; nothing to say here.
    }
  }

  if (!userId) {
    const session = await getServerSession(req, res, authOptions);
    if (session?.user?.id) userId = session.user.id;
  }

  if (!userId) return { ...ANONYMOUS };

  await connectDB();
  const user: any = await User.findById(userId)
    .select(
      "name email phoneNumber authMethod bankidSubject eligibility isAdmin isSuperAdmin membershipStatus membershipPaidUntil",
    )
    .lean();

  // A token for a deleted account. Anonymous rather than an error: the account
  // is genuinely gone, and the caller should see what any visitor sees.
  if (!user) return { ...ANONYMOUS };

  const { capability, reason, message } = capabilityOf(user);
  return {
    userId: user._id.toString(),
    capability,
    user,
    isAdmin: !!user.isAdmin,
    isSuperAdmin: !!user.isSuperAdmin,
    reason,
    message,
  };
}

/**
 * Gate for anything that writes on a citizen's behalf — a vote, a comment, a
 * rating, a proposal.
 *
 * Returns the viewer when they may act, and `null` after having already sent a
 * 401 or 403. So the caller's shape is:
 *
 *     const viewer = await requireParticipant(req, res);
 *     if (!viewer) return;
 *
 * The status separates the two things a client can do about it. 401 means "sign
 * in and try again". 403 means signing in again will not help — either the
 * account needs BankID (show the link gate) or the person is not eligible (show
 * the reason). `code` is what the app switches on; `message` is what it shows,
 * and it is deliberately empty for NEEDS_BANKID.
 */
export async function requireParticipant(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<Viewer | null> {
  const viewer = await getViewer(req, res);
  if (viewer.capability === "participant") return viewer;

  const anonymous = viewer.capability === "anonymous";
  res.status(anonymous ? 401 : 403).json({
    code: anonymous
      ? "ANONYMOUS"
      : viewer.capability === "needs_bankid"
        ? "NEEDS_BANKID"
        : "RESTRICTED",
    reason: viewer.reason,
    message: viewer.message,
  });
  return null;
}

/**
 * Gate for routes that need an account but not the right to participate —
 * reading your own membership, managing your own contact details, linking
 * BankID. A restricted user must be able to do all of those; that is how they
 * stop being restricted.
 */
export async function requireAccount(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<Viewer | null> {
  const viewer = await getViewer(req, res);
  if (viewer.userId) return viewer;

  res.status(401).json({ code: "ANONYMOUS", message: ANONYMOUS.message });
  return null;
}

/**
 * The shape both `/api/user/me` and `/api/mobile/user/me` return.
 *
 * One function rather than two nearly-identical handlers, because the clients
 * read the same fields and a drift between them would show up as one surface
 * quietly disagreeing with the other about what a user may do.
 */
export function describeViewer(
  viewer: Viewer,
  feeSek: number,
  years: number[],
) {
  const user = viewer.user;
  return {
    capability: viewer.capability,
    reason: viewer.reason,
    message: viewer.message,
    user: user
      ? {
          id: viewer.userId,
          name: user.name,
          email: user.email ?? null,
          phoneNumber: user.phoneNumber ?? null,
          isAdmin: viewer.isAdmin,
          isSuperAdmin: viewer.isSuperAdmin,
          // Drives the link gate. The same fact as capability "needs_bankid",
          // reported separately so a client never has to infer one from the
          // other.
          authMethod: user.authMethod ?? "email",
        }
      : null,
    membership: user
      ? {
          status: user.membershipStatus ?? "none",
          paidUntil: user.membershipPaidUntil ?? null,
          feeSek,
          years,
          // Exactly what this account still lacks, so the client can ask for the
          // missing pieces rather than a form that is mostly already filled in.
          missing: [
            !user.email ? "email" : null,
            !user.phoneNumber ? "phone" : null,
            viewer.capability !== "participant" ? "bankid" : null,
          ].filter(Boolean),
        }
      : null,
  };
}
