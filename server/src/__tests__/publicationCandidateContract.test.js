import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPLICATION_DESTINATION_MODES,
  APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS,
  buildApplicationDestinationEvidence,
} from '../services/publishing/contracts/ApplicationDestinationContract.js';
import * as contract from '../services/publishing/contracts/PublicationCandidateContract.js';

const {
  PUBLICATION_CANDIDATE_BOUNDS,
  PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS,
  PUBLICATION_CANDIDATE_CONTENT_FIELDS,
  PUBLICATION_CANDIDATE_EDITABLE_FIELDS,
  PUBLICATION_CANDIDATE_ERROR_CODES,
  PUBLICATION_CANDIDATE_FIELDS,
  PUBLICATION_CANDIDATE_FIELD_CLASSIFICATIONS,
  PUBLICATION_CANDIDATE_KINDS,
  PUBLICATION_CANDIDATE_POLICY_VERSION,
  PUBLICATION_CANDIDATE_SCHEMA_VERSION,
  PublicationCandidateContractError,
  buildMajorEditPublicationCandidate,
  buildPublicationCandidateCorrection,
  comparePublicationCandidates,
  validatePublicationCandidate,
} = contract;

let assertions = 0;
function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}
function equal(actual, expected, message) {
  assertions += 1;
  assert.strictEqual(actual, expected, message);
}
function deepEqual(actual, expected, message) {
  assertions += 1;
  assert.deepStrictEqual(actual, expected, message);
}
function throws(fn, code) {
  assertions += 1;
  assert.throws(fn, (error) => error?.code === code);
}

const JOB_ID = '222222222222222222222222';
const OTHER_JOB_ID = '333333333333333333333333';
const BASE_ID = '111111111111111111111111';
const BASE_HASH = 'a'.repeat(64);
const NOW = '2026-07-29T00:00:00.000Z';
const DEADLINE = '2027-01-01T00:00:00.000Z';
const validationContext = () => ({ jobId: JOB_ID });
const builderContext = (overrides = {}) => ({
  jobId: JOB_ID,
  expectedPublicationVersion: 7,
  evaluatedAt: new Date(NOW),
  ...overrides,
});

function destination(
  mode = APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM,
  target,
  evaluatedAt = NOW
) {
  const input = target === undefined ? { mode } : { mode, target };
  return buildApplicationDestinationEvidence(input, {
    jobId: JOB_ID,
    evaluatedAt: new Date(evaluatedAt),
    validationPolicyVersion: PUBLICATION_CANDIDATE_POLICY_VERSION,
  });
}

function content(overrides = {}) {
  return {
    title: 'Engineer',
    companyName: 'Example Employer',
    organizationName: null,
    description: 'Build reliable systems.',
    requirements: ['Relevant degree'],
    responsibilities: [],
    benefits: [],
    skillsRequired: ['Node.js'],
    salaryRange: null,
    salaryCurrency: 'PKR',
    location: 'Lahore',
    province: 'Punjab',
    city: 'Lahore',
    category: 'Technology',
    employmentType: 'full-time',
    jobType: 'Private',
    educationRequirement: 'Bachelor',
    experience: '2 years',
    gender: null,
    workMode: 'on_site',
    deadline: DEADLINE,
    totalSeats: null,
    autoCloseWhenFilled: true,
    applicationInstructions: null,
    logoUrl: null,
    gallery: [],
    ...overrides,
  };
}

function approvedBase(overrides = {}) {
  return {
    approvedSubmissionId: BASE_ID,
    approvedPublicationVersion: 7,
    approvedCandidateHash: BASE_HASH,
    content: content(),
    destinationEvidence: destination(),
    ...overrides,
  };
}

function major(patch = {}, base = approvedBase(), context = builderContext()) {
  return buildMajorEditPublicationCandidate(
    { approvedBase: base, patch },
    context
  );
}

function independentU32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
}

function independentFramed(tag, bytes) {
  return Buffer.concat([
    Buffer.from([tag]),
    independentU32(bytes.length),
    bytes,
  ]);
}

