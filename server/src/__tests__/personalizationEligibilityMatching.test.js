/**
 * Mission 8 — Personalization / Eligibility / Matching Engine tests.
 *
 * Pure-contract tests (no DB, no network). Run:
 *   node src/__tests__/personalizationEligibilityMatching.test.js
 *
 * Coverage:
 *  1.  ELIGIBILITY_STATES all defined, non-boolean
 *  2.  unknown/missing_profile_data NOT automatically fail
 *  3.  Nationality / residence — match pass
 *  4.  Nationality / residence — open (*) pass
 *  5.  Nationality / residence — mismatch fail
 *  6.  Nationality / residence — missing profile data → missing_profile_data
 *  7.  Degree level — match pass
 *  8.  Degree level — mismatch fail
 *  9.  Degree level — ambiguous level → unknown
 * 10.  Academic threshold — compatible grading → pass
 * 11.  Academic threshold — compatible grading → fail
 * 12.  Academic threshold — incompatible grading → unknown (no guessing)
 * 13.  Academic threshold — missing graded education → missing_profile_data
 * 14.  Test requirement — overall minimum met → pass
 * 15.  Test requirement — overall minimum below → fail
 * 16.  Test requirement — section score below → fail
 * 17.  Test requirement — no test in profile → missing_profile_data
 * 18.  Test requirement — planned test → missing_profile_data (not completed)
 * 19.  Test requirement — expired test → missing_profile_data
 * 20.  Test requirement — not_accepted by program → fail
 * 21.  Test requirement — no numeric minimum but test present → pass
 * 22.  Program/intake acceptance precedence: program overrides institution
 * 23.  Scholarship nationality criteria evaluation
 * 24.  Scholarship degree level criteria evaluation
 * 25.  Scholarship admission_enrollment → manual_review
 * 26.  Scholarship unsupported criteria → manual_review
 * 27.  Scholarship financial_need without budget data → missing_profile_data
 * 28.  deriveOverallEligibilityState — all pass → eligible
 * 29.  deriveOverallEligibilityState — one fail → not_eligible
 * 30.  deriveOverallEligibilityState — only missing → potentially_eligible
 * 31.  deriveOverallEligibilityState — only manual_review → requires_manual_review
 * 32.  deriveOverallEligibilityState — only unknown → insufficient_information
 * 33.  computeMatchScore — explicit weights, component scores
 * 34.  computeMatchScore — eligibility separate from match score
 * 35.  computeMatchScore — destination mismatch lowers score
 * 36.  computeMatchScore — global scholarship gives full destination score
 * 37.  analyzeGaps — fail criterion → critical gap
 * 38.  analyzeGaps — missing_profile_data → major gap
 * 39.  analyzeGaps — manual_review → minor gap
 * 40.  buildEligibilityResult — timestamps, profileDataUsed, freshnessWarnings
 * 41.  buildRecommendation — no guarantee/probability language in note
 * 42.  Profile incompleteness — no exam scores detected
 * 43.  Stale/broken provenance warning via buildFreshnessWarning
 * 44.  buildTestGuidance — score meets requirement
 * 45.  buildTestGuidance — score below requirement
 * 46.  buildTestGuidance — no test in profile
 * 47.  evaluateField — match pass
 * 48.  evaluateField — no profile field → missing_profile_data
 * 49.  evaluateStudyMode — match pass
 * 50.  evaluateStudyMode — mismatch fail
 * 51.  evaluateDestination — match pass
 * 52.  evaluateDestination — global scholarship pass
 * 53.  evaluateFundingPreference — scholarship required, fully funded → pass
 * 54.  evaluateFundingPreference — scholarship required, partial → fail
 * 55.  evaluateExperience — quantifiable meets requirement → pass
 * 56.  evaluateExperience — non-quantifiable → manual_review
 * 57.  evaluateAgeCriteria — explicit DOB, meets range → pass
 * 58.  evaluateAgeCriteria — exceeds max → fail
 * 59.  evaluateScholarshipCriteria — full scenario
 * 60.  No guarantee/probability language in ELIGIBILITY_STATES values
 */

import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedDir = path.resolve(__dirname, '../../../shared');

const loadShared = (rel) => import(pathToFileURL(path.join(sharedDir, rel)).href);

const eng = await loadShared('education/eligibilityEngine.js');
const ae = await loadShared('education/acceptanceExplorer.js');

