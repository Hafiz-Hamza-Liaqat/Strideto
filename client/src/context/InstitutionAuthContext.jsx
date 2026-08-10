import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isInstitutionRoutePrefix } from '../auth/institutionAuthRealm';
import {
  clearInstitutionAccessToken,
  getInstitutionAccessToken,
  institutionAuthApi,
  resetInstitutionAuthState,
  setInstitutionAccessToken,
} from '../services/institutionPortalService';

const STORAGE_KEY = 'strideto-institution';
const InstitutionAuthContext = createContext(null);

function readStoredSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { return null; }
}

function clearLocalSession() {
  clearInstitutionAccessToken();
  resetInstitutionAuthState();
  localStorage.removeItem(STORAGE_KEY);
}

export function InstitutionAuthProvider({ children }) {
  const { pathname } = useLocation();
  const institutionRouteActive = isInstitutionRoutePrefix(pathname);
  const [session, setSession] = useState(readStoredSession);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const persist = useCallback((next) => {
    setSession(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadMe = useCallback(async () => {
    const { data } = await institutionAuthApi.me();
    const next = { account: data.account, memberships: data.memberships || [] };
    persist(next);
    return next;
  }, [persist]);

  const login = useCallback(async (email, password) => {
    setError('');
    const { data } = await institutionAuthApi.login(email, password);
    setInstitutionAccessToken(data.accessToken);
    return loadMe();
  }, [loadMe]);

  const logout = useCallback(async () => {
    try {
      if (getInstitutionAccessToken()) await institutionAuthApi.logout();
    } catch { /* best-effort cookie cleanup */ }
    finally {
      clearLocalSession();
      setSession(null);
    }
  }, []);

  useEffect(() => {
    if (!institutionRouteActive) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (!getInstitutionAccessToken()) {
          const { data } = await institutionAuthApi.refresh();
          setInstitutionAccessToken(data.accessToken);
        }
        await loadMe();
      } catch {
        clearLocalSession();
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [institutionRouteActive, loadMe]);

  const value = useMemo(() => ({
    account: session?.account || null,
    memberships: session?.memberships || [],
    organizationId: session?.memberships?.[0]?.organizationId || null,
    membership: session?.memberships?.[0] || null,
    loading,
    error,
    setError,
    login,
    logout,
  }), [session, loading, error, login, logout]);

  return <InstitutionAuthContext.Provider value={value}>{children}</InstitutionAuthContext.Provider>;
}

export function useInstitutionAuth() {
  const value = useContext(InstitutionAuthContext);
  if (!value) throw new Error('useInstitutionAuth must be used within InstitutionAuthProvider');
  return value;
}
