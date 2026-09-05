import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { isSafeInternalReturnPath, publicHttpUrlOrNull } from '../../../shared/publicDiscovery/safePublicUrl.js';

const read = (file) => fs.readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
const gate = read('client/src/components/public/ProtectedExternalApplicationLink.jsx');

const pages = {
  jobs: read('client/src/pages/Jobs/JobDetail.jsx'),
  scholarships: read('client/src/pages/Scholarships/ScholarshipDetail.jsx'),
  admissions: read('client/src/pages/Admissions/AdmissionDetail.jsx'),
  intlScholarships: read('client/src/pages/IntlScholarships/IntlScholarshipDetail.jsx'),
  internships: read('client/src/pages/Internships/InternshipDetail.jsx'),
  programs: read('client/src/pages/Tests/ProgramExplorer.jsx'),
};

test('EAG-01 anonymous external application renders an internal Login link', () => {
  assert.match(gate, /if \(!isAuthenticated\)/);
  assert.match(gate, /<Link to=\{ROUTES\.LOGIN\} state=\{returnState\}/);
  const anonymousBranch = gate.slice(gate.indexOf('if (!isAuthenticated)'), gate.indexOf("const isEmail"));
  assert.doesNotMatch(anonymousBranch, /href=\{destination\}/);
});

test('EAG-02 authenticated external application is the only branch that opens and tracks destination', () => {
  assert.match(gate, /<a[\s\S]*href=\{destination\}/);
  assert.match(gate, /trackApplicationClick\(\{ entityType, entityId, destinationType \}\)/);
  assert.match(gate, /const isEmail = destinationType === 'email'/);
});

test('EAG-03 all public opportunity application CTAs use the shared gate', () => {
  for (const [type, source] of Object.entries(pages)) {
    assert.match(source, /ProtectedExternalApplicationLink/, `${type} imports shared application gate`);
  }
  assert.doesNotMatch(pages.jobs, /href=\{applicationLink\}/);
  assert.doesNotMatch(pages.scholarships, /href=\{officialLink\}/);
  assert.doesNotMatch(pages.admissions, /href=\{officialLink\}/);
  assert.doesNotMatch(pages.intlScholarships, /href=\{officialLink\}/);
  assert.doesNotMatch(pages.internships, /href=\{applicationLink\}/);
  assert.doesNotMatch(pages.programs, /href=\{applyUrl\}/);
});

test('EAG-04 Jobs email applications use the same gate and remain email destinations', () => {
  assert.match(pages.jobs, /destination=\{`mailto:\$\{applyEmail\}`\}/);
  assert.match(pages.jobs, /destinationType="email"/);
  assert.match(gate, /target=\{isEmail \? undefined : target\}/);
});

test('EAG-05 the gate preserves validated opportunity return paths and rejects unsafe redirects', () => {
  assert.match(gate, /loginLocationState\(location\)/);
  assert.equal(isSafeInternalReturnPath('/jobs/example-job'), true);
  for (const value of ['https://evil.example', '//evil.example', 'javascript:alert(1)', 'data:text/html,x']) {
    assert.equal(isSafeInternalReturnPath(value), false);
  }
});

test('EAG-06 authenticated return never auto-opens a destination or creates an application', () => {
  assert.doesNotMatch(gate, /window\.open|location\.href|applicationsApi|createApplication/);
  assert.match(gate, /onClick=\{\(\) => trackApplicationClick/);
});

test('EAG-07 existing URL safety remains intact for external destinations', () => {
  assert.equal(publicHttpUrlOrNull('https://example.com/apply'), 'https://example.com/apply');
  assert.equal(publicHttpUrlOrNull('javascript:alert(1)'), null);
  assert.equal(publicHttpUrlOrNull('data:text/html,x'), null);
});

test('EAG-08 internal application and Save flows remain separate from outbound gate', () => {
  assert.match(pages.jobs, /handleInternalApply/);
  assert.match(pages.scholarships, /SaveButton/);
  assert.match(pages.admissions, /SaveButton/);
  assert.match(pages.internships, /SaveButton/);
});
