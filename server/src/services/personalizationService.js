/**
 * Personalization Service — Mission 8.
 *
 * Deterministic, explainable eligibility + matching engine.
 * Evaluates an authenticated user's own profile against programs and scholarships.
 * No AI/LLM, no fabricated scores, no admission guarantees.
 *
 * All evaluation is on-demand (no persisted eligibility).
 * Server derives user identity from auth — callers pass userId from req.user.
 */
import { TalentProfile } from '../models/career/TalentProfile.js';
import { CanonicalScholarship } from '../models/education/CanonicalScholarship.js';
import { ScholarshipCycle } from '../models/education/ScholarshipCycle.js';
import { Program } from '../models/education/Program.js';
import { ProgramRequirement } from '../models/education/ProgramRequirement.js';
import { TestAcceptance } from '../models/education/TestAcceptance.js';
import { Test } from '../models/education/Test.js';
import {
  evaluateNationalityResidence,
  evaluateDegreeLevel,
  evaluateAcademicThreshold,
  evaluateTestRequirement,
  evaluateExperience,
  evaluateField,
  evaluateStudyMode,
  evaluateDestination,
  evaluateFinancialNeed,
  evaluateScholarshipCriteria,
  computeMatchScore,
  analyzeGaps,
  buildEligibilityResult,
  buildRecommendation,
  buildFreshnessWarning,
  buildTestGuidance,
  ELIGIBILITY_STATES,
  CRITERION_STATES,
  makeCriterionResult,
  DEFAULT_MATCH_WEIGHTS,
} from '../../../shared/education/eligibilityEngine.js';
import { PROGRAM_REQUIREMENT_TYPES, REQUIREMENT_SEMANTICS } from '../../../shared/education/scholarshipIntelligence.js';
import { FRESHNESS_STATES } from '../../../shared/trust/sourceVerification.js';

const PUB_PUBLISHED = 'published';

// ── Profile loading helper ────────────────────────────────────────────────────

async function loadProfileForUser(userId) {
  const profile = await TalentProfile.findOne({ userId }).lean();
  return profile || null;
}

function buildProfileSnapshot(profile) {
  if (!profile) return null;
  return {
    userId: profile.userId,
    personalInfo: {
      nationality: profile.personalInfo?.nationality || null,
      country: profile.personalInfo?.country || null,
      dateOfBirth: profile.personalInfo?.dateOfBirth || null,
    },
    education: profile.education || [],
    examScores: profile.examScores || [],
    studyGoals: profile.studyGoals || [],
    studentPreferences: profile.studentPreferences || {},
    budgetProfile: profile.budgetProfile || {},
    experience: profile.experience || [],
  };
}

// ── Test type resolution ──────────────────────────────────────────────────────

async function resolveTestTypes(testIds) {
  if (!testIds || testIds.length === 0) return new Map();
  const tests = await Test.find({ _id: { $in: testIds } }).lean();
  const map = new Map();
  for (const t of tests) {
    map.set(String(t._id), t.code || t.name || String(t._id));
  }
  return map;
}

// ── Freshness warning from record ─────────────────────────────────────────────

function extractFreshnessWarning(record) {
  if (!record) return null;
  return buildFreshnessWarning(record.freshnessState, record.lastVerifiedAt);
}

// ── Program eligibility ───────────────────────────────────────────────────────

