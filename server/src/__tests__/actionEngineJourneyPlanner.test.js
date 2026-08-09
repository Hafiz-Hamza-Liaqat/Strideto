/**
 * Mission 9 — Action Engine / Journey Planner tests.
 *
 * Pure-contract tests (no DB, no network). Run:
 *   node src/__tests__/actionEngineJourneyPlanner.test.js
 *
 * Coverage:
 *  1.  ACTION_TYPES all defined
 *  2.  ACTION_STATUSES all defined
 *  3.  PRIORITY_LEVELS all defined
 *  4.  URGENCY_LEVELS all defined
 *  5.  classifyDeadlineUrgency — overdue (past date)
 *  6.  classifyDeadlineUrgency — urgent (≤7 days)
 *  7.  classifyDeadlineUrgency — soon (≤30 days)
 *  8.  classifyDeadlineUrgency — upcoming (≤90 days)
 *  9.  classifyDeadlineUrgency — none (>90 days)
 * 10.  classifyDeadlineUrgency — unknown (null deadline)
 * 11.  classifyDeadlineUrgency — date-only classification (conservative)
 * 12.  identifyProfileGaps — missing nationality
 * 13.  identifyProfileGaps — missing education
 * 14.  identifyProfileGaps — missing study goals
 * 15.  identifyProfileGaps — complete profile returns empty gaps
 * 16.  buildJourneyPlan — stage order and count
 * 17.  buildJourneyPlan — complete_profile stage done when no gaps
 * 18.  buildJourneyPlan — explore_opportunities in_progress when savedOpportunities exist
 * 19.  buildJourneyPlan — apply stage in_progress with active applications
 * 20.  buildJourneyPlan — track_outcome in_progress with outcome-stage applications
 * 21.  buildJourneyPlan — goal-aware (study goal, no job steps)
 * 22.  buildJourneyPlan — overallProgress calculation
 * 23.  buildJourneyPlan — generatedAt is ISO string
 * 24.  buildJourneyPlan — uses Mission 8 gaps (criticalGaps) not duplicate logic
 * 25.  computeNextBestAction — returns null when no inputs
 * 26.  computeNextBestAction — overdue deadline → SAFETY_CRITICAL priority
 * 27.  computeNextBestAction — urgent deadline → IMMINENT_HARD_DEADLINE priority
 * 28.  computeNextBestAction — overdue wins over urgent
 * 29.  computeNextBestAction — blocking eligibility gap → BLOCKING_ELIGIBILITY_GAP
 * 30.  computeNextBestAction — imminent deadline beats eligibility gap
 * 31.  computeNextBestAction — active application action → ACTIVE_APPLICATION_REQUIREMENT
 * 32.  computeNextBestAction — profile gap → IMPORTANT_PROFILE_GAP
 * 33.  computeNextBestAction — approaching deadline (soon) → APPROACHING_DEADLINE
 * 34.  computeNextBestAction — saved opportunity → SAVED_OPPORTUNITY_ACTION
 * 35.  computeNextBestAction — completed action not surfaced as next action
 * 36.  computeNextBestAction — dismissed action not surfaced as next action
 * 37.  computeNextBestAction — freshnessWarning propagated to output
 * 38.  computeNextBestAction — no guarantee/admission language in action or reason
 * 39.  EDUCATION_APPLICATION_STATUSES — all lifecycle states present
 * 40.  EDUCATION_APPLICATION_MODES — self_managed present
 * 41.  EDUCATION_APPLICATION_MODES — no agent/direct modes deployed
 * 42.  CHECKLIST_ITEM_STATUSES — pending, completed, skipped defined
 * 43.  DOCUMENT_REQUIREMENT_TYPES — transcript, passport, cv, etc. defined
 * 44.  DOCUMENT_REQUIREMENT_TYPES — no file storage logic
 * 45.  ALERT_TYPES — all alert types defined
 * 46.  NBA_PRIORITY — explicit numeric hierarchy (safety < imminent < gap < app < profile)
 * 47.  buildJourneyPlan — document actions increase prepare_materials count
 * 48.  SAVED_OPPORTUNITY_TYPES — program and canonical_scholarship
 * 49.  DEADLINE_SOURCE_TYPES — all canonical source types present
 * 50.  classifyDeadlineUrgency — configurable thresholds respected
 */

