import { getItem, setItem, deleteItem } from "./storage";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

// ── Token storage ────────────────────────────────────────────────────────────

export async function getAccessToken(): Promise<string | null> {
  return getItem(ACCESS_TOKEN_KEY);
}

export async function setTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await setItem(ACCESS_TOKEN_KEY, accessToken);
  await setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await deleteItem(ACCESS_TOKEN_KEY);
  await deleteItem(REFRESH_TOKEN_KEY);
}

// ── Token refresh ────────────────────────────────────────────────────────────

async function attemptRefresh(): Promise<string | null> {
  const refreshToken = await getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const res = await fetch(`${BASE_URL}/api/mobile/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    await clearTokens();
    return null;
  }

  const data = await res.json();
  await setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

// ── API client ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /**
     * The parsed response body.
     *
     * Some failures are structured rather than fatal — a 409 from
     * /api/mobile/user/email carries `code: "MERGE_AVAILABLE"`, which the caller
     * turns into an offer rather than an error message. Losing the body would
     * mean re-requesting to find out what kind of "no" it was.
     */
    public body: Record<string, any> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiClient<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // Attempt token refresh on 401 then retry once
  if (res.status === 401 && token) {
    const newToken = await attemptRefresh();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Routes are split between `message` and `error` for the human-readable
    // string — the /user/* ones use `error`, most others use `message`. Reading
    // only one of them threw away real Swedish copy ("Ogiltigt telefonnummer",
    // "Den e-postadressen används redan") and showed "Request failed: 409"
    // instead.
    throw new ApiError(
      res.status,
      body.message ?? body.error ?? `Request failed: ${res.status}`,
      body,
    );
  }

  return res.json() as Promise<T>;
}
