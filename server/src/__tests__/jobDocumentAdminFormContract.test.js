/**
 * JOB-AUTOFILL-ADMIN — ordered/unordered document to AdminContentJobs form contract.
 * Run: node src/__tests__/jobDocumentAdminFormContract.test.js
 */
import assert from 'node:assert/strict';
import {
  extractJobFieldsFromText,
  filterSuggestionsForMode,
} from '../../../shared/jobs/jobDocumentExtraction.js';
import {
  ADMIN_FORM_DEFAULTS,
  ADMIN_SUGGESTION_FIELD_MAP,
  applyJobDocumentSuggestions,
} from '../../../client/src/components/jobs/jobDocumentSuggestionMerge.js';

const ADMIN_FORM = {
  title: '', company: '', category: '', type: 'full-time', jobType: 'Private',
  countryCode: '', province: '', region: '', city: '', location: '', workMode: 'unspecified',
  remote: false, hybrid: false, salaryRange: '', salaryCurrency: '', openingsCount: '',
  experience: '', educationRequirement: '', description: '', requirements: '',
  responsibilities: '', skillsRequired: '', applicationLink: '', applyEmail: '',
  sourceUrl: '', sourceWebsite: '', externalId: '', deadline: '', status: 'draft',
  approvalStatus: 'pending', urgent: false, isFeatured: false, logoUrl: '', gallery: '',
  slug: '', seoTitle: '', metaDescription: '',
};

const fields = {
  title: 'Senior Platform Engineer',
  company: 'Northstar Systems',
  category: 'Software & IT',
  type: 'Full-time',
  jobType: 'Private',
  countryCode: 'Canada',
  region: 'Ontario',
  city: 'Toronto',
  workMode: 'Remote',
  salaryRange: 'CAD 120,000–150,000 per year',
  salaryCurrency: 'CAD',
  openingsCount: '3',
  experience: '5+ years of professional software engineering experience',
  educationRequirement: "Bachelor's degree in Computer Science",
  deadline: '15 September 2026',
  applicationLink: 'https://careers.northstar.example/jobs/platform-engineer',
  applyEmail: 'jobs@northstar.example',
  description: 'Build reliable platform services for international customers.\n\nPartner with product and security teams.',
  requirements: ['Design distributed services', 'Review production code'],
  responsibilities: ['Own platform reliability', 'Mentor engineers'],
  skillsRequired: ['Go', 'Kubernetes', 'PostgreSQL'],
};

const labelled = (label, value) => `${label}: ${Array.isArray(value) ? value.join('\n') : value}`;

const ordered = [
  labelled('Job Title', fields.title),
  labelled('Company', fields.company),
  labelled('Category', fields.category),
  labelled('Employment Type', fields.type),
  labelled('Job Type', fields.jobType),
  labelled('Country', fields.countryCode),
  labelled('Province', fields.region),
  labelled('City', fields.city),
  labelled('Work Mode', fields.workMode),
  labelled('Salary', fields.salaryRange),
  labelled('Currency', fields.salaryCurrency),
  labelled('Number of Openings', fields.openingsCount),
  labelled('Experience Requirement', fields.experience),
  labelled('Education Requirement', fields.educationRequirement),
  labelled('Deadline', fields.deadline),
  labelled('Application Link', fields.applicationLink),
  labelled('Application Email', fields.applyEmail),
  'Job Description:\n' + fields.description,
  'Requirements:\n' + fields.requirements.map((v) => `- ${v}`).join('\n'),
  'Responsibilities:\n' + fields.responsibilities.map((v) => `- ${v}`).join('\n'),
  'Required Skills:\n' + fields.skillsRequired.join('\n'),
].join('\n\n');

const shuffled = [
  'Requirements:\n' + fields.requirements.map((v) => `- ${v}`).join('\n'),
  labelled('Company', fields.company),
  labelled('Deadline', fields.deadline),
  labelled('City', fields.city),
  'Job Description:\n' + fields.description,
  labelled('Job Title', fields.title),
  labelled('Work Mode', fields.workMode),
  labelled('Education', fields.educationRequirement),
  labelled('Experience Requirement', fields.experience),
  labelled('Category', fields.category),
  labelled('Country', fields.countryCode),
  labelled('Salary', fields.salaryRange),
  'Responsibilities:\n' + fields.responsibilities.map((v) => `- ${v}`).join('\n'),
  labelled('Application Email', fields.applyEmail),
  labelled('Province', fields.region),
  labelled('Employment Type', fields.type),
  labelled('Job Type', fields.jobType),
  labelled('Currency', fields.salaryCurrency),
  labelled('Number of Openings', fields.openingsCount),
  labelled('Application URL', fields.applicationLink),
  'Required Skills:\n' + fields.skillsRequired.join('\n'),
].join('\n\n');

function adminFormFromDocument(text) {
  const parsed = extractJobFieldsFromText(text, { mode: 'admin' });
  const suggestions = filterSuggestionsForMode(parsed.suggestions, 'admin');
  return {
    parsed,
    suggestions,
    result: applyJobDocumentSuggestions({ ...ADMIN_FORM }, suggestions, {
      fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
      formDefaults: ADMIN_FORM_DEFAULTS,
      initialForm: ADMIN_FORM,
      touchedFields: new Set(),
      onlyEmpty: true,
      allowUntouchedDefaults: true,
    }),
  };
}

