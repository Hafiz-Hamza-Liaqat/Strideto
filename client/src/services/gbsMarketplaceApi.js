import axiosInstance from './axiosBase';

function buildParams(params) {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value != null && value !== '') searchParams.set(key, String(value));
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const gbsMarketplaceApi = {
  enabled: () => axiosInstance.get('/business-services/enabled'),
  list: (params) => axiosInstance.get(`/business-services/listings${buildParams(params)}`),
  get: (slug) => axiosInstance.get(`/business-services/listings/${encodeURIComponent(slug)}`),
};
