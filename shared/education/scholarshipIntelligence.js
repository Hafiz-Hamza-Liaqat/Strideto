/**
 * Scholarship + Program Intelligence — shared contract (Mission 7).
 *
 * Client- and server-safe: pure JS, no Node/DOM globals.
 *
 * Defines:
 *   - Scholarship types, provider types, funding types, funding components
 *   - Application methods
 *   - Criteria types
 *   - Cycle/deadline statuses
 *   - Program requirement types and semantics
 *   - Truthfulness boundary helpers
 *   - Public projection helpers
 *
 * DO NOT rename existing values — stored in DB.
 */

// ── Scholarship types ─────────────────────────────────────────────────────────

export const SCHOLARSHIP_TYPES = Object.freeze({
  GOVERNMENT: 'government',
  INSTITUTIONAL: 'institutional',
  PRIVATE: 'private',
  INTERNATIONAL_ORG: 'international_org',
  BILATERAL: 'bilateral',
  FELLOWSHIP: 'fellowship',
  OTHER: 'other',
});

// ── Provider types ────────────────────────────────────────────────────────────

export const PROVIDER_TYPES = Object.freeze({
  GOVERNMENT: 'government',
  UNIVERSITY: 'university',
  PRIVATE_ORG: 'private_org',
  INTERNATIONAL_ORG: 'international_org',
  FOUNDATION: 'foundation',
  OTHER: 'other',
});

// ── Funding types ─────────────────────────────────────────────────────────────

export const FUNDING_TYPES = Object.freeze({
  FULL: 'full',
  PARTIAL: 'partial',
  FIXED_AMOUNT: 'fixed_amount',
  COMPONENT_BASED: 'component_based',
  UNKNOWN: 'unknown',
});

// ── Funding components ────────────────────────────────────────────────────────

export const FUNDING_COMPONENTS = Object.freeze({
  TUITION: 'tuition',
  STIPEND: 'stipend',
  ACCOMMODATION: 'accommodation',
  TRAVEL: 'travel',
  INSURANCE: 'insurance',
  BOOKS_MATERIALS: 'books_materials',
  RESEARCH_ALLOWANCE: 'research_allowance',
  OTHER: 'other',
});

// ── Application methods ───────────────────────────────────────────────────────

export const APPLICATION_METHODS = Object.freeze({
  DIRECT_PORTAL: 'direct_portal',
  INSTITUTION_APPLICATION: 'institution_application',
  AUTOMATIC_CONSIDERATION: 'automatic_consideration',
  NOMINATION: 'nomination',
  EXTERNAL_PROVIDER: 'external_provider',
  OTHER: 'other',
});

// ── Criteria types ────────────────────────────────────────────────────────────

export const CRITERIA_TYPES = Object.freeze({
  NATIONALITY_RESIDENCE: 'nationality_residence',
  DEGREE_LEVEL: 'degree_level',
  ACADEMIC_QUALIFICATION: 'academic_qualification',
  GPA_GRADE: 'gpa_grade',
  FIELD: 'field',
  AGE: 'age',
  LANGUAGE_TEST: 'language_test',
  EXPERIENCE_RESEARCH: 'experience_research',
  FINANCIAL_NEED: 'financial_need',
  ADMISSION_ENROLLMENT: 'admission_enrollment',
  OTHER: 'other',
});

// ── Cycle statuses ────────────────────────────────────────────────────────────

export const CYCLE_STATUSES = Object.freeze({
  OPEN: 'open',
  UPCOMING: 'upcoming',
  CLOSED: 'closed',
  UNKNOWN: 'unknown',
});

// ── Program requirement types ─────────────────────────────────────────────────

export const PROGRAM_REQUIREMENT_TYPES = Object.freeze({
  ACADEMIC: 'academic',
  LANGUAGE_TEST: 'language_test',
  STANDARDIZED_TEST: 'standardized_test',
  PREREQUISITE_SUBJECT: 'prerequisite_subject',
  EXPERIENCE: 'experience',
  PORTFOLIO: 'portfolio',
  DOCUMENT: 'document',
  OTHER: 'other',
});

// ── Requirement semantics ─────────────────────────────────────────────────────

export const REQUIREMENT_SEMANTICS = Object.freeze({
  REQUIRED: 'required',
  OPTIONAL: 'optional',
  CONDITIONAL: 'conditional',
});

// ── Scholarship applicability scopes ─────────────────────────────────────────

export const APPLICABILITY_SCOPES = Object.freeze({
  COUNTRY: 'country',
  INSTITUTION: 'institution',
  PROGRAM: 'program',
  DEGREE_LEVEL: 'degree_level',
  FIELD: 'field',
});

// ── Validators ────────────────────────────────────────────────────────────────

function makeValidator(obj) {
  const s = new Set(Object.values(obj));
  return (v) => typeof v === 'string' && s.has(v);
}

export const isValidScholarshipType = makeValidator(SCHOLARSHIP_TYPES);
export const isValidProviderType = makeValidator(PROVIDER_TYPES);
export const isValidFundingType = makeValidator(FUNDING_TYPES);
export const isValidFundingComponent = makeValidator(FUNDING_COMPONENTS);
export const isValidApplicationMethod = makeValidator(APPLICATION_METHODS);
export const isValidCriteriaType = makeValidator(CRITERIA_TYPES);
export const isValidCycleStatus = makeValidator(CYCLE_STATUSES);
export const isValidProgramRequirementType = makeValidator(PROGRAM_REQUIREMENT_TYPES);
export const isValidRequirementSemantics = makeValidator(REQUIREMENT_SEMANTICS);
export const isValidApplicabilityScope = makeValidator(APPLICABILITY_SCOPES);

