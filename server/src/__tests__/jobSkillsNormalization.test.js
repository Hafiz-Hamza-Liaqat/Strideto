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
