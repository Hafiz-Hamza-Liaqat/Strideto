import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'path';
import { projectAdminEntitlementSnapshot, derivePublishingEntitlementType } from '../services/employer/employerPublishingQuota.js';
import { FREE_BETA_PUBLISHING_POLICY } from '../config/freeBetaPublishingPolicy.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

{
  const usage = {
    policy: {
      code: FREE_BETA_PUBLISHING_POLICY.code,
      version: FREE_BETA_PUBLISHING_POLICY.version,
      paidPublishingEnabled: false,
    },
    usage: {
      activeFreeJobs: { used: 4, limit: 5, remaining: 1 },
      daily: { used: 0, limit: 3, remaining: 3, nextEligibleAt: null },
      rolling30Days: { used: 1, limit: 10, remaining: 9, nextSlotAt: null },
      submissionBlockers: [],
    },
    verification: { eligible: true, verified: false },
    nextReset: null,
  };
  const snap = projectAdminEntitlementSnapshot(usage);
  check(snap.type === derivePublishingEntitlementType(usage), 'Admin snapshot type matches Employer Plans & Usage');
  check(snap.paidPublishingEnabled === false, 'paidPublishingEnabled OFF is not treated as paid');
  check(snap.activeFreeJobs.remaining === 1, 'remaining active slots are server-derived');
  check(snap.payment.state === 'not_configured', 'payment state is not_configured while paid publishing is off');
}

{
  const admin = read('server/src/controllers/admin/adminJobsController.js');
  check(/projectAdminEntitlementSnapshot/.test(admin), 'admin job getOne/list use shared entitlement snapshot');
  check(/employerIds/.test(admin) && /employerEntitlement/.test(admin), 'admin job list attaches server entitlement per employer');
}

{
  const jobs = read('client/src/pages/Employer/EmployerJobs.jsx');
  check(!/isPaidDraft/.test(jobs) && !/planType !== 'free'/.test(jobs), 'Employer Jobs no longer treats null planType as paid');
  check(/plansUsage\(\)/.test(jobs), 'Employer Jobs quota chip uses server Plans & Usage');
  check(!/createCheckout/.test(jobs) && !/Pay and publish/i.test(jobs), 'paid CTA is absent while checkout is not offered from Jobs');
}

{
  const post = read('client/src/pages/Employer/EmployerPostJob.jsx');
  check(/paidPublishingEnabled/.test(post), 'Post Job reads server paidPublishingEnabled');
  check(/paidPublishingEnabled \? plans\.map/.test(post), 'Pay and publish plans render only when paid publishing is actually enabled');
}

{
  const adminJobs = read('client/src/pages/Admin/AdminContentJobs.jsx');
  check(/FREE BETA/.test(adminJobs), 'Admin job list shows FREE BETA from server entitlement');
  check(/activeFreeJobs\.remaining/.test(adminJobs), 'Admin review shows remaining free capacity');
}

{
  const payments = read('client/src/pages/Admin/AdminPayments.jsx');
  check(/Legacy Payments/.test(payments), 'legacy AdminPayments is labelled as historical');
  check(!/toFixed\?\.\(2\)/.test(payments) && !/`\$\$\{summary/.test(payments), 'legacy payments do not present $ toFixed as live revenue');
}

{
  const apps = read('client/src/pages/Employer/EmployerApplications.jsx');
  const interviews = read('client/src/pages/Employer/EmployerInterviews.jsx');
  const team = read('client/src/pages/Employer/EmployerTeam.jsx');
  check(/statusFilter/.test(apps) && /fromDate/.test(apps), 'Employer Applications has status and date filters');
  check(/jobFilter/.test(interviews) && /fromDate/.test(interviews), 'Employer Interviews has job and date filters');
  check(/pending invite/.test(team) && /INVITE_ROLES/.test(team), 'Employer Team shows counts and does not offer owner in the generic role select');
  check(/emailDelivery/.test(team), 'invite notice uses server delivery truth');
}

console.log(`phase17cEmployerAdmin.test.js: ${count} assertions passed`);