import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedDir = path.resolve(__dirname, '../../../shared');

const loadShared = (rel) => import(pathToFileURL(path.join(sharedDir, rel)).href);

const ae = await loadShared('action/actionEngine.js');

const {
  ACTION_TYPES,
  ACTION_STATUSES,
  PRIORITY_LEVELS,
  URGENCY_LEVELS,
  EDUCATION_APPLICATION_STATUSES,
  EDUCATION_APPLICATION_MODES,
  CHECKLIST_ITEM_STATUSES,
  DOCUMENT_REQUIREMENT_TYPES,
  ALERT_TYPES,
  NBA_PRIORITY,
  SAVED_OPPORTUNITY_TYPES,
  DEADLINE_SOURCE_TYPES,
  JOURNEY_STAGE_ORDER,
  classifyDeadlineUrgency,
  identifyProfileGaps,
  buildJourneyPlan,
  computeNextBestAction,
  DEFAULT_URGENCY_THRESHOLDS_DAYS,
} = ae;

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
    failures.push({ name, err });
  }
}

function now() { return new Date(); }
function daysFromNow(n) { return new Date(Date.now() + n * 86400000); }

// ── 1-4: Constants ────────────────────────────────────────────────────────────

test('1. ACTION_TYPES all defined', () => {
  assert.ok(ACTION_TYPES.PROFILE_COMPLETION);
  assert.ok(ACTION_TYPES.TEST);
  assert.ok(ACTION_TYPES.DOCUMENT);
  assert.ok(ACTION_TYPES.APPLICATION);
  assert.ok(ACTION_TYPES.GENERAL);
});

test('2. ACTION_STATUSES all defined', () => {
  assert.ok(ACTION_STATUSES.TODO);
  assert.ok(ACTION_STATUSES.IN_PROGRESS);
  assert.ok(ACTION_STATUSES.COMPLETED);
  assert.ok(ACTION_STATUSES.DISMISSED);
});

test('3. PRIORITY_LEVELS all defined', () => {
  assert.ok(PRIORITY_LEVELS.CRITICAL);
  assert.ok(PRIORITY_LEVELS.HIGH);
  assert.ok(PRIORITY_LEVELS.MEDIUM);
  assert.ok(PRIORITY_LEVELS.LOW);
});

test('4. URGENCY_LEVELS all defined', () => {
  assert.ok(URGENCY_LEVELS.OVERDUE);
  assert.ok(URGENCY_LEVELS.URGENT);
  assert.ok(URGENCY_LEVELS.SOON);
  assert.ok(URGENCY_LEVELS.UPCOMING);
  assert.ok(URGENCY_LEVELS.NONE);
  assert.ok(URGENCY_LEVELS.UNKNOWN);
});

// ── 5-11: Urgency classification ──────────────────────────────────────────────

test('5. classifyDeadlineUrgency — overdue', () => {
  const past = daysFromNow(-5);
  assert.strictEqual(classifyDeadlineUrgency(past, false, DEFAULT_URGENCY_THRESHOLDS_DAYS, now()), URGENCY_LEVELS.OVERDUE);
});

test('6. classifyDeadlineUrgency — urgent (≤7 days)', () => {
  const d = daysFromNow(3);
  assert.strictEqual(classifyDeadlineUrgency(d, false, DEFAULT_URGENCY_THRESHOLDS_DAYS, now()), URGENCY_LEVELS.URGENT);
});

