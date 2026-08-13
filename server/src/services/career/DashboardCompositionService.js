import { TalentProfileReadService } from './TalentProfileReadService.js';
import { OpportunityApplicationService } from './OpportunityApplicationService.js';
import { TimelineService } from './TimelineService.js';
import { DocumentService } from './DocumentService.js';
import { CredentialPlatformService } from './CredentialPlatformService.js';
import { TalentProfileRepository } from '../../repositories/career/TalentProfileRepository.js';
import { DashboardPreferenceService } from './DashboardPreferenceService.js';
import { UserNotification } from '../../models/UserNotification.js';
import { Job } from '../../models/Job.js';
import { Scholarship } from '../../models/Scholarship.js';
import { Admission } from '../../models/Admission.js';
import { withFixtureExclusion } from '../../../../shared/publicDiscovery/fixtureExclusion.js';
import {
  DASHBOARD_WIDGET_DEFINITIONS,
  filterLayoutByEnabled,
  resolveEnabledWidgets,
  resolveDefaultLayout,
  applyLayoutPreference,
} from '../../../../shared/career/dashboardWidgetRegistry.js';
import { buildDeterministicLearningRecommendations } from '../../../../shared/career/learningRecommendations.js';
import { evaluateProfileCompleteness } from '../../../../shared/scoring/profileCompletenessRules.js';
import {
  isTalentProfileEnabled,
  isOpportunityApplicationEnabled,
  isTimelineEnabled,
  isDocumentsPlatformEnabled,
  isCareerDashboardEnabled,
  isScoringEnabled,
  isCareerDashboardV2Enabled,
  isDashboardPersonalizationEnabled,
  isAssessmentsEnabled,
} from '../../config/careerFeatureFlags.js';
import { platformCacheGet, platformCacheSet, platformCacheInvalidateNamespace } from '../../config/cache.js';

const CACHE_NS = 'career';
const CACHE_TTL_MS = 120_000;

function computeCompletionPercent(profile, _hints) {
  if (!profile) return 0;
  return evaluateProfileCompleteness(profile).score;
}

function aggregateApplicationStages(applications) {
  const counts = {
    applied: 0,
    interview: 0,
    offers: 0,
    accepted: 0,
    rejected: 0,
  };
  const appliedStages = new Set(['applied', 'viewed', 'screening', 'assessment', 'preparing', 'interested']);
  const offerStages = new Set(['offer', 'negotiation']);

  for (const app of applications) {
    const stage = app.pipelineStage;
    if (appliedStages.has(stage)) counts.applied += 1;
    else if (stage === 'interview') counts.interview += 1;
    else if (offerStages.has(stage)) counts.offers += 1;
    else if (stage === 'accepted' || stage === 'joined') counts.accepted += 1;
    else if (stage === 'rejected' || stage === 'withdrawn') counts.rejected += 1;
  }
  return counts;
}

function weekAgo() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

/**
 * Load shared platform data once per composition — providers must not re-query.
 */
