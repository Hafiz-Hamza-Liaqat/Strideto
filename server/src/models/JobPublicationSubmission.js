import mongoose from 'mongoose';
import {
  FREE_BETA_POLICY_VERSION,
  PUBLISHING_POLICY_CODES,
  PUBLICATION_SUBMISSION_KINDS,
  PUBLICATION_SUBMISSION_STATES,
  QUOTA_EXEMPTION_REASONS,
  QUOTA_OWNER_TYPES,
} from '../config/freeBetaPublishingPolicy.js';

const { ObjectId } = mongoose.Schema.Types;

function safeText(maxlength) {
  return { type: String, trim: true, maxlength };
}

function rejectUnknownSnapshotKeys(field, allowedShape) {
  function inspect(value, shape, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return;
    }

    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(shape, key)) {
        throw new TypeError(`${path}.${key} is not an allowed snapshot field`);
      }
      if (shape[key] && typeof shape[key] === 'object') {
        inspect(value[key], shape[key], `${path}.${key}`);
      }
    }
  }

  return function enforceSnapshotShape(value) {
    inspect(value, allowedShape, field);
    return value;
  };
}

const CONTENT_SNAPSHOT_SHAPE = Object.freeze({
  contentHash: true,
  title: true,
  companyName: true,
  description: true,
  requirements: true,
  responsibilities: true,
  skillsRequired: true,
  salaryRange: true,
  salaryCurrency: true,
  location: true,
  province: true,
  city: true,
  category: true,
  employmentType: true,
  jobType: true,
  educationRequirement: true,
  experience: true,
  applicationMode: true,
  applicationDomain: true,
  workMode: true,
  deadline: true,
  totalSeats: true,
});

const VERIFICATION_SNAPSHOT_SHAPE = Object.freeze({
  verified: true,
  verificationLevel: true,
  accountStatus: true,
  normalizedCompanyName: true,
  emailPresent: true,
  emailValid: true,
  emailDomain: true,
  websiteDomain: true,
  requiredProfileChecks: true,
  predicateCapabilityVersion: true,
  eligibilityResultCodes: true,
});

const ROLLING_USAGE_SHAPE = Object.freeze({
  used: true,
  limit: true,
  remaining: true,
  nextEligibleAt: true,
  nextSlotAt: true,
});

const ACTIVE_FREE_USAGE_SHAPE = Object.freeze({
  planCode: true,
  used: true,
  limit: true,
  remaining: true,
  hasCapacity: true,
});

const QUOTA_USAGE_SHAPE = Object.freeze({
  daily: ROLLING_USAGE_SHAPE,
  rolling30Days: ROLLING_USAGE_SHAPE,
  activeFreeJobs: ACTIVE_FREE_USAGE_SHAPE,
});

const QUOTA_SNAPSHOT_SHAPE = Object.freeze({
  policyCode: true,
  policyVersion: true,
  capturedAt: true,
  before: QUOTA_USAGE_SHAPE,
  after: QUOTA_USAGE_SHAPE,
});

const MODERATION_SUMMARY_SHAPE = Object.freeze({
  action: true,
  reasonCode: true,
  ownerMessage: true,
  eventId: true,
  decidedAt: true,
});