const {
  ELIGIBILITY_STATES,
  CRITERION_STATES,
  GAP_SEVERITIES,
  MATCH_COMPONENT_KEYS,
  evaluateNationalityResidence,
  evaluateDegreeLevel,
  evaluateAcademicThreshold,
  evaluateTestRequirement,
  evaluateExperience,
  evaluateField,
  evaluateStudyMode,
  evaluateDestination,
  evaluateFundingPreference,
  evaluateScholarshipCriteria,
  deriveOverallEligibilityState,
  buildEligibilityResult,
  computeMatchScore,
  analyzeGaps,
  buildRecommendation,
  buildFreshnessWarning,
  buildTestGuidance,
  makeCriterionResult,
} = eng;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    → ${err.message}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\nMission 8 — Personalization / Eligibility / Matching Engine\n');

// 1. ELIGIBILITY_STATES defined and non-boolean
test('1. ELIGIBILITY_STATES all defined, non-boolean values', () => {
  const expected = ['eligible', 'potentially_eligible', 'not_eligible', 'insufficient_information', 'requires_manual_review'];
  for (const e of expected) {
    assert(Object.values(ELIGIBILITY_STATES).includes(e), `Missing state: ${e}`);
    assert(typeof e === 'string', 'State must be string, not boolean');
  }
});

// 2. unknown NOT automatically fail
test('2. unknown/missing_profile_data does NOT automatically mean fail', () => {
  const results = [
    makeCriterionResult({ key: 'a', label: 'A', state: CRITERION_STATES.UNKNOWN }),
    makeCriterionResult({ key: 'b', label: 'B', state: CRITERION_STATES.MISSING_PROFILE_DATA }),
  ];
  const state = deriveOverallEligibilityState(results);
  assert(state !== ELIGIBILITY_STATES.NOT_ELIGIBLE, `unknown/missing should not be not_eligible, got: ${state}`);
});

// 3. Nationality — match pass
test('3. Nationality/residence — matching country passes', () => {
  const r = evaluateNationalityResidence({ profileNationality: 'PK', profileCountry: null, criteriaValue: 'PK,IN,BD' });
  assert.strictEqual(r.state, CRITERION_STATES.PASS);
});

// 4. Nationality — open (*) pass
test('4. Nationality/residence — * (any) always passes', () => {
  const r = evaluateNationalityResidence({ profileNationality: 'US', profileCountry: null, criteriaValue: '*' });
  assert.strictEqual(r.state, CRITERION_STATES.PASS);
});

// 5. Nationality — mismatch fail
test('5. Nationality/residence — mismatch fails', () => {
  const r = evaluateNationalityResidence({ profileNationality: 'CN', profileCountry: null, criteriaValue: 'PK,IN' });
  assert.strictEqual(r.state, CRITERION_STATES.FAIL);
});

// 6. Nationality — missing profile data
test('6. Nationality/residence — no profile nationality → missing_profile_data', () => {
  const r = evaluateNationalityResidence({ profileNationality: null, profileCountry: null, criteriaValue: 'PK,IN' });
  assert.strictEqual(r.state, CRITERION_STATES.MISSING_PROFILE_DATA);
});

// 7. Degree level — match pass
test('7. Degree level — goal bachelor matches requirement bachelor', () => {
  const r = evaluateDegreeLevel({ profileGoalDegreeLevels: ['bachelor'], requiredDegreeLevels: ['bachelor'] });
  assert.strictEqual(r.state, CRITERION_STATES.PASS);
});

// 8. Degree level — mismatch fail
test('8. Degree level — goal phd does not match bachelor', () => {
  const r = evaluateDegreeLevel({ profileGoalDegreeLevels: ['phd'], requiredDegreeLevels: ['bachelor'] });
  assert.strictEqual(r.state, CRITERION_STATES.FAIL);
});

// 9. Degree level — ambiguous
test('9. Degree level — goal "other" → unknown (ambiguous mapping)', () => {
  const r = evaluateDegreeLevel({ profileGoalDegreeLevels: ['other'], requiredDegreeLevels: ['bachelor'] });
  assert.strictEqual(r.state, CRITERION_STATES.UNKNOWN);
});

// 10. Academic threshold — compatible grading, pass
test('10. Academic threshold — gpa_4 compatible, grade meets minimum', () => {
  const r = evaluateAcademicThreshold({
    profileEducation: [{ gradingSystem: 'gpa_4', gradeValue: '3.7', completionStatus: 'completed' }],
    requiredGradingSystem: 'gpa_4',
    requiredMinimum: 3.0,
  });
  assert.strictEqual(r.state, CRITERION_STATES.PASS);
});