function independentlyEncodeFingerprintValue(value) {
  if (value === null) return Buffer.from([0x4e]);
  if (typeof value === 'string') {
    return independentFramed(0x53, Buffer.from(value, 'utf8'));
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return independentFramed(0x49, Buffer.from(String(value), 'ascii'));
  }
  if (typeof value === 'boolean') {
    return Buffer.from([0x42, value ? 0x01 : 0x00]);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([
      Buffer.from([0x41]),
      independentU32(value.length),
      ...value.map(independentlyEncodeFingerprintValue),
    ]);
  }

  const fields = Object.entries(value);
  return Buffer.concat([
    Buffer.from([0x52]),
    independentU32(fields.length),
    ...fields.flatMap(([name, fieldValue]) => {
      const nameBytes = Buffer.from(name, 'utf8');
      return [
        Buffer.from([0x46]),
        independentU32(nameBytes.length),
        nameBytes,
        independentlyEncodeFingerprintValue(fieldValue),
      ];
    }),
  ]);
}

function independentlyFingerprintCandidate(candidate) {
  const orderedContent = Object.fromEntries(
    PUBLICATION_CANDIDATE_CONTENT_FIELDS.map((field) => [
      field,
      candidate.content[field],
    ])
  );
  const descriptor = {
    schemaVersion: candidate.schemaVersion,
    policyVersion: candidate.policyVersion,
    candidateKind: candidate.candidateKind,
    candidateRevision: candidate.candidateRevision,
    baseApprovedSubmissionId: candidate.baseApprovedSubmissionId,
    baseApprovedCandidateHash: candidate.baseApprovedCandidateHash,
    basePublicationVersion: candidate.basePublicationVersion,
    expectedPublicationVersion: candidate.expectedPublicationVersion,
    previousCandidateHash: candidate.previousCandidateHash,
    content: orderedContent,
    destinationIdentity: {
      mode: candidate.destinationEvidence.mode,
      targetDigest: candidate.destinationEvidence.targetDigest,
    },
  };
  const bytes = Buffer.concat([
    Buffer.from('strideto.publication_candidate\0v1\0', 'ascii'),
    independentlyEncodeFingerprintValue(descriptor),
  ]);
  return {
    bytes,
    hash: createHash('sha256').update(bytes).digest('hex'),
  };
}

// Exact public export inventory and immutable policy.
deepEqual(Object.keys(contract).sort(), [
  'PUBLICATION_CANDIDATE_BOUNDS',
  'PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS',
  'PUBLICATION_CANDIDATE_CONTENT_FIELDS',
  'PUBLICATION_CANDIDATE_EDITABLE_FIELDS',
  'PUBLICATION_CANDIDATE_ERROR_CODES',
  'PUBLICATION_CANDIDATE_FIELDS',
  'PUBLICATION_CANDIDATE_FIELD_CLASSIFICATIONS',
  'PUBLICATION_CANDIDATE_KINDS',
  'PUBLICATION_CANDIDATE_POLICY_VERSION',
  'PUBLICATION_CANDIDATE_SCHEMA_VERSION',
  'PublicationCandidateContractError',
  'buildMajorEditPublicationCandidate',
  'buildPublicationCandidateCorrection',
  'comparePublicationCandidates',
  'validatePublicationCandidate',
]);
equal(PUBLICATION_CANDIDATE_SCHEMA_VERSION, 1);
equal(PUBLICATION_CANDIDATE_POLICY_VERSION, 'free-beta-2026-01');
deepEqual(PUBLICATION_CANDIDATE_KINDS, ['major_edit', 'correction']);
deepEqual(PUBLICATION_CANDIDATE_FIELDS, [
  'schemaVersion',
  'policyVersion',
  'candidateKind',
  'candidateRevision',
  'baseApprovedSubmissionId',
  'baseApprovedCandidateHash',
  'basePublicationVersion',
  'expectedPublicationVersion',
  'previousCandidateHash',
  'content',
  'destinationEvidence',
  'candidateHash',
]);
deepEqual(PUBLICATION_CANDIDATE_CONTENT_FIELDS, [
  'title',
  'companyName',
  'organizationName',
  'description',
  'requirements',
  'responsibilities',
  'benefits',
  'skillsRequired',
  'salaryRange',
  'salaryCurrency',
  'location',
  'province',
  'city',
  'category',
  'employmentType',
  'jobType',
  'educationRequirement',
  'experience',
  'gender',
  'workMode',
  'deadline',
  'totalSeats',
  'autoCloseWhenFilled',
  'applicationInstructions',
  'logoUrl',
  'gallery',
]);
equal(PUBLICATION_CANDIDATE_EDITABLE_FIELDS.length, 15);
equal(Object.keys(PUBLICATION_CANDIDATE_ERROR_CODES).length, 6);
equal(Object.keys(PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS).length, 4);
for (const value of [
  PUBLICATION_CANDIDATE_KINDS,
  PUBLICATION_CANDIDATE_FIELDS,
  PUBLICATION_CANDIDATE_CONTENT_FIELDS,
  PUBLICATION_CANDIDATE_EDITABLE_FIELDS,
  PUBLICATION_CANDIDATE_BOUNDS,
  PUBLICATION_CANDIDATE_FIELD_CLASSIFICATIONS,
  PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS,
  PUBLICATION_CANDIDATE_ERROR_CODES,
]) {
  ok(Object.isFrozen(value));
}
for (const value of Object.values(PUBLICATION_CANDIDATE_BOUNDS)) {
  ok(Object.isFrozen(value));
}
for (const value of Object.values(
  PUBLICATION_CANDIDATE_FIELD_CLASSIFICATIONS
)) {
  ok(Object.isFrozen(value));
}