async function loadSharedContext(userId, flags) {
  const ctx = {
    userId,
    flags,
    profile: null,
    profileSummary: null,
    applications: [],
    metrics: null,
    readiness: null,
    documents: [],
    credentials: [],
    timeline: { data: [], nextCursor: null },
    recommendations: { jobs: [], scholarships: [], admissions: [], careerSource: null, placeholder: true },
    notifications: { items: [], unreadCount: 0 },
    preference: null,
    assessments: null,
  };

  const tasks = [];

  if (flags.talentProfile) {
    tasks.push(
      TalentProfileRepository.findByUserId(userId).then((p) => { ctx.profile = p; }).catch(() => {})
    );
    tasks.push(
      TalentProfileReadService.getDashboardSummary(userId).then((s) => { ctx.profileSummary = s; }).catch(() => {})
    );
  }

  if (flags.opportunityApplication) {
    tasks.push(
      OpportunityApplicationService.listForUser(userId, { limit: 100 })
        .then((apps) => { ctx.applications = apps || []; })
        .catch(() => { ctx.applications = []; })
    );
    tasks.push(
      import('./ApplicationMetricsService.js')
        .then(({ ApplicationMetricsService }) => ApplicationMetricsService.getForUser(userId))
        .then((m) => { ctx.metrics = m; })
        .catch(() => {})
    );
  }

  if (flags.scoring && flags.talentProfile) {
    tasks.push(
      import('./ScoringService.js')
        .then(({ ScoringService }) => ScoringService.getDashboardPayload(userId))
        .then((r) => { ctx.readiness = r; })
        .catch(() => { ctx.readiness = null; })
    );
    tasks.push(
      import('./ScoringService.js')
        .then(({ ScoringService }) => ScoringService.getSkillGapPayload(userId, {}))
        .then((sg) => { ctx.skillGap = sg; })
        .catch(() => { ctx.skillGap = null; })
    );
  }

  if (flags.documentsPlatform) {
    tasks.push(
      DocumentService.listForUser(userId, {}).then((d) => { ctx.documents = d || []; }).catch(() => {})
    );
    tasks.push(
      CredentialPlatformService.listForUser(userId).then((c) => { ctx.credentials = c || []; }).catch(() => {})
    );
  }

  if (flags.timeline) {
    tasks.push(
      TimelineService.listForUser(userId, { limit: 12 })
        .then((r) => { ctx.timeline = r || { data: [], nextCursor: null }; })
        .catch(() => {})
    );
  }

  tasks.push(
    (async () => {
      try {
        const targeting = flags.talentProfile
          ? await TalentProfileReadService.getCareerTargetingContext(userId)
          : { source: null };
        const launchActive = withFixtureExclusion({ status: 'active' });
        const [jobs, scholarships, admissions] = await Promise.all([
          Job.find(launchActive).sort({ createdAt: -1 }).limit(20).lean(),
          Scholarship.find(launchActive).sort({ createdAt: -1 }).limit(20).lean(),
          Admission.find(launchActive).sort({ createdAt: -1 }).limit(20).lean(),
        ]);
        ctx.recommendations = {
          jobs: jobs.slice(0, 4).map((j) => ({ _id: j._id, title: j.title, slug: j.slug, company: j.company })),
          scholarships: scholarships.slice(0, 3).map((s) => ({ _id: s._id, title: s.title, slug: s.slug })),
          admissions: admissions.slice(0, 3).map((a) => ({ _id: a._id, program: a.program, slug: a.slug })),
          careerSource: targeting.source,
          placeholder: jobs.length === 0 && scholarships.length === 0,
        };
      } catch {
        /* keep defaults */
      }
    })()
  );

  tasks.push(
    UserNotification.find({ recipientType: 'user', userId })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean()
      .then(async (items) => {
        const unreadCount = await UserNotification.countDocuments({
          recipientType: 'user',
          userId,
          read: false,
        });
        ctx.notifications = { items, unreadCount };
      })
      .catch(() => {})
  );

  if (flags.dashboardPersonalization) {
    tasks.push(
      DashboardPreferenceService.getForUser(userId).then((p) => { ctx.preference = p; }).catch(() => {})
    );
  }

  if (flags.assessments) {
    tasks.push(
      import('./AssessmentService.js')
        .then(({ AssessmentService }) => AssessmentService.getDashboardPayload(userId))
        .then((a) => { ctx.assessments = a; })
        .catch(() => { ctx.assessments = null; })
    );
  }

  await Promise.all(tasks);
  return ctx;
}

function profileSummaryFromCtx(ctx) {
  const summary = ctx.profileSummary || {};
  const profile = ctx.profile;
  const hints = summary.career?.completionHints || {};
  const primaryResume = summary.resumeVersions?.find((v) => v.isPrimary) || summary.resumeVersions?.[0];
  return {
    completionPercent: computeCompletionPercent(profile, hints),
    headline: summary.career?.headline || '',
    displayName: summary.career?.displayName || summary.user?.name || '',
    preferredRole: profile?.headline || '',
    preferredLocation: profile?.market || profile?.preferences?.preferredMarkets?.[0] || summary.career?.province || '',
    resumeStatus: primaryResume?.status || (summary.legacyResumes?.length ? 'legacy' : 'none'),
    completionHints: hints,
    talentProfileId: summary.talentProfileId,
  };
}

