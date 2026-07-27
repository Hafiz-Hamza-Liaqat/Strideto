import axios from 'axios';
import { API_BASE_URL } from '../constants';

const EMPLOYER_TOKEN_KEY = 'edurozgaar-employer-token';
const EMPLOYER_REFRESH_KEY = 'edurozgaar-employer-refresh-token';

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
  headers: { 'Content-Type': 'application/json' },
});

let employerRefreshPromise = null;

export function resetEmployerAxiosAuthState() {
  employerRefreshPromise = null;
}

employerAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(EMPLOYER_TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
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
        localStorage.removeItem(EMPLOYER_TOKEN_KEY);
        localStorage.removeItem(EMPLOYER_REFRESH_KEY);
        localStorage.removeItem('edurozgaar-employer');
      }
      return Promise.reject(err);
    }

    const refresh = localStorage.getItem(EMPLOYER_REFRESH_KEY);
    if (!refresh) {
      localStorage.removeItem(EMPLOYER_TOKEN_KEY);
      localStorage.removeItem('edurozgaar-employer');
      return Promise.reject(err);
    }

    original._retry = true;

    if (!employerRefreshPromise) {
      employerRefreshPromise = axios
        .post(`${API_BASE_URL}/auth/employer/refresh-token`, { refreshToken: refresh })
        .then((res) => {
          const { accessToken, refreshToken: newRefresh, employer } = res.data;
          localStorage.setItem(EMPLOYER_TOKEN_KEY, accessToken);
          if (newRefresh) localStorage.setItem(EMPLOYER_REFRESH_KEY, newRefresh);
          if (employer) localStorage.setItem('edurozgaar-employer', JSON.stringify(employer));
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
      localStorage.removeItem(EMPLOYER_TOKEN_KEY);
      localStorage.removeItem(EMPLOYER_REFRESH_KEY);
      localStorage.removeItem('edurozgaar-employer');
      resetEmployerAxiosAuthState();
      return Promise.reject(refreshErr);
    }
  }
);

export const EMPLOYER_TOKEN_STORAGE = EMPLOYER_TOKEN_KEY;
export const EMPLOYER_REFRESH_STORAGE = EMPLOYER_REFRESH_KEY;

export const employerAuthApi = {
  register: (payload) => axios.post(`${API_BASE_URL}/auth/employer/register`, payload),
  login: (email, password) => axios.post(`${API_BASE_URL}/auth/employer/login`, { email, password }),
  me: () => employerAxios.get('/employer/me'),
  logout: () => employerAxios.post('/auth/employer/logout'),
  refresh: (refreshToken) =>
    axios.post(`${API_BASE_URL}/auth/employer/refresh-token`, { refreshToken }),
};

export const employerApi = {
  dashboard: () => employerAxios.get('/employer/dashboard'),
  plans: () => employerAxios.get('/employer/plans'),
  getJobs: (params) => employerAxios.get('/employer/jobs', { params }),
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
  intelligenceCandidate: (id) => employerAxios.get(`/employer/intelligence/candidates/${id}`),
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
};