test('7. classifyDeadlineUrgency — soon (≤30 days)', () => {
  const d = daysFromNow(15);
  assert.strictEqual(classifyDeadlineUrgency(d, false, DEFAULT_URGENCY_THRESHOLDS_DAYS, now()), URGENCY_LEVELS.SOON);
});

test('8. classifyDeadlineUrgency — upcoming (≤90 days)', () => {
  const d = daysFromNow(60);
  assert.strictEqual(classifyDeadlineUrgency(d, false, DEFAULT_URGENCY_THRESHOLDS_DAYS, now()), URGENCY_LEVELS.UPCOMING);
});

test('9. classifyDeadlineUrgency — none (>90 days)', () => {
  const d = daysFromNow(120);
  assert.strictEqual(classifyDeadlineUrgency(d, false, DEFAULT_URGENCY_THRESHOLDS_DAYS, now()), URGENCY_LEVELS.NONE);
});

test('10. classifyDeadlineUrgency — unknown (null deadline)', () => {
  assert.strictEqual(classifyDeadlineUrgency(null, false, DEFAULT_URGENCY_THRESHOLDS_DAYS, now()), URGENCY_LEVELS.UNKNOWN);
});

test('11. classifyDeadlineUrgency — date-only flag preserved in result path', () => {
  // Date-only deadlines still classify by day difference — not invented timezone
  const d = daysFromNow(2);
  const result = classifyDeadlineUrgency(d, true, DEFAULT_URGENCY_THRESHOLDS_DAYS, now());
  assert.strictEqual(result, URGENCY_LEVELS.URGENT);
});

// ── 12-15: Profile gaps ───────────────────────────────────────────────────────

test('12. identifyProfileGaps — missing nationality', () => {
  const gaps = identifyProfileGaps({ personalInfo: {}, education: [{}], studyGoals: [{}], studentPreferences: { destinationCountries: ['US'] }, examScores: [{}] });
  assert.ok(gaps.includes('nationality'));
});

test('13. identifyProfileGaps — missing education', () => {
  const gaps = identifyProfileGaps({ personalInfo: { nationality: 'PK', country: 'PK' }, education: [], studyGoals: [{}], studentPreferences: { destinationCountries: ['US'] }, examScores: [{}] });
  assert.ok(gaps.includes('education'));
});

test('14. identifyProfileGaps — missing study goals', () => {
  const gaps = identifyProfileGaps({ personalInfo: { nationality: 'PK', country: 'PK' }, education: [{}], studyGoals: [], studentPreferences: { destinationCountries: ['US'] }, examScores: [{}] });
  assert.ok(gaps.includes('study_goals'));
});

test('15. identifyProfileGaps — complete profile returns empty gaps', () => {
  const gaps = identifyProfileGaps({
    personalInfo: { nationality: 'PK', country: 'PK' },
    education: [{ degree: 'BSc' }],
    studyGoals: [{ goalType: 'study' }],
    studentPreferences: { destinationCountries: ['US'] },
    examScores: [{ testName: 'IELTS' }],
  });
  assert.strictEqual(gaps.length, 0);
});

// ── 16-24: Journey planner ────────────────────────────────────────────────────

const baseJourneyInputs = {
  profile: { personalInfo: { nationality: 'PK', country: 'PK' }, education: [{}], studyGoals: [], studentPreferences: { destinationCountries: [] }, examScores: [] },
  profileGaps: [],
  eligibilityGaps: { criticalGaps: [], majorGaps: [] },
  savedOpportunities: [],
  educationApplications: [],
  pendingActions: [],
  upcomingDeadlines: [],
  goalTypes: [],
};

test('16. buildJourneyPlan — stage order and count', () => {
  const plan = buildJourneyPlan(baseJourneyInputs);
  assert.strictEqual(plan.stages.length, JOURNEY_STAGE_ORDER.length);
  for (let i = 0; i < plan.stages.length; i++) {
    assert.strictEqual(plan.stages[i].order, i + 1);
  }
});

