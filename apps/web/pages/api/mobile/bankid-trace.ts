import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../lib/mongodb";
import { LoginVerification, VoteVerification } from "../../../lib/models";
import { createLogger } from "../../../lib/logger";
import { optionalBearerToken } from "../../../lib/mobile-jwt";
import { clientHint } from "../../../lib/bankid/client-hint";

const log = createLogger("BankIdTrace");

/**
 * POST /api/mobile/bankid-trace
 *
 * Where the app reports what the **browser** did, so it lands in the same log
 * stream as the server's own view of the same order.
 *
 * This exists because of a failure we could not see the shape of: a BankID
 * order that hangs answering NOTLOGGEDIN forever. The server knows only that
 * GrandID has no news. Whether the hosted page was closed, torn down,
 * backgrounded, or never reached at all is invisible to it — and that half is
 * where the Android same-device flow actually breaks. On a developer's own
 * device the app's console answers this; from a tester across town it does not,
 * and "it just hangs" is not a diagnosis.
 *
 * **Authorisation is by knowing the order's own id**, not by a session — the
 * login flow has no token yet, which is the whole point of it. A `pollToken` is
 * 32 random bytes handed only to the client that started the order, so holding
 * one is proof enough to write a log line about that order. A `verificationId`
 * (votes) is a guessable ObjectId, so that path additionally requires the
 * bearer token and is scoped to the caller.
 *
 * An unrecognised id is answered 204 and logged nowhere. That is deliberate:
 * this endpoint must never become a way to write arbitrary text into the
 * production logs, and an attacker who cannot name a real order has nothing to
 * say. For the same reason the event name is checked against a list and every
 * string is truncated.
 */

/**
 * The events the client may report. An allowlist rather than free text, so the
 * log stays greppable and cannot be filled with someone else's prose.
 */
const EVENTS = new Set([
  "start",
  "started",
  "browser opening",
  "browser closed",
  "browser threw",
  "deep link",
  "app state",
  "poll",
  "poll failed",
  "order gone (404)",
  "watch timed out",
  "stalled",
  "retry requested",
]);

/** Detail is diagnostic breadcrumbs, never a payload. */
const MAX_DETAIL_KEYS = 8;
const MAX_VALUE_LENGTH = 200;

function safeDetail(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_DETAIL_KEYS) break;
    if (value === null || value === undefined) continue;
    if (typeof value === "object") continue;
    out[key.slice(0, 40)] = String(value).slice(0, MAX_VALUE_LENGTH);
  }
  return out;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const event = String(req.body?.event || "");
  if (!EVENTS.has(event)) return res.status(204).end();

  const pollToken = req.body?.pollToken;
  const verificationId = req.body?.verificationId;

  try {
    await connectDB();

    const platform = clientHint(req).platform;
    const detail = safeDetail(req.body?.detail);

    if (typeof pollToken === "string" && pollToken) {
      const row: any = await LoginVerification.findOne({ pollToken })
        .select("_id purpose status clientPlatform createdAt")
        .lean();
      // Silence rather than an error: an expired order is the ordinary reason,
      // and there is nothing the app could usefully do about it either way.
      if (!row) return res.status(204).end();

      log.info("Login client trace", {
        verificationId: row._id.toString(),
        purpose: row.purpose,
        status: row.status,
        platform,
        event,
        ...detail,
        ageSeconds: Math.round(
          (Date.now() - new Date(row.createdAt).getTime()) / 1000,
        ),
      });
      return res.status(204).end();
    }

    if (typeof verificationId === "string" && verificationId) {
      // An ObjectId is guessable, so this half needs the session the vote flow
      // already has, and only ever speaks about the caller's own order.
      const caller = optionalBearerToken(req.headers.authorization);
      if (!caller) return res.status(204).end();

      const row: any = await VoteVerification.findOne({
        _id: verificationId,
        userId: caller.id,
      })
        .select("_id status createdAt")
        .lean()
        .catch(() => null);
      if (!row) return res.status(204).end();

      log.info("Vote client trace", {
        verificationId: row._id.toString(),
        status: row.status,
        platform,
        event,
        ...detail,
        ageSeconds: Math.round(
          (Date.now() - new Date(row.createdAt).getTime()) / 1000,
        ),
      });
      return res.status(204).end();
    }

    return res.status(204).end();
  } catch (error) {
    // Never surfaced to the user, and never allowed to fail a flow: this is
    // diagnostics, and diagnostics that can break the thing they diagnose are
    // worse than none.
    log.warn("Could not record a BankID client trace", {
      event,
      error: (error as Error).message,
    });
    return res.status(204).end();
  }
}
