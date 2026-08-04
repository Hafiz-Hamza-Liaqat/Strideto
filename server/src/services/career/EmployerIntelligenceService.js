/**
 * Employer Intelligence workspace service (C.8.5).
 * Composes TalentProfile / OpportunityApplication / Readiness / Credentials / Documents / Timeline.
 * Emits domain events; never calls Timeline/Analytics/Notifications directly from controllers.
 */
import { Job } from '../../models/Job.js';
import { Application } from '../../models/Application.js';
import { resolveJobApplyType } from '../employerApplicationCounts.js';
import { EmployerSavedFilter } from '../../models/career/EmployerSavedFilter.js';
import { OpportunityApplicationRepository } from '../../repositories/career/OpportunityApplicationRepository.js';
import { EmployerCandidateCardService } from './EmployerCandidateCardService.js';
import { EmployerRankingService } from './EmployerRankingService.js';
import { emitCareerEvent } from './CareerEventBus.js';
import { trackEmployerAnalyticsFromEvent } from './careerEmployerBridge.js';
import { onApplicationStatusChange } from '../automationService.js';
import { isEmployerIntelligenceEnabled } from '../../config/careerFeatureFlags.js';
import { PIPELINE_STAGES } from '../../../../shared/career/constants.js';
import {
  LEGACY_STATUS_TO_PIPELINE,
  PIPELINE_TO_LEGACY_STATUS,
} from '../../../../shared/employer/constants.js';
import { canTransition } from '../../../../shared/career/applicationStageMachine.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { JobVacancyService } from './JobVacancyService.js';

function disabledError() {
  const err = new Error('Employer intelligence is disabled');
  err.status = 503;
  throw err;
}

function assertEnabled() {
  if (!isEmployerIntelligenceEnabled()) disabledError();
}

function employerActor(employerId) {
  return { type: 'employer', id: String(employerId) };
}

async function assertJobOwned(employerId, jobId) {
  const job = await Job.findOne({ _id: jobId, employerId }).lean();
  if (!job) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }
  return job;
}

async function getEmployerJobIds(employerId) {
  return Job.find({ employerId }).distinct('_id');
}

async function getOwnedLegacyApplication(employerId, applicationId) {
  const application = await Application.findById(applicationId).populate('jobId').populate('userId', 'name email');
  if (!application || application.jobId?.employerId?.toString() !== String(employerId)) {
    const err = new Error('Application not found');
    err.status = 404;
    throw err;
  }
  return application;
}

function emitHiringEvent(eventType, payload, actor, meta = {}) {
  const event = emitCareerEvent(eventType, payload, {
    actor,
    aggregateType: meta.aggregateType || 'HiringAction',
    aggregateId: meta.aggregateId || payload.legacyApplicationId || payload.opportunityApplicationId,
    locale: meta.locale || 'en',
    market: meta.market,
  });
  trackEmployerAnalyticsFromEvent(event, {
    employerId: actor?.id,
    userId: payload.candidateUserId,
  });
  return event;
}