// Known vector and complete immutable output.
const vector = major();
deepEqual(Object.keys(vector), PUBLICATION_CANDIDATE_FIELDS);
deepEqual(Object.keys(vector.content), PUBLICATION_CANDIDATE_CONTENT_FIELDS);
equal(vector.candidateHash.length, 64);
equal(
  vector.destinationEvidence.targetDigest,
  'c2b68765289729eb2eac3cf25926e9845bd16204eac01471273a20fca000a0b8'
);
equal(
  vector.candidateHash,
  'a77f2fc1f88154efb909988d1651b312a259b315c571bec725d46a461b8979e6'
);
const independentVectorFingerprint = independentlyFingerprintCandidate(vector);
equal(independentVectorFingerprint.bytes.length, 1271);
equal(
  independentVectorFingerprint.hash,
  'a77f2fc1f88154efb909988d1651b312a259b315c571bec725d46a461b8979e6'
);
equal(independentVectorFingerprint.hash, vector.candidateHash);
equal(vector.schemaVersion, 1);
equal(vector.policyVersion, 'free-beta-2026-01');
equal(vector.candidateKind, 'major_edit');
equal(vector.candidateRevision, 1);
equal(vector.previousCandidateHash, null);
ok(Object.isFrozen(vector));
ok(Object.isFrozen(vector.content));
ok(Object.isFrozen(vector.destinationEvidence));
for (const field of [
  'requirements',
  'responsibilities',
  'benefits',
  'skillsRequired',
  'gallery',
]) {
  ok(Object.isFrozen(vector.content[field]));
}
deepEqual(JSON.parse(JSON.stringify(vector)), vector);
deepEqual(structuredClone(vector), vector);
deepEqual(validatePublicationCandidate(vector, validationContext()), vector);

// Sparse patch, sanitization, NFC, line endings, arrays, null and isolation.
const patch = {
  title: '  <b>Développeur</b>  ',
  description: 'First line\r\nSecond line with enough text.',
  requirements: ['Node.js', 'Node.js'],
  skillsRequired: ['API', 'API'],
  salaryRange: '   ',
  location: null,
  province: '',
  city: '  Karachi  ',
  category: 'Engineering',
  employmentType: 'contract',
  jobType: 'Private',
  educationRequirement: '  Bachelor  ',
  experience: ' 3 years ',
  deadline: '2027-02-01T00:00:00.000Z',
};
const base = approvedBase();
const patched = major(patch, base);
equal(patched.content.title, 'Développeur');
equal(patched.content.description, 'First line\nSecond line with enough text.');
deepEqual(patched.content.requirements, ['Node.js', 'Node.js']);
deepEqual(patched.content.skillsRequired, ['API', 'API']);
equal(patched.content.salaryRange, null);
equal(patched.content.location, null);
equal(patched.content.province, null);
equal(patched.content.city, 'Karachi');
equal(patched.content.category, 'Engineering');
equal(patched.content.employmentType, 'contract');
equal(patched.content.educationRequirement, 'Bachelor');
equal(patched.content.experience, '3 years');
equal(patched.content.companyName, base.content.companyName);
deepEqual(patched.content.responsibilities, base.content.responsibilities);
equal(base.content.title, 'Engineer');
equal(patch.title, '  <b>Développeur</b>  ');
equal(base.destinationEvidence.evaluatedAt, NOW);
patch.requirements.push('Later mutation');
base.content.requirements.push('Base mutation');
equal(patched.content.requirements.length, 2);
equal(vector.content.requirements.length, 1);

