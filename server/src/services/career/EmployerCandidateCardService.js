/**
 * Canonical employer-facing candidate projection (C.8.5).
 * Composes TalentProfile + Readiness + Credentials + Documents + OA + Timeline + Assessments.
 * Does not duplicate TalentProfile fields as a second model.
 */
import { TalentProfileReadService } from './TalentProfileReadService.js';
import { TalentProfileRepository } from '../../repositories/career/TalentProfileRepository.js';
import { ScoringService } from './ScoringService.js';
import { CredentialPlatformService } from './CredentialPlatformService.js';
import { DocumentService } from './DocumentService.js';
import { TimelineService } from './TimelineService.js';
import { AssessmentService } from './AssessmentService.js';
import { OpportunityApplicationRepository } from '../../repositories/career/OpportunityApplicationRepository.js';
import {
  isTalentProfileEnabled,
  isScoringEnabled,
  isDocumentsPlatformEnabled,
  isTimelineEnabled,
  isAssessmentsEnabled,
  isOpportunityApplicationEnabled,
} from '../../config/careerFeatureFlags.js';
import { LEGACY_STATUS_TO_PIPELINE } from '../../../../shared/employer/constants.js';
import { evaluateProfileCompleteness } from '../../../../shared/scoring/profileCompletenessRules.js';
import { buildHiringRecommendations } from '../../../../shared/employer/hiringRecommendations.js';
import { Job } from '../../models/Job.js';
import { ResumeVersionRepository } from '../../repositories/career/ResumeVersionRepository.js';

function workPreferenceFromProfile(profile) {
  const pref = profile?.preferences || profile?.workPreference || {};
  const modes = pref.workModes || pref.modes || [];
  if (Array.isArray(modes) && modes.length) return modes.join(', ');
  if (pref.remote != null) return pref.remote ? 'remote' : 'onsite';
  return profile?.availability || '';
}

function experienceYears(profile) {
  const exp = profile?.experience || [];
  if (!exp.length) return 0;
  let months = 0;
  for (const e of exp) {
    const start = e.startDate ? new Date(e.startDate).getTime() : null;
    const end = e.endDate ? new Date(e.endDate).getTime() : Date.now();
    if (start && end >= start) months += (end - start) / (30 * 24 * 60 * 60 * 1000);
  }
  return Math.round((months / 12) * 10) / 10;
}

function completionPercent(profile) {
  return evaluateProfileCompleteness(profile || {}).score;
}

function assessmentScoresByCategory(verifiedSkills = []) {
  const map = {};
  for (const s of verifiedSkills) {
    const cat = (s.categorySlug || s.category || s.skillName || 'general').toLowerCase();
    const score = Number(s.score) || 0;
    if (!map[cat] || score > map[cat]) map[cat] = score;
  }
  return map;
}

/**
 * Build employer Candidate Card for a talent user.
 * @param {string} userId
 * @param {object} [applicationCtx] - legacy Application and/or OpportunityApplication context
 */
