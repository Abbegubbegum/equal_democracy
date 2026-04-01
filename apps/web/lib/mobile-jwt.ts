import jwt from "jsonwebtoken";

const SECRET = process.env.NEXTAUTH_SECRET!;
const ACCESS_TOKEN_TTL = "7d";
const REFRESH_TOKEN_TTL = "30d";

export interface MobileTokenPayload {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminStatus: string;
  type: "access" | "refresh";
}

export function signAccessToken(payload: Omit<MobileTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "access" }, SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function signRefreshToken(payload: Omit<MobileTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "refresh" }, SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyMobileToken(token: string, type: "access" | "refresh"): MobileTokenPayload {
  const payload = jwt.verify(token, SECRET) as MobileTokenPayload;
  if (payload.type !== type) {
    throw new Error(`Expected ${type} token`);
  }
  return payload;
}

/** Extract and verify the Bearer token from an Authorization header. */
export function verifyBearerToken(authHeader: string | undefined): MobileTokenPayload {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header");
  }
  return verifyMobileToken(authHeader.slice(7), "access");
}