const C4_UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const C4_OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/;
const C4_HASH_PATTERN = /^[a-f0-9]{64}$/;
const C4_DOMAIN_PATTERN =
  /^(?!.*[@/:])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const C4_CANONICAL_ISO_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const C4_UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const C4_CANDIDATE_CONTENT_FIELDS = Object.freeze([
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

const C4_DESTINATION_EVIDENCE_FIELDS = Object.freeze([
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

const C4_PUBLICATION_CANDIDATE_FIELDS = Object.freeze([
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

const C4_OUTBOX_KEY_FIELDS = Object.freeze([
  'employerSubmissionReceived',
  'adminJobReviewRequested',
]);

const C4_OPERATION_EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion',
  'operationId',
  'operationKind',
  'moderationEventId',
  'newModerationCycleId',
  'expectedPublicationVersion',
  'expectedPublicationState',
  'outboxDeduplicationKeys',
  'initiatedAt',
  'expectedCommittedPublicationVersion',
  'expectedCommittedPublicationState',
  'expectedCurrentSubmissionId',
  'rulesVersion',
  'rulesDigest',
]);

const C4_CANDIDATE_CONTENT_SHAPE = Object.freeze(
  Object.fromEntries(C4_CANDIDATE_CONTENT_FIELDS.map((field) => [field, true]))
);
const C4_DESTINATION_EVIDENCE_SHAPE = Object.freeze(
  Object.fromEntries(
    C4_DESTINATION_EVIDENCE_FIELDS.map((field) => [field, true])
  )
);
const C4_PUBLICATION_CANDIDATE_SHAPE = Object.freeze({
  ...Object.fromEntries(
    C4_PUBLICATION_CANDIDATE_FIELDS.map((field) => [field, true])
  ),
  content: C4_CANDIDATE_CONTENT_SHAPE,
  destinationEvidence: C4_DESTINATION_EVIDENCE_SHAPE,
});
const C4_OPERATION_EVIDENCE_SHAPE = Object.freeze({
  ...Object.fromEntries(
    C4_OPERATION_EVIDENCE_FIELDS.map((field) => [field, true])
  ),
  outboxDeduplicationKeys: Object.freeze(
    Object.fromEntries(C4_OUTBOX_KEY_FIELDS.map((field) => [field, true]))
  ),
});

const C4_STRING_ARRAY_FIELDS = new Set([
  'requirements',
  'responsibilities',
  'benefits',
  'skillsRequired',
  'gallery',
]);

function rejectUnsafeEvidence(category, value, shape) {
  function inspect(candidate, expectedShape, fieldName) {
    if (
      candidate === null ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate) ||
      Object.getPrototypeOf(candidate) !== Object.prototype
    ) {
      throw new TypeError(`${category} contains invalid evidence`);
    }

    for (const key of Reflect.ownKeys(candidate)) {
      const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
      if (
        typeof key !== 'string' ||
        C4_UNSAFE_KEYS.has(key) ||
        key.includes('.') ||
        key.startsWith('$') ||
        !Object.hasOwn(expectedShape, key) ||
        !descriptor?.enumerable ||
        !Object.hasOwn(descriptor, 'value')
      ) {
        throw new TypeError(`${category} contains unsupported evidence`);
      }

      const nestedShape = expectedShape[key];
      if (nestedShape && typeof nestedShape === 'object') {
        inspect(descriptor.value, nestedShape, key);
      } else if (
        C4_STRING_ARRAY_FIELDS.has(fieldName || key) ||
        C4_STRING_ARRAY_FIELDS.has(key)
      ) {
        if (
          !Array.isArray(descriptor.value) ||
          Object.getPrototypeOf(descriptor.value) !== Array.prototype ||
          descriptor.value.some((entry) => typeof entry !== 'string')
        ) {
          throw new TypeError(`${category} contains invalid evidence`);
        }
      } else if (
        descriptor.value !== null &&
        !['string', 'number', 'boolean'].includes(typeof descriptor.value)
      ) {
        throw new TypeError(`${category} contains invalid evidence`);
      }
    }
  }

  inspect(value, shape);
  return value;
}

function canonicalIso(value) {
  return (
    typeof value === 'string' &&
    C4_CANONICAL_ISO_PATTERN.test(value) &&
    new Date(value).toISOString() === value
  );
}

function canonicalText(value, { min, max, multiline = false }) {
  const hasForbiddenControlCharacter =
    typeof value === 'string' &&
    Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0);
      return (
        codePoint <= 8 ||
        codePoint === 11 ||
        codePoint === 12 ||
        (codePoint >= 14 && codePoint <= 31) ||
        codePoint === 127
      );
    });
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    value.normalize('NFC') !== value ||
    value.length < min ||
    value.length > max ||
    hasForbiddenControlCharacter ||
    (!multiline && /[\t\r\n]/.test(value)) ||
    (multiline && /\r/.test(value))
  ) {
    return false;
  }
  return true;
}

function immutableText({ min, max, multiline = false, nullable = false }) {
  return {
    type: String,
    immutable: true,
    validate: {
      validator(value) {
        return (
          (nullable && value === null) ||
          canonicalText(value, { min, max, multiline })
        );
      },
      message: 'candidate text evidence is invalid',
    },
  };
}

function immutableHash({ nullable = false } = {}) {
  return {
    type: String,
    immutable: true,
    validate: {
      validator(value) {
        return (nullable && value === null) || C4_HASH_PATTERN.test(value);
      },
      message: 'candidate hash evidence is invalid',
    },
  };
}

function immutableCanonicalTimestamp({ nullable = false } = {}) {
  return {
    type: String,
    immutable: true,
    validate: {
      validator(value) {
        return (nullable && value === null) || canonicalIso(value);
      },
      message: 'timestamp evidence is invalid',
    },
  };
}

function immutableStringArray({ maxCount, itemMin, itemMax }) {
  return {
    type: [String],
    default: undefined,
    immutable: true,
    validate: {
      validator(value) {
        return (
          Array.isArray(value) &&
          value.length <= maxCount &&
          value.every((entry) =>
            canonicalText(entry, {
              min: itemMin,
              max: itemMax,
            })
          )
        );
      },
      message: 'candidate array evidence is invalid',
    },
  };
}

function requireExactFields(schema, fields, category) {
  schema.pre('validate', function validateCompleteEvidence(next) {
    for (const field of fields) {
      if (this.get(field) === undefined) {
        this.invalidate(field, `${category} evidence is incomplete`);
      }
    }
    next();
  });
}

function requirePrimitiveInputTypes(
  schema,
  { strings = [], numbers = [], booleans = [], nullable = [] }
) {
  const nullableFields = new Set(nullable);
  for (const [fields, expectedType] of [
    [strings, 'string'],
    [numbers, 'number'],
    [booleans, 'boolean'],
  ]) {
    for (const field of fields) {
      schema.path(field).set(function rejectImplicitEvidenceCast(value) {
        if (
          value === undefined ||
          (nullableFields.has(field) && value === null)
        ) {
          return value;
        }
        if (typeof value !== expectedType) {
          throw new TypeError('evidence value has invalid type');
        }
        return value;
      });
    }
  }
}

