import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  employerAuthApi,
  resetEmployerAxiosAuthState,
  getEmployerAccessToken,
  setEmployerAccessToken,
  clearEmployerAccessToken,
} from '../services/employerService';
import { isEmployerRoutePrefix } from '../auth/authRealm';
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
 * SEC-3E — mirrors `AuthContext.jsx`'s secure contract: the Employer
 * access token lives only in `employerService.js`'s in-memory store;
 * `edurozgaar-employer` remains a non-authoritative UI cache only.
 */
const STORAGE_EMPLOYER = 'edurozgaar-employer';

const EmployerAuthContext = createContext(null);

function readStoredEmployer() {
  try {
    const raw = localStorage.getItem(STORAGE_EMPLOYER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearEmployerSessionLocal() {
  clearEmployerAccessToken();
  localStorage.removeItem(STORAGE_EMPLOYER);
  resetEmployerAxiosAuthState();
}

export function EmployerAuthProvider({ children }) {
  const { pathname } = useLocation();
  const [employer, setEmployer] = useState(readStoredEmployer);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [identityConflict, setIdentityConflict] = useState(null);
  const authEpoch = useRef(0);

  const persistEmployer = useCallback((e) => {
    setEmployer(e);
    if (e) localStorage.setItem(STORAGE_EMPLOYER, JSON.stringify(e));
    else localStorage.removeItem(STORAGE_EMPLOYER);
  }, []);

  const bindLocalEmployer = useCallback((next) => {
    authEpoch.current += 1;
    const subjectId = next?._id || next?.id;
    if (subjectId) bindTabIdentity('employer', subjectId);
    persistEmployer(next);
    setIdentityConflict(null);
  }, [persistEmployer]);

  const acceptEmployerSubject = useCallback((next) => {
    const subjectId = next?._id || next?.id;
    if (!subjectId) {
      persistEmployer(null);
      return null;
    }
    if (compareTabIdentity('employer', subjectId) === 'mismatch') {
      const expected = readTabIdentity('employer');
      persistEmployer(null);
      setIdentityConflict({
        realm: 'employer',
        expectedSubjectId: expected?.subjectId || null,
        actualSubjectId: String(subjectId),
        pendingRecord: next,
      });
      return null;
    }
    bindTabIdentity('employer', subjectId);
    persistEmployer(next);
    setIdentityConflict(null);
    return next;
  }, [persistEmployer]);

  const login = useCallback(
    async (email, password) => {
      setError(null);
      const { data } = await employerAuthApi.login(email, password);
      setEmployerAccessToken(data.accessToken);
      const me = await employerAuthApi.me();
      bindLocalEmployer(me.data.employer);
      writeActiveWorkspacePreference('employer');
      return me.data.employer;
    },
    [bindLocalEmployer]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await employerAuthApi.register(payload);
      if (data.requiresVerification || !data.accessToken) {
        return {
          requiresVerification: true,
          message: data.message,
          emailMode: data.emailMode,
        };
      }
      setEmployerAccessToken(data.accessToken);
      const me = await employerAuthApi.me();
      bindLocalEmployer(me.data.employer);
      writeActiveWorkspacePreference('employer');
      return me.data.employer;
    },
    [bindLocalEmployer]
  );

  const refreshEmployer = useCallback(async () => {
    const { data } = await employerAuthApi.me();
    return acceptEmployerSubject(data.employer);
  }, [acceptEmployerSubject]);

  const ensureSession = useCallback(async () => {
    if (getEmployerAccessToken() && employer) return employer;
    try {
      const { data } = await employerAuthApi.refresh();
      setEmployerAccessToken(data.accessToken);
      const me = await employerAuthApi.me();
      return acceptEmployerSubject(me.data.employer);
    } catch {
      if (getEmployerAccessToken() && employer) return employer;
      clearEmployerSessionLocal();
      persistEmployer(null);
      return null;
    }
  }, [employer, persistEmployer, acceptEmployerSubject]);

  const refreshQuietly = useCallback(() => {
    if (document.hidden) return;
    employerAuthApi.refresh().then(async ({ data }) => {
      if (data?.accessToken) setEmployerAccessToken(data.accessToken);
      const me = await employerAuthApi.me();
      acceptEmployerSubject(me.data.employer);
    }).catch(() => {});
  }, [acceptEmployerSubject]);

  const logout = useCallback(async () => {
    authEpoch.current += 1;
    try {
      if (getEmployerAccessToken()) {
        await employerAuthApi.logout();
      }
    } catch {
      /* local clear still required */
    }
    clearTabIdentity('employer');
    clearEmployerSessionLocal();
    persistEmployer(null);
    setIdentityConflict(null);
    clearActiveWorkspacePreferenceIfRealm('employer');
  }, [persistEmployer]);

  const logoutAll = useCallback(async () => {
    authEpoch.current += 1;
    try {
      await employerAuthApi.logoutAll();
    } finally {
      clearTabIdentity('employer');
      clearEmployerSessionLocal();
      persistEmployer(null);
      setIdentityConflict(null);
      clearActiveWorkspacePreferenceIfRealm('employer');
    }
  }, [persistEmployer]);

  const continueAsCurrentSession = useCallback(() => {
    setIdentityConflict((current) => {
      if (current?.pendingRecord) bindLocalEmployer(current.pendingRecord);
      return null;
    });
  }, [bindLocalEmployer]);

  const signInAgainFromConflict = useCallback(async () => {
    await logout();
  }, [logout]);

  const employerRouteActive = isEmployerRoutePrefix(pathname);

  useEffect(() => {
    if (!employerRouteActive) {
      setLoading(false);
      return undefined;
    }

    const epoch = authEpoch.current;
    let cancelled = false;
    const alreadyHydrated = !!getEmployerAccessToken();
    if (!alreadyHydrated) setLoading(true);

    employerAuthApi
      .refresh()
      .then(({ data }) => {
        if (cancelled || epoch !== authEpoch.current) return null;
        setEmployerAccessToken(data.accessToken);
        return employerAuthApi.me();
      })
      .then((res) => {
        if (!cancelled && epoch === authEpoch.current && res) acceptEmployerSubject(res.data.employer);
      })
      .catch(() => {
        if (!cancelled && epoch === authEpoch.current) {
          if (getEmployerAccessToken()) {
            return employerAuthApi.me().then((res) => acceptEmployerSubject(res.data.employer)).catch(() => {
              clearEmployerSessionLocal();
              persistEmployer(null);
            });
          }
          clearEmployerSessionLocal();
          persistEmployer(null);
        }
        return null;
      })
      .finally(() => {
        if (!cancelled && epoch === authEpoch.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employerRouteActive]);

  useEffect(() => {
    if (!employerRouteActive) return undefined;
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
  }, [employerRouteActive, refreshQuietly]);

  const value = {
    employer,
    loading,
    error,
    setError,
    isAuthenticated: !!employer && !!getEmployerAccessToken(),
    identityConflict,
    login,
    register,
    logout,
    logoutAll,
    refreshEmployer,
    ensureSession,
    refreshQuietly,
    continueAsCurrentSession,
    signInAgainFromConflict,
  };

  return (
    <EmployerAuthContext.Provider value={value}>
      {children}
    </EmployerAuthContext.Provider>
  );
}

export function useEmployerAuth() {
  const ctx = useContext(EmployerAuthContext);
  if (!ctx)
    throw new Error('useEmployerAuth must be used within EmployerAuthProvider');
  return ctx;
}
