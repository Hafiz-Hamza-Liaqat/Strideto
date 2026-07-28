/**
 * Quota usage read and serialized guard boundary tests (E.1F-H2A).
 * Run: node src/__tests__/publishingQuotaFoundations.test.js
 */
import assert from 'assert';
import {
  calculatePublishingQuotaUsage,
  countCanonicalActiveFreeJobs,
  getPublishingQuotaUsage,
} from '../services/publishing/PublishingQuotaUsageService.js';
import {
  acquirePublishingQuotaGuard,
  runWithSerializedPublishingQuota,
} from '../services/publishing/SerializedQuotaGuard.js';

const ownerId = '507f1f77bcf86cd799439011';
const now = new Date('2026-07-28T12:00:00.000Z');
const hour = 60 * 60 * 1000;
const day = 24 * hour;

const rollingUsage = calculatePublishingQuotaUsage({
  now,
  chargedAcceptedAt: [
    new Date(now.getTime() - hour),
    new Date(now.getTime() - day),
    new Date(now.getTime() - 29 * day),
    new Date(now.getTime() - 30 * day),
    new Date(now.getTime() + hour),
  ],
  activeFreeJobsUsed: 5,
});

assert.strictEqual(
  rollingUsage.daily.used,
  1,
  'exact 24-hour boundary must be excluded'
);
assert.strictEqual(
  rollingUsage.rolling30Days.used,
  3,
  'exact 30-day boundary must be excluded'
);
assert.strictEqual(
  rollingUsage.daily.nextEligibleAt.toISOString(),
  new Date(now.getTime() - hour + day).toISOString()
);
assert.strictEqual(rollingUsage.activeFreeJobs.planCode, 'free_beta');
assert.strictEqual(rollingUsage.activeFreeJobs.used, 5);
assert.strictEqual(rollingUsage.activeFreeJobs.hasCapacity, false);
assert.strictEqual(rollingUsage.approvalCapacity.hasCapacity, false);
assert.strictEqual(
  rollingUsage.approvalCapacity.warningCode,
  'ACTIVE_LIMIT_REACHED_AT_APPROVAL'
);
assert.strictEqual(
  rollingUsage.submissionBlockers.includes('ACTIVE_LIMIT_REACHED_AT_APPROVAL'),
  false,
  'active capacity must not block ordinary submission'
);

const tenChargedRows = Array.from(
  { length: 10 },
  (_, index) => new Date(now.getTime() - (index + 1) * day)
);
const monthlyFull = calculatePublishingQuotaUsage({
  now,
  chargedAcceptedAt: tenChargedRows,
  activeFreeJobsUsed: 0,
});
assert.strictEqual(monthlyFull.rolling30Days.used, 10);
assert.strictEqual(monthlyFull.rolling30Days.remaining, 0);
assert.strictEqual(
  monthlyFull.submissionBlockers.includes('ROLLING_30D_LIMIT'),
  true
);
assert.strictEqual(
  monthlyFull.rolling30Days.nextSlotAt.toISOString(),
  new Date(now.getTime() - 10 * day + 30 * day).toISOString()
);

let submissionFilter;
let submissionProjection;
let submissionSort;
let activePipeline;
const fakeSubmissionModel = {
  collection: { name: 'jobPublicationSubmissions' },
  find(filter) {
    submissionFilter = filter;
    return {
      select(projection) {
        submissionProjection = projection;
        return this;
      },
      sort(sort) {
        submissionSort = sort;
        return this;
      },
      async lean() {
        return [{ acceptedAt: new Date(now.getTime() - 2 * hour) }];
      },
    };
  },
};
const fakeJobModel = {
  schema: {
    path(name) {
      return ['publicationState', 'lastApprovedSubmissionId'].includes(name)
        ? { instance: name === 'publicationState' ? 'String' : 'ObjectId' }
        : undefined;
    },
  },
  async aggregate(pipeline) {
    activePipeline = pipeline;
    return [{ used: 5 }];
  },
};

const readUsage = await getPublishingQuotaUsage(
  { ownerType: 'employer', ownerId },
  {
    now,
    SubmissionModel: fakeSubmissionModel,
    JobModel: fakeJobModel,
  }
);

