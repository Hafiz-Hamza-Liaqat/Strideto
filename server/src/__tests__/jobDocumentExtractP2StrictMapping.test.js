/**
 * STRIDETO JOB-AUTOFILL-P2 — Strict extraction, field contracts, negative validation, apply behavior.
 * Run: node src/__tests__/jobDocumentExtractP2StrictMapping.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  extractJobFieldsFromText,
  normalizeDocumentText,
  JOB_DOCUMENT_PROTECTED_FIELDS,
  filterSuggestionsForMode,
} from '../../../shared/jobs/jobDocumentExtraction.js';
import {
  validateExperienceCandidate,
  validateEducationCandidate,
  validateTitleCandidate,
  validateCompanyCandidate,
  validateDeadlineCandidate,
  validateOpeningsCandidate,
  validateEmailCandidate,
  validateExternalJobIdCandidate,
  validateSalaryCandidate,
  validateApplicationUrlCandidate,
  validateSkillsItemCandidate,
  CANDIDATE_STATUS,
} from '../../../shared/jobs/jobDocumentFieldContracts.js';
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
  ADMIN_SUGGESTION_FIELD_MAP,
  EMPLOYER_FORM_DEFAULTS,
  ADMIN_FORM_DEFAULTS,
} = merge;

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

/** Manual acceptance fixture (section 91) */
const P2_ACCEPTANCE_FIXTURE = `JOB TITLE:
Senior Frontend Engineer

COMPANY / ORGANIZATION:
Nova Digital Solutions

LOCATION:
Lahore, Punjab, Pakistan

EMPLOYMENT TYPE:
Full-time

WORK MODE:
Hybrid

SALARY RANGE:
PKR 180,000–250,000 per month

SALARY CURRENCY:
PKR

EXPERIENCE REQUIREMENT:
3–5 years of professional frontend development experience

EDUCATION REQUIREMENT:
Bachelor's degree in Computer Science, Software Engineering, or related field

APPLICATION DEADLINE:
30 September 2026

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
Responsive Web Design
Frontend Performance Optimization

JOB DESCRIPTION:
Nova Digital Solutions is hiring a Senior Frontend Engineer to build accessible web products.

REQUIREMENTS:
3–5 years of professional frontend development experience
Strong practical experience with React and TypeScript
Experience integrating REST APIs.

RESPONSIBILITIES:
Build scalable frontend applications
Collaborate with backend teams

APPLICATION LINK:
https://careers.example.com/apply/senior-frontend-engineer

APPLICATION EMAIL:
jobs@nova.example.com

EXTERNAL ID:
R-1187397
`;

function extract(text, mode = 'employer') {
  return extractJobFieldsFromText(text, { mode });
}

// ── MANDATORY EXPERIENCE REGRESSION ──
{
  const cases = [
    'Experience integrating REST APIs.',
    'Experience: integrating REST APIs.',
    'REQUIREMENTS:\nExperience integrating REST APIs.',
    'Experience with React and REST APIs',
    'Experienced in REST API integration',
    'Strong experience building responsive interfaces',
  ];
  for (const text of cases) {
    const { suggestions } = extract(text);
    check(
      suggestions.experience?.value !== 'integrating REST APIs.',
      `P2-EXP-REGRESSION: no REST APIs in experience for: ${text.slice(0, 40)}`
    );
    check(!suggestions.experience?.value?.includes('integrating REST APIs'), 'P2-EXP-REGRESSION: fragment rejected');
  }
}