// 11. Academic threshold — compatible grading, fail
test('11. Academic threshold — gpa_4 compatible, grade below minimum', () => {
  const r = evaluateAcademicThreshold({
    profileEducation: [{ gradingSystem: 'gpa_4', gradeValue: '2.5', completionStatus: 'completed' }],
    requiredGradingSystem: 'gpa_4',
    requiredMinimum: 3.0,
  });
  assert.strictEqual(r.state, CRITERION_STATES.FAIL);
});

// 12. Academic threshold — incompatible grading → unknown (NO guessing)
test('12. Academic threshold — percentage vs gpa_4 incompatible → unknown', () => {
  const r = evaluateAcademicThreshold({
    profileEducation: [{ gradingSystem: 'percentage', gradeValue: '85', completionStatus: 'completed' }],
    requiredGradingSystem: 'gpa_4',
    requiredMinimum: 3.0,
  });
  assert.strictEqual(r.state, CRITERION_STATES.UNKNOWN, `Expected unknown, got: ${r.state}`);
  assert(!r.reason.includes('guess'), 'Should not mention guessing');
});

// 13. Academic threshold — no completed education
test('13. Academic threshold — no completed education → missing_profile_data', () => {
  const r = evaluateAcademicThreshold({
    profileEducation: [],
    requiredGradingSystem: 'gpa_4',
    requiredMinimum: 3.0,
  });
  assert.strictEqual(r.state, CRITERION_STATES.MISSING_PROFILE_DATA);
});

// 14. Test requirement — overall minimum met
test('14. Test requirement — IELTS 7.0 meets minimum 6.5', () => {
  const r = evaluateTestRequirement({
    profileExamScores: [{ testType: 'IELTS', overallScore: '7.0', status: 'completed', expiryDate: null }],
    resolvedTestType: 'IELTS',
    requirement: { minimumOverallScore: 6.5, sectionMinimums: [] },
    acceptanceClaim: { acceptanceStatus: 'accepted', minimumOverallScore: null, sectionMinimums: [] },
  });
  assert.strictEqual(r.state, CRITERION_STATES.PASS);
});

// 15. Test requirement — overall minimum below
test('15. Test requirement — IELTS 6.0 below minimum 6.5', () => {
  const r = evaluateTestRequirement({
    profileExamScores: [{ testType: 'IELTS', overallScore: '6.0', status: 'completed', expiryDate: null }],
    resolvedTestType: 'IELTS',
    requirement: { minimumOverallScore: 6.5, sectionMinimums: [] },
  });
  assert.strictEqual(r.state, CRITERION_STATES.FAIL);
  assert(r.reason.includes('below_minimum'), `Expected below_minimum in reason, got: ${r.reason}`);
});

// 16. Test requirement — section score below
test('16. Test requirement — IELTS writing 5.5 below section minimum 6.0', () => {
  const r = evaluateTestRequirement({
    profileExamScores: [{
      testType: 'IELTS', overallScore: '7.0', status: 'completed', expiryDate: null,
      sectionScores: { listening: 7.5, reading: 7.0, writing: 5.5, speaking: 7.0 },
    }],
    resolvedTestType: 'IELTS',
    requirement: { minimumOverallScore: 6.5, sectionMinimums: [{ sectionName: 'writing', minimum: 6.0 }] },
  });
  assert.strictEqual(r.state, CRITERION_STATES.FAIL);
  assert(r.reason.includes('writing'), `Expected writing in reason, got: ${r.reason}`);
});

// 17. No test in profile
test('17. Test requirement — no IELTS in profile → missing_profile_data', () => {
  const r = evaluateTestRequirement({
    profileExamScores: [],
    resolvedTestType: 'IELTS',
    requirement: { minimumOverallScore: 6.5 },
  });
  assert.strictEqual(r.state, CRITERION_STATES.MISSING_PROFILE_DATA);
});

// 18. Planned test — not yet completed
test('18. Test requirement — planned test → missing_profile_data (not completed)', () => {
  const r = evaluateTestRequirement({
    profileExamScores: [{ testType: 'IELTS', overallScore: null, status: 'planned' }],
    resolvedTestType: 'IELTS',
    requirement: { minimumOverallScore: 6.5 },
  });
  assert.strictEqual(r.state, CRITERION_STATES.MISSING_PROFILE_DATA);
  assert(r.reason.includes('planned'), `Expected planned in reason, got: ${r.reason}`);
});

// 19. Expired test
test('19. Test requirement — expired test → missing_profile_data', () => {
  const r = evaluateTestRequirement({
    profileExamScores: [{ testType: 'IELTS', overallScore: '7.5', status: 'completed', expiryDate: '2020-01-01' }],
    resolvedTestType: 'IELTS',
    requirement: { minimumOverallScore: 6.5 },
    referenceDate: new Date('2024-01-01'),
  });
  assert.strictEqual(r.state, CRITERION_STATES.MISSING_PROFILE_DATA);
  assert(r.freshnessWarning, 'Should have freshness warning for expired test');
});

