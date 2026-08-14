import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
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

export function AgentAuthProvider({ children }) {
  const { pathname } = useLocation();
  const [agent, setAgent] = useState(readStoredAgent);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const persistAgent = useCallback((a) => {
    setAgent(a);
    if (a) localStorage.setItem(STORAGE_AGENT, JSON.stringify(a));
    else localStorage.removeItem(STORAGE_AGENT);
  }, []);

  const login = useCallback(
    async (email, password) => {
      setError(null);
      const { data } = await agentAuthApi.login(email, password);
      setAgentAccessToken(data.accessToken);
      persistAgent(data.account);
      writeActiveWorkspacePreference('agent');
      return data.account;
    },
    [persistAgent]
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
      persistAgent(data.account);
      writeActiveWorkspacePreference('agent');
      return data.account;
    },
    [persistAgent]
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
    persistAgent(next);
    return next;
  }, [persistAgent]);

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
      clearAgentSessionLocal();
      persistAgent(null);
      return null;
    }
  }, [agent, persistAgent, persistFromMe]);

  const refreshQuietly = useCallback(() => {
    if (document.hidden || !getAgentAccessToken()) return;
    agentAuthApi.refreshToken().then(({ data }) => {
      if (data?.accessToken) setAgentAccessToken(data.accessToken);
    }).catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getAgentAccessToken()) await agentAuthApi.logout();
    } catch {
      // best-effort
    } finally {
      clearAgentSessionLocal();
      setAgent(null);
      clearActiveWorkspacePreferenceIfRealm('agent');
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await agentAuthApi.logoutAll();
    } finally {
      clearAgentSessionLocal();
      setAgent(null);
      clearActiveWorkspacePreferenceIfRealm('agent');
    }
  }, []);

  useEffect(() => {
    return onSessionExpired((realm) => {
      if (realm === 'agent') {
        clearAgentSessionLocal();
        setAgent(null);
      }
    });
  }, []);

  const agentRouteActive = isAgentRoutePrefix(pathname);

  // Realm-boundary bootstrap only — never re-run on every in-portal pathname.
  useEffect(() => {
    if (!agentRouteActive) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const alreadyHydrated = !!getAgentAccessToken();
    if (!alreadyHydrated) setLoading(true);

    agentAuthApi
      .refreshToken()
      .then(({ data }) => {
        if (cancelled) return null;
        setAgentAccessToken(data.accessToken);
        return agentAuthApi.me();
      })
      .then((res) => {
        if (!cancelled && res) persistFromMe(res);
      })
      .catch(() => {
        if (!cancelled) {
          clearAgentSessionLocal();
          persistAgent(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentRouteActive]);

  useEffect(() => {
    if (!agentRouteActive) return undefined;
    const refreshQuietly = () => {
      if (document.hidden || !getAgentAccessToken()) return;
      agentAuthApi.refreshToken().then(({ data }) => {
        if (data?.accessToken) setAgentAccessToken(data.accessToken);
      }).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshQuietly();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refreshQuietly);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refreshQuietly);
    };
  }, [agentRouteActive]);

  const value = {
    agent,
    loading,
    error,
    setError,
    isAuthenticated: !!agent && !!getAgentAccessToken(),
    login,
    register,
    logout,
    logoutAll,
    refreshAgent,
    ensureSession,
    refreshQuietly,
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
