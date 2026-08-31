import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getItem, setItem, deleteItem, STORAGE_PHONE } from "./storage";
import { BASE_URL, getAccessToken, setTokens, clearTokens } from "./api";
import { clearQuestionsCache } from "./questions-cache";

const USER_KEY = "auth_user";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

/**
 * What this viewer may do. Mirrors apps/web/lib/viewer.ts — the server is
 * authoritative and this is only what the UI renders from.
 *
 *   anonymous     no account; the whole app is still readable
 *   needs_bankid  legacy email account, BankID not linked yet → the link gate
 *   restricted    BankID-verified but not eligible to vote in Vallentuna
 *   participant   may vote, comment, rate and propose
 */
export type Capability =
  "anonymous" | "needs_bankid" | "restricted" | "participant";

interface AuthContextValue {
  user: AuthUser | null;
  capability: Capability;
  /** Swedish, ready to show. Empty for a participant. */
  capabilityMessage: string;
  isLoading: boolean;
  /** True once the account is `participant` — the only state that may act. */
  canAct: boolean;
  signInWithTokens: (
    accessToken: string,
    refreshToken: string,
    user: AuthUser,
  ) => Promise<void>;
  /** Re-reads capability from the server. Call after linking or verifying. */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [capability, setCapability] = useState<Capability>("anonymous");
  const [capabilityMessage, setCapabilityMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Reads the account's current state from the server.
   *
   * **Never from the stored user or the token.** Capability changes the moment
   * someone links BankID or their folkbokföring is re-read, and an access token
   * lives seven days — so a value cached in either would be stale in exactly the
   * situations that matter.
   */
  const refresh = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/mobile/user/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();

      setCapability(data.capability ?? "anonymous");
      setCapabilityMessage(data.message ?? "");

      if (data.user) {
        const fresh: AuthUser = {
          id: data.user.id,
          email: data.user.email ?? null,
          name: data.user.name,
          isAdmin: !!data.user.isAdmin,
          isSuperAdmin: !!data.user.isSuperAdmin,
        };
        setUser(fresh);
        await setItem(USER_KEY, JSON.stringify(fresh));
      } else {
        setUser(null);
      }
    } catch {
      // Offline. Keep whatever was restored from storage — the app is readable
      // either way, and every action is refused server-side regardless.
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Paint from storage first so a cold start does not flash the
        // signed-out state, then let the server correct it.
        const stored = await getItem(USER_KEY);
        if (stored) setUser(JSON.parse(stored));
      } catch {
        /* treat as signed out */
      }
      await refresh();
      setIsLoading(false);
    })();
  }, [refresh]);

  const signInWithTokens = useCallback(
    async (accessToken: string, refreshToken: string, nextUser: AuthUser) => {
      await setTokens(accessToken, refreshToken);
      await setItem(USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      // The login response carries a capability, but read it back from the
      // server anyway: one source of truth beats two that can disagree.
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await clearTokens();
    await deleteItem(USER_KEY);
    // The questions cache holds the previous user's votes and quota — the next
    // account to sign in on this device must not render off it.
    clearQuestionsCache();
    // The phone number is mirrored on the device for the settings form. It
    // belongs to the account, not the handset, so leaving it behind would show
    // the next person the previous one's number.
    await deleteItem(STORAGE_PHONE);
    setUser(null);
    setCapability("anonymous");
    setCapabilityMessage("");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        capability,
        capabilityMessage,
        isLoading,
        canAct: capability === "participant",
        signInWithTokens,
        refresh,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
