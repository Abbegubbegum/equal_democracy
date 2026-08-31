import jwt from "jsonwebtoken";

const SECRET = process.env.NEXTAUTH_SECRET!;
const ACCESS_TOKEN_TTL = "7d";
const REFRESH_TOKEN_TTL = "30d";

export interface MobileTokenPayload {
  id: string;
  /**
   * Null for a BankID account that has not added a contact address. It is not a
   * credential and never was — see docs/bankid-login-plan.md §1 C2 — so nothing
   * may key off it. `id` is the identity.
   */
  email: string | null;
  name: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminStatus: string;
  type: "access" | "refresh";
}

export function signAccessToken(
  payload: Omit<MobileTokenPayload, "type">,
): string {
  return jwt.sign({ ...payload, type: "access" }, SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function signRefreshToken(
  payload: Omit<MobileTokenPayload, "type">,
): string {
  return jwt.sign({ ...payload, type: "refresh" }, SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyMobileToken(
  token: string,
  type: "access" | "refresh",
): MobileTokenPayload {
  const payload = jwt.verify(token, SECRET) as MobileTokenPayload;
  if (payload.type !== type) {
    throw new Error(`Expected ${type} token`);
  }
  return payload;
}

/** Extract and verify the Bearer token from an Authorization header. */
export function verifyBearerToken(
  authHeader: string | undefined,
): MobileTokenPayload {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header");
  }
  return verifyMobileToken(authHeader.slice(7), "access");
}

/**
 * The same, for routes that serve signed-out visitors too — `null` instead of a
 * throw when there is no usable token.
 *
 * Every read endpoint uses this now: the app is fully browsable without an
 * account, so "no credential" is an ordinary way to call a GET rather than a
 * failure. An *invalid* token also lands here as `null` rather than a 401,
 * deliberately — the app refreshes expired tokens on its own, and a visitor
 * whose session lapsed mid-scroll should see the page, not an error.
 *
 * Never use it to guard a write. `requireParticipant()` in lib/viewer.ts is the
 * gate for those, and it consults the database rather than the token.
 */
export function optionalBearerToken(
  authHeader: string | undefined,
): MobileTokenPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return verifyMobileToken(authHeader.slice(7), "access");
  } catch {
    return null;
  }
}
