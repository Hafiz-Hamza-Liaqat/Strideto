import axiosInstance from './axiosBase';

function buildParams(params) {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value != null && value !== '') searchParams.set(key, String(value));
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const gbsBuyerApi = {
  enabled: () => axiosInstance.get('/business/enabled'),
  activate: () => axiosInstance.post('/business/activate', {}),
  overview: () => axiosInstance.get('/business/overview'),
  list: (params) => axiosInstance.get(`/business/requests${buildParams(params)}`),
  get: (requestRef) => axiosInstance.get(`/business/requests/${encodeURIComponent(requestRef)}`),
  create: (data) => axiosInstance.post('/business/requests', data),
  cancel: (requestRef, expectedVersion) =>
    axiosInstance.post(`/business/requests/${encodeURIComponent(requestRef)}/cancel`, { expectedVersion }),
  listQuotes: (params) => axiosInstance.get(`/business/quotes${buildParams(params)}`),
  getQuote: (quoteRef) => axiosInstance.get(`/business/quotes/${encodeURIComponent(quoteRef)}`),
  acceptQuote: (quoteRef, expectedVersion) =>
    axiosInstance.post(`/business/quotes/${encodeURIComponent(quoteRef)}/accept`, { expectedVersion }),
  declineQuote: (quoteRef, expectedVersion, extra = {}) =>
    axiosInstance.post(`/business/quotes/${encodeURIComponent(quoteRef)}/decline`, { expectedVersion, ...extra }),
  ensureCase: (quoteRef, extra = {}) =>
    axiosInstance.post(`/business/quotes/${encodeURIComponent(quoteRef)}/case`, extra),
  listCases: (params) => axiosInstance.get(`/business/cases${buildParams(params)}`),
  getCase: (caseRef) => axiosInstance.get(`/business/cases/${encodeURIComponent(caseRef)}`),
  completeCaseTask: (caseRef, taskRef, expectedVersion, extra = {}) =>
    axiosInstance.post(
      `/business/cases/${encodeURIComponent(caseRef)}/tasks/${encodeURIComponent(taskRef)}/complete`,
      { expectedVersion, ...extra }
    ),
  cancelCase: (caseRef, expectedVersion, extra = {}) =>
    axiosInstance.post(`/business/cases/${encodeURIComponent(caseRef)}/cancel`, { expectedVersion, ...extra }),
  listCaseDocumentRequirements: (caseRef) =>
    axiosInstance.get(`/business/cases/${encodeURIComponent(caseRef)}/document-requirements`),
  updateRequirementFact: (caseRef, expectedVersion, extra = {}) =>
    axiosInstance.patch(`/business/cases/${encodeURIComponent(caseRef)}/requirement-facts`, {
      expectedVersion,
      ...extra,
    }),
};
