import axios from 'axios';
import { API_BASE_URL } from '../constants';

const TOKEN_KEY = 'edurozgaar-token';
const REFRESH_KEY = 'edurozgaar-refresh-token';

const AUTH_NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh-token', '/auth/logout', '/auth/forgot-password', '/auth/reset-password', '/auth/verify-email'];

/** Endpoints that accept anonymous requests; do not refresh or clear session on 401. */
const OPTIONAL_AUTH_PATHS = ['/feedback'];

function isAuthNoRefreshUrl(url = '') {
  return AUTH_NO_REFRESH.some((path) => url.includes(path));
}

function isOptionalAuthUrl(url = '') {
  return OPTIONAL_AUTH_PATHS.some((path) => url.includes(path));
}

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;

export function resetAxiosAuthState() {
  refreshPromise = null;
}

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err)
);

axiosInstance.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;

    if (!original || status === 429) {
      return Promise.reject(err);
    }

    if (isOptionalAuthUrl(original.url)) {
      if (status === 401 && !original._retryAnonymous) {
        original._retryAnonymous = true;
        delete original.headers.Authorization;
        return axiosInstance(original);
      }
      return Promise.reject(err);
    }

    if (status !== 401 || original._retry || isAuthNoRefreshUrl(original.url)) {
      if (status === 401 && !isAuthNoRefreshUrl(original.url) && !isOptionalAuthUrl(original.url)) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem('edurozgaar-user');
      }
      return Promise.reject(err);
    }

    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('edurozgaar-user');
      return Promise.reject(err);
    }

    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken: refresh })
        .then((res) => {
          const { accessToken, refreshToken: newRefresh, user } = res.data;
          localStorage.setItem(TOKEN_KEY, accessToken);
          if (newRefresh) localStorage.setItem(REFRESH_KEY, newRefresh);
          if (user) localStorage.setItem('edurozgaar-user', JSON.stringify(user));
          return accessToken;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return axiosInstance(original);
    } catch (refreshErr) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem('edurozgaar-user');
      resetAxiosAuthState();
      return Promise.reject(refreshErr);
    }
  }
);

export default axiosInstance;
