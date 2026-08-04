/**
 * Employer Dashboard composition (C.8.5) — mirrors Career Dashboard V2 architecture.
 * Widgets are presentational; providers project from shared context only.
 */
import { Job } from '../../models/Job.js';
import { Application } from '../../models/Application.js';
import { resolveJobApplyType } from '../employerApplicationCounts.js';
import { EmployerIntelligenceService } from './EmployerIntelligenceService.js';
import {
  EMPLOYER_DASHBOARD_WIDGET_DEFINITIONS,
  DEFAULT_EMPLOYER_DASHBOARD_LAYOUT,
  resolveEnabledEmployerWidgets,
  filterEmployerLayoutByEnabled,
} from '../../../../shared/employer/employerDashboardWidgetRegistry.js';
import {
  isEmployerIntelligenceEnabled,
  isTalentProfileEnabled,
  isOpportunityApplicationEnabled,
  isTimelineEnabled,
  isScoringEnabled,
  isAssessmentsEnabled,
} from '../../config/careerFeatureFlags.js';
import { platformCacheGet, platformCacheSet } from '../../config/cache.js';
import { PIPELINE_STAGES } from '../../../../shared/career/constants.js';
import { LEGACY_STATUS_TO_PIPELINE } from '../../../../shared/employer/constants.js';

const CACHE_NS = 'employer';
const CACHE_TTL_MS = 90_000;

function buildFlags() {
  return {
    employerIntelligence: isEmployerIntelligenceEnabled(),
    talentProfile: isTalentProfileEnabled(),
    opportunityApplication: isOpportunityApplicationEnabled(),
    timeline: isTimelineEnabled(),
    scoring: isScoringEnabled(),
    assessments: isAssessmentsEnabled(),
  };
}

async function loadSharedContext(employerId, flags) {
  const ctx = {
    employerId,
    flags,
    jobs: [],
    applications: [],
    rankedCandidates: [],
    pipelineCounts: {},
  };

  const jobs = await Job.find({ employerId })
    .select('title status applicationsCount views deadline createdAt applyType applicationLink applyEmail')
    .lean();
  ctx.jobs = jobs;

  // Application aggregation is scoped to canonically-internal Jobs only —
  // matches the Employer Dashboard's own explicit internal-Job filter
  // (employerDashboardMetrics.js) rather than relying on the historical
  // cleanliness of the Application collection (see resolveJobApplyType).
  const internalJobIds = jobs.filter((j) => resolveJobApplyType(j) === 'internal').map((j) => j._id);
  const apps = internalJobIds.length
    ? await Application.find({ jobId: { $in: internalJobIds } })
      .select('status jobId userId appliedDate updatedAt createdAt')
      .lean()
    : [];
  ctx.applications = apps;

  const pipelineCounts = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, 0]));
  for (const app of apps) {
    const stage = LEGACY_STATUS_TO_PIPELINE[app.status] || 'applied';
    pipelineCounts[stage] = (pipelineCounts[stage] || 0) + 1;
  }
  ctx.pipelineCounts = pipelineCounts;

  if (flags.employerIntelligence) {
    try {
      const listed = await EmployerIntelligenceService.listCandidates(employerId, {});
      ctx.rankedCandidates = listed.data || [];
    } catch {
      ctx.rankedCandidates = [];
    }
  }

  return ctx;
}

