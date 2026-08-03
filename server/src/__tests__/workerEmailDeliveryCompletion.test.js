/**
 * PF-J-R1 — worker SMTP configuration and false-completion correction.
 * `sendEmail()` resolves (does not throw) when SMTP is unconfigured, so this
 * exercises that real, exported function directly (no mock needed, no
 * network/DB touched — getTransporter() short-circuits before any I/O when
 * MAIL_HOST/USER/PASS are unset) and proves the queue-level fix via source
 * assertion, since `processEmailJob` is an intentionally private function
 * that only runs through `processQueue()` (requires live Mongo).
 * Run: node server/src/__tests__/workerEmailDeliveryCompletion.test.js
 */
import assert from 'assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

delete process.env.MAIL_HOST;
delete process.env.MAIL_USER;
delete process.env.MAIL_PASS;

const { sendEmail, isSmtpConfigured } = await import('../services/emailService.js');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
const repoRoot = path.resolve(serverSrc, '..', '..');
function read(relPath) {
  return readFileSync(path.join(serverSrc, relPath), 'utf8');
}
function readRepo(relPath) {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

const queueSvc = read('services/jobQueueService.js');
const automation = read('services/automationService.js');
const composeLocal = readRepo('docker-compose.sec3f-local.yml');
const composeStaging = readRepo('docker-compose.staging.yml');

// --- 5/6/9. Missing SMTP: real function call, no mock — proves the pre-existing (preserved) contract ---
{
  check(isSmtpConfigured() === false, 'isSmtpConfigured(): false when MAIL_HOST/USER/PASS are unset');
  const result = await sendEmail({ to: 'test@example.com', subject: 'x', body: '<p>x</p>' });
  check(result.sent === false && result.placeholder === true, 'sendEmail(): resolves (does not throw) with { sent:false, placeholder:true } — synchronous verification/reset-email behavior preserved');
}

// --- 5/6/7. Queue-level fix: processEmailJob now checks the delivery result before letting processQueue mark completed ---
{
  check(
    /const result = payload\.templateKey\s*\?\s*await sendTemplatedEmail\(/.test(queueSvc),
    'jobQueueService.js: processEmailJob captures the real send result instead of returning it directly'
  );
  check(
    /if \(!result\?\.sent\) \{\s*const err = new Error\(result\?\.placeholder \? 'email_transport_not_configured' : 'email_not_sent'\);\s*err\.code = 'EMAIL_NOT_DELIVERED';\s*throw err;\s*\}/.test(queueSvc),
    'jobQueueService.js: a non-delivered result (placeholder or otherwise) now throws instead of silently succeeding'
  );
  check(
    !/err\.message[\s\S]{0,50}payload\.to|throw err;\s*\}\s*return result;[\s\S]{0,10}\}\s*\n[\s\S]{0,10}payload\.to/.test(queueSvc),
    'jobQueueService.js: the thrown error carries only a safe category string, never the recipient/body'
  );
}

// --- 7/8/10. processQueue's existing completed/retry/dead-letter/dedup logic is unchanged ---
{
  check(
    /job\.status = 'completed';\s*job\.processedAt = new Date\(\);/.test(queueSvc),
    'jobQueueService.js: the success path (real delivery) still marks the job completed, unchanged'
  );
  check(
    /if \(job\.attempts >= job\.maxAttempts\) \{\s*job\.status = 'dead';/.test(queueSvc),
    'jobQueueService.js: existing dead-letter threshold logic is unchanged — a persistently undelivered email now correctly exhausts retries instead of false-completing on attempt 1'
  );
  check(
    /job\.status = 'pending';\s*job\.scheduledAt = new Date\(Date\.now\(\) \+ job\.attempts \* 60 \* 1000\);/.test(queueSvc),
    'jobQueueService.js: existing retry/backoff scheduling is unchanged'
  );
  check(
    /if \(dedupKey\) \{\s*const existing = await BackgroundJob\.findOne\(\{\s*dedupKey,/.test(queueSvc),
    'jobQueueService.js: enqueueJob dedup-by-dedupKey logic is unchanged'
  );
}

// --- Regression: the synchronous/sensitive direct-send path (verification, reset, jobApproved/jobSubmitted-sensitive) is untouched ---
{
  check(
    /if \(templateKey && SENSITIVE_EMAIL_TEMPLATES\.has\(templateKey\)\) \{\s*try \{\s*const result = await sendTemplatedEmail\(to, templateKey, lang \|\| 'en', vars \|\| \{\}\);\s*return \{\s*enqueued: false,\s*sentDirect: true,\s*sent: !!result\?\.sent,\s*placeholder: !!result\?\.placeholder,/.test(automation),
    'automationService.js: queueEmail\'s sensitive-template direct-send branch is untouched — still reports placeholder/sent transparently rather than throwing'
  );
}

// --- 1/2/3/4. Compose: worker now gets the same local Mailpit contract as api-a/api-b, still profile-disabled by default ---
{
  const workerBlock = composeLocal.slice(composeLocal.indexOf('  worker:'), composeLocal.indexOf('  frontend:'));
  check(/profiles:\s*\n\s*- sec3f-worker-disabled/.test(workerBlock), 'docker-compose.sec3f-local.yml: worker remains behind the disabled-by-default profile');
  check(/MAIL_HOST: mailpit/.test(workerBlock), 'docker-compose.sec3f-local.yml: worker MAIL_HOST matches api-a/api-b (mailpit)');
  check(/MAIL_PORT: "1025"/.test(workerBlock), 'docker-compose.sec3f-local.yml: worker MAIL_PORT matches api-a/api-b (1025)');
  check(/MAIL_SECURE: "false"/.test(workerBlock), 'docker-compose.sec3f-local.yml: worker MAIL_SECURE matches api-a/api-b (false)');
  check(/MAIL_FROM: Strideto Local <noreply@strideto\.test>/.test(workerBlock), 'docker-compose.sec3f-local.yml: worker MAIL_FROM matches api-a/api-b');

  const apiABlock = composeLocal.slice(composeLocal.indexOf('  api-a:'), composeLocal.indexOf('  api-b:'));
  check(/MAIL_HOST: mailpit/.test(apiABlock) && /MAIL_PORT: "1025"/.test(apiABlock), 'api-a mail contract unchanged (reference for equivalence)');

  check(!/MAIL_HOST|MAIL_PORT|MAIL_SECURE/.test(composeStaging), 'docker-compose.staging.yml: no production/staging mail defaults were added — local-only correction stayed in the local overlay');
}

console.log(`workerEmailDeliveryCompletion.test.js: ${count} assertions passed`);
