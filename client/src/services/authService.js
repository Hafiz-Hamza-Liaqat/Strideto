import axiosInstance, { refreshUserAccessToken } from './axiosBase';

export const authApi = {
  register: (data) => axiosInstance.post('/auth/register', data),
  login: (data) => axiosInstance.post('/auth/login', data),
  logout: () => axiosInstance.post('/auth/logout'),
  logoutAll: () => axiosInstance.post('/auth/logout-all'),
  me: () => axiosInstance.get('/auth/me'),
  refreshToken: async () => {
    const accessToken = await refreshUserAccessToken();
    return { data: { accessToken } };
  },
  forgotPassword: (email) =>
    axiosInstance.post('/auth/forgot-password', { email }),
  resetPassword: (data) => axiosInstance.post('/auth/reset-password', data),
  verifyEmail: (data) => axiosInstance.post('/auth/verify-email', data),
  changePassword: (data) => axiosInstance.post('/auth/change-password', data),
  resendVerification: (email, realm) =>
    axiosInstance.post('/auth/resend-verification', {
      ...(email ? { email } : {}),
      ...(realm && realm !== 'user' ? { realm } : {}),
    }),
  getInvitation: (token) => axiosInstance.get('/auth/accept-invitation', { params: { token } }),
  acceptInvitation: (data) => axiosInstance.post('/auth/accept-invitation', data),
  getProfile: () => axiosInstance.get('/auth/profile'),
  updateProfile: (data) => axiosInstance.patch('/auth/profile', data),
};