const PROVIDERS = {
  hiringOverviewProvider: (ctx) => ({
    activeJobs: ctx.jobs.filter((j) => j.status === 'active').length,
    totalJobs: ctx.jobs.length,
    totalApplications: ctx.applications.length,
    shortlisted: ctx.pipelineCounts.screening || 0,
    interviews: ctx.pipelineCounts.interview || 0,
    offers: (ctx.pipelineCounts.offer || 0) + (ctx.pipelineCounts.negotiation || 0),
    hired: (ctx.pipelineCounts.accepted || 0) + (ctx.pipelineCounts.joined || 0),
  }),

  openPositionsProvider: (ctx) => ({
    positions: ctx.jobs
      .filter((j) => j.status === 'active')
      .slice(0, 8)
      .map((j) => ({
        _id: j._id,
        title: j.title,
        applicationsCount: j.applicationsCount || 0,
        views: j.views || 0,
        deadline: j.deadline,
      })),
  }),

  pipelineMetricsProvider: (ctx) => ({
    stages: PIPELINE_STAGES,
    counts: ctx.pipelineCounts,
  }),

  candidateRankingsProvider: (ctx) => ({
    candidates: (ctx.rankedCandidates || []).slice(0, 8).map((c) => ({
      legacyApplicationId: c.legacyApplicationId,
      displayName: c.basic?.displayName,
      headline: c.headline,
      readiness: c.readiness?.overall ?? null,
      ranking: c.ranking,
      pipelineStage: c.pipelineStage,
      jobTitle: c.jobTitle,
    })),
  }),

  upcomingInterviewsProvider: (ctx) => {
    const now = Date.now();
    const items = (ctx.rankedCandidates || [])
      .filter((c) => c.interviewStatus?.scheduledAt)
      .map((c) => ({
        legacyApplicationId: c.legacyApplicationId,
        displayName: c.basic?.displayName,
        scheduledAt: c.interviewStatus.scheduledAt,
        mode: c.interviewStatus.mode,
        jobTitle: c.jobTitle,
      }))
      .filter((i) => new Date(i.scheduledAt).getTime() >= now - 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
      .slice(0, 8);
    return { interviews: items };
  },

  employerRecentActivityProvider: (ctx) => {
    const items = [...ctx.applications]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 10)
      .map((a) => ({
        legacyApplicationId: String(a._id),
        status: a.status,
        pipelineStage: LEGACY_STATUS_TO_PIPELINE[a.status] || 'applied',
        at: a.updatedAt || a.createdAt,
      }));
    return { activity: items };
  },

  hiringTasksProvider: (ctx) => {
    const tasks = [];
    const screening = ctx.pipelineCounts.applied || 0;
    const viewed = ctx.pipelineCounts.viewed || 0;
    if (screening + viewed > 0) {
      tasks.push({ key: 'review_new', count: screening + viewed, labelKey: 'taskReviewNew' });
    }
    if (ctx.pipelineCounts.interview) {
      tasks.push({ key: 'interviews', count: ctx.pipelineCounts.interview, labelKey: 'taskInterviews' });
    }
    if (ctx.pipelineCounts.offer) {
      tasks.push({ key: 'offers', count: ctx.pipelineCounts.offer, labelKey: 'taskOffers' });
    }
    return { tasks };
  },

  recommendedCandidatesProvider: (ctx) => ({
    candidates: (ctx.rankedCandidates || [])
      .filter((c) => (c.ranking?.percent ?? 0) >= 50)
      .slice(0, 5)
      .map((c) => ({
        legacyApplicationId: c.legacyApplicationId,
        displayName: c.basic?.displayName,
        ranking: c.ranking,
        readiness: c.readiness?.overall ?? null,
        verifiedSkillsCount: (c.verifiedSkills || []).length,
      })),
    deterministic: true,
    aiUsed: false,
  }),

  verifiedSkillsSummaryProvider: (ctx) => {
    const counts = new Map();
    for (const c of ctx.rankedCandidates || []) {
      for (const s of c.verifiedSkills || []) {
        const name = s.skillName || s.title || 'Skill';
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
    const skills = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return { skills };
  },
};

export const EmployerDashboardCompositionService = {
  async composeForEmployer(employerId) {
    if (!isEmployerIntelligenceEnabled()) {
      const err = new Error('Employer intelligence is disabled');
      err.status = 503;
      throw err;
    }

    const cacheKey = `dashboard:${employerId}`;
    const cached = await platformCacheGet(CACHE_NS, cacheKey).catch(() => null);
    if (cached) return cached;

    const flags = buildFlags();
    const enabled = new Set(resolveEnabledEmployerWidgets(flags));
    const layout = filterEmployerLayoutByEnabled(DEFAULT_EMPLOYER_DASHBOARD_LAYOUT, enabled);
    const ctx = await loadSharedContext(employerId, flags);

    const widgets = {};
    for (const type of enabled) {
      const def = EMPLOYER_DASHBOARD_WIDGET_DEFINITIONS[type];
      const provider = def?.provider && PROVIDERS[def.provider];
      widgets[type] = provider ? provider(ctx) : null;
    }

    const result = {
      layout,
      widgets,
      flags,
      meta: {
        composedAt: new Date().toISOString(),
        architecture: 'employer-dashboard-composition',
      },
    };

    await platformCacheSet(CACHE_NS, cacheKey, result, CACHE_TTL_MS).catch(() => {});
    return result;
  },
};
