import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../../lib/mongodb";
import { LoginVerification } from "../../../../../lib/models";
import { createLogger } from "../../../../../lib/logger";
import { startLogin, type LoginPurpose } from "../../../../../lib/bankid/login";
import { checkLoginThrottle } from "../../../../../lib/bankid/rate-limit";
import { optionalBearerToken } from "../../../../../lib/mobile-jwt";
import { clientHint } from "../../../../../lib/bankid/client-hint";

const log = createLogger("MobileBankIdLogin");

/**
 * Deep-link schemes the app may ask GrandID to return to.
 *
 * Allowlisted rather than passed through, for the same reason the vote flow
 * does it: GrandID appends `?grandidsession=…` to whatever it is given, and an
 * arbitrary callback would hand that id to a third-party host.
 *
 * `exp://` is how Expo Go addresses a development machine; it cannot appear in a
 * store build, where the scheme is the app's own.
 */
const ALLOWED_RETURN_PREFIXES = [
  "vallentunaframat://",
  "exp://",
  "https://www.vallentuna.app/",
  "https://vallentuna.app/",
];

/**
 * GrandID rejects `scheme:///path` (three slashes) with
 * INCORRECT_CALLBACK_URL_DATA, and that is exactly what `Linking.createURL` can
 * emit. Verified against the live API 2026-08-25.
 */
function normaliseReturnUrl(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const url = value.replace(":///", "://");
  return ALLOWED_RETURN_PREFIXES.some((prefix) => url.startsWith(prefix))
    ? url
    : "";
}

/**
 * POST /api/mobile/auth/bankid
 * Body: { purpose?: "login" | "link", returnUrl?: string }
 *
 * `login` needs no token — that is the point of it. `link` requires one, and
 * attaches BankID to the account that token belongs to.
 *
 * Returns `{ pollToken, redirectUrl }`. The app opens `redirectUrl` in the
 * **system browser** (never a WebView — the hosted page launches `bankid://`,
 * which a WebView cannot follow) and polls
 * GET /api/mobile/auth/bankid/[pollToken] until it settles.
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
      const caller = optionalBearerToken(req.headers.authorization);
      if (!caller) {
        return res.status(401).json({
          code: "ANONYMOUS",
          message: "Du måste vara inloggad för att koppla BankID.",
        });
      }
      userId = caller.id;
    }

    const forwarded = String(req.headers["x-forwarded-for"] || "").split(
      ",",
    )[0];
    const ip = forwarded.trim() || req.socket?.remoteAddress || "";
    const ipHash = ip
      ? crypto.createHash("sha256").update(ip).digest("hex")
      : null;

    const throttle = await checkLoginThrottle({ userId, ipHash });
    if (throttle.limited) {
      log.warn("Mobile login start throttled", { purpose, hasUser: !!userId });
      return res.status(429).json({
        message: "För många inloggningsförsök. Försök igen om en liten stund.",
        retryAfter: throttle.retryAfter,
      });
    }

    // An unusable or missing returnUrl is not an error: BankID still works, the
    // user is just left on GrandID's completion page instead of being carried
    // back into the app. The outcome always arrives by polling.
    const returnUrl = normaliseReturnUrl(req.body?.returnUrl);
    if (req.body?.returnUrl && !returnUrl) {
      log.warn("Ignoring a returnUrl that is not an allowed deep link", {
        purpose,
        // The rejected value, not just the fact of it: the difference between a
        // scheme we do not allow and the `scheme:///path` form GrandID refuses
        // is one character, and invisible without seeing the string.
        rejected: String(req.body.returnUrl).slice(0, 120),
      });
    }

    const hint = clientHint(req);
    log.info("Mobile BankID login requested", {
      purpose,
      platform: hint.platform,
      userAgent: hint.userAgent,
      hasUser: !!userId,
      returnUrl: returnUrl || "(none)",
    });

    const started = await startLogin({
      purpose,
      userId,
      returnUrl,
      clientPlatform: hint.platform,
    });

    if (ipHash && !started.resumed) {
      await LoginVerification.updateOne(
        { pollToken: started.pollToken },
        { $set: { ipHash } },
      );
    }

    // No "order ready" line here — startLogin() already logged either
    // "Login verification started" or "Reusing in-flight login verification",
    // and a second line would only repeat purpose/platform/resumed.
    return res.status(201).json({
      pollToken: started.pollToken,
      redirectUrl: started.redirectUrl,
      resumed: started.resumed,
    });
  } catch (error) {
    log.error("Failed to start mobile BankID login", {
      purpose,
      platform: clientHint(req).platform,
      error: (error as Error).message,
    });
    return res.status(502).json({
      message: "BankID kunde inte startas just nu. Försök igen om en stund.",
    });
  }
}
