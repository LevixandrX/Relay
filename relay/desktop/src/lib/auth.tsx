import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, oauthUrl } from "./api";

const TOKEN_KEY = "relay-desktop-token-v1";

export type CloudUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
};

export type CloudWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export type CloudSubscription = {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  isPro: boolean;
  limits: {
    workspaces: number;
    pagesPerWorkspace: number;
    membersPerWorkspace: number;
    publishPages: number;
  };
};

type AuthContextValue = {
  token: string | null;
  user: CloudUser | null;
  workspaces: CloudWorkspace[];
  subscription: CloudSubscription | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string }) => Promise<void>;
  logout: () => Promise<void>;
  setToken: (token: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  openOAuth: (provider: "google" | "github") => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadMe(token: string) {
  return api<{
    user: CloudUser;
    workspaces: CloudWorkspace[];
    subscription: CloudSubscription;
  }>("/auth/me", { token });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<CloudUser | null>(null);
  const [workspaces, setWorkspaces] = useState<CloudWorkspace[]>([]);
  const [subscription, setSubscription] = useState<CloudSubscription | null>(null);
  const [loading, setLoading] = useState(!!token);

  const applyMe = useCallback(async (t: string) => {
    const me = await loadMe(t);
    setUser(me.user);
    setWorkspaces(me.workspaces);
    setSubscription(me.subscription);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    await applyMe(token);
  }, [token, applyMe]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setWorkspaces([]);
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    applyMe(token)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setTokenState(null);
      })
      .finally(() => setLoading(false));
  }, [token, applyMe]);

  // Dev / deep-link fallback: ?token= on URL
  useEffect(() => {
    const u = new URL(window.location.href);
    const t = u.searchParams.get("token");
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
      setTokenState(t);
      u.searchParams.delete("token");
      window.history.replaceState({}, "", u.pathname);
    }
  }, []);

  const setToken = useCallback(async (t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setTokenState(t);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ accessToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await setToken(res.accessToken);
  }, [setToken]);

  const register = useCallback(
    async (input: { email: string; password: string; name: string }) => {
      const res = await api<{ accessToken: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await setToken(res.accessToken);
    },
    [setToken],
  );

  const logout = useCallback(async () => {
    try {
      if (token) await api("/auth/logout", { method: "POST", token });
    } catch {
      // ignore
    }
    localStorage.removeItem(TOKEN_KEY);
    setTokenState(null);
  }, [token]);

  const openOAuth = useCallback((provider: "google" | "github") => {
    window.open(oauthUrl(provider), "_blank", "noopener,noreferrer");
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      workspaces,
      subscription,
      loading,
      login,
      register,
      logout,
      setToken,
      refreshMe,
      openOAuth,
    }),
    [
      token,
      user,
      workspaces,
      subscription,
      loading,
      login,
      register,
      logout,
      setToken,
      refreshMe,
      openOAuth,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
