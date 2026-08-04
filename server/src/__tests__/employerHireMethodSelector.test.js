/**
 * PF-HIRE-B1 — explicit Employer application-method selector on Job
 * creation, and employerController.createJob's explicit-applyType contract.
 * PF-HIRE-B2 — the same selector connected to editing, plus
 * employerController.updateJob's explicit-applyType/switching/existing-
 * Application-safety contract.
 *
 * Source-contract style for the DB-backed controller (no test-Mongo harness
 * exists for it, matching this repo's established convention); the client
 * form-logic pieces (validateApplyMethodSelection/buildApplyMethodPayload/
 * resolveApplyMethodFromJob) are covered executably in
 * employerPostJobValidation.test.js.
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
  employerController.indexOf('export const updateJob')
);
const updateFn = employerController.slice(
  employerController.indexOf('export const updateJob'),
  employerController.indexOf('export const closeJob')
);

// ==================================================
// PF-HIRE-B1 (unchanged) — createJob's explicit applyType contract
// ==================================================

check(
  /if \(body\.applyType === 'internal' && \(linkResult\.value \|\| emailResult\.value\)\) \{/.test(createFn),
  "createJob: explicit applyType:'internal' combined with a real destination is still rejected as contradictory"
);
check(
  /if \(body\.applyType === 'external' && !linkResult\.value && !emailResult\.value\) \{/.test(createFn),
  'createJob: external is still accepted whenever at least one destination is present, rejected only when both are empty'
);
check(
  /if \(body\.applyType !== 'internal' && body\.applyType !== 'external'\) \{\s*return res\.status\(400\)\.json\(\{ error: 'applyType must be internal or external', field: 'applyType' \}\);/.test(
    createFn
  ),
  'createJob: unknown applyType values are still rejected'
);
check(!/req\.body\.employerId|req\.query\.employerId/.test(createFn), 'createJob: still never reads employerId from the request body/query');

// ==================================================
// PF-HIRE-B2 — updateJob's explicit applyType/switching contract
// ==================================================

// 15/18. Explicit internal is accepted; unknown applyType rejected — same check reused, not duplicated
{
  check(
    /if \(body\.applyType !== 'internal' && body\.applyType !== 'external'\) \{\s*return res\.status\(400\)\.json\(\{ error: 'applyType must be internal or external', field: 'applyType' \}\);/.test(
      updateFn
    ),
    '18. updateJob rejects an unknown applyType value with the same error shape as createJob'
  );
}

// 19. Internal plus destination is rejected
{
  check(
    /if \(body\.applyType === 'internal' && \(targetLink \|\| targetEmail\)\) \{/.test(updateFn),
    '19. updateJob rejects applyType:internal when a real destination (new or pre-existing) is present'
  );
}

// 20/24. External without destination is rejected
{
  check(
    /if \(!targetLink && !targetEmail\) \{\s*return res\.status\(400\)\.json\(\{ error: 'External applications require a URL or email destination', field: 'applyType' \}\);/.test(
      updateFn
    ),
    '20/24. updateJob rejects applyType:external with no destination at all'
  );
}

// 21. External with both URL and email together is rejected (stricter than createJob, per this phase's explicit contract)
{
  check(
    /if \(targetLink && targetEmail\) \{/.test(updateFn),
    '21. updateJob rejects applyType:external when both a URL and an email destination are present simultaneously'
  );
}

// 16/17/24. targetLink/targetEmail correctly fall back to the existing stored value when the corresponding field is omitted
{
  check(
    /const targetLink = linkSupplied \? validatedLink : job\.applicationLink;/.test(updateFn) &&
      /const targetEmail = body\.applyEmail !== undefined \? validatedEmail : job\.applyEmail;/.test(updateFn),
    '16/17/26. Omitted destination fields resolve to the existing stored value, not to empty — preserving unrelated legacy callers'
  );
}

// 24/25. Explicit empty-string clears reach job.applicationLink/applyEmail via the existing validated-value assignment in the field loop
{
  check(
    /else if \(key === 'applyLink' \|\| key === 'applicationLink'\) job\.applicationLink = validatedLink;/.test(updateFn) &&
      /else if \(key === 'applyEmail'\) job\.applyEmail = validatedEmail;/.test(updateFn),
    '24/25. Supplied applyLink/applicationLink/applyEmail keys are written from the already-validated (possibly null/cleared) value, not the raw body'
  );
}

// Internal target forces both destinations null even if not separately supplied (defense in depth)
{
  check(
    /if \(targetApplyType === 'internal'\) \{\s*\/\/ Belt-and-suspenders[\s\S]{0,200}job\.applicationLink = null;\s*job\.applyEmail = null;/.test(
      updateFn
    ),
    '19/24/25. When the resolved target is internal, applicationLink/applyEmail are force-nulled as a defense-in-depth guarantee'
  );
}

// 22/23. PF-HIRE-B4 validators still run first, unmodified
{
  const linkValidateIdx = updateFn.indexOf('validateApplicationLink(incoming)');
  const applyTypeIdx = updateFn.indexOf('const applyTypeSupplied');
  check(linkValidateIdx !== -1 && applyTypeIdx !== -1 && linkValidateIdx < applyTypeIdx, '22/23. PF-HIRE-B4 destination-scheme/email validation still runs before any applyType logic — unsafe URLs and invalid emails remain rejected');
}

// 26. Omitted applyType + omitted destinations: legacy inference path preserved verbatim
{
  check(
    /\} else if \(linkSupplied \|\| body\.applyEmail !== undefined\) \{\s*\/\/ Legacy inference path[\s\S]{0,200}targetApplyType = targetLink \|\| targetEmail \? 'external' : 'internal';/.test(
      updateFn
    ),
    '26. A caller that omits applyType but supplies a raw destination field still gets the original inference formula — unrelated legacy callers unaffected'
  );
}

// 27. No save occurs on validation failure: every return happens before job.save()
{
  const firstReturnIdx = updateFn.indexOf("return res.status(400).json({ error: linkResult.message");
  const conflictReturnIdx = updateFn.indexOf('This job already has applications');
  const saveIdx = updateFn.indexOf('await job.save();');
  check(
    firstReturnIdx !== -1 && conflictReturnIdx !== -1 && saveIdx !== -1 && firstReturnIdx < saveIdx && conflictReturnIdx < saveIdx,
    '27. Every validation/conflict return (destination, applyType, existing-Application) occurs before job.save()'
  );
}

// 28. Cross-Employer update remains blocked (unchanged ownership scoping)
{
  check(
    /Job\.findOne\(\{ _id: req\.params\.id, employerId \}\)/.test(updateFn),
    '28. updateJob still scopes the fetched Job to the authenticated employerId — cross-Employer updates remain a 404, unchanged'
  );
}

// ==================================================
// PF-HIRE-B2 — existing-Application safety guard
// ==================================================

// 29/30/32/33. Guard only fires internal->external, uses resolveJobApplyType, queries Application.countDocuments, mutates nothing
{
  check(
    /if \(resolveJobApplyType\(job\) === 'internal' && targetApplyType === 'external'\) \{/.test(updateFn),
    "29/30/32. The safety guard is scoped to internal->external only (external->internal, and same-method edits, never trigger it) — reuses the canonical resolveJobApplyType helper rather than trusting the raw stored field"
  );
  check(
    /const existingApplications = await Application\.countDocuments\(\{ jobId: job\._id \}\);/.test(updateFn),
    '29/30. Uses the smallest existing query shape (Application.countDocuments by jobId), matching the pattern already used elsewhere in this file/service'
  );
  check(
    /if \(existingApplications > 0\) \{\s*return res\.status\(409\)\.json\(\{\s*error: 'This job already has applications and cannot be changed to external hiring\.',\s*field: 'applyType',\s*\}\);/.test(
      updateFn
    ),
    '31. Conflict response uses 409, a stable field identifier, and the suggested safe message — no candidate detail of any kind'
  );
  check(
    !/Application\.(deleteOne|deleteMany|updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate)/.test(updateFn),
    '33. No Application record is ever mutated by updateJob — the guard only reads a count'
  );
}

// The guard runs before the field-mutation loop and before job.save() (no partial persistence)
{
  const guardIdx = updateFn.indexOf('resolveJobApplyType(job) === ');
  const forEachIdx = updateFn.indexOf('allowed.forEach');
  const saveIdx = updateFn.indexOf('await job.save();');
  check(guardIdx !== -1 && forEachIdx !== -1 && saveIdx !== -1 && guardIdx < forEachIdx && forEachIdx < saveIdx, 'The existing-Application guard runs before any field is mutated and before job.save()');
}

// resolveJobApplyType is imported, not reimplemented (no duplicated application-method logic)
{
  check(
    /import \{ enrichEmployerJobsWithApplicationCounts, resolveJobApplyType \} from '\.\.\/services\/employerApplicationCounts\.js';/.test(
      employerController
    ),
    'resolveJobApplyType is imported from its single canonical source, not reimplemented in this controller'
  );
}

// Approval/re-review behavior is untouched: the existing unconditional reset still runs, now after all new checks
{
  check(
    /if \(job\.status === 'active' && job\.approvalStatus === 'approved'\) \{\s*job\.approvalStatus = 'pending';\s*\}/.test(updateFn),
    "Approval behavior preserved exactly: any successful edit to an active+approved Job still resets approvalStatus to 'pending', unconditionally — not specially triggered or skipped for applyType changes"
  );
}

// moderationController.js was not touched by this phase
{
  const moderationController = readFileSync(path.join(serverSrc, 'controllers/admin/moderationController.js'), 'utf8');
  check(!/applyType|applicationLink|applyEmail/.test(moderationController), 'moderationController.js still contains no applyType/applicationLink/applyEmail reference — Admin moderation is unaffected by this phase');
}

// ==================================================
// Client: unified selector now drives both create and edit
// ==================================================

// 1/2/6/7. Selector renders all three options, is required, defaults to internal, and now renders unconditionally (both modes)
{
  check(
    /APPLY_METHOD_VALUES\.map\(\(method, idx\) => \(/.test(postJobPage),
    'The fieldset renders one radio per APPLY_METHOD_VALUES entry (all three options)'
  );
  check(/applyMethod: DEFAULT_APPLY_METHOD,/.test(postJobPage), "defaultForm still initializes applyMethod to DEFAULT_APPLY_METHOD ('internal') for create's initial state");
  check(
    !/\{isEdit \? \(/.test(postJobPage) && postJobPage.includes('data-testid="apply-method-selector"'),
    '6. The isEdit ternary around the fieldset is gone — the same selector now renders for both create and edit'
  );
}

// 1/2/3. Edit hydration: jobToForm derives applyMethod via the shared resolver, not a duplicated rule
{
  check(
    /export function resolveApplyMethodFromJob\(job = \{\}\) \{/.test(postJobValidation),
    'A single resolveApplyMethodFromJob helper derives the UI method from a stored Job'
  );
  check(
    /if \(job\.applyType === 'internal'\) return 'internal';/.test(postJobValidation),
    "1. Stored/resolved internal Jobs hydrate to the 'internal' UI method"
  );
  check(
    /if \(job\.applicationLink\) return 'external_url';/.test(postJobValidation),
    "2. External Jobs with a stored applicationLink hydrate to 'external_url'"
  );
  check(
    /if \(job\.applyEmail\) return 'external_email';/.test(postJobValidation),
    "3. External Jobs with a stored applyEmail (no link) hydrate to 'external_email'"
  );
  check(
    /applyMethod: resolveApplyMethodFromJob\(job\),/.test(postJobValidation),
    'jobToForm wires applyMethod through resolveApplyMethodFromJob, so edit hydration and the selector share one source of truth'
  );
}

// 4. Legacy/contradictory fallback documented and safe (no unsafe value silently exposed, no invented rule beyond an explicit safe default)
{
  check(
    /if \(job\.applyType === 'external'\) \{[\s\S]{0,300}return 'external_url';/.test(postJobValidation),
    "4. A stored external Job with neither destination (a pre-existing dead-end state) hydrates to 'external_url' — the smallest safe state that immediately re-prompts for a real destination, rather than silently reclassifying the Job"
  );
}

// 9/10/13/14/17/18. Both create and edit submissions go through the same buildUpdateJobPayload, which layers buildApplyMethodPayload
{
  check(
    /export function buildUpdateJobPayload\(form, skills\) \{\s*return \{ \.\.\.buildCreateJobPayload\(form, skills\), \.\.\.buildApplyMethodPayload\(form\) \};/.test(
      postJobValidation
    ),
    '9/10/14/17/18. buildUpdateJobPayload now layers buildApplyMethodPayload over the base field payload, exactly like create — guaranteeing explicit empty-string clears (never omitted keys) on every edit submission too'
  );
  check(
    /const payload = buildUpdateJobPayload\(form, result\.skills\);/.test(postJobPage) && !/buildCreateJobPayload\(form, result\.skills\)/.test(postJobPage),
    'The component now builds one payload via buildUpdateJobPayload for both create and edit — no separate, divergent create-only construction remains'
  );
}

// 14. Method validation now runs unconditionally (both modes), not skipped for edit
{
  check(
    /const methodResult = validateApplyMethodSelection\(form\);/.test(postJobPage) && !/isEdit \? \{ ok: true, errors: \{\} \}/.test(postJobPage),
    '14. validateApplyMethodSelection now runs for edit too — active-field validation updates immediately when the method changes, in both modes'
  );
}

// 5. Create-mode default is unaffected by this phase (still 'internal', still required)
{
  check(/applyMethod: DEFAULT_APPLY_METHOD,/.test(postJobPage), "5. Create-mode default remains DEFAULT_APPLY_METHOD ('internal') — unchanged by edit hydration work");
}

console.log(`employerHireMethodSelector.test.js: ${count} assertions passed`);
