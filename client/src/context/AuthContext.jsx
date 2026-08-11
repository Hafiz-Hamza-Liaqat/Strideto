import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useLocation } from 'react-router-dom';
import { authApi } from '../services/authService';
import {
  resetAxiosAuthState,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
} from '../services/axiosBase';
import { resetPermissionsCache } from '../hooks/usePermissions';
import { shouldSkipUserAuthBootstrap } from '../auth/authRealm';
import { onSessionExpired } from '../auth/sessionExpired';

/**
 * SEC-3E — the access token lives in `axiosBase.js`'s in-memory store
 * only; this context never writes a token to `localStorage`. `edurozgaar-user`
 * remains a non-authoritative UI cache (avoids a name/avatar flash before
 * bootstrap resolves) — it is never treated as proof of authentication;
 * `isAuthenticated` reflects only the in-memory access-token + bootstrap
 * state below.
 */
const STORAGE_USER = 'edurozgaar-user';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const { pathname } = useLocation();
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const persistUser = useCallback((u) => {
    setUser(u);
    if (u) localStorage.setItem(STORAGE_USER, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_USER);
  }, []);

  const clearAuth = useCallback(() => {
    resetAxiosAuthState();
    resetPermissionsCache();
    clearAccessToken();
    localStorage.removeItem(STORAGE_USER);
    setUser(null);
  }, []);

  const login = useCallback(
    async (email, password) => {
      setError(null);
      resetAxiosAuthState();
      const { data } = await authApi.login({ email, password });
      setAccessToken(data.accessToken);
      persistUser({
        ...data.user,
        mustChangePassword: !!data.mustChangePassword,
      });
      return { user: data.user, mustChangePassword: !!data.mustChangePassword };
    },
    [persistUser]
  );

  const register = useCallback(
    async (payload) => {
      setError(null);
      const { data } = await authApi.register(payload);
      if (data.requiresVerification || !data.accessToken) {
        return {
          user: data.user || null,
          requiresVerification: true,
          message: data.message,
          emailQueued: data.emailQueued,
          emailMode: data.emailMode,
          expiresInMinutes: data.expiresInMinutes,
        };
      }
      setAccessToken(data.accessToken);
      persistUser(data.user);
      return { user: data.user, requiresVerification: false };
    },
    [persistUser]
  );

  const logout = useCallback(async () => {
    try {
      if (getAccessToken()) {
        await authApi.logout();
      }
    } catch {
      // ignore
    }
    clearAuth();
  }, [clearAuth]);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  /** Silent refresh via the HttpOnly cookie — never reads/writes a stored refresh token. */
  const refreshToken = useCallback(async () => {
    try {
      const { data } = await authApi.refreshToken();
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      clearAuth();
      return null;
    }
  }, [clearAuth]);

  useEffect(() => {
    return onSessionExpired((realm) => {
      if (realm === 'user') clearAuth();
    });
  }, [clearAuth]);

  useEffect(() => {
    if (shouldSkipUserAuthBootstrap(pathname)) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let cancelled = false;

    // Secure bootstrap: attempt a silent cookie-based refresh first (the
    // page reload starts with no in-memory access token by construction),
    // then hydrate the profile via /auth/me only on success.
    refreshToken()
      .then((token) => {
        if (cancelled) return null;
        if (!token) {
          persistUser(null);
          return null;
        }
        return authApi.me();
      })
      .then((res) => {
        if (!cancelled && res) persistUser(res.data.user);
      })
      .catch(() => {
        if (!cancelled) clearAuth();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const value = {
    user,
    loading,
    error,
    setError,
    isAuthenticated: !!user && !!getAccessToken(),
    isAdmin: user?.role === 'Admin',
    login,
    register,
    logout,
    logoutAll,
    refreshToken,
    updateUser: persistUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