function matchesFilters(card, filters = {}) {
  const q = (filters.q || '').trim().toLowerCase();
  if (q) {
    const hay = [
      card.basic?.displayName,
      card.headline,
      card.location,
      card.city,
      card.province,
      ...(card.skills || []),
      ...(card.verifiedSkills || []).map((s) => s.skillName || s.title),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filters.jobId && String(card.jobId) !== String(filters.jobId)) return false;
  if (filters.pipelineStage && card.pipelineStage !== filters.pipelineStage) return false;
  if (filters.stage && card.pipelineStage !== filters.stage) return false;

  const numFilter = (val, minKey, maxKey) => {
    const min = filters[minKey];
    const max = filters[maxKey];
    if (min != null && min !== '' && Number.isFinite(Number(min)) && val < Number(min)) return false;
    if (max != null && max !== '' && Number.isFinite(Number(max)) && val > Number(max)) return false;
    return true;
  };

  if (!numFilter(card.readiness?.overall ?? 0, 'minReadiness', 'maxReadiness')) return false;
  if (!numFilter(card.resumeStrength?.overall ?? card.resumeQuality?.score ?? 0, 'minResumeQuality', 'maxResumeQuality')) return false;
  if (!numFilter(card.profileCompleteness ?? 0, 'minProfileCompletion', 'maxProfileCompletion')) return false;
  if (!numFilter(card.jobMatch?.overall ?? card.jobMatch?.score ?? 0, 'minJobMatch', 'maxJobMatch')) return false;
  if (!numFilter(card.experienceYears ?? 0, 'minExperience', 'maxExperience')) return false;

  if (filters.minAssessmentScore != null && filters.minAssessmentScore !== '') {
    const min = Number(filters.minAssessmentScore);
    const scores = Object.values(card.assessmentScores || {});
    const maxScore = scores.length ? Math.max(...scores) : 0;
    if (Number.isFinite(min) && maxScore < min) return false;
  }

  if (filters.location || filters.city) {
    const loc = (card.location || card.city || '').toLowerCase();
    const want = String(filters.location || filters.city).toLowerCase();
    if (want && !loc.includes(want)) return false;
  }
  if (filters.province) {
    const prov = (card.province || card.location || '').toLowerCase();
    if (!prov.includes(String(filters.province).toLowerCase())) return false;
  }
  if (filters.education) {
    const edu = (card.educationLevel || '').toLowerCase();
    if (!edu.includes(String(filters.education).toLowerCase())) return false;
  }
  if (filters.skill || filters.verifiedSkill) {
    const skillQ = String(filters.skill || filters.verifiedSkill).toLowerCase();
    const skills = [
      ...(card.skills || []),
      ...(card.verifiedSkills || []).map((s) => s.skillName || s.title || ''),
    ].map((s) => String(s).toLowerCase());
    if (!skills.some((s) => s.includes(skillQ))) return false;
  }
  if (filters.skillCategory) {
    const cat = String(filters.skillCategory).toLowerCase();
    const has = (card.verifiedSkills || []).some((s) =>
      String(s.categorySlug || s.category || '').toLowerCase().includes(cat),
    );
    if (!has) return false;
  }
  if (filters.hasCredential === '1' && !(card.credentials?.length)) return false;

  if (filters.workMode) {
    const wm = String(filters.workMode).toLowerCase();
    const pref = String(card.workMode || card.workPreference || '').toLowerCase();
    if (!pref.includes(wm)) return false;
  }
  if (filters.jobType) {
    const jt = String(filters.jobType).toLowerCase();
    if (String(card.jobType || '').toLowerCase() !== jt) return false;
  }

  if (filters.recentActivityDays != null && filters.recentActivityDays !== '') {
    const days = Number(filters.recentActivityDays);
    const at = card.recentActivityAt ? new Date(card.recentActivityAt).getTime() : 0;
    if (Number.isFinite(days) && days > 0) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      if (!at || at < cutoff) return false;
    }
  }

  if (filters.appliedAfter) {
    const applied = card.appliedAt ? new Date(card.appliedAt).getTime() : 0;
    const after = new Date(filters.appliedAfter).getTime();
    if (!applied || applied < after) return false;
  }
  if (filters.appliedBefore) {
    const applied = card.appliedAt ? new Date(card.appliedAt).getTime() : 0;
    const before = new Date(filters.appliedBefore).getTime();
    if (!applied || applied > before) return false;
  }

  return true;
}

function sortCandidates(cards, sortBy = 'best_match') {
  const list = [...cards];
  const key = sortBy || 'best_match';
  list.sort((a, b) => {
    switch (key) {
      case 'highest_readiness':
        return (b.readiness?.overall ?? 0) - (a.readiness?.overall ?? 0);
      case 'highest_resume_quality':
        return (b.resumeStrength?.overall ?? 0) - (a.resumeStrength?.overall ?? 0);
      case 'highest_job_match':
        return (b.jobMatch?.overall ?? 0) - (a.jobMatch?.overall ?? 0);
      case 'highest_assessment': {
        const maxA = Math.max(0, ...Object.values(a.assessmentScores || {}));
        const maxB = Math.max(0, ...Object.values(b.assessmentScores || {}));
        return maxB - maxA;
      }
      case 'newest':
        return new Date(b.appliedAt || 0).getTime() - new Date(a.appliedAt || 0).getTime();
      case 'best_match':
      default:
        return (b.ranking?.percent ?? 0) - (a.ranking?.percent ?? 0);
    }
  });
  return list;
}

