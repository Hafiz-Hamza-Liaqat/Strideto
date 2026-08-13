import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  withFixtureExclusion,
  isPubliclyLaunchVisible,
} from '../../../shared/publicDiscovery/fixtureExclusion.js';
import {
  jobWouldConsumeFreeActiveSlot,
  projectAdminEntitlementSnapshot,
  derivePublishingEntitlementType,
} from '../services/employer/employerPublishingQuota.js';
import { PUBLISHING_QUOTA_RESULT_CODES, FREE_BETA_PUBLISHING_POLICY } from '../config/freeBetaPublishingPolicy.js';

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

const prod = { NODE_ENV: 'production' };

{
  const userFlow = read('server/src/services/auth/userSecureAuthFlows.js');
  const authCtrl = read('server/src/controllers/authController.js');
  check(userFlow.includes("code: 'PASSWORD_RESET'"), 'user reset success code is PASSWORD_RESET');
  check(!/RESET_ATTEMPTED/.test(userFlow), 'user reset no longer returns RESET_ATTEMPTED false-success');
  check(
    /result\.code !== 'VERSION_INCREMENTED'/.test(userFlow),
    'user reset requires VERSION_INCREMENTED before success'
  );
  check(
    /result\.code !== 'PASSWORD_RESET'/.test(authCtrl),
    'authController reset does not report success without PASSWORD_RESET'
  );
  check(
    !/console\.(log|info|debug|error).*token/.test(authCtrl.slice(authCtrl.indexOf('export const resetPassword'))),
    'reset handler does not log token values'
  );
}

{
  const alreadyActive = { status: 'active', approvalStatus: 'approved', planType: 'free' };
  const pendingFree = { status: 'draft', approvalStatus: 'pending', planType: 'free' };
  const pendingNull = { status: 'draft', approvalStatus: 'pending', planType: null };
  const snapshot = {
    policy: { paidPublishingEnabled: false, code: 'free_beta' },
    usage: { activeFreeJobs: { used: 5, limit: 5, remaining: 0 } },
  };
  check(jobWouldConsumeFreeActiveSlot(alreadyActive, snapshot) === false, 'already-active job does not consume another slot');
  check(jobWouldConsumeFreeActiveSlot(pendingFree, snapshot) === true, 'pending free job consumes a slot');
  check(jobWouldConsumeFreeActiveSlot(pendingNull, snapshot) === true, 'null planType is free while paid publishing is off');
  check(FREE_BETA_PUBLISHING_POLICY.paidPublishingEnabled === false, 'paid publishing remains off');
  check(
    PUBLISHING_QUOTA_RESULT_CODES.ACTIVE_LIMIT_REACHED_AT_APPROVAL === 'ACTIVE_LIMIT_REACHED_AT_APPROVAL',
    'canonical exhausted-capacity code retained'
  );
}

{
  const usage = {
    policy: {
      code: 'free_beta',
      version: 'free-beta-2026-01',
      paidPublishingEnabled: false,
    },
    usage: {
      activeFreeJobs: { used: 4, limit: 5, remaining: 1 },
      daily: { used: 0, limit: 1, remaining: 1, nextEligibleAt: null },
      rolling30Days: { used: 1, limit: 10, remaining: 9, nextSlotAt: null },
      submissionBlockers: [],
      approvalCapacity: { hasCapacity: true },
    },
    verification: { eligible: true },
    nextReset: null,
  };
  const projected = projectAdminEntitlementSnapshot(usage);
  check(projected.type === 'free_quota', 'admin snapshot type comes from same derive function');
  check(projected.activeFreeJobs.remaining === 1, 'admin snapshot includes remaining active slots');
  check(projected.paidPublishingEnabled === false, 'admin snapshot does not invent paid');
  check(projected.payment.state === 'not_configured', 'payment is not_configured while paid publishing is off');
  check(derivePublishingEntitlementType(usage) === projected.type, 'Employer and Admin share entitlement type authority');
}

{
  const admin = read('server/src/controllers/admin/adminJobsController.js');
  check(admin.includes('assertActiveFreeApprovalAllowed'), 'single approve loads server entitlement before activation');
  check(admin.includes('ACTIVE_LIMIT_REACHED_AT_APPROVAL'), 'exhausted capacity returns the canonical code');
  check(admin.includes('jobWouldConsumeFreeActiveSlot'), 'bulk approve uses the same consume-slot rule');
  check(admin.includes('skipped'), 'bulk approve reports skipped records instead of exceeding the cap');
  check(
    /status: 'active'[\s\S]{0,80}approvalStatus: 'approved'[\s\S]{0,200}assertActiveFreeApprovalAllowed/.test(admin)
      || admin.indexOf('assertActiveFreeApprovalAllowed') < admin.indexOf("status: 'active'"),
    'capacity is checked before the job is marked active'
  );
}

{
  const portal = read('server/src/controllers/institutionPortalController.js');
  const service = read('server/src/services/institutionPortalService.js');
  check(service.includes('assertOfficialInstitutionWrite'), 'shared official-write helper exists');
  check(
    /export const updateProgram[\s\S]*assertOfficialInstitutionWrite/.test(portal),
    'updateProgram requires verification AND claim'
  );
  check(
    /export const submitProgram[\s\S]*assertOfficialInstitutionWrite/.test(portal),
    'submitProgram requires verification AND claim'
  );
  check(
    /export const createProgram[\s\S]*assertOfficialInstitutionWrite/.test(portal),
    'createProgram uses the same official-write helper'
  );
  check(
    /assertApprovedVerification[\s\S]*assertApprovedClaim/.test(service)
      && /VERIFICATION_REQUIRED/.test(service)
      && /CLAIM_REQUIRED/.test(service),
    'verification and claim remain independent reason codes'
  );
}

{
  const dash = read('server/src/services/career/DashboardCompositionService.js');
  check(dash.includes('withFixtureExclusion'), 'dashboard recommendations use launch projection');
  check(!/Job\.find\(\{\s*status:\s*'active'\s*\}\)/.test(dash), 'dashboard does not query active jobs without launch exclusion');
  const clause = withFixtureExclusion({ status: 'active' }, prod);
  check(clause.$and.some((p) => p.launchEligible === true), 'production launch filter requires launchEligible true');
  check(isPubliclyLaunchVisible({ status: 'active', launchEligible: true, title: 'Real' }) === true, 'eligible record is visible');
  check(isPubliclyLaunchVisible({ status: 'active', launchEligible: false, title: 'Hidden' }) === false, 'launchEligible=false is excluded');
  check(
    isPubliclyLaunchVisible({ status: 'active', isFixture: true, title: 'P13 Fixture', dataClass: 'fixture' }) === false,
    'fixture active record is excluded'
  );
  check(
    isPubliclyLaunchVisible({ status: 'active', dataClass: 'qa', title: 'QA only' }) === false,
    'QA/test dataClass is excluded'
  );
}

console.log(`phase17cAuthority.test.js: ${count} assertions passed`);
