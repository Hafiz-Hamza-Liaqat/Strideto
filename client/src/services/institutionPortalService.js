import axios from 'axios';
import { API_BASE_URL } from '../constants';
import { notifySessionExpired } from '../auth/sessionExpired.js';

let institutionAccessToken = null;
let refreshPromise = null;

export const getInstitutionAccessToken = () => institutionAccessToken;
export const setInstitutionAccessToken = (token) => { institutionAccessToken = token || null; };
export const clearInstitutionAccessToken = () => { institutionAccessToken = null; };
export const resetInstitutionAuthState = () => { refreshPromise = null; };

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const noRefreshPaths = [
  '/auth/institution/login',
  '/auth/institution/register',
  '/auth/institution/refresh-token',
  '/auth/institution/logout',
];

client.interceptors.request.use((config) => {
  if (institutionAccessToken) config.headers.Authorization = `Bearer ${institutionAccessToken}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const mayRefresh = error.response?.status === 401 && original && !original._institutionRetry &&
      !noRefreshPaths.some((path) => (original.url || '').includes(path));
    if (!mayRefresh) return Promise.reject(error);

    original._institutionRetry = true;
    if (!refreshPromise) {
      refreshPromise = client.post('/auth/institution/refresh-token')
        .then(({ data }) => setInstitutionAccessToken(data.accessToken))
        .catch(() => {
          clearInstitutionAccessToken();
          localStorage.removeItem('strideto-institution');
          notifySessionExpired('institution');
        })
        .finally(() => { refreshPromise = null; });
    }
    await refreshPromise;
    if (!institutionAccessToken) return Promise.reject(error);
    original.headers.Authorization = `Bearer ${institutionAccessToken}`;
    return client(original);
  }
);

export const institutionAuthApi = {
  register: (payload) => client.post('/auth/institution/register', payload),
  login: (email, password) => client.post('/auth/institution/login', { email, password }),
  me: () => client.get('/auth/institution/me'),
  refresh: () => client.post('/auth/institution/refresh-token'),
  logout: () => client.post('/auth/institution/logout'),
};

const portalPath = (organizationId, suffix = '') =>
  `/institution/${encodeURIComponent(organizationId)}${suffix}`;

export const institutionPortalApi = {
  dashboard: (organizationId) => client.get(portalPath(organizationId, '/dashboard')),
  onboarding: (organizationId) => client.get(portalPath(organizationId, '/onboarding')),
  profile: (organizationId) => client.get(portalPath(organizationId, '/profile')),
  updateProfile: (organizationId, data) => client.patch(portalPath(organizationId, '/profile'), data),
  claim: (organizationId) => client.get(portalPath(organizationId, '/claim')),
  startClaim: (organizationId, data) => client.post(portalPath(organizationId, '/claim'), data),
  submitClaim: (organizationId, claimId) => client.post(portalPath(organizationId, `/claim/${encodeURIComponent(claimId)}/submit`)),
  programs: (organizationId) => client.get(portalPath(organizationId, '/programs')),
  program: (organizationId, programId) => client.get(portalPath(organizationId, `/programs/${encodeURIComponent(programId)}`)),
  createProgram: (organizationId, data) => client.post(portalPath(organizationId, '/programs'), data),
  updateProgram: (organizationId, programId, data) => client.patch(portalPath(organizationId, `/programs/${encodeURIComponent(programId)}`), data),
  submitProgram: (organizationId, programId) => client.post(portalPath(organizationId, `/programs/${encodeURIComponent(programId)}/submit`)),
  createRequirement: (organizationId, programId, data) => client.post(portalPath(organizationId, `/programs/${encodeURIComponent(programId)}/requirements`), data),
  createTestAcceptance: (organizationId, data) => client.post(portalPath(organizationId, '/test-acceptance'), data),
  conflicts: (organizationId) => client.get(portalPath(organizationId, '/data-conflicts')),
  history: (organizationId) => client.get(portalPath(organizationId, '/change-history')),
  reconfirmFreshness: (organizationId, data) => client.post(portalPath(organizationId, '/freshness/reconfirm'), data),
  team: (organizationId) => client.get(portalPath(organizationId, '/team')),
  updateMemberRole: (organizationId, memberId, role) => client.patch(portalPath(organizationId, `/team/${encodeURIComponent(memberId)}/role`), { role }),
};
