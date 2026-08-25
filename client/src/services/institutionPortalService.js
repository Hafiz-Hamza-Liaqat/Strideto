import axios from 'axios';
import { API_BASE_URL } from '../constants';
import { notifySessionExpired } from '../auth/sessionExpired.js';
import { createRefreshFlight } from '../auth/refreshFlight.js';

let institutionAccessToken = null;
const refreshPromise = createRefreshFlight();

export const getInstitutionAccessToken = () => institutionAccessToken;
export const setInstitutionAccessToken = (token) => { institutionAccessToken = token || null; };
export const clearInstitutionAccessToken = () => { institutionAccessToken = null; };
export const resetInstitutionAuthState = () => { refreshPromise.reset(); };

export function refreshInstitutionAccessToken() {
  return refreshPromise.run(async () => {
    const res = await axios.post(
      `${API_BASE_URL}/auth/institution/refresh-token`,
      {},
      { withCredentials: true }
    );
    const { accessToken } = res.data;
    setInstitutionAccessToken(accessToken);
    return accessToken;
  });
}

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
  '/auth/institution/forgot-password',
  '/auth/institution/reset-password',
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
    try {
      await refreshInstitutionAccessToken();
    } catch {
      clearInstitutionAccessToken();
      localStorage.removeItem('strideto-institution');
      notifySessionExpired('institution');
    }
    if (!institutionAccessToken) return Promise.reject(error);
    original.headers.Authorization = `Bearer ${institutionAccessToken}`;
    return client(original);
  }
);

export const institutionAuthApi = {
  register: (payload) => client.post('/auth/institution/register', payload),
  login: (email, password) => client.post('/auth/institution/login', { email, password }),
  me: () => client.get('/auth/institution/me'),
  refresh: async () => {
    const accessToken = await refreshInstitutionAccessToken();
    return { data: { accessToken } };
  },
  logout: () => client.post('/auth/institution/logout'),
  logoutAll: () => client.post('/auth/institution/logout-all'),
  changePassword: (payload) => client.post('/auth/institution/change-password', payload),
  forgotPassword: (email) => client.post('/auth/institution/forgot-password', { email }),
  resetPassword: (data) => client.post('/auth/institution/reset-password', data),
  previewInvite: (token) => client.get('/auth/institution/invitations/preview', { params: { token } }),
  acceptInvite: (token) => client.post('/auth/institution/invitations/accept', { token }),
};

const portalPath = (organizationId, suffix = '') =>
  `/institution/${encodeURIComponent(organizationId)}${suffix}`;

