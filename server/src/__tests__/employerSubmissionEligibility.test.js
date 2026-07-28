/**
 * Run: node src/__tests__/employerSubmissionEligibility.test.js
 */
import assert from 'assert';
import {
  EMPLOYER_SUBMISSION_ELIGIBILITY_FIELDS,
  buildEmployerVerificationSnapshot,
  evaluateEmployerSubmissionEligibility,
} from '../services/publishing/EmployerSubmissionEligibility.js';

function validEmployer(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    companyName: ' Example Company ',
    email: 'jobs@example.com',
    companyDescription: 'Builds useful products.',
    industry: 'Technology',
    location: 'Karachi',
    city: '',
    province: '',
    website: '',
    verified: true,
    verificationLevel: 'verified',
    accountStatus: 'active',
    ...overrides,
  };
}

const eligible = evaluateEmployerSubmissionEligibility(validEmployer());
assert.strictEqual(eligible.eligible, true);
assert.deepStrictEqual(eligible.blockers, []);
assert.strictEqual(
  EMPLOYER_SUBMISSION_ELIGIBILITY_FIELDS.emailVerificationSupported,
  false
);
assert.deepStrictEqual(EMPLOYER_SUBMISSION_ELIGIBILITY_FIELDS.required, [
  'companyName',
  'email',
  'companyDescription',
  'industry',
]);

const unverified = evaluateEmployerSubmissionEligibility(
  validEmployer({ verified: false, verificationLevel: 'basic' })
);
assert.strictEqual(unverified.eligible, false);
assert.deepStrictEqual(
  unverified.blockers.map(({ code }) => code),
  ['EMPLOYER_NOT_VERIFIED']
);

const missingLegacyLevel = evaluateEmployerSubmissionEligibility(
  validEmployer({ verificationLevel: undefined })
);
assert.deepStrictEqual(
  missingLegacyLevel.blockers.map(({ code }) => code),
  ['EMPLOYER_NOT_VERIFIED']
);

const suspended = evaluateEmployerSubmissionEligibility(
  validEmployer({ accountStatus: 'suspended' })
);
assert.deepStrictEqual(
  suspended.blockers.map(({ code }) => code),
  ['ACCOUNT_SUSPENDED']
);

const unknownStatus = evaluateEmployerSubmissionEligibility(
  validEmployer({ accountStatus: undefined })
);
assert.deepStrictEqual(
  unknownStatus.blockers.map(({ code }) => code),
  ['ACCOUNT_DISABLED']
);

const missing = evaluateEmployerSubmissionEligibility(null);
assert.deepStrictEqual(
  missing.blockers.map(({ code }) => code),
  ['EMPLOYER_NOT_FOUND']
);

const incomplete = evaluateEmployerSubmissionEligibility(
  validEmployer({
    companyName: ' ',
    email: 'invalid',
    companyDescription: '',
    industry: '',
    location: '',
    city: '',
    province: '',
  })
);
assert.deepStrictEqual(
  incomplete.blockers.map(({ code }) => code),
  ['EMPLOYER_PROFILE_INCOMPLETE']
);
assert.deepStrictEqual(incomplete.blockers[0].fields, [
  'companyName',
  'email',
  'companyDescription',
  'industry',
  'location',
]);

const invalidOptionalWebsite = evaluateEmployerSubmissionEligibility(
  validEmployer({ website: 'ftp://example.com' })
);
assert.deepStrictEqual(invalidOptionalWebsite.blockers[0].fields, ['website']);

assert.strictEqual(
  evaluateEmployerSubmissionEligibility(
    validEmployer({ emailVerified: undefined })
  ).eligible,
  true
);
assert.deepStrictEqual(
  evaluateEmployerSubmissionEligibility(validEmployer(), {
    employerEmailVerificationSupported: true,
  }).blockers.map(({ code }) => code),
  ['EMPLOYER_EMAIL_NOT_VERIFIED']
);

const employer = validEmployer({
  website: 'https://Careers.Example.com/jobs',
  email: ' Jobs@Example.com ',
});
const before = JSON.parse(JSON.stringify(employer));
const result = evaluateEmployerSubmissionEligibility(employer);
assert.deepStrictEqual(employer, before);

const snapshot = buildEmployerVerificationSnapshot(employer, result);
assert.strictEqual(snapshot.normalizedCompanyName, 'Example Company');
assert.strictEqual(snapshot.emailDomain, 'example.com');
assert.strictEqual(snapshot.websiteDomain, 'careers.example.com');
assert.strictEqual(snapshot.emailValid, true);
assert.strictEqual(snapshot.requiredProfileChecks.website, true);
assert.deepStrictEqual(snapshot.eligibilityResultCodes, []);
assert.strictEqual(Object.hasOwn(snapshot, 'email'), false);
assert.strictEqual(Object.hasOwn(snapshot, 'password'), false);
assert.strictEqual(Object.hasOwn(snapshot, 'staffNotes'), false);

const multiBlocker = evaluateEmployerSubmissionEligibility(
  validEmployer({
    accountStatus: 'suspended',
    verified: false,
    verificationLevel: 'basic',
    companyDescription: '',
  })
);
assert.deepStrictEqual(
  multiBlocker.blockers.map(({ code }) => code),
  ['ACCOUNT_SUSPENDED', 'EMPLOYER_NOT_VERIFIED', 'EMPLOYER_PROFILE_INCOMPLETE']
);

console.log('employerSubmissionEligibility tests passed.');
