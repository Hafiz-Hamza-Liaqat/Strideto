/**
 * Copilot Retrieval — Mission 19.
 *
 * Bounded, deterministic retrieval over existing canonical Strideto records.
 * All retrieval is SERVER-SIDE. Client cannot influence which records are fetched.
 *
 * Reuses:
 *   Mission 3  — TalentProfile (safe projection, no Vault, no credentials)
 *   Mission 5  — freshness via deriveFreshness
 *   Mission 6  — TestAcceptance with scope precedence
 *   Mission 7  — Program, Scholarship, ScholarshipCycle
 *   Mission 8  — evaluateProgramEligibility, evaluateScholarshipEligibility,
 *                getProfileGapAnalysis, getProfileTestGuidance
 *   Mission 9  — buildJourneyPlan, computeNextBestAction
 *   Mission 18 — InstitutionProfile (verified official data)
 *
 * Vault content: excluded. Payment data: excluded.
 * Private messages / Agent notes: excluded.
 * Cross-user access: denied (userId must come from authenticated session).
 */
import { TalentProfile } from '../../models/career/TalentProfile.js';
import { Test } from '../../models/education/Test.js';
import { TestAcceptance } from '../../models/education/TestAcceptance.js';
import { Program } from '../../models/education/Program.js';
import { CanonicalScholarship } from '../../models/education/CanonicalScholarship.js';
import { ScholarshipCycle } from '../../models/education/ScholarshipCycle.js';
import { InstitutionProfile } from '../../models/institution/InstitutionProfile.js';
import { InstitutionClaim } from '../../models/institution/InstitutionClaim.js';
import {
  evaluateProgramEligibility,
  evaluateScholarshipEligibility,
  getProfileGapAnalysis,
  getProfileTestGuidance,
} from '../personalizationService.js';
import { listActions, listDeadlines } from '../actionEngineService.js';
import { deriveFreshness } from '../../../../shared/trust/sourceVerification.js';
import { COPILOT_BOUNDS, COPILOT_INTENT } from '../../../../shared/ai/copilot.js';
import { buildJourneyPlan, computeNextBestAction } from '../../../../shared/action/actionEngine.js';

const LIMIT = COPILOT_BOUNDS.MAX_RETRIEVAL_ENTITIES;

// ── Student profile projection ────────────────────────────────────────────────

/**
 * Load a safe, minimal profile projection for copilot context.
 *
 * Vault content: excluded.
 * Password/auth: excluded.
 * Passport/government ID: excluded.
 * Private file storage refs: excluded.
 * Raw contact details beyond what is needed: excluded.
 *
 * Only fields needed for eligibility/matching/journey are included.
 */
export async function loadStudentContextProjection(userId) {
  const profile = await TalentProfile.findOne({ userId }).lean();
  if (!profile) return null;

  return {
    userId: String(profile.userId),
    goals: profile.goals ?? null,
    personalInfo: {
      nationality: profile.personalInfo?.nationality ?? null,
      country: profile.personalInfo?.country ?? null,
      dateOfBirth: profile.personalInfo?.dateOfBirth ?? null,
    },
    education: (profile.education ?? []).map((e) => ({
      level: e.level ?? null,
      field: e.fieldOfStudy ?? null,
      gpa: e.gpa ?? null,
      gradingSystem: e.gradingSystem ?? null,
      institution: e.institution ?? null,
      country: e.country ?? null,
      graduated: e.graduated ?? null,
    })),
    tests: (profile.testScores ?? []).map((t) => ({
      testName: t.testName ?? null,
      testId: t.testId ? String(t.testId) : null,
      scores: t.scores ?? null,
      dateTaken: t.dateTaken ?? null,
    })),
    experience: (profile.experience ?? []).map((ex) => ({
      months: ex.months ?? null,
      type: ex.type ?? null,
    })),
    skills: profile.skills ?? [],
    preferences: {
      destinations: profile.preferences?.destinations ?? [],
      degreeLevel: profile.preferences?.degreeLevel ?? null,
      studyMode: profile.preferences?.studyMode ?? null,
      budget: profile.preferences?.budget ?? null,
      fundingType: profile.preferences?.fundingType ?? null,
      fields: profile.preferences?.fields ?? [],
    },
    profileCompleteness: profile.profileCompleteness ?? null,
    createdAt: profile.createdAt ?? null,
  };
}

// ── Test retrieval ────────────────────────────────────────────────────────────