// Different key order produces the same canonical representation and hash.
const reversedContent = Object.fromEntries(Object.entries(content()).reverse());
const reversedBase = {
  destinationEvidence: destination(),
  content: reversedContent,
  approvedCandidateHash: BASE_HASH,
  approvedPublicationVersion: 7,
  approvedSubmissionId: BASE_ID,
};
equal(major({}, reversedBase).candidateHash, vector.candidateHash);

// Destination timestamp is excluded; exact destination identity is included.
const laterEvidenceBase = approvedBase({
  destinationEvidence: destination(
    APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM,
    undefined,
    '2026-07-30T00:00:00.000Z'
  ),
});
equal(major({}, laterEvidenceBase).candidateHash, vector.candidateHash);
const externalUrl = destination(
  APPLICATION_DESTINATION_MODES.EXTERNAL_URL,
  'https://careers.example.edu/apply'
);
const externalEmail = destination(
  APPLICATION_DESTINATION_MODES.EXTERNAL_EMAIL,
  'jobs@example.edu'
);
const urlCandidate = major(
  { destinationEvidence: externalUrl },
  approvedBase()
);
const emailCandidate = major(
  { destinationEvidence: externalEmail },
  approvedBase()
);
equal(
  urlCandidate.destinationEvidence.trustClassification,
  APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.ADMIN_REVIEW_REQUIRED
);
equal(
  emailCandidate.destinationEvidence.trustClassification,
  APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.ADMIN_REVIEW_REQUIRED
);
ok(urlCandidate.candidateHash !== vector.candidateHash);
ok(emailCandidate.candidateHash !== urlCandidate.candidateHash);

// Bounds and field types.
const textCases = [
  ['title', 'x'.repeat(200), 'x'.repeat(201)],
  ['description', 'x'.repeat(20000), 'x'.repeat(20001)],
  ['salaryRange', 'x'.repeat(120), 'x'.repeat(121)],
  ['location', 'x'.repeat(200), 'x'.repeat(201)],
  ['province', 'x'.repeat(120), 'x'.repeat(121)],
  ['city', 'x'.repeat(120), 'x'.repeat(121)],
  ['category', 'x'.repeat(120), 'x'.repeat(121)],
  ['educationRequirement', 'x'.repeat(1000), 'x'.repeat(1001)],
  ['experience', 'x'.repeat(500), 'x'.repeat(501)],
];
for (const [field, accepted, rejected] of textCases) {
  equal(major({ [field]: accepted }).content[field], accepted);
  throws(
    () => major({ [field]: rejected }),
    PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
  );
}
throws(
  () => major({ title: '' }),
  PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
);
throws(
  () => major({ description: 'too short' }),
  PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
);
throws(
  () => major({ title: 'bad\nline' }),
  PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
);
throws(
  () => major({ title: 'bad\u0000value' }),
  PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
);
throws(
  () => major({ employmentType: 'Full Time' }),
  PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
);
throws(
  () => major({ jobType: 'private' }),
  PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
);

for (const [field, maxCount, itemMax] of [
  ['requirements', 200, 2000],
  ['skillsRequired', 40, 80],
]) {
  const maximum = Array.from({ length: maxCount }, (_, index) => `x${index}`);
  equal(major({ [field]: maximum }).content[field].length, maxCount);
  throws(
    () => major({ [field]: [...maximum, 'extra'] }),
    PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
  );
  equal(
    major({ [field]: ['x'.repeat(itemMax)] }).content[field][0].length,
    itemMax
  );
  throws(
    () => major({ [field]: ['x'.repeat(itemMax + 1)] }),
    PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
  );
  throws(
    () => major({ [field]: null }),
    PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
  );
  deepEqual(major({ [field]: [] }).content[field], []);
}

