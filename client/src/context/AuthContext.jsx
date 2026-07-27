import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { authApi } from '../services/authService';
import { resetAxiosAuthState } from '../services/axiosBase';
import { resetPermissionsCache } from '../hooks/usePermissions';
import { shouldSkipUserAuthBootstrap } from '../auth/authRealm';

const STORAGE_TOKEN = 'edurozgaar-token';
const STORAGE_REFRESH = 'edurozgaar-refresh-token';
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

  const setTokens = useCallback((accessToken, refreshToken) => {
    if (accessToken) localStorage.setItem(STORAGE_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(STORAGE_REFRESH, refreshToken);
  }, []);

  const clearAuth = useCallback(() => {
    resetAxiosAuthState();
    resetPermissionsCache();
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_REFRESH);
    localStorage.removeItem(STORAGE_USER);
    setUser(null);
  }, []);

  const login = useCallback(
    async (email, password) => {
      setError(null);
      resetAxiosAuthState();
      const { data } = await authApi.login({ email, password });
      setTokens(data.accessToken, data.refreshToken);
      persistUser({ ...data.user, mustChangePassword: !!data.mustChangePassword });
      return { user: data.user, mustChangePassword: !!data.mustChangePassword };
    },
    [persistUser, setTokens]
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
      setTokens(data.accessToken, data.refreshToken);
      persistUser(data.user);
      return { user: data.user, requiresVerification: false };
    },
    [persistUser, setTokens]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    clearAuth();
  }, [clearAuth]);

  const refreshToken = useCallback(async () => {
    const refresh = localStorage.getItem(STORAGE_REFRESH);
    if (!refresh) return null;
    try {
      const { data } = await authApi.refreshToken(refresh);
      setTokens(data.accessToken, data.refreshToken);
      persistUser(data.user);
      return data.accessToken;
    } catch {
      clearAuth();
      return null;
    }
  }, [clearAuth, persistUser, setTokens]);

  useEffect(() => {
    if (shouldSkipUserAuthBootstrap(pathname)) {
      setLoading(false);
      return undefined;
    }

    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    let cancelled = false;
    authApi
      .me()
      .then(({ data }) => {
        if (!cancelled) persistUser(data.user);
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
  }, [pathname, clearAuth, persistUser]);

  const value = {
    user,
    loading,
    error,
    setError,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'Admin',
    login,
    register,
    logout,
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