export async function evaluateProgramEligibility(userId, programId) {
  const [profile, program] = await Promise.all([
    loadProfileForUser(userId),
    Program.findById(programId).lean(),
  ]);

  if (!profile) return { error: 'profile_not_found' };
  if (!program) return { error: 'program_not_found' };

  const snap = buildProfileSnapshot(profile);
  const reqs = await ProgramRequirement.find({ programId, status: PUB_PUBLISHED }).lean();

  // Resolve test types for requirements that have testId
  const testIds = reqs.filter((r) => r.testId).map((r) => r.testId);
  const testTypeMap = await resolveTestTypes(testIds);

  // Resolve TestAcceptance claims for this program
  const testAcceptances = testIds.length > 0
    ? await TestAcceptance.find({ testId: { $in: testIds }, programId, status: PUB_PUBLISHED }).lean()
    : [];
  const acceptanceByTestId = new Map();
  for (const ta of testAcceptances) {
    acceptanceByTestId.set(String(ta.testId), ta);
  }

  const criterionResults = [];
  const freshnessWarnings = [];

  if (program.freshnessState === FRESHNESS_STATES.STALE || program.freshnessState === FRESHNESS_STATES.BROKEN) {
    const fw = extractFreshnessWarning(program);
    if (fw) freshnessWarnings.push({ subject: 'program', ...fw });
  }

  for (const req of reqs) {
    const fw = extractFreshnessWarning(req);
    if (fw) freshnessWarnings.push({ subject: `requirement_${req.requirementType}`, ...fw });

    const isOptional = req.semantics === REQUIREMENT_SEMANTICS.OPTIONAL;
    const label = requirementLabel(req);

    switch (req.requirementType) {
      case PROGRAM_REQUIREMENT_TYPES.ACADEMIC: {
        const parsed = parseAcademicRequirement(req.description || '');
        const result = evaluateAcademicThreshold({
          profileEducation: snap.education,
          requiredGradingSystem: parsed.system,
          requiredMinimum: parsed.minimum,
          label,
          sources: req.sources || [],
        });
        criterionResults.push(isOptional ? optionalWrap(result) : result);
        break;
      }

      case PROGRAM_REQUIREMENT_TYPES.LANGUAGE_TEST:
      case PROGRAM_REQUIREMENT_TYPES.STANDARDIZED_TEST: {
        const resolvedTestType = req.testId ? testTypeMap.get(String(req.testId)) : null;
        const acceptanceClaim = req.testId ? acceptanceByTestId.get(String(req.testId)) : null;
        const result = evaluateTestRequirement({
          profileExamScores: snap.examScores,
          resolvedTestType,
          requirement: { minimumOverallScore: req.minimumScore, sectionMinimums: req.sectionMinimums || [] },
          acceptanceClaim,
          label,
          sources: req.sources || [],
        });
        criterionResults.push(isOptional ? optionalWrap(result) : result);
        break;
      }

      case PROGRAM_REQUIREMENT_TYPES.EXPERIENCE: {
        const result = evaluateExperience({
          profileExperience: snap.experience,
          criteriaValue: req.description || '',
          label,
          sources: req.sources || [],
        });
        criterionResults.push(isOptional ? optionalWrap(result) : result);
        break;
      }

      case PROGRAM_REQUIREMENT_TYPES.PORTFOLIO:
      case PROGRAM_REQUIREMENT_TYPES.DOCUMENT:
      case PROGRAM_REQUIREMENT_TYPES.PREREQUISITE_SUBJECT:
        criterionResults.push(makeCriterionResult({
          key: req.requirementType,
          label,
          state: CRITERION_STATES.MANUAL_REVIEW,
          requirement: req.description || req.documentName || req.subjectName || '',
          reason: 'requires_manual_verification',
          sources: req.sources || [],
        }));
        break;

      default:
        criterionResults.push(makeCriterionResult({
          key: req.requirementType,
          label,
          state: CRITERION_STATES.MANUAL_REVIEW,
          reason: 'unsupported_requirement_type',
          sources: req.sources || [],
        }));
    }
  }

  // Add degree-level criterion from program itself
  if (program.degreeLevel) {
    const goalDegrees = (snap.studyGoals || []).filter((g) => g.status === 'active' || g.status == null).map((g) => g.degreeLevel).filter(Boolean);
    criterionResults.push(evaluateDegreeLevel({
      profileGoalDegreeLevels: goalDegrees,
      requiredDegreeLevels: [program.degreeLevel],
      label: 'Degree Level',
    }));
  }

  // Field criterion
  if (program.field) {
    const allFields = [
      ...(snap.studyGoals || []).map((g) => g.fieldOfStudy).filter(Boolean),
      ...(snap.studentPreferences?.fieldsOfStudy || []),
      ...(snap.education || []).map((e) => e.fieldOfStudy).filter(Boolean),
    ];
    criterionResults.push(evaluateField({
      profileFields: allFields,
      requiredFields: [program.field],
      label: 'Field of Study',
    }));
  }

  const eligibilityResult = buildEligibilityResult({
    criterionResults,
    opportunityId: program._id,
    opportunityType: 'program',
    opportunityTitle: program.name,
    profileDataUsed: {
      nationality: snap.personalInfo.nationality,
      country: snap.personalInfo.country,
      educationCount: snap.education.length,
      examScoreCount: snap.examScores.length,
      goalCount: snap.studyGoals.length,
    },
    freshnessWarnings,
  });

  const matchResult = computeMatchScore({ profile: snap, opportunity: program, opportunityType: 'program' });
  const gaps = analyzeGaps({ criterionResults, matchResult, profile: snap });

  return { eligibility: eligibilityResult, match: matchResult, gaps };
}