export async function retrieveTests({ testIds = [], search = null } = {}) {
  let query = { status: 'published' };
  if (testIds.length > 0) {
    query._id = { $in: testIds.slice(0, LIMIT) };
  } else if (search) {
    query.$or = [
      { name: { $regex: String(search).slice(0, 100), $options: 'i' } },
      { abbreviation: { $regex: String(search).slice(0, 20), $options: 'i' } },
    ];
  }
  const tests = await Test.find(query)
    .select('_id name abbreviation category description administeredBy website')
    .limit(LIMIT)
    .lean();
  return tests.map((t) => ({
    entityId: String(t._id),
    name: t.name,
    abbreviation: t.abbreviation,
    category: t.category,
    description: t.description,
    administeredBy: t.administeredBy,
    website: t.website ?? null,
  }));
}

// ── TestAcceptance retrieval (scope precedence: program+intake > program > institution > country) ──

export async function retrieveTestAcceptance({ testId, programId, institutionId, country } = {}) {
  if (!testId && !programId && !institutionId && !country) return [];

  const filters = { status: 'active' };
  if (testId) filters.test = testId;
  if (programId) filters.program = programId;
  if (institutionId) filters.institution = institutionId;
  if (country) filters.country = country;

  const records = await TestAcceptance.find(filters)
    .select('_id test institution program scope acceptanceStatus minimumScore notes evidence freshnessState lastVerifiedAt nextReviewAt sourceStatus')
    .populate('test', 'name abbreviation')
    .limit(LIMIT)
    .lean();

  return records.map((r) => {
    const freshness = r.freshnessState || deriveFreshness({
      lastVerifiedAt: r.lastVerifiedAt,
      nextReviewAt: r.nextReviewAt,
      sourceStatus: r.sourceStatus,
      dataType: 'test_policy',
    });
    return {
      entityId: String(r._id),
      testId: r.test ? String(r.test._id ?? r.test) : null,
      testName: r.test?.name ?? null,
      testAbbreviation: r.test?.abbreviation ?? null,
      scope: r.scope,
      acceptanceStatus: r.acceptanceStatus,
      minimumScore: r.minimumScore ?? null,
      notes: r.notes ?? null,
      freshnessState: freshness,
      lastVerifiedAt: r.lastVerifiedAt ?? null,
      evidence: (r.evidence ?? []).slice(0, 3).map((ev) => ({
        sourceType: ev.sourceType,
        sourceUrl: ev.sourceUrl ?? null,
        verifiedAt: ev.verifiedAt ?? null,
      })),
    };
  });
}

// ── Program retrieval ─────────────────────────────────────────────────────────

export async function retrievePrograms({ programIds = [], search = null, country = null, field = null, degreeLevel = null } = {}) {
  let query = { status: 'published' };
  if (programIds.length > 0) {
    query._id = { $in: programIds.slice(0, LIMIT) };
  } else {
    if (search) query.$text = { $search: String(search).slice(0, 200) };
    if (country) query.country = country;
    if (field) query.field = { $regex: String(field).slice(0, 100), $options: 'i' };
    if (degreeLevel) query.degreeLevel = degreeLevel;
  }
  const programs = await Program.find(query)
    .select('_id name institution country degreeLevel field tuitionFee studyMode description slug intakes freshnessMeta')
    .limit(LIMIT)
    .lean();

  return programs.map((p) => {
    const freshness = p.freshnessMeta?.state || deriveFreshness({
      lastVerifiedAt: p.freshnessMeta?.lastVerifiedAt,
      nextReviewAt: p.freshnessMeta?.nextReviewAt,
      dataType: 'program',
    });
    return {
      entityId: String(p._id),
      name: p.name,
      institutionId: p.institution ? String(p.institution) : null,
      country: p.country ?? null,
      degreeLevel: p.degreeLevel ?? null,
      field: p.field ?? null,
      tuitionFee: p.tuitionFee ?? null,
      studyMode: p.studyMode ?? null,
      description: p.description ?? null,
      slug: p.slug ?? null,
      intakes: (p.intakes ?? []).slice(0, 3),
      freshnessState: freshness,
      lastVerifiedAt: p.freshnessMeta?.lastVerifiedAt ?? null,
    };
  });
}

// ── Scholarship retrieval ─────────────────────────────────────────────────────

