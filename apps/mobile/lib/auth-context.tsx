import React, { createContext, useContext, useEffect, useState } from "react";
import { getItem, setItem, deleteItem } from "./storage";
import { BASE_URL, setTokens, clearTokens } from "./api";

const USER_KEY = "auth_user";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  requestCode: (email: string) => Promise<void>;
  login: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const stored = await getItem(USER_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // Ignore — treat as logged out
    } finally {
      setIsLoading(false);
    }
  }

  async function requestCode(email: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/auth/request-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? "Failed to send code");
    }
  }

  async function login(email: string, code: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/mobile/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? "Login failed");
    }

    const data: {
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    } = await res.json();

    await setTokens(data.accessToken, data.refreshToken);
    await setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
  }

  async function logout(): Promise<void> {
    await clearTokens();
    await deleteItem(USER_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, requestCode, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
