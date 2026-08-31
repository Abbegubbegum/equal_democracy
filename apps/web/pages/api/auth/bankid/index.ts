import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "@/lib/mongodb";
import { createLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/email";
import { startLogin, type LoginPurpose } from "@/lib/bankid/login";
import { checkLoginThrottle } from "@/lib/bankid/rate-limit";
import { getViewer } from "@/lib/viewer";

const log = createLogger("WebBankIdLogin");

/**
 * POST /api/auth/bankid
 *
 * Starts a BankID identification order and returns where to send the browser.
 *
 *   { purpose: "login" }  — no session required; this is how someone signs in
 *   { purpose: "link" }   — requires a session; attaches BankID to that account
 *
 * **This is the only unauthenticated BankID endpoint in the system**, which is
 * what makes the throttle below load-bearing rather than tidy: every accepted
 * order is billed, and there is no account to count against.
 *
 * The outcome never comes back through the redirect. GrandID returns the
 * browser to /login, the page polls GET /api/auth/bankid/[pollToken], and the
 * session is established from that — see the "bankid" provider in
 * [...nextauth].ts.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const purpose: LoginPurpose = req.body?.purpose === "link" ? "link" : "login";

  try {
    await connectDB();

    let userId: string | null = null;
    if (purpose === "link") {
      const viewer = await getViewer(req, res);
      if (!viewer.userId) {
        return res.status(401).json({
          code: "ANONYMOUS",
          message: "Du måste vara inloggad för att koppla BankID.",
        });
      }
      userId = viewer.userId;
    }

    // Hashed, never stored raw: it is only ever compared. `x-forwarded-for` is
    // Vercel's own header here and the first entry is the client — trusting it
    // is safe behind their proxy and meaningless anywhere else, which is fine,
    // because this is a spending cap rather than a security boundary.
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(
      ",",
    )[0];
    const ip = forwarded.trim() || req.socket?.remoteAddress || "";
    const ipHash = ip
      ? crypto.createHash("sha256").update(ip).digest("hex")
      : null;

    const throttle = await checkLoginThrottle({ userId, ipHash });
    if (throttle.limited) {
      log.warn("Login start throttled", { purpose, hasUser: !!userId });
      return res.status(429).json({
        message: "För många inloggningsförsök. Försök igen om en liten stund.",
        retryAfter: throttle.retryAfter,
      });
    }

    // Absolute https URL on our own origin. GrandID appends `?grandidsession=…`
    // to whatever it is given, so this must stay free of a query string of its
    // own. The page does not read that parameter — it polls with the token it
    // kept — but the redirect is still what carries the browser home.
    const started = await startLogin({
      purpose,
      userId,
      returnUrl: `${getBaseUrl()}/login`,
    });

    // Stamp the throttling key onto the row the start just created. Done after
    // rather than passed in, so lib/bankid/login.ts stays free of request
    // plumbing — it has no business knowing what a header is.
    if (ipHash && !started.resumed) {
      const { LoginVerification } = await import("@/lib/models");
      await LoginVerification.updateOne(
        { pollToken: started.pollToken },
        { $set: { ipHash } },
      );
    }

    return res.status(201).json({
      pollToken: started.pollToken,
      redirectUrl: started.redirectUrl,
      resumed: started.resumed,
    });
  } catch (error) {
    log.error("Failed to start BankID login", {
      purpose,
      error: (error as Error).message,
    });
    return res.status(502).json({
      message: "BankID kunde inte startas just nu. Försök igen om en stund.",
    });
  }
}