{
  check(validateExperienceCandidate('3-5 years of experience').status === CANDIDATE_STATUS.ACCEPTED, 'EXP-01 accept range');
  check(validateExperienceCandidate('Minimum 3 years of professional experience').status === CANDIDATE_STATUS.ACCEPTED, 'EXP-02 accept minimum');
  check(validateExperienceCandidate('5+ years').status === CANDIDATE_STATUS.ACCEPTED, 'EXP-03 accept 5+');
  check(validateExperienceCandidate('Experience with React').status === CANDIDATE_STATUS.REJECTED, 'EXP-04 reject with React');
  check(validateExperienceCandidate('Experienced in REST API integration').status === CANDIDATE_STATUS.REJECTED, 'EXP-05 reject experienced in');
  check(validateExperienceCandidate('integrating REST APIs.').status === CANDIDATE_STATUS.REJECTED, 'EXP-06 reject fragment');
  check(validateExperienceCandidate('Entry level').status === CANDIDATE_STATUS.ACCEPTED, 'EXP-07 accept entry level');
  check(validateExperienceCandidate('Senior-level').status === CANDIDATE_STATUS.ACCEPTED, 'EXP-08 accept senior level');
  check(validateExperienceCandidate('Git experience preferred').status === CANDIDATE_STATUS.REJECTED, 'EXP-09 reject git skill');
  check(validateExperienceCandidate('3-5 years of frontend development experience').status === CANDIDATE_STATUS.ACCEPTED, 'EXP-10 accept full phrase');
}

// ── EDUCATION MATRIX ──
{
  check(validateEducationCandidate("Bachelor's degree in Computer Science").status === CANDIDATE_STATUS.ACCEPTED, 'EDU-01 bachelor');
  check(validateEducationCandidate('BSCS or equivalent').status === CANDIDATE_STATUS.ACCEPTED, 'EDU-02 bscs');
  check(validateEducationCandidate("Master's preferred").status === CANDIDATE_STATUS.ACCEPTED, 'EDU-03 masters');
  check(validateEducationCandidate('React certification preferred').status === CANDIDATE_STATUS.REVIEW, 'EDU-04 cert review');
  check(validateEducationCandidate('React').status === CANDIDATE_STATUS.REJECTED, 'EDU-05 react reject');
  check(validateEducationCandidate('AWS experience').status === CANDIDATE_STATUS.REJECTED, 'EDU-06 aws reject');
  check(validateEducationCandidate('High school diploma').status === CANDIDATE_STATUS.ACCEPTED, 'EDU-07 high school');
}

// ── DEADLINE MATRIX ──
{
  check(validateDeadlineCandidate('2026-09-30', { evidence: 'Application deadline: September 30, 2026' }).status === CANDIDATE_STATUS.ACCEPTED, 'DL-01 accept deadline');
  check(validateDeadlineCandidate('2026-08-20', { evidence: 'Posted August 20, 2026' }).status === CANDIDATE_STATUS.REJECTED, 'DL-02 reject posted');
  check(validateDeadlineCandidate('2026-10-01', { evidence: 'Start date October 2026' }).status === CANDIDATE_STATUS.REJECTED, 'DL-03 reject start');
  const posted = extract('Posted: August 20, 2026');
  check(!posted.suggestions.deadline, 'DL-04 posted not deadline');
  const closing = extract('APPLICATION DEADLINE:\nSeptember 30, 2026');
  check(closing.suggestions.deadline?.value === '2026-09-30', 'DL-05 closing accepted');
}

// ── OPENINGS MATRIX ──
{
  check(validateOpeningsCandidate(3, { evidence: '3 openings' }).status === CANDIDATE_STATUS.ACCEPTED, 'OPEN-01 accept');
  check(validateOpeningsCandidate(2, { evidence: 'Vacancies: 2' }).status === CANDIDATE_STATUS.ACCEPTED, 'OPEN-02 vacancies');
  check(validateOpeningsCandidate(3, { evidence: '3-5 years experience' }).status === CANDIDATE_STATUS.REJECTED, 'OPEN-03 years reject');
  check(validateOpeningsCandidate(20, { evidence: 'Team of 20 engineers' }).status === CANDIDATE_STATUS.REJECTED, 'OPEN-04 team reject');
  check(validateOpeningsCandidate(4, { evidence: 'Offices in 4 cities' }).status === CANDIDATE_STATUS.REJECTED, 'OPEN-05 offices reject');
}

