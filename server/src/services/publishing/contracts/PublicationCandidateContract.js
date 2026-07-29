import { createHash } from 'node:crypto';
import { validateApplicationDestinationEvidence } from './ApplicationDestinationContract.js';
import { stripAllHtml } from '../../../utils/htmlSanitize.js';

export const PUBLICATION_CANDIDATE_SCHEMA_VERSION = 1;
export const PUBLICATION_CANDIDATE_POLICY_VERSION = 'free-beta-2026-01';

export const PUBLICATION_CANDIDATE_KINDS = Object.freeze([
  'major_edit',
  'correction',
]);

export const PUBLICATION_CANDIDATE_FIELDS = Object.freeze([
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

export const PUBLICATION_CANDIDATE_CONTENT_FIELDS = Object.freeze([
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

export const PUBLICATION_CANDIDATE_EDITABLE_FIELDS = Object.freeze([
  'title',
  'description',
  'requirements',
  'skillsRequired',
  'salaryRange',
  'location',
  'province',
  'city',
  'category',
  'employmentType',
  'jobType',
  'educationRequirement',
  'experience',
  'deadline',
  'destinationEvidence',
]);

export const PUBLICATION_CANDIDATE_FIELD_CLASSIFICATIONS = Object.freeze({
  EMPLOYER_EDITABLE_CONTENT: Object.freeze([
    'title',
    'description',
    'requirements',
    'skillsRequired',
    'salaryRange',
    'location',
    'province',
    'city',
    'category',
    'employmentType',
    'jobType',
    'educationRequirement',
    'experience',
    'deadline',
  ]),
  EMPLOYER_EDITABLE_DESTINATION: Object.freeze(['destinationEvidence']),
  COPY_FROM_APPROVED_BASE_ONLY: Object.freeze([
    'companyName',
    'organizationName',
    'responsibilities',
    'benefits',
    'salaryCurrency',
    'gender',
    'totalSeats',
    'autoCloseWhenFilled',
    'applicationInstructions',
    'logoUrl',
    'gallery',
  ]),
  SERVER_DERIVED_CANDIDATE_METADATA: Object.freeze([
    'schemaVersion',
    'policyVersion',
    'candidateKind',
    'candidateRevision',
    'baseApprovedSubmissionId',
    'baseApprovedCandidateHash',
    'basePublicationVersion',
    'expectedPublicationVersion',
    'previousCandidateHash',
    'candidateHash',
    'workMode',
  ]),
  ADMIN_CONTROLLED: Object.freeze([
    'isFeatured',
    'isSponsored',
    'priority',
    'urgent',
    'boostLevel',
    'seoTitle',
    'metaDescription',
  ]),
  CANONICAL_PUBLICATION_STATE: Object.freeze([
    'publicationState',
    'publicationVersion',
    'currentSubmissionId',
    'lastApprovedSubmissionId',
    'publishedAt',
    'visibleUntil',
    'applicationsCloseAt',
    'closedAt',
    'expiredAt',
    'rejectionSummary',
    'slugFrozenAt',
    'publicationUpdatedAt',
    'publicationMigrationStatus',
  ]),
  PAYMENT_CONTROLLED: Object.freeze([
    'planId',
    'planType',
    'expiresAt',
    'paidUntil',
  ]),
  ANALYTICS_ONLY: Object.freeze(['views', 'applicationsCount']),
  LEGACY_ONLY: Object.freeze(['status', 'approvalStatus']),
  FORBIDDEN: Object.freeze([
    '_id',
    'employerId',
    'postedBy',
    'source',
    'scrapedAt',
    'sourceUrl',
    'sourceWebsite',
    'externalId',
  ]),
  OUTSIDE_CANDIDATE: Object.freeze([
    'slug',
    'locale',
    'translationGroupId',
    'translationOf',
    'translationStatus',
    'createdAt',
    'updatedAt',
    'applyType',
    'applicationLink',
    'applyEmail',
    'remote',
    'hybrid',
  ]),
});

export const PUBLICATION_CANDIDATE_BOUNDS = Object.freeze({
  title: Object.freeze({ min: 1, max: 200 }),
  companyName: Object.freeze({ min: 1, max: 300 }),
  organizationName: Object.freeze({ min: 1, max: 300 }),
  description: Object.freeze({ min: 20, max: 20000 }),
  requirements: Object.freeze({ maxCount: 200, itemMin: 1, itemMax: 2000 }),
  responsibilities: Object.freeze({
    maxCount: 200,
    itemMin: 1,
    itemMax: 2000,
  }),
  benefits: Object.freeze({ maxCount: 200, itemMin: 1, itemMax: 2000 }),
  skillsRequired: Object.freeze({
    maxCount: 40,
    itemMin: 1,
    itemMax: 80,
  }),
  salaryRange: Object.freeze({ min: 1, max: 120 }),
  salaryCurrency: Object.freeze({ min: 1, max: 10 }),
  location: Object.freeze({ min: 1, max: 200 }),
  province: Object.freeze({ min: 1, max: 120 }),
  city: Object.freeze({ min: 1, max: 120 }),
  category: Object.freeze({ min: 1, max: 120 }),
  educationRequirement: Object.freeze({ min: 1, max: 1000 }),
  experience: Object.freeze({ min: 1, max: 500 }),
  gender: Object.freeze({ min: 1, max: 120 }),
  totalSeats: Object.freeze({ min: 1, max: Number.MAX_SAFE_INTEGER }),
  applicationInstructions: Object.freeze({ min: 1, max: 10000 }),
  logoUrl: Object.freeze({ min: 1, max: 2048 }),
  gallery: Object.freeze({ maxCount: 200, itemMin: 1, itemMax: 2048 }),
});

export const PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS = Object.freeze({
  UNCHANGED: 'UNCHANGED',
  CONTENT_CHANGED: 'CONTENT_CHANGED',
  DESTINATION_CHANGED: 'DESTINATION_CHANGED',
  BASE_CONFLICT: 'BASE_CONFLICT',
});

export const PUBLICATION_CANDIDATE_ERROR_CODES = Object.freeze({
  INPUT_INVALID: 'PUBLICATION_CANDIDATE_INPUT_INVALID',
  BASE_CONFLICT: 'MAJOR_EDIT_BASE_CONFLICT',
  CANDIDATE_INVALID: 'MAJOR_EDIT_CANDIDATE_INVALID',
  DESTINATION_INVALID: 'PUBLICATION_CANDIDATE_DESTINATION_INVALID',
  FINGERPRINT_CONFLICT: 'PUBLICATION_CANDIDATE_FINGERPRINT_CONFLICT',
  COMPARISON_INVALID: 'PUBLICATION_CANDIDATE_COMPARISON_INVALID',
});

const ERROR_DEFINITIONS = Object.freeze({
  [PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID]: Object.freeze({
    status: 400,
    message: 'The publication candidate input is invalid.',
  }),
  [PUBLICATION_CANDIDATE_ERROR_CODES.BASE_CONFLICT]: Object.freeze({
    status: 409,
    message: 'The approved publication base has changed.',
  }),
  [PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID]: Object.freeze({
    status: 422,
    message: 'The publication candidate content is invalid.',
  }),
  [PUBLICATION_CANDIDATE_ERROR_CODES.DESTINATION_INVALID]: Object.freeze({
    status: 422,
    message: 'The publication candidate destination is invalid.',
  }),
  [PUBLICATION_CANDIDATE_ERROR_CODES.FINGERPRINT_CONFLICT]: Object.freeze({
    status: 409,
    message: 'The publication candidate integrity check failed.',
  }),
  [PUBLICATION_CANDIDATE_ERROR_CODES.COMPARISON_INVALID]: Object.freeze({
    status: 422,
    message: 'The publication candidates cannot be compared.',
  }),
});

const APPROVED_BASE_FIELDS = Object.freeze([
  'approvedSubmissionId',
  'approvedPublicationVersion',
  'approvedCandidateHash',
  'content',
  'destinationEvidence',
]);
const BUILDER_INPUT_FIELDS = Object.freeze(['approvedBase', 'patch']);
const CORRECTION_INPUT_FIELDS = Object.freeze(['priorCandidate', 'patch']);
const BUILDER_CONTEXT_FIELDS = Object.freeze([
  'jobId',
  'expectedPublicationVersion',
  'evaluatedAt',
]);
const VALIDATION_CONTEXT_FIELDS = Object.freeze(['jobId']);
const COMPARISON_CONTEXT_FIELDS = Object.freeze([
  'previousValidationContext',
  'nextValidationContext',
]);
const DESTINATION_FIELDS = Object.freeze([
  'schemaVersion',
  'mode',
  'normalizedTarget',
  'targetDigest',
  'normalizedDomain',
  'trustClassification',
  'evidenceSource',
  'evaluatedAt',
  'validationPolicyVersion',
  'classifiedByActorType',
  'classifiedByActorId',
]);
const EMPLOYMENT_TYPES = Object.freeze([
  'full-time',
  'part-time',
  'contract',
  'internship',
]);
const JOB_TYPES = Object.freeze(['Government', 'Private', 'Internship']);
const WORK_MODES = Object.freeze(['on_site', 'remote', 'hybrid']);
const ARRAY_FIELDS = Object.freeze([
  'requirements',
  'responsibilities',
  'benefits',
  'skillsRequired',
  'gallery',
]);
const MULTILINE_FIELDS = Object.freeze(
  new Set(['description', 'applicationInstructions'])
);
const REQUIRED_TEXT_FIELDS = Object.freeze(
  new Set(['title', 'companyName', 'description', 'salaryCurrency'])
);
const NULLABLE_TEXT_FIELDS = Object.freeze(
  new Set([
    'organizationName',
    'salaryRange',
    'location',
    'province',
    'city',
    'category',
    'educationRequirement',
    'experience',
    'gender',
    'applicationInstructions',
    'logoUrl',
  ])
);
const EDITABLE_NULLABLE_TEXT_FIELDS = Object.freeze(
  new Set([
    'salaryRange',
    'location',
    'province',
    'city',
    'category',
    'educationRequirement',
    'experience',
  ])
);
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/u;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const CANONICAL_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const FORBIDDEN_KEY_PATTERN = /^(?:__proto__|prototype|constructor)$/u;
const FINGERPRINT_PREFIX = Buffer.from(
  'strideto.publication_candidate\0v1\0',
  'ascii'
);

function candidateError(code) {
  return new PublicationCandidateContractError(code);
}

export class PublicationCandidateContractError extends Error {
  constructor(code) {
    const canonicalCode =
      typeof code === 'string' && Object.hasOwn(ERROR_DEFINITIONS, code)
        ? code
        : PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID;
    const definition = ERROR_DEFINITIONS[canonicalCode];
    super(definition.message);
    this.name = 'PublicationCandidateContractError';
    this.status = definition.status;
    this.code = canonicalCode;
    Object.freeze(this);
  }

  toJSON() {
    return Object.freeze({
      status: this.status,
      code: this.code,
      message: this.message,
    });
  }
}

function assertStrictRecord(value, fields, code) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw candidateError(code);
  }

  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length) {
    throw candidateError(code);
  }

  for (const key of keys) {
    if (
      typeof key !== 'string' ||
      FORBIDDEN_KEY_PATTERN.test(key) ||
      key.includes('.') ||
      key.startsWith('$') ||
      !fields.includes(key)
    ) {
      throw candidateError(code);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      descriptor.enumerable !== true ||
      !Object.hasOwn(descriptor, 'value')
    ) {
      throw candidateError(code);
    }
  }

  for (const field of fields) {
    if (!Object.hasOwn(value, field)) {
      throw candidateError(code);
    }
  }
  return value;
}

function assertSparseStrictRecord(value, fields, code) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw candidateError(code);
  }

  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key !== 'string' ||
      FORBIDDEN_KEY_PATTERN.test(key) ||
      key.includes('.') ||
      key.startsWith('$') ||
      !fields.includes(key)
    ) {
      throw candidateError(code);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      descriptor.enumerable !== true ||
      !Object.hasOwn(descriptor, 'value') ||
      descriptor.value === undefined
    ) {
      throw candidateError(code);
    }
  }
  return value;
}

