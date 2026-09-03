/**
 * Personalization API client — Mission 8.
 *
 * All calls are authenticated and operate on the logged-in user's own profile.
 * Never passes a userId param — server derives identity from the JWT.
 */
import axiosInstance from './axiosBase';

function buildParams(params) {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value != null && value !== '') searchParams.set(key, value);
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const personalizationApi = {
  guidance: () => axiosInstance.get('/personalization/guidance'),
  // Recommendations
  programRecommendations: (params) =>
    axiosInstance.get(`/personalization/recommendations/programs${buildParams(params)}`),

  scholarshipRecommendations: (params) =>
    axiosInstance.get(`/personalization/recommendations/scholarships${buildParams(params)}`),

  // Eligibility detail
  programEligibility: (programId) =>
    axiosInstance.get(`/personalization/programs/${programId}/eligibility`),

  scholarshipEligibility: (scholarshipId) =>
    axiosInstance.get(`/personalization/scholarships/${scholarshipId}/eligibility`),

  // Gap analysis
  gapAnalysis: () =>
    axiosInstance.get('/personalization/gaps'),

  // Profile-aware test guidance
  programTestGuidance: (programId) =>
    axiosInstance.get(`/personalization/programs/${programId}/test-guidance`),
};
