/**
 * PF-J2 — Employer pending-review acknowledgement (notification + email)
 * after a Job is durably submitted, alongside the existing Admin/staff path.
 * Run: node server/src/__tests__/employerJobPendingAcknowledgement.test.js
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

const controller = read('controllers/employerController.js');
const automation = read('services/automationService.js');
const templates = read('templates/emailTemplates.js');

function fnBody(src, exportSig) {
  const start = src.indexOf(exportSig);
  const end = src.indexOf('\nexport async function', start + 1);
  return src.slice(start, end === -1 ? undefined : end);
}

// --- 1/3/15/16/17. Job persists before onJobSubmitted; employerId threaded through; fire-and-forget unchanged; response unchanged ---
{
  const createIdx = controller.indexOf('const job = await Job.create({');
  const onJobSubmittedIdx = controller.indexOf('onJobSubmitted({');
  check(createIdx > -1 && onJobSubmittedIdx > createIdx, 'createJob: onJobSubmitted still called only after Job.create()');
  check(
    /onJobSubmitted\(\{\s*jobId: job\._id,\s*jobTitle: job\.title,\s*companyName,\s*employerId,\s*\}\)\.catch\(\(\) => \{\}\);/.test(controller),
    'createJob: employerId is now threaded through to onJobSubmitted, call remains fire-and-forget'
  );
  check(
    /res\.status\(201\)\.json\(\{ job, isFirstJobFree: isFirstJob \}\);/.test(controller),
    'createJob: Employer response body is unchanged'
  );
}

const onJobSubmittedBody = fnBody(automation, 'export async function onJobSubmitted(');

// --- 2/4/5/6/7/8. Employer notification: recipient, type, metadata, link, wording, dedup ---
{
  check(
    /export async function onJobSubmitted\(\{ jobId, jobTitle, companyName, employerId \}\)/.test(automation),
    'onJobSubmitted: signature now accepts employerId'
  );
  check(
    /if \(employerId\) \{\s*await queueNotification\(\{\s*dedupKey: `job:submitted:pending:\$\{jobId\}`,\s*recipientType: 'employer',\s*employerId,/.test(onJobSubmittedBody),
    'onJobSubmitted: Employer notification created via queueNotification, recipientType employer, matching the owning employerId'
  );
  check(/type: 'job\.submitted\.pending',/.test(onJobSubmittedBody), 'Employer notification: stable, specific type (job.submitted.pending)');
  check(/link: '\/employer\/jobs',/.test(onJobSubmittedBody), "Employer notification: links to '/employer/jobs'");
  check(
    /title: `Job submitted: \$\{jobTitle\}`,\s*\n\s*body: 'Your job listing was submitted and is awaiting Admin review\.',/.test(onJobSubmittedBody),
    'Employer notification: wording confirms submission + pending review'
  );
  check(
    !/approved|is now live|published/i.test(onJobSubmittedBody.slice(onJobSubmittedBody.indexOf("type: 'job.submitted.pending'"))),
    'Employer notification: does not claim approval or publication'
  );
  const metadataMatches = onJobSubmittedBody.match(/metadata: \{ jobId \},/g) || [];
  check(metadataMatches.length >= 2, 'Both Admin and Employer notifications carry { jobId } metadata');
}

// --- 9/10/11/14. Employer email: enqueue, recipient resolution, dedicated template, dedup ---
{
  check(
    /const employer = await Employer\.findById\(employerId\)\.select\('email'\)\.lean\(\);/.test(onJobSubmittedBody),
    'Employer recipient resolution matches the existing onJobApproved contract exactly (Employer.findById(employerId).select(\'email\').lean())'
  );
  check(
    /if \(employer\?\.email\) \{\s*await queueEmail\(\{\s*to: employer\.email,\s*templateKey: 'jobSubmittedEmployer',/.test(onJobSubmittedBody),
    'Employer pending email enqueued via the existing queueEmail infrastructure with a dedicated template'
  );
  check(
    /dedupKey: `email:job:submitted:pending:\$\{jobId\}`,/.test(onJobSubmittedBody),
    'Employer pending email has a stable, distinct dedup key'
  );
  check(
    !/templateKey: 'jobSubmitted',[\s\S]{0,30}employer\.email/.test(onJobSubmittedBody),
    "Employer email does not reuse the Admin 'jobSubmitted' template"
  );
}

// --- 12/13/22. Template: CTA, no approval/publication claim, no sensitive data ---
{
  const tplStart = templates.indexOf('jobSubmittedEmployer: {');
  const tplEnd = templates.indexOf('\n  employerVerification:');
  const tplBody = templates.slice(tplStart, tplEnd);
  check(tplStart > -1, 'emailTemplates.js: jobSubmittedEmployer template exists');
  check(/\/employer\/jobs/.test(tplBody), 'jobSubmittedEmployer template: CTA targets /employer/jobs');
  check(
    /awaiting Admin review\. It is not yet published\./.test(tplBody) && !/is now live/.test(tplBody),
    'jobSubmittedEmployer template: explicitly states pending review, not approved/published'
  );
  check(
    !/password|token|email:/i.test(tplBody),
    'jobSubmittedEmployer template: no credential/private-field variables interpolated'
  );
}

// --- 18. Admin submission notification/email regression ---
{
  check(/await notifyStaff\(\{\s*category: 'job',\s*type: 'job\.submitted',/.test(onJobSubmittedBody), 'Admin/staff notification (job.submitted) unchanged');
  check(/templateKey: 'jobSubmitted',/.test(onJobSubmittedBody), 'Admin email template (jobSubmitted) unchanged');
  check(/dedupKey: `email:job:submitted:\$\{jobId\}`,/.test(onJobSubmittedBody), 'Admin email dedup key unchanged');
}

// --- 19/20. Employer approval regression; no rejection behavior introduced ---
{
  check(
    /export async function onJobApproved\(\{ jobId, employerId, jobTitle \}\) \{/.test(automation),
    'onJobApproved unchanged, still present'
  );
  check(!/onJobRejected/.test(automation), 'No onJobRejected introduced in this phase (out of scope, deferred to PF-J3)');
}

console.log(`employerJobPendingAcknowledgement.test.js: ${count} assertions passed`);
