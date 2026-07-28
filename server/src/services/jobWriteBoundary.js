const MAX_REPORTED_FIELDS = 20;
const MAX_REPORTED_FIELD_LENGTH = 80;
const MONGO_SANITIZE_EVIDENCE = Symbol('strideto.mongoSanitizeEvidence');
const SANITIZE_EVIDENCE_BITS = Object.freeze({
  body: 1,
  params: 2,
  query: 4,
  headers: 8,
});

export const CANONICAL_JOB_PUBLICATION_FIELDS = Object.freeze([
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
  'policyVersion',
  'publicationUpdatedAt',
  'publicationMigrationStatus',
]);

export const JOB_TRANSLATION_OVERRIDE_FIELDS = Object.freeze([
  'title',
  'description',
  'requirements',
  'responsibilities',
  'benefits',
  'educationRequirement',
  'experience',
  'applicationInstructions',
  'seoTitle',
  'metaDescription',
]);

export const JOB_TRANSLATION_SOURCE_FIELDS = Object.freeze([
  'company',
  'organization',
  'location',
  'province',
  'city',
  'category',
  'type',
  'jobType',
  'skillsRequired',
  'gender',
  'salaryRange',
  'salaryCurrency',
  'deadline',
  'remote',
  'hybrid',
  'totalSeats',
  'autoCloseWhenFilled',
  'applyType',
  'applicationLink',
  'applyEmail',
  'logoUrl',
  'gallery',
  'employerId',
  'postedBy',
]);

const ARRAY_TRANSLATION_FIELDS = Object.freeze(
  new Set(['requirements', 'responsibilities', 'benefits'])
);
const TRANSLATION_FIELD_SET = Object.freeze(
  new Set(JOB_TRANSLATION_OVERRIDE_FIELDS)
);
const JOB_DUPLICATE_SOURCE_FIELDS = Object.freeze([
  ...JOB_TRANSLATION_OVERRIDE_FIELDS,
  ...JOB_TRANSLATION_SOURCE_FIELDS,
]);
const DANGEROUS_PROPERTY_NAMES = Object.freeze(
  new Set(['__proto__', 'constructor', 'prototype'])
);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasSanitizedInputEvidence(evidence) {
  if (evidence === true) return true;
  return Boolean(
    evidence && typeof evidence === 'object' && evidence.body === true
  );
}

function safeFieldName(value) {
  if (typeof value !== 'string') return 'overrides';
  const bounded = [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? '?' : character;
    })
    .join('')
    .slice(0, MAX_REPORTED_FIELD_LENGTH);
  return bounded || 'overrides';
}

function boundedFieldNames(fields) {
  return [...new Set(fields.map(safeFieldName))]
    .sort()
    .slice(0, MAX_REPORTED_FIELDS);
}

function isObjectIdCompatible(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return (
    prototype?.constructor?.name === 'ObjectId' &&
    value._bsontype === 'ObjectId' &&
    typeof value.toHexString === 'function'
  );
}

function assertSafeStructuredKey(key, path) {
  if (
    typeof key !== 'string' ||
    DANGEROUS_PROPERTY_NAMES.has(key) ||
    key.includes('.') ||
    key.startsWith('$')
  ) {
    throw new TypeError(`Unsupported projection value at ${path}`);
  }
}