function safeInteger(value, { min = 0 } = {}) {
  return (
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

function canonicalIdentifier(value, code) {
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    throw candidateError(code);
  }
  return value;
}

function canonicalHash(value, code) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw candidateError(code);
  }
  return value;
}

function assertNativeDate(value, code) {
  if (
    Object.prototype.toString.call(value) !== '[object Date]' ||
    Object.getPrototypeOf(value) !== Date.prototype
  ) {
    throw candidateError(code);
  }
  let timestamp;
  try {
    timestamp = Date.prototype.getTime.call(value);
  } catch {
    throw candidateError(code);
  }
  if (!Number.isFinite(timestamp)) {
    throw candidateError(code);
  }
  return timestamp;
}

function assertCanonicalTimestamp(value, code) {
  if (
    typeof value !== 'string' ||
    value.length !== 24 ||
    !CANONICAL_TIMESTAMP_PATTERN.test(value)
  ) {
    throw candidateError(code);
  }
  const timestamp = Date.parse(value);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== value
  ) {
    throw candidateError(code);
  }
  return value;
}

function hasForbiddenControlCharacter(value) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint <= 8 ||
      codePoint === 11 ||
      codePoint === 12 ||
      (codePoint >= 14 && codePoint <= 31) ||
      codePoint === 127
    );
  });
}

