import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isInstitutionRoutePrefix } from '../auth/institutionAuthRealm';
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
  const [identityConflict, setIdentityConflict] = useState(null);
  const authEpoch = useRef(0);

  const persist = useCallback((next) => {
    setSession(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const bindLocalInstitution = useCallback((next) => {
    authEpoch.current += 1;
    const subjectId = next?.account?._id || next?.account?.id;
    if (subjectId) bindTabIdentity('institution', subjectId);
    persist(next);
    setIdentityConflict(null);
  }, [persist]);

  const acceptInstitutionSubject = useCallback((next) => {
    const subjectId = next?.account?._id || next?.account?.id;
    if (!subjectId) {
      persist(null);
      return null;
    }
    if (compareTabIdentity('institution', subjectId) === 'mismatch') {
      const expected = readTabIdentity('institution');
      persist(null);
      setIdentityConflict({
        realm: 'institution',
        expectedSubjectId: expected?.subjectId || null,
        actualSubjectId: String(subjectId),
        pendingRecord: next,
      });
      return null;
    }
    bindTabIdentity('institution', subjectId);
    persist(next);
    setIdentityConflict(null);
    return next;
  }, [persist]);

  const loadMe = useCallback(async () => {
    const { data } = await institutionAuthApi.me();
    const next = { account: data.account, memberships: data.memberships || [] };
    return acceptInstitutionSubject(next);
  }, [acceptInstitutionSubject]);

  const login = useCallback(async (email, password) => {
    setError('');
    const { data } = await institutionAuthApi.login(email, password);
    setInstitutionAccessToken(data.accessToken);
    const { data: me } = await institutionAuthApi.me();
    const next = { account: me.account, memberships: me.memberships || [] };
    bindLocalInstitution(next);
    writeActiveWorkspacePreference('institution');
    return next;
  }, [bindLocalInstitution]);

  const register = useCallback(async (payload) => {
    setError('');
    const { data } = await institutionAuthApi.register(payload);
    if (data.requiresVerification || !data.accessToken) {
      return {
        requiresVerification: true,
        message: data.message,
        emailMode: data.emailMode,
      };
    }
    setInstitutionAccessToken(data.accessToken);
    const { data: me } = await institutionAuthApi.me();
    const next = { account: me.account, memberships: me.memberships || [] };
    bindLocalInstitution(next);
    writeActiveWorkspacePreference('institution');
    return next;
  }, [bindLocalInstitution]);

  const ensureSession = useCallback(async () => {
    if (getInstitutionAccessToken() && session?.account) return session;
    try {
      const { data } = await institutionAuthApi.refresh();
      setInstitutionAccessToken(data.accessToken);
      return await loadMe();
    } catch {
      if (getInstitutionAccessToken() && session?.account) return session;
      clearLocalSession();
      persist(null);
      return null;
    }
  }, [session, loadMe, persist]);

  const refreshQuietly = useCallback(() => {
    if (document.hidden) return;
    institutionAuthApi.refresh().then(async ({ data }) => {
      if (data?.accessToken) setInstitutionAccessToken(data.accessToken);
      await loadMe();
    }).catch(() => {});
  }, [loadMe]);

  const logout = useCallback(async () => {
    authEpoch.current += 1;
    try {
      if (getInstitutionAccessToken()) await institutionAuthApi.logout();
    } catch { /* best-effort cookie cleanup */ }
    finally {
      clearTabIdentity('institution');
      clearLocalSession();
      setSession(null);
      setIdentityConflict(null);
      clearActiveWorkspacePreferenceIfRealm('institution');
    }
  }, []);

  const logoutAll = useCallback(async () => {
    authEpoch.current += 1;
    try {
      await institutionAuthApi.logoutAll();
    } finally {
      clearTabIdentity('institution');
      clearLocalSession();
      setSession(null);
      setIdentityConflict(null);
      clearActiveWorkspacePreferenceIfRealm('institution');
    }
  }, []);

  const continueAsCurrentSession = useCallback(() => {
    setIdentityConflict((current) => {
      if (current?.pendingRecord) bindLocalInstitution(current.pendingRecord);
      return null;
    });
  }, [bindLocalInstitution]);

  const signInAgainFromConflict = useCallback(async () => {
    await logout();
  }, [logout]);

  useEffect(() => {
    return onSessionExpired((realm) => {
      if (realm === 'institution') {
        clearTabIdentity('institution');
        clearLocalSession();
        setSession(null);
        setIdentityConflict(null);
      }
    });
  }, []);

  useEffect(() => {
    if (!institutionRouteActive) {
      setLoading(false);
      return undefined;
    }

    const epoch = authEpoch.current;
    let cancelled = false;
    const alreadyHydrated = !!getInstitutionAccessToken();
    if (!alreadyHydrated) setLoading(true);

    institutionAuthApi
      .refresh()
      .then(({ data }) => {
        if (cancelled || epoch !== authEpoch.current) return null;
        setInstitutionAccessToken(data.accessToken);
        return loadMe();
      })
      .then((next) => {
        if (!cancelled && epoch === authEpoch.current && next) persist(next);
      })
      .catch(() => {
        if (!cancelled && epoch === authEpoch.current) {
          if (getInstitutionAccessToken()) {
            return loadMe().catch(() => {
              clearLocalSession();
              setSession(null);
            });
          }
          clearLocalSession();
          setSession(null);
        }
        return null;
      })
      .finally(() => {
        if (!cancelled && epoch === authEpoch.current) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionRouteActive]);

  useEffect(() => {
    if (!institutionRouteActive) return undefined;
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
  }, [institutionRouteActive, refreshQuietly]);

  const account = session?.account || null;
  const memberships = session?.memberships || [];
  const organizationId = memberships[0]?.organizationId || null;

  const value = useMemo(() => ({
    account,
    memberships,
    organizationId,
    membership: memberships[0] || null,
    loading,
    error,
    setError,
    isAuthenticated: !!account && !!organizationId && !!getInstitutionAccessToken(),
    identityConflict,
    login,
    register,
    logout,
    logoutAll,
    ensureSession,
    refreshQuietly,
    continueAsCurrentSession,
    signInAgainFromConflict,
  }), [account, memberships, organizationId, loading, error, identityConflict, login, register, logout, logoutAll, ensureSession, refreshQuietly, continueAsCurrentSession, signInAgainFromConflict]);

  return <InstitutionAuthContext.Provider value={value}>{children}</InstitutionAuthContext.Provider>;
}

export function useInstitutionAuth() {
  const value = useContext(InstitutionAuthContext);
  if (!value) throw new Error('useInstitutionAuth must be used within InstitutionAuthProvider');
  return value;
}
