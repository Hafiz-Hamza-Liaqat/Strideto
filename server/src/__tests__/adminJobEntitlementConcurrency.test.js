/**
 * Quota approval concurrency seam tests. The serialized connection below
 * models Mongo's per-owner transaction boundary without connecting to a DB.
 * Run: node src/__tests__/adminJobEntitlementConcurrency.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runWithSerializedPublishingQuota } from '../services/publishing/SerializedQuotaGuard.js';

const ownerId = '507f1f77bcf86cd799439011';

function serializedConnection() {
  let tail = Promise.resolve();
  return {
    async startSession() {
      return {
        inTransaction: () => true,
        async withTransaction(work) {
          const prior = tail;
          let release;
          tail = new Promise((resolve) => { release = resolve; });
          await prior;
          try { return await work(); } finally { release(); }
        },
        async endSession() {},
      };
    },
  };
}

const guardModel = {
  async findOneAndUpdate(filter) {
    return { _id: filter._id, revision: 1 };
  },
};

async function approveMany(initial, count) {
  let active = initial;
  let succeeded = 0;
  const connection = serializedConnection();
  const approve = () => runWithSerializedPublishingQuota(
    { ownerType: 'employer', ownerId },
    async () => {
      if (active >= 5) return false;
      await Promise.resolve();
      active += 1;
      succeeded += 1;
      return true;
    },
    { connection, GuardModel: guardModel }
  );
  await Promise.all(Array.from({ length: count }, approve));
  return { active, succeeded };
}

// JPEC-01: independent approvals cannot move 4/5 to 6/5.
const four = await approveMany(4, 2);
assert.equal(four.active, 5);
assert.equal(four.succeeded, 1);

// JPEC-02: both approvals reject when capacity is already full.
const five = await approveMany(5, 2);
assert.equal(five.active, 5);
assert.equal(five.succeeded, 0);

// JPEC-03: two approvals can consume the two remaining slots from 3/5.
const three = await approveMany(3, 2);
assert.equal(three.active, 5);
assert.equal(three.succeeded, 2);

const adminJobs = fs.readFileSync(new URL('../controllers/admin/adminJobsController.js', import.meta.url), 'utf8');
const moderation = fs.readFileSync(new URL('../controllers/admin/moderationController.js', import.meta.url), 'utf8');
assert.match(adminJobs, /runWithSerializedPublishingQuota/);
assert.match(moderation, /runWithSerializedPublishingQuota/);
assert.match(adminJobs, /loadEmployerPublishingUsage\(existing\.employerId, \{ session \}\)/);
assert.match(moderation, /loadEmployerPublishingUsage\(job\.employerId, \{ session \}\)/);

console.log('adminJobEntitlementConcurrency: 9 checks passed');
