import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "@/lib/mongodb";
import { User } from "@/lib/models";
import { createLogger } from "@/lib/logger";
import { cancelLogin, pollLogin } from "@/lib/bankid/login";
import { capabilityOf } from "@/lib/viewer";

const log = createLogger("WebBankIdLoginPoll");

/**
 * GET    /api/auth/bankid/[token]  — poll, settling the login when BankID is done
 * DELETE /api/auth/bankid/[token]  — give up, releasing the order
 *
 * `token` is the `pollToken` handed back by the start endpoint, not the row's
 * id. It is a bearer secret: whoever holds it will be handed this account's
 * session, which is why it is 32 random bytes rather than something guessable.
 *
 * A VERIFIED result here does **not** establish the session. The page then calls
 * `signIn("bankid", { pollToken })`, and the provider in [...nextauth].ts spends
 * the row exactly once. Splitting it that way keeps NextAuth the only thing that
 * issues a session cookie.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
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

    // An unknown token is a 404 rather than an error: it is what a reload after
    // the row's TTL looks like, and there is nothing the user can do but start
    // again.
    if (!result.found) {
      return res
        .status(404)
        .json({ message: "Inloggningen finns inte längre" });
    }

    // The capability comes back with the login so the client knows immediately
    // whether this person may act — an ineligible user is signed in, and must be
    // told why rather than discovering it at their first tap.
    let capability: string | null = null;
    let capabilityMessage = "";
    if (result.status === "VERIFIED" && result.userId) {
      const user: any = await User.findById(result.userId)
        .select("bankidSubject eligibility")
        .lean();
      const verdict = capabilityOf(user);
      capability = verdict.capability;
      capabilityMessage = verdict.message;
    }

    return res.status(200).json({
      status: result.status,
      reasonCode: result.reasonCode,
      message: result.message,
      createdAccount: result.createdAccount,
      capability,
      capabilityMessage,
    });
  } catch (error) {
    log.error("BankID login poll failed", { error: (error as Error).message });
    return res.status(502).json({
      message: "Kunde inte kontrollera inloggningen. Försök igen om en stund.",
    });
  }
}