function normalizeText(value, field, { nullable = false } = {}) {
  const code = PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID;
  if (value === null && nullable) return null;
  if (typeof value !== 'string') throw candidateError(code);

  const withoutHtml = stripAllHtml(value);
  const normalized = withoutHtml
    .normalize('NFC')
    .replace(/\r\n?/gu, '\n')
    .trim();
  if (
    hasForbiddenControlCharacter(normalized) ||
    (!MULTILINE_FIELDS.has(field) && /[\t\n]/u.test(normalized))
  ) {
    throw candidateError(code);
  }

  const bounds = PUBLICATION_CANDIDATE_BOUNDS[field];
  if (
    !bounds ||
    normalized.length < bounds.min ||
    normalized.length > bounds.max
  ) {
    throw candidateError(code);
  }
  return normalized;
}

function normalizeStringArray(value, field) {
  const code = PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID;
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    throw candidateError(code);
  }
  const bounds = PUBLICATION_CANDIDATE_BOUNDS[field];
  if (value.length > bounds.maxCount) throw candidateError(code);

  const result = [];
  for (const item of value) {
    if (typeof item !== 'string') throw candidateError(code);
    const normalized = stripAllHtml(item)
      .normalize('NFC')
      .replace(/\r\n?/gu, '\n')
      .trim();
    if (
      hasForbiddenControlCharacter(normalized) ||
      /[\t\n]/u.test(normalized) ||
      normalized.length < bounds.itemMin ||
      normalized.length > bounds.itemMax
    ) {
      throw candidateError(code);
    }
    result.push(normalized);
  }
  return Object.freeze(result);
}

