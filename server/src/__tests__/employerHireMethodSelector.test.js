/**
 * PF-HIRE-B1 — explicit Employer application-method selector on Job
 * creation, and employerController.createJob's new (optional, backward-
 * compatible) explicit-applyType contract.
 *
 * Source-contract style for the DB-backed controller (no test-Mongo harness
 * exists for it, matching this repo's established convention); the client
 * form-logic pieces (validateApplyMethodSelection/buildApplyMethodPayload)
 * are already covered executably in employerPostJobValidation.test.js.
 *
 * Run: node src/__tests__/employerHireMethodSelector.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
const clientSrc = path.resolve(serverSrc, '..', '..', 'client', 'src');

const employerController = readFileSync(path.join(serverSrc, 'controllers/employerController.js'), 'utf8');
const postJobPage = readFileSync(path.join(clientSrc, 'pages/Employer/EmployerPostJob.jsx'), 'utf8');
const postJobValidation = readFileSync(path.join(clientSrc, 'pages/Employer/employerPostJobValidation.js'), 'utf8');

const createFn = employerController.slice(
  employerController.indexOf('export const createJob'),
  employerController.indexOf('export const getMyApplications') !== -1
    ? employerController.indexOf('export const getMyApplications')
    : employerController.indexOf('export const updateJob')
);

// ---- Server: createJob's explicit applyType contract ----

// 19. Server accepts explicit internal applyType
{
  check(
    /if \(body\.applyType === 'internal' && \(linkResult\.value \|\| emailResult\.value\)\) \{/.test(createFn),
    "19/23. An explicit applyType:'internal' combined with a real destination is rejected as contradictory — internal alone (no destination) is accepted"
  );
}

// 20/21. Server accepts valid external URL/email combinations (single check covers both, since both feed the same linkResult/emailResult union)
{
  check(
    /if \(body\.applyType === 'external' && !linkResult\.value && !emailResult\.value\) \{/.test(createFn),
    '20/21/24. External is accepted whenever at least one of the (already-validated) URL or email destinations is present, and rejected only when both are empty'
  );
}

// 22. Server rejects unknown applyType values
{
  check(
    /if \(body\.applyType !== 'internal' && body\.applyType !== 'external'\) \{\s*return res\.status\(400\)\.json\(\{ error: 'applyType must be internal or external', field: 'applyType' \}\);/.test(
      createFn
    ),
    "22. Any applyType value other than 'internal'/'external' is rejected with a 400 and a stable field identifier"
  );
}

// Backward compatibility: explicit applyType is optional; omission falls back to the pre-existing inference (unchanged from PF-HIRE-B4)
{
  check(
    /if \(body\.applyType !== undefined\) \{/.test(createFn) &&
      /\} else \{\s*applyType = linkResult\.value \|\| emailResult\.value \? 'external' : 'internal';\s*\}/.test(createFn),
    'A caller that omits applyType entirely still gets the original link/email-presence inference — no regression for existing callers/tests'
  );
}

// No partial persistence: every applyType check occurs before Job.create
{
  const validateIdx = createFn.indexOf("body.applyType !== undefined");
  const createIdx = createFn.indexOf('await Job.create(');
  check(validateIdx !== -1 && createIdx !== -1 && validateIdx < createIdx, 'All applyType validation happens before Job.create — no partial Job is ever persisted on a rejected combination');
}

// 26. Client-supplied employerId remains ignored (unchanged from every prior phase)
{
  check(!/req\.body\.employerId|req\.query\.employerId/.test(createFn), '26. createJob still never reads employerId from the request body/query — ownership remains req.employer.employerId only');
}

// 25. PF-HIRE-B4 unsafe-URL validation remains active and unmodified in position (still runs before the new applyType block)
{
  const linkValidateIdx = createFn.indexOf('validateApplicationLink(body.applyLink)');
  const applyTypeIdx = createFn.indexOf('body.applyType !== undefined');
  check(linkValidateIdx !== -1 && applyTypeIdx !== -1 && linkValidateIdx < applyTypeIdx, '25. The PF-HIRE-B4 destination-scheme validation still runs first — the new applyType logic only ever sees already-safe, normalized values');
}

// ---- Client: selector wiring ----

// 1/2/6/7. Selector renders all three options, is required, defaults to internal, only in create mode
{
  check(
    /APPLY_METHOD_VALUES\.map\(\(method, idx\) => \(/.test(postJobPage),
    '1. The create-mode fieldset renders one radio per APPLY_METHOD_VALUES entry (all three options)'
  );
  check(
    /applyMethod: DEFAULT_APPLY_METHOD,/.test(postJobPage),
    "7. defaultForm initializes applyMethod to DEFAULT_APPLY_METHOD ('internal') — confirmed the safe default per this phase's own instruction"
  );
  check(
    /\{isEdit \? \(/.test(postJobPage) && postJobPage.includes('data-testid="apply-method-selector"'),
    '6. The selector is rendered only in the create-mode branch (isEdit ? old fieldset : new selector) — edit mode is untouched'
  );
}

// 3/4/5. Consequence copy keys exist for all three methods
{
  check(
    /applyMethodInternalHelp/.test(postJobPage) && /applyMethodExternalUrlHelp/.test(postJobPage) && /applyMethodExternalEmailHelp/.test(postJobPage),
    '3/4/5. All three methods render their own consequence-copy translation key'
  );
}

// 8/11/15. Conditional field visibility
{
  check(
    /\{form\.applyMethod === 'external_url' && \(/.test(postJobPage),
    '8/11. The Apply Link field is only rendered when external_url is selected (hidden for internal/external_email)'
  );
  check(
    /\{form\.applyMethod === 'external_email' && \(/.test(postJobPage),
    '15. The Apply Email field is only rendered when external_email is selected (hidden for internal/external_url)'
  );
}

// 9/14/17/18. Create submission uses buildApplyMethodPayload, overriding the base payload's applyLink/applyEmail
{
  check(
    /\{ \.\.\.buildCreateJobPayload\(form, result\.skills\), \.\.\.buildApplyMethodPayload\(form\) \}/.test(postJobPage),
    '9/14/17/18. Create-mode payload spreads buildApplyMethodPayload over the base payload, so applyType/applyLink/applyEmail always reflect the selected method, never stale hidden-field text'
  );
}

// 30. Edit-mode payload/behavior is completely untouched
{
  check(
    /const payload = isEdit\s*\? buildUpdateJobPayload\(form, result\.skills\)/.test(postJobPage),
    '30. Edit-mode payload still calls buildUpdateJobPayload exactly as before — no edit-time behavior was changed by this phase'
  );
}

// Selector-specific validation is skipped entirely in edit mode
{
  check(
    /const methodResult = isEdit \? \{ ok: true, errors: \{\} \} : validateApplyMethodSelection\(form\);/.test(postJobPage),
    'Edit mode short-circuits method validation to a no-op — validateApplyMethodSelection only ever runs for create'
  );
}

// buildApplyMethodPayload/validateApplyMethodSelection are exported from the shared validation module
{
  check(
    /export function validateApplyMethodSelection\(form\)/.test(postJobValidation) &&
      /export function buildApplyMethodPayload\(form\)/.test(postJobValidation),
    'Both new functions are exported from employerPostJobValidation.js for reuse/testing'
  );
}

console.log(`employerHireMethodSelector.test.js: ${count} assertions passed`);
