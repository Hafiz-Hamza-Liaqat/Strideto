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

console.log('employerPostJobValidation.test.js: all assertions passed');
