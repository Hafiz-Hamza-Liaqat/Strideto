/**
 * Strideto Mission 8 — Personalization / Eligibility / Matching Engine.
 *
 * Client- and server-safe: pure JS, no Node/DOM globals, no DB, no AI.
 *
 * Provides:
 *   - Eligibility result contract (ELIGIBILITY_STATES, CRITERION_STATES)
 *   - Deterministic criterion evaluators (nationality, degree, academic, test, experience, etc.)
 *   - Grading truthfulness policy (compatible systems only — no guessed equivalencies)
 *   - Scholarship criteria evaluation
 *   - Program requirement evaluation
 *   - Explicit-weight match scoring
 *   - Gap analysis
 *   - Recommendation contract helpers
 *
 * Unknown information MUST NOT automatically mean failure.
 * No AI decisions. No admission guarantees. No probability language.
 */

// ── Eligibility states ────────────────────────────────────────────────────────

export const ELIGIBILITY_STATES = Object.freeze({
  ELIGIBLE: 'eligible',
  POTENTIALLY_ELIGIBLE: 'potentially_eligible',
  NOT_ELIGIBLE: 'not_eligible',
  INSUFFICIENT_INFORMATION: 'insufficient_information',
  REQUIRES_MANUAL_REVIEW: 'requires_manual_review',
});

// ── Per-criterion evaluation states ──────────────────────────────────────────

export const CRITERION_STATES = Object.freeze({
  PASS: 'pass',
  FAIL: 'fail',
  UNKNOWN: 'unknown',
  MANUAL_REVIEW: 'manual_review',
  MISSING_PROFILE_DATA: 'missing_profile_data',
});

// ── Gap severity levels ───────────────────────────────────────────────────────

export const GAP_SEVERITIES = Object.freeze({
  CRITICAL: 'critical',   // definite eligibility blocker
  MAJOR: 'major',         // likely eligibility blocker
  MINOR: 'minor',         // informational gap
  INFO: 'info',           // profile improvement suggestion
});

// ── Match component keys ──────────────────────────────────────────────────────

export const MATCH_COMPONENT_KEYS = Object.freeze({
  DESTINATION: 'destination',
  FIELD: 'field',
  DEGREE: 'degree',
  STUDY_MODE: 'study_mode',
  TEST_READINESS: 'test_readiness',
  BUDGET: 'budget',
  FUNDING: 'funding',
});

// ── Default match weights (explicit, sum = 1.0) ───────────────────────────────

export const DEFAULT_MATCH_WEIGHTS = Object.freeze({
  destination: 0.25,
  field: 0.25,
  degree: 0.20,
  study_mode: 0.10,
  test_readiness: 0.10,
  budget: 0.05,
  funding: 0.05,
});

// ── Degree-level equivalency map ──────────────────────────────────────────────
//
// Maps Mission 3 QUALIFICATION_LEVELS to Mission 4 DEGREE_LEVELS equivalents.
// Only structurally obvious mappings included; ambiguous cases → empty (unknown).

const QUAL_TO_DEGREE_MAP = Object.freeze({
  high_school:           ['high_school'],
  o_level:               ['high_school'],
  a_level:               ['high_school', 'certificate'],
  diploma:               ['diploma', 'certificate'],
  associate:             ['diploma'],
  bachelor:              ['bachelor'],
  postgraduate_diploma:  ['master'],
  master:                ['master'],
  mphil:                 ['master'],
  phd:                   ['phd', 'postdoc'],
  other:                 [],
});

/**
 * Return true when a QUALIFICATION_LEVEL value maps to any of the given DEGREE_LEVELS.
 */
export function qualificationMatchesDegreeLevel(qualificationLevel, degreeLevels) {
  if (!qualificationLevel || !Array.isArray(degreeLevels) || degreeLevels.length === 0) {
    return false;
  }
  const mapped = QUAL_TO_DEGREE_MAP[qualificationLevel] || [];
  return degreeLevels.some((dl) => mapped.includes(dl));
}

// ── Compatible grading system pairs ──────────────────────────────────────────
//
// Only these combinations support direct numeric comparison.
// Cross-system comparison MUST return insufficient_information — no guessing.

const COMPARABLE_GRADING_PAIRS = new Set([
  'percentage::percentage',
  'gpa_4::gpa_4',
  'gpa_5::gpa_5',
  'gpa_10::gpa_10',
  'cgpa::cgpa',
  'cgpa::gpa_4',
  'gpa_4::cgpa',
]);

function isGradingCompatible(systemA, systemB) {
  if (!systemA || !systemB) return false;
  const key = `${systemA}::${systemB}`;
  return COMPARABLE_GRADING_PAIRS.has(key);
}

