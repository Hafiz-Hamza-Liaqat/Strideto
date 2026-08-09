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

  // Bootstrap session on agent portal routes
  useEffect(() => {
    if (!isAgentRoutePrefix(pathname)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (getAgentAccessToken()) {
          await refreshAgent();
        } else {
          // Try silent refresh via cookie
          const { data } = await agentAuthApi.refreshToken();
          setAgentAccessToken(data.accessToken);
          await refreshAgent();
        }
      } catch {
        clearAgentSessionLocal();
        setAgent(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pathname, refreshAgent]);

  return (
    <AgentAuthContext.Provider
      value={{ agent, loading, error, setError, login, register, logout, refreshAgent }}
    >
      {children}
    </AgentAuthContext.Provider>
  );
}

export function useAgentAuth() {
  const ctx = useContext(AgentAuthContext);
  if (!ctx) throw new Error('useAgentAuth must be used within AgentAuthProvider');
  return ctx;
}