// 20. Not accepted
test('20. Test requirement — not_accepted by program → fail', () => {
  const r = evaluateTestRequirement({
    profileExamScores: [{ testType: 'PTE', overallScore: '75', status: 'completed' }],
    resolvedTestType: 'PTE',
    requirement: {},
    acceptanceClaim: { acceptanceStatus: 'not_accepted' },
  });
  assert.strictEqual(r.state, CRITERION_STATES.FAIL);
  assert(r.reason.includes('not_accepted'), `Expected not_accepted in reason, got: ${r.reason}`);
});

// 21. Test present, no minimum required
test('21. Test requirement — test present, no minimum → pass', () => {
  const r = evaluateTestRequirement({
    profileExamScores: [{ testType: 'IELTS', overallScore: '6.5', status: 'completed' }],
    resolvedTestType: 'IELTS',
    requirement: { minimumOverallScore: null, sectionMinimums: [] },
  });
  assert.strictEqual(r.state, CRITERION_STATES.PASS);
});

// 22. Scope precedence (pure logic)
test('22. Program/intake precedence — program acceptance overrides institution claim', () => {
  const { resolvePrecedence } = ae;
  const claims = [
    { acceptanceScope: 'institution', acceptanceStatus: 'accepted', updatedAt: new Date('2024-01-01') },
    { acceptanceScope: 'program', acceptanceStatus: 'not_accepted', updatedAt: new Date('2024-01-02') },
  ];
  const winner = resolvePrecedence(claims);
  assert.strictEqual(winner.acceptanceScope, 'program', `Expected program to win, got: ${winner.acceptanceScope}`);
});

// 23. Scholarship nationality criteria
test('23. Scholarship nationality_residence criteria evaluation', () => {
  const results = evaluateScholarshipCriteria({
    criteria: [{ criteriaType: 'nationality_residence', value: 'PK,IN', gradingContext: '', notes: '' }],
    profile: { personalInfo: { nationality: 'IN', country: null }, education: [], examScores: [], studyGoals: [], studentPreferences: {}, budgetProfile: {}, experience: [] },
    testContexts: [],
  });
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].state, CRITERION_STATES.PASS);
});

// 24. Scholarship degree_level criteria
test('24. Scholarship degree_level criteria evaluation — match pass', () => {
  const results = evaluateScholarshipCriteria({
    criteria: [{ criteriaType: 'degree_level', value: 'bachelor,master', gradingContext: '', notes: '' }],
    profile: {
      personalInfo: {}, education: [], examScores: [],
      studyGoals: [{ degreeLevel: 'master', status: 'active' }],
      studentPreferences: {}, budgetProfile: {}, experience: [],
    },
    testContexts: [],
  });
  assert.strictEqual(results[0].state, CRITERION_STATES.PASS);
});

// 25. Scholarship admission_enrollment → manual_review
test('25. Scholarship admission_enrollment → manual_review', () => {
  const results = evaluateScholarshipCriteria({
    criteria: [{ criteriaType: 'admission_enrollment', value: 'admitted students only', gradingContext: '', notes: '' }],
    profile: { personalInfo: {}, education: [], examScores: [], studyGoals: [], studentPreferences: {}, budgetProfile: {}, experience: [] },
    testContexts: [],
  });
  assert.strictEqual(results[0].state, CRITERION_STATES.MANUAL_REVIEW);
  assert(results[0].reason.includes('manual_review'), `Expected manual_review in reason, got: ${results[0].reason}`);
});

// 26. Unsupported criteria type → manual_review
test('26. Scholarship other/unsupported criteria → manual_review', () => {
  const results = evaluateScholarshipCriteria({
    criteria: [{ criteriaType: 'other', value: 'demonstrate passion for science', gradingContext: '', notes: '' }],
    profile: { personalInfo: {}, education: [], examScores: [], studyGoals: [], studentPreferences: {}, budgetProfile: {}, experience: [] },
    testContexts: [],
  });
  assert.strictEqual(results[0].state, CRITERION_STATES.MANUAL_REVIEW);
});

// 27. Financial need without budget data
test('27. Scholarship financial_need without budget data → missing_profile_data', () => {
  const results = evaluateScholarshipCriteria({
    criteria: [{ criteriaType: 'financial_need', value: 'demonstrated financial need', gradingContext: '', notes: '' }],
    profile: { personalInfo: {}, education: [], examScores: [], studyGoals: [], studentPreferences: {}, budgetProfile: {}, experience: [] },
    testContexts: [],
  });
  assert.strictEqual(results[0].state, CRITERION_STATES.MISSING_PROFILE_DATA);
});