// ── Scholarship eligibility ───────────────────────────────────────────────────

export async function evaluateScholarshipEligibility(userId, scholarshipId) {
  const [profile, scholarship] = await Promise.all([
    loadProfileForUser(userId),
    CanonicalScholarship.findById(scholarshipId).lean(),
  ]);

  if (!profile) return { error: 'profile_not_found' };
  if (!scholarship) return { error: 'scholarship_not_found' };

  const snap = buildProfileSnapshot(profile);
  const freshnessWarnings = [];

  const fw = extractFreshnessWarning(scholarship);
  if (fw) freshnessWarnings.push({ subject: 'scholarship', ...fw });

  // Resolve test contexts for language_test criteria
  const testContexts = await buildTestContextsFromCriteria(scholarship.criteria || [], snap.examScores);

  const criterionResults = evaluateScholarshipCriteria({
    criteria: scholarship.criteria || [],
    profile: snap,
    testContexts,
  });

  const eligibilityResult = buildEligibilityResult({
    criterionResults,
    opportunityId: scholarship._id,
    opportunityType: 'scholarship',
    opportunityTitle: scholarship.title,
    profileDataUsed: {
      nationality: snap.personalInfo.nationality,
      country: snap.personalInfo.country,
      educationCount: snap.education.length,
      examScoreCount: snap.examScores.length,
      goalCount: snap.studyGoals.length,
    },
    freshnessWarnings,
  });

  const matchResult = computeMatchScore({
    profile: snap,
    opportunity: {
      ...scholarship,
      degreeLevels: scholarship.degreeLevels,
      fields: scholarship.fields,
      studyModes: scholarship.studyModes,
    },
    opportunityType: 'scholarship',
  });

  const gaps = analyzeGaps({ criterionResults, matchResult, profile: snap });

  return { eligibility: eligibilityResult, match: matchResult, gaps };
}

// ── Resolve test contexts for scholarship criteria ────────────────────────────

async function buildTestContextsFromCriteria(criteria, profileExamScores) {
  const langTestCriteria = criteria.filter((c) => c.criteriaType === 'language_test');
  if (langTestCriteria.length === 0) return [];

  // Try to match test types from criteria value (e.g. "IELTS >= 6.5")
  const contexts = [];
  for (const c of langTestCriteria) {
    const testTypeMatch = String(c.value || '').match(/\b(IELTS|TOEFL|PTE|DET|DUOLINGO)\b/i);
    const scoreMatch = String(c.value || '').match(/>=?\s*([0-9.]+)/);
    const testType = testTypeMatch ? testTypeMatch[1].toUpperCase() : null;
    const minimumScore = scoreMatch ? parseFloat(scoreMatch[1]) : null;
    contexts.push({
      criteriaType: 'language_test',
      testType: testType || 'IELTS',
      requirement: { minimumOverallScore: minimumScore, sectionMinimums: [] },
      acceptanceClaim: null,
    });
  }
  return contexts;
}

