import axiosInstance from './axiosBase';

export const seoMeasurementApi = {
  dashboard: (params) => axiosInstance.get('/admin/seo-measurement', { params }),
  importSnapshot: (body) => axiosInstance.post('/admin/seo-measurement/snapshots', body),
};