// 28. All pass → eligible
test('28. deriveOverallEligibilityState — all pass → eligible', () => {
  const state = deriveOverallEligibilityState([
    makeCriterionResult({ key: 'a', label: 'A', state: CRITERION_STATES.PASS }),
    makeCriterionResult({ key: 'b', label: 'B', state: CRITERION_STATES.PASS }),
  ]);
  assert.strictEqual(state, ELIGIBILITY_STATES.ELIGIBLE);
});

// 29. One fail → not_eligible
test('29. deriveOverallEligibilityState — one fail → not_eligible', () => {
  const state = deriveOverallEligibilityState([
    makeCriterionResult({ key: 'a', label: 'A', state: CRITERION_STATES.PASS }),
    makeCriterionResult({ key: 'b', label: 'B', state: CRITERION_STATES.FAIL }),
  ]);
  assert.strictEqual(state, ELIGIBILITY_STATES.NOT_ELIGIBLE);
});

// 30. Only missing → potentially_eligible
test('30. deriveOverallEligibilityState — only missing → potentially_eligible', () => {
  const state = deriveOverallEligibilityState([
    makeCriterionResult({ key: 'a', label: 'A', state: CRITERION_STATES.PASS }),
    makeCriterionResult({ key: 'b', label: 'B', state: CRITERION_STATES.MISSING_PROFILE_DATA }),
  ]);
  assert.strictEqual(state, ELIGIBILITY_STATES.POTENTIALLY_ELIGIBLE);
});

// 31. Manual review
test('31. deriveOverallEligibilityState — manual_review → requires_manual_review', () => {
  const state = deriveOverallEligibilityState([
    makeCriterionResult({ key: 'a', label: 'A', state: CRITERION_STATES.PASS }),
    makeCriterionResult({ key: 'b', label: 'B', state: CRITERION_STATES.MANUAL_REVIEW }),
  ]);
  assert.strictEqual(state, ELIGIBILITY_STATES.REQUIRES_MANUAL_REVIEW);
});

// 32. Only unknown → insufficient_information
test('32. deriveOverallEligibilityState — only unknown → insufficient_information', () => {
  const state = deriveOverallEligibilityState([
    makeCriterionResult({ key: 'a', label: 'A', state: CRITERION_STATES.UNKNOWN }),
  ]);
  assert.strictEqual(state, ELIGIBILITY_STATES.INSUFFICIENT_INFORMATION);
});

// 33. computeMatchScore — explicit weights
test('33. computeMatchScore — returns score 0-100 with explicit weights', () => {
  const profile = {
    studyGoals: [{ degreeLevel: 'master', fieldOfStudy: 'computing', destinationCountries: ['GB'], status: 'active', studyMode: 'full_time' }],
    studentPreferences: { studyMode: 'full_time', destinationCountries: ['GB'], fundingPreference: 'open' },
    education: [],
    examScores: [{ testType: 'IELTS', overallScore: '7.0', status: 'completed' }],
    budgetProfile: {},
  };
  const opportunity = {
    degreeLevel: 'master',
    field: 'computing',
    country: 'GB',
    studyMode: 'full_time',
    degreeLevels: ['master'],
  };
  const result = computeMatchScore({ profile, opportunity });
  assert(typeof result.score === 'number', 'score must be a number');
  assert(result.score >= 0 && result.score <= 100, `score must be 0-100, got: ${result.score}`);
  assert(result.components, 'must have components');
  assert(result.weights, 'must have explicit weights');
  assert.strictEqual(Object.keys(result.components).length, Object.keys(MATCH_COMPONENT_KEYS).length);
});

// 34. Eligibility separate from match quality
test('34. Eligibility state is separate from match score', () => {
  // A profile with poor match but unknown eligibility
  const criterionResults = [
    makeCriterionResult({ key: 'a', label: 'A', state: CRITERION_STATES.UNKNOWN }),
  ];
  const eligState = deriveOverallEligibilityState(criterionResults);
  const matchResult = computeMatchScore({
    profile: { studyGoals: [], studentPreferences: {}, education: [], examScores: [], budgetProfile: {} },
    opportunity: { degreeLevel: 'master', field: 'computing', country: 'US' },
  });
  // Match score can be any value regardless of eligibility state
  assert.strictEqual(eligState, ELIGIBILITY_STATES.INSUFFICIENT_INFORMATION);
  assert(typeof matchResult.score === 'number');
  // They are independent
});

