import axios from 'axios';
import { API_BASE_URL } from '../constants';

/**
 * SEC-3E — secure Employer-realm client contract, mirroring
 * `axiosBase.js`'s User-realm cutover exactly: access token in memory
 * only, refresh token exclusively as an `HttpOnly` cookie via
 * `withCredentials: true`, never a body/header refresh token.
 */
let inMemoryEmployerAccessToken = null;

export function getEmployerAccessToken() {
  return inMemoryEmployerAccessToken;
}

export function setEmployerAccessToken(token) {
  inMemoryEmployerAccessToken = token || null;
}

export function clearEmployerAccessToken() {
  inMemoryEmployerAccessToken = null;
}

const EMPLOYER_NO_REFRESH = [
  '/auth/employer/login',
  '/auth/employer/register',
  '/auth/employer/refresh-token',
  '/auth/employer/logout',
];

function isEmployerNoRefreshUrl(url = '') {
  return EMPLOYER_NO_REFRESH.some((path) => url.includes(path));
}

const employerAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let employerRefreshPromise = null;

export function resetEmployerAxiosAuthState() {
  employerRefreshPromise = null;
}

employerAxios.interceptors.request.use(
  (config) => {
    if (inMemoryEmployerAccessToken) config.headers.Authorization = `Bearer ${inMemoryEmployerAccessToken}`;
    return config;
  },
  (e) => Promise.reject(e)
);

employerAxios.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;

    if (!original || status === 429) {
      return Promise.reject(err);
    }

    if (status !== 401 || original._retry || isEmployerNoRefreshUrl(original.url)) {
      if (status === 401 && !isEmployerNoRefreshUrl(original.url)) {
        clearEmployerAccessToken();
      }
      return Promise.reject(err);
    }

    original._retry = true;

    if (!employerRefreshPromise) {
      employerRefreshPromise = axios
        .post(`${API_BASE_URL}/auth/employer/refresh-token`, {}, { withCredentials: true })
        .then((res) => {
          const { accessToken } = res.data;
          setEmployerAccessToken(accessToken);
          return accessToken;
        })
        .finally(() => {
          employerRefreshPromise = null;
        });
    }

    try {
      const newToken = await employerRefreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return employerAxios(original);
    } catch (refreshErr) {
      clearEmployerAccessToken();
      resetEmployerAxiosAuthState();
      return Promise.reject(refreshErr);
    }
  }
);

export const employerAuthApi = {
  register: (payload) => employerAxios.post('/auth/employer/register', payload),
  login: (email, password) => employerAxios.post('/auth/employer/login', { email, password }),
  me: () => employerAxios.get('/employer/me'),
  logout: () => employerAxios.post('/auth/employer/logout'),
  logoutAll: () => employerAxios.post('/auth/employer/logout-all'),
  changePassword: (payload) => employerAxios.post('/auth/employer/change-password', payload),
  refresh: () => employerAxios.post('/auth/employer/refresh-token', {}),
};

export const employerApi = {
  dashboard: () => employerAxios.get('/employer/dashboard'),
  plans: () => employerAxios.get('/employer/plans'),
  getJobs: (params) => employerAxios.get('/employer/jobs', { params }),
  // Bounded, minimal-projection list of ALL jobs for picker dropdowns (does not
  // silently cap at the paginated list's page size).
  getJobOptions: () => employerAxios.get('/employer/jobs/selector'),
  getJob: (id) => employerAxios.get(`/employer/jobs/${id}`),
  createJob: (body) => employerAxios.post('/employer/jobs', body),
  updateJob: (id, body) => employerAxios.patch(`/employer/jobs/${id}`, body),
  closeJob: (id) => employerAxios.post(`/employer/jobs/${id}/close`),
  reopenJob: (id) => employerAxios.post(`/employer/jobs/${id}/reopen`),
  updateProfile: (body) => employerAxios.patch('/employer/profile', body),
  activateJob: (id, body) => employerAxios.post(`/employer/jobs/${id}/activate`, body),
  createCheckout: (id, body) => employerAxios.post(`/employer/jobs/${id}/checkout`, body),
  getJobApplications: (jobId) => employerAxios.get(`/employer/jobs/${jobId}/applications`),
  updateApplicationStatus: (applicationId, status) =>
    employerAxios.patch(`/employer/applications/${applicationId}`, { status }),
  jobAnalytics: (jobId) => employerAxios.get(`/employer/analytics/${jobId}`),
  intelligenceDashboard: () => employerAxios.get('/employer/intelligence/dashboard'),
  intelligenceCandidates: (params) => employerAxios.get('/employer/intelligence/candidates', { params }),
  intelligenceCandidate: (id, { recordView = false } = {}) =>
    employerAxios.get(`/employer/intelligence/candidates/${id}`, { params: { recordView } }),
  intelligencePipeline: (params) => employerAxios.get('/employer/intelligence/pipeline', { params }),
  intelligenceTransitionStage: (id, body) =>
    employerAxios.post(`/employer/intelligence/candidates/${id}/stage`, body),
  intelligenceAddNote: (id, body) =>
    employerAxios.post(`/employer/intelligence/candidates/${id}/notes`, body),
  intelligenceScheduleInterview: (id, body) =>
    employerAxios.put(`/employer/intelligence/candidates/${id}/interview`, body),
  intelligenceCompleteInterview: (id, body) =>
    employerAxios.post(`/employer/intelligence/candidates/${id}/interview/complete`, body),
  intelligenceSavedFilters: () => employerAxios.get('/employer/intelligence/saved-filters'),
  intelligenceSaveFilter: (body) => employerAxios.post('/employer/intelligence/saved-filters', body),
  intelligenceDeleteFilter: (id) => employerAxios.delete(`/employer/intelligence/saved-filters/${id}`),
  intelligenceRankingWeights: () => employerAxios.get('/employer/intelligence/ranking/weights'),
  intelligenceCompareCandidates: (ids) =>
    employerAxios.post('/employer/intelligence/candidates/compare', { legacyApplicationIds: ids }),

  /**
   * Read one applicant's skill claims and safe evidence metadata.
   *
   * Employer-realm on purpose: the route is guarded by `requireEmployerAuth`
   * and the server independently checks this applicant actually applied to one
   * of this employer's jobs — so it must carry the employer token, not the
   * User-realm one. Read-only; there is no employer path that writes trust.
   */
  applicantSkills: (applicantUserId, params) =>
    employerAxios.get(`/employer/applicants/${applicantUserId}/skills`, { params }),
};

/**
 * Employer-realm notification inbox. Hits the same /inbox/notifications
 * routes the User realm uses — those routes are already realm-agnostic
 * (requireAuth only) and the controller already scopes strictly by
 * req.employer when present, so no new server route was needed.
 */
export const employerInboxApi = {
  list: (params) => employerAxios.get('/inbox/notifications', { params }),
  unreadCount: () => employerAxios.get('/inbox/notifications/unread-count'),
  markRead: (id) => employerAxios.patch(`/inbox/notifications/${id}/read`),
  markAllRead: () => employerAxios.post('/inbox/notifications/mark-all-read'),
  remove: (id) => employerAxios.delete(`/inbox/notifications/${id}`),
};
