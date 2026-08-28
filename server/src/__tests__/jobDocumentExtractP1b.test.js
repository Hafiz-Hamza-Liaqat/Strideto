/**
 * STRIDETO JOB-AUTHORING-P1B-2 — Strict job document extraction + dependency-aware apply.
 * Run: node src/__tests__/jobDocumentExtractP1b.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  extractJobFieldsFromText,
  normalizeDocumentText,
  JOB_DOCUMENT_PROTECTED_FIELDS,
} from '../../../shared/jobs/jobDocumentExtraction.js';
import { validateJobDescriptionBuffer } from '../utils/jobDescriptionFileValidation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8');

const merge = await import(
  pathToFileURL(path.join(repoRoot, 'client/src/components/jobs/jobDocumentSuggestionMerge.js')).href
);

const {
  applyJobDocumentSuggestions,
  buildSuggestionConflicts,
  resolveFieldState,
  FIELD_STATE,
  EMPLOYER_SUGGESTION_FIELD_MAP,
  EMPLOYER_FORM_DEFAULTS,
} = merge;

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const STRUCTURED_FIXTURE = `JOB TITLE:
Senior Frontend Engineer

NUMBER OF OPENINGS:
3

COMPANY / ORGANIZATION:
Nova Digital Solutions

LOCATION:
Gulberg III, Lahore, Punjab, Pakistan

COUNTRY:
Pakistan

COUNTRY CODE:
PK

STATE / PROVINCE / REGION:
Punjab

CITY:
Lahore

JOB FAMILY:
Software Engineering

SPECIALIZATION:
Frontend Development

JOB CLASSIFICATION:
Private

EMPLOYMENT TYPE:
Full-time

WORK MODE:
Hybrid

SALARY RANGE:
180,000 - 250,000 per month

SALARY CURRENCY:
PKR

REQUIRED SKILLS:
React
TypeScript
JavaScript
HTML5
CSS3
Tailwind CSS
REST APIs
Git

EXPERIENCE REQUIREMENT:
3-5 years of professional frontend development experience.

EDUCATION REQUIREMENT:
Bachelor's degree in Computer Science.

REQUIREMENTS:
Requirement A
Requirement B

RESPONSIBILITIES:
Responsibility A
Responsibility B

JOB DESCRIPTION:
We build accessible web products for millions of users.

APPLICATION DEADLINE:
September 30, 2026

APPLICATION METHOD:
External application website

APPLICATION LINK:
https://careers.example.com/job
`;

const SHUFFLED_FIXTURE = `CloudScale Technologies is expanding its engineering organization across Pakistan.

APPLICATION METHOD:
External application website

APPLICATION LINK:
https://careers.example.com/job

SALARY RANGE:
180,000 - 250,000 per month

SALARY CURRENCY:
PKR

RESPONSIBILITIES:
Responsibility A
Responsibility B

LOCATION:
Gulberg III, Lahore, Punjab, Pakistan

COUNTRY:
Pakistan

COUNTRY CODE:
PK

STATE / PROVINCE / REGION:
Punjab

CITY:
Lahore

EDUCATION REQUIREMENT:
Bachelor's degree in Computer Science.

POSITION TITLE:
Senior Frontend Engineer

NUMBER OF OPENINGS:
3

REQUIRED SKILLS:
React
TypeScript
JavaScript
HTML5
CSS3
Tailwind CSS
REST APIs
Git

EMPLOYMENT TYPE:
Full-time

EXPERIENCE REQUIREMENT:
3-5 years of professional frontend development experience.

SPECIALIZATION:
Frontend Development

REQUIREMENTS:
Requirement A
Requirement B

COMPANY / ORGANIZATION:
Nova Digital Solutions

JOB DESCRIPTION:
We build accessible web products for millions of users.

JOB FAMILY:
Software Engineering

JOB CLASSIFICATION:
Private

WORK MODE:
Hybrid

APPLICATION DEADLINE:
September 30, 2026
`;

function extractStructured(mode = 'employer') {
  return extractJobFieldsFromText(STRUCTURED_FIXTURE, { mode }).suggestions;
}

function extractShuffled(mode = 'employer') {
  return extractJobFieldsFromText(SHUFFLED_FIXTURE, { mode }).suggestions;
}

// STRICT-SEQ-01 structured fields
{
  const s = extractStructured();
  check(s.title?.value === 'Senior Frontend Engineer', 'STRICT-SEQ-01: title');
  check(s.openingsCount?.value === 3, 'STRICT-SEQ-01: openings');
  check(s.company?.value === 'Nova Digital Solutions', 'STRICT-SEQ-01: company');
  check(s.location?.value?.includes('Lahore'), 'STRICT-SEQ-01: location');
  check(s.countryCode?.value === 'PK', 'STRICT-SEQ-01: countryCode');
  check(s.region?.value === 'Punjab', 'STRICT-SEQ-01: region');
  check(s.city?.value === 'Lahore', 'STRICT-SEQ-01: city');
  check(s.jobFamily?.value === 'Software & IT', 'STRICT-SEQ-01: jobFamily');
  check(s.specialization?.value === 'Frontend', 'STRICT-SEQ-01: specialization');
  check(s.jobType?.value === 'Private', 'STRICT-SEQ-01: classification');
  check(s.type?.value === 'full-time', 'STRICT-SEQ-01: employment');
  check(s.workMode?.value === 'hybrid', 'STRICT-SEQ-01: workMode');
  check(s.salaryRange?.value === '180,000 - 250,000 per month', 'STRICT-SEQ-01: salaryRange');
  check(s.salaryCurrency?.value === 'PKR', 'STRICT-SEQ-01: salaryCurrency');
  check(Array.isArray(s.skillsRequired?.value) && s.skillsRequired.value.length === 8, 'STRICT-SEQ-01: skills count');
  check(s.skillsRequired?.value?.[0] === 'React' && s.skillsRequired?.value?.[1] === 'TypeScript', 'STRICT-SEQ-01: skills order');
  check(s.experience?.value?.includes('3-5 years'), 'STRICT-SEQ-01: experience');
  check(s.educationRequirement?.value?.includes('Bachelor'), 'STRICT-SEQ-01: education');
  check(Array.isArray(s.requirements?.value) && s.requirements.value.length === 2, 'STRICT-SEQ-01: requirements');
  check(Array.isArray(s.responsibilities?.value) && s.responsibilities.value.length === 2, 'STRICT-SEQ-01: responsibilities');
  check(s.description?.value?.includes('accessible web products'), 'STRICT-SEQ-01: description');
  check(s.deadline?.value === '2026-09-30', 'STRICT-SEQ-01: deadline');
  check(s.applicationMethod?.value === 'external_url', 'STRICT-SEQ-01: applicationMethod');
  check(s.applicationLink?.value === 'https://careers.example.com/job', 'STRICT-SEQ-01: applicationLink');
}

// STRICT-SEQ-02 label never becomes value
{
  const leakCases = [
    'JOB TITLE:\nSenior Frontend Engineer',
    'SALARY RANGE:\n180,000 - 250,000 per month',
    'POSITION TITLE:\nBackend Software Engineer',
  ];
  for (const text of leakCases) {
    const { suggestions } = extractJobFieldsFromText(text, { mode: 'employer' });
    for (const sug of Object.values(suggestions)) {
      const val = Array.isArray(sug.value) ? sug.value.join(' ') : String(sug.value || '');
      check(!/^job title\s*:?$/i.test(val.trim()), 'STRICT-SEQ-02: no JOB TITLE label leakage');
      check(!/^salary range\s*:?$/i.test(val.trim()), 'STRICT-SEQ-02: no SALARY RANGE label leakage');
      check(!/^range\s*:?$/i.test(val.trim()), 'STRICT-SEQ-02: no RANGE label leakage');
      check(!/^position title\s*:?$/i.test(val.trim()), 'STRICT-SEQ-02: no POSITION TITLE label leakage');
    }
  }
}

// STRICT-SEQ-03 salary exact
{
  const s = extractStructured();
  check(s.salaryRange?.value === '180,000 - 250,000 per month', 'STRICT-SEQ-03: salary exact value');
  check(s.salaryRange?.value !== 'RANGE:', 'STRICT-SEQ-03: salary not RANGE:');
}

// STRICT-SEQ-04 skills separators
{
  const s = extractStructured();
  const joined = s.skillsRequired?.value?.join(', ') || '';
  check(joined === 'React, TypeScript, JavaScript, HTML5, CSS3, Tailwind CSS, REST APIs, Git', 'STRICT-SEQ-04: skills joined');
  check(!joined.includes('ReactTypeScript'), 'STRICT-SEQ-04: skills not collapsed');
}

// STRICT-SEQ-05 experience
{
  check(extractStructured().experience?.value?.includes('frontend development'), 'STRICT-SEQ-05: experience populated');
}

// STRICT-SEQ-06 education
{
  check(extractStructured().educationRequirement?.value?.includes('Computer Science'), 'STRICT-SEQ-06: education populated');
}

// STRICT-SEQ-07 deadline normalized
{
  check(extractStructured().deadline?.value === '2026-09-30', 'STRICT-SEQ-07: deadline normalized');
}

// STRICT-SEQ-08 location cascade values
{
  const s = extractStructured();
  check(s.countryCode?.value === 'PK' && s.region?.value === 'Punjab' && s.city?.value === 'Lahore', 'STRICT-SEQ-08: country-region-city');
}

// STRICT-SEQ-09 taxonomy
{
  const s = extractStructured();
  check(s.jobFamily?.value === 'Software & IT' && s.specialization?.value === 'Frontend', 'STRICT-SEQ-09: family-specialization');
}

// STRICT-SEQ-10 work mode enum
{
  check(extractStructured().workMode?.value === 'hybrid', 'STRICT-SEQ-10: work mode canonical');
}

// STRICT-SEQ-11 external URL method
{
  const s = extractStructured();
  check(s.applicationMethod?.value === 'external_url', 'STRICT-SEQ-11: external_url method');
}

// STRICT-SEQ-12 email method
{
  const emailDoc = `APPLICATION METHOD:
Apply by email

APPLICATION EMAIL:
jobs@example.com`;
  const s = extractJobFieldsFromText(emailDoc, { mode: 'employer' }).suggestions;
  check(s.applicationMethod?.value === 'external_email', 'STRICT-SEQ-12: external_email method');
  check(s.applyEmail?.value === 'jobs@example.com', 'STRICT-SEQ-12: apply email');
}

// STRICT-RANDOM-01 shuffled canonical structure
{
  const s = extractShuffled();
  check(s.title?.value === 'Senior Frontend Engineer', 'STRICT-RANDOM-01: title');
  check(s.openingsCount?.value === 3, 'STRICT-RANDOM-01: openings');
  check(s.company?.value === 'Nova Digital Solutions', 'STRICT-RANDOM-01: company');
  check(s.countryCode?.value === 'PK', 'STRICT-RANDOM-01: country');
  check(s.jobFamily?.value === 'Software & IT', 'STRICT-RANDOM-01: family');
  check(s.workMode?.value === 'hybrid', 'STRICT-RANDOM-01: work mode');
  check(s.applicationMethod?.value === 'external_url', 'STRICT-RANDOM-01: application method');
}

// STRICT-RANDOM-02 explicit later title beats intro heuristic
{
  const s = extractShuffled();
  check(s.title?.value === 'Senior Frontend Engineer', 'STRICT-RANDOM-02: explicit title wins');
  check(s.title?.value !== 'CloudScale Technologies is expanding its engineering organization across Pakistan.', 'STRICT-RANDOM-02: intro not title');
  check(s.title?.sourceType === 'explicit_label', 'STRICT-RANDOM-02: title source explicit');
}

// STRICT-RANDOM-03 section order irrelevant
{
  const a = extractStructured();
  const b = extractShuffled();
  check(a.title?.value === b.title?.value, 'STRICT-RANDOM-03: title stable');
  check(a.salaryRange?.value === b.salaryRange?.value, 'STRICT-RANDOM-03: salary stable');
  check(a.deadline?.value === b.deadline?.value, 'STRICT-RANDOM-03: deadline stable');
}

// Line preservation
{
  const skillsBlock = `REQUIRED SKILLS:
React
TypeScript
JavaScript`;
  const { lines } = normalizeDocumentText(skillsBlock);
  check(lines.includes('React') && lines.includes('TypeScript'), 'LINE-PRESERVE: skills stay on separate lines');
  const { suggestions } = extractJobFieldsFromText(skillsBlock, { mode: 'employer' });
  check(suggestions.skillsRequired?.value?.length === 3, 'LINE-PRESERVE: three skills extracted');
}

// APPLY tests
{
  const form = { ...EMPLOYER_FORM_DEFAULTS };
  const suggestions = extractStructured();
  const { form: next, applied } = applyJobDocumentSuggestions(form, suggestions, {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
  });
  check(applied.includes('title'), 'APPLY-01: title applied');
  check(next.jobTitle === 'Senior Frontend Engineer', 'APPLY-01: title populated');
  check(next.countryCode === 'PK', 'APPLY-01: country populated');
}

{
  const form = { ...EMPLOYER_FORM_DEFAULTS, openingsCount: '1' };
  const { form: next } = applyJobDocumentSuggestions(form, extractStructured(), {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
  });
  check(next.openingsCount === '3', 'APPLY-02: openings default replaced');
}

{
  const form = { ...EMPLOYER_FORM_DEFAULTS, workMode: '' };
  const { form: next } = applyJobDocumentSuggestions(form, extractStructured(), {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
  });
  check(next.workMode === 'hybrid', 'APPLY-03: workMode default replaced');
}

{
  const form = { ...EMPLOYER_FORM_DEFAULTS, applyMethod: 'internal' };
  const { form: next } = applyJobDocumentSuggestions(form, extractStructured(), {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
  });
  check(next.applyMethod === 'external_url', 'APPLY-04: application method replaced');
}

{
  const form = { ...EMPLOYER_FORM_DEFAULTS, jobTitle: 'My Custom Title' };
  const conflicts = buildSuggestionConflicts(form, extractStructured(), {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(['jobTitle']),
  });
  check(conflicts.some((c) => c.field === 'title'), 'APPLY-05: edited title conflict');
  check(
    resolveFieldState('jobTitle', form.jobTitle, {
      touchedFields: new Set(['jobTitle']),
      formDefaults: EMPLOYER_FORM_DEFAULTS,
      field: 'title',
    }) === FIELD_STATE.USER_EDITED,
    'APPLY-05: user edited state'
  );
}

{
  const { applied, form: next } = applyJobDocumentSuggestions({ ...EMPLOYER_FORM_DEFAULTS }, extractStructured(), {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
  });
  check(applied.indexOf('countryCode') < applied.indexOf('region'), 'APPLY-06: country before region');
  check(applied.indexOf('region') < applied.indexOf('city'), 'APPLY-06: region before city');
  check(next.countryCode === 'PK' && next.region === 'Punjab' && next.city === 'Lahore', 'APPLY-06: location values');
}

{
  const { applied, form: next } = applyJobDocumentSuggestions({ ...EMPLOYER_FORM_DEFAULTS }, extractStructured(), {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
  });
  check(applied.indexOf('jobFamily') < applied.indexOf('specialization'), 'APPLY-07: taxonomy order');
  check(next.jobFamily === 'Software & IT' && next.specialization === 'Frontend', 'APPLY-07: taxonomy values');
}

{
  const { form: next } = applyJobDocumentSuggestions({ ...EMPLOYER_FORM_DEFAULTS }, extractStructured(), {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
  });
  check(next.skillsRequired.startsWith('React, TypeScript'), 'APPLY-08: skills comma-separated');
}

{
  const { form: next } = applyJobDocumentSuggestions({ ...EMPLOYER_FORM_DEFAULTS }, extractStructured(), {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
  });
  check(next.applyMethod === 'external_url' && next.applyLink === 'https://careers.example.com/job', 'APPLY-09: external url apply');
}

{
  const emailDoc = `APPLICATION METHOD:
Apply by email

APPLICATION EMAIL:
jobs@example.com`;
  const suggestions = extractJobFieldsFromText(emailDoc, { mode: 'employer' }).suggestions;
  const { form: next } = applyJobDocumentSuggestions({ ...EMPLOYER_FORM_DEFAULTS }, suggestions, {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
  });
  check(next.applyMethod === 'external_email' && next.applyEmail === 'jobs@example.com', 'APPLY-10: external email apply');
}

{
  const panelSrc = read('client/src/components/jobs/JobDescriptionUploadPanel.jsx');
  check(panelSrc.includes('setSuggestions(sug)'), 'APPLY-11: upload stores suggestions only');
  check(!panelSrc.includes('handleFile(e.target.files?.[0]); onApply'), 'APPLY-11: no auto apply on upload');
}

for (const field of JOB_DOCUMENT_PROTECTED_FIELDS) {
  const poisoned = `${field}: malicious-value\nCompany: Safe Co`;
  const { suggestions } = extractJobFieldsFromText(poisoned, { mode: 'admin' });
  check(!suggestions[field], `SEC-01: protected field ${field} not extracted`);
}

const extractCtrl = read('server/src/controllers/jobDocumentExtractController.js');
check(!extractCtrl.includes('Job.create'), 'SEC-02: no Job.create');
check(!extractCtrl.includes('job.save'), 'SEC-03: no job.save');
check(!extractCtrl.includes('checkout'), 'SEC-04: no checkout/billing');

{
  const adminText = `Source Website: Indeed
Source URL: https://indeed.com/job/123
External ID: INDEED-999
Company: Test Co`;
  const employer = extractJobFieldsFromText(adminText, { mode: 'employer' }).suggestions;
  const admin = extractJobFieldsFromText(adminText, { mode: 'admin' }).suggestions;
  check(!employer.sourceWebsite, 'ADMIN: employer blocks sourceWebsite');
  check(admin.sourceWebsite?.value === 'Indeed', 'ADMIN: admin sourceWebsite');
}

{
  const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0x41);
  let threw = false;
  try {
    await validateJobDescriptionBuffer(big, 'text/plain', 'big.txt');
  } catch (e) {
    threw = e.code === 'file_too_large';
  }
  check(threw, 'JD-VAL-SIZE: 5MB+ rejected');
}

const bounded = read('server/src/services/boundedDocumentTextExtract.js');
check(bounded.includes('worker_threads'), 'JD-BOUND: worker_threads preserved');
check(bounded.includes('worker.terminate'), 'JD-BOUND: worker terminate preserved');

console.log(`jobDocumentExtractP1b.test.js: ${count} assertions passed`);