// ── Truthfulness boundary helpers ─────────────────────────────────────────────

/**
 * Phrases that imply guaranteed outcomes — never publish these.
 * Mission 7 stores factual data; Mission 8 evaluates users.
 * No output may claim certainty for scholarship, admission, visa, or employment.
 */
export const FORBIDDEN_GUARANTEE_PATTERNS = Object.freeze([
  /\b(guaranteed?|100\s*%\s*(eligible|funded|scholarship|admission|visa))\b/i,
  /\bguaranteed?\s+(scholarship|admission|visa|job|employment)\b/i,
]);

export function containsForbiddenGuarantee(text) {
  if (typeof text !== 'string') return false;
  return FORBIDDEN_GUARANTEE_PATTERNS.some((re) => re.test(text));
}

/**
 * True when a "No IELTS required" style claim is present in the text.
 * Such claims must NOT be published without source-backed evidence.
 * This is a truthfulness boundary signal — enforcement is at the application layer.
 */
export function containsNoTestRequired(text) {
  if (typeof text !== 'string') return false;
  return /\bno\s+(ielts|toefl|duolingo|pte|test)\s+required\b/i.test(text);
}

// ── Funding label helpers (display only, not for eligibility logic) ───────────

export const FUNDING_TYPE_LABELS = Object.freeze({
  full: 'Fully Funded',
  partial: 'Partially Funded',
  fixed_amount: 'Fixed Amount',
  component_based: 'Component-Based',
  unknown: 'Funding Not Specified',
});

export function fundingTypeLabel(type) {
  return FUNDING_TYPE_LABELS[type] || 'Funding Not Specified';
}

// ── Cycle status derivation ───────────────────────────────────────────────────

/**
 * Derive a cycle's display status from its deadline/openAt dates and a reference
 * point (defaults to now). Returns a CYCLE_STATUSES value.
 *
 * Unknown remains unknown when dates are absent — do not infer.
 */
export function deriveCycleStatus(cycle, referenceDate = new Date()) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const open = cycle.applicationOpenAt ? new Date(cycle.applicationOpenAt) : null;
  const deadline = cycle.deadlineAt ? new Date(cycle.deadlineAt) : null;

  if (!open && !deadline) return CYCLE_STATUSES.UNKNOWN;
  if (deadline && ref > deadline) return CYCLE_STATUSES.CLOSED;
  if (open && ref < open) return CYCLE_STATUSES.UPCOMING;
  if ((!open || ref >= open) && (!deadline || ref <= deadline)) return CYCLE_STATUSES.OPEN;
  return CYCLE_STATUSES.UNKNOWN;
}

// ── Public projection — scholarship ──────────────────────────────────────────

/**
 * Project a CanonicalScholarship document for public API response.
 * Strips adminNotes; preserves source/freshness for truthfulness display.
 */
export function projectPublicScholarship(doc) {
  if (!doc) return null;
  const {
    adminNotes: _adminNotes, // never expose
    reviewFeedback: _reviewFeedback, // provider/admin workflow only
    __v: _v,
    ...rest
  } = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return rest;
}

// ── Public projection — program requirement ───────────────────────────────────

export function projectPublicProgramRequirement(doc) {
  if (!doc) return null;
  const {
    adminNotes: _adminNotes,
    __v: _v,
    ...rest
  } = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return rest;
}

// ── Factual comparison contract ───────────────────────────────────────────────

/**
 * Extract lightweight comparable facts from a projected scholarship.
 * Used by the comparison endpoint — no eligibility scoring, no ranking.
 * Maximum 3 items compared.
 */
export function scholarshipComparisonFacts(scholarship) {
  if (!scholarship) return null;
  return {
    id: scholarship._id,
    slug: scholarship.slug,
    title: scholarship.title,
    provider: scholarship.provider?.name ?? '',
    providerType: scholarship.provider?.providerType ?? '',
    destinationCountries: scholarship.destinationCountries ?? [],
    scholarshipType: scholarship.scholarshipType ?? '',
    degreeLevels: scholarship.degreeLevels ?? [],
    fields: scholarship.fields ?? [],
    studyModes: scholarship.studyModes ?? [],
    fundingType: scholarship.funding?.type ?? FUNDING_TYPES.UNKNOWN,
    applicationMethod: scholarship.applicationMethod ?? '',
    applicationUrl: scholarship.applicationUrl ?? '',
    lastVerifiedAt: scholarship.lastVerifiedAt ?? null,
    freshnessState: scholarship.freshnessState ?? '',
    status: scholarship.status,
  };
}

/**
 * Extract lightweight comparable facts from a projected Program + requirements.
 */
export function programComparisonFacts(program, requirements = []) {
  if (!program) return null;
  return {
    id: program._id,
    slug: program.slug,
    name: program.name,
    degreeLevel: program.degreeLevel ?? '',
    field: program.field ?? '',
    studyMode: program.studyMode ?? '',
    durationMonths: program.durationMonths ?? null,
    country: program.country ?? '',
    campus: program.campus ?? '',
    officialProgramUrl: program.officialProgramUrl ?? '',
    requirementSummary: requirements.map((r) => ({
      type: r.requirementType,
      semantics: r.semantics,
      description: r.description ?? '',
    })),
    status: program.status,
  };
}
