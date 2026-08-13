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
      return data.account;
    },
    [persistAgent]
  );

  const refreshAgent = useCallback(async () => {
    const { data } = await agentAuthApi.me();
    persistAgent(data.account);
    return data.account;
  }, [persistAgent]);

  const logout = useCallback(async () => {
    try {
      if (getAgentAccessToken()) await agentAuthApi.logout();
    } catch {
      // best-effort
    } finally {
      clearAgentSessionLocal();
      setAgent(null);
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
        if (!cancelled && res) {
          persistAgent({
            ...res.data.account,
            agentType: res.data.profile?.agentType || res.data.account?.agentType,
          });
        }
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

  const value = {
    agent,
    loading,
    error,
    setError,
    isAuthenticated: !!agent && !!getAgentAccessToken(),
    login,
    register,
    logout,
    refreshAgent,
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
