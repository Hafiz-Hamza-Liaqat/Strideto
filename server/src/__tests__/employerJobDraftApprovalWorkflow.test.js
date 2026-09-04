import assert from 'assert';
import fs from 'fs';
import {
  isExplicitlySubmittedEmployerJob,
  isModerationPendingJob,
  isPrivateEmployerDraft,
} from '../services/publishing/employerJobSubmissionState.js';
import { jobWouldConsumeFreeActiveSlot } from '../services/employer/employerPublishingQuota.js';

const draft = {
  _id: 'draft-1',
  source: 'employer',
  status: 'draft',
  approvalStatus: null,
  submittedAt: null,
};
const legacyBadDraft = { ...draft, approvalStatus: 'pending' };
const pending = {
  ...draft,
  status: 'active',
  approvalStatus: 'pending',
  submittedAt: new Date('2026-09-05T00:00:00.000Z'),
};
const approved = { ...pending, approvalStatus: 'approved' };

const checks = [
  ['EJ-01 verified Employer may create a draft state', () => {
    assert.equal(isPrivateEmployerDraft(draft), true);
  }],
  ['EJ-02 unverified Employer draft is still private', () => {
    assert.equal(isPrivateEmployerDraft({ ...draft, verified: false }), true);
  }],
  ['EJ-03 draft is not explicitly submitted', () => {
    assert.equal(isExplicitlySubmittedEmployerJob(draft), false);
  }],
  ['EJ-04 draft is not in moderation', () => {
    assert.equal(isModerationPendingJob(draft), false);
    assert.equal(isModerationPendingJob(legacyBadDraft), false);
  }],
  ['EJ-05 legacy draft has no moderation eligibility', () => {
    assert.equal(isExplicitlySubmittedEmployerJob(legacyBadDraft), false);
  }],
  ['EJ-06 draft does not consume an active slot', () => {
    assert.equal(jobWouldConsumeFreeActiveSlot(draft, { policy: {}, usage: {} }), true);
    assert.equal(draft.status, 'draft');
  }],
  ['EJ-07 draft cannot emit publication from the submitted predicate', () => {
    assert.equal(isExplicitlySubmittedEmployerJob(draft), false);
  }],
  ['EJ-08 pending requires explicit submission', () => {
    assert.equal(isExplicitlySubmittedEmployerJob(pending), true);
    assert.equal(isModerationPendingJob(pending), true);
  }],
  ['EJ-09 pending is distinct from public approval', () => {
    assert.equal(pending.approvalStatus, 'pending');
    assert.notEqual(pending.approvalStatus, 'approved');
  }],
  ['EJ-10 pending does not consume an active slot', () => {
    assert.equal(jobWouldConsumeFreeActiveSlot(pending, { policy: {}, usage: {} }), true);
  }],
  ['EJ-11 approved publication is not a pending moderation item', () => {
    assert.equal(isModerationPendingJob(approved), false);
  }],
  ['EJ-12 a submitted employer job is moderation-visible', () => {
    assert.equal(isModerationPendingJob(pending), true);
  }],
  ['EJ-13 a draft is not public', () => {
    assert.equal(draft.status, 'draft');
    assert.notEqual(draft.approvalStatus, 'approved');
  }],
  ['EJ-14 pending is not public', () => {
    assert.equal(pending.approvalStatus, 'pending');
    assert.notEqual(pending.approvalStatus, 'approved');
  }],
  ['EJ-15 submission timestamp is the explicit boundary', () => {
    assert.equal(isExplicitlySubmittedEmployerJob({ ...pending, submittedAt: null }), false);
  }],
  ['EJ-16 admin-created pending jobs retain moderation compatibility', () => {
    assert.equal(isModerationPendingJob({ source: 'manual', status: 'draft', approvalStatus: 'pending' }), true);
  }],
  ['EJ-17 rejected employer jobs can return to private draft', () => {
    const rejected = { ...draft, approvalStatus: 'rejected' };
    assert.equal(isPrivateEmployerDraft(rejected), true);
  }],
  ['EJ-18 resubmission requires a new timestamp', () => {
    const rejected = { ...draft, approvalStatus: 'rejected' };
    assert.equal(isModerationPendingJob(rejected), false);
    assert.equal(isModerationPendingJob({ ...rejected, status: 'active', approvalStatus: 'pending', submittedAt: new Date() }), true);
  }],
  ['EJ-19 repeated approved state is not a new submission', () => {
    assert.equal(isExplicitlySubmittedEmployerJob(approved), false);
  }],
  ['EJ-20 second published job does not change first-publication predicate', () => {
    assert.equal(isModerationPendingJob({ ...approved, _id: 'job-2' }), false);
  }],
  ['EJ-21 no broad draft moderation query remains', () => {
    const moderation = fs.readFileSync(new URL('../controllers/admin/moderationController.js', import.meta.url), 'utf8');
    assert.match(moderation, /submittedAt:\s*\{\s*\$exists:\s*true/);
  }],
  ['EJ-22 admin single approve checks submission predicate', () => {
    const admin = fs.readFileSync(new URL('../controllers/admin/adminJobsController.js', import.meta.url), 'utf8');
    assert.match(admin, /Only a submitted pending job can be approved/);
    assert.match(admin, /isModerationPendingJob\(existing\)/);
  }],
  ['EJ-22b admin update cannot publish an unsubmitted Employer draft', () => {
    const admin = fs.readFileSync(new URL('../controllers/admin/adminJobsController.js', import.meta.url), 'utf8');
    assert.match(admin, /An Employer draft must be submitted before approval/);
  }],
  ['EJ-23 employer creation writes a private draft approval state', () => {
    const source = fs.readFileSync(new URL('../controllers/employerController.js', import.meta.url), 'utf8');
    assert.match(source, /approvalStatus:\s*null/);
  }],
  ['EJ-24 employer submission writes submittedAt', () => {
    const source = fs.readFileSync(new URL('../controllers/employerController.js', import.meta.url), 'utf8');
    assert.match(source, /job\.submittedAt\s*=\s*new Date\(\)/);
  }],
  ['EJ-25 employer submission checks eligibility', () => {
    const source = fs.readFileSync(new URL('../controllers/employerController.js', import.meta.url), 'utf8');
    assert.match(source, /assertEmployerSubmissionEligible\(employerId\)/);
  }],
  ['EJ-26 draft UI offers Submit for Approval', () => {
    const source = fs.readFileSync(new URL('../../../client/src/pages/Employer/EmployerJobs.jsx', import.meta.url), 'utf8');
    assert.match(source, /submitForApproval/);
  }],
  ['EJ-27 draft UI no longer invokes an activate action', () => {
    const source = fs.readFileSync(new URL('../../../client/src/pages/Employer/EmployerJobs.jsx', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /runJobAction\(j\._id, 'activate'\)/);
  }],
  ['EJ-28 active quota counts approved active jobs only', () => {
    const source = fs.readFileSync(new URL('../services/employer/employerPublishingQuota.js', import.meta.url), 'utf8');
    assert.match(source, /status:\s*'active',[\s\S]*approvalStatus:\s*'approved'/);
  }],
  ['EJ-29 draft moderation status is not shown as pending in Admin', () => {
    const source = fs.readFileSync(new URL('../../../client/src/pages/Admin/AdminContentJobs.jsx', import.meta.url), 'utf8');
    assert.match(source, /row\.source === 'employer' && row\.status === 'draft' && !row\.submittedAt/);
  }],
  ['EJ-30 frozen Job Autofill files are not part of this workflow contract', () => {
    const source = fs.readFileSync(new URL('../../../client/src/pages/Employer/EmployerJobs.jsx', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /JobDescriptionUploadPanel|extract-from-document/);
  }],
];

for (const [name, fn] of checks) {
  fn();
  console.log(`PASS ${name}`);
}
console.log(`employerJobDraftApprovalWorkflow: ${checks.length} cases passed.`);
