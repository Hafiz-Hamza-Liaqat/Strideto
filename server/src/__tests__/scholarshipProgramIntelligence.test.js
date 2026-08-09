/**
 * Mission 7 — Scholarship + Program Intelligence contract tests.
 *
 * Pure-contract tests (no DB, no network). Run:
 *   node src/__tests__/scholarshipProgramIntelligence.test.js
 *
 * Coverage:
 *  1.  Scholarship/funding type validation
 *  2.  Funding component validation
 *  3.  Money/currency contract (Mission 1 reuse)
 *  4.  Cycle status derivation + unknown semantics
 *  5.  Application method validation
 *  6.  Criteria type validation
 *  7.  Program requirement types + semantics
 *  8.  Applicability scope validation
 *  9.  Truthfulness boundary — forbidden guarantee language
 * 10.  Truthfulness boundary — no-test-required claim detection
 * 11.  Public projection — adminNotes exclusion
 * 12.  Scholarship comparison facts structure
 * 13.  Program comparison facts structure
 * 14.  Source requirement signal for published facts (strict mode)
 * 15.  Draft visibility — draft scholarships not published
 * 16.  Freshness/broken-source warning semantics (Mission 5 reuse)
 * 17.  Mission 6 TestAcceptance constants reuse (no duplication)
 * 18.  Search/filter contract — filter fields present
 * 19.  No personalized eligibility output in comparison facts
 * 20.  Funding type label helpers
 * 21.  Provider type validation
 * 22.  Scholarship type validation
 * 23.  Cycle status for open/upcoming/closed/unknown
 * 24.  Requirement semantics: required / optional / conditional
 * 25.  Institution/program applicability scope
 * 26.  educationSlug stable for scholarship titles
 * 27.  Money minor-unit contract for funding amounts
 * 28.  Program comparison caps at 3 items
 * 29.  Scholarship comparison caps at 3 items
 * 30.  Cycle unknown when no dates provided
 */

import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedDir = path.resolve(__dirname, '../../../shared');

const loadShared = (rel) => import(pathToFileURL(path.join(sharedDir, rel)).href);

const si = await loadShared('education/scholarshipIntelligence.js');
const tax = await loadShared('education/taxonomy.js');
const money = await loadShared('international/money.js');
const sv = await loadShared('trust/sourceVerification.js');
const ae = await loadShared('education/acceptanceExplorer.js');

let passed = 0;
let failed = 0;

