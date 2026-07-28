/**
 * Canonical Job write-boundary correction tests (E.1F-H2B-B1-B-C2-A).
 * Run: node src/__tests__/canonicalJobWriteBoundary.test.js
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import {
  createTranslation,
  resolveTranslationOverrides,
} from '../controllers/admin/translationController.js';
import {
  CANONICAL_JOB_PUBLICATION_FIELDS,
  JOB_TRANSLATION_OVERRIDE_FIELDS,
  JOB_TRANSLATION_SOURCE_FIELDS,
  buildJobDuplicateProjection,
  buildJobTranslationProjection,
  createMongoSanitizeOptions,
  getMongoSanitizeEvidence,
  hasSanitizedBodyEvidence,
  validateJobTranslationOverrides,
} from '../services/jobWriteBoundary.js';

let assertions = 0;

function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}

function deepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}

function ok(value, message) {
  assert.ok(value, message);
  assertions += 1;
}

function throws(callback, expected, message) {
  assert.throws(callback, expected, message);
  assertions += 1;
}

async function invokeJobTranslation(req) {
  const response = {
    statusCode: 200,
    payload: null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
  };
  let forwardedError = null;
  await createTranslation(req, response, (error) => {
    forwardedError = error;
  });
  equal(
    forwardedError,
    null,
    'boundary rejection stays out of the global error handler'
  );
  return response;
}

function createMockRequest({
  entityType = 'job',
  body = {},
  query = {},
  params = {},
} = {}) {
  return {
    body,
    query,
    params: {
      entityType,
      id: '507f1f77bcf86cd799439011',
      ...params,
    },
    headers: {},
    user: { userId: '507f1f77bcf86cd799439012' },
  };
}

const mongoSanitizeMiddleware = mongoSanitize(createMongoSanitizeOptions());

async function runMongoSanitize(req) {
  let nextCalls = 0;
  await new Promise((resolve, reject) => {
    mongoSanitizeMiddleware(req, {}, (error) => {
      nextCalls += 1;
      if (error) reject(error);
      else resolve();
    });
  });
  equal(nextCalls, 1, 'installed sanitizer calls next exactly once');
  return req;
}

const translatedValues = {
  title: 'Localized backend engineer',
  description: 'Localized role description',
  requirements: ['Localized experience', 'Localized education'],
  responsibilities: ['Maintain localized services'],
  benefits: ['Localized health benefit'],
  educationRequirement: 'Localized bachelor degree',
  experience: 'Localized three years',
  applicationInstructions: 'Submit the localized application online',
  seoTitle: 'Localized backend engineer vacancy',
  metaDescription: 'Localized summary of the vacancy',
};

const sourceOnlyValues = {
  company: 'Example Company',
  organization: 'Example Engineering',
  location: 'Lahore',
  province: 'Punjab',
  city: 'Lahore',
  category: 'Engineering',
  type: 'full-time',
  jobType: 'Private',
  skillsRequired: ['Node.js', 'MongoDB'],
  gender: 'Any',
  salaryRange: '150000-200000',
  salaryCurrency: 'PKR',
  deadline: new Date('2026-08-31T00:00:00.000Z'),
  remote: false,
  hybrid: true,
  totalSeats: 2,
  autoCloseWhenFilled: true,
  applyType: 'external',
  applicationLink: 'https://example.test/apply',
  applyEmail: 'jobs@example.test',
  logoUrl: 'https://example.test/logo.png',
  gallery: ['https://example.test/office.png'],
  employerId: new mongoose.Types.ObjectId(),
  postedBy: new mongoose.Types.ObjectId(),
};

const valid = validateJobTranslationOverrides(translatedValues);
equal(valid.ok, true, 'approved translated fields are accepted');
deepEqual(
  Object.keys(valid.safeOverrides),
  JOB_TRANSLATION_OVERRIDE_FIELDS,
  'allowlist order is stable'
);
for (const field of JOB_TRANSLATION_OVERRIDE_FIELDS) {
  deepEqual(
    valid.safeOverrides[field],
    translatedValues[field],
    `${field} retains its supported value`
  );
}
ok(
  valid.safeOverrides.requirements !== translatedValues.requirements,
  'accepted arrays are copied'
);

for (const field of CANONICAL_JOB_PUBLICATION_FIELDS) {
  const result = validateJobTranslationOverrides({
    [field]: 'forbidden-value',
  });
  equal(result.ok, false, `${field} is rejected as an override`);
  deepEqual(result.forbiddenFields, [field], `${field} is safely identified`);
}

const protectedOverrideFields = [
  'employerId',
  'postedBy',
  'status',
  'approvalStatus',
  'planId',
  'planType',
  'expiresAt',
  'paidUntil',
  'views',
  'applicationsCount',
  'isFeatured',
  'isSponsored',
  'priority',
  'urgent',
  'boostLevel',
  'source',
  'sourceUrl',
  'sourceWebsite',
  'scrapedAt',
  'externalId',
  'locale',
  'translationGroupId',
  'translationOf',
  'translationStatus',
  'category',
  'futureCanonicalField',
];
for (const field of protectedOverrideFields) {
  const result = validateJobTranslationOverrides({
    [field]: 'forbidden-value',
  });
  equal(result.ok, false, `${field} is not client-writable`);
  deepEqual(
    result.forbiddenFields,
    [field],
    `${field} produces bounded field-only details`
  );
}

for (const key of [
  'publicationState.value',
  'rejectionSummary.reasonCode',
  '$set',
  '$unset',
  '$rename',
  'constructor',
  'prototype',
]) {
  const result = validateJobTranslationOverrides({ [key]: 'unsafe' });
  equal(result.ok, false, `${key} fails safely`);
  deepEqual(
    result.forbiddenFields,
    [key],
    `${key} is reported without its value`
  );
}

const protoAttempt = validateJobTranslationOverrides(
  JSON.parse('{"__proto__":{"publicationState":"active"}}')
);
equal(protoAttempt.ok, false, '__proto__ fails safely');
deepEqual(
  protoAttempt.forbiddenFields,
  ['__proto__'],
  '__proto__ is safely identified'
);

for (const envelope of [
  [],
  'title',
  42,
  true,
  null,
  new Date(),
  new mongoose.Types.ObjectId(),
]) {
  const result = validateJobTranslationOverrides(envelope);
  equal(result.ok, false, 'non-plain override envelopes fail safely');
  deepEqual(
    result.forbiddenFields,
    ['overrides'],
    'invalid envelopes expose only the safe marker'
  );
}

for (const [field, value] of [
  ['title', { nested: 'value' }],
  ['description', ['not', 'a', 'string']],
  ['requirements', ['valid', 42]],
  ['responsibilities', { 0: 'invalid' }],
  ['benefits', [new Date()]],
]) {
  const result = validateJobTranslationOverrides({ [field]: value });
  equal(result.ok, false, `${field} rejects unsupported nested values`);
  deepEqual(
    result.forbiddenFields,
    [field],
    `${field} reports no supplied value`
  );
}

const sanitized = validateJobTranslationOverrides({}, { body: true });
equal(
  sanitized.ok,
  false,
  'sanitizer evidence rejects the Job override envelope'
);
deepEqual(
  sanitized.forbiddenFields,
  ['overrides'],
  'sanitizer evidence uses a safe marker'
);

for (const [body, expectedField] of [
  [
    { locale: 'ur', overrides: { publicationState: 'active' } },
    'publicationState',
  ],
  [{ locale: 'ur', overrides: { $set: 'unsafe' } }, '$set'],
]) {
  const response = await invokeJobTranslation(createMockRequest({ body }));
  equal(
    response.statusCode,
    400,
    'invalid Job translation input returns HTTP 400'
  );
  equal(
    response.payload.code,
    'TRANSLATION_OVERRIDE_FIELDS_FORBIDDEN',
    'invalid Job translation input returns the stable code'
  );
  equal(
    response.payload.error,
    'One or more translation override fields are not allowed.',
    'invalid Job translation input returns the safe message'
  );
  deepEqual(
    response.payload.details,
    { fields: [expectedField] },
    'controller details contain only the bounded field marker'
  );
  equal(
    JSON.stringify(response.payload).includes('forbidden-value-secret'),
    false,
    'controller response contains no supplied value'
  );
}

for (const body of [
  { locale: 'ur' },
  { locale: 'ur', overrides: {} },
  { locale: 'ur', overrides: { title: 'Approved translation' } },
]) {
  const req = await runMongoSanitize(createMockRequest({ body }));
  const resolution = resolveTranslationOverrides(req, 'job');
  equal(resolution.ok, true, 'safe Job bodies pass boundary validation');
  equal(
    hasSanitizedBodyEvidence(req),
    false,
    'safe Job bodies create no sanitizer evidence'
  );
}

const unsafeDollarValue = 'private-dollar-value';
const unsafeDollarRequest = await runMongoSanitize(
  createMockRequest({
    body: {
      locale: 'ur',
      overrides: { $set: unsafeDollarValue },
    },
  })
);
equal(
  Object.hasOwn(unsafeDollarRequest.body.overrides, '$set'),
  false,
  'installed sanitizer removes a dollar-prefixed override key'
);
equal(
  hasSanitizedBodyEvidence(unsafeDollarRequest),
  true,
  'installed sanitizer records body evidence on the affected request'
);
const unsafeDollarResponse = await invokeJobTranslation(unsafeDollarRequest);
equal(
  unsafeDollarResponse.statusCode,
  400,
  'sanitized unsafe Job overrides return HTTP 400'
);
equal(
  unsafeDollarResponse.payload.code,
  'TRANSLATION_OVERRIDE_FIELDS_FORBIDDEN',
  'sanitized unsafe Job overrides return the stable code'
);
deepEqual(
  unsafeDollarResponse.payload.details,
  { fields: ['overrides'] },
  'removed keys use the safe overrides marker'
);
equal(
  JSON.stringify(unsafeDollarResponse.payload).includes(unsafeDollarValue),
  false,
  'the stable error does not expose the removed value'
);

const unsafeDottedRequest = await runMongoSanitize(
  createMockRequest({
    body: {
      locale: 'ur',
      overrides: {
        'publicationState.value': 'private-dotted-value',
        $set: 'second-private-value',
      },
    },
  })
);
equal(
  Object.hasOwn(unsafeDottedRequest.body.overrides, 'publicationState.value'),
  false,
  'installed sanitizer removes a dotted override key'
);
const unsafeDottedResponse = await invokeJobTranslation(unsafeDottedRequest);
deepEqual(
  unsafeDottedResponse.payload.details,
  { fields: ['overrides'] },
  'multiple removed keys produce one bounded safe marker'
);
equal(
  JSON.stringify(unsafeDottedResponse.payload).includes('private-dotted-value'),
  false,
  'multiple-key rejection exposes no sanitized value'
);

const unsafeQueryRequest = await runMongoSanitize(
  createMockRequest({
    body: { locale: 'ur', overrides: { title: 'Safe title' } },
    query: { $where: 'private-query-value' },
  })
);
equal(
  Object.hasOwn(unsafeQueryRequest.query, '$where'),
  false,
  'installed sanitizer removes unsafe query keys'
);
deepEqual(
  getMongoSanitizeEvidence(unsafeQueryRequest),
  { body: false, params: false, query: true, headers: false },
  'query sanitization is distinguished from body evidence'
);
equal(
  resolveTranslationOverrides(unsafeQueryRequest, 'job').ok,
  true,
  'query sanitization alone does not reject a safe Job body'
);

const unsafeParamsRequest = await runMongoSanitize(
  createMockRequest({
    body: { locale: 'ur', overrides: { title: 'Safe title' } },
    params: { $bad: 'private-parameter-value' },
  })
);
equal(
  Object.hasOwn(unsafeParamsRequest.params, '$bad'),
  false,
  'installed sanitizer removes unsafe parameter keys'
);
deepEqual(
  getMongoSanitizeEvidence(unsafeParamsRequest),
  { body: false, params: true, query: false, headers: false },
  'parameter sanitization is distinguished from body evidence'
);
equal(
  resolveTranslationOverrides(unsafeParamsRequest, 'job').ok,
  true,
  'parameter sanitization alone does not reject a safe Job body'
);

const clientMarkerRequest = createMockRequest({
  body: { locale: 'ur', overrides: { title: 'Safe title' } },
});
clientMarkerRequest.mongoSanitizeEvidence = { body: true };
equal(
  hasSanitizedBodyEvidence(clientMarkerRequest),
  false,
  'a client-visible property cannot forge private sanitizer evidence'
);

const firstUnsafe = await runMongoSanitize(
  createMockRequest({ body: { overrides: { $set: 'first' } } })
);
const followingSafe = await runMongoSanitize(
  createMockRequest({ body: { overrides: { title: 'safe' } } })
);
equal(
  hasSanitizedBodyEvidence(firstUnsafe),
  true,
  'unsafe sequential request retains its own evidence'
);
equal(
  hasSanitizedBodyEvidence(followingSafe),
  false,
  'unsafe evidence does not leak to a following safe request'
);

const leadingSafe = await runMongoSanitize(
  createMockRequest({ body: { overrides: { title: 'safe' } } })
);
const secondUnsafe = await runMongoSanitize(
  createMockRequest({ body: { overrides: { 'bad.key': 'second' } } })
);
equal(
  hasSanitizedBodyEvidence(leadingSafe),
  false,
  'a leading safe request remains clean'
);
equal(
  hasSanitizedBodyEvidence(secondUnsafe),
  true,
  'a following unsafe request records only its own evidence'
);

const concurrentSafe = createMockRequest({
  body: { overrides: { title: 'concurrent safe' } },
});
const concurrentUnsafe = createMockRequest({
  body: { overrides: { $set: 'concurrent unsafe' } },
});
await Promise.all([
  runMongoSanitize(concurrentSafe),
  runMongoSanitize(concurrentUnsafe),
]);
equal(
  hasSanitizedBodyEvidence(concurrentSafe),
  false,
  'concurrent safe request remains clean'
);
equal(
  hasSanitizedBodyEvidence(concurrentUnsafe),
  true,
  'concurrent unsafe request retains isolated evidence'
);

const unrelatedRequest = await runMongoSanitize(
  createMockRequest({
    entityType: 'notice',
    body: { locale: 'ur', unrelated: 'safe' },
  })
);
equal(
  hasSanitizedBodyEvidence(unrelatedRequest),
  false,
  'unrelated safe endpoints continue without body evidence'
);
const nonJobUnsafeRequest = await runMongoSanitize(
  createMockRequest({
    entityType: 'page',
    body: { locale: 'ur', overrides: { $set: 'removed' } },
  })
);
const nonJobResolution = resolveTranslationOverrides(
  nonJobUnsafeRequest,
  'page'
);
equal(
  nonJobResolution.ok,
  true,
  'non-Job translations do not consume the Job-only evidence boundary'
);
deepEqual(
  nonJobResolution.overrides,
  {},
  'non-Job translation behavior retains the sanitized override object'
);

const manyUnknownFields = Object.fromEntries(
  Array.from({ length: 25 }, (_, index) => [
    `unknown${String(index).padStart(2, '0')}`,
    index,
  ])
);
const bounded = validateJobTranslationOverrides(manyUnknownFields);
equal(bounded.ok, false, 'unknown fields fail');
equal(
  bounded.forbiddenFields.length,
  20,
  'error details are capped at 20 fields'
);
deepEqual(
  bounded.forbiddenFields,
  [...bounded.forbiddenFields].sort(),
  'error details are sorted'
);
equal(
  new Set(bounded.forbiddenFields).size,
  bounded.forbiddenFields.length,
  'error details are unique'
);
equal(
  JSON.stringify(bounded).includes('unknown-value-secret'),
  false,
  'no supplied value is echoed'
);

const symbolOverrides = { title: 'Allowed' };
Object.defineProperty(symbolOverrides, Symbol('unsafe'), {
  value: 'secret',
  enumerable: true,
});
const symbolResult = validateJobTranslationOverrides(symbolOverrides);
equal(symbolResult.ok, false, 'symbol keys fail safely');
deepEqual(
  symbolResult.forbiddenFields,
  ['overrides'],
  'symbol keys use the safe marker'
);

const accessorOverrides = {};
Object.defineProperty(accessorOverrides, 'title', {
  enumerable: true,
  get() {
    throw new Error('accessor must not execute');
  },
});
const accessorResult = validateJobTranslationOverrides(accessorOverrides);
equal(accessorResult.ok, false, 'accessor properties fail without executing');
deepEqual(
  accessorResult.forbiddenFields,
  ['title'],
  'accessor field name is reported safely'
);

const source = {
  ...sourceOnlyValues,
  ...translatedValues,
  publicationState: 'active',
  publicationVersion: 8,
  currentSubmissionId: new mongoose.Types.ObjectId(),
  lastApprovedSubmissionId: new mongoose.Types.ObjectId(),
  publishedAt: new Date(),
  visibleUntil: new Date(),
  applicationsCloseAt: new Date(),
  closedAt: new Date(),
  expiredAt: new Date(),
  rejectionSummary: { reasonCode: 'PRIVATE', ownerMessage: 'private' },
  slugFrozenAt: new Date(),
  policyVersion: 'private-policy',
  publicationUpdatedAt: new Date(),
  publicationMigrationStatus: 'canonical_native',
  status: 'active',
  approvalStatus: 'approved',
  planId: new mongoose.Types.ObjectId(),
  planType: 'premium',
  expiresAt: new Date(),
  paidUntil: new Date(),
  views: 99,
  applicationsCount: 42,
  isFeatured: true,
  isSponsored: true,
  priority: 10,
  urgent: true,
  boostLevel: 4,
  source: 'scraper',
  sourceUrl: 'https://private.example.test/source',
  sourceWebsite: 'Private Source',
  scrapedAt: new Date(),
  externalId: 'private-external-id',
  locale: 'en',
  translationGroupId: 'private-group',
  translationOf: new mongoose.Types.ObjectId(),
  translationStatus: 'published',
  slug: 'private-slug',
  _id: new mongoose.Types.ObjectId(),
  __v: 7,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const translatedProjection = buildJobTranslationProjection(source, {
  title: 'Translated title',
  requirements: ['Translated requirement'],
});
deepEqual(
  JOB_TRANSLATION_OVERRIDE_FIELDS,
  [
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
  ],
  'translation override field list remains unchanged'
);
deepEqual(
  JOB_TRANSLATION_SOURCE_FIELDS,
  [
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
  ],
  'translation source field list remains unchanged'
);
equal(
  translatedProjection.title,
  'Translated title',
  'validated overrides replace source text'
);
deepEqual(
  translatedProjection.requirements,
  ['Translated requirement'],
  'validated translated arrays replace source arrays'
);
for (const field of JOB_TRANSLATION_SOURCE_FIELDS) {
  if (field === 'employerId' || field === 'postedBy') {
    equal(
      translatedProjection[field],
      source[field].toHexString(),
      `${field} is copied as an equivalent canonical identifier string`
    );
  } else {
    deepEqual(
      translatedProjection[field],
      source[field],
      `${field} is copied from the source`
    );
  }
}
ok(
  translatedProjection.deadline !== source.deadline,
  'translation deadline has distinct identity'
);
ok(
  translatedProjection.employerId !== source.employerId,
  'translation employer identifier has no shared object identity'
);
ok(
  translatedProjection.postedBy !== source.postedBy,
  'translation postedBy identifier has no shared object identity'
);
for (const field of CANONICAL_JOB_PUBLICATION_FIELDS) {
  equal(
    Object.hasOwn(translatedProjection, field),
    false,
    `${field} is not copied into translations`
  );
}
for (const field of [
  'status',
  'approvalStatus',
  'planId',
  'planType',
  'expiresAt',
  'paidUntil',
  'views',
  'applicationsCount',
  'isFeatured',
  'isSponsored',
  'priority',
  'urgent',
  'boostLevel',
  'source',
  'sourceUrl',
  'sourceWebsite',
  'scrapedAt',
  'externalId',
  'locale',
  'translationGroupId',
  'translationOf',
  'translationStatus',
  'slug',
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
]) {
  equal(
    Object.hasOwn(translatedProjection, field),
    false,
    `${field} is excluded from translations`
  );
}

const duplicateProjection = buildJobDuplicateProjection(source);
for (const field of [
  ...JOB_TRANSLATION_OVERRIDE_FIELDS,
  ...JOB_TRANSLATION_SOURCE_FIELDS,
]) {
  if (field === 'employerId' || field === 'postedBy') {
    equal(
      duplicateProjection[field],
      source[field].toHexString(),
      `${field} is retained as an equivalent canonical identifier string`
    );
  } else {
    deepEqual(
      duplicateProjection[field],
      source[field],
      `${field} is retained for an editable duplicate`
    );
  }
}
ok(
  duplicateProjection.deadline !== source.deadline,
  'duplicate deadline has distinct identity'
);
ok(
  duplicateProjection.employerId !== source.employerId,
  'duplicate employer identifier has no shared object identity'
);
ok(
  duplicateProjection.postedBy !== source.postedBy,
  'duplicate postedBy identifier has no shared object identity'
);
for (const field of CANONICAL_JOB_PUBLICATION_FIELDS) {
  equal(
    Object.hasOwn(duplicateProjection, field),
    false,
    `${field} is excluded from duplicates`
  );
}
for (const field of [
  'approvalStatus',
  'planId',
  'planType',
  'expiresAt',
  'paidUntil',
  'views',
  'applicationsCount',
  'isFeatured',
  'isSponsored',
  'priority',
  'urgent',
  'boostLevel',
  'source',
  'sourceUrl',
  'sourceWebsite',
  'scrapedAt',
  'externalId',
  'locale',
  'translationGroupId',
  'translationOf',
  'translationStatus',
  'slug',
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
]) {
  equal(
    Object.hasOwn(duplicateProjection, field),
    false,
    `${field} is excluded from duplicates`
  );
}

const isolationSourceDeadline = new Date('2026-09-15T12:30:00.000Z');
const isolationEmployerId = new mongoose.Types.ObjectId();
const isolationPostedBy = new mongoose.Types.ObjectId();
const nestedDate = new Date('2026-09-20T00:00:00.000Z');
const nestedObjectId = new mongoose.Types.ObjectId();
const isolationSource = {
  deadline: isolationSourceDeadline,
  employerId: isolationEmployerId,
  postedBy: isolationPostedBy,
  skillsRequired: ['Node.js', ['nested skill']],
  gallery: [
    {
      label: 'office',
      metadata: {
        dates: [nestedDate],
        owners: [nestedObjectId],
      },
    },
  ],
};
const isolatedTranslation = buildJobTranslationProjection(isolationSource);
const isolatedDuplicate = buildJobDuplicateProjection(isolationSource);

equal(
  isolatedTranslation.deadline.getTime(),
  isolationSourceDeadline.getTime(),
  'translation Date preserves its exact timestamp'
);
equal(
  isolatedDuplicate.deadline.getTime(),
  isolationSourceDeadline.getTime(),
  'duplicate Date preserves its exact timestamp'
);
ok(
  isolatedTranslation.deadline !== isolationSourceDeadline,
  'translation Date is a distinct instance'
);
ok(
  isolatedDuplicate.deadline !== isolationSourceDeadline,
  'duplicate Date is a distinct instance'
);
equal(
  isolatedTranslation.employerId,
  isolationEmployerId.toHexString(),
  'translation ObjectId is normalized to the equivalent canonical string'
);
equal(
  isolatedDuplicate.employerId,
  isolationEmployerId.toHexString(),
  'duplicate ObjectId is normalized to the equivalent canonical string'
);
equal(
  isolatedTranslation.postedBy,
  isolationPostedBy.toHexString(),
  'translation postedBy is normalized to the equivalent canonical string'
);
equal(
  isolatedDuplicate.postedBy,
  isolationPostedBy.toHexString(),
  'duplicate postedBy is normalized to the equivalent canonical string'
);
ok(
  isolatedTranslation.skillsRequired !== isolationSource.skillsRequired,
  'translation arrays are independently cloned'
);
ok(
  isolatedDuplicate.skillsRequired !== isolationSource.skillsRequired,
  'duplicate arrays are independently cloned'
);
ok(
  isolatedTranslation.skillsRequired[1] !== isolationSource.skillsRequired[1],
  'nested translation arrays are independently cloned'
);
ok(
  isolatedDuplicate.gallery[0] !== isolationSource.gallery[0],
  'nested duplicate plain objects are independently cloned'
);
ok(
  isolatedTranslation.gallery[0].metadata !==
    isolationSource.gallery[0].metadata,
  'deep translation plain objects are independently cloned'
);
ok(
  isolatedDuplicate.gallery[0].metadata.dates !==
    isolationSource.gallery[0].metadata.dates,
  'deep duplicate arrays are independently cloned'
);
ok(
  isolatedTranslation.gallery[0].metadata.dates[0] !== nestedDate,
  'nested translation Dates have distinct identity'
);
equal(
  isolatedTranslation.gallery[0].metadata.dates[0].getTime(),
  nestedDate.getTime(),
  'nested translation Dates preserve their timestamp'
);
equal(
  isolatedDuplicate.gallery[0].metadata.owners[0],
  nestedObjectId.toHexString(),
  'nested duplicate ObjectIds use canonical strings'
);

isolatedTranslation.deadline.setUTCFullYear(2030);
equal(
  isolationSourceDeadline.getUTCFullYear(),
  2026,
  'mutating a translated Date does not mutate the source Date'
);
isolatedDuplicate.deadline.setUTCFullYear(2031);
equal(
  isolationSourceDeadline.getUTCFullYear(),
  2026,
  'mutating a duplicate Date does not mutate the source Date'
);
isolationSourceDeadline.setUTCFullYear(2027);
equal(
  isolatedTranslation.deadline.getUTCFullYear(),
  2030,
  'mutating the source Date does not mutate the translation'
);
equal(
  isolatedDuplicate.deadline.getUTCFullYear(),
  2031,
  'mutating the source Date does not mutate the duplicate'
);

isolatedTranslation.skillsRequired[0] = 'Changed projection';
equal(
  isolationSource.skillsRequired[0],
  'Node.js',
  'mutating a projection array does not mutate the source'
);
isolationSource.skillsRequired[1][0] = 'Changed source';
equal(
  isolatedTranslation.skillsRequired[1][0],
  'nested skill',
  'mutating a nested source array does not mutate the translation'
);
isolatedDuplicate.gallery[0].metadata.dates[0].setUTCFullYear(2035);
equal(
  nestedDate.getUTCFullYear(),
  2026,
  'mutating a nested projected Date does not mutate the source'
);
isolationSource.gallery[0].metadata.label = 'changed source';
equal(
  isolatedTranslation.gallery[0].metadata.label,
  undefined,
  'source-only nested mutation does not appear in an existing projection'
);

class UnsupportedProjectionValue {}
throws(
  () =>
    buildJobTranslationProjection({
      company: new UnsupportedProjectionValue(),
    }),
  /Unsupported projection value at company/,
  'unsupported custom classes fail safely'
);
throws(
  () =>
    buildJobDuplicateProjection({
      deadline: new Date(Number.NaN),
    }),
  /Unsupported projection value at deadline/,
  'invalid Dates fail safely'
);
const circularValue = {};
circularValue.self = circularValue;
throws(
  () => buildJobDuplicateProjection({ gallery: [circularValue] }),
  /Unsupported projection value at gallery\[0\]\.self/,
  'circular structured values fail safely'
);
throws(
  () =>
    buildJobTranslationProjection({
      gallery: [JSON.parse('{"$set":"unsafe"}')],
    }),
  /Unsupported projection value at gallery\[0\]/,
  'dollar-prefixed nested keys fail safely'
);
throws(
  () =>
    buildJobDuplicateProjection({
      gallery: [JSON.parse('{"__proto__":"unsafe"}')],
    }),
  /Unsupported projection value at gallery\[0\]/,
  'prototype-pollution keys fail safely'
);

const modelInput = {
  ...translatedProjection,
  slug: 'translated-title-ur',
  locale: 'ur',
  translationGroupId: 'translation-group',
  translationOf: new mongoose.Types.ObjectId(),
  translationStatus: 'needs_translation',
  status: 'draft',
  approvalStatus: 'pending',
};
const translatedJob = new Job(modelInput);
await translatedJob.validate();
assertions += 1;
equal(
  translatedJob.employerId.toHexString(),
  source.employerId.toHexString(),
  'normal Job construction casts the projected employer identifier'
);
equal(
  translatedJob.postedBy.toHexString(),
  source.postedBy.toHexString(),
  'normal Job construction casts the projected postedBy identifier'
);
const duplicateJob = new Job({
  ...duplicateProjection,
  slug: 'duplicate-title',
  status: 'draft',
  approvalStatus: 'pending',
});
await duplicateJob.validate();
assertions += 1;
equal(
  duplicateJob.employerId.toHexString(),
  source.employerId.toHexString(),
  'normal duplicate Job construction preserves employer identifier semantics'
);

const serviceSource = readFileSync(
  new URL('../services/localization/TranslationService.js', import.meta.url),
  'utf8'
);
const controllerSource = readFileSync(
  new URL('../controllers/admin/translationController.js', import.meta.url),
  'utf8'
);
const adminJobSource = readFileSync(
  new URL('../controllers/admin/adminJobsController.js', import.meta.url),
  'utf8'
);
const routeSource = readFileSync(
  new URL('../routes/admin.js', import.meta.url),
  'utf8'
);
const indexSource = readFileSync(
  new URL('../index.js', import.meta.url),
  'utf8'
);
const boundarySource = readFileSync(
  new URL('../services/jobWriteBoundary.js', import.meta.url),
  'utf8'
);

ok(
  serviceSource.includes('buildJobTranslationProjection'),
  'translation uses the positive projection'
);
ok(
  serviceSource.includes("if (entityType === 'job')"),
  'the corrected construction is restricted to Job translations'
);
ok(serviceSource.includes("status: 'draft'"), 'Job translations remain draft');
ok(
  serviceSource.includes("approvalStatus: 'pending'"),
  'Job translations receive safe approval state'
);
ok(
  serviceSource.includes('await doc.save()'),
  'normal document validation and hooks remain in use'
);
ok(
  serviceSource.includes('...plain') && serviceSource.includes('...overrides'),
  'non-Job construction retains its existing spread behavior'
);
ok(
  adminJobSource.includes('buildJobDuplicateProjection(source)'),
  'duplicate uses its projection'
);
equal(
  adminJobSource.includes('const doc = new Job(source)'),
  false,
  'duplicate no longer constructs a Job from the complete source'
);
ok(
  controllerSource.includes("code: 'TRANSLATION_OVERRIDE_FIELDS_FORBIDDEN'"),
  'controller exposes the stable error code'
);
ok(controllerSource.includes('res.status(400)'), 'controller returns HTTP 400');
ok(
  controllerSource.includes('hasSanitizedBodyEvidence(req)'),
  'controller consumes private request-local sanitizer evidence'
);
ok(
  indexSource.includes('createMongoSanitizeOptions()'),
  'startup uses the shared sanitizer options factory'
);
equal(
  indexSource.includes('onSanitize:'),
  false,
  'startup does not duplicate the sanitizer callback'
);
ok(
  boundarySource.includes(
    "const MONGO_SANITIZE_EVIDENCE = Symbol('strideto.mongoSanitizeEvidence')"
  ),
  'sanitizer evidence uses a private Symbol'
);
ok(
  boundarySource.includes('recordMongoSanitizeEvidence'),
  'the boundary owns the shared sanitizer evidence callback'
);
ok(
  routeSource.includes(
    "adminRouter.post('/translations/:entityType/:id', requirePermission(PERMISSIONS.CONTENT_SITE), translationAdmin.createTranslation)"
  ),
  'translation authorization remains CONTENT_SITE'
);
equal(
  boundarySource.includes("from 'express'"),
  false,
  'pure boundary imports no Express code'
);
equal(
  boundarySource.includes('mongoose'),
  false,
  'pure boundary imports no Mongoose model'
);
equal(
  boundarySource.includes('payment'),
  false,
  'pure boundary imports no payment code'
);
equal(
  boundarySource.includes('.save('),
  false,
  'pure boundary performs no persistence'
);
equal(
  serviceSource.includes("status: 'active'"),
  false,
  'translation creates no public activation'
);

console.log(
  `canonicalJobWriteBoundary.test.js: ${assertions} assertions passed`
);
