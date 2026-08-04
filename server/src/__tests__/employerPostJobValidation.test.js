/**
 * Employer Post Job validation (E.1F-C).
 * Run: node src/__tests__/employerPostJobValidation.test.js
 */
import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modPath = pathToFileURL(
  path.resolve(__dirname, '../../../client/src/pages/Employer/employerPostJobValidation.js')
).href;

const {
  FIELD_IDS,
  validateEmployerPostJobForm,
  resolveApplyMode,
  isValidHttpUrl,
  isValidEmail,
  isDeadlineNotPast,
  normalizeSkills,
  buildCreateJobPayload,
  APPLY_METHOD_VALUES,
  DEFAULT_APPLY_METHOD,
  validateApplyMethodSelection,
  buildApplyMethodPayload,
  resolveApplyMethodFromJob,
  jobToForm,
  buildUpdateJobPayload,
} = await import(modPath);

const base = {
  jobTitle: 'React Developer',
  companyName: 'Strideto',
  location: 'Lahore',
  jobType: 'Private',
  type: 'full-time',
  salaryRange: '',
  skillsRequired: 'React, Node.js',
  jobDescription: 'Build and maintain React applications for our platform.',
  applicationDeadline: '',
  applyLink: '',
  applyEmail: '',
};

// 1–3: field IDs exist for every control (label association contract)
for (const key of Object.keys(base)) {
  assert.ok(FIELD_IDS[key], `FIELD_IDS missing for ${key}`);
  assert.ok(FIELD_IDS[key].startsWith('employer-post-'), `id prefix for ${key}`);
}

// Required fields fail when empty
{
  const r = validateEmployerPostJobForm({ ...base, jobTitle: '', companyName: '', jobDescription: '' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.jobTitle);
  assert.ok(r.errors.companyName);
  assert.ok(r.errors.jobDescription);
}

// Valid minimal internal form
{
  const r = validateEmployerPostJobForm(base);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.applyMode.applyType, 'internal');
  assert.deepStrictEqual(r.skills, ['React', 'Node.js']);
}

// Past deadline rejected
{
  const r = validateEmployerPostJobForm(
    { ...base, applicationDeadline: '2020-01-01' },
    { today: new Date(2026, 6, 27) }
  );
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.errors.applicationDeadline, 'validationDeadlinePast');
}

assert.strictEqual(isDeadlineNotPast('2026-07-27', new Date(2026, 6, 27)), true);
assert.strictEqual(isDeadlineNotPast('2026-07-26', new Date(2026, 6, 27)), false);

// Invalid URL / email
assert.strictEqual(isValidHttpUrl('ftp://x.com'), false);
assert.strictEqual(isValidHttpUrl('https://company.com/careers'), true);
assert.strictEqual(isValidEmail('not-an-email'), false);
assert.strictEqual(isValidEmail('careers@company.com'), true);

{
  const r = validateEmployerPostJobForm({ ...base, applyLink: 'notaurl' });
  assert.strictEqual(r.errors.applyLink, 'validationApplyUrlInvalid');
}
{
  const r = validateEmployerPostJobForm({ ...base, applyEmail: 'bad' });
  assert.strictEqual(r.errors.applyEmail, 'validationApplyEmailInvalid');
}

// Apply mode: none / url / email / both
assert.strictEqual(resolveApplyMode({}).applyType, 'internal');
assert.strictEqual(resolveApplyMode({ applyLink: 'https://a.com' }).applyType, 'external');
assert.strictEqual(resolveApplyMode({ applyEmail: 'a@b.com' }).applyType, 'external');
{
  const both = resolveApplyMode({ applyLink: 'https://a.com', applyEmail: 'a@b.com' });
  assert.strictEqual(both.applyType, 'external');
  assert.strictEqual(both.hasLink, true);
  assert.strictEqual(both.hasEmail, true);
}

// Payload keeps both URL and email (does not discard)
{
  const payload = buildCreateJobPayload(
    { ...base, applyLink: 'https://a.com/j', applyEmail: 'hr@a.com' },
    normalizeSkills('React')
  );
  assert.strictEqual(payload.applyLink, 'https://a.com/j');
  assert.strictEqual(payload.applyEmail, 'hr@a.com');
  assert.strictEqual(payload.jobTitle, 'React Developer');
}