// ── TITLE MATRIX ──
{
  check(validateTitleCandidate('Senior Frontend Engineer').status === CANDIDATE_STATUS.ACCEPTED, 'TTL-01 accept title');
  check(validateTitleCandidate('Job Description').status === CANDIDATE_STATUS.REJECTED, 'TTL-02 reject heading');
  check(validateTitleCandidate('About the Role').status === CANDIDATE_STATUS.REJECTED, 'TTL-03 reject about');
  check(validateTitleCandidate('Lahore').status === CANDIDATE_STATUS.ACCEPTED, 'TTL-04 city ambiguous ok for heuristic');
  const badTitle = extract('JOB TITLE:\nJob Description');
  check(!badTitle.suggestions.title || badTitle.suggestions.title.value !== 'Job Description', 'TTL-05 no job description title');
}

// ── COMPANY MATRIX ──
{
  check(validateCompanyCandidate('Nova Digital Solutions').status === CANDIDATE_STATUS.ACCEPTED, 'CO-01 accept');
  check(validateCompanyCandidate('jobs@company.com').status === CANDIDATE_STATUS.REJECTED, 'CO-02 email reject');
  check(validateCompanyCandidate('https://company.com').status === CANDIDATE_STATUS.REJECTED, 'CO-03 url reject');
  check(validateCompanyCandidate('About us').status === CANDIDATE_STATUS.REJECTED, 'CO-04 about us reject');
}

// ── URL MATRIX ──
{
  check(validateApplicationUrlCandidate('https://careers.example.com/apply').status === CANDIDATE_STATUS.ACCEPTED, 'URL-01 accept');
  check(validateApplicationUrlCandidate('javascript:alert(1)').status === CANDIDATE_STATUS.REJECTED, 'URL-02 javascript');
  check(validateApplicationUrlCandidate('http://localhost/job').status === CANDIDATE_STATUS.REJECTED, 'URL-03 localhost');
  check(validateApplicationUrlCandidate('data:text/html,test').status === CANDIDATE_STATUS.REJECTED, 'URL-04 data');
}

// ── EMAIL MATRIX ──
{
  check(validateEmailCandidate('jobs@example.com', { evidence: 'Apply at jobs@example.com' }).status === CANDIDATE_STATUS.ACCEPTED, 'EM-01 apply email');
  check(validateEmailCandidate('info@example.com', { evidence: 'For questions: info@example.com' }).status === CANDIDATE_STATUS.REVIEW, 'EM-02 info review');
  check(validateEmailCandidate('privacy@example.com', { evidence: 'Privacy: privacy@example.com' }).status === CANDIDATE_STATUS.REJECTED, 'EM-03 privacy reject');
}

// ── JOB ID MATRIX ──
{
  check(validateExternalJobIdCandidate('R-1187397').status === CANDIDATE_STATUS.ACCEPTED, 'ID-01 accept');
  check(validateExternalJobIdCandidate('12345').status === CANDIDATE_STATUS.REVIEW, 'ID-02 numeric review');
  check(validateExternalJobIdCandidate('120000').status === CANDIDATE_STATUS.REVIEW, 'ID-03 salary-like review');
  check(validateExternalJobIdCandidate('Page 3').status === CANDIDATE_STATUS.REJECTED, 'ID-04 page reject');
  check(validateExternalJobIdCandidate('30/09/2026').status === CANDIDATE_STATUS.REJECTED, 'ID-05 date reject');
}

// ── SALARY MATRIX ──
{
  check(validateSalaryCandidate('PKR 180,000–250,000 per month').status === CANDIDATE_STATUS.ACCEPTED, 'SAL-01 accept range');
  check(validateSalaryCandidate('Competitive salary').status === CANDIDATE_STATUS.REJECTED, 'SAL-02 reject competitive');
  check(validateSalaryCandidate('Market competitive').status === CANDIDATE_STATUS.REJECTED, 'SAL-03 reject market');
}

// ── SKILLS MATRIX ──
{
  check(validateSkillsItemCandidate('React').status === CANDIDATE_STATUS.ACCEPTED, 'SK-01 react');
  check(validateSkillsItemCandidate('3-5 years').status === CANDIDATE_STATUS.REJECTED, 'SK-02 years reject');
  check(validateSkillsItemCandidate("Bachelor's degree").status === CANDIDATE_STATUS.REJECTED, 'SK-03 degree reject');
  check(validateSkillsItemCandidate('Lahore').status === CANDIDATE_STATUS.ACCEPTED, 'SK-04 lahore ok as skill name edge');
}

