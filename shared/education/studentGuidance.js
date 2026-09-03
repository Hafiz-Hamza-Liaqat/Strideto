/** Bounded, deterministic presentation contracts for the private student hub. */
export const GUIDANCE_READINESS_STATES = Object.freeze({
  READY: 'READY', IN_PROGRESS: 'IN_PROGRESS', MISSING: 'MISSING',
  NOT_REQUIRED: 'NOT_REQUIRED', UNKNOWN: 'UNKNOWN',
});

export const GUIDANCE_FRESHNESS_STATES = Object.freeze({
  VERIFIED_RECENT: 'VERIFIED_RECENT', VERIFIED: 'VERIFIED', STALE: 'STALE',
  UNVERIFIED: 'UNVERIFIED', UNKNOWN: 'UNKNOWN',
});

const asArray = (value) => Array.isArray(value) ? value : [];
const unique = (items) => [...new Set(items.filter(Boolean).map(String))];

export function buildStudentContextSummary(profile = {}) {
  const personal = profile.personalInfo || profile.personal || {};
  const preferences = profile.studentPreferences || profile.preferences || {};
  const goals = asArray(profile.studyGoals);
  const activeGoals = goals.filter((goal) => goal.status === 'active' || goal.status == null);
  const fields = unique([
    ...activeGoals.map((goal) => goal.fieldOfStudy),
    ...asArray(preferences.fieldsOfStudy),
  ]);
  const destinations = unique([
    ...activeGoals.flatMap((goal) => asArray(goal.destinationCountries)),
    ...asArray(preferences.destinationCountries),
  ]);
  const known = {
    studyLevel: activeGoals.find((goal) => goal.degreeLevel)?.degreeLevel || null,
    fieldsOfStudy: fields,
    destinations,
    educationRecords: asArray(profile.education).length,
    recordedTests: asArray(profile.examScores).length,
    savedItems: asArray(profile.savedItems || profile.saved).length,
  };
  const missing = [];
  if (!known.studyLevel) missing.push('study_level');
  if (!fields.length) missing.push('field_of_study');
  if (!destinations.length) missing.push('destination');
  if (!known.educationRecords) missing.push('education_history');
  if (!known.recordedTests) missing.push('test_scores');
  return { known, missing, hasSufficientContext: missing.length === 0 };
}

export function buildReadinessPlan({ profile = {}, gaps = [] } = {}) {
  const profileGaps = asArray(gaps);
  const actions = profileGaps.slice(0, 8).map((gap) => ({
    key: gap.key, label: gap.label, status: GUIDANCE_READINESS_STATES.MISSING,
    reason: gap.reason, deadline: null,
  }));
  const education = asArray(profile.education);
  const tests = asArray(profile.examScores);
  if (education.length && education.some((item) => item.gradingSystem && item.gradeValue)) {
    actions.push({ key: 'academic_records', label: 'Academic records', status: GUIDANCE_READINESS_STATES.READY, deadline: null });
  }
  if (tests.length && tests.some((item) => item.status === 'completed')) {
    actions.push({ key: 'test_scores', label: 'Language or standardized tests', status: GUIDANCE_READINESS_STATES.READY, deadline: null });
  }
  return { items: actions.slice(0, 10), unknownRequirements: true };
}

export function buildApplicationReadiness({ documents = [], checklists = [], applications = [], deadlines = [], pendingActions = [] } = {}) {
  const safeDocuments = asArray(documents).map((doc) => ({
    id: doc._id != null ? String(doc._id) : null,
    documentType: doc.documentType || 'other',
    status: doc.status || 'unknown',
  }));
  const checklistItems = asArray(checklists).flatMap((checklist) => asArray(checklist.items));
  const documentItems = checklistItems.filter((item) => item.documentRequirementType).map((item) => {
    const present = safeDocuments.some((doc) => doc.status === 'active' && doc.documentType === item.documentRequirementType);
    return {
      key: item.requirementRef || item.documentRequirementType,
      label: item.label,
      status: present ? GUIDANCE_READINESS_STATES.READY : GUIDANCE_READINESS_STATES.MISSING,
      requirementType: item.documentRequirementType,
    };
  });
  const unknownRequirements = checklistItems.filter((item) => !item.documentRequirementType).map((item) => ({
    key: item.requirementRef || item.label, label: item.label, status: GUIDANCE_READINESS_STATES.UNKNOWN,
  }));
  return {
    documents: documentItems.slice(0, 20),
    unknownRequirements: unknownRequirements.slice(0, 20),
    applications: asArray(applications).slice(0, 10).map((app) => ({ id: app._id != null ? String(app._id) : null, title: app.targetTitle || null, targetType: app.targetType || null, status: app.status || 'unknown', startedAt: app.startedAt || null, submittedAt: app.submittedAt || null })),
    hardDeadlines: asArray(deadlines).slice(0, 10).map((deadline) => ({ title: deadline.title || null, deadlineAt: deadline.deadlineAt || null, isDateOnly: deadline.isDateOnly === true, sourceEntityType: deadline.sourceEntityType || null })),
    recommendedActions: asArray(pendingActions).slice(0, 10).map((action) => ({ id: action._id != null ? String(action._id) : null, title: action.title || action.label || null, status: action.status || 'unknown', dueAt: action.dueAt || null })),
  };
}

export function classifyGuidanceFreshness({ freshnessState, verificationStatus, lastVerifiedAt } = {}) {
  if (freshnessState === 'fresh' || freshnessState === 'verified_recent') return GUIDANCE_FRESHNESS_STATES.VERIFIED_RECENT;
  if (verificationStatus === 'verified' && lastVerifiedAt) return GUIDANCE_FRESHNESS_STATES.VERIFIED;
  if (freshnessState === 'stale' || freshnessState === 'review_due' || freshnessState === 'broken') return GUIDANCE_FRESHNESS_STATES.STALE;
  if (verificationStatus === 'unverified') return GUIDANCE_FRESHNESS_STATES.UNVERIFIED;
  return GUIDANCE_FRESHNESS_STATES.UNKNOWN;
}

export function summarizeGuidanceFreshness(records = []) {
  const summary = Object.fromEntries(Object.values(GUIDANCE_FRESHNESS_STATES).map((state) => [state, 0]));
  for (const record of asArray(records)) summary[classifyGuidanceFreshness(record)] += 1;
  return summary;
}