export async function buildCandidateCard(userId, applicationCtx = {}) {
  if (!userId || !isTalentProfileEnabled()) return null;

  const baseCard = await TalentProfileReadService.getCandidateCardForUser(userId).catch(() => null);
  const profile = await TalentProfileRepository.findByUserId(userId).catch(() => null);
  if (!baseCard && !profile) return null;

  const legacy = applicationCtx.legacyApplication || null;

  const [
    readiness,
    resumeStrength,
    credentials,
    documents,
    timeline,
    verifiedSkills,
    opportunityApplication,
    _resumeVersions,
  ] = await Promise.all([
    isScoringEnabled()
      ? ScoringService.getLatest(userId, 'career_readiness', { computeIfMissing: false }).catch(() => null)
      : null,
    isScoringEnabled()
      ? ScoringService.getLatest(userId, 'resume_strength', { computeIfMissing: false }).catch(() => null)
      : null,
    CredentialPlatformService.listForUser(userId).catch(() => []),
    isDocumentsPlatformEnabled()
      ? DocumentService.listForUser(userId, { limit: 20 }).catch(() => [])
      : [],
    isTimelineEnabled()
      ? TimelineService.listForUser(userId, { limit: 8 }).catch(() => ({ data: [] }))
      : { data: [] },
    isAssessmentsEnabled()
      ? AssessmentService.getEmployerVisibleSkills(userId).catch(() => [])
      : [],
    resolveOpportunityApplication(userId, applicationCtx),
    profile?._id
      ? ResumeVersionRepository.findByProfileId(profile._id, { limit: 10 }).catch(() => [])
      : [],
  ]);

  const jobIdStr = legacy?.jobId
    ? String(legacy.jobId._id || legacy.jobId)
    : applicationCtx.jobId || null;
  let jobMatch = null;
  if (jobIdStr && isScoringEnabled()) {
    jobMatch = await ScoringService.computeJobMatch(userId, jobIdStr).catch(() => null);
  }
  const jobDoc = jobIdStr ? await Job.findById(jobIdStr).select('title type jobType remote hybrid').lean().catch(() => null) : null;
  const pipelineStage = opportunityApplication?.pipelineStage
    || LEGACY_STATUS_TO_PIPELINE[legacy?.status]
    || 'applied';

  const timelineItems = timeline?.data || timeline?.items || [];
  const docList = Array.isArray(documents) ? documents : (documents?.data || []);
  const credList = Array.isArray(credentials) ? credentials : (credentials?.data || []);

  const card = {
    // Identity — from TalentProfile projection only (no duplicated talent model)
    userId: String(userId),
    talentProfileId: baseCard?.talentProfileId || (profile?._id ? String(profile._id) : null),
    basic: {
      displayName: baseCard?.displayName || profile?.displayName || '',
      email: applicationCtx.userEmail || null,
      avatarUrl: profile?.avatarUrl || null,
    },
    headline: baseCard?.headline || profile?.headline || '',
    location: baseCard?.location || '',
    workPreference: workPreferenceFromProfile(profile),
    readiness: readiness
      ? {
          overall: readiness.overall,
          version: readiness.version,
          computedAt: readiness.computedAt,
          scoreType: readiness.scoreType || 'career_readiness',
        }
      : null,
    resumeStrength: resumeStrength
      ? {
          overall: resumeStrength.overall,
          version: resumeStrength.version,
          computedAt: resumeStrength.computedAt,
          scoreType: 'resume_strength',
        }
      : null,
    resumeQuality: resumeStrength
      ? { score: resumeStrength.overall, overall: resumeStrength.overall }
      : null,
    jobMatch: jobMatch
      ? {
          overall: jobMatch.overall,
          score: jobMatch.overall,
          strengths: jobMatch.strengths,
          missing: jobMatch.missing,
          missingRequirements: jobMatch.missingRequirements,
          explanation: jobMatch.explanation,
          deterministic: true,
          aiUsed: false,
        }
      : null,
    verifiedSkills: verifiedSkills || [],
    credentials: (credList || []).slice(0, 12).map((c) => ({
      _id: c._id,
      title: c.title,
      skillName: c.skillName,
      verificationStatus: c.verificationStatus || c.status,
      source: c.source,
      issuedAt: c.issuedAt || c.createdAt,
    })),
    resumeVersion: baseCard?.primaryResumeVersionId
      ? {
          id: baseCard.primaryResumeVersionId,
          title: baseCard.resumeTitle || null,
        }
      : null,
    documents: (docList || []).slice(0, 12).map((d) => ({
      _id: d._id,
      title: d.title || d.name,
      documentType: d.documentType || d.type,
      status: d.status,
      updatedAt: d.updatedAt,
    })),
    applicationHistory: buildApplicationHistory(legacy, opportunityApplication),
    timelineSummary: (timelineItems || []).slice(0, 8).map((e) => ({
      verb: e.verb,
      objectType: e.objectType,
      occurredAt: e.occurredAt || e.createdAt,
      metadata: e.metadata,
    })),
    interviewStatus: resolveInterviewStatus(opportunityApplication),
    pipelineStage,
    legacyApplicationId: legacy?._id ? String(legacy._id) : null,
    opportunityApplicationId: opportunityApplication?._id ? String(opportunityApplication._id) : null,
    jobId: legacy?.jobId ? String(legacy.jobId._id || legacy.jobId) : applicationCtx.jobId || null,
    jobTitle: applicationCtx.jobTitle || null,
    legacyStatus: legacy?.status || null,
    experienceSummary: baseCard?.experienceSummary || [],
    experienceYears: experienceYears(profile),
    profileCompleteness: completionPercent(profile),
    educationLevel: profile?.education?.[0]?.degree || null,
    province: profile?.personal?.province || profile?.location?.split(',')[0] || '',
    city: profile?.personal?.city || '',
    workMode: profile?.preferences?.workMode || null,
    employmentStatus: profile?.preferences?.employmentStatus || null,
    salaryExpectation: profile?.preferences?.salaryExpectation || null,
    hasPortfolio: (profile?.portfolioReferences?.length || 0) > 0,
    portfolioCount: profile?.portfolioReferences?.length || 0,
    assessmentScores: assessmentScoresByCategory(verifiedSkills || []),
    appliedAt: legacy?.appliedDate || legacy?.createdAt || null,
    jobType: jobDoc?.type || jobDoc?.jobType || null,
    recentActivityAt: timelineItems?.[0]?.occurredAt
      || timelineItems?.[0]?.createdAt
      || opportunityApplication?.updatedAt
      || legacy?.updatedAt
      || null,
    skills: baseCard?.skills || (profile?.skills || []).map((s) => s.name || s),
    visibility: baseCard?.visibility || profile?.visibility,
  };

  return {
    ...card,
    hiringRecommendations: buildHiringRecommendations(card),
  };
}