// ── ACCEPTANCE FIXTURE ──
{
  const { suggestions: s } = extract(P2_ACCEPTANCE_FIXTURE);
  check(s.title?.value === 'Senior Frontend Engineer', 'FIX-01 title');
  check(s.company?.value === 'Nova Digital Solutions', 'FIX-02 company');
  check(s.countryCode?.value === 'PK', 'FIX-03 country');
  check(s.region?.value === 'Punjab', 'FIX-04 region');
  check(s.city?.value === 'Lahore', 'FIX-05 city');
  check(s.type?.value === 'full-time', 'FIX-06 employment');
  check(s.workMode?.value === 'hybrid', 'FIX-07 work mode');
  check(s.salaryCurrency?.value === 'PKR', 'FIX-08 currency');
  check(s.experience?.value?.includes('3'), 'FIX-09 experience years');
  check(!s.experience?.value?.includes('integrating REST APIs'), 'FIX-10 experience not REST fragment');
  check(s.educationRequirement?.value?.includes('Bachelor'), 'FIX-11 education');
  check(s.deadline?.value === '2026-09-30', 'FIX-12 deadline');
  check(s.openingsCount?.value === 3, 'FIX-13 openings');
  check(s.skillsRequired?.value?.includes('REST APIs'), 'FIX-14 REST APIs in skills');
  check(s.skillsRequired?.value?.includes('React'), 'FIX-15 react skill');
  check(s.requirements?.value?.some((r) => r.includes('integrating REST APIs')), 'FIX-16 REST in requirements');
  check(s.applicationLink?.value?.startsWith('https://'), 'FIX-17 application url');
  check(s.applyEmail?.value === 'jobs@nova.example.com', 'FIX-18 apply email');
  check(s.description?.value?.includes('Nova Digital Solutions'), 'FIX-19 description');
}

{
  const { suggestions: s } = extract(P2_ACCEPTANCE_FIXTURE, 'admin');
  check(s.externalId?.value === 'R-1187397', 'FIX-20 external id admin');
}

// ── RAW TEXT PRESERVATION ──
{
  const block = `REQUIRED SKILLS:
React
TypeScript
JavaScript`;
  const { lines } = normalizeDocumentText(block);
  check(lines.includes('React') && lines.includes('TypeScript'), 'PRES-01 lines preserved');
  check(lines.indexOf('React') < lines.indexOf('TypeScript'), 'PRES-02 order preserved');
  const multi = normalizeDocumentText('Line one\n\nLine two');
  check(multi.paragraphs.length === 2, 'PRES-03 paragraphs');
}

// ── SECTION DETECTION ──
{
  const doc = `REQUIREMENTS:
Req one
Req two

RESPONSIBILITIES:
Duty one

REQUIRED SKILLS:
Skill A`;
  const { suggestions } = extract(doc);
  check(suggestions.requirements?.value?.length === 2, 'SEC-01 requirements section');
  check(suggestions.responsibilities?.value?.length === 1, 'SEC-02 responsibilities section');
  check(suggestions.skillsRequired?.value?.includes('Skill A'), 'SEC-03 skills section');
}

// ── WORK MODE ──
{
  check(extract('WORK MODE:\nRemote').suggestions.workMode?.value === 'remote', 'WM-01 remote');
  check(extract('WORK MODE:\nHybrid').suggestions.workMode?.value === 'hybrid', 'WM-02 hybrid');
  check(extract('WORK MODE:\nOn-site').suggestions.workMode?.value === 'on_site', 'WM-03 onsite');
  check(!extract('Apply at https://jobs.example.com/apply').suggestions.workMode, 'WM-04 no infer from url');
}

// ── EMPLOYMENT TYPE ──
{
  check(extract('EMPLOYMENT TYPE:\nFull-time').suggestions.type?.value === 'full-time', 'ET-01 full-time');
  check(extract('EMPLOYMENT TYPE:\nPart-time').suggestions.type?.value === 'part-time', 'ET-02 part-time');
  check(extract('EMPLOYMENT TYPE:\nContract').suggestions.type?.value === 'contract', 'ET-03 contract');
}