function applicationsSummaryFromCtx(ctx) {
  const applications = ctx.applications || [];
  return {
    total: applications.length,
    byStage: aggregateApplicationStages(applications),
    metrics: ctx.metrics,
    quickActions: true,
    recent: applications.slice(0, 5).map((a) => ({
      _id: a._id,
      title: a.title,
      pipelineStage: a.pipelineStage,
      opportunityType: a.opportunityRef?.opportunityType,
      updatedAt: a.updatedAt,
    })),
  };
}

function documentsRecentFromCtx(ctx) {
  const docs = ctx.documents || [];
  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  return {
    recent: docs.slice(0, 6),
    expiring: docs.filter((d) => d.expiresAt && new Date(d.expiresAt).getTime() <= in30Days),
    resumeCount: docs.filter((d) => d.documentType === 'resume' || d.documentType === 'cv').length,
    certificateCount: docs.filter((d) => d.documentType === 'certificate').length,
  };
}

function credentialsSummaryFromCtx(ctx) {
  const creds = ctx.credentials || [];
  const verified = creds.filter((c) => c.verificationStatus === 'active');
  const latest = [...creds].sort((a, b) => new Date(b.issuedAt || b.createdAt) - new Date(a.issuedAt || a.createdAt)).slice(0, 5);
  return {
    total: creds.length,
    verifiedCount: verified.length,
    verifiedSkills: verified.filter((c) => c.skillName).slice(0, 6),
    latest,
  };
}

