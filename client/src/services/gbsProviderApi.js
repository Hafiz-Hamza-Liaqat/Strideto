import { agentAxios } from './agentService';

function subjectParams(subject) {
  return {
    subjectType: subject?.subjectType,
    subjectId: subject?.subjectId,
  };
}

const base = '/api/agent/business-services';

export const gbsProviderApi = {
  getEnabled: () => agentAxios.get(`${base}/enabled`),
  getContext: () => agentAxios.get(`${base}/context`),
  getOverview: (subject) => agentAxios.get(`${base}/overview`, { params: subjectParams(subject) }),
  getCatalog: () => agentAxios.get(`${base}/catalog`),
  listCapabilities: (subject) =>
    agentAxios.get(`${base}/capabilities`, { params: subjectParams(subject) }),
  claimCapability: (subject, data) =>
    agentAxios.post(`${base}/capabilities`, { ...data, ...subjectParams(subject) }),
  updateCapabilityScope: (subject, id, data) =>
    agentAxios.patch(`${base}/capabilities/${id}`, { ...data, ...subjectParams(subject) }),
  submitEvidence: (subject, id, data) =>
    agentAxios.post(`${base}/capabilities/${id}/evidence`, { ...data, ...subjectParams(subject) }),
  listListings: (subject, params = {}) =>
    agentAxios.get(`${base}/listings`, { params: { ...subjectParams(subject), ...params } }),
  getListing: (subject, listingId) =>
    agentAxios.get(`${base}/listings/${listingId}`, { params: subjectParams(subject) }),
  createListing: (subject, data, creationCommandId) =>
    agentAxios.post(`${base}/listings`, {
      ...data,
      ...subjectParams(subject),
      creationCommandId,
    }),
  updateListing: (subject, listingId, data) =>
    agentAxios.patch(`${base}/listings/${listingId}`, { ...data, ...subjectParams(subject) }),
  submitListing: (subject, listingId, expectedVersion) =>
    agentAxios.post(`${base}/listings/${listingId}/submit`, {
      ...subjectParams(subject),
      expectedVersion,
    }),
  archiveListing: (subject, listingId, expectedVersion) =>
    agentAxios.post(`${base}/listings/${listingId}/archive`, {
      ...subjectParams(subject),
      expectedVersion,
    }),
};