const candidateContentEvidenceSchema = new mongoose.Schema(
  {
    title: immutableText({ min: 1, max: 200 }),
    companyName: immutableText({ min: 1, max: 300 }),
    organizationName: immutableText({
      min: 1,
      max: 300,
      nullable: true,
    }),
    description: immutableText({
      min: 20,
      max: 20000,
      multiline: true,
    }),
    requirements: immutableStringArray({
      maxCount: 200,
      itemMin: 1,
      itemMax: 2000,
    }),
    responsibilities: immutableStringArray({
      maxCount: 200,
      itemMin: 1,
      itemMax: 2000,
    }),
    benefits: immutableStringArray({
      maxCount: 200,
      itemMin: 1,
      itemMax: 2000,
    }),
    skillsRequired: immutableStringArray({
      maxCount: 40,
      itemMin: 1,
      itemMax: 80,
    }),
    salaryRange: immutableText({ min: 1, max: 120, nullable: true }),
    salaryCurrency: immutableText({ min: 1, max: 10 }),
    location: immutableText({ min: 1, max: 200, nullable: true }),
    province: immutableText({ min: 1, max: 120, nullable: true }),
    city: immutableText({ min: 1, max: 120, nullable: true }),
    category: immutableText({ min: 1, max: 120, nullable: true }),
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship'],
      immutable: true,
    },
    jobType: {
      type: String,
      enum: ['Government', 'Private', 'Internship'],
      immutable: true,
    },
    educationRequirement: immutableText({
      min: 1,
      max: 1000,
      nullable: true,
    }),
    experience: immutableText({ min: 1, max: 500, nullable: true }),
    gender: immutableText({ min: 1, max: 120, nullable: true }),
    workMode: {
      type: String,
      enum: ['on_site', 'remote', 'hybrid'],
      immutable: true,
    },
    deadline: immutableCanonicalTimestamp({ nullable: true }),
    totalSeats: {
      type: Number,
      immutable: true,
      validate: {
        validator(value) {
          return value === null || (Number.isSafeInteger(value) && value >= 1);
        },
        message: 'candidate seat evidence is invalid',
      },
    },
    autoCloseWhenFilled: { type: Boolean, immutable: true },
    applicationInstructions: immutableText({
      min: 1,
      max: 10000,
      multiline: true,
      nullable: true,
    }),
    logoUrl: immutableText({ min: 1, max: 2048, nullable: true }),
    gallery: immutableStringArray({
      maxCount: 200,
      itemMin: 1,
      itemMax: 2048,
    }),
  },
  { _id: false, strict: 'throw' }
);
requireExactFields(
  candidateContentEvidenceSchema,
  C4_CANDIDATE_CONTENT_FIELDS,
  'publication candidate content'
);
requirePrimitiveInputTypes(candidateContentEvidenceSchema, {
  strings: [
    'title',
    'companyName',
    'organizationName',
    'description',
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
    'applicationInstructions',
    'logoUrl',
  ],
  numbers: ['totalSeats'],
  booleans: ['autoCloseWhenFilled'],
  nullable: [
    'organizationName',
    'salaryRange',
    'location',
    'province',
    'city',
    'category',
    'educationRequirement',
    'experience',
    'gender',
    'deadline',
    'totalSeats',
    'applicationInstructions',
    'logoUrl',
  ],
});

const destinationEvidenceSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, enum: [1], immutable: true },
    mode: {
      type: String,
      enum: ['internal_platform', 'external_url', 'external_email'],
      immutable: true,
    },
    normalizedTarget: immutableText({
      min: 1,
      max: 2048,
      nullable: true,
    }),
    targetDigest: immutableHash(),
    normalizedDomain: immutableText({
      min: 1,
      max: 253,
      nullable: true,
    }),
    trustClassification: {
      type: String,
      enum: [
        'INTERNAL_PLATFORM',
        'ADMIN_REVIEW_REQUIRED',
        'ADMIN_APPROVED_FOR_PUBLICATION',
        'UNVERIFIED_REJECTED',
      ],
      immutable: true,
    },
    evidenceSource: {
      type: String,
      enum: [
        'server_derived_internal_route',
        'employer_declared_external_target',
      ],
      immutable: true,
    },
    evaluatedAt: immutableCanonicalTimestamp(),
    validationPolicyVersion: {
      type: String,
      enum: [FREE_BETA_POLICY_VERSION],
      maxlength: 64,
      immutable: true,
    },
    classifiedByActorType: {
      type: String,
      enum: ['system', 'staff', 'security_operator'],
      immutable: true,
    },
    classifiedByActorId: {
      type: String,
      immutable: true,
      validate: {
        validator(value) {
          return value === null || C4_OBJECT_ID_PATTERN.test(value);
        },
        message: 'destination actor evidence is invalid',
      },
    },
  },
  { _id: false, strict: 'throw' }
);
requireExactFields(
  destinationEvidenceSchema,
  C4_DESTINATION_EVIDENCE_FIELDS,
  'application destination'
);
requirePrimitiveInputTypes(destinationEvidenceSchema, {
  strings: [
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
  ],
  numbers: ['schemaVersion'],
  nullable: ['normalizedTarget', 'normalizedDomain', 'classifiedByActorId'],
});
destinationEvidenceSchema.pre(
  'validate',
  function validateDestinationRelationships(next) {
    const internal = this.mode === 'internal_platform';
    const external = ['external_url', 'external_email'].includes(this.mode);
    let normalizedExternalTarget = false;
    if (
      this.mode === 'external_url' &&
      typeof this.normalizedTarget === 'string' &&
      typeof this.normalizedDomain === 'string'
    ) {
      try {
        const parsed = new URL(this.normalizedTarget);
        normalizedExternalTarget =
          parsed.protocol === 'https:' &&
          parsed.href === this.normalizedTarget &&
          parsed.username === '' &&
          parsed.password === '' &&
          parsed.search === '' &&
          parsed.hash === '' &&
          parsed.hostname === this.normalizedDomain &&
          C4_DOMAIN_PATTERN.test(this.normalizedDomain);
      } catch {
        normalizedExternalTarget = false;
      }
    } else if (
      this.mode === 'external_email' &&
      typeof this.normalizedTarget === 'string' &&
      typeof this.normalizedDomain === 'string'
    ) {
      const separator = this.normalizedTarget.lastIndexOf('@');
      const localPart = this.normalizedTarget.slice(0, separator);
      const domain = this.normalizedTarget.slice(separator + 1);
      normalizedExternalTarget =
        separator > 0 &&
        localPart.length <= 64 &&
        !/[\s@<>,;:"()[\]\\]/.test(localPart) &&
        domain === this.normalizedDomain &&
        C4_DOMAIN_PATTERN.test(domain);
    }
    if (
      (internal &&
        (this.normalizedTarget !== null ||
          this.normalizedDomain !== null ||
          this.trustClassification !== 'INTERNAL_PLATFORM' ||
          this.evidenceSource !== 'server_derived_internal_route')) ||
      (external &&
        (typeof this.normalizedTarget !== 'string' ||
          typeof this.normalizedDomain !== 'string' ||
          !normalizedExternalTarget ||
          this.trustClassification !== 'ADMIN_REVIEW_REQUIRED' ||
          this.evidenceSource !== 'employer_declared_external_target')) ||
      this.classifiedByActorType !== 'system' ||
      this.classifiedByActorId !== null
    ) {
      this.invalidate(
        'trustClassification',
        'application destination relationship is invalid'
      );
    }
    if (
      this.mode === 'external_email' &&
      typeof this.normalizedTarget === 'string' &&
      this.normalizedTarget.length > 254
    ) {
      this.invalidate(
        'normalizedTarget',
        'application destination target is invalid'
      );
    }
    next();
  }
);

const publicationCandidateEvidenceSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, enum: [1], immutable: true },
    policyVersion: {
      type: String,
      enum: [FREE_BETA_POLICY_VERSION],
      immutable: true,
    },
    candidateKind: {
      type: String,
      enum: ['major_edit', 'correction'],
      immutable: true,
    },
    candidateRevision: {
      type: Number,
      min: 1,
      immutable: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'candidate revision evidence is invalid',
      },
    },
    baseApprovedSubmissionId: {
      type: String,
      match: [C4_OBJECT_ID_PATTERN, 'candidate base identity is invalid'],
      immutable: true,
    },
    baseApprovedCandidateHash: immutableHash(),
    basePublicationVersion: {
      type: Number,
      min: 0,
      immutable: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'candidate base version evidence is invalid',
      },
    },
    expectedPublicationVersion: {
      type: Number,
      min: 0,
      immutable: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'candidate expected version evidence is invalid',
      },
    },
    previousCandidateHash: immutableHash({ nullable: true }),
    content: {
      type: candidateContentEvidenceSchema,
      immutable: true,
    },
    destinationEvidence: {
      type: destinationEvidenceSchema,
      immutable: true,
    },
    candidateHash: immutableHash(),
  },
  { _id: false, strict: 'throw' }
);
requireExactFields(
  publicationCandidateEvidenceSchema,
  C4_PUBLICATION_CANDIDATE_FIELDS,
  'publication candidate'
);
requirePrimitiveInputTypes(publicationCandidateEvidenceSchema, {
  strings: [
    'policyVersion',
    'candidateKind',
    'baseApprovedSubmissionId',
    'baseApprovedCandidateHash',
    'previousCandidateHash',
    'candidateHash',
  ],
  numbers: [
    'schemaVersion',
    'candidateRevision',
    'basePublicationVersion',
    'expectedPublicationVersion',
  ],
  nullable: ['previousCandidateHash'],
});
publicationCandidateEvidenceSchema.pre(
  'validate',
  function validateCandidateRelationships(next) {
    if (
      (this.candidateKind === 'major_edit' &&
        (this.candidateRevision !== 1 ||
          this.previousCandidateHash !== null ||
          this.basePublicationVersion !== this.expectedPublicationVersion)) ||
      (this.candidateKind === 'correction' &&
        (this.candidateRevision < 2 ||
          !C4_HASH_PATTERN.test(this.previousCandidateHash || '')))
    ) {
      this.invalidate(
        'candidateKind',
        'publication candidate relationship is invalid'
      );
    }
    next();
  }
);