export const institutionPortalApi = {
  searchInstitutions: (params) => client.get('/institutions/directory', { params }),
  dashboard: (organizationId) => client.get(portalPath(organizationId, '/dashboard')),
  onboarding: (organizationId) => client.get(portalPath(organizationId, '/onboarding')),
  profile: (organizationId) => client.get(portalPath(organizationId, '/profile')),
  updateProfile: (organizationId, data) => client.patch(portalPath(organizationId, '/profile'), data),
  claim: (organizationId) => client.get(portalPath(organizationId, '/claim')),
  startClaim: (organizationId, data) => client.post(portalPath(organizationId, '/claim'), data),
  updateClaim: (organizationId, claimId, data) => client.patch(portalPath(organizationId, `/claim/${encodeURIComponent(claimId)}`), data),
  submitClaim: (organizationId, claimId) => client.post(portalPath(organizationId, `/claim/${encodeURIComponent(claimId)}/submit`)),
  reopenClaim: (organizationId, claimId, data) => client.post(portalPath(organizationId, `/claim/${encodeURIComponent(claimId)}/reopen`), data || {}),
  program: (organizationId, programId) => client.get(portalPath(organizationId, `/programs/${encodeURIComponent(programId)}`)),
  createProgram: (organizationId, data) => client.post(portalPath(organizationId, '/programs'), data),
  updateProgram: (organizationId, programId, data) => client.patch(portalPath(organizationId, `/programs/${encodeURIComponent(programId)}`), data),
  submitProgram: (organizationId, programId) => client.post(portalPath(organizationId, `/programs/${encodeURIComponent(programId)}/submit`)),
  createRequirement: (organizationId, programId, data) => client.post(portalPath(organizationId, `/programs/${encodeURIComponent(programId)}/requirements`), data),
  createTestAcceptance: (organizationId, data) => client.post(portalPath(organizationId, '/test-acceptance'), data),
  publishTestAcceptance: (organizationId, testAcceptanceId) => client.post(portalPath(organizationId, `/test-acceptance/${encodeURIComponent(testAcceptanceId)}/publish`)),
  archiveTestAcceptance: (organizationId, testAcceptanceId) => client.post(portalPath(organizationId, `/test-acceptance/${encodeURIComponent(testAcceptanceId)}/archive`)),
  conflicts: (organizationId) => client.get(portalPath(organizationId, '/data-conflicts')),
  history: (organizationId) => client.get(portalPath(organizationId, '/change-history')),
  reconfirmFreshness: (organizationId, data) => client.post(portalPath(organizationId, '/freshness/reconfirm'), data),
  team: (organizationId, params) => client.get(portalPath(organizationId, '/team'), { params }),
  updateMemberRole: (organizationId, memberId, role) => client.patch(portalPath(organizationId, `/team/${encodeURIComponent(memberId)}/role`), { role }),
  revokeMember: (organizationId, memberId) => client.delete(portalPath(organizationId, `/team/${encodeURIComponent(memberId)}`)),
  listInvites: (organizationId) => client.get(portalPath(organizationId, '/team/invites')),
  createInvite: (organizationId, data) => client.post(portalPath(organizationId, '/team/invites'), data),
  revokeInvite: (organizationId, invitationId) => client.post(portalPath(organizationId, `/team/invites/${encodeURIComponent(invitationId)}/revoke`)),
  programs: (organizationId, params) => client.get(portalPath(organizationId, '/programs'), { params }),
  listTestAcceptance: (organizationId, params) => client.get(portalPath(organizationId, '/test-acceptance'), { params }),
  scholarships: (organizationId, params) => client.get(portalPath(organizationId, '/scholarships'), { params }),
  createScholarship: (organizationId, data) => client.post(portalPath(organizationId, '/scholarships'), data),
  updateScholarship: (organizationId, scholarshipId, data) => client.patch(portalPath(organizationId, `/scholarships/${encodeURIComponent(scholarshipId)}`), data),
  applications: (organizationId, params) => client.get(portalPath(organizationId, '/applications'), { params }),
  application: (organizationId, applicationId) => client.get(portalPath(organizationId, `/applications/${encodeURIComponent(applicationId)}`)),
  transitionApplication: (organizationId, applicationId, data) => client.patch(portalPath(organizationId, `/applications/${encodeURIComponent(applicationId)}/status`), data),
  usageBilling: (organizationId) => client.get(portalPath(organizationId, '/usage-billing')),
  vaultProbe: (organizationId) => client.get(portalPath(organizationId, '/vault')),
  getVerification: (organizationId) => client.get(`/organizations/${encodeURIComponent(organizationId)}/verification`),
  submitVerification: (organizationId, profile) => client.post(`/organizations/${encodeURIComponent(organizationId)}/verification/submit`, { profile }),
  respondToVerification: (organizationId, profile) => client.post(`/organizations/${encodeURIComponent(organizationId)}/verification/respond`, { profile }),
  getCredentialPolicy: (organizationId) => client.get(`/organizations/${encodeURIComponent(organizationId)}/verification/credential-policy`),
};

export const institutionInboxApi = {
  list: (params) => client.get('/inbox/notifications', { params }),
  unreadCount: () => client.get('/inbox/notifications/unread-count'),
  markRead: (id) => client.patch(`/inbox/notifications/${id}/read`),
  markAllRead: () => client.post('/inbox/notifications/mark-all-read'),
  remove: (id) => client.delete(`/inbox/notifications/${id}`),
};

