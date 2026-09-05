/**
 * Admin job posting-entitlement projection and workflow-boundary tests.
 * Run: node src/__tests__/adminJobPostingEntitlement.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FREE_BETA_PUBLISHING_POLICY } from '../config/freeBetaPublishingPolicy.js';
import {
  projectJobPublishingEntitlement,
  jobWouldConsumeFreeActiveSlot,
} from '../services/employer/employerPublishingQuota.js';

const employerId = '507f1f77bcf86cd799439011';
const snapshot = (active, pending = 1) => ({
  policy: {
    paidPublishingEnabled: false,
    code: FREE_BETA_PUBLISHING_POLICY.code,
  },
  pendingReview: pending,
  usage: {
    activeFreeJobs: {
      used: active,
      limit: FREE_BETA_PUBLISHING_POLICY.maximumActiveFreeJobs,
      remaining: Math.max(0, FREE_BETA_PUBLISHING_POLICY.maximumActiveFreeJobs - active),
    },
  },
});

function freeJob() {
  return { employerId, planType: 'free', status: 'active', approvalStatus: 'pending' };
}

for (const [active, expectedAfter, expectedRemaining] of [[0, 1, 4], [1, 2, 3], [4, 5, 0]]) {
  const access = projectJobPublishingEntitlement(freeJob(), snapshot(active));
  assert.equal(access.type, 'free_beta');
  assert.equal(access.freeBeta.active, active);
  assert.equal(access.freeBeta.pending, 1);
  assert.equal(access.freeBeta.activeAfterApproval, expectedAfter);
  assert.equal(access.freeBeta.remainingAfterApproval, expectedRemaining);
  assert.equal(access.freeBeta.canApprove, true);
}

const full = projectJobPublishingEntitlement(freeJob(), snapshot(5, 3));
assert.equal(full.freeBeta.active, 5);
assert.equal(full.freeBeta.pending, 3);
assert.equal(full.freeBeta.canApprove, false);
assert.equal(full.freeBeta.approvalImpact, 'blocked');
assert.equal(full.freeBeta.remainingAfterApproval, 0);
assert.equal(jobWouldConsumeFreeActiveSlot(freeJob(), snapshot(0)), true);

const paid = projectJobPublishingEntitlement(
  { employerId, planType: 'standard', status: 'active', approvalStatus: 'pending' },
  { ...snapshot(2, 2), policy: { ...snapshot(2).policy, paidPublishingEnabled: true } }
);
assert.equal(paid.type, 'paid');
assert.equal(paid.label, 'Paid Job Posting');
assert.equal(paid.freeBeta.impact, 'none');
assert.equal(jobWouldConsumeFreeActiveSlot({ employerId, planType: 'standard' }, { ...snapshot(2), policy: { ...snapshot(2).policy, paidPublishingEnabled: true } }), false);

const moderation = fs.readFileSync(new URL('../controllers/admin/moderationController.js', import.meta.url), 'utf8');
const adminJobs = fs.readFileSync(new URL('../controllers/admin/adminJobsController.js', import.meta.url), 'utf8');
const automation = fs.readFileSync(new URL('../services/automationService.js', import.meta.url), 'utf8');
const submissionState = fs.readFileSync(new URL('../services/publishing/employerJobSubmissionState.js', import.meta.url), 'utf8');
const moderationUi = fs.readFileSync(new URL('../../../client/src/pages/Admin/ModerationQueue.jsx', import.meta.url), 'utf8');
const adminJobsUi = fs.readFileSync(new URL('../../../client/src/pages/Admin/AdminContentJobs.jsx', import.meta.url), 'utf8');

assert.match(moderation, /publishingAccess/);
assert.match(adminJobs, /publishingAccess/);
assert.match(automation, /const entitlementSuffix/);
assert.match(automation, /approval would become/);
assert.match(submissionState, /employerPrivateDraftExclusion/);
assert.match(adminJobs, /employerPrivateDraftExclusion\(\)/);
assert.match(moderation, /employerPrivateDraftExclusion\(\)/);
assert.match(adminJobs, /assertActiveFreeApprovalAllowed/);
assert.match(moderationUi, /job\.publishingAccess/);
assert.match(moderationUi, /Active now:/);
assert.match(moderationUi, /If approved:/);
assert.match(adminJobsUi, /row\.publishingAccess/);

console.log('adminJobPostingEntitlement: 33 checks passed');
