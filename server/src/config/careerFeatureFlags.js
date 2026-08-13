/**
 * Feature flags for career domain rollout + migration (C.8.0.2A / C.8.0.7).
 */
import { resolveRolloutMode } from '../../../shared/career/migrationMap.js';

export function isTalentProfileEnabled() {
  return process.env.TALENT_PROFILE_ENABLED !== '0';
}

export function isTalentProfileDualWrite() {
  return process.env.TALENT_PROFILE_DUAL_WRITE === '1';
}

export function isTalentProfileReadFromCanonical() {
  return process.env.TALENT_PROFILE_READ_CANONICAL === '1';
}

export function isOpportunityApplicationEnabled() {
  return process.env.OPPORTUNITY_APPLICATION_ENABLED !== '0';
}

/**
 * Dual-write legacy Application/InternshipApplication → OpportunityApplication.
 * L.2.6 — defaults ON when Opportunity Applications are enabled so Apply → Tracker
 * works without requiring APPLICATION_DUAL_WRITE=1. Explicit `0` disables.
 */
export function isApplicationDualWrite() {
  if (process.env.APPLICATION_DUAL_WRITE === '0') return false;
  if (process.env.APPLICATION_DUAL_WRITE === '1') return true;
  return isOpportunityApplicationEnabled();
}

/** Prefer OpportunityApplication for user-facing career reads when enabled */
export function isApplicationReadFromCanonical() {
  return process.env.APPLICATION_READ_CANONICAL === '1';
}

export function isTimelineEnabled() {
  return process.env.TIMELINE_ENABLED !== '0';
}

export function isDocumentsPlatformEnabled() {
  return process.env.DOCUMENTS_PLATFORM_ENABLED !== '0';
}

/** Allow ProfileDocument → Document batch migration jobs */
export function isDocumentsMigrationEnabled() {
  return process.env.DOCUMENTS_MIGRATION_ENABLED === '1' || isDocumentsPlatformEnabled();
}

export function isCareerDashboardEnabled() {
  return process.env.CAREER_DASHBOARD_ENABLED !== '0';
}

/** Career Dashboard v2 (Career OS) widget set / layout (C.8.3) */
export function isCareerDashboardV2Enabled() {
  return process.env.CAREER_DASHBOARD_V2_ENABLED !== '0';
}

/** Persist hide/show + layout order per user */
export function isDashboardPersonalizationEnabled() {
  return process.env.DASHBOARD_PERSONALIZATION_ENABLED === '1';
}

/** Deterministic career scoring / readiness engine (C.8.2) */
export function isScoringEnabled() {
  return process.env.SCORING_ENABLED !== '0';
}

/** Career assessments / verified skills platform (C.8.4) */
export function isAssessmentsEnabled() {
  return process.env.ASSESSMENTS_ENABLED === '1';
}

export function isAssessmentResultsEnabled() {
  return process.env.ASSESSMENT_RESULTS_ENABLED === '1' && isAssessmentsEnabled();
}

/** Credential issuance from assessments (requires assessments + documents platform) */
export function isVerifiedCredentialsEnabled() {
  return process.env.VERIFIED_CREDENTIALS_ENABLED !== '0' && isDocumentsPlatformEnabled();
}

/** Employer Intelligence Platform (C.8.5) */
export function isEmployerIntelligenceEnabled() {
  return process.env.EMPLOYER_INTELLIGENCE_ENABLED !== '0';
}

/** Kill-switch for all migration background jobs */
export function isMigrationJobsEnabled() {
  return process.env.CAREER_MIGRATION_JOBS_ENABLED !== '0';
}

export function getTalentProfileRolloutMode() {
  return resolveRolloutMode({
    enabled: isTalentProfileEnabled(),
    dualWrite: isTalentProfileDualWrite(),
    readCanonical: isTalentProfileReadFromCanonical(),
  });
}

export function getApplicationRolloutMode() {
  return resolveRolloutMode({
    enabled: isOpportunityApplicationEnabled(),
    dualWrite: isApplicationDualWrite(),
    readCanonical: isApplicationReadFromCanonical(),
  });
}

export function getFeatureFlagMatrix() {
  return {
    talentProfile: {
      enabled: isTalentProfileEnabled(),
      dualWrite: isTalentProfileDualWrite(),
      readCanonical: isTalentProfileReadFromCanonical(),
      mode: getTalentProfileRolloutMode(),
    },
    opportunityApplication: {
      enabled: isOpportunityApplicationEnabled(),
      dualWrite: isApplicationDualWrite(),
      readCanonical: isApplicationReadFromCanonical(),
      mode: getApplicationRolloutMode(),
    },
    timeline: { enabled: isTimelineEnabled() },
    documentsPlatform: {
      enabled: isDocumentsPlatformEnabled(),
      migration: isDocumentsMigrationEnabled(),
    },
    careerDashboard: { enabled: isCareerDashboardEnabled() },
    careerDashboardV2: { enabled: isCareerDashboardV2Enabled() },
    dashboardPersonalization: { enabled: isDashboardPersonalizationEnabled() },
    scoring: { enabled: isScoringEnabled() },
    assessments: {
      enabled: isAssessmentsEnabled(),
      results: isAssessmentResultsEnabled(),
      verifiedCredentials: isVerifiedCredentialsEnabled(),
    },
    employerIntelligence: { enabled: isEmployerIntelligenceEnabled() },
    migrationJobs: { enabled: isMigrationJobsEnabled() },
  };
}