function normalizeContent(content, { requireCanonical = false } = {}) {
  const code = PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID;
  assertStrictRecord(content, PUBLICATION_CANDIDATE_CONTENT_FIELDS, code);
  const normalized = {};

  for (const field of PUBLICATION_CANDIDATE_CONTENT_FIELDS) {
    const value = content[field];
    if (ARRAY_FIELDS.includes(field)) {
      normalized[field] = normalizeStringArray(value, field);
    } else if (REQUIRED_TEXT_FIELDS.has(field)) {
      normalized[field] = normalizeText(value, field);
    } else if (NULLABLE_TEXT_FIELDS.has(field)) {
      normalized[field] = normalizeText(value, field, { nullable: true });
    } else if (field === 'employmentType') {
      if (!EMPLOYMENT_TYPES.includes(value)) throw candidateError(code);
      normalized[field] = value;
    } else if (field === 'jobType') {
      if (!JOB_TYPES.includes(value)) throw candidateError(code);
      normalized[field] = value;
    } else if (field === 'workMode') {
      if (!WORK_MODES.includes(value)) throw candidateError(code);
      normalized[field] = value;
    } else if (field === 'deadline') {
      normalized[field] =
        value === null ? null : assertCanonicalTimestamp(value, code);
    } else if (field === 'totalSeats') {
      if (
        value !== null &&
        !safeInteger(value, {
          min: PUBLICATION_CANDIDATE_BOUNDS.totalSeats.min,
        })
      ) {
        throw candidateError(code);
      }
      normalized[field] = value;
    } else if (field === 'autoCloseWhenFilled') {
      if (typeof value !== 'boolean') throw candidateError(code);
      normalized[field] = value;
    } else {
      throw candidateError(code);
    }
  }

  if (
    requireCanonical &&
    !PUBLICATION_CANDIDATE_CONTENT_FIELDS.every((field) =>
      valuesEqual(content[field], normalized[field])
    )
  ) {
    throw candidateError(code);
  }

  return Object.freeze(normalized);
}

