import axiosInstance from './axiosBase';

export function createAnnouncementsApi(httpClient, { urlPrefix = '' } = {}) {
  const path = (suffix) => `${urlPrefix}${suffix}`;
  return {
    feed: (params) => httpClient.get(path('/announcements/feed'), { params }),
    read: (id) => httpClient.post(path(`/announcements/${id}/read`)),
    ack: (id) => httpClient.post(path(`/announcements/${id}/ack`)),
    vote: (id, vote) => httpClient.post(path(`/announcements/${id}/vote`), { vote }),
  };
}

export const announcementsApi = createAnnouncementsApi(axiosInstance);