async function resolveOpportunityApplication(userId, applicationCtx) {
  if (!isOpportunityApplicationEnabled()) return null;
  if (applicationCtx.opportunityApplication) return applicationCtx.opportunityApplication;
  if (applicationCtx.legacyApplication?._id) {
    const byLegacy = await OpportunityApplicationRepository
      .findByLegacyApplicationId(applicationCtx.legacyApplication._id)
      .catch(() => null);
    if (byLegacy) return byLegacy;
  }
  if (applicationCtx.jobId && applicationCtx.talentProfileId) {
    return OpportunityApplicationRepository.findByTalentAndOpportunity(
      applicationCtx.talentProfileId,
      'job',
      applicationCtx.jobId
    ).catch(() => null);
  }
  return null;
}

function buildApplicationHistory(legacy, oa) {
  const history = [];
  if (oa?.stageHistory?.length) {
    for (const h of oa.stageHistory.slice(-10)) {
      history.push({
        source: 'opportunity_application',
        fromStage: h.fromStage,
        toStage: h.toStage,
        at: h.at,
        reason: h.reason,
      });
    }
  }
  if (legacy) {
    history.push({
      source: 'legacy_application',
      status: legacy.status,
      appliedAt: legacy.appliedDate || legacy.createdAt,
      updatedAt: legacy.updatedAt,
    });
  }
  return history;
}

/**
 * PF-EMP-INT-B1: appointment status reflects a persisted appointment only.
 *
 * `scheduledAt` is the sole evidence that an appointment exists. The pipeline
 * stage is deliberately not consulted: a candidate can sit in the `interview`
 * stage with nothing booked, and reporting that as 'scheduled' told the
 * Employer an appointment existed when none did. Stage remains available
 * separately as `pipelineStage` for any caller that needs it.
 */
function resolveInterviewStatus(oa) {
  if (oa?.interview?.scheduledAt) {
    return {
      scheduledAt: oa.interview.scheduledAt,
      mode: oa.interview.mode || oa.interview.type || null,
      status: oa.interview.outcome ? 'completed' : 'scheduled',
      location: oa.interview.location || null,
      // PF-EMP-INT-B3: the Employer form needs the joining link to prefill a
      // reschedule and to tell an identical save apart from a genuine one.
      // `notes` stays out of this projection on purpose — it is a single field
      // shared with the candidate (audit §17) and the ownership boundary is B4.
      meetingUrl: oa.interview.meetingUrl || null,
      outcome: oa.interview.outcome || null,
    };
  }
  // An outcome recorded without a surviving scheduledAt still means the
  // interview happened — preserve 'completed' rather than reporting 'none'.
  if (oa?.interview?.outcome) {
    return {
      scheduledAt: null,
      mode: oa.interview.mode || null,
      status: 'completed',
      location: oa.interview.location || null,
      meetingUrl: oa.interview.meetingUrl || null,
      outcome: oa.interview.outcome,
    };
  }
  return { status: 'none', scheduledAt: null, mode: null, location: null, meetingUrl: null, outcome: null };
}

export const EmployerCandidateCardService = {
  buildCandidateCard,
};