const operationOutboxEvidenceSchema = new mongoose.Schema(
  {
    employerSubmissionReceived: {
      type: String,
      maxlength: 160,
      immutable: true,
    },
    adminJobReviewRequested: {
      type: String,
      maxlength: 160,
      immutable: true,
    },
  },
  { _id: false, strict: 'throw' }
);
requireExactFields(
  operationOutboxEvidenceSchema,
  C4_OUTBOX_KEY_FIELDS,
  'operation outbox'
);
requirePrimitiveInputTypes(operationOutboxEvidenceSchema, {
  strings: [...C4_OUTBOX_KEY_FIELDS],
});

const operationEvidenceSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, enum: [1], immutable: true },
    operationId: {
      type: String,
      match: [C4_UUID_V4_PATTERN, 'operation identity is invalid'],
      immutable: true,
    },
    operationKind: {
      type: String,
      enum: ['major_edit_submission', 'correction_submission'],
      immutable: true,
    },
    moderationEventId: {
      type: String,
      match: [C4_OBJECT_ID_PATTERN, 'moderation event identity is invalid'],
      immutable: true,
    },
    newModerationCycleId: {
      type: String,
      match: [C4_OBJECT_ID_PATTERN, 'moderation cycle identity is invalid'],
      immutable: true,
    },
    expectedPublicationVersion: {
      type: Number,
      min: 0,
      immutable: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'operation version evidence is invalid',
      },
    },
    expectedPublicationState: {
      type: String,
      enum: ['active', 'rejected'],
      immutable: true,
    },
    outboxDeduplicationKeys: {
      type: operationOutboxEvidenceSchema,
      immutable: true,
    },
    initiatedAt: immutableCanonicalTimestamp(),
    expectedCommittedPublicationVersion: {
      type: Number,
      min: 1,
      immutable: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'operation committed version evidence is invalid',
      },
    },
    expectedCommittedPublicationState: {
      type: String,
      enum: ['pending_review'],
      immutable: true,
    },
    expectedCurrentSubmissionId: {
      type: String,
      match: [C4_OBJECT_ID_PATTERN, 'current submission identity is invalid'],
      immutable: true,
    },
    rulesVersion: {
      type: String,
      minlength: 1,
      maxlength: 100,
      immutable: true,
      validate: {
        validator(value) {
          return (
            typeof value === 'string' &&
            value === value.trim() &&
            /^[\x20-\x7e]+$/.test(value)
          );
        },
        message: 'operation rules evidence is invalid',
      },
    },
    rulesDigest: immutableHash(),
  },
  { _id: false, strict: 'throw' }
);
requireExactFields(
  operationEvidenceSchema,
  C4_OPERATION_EVIDENCE_FIELDS,
  'publishing operation'
);
requirePrimitiveInputTypes(operationEvidenceSchema, {
  strings: [
    'operationId',
    'operationKind',
    'moderationEventId',
    'newModerationCycleId',
    'expectedPublicationState',
    'initiatedAt',
    'expectedCommittedPublicationState',
    'expectedCurrentSubmissionId',
    'rulesVersion',
    'rulesDigest',
  ],
  numbers: [
    'schemaVersion',
    'expectedPublicationVersion',
    'expectedCommittedPublicationVersion',
  ],
});

const contentSnapshotSchema = new mongoose.Schema(
  {
    contentHash: {
      type: String,
      required: true,
      lowercase: true,
      match: /^[a-f0-9]{64}$/,
    },
    title: safeText(300),
    companyName: safeText(300),
    description: safeText(20000),
    requirements: [safeText(2000)],
    responsibilities: [safeText(2000)],
    skillsRequired: [safeText(200)],
    salaryRange: safeText(200),
    salaryCurrency: safeText(10),
    location: safeText(300),
    province: safeText(120),
    city: safeText(120),
    category: safeText(120),
    employmentType: safeText(80),
    jobType: safeText(80),
    educationRequirement: safeText(1000),
    experience: safeText(500),
    applicationMode: {
      type: String,
      enum: ['internal', 'external'],
    },
    applicationDomain: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 253,
      match:
        /^(?!.*[@/:])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    },
    workMode: {
      type: String,
      enum: ['on_site', 'remote', 'hybrid'],
    },
    deadline: { type: Date, default: null },
    totalSeats: { type: Number, min: 1, default: null },
  },
  { _id: false, strict: 'throw' }
);

