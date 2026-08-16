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
  agentAuthApi,
  resetAgentAxiosAuthState,
  getAgentAccessToken,
  setAgentAccessToken,
  clearAgentAccessToken,
} from '../services/agentService';
import { isAgentRoutePrefix } from '../auth/agentAuthRealm';
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
import { clearVerificationDraftsForAccount } from '../auth/verificationDraft';

const STORAGE_AGENT = 'strideto-agent';

const AgentAuthContext = createContext(null);

function readStoredAgent() {
  try {
    const raw = localStorage.getItem(STORAGE_AGENT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearAgentSessionLocal() {
  clearAgentAccessToken();
  localStorage.removeItem(STORAGE_AGENT);
  resetAgentAxiosAuthState();
}

function accountIdOf(record) {
  return record?._id || record?.id || record?.agentAccountId || null;
}

export function AgentAuthProvider({ children }) {
  const { pathname } = useLocation();
  const [agent, setAgent] = useState(readStoredAgent);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [identityConflict, setIdentityConflict] = useState(null);
  const authEpoch = useRef(0);

  const persistAgent = useCallback((a) => {
    setAgent(a);
    if (a) localStorage.setItem(STORAGE_AGENT, JSON.stringify(a));
    else localStorage.removeItem(STORAGE_AGENT);
  }, []);

  const bindLocalAgent = useCallback((nextAgent) => {
    authEpoch.current += 1;
    const subjectId = accountIdOf(nextAgent);
    if (subjectId) bindTabIdentity('agent', subjectId);
    persistAgent(nextAgent);
    setIdentityConflict(null);
  }, [persistAgent]);

  const acceptAgentSubject = useCallback((nextAgent) => {
    const subjectId = accountIdOf(nextAgent);
    if (!subjectId) {
      persistAgent(null);
      return null;
    }
    if (compareTabIdentity('agent', subjectId) === 'mismatch') {
      const expected = readTabIdentity('agent');
      persistAgent(null);
      setIdentityConflict({
        realm: 'agent',
        expectedSubjectId: expected?.subjectId || null,
        actualSubjectId: String(subjectId),
        pendingRecord: nextAgent,
      });
      return null;
    }
    bindTabIdentity('agent', subjectId);
    persistAgent(nextAgent);
    setIdentityConflict(null);
    return nextAgent;
  }, [persistAgent]);

  const login = useCallback(
    async (email, password) => {
      setError(null);
      const { data } = await agentAuthApi.login(email, password);
      setAgentAccessToken(data.accessToken);
      bindLocalAgent(data.account);
      writeActiveWorkspacePreference('agent');
      return data.account;
    },
    [bindLocalAgent]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await agentAuthApi.register(payload);
      if (data.requiresVerification || !data.accessToken) {
        return {
          requiresVerification: true,
          message: data.message,
          emailMode: data.emailMode,
        };
      }
      setAgentAccessToken(data.accessToken);
      bindLocalAgent(data.account);
      writeActiveWorkspacePreference('agent');
      return data.account;
    },
    [bindLocalAgent]
  );

  const persistFromMe = useCallback((res) => {
    if (!res?.data?.account) {
      persistAgent(null);
      return null;
    }
    const next = {
      ...res.data.account,
      agentType: res.data.profile?.agentType || res.data.account?.agentType,
      professionalName: res.data.profile?.professionalName || '',
      profileStatus: res.data.profile?.profileStatus || '',
    };
    return acceptAgentSubject(next);
  }, [persistAgent, acceptAgentSubject]);

  const refreshAgent = useCallback(async () => {
    const res = await agentAuthApi.me();
    return persistFromMe(res);
  }, [persistFromMe]);

  const ensureSession = useCallback(async () => {
    if (getAgentAccessToken() && agent) return agent;
    try {
      const { data } = await agentAuthApi.refreshToken();
      setAgentAccessToken(data.accessToken);
      const me = await agentAuthApi.me();
      return persistFromMe(me);
    } catch {
      if (getAgentAccessToken() && agent) return agent;
      clearAgentSessionLocal();
      persistAgent(null);
      return null;
    }
  }, [agent, persistAgent, persistFromMe]);

  const refreshQuietly = useCallback(() => {
    if (document.hidden) return;
    agentAuthApi.refreshToken().then(async ({ data }) => {
      if (data?.accessToken) setAgentAccessToken(data.accessToken);
      const me = await agentAuthApi.me();
      persistFromMe(me);
    }).catch(() => {});
  }, [persistFromMe]);

  const logout = useCallback(async () => {
    authEpoch.current += 1;
    const id = accountIdOf(agent);
    try {
      if (getAgentAccessToken()) await agentAuthApi.logout();
    } catch {
      // best-effort
    } finally {
      if (id) clearVerificationDraftsForAccount({ realm: 'agent', accountId: id });
      clearTabIdentity('agent');
      clearAgentSessionLocal();
      setAgent(null);
      setIdentityConflict(null);
      clearActiveWorkspacePreferenceIfRealm('agent');
    }
  }, [agent]);

  const logoutAll = useCallback(async () => {
    authEpoch.current += 1;
    const id = accountIdOf(agent);
    try {
      await agentAuthApi.logoutAll();
    } finally {
      if (id) clearVerificationDraftsForAccount({ realm: 'agent', accountId: id });
      clearTabIdentity('agent');
      clearAgentSessionLocal();
      setAgent(null);
      setIdentityConflict(null);
      clearActiveWorkspacePreferenceIfRealm('agent');
    }
  }, [agent]);

  const continueAsCurrentSession = useCallback(() => {
    setIdentityConflict((current) => {
      if (current?.pendingRecord) bindLocalAgent(current.pendingRecord);
      return null;
    });
  }, [bindLocalAgent]);

  const signInAgainFromConflict = useCallback(async () => {
    await logout();
  }, [logout]);

  useEffect(() => {
    return onSessionExpired((realm) => {
      if (realm === 'agent') {
        clearTabIdentity('agent');
        clearAgentSessionLocal();
        setAgent(null);
        setIdentityConflict(null);
      }
    });
  }, []);

  const agentRouteActive = isAgentRoutePrefix(pathname);

  useEffect(() => {
    if (!agentRouteActive) {
      setLoading(false);
      return undefined;
    }

    const epoch = authEpoch.current;
    let cancelled = false;
    const alreadyHydrated = !!getAgentAccessToken();
    if (!alreadyHydrated) setLoading(true);

    agentAuthApi
      .refreshToken()
      .then(({ data }) => {
        if (cancelled || epoch !== authEpoch.current) return null;
        setAgentAccessToken(data.accessToken);
        return agentAuthApi.me();
      })
      .then((res) => {
        if (!cancelled && epoch === authEpoch.current && res) persistFromMe(res);
      })
      .catch(() => {
        if (!cancelled && epoch === authEpoch.current) {
          if (getAgentAccessToken()) {
            return agentAuthApi.me().then((res) => persistFromMe(res)).catch(() => {
              clearAgentSessionLocal();
              persistAgent(null);
            });
          }
          clearAgentSessionLocal();
          persistAgent(null);
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
  }, [agentRouteActive]);

  useEffect(() => {
    if (!agentRouteActive) return undefined;
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
  }, [agentRouteActive, refreshQuietly]);

  const value = {
    agent,
    loading,
    error,
    setError,
    isAuthenticated: !!agent && !!getAgentAccessToken(),
    identityConflict,
    login,
    register,
    logout,
    logoutAll,
    refreshAgent,
    ensureSession,
    refreshQuietly,
    continueAsCurrentSession,
    signInAgainFromConflict,
  };

  return (
    <AgentAuthContext.Provider value={value}>
      {children}
    </AgentAuthContext.Provider>
  );
}

export function useAgentAuth() {
  const ctx = useContext(AgentAuthContext);
  if (!ctx) throw new Error('useAgentAuth must be used within AgentAuthProvider');
  return ctx;
}
