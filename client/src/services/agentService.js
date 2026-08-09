/**
 * Agent portal API client (Mission 11).
 * Mirrors employerService.js — access token in memory only,
 * refresh token as HttpOnly cookie.
 */
import axios from 'axios';
import userAxios from './axiosBase';
import { API_BASE_URL } from '../constants';

let inMemoryAgentAccessToken = null;

export function getAgentAccessToken() {
  return inMemoryAgentAccessToken;
}

export function setAgentAccessToken(token) {
  inMemoryAgentAccessToken = token || null;
}

export function clearAgentAccessToken() {
  inMemoryAgentAccessToken = null;
}

const AGENT_NO_REFRESH = [
  '/auth/agent/login',
  '/auth/agent/register',
  '/auth/agent/refresh-token',
  '/auth/agent/logout',
];

function isAgentNoRefreshUrl(url = '') {
  return AGENT_NO_REFRESH.some((path) => url.includes(path));
}

const agentAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let agentRefreshPromise = null;

export function resetAgentAxiosAuthState() {
  agentRefreshPromise = null;
}

agentAxios.interceptors.request.use(
  (config) => {
    if (inMemoryAgentAccessToken) {
      config.headers.Authorization = `Bearer ${inMemoryAgentAccessToken}`;
    }
    return config;
  },
  (e) => Promise.reject(e)
);

agentAxios.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;
    if (status === 401 && !original._agentRetry && !isAgentNoRefreshUrl(original.url || '')) {
      original._agentRetry = true;
      if (!agentRefreshPromise) {
        agentRefreshPromise = agentAxios
          .post('/api/auth/agent/refresh-token')
          .then((r) => {
            setAgentAccessToken(r.data.accessToken);
            agentRefreshPromise = null;
          })
          .catch(() => {
            clearAgentAccessToken();
            agentRefreshPromise = null;
          });
      }
      await agentRefreshPromise;
      if (inMemoryAgentAccessToken) {
        original.headers.Authorization = `Bearer ${inMemoryAgentAccessToken}`;
        return agentAxios(original);
      }
    }
    return Promise.reject(err);
  }
);

export const agentAuthApi = {
  register: (payload) => agentAxios.post('/api/auth/agent/register', payload),
  login: (email, password) => agentAxios.post('/api/auth/agent/login', { email, password }),
  me: () => agentAxios.get('/api/auth/agent/me'),
  logout: () => agentAxios.post('/api/auth/agent/logout'),
  logoutAll: () => agentAxios.post('/api/auth/agent/logout-all'),
  refreshToken: () => agentAxios.post('/api/auth/agent/refresh-token'),
  changePassword: (newPassword) =>
    agentAxios.post('/api/auth/agent/change-password', { newPassword }),
};

export const agentApi = {
  getDashboard: () => agentAxios.get('/api/agent/dashboard'),
  getProfile: () => agentAxios.get('/api/agent/profile'),
  updateProfile: (data) => agentAxios.patch('/api/agent/profile', data),
  getCompleteness: () => agentAxios.get('/api/agent/profile/completeness'),
  submitOnboardingStep: (step) =>
    agentAxios.post('/api/agent/onboarding/step', { step }),
  getVerification: () => agentAxios.get('/api/agent/verification'),
  getVerificationDetails: (organizationId) =>
    agentAxios.get(`/api/organizations/${organizationId}/verification`),
  submitVerification: (organizationId, profile) =>
    agentAxios.post(`/api/organizations/${organizationId}/verification/submit`, { profile }),
  respondToVerification: (organizationId, profile) =>
    agentAxios.post(`/api/organizations/${organizationId}/verification/respond`, { profile }),
  addVerificationEvidence: (organizationId, evidence) =>
    agentAxios.post(`/api/organizations/${organizationId}/verification/evidence`, evidence),
  getServices: () => agentAxios.get('/api/agent/services'),
  createService: (data) => agentAxios.post('/api/agent/services', data),
  updateService: (serviceId, data) =>
    agentAxios.patch(`/api/agent/services/${serviceId}`, data),
  getTeam: () => agentAxios.get('/api/agent/team'),
  changeMemberRole: (targetAgentAccountId, role) =>
    agentAxios.patch('/api/agent/team/member', { targetAgentAccountId, role }),
  changeMemberStatus: (targetAgentAccountId, active) =>
    agentAxios.patch('/api/agent/team/member/status', { targetAgentAccountId, active }),
  getLeads: () => agentAxios.get('/api/agent/leads'),
  updateLeadStatus: (leadId, status) =>
    agentAxios.patch(`/api/agent/leads/${leadId}`, { status }),
  getClients: () => agentAxios.get('/api/agent/clients'),
  getMarketplaceCounts: () => agentAxios.get('/api/agent/marketplace/counts'),
  getMarketplacePosts: (params) => agentAxios.get('/api/agent/marketplace', { params }),
  getMarketplacePost: (postId) => agentAxios.get(`/api/agent/marketplace/${postId}`),
  createMarketplacePost: (data) => agentAxios.post('/api/agent/marketplace', data),
  updateMarketplacePost: (postId, data) => agentAxios.patch(`/api/agent/marketplace/${postId}`, data),
  submitMarketplacePost: (postId) => agentAxios.post(`/api/agent/marketplace/${postId}/submit`),
  archiveMarketplacePost: (postId) => agentAxios.post(`/api/agent/marketplace/${postId}/archive`),
};

export const agentPublicApi = {
  getDirectory: (params) => agentAxios.get('/api/agents', { params }),
  getProfile: (slug) => agentAxios.get(`/api/agents/${slug}`),
  getMarketplace: (params) => agentAxios.get('/api/agents/marketplace/posts', { params }),
  getMarketplacePost: (slug) => agentAxios.get(`/api/agents/marketplace/posts/${slug}`),
};

export const studentMarketplaceApi = {
  expressInterest: (slug) => userAxios.post(`/agents/marketplace/posts/${slug}/interest`, { explicitConsent: true }),
  withdrawInterest: (slug) => userAxios.delete(`/agents/marketplace/posts/${slug}/interest`),
};