assert.strictEqual(submissionFilter.quotaCharged, true);
assert.strictEqual(submissionFilter.planCode, 'free_beta');
assert.strictEqual(submissionFilter.quotaOwnerType, 'employer');
assert.strictEqual(submissionFilter.quotaOwnerId.toString(), ownerId);
assert.strictEqual(
  submissionFilter.acceptedAt.$gt.toISOString(),
  new Date(now.getTime() - 30 * day).toISOString()
);
assert.strictEqual(
  submissionFilter.acceptedAt.$lte.toISOString(),
  now.toISOString()
);
assert.deepStrictEqual(submissionProjection, { acceptedAt: 1, _id: 0 });
assert.deepStrictEqual(submissionSort, { acceptedAt: 1 });
assert.strictEqual(activePipeline[0].$match.employerId.toString(), ownerId);
assert.strictEqual(activePipeline[0].$match.publicationState, 'active');
assert.strictEqual(activePipeline[1].$lookup.from, 'jobPublicationSubmissions');
assert.deepStrictEqual(
  activePipeline[2].$match.lastApprovedSubmission.$elemMatch,
  {
    planCode: 'free_beta',
    state: 'approved',
  }
);
assert.strictEqual(Object.hasOwn(activePipeline[0].$match, 'status'), false);
assert.strictEqual(readUsage.canAcceptChargedSubmission, false);
assert.deepStrictEqual(readUsage.submissionBlockers, ['ROLLING_24H_LIMIT']);
assert.strictEqual(readUsage.approvalCapacity.hasCapacity, false);

await assert.rejects(
  countCanonicalActiveFreeJobs(
    { ownerType: 'organization', ownerId },
    { JobModel: fakeJobModel, SubmissionModel: fakeSubmissionModel }
  ),
  (error) => error.code === 'UNSUPPORTED_ACTIVE_JOB_OWNER_TYPE'
);

await assert.rejects(
  countCanonicalActiveFreeJobs(
    { ownerType: 'employer', ownerId },
    {
      JobModel: {
        schema: { path: () => undefined },
        aggregate: async () => [],
      },
      SubmissionModel: fakeSubmissionModel,
    }
  ),
  (error) => error.code === 'CANONICAL_PUBLICATION_STATE_NOT_AVAILABLE'
);

await assert.rejects(
  acquirePublishingQuotaGuard(
    { ownerType: 'employer', ownerId },
    { session: null, GuardModel: {} }
  ),
  (error) => error.code === 'QUOTA_TRANSACTION_SESSION_REQUIRED'
);

let guardFilter;
let guardUpdate;
let guardOptions;
const activeSession = { inTransaction: () => true };
const fakeGuardModel = {
  async findOneAndUpdate(filter, update, options) {
    guardFilter = filter;
    guardUpdate = update;
    guardOptions = options;
    return { _id: filter._id, revision: 1 };
  },
};

const acquired = await acquirePublishingQuotaGuard(
  { ownerType: 'employer', ownerId },
  { session: activeSession, GuardModel: fakeGuardModel }
);
assert.strictEqual(guardFilter._id, `employer:${ownerId}`);
assert.strictEqual(guardFilter.ownerType, 'employer');
assert.strictEqual(guardFilter.ownerId.toString(), ownerId);
assert.deepStrictEqual(guardUpdate, { $inc: { revision: 1 } });
assert.strictEqual(guardOptions.upsert, true);
assert.strictEqual(guardOptions.new, true);
assert.strictEqual(guardOptions.runValidators, true);
assert.strictEqual(guardOptions.session, activeSession);
assert.strictEqual(acquired.guard.revision, 1);

const events = [];
const transactionSession = {
  inTransaction: () => true,
  async withTransaction(callback) {
    events.push('transaction:start');
    const result = await callback();
    events.push('transaction:commit');
    return result;
  },
  async endSession() {
    events.push('session:end');
  },
};
const fakeConnection = {
  async startSession() {
    events.push('session:start');
    return transactionSession;
  },
};

const transactionResult = await runWithSerializedPublishingQuota(
  { ownerType: 'employer', ownerId },
  async ({ owner, guard }) => {
    events.push('work');
    assert.strictEqual(owner.guardId, `employer:${ownerId}`);
    assert.strictEqual(guard.revision, 1);
    return 'ok';
  },
  {
    connection: fakeConnection,
    GuardModel: fakeGuardModel,
  }
);

assert.strictEqual(transactionResult, 'ok');
assert.deepStrictEqual(events, [
  'session:start',
  'transaction:start',
  'work',
  'transaction:commit',
  'session:end',
]);

console.log('publishingQuotaFoundations tests passed.');
