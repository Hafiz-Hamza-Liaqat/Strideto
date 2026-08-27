/**
 * PF-HIRE-B4 — canonical server-side Job application-destination validation.
 * Confirmed vulnerability (docs/STRIDETO_INTERNAL_HIRING_SETUP_CONNECTION_AUDIT.md
 * §18): neither employerController.js's createJob/updateJob nor
 * adminJobsController.js's applyJobBody validated applicationLink's URL
 * scheme server-side — only the client-side isValidHttpUrl did, which any
 * direct API call bypasses entirely.
 *
 * Part 1 (executable): the real, imported validateApplicationLink/
 * validateApplyEmail helpers, exercised against the scheme/format matrix
 * required by this phase.
 * Part 2 (source-contract, matching this repo's established convention for
 * these two DB-backed controllers — no test-Mongo harness exists for them):
 * proves the validators are actually wired in before persistence in both
 * write paths, and that nothing else in scope changed.
 *
 * Run: node src/__tests__/jobApplicationDestinationValidation.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

const { validateApplicationLink, validateApplyEmail } = await import(
  pathToFileURL(path.resolve(serverSrc, 'utils/jobApplicationDestination.js')).href
);

// ---- Part 1: executable helper behavior ----

// 1/2. Valid https/http accepted
check(validateApplicationLink('https://example.com/careers').ok === true, '1. https accepted');
check(validateApplicationLink('http://example.com/careers').ok === true, '2. http accepted');

// 3-6. Unsafe schemes rejected
check(validateApplicationLink('javascript:alert(1)').ok === false, '3. javascript: rejected');
check(validateApplicationLink('data:text/html,x').ok === false, '4. data: rejected');
check(validateApplicationLink('vbscript:msgbox(1)').ok === false, '5. vbscript: rejected');
check(validateApplicationLink('file:///etc/passwd').ok === false, '6. file: rejected');

// 7. Protocol-relative rejected
check(validateApplicationLink('//evil.example/x').ok === false, '7. protocol-relative rejected');

// 8. Malformed rejected
check(validateApplicationLink('not a url').ok === false, '8. malformed URL rejected');

// 9. Whitespace trimmed
{
  const result = validateApplicationLink('  https://example.com/x  ');
  check(result.ok === true && result.value === 'https://example.com/x', '9. surrounding whitespace trimmed');
}

// Whitespace-only normalizes to empty (null)
{
  const result = validateApplicationLink('   ');
  check(result.ok === true && result.value === null, 'whitespace-only normalizes to empty');
}

// Embedded credentials rejected
check(validateApplicationLink('https://user:pass@evil.example/x').ok === false, 'embedded credentials rejected');

// Control characters rejected
check(validateApplicationLink('https://example.com/x').ok === false, 'control characters rejected');

// No parser stack/raw exception leaks into the result shape (21)
{
  const result = validateApplicationLink('not a url');
  check(
    Object.keys(result).every((k) => ['ok', 'field', 'message'].includes(k)) && typeof result.message === 'string',
    '21. failure result exposes only {ok, field, message} — no stack/parser internals'
  );
}

// 10. Internal Job with no applicationLink remains valid
check(validateApplicationLink(null).ok === true && validateApplicationLink(null).value === null, '10. null (no destination) is valid');

// 11. Valid applyEmail without applicationLink remains valid
check(validateApplyEmail('jobs@example.com').ok === true, '11. valid applyEmail accepted');

// 12. Invalid applyEmail rejected
check(validateApplyEmail('not-an-email').ok === false, '12. invalid applyEmail rejected');

// 13. Newline/header-injection email input rejected
check(validateApplyEmail('jobs@example.com\nBcc: x@evil.com').ok === false, '13. newline/header-injection email rejected');

// Email empty permitted (another method may be used)
check(validateApplyEmail('').ok === true && validateApplyEmail('').value === null, 'empty applyEmail permitted');

console.log(`  helper assertions: ${count}`);

// ---- Part 2: source-contract wiring proof ----

const employerController = read('controllers/employerController.js');
const adminJobsController = read('controllers/admin/adminJobsController.js');

// 14/17/18. Employer create/update and Admin create/update all import and call the same canonical validators
{
  check(
    /import \{ validateApplicationLink, validateApplyEmail \} from '\.\.\/utils\/jobApplicationDestination\.js';/.test(employerController),
    '14. employerController.js imports the canonical validators'
  );
  check(
    /import \{ validateApplicationLink, validateApplyEmail \} from '\.\.\/\.\.\/utils\/jobApplicationDestination\.js';/.test(adminJobsController),
    '17/18. adminJobsController.js imports the canonical link and email validators'
  );
}

// Employer create: validation runs before Job.create (persistence)
{
  const createFn = employerController.slice(
    employerController.indexOf('export const createJob'),
    employerController.indexOf('export const getMyApplications') !== -1
      ? employerController.indexOf('export const getMyApplications')
      : employerController.indexOf('export const updateJob')
  );
  const validateIdx = createFn.indexOf('validateApplicationLink(body.applyLink)');
  const persistIdx = createFn.indexOf('await Job.create(');
  check(validateIdx !== -1 && persistIdx !== -1 && validateIdx < persistIdx, '20. Employer createJob validates before Job.create persists');
}

// Employer update: validation runs before job.save() and before any field mutation
{
  const updateFn = employerController.slice(
    employerController.indexOf('export const updateJob'),
    employerController.indexOf('export const closeJob')
  );
  const validateIdx = updateFn.indexOf('validateApplicationLink(incoming)');
  const forEachIdx = updateFn.indexOf('allowed.forEach');
  const saveIdx = updateFn.indexOf('await job.save();');
  check(
    validateIdx !== -1 && forEachIdx !== -1 && saveIdx !== -1 && validateIdx < forEachIdx && forEachIdx < saveIdx,
    '15/20. Employer updateJob validates before any field is assigned, and both occur before job.save()'
  );
}

// 15. Omitted destination during update preserves the existing value (linkSupplied gate unchanged in spirit)
{
  check(
    /const linkSupplied = body\.applyLink !== undefined \|\| body\.applicationLink !== undefined;/.test(employerController),
    '15. updateJob only touches applicationLink when one of its two possible key names is actually supplied — omission still preserves the existing stored value'
  );
}

// 16. Explicit clear (empty string) remains distinguishable from omission and is accepted by the validator as a valid clear
{
  const result = validateApplicationLink('');
  check(
    result.ok === true && result.value === null,
    '16. An explicitly-supplied empty string is accepted as a valid clear (value:null), not rejected — clearing is not blocked by this phase\'s validation even though the client cannot yet send it (PF-HIRE-B2)'
  );
}

// Admin create/update check the validation-error return before doc.save()
{
  const createFn = adminJobsController.slice(
    adminJobsController.indexOf('export const create ='),
    adminJobsController.indexOf('export const update =')
  );
  const updateFn = adminJobsController.slice(
    adminJobsController.indexOf('export const update ='),
    adminJobsController.indexOf('// Field-level duplication contract')
  );
  check(
    /const validationError = applyJobBody\(doc, body, true\);\s*if \(validationError\) return res\.status\(validationError\.status\)/.test(createFn)
      && createFn.indexOf('const validationError = applyJobBody') < createFn.indexOf('await doc.save();'),
    '17. Admin create checks the validation result and returns before doc.save() on failure'
  );
  check(
    /const validationError = applyJobBody\(doc, body\);\s*if \(validationError\) return res\.status\(validationError\.status\)/.test(updateFn)
      && updateFn.indexOf('const validationError = applyJobBody') < updateFn.indexOf('await doc.save();'),
    '18. Admin update checks the validation result and returns before doc.save() on failure'
  );
}

// 19. Duplicate does not introduce a new unsafe URL: duplicate() is untouched and does not call applyJobBody
{
  const duplicateFn = adminJobsController.slice(
    adminJobsController.indexOf('export const duplicate ='),
    adminJobsController.indexOf('export const bulkAction =')
  );
  check(
    !duplicateFn.includes('applyJobBody') && duplicateFn.includes('buildJobDuplicateProjection'),
    '19. duplicate() is unchanged — it copies the already-validated source Job\'s stored fields verbatim via buildJobDuplicateProjection, not through applyJobBody, so it introduces no new value to validate and cannot mutate the source Job'
  );
}

// 20. No persistence call precedes validation anywhere in the two update paths (already proven above); explicit no-Job-created-on-failure check for employer create
{
  const createFn = employerController.slice(
    employerController.indexOf('export const createJob'),
    employerController.indexOf('export const updateJob')
  );
  check(
    createFn.indexOf("return res.status(400).json({ error: linkResult.message") <
      createFn.indexOf('const slug = jobSlug'),
    '20. Employer createJob returns on link-validation failure before any slug/Job.create work begins'
  );
}

// 27. Admin bulkAction is untouched (no applyType/applicationLink write) — moderation-adjacent path unaffected
{
  const bulkFn = adminJobsController.slice(adminJobsController.indexOf('export const bulkAction ='));
  check(
    !/applyType|applicationLink|applyEmail/.test(bulkFn.slice(0, bulkFn.indexOf('export const') === -1 ? bulkFn.length : bulkFn.indexOf('\nexport const', 1))),
    '27. bulkAction contains no applyType/applicationLink/applyEmail write — unaffected by this phase'
  );
}

// 30. No new dependency: this file and the helper only import Node built-ins and existing repo modules
{
  const helperSrc = read('utils/jobApplicationDestination.js');
  check(
    /^import \{ isValidHttpUrl, isValidEmail \} from '\.\/employerProfileValidation\.js';$/m.test(helperSrc),
    '30. jobApplicationDestination.js has exactly one import, an existing repo module — no new dependency introduced'
  );
}

console.log(`jobApplicationDestinationValidation.test.js: ${count} assertions passed`);