const orderedResult = adminFormFromDocument(ordered);
const shuffledResult = adminFormFromDocument(shuffled);

assert.equal(orderedResult.suggestions.applicationMethod, undefined);
assert.equal(shuffledResult.suggestions.applicationMethod, undefined);

const expected = {
  title: fields.title,
  company: fields.company,
  category: fields.category,
  type: 'full-time',
  jobType: fields.jobType,
  countryCode: 'CA',
  region: fields.region,
  province: fields.region,
  city: fields.city,
  workMode: 'remote',
  remote: true,
  hybrid: false,
  salaryRange: fields.salaryRange,
  salaryCurrency: fields.salaryCurrency,
  openingsCount: fields.openingsCount,
  experience: fields.experience,
  educationRequirement: fields.educationRequirement,
  deadline: '2026-09-15',
  applicationLink: fields.applicationLink,
  applyEmail: fields.applyEmail,
  description: fields.description,
  requirements: fields.requirements.join('\n'),
  responsibilities: fields.responsibilities.join('\n'),
  skillsRequired: fields.skillsRequired.join(', '),
};

for (const [key, value] of Object.entries(expected)) {
  assert.equal(orderedResult.result.form[key], value, `ordered ${key}`);
  assert.equal(shuffledResult.result.form[key], value, `shuffled ${key}`);
  assert.equal(orderedResult.result.form[key], shuffledResult.result.form[key], `order independence ${key}`);
}

const dateCases = [
  ['2026-09-15', '2026-09-15'],
  ['September 15, 2026', '2026-09-15'],
  ['15 September 2026', '2026-09-15'],
  ['15/09/2026', '2026-09-15'],
  ['03/04/2026', undefined],
  ['09/15/2026', '2026-09-15'],
  ['09/10/2026', undefined],
  ['2026-02-30', undefined],
  ['31 February 2026', undefined],
  ['31/02/2026', undefined],
];
for (const [raw, expectedDate] of dateCases) {
  const { suggestions } = adminFormFromDocument(`Application Deadline: ${raw}`);
  assert.equal(suggestions.deadline?.value, expectedDate, `date ${raw}`);
}

const applicationMethodText = [
  'Application Method: External URL',
  'Application Link: https://example.com/jobs/123',
].join('\n');
const employerParsed = extractJobFieldsFromText(applicationMethodText, { mode: 'employer' });
const employerSuggestions = filterSuggestionsForMode(employerParsed.suggestions, 'employer');
const adminParsed = extractJobFieldsFromText(applicationMethodText, { mode: 'admin' });
const adminSuggestions = filterSuggestionsForMode(adminParsed.suggestions, 'admin');
assert.equal(adminSuggestions.applicationMethod, undefined, 'application method is Admin-filtered');
assert.equal(employerSuggestions.applicationMethod?.value, 'external_url', 'employer application method is retained');
assert.equal(employerSuggestions.applicationLink?.value, 'https://example.com/jobs/123');

const descriptionText = 'Description:\nFirst paragraph.\n\nSecond paragraph.';
const descriptionParsed = extractJobFieldsFromText(descriptionText, { mode: 'admin' });
const descriptionSuggestions = filterSuggestionsForMode(descriptionParsed.suggestions, 'admin');
assert.equal(descriptionSuggestions.description?.value, 'First paragraph.\n\nSecond paragraph.');
const descriptionForm = applyJobDocumentSuggestions({ ...ADMIN_FORM }, descriptionSuggestions, {
  fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
  formDefaults: ADMIN_FORM_DEFAULTS,
  initialForm: ADMIN_FORM,
  touchedFields: new Set(),
  onlyEmpty: true,
  allowUntouchedDefaults: true,
});
assert.equal(descriptionForm.form.description, 'First paragraph.\n\nSecond paragraph.');

const locationForm = {
  ...ADMIN_FORM,
  countryCode: 'PK',
  region: 'Punjab',
  province: 'Punjab',
  city: 'Lahore',
};
const locationSuggestions = filterSuggestionsForMode(
  extractJobFieldsFromText('Country: Canada', { mode: 'admin' }).suggestions,
  'admin',
);
const locationResult = applyJobDocumentSuggestions(locationForm, locationSuggestions, {
  fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
  formDefaults: ADMIN_FORM_DEFAULTS,
  initialForm: locationForm,
  touchedFields: new Set(),
  onlyEmpty: true,
  allowUntouchedDefaults: true,
});
assert.equal(locationResult.form.countryCode, 'CA');
assert.equal(locationResult.form.region, '');
assert.equal(locationResult.form.province, '');
assert.equal(locationResult.form.city, '');

const modes = [
  ['Remote', 'remote', true, false],
  ['Hybrid', 'hybrid', false, true],
  ['On-site', 'on_site', false, false],
];
for (const [raw, value, remote, hybrid] of modes) {
  const { result } = adminFormFromDocument(`Work Mode: ${raw}`);
  assert.equal(result.form.workMode, value, `work mode ${raw}`);
  assert.equal(result.form.remote, remote, `remote flag ${raw}`);
  assert.equal(result.form.hybrid, hybrid, `hybrid flag ${raw}`);
}

console.log('JOB-AUTOFILL-ADMIN: ordered/unordered form contract passed');
