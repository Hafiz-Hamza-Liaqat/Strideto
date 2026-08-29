/**
 * STRIDETO MKT-P3 — Employer application detail & authorization server contracts.
 * Run: node src/__tests__/mktP3EmployerApplicantWorkflow.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEGACY_EMPLOYER_STATUSES, isSameStatusNoOp } from '../utils/applicationStatusTransition.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
const read = (rel) => readFileSync(path.join(serverSrc, rel), 'utf8');

const controller = read('controllers/employerController.js');
const routes = read('routes/employer.js');

const getDetailFn = controller.slice(
  controller.indexOf('export const getApplicationDetail'),
  controller.indexOf('export const getApplicationResume')
);

const updateFn = controller.slice(
  controller.indexOf('export const updateApplicationStatus'),
  controller.indexOf('export const getJobAnalytics')
);

function canEmployerAccessApplication(application, employerId) {
  if (!application?.jobId) return false;
  const jobEmployerId = application.jobId.employerId ?? application.jobId;
  return String(jobEmployerId) === String(employerId);
}

const employerA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const employerB = 'bbbbbbbbbbbbbbbbbbbbbbbb';

check(canEmployerAccessApplication({ jobId: { employerId: employerA } }, employerA), 'MKT-P3-18: employer A owns application');
check(!canEmployerAccessApplication({ jobId: { employerId: employerA } }, employerB), 'MKT-P3-19: employer B blocked');
check(LEGACY_EMPLOYER_STATUSES.join(',') === 'shortlisted,rejected,interview,hired', 'MKT-P3-11: employer-settable statuses');
check(isSameStatusNoOp('shortlisted', 'shortlisted'), 'MKT-P3-12: same-status no-op');

check(getDetailFn.includes('Job.findOne') === false, 'MKT-P3-24: detail uses application id with job populate');
check(
  /application\.jobId\.employerId\?\.toString\(\) !== String\(employerId\)/.test(getDetailFn),
  'MKT-P3-19: detail IDOR guard via job employerId'
);
check(
  /if \(applyType === 'external'\)[\s\S]*?return res\.status\(404\)/.test(getDetailFn),
  'MKT-P3-38: external job applications return 404 on detail'
);
check(getDetailFn.includes('coverLetter'), 'MKT-P3-06: detail returns coverLetter');
check(getDetailFn.includes('hasResume: Boolean(application.resumeURL)'), 'MKT-P3-07: hasResume boolean');

check(
  /const ALLOWED_BODY_KEYS = new Set\(\['status'\]\)/.test(updateFn),
  'MKT-P3-17: PATCH whitelists status only'
);
check(
  /Only application status may be updated/.test(updateFn),
  'MKT-P3-17: rejects extra body fields'
);
check(
  /application\.jobId\?\.employerId\?\.toString\(\) !== String\(employerId\)/.test(updateFn),
  'MKT-P3-20: update IDOR guard'
);
check(updateFn.includes("const allowed = ['shortlisted', 'rejected', 'interview', 'hired']"), 'MKT-P3-16: server status whitelist');

check(updateFn.includes('hiringStage'), 'STATUS-03: PATCH response includes hiringStage');
check(controller.includes('getApplicationResume'), 'DOC-01: resume access handler exists');
check(
  getDetailFn.includes('hasResume: Boolean(application.resumeURL)') && !getDetailFn.includes('resumeURL: application.resumeURL'),
  'SEC-09: detail response excludes raw resumeURL'
);
check(routes.includes("'/employer/applications/:id/resume'"), 'DOC-01: resume route registered');
check(
  routes.indexOf('getApplicationDetail') < routes.indexOf('updateApplicationStatus'),
  'MKT-P3: GET detail registered before PATCH'
);

console.log(`mktP3EmployerApplicantWorkflow.test.js (server): ${count} checks passed`);
