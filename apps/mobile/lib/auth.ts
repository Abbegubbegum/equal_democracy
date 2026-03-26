import { api, setToken, clearToken, getToken } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  municipality?: string;
}

// Step 1: Request a login code sent to the user's email.
// Reuses the existing /api/auth/request-code endpoint.
export async function requestLoginCode(email: string): Promise<void> {
  await api.post("/api/auth/request-code", { email });
}

// Step 2: Verify the code and receive a mobile session token.
// NOTE: This requires a new API route /api/auth/mobile-verify to be created
// in the web app. See apps/web/pages/api/auth/mobile-verify.ts.
export async function verifyLoginCode(
  email: string,
  code: string
): Promise<AuthUser> {
  const { token, user } = await api.post<{ token: string; user: AuthUser }>(
    "/api/auth/mobile-verify",
    { email, code }
  );
  await setToken(token);
  return user;
}

export async function signOut(): Promise<void> {
  await clearToken();
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}