function validateDeadlineAgainstClock(deadline, evaluatedAtTimestamp) {
  if (deadline !== null && Date.parse(deadline) < evaluatedAtTimestamp) {
    throw candidateError(PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID);
  }
}

function cloneDestinationEvidence(evidence, jobId) {
  if (
    evidence === null ||
    typeof evidence !== 'object' ||
    Array.isArray(evidence)
  ) {
    throw candidateError(PUBLICATION_CANDIDATE_ERROR_CODES.DESTINATION_INVALID);
  }
  validateApplicationDestinationEvidence(evidence, { jobId });
  const clone = {};
  for (const field of DESTINATION_FIELDS) {
    clone[field] = evidence[field];
  }
  return Object.freeze(clone);
}

function validateBuilderContext(context) {
  const code = PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID;
  assertStrictRecord(context, BUILDER_CONTEXT_FIELDS, code);
  const jobId = canonicalIdentifier(context.jobId, code);
  if (!safeInteger(context.expectedPublicationVersion)) {
    throw candidateError(code);
  }
  const evaluatedAtTimestamp = assertNativeDate(context.evaluatedAt, code);
  return Object.freeze({
    jobId,
    expectedPublicationVersion: context.expectedPublicationVersion,
    evaluatedAtTimestamp,
  });
}

function validateValidationContext(context) {
  const code = PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID;
  assertStrictRecord(context, VALIDATION_CONTEXT_FIELDS, code);
  return Object.freeze({ jobId: canonicalIdentifier(context.jobId, code) });
}

function validateApprovedBase(approvedBase, context) {
  const code = PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID;
  assertStrictRecord(approvedBase, APPROVED_BASE_FIELDS, code);
  const approvedSubmissionId = canonicalIdentifier(
    approvedBase.approvedSubmissionId,
    code
  );
  if (!safeInteger(approvedBase.approvedPublicationVersion)) {
    throw candidateError(code);
  }
  const approvedCandidateHash = canonicalHash(
    approvedBase.approvedCandidateHash,
    code
  );
  if (
    approvedBase.approvedPublicationVersion !==
    context.expectedPublicationVersion
  ) {
    throw candidateError(PUBLICATION_CANDIDATE_ERROR_CODES.BASE_CONFLICT);
  }
  const content = normalizeContent(approvedBase.content, {
    requireCanonical: true,
  });
  const destinationEvidence = cloneDestinationEvidence(
    approvedBase.destinationEvidence,
    context.jobId
  );
  return Object.freeze({
    approvedSubmissionId,
    approvedPublicationVersion: approvedBase.approvedPublicationVersion,
    approvedCandidateHash,
    content,
    destinationEvidence,
  });
}