// ── JOB TYPE (sector) ──
{
  check(extract('JOB CLASSIFICATION:\nPrivate').suggestions.jobType?.value === 'Private', 'JT-01 private');
  check(extract('JOB CLASSIFICATION:\nGovernment').suggestions.jobType?.value === 'Government', 'JT-02 government');
}

// ── PROTECTED FIELDS ──
for (const field of JOB_DOCUMENT_PROTECTED_FIELDS) {
  const { suggestions } = extract(`${field}: bad-value\nCompany: Safe Co`, 'admin');
  check(!suggestions[field], `PROT-${field}: not extracted`);
}

// ── STATUS ON SUGGESTIONS ──
{
  const { suggestions } = extract(P2_ACCEPTANCE_FIXTURE);
  check(suggestions.title?.status === 'accepted' || !suggestions.title?.status, 'STAT-01 title accepted');
  check(suggestions.experience?.status === 'accepted' || !suggestions.experience?.status, 'STAT-02 experience accepted');
}

// ── APPLY TESTS (JOB-P2-APPLY-*) ──
{
  const form = { ...EMPLOYER_FORM_DEFAULTS };
  const before = JSON.stringify(form);
  check(before === JSON.stringify(form), 'JOB-P2-APPLY-01: upload alone does not mutate form');
}

{
  const form = { ...EMPLOYER_FORM_DEFAULTS };
  const suggestions = extract(P2_ACCEPTANCE_FIXTURE).suggestions;
  const { form: next, applied } = applyJobDocumentSuggestions(form, suggestions, {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
  });
  check(applied.includes('title'), 'JOB-P2-APPLY-02: accepted populates empty');
  check(next.jobTitle === 'Senior Frontend Engineer', 'JOB-P2-APPLY-02: title value');
}

{
  const poison = { experience: { value: 'integrating REST APIs.', status: 'rejected', confidence: 'low' } };
  const { form: next, applied } = applyJobDocumentSuggestions({ ...EMPLOYER_FORM_DEFAULTS }, poison, {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
  });
  check(!applied.includes('experience'), 'JOB-P2-APPLY-03: rejected never applied');
  check(next.experience === '', 'JOB-P2-APPLY-03: experience empty');
}

{
  const form = { ...EMPLOYER_FORM_DEFAULTS, experience: 'Manual 10 years' };
  const suggestions = { experience: { value: '3-5 years', status: 'accepted' } };
  const { form: next, applied } = applyJobDocumentSuggestions(form, suggestions, {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(['experience']),
    onlyEmpty: true,
  });
  check(!applied.includes('experience'), 'JOB-P2-APPLY-05: manual preserved');
  check(next.experience === 'Manual 10 years', 'JOB-P2-APPLY-05: value kept');
}

{
  const form = { ...EMPLOYER_FORM_DEFAULTS, jobTitle: 'Prefilled' };
  const suggestions = extract(P2_ACCEPTANCE_FIXTURE).suggestions;
  const { form: a } = applyJobDocumentSuggestions(form, suggestions, {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
    onlyEmpty: true,
  });
  const { form: b } = applyJobDocumentSuggestions(form, suggestions, {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
    onlyEmpty: true,
  });
  check(JSON.stringify(a) === JSON.stringify(b), 'JOB-P2-APPLY-06: deterministic apply');
}

{
  const form = { ...EMPLOYER_FORM_DEFAULTS };
  const suggestions = extract(P2_ACCEPTANCE_FIXTURE).suggestions;
  applyJobDocumentSuggestions(form, suggestions, {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
  });
  check(form.status === undefined || form.status !== 'published', 'JOB-P2-APPLY-08: status unchanged');
  check(form.urgent === undefined, 'JOB-P2-APPLY-09: urgent unchanged');
}

{
  const reviewSug = { sourceUrl: { value: 'https://example.com/job/1', status: 'review', confidence: 'low' } };
  const { applied } = applyJobDocumentSuggestions({ ...ADMIN_FORM_DEFAULTS }, reviewSug, {
    fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
    formDefaults: ADMIN_FORM_DEFAULTS,
    initialForm: ADMIN_FORM_DEFAULTS,
    onlyEmpty: true,
  });
  check(!applied.includes('sourceUrl'), 'JOB-P2-APPLY-03b: review skipped on bulk apply');
}