function parseNumericGrade(gradeValue) {
  if (gradeValue == null) return null;
  const n = parseFloat(String(gradeValue).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// ── Criterion result builder ──────────────────────────────────────────────────

export function makeCriterionResult({
  key,
  label,
  state,
  requirement = null,
  profileValue = null,
  reason = '',
  sources = [],
  freshnessWarning = null,
}) {
  return Object.freeze({
    key,
    label,
    state,
    requirement,
    profileValue,
    reason,
    sources: Array.isArray(sources) ? sources : [],
    freshnessWarning,
  });
}

// ── Nationality / residence evaluator ────────────────────────────────────────
//
// criteriaValue: comma-separated ISO codes, or '*' for any, or 'non_<code>' exclusions.
// profileNationality: ISO 3166-1 alpha-2 or null
// profileCountry: ISO 3166-1 alpha-2 (residence) or null

export function evaluateNationalityResidence({
  profileNationality,
  profileCountry,
  criteriaValue,
  label = 'Nationality / Residence',
  sources = [],
}) {
  if (!criteriaValue || criteriaValue.trim() === '') {
    return makeCriterionResult({ key: 'nationality_residence', label, state: CRITERION_STATES.UNKNOWN, reason: 'no_criteria_specified', sources });
  }

  const val = criteriaValue.trim();

  if (val === '*' || val.toLowerCase() === 'any') {
    return makeCriterionResult({ key: 'nationality_residence', label, state: CRITERION_STATES.PASS, requirement: val, profileValue: profileNationality || profileCountry, reason: 'open_to_all', sources });
  }

  const profileNat = (profileNationality || '').toUpperCase();
  const profileRes = (profileCountry || '').toUpperCase();

  if (!profileNat && !profileRes) {
    return makeCriterionResult({ key: 'nationality_residence', label, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: val, reason: 'profile_nationality_residence_missing', sources });
  }

  const allowed = val.split(/[,;|\s]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
  const profileValues = [profileNat, profileRes].filter(Boolean);
  const matches = profileValues.some((pv) => allowed.includes(pv));

  if (matches) {
    return makeCriterionResult({ key: 'nationality_residence', label, state: CRITERION_STATES.PASS, requirement: val, profileValue: profileNat || profileRes, reason: 'nationality_or_residence_matches', sources });
  }

  return makeCriterionResult({ key: 'nationality_residence', label, state: CRITERION_STATES.FAIL, requirement: val, profileValue: profileNat || profileRes, reason: 'nationality_residence_not_in_allowed_list', sources });
}

// ── Degree level evaluator ────────────────────────────────────────────────────
//
// profileGoalDegreeLevels: QUALIFICATION_LEVELS values from active study goals
// profileEducationLevels: QUALIFICATION_LEVELS values from completed education
// requiredDegreeLevels: DEGREE_LEVELS values (what the program/scholarship is for)

export function evaluateDegreeLevel({
  profileGoalDegreeLevels = [],
  requiredDegreeLevels = [],
  label = 'Degree Level',
  sources = [],
}) {
  if (!Array.isArray(requiredDegreeLevels) || requiredDegreeLevels.length === 0) {
    return makeCriterionResult({ key: 'degree_level', label, state: CRITERION_STATES.UNKNOWN, reason: 'no_degree_level_requirement', sources });
  }

  const goals = Array.isArray(profileGoalDegreeLevels) ? profileGoalDegreeLevels.filter(Boolean) : [];

  if (goals.length === 0) {
    return makeCriterionResult({ key: 'degree_level', label, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: requiredDegreeLevels.join(', '), reason: 'no_study_goal_degree_set', sources });
  }

  const anyMatch = goals.some((ql) => qualificationMatchesDegreeLevel(ql, requiredDegreeLevels));

  if (anyMatch) {
    return makeCriterionResult({ key: 'degree_level', label, state: CRITERION_STATES.PASS, requirement: requiredDegreeLevels.join(', '), profileValue: goals.join(', '), reason: 'degree_level_matches', sources });
  }

  const ambiguous = goals.some((ql) => !QUAL_TO_DEGREE_MAP[ql] || QUAL_TO_DEGREE_MAP[ql].length === 0);
  if (ambiguous) {
    return makeCriterionResult({ key: 'degree_level', label, state: CRITERION_STATES.UNKNOWN, requirement: requiredDegreeLevels.join(', '), profileValue: goals.join(', '), reason: 'degree_level_mapping_ambiguous', sources });
  }

  return makeCriterionResult({ key: 'degree_level', label, state: CRITERION_STATES.FAIL, requirement: requiredDegreeLevels.join(', '), profileValue: goals.join(', '), reason: 'degree_level_does_not_match', sources });
}

// ── Academic threshold evaluator ──────────────────────────────────────────────
//
// Truthfulness policy: compare only when grading systems are structurally compatible.
// Never guess equivalencies.
//
// profileEducation: array of { qualificationLevel, gradingSystem, gradeValue, gradeScale, completionStatus }
// requiredGradingSystem: e.g. 'gpa_4', 'percentage'
// requiredMinimum: numeric threshold
// qualificationLevelFilter: optional — only check education at or above this level

export function evaluateAcademicThreshold({
  profileEducation = [],
  requiredGradingSystem,
  requiredMinimum,
  qualificationLevelFilter = null,
  label = 'Academic Qualification',
  sources = [],
}) {
  if (requiredGradingSystem == null || requiredMinimum == null) {
    return makeCriterionResult({ key: 'academic', label, state: CRITERION_STATES.MANUAL_REVIEW, reason: 'requirement_not_structurally_parseable', sources });
  }

  const completed = (Array.isArray(profileEducation) ? profileEducation : []).filter(
    (e) => e && (e.completionStatus === 'completed' || e.completionStatus == null)
  );

  if (completed.length === 0) {
    return makeCriterionResult({ key: 'academic', label, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: `${requiredGradingSystem} >= ${requiredMinimum}`, reason: 'no_completed_education_records', sources });
  }

  let bestMatch = null;
  let hasIncompatible = false;

  for (const edu of completed) {
    if (!isGradingCompatible(edu.gradingSystem, requiredGradingSystem)) {
      hasIncompatible = true;
      continue;
    }
    const grade = parseNumericGrade(edu.gradeValue);
    if (grade == null) continue;
    if (bestMatch == null || grade > bestMatch.grade) {
      bestMatch = { grade, gradingSystem: edu.gradingSystem, institution: edu.institution };
    }
  }

  if (bestMatch == null) {
    if (hasIncompatible) {
      return makeCriterionResult({ key: 'academic', label, state: CRITERION_STATES.UNKNOWN, requirement: `${requiredGradingSystem} >= ${requiredMinimum}`, reason: 'grading_systems_incompatible_no_direct_comparison', sources });
    }
    return makeCriterionResult({ key: 'academic', label, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: `${requiredGradingSystem} >= ${requiredMinimum}`, reason: 'no_parseable_grade_in_compatible_system', sources });
  }

  if (bestMatch.grade >= requiredMinimum) {
    return makeCriterionResult({ key: 'academic', label, state: CRITERION_STATES.PASS, requirement: `${requiredGradingSystem} >= ${requiredMinimum}`, profileValue: `${bestMatch.gradingSystem} ${bestMatch.grade}`, reason: 'academic_threshold_met', sources });
  }

  return makeCriterionResult({ key: 'academic', label, state: CRITERION_STATES.FAIL, requirement: `${requiredGradingSystem} >= ${requiredMinimum}`, profileValue: `${bestMatch.gradingSystem} ${bestMatch.grade}`, reason: `grade_below_threshold:provided=${bestMatch.grade},required=${requiredMinimum}`, sources });
}

// ── Test requirement evaluator ────────────────────────────────────────────────
//
// Reuses Mission 6 structuralScoreCheck logic.
//
// profileExamScores: array of { testType, overallScore(String), sectionScores(Object), expiryDate, status }
// resolvedTestType: testType string (e.g. 'IELTS') resolved from testId by service layer
// requirement: { minimumOverallScore?, sectionMinimums? }
// acceptanceClaim: TestAcceptance resolved claim (or null)
// referenceDate: for expiry checking

export function evaluateTestRequirement({
  profileExamScores = [],
  resolvedTestType,
  requirement = {},
  acceptanceClaim = null,
  label,
  sources = [],
  referenceDate = new Date(),
}) {
  const testLabel = label || `Test: ${resolvedTestType || 'unknown'}`;
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  if (!resolvedTestType) {
    return makeCriterionResult({ key: 'test_unknown', label: testLabel, state: CRITERION_STATES.UNKNOWN, reason: 'test_type_not_resolvable', sources });
  }

  // Check acceptance status
  if (acceptanceClaim) {
    if (acceptanceClaim.acceptanceStatus === 'not_accepted') {
      return makeCriterionResult({ key: `test_${resolvedTestType}`, label: testLabel, state: CRITERION_STATES.FAIL, reason: 'test_not_accepted_by_program', sources });
    }
    // case_by_case or conditional → manual review
    if (acceptanceClaim.acceptanceStatus === 'case_by_case' || acceptanceClaim.acceptanceStatus === 'conditional') {
      return makeCriterionResult({ key: `test_${resolvedTestType}`, label: testLabel, state: CRITERION_STATES.MANUAL_REVIEW, reason: `acceptance_is_${acceptanceClaim.acceptanceStatus}`, sources });
    }
  }

  // Find matching profile scores
  const matchingScores = (Array.isArray(profileExamScores) ? profileExamScores : []).filter(
    (s) => s && s.testType === resolvedTestType && s.status === 'completed'
  );

  if (matchingScores.length === 0) {
    const planned = (Array.isArray(profileExamScores) ? profileExamScores : []).some(
      (s) => s && s.testType === resolvedTestType && (s.status === 'planned' || s.status === 'booked')
    );
    if (planned) {
      return makeCriterionResult({ key: `test_${resolvedTestType}`, label: testLabel, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: requirement.minimumOverallScore != null ? `${resolvedTestType} >= ${requirement.minimumOverallScore}` : resolvedTestType, reason: 'test_planned_not_completed', sources });
    }
    return makeCriterionResult({ key: `test_${resolvedTestType}`, label: testLabel, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: requirement.minimumOverallScore != null ? `${resolvedTestType} >= ${requirement.minimumOverallScore}` : resolvedTestType, reason: 'no_completed_test_in_profile', sources });
  }

  // Use best non-expired score
  let bestScore = null;
  let hasExpired = false;

  for (const score of matchingScores) {
    if (score.expiryDate && new Date(score.expiryDate) < ref) {
      hasExpired = true;
      continue;
    }
    const overall = parseNumericGrade(score.overallScore);
    if (bestScore == null || (overall != null && overall > (parseNumericGrade(bestScore.overallScore) ?? -Infinity))) {
      bestScore = score;
    }
  }

  if (!bestScore) {
    return makeCriterionResult({
      key: `test_${resolvedTestType}`, label: testLabel, state: CRITERION_STATES.MISSING_PROFILE_DATA,
      requirement: requirement.minimumOverallScore != null ? `${resolvedTestType} >= ${requirement.minimumOverallScore}` : resolvedTestType,
      reason: 'all_completed_tests_expired',
      freshnessWarning: hasExpired ? 'all_completed_test_scores_are_expired' : null,
      sources,
    });
  }

  // Build check
  const userScore = {
    overall: parseNumericGrade(bestScore.overallScore),
    sections: bestScore.sectionScores && typeof bestScore.sectionScores === 'object' ? bestScore.sectionScores : {},
  };

  const effectiveRequirement = {
    minimumOverallScore: requirement.minimumOverallScore ?? acceptanceClaim?.minimumOverallScore ?? null,
    sectionMinimums: requirement.sectionMinimums?.length
      ? requirement.sectionMinimums
      : acceptanceClaim?.sectionMinimums ?? [],
  };

  // No numeric minimum → accepted if test present
  if (effectiveRequirement.minimumOverallScore == null && (!effectiveRequirement.sectionMinimums || effectiveRequirement.sectionMinimums.length === 0)) {
    return makeCriterionResult({
      key: `test_${resolvedTestType}`, label: testLabel, state: CRITERION_STATES.PASS,
      profileValue: bestScore.overallScore,
      reason: 'test_present_no_minimum_required',
      freshnessWarning: hasExpired ? 'some_scores_expired_using_valid_score' : null,
      sources,
    });
  }

  // structuralScoreCheck inline (to avoid circular dep on acceptanceExplorer)
  if (effectiveRequirement.minimumOverallScore != null) {
    if (userScore.overall == null) {
      return makeCriterionResult({ key: `test_${resolvedTestType}`, label: testLabel, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: `${resolvedTestType} >= ${effectiveRequirement.minimumOverallScore}`, reason: 'overall_score_not_parseable', sources });
    }
    if (userScore.overall < effectiveRequirement.minimumOverallScore) {
      return makeCriterionResult({ key: `test_${resolvedTestType}`, label: testLabel, state: CRITERION_STATES.FAIL, requirement: `${resolvedTestType} >= ${effectiveRequirement.minimumOverallScore}`, profileValue: String(userScore.overall), reason: `overall_score_below_minimum:provided=${userScore.overall},required=${effectiveRequirement.minimumOverallScore}`, sources });
    }
  }

  for (const { sectionName, minimum } of (effectiveRequirement.sectionMinimums || [])) {
    if (minimum == null) continue;
    const provided = userScore.sections[sectionName];
    if (provided == null) {
      return makeCriterionResult({ key: `test_${resolvedTestType}`, label: testLabel, state: CRITERION_STATES.MISSING_PROFILE_DATA, reason: `section_score_not_provided:${sectionName}`, sources });
    }
    if (provided < minimum) {
      return makeCriterionResult({ key: `test_${resolvedTestType}`, label: testLabel, state: CRITERION_STATES.FAIL, requirement: `${sectionName} >= ${minimum}`, profileValue: String(provided), reason: `section_score_below_minimum:${sectionName}:provided=${provided},required=${minimum}`, sources });
    }
  }

  return makeCriterionResult({
    key: `test_${resolvedTestType}`, label: testLabel, state: CRITERION_STATES.PASS,
    profileValue: bestScore.overallScore,
    reason: 'test_score_meets_requirement',
    freshnessWarning: hasExpired ? 'some_scores_expired_using_valid_score' : null,
    sources,
  });
}

// ── Experience evaluator ──────────────────────────────────────────────────────
//
// criteriaValue: e.g. '2', '2 years', 'research experience'
// profileExperience: array of { startDate, endDate, employmentType }
// Returns manual_review for non-quantifiable criteria.

export function evaluateExperience({
  profileExperience = [],
  criteriaValue,
  label = 'Experience',
  sources = [],
}) {
  if (!criteriaValue || criteriaValue.trim() === '') {
    return makeCriterionResult({ key: 'experience', label, state: CRITERION_STATES.UNKNOWN, reason: 'no_experience_requirement', sources });
  }

  // Try to parse a numeric year requirement
  const yearsMatch = String(criteriaValue).match(/(\d+)\s*(year|yr)/i);
  const requiredYears = yearsMatch ? parseInt(yearsMatch[1], 10) : null;

  if (requiredYears == null) {
    // Non-quantifiable (e.g. "research experience") → manual review
    return makeCriterionResult({ key: 'experience', label, state: CRITERION_STATES.MANUAL_REVIEW, requirement: criteriaValue, reason: 'experience_requirement_requires_manual_review', sources });
  }

  const exp = Array.isArray(profileExperience) ? profileExperience : [];
  if (exp.length === 0) {
    return makeCriterionResult({ key: 'experience', label, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: `${requiredYears} years`, reason: 'no_experience_in_profile', sources });
  }

  // Sum months from dated entries
  let totalMonths = 0;
  let hasDatedEntry = false;

  for (const e of exp) {
    if (e.startDate && e.endDate) {
      hasDatedEntry = true;
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      if (months > 0) totalMonths += months;
    } else if (e.startDate) {
      hasDatedEntry = true;
      // Ongoing — use today
      const start = new Date(e.startDate);
      const now = new Date();
      const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      if (months > 0) totalMonths += months;
    }
  }

  if (!hasDatedEntry) {
    return makeCriterionResult({ key: 'experience', label, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: `${requiredYears} years`, reason: 'experience_dates_not_provided_for_calculation', sources });
  }

  const totalYears = totalMonths / 12;
  if (totalYears >= requiredYears) {
    return makeCriterionResult({ key: 'experience', label, state: CRITERION_STATES.PASS, requirement: `${requiredYears} years`, profileValue: `~${totalYears.toFixed(1)} years`, reason: 'experience_meets_requirement', sources });
  }

  return makeCriterionResult({ key: 'experience', label, state: CRITERION_STATES.FAIL, requirement: `${requiredYears} years`, profileValue: `~${totalYears.toFixed(1)} years`, reason: `experience_below_requirement:provided=${totalYears.toFixed(1)},required=${requiredYears}`, sources });
}

// ── Field / discipline evaluator ──────────────────────────────────────────────

export function evaluateField({
  profileFields = [],
  requiredFields = [],
  label = 'Field of Study',
  sources = [],
}) {
  if (!Array.isArray(requiredFields) || requiredFields.length === 0) {
    return makeCriterionResult({ key: 'field', label, state: CRITERION_STATES.UNKNOWN, reason: 'no_field_requirement', sources });
  }

  const pFields = Array.isArray(profileFields) ? profileFields.filter(Boolean).map((f) => f.toLowerCase()) : [];

  if (pFields.length === 0) {
    return makeCriterionResult({ key: 'field', label, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: requiredFields.join(', '), reason: 'no_field_in_profile', sources });
  }

  const reqLower = requiredFields.map((f) => f.toLowerCase());
  const match = pFields.some((pf) => reqLower.includes(pf));

  if (match) {
    return makeCriterionResult({ key: 'field', label, state: CRITERION_STATES.PASS, requirement: requiredFields.join(', '), profileValue: pFields.join(', '), reason: 'field_matches', sources });
  }

  return makeCriterionResult({ key: 'field', label, state: CRITERION_STATES.FAIL, requirement: requiredFields.join(', '), profileValue: pFields.join(', '), reason: 'field_not_in_required_list', sources });
}

// ── Study mode evaluator ──────────────────────────────────────────────────────

export function evaluateStudyMode({
  profilePreferredStudyMode,
  requiredStudyModes = [],
  label = 'Study Mode',
  sources = [],
}) {
  if (!Array.isArray(requiredStudyModes) || requiredStudyModes.length === 0) {
    return makeCriterionResult({ key: 'study_mode', label, state: CRITERION_STATES.UNKNOWN, reason: 'no_study_mode_requirement', sources });
  }

  if (!profilePreferredStudyMode) {
    return makeCriterionResult({ key: 'study_mode', label, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: requiredStudyModes.join(', '), reason: 'study_mode_not_set_in_profile', sources });
  }

  const match = requiredStudyModes.includes(profilePreferredStudyMode);
  if (match) {
    return makeCriterionResult({ key: 'study_mode', label, state: CRITERION_STATES.PASS, requirement: requiredStudyModes.join(', '), profileValue: profilePreferredStudyMode, reason: 'study_mode_matches', sources });
  }

  return makeCriterionResult({ key: 'study_mode', label, state: CRITERION_STATES.FAIL, requirement: requiredStudyModes.join(', '), profileValue: profilePreferredStudyMode, reason: 'study_mode_not_available', sources });
}

// ── Destination evaluator ─────────────────────────────────────────────────────

export function evaluateDestination({
  profileDestinationCountries = [],
  opportunityCountries = [],
  label = 'Destination',
  sources = [],
}) {
  if (!Array.isArray(opportunityCountries) || opportunityCountries.length === 0) {
    return makeCriterionResult({ key: 'destination', label, state: CRITERION_STATES.UNKNOWN, reason: 'no_destination_requirement', sources });
  }

  const isGlobal = opportunityCountries.includes('*');
  if (isGlobal) {
    return makeCriterionResult({ key: 'destination', label, state: CRITERION_STATES.PASS, requirement: 'global', reason: 'global_scholarship', sources });
  }

  const pDest = Array.isArray(profileDestinationCountries)
    ? profileDestinationCountries.map((c) => c.toUpperCase())
    : [];

  if (pDest.length === 0) {
    return makeCriterionResult({ key: 'destination', label, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: opportunityCountries.join(', '), reason: 'destination_preference_not_set', sources });
  }

  const oppUpper = opportunityCountries.map((c) => c.toUpperCase());
  const match = pDest.some((c) => oppUpper.includes(c));

  if (match) {
    return makeCriterionResult({ key: 'destination', label, state: CRITERION_STATES.PASS, requirement: oppUpper.join(', '), profileValue: pDest.join(', '), reason: 'destination_matches', sources });
  }

  return makeCriterionResult({ key: 'destination', label, state: CRITERION_STATES.FAIL, requirement: oppUpper.join(', '), profileValue: pDest.join(', '), reason: 'destination_not_in_preference', sources });
}

// ── Funding / scholarship preference evaluator ────────────────────────────────

export function evaluateFundingPreference({
  profileScholarshipRequired,
  profileFundingPreference,
  opportunityFundingType,
  label = 'Funding Preference',
  sources = [],
}) {
  if (!opportunityFundingType) {
    return makeCriterionResult({ key: 'funding', label, state: CRITERION_STATES.UNKNOWN, reason: 'funding_type_not_specified', sources });
  }

  if (profileScholarshipRequired === true || profileFundingPreference === 'required') {
    const fullyFunded = ['full', 'full_tuition'].includes(opportunityFundingType);
    if (fullyFunded) {
      return makeCriterionResult({ key: 'funding', label, state: CRITERION_STATES.PASS, requirement: 'scholarship_required', profileValue: opportunityFundingType, reason: 'full_funding_available', sources });
    }
    return makeCriterionResult({ key: 'funding', label, state: CRITERION_STATES.FAIL, requirement: 'scholarship_required', profileValue: opportunityFundingType, reason: 'funding_type_not_full', sources });
  }

  return makeCriterionResult({ key: 'funding', label, state: CRITERION_STATES.PASS, requirement: opportunityFundingType, reason: 'funding_not_required', sources });
}

// ── Financial need evaluator ──────────────────────────────────────────────────

export function evaluateFinancialNeed({
  profileBudget,
  criteriaValue,
  label = 'Financial Need',
  sources = [],
}) {
  // Financial need requires explicit profile data — always manual review without it
  if (!profileBudget || (profileBudget.general?.amountMinor == null && profileBudget.tuition?.amountMinor == null)) {
    return makeCriterionResult({ key: 'financial_need', label, state: CRITERION_STATES.MISSING_PROFILE_DATA, requirement: criteriaValue || 'financial_need_demonstrated', reason: 'budget_profile_insufficient_for_need_assessment', sources });
  }

  // Without a structured financial-need threshold, this needs manual review
  return makeCriterionResult({ key: 'financial_need', label, state: CRITERION_STATES.MANUAL_REVIEW, reason: 'financial_need_requires_manual_review', sources });
}

// ── Overall eligibility aggregation ──────────────────────────────────────────
//
// Decision table (in priority order):
// 1. Any FAIL on a required criterion → not_eligible
// 2. All required criteria PASS → eligible (if unknowns are all optional)
// 3. Any MISSING_PROFILE_DATA on required → potentially_eligible or insufficient_information
// 4. Any MANUAL_REVIEW on required → requires_manual_review
// 5. Any UNKNOWN on required → insufficient_information (still not not_eligible)
// 6. All optional → eligible

export function deriveOverallEligibilityState(criterionResults) {
  if (!Array.isArray(criterionResults) || criterionResults.length === 0) {
    return ELIGIBILITY_STATES.INSUFFICIENT_INFORMATION;
  }

  let hasRequiredFail = false;
  let hasRequiredMissing = false;
  let hasRequiredManualReview = false;
  let hasRequiredUnknown = false;
  let hasAnyRequired = false;
  let allRequiredPass = true;

  for (const cr of criterionResults) {
    const s = cr.state;
    // Treat all returned criteria as required unless explicitly optional
    hasAnyRequired = true;

    if (s === CRITERION_STATES.FAIL) { hasRequiredFail = true; allRequiredPass = false; }
    else if (s === CRITERION_STATES.MISSING_PROFILE_DATA) { hasRequiredMissing = true; allRequiredPass = false; }
    else if (s === CRITERION_STATES.MANUAL_REVIEW) { hasRequiredManualReview = true; allRequiredPass = false; }
    else if (s === CRITERION_STATES.UNKNOWN) { hasRequiredUnknown = true; allRequiredPass = false; }
    // PASS: allRequiredPass stays true
  }

  if (!hasAnyRequired) return ELIGIBILITY_STATES.INSUFFICIENT_INFORMATION;
  if (hasRequiredFail) return ELIGIBILITY_STATES.NOT_ELIGIBLE;
  if (allRequiredPass) return ELIGIBILITY_STATES.ELIGIBLE;
  if (hasRequiredManualReview) return ELIGIBILITY_STATES.REQUIRES_MANUAL_REVIEW;
  if (hasRequiredMissing) return ELIGIBILITY_STATES.POTENTIALLY_ELIGIBLE;
  if (hasRequiredUnknown) return ELIGIBILITY_STATES.INSUFFICIENT_INFORMATION;
  return ELIGIBILITY_STATES.POTENTIALLY_ELIGIBLE;
}

// ── Eligibility result builder ────────────────────────────────────────────────

export function buildEligibilityResult({
  criterionResults = [],
  opportunityId,
  opportunityType,
  opportunityTitle,
  evaluatedAt = new Date(),
  profileDataUsed = {},
  freshnessWarnings = [],
}) {
  const overallState = deriveOverallEligibilityState(criterionResults);
  const passedCriteria = criterionResults.filter((c) => c.state === CRITERION_STATES.PASS);
  const failedCriteria = criterionResults.filter((c) => c.state === CRITERION_STATES.FAIL);
  const unknownCriteria = criterionResults.filter((c) => [CRITERION_STATES.UNKNOWN, CRITERION_STATES.MISSING_PROFILE_DATA].includes(c.state));
  const manualCriteria = criterionResults.filter((c) => c.state === CRITERION_STATES.MANUAL_REVIEW);

  return Object.freeze({
    overallState,
    evaluatedCriteria: criterionResults,
    passedCriteria,
    failedCriteria,
    unknownCriteria,
    manualCriteria,
    opportunityId,
    opportunityType,
    opportunityTitle,
    evaluatedAt: evaluatedAt instanceof Date ? evaluatedAt.toISOString() : evaluatedAt,
    profileDataUsed,
    freshnessWarnings: Array.isArray(freshnessWarnings) ? freshnessWarnings : [],
  });
}

// ── Match scoring ─────────────────────────────────────────────────────────────
//
// Returns a 0–100 normalized match score plus per-component breakdown.
// Weights must sum to 1.0; caller may override.
// This is PREFERENCE ALIGNMENT, not admission probability.

export function computeMatchScore({
  profile = {},
  opportunity = {},
  opportunityType = 'program',
  weights = DEFAULT_MATCH_WEIGHTS,
}) {
  const w = { ...DEFAULT_MATCH_WEIGHTS, ...weights };
  const components = {};

  const goals = (profile.studyGoals || []).filter((g) => g.status === 'active' || g.status == null);
  const prefs = profile.studentPreferences || {};

  // ── Destination ──
  const profileDest = [
    ...new Set([
      ...(goals.flatMap((g) => g.destinationCountries || [])),
      ...(prefs.destinationCountries || []),
    ]),
  ].map((c) => c.toUpperCase());
  const oppDest = Array.isArray(opportunity.destinationCountries)
    ? opportunity.destinationCountries.map((c) => c.toUpperCase())
    : opportunity.country ? [opportunity.country.toUpperCase()] : [];
  const isGlobal = oppDest.includes('*');
  let destScore = 0;
  if (isGlobal) destScore = 1;
  else if (profileDest.length === 0 || oppDest.length === 0) destScore = 0;
  else destScore = profileDest.some((c) => oppDest.includes(c)) ? 1 : 0;
  components[MATCH_COMPONENT_KEYS.DESTINATION] = { score: destScore, weight: w.destination, reason: isGlobal ? 'global_opportunity' : destScore ? 'destination_preference_match' : profileDest.length === 0 ? 'no_destination_preference' : 'destination_mismatch' };

  // ── Field ──
  const profileFields = [
    ...new Set([
      ...(goals.map((g) => g.fieldOfStudy).filter(Boolean)),
      ...(prefs.fieldsOfStudy || []),
      ...(profile.education || []).map((e) => e.fieldOfStudy).filter(Boolean),
    ]),
  ].map((f) => f.toLowerCase());
  const oppFields = (Array.isArray(opportunity.fields) ? opportunity.fields : opportunity.field ? [opportunity.field] : []).map((f) => f.toLowerCase());
  let fieldScore = 0;
  if (profileFields.length === 0 || oppFields.length === 0) fieldScore = 0;
  else fieldScore = profileFields.some((pf) => oppFields.includes(pf)) ? 1 : 0;
  components[MATCH_COMPONENT_KEYS.FIELD] = { score: fieldScore, weight: w.field, reason: fieldScore ? 'field_preference_match' : profileFields.length === 0 ? 'no_field_preference' : 'field_mismatch' };

  // ── Degree ──
  const profileGoalDegrees = goals.map((g) => g.degreeLevel).filter(Boolean);
  const oppDegreeLevels = Array.isArray(opportunity.degreeLevels)
    ? opportunity.degreeLevels
    : opportunity.degreeLevel ? [opportunity.degreeLevel] : [];
  let degreeScore = 0;
  if (profileGoalDegrees.length === 0 || oppDegreeLevels.length === 0) degreeScore = 0;
  else degreeScore = profileGoalDegrees.some((ql) => qualificationMatchesDegreeLevel(ql, oppDegreeLevels)) ? 1 : 0;
  components[MATCH_COMPONENT_KEYS.DEGREE] = { score: degreeScore, weight: w.degree, reason: degreeScore ? 'degree_level_match' : profileGoalDegrees.length === 0 ? 'no_degree_goal' : 'degree_level_mismatch' };

  // ── Study mode ──
  const profileMode = prefs.studyMode || (goals.find((g) => g.studyMode)?.studyMode) || null;
  const oppModes = Array.isArray(opportunity.studyModes) ? opportunity.studyModes : opportunity.studyMode ? [opportunity.studyMode] : [];
  let modeScore = 0;
  if (!profileMode || oppModes.length === 0) modeScore = 0;
  else modeScore = oppModes.includes(profileMode) ? 1 : 0;
  components[MATCH_COMPONENT_KEYS.STUDY_MODE] = { score: modeScore, weight: w.study_mode, reason: modeScore ? 'study_mode_match' : !profileMode ? 'no_study_mode_preference' : 'study_mode_mismatch' };

  // ── Test readiness ──
  // Score 1 if any completed exam score exists; 0.5 if planned/booked; 0 if none.
  // Full score evaluation is done in program eligibility — this is preference signal only.
  const exams = profile.examScores || [];
  const hasCompleted = exams.some((e) => e.status === 'completed');
  const hasPlanned = exams.some((e) => e.status === 'planned' || e.status === 'booked');
  const testReadinessScore = hasCompleted ? 1 : hasPlanned ? 0.5 : 0;
  components[MATCH_COMPONENT_KEYS.TEST_READINESS] = { score: testReadinessScore, weight: w.test_readiness, reason: hasCompleted ? 'has_completed_test' : hasPlanned ? 'test_planned_or_booked' : 'no_test_scores' };

  // ── Budget ──
  const profileTuition = profile.budgetProfile?.tuition;
  const oppTuition = opportunity.tuition;
  let budgetScore = 0;
  let budgetReason = 'budget_data_unavailable';
  if (profileTuition?.amountMinor != null && oppTuition?.amountMinor != null && profileTuition.currency && oppTuition.currency) {
    if (profileTuition.currency.toUpperCase() === oppTuition.currency.toUpperCase()) {
      budgetScore = profileTuition.amountMinor >= oppTuition.amountMinor ? 1 : 0;
      budgetReason = budgetScore ? 'budget_covers_tuition' : 'budget_below_tuition';
    } else {
      budgetReason = 'currency_mismatch_no_conversion';
    }
  }
  components[MATCH_COMPONENT_KEYS.BUDGET] = { score: budgetScore, weight: w.budget, reason: budgetReason };

  // ── Funding preference ──
  const scholarRequired = prefs.scholarshipRequired === true || prefs.fundingPreference === 'required';
  const isFullyFunded = ['full', 'full_tuition'].includes(opportunity.funding?.type) || opportunityType === 'scholarship';
  let fundingScore = 0;
  let fundingReason = 'funding_preference_not_set';
  if (scholarRequired) {
    fundingScore = isFullyFunded ? 1 : 0;
    fundingReason = isFullyFunded ? 'funding_requirement_met' : 'scholarship_required_but_not_fully_funded';
  } else {
    fundingScore = 1; // no hard requirement
    fundingReason = 'no_scholarship_requirement';
  }
  components[MATCH_COMPONENT_KEYS.FUNDING] = { score: fundingScore, weight: w.funding, reason: fundingReason };

  // ── Total ──
  let total = 0;
  let totalWeight = 0;
  for (const [key, comp] of Object.entries(components)) {
    if (w[key] != null) {
      total += comp.score * comp.weight;
      totalWeight += comp.weight;
    }
  }

  const normalizedScore = totalWeight > 0 ? Math.round((total / totalWeight) * 100) : 0;

  return Object.freeze({
    score: normalizedScore,
    components,
    weights: w,
    note: 'Match score reflects preference alignment only — not admission probability',
  });
}

// ── Gap analysis ──────────────────────────────────────────────────────────────
//
// Converts criterion results and match components into actionable gap items.
// Mission 9 converts these into Journey Planner actions.

export function analyzeGaps({ criterionResults = [], matchResult = null, profile = {} }) {
  const gaps = [];

  for (const cr of criterionResults) {
    if (cr.state === CRITERION_STATES.FAIL) {
      gaps.push({
        key: `fail_${cr.key}`,
        label: cr.label,
        severity: GAP_SEVERITIES.CRITICAL,
        reason: cr.reason,
        requirement: cr.requirement,
        profileValue: cr.profileValue,
        action: 'review_requirement',
      });
    } else if (cr.state === CRITERION_STATES.MISSING_PROFILE_DATA) {
      gaps.push({
        key: `missing_${cr.key}`,
        label: cr.label,
        severity: GAP_SEVERITIES.MAJOR,
        reason: cr.reason,
        requirement: cr.requirement,
        profileValue: null,
        action: 'complete_profile',
      });
    } else if (cr.state === CRITERION_STATES.MANUAL_REVIEW) {
      gaps.push({
        key: `review_${cr.key}`,
        label: cr.label,
        severity: GAP_SEVERITIES.MINOR,
        reason: cr.reason,
        requirement: cr.requirement,
        action: 'manual_review_needed',
      });
    }
  }

  // Profile completeness gaps
  if (matchResult) {
    for (const [key, comp] of Object.entries(matchResult.components || {})) {
      if (comp.score === 0) {
        const isCritical = [MATCH_COMPONENT_KEYS.DESTINATION, MATCH_COMPONENT_KEYS.FIELD, MATCH_COMPONENT_KEYS.DEGREE].includes(key);
        gaps.push({
          key: `match_${key}`,
          label: `Match: ${key.replace(/_/g, ' ')}`,
          severity: isCritical ? GAP_SEVERITIES.MAJOR : GAP_SEVERITIES.MINOR,
          reason: comp.reason,
          action: 'improve_profile_match',
        });
      }
    }
  }

  // Deduplicate by key, keeping highest severity
  const severityOrder = { critical: 3, major: 2, minor: 1, info: 0 };
  const seen = new Map();
  for (const gap of gaps) {
    const existing = seen.get(gap.key);
    if (!existing || severityOrder[gap.severity] > severityOrder[existing.severity]) {
      seen.set(gap.key, gap);
    }
  }

  return [...seen.values()].sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));
}

// ── Recommendation contract ───────────────────────────────────────────────────

export function buildRecommendation({ opportunity, eligibilityResult, matchResult, gapSummary = [] }) {
  return Object.freeze({
    opportunity,
    eligibility: {
      state: eligibilityResult.overallState,
      passedCount: eligibilityResult.passedCriteria?.length ?? 0,
      failedCount: eligibilityResult.failedCriteria?.length ?? 0,
      unknownCount: eligibilityResult.unknownCriteria?.length ?? 0,
      manualCount: eligibilityResult.manualCriteria?.length ?? 0,
      freshnessWarnings: eligibilityResult.freshnessWarnings ?? [],
    },
    match: {
      score: matchResult.score,
      components: matchResult.components,
      note: matchResult.note,
    },
    gaps: gapSummary.slice(0, 5), // top 5 gaps
    evaluatedAt: eligibilityResult.evaluatedAt,
    whyRecommended: deriveWhyRecommended(eligibilityResult, matchResult),
  });
}

function deriveWhyRecommended(eligibilityResult, matchResult) {
  const reasons = [];
  if (eligibilityResult.overallState === ELIGIBILITY_STATES.ELIGIBLE) {
    reasons.push('Meets evaluated eligibility criteria');
  } else if (eligibilityResult.overallState === ELIGIBILITY_STATES.POTENTIALLY_ELIGIBLE) {
    reasons.push('Potentially eligible — some information needs verification');
  }
  for (const [key, comp] of Object.entries(matchResult.components || {})) {
    if (comp.score === 1) {
      reasons.push(comp.reason.replace(/_/g, ' '));
    }
  }
  return reasons.slice(0, 3);
}

// ── Scholarship criteria evaluator ────────────────────────────────────────────
//
// Evaluates CanonicalScholarship.criteria[] against a profile.
// Each criterion has: { criteriaType, value, gradingContext, notes }

export function evaluateScholarshipCriteria({ criteria = [], profile = {}, testContexts = [], referenceDate = new Date() }) {
  const results = [];
  const { personalInfo, education, examScores, studyGoals, studentPreferences, budgetProfile, experience } = profile;

  const activeGoals = (studyGoals || []).filter((g) => g.status === 'active' || g.status == null);
  const allDest = [...new Set([
    ...(activeGoals.flatMap((g) => g.destinationCountries || [])),
    ...(studentPreferences?.destinationCountries || []),
  ])];
  const allFields = [
    ...(activeGoals.map((g) => g.fieldOfStudy).filter(Boolean)),
    ...(studentPreferences?.fieldsOfStudy || []),
    ...(education || []).map((e) => e.fieldOfStudy).filter(Boolean),
  ];
  const goalDegreeLevels = activeGoals.map((g) => g.degreeLevel).filter(Boolean);

  for (const criterion of criteria) {
    const { criteriaType, value, gradingContext, notes } = criterion;

    switch (criteriaType) {
      case 'nationality_residence':
        results.push(evaluateNationalityResidence({
          profileNationality: personalInfo?.nationality,
          profileCountry: personalInfo?.country,
          criteriaValue: value,
        }));
        break;

      case 'degree_level': {
        const reqLevels = value ? value.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) : [];
        results.push(evaluateDegreeLevel({ profileGoalDegreeLevels: goalDegreeLevels, requiredDegreeLevels: reqLevels }));
        break;
      }

      case 'field': {
        const reqFields = value ? value.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) : [];
        results.push(evaluateField({ profileFields: allFields, requiredFields: reqFields }));
        break;
      }

      case 'academic_qualification':
      case 'gpa_grade': {
        // Parse "system >= value" or just "value" with gradingContext as system
        const parsed = parseAcademicCriteriaValue(value, gradingContext);
        results.push(evaluateAcademicThreshold({
          profileEducation: education || [],
          requiredGradingSystem: parsed.system,
          requiredMinimum: parsed.minimum,
          label: criteriaType === 'gpa_grade' ? 'GPA / Grade' : 'Academic Qualification',
        }));
        break;
      }

      case 'language_test': {
        // Find matching test context by test type
        const testCtx = testContexts.find((tc) => tc.criteriaType === 'language_test');
        if (!testCtx) {
          results.push(makeCriterionResult({ key: 'language_test', label: 'Language Test', state: CRITERION_STATES.UNKNOWN, reason: 'language_test_not_specified_in_context' }));
        } else {
          results.push(evaluateTestRequirement({
            profileExamScores: examScores || [],
            resolvedTestType: testCtx.testType,
            requirement: testCtx.requirement || {},
            acceptanceClaim: testCtx.acceptanceClaim || null,
            label: `Language Test: ${testCtx.testType}`,
            referenceDate,
          }));
        }
        break;
      }

      case 'experience_research':
        results.push(evaluateExperience({ profileExperience: experience || [], criteriaValue: value, label: 'Experience / Research' }));
        break;

      case 'financial_need':
        results.push(evaluateFinancialNeed({ profileBudget: budgetProfile, criteriaValue: value }));
        break;

      case 'admission_enrollment':
        results.push(makeCriterionResult({ key: 'admission_enrollment', label: 'Admission / Enrollment', state: CRITERION_STATES.MANUAL_REVIEW, requirement: value || 'enrollment_required', reason: 'admission_dependent_requires_manual_review' }));
        break;

      case 'age':
        // Only evaluate when profile has explicit, validated dateOfBirth AND criterion is parseable
        results.push(evaluateAgeCriteria({ profileDateOfBirth: personalInfo?.dateOfBirth, criteriaValue: value, referenceDate }));
        break;

      default:
        results.push(makeCriterionResult({ key: criteriaType, label: criteriaType.replace(/_/g, ' '), state: CRITERION_STATES.MANUAL_REVIEW, requirement: value, reason: 'unsupported_criteria_type_requires_manual_review' }));
    }
  }

  return results;
}