async function loadCardsForEmployer(employerId, filters = {}) {
  const jobIds = filters.jobId
    ? [(await assertJobOwned(employerId, filters.jobId))._id]
    : await getEmployerJobIds(employerId);

  if (!jobIds.length) return [];

  const jobs = await Job.find({ _id: { $in: jobIds } })
    .select('title applyType applicationLink applyEmail')
    .lean();
  const jobTitleById = new Map(jobs.map((j) => [String(j._id), j.title]));

  // Employer-facing candidate cards are scoped to canonically-internal Jobs
  // only — the internal apply endpoint is the only normal writer of
  // Application, but this aggregation must not rely solely on that
  // invariant (historical/legacy/imported records, test fixtures, or a
  // future alternate writer could otherwise leak an external Job's stray
  // Application into the Employer's candidate list).
  const internalJobIds = jobs.filter((j) => resolveJobApplyType(j) === 'internal').map((j) => j._id);
  if (!internalJobIds.length) return [];

  const apps = await Application.find({ jobId: { $in: internalJobIds } })
    .populate('userId', 'name email')
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  const CONCURRENCY = 8;
  const cards = [];
  for (let i = 0; i < apps.length; i += CONCURRENCY) {
    const chunk = apps.slice(i, i + CONCURRENCY);
    const built = await Promise.all(
      chunk.map(async (app) => {
        const userId = app.userId?._id || app.userId;
        if (!userId) return null;
        const card = await EmployerCandidateCardService.buildCandidateCard(userId, {
          legacyApplication: app,
          jobId: String(app.jobId),
          jobTitle: jobTitleById.get(String(app.jobId)) || null,
          userEmail: app.userId?.email || null,
        });
        if (!card || !matchesFilters(card, filters)) return null;
        return card;
      })
    );
    for (const card of built) {
      if (card) cards.push(card);
    }
  }
  return cards;
}

function eventForPipelineStage(toStage) {
  switch (toStage) {
    case 'screening':
      return 'CandidateShortlisted';
    case 'interview':
      return 'InterviewScheduled';
    case 'offer':
    case 'negotiation':
      return 'OfferSent';
    case 'accepted':
    case 'joined':
      return toStage === 'joined' ? 'CandidateHired' : 'OfferAccepted';
    case 'rejected':
      return 'CandidateRejected';
    case 'withdrawn':
      return 'CandidateRejected';
    default:
      return null;
  }
}

