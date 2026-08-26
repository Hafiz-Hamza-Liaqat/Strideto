import axiosInstance from './axiosBase';

const BASE = '/admin/education/programs';
const INSTITUTIONS = '/admin/education/institutions';

export const adminEducationProgramsApi = {
  list: (params) => axiosInstance.get(BASE, { params }),
  get: (id) => axiosInstance.get(`${BASE}/${id}`),
  create: (body) => axiosInstance.post(BASE, body),
  update: (id, body) => axiosInstance.patch(`${BASE}/${id}`, body),
  /** Canonical publication authority (sources required when publishing). */
  publishIntelligence: (id, body) => axiosInstance.patch(`${BASE}/${id}/intelligence`, body),
  listInstitutions: (params) => axiosInstance.get(INSTITUTIONS, { params }),
  listAcceptance: (params) => axiosInstance.get('/admin/education/acceptance', { params }),
};