function parseAcademicCriteriaValue(value, gradingContext) {
  if (!value) return { system: gradingContext || null, minimum: null };
  // Match "gpa_4 >= 3.5", "percentage >= 70", "3.5", ">= 3.5"
  const full = String(value).match(/^(\w+)\s*>=\s*([0-9.]+)/);
  if (full) return { system: full[1], minimum: parseFloat(full[2]) };
  const numOnly = String(value).match(/>=\s*([0-9.]+)/);
  if (numOnly) return { system: gradingContext || null, minimum: parseFloat(numOnly[1]) };
  const justNum = String(value).match(/^([0-9.]+)$/);
  if (justNum) return { system: gradingContext || null, minimum: parseFloat(justNum[1]) };
  return { system: gradingContext || null, minimum: null };
}

function evaluateAgeCriteria({ profileDateOfBirth, criteriaValue, referenceDate }) {
  if (!profileDateOfBirth) {
    return makeCriterionResult({ key: 'age', label: 'Age', state: CRITERION_STATES.MISSING_PROFILE_DATA, reason: 'date_of_birth_not_in_profile' });
  }
  if (!criteriaValue) {
    return makeCriterionResult({ key: 'age', label: 'Age', state: CRITERION_STATES.MANUAL_REVIEW, reason: 'age_criteria_not_parseable' });
  }
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const dob = new Date(profileDateOfBirth);
  if (isNaN(dob.getTime())) {
    return makeCriterionResult({ key: 'age', label: 'Age', state: CRITERION_STATES.MISSING_PROFILE_DATA, reason: 'date_of_birth_invalid' });
  }
  const ageYears = (ref - dob) / (365.25 * 24 * 60 * 60 * 1000);

  // Parse "max 35", "under 35", "<= 35", "between 18 and 35"
  const maxMatch = String(criteriaValue).match(/(?:max|under|<=?|<)\s*(\d+)/i);
  const minMatch = String(criteriaValue).match(/(?:min|over|>=?|>|at\s*least)\s*(\d+)/i);

  if (!maxMatch && !minMatch) {
    return makeCriterionResult({ key: 'age', label: 'Age', state: CRITERION_STATES.MANUAL_REVIEW, reason: 'age_criteria_not_parseable', requirement: criteriaValue });
  }

  if (maxMatch && ageYears > parseInt(maxMatch[1], 10)) {
    return makeCriterionResult({ key: 'age', label: 'Age', state: CRITERION_STATES.FAIL, requirement: criteriaValue, profileValue: `~${Math.floor(ageYears)} years`, reason: `age_exceeds_maximum:provided=${Math.floor(ageYears)},required_max=${maxMatch[1]}` });
  }
  if (minMatch && ageYears < parseInt(minMatch[1], 10)) {
    return makeCriterionResult({ key: 'age', label: 'Age', state: CRITERION_STATES.FAIL, requirement: criteriaValue, profileValue: `~${Math.floor(ageYears)} years`, reason: `age_below_minimum:provided=${Math.floor(ageYears)},required_min=${minMatch[1]}` });
  }

  return makeCriterionResult({ key: 'age', label: 'Age', state: CRITERION_STATES.PASS, requirement: criteriaValue, profileValue: `~${Math.floor(ageYears)} years`, reason: 'age_within_range' });
}