function applyPatch(baseContent, baseDestination, patch, context) {
  const code = PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID;
  assertSparseStrictRecord(patch, PUBLICATION_CANDIDATE_EDITABLE_FIELDS, code);
  const next = {};

  for (const field of PUBLICATION_CANDIDATE_CONTENT_FIELDS) {
    if (!Object.hasOwn(patch, field)) {
      next[field] = baseContent[field];
      continue;
    }
    const value = patch[field];
    if (field === 'requirements' || field === 'skillsRequired') {
      next[field] = normalizeStringArray(value, field);
    } else if (field === 'title' || field === 'description') {
      next[field] = normalizeText(value, field);
    } else if (EDITABLE_NULLABLE_TEXT_FIELDS.has(field)) {
      next[field] =
        value === null ||
        (typeof value === 'string' && value.trim().length === 0)
          ? null
          : normalizeText(value, field);
    } else if (field === 'employmentType') {
      if (!EMPLOYMENT_TYPES.includes(value)) {
        throw candidateError(
          PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
        );
      }
      next[field] = value;
    } else if (field === 'jobType') {
      if (!JOB_TYPES.includes(value)) {
        throw candidateError(
          PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
        );
      }
      next[field] = value;
    } else if (field === 'deadline') {
      next[field] =
        value === null ||
        (typeof value === 'string' && value.trim().length === 0)
          ? null
          : assertCanonicalTimestamp(
              value,
              PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
            );
    } else {
      throw candidateError(PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID);
    }
  }

  const destinationEvidence = Object.hasOwn(patch, 'destinationEvidence')
    ? cloneDestinationEvidence(patch.destinationEvidence, context.jobId)
    : cloneDestinationEvidence(baseDestination, context.jobId);
  const content = normalizeContent(next, { requireCanonical: true });
  validateDeadlineAgainstClock(content.deadline, context.evaluatedAtTimestamp);
  return Object.freeze({ content, destinationEvidence });
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
}

function framed(tag, bytes) {
  return Buffer.concat([Buffer.from([tag]), u32(bytes.length), bytes]);
}

function encodeValue(value) {
  if (value === null) return Buffer.from([0x4e]);
  if (typeof value === 'string') {
    return framed(0x53, Buffer.from(value, 'utf8'));
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return framed(0x49, Buffer.from(String(value), 'ascii'));
  }
  if (typeof value === 'boolean') {
    return Buffer.from([0x42, value ? 0x01 : 0x00]);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([
      Buffer.from([0x41]),
      u32(value.length),
      ...value.map(encodeValue),
    ]);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    return Buffer.concat([
      Buffer.from([0x52]),
      u32(entries.length),
      ...entries.flatMap(([name, fieldValue]) => {
        const nameBytes = Buffer.from(name, 'utf8');
        return [
          Buffer.from([0x46]),
          u32(nameBytes.length),
          nameBytes,
          encodeValue(fieldValue),
        ];
      }),
    ]);
  }
  throw candidateError(PUBLICATION_CANDIDATE_ERROR_CODES.FINGERPRINT_CONFLICT);
}

function fingerprintDescriptor(candidate) {
  const content = {};
  for (const field of PUBLICATION_CANDIDATE_CONTENT_FIELDS) {
    content[field] = candidate.content[field];
  }
  return {
    schemaVersion: candidate.schemaVersion,
    policyVersion: candidate.policyVersion,
    candidateKind: candidate.candidateKind,
    candidateRevision: candidate.candidateRevision,
    baseApprovedSubmissionId: candidate.baseApprovedSubmissionId,
    baseApprovedCandidateHash: candidate.baseApprovedCandidateHash,
    basePublicationVersion: candidate.basePublicationVersion,
    expectedPublicationVersion: candidate.expectedPublicationVersion,
    previousCandidateHash: candidate.previousCandidateHash,
    content,
    destinationIdentity: {
      mode: candidate.destinationEvidence.mode,
      targetDigest: candidate.destinationEvidence.targetDigest,
    },
  };
}

function computeCandidateHash(candidate) {
  return createHash('sha256')
    .update(
      Buffer.concat([
        FINGERPRINT_PREFIX,
        encodeValue(fingerprintDescriptor(candidate)),
      ])
    )
    .digest('hex');
}

function createCandidate({
  candidateKind,
  candidateRevision,
  baseApprovedSubmissionId,
  baseApprovedCandidateHash,
  basePublicationVersion,
  expectedPublicationVersion,
  previousCandidateHash,
  content,
  destinationEvidence,
}) {
  const withoutHash = {
    schemaVersion: PUBLICATION_CANDIDATE_SCHEMA_VERSION,
    policyVersion: PUBLICATION_CANDIDATE_POLICY_VERSION,
    candidateKind,
    candidateRevision,
    baseApprovedSubmissionId,
    baseApprovedCandidateHash,
    basePublicationVersion,
    expectedPublicationVersion,
    previousCandidateHash,
    content,
    destinationEvidence,
  };
  const candidateHash = computeCandidateHash(withoutHash);
  return Object.freeze({ ...withoutHash, candidateHash });
}

