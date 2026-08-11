import axiosInstance from './axiosBase';

/** Student Budget Planner — uses SEC-3 in-memory access token + HttpOnly refresh. */
export const budgetApi = {
  listPlans: (params) => axiosInstance.get('/budget/plans', { params }),
  getPlan: (id) => axiosInstance.get(`/budget/plans/${id}`),
  getSummary: (id) => axiosInstance.get(`/budget/plans/${id}/summary`),
  listItems: (id) => axiosInstance.get(`/budget/plans/${id}/items`),
  createPlan: (body) => axiosInstance.post('/budget/plans', body),
  archivePlan: (id) => axiosInstance.post(`/budget/plans/${id}/archive`),
  clonePlan: (id) => axiosInstance.post(`/budget/plans/${id}/clone`),
  addItem: (planId, body) => axiosInstance.post(`/budget/plans/${planId}/items`, body),
  removeItem: (planId, itemId) => axiosInstance.delete(`/budget/plans/${planId}/items/${itemId}`),
  refreshItem: (planId, itemId) => axiosInstance.post(`/budget/plans/${planId}/items/${itemId}/refresh`),
};