// Short description rejected
{
  const r = validateEmployerPostJobForm({ ...base, jobDescription: 'Too short' });
  assert.strictEqual(r.errors.jobDescription, 'validationDescriptionTooShort');
}

// ---- PF-HIRE-B1: explicit create-time application-method selector ----

// 6/7/22. Three options exist, default is 'internal' (the confirmed safe default per §5)
{
  assert.deepStrictEqual(APPLY_METHOD_VALUES, ['internal', 'external_url', 'external_email']);
  assert.strictEqual(DEFAULT_APPLY_METHOD, 'internal');
}

// 6. Selected method is required — unknown/missing value rejected
{
  const r = validateApplyMethodSelection({});
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.errors.applyMethod, 'validationApplyMethodRequired');
}

// 9/10. Internal requires no destination and is valid on its own
{
  const r = validateApplyMethodSelection({ applyMethod: 'internal' });
  assert.strictEqual(r.ok, true);
}
{
  const payload = buildApplyMethodPayload({ applyMethod: 'internal', applyLink: 'stale', applyEmail: 'stale@x.com' });
  assert.deepStrictEqual(payload, { applyType: 'internal', applyLink: '', applyEmail: '' });
}

// 12/13. External URL requires a destination and rejects unsafe/malformed input client-side
{
  const missing = validateApplyMethodSelection({ applyMethod: 'external_url', applyLink: '' });
  assert.strictEqual(missing.errors.applyLink, 'validationApplyUrlRequired');
  const invalid = validateApplyMethodSelection({ applyMethod: 'external_url', applyLink: 'javascript:alert(1)' });
  assert.strictEqual(invalid.errors.applyLink, 'validationApplyUrlInvalid');
  const valid = validateApplyMethodSelection({ applyMethod: 'external_url', applyLink: 'https://company.com/careers' });
  assert.strictEqual(valid.ok, true);
}

// 14/18. External URL payload sends applyType:'external' and never a stale hidden email
{
  const payload = buildApplyMethodPayload({
    applyMethod: 'external_url',
    applyLink: '  https://company.com/careers  ',
    applyEmail: 'stale@x.com',
  });
  assert.deepStrictEqual(payload, { applyType: 'external', applyLink: 'https://company.com/careers', applyEmail: '' });
}

// 16. Email requires a valid address
{
  const missing = validateApplyMethodSelection({ applyMethod: 'external_email', applyEmail: '' });
  assert.strictEqual(missing.errors.applyEmail, 'validationApplyEmailRequired');
  const invalid = validateApplyMethodSelection({ applyMethod: 'external_email', applyEmail: 'not-an-email' });
  assert.strictEqual(invalid.errors.applyEmail, 'validationApplyEmailInvalid');
  const valid = validateApplyMethodSelection({ applyMethod: 'external_email', applyEmail: 'careers@company.com' });
  assert.strictEqual(valid.ok, true);
}

// 17/18. Email payload sends applyType:'external' and never a stale hidden URL
{
  const payload = buildApplyMethodPayload({
    applyMethod: 'external_email',
    applyLink: 'stale',
    applyEmail: '  careers@company.com  ',
  });
  assert.deepStrictEqual(payload, { applyType: 'external', applyLink: '', applyEmail: 'careers@company.com' });
}

// ---- PF-HIRE-B2: edit hydration and unified update payload ----

// 1. Internal Job hydrates as Apply through Strideto
assert.strictEqual(resolveApplyMethodFromJob({ applyType: 'internal' }), 'internal');
{
  const form = jobToForm({ applyType: 'internal', title: 'T', company: 'C' });
  assert.strictEqual(form.applyMethod, 'internal');
  assert.strictEqual(form.applyLink, '');
  assert.strictEqual(form.applyEmail, '');
}

// 2. External URL Job hydrates URL method and value
assert.strictEqual(resolveApplyMethodFromJob({ applyType: 'external', applicationLink: 'https://a.com/j' }), 'external_url');
{
  const form = jobToForm({ applyType: 'external', applicationLink: 'https://a.com/j', title: 'T', company: 'C' });
  assert.strictEqual(form.applyMethod, 'external_url');
  assert.strictEqual(form.applyLink, 'https://a.com/j');
}