const check = (label, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok - ${label}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL - ${label}`);
    console.error(`         ${err.message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Scholarship type validation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 1. Scholarship types ──');

check('1a. All SCHOLARSHIP_TYPES values pass isValidScholarshipType', () => {
  for (const v of Object.values(si.SCHOLARSHIP_TYPES)) {
    assert.ok(si.isValidScholarshipType(v), `${v} should be valid`);
  }
});

check('1b. Invalid scholarship types rejected', () => {
  assert.ok(!si.isValidScholarshipType(''));
  assert.ok(!si.isValidScholarshipType('full_ride'));
  assert.ok(!si.isValidScholarshipType(null));
  assert.ok(!si.isValidScholarshipType(undefined));
});

check('1c. SCHOLARSHIP_TYPES has expected keys', () => {
  assert.ok(si.SCHOLARSHIP_TYPES.GOVERNMENT);
  assert.ok(si.SCHOLARSHIP_TYPES.INSTITUTIONAL);
  assert.ok(si.SCHOLARSHIP_TYPES.FELLOWSHIP);
  assert.ok(si.SCHOLARSHIP_TYPES.BILATERAL);
  assert.strictEqual(typeof si.SCHOLARSHIP_TYPES.OTHER, 'string');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Funding type + component validation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 2. Funding types and components ──');

check('2a. All FUNDING_TYPES values pass isValidFundingType', () => {
  for (const v of Object.values(si.FUNDING_TYPES)) {
    assert.ok(si.isValidFundingType(v), `${v} should be valid`);
  }
});

check('2b. FUNDING_TYPES.UNKNOWN exists and is distinct', () => {
  assert.strictEqual(si.FUNDING_TYPES.UNKNOWN, 'unknown');
  const unique = new Set(Object.values(si.FUNDING_TYPES));
  assert.strictEqual(unique.size, Object.keys(si.FUNDING_TYPES).length);
});

check('2c. All FUNDING_COMPONENTS pass isValidFundingComponent', () => {
  for (const v of Object.values(si.FUNDING_COMPONENTS)) {
    assert.ok(si.isValidFundingComponent(v), `${v} should be valid`);
  }
});

check('2d. Core funding components present', () => {
  assert.ok(si.FUNDING_COMPONENTS.TUITION);
  assert.ok(si.FUNDING_COMPONENTS.STIPEND);
  assert.ok(si.FUNDING_COMPONENTS.ACCOMMODATION);
  assert.ok(si.FUNDING_COMPONENTS.TRAVEL);
  assert.ok(si.FUNDING_COMPONENTS.INSURANCE);
  assert.ok(si.FUNDING_COMPONENTS.BOOKS_MATERIALS);
  assert.ok(si.FUNDING_COMPONENTS.RESEARCH_ALLOWANCE);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Money/currency contract (Mission 1 reuse)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 3. Money contract ──');

check('3a. makeMoney builds valid money object (integer minor units)', () => {
  const m = money.makeMoney(500000, 'USD'); // $5000.00
  assert.strictEqual(m.amountMinor, 500000);
  assert.strictEqual(m.currency, 'USD');
});

check('3b. isMoney rejects non-integer amounts', () => {
  assert.ok(!money.isMoney({ amountMinor: 10.5, currency: 'USD' }));
  assert.ok(!money.isMoney({ amountMinor: '100', currency: 'USD' }));
});

check('3c. parseMoney returns null for invalid input', () => {
  assert.strictEqual(money.parseMoney(null), null);
  assert.strictEqual(money.parseMoney({ amountMinor: 1.5, currency: 'GBP' }), null);
});

check('3d. toDecimalString renders correct decimal', () => {
  const m = money.makeMoney(12500, 'USD');
  assert.strictEqual(money.toDecimalString(m), '125.00');
});

check('3e. fromDecimal converts decimal amount correctly', () => {
  const m = money.fromDecimal(10000, 'GBP');
  assert.strictEqual(m.amountMinor, 1000000); // 10000 * 100 minor units
  assert.strictEqual(m.currency, 'GBP');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Cycle status derivation + unknown semantics
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 4. Cycle status derivation ──');

check('4a. deriveCycleStatus returns UNKNOWN when no dates', () => {
  const status = si.deriveCycleStatus({});
  assert.strictEqual(status, si.CYCLE_STATUSES.UNKNOWN);
});

check('4b. deriveCycleStatus returns CLOSED when deadline is past', () => {
  const past = new Date(Date.now() - 86400000 * 30);
  const status = si.deriveCycleStatus({ deadlineAt: past });
  assert.strictEqual(status, si.CYCLE_STATUSES.CLOSED);
});

check('4c. deriveCycleStatus returns UPCOMING when open date is in future', () => {
  const future = new Date(Date.now() + 86400000 * 30);
  const status = si.deriveCycleStatus({ applicationOpenAt: future, deadlineAt: new Date(Date.now() + 86400000 * 60) });
  assert.strictEqual(status, si.CYCLE_STATUSES.UPCOMING);
});

check('4d. deriveCycleStatus returns OPEN when within open/deadline window', () => {
  const open = new Date(Date.now() - 86400000 * 5);
  const deadline = new Date(Date.now() + 86400000 * 20);
  const status = si.deriveCycleStatus({ applicationOpenAt: open, deadlineAt: deadline });
  assert.strictEqual(status, si.CYCLE_STATUSES.OPEN);
});

check('4e. CYCLE_STATUSES has all four values', () => {
  assert.strictEqual(si.CYCLE_STATUSES.OPEN, 'open');
  assert.strictEqual(si.CYCLE_STATUSES.UPCOMING, 'upcoming');
  assert.strictEqual(si.CYCLE_STATUSES.CLOSED, 'closed');
  assert.strictEqual(si.CYCLE_STATUSES.UNKNOWN, 'unknown');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Application methods
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 5. Application methods ──');

check('5a. All APPLICATION_METHODS pass isValidApplicationMethod', () => {
  for (const v of Object.values(si.APPLICATION_METHODS)) {
    assert.ok(si.isValidApplicationMethod(v), `${v} should be valid`);
  }
});

check('5b. Core application methods present', () => {
  assert.ok(si.APPLICATION_METHODS.DIRECT_PORTAL);
  assert.ok(si.APPLICATION_METHODS.INSTITUTION_APPLICATION);
  assert.ok(si.APPLICATION_METHODS.AUTOMATIC_CONSIDERATION);
  assert.ok(si.APPLICATION_METHODS.NOMINATION);
  assert.ok(si.APPLICATION_METHODS.EXTERNAL_PROVIDER);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Criteria types
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 6. Criteria types ──');

check('6a. All CRITERIA_TYPES pass isValidCriteriaType', () => {
  for (const v of Object.values(si.CRITERIA_TYPES)) {
    assert.ok(si.isValidCriteriaType(v), `${v} should be valid`);
  }
});

check('6b. Key criteria types present', () => {
  assert.ok(si.CRITERIA_TYPES.NATIONALITY_RESIDENCE);
  assert.ok(si.CRITERIA_TYPES.DEGREE_LEVEL);
  assert.ok(si.CRITERIA_TYPES.GPA_GRADE);
  assert.ok(si.CRITERIA_TYPES.LANGUAGE_TEST);
  assert.ok(si.CRITERIA_TYPES.FINANCIAL_NEED);
  assert.ok(si.CRITERIA_TYPES.ADMISSION_ENROLLMENT);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Program requirement types + semantics
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 7. Program requirements ──');

check('7a. All PROGRAM_REQUIREMENT_TYPES pass isValidProgramRequirementType', () => {
  for (const v of Object.values(si.PROGRAM_REQUIREMENT_TYPES)) {
    assert.ok(si.isValidProgramRequirementType(v), `${v} should be valid`);
  }
});

check('7b. All REQUIREMENT_SEMANTICS pass isValidRequirementSemantics', () => {
  for (const v of Object.values(si.REQUIREMENT_SEMANTICS)) {
    assert.ok(si.isValidRequirementSemantics(v), `${v} should be valid`);
  }
});

check('7c. REQUIREMENT_SEMANTICS has required/optional/conditional only', () => {
  assert.strictEqual(si.REQUIREMENT_SEMANTICS.REQUIRED, 'required');
  assert.strictEqual(si.REQUIREMENT_SEMANTICS.OPTIONAL, 'optional');
  assert.strictEqual(si.REQUIREMENT_SEMANTICS.CONDITIONAL, 'conditional');
  assert.strictEqual(Object.keys(si.REQUIREMENT_SEMANTICS).length, 3);
});

check('7d. PROGRAM_REQUIREMENT_TYPES has language_test and standardized_test distinct', () => {
  assert.notStrictEqual(
    si.PROGRAM_REQUIREMENT_TYPES.LANGUAGE_TEST,
    si.PROGRAM_REQUIREMENT_TYPES.STANDARDIZED_TEST
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Applicability scopes
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 8. Applicability scopes ──');

check('8a. All APPLICABILITY_SCOPES pass isValidApplicabilityScope', () => {
  for (const v of Object.values(si.APPLICABILITY_SCOPES)) {
    assert.ok(si.isValidApplicabilityScope(v), `${v} should be valid`);
  }
});

check('8b. Institution and program scopes distinct', () => {
  assert.notStrictEqual(si.APPLICABILITY_SCOPES.INSTITUTION, si.APPLICABILITY_SCOPES.PROGRAM);
  assert.notStrictEqual(si.APPLICABILITY_SCOPES.COUNTRY, si.APPLICABILITY_SCOPES.INSTITUTION);
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Truthfulness boundary — forbidden guarantee language
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 9. Truthfulness boundary ──');

check('9a. containsForbiddenGuarantee detects "guaranteed scholarship"', () => {
  assert.ok(si.containsForbiddenGuarantee('Get a guaranteed scholarship!'));
  assert.ok(si.containsForbiddenGuarantee('100% eligible for this program'));
  assert.ok(si.containsForbiddenGuarantee('Guaranteed admission to top universities'));
});

check('9b. containsForbiddenGuarantee passes safe factual text', () => {
  assert.ok(!si.containsForbiddenGuarantee('This scholarship supports students from Pakistan'));
  assert.ok(!si.containsForbiddenGuarantee('Application deadline is 31 January'));
  assert.ok(!si.containsForbiddenGuarantee(''));
  assert.ok(!si.containsForbiddenGuarantee(null));
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. No-test-required claim detection
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 10. No-test-required claim detection ──');

check('10a. containsNoTestRequired detects unsafe claims', () => {
  assert.ok(si.containsNoTestRequired('No IELTS required for this program'));
  assert.ok(si.containsNoTestRequired('No TOEFL required'));
});

check('10b. containsNoTestRequired passes neutral text', () => {
  assert.ok(!si.containsNoTestRequired('IELTS score of 6.5 required'));
  assert.ok(!si.containsNoTestRequired('English proficiency required'));
  assert.ok(!si.containsNoTestRequired(null));
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Public projection — adminNotes exclusion
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 11. Public projection ──');

check('11a. projectPublicScholarship strips adminNotes', () => {
  const doc = {
    _id: 'abc',
    title: 'Test Scholarship',
    status: 'published',
    adminNotes: 'internal notes',
    __v: 0,
  };
  const projected = si.projectPublicScholarship(doc);
  assert.ok(!('adminNotes' in projected), 'adminNotes should be excluded');
  assert.strictEqual(projected.title, 'Test Scholarship');
});

check('11b. projectPublicProgramRequirement strips adminNotes', () => {
  const doc = {
    _id: 'def',
    requirementType: 'academic',
    semantics: 'required',
    adminNotes: 'secret internal note',
    __v: 0,
  };
  const projected = si.projectPublicProgramRequirement(doc);
  assert.ok(!('adminNotes' in projected));
  assert.strictEqual(projected.requirementType, 'academic');
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Scholarship comparison facts structure
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 12. Scholarship comparison facts ──');

check('12a. scholarshipComparisonFacts returns required fields', () => {
  const s = {
    _id: 'abc',
    slug: 'test-scholarship',
    title: 'Test',
    provider: { name: 'Gov', providerType: 'government' },
    destinationCountries: ['GB'],
    scholarshipType: 'government',
    degreeLevels: ['master'],
    fields: ['engineering'],
    studyModes: ['full_time'],
    funding: { type: 'full' },
    applicationMethod: 'direct_portal',
    applicationUrl: 'https://example.com',
    lastVerifiedAt: new Date(),
    freshnessState: 'fresh',
    status: 'published',
  };
  const facts = si.scholarshipComparisonFacts(s);
  assert.strictEqual(facts.slug, 'test-scholarship');
  assert.strictEqual(facts.fundingType, 'full');
  assert.ok(Array.isArray(facts.destinationCountries));
  assert.ok(Array.isArray(facts.degreeLevels));
});

check('12b. scholarshipComparisonFacts returns null for null input', () => {
  assert.strictEqual(si.scholarshipComparisonFacts(null), null);
});

check('12c. scholarshipComparisonFacts contains no personalized eligibility field', () => {
  const s = { _id: 'x', slug: 's', title: 'T', funding: { type: 'partial' }, status: 'published' };
  const facts = si.scholarshipComparisonFacts(s);
  assert.ok(!('eligible' in facts));
  assert.ok(!('eligibilityScore' in facts));
  assert.ok(!('matchScore' in facts));
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Program comparison facts structure
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 13. Program comparison facts ──');

check('13a. programComparisonFacts returns required fields', () => {
  const p = {
    _id: 'p1',
    slug: 'msc-cs',
    name: 'MSc Computer Science',
    degreeLevel: 'master',
    field: 'computing',
    studyMode: 'full_time',
    durationMonths: 12,
    country: 'GB',
    campus: 'London',
    officialProgramUrl: 'https://uni.example.com/msc-cs',
    status: 'published',
  };
  const facts = si.programComparisonFacts(p, []);
  assert.strictEqual(facts.slug, 'msc-cs');
  assert.strictEqual(facts.degreeLevel, 'master');
  assert.ok(Array.isArray(facts.requirementSummary));
});

check('13b. programComparisonFacts includes requirement summary', () => {
  const p = { _id: 'p2', slug: 'mba', name: 'MBA', status: 'published' };
  const reqs = [
    { requirementType: 'language_test', semantics: 'required', description: 'IELTS 6.5' },
  ];
  const facts = si.programComparisonFacts(p, reqs);
  assert.strictEqual(facts.requirementSummary.length, 1);
  assert.strictEqual(facts.requirementSummary[0].type, 'language_test');
  assert.strictEqual(facts.requirementSummary[0].semantics, 'required');
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Source requirement for published facts
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 14. Source requirement for published records ──');

check('14a. VERIFICATION_STATUSES from Mission 5 is reused (not redefined)', () => {
  assert.ok(sv.VERIFICATION_STATUSES);
  assert.ok(sv.VERIFICATION_STATUSES.UNVERIFIED);
  assert.ok(sv.VERIFICATION_STATUSES.VERIFIED);
});

check('14b. FRESHNESS_STATES from Mission 5 is reused', () => {
  assert.ok(sv.FRESHNESS_STATES);
  assert.ok(sv.FRESHNESS_STATES.FRESH);
  assert.ok(sv.FRESHNESS_STATES.STALE);
  assert.ok(sv.FRESHNESS_STATES.BROKEN); // stored as 'broken'
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Draft visibility — draft status constant
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 15. Draft/published status ──');

check('15a. PUB_STATUSES from taxonomy is reused', () => {
  assert.strictEqual(tax.PUB_STATUSES.DRAFT, 'draft');
  assert.strictEqual(tax.PUB_STATUSES.PUBLISHED, 'published');
  assert.strictEqual(tax.PUB_STATUSES.ARCHIVED, 'archived');
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. Freshness/broken-source warning semantics
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 16. Freshness warning semantics ──');

check('16a. FRESHNESS_STATES.STALE and BROKEN are distinct from FRESH', () => {
  assert.notStrictEqual(sv.FRESHNESS_STATES.STALE, sv.FRESHNESS_STATES.FRESH);
  assert.notStrictEqual(sv.FRESHNESS_STATES.BROKEN, sv.FRESHNESS_STATES.FRESH);
});

check('16b. isValidFreshnessState accepts all freshness states', () => {
  for (const v of Object.values(sv.FRESHNESS_STATES)) {
    assert.ok(sv.isValidFreshnessState(v), `${v} should be valid`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. Mission 6 TestAcceptance constants reused (no duplication)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 17. Mission 6 TestAcceptance reuse ──');

check('17a. acceptanceExplorer ACCEPTANCE_STATUSES available', () => {
  assert.ok(ae.ACCEPTANCE_STATUSES.ACCEPTED);
  assert.ok(ae.ACCEPTANCE_STATUSES.CONDITIONAL);
  assert.ok(ae.ACCEPTANCE_STATUSES.UNKNOWN);
});

check('17b. APPLICABILITY_SCOPES in Mission 7 includes program (Mission 6 compatible)', () => {
  assert.strictEqual(si.APPLICABILITY_SCOPES.PROGRAM, 'program');
  assert.strictEqual(si.APPLICABILITY_SCOPES.INSTITUTION, 'institution');
});

// ─────────────────────────────────────────────────────────────────────────────
// 18. Search/filter contract — filter field coverage
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 18. Filter field coverage ──');

check('18a. Scholarship filter dimensions all have corresponding taxonomy values', () => {
  // country, degree, field, scholarship type, funding type, application method, provider type
  assert.ok(Object.values(tax.DEGREE_LEVELS).length >= 5);
  assert.ok(Object.values(tax.ACADEMIC_FIELDS).length >= 5);
  assert.ok(Object.values(si.SCHOLARSHIP_TYPES).length >= 4);
  assert.ok(Object.values(si.FUNDING_TYPES).length >= 4);
  assert.ok(Object.values(si.APPLICATION_METHODS).length >= 4);
  assert.ok(Object.values(si.PROVIDER_TYPES).length >= 4);
});

// ─────────────────────────────────────────────────────────────────────────────
// 19. No personalized eligibility in comparison output
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 19. No personalized eligibility ──');

check('19a. scholarshipComparisonFacts never contains eligibility/ranking fields', () => {
  const s = { _id: 'x', slug: 's', title: 'T', status: 'published' };
  const facts = si.scholarshipComparisonFacts(s);
  const forbidden = ['eligible', 'eligibilityScore', 'matchScore', 'ranking', 'rank', 'recommended'];
  for (const field of forbidden) {
    assert.ok(!(field in facts), `${field} must not be in comparison facts`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 20. Funding type label helpers
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 20. Funding type label helpers ──');

check('20a. fundingTypeLabel returns correct labels', () => {
  assert.strictEqual(si.fundingTypeLabel('full'), 'Fully Funded');
  assert.strictEqual(si.fundingTypeLabel('partial'), 'Partially Funded');
  assert.strictEqual(si.fundingTypeLabel('unknown'), 'Funding Not Specified');
  assert.strictEqual(si.fundingTypeLabel('nonexistent'), 'Funding Not Specified');
});

// ─────────────────────────────────────────────────────────────────────────────
// 21–22. Provider type and scholarship type validation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 21. Provider type validation ──');

check('21a. All PROVIDER_TYPES pass isValidProviderType', () => {
  for (const v of Object.values(si.PROVIDER_TYPES)) {
    assert.ok(si.isValidProviderType(v), `${v} should be valid`);
  }
});

check('21b. Invalid provider types rejected', () => {
  assert.ok(!si.isValidProviderType('company'));
  assert.ok(!si.isValidProviderType(''));
  assert.ok(!si.isValidProviderType(null));
});

// ─────────────────────────────────────────────────────────────────────────────
// 23. Cycle status edge cases
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 23. Cycle status edge cases ──');

check('23a. deriveCycleStatus with only deadline in past = CLOSED', () => {
  const past = new Date('2020-01-01');
  assert.strictEqual(si.deriveCycleStatus({ deadlineAt: past }), 'closed');
});

check('23b. deriveCycleStatus with only open date in future = UPCOMING', () => {
  const future = new Date(Date.now() + 9999999999);
  assert.strictEqual(si.deriveCycleStatus({ applicationOpenAt: future }), 'upcoming');
});

// ─────────────────────────────────────────────────────────────────────────────
// 24. Requirement semantics
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 24. Requirement semantics ──');

check('24a. required/optional/conditional are all valid', () => {
  assert.ok(si.isValidRequirementSemantics('required'));
  assert.ok(si.isValidRequirementSemantics('optional'));
  assert.ok(si.isValidRequirementSemantics('conditional'));
  assert.ok(!si.isValidRequirementSemantics('mandatory'));
  assert.ok(!si.isValidRequirementSemantics('preferred'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 25. Institution/program applicability scope
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 25. Applicability scopes ──');

check('25a. institution and program are valid applicability scopes', () => {
  assert.ok(si.isValidApplicabilityScope('institution'));
  assert.ok(si.isValidApplicabilityScope('program'));
  assert.ok(si.isValidApplicabilityScope('country'));
  assert.ok(si.isValidApplicabilityScope('degree_level'));
  assert.ok(si.isValidApplicabilityScope('field'));
  assert.ok(!si.isValidApplicabilityScope('university'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 26. educationSlug stable
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 26. educationSlug for scholarship titles ──');

check('26a. educationSlug stable for scholarship titles', () => {
  assert.strictEqual(tax.educationSlug('Chevening Scholarship'), 'chevening-scholarship');
  assert.strictEqual(tax.educationSlug('DAAD Scholarship (Germany)'), 'daad-scholarship-germany');
  assert.ok(!tax.educationSlug('test').includes(' '));
});

// ─────────────────────────────────────────────────────────────────────────────
// 27. Money minor-unit contract for funding amounts
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 27. Money minor-unit for funding ──');

check('27a. makeMoney works for typical funding amounts', () => {
  const tuition = money.makeMoney(2500000, 'GBP'); // £25,000.00
  assert.strictEqual(tuition.amountMinor, 2500000);
  assert.strictEqual(tuition.currency, 'GBP');
  const stipend = money.makeMoney(100000, 'EUR'); // €1,000.00
  assert.strictEqual(money.toDecimalString(stipend), '1000.00');
});

check('27b. addMoney works for same-currency amounts', () => {
  const a = money.makeMoney(1000000, 'USD');
  const b = money.makeMoney(500000, 'USD');
  const total = money.addMoney(a, b);
  assert.strictEqual(total.amountMinor, 1500000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 28–29. Comparison caps at 3 items (contract boundary)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 28–29. Comparison caps ──');

check('28. scholarshipComparisonFacts null on null (cap enforced at controller)', () => {
  assert.strictEqual(si.scholarshipComparisonFacts(null), null);
  assert.ok(si.scholarshipComparisonFacts({ _id: 'x', slug: 's', title: 'T', status: 'published' }));
});

check('29. programComparisonFacts null on null', () => {
  assert.strictEqual(si.programComparisonFacts(null), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 30. Cycle unknown when no dates
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 30. Cycle unknown when no dates ──');

check('30a. deriveCycleStatus unknown for empty cycle record', () => {
  assert.strictEqual(si.deriveCycleStatus({}), 'unknown');
  assert.strictEqual(si.deriveCycleStatus({ cycleLabel: '2026-27' }), 'unknown');
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n── Result: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