function validateCandidateShape(candidate, jobId, errorCode) {
  assertStrictRecord(candidate, PUBLICATION_CANDIDATE_FIELDS, errorCode);
  if (
    candidate.schemaVersion !== PUBLICATION_CANDIDATE_SCHEMA_VERSION ||
    candidate.policyVersion !== PUBLICATION_CANDIDATE_POLICY_VERSION ||
    !PUBLICATION_CANDIDATE_KINDS.includes(candidate.candidateKind) ||
    !safeInteger(candidate.candidateRevision, { min: 1 }) ||
    !safeInteger(candidate.basePublicationVersion) ||
    !safeInteger(candidate.expectedPublicationVersion)
  ) {
    throw candidateError(errorCode);
  }
  canonicalIdentifier(candidate.baseApprovedSubmissionId, errorCode);
  canonicalHash(candidate.baseApprovedCandidateHash, errorCode);
  canonicalHash(candidate.candidateHash, errorCode);

  if (candidate.candidateKind === 'major_edit') {
    if (
      candidate.candidateRevision !== 1 ||
      candidate.previousCandidateHash !== null ||
      candidate.basePublicationVersion !== candidate.expectedPublicationVersion
    ) {
      throw candidateError(errorCode);
    }
  } else if (
    candidate.candidateRevision < 2 ||
    typeof candidate.previousCandidateHash !== 'string' ||
    !HASH_PATTERN.test(candidate.previousCandidateHash)
  ) {
    throw candidateError(errorCode);
  }

  const content = normalizeContent(candidate.content, {
    requireCanonical: true,
  });
  const destinationEvidence = cloneDestinationEvidence(
    candidate.destinationEvidence,
    jobId
  );
  const clone = {
    schemaVersion: candidate.schemaVersion,
    policyVersion: candidate.policyVersion,
    candidateKind: candidate.candidateKind,
    candidateRevision: candidate.candidateRevision,
    baseApprovedSubmissionId: candidate.baseApprovedSubmissionId,
    baseApprovedCandidateHash: candidate.baseApprovedCandidateHash,
    basePublicationVersion: candidate.basePublicationVersion,
    expectedPublicationVersion: candidate.expectedPublicationVersion,
    previousCandidateHash: candidate.previousCandidateHash,
    content,
    destinationEvidence,
    candidateHash: candidate.candidateHash,
  };
  if (computeCandidateHash(clone) !== candidate.candidateHash) {
    throw candidateError(
      PUBLICATION_CANDIDATE_ERROR_CODES.FINGERPRINT_CONFLICT
    );
  }
  return Object.freeze(clone);
}

function valuesEqual(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }
  return false;
}

export function buildMajorEditPublicationCandidate(input, serverContext) {
  const code = PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID;
  assertStrictRecord(input, BUILDER_INPUT_FIELDS, code);
  const context = validateBuilderContext(serverContext);
  const approvedBase = validateApprovedBase(input.approvedBase, context);
  const patched = applyPatch(
    approvedBase.content,
    approvedBase.destinationEvidence,
    input.patch,
    context
  );
  return createCandidate({
    candidateKind: 'major_edit',
    candidateRevision: 1,
    baseApprovedSubmissionId: approvedBase.approvedSubmissionId,
    baseApprovedCandidateHash: approvedBase.approvedCandidateHash,
    basePublicationVersion: approvedBase.approvedPublicationVersion,
    expectedPublicationVersion: context.expectedPublicationVersion,
    previousCandidateHash: null,
    content: patched.content,
    destinationEvidence: patched.destinationEvidence,
  });
}

