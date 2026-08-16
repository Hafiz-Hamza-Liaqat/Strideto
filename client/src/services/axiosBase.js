import axios from 'axios';
import { API_BASE_URL } from '../constants';
import { notifySessionExpired } from '../auth/sessionExpired.js';
import { createRefreshFlight } from '../auth/refreshFlight.js';

/**
 * SEC-3E — secure User-realm client contract. The access token lives in
 * this module's own in-memory variable only — never `localStorage`,
 * `sessionStorage`, or `IndexedDB`. The refresh token never reaches
 * JavaScript at all: it travels exclusively as an `HttpOnly` cookie,
 * attached automatically by the browser via `withCredentials: true`. No
 * request ever sends a refresh token in a body or header.
 */
let inMemoryAccessToken = null;

export function getAccessToken() {
  return inMemoryAccessToken;
}

export function setAccessToken(token) {
  inMemoryAccessToken = token || null;
}

export function clearAccessToken() {
  inMemoryAccessToken = null;
}

const AUTH_NO_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh-token',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
];

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
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshPromise = createRefreshFlight();

export function resetAxiosAuthState() {
  refreshPromise.reset();
}

/** Cookie refresh shared by bootstrap, interceptor, and visibility refresh. */
export function refreshUserAccessToken() {
  return refreshPromise.run(async () => {
    const res = await axios.post(
      `${API_BASE_URL}/auth/refresh-token`,
      {},
      { withCredentials: true }
    );
    const { accessToken } = res.data;
    setAccessToken(accessToken);
    return accessToken;
  });
}

axiosInstance.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken)
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
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
      if (
        status === 401 &&
        !isAuthNoRefreshUrl(original.url) &&
        !isOptionalAuthUrl(original.url)
      ) {
        clearAccessToken();
        notifySessionExpired('user');
      }
      return Promise.reject(err);
    }

    original._retry = true;

    try {
      const newToken = await refreshUserAccessToken();
      original.headers.Authorization = `Bearer ${newToken}`;
      return axiosInstance(original);
    } catch (refreshErr) {
      clearAccessToken();
      resetAxiosAuthState();
      notifySessionExpired('user');
      return Promise.reject(refreshErr);
    }
  }
);

export default axiosInstance;