// 3. External email Job hydrates email method and value
assert.strictEqual(resolveApplyMethodFromJob({ applyType: 'external', applyEmail: 'hr@a.com' }), 'external_email');
{
  const form = jobToForm({ applyType: 'external', applyEmail: 'hr@a.com', title: 'T', company: 'C' });
  assert.strictEqual(form.applyMethod, 'external_email');
  assert.strictEqual(form.applyEmail, 'hr@a.com');
}

// 4. Legacy/contradictory fallback: external Job with neither destination hydrates to the safe external_url state (never silently internal)
assert.strictEqual(resolveApplyMethodFromJob({ applyType: 'external' }), 'external_url');

// 5. Create-mode default remains internal for an empty/unloaded Job
assert.strictEqual(resolveApplyMethodFromJob({}), DEFAULT_APPLY_METHOD);

// 6/7. External URL -> internal and external email -> internal both send explicit clears via buildUpdateJobPayload
{
  const payload = buildUpdateJobPayload(
    { ...base, applyMethod: 'internal', applyLink: 'https://old.com', applyEmail: '' },
    []
  );
  assert.deepStrictEqual(
    { applyType: payload.applyType, applyLink: payload.applyLink, applyEmail: payload.applyEmail },
    { applyType: 'internal', applyLink: '', applyEmail: '' }
  );
}
{
  const payload = buildUpdateJobPayload(
    { ...base, applyMethod: 'internal', applyLink: '', applyEmail: 'old@x.com' },
    []
  );
  assert.deepStrictEqual(
    { applyType: payload.applyType, applyLink: payload.applyLink, applyEmail: payload.applyEmail },
    { applyType: 'internal', applyLink: '', applyEmail: '' }
  );
}

// 8/9. URL -> email clears the URL; email -> URL clears the email
{
  const payload = buildUpdateJobPayload(
    { ...base, applyMethod: 'external_email', applyLink: 'https://old.com', applyEmail: 'new@x.com' },
    []
  );
  assert.deepStrictEqual(
    { applyType: payload.applyType, applyLink: payload.applyLink, applyEmail: payload.applyEmail },
    { applyType: 'external', applyLink: '', applyEmail: 'new@x.com' }
  );
}
{
  const payload = buildUpdateJobPayload(
    { ...base, applyMethod: 'external_url', applyLink: 'https://new.com', applyEmail: 'old@x.com' },
    []
  );
  assert.deepStrictEqual(
    { applyType: payload.applyType, applyLink: payload.applyLink, applyEmail: payload.applyEmail },
    { applyType: 'external', applyLink: 'https://new.com', applyEmail: '' }
  );
}

// 10/11. Internal -> URL and internal -> email send a valid external combination
{
  const payload = buildUpdateJobPayload({ ...base, applyMethod: 'external_url', applyLink: 'https://x.com/j', applyEmail: '' }, []);
  assert.deepStrictEqual(
    { applyType: payload.applyType, applyLink: payload.applyLink, applyEmail: payload.applyEmail },
    { applyType: 'external', applyLink: 'https://x.com/j', applyEmail: '' }
  );
}
{
  const payload = buildUpdateJobPayload({ ...base, applyMethod: 'external_email', applyLink: '', applyEmail: 'hr@x.com' }, []);
  assert.deepStrictEqual(
    { applyType: payload.applyType, applyLink: payload.applyLink, applyEmail: payload.applyEmail },
    { applyType: 'external', applyLink: '', applyEmail: 'hr@x.com' }
  );
}

// 12/13. Same-method edit preserves the active destination and never sends the inactive one
{
  const payload = buildUpdateJobPayload({ ...base, applyMethod: 'external_url', applyLink: 'https://same.com', applyEmail: '' }, []);
  assert.strictEqual(payload.applyLink, 'https://same.com');
  assert.strictEqual(payload.applyEmail, '');
}

console.log('employerPostJobValidation.test.js: all assertions passed');
