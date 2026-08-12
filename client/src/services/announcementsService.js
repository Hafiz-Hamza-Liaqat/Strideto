import axiosInstance from './axiosBase';

export const announcementsApi = {
  feed: (params) => axiosInstance.get('/announcements/feed', { params }),
  read: (id) => axiosInstance.post(`/announcements/${id}/read`),
  ack: (id) => axiosInstance.post(`/announcements/${id}/ack`),
  vote: (id, vote) => axiosInstance.post(`/announcements/${id}/vote`, { vote }),
};
