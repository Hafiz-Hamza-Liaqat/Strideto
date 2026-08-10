import assert from 'node:assert/strict';
import fs from 'node:fs';

const employer = fs.readFileSync(new URL('../controllers/employerController.js', import.meta.url), 'utf8');
const talent = fs.readFileSync(new URL('../services/career/TalentProfileReadService.js', import.meta.url), 'utf8');
const trending = fs.readFileSync(new URL('../controllers/trendingController.js', import.meta.url), 'utf8');

assert.match(employer, /\.limit\(APPLICATION_LIST_LIMIT\)/);
assert.match(employer, /getCandidateCardsForUsers/);
assert.doesNotMatch(employer.slice(employer.indexOf('export const getJobApplications'), employer.indexOf('export const updateApplicationStatus')), /applications\.map\(async/);
assert.match(talent, /findByUserIds/);
assert.match(talent, /findPrimaryByProfileIds/);
assert.match(trending, /\.limit\(TRENDING_CANDIDATE_LIMIT\)/g);
assert.match(trending, /\.limit\(BOOKMARK_USER_LIMIT\)/);
console.log('targetedQueryScalability.test.js: 7/7 checks passed');
