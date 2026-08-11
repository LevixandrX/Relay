import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, claimPairing, startPairing, type OAuthProvider } from "./api";
import { openExternal } from "./open-external";

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

export type OAuthFlow = {
  provider: OAuthProvider;
  /** `opening` — asking the server for a handshake, `waiting` — browser is open. */
  stage: "opening" | "waiting";
  url?: string;
};

type AuthContextValue = {
  token: string | null;
  user: CloudUser | null;
  workspaces: CloudWorkspace[];
  subscription: CloudSubscription | null;
  loading: boolean;
  oauthFlow: OAuthFlow | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string }) => Promise<void>;
  logout: () => Promise<void>;
  setToken: (token: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  /** Resolves `true` when a token arrived, `false` if the user cancelled. */
  signInWithProvider: (provider: OAuthProvider) => Promise<boolean>;
  cancelOAuth: () => void;
};

const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/** Tight polling while the user is likely still clicking, then relaxed. */
function pollDelay(elapsedMs: number) {
  if (elapsedMs < 30_000) return 1200;
  if (elapsedMs < 90_000) return 2500;
  return 5000;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const [oauthFlow, setOauthFlow] = useState<OAuthFlow | null>(null);

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

  const cancelRef = useRef(false);

  const cancelOAuth = useCallback(() => {
    cancelRef.current = true;
    setOauthFlow(null);
  }, []);

  const signInWithProvider = useCallback(
    async (provider: OAuthProvider) => {
      cancelRef.current = false;
      setOauthFlow({ provider, stage: "opening" });
      try {
        const { code, claimSecret, url } = await startPairing(provider);
        await openExternal(url);
        setOauthFlow({ provider, stage: "waiting", url });

        const startedAt = Date.now();
        while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
          if (cancelRef.current) return false;
          await sleep(pollDelay(Date.now() - startedAt));
          if (cancelRef.current) return false;

          const res = await claimPairing(code, claimSecret).catch(() => null);
          if (!res) continue;
          if (res.status === "ready") {
            await setToken(res.accessToken);
            setOauthFlow(null);
            return true;
          }
          if (res.status === "error") throw new Error(res.message);
          if (res.status === "expired") {
            throw new Error("Время ожидания истекло — попробуй ещё раз");
          }
        }
        throw new Error("Ждали 5 минут и остановились — нажми кнопку входа ещё раз");
      } catch (err) {
        setOauthFlow(null);
        throw err;
      }
    },
    [setToken],
  );

  const value = useMemo(
    () => ({
      token,
      user,
      workspaces,
      subscription,
      loading,
      oauthFlow,
      login,
      register,
      logout,
      setToken,
      refreshMe,
      signInWithProvider,
      cancelOAuth,
    }),
    [
      token,
      user,
      workspaces,
      subscription,
      loading,
      oauthFlow,
      login,
      register,
      logout,
      setToken,
      refreshMe,
      signInWithProvider,
      cancelOAuth,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