const verificationSnapshotSchema = new mongoose.Schema(
  {
    verified: { type: Boolean, required: true },
    verificationLevel: {
      type: String,
      enum: ['basic', 'verified', 'trusted'],
      required: true,
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended'],
      required: true,
    },
    normalizedCompanyName: safeText(300),
    emailPresent: { type: Boolean, required: true },
    emailValid: { type: Boolean, required: true },
    emailDomain: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 253,
      match:
        /^(?!.*[@/:])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    },
    websiteDomain: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 253,
      match:
        /^(?!.*[@/:])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    },
    requiredProfileChecks: {
      type: Map,
      of: Boolean,
      default: undefined,
    },
    predicateCapabilityVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    eligibilityResultCodes: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 100,
          match: /^[A-Z0-9_]+$/,
        },
      ],
      required: true,
    },
  },
  { _id: false, strict: 'throw' }
);

const rollingUsageSnapshotSchema = new mongoose.Schema(
  {
    used: { type: Number, required: true, min: 0 },
    limit: { type: Number, required: true, min: 0 },
    remaining: { type: Number, required: true, min: 0 },
    nextEligibleAt: { type: Date, default: null },
    nextSlotAt: { type: Date, default: null },
  },
  { _id: false, strict: 'throw' }
);

const activeFreeUsageSnapshotSchema = new mongoose.Schema(
  {
    planCode: {
      type: String,
      enum: [PUBLISHING_POLICY_CODES.FREE_BETA],
      required: true,
    },
    used: { type: Number, required: true, min: 0 },
    limit: { type: Number, required: true, min: 0 },
    remaining: { type: Number, required: true, min: 0 },
    hasCapacity: { type: Boolean, required: true },
  },
  { _id: false, strict: 'throw' }
);

const quotaUsageSnapshotSchema = new mongoose.Schema(
  {
    daily: { type: rollingUsageSnapshotSchema, required: true },
    rolling30Days: { type: rollingUsageSnapshotSchema, required: true },
    activeFreeJobs: {
      type: activeFreeUsageSnapshotSchema,
      required: true,
    },
  },
  { _id: false, strict: 'throw' }
);

const quotaSnapshotSchema = new mongoose.Schema(
  {
    policyCode: {
      type: String,
      enum: [PUBLISHING_POLICY_CODES.FREE_BETA],
      required: true,
    },
    policyVersion: {
      type: String,
      enum: [FREE_BETA_POLICY_VERSION],
      required: true,
    },
    capturedAt: { type: Date, required: true },
    before: { type: quotaUsageSnapshotSchema, required: true },
    after: { type: quotaUsageSnapshotSchema, required: true },
  },
  { _id: false, strict: 'throw' }
);

const moderationSummarySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        'approved',
        'rejected',
        'changes_requested',
        'withdrawn',
        'expired',
        'superseded',
      ],
      required: true,
    },
    reasonCode: {
      type: String,
      trim: true,
      maxlength: 100,
      match: /^[A-Z0-9_]+$/,
    },
    ownerMessage: safeText(1000),
    eventId: { type: ObjectId, required: true },
    decidedAt: { type: Date, required: true },
  },
  { _id: false, strict: 'throw' }
);

const jobPublicationSubmissionSchema = new mongoose.Schema(
  {
    jobId: { type: ObjectId, ref: 'Job', required: true, immutable: true },
    employerId: {
      type: ObjectId,
      ref: 'Employer',
      required: true,
      immutable: true,
    },
    quotaOwnerType: {
      type: String,
      enum: QUOTA_OWNER_TYPES,
      required: true,
      immutable: true,
    },
    quotaOwnerId: { type: ObjectId, required: true, immutable: true },
    submissionKind: {
      type: String,
      enum: PUBLICATION_SUBMISSION_KINDS,
      required: true,
      immutable: true,
    },
    planCode: {
      type: String,
      enum: Object.values(PUBLISHING_POLICY_CODES),
      default: PUBLISHING_POLICY_CODES.FREE_BETA,
      required: true,
      immutable: true,
    },
    policyVersion: {
      type: String,
      default: FREE_BETA_POLICY_VERSION,
      required: true,
      immutable: true,
    },
    state: {
      type: String,
      enum: PUBLICATION_SUBMISSION_STATES,
      default: 'pending_review',
      required: true,
    },
    acceptedAt: { type: Date, required: true, immutable: true },
    reviewedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      minlength: 16,
      maxlength: 128,
      immutable: true,
    },
    requestFingerprint: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-f0-9]{64}$/,
      immutable: true,
    },
    correctionOfSubmissionId: {
      type: ObjectId,
      ref: 'JobPublicationSubmission',
      default: null,
      immutable: true,
    },
    moderationCycleId: { type: ObjectId, required: true, immutable: true },
    quotaCharged: { type: Boolean, required: true, immutable: true },
    quotaExemptionReason: {
      type: String,
      enum: QUOTA_EXEMPTION_REASONS,
      default: null,
      immutable: true,
    },
    publicationCandidate: {
      type: publicationCandidateEvidenceSchema,
      default: undefined,
      immutable: true,
      set(value) {
        if (value === undefined) return value;
        return rejectUnsafeEvidence(
          'publicationCandidate',
          value,
          C4_PUBLICATION_CANDIDATE_SHAPE
        );
      },
    },
    operationEvidence: {
      type: operationEvidenceSchema,
      default: undefined,
      immutable: true,
      set(value) {
        if (value === undefined) return value;
        return rejectUnsafeEvidence(
          'operationEvidence',
          value,
          C4_OPERATION_EVIDENCE_SHAPE
        );
      },
    },
    jobRevision: { type: Number, required: true, min: 0, immutable: true },
    contentSnapshot: {
      type: contentSnapshotSchema,
      required: true,
      immutable: true,
      set: rejectUnknownSnapshotKeys('contentSnapshot', CONTENT_SNAPSHOT_SHAPE),
    },
    rulesAcknowledgementId: {
      type: ObjectId,
      ref: 'EmployerPostingRulesAcknowledgement',
      required: true,
      immutable: true,
    },
    verificationSnapshot: {
      type: verificationSnapshotSchema,
      required: true,
      immutable: true,
      set: rejectUnknownSnapshotKeys(
        'verificationSnapshot',
        VERIFICATION_SNAPSHOT_SHAPE
      ),
    },
    quotaSnapshot: {
      type: quotaSnapshotSchema,
      required: true,
      immutable: true,
      set: rejectUnknownSnapshotKeys('quotaSnapshot', QUOTA_SNAPSHOT_SHAPE),
    },
    moderationSummary: {
      type: moderationSummarySchema,
      default: null,
      set: rejectUnknownSnapshotKeys(
        'moderationSummary',
        MODERATION_SUMMARY_SHAPE
      ),
    },
  },
  {
    timestamps: true,
    collection: 'jobPublicationSubmissions',
    strict: 'throw',
  }
);

