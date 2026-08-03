/**
 * PF-J3-A — Employer job-rejection notification + email (backend only).
 * Run: node server/src/__tests__/employerJobRejectionNotification.test.js
 */
import assert from 'assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
function read(relPath) {
  return readFileSync(path.join(serverSrc, relPath), 'utf8');
}

const moderation = read('controllers/admin/moderationController.js');
const automation = read('services/automationService.js');
const templates = read('templates/emailTemplates.js');

function fnBody(src, exportSig) {
  const start = src.indexOf(exportSig);
  const end = src.indexOf('\nexport async function', start + 1);
  return src.slice(start, end === -1 ? undefined : end);
}

// --- 1/2/3/4/5/19/24. bulkRejectJobs: durable update before automation, reason validated, re-queried like bulkApproveJobs ---
{
  const updateIdx = moderation.indexOf('export const bulkRejectJobs');
  const rejectManyIdx = moderation.indexOf("{ $set: { approvalStatus: 'rejected' } }", updateIdx);
  const onRejectedIdx = moderation.indexOf('onJobRejected({', updateIdx);
  check(updateIdx > -1 && rejectManyIdx > updateIdx && onRejectedIdx > rejectManyIdx, 'bulkRejectJobs: onJobRejected is only called after the Job.updateMany rejection write');
  check(
    /const reason = typeof req\.body\?\.reason === 'string'\s*\n\s*\? req\.body\.reason\.trim\(\)\.slice\(0, MAX_REJECTION_REASON_LENGTH\)\s*\n\s*: '';/.test(moderation),
    'bulkRejectJobs: reason is type-checked, trimmed, and length-capped before use'
  );
  check(/const MAX_REJECTION_REASON_LENGTH = 500;/.test(moderation), 'A conservative, explicit max length is defined for the rejection reason');
  check(
    /const rejectedJobs = await Job\.find\(\{ _id: \{ \$in: ids \}, approvalStatus: 'rejected' \}\)\.select\('title employerId'\)\.lean\(\);/.test(moderation),
    'bulkRejectJobs: re-queries actually-rejected jobs the same way bulkApproveJobs re-queries actually-approved jobs (only real transitions notify, matching established precedent)'
  );
  check(
    /onJobRejected\(\{ jobId: job\._id, employerId: job\.employerId, jobTitle: job\.title, reason \}\)\.catch\(\(\) => \{\}\);/.test(moderation),
    'onJobRejected is called with the real Job id/title/employerId and the validated reason, fire-and-forget'
  );
  check(
    /await logAudit\(\{[\s\S]{0,120}action: 'jobs\.bulk_reject',/.test(moderation),
    'Existing audit logging for rejection is preserved'
  );
}

// --- 6/7/8/9/10/11/12/24. Employer rejection notification content ---
const onJobRejectedBody = fnBody(automation, 'export async function onJobRejected(');
{
  check(onJobRejectedBody.length > 0, 'automationService.js: onJobRejected is defined');
  check(/if \(!jobId \|\| !employerId\) return;/.test(onJobRejectedBody), 'onJobRejected: requires both jobId and employerId (cannot notify an unresolved or unrelated Employer)');
  check(
    /recipientType: 'employer',\s*\n\s*employerId,/.test(onJobRejectedBody),
    'Employer rejection notification: recipient is the owning Employer'
  );
  check(/type: 'job\.rejected',/.test(onJobRejectedBody), "Notification type is 'job.rejected'");
  check(/metadata: \{ jobId \},/.test(onJobRejectedBody), 'Notification metadata includes the Job id');
  check(/link: '\/employer\/jobs',/.test(onJobRejectedBody), "Notification links to '/employer/jobs'");
  check(
    /not approved/i.test(onJobRejectedBody) && !/is now live|still pending|has been approved/i.test(onJobRejectedBody),
    'Notification wording states rejection ("not approved") and never claims publication or pending status'
  );
  check(
    /dedupKey: `job:rejected:\$\{jobId\}`,/.test(onJobRejectedBody),
    'Notification has a stable dedup key scoped to this job'
  );
  check(
    /const safeReason = typeof reason === 'string' && reason\.trim\(\) \? reason\.trim\(\) : '';/.test(onJobRejectedBody)
      && /body: safeReason \|\| REJECTION_FALLBACK_MESSAGE,/.test(onJobRejectedBody),
    'Notification uses the validated reason when present, falling back to a neutral message otherwise'
  );
  check(
    /const REJECTION_FALLBACK_MESSAGE = 'The Job was not approved during review\. Open your Employer Jobs page to review its status\.';/.test(automation),
    'Neutral fallback message matches the required wording exactly, not invented differently'
  );
}

// --- 13/14/15/16/17. Employer rejection email ---
{
  check(
    /const employer = await Employer\.findById\(employerId\)\.select\('email'\)\.lean\(\);/.test(onJobRejectedBody),
    'Employer recipient resolution matches the established onJobApproved/onJobSubmitted contract'
  );
  check(
    /templateKey: 'jobRejectedEmployer',/.test(onJobRejectedBody),
    'Uses a dedicated jobRejectedEmployer template (not Admin-submission, not pending, not approval templates)'
  );
  check(
    /dedupKey: `email:job:rejected:\$\{jobId\}`,/.test(onJobRejectedBody),
    'Rejection email has a stable dedup key'
  );

  const tplStart = templates.indexOf('jobRejectedEmployer: {');
  const tplEnd = templates.indexOf('\n  employerVerification:');
  const tpl = templates.slice(tplStart, tplEnd);
  check(tplStart > -1, 'jobRejectedEmployer template exists');
  check(/\/employer\/jobs/.test(tpl), 'Template CTA targets /employer/jobs');
  check(/escapeHtml\(reason\)/.test(tpl), 'Template escapes the admin-authored reason before HTML interpolation (defense against markup/script injection)');
  check(!/is now live|approved and/i.test(tpl), 'Template never claims approval or publication');
  check(!/delete|deleted|resubmit/i.test(tpl), 'Template does not claim deletion or a resubmission workflow that does not exist');
}

// --- 18/26. No raw errors, no credentials in template/log-adjacent code ---
{
  check(
    !/reason\}\)\.catch\(\(err\) =>/.test(moderation) && /\.catch\(\(\) => \{\}\);/.test(moderation),
    'onJobRejected call site swallows errors (fire-and-forget), never surfaces a raw internal error to the Admin response'
  );
}

// --- 20/21/22/23. Regression: approval/pending/submission hooks and audit logging unchanged ---
{
  check(/export async function onJobApproved\(\{ jobId, employerId, jobTitle \}\) \{/.test(automation), 'onJobApproved unchanged');
  check(/export async function onJobSubmitted\(\{ jobId, jobTitle, companyName, employerId \}\)/.test(automation), 'onJobSubmitted (incl. PF-J2 employer pending ack) unchanged');
  check(
    /await Job\.updateMany\(\s*\{ _id: \{ \$in: ids \}, approvalStatus: 'pending' \},\s*\{ \$set: \{ approvalStatus: 'approved', status: 'active' \} \}\s*\);/.test(moderation),
    'bulkApproveJobs status-transition logic unchanged'
  );
}

console.log(`employerJobRejectionNotification.test.js: ${count} assertions passed`);