// 35. Destination mismatch lowers score
test('35. computeMatchScore — destination mismatch gives 0 destination score', () => {
  const profile = {
    studyGoals: [{ destinationCountries: ['DE'], status: 'active' }],
    studentPreferences: { destinationCountries: ['DE'] },
    education: [], examScores: [], budgetProfile: {},
  };
  const result = computeMatchScore({ profile, opportunity: { country: 'US', degreeLevel: 'master' } });
  assert.strictEqual(result.components.destination.score, 0, 'destination score should be 0 for mismatch');
});

// 36. Global scholarship destination
test('36. computeMatchScore — global scholarship (* destination) gives full destination score', () => {
  const profile = {
    studyGoals: [{ destinationCountries: ['PK'], status: 'active' }],
    studentPreferences: {},
    education: [], examScores: [], budgetProfile: {},
  };
  const result = computeMatchScore({ profile, opportunity: { destinationCountries: ['*'] } });
  assert.strictEqual(result.components.destination.score, 1);
});

// 37. Gaps — fail criterion → critical
test('37. analyzeGaps — fail criterion produces critical gap', () => {
  const criterionResults = [
    makeCriterionResult({ key: 'nat', label: 'Nationality', state: CRITERION_STATES.FAIL, reason: 'mismatch', requirement: 'PK only' }),
  ];
  const gaps = analyzeGaps({ criterionResults });
  const criticalGap = gaps.find((g) => g.severity === GAP_SEVERITIES.CRITICAL);
  assert(criticalGap, 'Expected a critical gap for FAIL criterion');
});

// 38. Gaps — missing_profile_data → major
test('38. analyzeGaps — missing_profile_data produces major gap', () => {
  const criterionResults = [
    makeCriterionResult({ key: 'test', label: 'Language Test', state: CRITERION_STATES.MISSING_PROFILE_DATA, reason: 'no_test' }),
  ];
  const gaps = analyzeGaps({ criterionResults });
  const majorGap = gaps.find((g) => g.severity === GAP_SEVERITIES.MAJOR);
  assert(majorGap, 'Expected a major gap for MISSING_PROFILE_DATA criterion');
});

// 39. Gaps — manual_review → minor
test('39. analyzeGaps — manual_review produces minor gap', () => {
  const criterionResults = [
    makeCriterionResult({ key: 'portfolio', label: 'Portfolio', state: CRITERION_STATES.MANUAL_REVIEW, reason: 'manual' }),
  ];
  const gaps = analyzeGaps({ criterionResults });
  const minorGap = gaps.find((g) => g.severity === GAP_SEVERITIES.MINOR);
  assert(minorGap, 'Expected a minor gap for MANUAL_REVIEW criterion');
});

// 40. buildEligibilityResult — shape and timestamps
test('40. buildEligibilityResult — includes evaluatedAt, profileDataUsed, freshnessWarnings', () => {
  const result = buildEligibilityResult({
    criterionResults: [makeCriterionResult({ key: 'a', label: 'A', state: CRITERION_STATES.PASS })],
    opportunityId: '123',
    opportunityType: 'program',
    opportunityTitle: 'Test Program',
    evaluatedAt: new Date('2025-01-01'),
    profileDataUsed: { nationality: 'PK', educationCount: 2 },
    freshnessWarnings: [{ level: 'warning', message: 'stale data' }],
  });
  assert(result.evaluatedAt, 'Must have evaluatedAt');
  assert(result.profileDataUsed.nationality === 'PK', 'Must include profile data used');
  assert(result.freshnessWarnings.length === 1, 'Must include freshness warnings');
  assert(Array.isArray(result.passedCriteria), 'Must have passedCriteria array');
  assert(Array.isArray(result.failedCriteria), 'Must have failedCriteria array');
});

// 41. No guarantee/probability language in match note
test('41. buildRecommendation — match note contains no guarantee language', () => {
  const eligibilityResult = buildEligibilityResult({
    criterionResults: [makeCriterionResult({ key: 'a', label: 'A', state: CRITERION_STATES.PASS })],
    opportunityId: '1', opportunityType: 'program', opportunityTitle: 'Test',
  });
  const matchResult = computeMatchScore({
    profile: { studyGoals: [], studentPreferences: {}, education: [], examScores: [], budgetProfile: {} },
    opportunity: {},
  });
  const rec = buildRecommendation({ opportunity: { name: 'Test' }, eligibilityResult, matchResult });
  const noteStr = JSON.stringify(rec.match.note).toLowerCase();
  // Note must not claim to be a probability — it may explicitly disclaim it
  assert(!noteStr.includes('100%'), 'Note must not contain "100%"');
  assert(!noteStr.includes('admission probability is'), 'Note must not claim to be an admission probability');
  // Should contain disclaimer language
  assert(noteStr.includes('not') || noteStr.includes('only') || noteStr.includes('preference'), 'Note should contain disclaimer language');
});

