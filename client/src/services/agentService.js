/**
 * Agent portal API client (Mission 11).
 * Mirrors employerService.js — access token in memory only,
 * refresh token as HttpOnly cookie.
 */
import axios from 'axios';
import userAxios from './axiosBase';
import { API_BASE_URL } from '../constants';
import { notifySessionExpired } from '../auth/sessionExpired.js';

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
  '/auth/agent/forgot-password',
  '/auth/agent/reset-password',
];

function isAgentNoRefreshUrl(url = '') {
  return AGENT_NO_REFRESH.some((path) => url.includes(path));
}

export const agentAxios = axios.create({
  // Agent endpoints below include the canonical `/api` prefix. Strip only a
  // trailing API segment from the configured base so runtime requests never
  // become `/api/api/...` behind the reverse proxy.
  baseURL: API_BASE_URL.replace(/\/api\/?$/, ''),
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
            localStorage.removeItem('strideto-agent');
            agentRefreshPromise = null;
            notifySessionExpired('agent');
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
  changePassword: (payload) =>
    agentAxios.post('/api/auth/agent/change-password', payload),
  forgotPassword: (email) => agentAxios.post('/api/auth/agent/forgot-password', { email }),
  resetPassword: (data) => agentAxios.post('/api/auth/agent/reset-password', data),
};

export const agentApi = {
  getDashboard: () => agentAxios.get('/api/agent/dashboard'),
  getProfile: () => agentAxios.get('/api/agent/profile'),
  updateProfile: (data) => agentAxios.patch('/api/agent/profile', data),
  getCompleteness: () => agentAxios.get('/api/agent/profile/completeness'),
  submitOnboardingStep: (step, { skip = false } = {}) =>
    agentAxios.post('/api/agent/onboarding/step', { step, skip: Boolean(skip) }),
  getVerification: () => agentAxios.get('/api/agent/verification'),
  getVerificationDetails: (organizationId) =>
    agentAxios.get(`/api/organizations/${organizationId}/verification`),
  submitVerification: (organizationId, profile) =>
    agentAxios.post(`/api/organizations/${organizationId}/verification/submit`, { profile }),
  respondToVerification: (organizationId, profile) =>
    agentAxios.post(`/api/organizations/${organizationId}/verification/respond`, { profile }),
  addVerificationEvidence: (organizationId, evidence) =>
    agentAxios.post(`/api/organizations/${organizationId}/verification/evidence`, evidence),
  getServices: (opts) => agentAxios.get('/api/agent/services', opts),
  createService: (data) => agentAxios.post('/api/agent/services', data),
  updateService: (serviceId, data) =>
    agentAxios.patch(`/api/agent/services/${serviceId}`, data),
  getTeam: (opts) => agentAxios.get('/api/agent/team', opts),
  changeMemberRole: (targetAgentAccountId, role) =>
    agentAxios.patch('/api/agent/team/member', { targetAgentAccountId, role }),
  changeMemberStatus: (targetAgentAccountId, active) =>
    agentAxios.patch('/api/agent/team/member/status', { targetAgentAccountId, active }),
  getLeads: (opts) => agentAxios.get('/api/agent/leads', opts),
  updateLeadStatus: (leadId, status) =>
    agentAxios.patch(`/api/agent/leads/${leadId}`, { status }),
  getClients: (opts) => agentAxios.get('/api/agent/clients', opts),
  getMarketplaceCounts: () => agentAxios.get('/api/agent/marketplace/counts'),
  getMarketplacePosts: (params) => agentAxios.get('/api/agent/marketplace', { params }),
  getMarketplacePost: (postId) => agentAxios.get(`/api/agent/marketplace/${postId}`),
  createMarketplacePost: (data) => agentAxios.post('/api/agent/marketplace', data),
  updateMarketplacePost: (postId, data) => agentAxios.patch(`/api/agent/marketplace/${postId}`, data),
  submitMarketplacePost: (postId) => agentAxios.post(`/api/agent/marketplace/${postId}/submit`),
  archiveMarketplacePost: (postId) => agentAxios.post(`/api/agent/marketplace/${postId}/archive`),
  getConsultations: (params) => agentAxios.get('/api/agent/consultations', { params }),
  getConsultation: (consultationId) => agentAxios.get(`/api/agent/consultations/${consultationId}`),
  transitionConsultation: (consultationId, data) => agentAxios.post(`/api/agent/consultations/${consultationId}/transition`, data),
  getAvailability: () => agentAxios.get('/api/agent/availability'),
  saveAvailability: (data) => agentAxios.put('/api/agent/availability', data),
  getConsultationMessages: (threadId, params) => agentAxios.get(`/api/agent/consultations/threads/${threadId}/messages`, { params }),
  sendConsultationMessage: (threadId, data) => agentAxios.post(`/api/agent/consultations/threads/${threadId}/messages`, data),
  markConsultationRead: (threadId) => agentAxios.post(`/api/agent/consultations/threads/${threadId}/read`),
  resolveConsultationDocument: (threadId, messageId) => agentAxios.get(`/api/agent/consultations/threads/${threadId}/document-references/${messageId}`),
  getCases: (params) => agentAxios.get('/api/agent/cases', { params }),
  getCase: (caseId) => agentAxios.get(`/api/agent/cases/${caseId}`),
  proposeCase: (data) => agentAxios.post('/api/agent/cases', data),
  updateCaseStage: (caseId, data) => agentAxios.post(`/api/agent/cases/${caseId}/stage`, data),
  createCaseTask: (caseId, data) => agentAxios.post(`/api/agent/cases/${caseId}/tasks`, data),
  requestCaseApproval: (caseId, data) => agentAxios.post(`/api/agent/cases/${caseId}/approvals`, data),
  requestCaseDocument: (caseId, data) => agentAxios.post(`/api/agent/cases/${caseId}/document-requests`, data),
  getCaseMessages: (caseId, params) => agentAxios.get(`/api/agent/cases/${caseId}/messages`, { params }),
  sendCaseMessage: (caseId, data) => agentAxios.post(`/api/agent/cases/${caseId}/messages`, data),
  getReviews: () => agentAxios.get('/api/agent/reviews'), respondToReview: (reviewId, body) => agentAxios.put(`/api/agent/reviews/${reviewId}/response`, { body }),
  getReports: () => agentAxios.get('/api/agent/reports'), getDisputes: () => agentAxios.get('/api/agent/disputes'),
  addDisputeEvent: (disputeId, data) => agentAxios.post(`/api/agent/disputes/${disputeId}/events`, data),
  getCommerceHistory: (params) => agentAxios.get('/api/agent/commerce/history', { params }),
  getCommerceReadiness: () => agentAxios.get('/api/agent/commerce/readiness'),
  getUsageBilling: (params) => agentAxios.get('/api/agent/usage-billing', { params }),
  getMessages: (params) => agentAxios.get('/api/agent/messages', { params }),
  getVaultGrants: () => agentAxios.get('/api/agent/vault/grants'),
  getVerificationSources: (params) => agentAxios.get('/api/agent/verification/sources', { params }),
  getCredentialPolicy: (organizationId) =>
    agentAxios.get(`/api/organizations/${organizationId}/verification/credential-policy`),
  getTeamInvites: () => agentAxios.get('/api/agent/team/invites'),
  createTeamInvite: (data) => agentAxios.post('/api/agent/team/invites', data),
  revokeTeamInvite: (invitationId) => agentAxios.post(`/api/agent/team/invites/${invitationId}/revoke`),
  previewInvite: (token) => agentAxios.get('/api/auth/agent/invitations/preview', { params: { token } }),
  acceptInvite: (token) => agentAxios.post('/api/auth/agent/invitations/accept', { token }),
  getPaymentStatus: () => agentAxios.post('/api/agent/marketplace-payments/connect/sync'),
  startPaymentOnboarding: (country, idempotencyKey) => agentAxios.post('/api/agent/marketplace-payments/connect/onboarding', { country }, { headers: { 'Idempotency-Key': idempotencyKey } }),
};

export const agentInboxApi = {
  list: (params) => agentAxios.get('/api/inbox/notifications', { params }),
  unreadCount: () => agentAxios.get('/api/inbox/notifications/unread-count'),
  markRead: (id) => agentAxios.patch(`/api/inbox/notifications/${id}/read`),
  markAllRead: () => agentAxios.post('/api/inbox/notifications/mark-all-read'),
  remove: (id) => agentAxios.delete(`/api/inbox/notifications/${id}`),
};

export const agentPublicApi = {
  getDirectory: (params) => agentAxios.get('/api/agents', { params }),
  getProfile: (slug) => agentAxios.get(`/api/agents/${slug}`),
  getMarketplace: (params) => agentAxios.get('/api/agents/marketplace/posts', { params }),
  getMarketplacePost: (slug) => agentAxios.get(`/api/agents/marketplace/posts/${slug}`),
  getReviews: (slug) => agentAxios.get(`/api/agents/${slug}/reviews`),
};

export const studentMarketplaceApi = {
  expressInterest: (slug) => userAxios.post(`/agents/marketplace/posts/${slug}/interest`, { explicitConsent: true }),
  withdrawInterest: (slug) => userAxios.delete(`/agents/marketplace/posts/${slug}/interest`),
};

export const studentConsultationApi = {
  getAvailability: (serviceId) => userAxios.get(`/consultations/availability/${serviceId}`),
  list: (params) => userAxios.get('/consultations', { params }),
  get: (consultationId) => userAxios.get(`/consultations/${consultationId}`),
  request: (data) => userAxios.post('/consultations', data),
  transition: (consultationId, data) => userAxios.post(`/consultations/${consultationId}/transition`, data),
  getMessages: (threadId, params) => userAxios.get(`/consultations/threads/${threadId}/messages`, { params }),
  sendMessage: (threadId, data) => userAxios.post(`/consultations/threads/${threadId}/messages`, data),
  markRead: (threadId) => userAxios.post(`/consultations/threads/${threadId}/read`),
};

export const studentCaseApi = {
  list: (params) => userAxios.get('/cases', { params }), get: (caseId) => userAxios.get(`/cases/${caseId}`),
  decideProposal: (caseId, decision) => userAxios.post(`/cases/${caseId}/proposal-decision`, { decision }),
  decideApproval: (caseId, approvalId, decision, comment = '') => userAxios.post(`/cases/${caseId}/approvals/${approvalId}/decision`, { decision, comment }),
  completeTask: (caseId, taskId) => userAxios.post(`/cases/${caseId}/tasks/${taskId}/complete`),
  updateLifecycle: (caseId, lifecycle) => userAxios.post(`/cases/${caseId}/lifecycle`, { lifecycle }),
  getMessages: (caseId, params) => userAxios.get(`/cases/${caseId}/messages`, { params }), sendMessage: (caseId, text) => userAxios.post(`/cases/${caseId}/messages`, { text }),
};

export const studentTrustApi = {
  eligibility: (interactionType, interactionId) => userAxios.get('/reviews/eligibility', { params: { interactionType, interactionId } }),
  reviews: () => userAxios.get('/reviews/mine'), createReview: (data) => userAxios.post('/reviews', data), updateReview: (reviewId, data) => userAxios.patch(`/reviews/${reviewId}`, data),
  reports: () => userAxios.get('/reports/mine'), createReport: (data) => userAxios.post('/reports', data),
  disputes: () => userAxios.get('/disputes/mine'), openDispute: (data) => userAxios.post('/disputes', data), addDisputeEvent: (disputeId, data) => userAxios.post(`/disputes/${disputeId}/events`, data),
};

export const studentCommerceApi = { history: (params) => userAxios.get('/commerce/history', { params }), products: (params) => userAxios.get('/commerce/products', { params }), createOrder: (data, idempotencyKey) => userAxios.post('/commerce/orders', data, { headers: { 'Idempotency-Key': idempotencyKey } }) };
export const marketplacePaymentApi = { configuration: () => userAxios.get('/marketplace-payments/configuration'), createServiceOrder: (data, idempotencyKey) => userAxios.post('/marketplace-payments/service-orders', data, { headers: { 'Idempotency-Key': idempotencyKey } }), createIntent: (orderId, idempotencyKey) => userAxios.post('/marketplace-payments/intents', { orderId }, { headers: { 'Idempotency-Key': idempotencyKey } }) };