const PROVIDERS = {
  profileSummaryProvider: (ctx) => profileSummaryFromCtx(ctx),
  applicationsSummaryProvider: (ctx) => applicationsSummaryFromCtx(ctx),
  timelineRecentProvider: (ctx) => ({ items: ctx.timeline?.data || [], nextCursor: ctx.timeline?.nextCursor }),
  documentsRecentProvider: (ctx) => documentsRecentFromCtx(ctx),
  credentialsSummaryProvider: (ctx) => credentialsSummaryFromCtx(ctx),
  recommendationsProvider: (ctx) => ctx.recommendations,
  readinessScoreProvider: (ctx) => ctx.readiness,

  careerHealthProvider: (ctx) => {
    const readiness = ctx.readiness?.overall ?? null;
    const metrics = ctx.metrics || {};
    const profile = profileSummaryFromCtx(ctx);
    return {
      readinessScore: readiness,
      activeApplications: metrics.active ?? 0,
      interviewsScheduled: metrics.interviewsScheduled ?? 0,
      offersReceived: metrics.offersReceived ?? 0,
      responseRate: metrics.responseRate ?? 0,
      profileCompletion: profile.completionPercent ?? 0,
      healthLabel: readiness == null ? 'unknown' : readiness >= 70 ? 'strong' : readiness >= 40 ? 'building' : 'getting_started',
    };
  },

  weeklyProgressProvider: (ctx) => {
    const since = weekAgo();
    const appsUpdated = (ctx.applications || []).filter((a) => a.updatedAt && new Date(a.updatedAt) >= since).length;
    const timelineItems = (ctx.timeline?.data || []).filter((e) => e.occurredAt && new Date(e.occurredAt) >= since);
    const credentialsNew = (ctx.credentials || []).filter((c) => {
      const at = c.issuedAt || c.createdAt;
      return at && new Date(at) >= since;
    }).length;
    return {
      applicationsUpdated: appsUpdated,
      timelineEvents: timelineItems.length,
      credentialsEarned: credentialsNew,
      readinessDelta: ctx.readiness?.delta ?? null,
      readinessOverall: ctx.readiness?.overall ?? null,
      since: since.toISOString(),
    };
  },

  profileCompletionProvider: (ctx) => {
    const result = evaluateProfileCompleteness(ctx.profile || {});
    return {
      completionPercent: result.score,
      checks: result.checks.map((c) => ({ key: c.key, ok: c.ok, labelKey: c.key })),
      missing: result.missing,
    };
  },

  skillGapProvider: (ctx) => ctx.skillGap || {
    currentSkills: [],
    missingSkills: [],
    recommendedAssessments: [],
    recommendedLearning: [],
    deterministic: true,
    aiUsed: false,
  },

  upcomingDeadlinesProvider: (ctx) => {
    const now = Date.now();
    const items = [];
    for (const app of ctx.applications || []) {
      for (const rem of app.reminderReferences || []) {
        if (rem.status && rem.status !== 'scheduled') continue;
        if (!rem.remindAt) continue;
        const t = new Date(rem.remindAt).getTime();
        if (t < now - 24 * 60 * 60 * 1000) continue;
        items.push({
          type: 'reminder',
          applicationId: app._id,
          title: rem.title || app.title,
          at: rem.remindAt,
          applicationTitle: app.title,
        });
      }
    }
    items.sort((a, b) => new Date(a.at) - new Date(b.at));
    return { items: items.slice(0, 8) };
  },

  interviewScheduleProvider: (ctx) => {
    const now = Date.now() - 60 * 60 * 1000;
    const items = (ctx.applications || [])
      .filter((a) => a.interview?.scheduledAt)
      .map((a) => ({
        applicationId: a._id,
        title: a.title,
        scheduledAt: a.interview.scheduledAt,
        mode: a.interview.mode,
        location: a.interview.location,
        meetingUrl: a.interview.meetingUrl,
        pipelineStage: a.pipelineStage,
      }))
      .filter((i) => new Date(i.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    return { items: items.slice(0, 8) };
  },

  recommendedJobsProvider: (ctx) => ({
    items: ctx.recommendations?.jobs || [],
    placeholder: !(ctx.recommendations?.jobs?.length),
  }),

  recommendedScholarshipsProvider: (ctx) => ({
    items: ctx.recommendations?.scholarships || [],
    placeholder: !(ctx.recommendations?.scholarships?.length),
  }),

  recommendedAdmissionsProvider: (ctx) => ({
    items: ctx.recommendations?.admissions || [],
    placeholder: !(ctx.recommendations?.admissions?.length),
  }),

  recommendedLearningProvider: (ctx) => buildDeterministicLearningRecommendations(ctx),

  goalsTargetsProvider: (ctx) => {
    const goals = (ctx.profile?.careerGoals || []).filter((g) => g.status !== 'archived');
    const prefs = ctx.profile?.preferences || {};
    return {
      goals: goals.slice(0, 6).map((g) => ({
        title: g.title,
        targetDate: g.targetDate,
        status: g.status,
        notes: g.notes,
      })),
      preferredRole: ctx.profile?.headline || '',
      preferredMarkets: prefs.preferredMarkets || [],
      workMode: prefs.workMode || null,
    };
  },

  notificationCenterProvider: (ctx) => ({
    unreadCount: ctx.notifications?.unreadCount || 0,
    items: (ctx.notifications?.items || []).slice(0, 6).map((n) => ({
      _id: n._id,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt,
      category: n.category,
    })),
  }),

  recentAchievementsProvider: (ctx) => {
    const achievements = [];
    for (const c of (ctx.credentials || []).slice(0, 5)) {
      if (c.verificationStatus === 'active') {
        achievements.push({
          type: 'credential',
          title: c.title || c.skillName,
          at: c.issuedAt || c.createdAt,
        });
      }
    }
    if (ctx.readiness?.delta != null && ctx.readiness.delta >= 5) {
      achievements.push({
        type: 'readiness',
        title: 'readinessImproved',
        at: ctx.readiness.computedAt,
        delta: ctx.readiness.delta,
        overall: ctx.readiness.overall,
      });
    }
    const joined = (ctx.applications || []).filter((a) => a.pipelineStage === 'joined' || a.pipelineStage === 'accepted');
    for (const a of joined.slice(0, 3)) {
      achievements.push({ type: 'application', title: a.title, at: a.updatedAt, stage: a.pipelineStage });
    }
    achievements.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    return { items: achievements.slice(0, 8) };
  },

  layoutCustomizeProvider: (ctx) => ({
    personalizationEnabled: Boolean(ctx.flags?.dashboardPersonalization),
    hasSavedLayout: Boolean(ctx.preference?.layout?.main?.length || ctx.preference?.hiddenWidgets?.length),
    hiddenWidgets: ctx.preference?.hiddenWidgets || [],
    dragDrop: Boolean(ctx.flags?.dashboardPersonalization),
    placeholder: !ctx.flags?.dashboardPersonalization,
  }),

  recentAssessmentsProvider: (ctx) => ctx.assessments || {
    recentAttempts: [],
    inProgressCount: 0,
    publishedCount: 0,
    verifiedFromAssessments: 0,
  },

  verifiedSkillsWidgetProvider: (ctx) => {
    const creds = (ctx.credentials || []).filter(
      (c) => c.verificationStatus === 'active' && (c.source === 'assessment' || c.skillName)
    );
    return {
      skills: creds.slice(0, 8).map((c) => ({
        _id: c._id,
        title: c.title,
        skillName: c.skillName,
        score: c.score,
        issuedAt: c.issuedAt || c.createdAt,
        assessmentAttemptId: c.assessmentAttemptId,
      })),
      total: creds.length,
    };
  },
};

function buildFlags() {
  return {
    talentProfile: isTalentProfileEnabled(),
    opportunityApplication: isOpportunityApplicationEnabled(),
    timeline: isTimelineEnabled(),
    documentsPlatform: isDocumentsPlatformEnabled(),
    careerDashboard: isCareerDashboardEnabled(),
    scoring: isScoringEnabled(),
    careerDashboardV2: isCareerDashboardV2Enabled(),
    dashboardPersonalization: isDashboardPersonalizationEnabled(),
    assessments: isAssessmentsEnabled(),
  };
}

export const DashboardCompositionService = {
  async composeForUser(userId) {
    if (!isCareerDashboardEnabled()) {
      const err = new Error('Career dashboard is disabled');
      err.status = 503;
      throw err;
    }

    const cacheKey = `dashboard:${userId}`;
    const cached = await platformCacheGet(CACHE_NS, cacheKey);
    if (cached) return cached;

    const flags = buildFlags();
    const enabled = new Set(resolveEnabledWidgets(flags));
    const ctx = await loadSharedContext(userId, flags);

    let layout = resolveDefaultLayout(flags);
    if (flags.dashboardPersonalization && ctx.preference) {
      layout = applyLayoutPreference(layout, ctx.preference);
    }
    layout = filterLayoutByEnabled(layout, enabled);

    const widgets = {};
    for (const zone of Object.keys(layout)) {
      for (const widgetType of layout[zone]) {
        if (widgets[widgetType] !== undefined) continue;
        const def = DASHBOARD_WIDGET_DEFINITIONS[widgetType];
        if (!def?.provider) {
          widgets[widgetType] = null;
          continue;
        }
        const fn = PROVIDERS[def.provider];
        if (!fn) {
          widgets[widgetType] = null;
          continue;
        }
        try {
          widgets[widgetType] = fn(ctx);
        } catch {
          widgets[widgetType] = null;
        }
      }
    }

    const payload = {
      layout,
      widgets,
      meta: {
        flags,
        version: flags.careerDashboardV2 ? '2.0' : '1.0',
        personalization: Boolean(flags.dashboardPersonalization),
      },
    };

    await platformCacheSet(CACHE_NS, cacheKey, payload, CACHE_TTL_MS);
    return payload;
  },

  async invalidateForUser(userId) {
    await platformCacheInvalidateNamespace(CACHE_NS, `dashboard:${userId}`);
  },
};
