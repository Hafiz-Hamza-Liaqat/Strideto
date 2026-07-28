/**
 * Run: node src/__tests__/publishingSubmissionSupportModels.test.js
 */
import assert from 'assert';
import mongoose from 'mongoose';
import { EmployerPostingRulesAcknowledgement } from '../models/EmployerPostingRulesAcknowledgement.js';
import {
  JobModerationEvent,
  toEmployerSafeModerationEvent,
} from '../models/JobModerationEvent.js';

const id = () => new mongoose.Types.ObjectId();
const hash = (character) => character.repeat(64);

function indexByName(schema, name) {
  return schema.indexes().find(([, options]) => options?.name === name);
}

function acknowledgement(overrides = {}) {
  return {
    employerId: id(),
    jobId: id(),
    submissionId: id(),
    policyVersion: 'free-beta-2026-01',
    rulesVersion: 'employer-rules-2026-01',
    rulesDigest: hash('a'),
    accepted: true,
    acceptedAt: new Date('2026-07-28T12:00:00.000Z'),
    ...overrides,
  };
}

function moderationEvent(overrides = {}) {
  return {
    jobId: id(),
    submissionId: id(),
    employerId: id(),
    actorType: 'employer',
    actorId: id(),
    action: 'submitted',
    fromState: 'draft',
    toState: 'pending_review',
    contentHash: hash('b'),
    createdAt: new Date('2026-07-28T12:00:00.000Z'),
    ...overrides,
  };
}

await new EmployerPostingRulesAcknowledgement(acknowledgement()).validate();

await assert.rejects(
  new EmployerPostingRulesAcknowledgement(
    acknowledgement({ accepted: false })
  ).validate(),
  /accepted must be true/
);

assert.strictEqual(
  EmployerPostingRulesAcknowledgement.schema.options.strict,
  'throw'
);
assert.strictEqual(
  EmployerPostingRulesAcknowledgement.schema.path('sourceIpHash').instance,
  'String'
);
assert.strictEqual(
  EmployerPostingRulesAcknowledgement.schema.path('userAgentHash').instance,
  'String'
);
assert.strictEqual(
  EmployerPostingRulesAcknowledgement.schema.path('rawIpAddress'),
  undefined
);
assert.strictEqual(
  EmployerPostingRulesAcknowledgement.schema.path('rawUserAgent'),
  undefined
);
assert.throws(
  () =>
    new EmployerPostingRulesAcknowledgement({
      ...acknowledgement(),
      rawIpAddress: 'synthetic-private-value',
    }),
  /strict mode/
);
assert.throws(
  () =>
    new EmployerPostingRulesAcknowledgement({
      ...acknowledgement(),
      request: { body: 'not-allowed' },
    }),
  /strict mode/
);

const uniqueSubmission = indexByName(
  EmployerPostingRulesAcknowledgement.schema,
  'posting_rules_acknowledgement_submission_unique'
);
assert.ok(uniqueSubmission);
assert.deepStrictEqual(uniqueSubmission[0], { submissionId: 1 });
assert.strictEqual(uniqueSubmission[1].unique, true);
assert.ok(
  EmployerPostingRulesAcknowledgement.schema
    .indexes()
    .some(([fields]) => fields.employerId === 1 && fields.acceptedAt === -1)
);
assert.ok(
  EmployerPostingRulesAcknowledgement.schema
    .indexes()
    .some(([fields]) => fields.rulesVersion === 1 && fields.acceptedAt === -1)
);

await new JobModerationEvent(moderationEvent()).validate();

await assert.rejects(
  new JobModerationEvent(
    moderationEvent({ actorType: 'staff', actorId: null })
  ).validate(),
  /actorId is required/
);
await new JobModerationEvent(
  moderationEvent({ actorType: 'system', actorId: null, action: 'expired' })
).validate();

await assert.rejects(
  new JobModerationEvent(
    moderationEvent({
      actorType: 'staff',
      action: 'rejected',
      reasonCode: 'CONTENT_POLICY',
      reasonTextEmployer: null,
    })
  ).validate(),
  /reasonTextEmployer is required/
);

await new JobModerationEvent(
  moderationEvent({
    actorType: 'staff',
    action: 'changes_requested',
    reasonCode: 'PROFILE_DETAIL',
    reasonTextInternal: 'Staff-only investigation context',
    reasonTextEmployer: 'Please correct the education requirement.',
    requestedFieldPaths: ['educationRequirement'],
    metadata: { moderationCycleId: id() },
    toState: 'rejected',
  })
).validate();

await assert.rejects(
  new JobModerationEvent(
    moderationEvent({
      actorType: 'staff',
      action: 'rejected',
      reasonCode: 'CONTENT_POLICY',
      reasonTextEmployer: 'The listing needs correction.',
      toState: 'rejected',
    })
  ).validate(),
  /metadata\.moderationCycleId is required/
);

await assert.rejects(
  new JobModerationEvent(
    moderationEvent({
      actorType: 'staff',
      action: 'changes_requested',
      reasonCode: 'PROFILE_DETAIL',
      reasonTextEmployer: 'Please correct the education requirement.',
      requestedFieldPaths: ['educationRequirement'],
      toState: 'rejected',
    })
  ).validate(),
  /metadata\.moderationCycleId is required/
);

await assert.rejects(
  new JobModerationEvent(
    moderationEvent({
      actorType: 'staff',
      action: 'changes_requested',
      reasonCode: 'PROFILE_DETAIL',
      reasonTextEmployer: 'Please correct the listing.',
      requestedFieldPaths: [],
      toState: 'rejected',
    })
  ).validate(),
  /requestedFieldPaths is required/
);

const employerProjection = toEmployerSafeModerationEvent(
  moderationEvent({
    action: 'rejected',
    reasonCode: 'CONTENT_POLICY',
    reasonTextInternal: 'Private staff note',
    reasonTextEmployer: 'The listing needs correction.',
    toState: 'rejected',
  })
);
assert.strictEqual(
  Object.hasOwn(employerProjection, 'reasonTextInternal'),
  false
);
assert.strictEqual(
  employerProjection.reasonTextEmployer,
  'The listing needs correction.'
);
assert.strictEqual(Object.hasOwn(employerProjection, 'metadata'), false);

assert.strictEqual(JobModerationEvent.schema.options.strict, 'throw');
assert.notStrictEqual(
  JobModerationEvent.schema.path('metadata').instance,
  'Mixed'
);
assert.strictEqual(JobModerationEvent.schema.path('request'), undefined);
assert.strictEqual(JobModerationEvent.schema.path('applicantId'), undefined);

await assert.rejects(
  new JobModerationEvent(
    moderationEvent({
      metadata: {
        quotaCharged: true,
        rawRequest: 'not-allowed',
      },
    })
  ).validate(),
  (error) =>
    error.errors?.metadata?.reason?.message ===
    'metadata.rawRequest is not an allowed moderation-event field'
);

const moderationIndexes = JobModerationEvent.schema.indexes();
assert.ok(
  moderationIndexes.some(
    ([fields]) => fields.jobId === 1 && fields.createdAt === 1
  )
);
assert.ok(
  moderationIndexes.some(
    ([fields]) => fields.submissionId === 1 && fields.createdAt === 1
  )
);
assert.ok(
  moderationIndexes.some(
    ([fields]) => fields.employerId === 1 && fields.createdAt === -1
  )
);
assert.ok(
  moderationIndexes.some(
    ([fields]) => fields.action === 1 && fields.createdAt === -1
  )
);

console.log('publishingSubmissionSupportModels tests passed.');
