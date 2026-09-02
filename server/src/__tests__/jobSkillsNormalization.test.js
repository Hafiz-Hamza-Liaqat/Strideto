import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeJobSkills } from '../../../shared/jobs/jobSkills.js';
import { extractJobFieldsFromText } from '../../../shared/jobs/jobDocumentExtraction.js';

const expected = ['React', 'Next.js', 'TypeScript'];
const inputs = [
  expected,
  'React\nNext.js\nTypeScript',
  'React, Next.js, TypeScript',
  'React; Next.js; TypeScript',
  '- React\n- Next.js\n- TypeScript',
  'React\n\nNext.js; TypeScript',
  '  React  ,  Next.js;\n- TypeScript  ',
];

for (const input of inputs) {
  assert.deepEqual(normalizeJobSkills(input), expected);
  assert.deepEqual(normalizeJobSkills(normalizeJobSkills(input)), expected);
}

assert.deepEqual(normalizeJobSkills(['React', ' react ', '', null]), ['React']);
assert.deepEqual(normalizeJobSkills('React, Next.js, TypeScript, JavaScript'), [
  'React', 'Next.js', 'TypeScript', 'JavaScript',
]);
assert.deepEqual(normalizeJobSkills(['React, Next.js, TypeScript']), expected);
assert.deepEqual(normalizeJobSkills('React; Next.js; TypeScript'), expected);
assert.deepEqual(normalizeJobSkills('React\nNext.js\nTypeScript'), expected);
assert.deepEqual(normalizeJobSkills(
  'B2B Sales, Mid-Market Sales, Full-Cycle Sales, New Business Acquisition, F&B Sales, Business Development, Sales Pipeline Management, CRM, Prospecting, LinkedIn Outreach, Negotiation, Stakeholder Management, C-Level Engagement, Account Executive, Commercial Sales, Forecasting, Customer Acquisition, Problem Solving, English Communication, Nice to Have, Background in the F&B industry, particularly with POS systems or online-ordering platforms., Existing customer network or relationships within the UAE F&B or technology industry., Native proficiency in Arabic.'
), [
  'B2B Sales', 'Mid-Market Sales', 'Full-Cycle Sales', 'New Business Acquisition',
  'F&B Sales', 'Business Development', 'Sales Pipeline Management', 'CRM',
  'Prospecting', 'LinkedIn Outreach', 'Negotiation', 'Stakeholder Management',
  'C-Level Engagement', 'Account Executive', 'Commercial Sales', 'Forecasting',
  'Customer Acquisition', 'Problem Solving', 'English Communication',
]);
assert.deepEqual(normalizeJobSkills(
  'Food Systems, Agriculture, Climate Resilience, Behavioral Science, Qualitative Research, In-Depth Interviews, Focus Group Discussions, Thematic Analysis, Ethnographic Research, Mixed-Methods Research, Research Design, Client Advisory, Project Management, People Management, Stakeholder Management, Proposal Development, Business Development, Data Synthesis, Technical Writing, English Communication, Field Research, Smallholder Agriculture, Climate Adaptation, Strongly Preferred, Experience applying behavioral science to agricultural extension..., Application Timing, Applications are reviewed on a rolling basis...'
), [
  'Food Systems', 'Agriculture', 'Climate Resilience', 'Behavioral Science',
  'Qualitative Research', 'In-Depth Interviews', 'Focus Group Discussions',
  'Thematic Analysis', 'Ethnographic Research', 'Mixed-Methods Research',
  'Research Design', 'Client Advisory', 'Project Management', 'People Management',
  'Stakeholder Management', 'Proposal Development', 'Business Development',
  'Data Synthesis', 'Technical Writing', 'English Communication', 'Field Research',
  'Smallholder Agriculture', 'Climate Adaptation',
]);
assert.deepEqual(normalizeJobSkills('Project Management, Business Development, Data Analysis'), [
  'Project Management', 'Business Development', 'Data Analysis',
]);
assert.deepEqual(
  normalizeJobSkills('Experience applying data science to agricultural extension, climate adaptation and food value chains.'),
  ['Experience applying data science to agricultural extension, climate adaptation and food value chains.'],
);

const leakageText = [
  'Skills Required',
  'Food Systems',
  'Agriculture',
  'Climate Resilience',
  'Behavioral Science',
  'Qualitative Research',
  '',
  'Strongly Preferred',
  'Experience applying behavioral science to agricultural extension, climate adaptation or food value chains.',
  '',
  'Application Timing',
  'Applications are reviewed on a rolling basis until the position is filled.',
].join('\n');
const skills = extractJobFieldsFromText(leakageText, { mode: 'admin' }).suggestions.skillsRequired.value;
assert.deepEqual(skills, [
  'Food Systems',
  'Agriculture',
  'Climate Resilience',
  'Behavioral Science',
  'Qualitative Research',
]);

const adminJobs = fs.readFileSync(new URL('../../../client/src/pages/Admin/AdminContentJobs.jsx', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../../../client/src/pages/Jobs/JobDetail.jsx', import.meta.url), 'utf8');
assert.match(adminJobs, /normalizeJobSkills\(job\.skillsRequired\)\.join\('\\n'\)/);
assert.match(adminJobs, /skillsRequired: normalizeJobSkills\(form\.skillsRequired\)/);
assert.match(detail, /normalizeJobSkills\(job\.skillsRequired\)/);

console.log('JOB-SKILLS: normalization, legacy compatibility, public rendering input, and section boundary passed');