// ── Program recommendations ───────────────────────────────────────────────────

export async function recommendPrograms(userId, { page = 1, limit = 20, country, field, degreeLevel } = {}) {
  const profile = await loadProfileForUser(userId);
  if (!profile) return { error: 'profile_not_found' };

  const snap = buildProfileSnapshot(profile);
  const goals = (snap.studyGoals || []).filter((g) => g.status === 'active' || g.status == null);
  const prefs = snap.studentPreferences || {};

  // Build filter — prefer profile preferences, allow explicit overrides
  const filter = { status: PUB_PUBLISHED };
  const effectiveCountries = country
    ? [country]
    : [...new Set([...(goals.flatMap((g) => g.destinationCountries || [])), ...(prefs.destinationCountries || [])])];
  if (effectiveCountries.length > 0) filter.country = { $in: effectiveCountries };

  const effectiveField = field || prefs.fieldsOfStudy?.[0] || goals[0]?.fieldOfStudy || null;
  if (effectiveField) filter.field = effectiveField;

  const effectiveDegree = degreeLevel || null;
  if (effectiveDegree) filter.degreeLevel = effectiveDegree;

  const skip = (Math.max(1, page) - 1) * limit;
  const programs = await Program.find(filter).skip(skip).limit(limit).lean();
  const total = await Program.countDocuments(filter);

  const results = [];
  for (const prog of programs) {
    const matchResult = computeMatchScore({ profile: snap, opportunity: prog, opportunityType: 'program' });
    const criterionResults = buildLightEligibilityCriteria(snap, prog);
    const eligibilityResult = buildEligibilityResult({
      criterionResults,
      opportunityId: prog._id,
      opportunityType: 'program',
      opportunityTitle: prog.name,
      profileDataUsed: {},
      freshnessWarnings: extractFreshnessWarning(prog) ? [extractFreshnessWarning(prog)] : [],
    });
    const gaps = analyzeGaps({ criterionResults, matchResult, profile: snap });
    results.push(buildRecommendation({ opportunity: projectPublicProgram(prog), eligibilityResult, matchResult, gapSummary: gaps }));
  }

  // Sort by match score descending
  results.sort((a, b) => b.match.score - a.match.score);

  return { results, page, limit, total, totalPages: Math.ceil(total / limit) };
}

// ── Scholarship recommendations ───────────────────────────────────────────────

export async function recommendScholarships(userId, { page = 1, limit = 20, country, field, fundingType } = {}) {
  const profile = await loadProfileForUser(userId);
  if (!profile) return { error: 'profile_not_found' };

  const snap = buildProfileSnapshot(profile);
  const goals = (snap.studyGoals || []).filter((g) => g.status === 'active' || g.status == null);
  const prefs = snap.studentPreferences || {};

  const filter = { status: PUB_PUBLISHED };
  const effectiveCountries = country
    ? [country]
    : [...new Set([...(goals.flatMap((g) => g.destinationCountries || [])), ...(prefs.destinationCountries || [])])];
  if (effectiveCountries.length > 0) {
    filter.$or = [{ destinationCountries: { $in: effectiveCountries } }, { destinationCountries: '*' }];
  }
  if (field) filter.fields = field;
  if (fundingType) filter['funding.type'] = fundingType;

  const skip = (Math.max(1, page) - 1) * limit;
  const scholarships = await CanonicalScholarship.find(filter).skip(skip).limit(limit).lean();
  const total = await CanonicalScholarship.countDocuments(filter);

  const results = [];
  for (const sch of scholarships) {
    const testContexts = await buildTestContextsFromCriteria(sch.criteria || [], snap.examScores);
    const criterionResults = evaluateScholarshipCriteria({ criteria: sch.criteria || [], profile: snap, testContexts });
    const eligibilityResult = buildEligibilityResult({
      criterionResults,
      opportunityId: sch._id,
      opportunityType: 'scholarship',
      opportunityTitle: sch.title,
      profileDataUsed: {},
      freshnessWarnings: extractFreshnessWarning(sch) ? [extractFreshnessWarning(sch)] : [],
    });
    const matchResult = computeMatchScore({
      profile: snap,
      opportunity: { degreeLevels: sch.degreeLevels, fields: sch.fields, studyModes: sch.studyModes, destinationCountries: sch.destinationCountries, funding: sch.funding },
      opportunityType: 'scholarship',
    });
    const gaps = analyzeGaps({ criterionResults, matchResult, profile: snap });
    results.push(buildRecommendation({ opportunity: projectPublicScholarship(sch), eligibilityResult, matchResult, gapSummary: gaps }));
  }

  results.sort((a, b) => b.match.score - a.match.score);

  return { results, page, limit, total, totalPages: Math.ceil(total / limit) };
}

