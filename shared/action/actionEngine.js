/**
 * Action Engine — Mission 9.
 *
 * Pure, isomorphic constants and deterministic logic for:
 *   - Action/task types and statuses
 *   - Checklist management
 *   - Deadline urgency classification
 *   - Application lifecycle (education-specific)
 *   - Journey Planner stages
 *   - Next Best Action priority engine
 *
 * No AI, no fabricated scores, no admission guarantees.
 * All precedence is explicit and testable.
 */

// ── Action types ──────────────────────────────────────────────────────────────

export const ACTION_TYPES = Object.freeze({
  PROFILE_COMPLETION: 'profile_completion',
  TEST: 'test',
  DOCUMENT: 'document',
  APPLICATION: 'application',
  DEADLINE: 'deadline',
  PROGRAM: 'program',
  SCHOLARSHIP: 'scholarship',
  INTERVIEW: 'interview',
  CONSULTATION_FUTURE: 'consultation_future',
  GENERAL: 'general',
});

export const ACTION_STATUSES = Object.freeze({
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DISMISSED: 'dismissed',
});

export const PRIORITY_LEVELS = Object.freeze({
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

// ── Saved opportunity types ───────────────────────────────────────────────────

export const SAVED_OPPORTUNITY_TYPES = Object.freeze({
  PROGRAM: 'program',
  CANONICAL_SCHOLARSHIP: 'canonical_scholarship',
  AGENT_MARKETPLACE_POST: 'agent_marketplace_post',
});

// ── Deadline urgency ──────────────────────────────────────────────────────────

export const URGENCY_LEVELS = Object.freeze({
  OVERDUE: 'overdue',
  URGENT: 'urgent',
  SOON: 'soon',
  UPCOMING: 'upcoming',
  NONE: 'none',
  UNKNOWN: 'unknown',
});

export const DEFAULT_URGENCY_THRESHOLDS_DAYS = Object.freeze({
  URGENT: 7,
  SOON: 30,
  UPCOMING: 90,
});

// ── Deadline source types ─────────────────────────────────────────────────────

export const DEADLINE_SOURCE_TYPES = Object.freeze({
  SCHOLARSHIP_CYCLE: 'scholarship_cycle',
  PROGRAM_INTAKE: 'program_intake',
  TEST: 'test',
  USER_CREATED: 'user_created',
  APPLICATION_MILESTONE: 'application_milestone',
  CONSULTATION_FUTURE: 'consultation_future',
  OTHER: 'other',
});

// ── Application lifecycle (education — does NOT collide with Employer Application) ──

export const EDUCATION_APPLICATION_STATUSES = Object.freeze({
  INTERESTED: 'interested',
  PREPARING: 'preparing',
  READY_TO_APPLY: 'ready_to_apply',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  INTERVIEW_OR_ASSESSMENT: 'interview_or_assessment',
  OFFER_OR_ADMITTED: 'offer_or_admitted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  COMPLETED: 'completed',
});

export const EDUCATION_APPLICATION_TARGET_TYPES = Object.freeze({
  PROGRAM: 'program',
  CANONICAL_SCHOLARSHIP: 'canonical_scholarship',
  OTHER: 'other',
});

export const EDUCATION_APPLICATION_MODES = Object.freeze({
  SELF_MANAGED: 'self_managed',
  AGENT_MANAGED_FUTURE: 'agent_managed_future',
  DIRECT_INTEGRATION_FUTURE: 'direct_integration_future',
});

// ── Journey stages ────────────────────────────────────────────────────────────

export const JOURNEY_STAGE_IDS = Object.freeze({
  COMPLETE_PROFILE: 'complete_profile',
  EXPLORE_OPPORTUNITIES: 'explore_opportunities',
  MEET_REQUIREMENTS: 'meet_requirements',
  PREPARE_MATERIALS: 'prepare_materials',
  APPLY: 'apply',
  TRACK_OUTCOME: 'track_outcome',
});

export const JOURNEY_STAGE_ORDER = [
  JOURNEY_STAGE_IDS.COMPLETE_PROFILE,
  JOURNEY_STAGE_IDS.EXPLORE_OPPORTUNITIES,
  JOURNEY_STAGE_IDS.MEET_REQUIREMENTS,
  JOURNEY_STAGE_IDS.PREPARE_MATERIALS,
  JOURNEY_STAGE_IDS.APPLY,
  JOURNEY_STAGE_IDS.TRACK_OUTCOME,
];

// ── Alert preference types ────────────────────────────────────────────────────

export const ALERT_TYPES = Object.freeze({
  SAVED_SCHOLARSHIP_DEADLINE: 'saved_scholarship_deadline',
  SAVED_PROGRAM_DEADLINE: 'saved_program_deadline',
  TEST_DEADLINE: 'test_deadline',
  APPLICATION_MILESTONE: 'application_milestone',
  TASK_REMINDER: 'task_reminder',
});

// ── Next Best Action priority weights ─────────────────────────────────────────
// Lower number = higher priority. Explicit and deterministic.

export const NBA_PRIORITY = Object.freeze({
  SAFETY_CRITICAL: 1,
  IMMINENT_HARD_DEADLINE: 2,
  BLOCKING_ELIGIBILITY_GAP: 3,
  ACTIVE_APPLICATION_REQUIREMENT: 4,
  IMPORTANT_PROFILE_GAP: 5,
  APPROACHING_DEADLINE: 6,
  SAVED_OPPORTUNITY_ACTION: 7,
  EXPLORATION: 8,
});

// ── Deadline urgency classification ──────────────────────────────────────────

/**
 * classifyDeadlineUrgency
 *
 * @param {Date|null} deadlineAt — UTC Date object, or null if unknown
 * @param {boolean} isDateOnly — true if source only provided a date (no time)
 * @param {object} thresholds — configurable day thresholds (default: DEFAULT_URGENCY_THRESHOLDS_DAYS)
 * @param {Date} now — injectable for testing
 * @returns {string} URGENCY_LEVELS value
 *
 * Date-only deadlines: treated as end-of-day in the user's perspective but
 * we do NOT invent a timezone. We classify based on calendar-day difference
 * treating the deadline as the start of that day in UTC.
 * This is conservative — we never show "upcoming" when it should be "urgent".
 */
export function classifyDeadlineUrgency(deadlineAt, isDateOnly = false, thresholds = DEFAULT_URGENCY_THRESHOLDS_DAYS, now = new Date()) {
  if (!deadlineAt) return URGENCY_LEVELS.UNKNOWN;

  const deadlineMs = deadlineAt instanceof Date ? deadlineAt.getTime() : new Date(deadlineAt).getTime();
  if (isNaN(deadlineMs)) return URGENCY_LEVELS.UNKNOWN;

  const nowMs = now.getTime();
  const diffMs = deadlineMs - nowMs;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return URGENCY_LEVELS.OVERDUE;
  if (diffDays <= thresholds.URGENT) return URGENCY_LEVELS.URGENT;
  if (diffDays <= thresholds.SOON) return URGENCY_LEVELS.SOON;
  if (diffDays <= thresholds.UPCOMING) return URGENCY_LEVELS.UPCOMING;
  return URGENCY_LEVELS.NONE;
}

// ── Profile completeness check ────────────────────────────────────────────────

/**
 * Returns an array of missing profile section identifiers.
 * Input is a partial profile snapshot (same shape as buildProfileSnapshot).
 */
export function identifyProfileGaps(profile) {
  const gaps = [];
  if (!profile) return ['profile_missing'];

  const pi = profile.personalInfo || {};
  if (!pi.nationality) gaps.push('nationality');
  if (!pi.country) gaps.push('country');

  const edu = profile.education || [];
  if (edu.length === 0) gaps.push('education');

  const goals = profile.studyGoals || [];
  if (goals.length === 0) gaps.push('study_goals');

  const prefs = profile.studentPreferences || {};
  if (!prefs.destinationCountries || prefs.destinationCountries.length === 0) gaps.push('destination_countries');

  if (!profile.examScores || profile.examScores.length === 0) gaps.push('exam_scores');

  return gaps;
}

// ── Journey planner ───────────────────────────────────────────────────────────

/**
 * buildJourneyPlan
 *
 * Derives a deterministic journey plan from available inputs.
 * Does NOT call any AI. Does NOT duplicate Mission 8 eligibility logic.
 * Consumes gaps from Mission 8's getGapAnalysis output.
 *
 * @param {object} inputs
 *   .profile — profile snapshot
 *   .profileGaps — array of profile gap identifiers (from identifyProfileGaps)
 *   .eligibilityGaps — Mission 8 gap analysis result (criticalGaps, majorGaps)
 *   .savedOpportunities — array of saved opportunity records
 *   .educationApplications — array of EducationApplication records
 *   .pendingActions — array of active UserAction records
 *   .upcomingDeadlines — array of deadline records with urgency
 *   .goalTypes — array of goal types from studyGoals (e.g. ['study', 'scholarship'])
 * @returns {object} journey plan with stages
 */
export function buildJourneyPlan({
  profile,
  profileGaps = [],
  eligibilityGaps = { criticalGaps: [], majorGaps: [] },
  savedOpportunities = [],
  educationApplications = [],
  pendingActions = [],
  upcomingDeadlines = [],
  goalTypes = [],
}) {
  const isStudyGoal = goalTypes.includes('study') || goalTypes.includes('postgraduate') || goalTypes.length === 0;
  const isScholarshipGoal = goalTypes.includes('scholarship');

  const stages = [];

  // Stage 1 — Complete profile
  const profileComplete = profileGaps.length === 0;
  const criticalEligibilityGaps = eligibilityGaps.criticalGaps || [];
  const majorEligibilityGaps = eligibilityGaps.majorGaps || [];

  stages.push({
    id: JOURNEY_STAGE_IDS.COMPLETE_PROFILE,
    order: 1,
    title: 'Complete your profile',
    description: 'A complete profile enables accurate eligibility checks and better opportunity matches.',
    status: profileComplete ? 'done' : 'in_progress',
    gaps: profileGaps,
    actionCount: profileGaps.length,
  });

  // Stage 2 — Explore opportunities
  const hasSaved = savedOpportunities.length > 0;
  stages.push({
    id: JOURNEY_STAGE_IDS.EXPLORE_OPPORTUNITIES,
    order: 2,
    title: 'Explore opportunities',
    description: isScholarshipGoal
      ? 'Find programs and scholarships that match your goals.'
      : 'Find programs and institutions that match your goals.',
    status: hasSaved ? 'in_progress' : 'not_started',
    savedCount: savedOpportunities.length,
    actionCount: hasSaved ? 0 : 1,
  });

  // Stage 3 — Meet academic/test requirements
  const hasTestGaps = criticalEligibilityGaps.some((g) => g.type === 'test') ||
    majorEligibilityGaps.some((g) => g.type === 'test');
  const hasAcademicGaps = criticalEligibilityGaps.some((g) => g.type === 'academic') ||
    majorEligibilityGaps.some((g) => g.type === 'academic');
  const requirementsStatus = (hasTestGaps || hasAcademicGaps) ? 'in_progress' : (profileComplete ? 'done' : 'not_started');

  stages.push({
    id: JOURNEY_STAGE_IDS.MEET_REQUIREMENTS,
    order: 3,
    title: 'Meet academic and test requirements',
    description: 'Address any eligibility gaps identified for your target programs or scholarships.',
    status: requirementsStatus,
    criticalGapCount: criticalEligibilityGaps.length,
    majorGapCount: majorEligibilityGaps.length,
    actionCount: criticalEligibilityGaps.length + majorEligibilityGaps.length,
  });

  // Stage 4 — Prepare materials
  const docActions = pendingActions.filter((a) => a.actionType === ACTION_TYPES.DOCUMENT && a.status !== ACTION_STATUSES.COMPLETED && a.status !== ACTION_STATUSES.DISMISSED);
  stages.push({
    id: JOURNEY_STAGE_IDS.PREPARE_MATERIALS,
    order: 4,
    title: 'Prepare required materials',
    description: 'Gather documents, references, and statements required for your applications.',
    status: docActions.length > 0 ? 'in_progress' : 'not_started',
    actionCount: docActions.length,
  });

  // Stage 5 — Apply
  const activeApps = educationApplications.filter((a) =>
    [EDUCATION_APPLICATION_STATUSES.PREPARING, EDUCATION_APPLICATION_STATUSES.READY_TO_APPLY, EDUCATION_APPLICATION_STATUSES.SUBMITTED].includes(a.status)
  );
  const applyStatus = activeApps.length > 0 ? 'in_progress' : (savedOpportunities.length > 0 ? 'not_started' : 'not_started');
  stages.push({
    id: JOURNEY_STAGE_IDS.APPLY,
    order: 5,
    title: 'Apply',
    description: 'Submit your applications and track submission status.',
    status: applyStatus,
    activeApplicationCount: activeApps.length,
    actionCount: activeApps.filter((a) => a.status === EDUCATION_APPLICATION_STATUSES.READY_TO_APPLY).length,
    note: 'Strideto tracks your application status. Submission is handled directly with the institution.',
  });

  // Stage 6 — Track outcome
  const outcomeApps = educationApplications.filter((a) =>
    [EDUCATION_APPLICATION_STATUSES.UNDER_REVIEW, EDUCATION_APPLICATION_STATUSES.INTERVIEW_OR_ASSESSMENT, EDUCATION_APPLICATION_STATUSES.OFFER_OR_ADMITTED].includes(a.status)
  );
  stages.push({
    id: JOURNEY_STAGE_IDS.TRACK_OUTCOME,
    order: 6,
    title: 'Track your outcome',
    description: 'Monitor decisions, respond to offers, and record your final outcome.',
    status: outcomeApps.length > 0 ? 'in_progress' : 'not_started',
    awaitingCount: outcomeApps.length,
    actionCount: outcomeApps.length,
  });

  const overallProgress = Math.round(
    (stages.filter((s) => s.status === 'done').length / stages.length) * 100
  );

  return {
    stages,
    goalTypes,
    overallProgress,
    generatedAt: new Date().toISOString(),
  };
}

// ── Next Best Action engine ───────────────────────────────────────────────────

/**
 * computeNextBestAction
 *
 * Deterministic and explainable. No AI scoring.
 * Priority is explicit (NBA_PRIORITY constants).
 *
 * Returns the single highest-priority action the user should take,
 * or null if nothing actionable is found.
 *
 * @param {object} inputs
 *   .profileGaps — array of gap identifiers
 *   .eligibilityGaps — { criticalGaps, majorGaps } from Mission 8
 *   .upcomingDeadlines — array of { deadlineAt, urgency, sourceType, title, entityId, entityType, freshnessWarning }
 *   .pendingActions — active UserAction records (status todo/in_progress)
 *   .activeApplications — EducationApplication records in active statuses
 *   .savedOpportunities — SavedOpportunity records
 * @returns {object|null} next best action descriptor
 */
export function computeNextBestAction({
  profileGaps = [],
  eligibilityGaps = { criticalGaps: [], majorGaps: [] },
  upcomingDeadlines = [],
  pendingActions = [],
  activeApplications = [],
  savedOpportunities = [],
}) {
  const candidates = [];

  // P2 — Imminent hard deadlines (overdue or urgent)
  const imminentDeadlines = upcomingDeadlines.filter(
    (d) => d.urgency === URGENCY_LEVELS.OVERDUE || d.urgency === URGENCY_LEVELS.URGENT
  );
  for (const dl of imminentDeadlines) {
    candidates.push({
      priorityScore: dl.urgency === URGENCY_LEVELS.OVERDUE ? NBA_PRIORITY.SAFETY_CRITICAL : NBA_PRIORITY.IMMINENT_HARD_DEADLINE,
      priority: dl.urgency === URGENCY_LEVELS.OVERDUE ? PRIORITY_LEVELS.CRITICAL : PRIORITY_LEVELS.HIGH,
      action: dl.urgency === URGENCY_LEVELS.OVERDUE ? 'Review overdue deadline' : 'Act on approaching deadline',
      reason: dl.urgency === URGENCY_LEVELS.OVERDUE
        ? `Deadline for "${dl.title}" has passed. Review whether you can still act.`
        : `Deadline for "${dl.title}" is within 7 days.`,
      entityType: dl.entityType,
      entityId: dl.entityId,
      dueDate: dl.deadlineAt,
      sourceType: dl.sourceType,
      freshnessWarning: dl.freshnessWarning || null,
      ctaRoute: dl.ctaRoute || null,
    });
  }

  // P3 — Blocking eligibility gaps (critical from Mission 8)
  const criticalGaps = eligibilityGaps.criticalGaps || [];
  for (const gap of criticalGaps) {
    candidates.push({
      priorityScore: NBA_PRIORITY.BLOCKING_ELIGIBILITY_GAP,
      priority: PRIORITY_LEVELS.HIGH,
      action: gap.action || 'Address eligibility requirement',
      reason: gap.reason || `Critical gap identified: ${gap.label || gap.type}`,
      entityType: gap.opportunityType || null,
      entityId: gap.opportunityId || null,
      dueDate: null,
      freshnessWarning: null,
      ctaRoute: gap.ctaRoute || null,
    });
  }

  // P4 — Active application requirements (pending actions of type application/document)
  const appActions = pendingActions.filter(
    (a) =>
      [ACTION_TYPES.APPLICATION, ACTION_TYPES.DOCUMENT].includes(a.actionType) &&
      [ACTION_STATUSES.TODO, ACTION_STATUSES.IN_PROGRESS].includes(a.status)
  );
  for (const act of appActions) {
    candidates.push({
      priorityScore: NBA_PRIORITY.ACTIVE_APPLICATION_REQUIREMENT,
      priority: PRIORITY_LEVELS.HIGH,
      action: act.title,
      reason: act.description || 'Required for active application.',
      entityType: act.relatedEntityType || null,
      entityId: act.relatedEntityId || null,
      dueDate: act.dueAt || null,
      freshnessWarning: null,
      ctaRoute: '/journey/tasks',
    });
  }

  // P5 — Important profile gaps
  if (profileGaps.length > 0) {
    const gap = profileGaps[0];
    candidates.push({
      priorityScore: NBA_PRIORITY.IMPORTANT_PROFILE_GAP,
      priority: PRIORITY_LEVELS.MEDIUM,
      action: 'Complete your profile',
      reason: `Profile section missing: ${gap.replace(/_/g, ' ')}. A complete profile improves eligibility assessment accuracy.`,
      entityType: 'profile',
      entityId: null,
      dueDate: null,
      freshnessWarning: null,
      ctaRoute: '/talent-profile',
    });
  }

  // P6 — Approaching deadlines (soon)
  const soonDeadlines = upcomingDeadlines.filter((d) => d.urgency === URGENCY_LEVELS.SOON);
  for (const dl of soonDeadlines) {
    candidates.push({
      priorityScore: NBA_PRIORITY.APPROACHING_DEADLINE,
      priority: PRIORITY_LEVELS.MEDIUM,
      action: 'Prepare for approaching deadline',
      reason: `Deadline for "${dl.title}" is within 30 days.`,
      entityType: dl.entityType,
      entityId: dl.entityId,
      dueDate: dl.deadlineAt,
      sourceType: dl.sourceType,
      freshnessWarning: dl.freshnessWarning || null,
      ctaRoute: dl.ctaRoute || '/journey/deadlines',
    });
  }

  // P7 — Saved opportunity with no application started
  const savedWithNoApp = savedOpportunities.filter((s) => {
    return !activeApplications.some(
      (a) => String(a.targetId) === String(s.entityId) && a.targetType === s.entityType
    );
  });
  if (savedWithNoApp.length > 0) {
    const s = savedWithNoApp[0];
    candidates.push({
      priorityScore: NBA_PRIORITY.SAVED_OPPORTUNITY_ACTION,
      priority: PRIORITY_LEVELS.LOW,
      action: 'Start tracking your saved opportunity',
      reason: `You saved "${s.title || s.entityType}" but have not started tracking an application. Consider beginning your preparation.`,
      entityType: s.entityType,
      entityId: s.entityId,
      dueDate: null,
      freshnessWarning: null,
      ctaRoute: '/journey/applications',
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.priorityScore - b.priorityScore);
  return candidates[0];
}

// ── Checklist helpers ─────────────────────────────────────────────────────────

export const CHECKLIST_TARGET_TYPES = Object.freeze({
  PROGRAM: 'program',
  CANONICAL_SCHOLARSHIP: 'canonical_scholarship',
  APPLICATION: 'application',
  GENERAL: 'general',
});

export const CHECKLIST_ITEM_STATUSES = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
});

/**
 * Document requirement placeholders — Mission 9 uses identifiers only.
 * Actual file storage is Mission 10 (Secure Document Vault).
 */
export const DOCUMENT_REQUIREMENT_TYPES = Object.freeze({
  TRANSCRIPT: 'transcript',
  PASSPORT: 'passport',
  CV: 'cv',
  RECOMMENDATION_LETTER: 'recommendation_letter',
  STATEMENT_OF_PURPOSE: 'statement_of_purpose',
  FINANCIAL_EVIDENCE: 'financial_evidence',
  TEST_SCORE_REPORT: 'test_score_report',
  PHOTO: 'photo',
  OTHER: 'other',
});