test('17. buildJourneyPlan — complete_profile done when no gaps', () => {
  const plan = buildJourneyPlan({ ...baseJourneyInputs, profileGaps: [] });
  const stage = plan.stages.find((s) => s.id === 'complete_profile');
  assert.strictEqual(stage.status, 'done');
});

test('18. buildJourneyPlan — explore_opportunities in_progress with saved opportunities', () => {
  const plan = buildJourneyPlan({ ...baseJourneyInputs, savedOpportunities: [{ _id: '1', entityType: 'program', entityId: 'p1' }] });
  const stage = plan.stages.find((s) => s.id === 'explore_opportunities');
  assert.strictEqual(stage.status, 'in_progress');
});

test('19. buildJourneyPlan — apply in_progress with active applications', () => {
  const plan = buildJourneyPlan({
    ...baseJourneyInputs,
    educationApplications: [{ status: 'preparing', _id: 'a1' }],
  });
  const stage = plan.stages.find((s) => s.id === 'apply');
  assert.strictEqual(stage.status, 'in_progress');
});

test('20. buildJourneyPlan — track_outcome in_progress with outcome-stage applications', () => {
  const plan = buildJourneyPlan({
    ...baseJourneyInputs,
    educationApplications: [{ status: 'offer_or_admitted', _id: 'a2' }],
  });
  const stage = plan.stages.find((s) => s.id === 'track_outcome');
  assert.strictEqual(stage.status, 'in_progress');
});

test('21. buildJourneyPlan — goal-aware: scholarship goal reflected in description', () => {
  const plan = buildJourneyPlan({ ...baseJourneyInputs, goalTypes: ['scholarship'] });
  const exploreStage = plan.stages.find((s) => s.id === 'explore_opportunities');
  assert.ok(exploreStage.description.includes('scholarship'));
});

test('22. buildJourneyPlan — overallProgress is 0-100', () => {
  const plan = buildJourneyPlan(baseJourneyInputs);
  assert.ok(plan.overallProgress >= 0 && plan.overallProgress <= 100);
});

test('23. buildJourneyPlan — generatedAt is ISO string', () => {
  const plan = buildJourneyPlan(baseJourneyInputs);
  assert.ok(typeof plan.generatedAt === 'string');
  assert.ok(!isNaN(Date.parse(plan.generatedAt)));
});

test('24. buildJourneyPlan — uses Mission 8 criticalGaps (not duplicating eligibility)', () => {
  const plan = buildJourneyPlan({
    ...baseJourneyInputs,
    eligibilityGaps: { criticalGaps: [{ type: 'academic', label: 'GPA requirement', key: 'gpa' }], majorGaps: [] },
  });
  const reqStage = plan.stages.find((s) => s.id === 'meet_requirements');
  assert.strictEqual(reqStage.criticalGapCount, 1);
});

// ── 25-38: Next Best Action ───────────────────────────────────────────────────

test('25. computeNextBestAction — returns null when no inputs', () => {
  const nba = computeNextBestAction({});
  assert.strictEqual(nba, null);
});

test('26. computeNextBestAction — overdue deadline → SAFETY_CRITICAL priority', () => {
  const nba = computeNextBestAction({
    upcomingDeadlines: [{ title: 'App deadline', deadlineAt: daysFromNow(-2), urgency: URGENCY_LEVELS.OVERDUE, entityType: 'program', entityId: 'p1' }],
  });
  assert.ok(nba);
  assert.strictEqual(nba.priorityScore, NBA_PRIORITY.SAFETY_CRITICAL);
  assert.strictEqual(nba.priority, PRIORITY_LEVELS.CRITICAL);
});

test('27. computeNextBestAction — urgent deadline → IMMINENT_HARD_DEADLINE priority', () => {
  const nba = computeNextBestAction({
    upcomingDeadlines: [{ title: 'Scholarship deadline', deadlineAt: daysFromNow(3), urgency: URGENCY_LEVELS.URGENT, entityType: 'canonical_scholarship', entityId: 's1' }],
  });
  assert.ok(nba);
  assert.strictEqual(nba.priorityScore, NBA_PRIORITY.IMMINENT_HARD_DEADLINE);
});