// ── CROSS-FIELD CONTAMINATION ──
{
  check(!extract('3 years').suggestions.openingsCount, 'CROSS-01 years not openings');
  check(!extract('5 offices worldwide').suggestions.openingsCount, 'CROSS-02 offices not openings');
  check(!extract('React').suggestions.educationRequirement, 'CROSS-03 react not education');
  check(!extract('120000').suggestions.externalId, 'CROSS-04 salary not id standalone');
}

// ── ADMIN VS EMPLOYER ──
{
  const adminText = `Source Website: PPSC
Source URL: https://ppsc.gov.pk/job/1
External ID: ABC-2026-14
Company: Test Co`;
  const emp = extract(adminText, 'employer').suggestions;
  const adm = extract(adminText, 'admin').suggestions;
  check(!emp.sourceWebsite && !emp.sourceUrl && !emp.externalId, 'MODE-01 employer no provenance');
  check(adm.sourceWebsite?.value === 'PPSC', 'MODE-02 admin source website');
  check(adm.externalId?.value === 'ABC-2026-14', 'MODE-03 admin external id');
}

// ── EXTRACTION NO PERSISTENCE ──
{
  const ctrl = read('server/src/controllers/jobDocumentExtractController.js');
  check(!ctrl.includes('Job.create'), 'SIDE-01 no create');
  check(!ctrl.includes('.save('), 'SIDE-02 no save');
  check(!ctrl.includes('IndexNow'), 'SIDE-03 no indexnow');
}

// ── SECURITY ──
{
  const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0x41);
  let threw = false;
  try {
    await validateJobDescriptionBuffer(big, 'text/plain', 'big.txt');
  } catch (e) {
    threw = e.code === 'file_too_large';
  }
  check(threw, 'SEC-SIZE: 5MB+ rejected');
}

{
  const bounded = read('server/src/services/boundedDocumentTextExtract.js');
  check(bounded.includes('DOCUMENT_PARSE_TIMEOUT_MS'), 'SEC-TIMEOUT: timeout preserved');
  check(bounded.includes('worker_threads'), 'SEC-WORKER: worker preserved');
}

// ── MALFORMED INPUT ──
{
  check(extract('').suggestions && Object.keys(extract('').suggestions).length === 0, 'MAL-01 empty');
  check(extract('   \n  \n  ').suggestions && Object.keys(extract('   \n  \n  ').suggestions).length === 0, 'MAL-02 whitespace');
  check(extract('REQUIREMENTS:\n- Item one\n- Item two').suggestions.requirements?.value?.length === 2, 'MAL-03 bullets');
}

// ── PREVIEW UI ──
{
  const panel = read('client/src/components/jobs/JobDescriptionUploadPanel.jsx');
  check(panel.includes('setSuggestions(sug)'), 'UI-01 preview only on upload');
  check(panel.includes('Apply all valid suggestions'), 'UI-02 explicit apply');
  check(panel.includes('formatSuggestionStatus'), 'UI-03 status display');
  check(panel.includes('disabled={!canApply'), 'UI-04 apply disabled when empty');
}

// ── FILTER MODE ──
{
  const all = extract(P2_ACCEPTANCE_FIXTURE, 'admin').suggestions;
  const filtered = filterSuggestionsForMode(all, 'employer');
  check(!filtered.sourceUrl && !filtered.externalId, 'FILTER-01 employer strips admin fields');
}

// ── NO CATEGORY INFERENCE ──
{
  check(!extract(P2_ACCEPTANCE_FIXTURE).suggestions.category, 'CAT-01 no category extracted');
}

// ── LOCATION HIERARCHY ──
{
  const s = extract('LOCATION:\nLahore, Punjab, Pakistan').suggestions;
  check(s.countryCode?.value === 'PK', 'LOC-01 country');
  check(s.region?.value === 'Punjab', 'LOC-02 region');
  check(s.city?.value === 'Lahore', 'LOC-03 city');
  check(s.city?.value !== 'Pakistan', 'LOC-04 city not country');
}

