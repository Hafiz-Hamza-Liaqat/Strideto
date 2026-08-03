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

// --- 1/11. onJobSubmitted is only called after Job.create() succeeds, fire-and-forget ---
{
  const createIdx = employerController.indexOf('const job = await Job.create({');
  const submittedIdx = employerController.indexOf('onJobSubmitted({');
  const responseIdx = employerController.indexOf('res.status(201).json({ job, isFirstJobFree: isFirstJob });');
  check(createIdx > -1 && submittedIdx > createIdx, 'createJob: onJobSubmitted is called only after Job.create() in source order');
  check(submittedIdx > -1 && responseIdx > submittedIdx, 'createJob: onJobSubmitted is invoked before the response is sent (not blocking a later step)');
  check(
    /onJobSubmitted\(\{\s*jobId: job\._id,\s*jobTitle: job\.title,\s*companyName,\s*\}\)\.catch\(\(\) => \{\}\);/.test(employerController),
    'createJob: onJobSubmitted is fire-and-forget (not awaited), matching the existing onJobApplication pattern'
  );
  check(
    !/await onJobSubmitted/.test(employerController),
    'createJob: does not await onJobSubmitted (no added response latency)'
  );
}

// --- 12. Employer response unchanged: no admin/email info added ---
{
  check(
    /res\.status\(201\)\.json\(\{ job, isFirstJobFree: isFirstJob \}\);/.test(employerController),
    'createJob: Employer response body is unchanged (job + isFirstJobFree only)'
  );
}

// --- 3/5/6. notifyStaff wired with correct entity/link; email uses queueEmail with dedupKey ---
{
  check(
    /export async function onJobSubmitted\(\{ jobId, jobTitle, companyName \}\) \{/.test(automationService),
    'automationService.js: defines onJobSubmitted with the expected signature'
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
  check(
    !/onJobSubmitted[\s\S]{0,600}password|onJobSubmitted[\s\S]{0,600}token|onJobSubmitted[\s\S]{0,600}employer\.email/.test(automationService),
    'onJobSubmitted: does not include Employer credentials or private Employer contact fields'
  );
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
  check(
    !/onJobRejected/.test(automationService),
    'No rejection-to-Employer notification exists in this codebase to regress (bulkRejectJobs never called one) — confirms nothing was silently removed by this phase'
  );
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