export function buildPublicationCandidateCorrection(input, serverContext) {
  const code = PUBLICATION_CANDIDATE_ERROR_CODES.INPUT_INVALID;
  assertStrictRecord(input, CORRECTION_INPUT_FIELDS, code);
  const context = validateBuilderContext(serverContext);
  const prior = validateCandidateShape(
    input.priorCandidate,
    context.jobId,
    PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
  );
  if (prior.candidateRevision === Number.MAX_SAFE_INTEGER) {
    throw candidateError(PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID);
  }
  const patched = applyPatch(
    prior.content,
    prior.destinationEvidence,
    input.patch,
    context
  );
  const changedContent = PUBLICATION_CANDIDATE_CONTENT_FIELDS.some(
    (field) => !valuesEqual(prior.content[field], patched.content[field])
  );
  const changedDestination =
    prior.destinationEvidence.mode !== patched.destinationEvidence.mode ||
    prior.destinationEvidence.targetDigest !==
      patched.destinationEvidence.targetDigest;
  if (!changedContent && !changedDestination) {
    throw candidateError(PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID);
  }
  return createCandidate({
    candidateKind: 'correction',
    candidateRevision: prior.candidateRevision + 1,
    baseApprovedSubmissionId: prior.baseApprovedSubmissionId,
    baseApprovedCandidateHash: prior.baseApprovedCandidateHash,
    basePublicationVersion: prior.basePublicationVersion,
    expectedPublicationVersion: context.expectedPublicationVersion,
    previousCandidateHash: prior.candidateHash,
    content: patched.content,
    destinationEvidence: patched.destinationEvidence,
  });
}

export function validatePublicationCandidate(candidate, validationContext) {
  const context = validateValidationContext(validationContext);
  return validateCandidateShape(
    candidate,
    context.jobId,
    PUBLICATION_CANDIDATE_ERROR_CODES.CANDIDATE_INVALID
  );
}

export function comparePublicationCandidates(
  previousCandidate,
  nextCandidate,
  validationContexts
) {
  const code = PUBLICATION_CANDIDATE_ERROR_CODES.COMPARISON_INVALID;
  assertStrictRecord(validationContexts, COMPARISON_CONTEXT_FIELDS, code);
  let previous;
  let next;
  try {
    previous = validatePublicationCandidate(
      previousCandidate,
      validationContexts.previousValidationContext
    );
    next = validatePublicationCandidate(
      nextCandidate,
      validationContexts.nextValidationContext
    );
  } catch (error) {
    if (
      error?.code === 'DESTINATION_MODE_INVALID' ||
      error?.code === 'DESTINATION_OWNERSHIP_UNVERIFIED' ||
      error?.code === 'DESTINATION_EVIDENCE_CONFLICT' ||
      error?.code === 'DESTINATION_CHANGED_BEYOND_CORRECTION_SCOPE'
    ) {
      throw error;
    }
    throw candidateError(code);
  }

  const baseConflict =
    previous.baseApprovedSubmissionId !== next.baseApprovedSubmissionId ||
    previous.baseApprovedCandidateHash !== next.baseApprovedCandidateHash ||
    previous.basePublicationVersion !== next.basePublicationVersion ||
    previous.expectedPublicationVersion !== next.expectedPublicationVersion;
  const destinationChanged =
    previous.destinationEvidence.mode !== next.destinationEvidence.mode ||
    previous.destinationEvidence.targetDigest !==
      next.destinationEvidence.targetDigest;
  const changedContentFields = PUBLICATION_CANDIDATE_CONTENT_FIELDS.filter(
    (field) => !valuesEqual(previous.content[field], next.content[field])
  );
  const contentChanged = changedContentFields.length > 0;

  let classification =
    PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS.UNCHANGED;
  if (baseConflict) {
    classification =
      PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS.BASE_CONFLICT;
  } else if (destinationChanged) {
    classification =
      PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS.DESTINATION_CHANGED;
  } else if (contentChanged) {
    classification =
      PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS.CONTENT_CHANGED;
  }

  return Object.freeze({
    classification,
    candidateEqual: !baseConflict && !destinationChanged && !contentChanged,
    contentChanged,
    destinationChanged,
    baseConflict,
    requiresRenewedDestinationValidation: destinationChanged,
    priorDestinationApprovalTransferAllowed:
      !baseConflict && !destinationChanged,
    changedContentFields: Object.freeze(changedContentFields),
  });
}
