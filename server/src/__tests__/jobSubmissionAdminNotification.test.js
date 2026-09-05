/**
 * PF-J — Employer job submission → Admin dashboard notification + email.
 * No existing server test in this repo mocks Mongo/SMTP for automationService;
 * per this phase's "must not connect to real databases/SMTP" constraint,
 * these checks prove the wiring against the shipped source text rather than
 * exercising notifyStaff/queueEmail against a live Mongo/SMTP connection.
 * Run: node server/src/__tests__/jobSubmissionAdminNotification.test.js
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

const employerController = read('controllers/employerController.js');
const automationService = read('services/automationService.js');
const emailTemplates = read('templates/emailTemplates.js');

// --- Explicit Submit-for-Approval is the only path that calls onJobSubmitted ---
{
  const createIdx = employerController.indexOf('const job = await Job.create({');
  const submittedIdx = employerController.indexOf('onJobSubmitted({');
  const responseIdx = employerController.indexOf('res.status(201).json({', createIdx);
  check(createIdx > -1 && responseIdx > createIdx, 'createJob: draft creation persists before its response');
  check(submittedIdx > responseIdx, 'submit-for-approval: onJobSubmitted is separate from draft creation');
  check(
    /onJobSubmitted\(\{\s*jobId: job\._id,\s*jobTitle: job\.title,\s*companyName: job\.company,\s*employerId,\s*\}\)\.catch\(\(\) => \{\}\);/.test(employerController),
    'submit-for-approval: onJobSubmitted is fire-and-forget (not awaited)'
  );
  check(
    !/await onJobSubmitted/.test(employerController),
    'submit-for-approval: does not await onJobSubmitted (no added response latency)'
  );
}

// --- 12. Employer response unchanged: no admin/email info added ---
{
  check(
    /res\.json\(\{ job, message: 'Job submitted for review\./.test(employerController),
    'submit-for-approval: response remains the existing pending-review contract'
  );
}

// --- 3/5/6. notifyStaff wired with correct entity/link; email uses queueEmail with dedupKey ---
{
  check(
    /export async function onJobSubmitted\(\{ jobId, jobTitle, companyName, employerId \}\) \{/.test(automationService),
    'automationService.js: defines onJobSubmitted with the expected signature (PF-J2 added employerId)'
  );
  check(
    /await notifyStaff\(\{\s*category: 'job',\s*type: 'job\.submitted',/.test(automationService),
    'onJobSubmitted: calls the canonical notifyStaff service (not a new notification model)'
  );
  check(
    /link: '\/admin\/moderation',/.test(automationService),
    "onJobSubmitted: notification links to the real canonical Admin moderation route ('/admin/moderation', confirmed mounted at client/src/routes/index.jsx as the ADMIN + 'moderation' child, rendering ModerationQueue.jsx)"
  );
  check(
    /metadata: \{ jobId \},/.test(automationService),
    'onJobSubmitted: notification carries the Job entity id in metadata'
  );
  check(
    /templateKey: 'jobSubmitted',/.test(automationService) && /dedupKey: `email:job:submitted:\$\{jobId\}`,/.test(automationService),
    'onJobSubmitted: email uses queueEmail with a stable per-job dedupKey (native BackgroundJob dedup, same mechanism as onJobApproved)'
  );
  check(
    /const adminEmail = process\.env\.CONTACT_ADMIN_EMAIL \|\| process\.env\.MAIL_FROM \|\| process\.env\.MAIL_USER;/.test(automationService),
    'onJobSubmitted: reuses the existing admin-alert recipient convention (same fallback chain as sendContactAdminAlertEmail), no new email service invented'
  );
  {
    const adminPortionStart = automationService.indexOf('export async function onJobSubmitted(');
    const adminPortionEnd = automationService.indexOf('if (employerId) {', adminPortionStart);
    const adminOnlyPortion = automationService.slice(adminPortionStart, adminPortionEnd === -1 ? undefined : adminPortionEnd);
    check(
      !/password|token|employer\.email/.test(adminOnlyPortion),
      'onJobSubmitted: the Admin-facing notification/email portion does not include Employer credentials or private Employer contact fields (the function\'s separate Employer-acknowledgement portion, added in PF-J2, legitimately uses employer.email as the Employer\'s own recipient address and is checked separately)'
    );
  }
}

// --- 7/13/14. Regression: existing onJobApproved (Employer-facing) is untouched ---
{
  check(
    /export async function onJobApproved\(\{ jobId, employerId, jobTitle \}\) \{/.test(automationService),
    'automationService.js: onJobApproved (Employer approval notification/email) still present, unchanged'
  );
  check(
    /queueNotification\(\{\s*dedupKey: `job:approved:\$\{jobId\}`,/.test(automationService),
    'onJobApproved: Employer approval notification path unchanged'
  );
  // Note: onJobRejected was intentionally added later by PF-J3-A (a separate,
  // dedicated commit) — no longer asserted absent here.
}

// --- 8/9. Email template: subject indicates pending review; CTA present; no sensitive vars ---
{
  check(
    /jobSubmitted: \{/.test(emailTemplates),
    'emailTemplates.js: jobSubmitted template exists'
  );
  check(
    /subject: `\$\{BRAND\} – Job pending review: \$\{jobTitle\}`,/.test(emailTemplates),
    'jobSubmitted template: subject clearly indicates pending review'
  );
  check(
    /admin\/moderation.*Review in admin|Review in admin.*admin\/moderation/.test(
      emailTemplates.slice(emailTemplates.indexOf('jobSubmitted:'), emailTemplates.indexOf('jobSubmitted:') + 900)
    ),
    'jobSubmitted template: includes a moderation CTA button to the admin moderation route'
  );
  check(
    !/jobSubmitted:[\s\S]{0,900}(password|token|email:)/i.test(emailTemplates),
    'jobSubmitted template: no credential/private-field variables are interpolated'
  );
}

console.log(`jobSubmissionAdminNotification.test.js: ${count} assertions passed`);