function cloneAllowedValue(value, path = 'field', ancestors = new WeakSet()) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Unsupported projection value at ${path}`);
    }
    return value;
  }
  if (value instanceof Date) {
    const timestamp = value.getTime();
    if (!Number.isFinite(timestamp)) {
      throw new TypeError(`Unsupported projection value at ${path}`);
    }
    return new Date(timestamp);
  }
  if (isObjectIdCompatible(value)) {
    const identifier = value.toHexString();
    if (!/^[a-f0-9]{24}$/i.test(identifier)) {
      throw new TypeError(`Unsupported projection value at ${path}`);
    }
    return identifier.toLowerCase();
  }
  if (value === undefined || typeof value !== 'object') {
    throw new TypeError(`Unsupported projection value at ${path}`);
  }
  if (ancestors.has(value)) {
    throw new TypeError(`Unsupported projection value at ${path}`);
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        cloneAllowedValue(item, `${path}[${index}]`, ancestors)
      );
    }
    if (!isPlainObject(value)) {
      throw new TypeError(`Unsupported projection value at ${path}`);
    }

    const clone = {};
    for (const key of Reflect.ownKeys(value)) {
      assertSafeStructuredKey(key, path);
      if (!Object.prototype.propertyIsEnumerable.call(value, key)) {
        throw new TypeError(`Unsupported projection value at ${path}.${key}`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw new TypeError(`Unsupported projection value at ${path}.${key}`);
      }
      clone[key] = cloneAllowedValue(
        descriptor.value,
        `${path}.${key}`,
        ancestors
      );
    }
    return clone;
  } finally {
    ancestors.delete(value);
  }
}

function copyFields(source, fields) {
  const projection = {};
  if (!source || typeof source !== 'object') return projection;
  for (const field of fields) {
    if (
      Object.prototype.hasOwnProperty.call(source, field) &&
      source[field] !== undefined
    ) {
      projection[field] = cloneAllowedValue(source[field], field);
    }
  }
  return projection;
}

function hasSupportedTranslationValue(field, value) {
  if (ARRAY_TRANSLATION_FIELDS.has(field)) {
    return (
      Array.isArray(value) && value.every((item) => typeof item === 'string')
    );
  }
  return typeof value === 'string';
}

export function validateJobTranslationOverrides(
  value,
  sanitizedInputEvidence = false
) {
  const forbiddenFields = [];
  const safeOverrides = {};

  if (hasSanitizedInputEvidence(sanitizedInputEvidence)) {
    forbiddenFields.push('overrides');
  }

  if (value === undefined) {
    const fields = boundedFieldNames(forbiddenFields);
    return { ok: fields.length === 0, safeOverrides, forbiddenFields: fields };
  }

  if (!isPlainObject(value)) {
    forbiddenFields.push('overrides');
    const fields = boundedFieldNames(forbiddenFields);
    return { ok: false, safeOverrides, forbiddenFields: fields };
  }

  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key !== 'string' ||
      !Object.prototype.propertyIsEnumerable.call(value, key)
    ) {
      forbiddenFields.push('overrides');
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      forbiddenFields.push(key);
      continue;
    }

    if (
      DANGEROUS_PROPERTY_NAMES.has(key) ||
      key.includes('.') ||
      key.startsWith('$') ||
      !TRANSLATION_FIELD_SET.has(key) ||
      !hasSupportedTranslationValue(key, descriptor.value)
    ) {
      forbiddenFields.push(key);
      continue;
    }

    safeOverrides[key] = cloneAllowedValue(descriptor.value, key);
  }

  const fields = boundedFieldNames(forbiddenFields);
  return {
    ok: fields.length === 0,
    safeOverrides: fields.length === 0 ? safeOverrides : {},
    forbiddenFields: fields,
  };
}

export function buildJobTranslationProjection(source, safeOverrides = {}) {
  return {
    ...copyFields(source, JOB_TRANSLATION_SOURCE_FIELDS),
    ...copyFields(source, JOB_TRANSLATION_OVERRIDE_FIELDS),
    ...copyFields(safeOverrides, JOB_TRANSLATION_OVERRIDE_FIELDS),
  };
}

export function buildJobDuplicateProjection(source) {
  return copyFields(source, JOB_DUPLICATE_SOURCE_FIELDS);
}

export function recordMongoSanitizeEvidence({ req, key }) {
  if (!req || typeof req !== 'object') return;
  const bit = SANITIZE_EVIDENCE_BITS[key];
  if (!bit) return;
  const current = req[MONGO_SANITIZE_EVIDENCE] || 0;
  const next = current | bit;
  if (Object.prototype.hasOwnProperty.call(req, MONGO_SANITIZE_EVIDENCE)) {
    req[MONGO_SANITIZE_EVIDENCE] = next;
    return;
  }
  Object.defineProperty(req, MONGO_SANITIZE_EVIDENCE, {
    value: next,
    writable: true,
    enumerable: false,
    configurable: false,
  });
}

export function createMongoSanitizeOptions() {
  return Object.freeze({ onSanitize: recordMongoSanitizeEvidence });
}

export function getMongoSanitizeEvidence(req) {
  const evidence =
    req && typeof req === 'object' ? req[MONGO_SANITIZE_EVIDENCE] || 0 : 0;
  return Object.freeze({
    body: Boolean(evidence & SANITIZE_EVIDENCE_BITS.body),
    params: Boolean(evidence & SANITIZE_EVIDENCE_BITS.params),
    query: Boolean(evidence & SANITIZE_EVIDENCE_BITS.query),
    headers: Boolean(evidence & SANITIZE_EVIDENCE_BITS.headers),
  });
}

export function hasSanitizedBodyEvidence(req) {
  return getMongoSanitizeEvidence(req).body;
}