export const EmployerIntelligenceService = {
  async listCandidates(employerId, query = {}) {
    assertEnabled();
    const filters = {
      q: query.q,
      jobId: query.jobId || null,
      pipelineStage: query.pipelineStage || query.stage || null,
      stage: query.stage || query.pipelineStage || null,
      minReadiness: query.minReadiness,
      maxReadiness: query.maxReadiness,
      minResumeQuality: query.minResumeQuality,
      minProfileCompletion: query.minProfileCompletion,
      minJobMatch: query.minJobMatch,
      minExperience: query.minExperience,
      minAssessmentScore: query.minAssessmentScore,
      location: query.location,
      city: query.city,
      province: query.province,
      education: query.education,
      skill: query.skill,
      verifiedSkill: query.verifiedSkill,
      skillCategory: query.skillCategory,
      hasCredential: query.hasCredential,
      workMode: query.workMode,
      jobType: query.jobType,
      recentActivityDays: query.recentActivityDays,
      appliedAfter: query.appliedAfter,
      appliedBefore: query.appliedBefore,
    };
    const cards = await loadCardsForEmployer(employerId, filters);
    const ranked = EmployerRankingService.rankCandidates(cards);
    const sorted = sortCandidates(ranked, query.sort || query.sortBy || 'best_match');
    return {
      data: sorted,
      meta: {
        total: sorted.length,
        rankingVersion: EmployerRankingService.getWeights().version,
        filters,
        sort: query.sort || query.sortBy || 'best_match',
      },
    };
  },

  async compareCandidates(employerId, legacyApplicationIds = []) {
    assertEnabled();
    const ids = [...new Set((legacyApplicationIds || []).map(String))].slice(0, 4);
    if (ids.length < 2) {
      const err = new Error('At least 2 candidate application IDs required');
      err.status = 400;
      throw err;
    }
    const rows = [];
    for (const id of ids) {
      const detail = await this.getCandidateDetail(employerId, id, { recordView: false });
      rows.push({
        legacyApplicationId: detail.legacyApplicationId,
        displayName: detail.basic?.displayName,
        jobMatch: detail.jobMatch?.overall ?? null,
        resumeQuality: detail.resumeStrength?.overall ?? detail.resumeQuality?.score ?? null,
        readiness: detail.readiness?.overall ?? null,
        communication: detail.assessmentScores?.communication ?? detail.assessmentScores?.communication_skills ?? null,
        iq: detail.assessmentScores?.iq ?? detail.assessmentScores?.logical_reasoning ?? null,
        english: detail.assessmentScores?.english ?? null,
        verifiedSkillsCount: (detail.verifiedSkills || []).length,
        experienceYears: detail.experienceYears,
        profileCompleteness: detail.profileCompleteness,
        pipelineStage: detail.pipelineStage,
        ranking: detail.ranking,
        hiringRecommendations: detail.hiringRecommendations || [],
        assessmentScores: detail.assessmentScores || {},
      });
    }
    return { candidates: rows, meta: { count: rows.length, deterministic: true, aiUsed: false } };
  },

  async getCandidateDetail(employerId, legacyApplicationId, { recordView = true } = {}) {
    assertEnabled();
    const application = await getOwnedLegacyApplication(employerId, legacyApplicationId);
    const plain = application.toObject ? application.toObject() : application;
    const userId = plain.userId?._id || plain.userId;
    const job = plain.jobId;
    const card = await EmployerCandidateCardService.buildCandidateCard(userId, {
      legacyApplication: plain,
      jobId: String(job?._id || job),
      jobTitle: job?.title || null,
      userEmail: plain.userId?.email || null,
    });
    if (!card) {
      const err = new Error('Candidate profile not available');
      err.status = 404;
      throw err;
    }

    if (recordView) {
      emitHiringEvent(
        'CandidateViewed',
        {
          candidateUserId: String(userId),
          talentProfileId: card.talentProfileId,
          legacyApplicationId: String(plain._id),
          opportunityApplicationId: card.opportunityApplicationId,
          jobId: card.jobId,
          pipelineStage: card.pipelineStage,
        },
        employerActor(employerId),
        { aggregateId: plain._id }
      );
    }

    const ranking = EmployerRankingService.rankCandidate(card);
    return { ...card, ranking };
  },

  async getPipeline(employerId, query = {}) {
    assertEnabled();
    const { data } = await this.listCandidates(employerId, query);
    const columns = {};
    for (const stage of PIPELINE_STAGES) columns[stage] = [];
    for (const card of data) {
      const stage = card.pipelineStage || 'applied';
      if (!columns[stage]) columns[stage] = [];
      columns[stage].push(card);
    }
    return {
      stages: PIPELINE_STAGES,
      columns,
      meta: { total: data.length },
    };
  },

  async transitionPipeline(employerId, legacyApplicationId, body = {}) {
    assertEnabled();
    const application = await getOwnedLegacyApplication(employerId, legacyApplicationId);
    const toStage = sanitizeString(body.toStage || body.pipelineStage || '');
    if (!PIPELINE_STAGES.includes(toStage)) {
      const err = new Error('Invalid pipeline stage');
      err.status = 400;
      throw err;
    }

    const fromLegacy = application.status;
    const fromStage = LEGACY_STATUS_TO_PIPELINE[fromLegacy] || 'applied';
    const legacyStatus = PIPELINE_TO_LEGACY_STATUS[toStage] || application.status;

    application.status = legacyStatus;
    await application.save();
    try {
      await onApplicationStatusChange(application);
    } catch {
      /* non-blocking */
    }

    const oa = await OpportunityApplicationRepository.findByLegacyApplicationId(application._id);
    let oaSync = 'none';
    if (oa) {
      const allowed = canTransition(oa.stageTemplateId || 'job_default', oa.pipelineStage, toStage);
      const historyEntry = {
        fromStage: oa.pipelineStage,
        toStage,
        at: new Date(),
        byActorType: 'employer',
        byActorId: String(employerId),
        reason: sanitizeString(body.reason || '') || 'employer_transition',
        metadata: {
          source: 'employer_intelligence',
          forced: !allowed,
        },
      };
      // Employer owns hiring stage projection — sync OA even when talent template would block
      await OpportunityApplicationRepository.pushStageHistory(oa._id, historyEntry);
      oaSync = allowed ? 'synced' : 'forced';
    }

    const hireEvent = eventForPipelineStage(toStage);
    if (hireEvent) {
      emitHiringEvent(
        hireEvent,
        {
          candidateUserId: String(application.userId?._id || application.userId),
          talentProfileId: application.talentProfileId ? String(application.talentProfileId) : null,
          legacyApplicationId: String(application._id),
          opportunityApplicationId: oa?._id ? String(oa._id) : null,
          jobId: String(application.jobId?._id || application.jobId),
          fromStage,
          toStage,
          reason: body.reason || null,
          oaSync,
        },
        employerActor(employerId),
        { aggregateId: application._id }
      );
    }

    if (['accepted', 'joined', 'hired'].includes(toStage) || ['hired', 'accepted'].includes(legacyStatus)) {
      try {
        await JobVacancyService.syncVacancyAfterHire(application.jobId?._id || application.jobId);
      } catch {
        /* non-blocking */
      }
    }

    return this.getCandidateDetail(employerId, legacyApplicationId, { recordView: false });
  },

  async addNote(employerId, legacyApplicationId, body = {}) {
    assertEnabled();
    const application = await getOwnedLegacyApplication(employerId, legacyApplicationId);
    const text = sanitizeString(body.text || body.body || '').slice(0, 4000);
    if (!text) {
      const err = new Error('Note text is required');
      err.status = 400;
      throw err;
    }

    const oa = await OpportunityApplicationRepository.findByLegacyApplicationId(application._id);
    let note = null;
    if (oa) {
      note = {
        body: text,
        visibility: body.visibility === 'private' ? 'private' : 'employer_scoped',
        createdAt: new Date(),
        createdByActorType: 'employer',
        createdByActorId: String(employerId),
      };
      await OpportunityApplicationRepository.pushNote(oa._id, note);
    } else {
      const existing = application.note ? `${application.note}\n---\n` : '';
      application.note = `${existing}${text}`.slice(0, 8000);
      await application.save();
      note = { body: text, visibility: 'employer_scoped', createdAt: new Date() };
    }

    emitHiringEvent(
      'HiringNoteAdded',
      {
        candidateUserId: String(application.userId?._id || application.userId),
        legacyApplicationId: String(application._id),
        opportunityApplicationId: oa?._id ? String(oa._id) : null,
        notePreview: text.slice(0, 120),
      },
      employerActor(employerId),
      { aggregateId: application._id }
    );

    return { note, applicationId: String(application._id) };
  },

  async scheduleInterview(employerId, legacyApplicationId, body = {}) {
    assertEnabled();
    const application = await getOwnedLegacyApplication(employerId, legacyApplicationId);
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      const err = new Error('scheduledAt is required');
      err.status = 400;
      throw err;
    }

    const interview = {
      scheduledAt,
      mode: sanitizeString(body.mode || body.type || 'video') || 'video',
      location: sanitizeString(body.location || '') || '',
      notes: sanitizeString(body.notes || '') || '',
      outcome: '',
    };

    const oa = await OpportunityApplicationRepository.findByLegacyApplicationId(application._id);
    if (oa) {
      await OpportunityApplicationRepository.setInterview(oa._id, interview);
      if (canTransition(oa.stageTemplateId || 'job_default', oa.pipelineStage, 'interview')) {
        await OpportunityApplicationRepository.pushStageHistory(oa._id, {
          fromStage: oa.pipelineStage,
          toStage: 'interview',
          at: new Date(),
          byActorType: 'employer',
          byActorId: String(employerId),
          reason: 'interview_scheduled',
          metadata: {},
        });
      }
    }

    if (application.status !== 'interview' && application.status !== 'hired') {
      application.status = 'interview';
      await application.save();
      try {
        await onApplicationStatusChange(application);
      } catch {
        /* non-blocking */
      }
    }

    emitHiringEvent(
      'InterviewScheduled',
      {
        candidateUserId: String(application.userId?._id || application.userId),
        legacyApplicationId: String(application._id),
        opportunityApplicationId: oa?._id ? String(oa._id) : null,
        scheduledAt: interview.scheduledAt,
        mode: interview.mode,
        location: interview.location,
      },
      employerActor(employerId),
      { aggregateId: application._id }
    );

    return { interview, applicationId: String(application._id) };
  },

  async completeInterview(employerId, legacyApplicationId, body = {}) {
    assertEnabled();
    const application = await getOwnedLegacyApplication(employerId, legacyApplicationId);
    const oa = await OpportunityApplicationRepository.findByLegacyApplicationId(application._id);
    if (oa?.interview) {
      await OpportunityApplicationRepository.setInterview(oa._id, {
        ...oa.interview,
        outcome: sanitizeString(body.outcome || 'completed') || 'completed',
        notes: sanitizeString(body.notes || oa.interview.notes || ''),
      });
    }
    emitHiringEvent(
      'InterviewCompleted',
      {
        candidateUserId: String(application.userId?._id || application.userId),
        legacyApplicationId: String(application._id),
        opportunityApplicationId: oa?._id ? String(oa._id) : null,
        outcome: sanitizeString(body.outcome || '') || null,
      },
      employerActor(employerId),
      { aggregateId: application._id }
    );
    return this.getCandidateDetail(employerId, legacyApplicationId, { recordView: false });
  },

  async listSavedFilters(employerId) {
    assertEnabled();
    return EmployerSavedFilter.find({ employerId }).sort({ updatedAt: -1 }).lean();
  },

  async saveFilter(employerId, body = {}) {
    assertEnabled();
    const name = sanitizeString(body.name || '').slice(0, 120);
    if (!name) {
      const err = new Error('Filter name is required');
      err.status = 400;
      throw err;
    }
    const filters = {
      q: sanitizeString(body.filters?.q || '') || '',
      jobId: body.filters?.jobId || null,
      pipelineStage: body.filters?.pipelineStage || null,
      minReadiness: body.filters?.minReadiness ?? null,
      location: sanitizeString(body.filters?.location || '') || '',
      skill: sanitizeString(body.filters?.skill || '') || '',
    };
    const doc = await EmployerSavedFilter.findOneAndUpdate(
      { employerId, name },
      { $set: { filters } },
      { upsert: true, new: true, runValidators: true }
    );
    return doc.toObject();
  },

  async deleteSavedFilter(employerId, filterId) {
    assertEnabled();
    const result = await EmployerSavedFilter.deleteOne({ _id: filterId, employerId });
    if (!result.deletedCount) {
      const err = new Error('Saved filter not found');
      err.status = 404;
      throw err;
    }
    return { ok: true };
  },

  async getRankingWeights() {
    assertEnabled();
    return EmployerRankingService.getWeights();
  },

  async getTimelineViewer(employerId, legacyApplicationId) {
    assertEnabled();
    const detail = await this.getCandidateDetail(employerId, legacyApplicationId, { recordView: false });
    return { timelineSummary: detail.timelineSummary || [], candidateUserId: detail.userId };
  },

  async getDocumentViewer(employerId, legacyApplicationId) {
    assertEnabled();
    const detail = await this.getCandidateDetail(employerId, legacyApplicationId, { recordView: false });
    return { documents: detail.documents || [], resumeVersion: detail.resumeVersion };
  },

  async getCredentialViewer(employerId, legacyApplicationId) {
    assertEnabled();
    const detail = await this.getCandidateDetail(employerId, legacyApplicationId, { recordView: false });
    return {
      credentials: detail.credentials || [],
      verifiedSkills: detail.verifiedSkills || [],
    };
  },
};
