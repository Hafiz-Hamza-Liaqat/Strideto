/**
 * STRIDETO MKT-P6 — Flexible candidate outcome & reconsideration contracts.
 * Run: node src/__tests__/mktP6ApplicationReconsideration.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LEGACY_EMPLOYER_STATUSES,
  isSameStatusNoOp,
  isReconsiderationTransition,
  isHiredReopenTransition,
  requiresEmployerStatusConfirmation,
  canTransitionApplicationStatus,
  resolveEmployerStatusSyncReason,
} from '../utils/applicationStatusTransition.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
const read = (rel) => readFileSync(path.join(serverSrc, rel), 'utf8');

const controller = read('controllers/employerController.js');
const sync = read('services/employerOpportunityApplicationSync.js');
const automation = read('services/automationService.js');
const detailPage = readFileSync(
  path.resolve(serverSrc, '../../client/src/pages/Employer/EmployerApplicationDetail.jsx'),
  'utf8'
);

const updateFn = controller.slice(
  controller.indexOf('export const updateApplicationStatus'),
  controller.indexOf('export const getJobAnalytics')
);

// P6-E01 / transition model
check(canTransitionApplicationStatus('submitted', 'rejected'), 'P6-E01: employer may mark not selected');
check(isReconsiderationTransition('rejected', 'shortlisted'), 'P6-E02: reconsideration detected');
check(!isReconsiderationTransition('shortlisted', 'interview'), 'P6: forward progress not reconsideration');
check(resolveEmployerStatusSyncReason('rejected', 'shortlisted') === 'employer_reconsideration', 'P6-E05: sync reason reconsideration');
check(isSameStatusNoOp('rejected', 'rejected'), 'P6: same-status no-op');
check(canTransitionApplicationStatus('rejected', 'shortlisted'), 'P6-E03: rejected → screening allowed');
check(canTransitionApplicationStatus('rejected', 'interview'), 'P6-E04: rejected → interview allowed');
check(!canTransitionApplicationStatus('hired', 'shortlisted'), 'P6-H01: hired → shortlisted without intent blocked');
check(!canTransitionApplicationStatus('hired', 'interview'), 'P6-H02: hired → interview without intent blocked');
check(canTransitionApplicationStatus('hired', 'shortlisted', { confirmReopen: true }), 'P6-H03: explicit reopen → shortlisted allowed');
check(canTransitionApplicationStatus('hired', 'interview', { confirmReopen: true }), 'P6-H04: explicit reopen → interview allowed');
check(isSameStatusNoOp('hired', 'hired'), 'P6-H10: hired → hired no-op');

// P6-SEC05 / mass assignment
check(/const ALLOWED_BODY_KEYS = new Set\(\['status', 'confirmReopen'\]\)/.test(updateFn), 'P6-SEC05: narrow body whitelist');
check(updateFn.includes('HIRING_REOPEN_REQUIRED'), 'P6-H01: hired reopen required code');
check(updateFn.includes('confirmReopen === true'), 'P6: server requires explicit reopen intent');

// History / audit
check(updateFn.includes('logAudit'), 'P6: status changes audited');
check(updateFn.includes("'application.reconsidered'"), 'P6: reconsideration audit action');
check(updateFn.includes('resolveEmployerStatusSyncReason'), 'P6-E05: sync uses reconsideration reason resolver');
check(sync.includes('legacyFromStatus'), 'P6-E05: history preserves legacy from/to');

// Employer UX
check(detailPage.includes('confirmReconsiderTitle'), 'P6: reconsider confirmation dialog');
check(detailPage.includes('actionReconsiderApplicant'), 'P6: reconsider action label');
check(detailPage.includes('confirmReopenTitle'), 'P6: hired reopen confirmation');
check(detailPage.includes('StageTimeline'), 'P6-E05: employer history timeline');

// Notifications
check(automation.includes('reconsidered'), 'P6: reconsideration notification path');
check(automation.includes('historySequence'), 'P6: dedup uses history sequence');

// Hired protection (server + UI)
check(isHiredReopenTransition('hired', 'shortlisted'), 'P6: hired reopen detected');
check(requiresEmployerStatusConfirmation('hired', 'interview'), 'P6: hired reopen requires confirmation');
check(resolveEmployerStatusSyncReason('hired', 'shortlisted') === 'employer_reopen', 'P6-H05: hired reopen sync reason');
check(detailPage.includes('confirmReopen: needsReopenConfirm'), 'P6: client sends confirmReopen on reopen');

check(LEGACY_EMPLOYER_STATUSES.join(',') === 'shortlisted,rejected,interview,hired', 'P6: employer status vocabulary unchanged');

console.log(`mktP6ApplicationReconsideration.test.js: ${count} checks passed`);
