import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { API_BASE_URL } from "../config/env";

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

type LoginPayload = {
  email: string;
  password: string;
};

type SignupPayload = {
  name: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
};

const TOKEN_STORAGE_KEY = "greenfn_access_token";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let originalFetchRef: typeof window.fetch | null = null;
let patched = false;
let tokenProvider: () => string | null = () => null;

function ensureAuthFetchPatched() {
  if (patched || typeof window === "undefined") {
    return;
  }

  originalFetchRef = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const resolvedUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const shouldAttachAuth = resolvedUrl.startsWith(API_BASE_URL);
    const token = tokenProvider();

    if (!shouldAttachAuth || !token) {
      return originalFetchRef!(input, init);
    }

    const headers = new Headers(init?.headers);

    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return originalFetchRef!(input, {
      ...init,
      headers,
    });
  };

  patched = true;
}

function readStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

function persistToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!token) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function buildAuthErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const parsedPayload = payload as {
    message?: string;
    error?: {
      message?: string;
      details?: Array<{ field?: string; message?: string }>;
    };
  };

  const baseMessage =
    parsedPayload.message || parsedPayload.error?.message || fallback;
  const details = Array.isArray(parsedPayload.error?.details)
    ? parsedPayload.error.details
        .map((detail) => {
          const field = String(detail?.field || "").trim();
          const message = String(detail?.message || "").trim();
          if (!message) return "";
          return field ? `${field}: ${message}` : message;
        })
        .filter(Boolean)
    : [];

  if (details.length === 0) {
    return baseMessage;
  }

  return `${baseMessage}. ${details.join("; ")}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(readStoredToken());

  useEffect(() => {
    tokenProvider = () => tokenRef.current;
    ensureAuthFetchPatched();
  }, []);

  const setToken = useCallback((token: string | null) => {
    tokenRef.current = token;
    persistToken(token);
  }, []);

  const bootstrapSession = useCallback(async () => {
    const currentToken = tokenRef.current;

    if (!currentToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`);

      if (!response.ok) {
        setToken(null);
        setUser(null);
        setLoading(false);
        return;
      }

      const payload = await response.json();
      setUser(payload.user ?? null);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setToken]);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  const login = useCallback(
    async ({ email, password }: LoginPayload) => {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(buildAuthErrorMessage(payload, "Login failed"));
      }

      setToken(payload.accessToken);
      setUser(payload.user ?? null);
    },
    [setToken],
  );

  const signup = useCallback(
    async ({ name, email, password }: SignupPayload) => {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(buildAuthErrorMessage(payload, "Signup failed"));
      }

      setToken(payload.accessToken);
      setUser(payload.user ?? null);
    },
    [setToken],
  );

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST" });
    } catch {
      // Ignore network errors during logout; token is cleared locally.
    }

    setToken(null);
    setUser(null);
  }, [setToken]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      signup,
      logout,
    }),
    [user, loading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
