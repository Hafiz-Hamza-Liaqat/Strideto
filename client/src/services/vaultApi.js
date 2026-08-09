import axiosInstance from './axiosBase';

export const vaultApi = {
  // Documents
  list: (params) => axiosInstance.get('/vault/documents', { params }),
  get: (id) => axiosInstance.get(`/vault/documents/${id}`),
  create: (formData) =>
    axiosInstance.post('/vault/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id, body) => axiosInstance.patch(`/vault/documents/${id}`, body),
  archive: (id) => axiosInstance.post(`/vault/documents/${id}/archive`),
  remove: (id) => axiosInstance.delete(`/vault/documents/${id}`),

  // Versions
  listVersions: (id) => axiosInstance.get(`/vault/documents/${id}/versions`),
  uploadVersion: (id, formData) =>
    axiosInstance.post(`/vault/documents/${id}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Access URL (server-mediated, never a raw storage URL)
  accessUrl: (id, opts = {}) => {
    const params = new URLSearchParams();
    if (opts.versionId) params.set('versionId', opts.versionId);
    if (opts.download) params.set('download', 'true');
    const qs = params.toString();
    return `/api/vault/documents/${id}/access${qs ? `?${qs}` : ''}`;
  },

  // Grants
  listGrants: (id) => axiosInstance.get(`/vault/documents/${id}/grants`),
  createGrant: (id, body) => axiosInstance.post(`/vault/documents/${id}/grants`, body),
  revokeGrant: (id, grantId) => axiosInstance.delete(`/vault/documents/${id}/grants/${grantId}`),
};
