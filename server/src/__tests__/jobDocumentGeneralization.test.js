/**
 * Job DOCX generalization and cross-document Admin application contract.
 * Uses the real local DOCX files when available and portable Mammoth-equivalent text otherwise.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from '../../node_modules/mammoth/lib/index.js';
import { extractJobFieldsFromText, filterSuggestionsForMode } from '../../../shared/jobs/jobDocumentExtraction.js';
import {
  ADMIN_FORM_DEFAULTS,
  ADMIN_SUGGESTION_FIELD_MAP,
  applyJobDocumentSuggestions,
  buildSuggestionConflicts,
} from '../../../client/src/components/jobs/jobDocumentSuggestionMerge.js';

const optionalDocxPath = (envName) => {
  const configured = process.env[envName];
  return configured ? path.resolve(configured) : null;
};

const FILE_A = optionalDocxPath('STRIDETO_JOB_DOCX_A');
const FILE_B = optionalDocxPath('STRIDETO_JOB_DOCX_B');

const skills = [
  'Data Analysis', 'SQL', 'Amazon Athena', 'Python', 'Sage', 'Looker', 'Data Wrangling',
  'Data Pipelines', 'Dashboard Development', 'Data Visualization', 'KPI Reporting',
  'Analytics Automation', 'Data Quality', 'Data Governance', 'Stakeholder Management',
  'Cross-functional Collaboration', 'Problem Solving', 'Communication',
];

const fileAFallback = [
  'Job Title', 'AI Agent Engineer (Remote, Full-Time)', '',
  'Company / Organization', 'Smart Working Solutions', '',
  'Job Family', 'Engineering', '',
  'Job Classification', 'Private', '',
  'Employment Type', 'Full-time', '',
  'Work Mode', 'Remote', '',
  'Country', 'Pakistan', '',
  'Experience Requirement', '2+ years building production LLM agents; 5+ years backend engineering proficiency', '',
  'Source Website', 'Smart Working Solutions Careers (Lever)', '',
  'Source URL', 'https://jobs.lever.co/smart-working-solutions/source', '',
  'Application Link', 'https://jobs.lever.co/smart-working-solutions/apply', '',
  'Job Description', 'Smart Working Solutions is hiring an AI Agent Engineer.', '',
  'Responsibilities', '- Build production AI agents.', '',
  'Requirements', '- Production LLM experience.', '',
  'Required Skills', 'LLM Agents', 'TypeScript', '',
  'SEO Fields', '', 'SEO Title', 'AI Agent Engineer at Smart Working Solutions | STRIDETO',
  'Meta Description', 'AI Agent Engineer role metadata',
].join('\n');

const fileBFallback = [
  'Title', 'Data Analyst (Sage Experience)', '',
  'Company', 'US Mobile', '',
  'Category', 'Data & Analytics', '',
  'Employment type', 'Full-time', '',
  'Job type', 'Private', '',
  'Country', 'Pakistan', '',
  'State / Province / Region', 'Sindh', '',
  'City', 'Karachi', '',
  'Work mode', 'On-site', '',
  'Experience', '1+ year of experience in a Data Analyst or similar role', '',
  'Education', "Bachelor's or Master's degree in Data Science, Computer Science, Statistics, or a related field", '',
  'Apply / official link', 'https://jobs.lever.co/USMobile/apply', '',
  'Official source URL', 'https://jobs.lever.co/USMobile/source', '',
  'Source / employer website name', 'US Mobile Careers (Lever)', '',
  'External job ID / reference id', 'usm-123', '',
  'Description', 'US Mobile Data Analyst description.', '',
  'Responsibilities', '- Analyze data.', '- Build dashboards.', '',
  'Requirements', "- Bachelor's degree.", '- SQL.', '',
  'Skills required', ...skills, '',
  'Benefits / Work Environment', 'Competitive salary and benefits.', '',
  'Publishing / SEO Fields', '', 'Status', 'Published', '', 'Approval', 'Approved', '',
  'SEO slug', 'data-analyst-sage-us-mobile-karachi', '',
  'SEO title', 'Data Analyst (Sage Experience) at US Mobile Karachi | STRIDETO', '',
  'Meta description', 'US Mobile Data Analyst metadata', '',
  'Urgent', 'No', '', 'Featured', 'No',
].join('\n');

async function readRaw(file, fallback) {
  if (!file) return { text: fallback, source: 'PORTABLE MAMMOTH-EQUIVALENT FIXTURE' };
  try {
    return {
      text: (await mammoth.extractRawText({ buffer: await fs.readFile(file) })).value,
      source: 'REAL DOCX extraction used',
    };
  } catch {
    throw new Error(`Configured DOCX could not be read: ${file}`);
  }
}

function parse(text) {
  return filterSuggestionsForMode(
    extractJobFieldsFromText(text, { mode: 'admin' }).suggestions,
    'admin',
  );
}

function form() {
  return {
    ...ADMIN_FORM_DEFAULTS,
    province: '',
    remote: false,
    hybrid: false,
    status: 'draft',
    approvalStatus: 'pending',
    urgent: false,
    isFeatured: false,
    slug: '',
  };
}

function apply(current, parsed, initialForm) {
  return applyJobDocumentSuggestions(current, parsed, {
    fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
    formDefaults: ADMIN_FORM_DEFAULTS,
    initialForm,
    touchedFields: new Set(),
    onlyEmpty: true,
    allowUntouchedDefaults: true,
    replaceSupported: true,
  }).form;
}

const [sourceA, sourceB] = await Promise.all([
  readRaw(FILE_A, fileAFallback),
  readRaw(FILE_B, fileBFallback),
]);
const rawA = sourceA.text;
const rawB = sourceB.text;
const a = parse(rawA);
const b = parse(rawB);

console.log(`File A: ${sourceA.source}`);
console.log(`File B: ${sourceB.source}`);

const comparableFields = [
  'title', 'company', 'jobFamily', 'type', 'jobType', 'countryCode', 'region', 'city', 'workMode',
  'experience', 'educationRequirement', 'applicationLink', 'sourceUrl', 'sourceWebsite', 'externalId',
  'description', 'requirements', 'responsibilities', 'skillsRequired', 'seoTitle', 'metaDescription',
];
const comparableValues = (result) => Object.fromEntries(
  comparableFields.map((key) => [key, result[key]?.value]),
);

assert.equal(a.title?.value, 'AI Agent Engineer (Remote, Full-Time)');
assert.equal(a.company?.value, 'Smart Working Solutions');
assert.equal(a.jobFamily?.value, 'Engineering');
assert.equal(a.jobType?.value, 'Private');
assert.equal(a.experience?.value.includes('2+ years'), true);
assert.equal(Array.isArray(a.skillsRequired?.value), true);

const fileAOrdered = [
  'Job Title\nAI Agent Engineer (Remote, Full-Time)',
  'Company / Organization\nSmart Working Solutions',
  'Job Family\nEngineering',
  'Job Classification\nPrivate',
  'Employment Type\nFull-time',
  'Work Mode\nRemote',
  'Country\nPakistan',
  'Experience Requirement\n2+ years building production LLM agents',
  'Source Website\nSmart Working Solutions Careers (Lever)',
  'Source URL\nhttps://jobs.lever.co/smart-working-solutions/source',
  'Application Link\nhttps://jobs.lever.co/smart-working-solutions/apply',
  'Description\nSmart Working Solutions is hiring an AI Agent Engineer.',
  'Responsibilities\n- Build production AI agents.',
  'Requirements\n- Production LLM experience.',
  'Required Skills\nLLM Agents\nTypeScript',
  'SEO Title\nAI Agent Engineer at Smart Working Solutions | STRIDETO',
  'Meta Description\nAI Agent Engineer role metadata',
].join('\n\n');
const fileAShuffled = [
  'Requirements\n- Production LLM experience.',
  'Source URL\nhttps://jobs.lever.co/smart-working-solutions/source',
  'Company / Organization\nSmart Working Solutions',
  'Required Skills\nLLM Agents\nTypeScript',
  'Description\nSmart Working Solutions is hiring an AI Agent Engineer.',
  'Work Mode\nRemote',
  'Job Title\nAI Agent Engineer (Remote, Full-Time)',
  'Experience Requirement\n2+ years building production LLM agents',
  'Country\nPakistan',
  'SEO Title\nAI Agent Engineer at Smart Working Solutions | STRIDETO',
  'Job Family\nEngineering',
  'Responsibilities\n- Build production AI agents.',
  'Source Website\nSmart Working Solutions Careers (Lever)',
  'Application Link\nhttps://jobs.lever.co/smart-working-solutions/apply',
  'Employment Type\nFull-time',
  'Job Classification\nPrivate',
  'Meta Description\nAI Agent Engineer role metadata',
].join('\n\n');
assert.deepEqual(comparableValues(parse(fileAOrdered)), comparableValues(parse(fileAShuffled)));

assert.equal(b.title?.value, 'Data Analyst (Sage Experience)');
assert.equal(b.company?.value, 'US Mobile');
assert.equal(b.jobFamily?.value, 'Data, AI & Analytics');
assert.equal(b.type?.value, 'full-time');
assert.equal(b.jobType?.value, 'Private');
assert.equal(b.countryCode?.value, 'PK');
assert.equal(b.region?.value, 'Sindh');
assert.equal(b.city?.value, 'Karachi');
assert.equal(b.workMode?.value, 'on_site');
assert.equal(b.experience?.value, '1+ year of experience in a Data Analyst or similar role');
assert.equal(b.sourceUrl?.value.startsWith('https://jobs.lever.co/USMobile/'), true);
assert.equal(b.sourceWebsite?.value, 'US Mobile Careers (Lever)');
assert.equal(b.externalId?.value === 'usm-123' || b.externalId?.value === 'dc8f50eb-4edd-4fff-95e2-cd49485bd3e0', true);
assert.deepEqual(b.skillsRequired?.value, skills);
assert.equal(b.seoTitle?.value, 'Data Analyst (Sage Experience) at US Mobile Karachi | STRIDETO');
assert.equal(b.metaDescription?.value.includes('Data Analyst'), true);
assert.equal(b.slug, undefined);

const blocks = {
  requirements: "Requirements\n- Bachelor's degree.\n- SQL.",
  externalId: 'External job ID / reference id\ndifferent-123',
  company: 'Company\nUS Mobile',
  skills: 'Skills Required\n' + skills.join('\n'),
  city: 'City\nKarachi',
  description: 'Description\nUS Mobile Data Analyst description.',
  apply: 'Apply URL\nhttps://jobs.lever.co/USMobile/apply',
  experience: 'Experience\n1+ year of experience in a Data Analyst or similar role',
  country: 'Country\nPakistan',
  meta: 'Meta Description\nUS Mobile Data Analyst metadata',
  workMode: 'Work Mode\nOn-site',
  category: 'Category\nData & Analytics',
  sourceWebsite: 'Source Website\nUS Mobile Careers (Lever)',
  education: "Education\nBachelor's degree in Data Science",
  title: 'Title\nData Analyst (Sage Experience)',
  region: 'Region\nSindh',
  responsibilities: 'Responsibilities\n- Analyze data.',
  sourceUrl: 'Official Source URL\nhttps://jobs.lever.co/USMobile/source',
  type: 'Employment Type\nFull-time',
  jobType: 'Job Type\nPrivate',
  seoTitle: 'SEO Title\nData Analyst SEO',
};
const normal = [
  'title', 'company', 'category', 'type', 'jobType', 'country', 'region', 'city', 'workMode',
  'experience', 'education', 'apply', 'sourceUrl', 'sourceWebsite', 'externalId', 'description',
  'responsibilities', 'requirements', 'skills', 'seoTitle', 'meta',
].map((key) => blocks[key]).join('\n\n');
const shuffled = [
  'requirements', 'externalId', 'company', 'skills', 'city', 'description', 'apply', 'experience',
  'country', 'meta', 'workMode', 'category', 'sourceWebsite', 'education', 'title', 'region',
  'responsibilities', 'sourceUrl', 'type', 'jobType', 'seoTitle',
].map((key) => blocks[key]).join('\n\n');
const normalValues = Object.fromEntries(Object.entries(parse(normal)).map(([key, value]) => [key, value.value]));
const shuffledValues = Object.fromEntries(Object.entries(parse(shuffled)).map(([key, value]) => [key, value.value]));
assert.deepEqual(normalValues, shuffledValues);

const initial = form();
let current = apply(form(), a, initial);
assert.equal(current.title, 'AI Agent Engineer (Remote, Full-Time)');
assert.equal(current.company, 'Smart Working Solutions');

current = apply(current, b, initial);
assert.equal(current.title, 'Data Analyst (Sage Experience)');
assert.equal(current.company, 'US Mobile');
assert.equal(current.category, 'Data, AI & Analytics');
assert.equal(current.workMode, 'on_site');
assert.equal(current.region, 'Sindh');
assert.equal(current.city, 'Karachi');
assert.deepEqual(current.skillsRequired.split(', '), skills);
assert.equal(current.salaryRange, '');
assert.equal(current.applyEmail, '');

const blankPreservationForm = {
  ...form(),
  salaryRange: 'USD 100,000',
  salaryCurrency: 'USD',
  deadline: '2026-12-01',
  openingsCount: '2',
  applyEmail: 'old@example.com',
  logoUrl: 'https://example.com/old-logo.png',
  status: 'active',
  approvalStatus: 'approved',
  urgent: true,
  isFeatured: true,
  slug: 'existing-job-slug',
};
const blankPreserved = apply(blankPreservationForm, b, initial);
assert.equal(blankPreserved.salaryRange, 'USD 100,000');
assert.equal(blankPreserved.salaryCurrency, 'USD');
assert.equal(blankPreserved.deadline, '2026-12-01');
assert.equal(blankPreserved.openingsCount, '2');
assert.equal(blankPreserved.applyEmail, 'old@example.com');
assert.equal(blankPreserved.logoUrl, 'https://example.com/old-logo.png');
assert.equal(blankPreserved.status, 'active');
assert.equal(blankPreserved.approvalStatus, 'approved');
assert.equal(blankPreserved.urgent, true);
assert.equal(blankPreserved.isFeatured, true);
assert.equal(blankPreserved.slug, 'existing-job-slug');

current = apply(current, a, initial);
assert.equal(current.title, 'AI Agent Engineer (Remote, Full-Time)');
assert.equal(current.company, 'Smart Working Solutions');
assert.equal(current.category, 'Engineering');
assert.equal(current.workMode, 'remote');
assert.equal(current.status, 'draft');
assert.equal(current.approvalStatus, 'pending');
assert.equal(current.urgent, false);
assert.equal(current.isFeatured, false);
assert.equal(current.slug, '');

// Eligibility and review safety: replaceSupported never bypasses the parser's
// rejected/review contract. Explicit conflict approval remains the only path
// that applies a review item to a populated field.
const populated = { ...form(), title: 'Existing title' };
const acceptedTitle = {
  value: 'Current document title',
  status: 'accepted',
  confidence: 'high',
};
const rejectedTitle = { ...acceptedTitle, status: 'rejected' };
const reviewTitle = { ...acceptedTitle, status: 'review' };

const rejectedResult = applyJobDocumentSuggestions(populated, { title: rejectedTitle }, {
  fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
  formDefaults: ADMIN_FORM_DEFAULTS,
  onlyEmpty: true,
  replaceSupported: true,
}).form;
assert.equal(rejectedResult.title, 'Existing title');

const reviewResult = applyJobDocumentSuggestions(populated, { title: reviewTitle }, {
  fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
  formDefaults: ADMIN_FORM_DEFAULTS,
  onlyEmpty: true,
  replaceSupported: true,
}).form;
assert.equal(reviewResult.title, 'Existing title');

const detectedConflicts = buildSuggestionConflicts(populated, { title: reviewTitle }, {
  fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
  formDefaults: ADMIN_FORM_DEFAULTS,
});
assert.deepEqual(detectedConflicts.map((conflict) => conflict.field), ['title']);

const approvedConflictResult = applyJobDocumentSuggestions(populated, { title: reviewTitle }, {
  fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
  formDefaults: ADMIN_FORM_DEFAULTS,
  onlyEmpty: false,
  replaceSupported: false,
}).form;
assert.equal(approvedConflictResult.title, 'Current document title');

const absentResult = applyJobDocumentSuggestions(populated, {}, {
  fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
  formDefaults: ADMIN_FORM_DEFAULTS,
  onlyEmpty: true,
  replaceSupported: true,
}).form;
assert.equal(absentResult.title, 'Existing title');

console.log('JOB-AUTOFILL-GENERALIZATION: real-doc aliases, order independence, and A-B-A replacement passed');