// ── Profile-aware test guidance ────────────────────────────────────────────────
//
// Returns deterministic guidance about the user's test status relative to a requirement.
// Does NOT recommend "the best test" — only facts.

export function buildTestGuidance({ profileExamScores = [], testRequirements = [], referenceDate = new Date() }) {
  const guidance = [];

  for (const req of testRequirements) {
    const { testType, minimumScore, sectionMinimums, label } = req;
    const matching = profileExamScores.filter((s) => s.testType === testType);
    const completed = matching.filter((s) => s.status === 'completed');
    const planned = matching.filter((s) => s.status === 'planned' || s.status === 'booked');
    const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const validCompleted = completed.filter((s) => !s.expiryDate || new Date(s.expiryDate) >= ref);

    if (validCompleted.length === 0 && planned.length === 0) {
      guidance.push({
        testType, label: label || testType, status: 'no_test',
        message: `No completed ${testType} in your profile${minimumScore ? `. Requirement: ${minimumScore}` : ''}.`,
      });
      continue;
    }

    if (validCompleted.length === 0 && planned.length > 0) {
      guidance.push({ testType, label: label || testType, status: 'test_planned', message: `${testType} is planned/booked but not yet completed.` });
      continue;
    }

    const best = validCompleted.reduce((b, s) => {
      const bn = parseNumericGrade(b.overallScore) ?? -Infinity;
      const sn = parseNumericGrade(s.overallScore) ?? -Infinity;
      return sn > bn ? s : b;
    });

    const bestScore = parseNumericGrade(best.overallScore);

    if (minimumScore != null && bestScore != null) {
      if (bestScore >= minimumScore) {
        guidance.push({ testType, label: label || testType, status: 'score_meets_requirement', userScore: best.overallScore, required: minimumScore, message: `Your ${testType} score of ${best.overallScore} meets the minimum of ${minimumScore}.` });
      } else {
        guidance.push({ testType, label: label || testType, status: 'score_below_requirement', userScore: best.overallScore, required: minimumScore, message: `Your ${testType} score of ${best.overallScore} is below the requirement of ${minimumScore}.` });
      }
    } else {
      guidance.push({ testType, label: label || testType, status: 'test_present', userScore: best.overallScore, message: `${testType} score of ${best.overallScore} is present in your profile.` });
    }
  }

  return guidance;
}

// ── Freshness warning builder ─────────────────────────────────────────────────

export function buildFreshnessWarning(freshnessState, lastVerifiedAt) {
  if (freshnessState === 'stale' || freshnessState === 'overdue') {
    return {
      level: 'warning',
      message: `This information may be outdated (last verified: ${lastVerifiedAt ? new Date(lastVerifiedAt).toLocaleDateString() : 'unknown'}). Verify directly with the institution.`,
    };
  }
  if (freshnessState === 'broken_source') {
    return { level: 'error', message: 'Source for this requirement is currently unavailable. Treat with caution.' };
  }
  return null;
}
