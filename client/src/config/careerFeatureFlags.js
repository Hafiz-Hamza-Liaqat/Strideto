/**
 * Client-side career feature flags (mirror server rollout — C.8.0.2B.2).
 */

export function isTalentProfileEnabled() {
  return import.meta.env.VITE_TALENT_PROFILE_ENABLED !== '0';
}

export function isTalentProfileReadCanonical() {
  return import.meta.env.VITE_TALENT_PROFILE_READ_CANONICAL === '1';
}

export function shouldUseTalentProfileApi() {
  return isTalentProfileEnabled();
}

export function isOpportunityApplicationEnabled() {
  return import.meta.env.VITE_OPPORTUNITY_APPLICATION_ENABLED !== '0';
}

export function isTimelineEnabled() {
  return import.meta.env.VITE_TIMELINE_ENABLED !== '0';
}

export function isDocumentsPlatformEnabled() {
  return import.meta.env.VITE_DOCUMENTS_PLATFORM_ENABLED !== '0';
}

export function isCareerDashboardEnabled() {
  return import.meta.env.VITE_CAREER_DASHBOARD_ENABLED !== '0';
}

export function isCareerDashboardV2Enabled() {
  return import.meta.env.VITE_CAREER_DASHBOARD_V2_ENABLED !== '0';
}

export function isDashboardPersonalizationEnabled() {
  return import.meta.env.VITE_DASHBOARD_PERSONALIZATION_ENABLED === '1';
}

export function isScoringEnabled() {
  return import.meta.env.VITE_SCORING_ENABLED !== '0';
}

export function isAssessmentsEnabled() {
  return import.meta.env.VITE_ASSESSMENTS_ENABLED === '1';
}

export function isEmployerIntelligenceEnabled() {
  return import.meta.env.VITE_EMPLOYER_INTELLIGENCE_ENABLED !== '0';
}

export function isApplicationReadCanonical() {
  return import.meta.env.VITE_APPLICATION_READ_CANONICAL === '1';
}

export function shouldUseOpportunityApplicationApi() {
  return isOpportunityApplicationEnabled();
}
