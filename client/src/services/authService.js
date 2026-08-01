import axiosInstance from './axiosBase';

export const authApi = {
  register: (data) => axiosInstance.post('/auth/register', data),
  login: (data) => axiosInstance.post('/auth/login', data),
  logout: () => axiosInstance.post('/auth/logout'),
  logoutAll: () => axiosInstance.post('/auth/logout-all'),
  me: () => axiosInstance.get('/auth/me'),
  refreshToken: () => axiosInstance.post('/auth/refresh-token', {}),
  forgotPassword: (email) =>
    axiosInstance.post('/auth/forgot-password', { email }),
  resetPassword: (data) => axiosInstance.post('/auth/reset-password', data),
  verifyEmail: (data) => axiosInstance.post('/auth/verify-email', data),
  changePassword: (data) => axiosInstance.post('/auth/change-password', data),
  resendVerification: (email) =>
    axiosInstance.post('/auth/resend-verification', email ? { email } : {}),
  getInvitation: (token) => axiosInstance.get('/auth/accept-invitation', { params: { token } }),
  acceptInvitation: (data) => axiosInstance.post('/auth/accept-invitation', data),
  getProfile: () => axiosInstance.get('/auth/profile'),
  updateProfile: (data) => axiosInstance.patch('/auth/profile', data),
};