// Deadline is canonical UTC and checked against the injected native clock.
equal(
  major({ deadline: NOW }, approvedBase(), builderContext()).content.deadline,
  NOW
);
throws(
  () =>
    major(
      { deadline: '2026-07-28T23:59:59.999Z' },
      approvedBase(),
      builderContext()
    ),
  PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
);
for (const invalidDeadline of [
  '2027-01-01',
  '2027-01-01T00:00:00Z',
  '2027-01-01T00:00:00.000+00:00',
  ' 2027-01-01T00:00:00.000Z ',
  new Date(DEADLINE),
  0,
  false,
]) {
  throws(
    () => major({ deadline: invalidDeadline }),
    PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
  );
}
equal(major({ deadline: null }).content.deadline, null);
equal(major({ deadline: '' }).content.deadline, null);
throws(
  () => major({}, approvedBase(), builderContext({ evaluatedAt: NOW })),
  PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID
);

// Approved-base and strict input boundaries.
throws(
  () => major({}, approvedBase({ approvedPublicationVersion: 6 })),
  PUBLICATION_CANDIDATE_ERROR_CODES.BASE_CONFLICT
);
for (const override of [
  { approvedSubmissionId: 'bad' },
  { approvedCandidateHash: 'f'.repeat(63) },
  { approvedPublicationVersion: -1 },
  { approvedPublicationVersion: 1.5 },
  { employerId: JOB_ID },
  { publicationState: 'active' },
  { planType: 'free' },
  { views: 1 },
  { moderationNote: 'private' },
  { sourceUrl: 'https://invalid.example' },
]) {
  throws(
    () => major({}, { ...approvedBase(), ...override }),
    PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID
  );
}
throws(
  () =>
    major({}, approvedBase({ content: { ...content(), status: 'active' } })),
  PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
);

const hostileOuterValues = [
  undefined,
  null,
  true,
  1,
  'x',
  [],
  new Date(),
  /x/u,
  new Map(),
  new Set(),
  Object.create(null),
  new (class Envelope {})(),
];
for (const hostile of hostileOuterValues) {
  throws(
    () => buildMajorEditPublicationCandidate(hostile, builderContext()),
    PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID
  );
}
for (const unknown of [
  'metadata',
  'request',
  'session',
  'headers',
  'cookies',
  'token',
  'password',
  'applicant',
  'payment',
  'moderation',
  'publicationState',
  'employerId',
  'translationStatus',
  'views',
  'source',
  'sourceUrl',
  '$set',
  'title.value',
  'constructor',
  'prototype',
]) {
  throws(
    () => major({ [unknown]: 'x' }),
    PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID
  );
}
let getterReads = 0;
const accessorPatch = {};
Object.defineProperty(accessorPatch, 'title', {
  enumerable: true,
  get() {
    getterReads += 1;
    return 'Unsafe';
  },
});
throws(
  () => major(accessorPatch),
  PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID
);
equal(getterReads, 0);
const hiddenPatch = {};
Object.defineProperty(hiddenPatch, 'title', {
  value: 'Hidden',
  enumerable: false,
});
throws(
  () => major(hiddenPatch),
  PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID
);
const symbolPatch = { [Symbol('title')]: 'unsafe' };
throws(
  () => major(symbolPatch),
  PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID
);
const inheritedPatch = Object.create({ title: 'inherited' });
throws(
  () => major(inheritedPatch),
  PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID
);
const circularPatch = {};
circularPatch.metadata = circularPatch;
throws(
  () => major(circularPatch),
  PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID
);

// Forged destination evidence propagates the accepted C1 error unchanged.
for (const forged of [
  { ...destination(), targetDigest: 'f'.repeat(64) },
  {
    ...externalUrl,
    trustClassification:
      APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.INTERNAL_PLATFORM,
  },
  { ...externalUrl, evidenceSource: 'forged' },
  { ...externalUrl, classifiedByActorType: 'staff' },
  { ...externalUrl, evaluatedAt: 'not-a-time' },
]) {
  throws(
    () => major({ destinationEvidence: forged }),
    'DESTINATION_EVIDENCE_CONFLICT'
  );
}
throws(
  () => major({}, approvedBase(), builderContext({ jobId: OTHER_JOB_ID })),
  'DESTINATION_EVIDENCE_CONFLICT'
);