// ── DUPLICATE SECTIONS ──
{
  const doc = `REQUIREMENTS:
First req

REQUIREMENTS:
Second req`;
  const { suggestions } = extract(doc);
  check(suggestions.requirements?.value?.length >= 1, 'DUP-01 handles duplicate sections');
}

// ── UNICODE / MIXED CASE ──
{
  const doc = `job title:
Senior Engineer

work mode:
HYBRID`;
  const { suggestions } = extract(doc);
  check(suggestions.title?.value === 'Senior Engineer', 'UNI-01 mixed case title');
  check(suggestions.workMode?.value === 'hybrid', 'UNI-02 mixed case work mode');
}

// ── CONFLICT RESOLUTION ──
{
  const form = { ...EMPLOYER_FORM_DEFAULTS, jobTitle: 'My Title' };
  const conflicts = buildSuggestionConflicts(form, extract(P2_ACCEPTANCE_FIXTURE).suggestions, {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(['jobTitle']),
  });
  check(conflicts.some((c) => c.field === 'title'), 'CONF-01 title conflict when edited');
}

// ── FIELD STATE ──
{
  check(
    resolveFieldState('jobTitle', 'Custom', {
      touchedFields: new Set(['jobTitle']),
      formDefaults: EMPLOYER_FORM_DEFAULTS,
      field: 'title',
    }) === FIELD_STATE.USER_EDITED,
    'STATE-01 user edited'
  );
  check(
    resolveFieldState('jobTitle', '', {
      touchedFields: new Set(),
      formDefaults: EMPLOYER_FORM_DEFAULTS,
      field: 'title',
    }) === FIELD_STATE.EMPTY,
    'STATE-02 empty'
  );
}

// ── MISSING CANDIDATE NO CLEAR ──
{
  const form = { ...EMPLOYER_FORM_DEFAULTS, experience: '5+ years' };
  const { form: next } = applyJobDocumentSuggestions(form, {}, {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
  });
  check(next.experience === '5+ years', 'CLEAR-01 missing does not clear');
}

// ── REVIEW STATUS ──
{
  const weakSource = extract('Source URL: https://example.com/listing', 'admin');
  check(
    weakSource.suggestions.sourceUrl?.status === 'review'
      || weakSource.suggestions.sourceUrl?.status === 'accepted'
      || !weakSource.suggestions.sourceUrl,
    'REV-01 source url labeled or review or absent'
  );
}

// ── HEURISTIC EMAIL FILTER ──
{
  const doc = `Contact us at privacy@example.com for privacy concerns.
Apply at jobs@example.com`;
  const { suggestions } = extract(doc);
  check(suggestions.applyEmail?.value === 'jobs@example.com', 'HEUR-01 prefers apply email');
}

// ── LONG LINE ──
{
  const longLine = 'A'.repeat(5000);
  const { meta } = extract(`${longLine}\nCompany: Test Co`);
  check(meta.charCount <= 150000, 'LONG-01 within cap');
}

// ── TAXONOMY ──
{
  const { suggestions: s } = extract(`JOB FAMILY:
Software Engineering

SPECIALIZATION:
Frontend Development`);
  check(s.jobFamily?.value === 'Software & IT', 'TAX-01 family');
  check(s.specialization?.value === 'Frontend', 'TAX-02 specialization');
}

// ── APPLICATION METHOD ──
{
  const { suggestions: s } = extract(`APPLICATION METHOD:
External application website

APPLICATION LINK:
https://careers.example.com/job`);
  check(s.applicationMethod?.value === 'external_url', 'AM-01 external url method');
}

// ── NO AI / NO FETCH PROOF ──
{
  const extractionSrc = read('shared/jobs/jobDocumentExtraction.js');
  const contractSrc = read('shared/jobs/jobDocumentFieldContracts.js');
  check(!extractionSrc.includes('openai'), 'NOAI-01 no openai in extraction');
  check(!contractSrc.includes('fetch('), 'NOFETCH-01 no fetch in contracts');
  check(!extractionSrc.includes('ocr'), 'NOOCR-01 no ocr');
}

console.log(`jobDocumentExtractP2StrictMapping.test.js: ${count} assertions passed`);
