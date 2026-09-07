import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const read = (relative) => readFileSync(path.join(clientSrc, relative), 'utf8');

const nav = read('components/layout/navConfig.js');
const jobs = read('pages/Jobs/Jobs.jsx');
const routes = read('routes/index.jsx');
const jobController = read(path.join('..', '..', 'server', 'src', 'controllers', 'jobsController.js'));

assert.match(nav, /labelKey: 'navbar:jobs', path: '\/jobs'/);
assert.match(nav, /labelKey: 'navbar:scholarshipsAndFunding'/);
assert.match(nav, /labelKey: 'navbar:admissionsAndIntakes'/);
assert.match(nav, /labelKey: 'navbar:services'/);
assert.doesNotMatch(nav, /labelKey: 'navbar:studyAndInstitutions'/);
assert.doesNotMatch(nav, /labelKey: 'navbar:testsAndPrep'/);
assert.doesNotMatch(nav, /labelKey: 'navbar:internships'/);

assert.match(jobs, /data-testid="jobs-opportunity-type-selector"/);
assert.match(jobs, /data-testid="jobs-opportunity-all"/);
assert.match(jobs, /data-testid="jobs-opportunity-internships"/);
assert.match(jobs, /setFilters\(\{ type: value \|\| undefined \}\)/);
assert.match(jobs, /nextSearch\.set\('type', value\)/);
assert.match(jobs, /value="deadline"|SORT_OPTIONS\.jobs/);
assert.doesNotMatch(jobs, /SORT_OPTIONS\.jobs[\s\S]{0,500}internship/);

assert.match(jobController, /if \(q\.type && \['full-time', 'part-time', 'contract', 'internship'\]/);
assert.match(routes, /Internship|internships/);

console.log('jobsNavigationMerge.test.js: navigation, selector, API filter, sort, and route assertions passed');