// Fingerprint binds all audited stable identity/content inputs.
const fingerprintChanges = [
  major({ title: 'Senior Engineer' }),
  major({}, approvedBase({ approvedSubmissionId: '4'.repeat(24) })),
  major({}, approvedBase({ approvedCandidateHash: 'b'.repeat(64) })),
  major(
    {},
    approvedBase({ approvedPublicationVersion: 8 }),
    builderContext({ expectedPublicationVersion: 8 })
  ),
  urlCandidate,
];
for (const changed of fingerprintChanges) {
  ok(changed.candidateHash !== vector.candidateHash);
}
const forgedHash = { ...vector, candidateHash: 'f'.repeat(64) };
throws(
  () => validatePublicationCandidate(forgedHash, validationContext()),
  PUBLICATION_CANDIDATE_ERROR_CODES.FINGERPRINT_CONFLICT
);
throws(
  () =>
    validatePublicationCandidate(vector, {
      jobId: OTHER_JOB_ID,
    }),
  'DESTINATION_EVIDENCE_CONFLICT'
);

// Correction behavior, replay stability, predecessor binding and no-op denial.
const correctionPatch = { educationRequirement: 'Master degree' };
const correction = buildPublicationCandidateCorrection(
  { priorCandidate: vector, patch: correctionPatch },
  builderContext({ expectedPublicationVersion: 8 })
);
equal(correction.candidateKind, 'correction');
equal(correction.candidateRevision, 2);
equal(correction.previousCandidateHash, vector.candidateHash);
equal(correction.baseApprovedSubmissionId, vector.baseApprovedSubmissionId);
equal(correction.baseApprovedCandidateHash, vector.baseApprovedCandidateHash);
equal(correction.basePublicationVersion, vector.basePublicationVersion);
equal(correction.expectedPublicationVersion, 8);
equal(correction.content.educationRequirement, 'Master degree');
equal(vector.content.educationRequirement, 'Bachelor');
const replay = buildPublicationCandidateCorrection(
  { priorCandidate: vector, patch: correctionPatch },
  builderContext({ expectedPublicationVersion: 8 })
);
equal(replay.candidateRevision, correction.candidateRevision);
equal(replay.candidateHash, correction.candidateHash);
deepEqual(replay, correction);
throws(
  () =>
    buildPublicationCandidateCorrection(
      { priorCandidate: vector, patch: {} },
      builderContext({ expectedPublicationVersion: 8 })
    ),
  PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
);
const correctionDestination = buildPublicationCandidateCorrection(
  {
    priorCandidate: vector,
    patch: { destinationEvidence: externalUrl },
  },
  builderContext({ expectedPublicationVersion: 8 })
);
ok(correctionDestination.candidateHash !== correction.candidateHash);
equal(correctionDestination.previousCandidateHash, vector.candidateHash);
const overflowPrior = {
  ...correction,
  candidateRevision: Number.MAX_SAFE_INTEGER,
};
overflowPrior.candidateHash =
  independentlyFingerprintCandidate(overflowPrior).hash;
throws(
  () =>
    buildPublicationCandidateCorrection(
      { priorCandidate: overflowPrior, patch: correctionPatch },
      builderContext({ expectedPublicationVersion: 9 })
    ),
  PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
);

// Comparison classifications and privacy.
const unchanged = comparePublicationCandidates(vector, vector, {
  previousValidationContext: validationContext(),
  nextValidationContext: validationContext(),
});
equal(
  unchanged.classification,
  PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS.UNCHANGED
);
equal(unchanged.candidateEqual, true);
deepEqual(unchanged.changedContentFields, []);
const contentChanged = comparePublicationCandidates(vector, patched, {
  previousValidationContext: validationContext(),
  nextValidationContext: validationContext(),
});
equal(
  contentChanged.classification,
  PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS.CONTENT_CHANGED
);
equal(contentChanged.contentChanged, true);
ok(contentChanged.changedContentFields.includes('title'));
const destinationChanged = comparePublicationCandidates(vector, urlCandidate, {
  previousValidationContext: validationContext(),
  nextValidationContext: validationContext(),
});
equal(
  destinationChanged.classification,
  PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS.DESTINATION_CHANGED
);
equal(destinationChanged.destinationChanged, true);
equal(destinationChanged.requiresRenewedDestinationValidation, true);
equal(destinationChanged.priorDestinationApprovalTransferAllowed, false);
const otherBase = major(
  { title: 'Changed too' },
  approvedBase({ approvedSubmissionId: '4'.repeat(24) })
);
const baseConflict = comparePublicationCandidates(vector, otherBase, {
  previousValidationContext: validationContext(),
  nextValidationContext: validationContext(),
});
equal(
  baseConflict.classification,
  PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS.BASE_CONFLICT
);
equal(baseConflict.baseConflict, true);
deepEqual(Object.keys(baseConflict), [
  'classification',
  'candidateEqual',
  'contentChanged',
  'destinationChanged',
  'baseConflict',
  'requiresRenewedDestinationValidation',
  'priorDestinationApprovalTransferAllowed',
  'changedContentFields',
]);
for (const forbiddenOutput of [
  'title',
  'content',
  'destination',
  'target',
  'domain',
  'candidateHash',
  'baseApprovedSubmissionId',
  'quota',
  'approval',
]) {
  equal(Object.hasOwn(baseConflict, forbiddenOutput), false);
}
throws(
  () =>
    comparePublicationCandidates(vector, forgedHash, {
      previousValidationContext: validationContext(),
      nextValidationContext: validationContext(),
    }),
  PUBLICATION_CANDIDATE_ERROR_CODES.COMPARISON_INVALID
);

