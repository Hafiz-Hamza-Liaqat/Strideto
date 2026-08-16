import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
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
import {
  clearActiveWorkspacePreferenceIfRealm,
  writeActiveWorkspacePreference,
} from '../auth/activeWorkspace';
import {
  bindTabIdentity,
  clearTabIdentity,
  compareTabIdentity,
  readTabIdentity,
} from '../auth/tabIdentity';

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
  const [identityConflict, setIdentityConflict] = useState(null);
  const authEpoch = useRef(0);

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
    setIdentityConflict(null);
  }, []);

  const acceptUserSubject = useCallback((nextUser) => {
    const subjectId = nextUser?._id || nextUser?.id;
    if (!subjectId) {
      persistUser(null);
      return false;
    }
    const verdict = compareTabIdentity('user', subjectId);
    if (verdict === 'mismatch') {
      const expected = readTabIdentity('user');
      persistUser(null);
      setIdentityConflict({
        realm: 'user',
        expectedSubjectId: expected?.subjectId || null,
        actualSubjectId: String(subjectId),
        pendingRecord: nextUser,
      });
      return false;
    }
    bindTabIdentity('user', subjectId);
    persistUser(nextUser);
    setIdentityConflict(null);
    return true;
  }, [persistUser]);

  const bindLocalUser = useCallback((nextUser, extra = {}) => {
    authEpoch.current += 1;
    const subjectId = nextUser?._id || nextUser?.id;
    if (subjectId) bindTabIdentity('user', subjectId);
    persistUser({ ...nextUser, ...extra });
    setIdentityConflict(null);
  }, [persistUser]);

  const login = useCallback(
    async (email, password) => {
      setError(null);
      resetAxiosAuthState();
      const { data } = await authApi.login({ email, password });
      setAccessToken(data.accessToken);
      bindLocalUser(data.user, { mustChangePassword: !!data.mustChangePassword });
      writeActiveWorkspacePreference('student');
      return { user: data.user, mustChangePassword: !!data.mustChangePassword };
    },
    [bindLocalUser]
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
      bindLocalUser(data.user);
      writeActiveWorkspacePreference('student');
      return { user: data.user, requiresVerification: false };
    },
    [bindLocalUser]
  );

  const logout = useCallback(async () => {
    authEpoch.current += 1;
    try {
      if (getAccessToken()) {
        await authApi.logout();
      }
    } catch {
      // ignore
    }
    clearTabIdentity('user');
    clearAuth();
    clearActiveWorkspacePreferenceIfRealm('student');
  }, [clearAuth]);

  const logoutAll = useCallback(async () => {
    authEpoch.current += 1;
    try {
      await authApi.logoutAll();
    } finally {
      clearTabIdentity('user');
      clearAuth();
      clearActiveWorkspacePreferenceIfRealm('student');
    }
  }, [clearAuth]);

  const continueAsCurrentSession = useCallback(() => {
    setIdentityConflict((current) => {
      const pending = current?.pendingRecord;
      if (pending) bindLocalUser(pending);
      return null;
    });
  }, [bindLocalUser]);

  const signInAgainFromConflict = useCallback(async () => {
    await logout();
  }, [logout]);

  /** Silent refresh via the HttpOnly cookie — never reads/writes a stored refresh token. */
  const refreshToken = useCallback(async ({ clearOnFailure = true } = {}) => {
    try {
      const { data } = await authApi.refreshToken();
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      if (clearOnFailure) clearAuth();
      return null;
    }
  }, [clearAuth]);

  useEffect(() => {
    return onSessionExpired((realm) => {
      if (realm === 'user') {
        clearTabIdentity('user');
        clearAuth();
      }
    });
  }, [clearAuth]);

  const userRealmActive = !shouldSkipUserAuthBootstrap(pathname);

  useEffect(() => {
    if (!userRealmActive) {
      setLoading(false);
      return undefined;
    }

    const epoch = authEpoch.current;
    const alreadyHydrated = !!getAccessToken();
    if (!alreadyHydrated) setLoading(true);
    let cancelled = false;

    // Realm-boundary bootstrap only (not every pathname). Quiet refresh when
    // already hydrated so in-app navigation never unmounts the shell.
    refreshToken({ clearOnFailure: false })
      .then((token) => {
        if (cancelled || epoch !== authEpoch.current) return null;
        if (!token) {
          if (getAccessToken()) {
            return authApi.me();
          }
          clearAuth();
          persistUser(null);
          return null;
        }
        return authApi.me();
      })
      .then((res) => {
        if (cancelled || epoch !== authEpoch.current || !res) return;
        acceptUserSubject(res.data.user);
      })
      .catch(() => {
        if (!cancelled && epoch === authEpoch.current) clearAuth();
      })
      .finally(() => {
        if (!cancelled && epoch === authEpoch.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRealmActive]);

  useEffect(() => {
    if (!userRealmActive) return undefined;
    const refreshQuietly = () => {
      if (document.hidden) return;
      refreshToken({ clearOnFailure: false }).then(async (token) => {
        if (!token && !getAccessToken()) return;
        try {
          const res = await authApi.me();
          if (res?.data?.user) acceptUserSubject(res.data.user);
        } catch {
          /* interceptor / session-expired handler owns terminal failure */
        }
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshQuietly();
    };
    const onPageShow = (event) => {
      if (event.persisted) refreshQuietly();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refreshQuietly);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refreshQuietly);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [userRealmActive, refreshToken, acceptUserSubject]);

  const value = {
    user,
    loading,
    error,
    setError,
    isAuthenticated: !!user && !!getAccessToken(),
    isAdmin: user?.role === 'Admin',
    identityConflict,
    login,
    register,
    logout,
    logoutAll,
    refreshToken,
    updateUser: persistUser,
    continueAsCurrentSession,
    signInAgainFromConflict,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
