import { createHash, randomBytes } from "crypto";
import { verifyBearerToken } from "./mobile-jwt";

/**
 * Simple CSRF token generator and validator
 * Tokens are stored in session cookies and validated on state-changing requests
 */

const SECRET = process.env.NEXTAUTH_SECRET || "fallback-csrf-secret";

/**
 * Generates a CSRF token
 * @returns {string} - CSRF token
 */
export function generateCsrfToken() {
  const token = randomBytes(32).toString("hex");
  return token;
}

/**
 * Creates a hash of the token with the secret
 * @param {string} token - The token to hash
 * @returns {string} - Hashed token
 */
function hashToken(token) {
  return createHash("sha256").update(`${token}:${SECRET}`).digest("hex");
}

/**
 * Validates a CSRF token against the stored hash
 * @param {string} token - Token from request
 * @param {string} storedHash - Hash stored in cookie
 * @returns {boolean} - True if valid
 */
export function validateCsrfToken(token, storedHash) {
  if (!token || !storedHash) {
    return false;
  }

  const hash = hashToken(token);
  return hash === storedHash;
}

/**
 * Gets or creates CSRF token from cookies
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @returns {string} - CSRF token
 */
export function getCsrfToken(req, res) {
  // Check if token already exists in cookie AND matches its hash
  const existingToken = req.cookies?.["csrf-token"];
  const existingHash = req.cookies?.["csrf-token-hash"];

  if (
    existingToken &&
    existingHash &&
    validateCsrfToken(existingToken, existingHash)
  ) {
    return existingToken;
  }

  // Generate new token
  const newToken = generateCsrfToken();
  const hash = hashToken(newToken);

  // Store token in readable cookie and hash in httpOnly cookie
  // Both cookies ensure the token persists across page loads and tabs
  res.setHeader("Set-Cookie", [
    `csrf-token=${newToken}; Path=/; SameSite=Strict; Max-Age=86400`,
    `csrf-token-hash=${hash}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
  ]);

  // Return token to be included in responses
  return newToken;
}

/**
 * Validates CSRF token from request
 * @param {object} req - Request object
 * @returns {boolean} - True if valid
 */
export function validateCsrfFromRequest(req) {
  // Get token from header or body
  const token =
    req.headers["x-csrf-token"] || req.body?.csrfToken || req.query?.csrfToken;

  // Get stored hash from cookie
  const storedHash = req.cookies?.["csrf-token-hash"];

  return validateCsrfToken(token, storedHash);
}

/**
 * Middleware to validate CSRF on state-changing methods
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - Next function
 * @returns {boolean} - True if validation passes
 */
export function csrfProtection(req, res) {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return true;
  }

  // The app authenticates with a Bearer token, not a cookie, and has no CSRF
  // cookie to echo back. CSRF is an attack on ambient (cookie) credentials: a
  // cross-site page cannot attach an Authorization header without a CORS
  // preflight, which this API never grants. So a request carrying a *valid*
  // Bearer token is not forgeable and needs no token — an invalid or missing
  // one still goes through the normal check below.
  if (req.headers?.authorization) {
    try {
      verifyBearerToken(req.headers.authorization);
      return true;
    } catch {
      // Fall through to the cookie-based check.
    }
  }

  // Validate CSRF token
  if (!validateCsrfFromRequest(req)) {
    res.status(403).json({
      error: "CSRF validation failed",
      message: "Invalid or missing CSRF token",
    });
    return false;
  }

  return true;
}