export async function retrieveScholarships({ scholarshipIds = [], search = null, country = null } = {}) {
  let query = { publicationStatus: 'published' };
  if (scholarshipIds.length > 0) {
    query._id = { $in: scholarshipIds.slice(0, LIMIT) };
  } else {
    if (search) query.$text = { $search: String(search).slice(0, 200) };
    if (country) query.country = country;
  }
  const scholarships = await CanonicalScholarship.find(query)
    .select('_id name provider country fundingType coverageDetails eligibilitySummary description slug freshnessMeta')
    .limit(LIMIT)
    .lean();

  const cycles = await ScholarshipCycle.find({
    scholarship: { $in: scholarships.map((s) => s._id) },
    status: 'active',
  })
    .select('scholarship deadline applicationUrl freshnessMeta')
    .limit(LIMIT)
    .lean();

  const cycleMap = {};
  for (const c of cycles) {
    const sid = String(c.scholarship);
    if (!cycleMap[sid]) cycleMap[sid] = [];
    cycleMap[sid].push(c);
  }

  return scholarships.map((s) => {
    const sid = String(s._id);
    const activeCycles = cycleMap[sid] ?? [];
    const freshness = s.freshnessMeta?.state || deriveFreshness({
      lastVerifiedAt: s.freshnessMeta?.lastVerifiedAt,
      nextReviewAt: s.freshnessMeta?.nextReviewAt,
      dataType: 'scholarship',
    });
    return {
      entityId: sid,
      name: s.name,
      provider: s.provider ?? null,
      country: s.country ?? null,
      fundingType: s.fundingType ?? null,
      coverageDetails: s.coverageDetails ?? null,
      eligibilitySummary: s.eligibilitySummary ?? null,
      description: s.description ?? null,
      slug: s.slug ?? null,
      freshnessState: freshness,
      lastVerifiedAt: s.freshnessMeta?.lastVerifiedAt ?? null,
      activeDeadlines: activeCycles.map((c) => ({
        deadline: c.deadline ?? null,
        applicationUrl: c.applicationUrl ?? null,
      })),
    };
  });
}

// ── Institution retrieval ─────────────────────────────────────────────────────

export async function retrieveInstitutions({ institutionIds = [], search = null } = {}) {
  if (institutionIds.length === 0 && !search) return [];

  let query = {};
  if (institutionIds.length > 0) {
    query.institution = { $in: institutionIds.slice(0, LIMIT) };
  }

  const profiles = await InstitutionProfile.find(query)
    .select('institution displayName country type description website verifiedAt')
    .limit(LIMIT)
    .lean();

  const claimQuery = { status: 'approved' };
  if (institutionIds.length > 0) claimQuery.institution = { $in: institutionIds.slice(0, LIMIT) };
  const claims = await InstitutionClaim.find(claimQuery)
    .select('institution verifiedAt')
    .limit(LIMIT)
    .lean();
  const verifiedInstitutionIds = new Set(claims.map((c) => String(c.institution)));

  return profiles.map((p) => ({
    entityId: String(p.institution),
    displayName: p.displayName,
    country: p.country ?? null,
    type: p.type ?? null,
    description: p.description ?? null,
    website: p.website ?? null,
    isVerifiedInstitution: verifiedInstitutionIds.has(String(p.institution)),
    verifiedAt: p.verifiedAt ?? null,
    officialAttribution: verifiedInstitutionIds.has(String(p.institution))
      ? 'Official information supplied and confirmed by the institution'
      : null,
  }));
}

// ── Eligibility + matching retrieval ─────────────────────────────────────────

export async function retrieveEligibility(userId, { programId, scholarshipId } = {}) {
  const results = {};
  if (programId) {
    results.program = await evaluateProgramEligibility(userId, programId).catch(() => null);
  }
  if (scholarshipId) {
    results.scholarship = await evaluateScholarshipEligibility(userId, scholarshipId).catch(() => null);
  }
  return results;
}

export async function retrieveGapAnalysis(userId) {
  return getProfileGapAnalysis(userId).catch(() => null);
}

export async function retrieveTestGuidance(userId, programId) {
  return getProfileTestGuidance(userId, programId).catch(() => null);
}

// ── Journey + NBA retrieval ───────────────────────────────────────────────────

export async function retrieveJourneyContext(userId) {
  const [actions, deadlines] = await Promise.all([
    listActions(userId, { limit: 20 }).catch(() => ({ items: [] })),
    listDeadlines(userId, { limit: 10 }).catch(() => ({ items: [] })),
  ]);

  const actionList = actions?.items ?? [];
  const deadlineList = deadlines?.items ?? [];

  const journeyPlan = buildJourneyPlan({
    pendingActions: actionList,
    upcomingDeadlines: deadlineList,
  });
  const nba = computeNextBestAction({
    pendingActions: actionList,
    upcomingDeadlines: deadlineList,
  });

  return {
    journeyPlan,
    nextBestAction: nba,
    recentActions: actionList.slice(0, 5),
    upcomingDeadlines: deadlineList.slice(0, 5),
  };
}

// ── Intent-based retrieval router ─────────────────────────────────────────────

/**
 * Route to appropriate retrievers based on classified intent.
 * Returns structured retrieval result consumed by evidence packet assembly.
 */