test('28. computeNextBestAction — overdue beats urgent', () => {
  const nba = computeNextBestAction({
    upcomingDeadlines: [
      { title: 'Urgent', deadlineAt: daysFromNow(2), urgency: URGENCY_LEVELS.URGENT, entityType: 'program', entityId: 'p2' },
      { title: 'Overdue', deadlineAt: daysFromNow(-1), urgency: URGENCY_LEVELS.OVERDUE, entityType: 'program', entityId: 'p1' },
    ],
  });
  assert.strictEqual(nba.priorityScore, NBA_PRIORITY.SAFETY_CRITICAL);
});

test('29. computeNextBestAction — blocking eligibility gap', () => {
  const nba = computeNextBestAction({
    eligibilityGaps: { criticalGaps: [{ type: 'academic', label: 'GPA below threshold', key: 'gpa', reason: 'GPA too low for program requirements.' }], majorGaps: [] },
  });
  assert.strictEqual(nba.priorityScore, NBA_PRIORITY.BLOCKING_ELIGIBILITY_GAP);
});

test('30. computeNextBestAction — imminent deadline beats eligibility gap', () => {
  const nba = computeNextBestAction({
    upcomingDeadlines: [{ title: 'Imminent', deadlineAt: daysFromNow(1), urgency: URGENCY_LEVELS.URGENT, entityType: 'program', entityId: 'p1' }],
    eligibilityGaps: { criticalGaps: [{ type: 'test', label: 'IELTS required', key: 'ielts' }], majorGaps: [] },
  });
  assert.ok(nba.priorityScore < NBA_PRIORITY.BLOCKING_ELIGIBILITY_GAP);
});

test('31. computeNextBestAction — active application action', () => {
  const nba = computeNextBestAction({
    pendingActions: [{ _id: 'a1', title: 'Upload CV', actionType: ACTION_TYPES.DOCUMENT, status: ACTION_STATUSES.TODO }],
  });
  assert.strictEqual(nba.priorityScore, NBA_PRIORITY.ACTIVE_APPLICATION_REQUIREMENT);
});

test('32. computeNextBestAction — profile gap surfaces correctly', () => {
  const nba = computeNextBestAction({ profileGaps: ['education'] });
  assert.strictEqual(nba.priorityScore, NBA_PRIORITY.IMPORTANT_PROFILE_GAP);
});

test('33. computeNextBestAction — approaching deadline (soon)', () => {
  const nba = computeNextBestAction({
    upcomingDeadlines: [{ title: 'Soon deadline', deadlineAt: daysFromNow(20), urgency: URGENCY_LEVELS.SOON, entityType: 'program', entityId: 'p1' }],
  });
  assert.strictEqual(nba.priorityScore, NBA_PRIORITY.APPROACHING_DEADLINE);
});

test('34. computeNextBestAction — saved opportunity with no application', () => {
  const nba = computeNextBestAction({
    savedOpportunities: [{ entityType: 'program', entityId: 'p1', title: 'MSc CS at MIT' }],
    activeApplications: [],
  });
  assert.strictEqual(nba.priorityScore, NBA_PRIORITY.SAVED_OPPORTUNITY_ACTION);
});

test('35. computeNextBestAction — completed action not surfaced', () => {
  const nba = computeNextBestAction({
    pendingActions: [{ _id: 'a1', title: 'Done task', actionType: ACTION_TYPES.DOCUMENT, status: ACTION_STATUSES.COMPLETED }],
  });
  assert.strictEqual(nba, null);
});

test('36. computeNextBestAction — dismissed action not surfaced', () => {
  const nba = computeNextBestAction({
    pendingActions: [{ _id: 'a2', title: 'Dismissed task', actionType: ACTION_TYPES.APPLICATION, status: ACTION_STATUSES.DISMISSED }],
  });
  assert.strictEqual(nba, null);
});

