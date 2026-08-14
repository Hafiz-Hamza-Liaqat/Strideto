import axiosInstance from './axiosBase';

export const gbsAdminApi = {
  listCapabilities: (params) => axiosInstance.get('/admin/gbs/capabilities/queue', { params }),
  getCapability: (id) => axiosInstance.get(`/admin/gbs/capabilities/${id}`),
  reviewCapability: (id, action, body) =>
    axiosInstance.post(`/admin/gbs/capabilities/${id}/${action}`, body),
  listListings: (params) => axiosInstance.get('/admin/gbs/listings/queue', { params }),
  getListing: (id) => axiosInstance.get(`/admin/gbs/listings/${id}`),
  reviewListing: (id, action, body) =>
    axiosInstance.post(`/admin/gbs/listings/${id}/${action}`, body),
};