export async function retrieveForIntent(userId, intent, entityRefs = {}, studentContext = null) {
  const result = {
    tests: [],
    testAcceptances: [],
    programs: [],
    scholarships: [],
    institutions: [],
    eligibility: {},
    gapAnalysis: null,
    journeyContext: null,
    studentContext: studentContext,
  };

  const refs = {
    testIds: (entityRefs.testIds ?? []).slice(0, LIMIT),
    programIds: (entityRefs.programIds ?? []).slice(0, LIMIT),
    scholarshipIds: (entityRefs.scholarshipIds ?? []).slice(0, LIMIT),
    institutionIds: (entityRefs.institutionIds ?? []).slice(0, LIMIT),
    search: entityRefs.search ? String(entityRefs.search).slice(0, 200) : null,
    country: entityRefs.country ?? null,
    field: entityRefs.field ?? null,
    degreeLevel: entityRefs.degreeLevel ?? null,
  };

  switch (intent) {
    case COPILOT_INTENT.TEST_QUESTION:
      result.tests = await retrieveTests({ testIds: refs.testIds, search: refs.search });
      break;

    case COPILOT_INTENT.ACCEPTANCE_QUESTION:
      result.testAcceptances = await retrieveTestAcceptance({
        testId: refs.testIds[0] ?? null,
        programId: refs.programIds[0] ?? null,
        institutionId: refs.institutionIds[0] ?? null,
        country: refs.country,
      });
      if (refs.testIds.length > 0) {
        result.tests = await retrieveTests({ testIds: refs.testIds });
      }
      break;

    case COPILOT_INTENT.PROGRAM_SEARCH:
      result.programs = await retrievePrograms({
        programIds: refs.programIds,
        search: refs.search,
        country: refs.country,
        field: refs.field,
        degreeLevel: refs.degreeLevel,
      });
      if (userId && refs.programIds.length > 0) {
        result.eligibility = await retrieveEligibility(userId, { programId: refs.programIds[0] });
      }
      break;

    case COPILOT_INTENT.SCHOLARSHIP_SEARCH:
      result.scholarships = await retrieveScholarships({
        scholarshipIds: refs.scholarshipIds,
        search: refs.search,
        country: refs.country,
      });
      if (userId && refs.scholarshipIds.length > 0) {
        result.eligibility = await retrieveEligibility(userId, { scholarshipId: refs.scholarshipIds[0] });
      }
      break;

    case COPILOT_INTENT.ELIGIBILITY_QUESTION: {
      const eligParams = {};
      if (refs.programIds[0]) eligParams.programId = refs.programIds[0];
      if (refs.scholarshipIds[0]) eligParams.scholarshipId = refs.scholarshipIds[0];
      if (Object.keys(eligParams).length > 0 && userId) {
        result.eligibility = await retrieveEligibility(userId, eligParams);
      }
      if (refs.programIds.length > 0) {
        result.programs = await retrievePrograms({ programIds: refs.programIds });
      }
      result.gapAnalysis = userId ? await retrieveGapAnalysis(userId) : null;
      break;
    }

    case COPILOT_INTENT.JOURNEY_QUESTION:
      if (userId) {
        result.journeyContext = await retrieveJourneyContext(userId);
      }
      result.gapAnalysis = userId ? await retrieveGapAnalysis(userId) : null;
      break;

    case COPILOT_INTENT.INSTITUTION_QUESTION:
      result.institutions = await retrieveInstitutions({ institutionIds: refs.institutionIds });
      if (refs.programIds.length > 0) {
        result.programs = await retrievePrograms({ programIds: refs.programIds });
      }
      break;

    case COPILOT_INTENT.COMPARISON:
      if (refs.programIds.length > 0) {
        result.programs = await retrievePrograms({ programIds: refs.programIds });
      }
      if (refs.scholarshipIds.length > 0) {
        result.scholarships = await retrieveScholarships({ scholarshipIds: refs.scholarshipIds });
      }
      if (refs.institutionIds.length > 0) {
        result.institutions = await retrieveInstitutions({ institutionIds: refs.institutionIds });
      }
      break;

    case COPILOT_INTENT.PROFILE_GAP:
      result.gapAnalysis = userId ? await retrieveGapAnalysis(userId) : null;
      result.journeyContext = userId ? await retrieveJourneyContext(userId) : null;
      break;

    default:
      // general — retrieve based on whatever refs are available
      if (refs.testIds.length > 0) result.tests = await retrieveTests({ testIds: refs.testIds });
      if (refs.programIds.length > 0) result.programs = await retrievePrograms({ programIds: refs.programIds });
      if (refs.scholarshipIds.length > 0) result.scholarships = await retrieveScholarships({ scholarshipIds: refs.scholarshipIds });
      if (refs.institutionIds.length > 0) result.institutions = await retrieveInstitutions({ institutionIds: refs.institutionIds });
      if (userId) result.journeyContext = await retrieveJourneyContext(userId);
      break;
  }

  return result;
}
