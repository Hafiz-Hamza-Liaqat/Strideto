import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractJobFieldsFromText, filterSuggestionsForMode } from '../../../shared/jobs/jobDocumentExtraction.js';
import { projectPublicJob } from '../../../shared/publicDiscovery/projectPublicDiscovery.js';
import {
  ADMIN_FORM_DEFAULTS,
  ADMIN_SUGGESTION_FIELD_MAP,
  applyJobDocumentSuggestions,
} from '../../../client/src/components/jobs/jobDocumentSuggestionMerge.js';

const sections = {
  skills: 'Skills Required\nFood Systems\nAgriculture\nClimate Resilience',
  benefits: 'Compensation / Benefits\nCompetitive salary\nHealth insurance',
  eligibility: 'Location Eligibility\nApplicants must be located in Kenya.\nRelocation assistance is available.',
};

function parse(text) {
  return filterSuggestionsForMode(
    extractJobFieldsFromText(text, { mode: 'admin' }).suggestions,
    'admin',
  );
}

const ordered = parse([
  'Title\nData Analyst',
  sections.skills,
  sections.benefits,
  sections.eligibility,
  'Requirements\nSQL experience',
].join('\n\n'));
const shuffled = parse([
  sections.eligibility,
  'Requirements\nSQL experience',
  'Title\nData Analyst',
  sections.benefits,
  sections.skills,
].join('\n\n'));

assert.deepEqual(ordered.benefits?.value, ['Competitive salary', 'Health insurance']);
assert.equal(ordered.locationEligibility?.value, 'Applicants must be located in Kenya.\nRelocation assistance is available.');
assert.deepEqual(ordered.skillsRequired?.value, ['Food Systems', 'Agriculture', 'Climate Resilience']);
assert.deepEqual(
  Object.fromEntries(['benefits', 'locationEligibility', 'skillsRequired'].map((key) => [key, ordered[key]?.value])),
  Object.fromEntries(['benefits', 'locationEligibility', 'skillsRequired'].map((key) => [key, shuffled[key]?.value])),
);

const sameLine = parse([
  'Salary Range: USD 80,000-100,000',
  'Currency: USD',
  'Benefits: Competitive salary, Health insurance; Paid leave',
  'Location Eligibility: Applicants must be based in Kenya.',
].join('\n'));
assert.equal(sameLine.salaryRange?.value, 'USD 80,000-100,000');
assert.deepEqual(sameLine.benefits?.value, ['Competitive salary', 'Health insurance', 'Paid leave']);
assert.equal(sameLine.locationEligibility?.value, 'Applicants must be based in Kenya.');

const form = {
  ...ADMIN_FORM_DEFAULTS,
  benefits: 'Old benefit',
  locationEligibility: 'Remote within Pakistan',
};
const merged = applyJobDocumentSuggestions(form, ordered, {
  fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
  formDefaults: ADMIN_FORM_DEFAULTS,
  onlyEmpty: true,
  replaceSupported: true,
}).form;
assert.equal(merged.benefits, 'Competitive salary\nHealth insurance');
assert.equal(merged.locationEligibility, 'Applicants must be located in Kenya.\nRelocation assistance is available.');

const absent = applyJobDocumentSuggestions(merged, { title: ordered.title }, {
  fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
  formDefaults: ADMIN_FORM_DEFAULTS,
  onlyEmpty: true,
  replaceSupported: true,
}).form;
assert.equal(absent.benefits, merged.benefits);
assert.equal(absent.locationEligibility, merged.locationEligibility);

const publicJob = projectPublicJob({
  _id: 'job-1',
  title: 'Data Analyst',
  status: 'active',
  approvalStatus: 'approved',
  benefits: 'Competitive salary; Health insurance',
  locationEligibility: 'Applicants must be based in Kenya.',
});
assert.deepEqual(publicJob.benefits, ['Competitive salary', 'Health insurance']);
assert.equal(publicJob.locationEligibility, 'Applicants must be based in Kenya.');
const publicEmpty = projectPublicJob({ _id: 'job-2', title: 'Other', benefits: [], locationEligibility: '' });
assert.deepEqual(publicEmpty.benefits, []);
assert.equal(publicEmpty.locationEligibility, '');

const adminSource = fs.readFileSync(new URL('../../../client/src/pages/Admin/AdminContentJobs.jsx', import.meta.url), 'utf8');
const detailSource = fs.readFileSync(new URL('../../../client/src/pages/Jobs/JobDetail.jsx', import.meta.url), 'utf8');
assert.match(adminSource, /Compensation \/ Benefits/);
assert.match(adminSource, /Location Eligibility/);
assert.match(detailSource, /job\.benefits/);
assert.match(detailSource, /job\.locationEligibility/);

console.log('JOB-OPTIONAL-SECTIONS: benefits/location eligibility extraction, boundaries, merge, projection, and UI contracts passed');