// Safe errors contain only canonical values.
const expectedErrors = {
  PUBLICATION_CANDIDATE_INPUT_INVALID:
    'The publication candidate input is invalid.',
  MAJOR_EDIT_BASE_CONFLICT: 'The approved publication base has changed.',
  MAJOR_EDIT_CANDIDATE_INVALID: 'The publication candidate content is invalid.',
  PUBLICATION_CANDIDATE_DESTINATION_INVALID:
    'The publication candidate destination is invalid.',
  PUBLICATION_CANDIDATE_FINGERPRINT_CONFLICT:
    'The publication candidate integrity check failed.',
  PUBLICATION_CANDIDATE_COMPARISON_INVALID:
    'The publication candidates cannot be compared.',
};
for (const code of Object.values(PUBLICATION_CANDIDATE_ERROR_CODES)) {
  const error = new PublicationCandidateContractError(code);
  equal(error.code, code);
  equal(error.message, expectedErrors[code]);
  ok(Object.isFrozen(error));
  const first = error.toJSON();
  const second = error.toJSON();
  deepEqual(Object.keys(first), ['status', 'code', 'message']);
  ok(Object.isFrozen(first));
  ok(first !== second);
  equal(Object.hasOwn(first, 'stack'), false);
  equal(Object.hasOwn(first, 'cause'), false);
}
let coercions = 0;
const hostileCode = {
  toString() {
    coercions += 1;
    return 'MAJOR_EDIT_BASE_CONFLICT';
  },
  [Symbol.toPrimitive]() {
    coercions += 1;
    return 'MAJOR_EDIT_BASE_CONFLICT';
  },
};
const safeUnsupported = new PublicationCandidateContractError(
  hostileCode,
  vector.content.title,
  vector.candidateHash
);
equal(safeUnsupported.code, PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID);
equal(coercions, 0);
const serializedError = JSON.stringify(safeUnsupported);
for (const privateValue of [
  vector.content.title,
  vector.content.description,
  vector.destinationEvidence.targetDigest,
  vector.baseApprovedSubmissionId,
  vector.candidateHash,
]) {
  equal(serializedError.includes(privateValue), false);
}

// Static purity and import isolation.
const here = dirname(fileURLToPath(import.meta.url));
const modulePath = resolve(
  here,
  '../services/publishing/contracts/PublicationCandidateContract.js'
);
const source = readFileSync(modulePath, 'utf8');
for (const requiredImport of [
  "from 'node:crypto'",
  "from './ApplicationDestinationContract.js'",
  "from '../../../utils/htmlSanitize.js'",
]) {
  ok(source.includes(requiredImport));
}
for (const forbiddenSource of [
  'mongoose',
  'mongodb',
  'process.env',
  'fetch(',
  'axios',
  'console.',
  'setTimeout',
  'setInterval',
  'addEventListener',
  'process.on',
  'node:fs',
  '/models/',
  '/controllers/',
  '/routes/',
  'paymentService',
]) {
  equal(source.includes(forbiddenSource), false);
}

console.log(
  `publicationCandidateContract.test.js: ${assertions} assertions passed`
);