// ── Gap analysis for own profile ──────────────────────────────────────────────

export async function getProfileGapAnalysis(userId) {
  const profile = await loadProfileForUser(userId);
  if (!profile) return { error: 'profile_not_found' };

  const snap = buildProfileSnapshot(profile);
  const gaps = [];

  // Check each major profile section
  if (!snap.personalInfo.nationality && !snap.personalInfo.country) {
    gaps.push({ key: 'missing_nationality', label: 'Nationality / Residence', severity: 'major', reason: 'nationality_and_residence_missing', action: 'complete_profile', section: 'identity' });
  }

  if (!snap.education || snap.education.length === 0) {
    gaps.push({ key: 'missing_education', label: 'Education History', severity: 'critical', reason: 'no_education_records', action: 'complete_profile', section: 'education' });
  } else {
    const hasGrading = snap.education.some((e) => e.gradingSystem && e.gradeValue);
    if (!hasGrading) {
      gaps.push({ key: 'missing_grades', label: 'Academic Grades', severity: 'major', reason: 'no_grading_information_in_education_records', action: 'complete_profile', section: 'education' });
    }
  }

  if (!snap.examScores || snap.examScores.length === 0) {
    gaps.push({ key: 'missing_test_scores', label: 'Test Scores', severity: 'major', reason: 'no_test_scores_in_profile', action: 'complete_profile', section: 'examScores' });
  } else {
    const hasCompleted = snap.examScores.some((e) => e.status === 'completed');
    if (!hasCompleted) {
      gaps.push({ key: 'no_completed_test', label: 'Completed Test Score', severity: 'major', reason: 'no_completed_test_scores', action: 'complete_profile', section: 'examScores' });
    }
  }

  if (!snap.studyGoals || snap.studyGoals.length === 0) {
    gaps.push({ key: 'missing_goals', label: 'Study Goals', severity: 'major', reason: 'no_study_goals_set', action: 'complete_profile', section: 'studyGoals' });
  } else {
    const activeGoal = snap.studyGoals.find((g) => g.status === 'active' || g.status == null);
    if (!activeGoal) {
      gaps.push({ key: 'no_active_goal', label: 'Active Study Goal', severity: 'minor', reason: 'no_active_study_goal', action: 'complete_profile', section: 'studyGoals' });
    } else {
      if (!activeGoal.destinationCountries?.length) {
        gaps.push({ key: 'missing_destination', label: 'Destination Countries', severity: 'major', reason: 'no_destination_in_goal', action: 'complete_profile', section: 'studyGoals' });
      }
      if (!activeGoal.degreeLevel) {
        gaps.push({ key: 'missing_degree_goal', label: 'Target Degree Level', severity: 'major', reason: 'no_degree_level_in_goal', action: 'complete_profile', section: 'studyGoals' });
      }
    }
  }

  return { gaps };
}

// ── Profile-aware test guidance ────────────────────────────────────────────────

