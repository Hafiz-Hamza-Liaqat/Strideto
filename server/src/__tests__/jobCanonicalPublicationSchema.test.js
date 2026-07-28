/**
 * Dormant additive canonical Job publication schema tests (E.1F-H2B-B1-B).
 * Run: node src/__tests__/jobCanonicalPublicationSchema.test.js
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';

const canonicalFields = [
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
];

const canonicalStates = [
  'draft',
  'pending_review',
  'active',
  'rejected',
  'closed',
  'expired',
];

const migrationStatuses = [
  'canonical_native',
  'legacy_backfilled',
  'legacy_compatible',
  'manual_review',
];

const id = () => new mongoose.Types.ObjectId();
const publishedAt = new Date('2026-07-28T12:00:00.000Z');
const visibleUntil = new Date('2026-08-27T12:00:00.000Z');
const applicationsCloseAt = new Date('2026-08-20T12:00:00.000Z');
let assertions = 0;

function legacyJob(overrides = {}) {
  return {
    title: 'Backend Engineer',
    slug: 'backend-engineer-lahore',
    company: 'Example Company',
    ...overrides,
  };
}

function pendingProjection(overrides = {}) {
  return legacyJob({
    publicationState: 'pending_review',
    publicationVersion: 1,
    currentSubmissionId: id(),
    policyVersion: 'free-beta-2026-01',
    ...overrides,
  });
}

function activeProjection(overrides = {}) {
  const submissionId = id();
  return legacyJob({
    publicationState: 'active',
    publicationVersion: 2,
    currentSubmissionId: submissionId,
    lastApprovedSubmissionId: submissionId,
    publishedAt,
    visibleUntil,
    applicationsCloseAt,
    slugFrozenAt: publishedAt,
    policyVersion: 'free-beta-2026-01',
    ...overrides,
  });
}

function rejectedProjection(overrides = {}) {
  return legacyJob({
    publicationState: 'rejected',
    publicationVersion: 2,
    currentSubmissionId: id(),
    policyVersion: 'free-beta-2026-01',
    rejectionSummary: {
      reasonCode: 'CONTENT_POLICY',
      ownerMessage: 'Please revise the employer-facing listing content.',
      eventId: id(),
      decidedAt: new Date('2026-07-28T13:00:00.000Z'),
    },
    ...overrides,
  });
}

async function accepts(value, message) {
  await new Job(value).validate();
  assertions += 1;
  assert.ok(true, message);
}

async function rejects(value, matcher, message) {
  await assert.rejects(new Job(value).validate(), matcher, message);
  assertions += 1;
}

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

await accepts(legacyJob(), 'legacy Jobs remain valid');

const ordinaryLegacyJob = new Job(legacyJob());
const ordinaryLegacyObject = ordinaryLegacyJob.toObject();
for (const field of canonicalFields) {
  equal(
    Object.hasOwn(ordinaryLegacyObject, field),
    false,
    `${field} must not be eagerly persisted`
  );
  equal(
    Job.schema.path(field).options.default,
    undefined,
    `${field} must not have an eager default`
  );
}

await accepts(
  legacyJob({
    publicationState: null,
    publicationVersion: null,
    currentSubmissionId: null,
    lastApprovedSubmissionId: null,
    publishedAt: null,
    visibleUntil: null,
    applicationsCloseAt: null,
    closedAt: null,
    expiredAt: null,
    rejectionSummary: null,
    slugFrozenAt: null,
    policyVersion: null,
    publicationUpdatedAt: null,
    publicationMigrationStatus: null,
  }),
  'explicit nullable compatibility values remain valid'
);

const validStateProjections = {
  draft: legacyJob({ publicationState: 'draft', publicationVersion: 0 }),
  pending_review: pendingProjection(),
  active: activeProjection(),
  rejected: rejectedProjection(),
  closed: legacyJob({
    publicationState: 'closed',
    publicationVersion: 3,
    closedAt: new Date('2026-07-28T14:00:00.000Z'),
  }),
  expired: legacyJob({
    publicationState: 'expired',
    publicationVersion: 3,
    expiredAt: new Date('2026-08-27T12:00:00.000Z'),
  }),
};

for (const state of canonicalStates) {
  await accepts(
    validStateProjections[state],
    `canonical state ${state} must validate`
  );
}

await rejects(
  legacyJob({ publicationState: 'changes_required', publicationVersion: 0 }),
  /is not a valid enum value/,
  'unknown canonical states must fail'
);
await rejects(
  legacyJob({ publicationState: 'draft' }),
  /publicationVersion.*required/,
  'canonical state requires an explicit publication version'
);
await accepts(
  legacyJob({ publicationState: 'draft', publicationVersion: 0 }),
  'zero is a valid initial publication version'
);
await accepts(
  legacyJob({ publicationState: 'draft', publicationVersion: 42 }),
  'positive integer publication versions are valid'
);
await rejects(
  legacyJob({ publicationState: 'draft', publicationVersion: -1 }),
  /less than minimum allowed value/,
  'negative publication versions must fail'
);
await rejects(
  legacyJob({ publicationState: 'draft', publicationVersion: 1.5 }),
  /publicationVersion must be an integer/,
  'fractional publication versions must fail'
);
await rejects(
  legacyJob({ publicationState: 'draft', publicationVersion: 'not-a-number' }),
  /Cast to Number failed/,
  'non-numeric publication versions must fail'
);

const validCurrentSubmissionId = id();
const validApprovedSubmissionId = id();
await accepts(
  activeProjection({
    currentSubmissionId: validCurrentSubmissionId,
    lastApprovedSubmissionId: validApprovedSubmissionId,
  }),
  'valid submission ObjectIds are accepted'
);
await rejects(
  pendingProjection({ currentSubmissionId: 'malformed-submission-id' }),
  /Cast to ObjectId failed/,
  'malformed current submission IDs must fail'
);
await rejects(
  activeProjection({ lastApprovedSubmissionId: 'malformed-submission-id' }),
  /Cast to ObjectId failed/,
  'malformed approved submission IDs must fail'
);
equal(
  Job.schema.path('currentSubmissionId').options.ref,
  'JobPublicationSubmission',
  'current submission uses the immutable submission model'
);
equal(
  Job.schema.path('lastApprovedSubmissionId').options.ref,
  'JobPublicationSubmission',
  'last approved submission uses the immutable submission model'
);

await accepts(pendingProjection(), 'a complete pending projection is valid');
await rejects(
  pendingProjection({ currentSubmissionId: undefined }),
  /currentSubmissionId.*required/,
  'pending review requires the current submission'
);
await rejects(
  pendingProjection({ policyVersion: undefined }),
  /policyVersion.*required/,
  'pending review requires the accepted policy version'
);

await accepts(activeProjection(), 'a complete active projection is valid');
for (const field of [
  'currentSubmissionId',
  'lastApprovedSubmissionId',
  'publishedAt',
  'visibleUntil',
  'applicationsCloseAt',
  'slugFrozenAt',
  'policyVersion',
]) {
  await rejects(
    activeProjection({ [field]: undefined }),
    new RegExp(`${field}.*required`),
    `active projection requires ${field}`
  );
}

await rejects(
  activeProjection({
    visibleUntil: new Date('2026-07-28T11:59:59.999Z'),
    applicationsCloseAt: new Date('2026-07-28T11:59:59.999Z'),
  }),
  /visibleUntil cannot be earlier than publishedAt/,
  'visibility cannot end before it starts'
);
await accepts(
  activeProjection({
    visibleUntil: publishedAt,
    applicationsCloseAt: publishedAt,
  }),
  'an inclusive zero-length schema boundary remains deterministic'
);
await accepts(activeProjection(), 'a valid visibility range passes');
await rejects(
  activeProjection({
    applicationsCloseAt: new Date('2026-08-27T12:00:00.001Z'),
  }),
  /applicationsCloseAt cannot be later than visibleUntil/,
  'applications cannot remain open after visibility ends'
);

await accepts(
  rejectedProjection(),
  'rejected state accepts the strict employer-safe summary'
);
await rejects(
  rejectedProjection({ rejectionSummary: undefined }),
  /rejectionSummary.*required/,
  'rejected state requires the safe summary'
);
await rejects(
  rejectedProjection({
    rejectionSummary: {
      reasonCode: 'CONTENT_POLICY',
      ownerMessage: 'Please revise the listing.',
      eventId: id(),
      decidedAt: new Date('2026-07-28T13:00:00.000Z'),
      reasonTextInternal: 'private staff text',
    },
  }),
  /Cast to Embedded failed/,
  'internal moderation text is rejected safely'
);
await rejects(
  rejectedProjection({
    rejectionSummary: {
      reasonCode: 'CONTENT_POLICY',
      ownerMessage: 'Please revise the listing.',
      eventId: id(),
      decidedAt: new Date('2026-07-28T13:00:00.000Z'),
      metadata: { rawRequest: true },
    },
  }),
  /Cast to Embedded failed/,
  'arbitrary rejection metadata is rejected safely'
);
equal(
  Job.schema.path('rejectionSummary').schema.options.strict,
  'throw',
  'rejection summary uses strict allow-listing'
);
equal(
  Job.schema.path('rejectionSummary.reasonTextInternal'),
  undefined,
  'staff-internal rejection text is not in the schema'
);
equal(
  Job.schema.path('rejectionSummary.metadata'),
  undefined,
  'arbitrary rejection metadata is not in the schema'
);

await accepts(
  legacyJob({
    publicationState: 'closed',
    publicationVersion: 3,
    closedAt: new Date('2026-07-28T14:00:00.000Z'),
  }),
  'closed state accepts closure evidence'
);
await rejects(
  legacyJob({ publicationState: 'closed', publicationVersion: 3 }),
  /closedAt.*required/,
  'closed state requires closure evidence'
);
await accepts(
  legacyJob({
    publicationState: 'expired',
    publicationVersion: 3,
    expiredAt: new Date('2026-08-27T12:00:00.000Z'),
  }),
  'expired state accepts expiry evidence'
);
await rejects(
  legacyJob({ publicationState: 'expired', publicationVersion: 3 }),
  /expiredAt.*required/,
  'expired state requires expiry evidence'
);

for (const status of migrationStatuses) {
  await accepts(
    legacyJob({ publicationMigrationStatus: status }),
    `migration status ${status} must validate`
  );
}
await rejects(
  legacyJob({ publicationMigrationStatus: 'automatically_migrated' }),
  /is not a valid enum value/,
  'unknown migration classifications must fail'
);

await accepts(
  activeProjection({ slugFrozenAt: new Date('2026-07-28T12:00:00.000Z') }),
  'valid slug freeze evidence is accepted'
);
await rejects(
  activeProjection({ slugFrozenAt: 'not-a-date' }),
  /Cast to date failed/,
  'malformed slug freeze evidence fails'
);
equal(
  Job.schema.path('publicationPlanCode'),
  undefined,
  'Job-level publication plan code is prohibited'
);
equal(
  Job.schema.path('moderationCycleId'),
  undefined,
  'Job-level moderation cycle is prohibited'
);
equal(
  Job.schema.path('paymentState'),
  undefined,
  'payment state is not part of the canonical Job projection'
);

deepEqual(Job.schema.path('status').enumValues, ['draft', 'active', 'closed']);
equal(Job.schema.path('status').options.default, 'active');
deepEqual(Job.schema.path('approvalStatus').enumValues, [
  'pending',
  'approved',
  'rejected',
]);
equal(Job.schema.path('approvalStatus').options.default, 'approved');
deepEqual(Job.schema.path('planType').enumValues, [
  'free',
  'starter',
  'standard',
  'premium',
]);
equal(Job.schema.path('planType').options.default, null);
equal(Job.schema.path('slug').options.required, true);
equal(Job.schema.path('applyType').options.default, 'external');
equal(Job.schema.path('applicationLink').instance, 'String');
equal(Job.schema.path('applyEmail').instance, 'String');
equal(Job.schema.path('deadline').instance, 'Date');
equal(Job.schema.path('expiresAt').instance, 'Date');

const expectedIndexes = [
  [{ externalId: 1 }, { unique: true, sparse: true, background: true }],
  [{ locale: 1 }, { background: true }],
  [{ translationGroupId: 1 }, { background: true }],
  [{ translationStatus: 1 }, { background: true }],
  [{ sourceWebsite: 1, status: 1 }, { background: true }],
  [{ status: 1, createdAt: -1 }, { background: true }],
  [{ status: 1, deadline: 1 }, { background: true }],
  [{ province: 1, status: 1 }, { background: true }],
  [{ category: 1, status: 1 }, { background: true }],
  [
    { title: 'text', company: 'text', location: 'text', province: 'text' },
    { background: true },
  ],
  [{ employerId: 1, status: 1 }, { background: true }],
  [{ status: 1, approvalStatus: 1 }, { background: true }],
  [{ expiresAt: 1 }, { background: true }],
  [
    { slug: 1, locale: 1 },
    { unique: true, background: true },
  ],
  [{ translationGroupId: 1, locale: 1 }, { background: true }],
];
deepEqual(
  Job.schema.indexes(),
  expectedIndexes,
  'the exact legacy index declaration set remains unchanged'
);
ok(
  Job.schema
    .indexes()
    .every(([fields]) =>
      canonicalFields.every((field) => !Object.hasOwn(fields, field))
    ),
  'no canonical publication index is declared'
);

equal(
  Job.schema.s.hooks._pres.get('save')?.length ?? 0,
  7,
  'the existing pre-save hook count remains unchanged'
);
equal(
  Job.schema.s.hooks._pres.get('validate')?.length ?? 0,
  0,
  'no validation middleware is registered'
);
deepEqual(
  [...Job.schema.s.hooks._posts.entries()].map(([name, handlers]) => [
    name,
    handlers.length,
  ]),
  [
    ['save', 3],
    ['init', 1],
  ],
  'the existing post-middleware set remains unchanged'
);

const jobSource = readFileSync(
  new URL('../models/Job.js', import.meta.url),
  'utf8'
);
const importSpecifiers = [...jobSource.matchAll(/from ['"]([^'"]+)['"]/g)].map(
  (match) => match[1]
);
deepEqual(importSpecifiers, [
  'mongoose',
  '../utils/slugify.js',
  './mixins/translationFields.js',
]);
equal(
  /services|controllers|routes|payment|outbox|JobPublicationSubmission\.js/.test(
    importSpecifiers.join('\n')
  ),
  false,
  'no runtime publication dependency is imported'
);

equal(
  Job.schema.path('publicationVersion').options.default,
  undefined,
  'publication CAS version is initialized only by a future writer'
);
ok(
  Job.schema.path('__v') !== Job.schema.path('publicationVersion'),
  'Mongoose __v remains unrelated to the publication CAS contract'
);
await accepts(
  legacyJob({
    publicationUpdatedAt: new Date('2026-07-28T15:00:00.000Z'),
  }),
  'publication update timestamps accept valid dates without defaults'
);
await rejects(
  legacyJob({ publicationUpdatedAt: 'not-a-date' }),
  /Cast to date failed/,
  'publication update timestamps reject malformed dates'
);

console.log(
  `jobCanonicalPublicationSchema tests passed (${assertions} assertions).`
);
