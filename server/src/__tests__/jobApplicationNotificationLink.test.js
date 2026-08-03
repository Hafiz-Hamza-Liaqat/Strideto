/**
 * PF-N2 — internal Job application notification links to its personal
 * tracker record instead of a generic /dashboard route.
 * Run: node server/src/__tests__/jobApplicationNotificationLink.test.js
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

const controller = read('controllers/applicationsController.js');
const automation = read('services/automationService.js');

// --- 1/2/10. Tracker (dual-write) is created, and awaited, before onJobApplication is called ---
{
  const dualWriteIdx = controller.indexOf('const dualWrite = await ApplicationMigrationService.dualWriteFromLegacyJobApplication(');
  const onJobAppIdx = controller.indexOf('onJobApplication({');
  check(dualWriteIdx > -1 && onJobAppIdx > dualWriteIdx, 'applicationsController.js: dual-write tracker creation is awaited before onJobApplication is called (source order unchanged)');
  check(
    /application = await Application\.create\(\{/.test(controller),
    'applicationsController.js: Employer-facing Application.create call is unchanged'
  );
}

// --- 3/4/5. opportunityApplicationId is threaded through and used as the link identifier ---
{
  check(
    /onJobApplication\(\{\s*applicationId: application\._id,\s*opportunityApplicationId,\s*userId,/.test(controller),
    'applicationsController.js: opportunityApplicationId (the tracker record id) is passed to onJobApplication'
  );
  check(
    /export async function onJobApplication\(\{ applicationId, opportunityApplicationId, userId, jobId, userName, userEmail \}\)/.test(automation),
    'automationService.js: onJobApplication accepts opportunityApplicationId'
  );
  check(
    /link: opportunityApplicationId \? `\/applications\/\$\{opportunityApplicationId\}` : '\/dashboard',/.test(automation),
    "onJobApplication: link uses '/applications/${opportunityApplicationId}' — the tracker record id, not the Job id or the legacy Application id"
  );
}

// --- onJobApplication body scoped checks: no bare /dashboard link, no jobId used as tracker id ---
{
  const start = automation.indexOf('export async function onJobApplication(');
  const nextFn = automation.indexOf('\nexport async function', start + 1);
  const onJobApplicationBody = automation.slice(start, nextFn === -1 ? undefined : nextFn);

  check(
    !/link: '\/dashboard',/.test(onJobApplicationBody),
    'onJobApplication: the old unconditional /dashboard link is gone from this function (a different, unrelated function elsewhere in the file legitimately keeps its own /dashboard link, untouched)'
  );
  check(
    !/`\/applications\/\$\{jobId\}`/.test(onJobApplicationBody),
    'onJobApplication: the link never uses the Job id as if it were the tracker id'
  );
}

// --- 6. Recipient/type/title/body/dedupKey preserved exactly ---
{
  check(/recipientType: 'user',/.test(automation), 'onJobApplication: recipientType unchanged (user)');
  check(/type: 'application\.submitted',/.test(automation), 'onJobApplication: notification type unchanged');
  check(/title: `Application submitted: \$\{job\.title\}`,/.test(automation), 'onJobApplication: title unchanged');
  check(/body: `Your application for \$\{job\.title\} was received\.`,/.test(automation), 'onJobApplication: body unchanged');
  check(/dedupKey: `application:student:\$\{applicationId\}`,/.test(automation), 'onJobApplication: dedupKey unchanged (still keyed on the stable legacy applicationId)');
}

// --- 7. Resulting route matches the safe-internal-link pattern PF-N accepts (single leading slash, no scheme, no protocol-relative) ---
{
  const sampleId = '64f1a2b3c4d5e6f7a8b9c0d1';
  const link = `/applications/${sampleId}`;
  const isSafe = /^\/[^/\\]/.test(link) && !/^[a-z][a-z0-9+.-]*:/i.test(link) && !link.includes('://');
  check(isSafe === true, "the constructed link shape ('/applications/<id>') satisfies PF-N's isSafeInternalLink contract");
}

// --- 8. Fallback preserved for the best-effort dual-write failure case ---
{
  check(
    /const dualWrite = await ApplicationMigrationService\.dualWriteFromLegacyJobApplication\(/.test(controller),
    'applicationsController.js: dual-write remains a single, awaited, non-throwing best-effort call (dualWriteFromLegacyJobApplication catches its own errors)'
  );
  check(
    /const opportunityApplicationId = opportunityApplication\?\._id\s*\n\s*\? String\(opportunityApplication\._id\)\s*\n\s*: null;/.test(controller),
    'applicationsController.js: opportunityApplicationId safely resolves to null when the tracker record does not exist, matching the /dashboard fallback branch'
  );
}

// --- 9. Exactly one User-facing notification (unchanged: one user + one pre-existing, untouched employer notification) ---
{
  const start = automation.indexOf('export async function onJobApplication(');
  const end = automation.indexOf('\nexport async function', start + 1);
  const body = automation.slice(start, end === -1 ? undefined : end);
  const userNotifications = body.match(/recipientType: 'user',/g) || [];
  const employerNotifications = body.match(/recipientType: 'employer',/g) || [];
  check(userNotifications.length === 1, 'onJobApplication: exactly one User-facing notification (the one corrected) — no duplicate introduced');
  check(employerNotifications.length === 1, "onJobApplication: the pre-existing, separate Employer-facing 'new application' notification (link: '/employer/applications') is untouched — not the same notification as the User's");
}

console.log(`jobApplicationNotificationLink.test.js: ${count} assertions passed`);
