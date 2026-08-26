import axiosInstance from './axiosBase';

const BASE = '/admin/education/institutions';

export const adminEducationInstitutionsApi = {
  list: (params) => axiosInstance.get(BASE, { params }),
  get: (id) => axiosInstance.get(`${BASE}/${id}`),
  create: (body) => axiosInstance.post(BASE, body),
  update: (id, body) => axiosInstance.patch(`${BASE}/${id}`, body),
};