export async function getProfileTestGuidance(userId, programId) {
  const [profile, program] = await Promise.all([
    loadProfileForUser(userId),
    Program.findById(programId).lean(),
  ]);

  if (!profile) return { error: 'profile_not_found' };
  if (!program) return { error: 'program_not_found' };

  const snap = buildProfileSnapshot(profile);
  const reqs = await ProgramRequirement.find({
    programId,
    status: PUB_PUBLISHED,
    requirementType: { $in: [PROGRAM_REQUIREMENT_TYPES.LANGUAGE_TEST, PROGRAM_REQUIREMENT_TYPES.STANDARDIZED_TEST] },
  }).lean();

  const testIds = reqs.filter((r) => r.testId).map((r) => r.testId);
  const testTypeMap = await resolveTestTypes(testIds);

  const testRequirements = reqs.map((r) => ({
    testType: r.testId ? testTypeMap.get(String(r.testId)) : null,
    minimumScore: r.minimumScore,
    sectionMinimums: r.sectionMinimums || [],
    label: requirementLabel(r),
  })).filter((r) => r.testType);

  const guidance = buildTestGuidance({
    profileExamScores: snap.examScores,
    testRequirements,
  });

  return { programId, programName: program.name, guidance };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function requirementLabel(req) {
  const typeLabels = {
    academic: 'Academic Qualification',
    language_test: 'Language Test',
    standardized_test: 'Standardized Test',
    prerequisite_subject: `Prerequisite: ${req.subjectName || 'subject'}`,
    experience: 'Experience',
    portfolio: 'Portfolio',
    document: `Document: ${req.documentName || 'required'}`,
    other: 'Requirement',
  };
  return typeLabels[req.requirementType] || 'Requirement';
}

function parseAcademicRequirement(description) {
  if (!description) return { system: null, minimum: null };
  const percentMatch = description.match(/(\d+\.?\d*)\s*%/);
  if (percentMatch) return { system: 'percentage', minimum: parseFloat(percentMatch[1]) };
  const gpaMatch = description.match(/gpa\s*[>=]+\s*([0-9.]+)/i);
  if (gpaMatch) return { system: 'gpa_4', minimum: parseFloat(gpaMatch[1]) };
  return { system: null, minimum: null };
}

function buildLightEligibilityCriteria(snap, program) {
  const results = [];
  const goals = (snap.studyGoals || []).filter((g) => g.status === 'active' || g.status == null);

  if (program.degreeLevel) {
    results.push(evaluateDegreeLevel({
      profileGoalDegreeLevels: goals.map((g) => g.degreeLevel).filter(Boolean),
      requiredDegreeLevels: [program.degreeLevel],
    }));
  }

  if (program.field) {
    const allFields = [
      ...(goals.map((g) => g.fieldOfStudy).filter(Boolean)),
      ...(snap.studentPreferences?.fieldsOfStudy || []),
    ];
    results.push(evaluateField({ profileFields: allFields, requiredFields: [program.field] }));
  }

  if (program.country) {
    const allDest = [...(goals.flatMap((g) => g.destinationCountries || [])), ...(snap.studentPreferences?.destinationCountries || [])];
    results.push(evaluateDestination({ profileDestinationCountries: allDest, opportunityCountries: [program.country] }));
  }

  return results;
}

function optionalWrap(criterionResult) {
  if (criterionResult.state === CRITERION_STATES.FAIL) {
    return { ...criterionResult, state: CRITERION_STATES.MANUAL_REVIEW, reason: `optional_criterion_not_met:${criterionResult.reason}`, isOptional: true };
  }
  return { ...criterionResult, isOptional: true };
}

function projectPublicProgram(prog) {
  const { adminNotes: _a, __v: _v, ...rest } = prog;
  return rest;
}

function projectPublicScholarship(sch) {
  const { adminNotes: _a, __v: _v, ...rest } = sch;
  return rest;
}
