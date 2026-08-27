import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../../lib/mongodb";
import { User } from "../../../../../lib/models";
import { createLogger } from "../../../../../lib/logger";
import {
  cancelLogin,
  consumeVerification,
  pollLogin,
} from "../../../../../lib/bankid/login";
import {
  signAccessToken,
  signRefreshToken,
} from "../../../../../lib/mobile-jwt";
import { capabilityOf } from "../../../../../lib/viewer";

const log = createLogger("MobileBankIdLoginPoll");

/**
 * GET    /api/mobile/auth/bankid/[token] — poll; issues tokens once it settles
 * DELETE /api/mobile/auth/bankid/[token] — give up, releasing the order
 *
 * `token` is the `pollToken` from the start endpoint. It is a bearer secret —
 * whoever holds it gets this account's tokens — which is why it is 32 random
 * bytes rather than the row's guessable ObjectId, and why the row is spent
 * exactly once.
 *
 * Unlike the web, this issues the session directly: there is no NextAuth here,
 * we mint the JWT pair ourselves, so there is nothing to hand off to.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // **Never cached.** Next.js puts an ETag on API responses by default, so a
  // client polling this gets 304s — and a 304 either has no body to parse or is
  // transparently served from the platform HTTP cache with the *previous*
  // answer. Either way the poller keeps seeing PENDING after the order has
  // settled, and the flow simply never completes.
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const token = req.query.token;
  if (typeof token !== "string" || !token) {
    return res.status(400).json({ message: "Ogiltig token" });
  }

  try {
    await connectDB();

    if (req.method === "DELETE") {
      const cancelled = await cancelLogin(token);
      return res.status(200).json({ cancelled });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const result = await pollLogin(token);
    if (!result.found) {
      return res
        .status(404)
        .json({ message: "Inloggningen finns inte längre" });
    }

    if (result.status !== "VERIFIED") {
      return res.status(200).json({
        status: result.status,
        reasonCode: result.reasonCode,
        message: result.message,
      });
    }

    // Spend the row. Atomic and one-way, so a retried poll — which the app does
    // by design, and which app-switching back from BankID makes likely — cannot
    // mint a second session.
    const spent = await consumeVerification(token);
    if (!spent) {
      // Already consumed. The app has its tokens from the first successful poll;
      // saying so lets it stop rather than treating this as a failure.
      return res.status(409).json({
        status: "ALREADY_CONSUMED",
        message: "",
      });
    }

    const user: any = await User.findById(spent.userId);
    if (!user) {
      log.error("Verified login resolved to a missing account", {
        userId: spent.userId,
      });
      return res.status(500).json({ message: "Kontot kunde inte hittas." });
    }

    const payload = {
      id: user._id.toString(),
      email: user.email ?? null,
      name: user.name,
      isAdmin: !!user.isAdmin,
      isSuperAdmin: !!user.isSuperAdmin,
      adminStatus: user.adminStatus || "none",
    };

    // The capability rides along so the app knows on the login screen whether
    // this person may act. An ineligible user is genuinely signed in and must be
    // told why now, rather than discovering it at their first tap.
    const verdict = capabilityOf(user);

    log.info("Mobile BankID session issued", {
      userId: payload.id,
      capability: verdict.capability,
      createdAccount: result.createdAccount,
    });

    return res.status(200).json({
      status: "VERIFIED",
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        isAdmin: payload.isAdmin,
        isSuperAdmin: payload.isSuperAdmin,
      },
      capability: verdict.capability,
      capabilityMessage: verdict.message,
      createdAccount: result.createdAccount,
    });
  } catch (error) {
    log.error("Mobile BankID login poll failed", {
      error: (error as Error).message,
    });
    return res.status(502).json({
      message: "Kunde inte kontrollera inloggningen. Försök igen om en stund.",
    });
  }
}