jobPublicationSubmissionSchema.index(
  { quotaOwnerType: 1, quotaOwnerId: 1, idempotencyKey: 1 },
  { unique: true, name: 'publication_submission_owner_idempotency_unique' }
);
jobPublicationSubmissionSchema.index({
  quotaOwnerType: 1,
  quotaOwnerId: 1,
  acceptedAt: -1,
});
jobPublicationSubmissionSchema.index({
  quotaOwnerType: 1,
  quotaOwnerId: 1,
  planCode: 1,
  acceptedAt: -1,
});
jobPublicationSubmissionSchema.index({ jobId: 1, acceptedAt: -1 });
jobPublicationSubmissionSchema.index({ state: 1, acceptedAt: 1 });
jobPublicationSubmissionSchema.index({ employerId: 1, acceptedAt: -1 });
jobPublicationSubmissionSchema.index(
  { rulesAcknowledgementId: 1 },
  { unique: true, name: 'publication_submission_rules_ack_unique' }
);
jobPublicationSubmissionSchema.index(
  { correctionOfSubmissionId: 1 },
  { sparse: true }
);
jobPublicationSubmissionSchema.index({ moderationCycleId: 1, acceptedAt: 1 });
jobPublicationSubmissionSchema.index(
  { moderationCycleId: 1 },
  {
    unique: true,
    name: 'publication_submission_one_exempt_correction_per_cycle',
    partialFilterExpression: {
      submissionKind: 'correction',
      quotaCharged: false,
    },
  }
);
jobPublicationSubmissionSchema.index(
  { jobId: 1 },
  {
    unique: true,
    name: 'publication_submission_one_pending_per_job',
    partialFilterExpression: { state: 'pending_review' },
  }
);