// 42. Profile incompleteness — no exam scores detected
test('42. Profile incompleteness — missing_profile_data when no exam scores', () => {
  const r = evaluateTestRequirement({
    profileExamScores: [],
    resolvedTestType: 'TOEFL',
    requirement: { minimumOverallScore: 90 },
  });
  assert.strictEqual(r.state, CRITERION_STATES.MISSING_PROFILE_DATA);
});

// 43. Freshness warning
test('43. buildFreshnessWarning — stale state produces warning', () => {
  const fw = buildFreshnessWarning('stale', new Date('2023-01-01'));
  assert(fw, 'Should return a freshness warning object');
  assert.strictEqual(fw.level, 'warning');
  assert(fw.message.length > 0);
});

// 43b. broken_source → error level
test('43b. buildFreshnessWarning — broken_source produces error level', () => {
  const fw = buildFreshnessWarning('broken_source', null);
  assert.strictEqual(fw.level, 'error');
});

// 44. buildTestGuidance — score meets requirement
test('44. buildTestGuidance — IELTS 7.0 meets minimum 6.5', () => {
  const guidance = buildTestGuidance({
    profileExamScores: [{ testType: 'IELTS', overallScore: '7.0', status: 'completed', expiryDate: null }],
    testRequirements: [{ testType: 'IELTS', minimumScore: 6.5 }],
  });
  assert.strictEqual(guidance[0].status, 'score_meets_requirement');
  assert(guidance[0].message.includes('7.0'), 'Message should include user score');
});

// 45. buildTestGuidance — score below requirement
test('45. buildTestGuidance — IELTS 5.5 below minimum 6.5', () => {
  const guidance = buildTestGuidance({
    profileExamScores: [{ testType: 'IELTS', overallScore: '5.5', status: 'completed' }],
    testRequirements: [{ testType: 'IELTS', minimumScore: 6.5 }],
  });
  assert.strictEqual(guidance[0].status, 'score_below_requirement');
});

// 46. buildTestGuidance — no test
test('46. buildTestGuidance — no test in profile', () => {
  const guidance = buildTestGuidance({
    profileExamScores: [],
    testRequirements: [{ testType: 'IELTS', minimumScore: 6.5 }],
  });
  assert.strictEqual(guidance[0].status, 'no_test');
});

// 47. evaluateField — match
test('47. evaluateField — field match passes', () => {
  const r = evaluateField({ profileFields: ['computing', 'engineering'], requiredFields: ['computing'] });
  assert.strictEqual(r.state, CRITERION_STATES.PASS);
});

// 48. evaluateField — no profile field
test('48. evaluateField — no profile field → missing_profile_data', () => {
  const r = evaluateField({ profileFields: [], requiredFields: ['computing'] });
  assert.strictEqual(r.state, CRITERION_STATES.MISSING_PROFILE_DATA);
});

// 49. evaluateStudyMode — match
test('49. evaluateStudyMode — full_time matches', () => {
  const r = evaluateStudyMode({ profilePreferredStudyMode: 'full_time', requiredStudyModes: ['full_time', 'part_time'] });
  assert.strictEqual(r.state, CRITERION_STATES.PASS);
});

// 50. evaluateStudyMode — mismatch
test('50. evaluateStudyMode — mismatch fails', () => {
  const r = evaluateStudyMode({ profilePreferredStudyMode: 'online', requiredStudyModes: ['full_time'] });
  assert.strictEqual(r.state, CRITERION_STATES.FAIL);
});

// 51. evaluateDestination — match
test('51. evaluateDestination — destination match passes', () => {
  const r = evaluateDestination({ profileDestinationCountries: ['GB', 'CA'], opportunityCountries: ['CA'] });
  assert.strictEqual(r.state, CRITERION_STATES.PASS);
});

// 52. evaluateDestination — global
test('52. evaluateDestination — global (*) always passes', () => {
  const r = evaluateDestination({ profileDestinationCountries: ['PK'], opportunityCountries: ['*'] });
  assert.strictEqual(r.state, CRITERION_STATES.PASS);
  assert.strictEqual(r.reason, 'global_scholarship');
});

