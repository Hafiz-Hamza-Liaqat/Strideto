import axiosInstance from './axiosBase';

export const privacyApi = {
  overview: () => axiosInstance.get('/privacy/overview'),
  listRequests: () => axiosInstance.get('/privacy/requests'),
  requestExport: () => axiosInstance.post('/privacy/requests/export'),
  requestDeletion: () => axiosInstance.post('/privacy/requests/deletion', { confirm: true }),
  cancelRequest: (id) => axiosInstance.post(`/privacy/requests/${id}/cancel`),
};

export const adminPrivacyApi = {
  list: (params) => axiosInstance.get('/admin/privacy-requests', { params }),
  updateStatus: (id, status) => axiosInstance.patch(`/admin/privacy-requests/${id}`, { status }),
};