jobPublicationSubmissionSchema.pre(
  'validate',
  function validateSubmissionContract(next) {
    const hasCandidateEvidence = this.publicationCandidate !== undefined;
    const hasOperationEvidence = this.operationEvidence !== undefined;
    if (hasCandidateEvidence !== hasOperationEvidence) {
      this.invalidate(
        hasCandidateEvidence ? 'operationEvidence' : 'publicationCandidate',
        'complete immutable publication evidence is required'
      );
    }

    if (hasCandidateEvidence && hasOperationEvidence) {
      const candidate = this.publicationCandidate;
      const operation = this.operationEvidence;
      const submissionId = this._id?.toString();
      const moderationCycleId = this.moderationCycleId?.toString();
      const acknowledgementId = this.rulesAcknowledgementId?.toString();
      const expectedKind =
        this.submissionKind === 'major_edit'
          ? 'major_edit_submission'
          : this.submissionKind === 'correction'
            ? 'correction_submission'
            : null;
      const expectedCandidateKind =
        this.submissionKind === 'major_edit'
          ? 'major_edit'
          : this.submissionKind === 'correction'
            ? 'correction'
            : null;
      const expectedSourceState =
        this.submissionKind === 'major_edit'
          ? 'active'
          : this.submissionKind === 'correction'
            ? 'rejected'
            : null;
      const expectedEmployerOutboxKey = `${submissionId}:employer_submission_received`;
      const expectedAdminOutboxKey = `${submissionId}:admin_job_review_requested`;

      if (
        this.planCode !== PUBLISHING_POLICY_CODES.FREE_BETA ||
        this.policyVersion !== FREE_BETA_POLICY_VERSION ||
        this.quotaOwnerType !== 'employer' ||
        this.quotaOwnerId?.toString() !== this.employerId?.toString() ||
        expectedKind === null ||
        operation.operationKind !== expectedKind ||
        candidate.candidateKind !== expectedCandidateKind ||
        operation.expectedPublicationState !== expectedSourceState ||
        operation.expectedPublicationVersion !==
          candidate.expectedPublicationVersion ||
        operation.expectedCommittedPublicationVersion !==
          operation.expectedPublicationVersion + 1 ||
        operation.expectedCommittedPublicationState !== 'pending_review' ||
        operation.expectedCurrentSubmissionId !== submissionId ||
        operation.outboxDeduplicationKeys?.employerSubmissionReceived !==
          expectedEmployerOutboxKey ||
        operation.outboxDeduplicationKeys?.adminJobReviewRequested !==
          expectedAdminOutboxKey ||
        operation.initiatedAt !== this.acceptedAt?.toISOString() ||
        candidate.policyVersion !== this.policyVersion ||
        operation.expectedPublicationVersion !== this.jobRevision ||
        acknowledgementId === undefined
      ) {
        this.invalidate(
          'operationEvidence',
          'immutable publication evidence relationships are invalid'
        );
      }

      if (
        (this.submissionKind === 'major_edit' || this.quotaCharged) &&
        operation.newModerationCycleId !== moderationCycleId
      ) {
        this.invalidate(
          'operationEvidence.newModerationCycleId',
          'moderation-cycle evidence relationship is invalid'
        );
      }
    }

    if (
      !this.isNew &&
      (this.isModified('publicationCandidate') ||
        this.isModified('operationEvidence'))
    ) {
      this.invalidate(
        'publicationCandidate',
        'immutable publication evidence cannot be modified'
      );
    }

    if (!Number.isInteger(this.jobRevision) || this.jobRevision < 0) {
      this.invalidate(
        'jobRevision',
        'jobRevision must be a non-negative integer'
      );
    }

    if (
      this.submissionKind === 'correction' &&
      !this.correctionOfSubmissionId
    ) {
      this.invalidate(
        'correctionOfSubmissionId',
        'correctionOfSubmissionId is required for correction submissions'
      );
    }

    if (this.submissionKind !== 'correction' && this.correctionOfSubmissionId) {
      this.invalidate(
        'correctionOfSubmissionId',
        'correctionOfSubmissionId is only valid for correction submissions'
      );
    }

    if (this.quotaCharged && this.quotaExemptionReason) {
      this.invalidate(
        'quotaExemptionReason',
        'quotaExemptionReason must be empty when quotaCharged is true'
      );
    }

    if (!this.quotaCharged && !this.quotaExemptionReason) {
      this.invalidate(
        'quotaExemptionReason',
        'quotaExemptionReason is required when quotaCharged is false'
      );
    }

    if (
      this.quotaExemptionReason === 'reviewer_requested_correction' &&
      this.submissionKind !== 'correction'
    ) {
      this.invalidate(
        'quotaExemptionReason',
        'reviewer_requested_correction is valid only for correction submissions'
      );
    }

    if (this.approvedAt && this.rejectedAt) {
      this.invalidate(
        'approvedAt',
        'approvedAt and rejectedAt are mutually exclusive'
      );
      this.invalidate(
        'rejectedAt',
        'approvedAt and rejectedAt are mutually exclusive'
      );
    }

    if (this.state === 'approved' && !this.approvedAt) {
      this.invalidate(
        'approvedAt',
        'approvedAt is required for approved submissions'
      );
    }

    if (this.state === 'rejected' && !this.rejectedAt) {
      this.invalidate(
        'rejectedAt',
        'rejectedAt is required for rejected submissions'
      );
    }

    const isApproved = this.state === 'approved';
    const isRejected = this.state === 'rejected';
    const isReviewed = isApproved || isRejected;
    const decisionAt = isApproved ? this.approvedAt : this.rejectedAt;

    if (isReviewed && !this.reviewedAt) {
      this.invalidate(
        'reviewedAt',
        'reviewedAt is required for approved and rejected submissions'
      );
    }

    if (!isReviewed && this.reviewedAt) {
      this.invalidate(
        'reviewedAt',
        'reviewedAt is only valid for approved and rejected submissions'
      );
    }

    if (!isApproved && this.approvedAt) {
      this.invalidate(
        'approvedAt',
        'approvedAt is only valid for approved submissions'
      );
    }

    if (!isRejected && this.rejectedAt) {
      this.invalidate(
        'rejectedAt',
        'rejectedAt is only valid for rejected submissions'
      );
    }

    if (
      isReviewed &&
      this.reviewedAt &&
      decisionAt &&
      this.reviewedAt.getTime() !== decisionAt.getTime()
    ) {
      this.invalidate(
        'reviewedAt',
        'reviewedAt must match the approval or rejection decision time'
      );
    }

    if (
      isReviewed &&
      this.acceptedAt &&
      this.reviewedAt &&
      this.reviewedAt < this.acceptedAt
    ) {
      this.invalidate(
        'reviewedAt',
        'reviewedAt cannot be earlier than acceptedAt'
      );
    }

    next();
  }
);

export const JobPublicationSubmission = mongoose.model(
  'JobPublicationSubmission',
  jobPublicationSubmissionSchema
);