test('37. computeNextBestAction — freshnessWarning propagated', () => {
  const nba = computeNextBestAction({
    upcomingDeadlines: [{ title: 'Stale deadline', deadlineAt: daysFromNow(1), urgency: URGENCY_LEVELS.URGENT, entityType: 'program', entityId: 'p1', freshnessWarning: 'Source last verified 6 months ago.' }],
  });
  assert.ok(nba.freshnessWarning);
  assert.ok(nba.freshnessWarning.includes('6 months'));
});

test('38. computeNextBestAction — no guarantee/admission language in output', () => {
  const nba = computeNextBestAction({ profileGaps: ['education'] });
  if (nba) {
    const text = `${nba.action} ${nba.reason}`.toLowerCase();
    assert.ok(!text.includes('guarantees admission'), 'Must not claim guarantee');
    assert.ok(!text.includes('guarantees scholarship'), 'Must not claim guarantee');
  }
});

// ── 39-50: Data model constants ───────────────────────────────────────────────

test('39. EDUCATION_APPLICATION_STATUSES — lifecycle states present', () => {
  assert.ok(EDUCATION_APPLICATION_STATUSES.INTERESTED);
  assert.ok(EDUCATION_APPLICATION_STATUSES.PREPARING);
  assert.ok(EDUCATION_APPLICATION_STATUSES.SUBMITTED);
  assert.ok(EDUCATION_APPLICATION_STATUSES.OFFER_OR_ADMITTED);
  assert.ok(EDUCATION_APPLICATION_STATUSES.REJECTED);
  assert.ok(EDUCATION_APPLICATION_STATUSES.COMPLETED);
});

test('40. EDUCATION_APPLICATION_MODES — self_managed present', () => {
  assert.strictEqual(EDUCATION_APPLICATION_MODES.SELF_MANAGED, 'self_managed');
});

test('41. EDUCATION_APPLICATION_MODES — future modes listed but not enforced in M9', () => {
  assert.ok(EDUCATION_APPLICATION_MODES.AGENT_MANAGED_FUTURE);
  assert.ok(EDUCATION_APPLICATION_MODES.DIRECT_INTEGRATION_FUTURE);
});

test('42. CHECKLIST_ITEM_STATUSES — pending, completed, skipped defined', () => {
  assert.ok(CHECKLIST_ITEM_STATUSES.PENDING);
  assert.ok(CHECKLIST_ITEM_STATUSES.COMPLETED);
  assert.ok(CHECKLIST_ITEM_STATUSES.SKIPPED);
});

test('43. DOCUMENT_REQUIREMENT_TYPES — key types defined', () => {
  assert.ok(DOCUMENT_REQUIREMENT_TYPES.TRANSCRIPT);
  assert.ok(DOCUMENT_REQUIREMENT_TYPES.PASSPORT);
  assert.ok(DOCUMENT_REQUIREMENT_TYPES.CV);
  assert.ok(DOCUMENT_REQUIREMENT_TYPES.RECOMMENDATION_LETTER);
  assert.ok(DOCUMENT_REQUIREMENT_TYPES.STATEMENT_OF_PURPOSE);
});

test('44. DOCUMENT_REQUIREMENT_TYPES — no file storage logic (identifiers only)', () => {
  for (const v of Object.values(DOCUMENT_REQUIREMENT_TYPES)) {
    assert.ok(typeof v === 'string', 'Each type is an identifier string only');
  }
});

test('45. ALERT_TYPES — all alert types defined', () => {
  assert.ok(ALERT_TYPES.SAVED_SCHOLARSHIP_DEADLINE);
  assert.ok(ALERT_TYPES.SAVED_PROGRAM_DEADLINE);
  assert.ok(ALERT_TYPES.TEST_DEADLINE);
  assert.ok(ALERT_TYPES.APPLICATION_MILESTONE);
  assert.ok(ALERT_TYPES.TASK_REMINDER);
});