// 53. evaluateFundingPreference — required, fully funded → pass
test('53. evaluateFundingPreference — required + fully funded passes', () => {
  const r = evaluateFundingPreference({ profileScholarshipRequired: true, profileFundingPreference: 'required', opportunityFundingType: 'full' });
  assert.strictEqual(r.state, CRITERION_STATES.PASS);
});

// 54. evaluateFundingPreference — required, partial → fail
test('54. evaluateFundingPreference — required + partial fails', () => {
  const r = evaluateFundingPreference({ profileScholarshipRequired: true, profileFundingPreference: 'required', opportunityFundingType: 'partial' });
  assert.strictEqual(r.state, CRITERION_STATES.FAIL);
});

// 55. evaluateExperience — meets requirement
test('55. evaluateExperience — 2+ years meets 2-year requirement', () => {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 3);
  const end = new Date();
  end.setFullYear(end.getFullYear() - 1);
  const r = evaluateExperience({
    profileExperience: [{ startDate: start.toISOString(), endDate: end.toISOString() }],
    criteriaValue: '2 years',
  });
  assert.strictEqual(r.state, CRITERION_STATES.PASS);
});

// 56. evaluateExperience — non-quantifiable → manual_review
test('56. evaluateExperience — "research experience" → manual_review', () => {
  const r = evaluateExperience({
    profileExperience: [{ employmentType: 'other' }],
    criteriaValue: 'demonstrated research experience',
  });
  assert.strictEqual(r.state, CRITERION_STATES.MANUAL_REVIEW);
});

// 57. Age criteria — meets range → pass
test('57. evaluateScholarshipCriteria — age meets max requirement', () => {
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - 25);
  const results = evaluateScholarshipCriteria({
    criteria: [{ criteriaType: 'age', value: 'max 35', gradingContext: '', notes: '' }],
    profile: {
      personalInfo: { dateOfBirth: dob.toISOString(), nationality: null, country: null },
      education: [], examScores: [], studyGoals: [], studentPreferences: {}, budgetProfile: {}, experience: [],
    },
    testContexts: [],
  });
  assert.strictEqual(results[0].state, CRITERION_STATES.PASS, `Expected pass, got: ${results[0].state} — ${results[0].reason}`);
});

// 58. Age criteria — exceeds max → fail
test('58. evaluateScholarshipCriteria — age exceeds max → fail', () => {
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - 40);
  const results = evaluateScholarshipCriteria({
    criteria: [{ criteriaType: 'age', value: 'max 35', gradingContext: '', notes: '' }],
    profile: {
      personalInfo: { dateOfBirth: dob.toISOString(), nationality: null, country: null },
      education: [], examScores: [], studyGoals: [], studentPreferences: {}, budgetProfile: {}, experience: [],
    },
    testContexts: [],
  });
  assert.strictEqual(results[0].state, CRITERION_STATES.FAIL, `Expected fail, got: ${results[0].state}`);
});

// 59. Full scholarship scenario
test('59. evaluateScholarshipCriteria — full scenario (nationality + degree + field)', () => {
  const results = evaluateScholarshipCriteria({
    criteria: [
      { criteriaType: 'nationality_residence', value: 'PK', gradingContext: '', notes: '' },
      { criteriaType: 'degree_level', value: 'master', gradingContext: '', notes: '' },
      { criteriaType: 'field', value: 'computing,engineering', gradingContext: '', notes: '' },
    ],
    profile: {
      personalInfo: { nationality: 'PK', country: null, dateOfBirth: null },
      education: [],
      examScores: [],
      studyGoals: [{ degreeLevel: 'master', fieldOfStudy: 'computing', status: 'active', destinationCountries: ['GB'] }],
      studentPreferences: {},
      budgetProfile: {},
      experience: [],
    },
    testContexts: [],
  });
  assert.strictEqual(results.length, 3);
  const stateMap = {};
  for (const r of results) stateMap[r.key] = r.state;
  assert.strictEqual(stateMap['nationality_residence'], CRITERION_STATES.PASS);
  assert.strictEqual(stateMap['degree_level'], CRITERION_STATES.PASS);
  assert.strictEqual(stateMap['field'], CRITERION_STATES.PASS);
});

// 60. No guarantee language in ELIGIBILITY_STATES
test('60. No guarantee/probability language in ELIGIBILITY_STATES values', () => {
  const values = Object.values(ELIGIBILITY_STATES).join(' ');
  assert(!values.includes('guaranteed'), 'No guarantee language in state names');
  assert(!values.includes('probability'), 'No probability language in state names');
  assert(!values.includes('100%'), 'No 100% language in state names');
  assert(!values.includes('certain'), 'No certainty language in state names');
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
