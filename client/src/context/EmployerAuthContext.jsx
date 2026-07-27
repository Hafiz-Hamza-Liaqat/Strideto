import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  employerAuthApi,
  EMPLOYER_TOKEN_STORAGE,
  EMPLOYER_REFRESH_STORAGE,
  resetEmployerAxiosAuthState,
} from '../services/employerService';

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
  localStorage.removeItem(EMPLOYER_TOKEN_STORAGE);
  localStorage.removeItem(EMPLOYER_REFRESH_STORAGE);
  localStorage.removeItem(STORAGE_EMPLOYER);
  resetEmployerAxiosAuthState();
}

export function EmployerAuthProvider({ children }) {
  const [employer, setEmployer] = useState(readStoredEmployer);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const persistEmployer = useCallback((e) => {
    setEmployer(e);
    if (e) localStorage.setItem(STORAGE_EMPLOYER, JSON.stringify(e));
    else localStorage.removeItem(STORAGE_EMPLOYER);
  }, []);

  const setSessionTokens = useCallback((accessToken, refreshToken) => {
    if (accessToken) localStorage.setItem(EMPLOYER_TOKEN_STORAGE, accessToken);
    else localStorage.removeItem(EMPLOYER_TOKEN_STORAGE);
    if (refreshToken) localStorage.setItem(EMPLOYER_REFRESH_STORAGE, refreshToken);
    else localStorage.removeItem(EMPLOYER_REFRESH_STORAGE);
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    const { data } = await employerAuthApi.login(email, password);
    setSessionTokens(data.accessToken, data.refreshToken);
    persistEmployer(data.employer);
    return data.employer;
  }, [persistEmployer, setSessionTokens]);

  const register = useCallback(async (payload) => {
    const { data } = await employerAuthApi.register(payload);
    setSessionTokens(data.accessToken, data.refreshToken);
    persistEmployer(data.employer);
    return data.employer;
  }, [persistEmployer, setSessionTokens]);

  const refreshEmployer = useCallback(async () => {
    const { data } = await employerAuthApi.me();
    persistEmployer(data.employer);
    return data.employer;
  }, [persistEmployer]);

  const logout = useCallback(async () => {
    try {
      if (localStorage.getItem(EMPLOYER_TOKEN_STORAGE)) {
        await employerAuthApi.logout();
      }
    } catch {
      /* local clear still required */
    }
    clearEmployerSessionLocal();
    persistEmployer(null);
  }, [persistEmployer]);

  useEffect(() => {
    const token = localStorage.getItem(EMPLOYER_TOKEN_STORAGE);
    if (!token) {
      setLoading(false);
      return;
    }
    employerAuthApi
      .me()
      .then(({ data }) => persistEmployer(data.employer))
      .catch(() => {
        clearEmployerSessionLocal();
        persistEmployer(null);
      })
      .finally(() => setLoading(false));
  }, [persistEmployer]);

  const value = {
    employer,
    loading,
    error,
    setError,
    isAuthenticated: !!employer,
    login,
    register,
    logout,
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
  if (!ctx) throw new Error('useEmployerAuth must be used within EmployerAuthProvider');
  return ctx;
}
