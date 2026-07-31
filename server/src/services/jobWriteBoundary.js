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
const DANGEROUS_PROPERTY_NAMES = Object.freeze(
  new Set(['__proto__', 'constructor', 'prototype'])
);

/**
 * Admin job-duplication field contract (STRIDETO-SEC-1).
 *
 * Defined independently of JOB_TRANSLATION_OVERRIDE_FIELDS / JOB_TRANSLATION_SOURCE_FIELDS
 * on purpose: duplication and translation are different operations with different intended
 * semantics, and deriving one allowlist from the other coupled two unrelated concerns behind
 * a shared array, which is how the F460F1E admin-duplicate regression went undocumented — a
 * future change to the translation lists would have silently changed duplication behavior too.
 *
 * Every Job schema path must be classified into exactly one of the three groups below
 * (a fourth group, RECOMPUTE, is applied by adminJobsController.duplicate() after this
 * projection runs, for title/status/approvalStatus/slug — see
 * docs/STRIDETO_ADMIN_JOB_DUPLICATION_REGRESSION_CORRECTION_REPORT.md for the full,
 * field-by-field rationale).
 */

/** PRESERVE — editable content + ownership/attribution fields copied verbatim from the source. */
export const JOB_DUPLICATE_PRESERVE_FIELDS = Object.freeze([
  'title',
  'company',
  'organization',
  'location',
  'province',
  'city',
  'category',
  'type',
  'jobType',
  'educationRequirement',
  'experience',
  'applyType',
  'applicationLink',
  'description',
  'requirements',
  'applicationInstructions',
  'responsibilities',
  'benefits',
  'gender',
  'salaryRange',
  'salaryCurrency',
  'skillsRequired',
  'applyEmail',
  'deadline',
  'logoUrl',
  'remote',
  'hybrid',
  'totalSeats',
  'autoCloseWhenFilled',
  'gallery',
  'seoTitle',
  'metaDescription',
  'postedBy',
  'employerId',
]);

/**
 * RESET — deliberately excluded from the projection allowlist; the new document receives its
 * Mongoose schema default (or, for status/approvalStatus/slug, an explicit new value assigned
 * by the controller immediately after this projection runs).
 *
 * Proven paid placement (isFeatured, isSponsored, paidUntil, planId, planType, expiresAt) is
 * reset rather than preserved: each is only ever written as a side effect of a real Stripe
 * checkout (the billing-activation-verification service, employerController.js's job-activation
 * handler) or a staff-only monetization toggle (monetizationController.js), and
 * each is read by a live public query or scheduled job (monetizationController.js
 * featured/sponsored listing queries, reminderJobs.js expiry reminders, automationService.js
 * subscription-expiring notices). An admin duplicate has not been purchased or approved for that
 * placement, and silently copying it would grant a free duplicate of paid/promoted status, or
 * misfire a "your paid job is expiring" reminder for a job nobody paid for.
 *
 * priority, urgent, and boostLevel are reset for a different, narrower reason: as of this
 * correction, none of the three has a single writer or reader anywhere in the live codebase
 * (verified by repository-wide search) apart from `urgent`'s one-way admin edit-form checkbox —
 * they carry no proven billing, promotion, or moderation relationship today. They are reset
 * because that is the neutral, no-regression choice (it makes a duplicate start identical to a
 * freshly-created Job for these three fields, exactly as it always has), not because a
 * billing/promotion relationship was proven. If a future feature gives these fields real
 * read/write behavior, this classification should be revisited against that behavior rather than
 * assumed to still apply.
 *
 * Provenance-of-the-original-scrape fields (source, scrapedAt, sourceUrl, sourceWebsite) are
 * reset rather than preserved: once an admin forks a record into a new editable draft it is an
 * admin-originated document, not a live tracked external record, and each field has a live reader
 * that would be corrupted by carrying the old value forward — growthDashboardController.js counts
 * `source: 'scraper'` as a KPI, seoController.js filters public SEO landing pages
 * (e.g. `/ppsc-jobs`) by `sourceWebsite`, and blogAutoGenerateService.js sorts by `scrapedAt` to
 * pick jobs for auto-generated content. Translation-linkage fields (locale, translationGroupId,
 * translationOf, translationStatus) are reset because a duplicate is a new standalone document,
 * not a translation of the source.
 */
export const JOB_DUPLICATE_RESET_FIELDS = Object.freeze([
  'views',
  'applicationsCount',
  'isFeatured',
  'isSponsored',
  'priority',
  'urgent',
  'boostLevel',
  'paidUntil',
  'planId',
  'planType',
  'expiresAt',
  'source',
  'scrapedAt',
  'sourceUrl',
  'sourceWebsite',
  'locale',
  'translationGroupId',
  'translationOf',
  'translationStatus',
  'status',
  'approvalStatus',
  'slug',
]);

/**
 * FORBID — must never appear in the duplicate projection, for hard technical or evidentiary
 * reasons rather than plain business-state defaults; enforced by an explicit runtime assertion
 * (assertNoForbiddenDuplicateFields) in addition to being absent from the allowlist, so a future
 * accidental addition to JOB_DUPLICATE_PRESERVE_FIELDS fails loudly instead of silently.
 *
 * externalId carries a unique+sparse index for scraper dedup — copying it risks an E11000
 * collision and corrupts dedup semantics. The canonical publication/moderation fields
 * (CANONICAL_JOB_PUBLICATION_FIELDS) are immutable publishing-operation identities and evidence
 * tied to a specific submission/moderation lifecycle that does not exist for a fresh duplicate.
 */
export const JOB_DUPLICATE_FORBIDDEN_FIELDS = Object.freeze([
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'externalId',
  ...CANONICAL_JOB_PUBLICATION_FIELDS,
]);

function assertNoForbiddenDuplicateFields(projection) {
  for (const field of JOB_DUPLICATE_FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(projection, field)) {
      throw new TypeError(
        `buildJobDuplicateProjection must never include forbidden field "${field}"`
      );
    }
  }
  return projection;
}

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
  const projection = copyFields(source, JOB_DUPLICATE_PRESERVE_FIELDS);
  return assertNoForbiddenDuplicateFields(projection);
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
