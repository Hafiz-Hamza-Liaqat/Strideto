import axiosInstance from './axiosBase';

const BASE = '/admin/education/scholarships';

export const adminEducationScholarshipsApi = {
  list: (params) => axiosInstance.get(BASE, { params }),
  get: (id) => axiosInstance.get(`${BASE}/${id}`),
  create: (body) => axiosInstance.post(BASE, body),
  update: (id, body) => axiosInstance.patch(`${BASE}/${id}`, body),
  listCycles: (scholarshipId) => axiosInstance.get(`${BASE}/${scholarshipId}/cycles`),
  listApplicability: (scholarshipId) => axiosInstance.get(`${BASE}/${scholarshipId}/applicability`),
  createApplicability: (scholarshipId, body) => axiosInstance.post(`${BASE}/${scholarshipId}/applicability`, body),
  updateApplicability: (scholarshipId, applicabilityId, body) =>
    axiosInstance.patch(`${BASE}/${scholarshipId}/applicability/${applicabilityId}`, body),
};