test('46. NBA_PRIORITY — explicit numeric hierarchy', () => {
  assert.ok(NBA_PRIORITY.SAFETY_CRITICAL < NBA_PRIORITY.IMMINENT_HARD_DEADLINE);
  assert.ok(NBA_PRIORITY.IMMINENT_HARD_DEADLINE < NBA_PRIORITY.BLOCKING_ELIGIBILITY_GAP);
  assert.ok(NBA_PRIORITY.BLOCKING_ELIGIBILITY_GAP < NBA_PRIORITY.ACTIVE_APPLICATION_REQUIREMENT);
  assert.ok(NBA_PRIORITY.ACTIVE_APPLICATION_REQUIREMENT < NBA_PRIORITY.IMPORTANT_PROFILE_GAP);
  assert.ok(NBA_PRIORITY.IMPORTANT_PROFILE_GAP < NBA_PRIORITY.APPROACHING_DEADLINE);
  assert.ok(NBA_PRIORITY.APPROACHING_DEADLINE < NBA_PRIORITY.SAVED_OPPORTUNITY_ACTION);
});

test('47. buildJourneyPlan — document actions counted in prepare_materials', () => {
  const plan = buildJourneyPlan({
    ...baseJourneyInputs,
    pendingActions: [
      { actionType: ACTION_TYPES.DOCUMENT, status: ACTION_STATUSES.TODO, _id: 'd1', title: 'Get transcript' },
    ],
  });
  const stage = plan.stages.find((s) => s.id === 'prepare_materials');
  assert.strictEqual(stage.actionCount, 1);
});

test('48. SAVED_OPPORTUNITY_TYPES — program and canonical_scholarship', () => {
  assert.strictEqual(SAVED_OPPORTUNITY_TYPES.PROGRAM, 'program');
  assert.strictEqual(SAVED_OPPORTUNITY_TYPES.CANONICAL_SCHOLARSHIP, 'canonical_scholarship');
});

test('49. DEADLINE_SOURCE_TYPES — canonical source types present', () => {
  assert.ok(DEADLINE_SOURCE_TYPES.SCHOLARSHIP_CYCLE);
  assert.ok(DEADLINE_SOURCE_TYPES.PROGRAM_INTAKE);
  assert.ok(DEADLINE_SOURCE_TYPES.TEST);
  assert.ok(DEADLINE_SOURCE_TYPES.USER_CREATED);
  assert.ok(DEADLINE_SOURCE_TYPES.APPLICATION_MILESTONE);
});

test('50. classifyDeadlineUrgency — configurable thresholds respected', () => {
  const customThresholds = { URGENT: 3, SOON: 10, UPCOMING: 30 };
  // 5 days away: with default = soon, with custom = soon (between 3 and 10)
  const d5 = daysFromNow(5);
  assert.strictEqual(classifyDeadlineUrgency(d5, false, customThresholds, now()), URGENCY_LEVELS.SOON);
  // 2 days away: with custom thresholds = urgent
  const d2 = daysFromNow(2);
  assert.strictEqual(classifyDeadlineUrgency(d2, false, customThresholds, now()), URGENCY_LEVELS.URGENT);
  // 25 days: with custom upcoming threshold of 30 = upcoming
  const d25 = daysFromNow(25);
  assert.strictEqual(classifyDeadlineUrgency(d25, false, customThresholds, now()), URGENCY_LEVELS.UPCOMING);
  // 35 days: beyond custom upcoming = none
  const d35 = daysFromNow(35);
  assert.strictEqual(classifyDeadlineUrgency(d35, false, customThresholds, now()), URGENCY_LEVELS.NONE);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Mission 9 Action Engine Tests: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach(({ name }) => console.log(`  ✗ ${name}`));
  process.exit(1);
} else {
  console.log('All tests passed.');
  process.exit(0);
}
