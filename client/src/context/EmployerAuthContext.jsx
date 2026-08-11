import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
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

  const persistEmployer = useCallback((e) => {
    setEmployer(e);
    if (e) localStorage.setItem(STORAGE_EMPLOYER, JSON.stringify(e));
    else localStorage.removeItem(STORAGE_EMPLOYER);
  }, []);

  const login = useCallback(
    async (email, password) => {
      setError(null);
      const { data } = await employerAuthApi.login(email, password);
      setEmployerAccessToken(data.accessToken);
      const me = await employerAuthApi.me();
      persistEmployer(me.data.employer);
      return me.data.employer;
    },
    [persistEmployer]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await employerAuthApi.register(payload);
      setEmployerAccessToken(data.accessToken);
      const me = await employerAuthApi.me();
      persistEmployer(me.data.employer);
      return me.data.employer;
    },
    [persistEmployer]
  );

  const refreshEmployer = useCallback(async () => {
    const { data } = await employerAuthApi.me();
    persistEmployer(data.employer);
    return data.employer;
  }, [persistEmployer]);

  const logout = useCallback(async () => {
    try {
      if (getEmployerAccessToken()) {
        await employerAuthApi.logout();
      }
    } catch {
      /* local clear still required */
    }
    clearEmployerSessionLocal();
    persistEmployer(null);
  }, [persistEmployer]);

  const logoutAll = useCallback(async () => {
    try {
      await employerAuthApi.logoutAll();
    } finally {
      clearEmployerSessionLocal();
      persistEmployer(null);
    }
  }, [persistEmployer]);

  useEffect(() => {
    // Never attempt an employer cookie refresh from a User-only page —
    // mirrors AuthContext.jsx's reciprocal `shouldSkipUserAuthBootstrap`
    // guard so neither realm's bootstrap ever touches the other's route.
    if (!isEmployerRoutePrefix(pathname)) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    // Secure bootstrap: attempt a silent cookie-based refresh first, then
    // hydrate the profile only on success — never trusts a stored token.
    employerAuthApi
      .refresh()
      .then(({ data }) => {
        if (cancelled) return null;
        setEmployerAccessToken(data.accessToken);
        return employerAuthApi.me();
      })
      .then((res) => {
        if (!cancelled && res) persistEmployer(res.data.employer);
      })
      .catch(() => {
        if (!cancelled) {
          clearEmployerSessionLocal();
          persistEmployer(null);
        }
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
    employer,
    loading,
    error,
    setError,
    isAuthenticated: !!employer && !!getEmployerAccessToken(),
    login,
    register,
    logout,
    logoutAll,
    refreshEmployer,
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
