import assert from 'node:assert/strict';
import fs from 'node:fs';

const detail = fs.readFileSync(new URL('../pages/Tests/TestDetail.jsx', import.meta.url), 'utf8');
const compare = fs.readFileSync(new URL('../pages/Tests/TestCompare.jsx', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../routes/index.jsx', import.meta.url), 'utf8');

assert.match(detail, /Preparation Steps/);
assert.match(detail, /Section strategy/);
assert.match(detail, /baseline, target score, available study time/);
assert.match(detail, /No verified preparation resource/);
assert.match(detail, /registrationGuidance/);
assert.match(compare, /testsApi\.compare/);
assert.match(compare, /English proficiency/);
assert.match(compare, /Graduate admissions/);
assert.match(compare, /not a worldwide acceptance census/);
assert.doesNotMatch(compare, /easiest|best test|guarantee|admission probability|scholarship/i);
assert.match(compare, /overflow-x-auto/);
assert.match(compare, /scope="col"/);
assert.match(routes, /path: ROUTES\.TEST_COMPARE/);
assert.ok(routes.indexOf('path: ROUTES.TEST_COMPARE') < routes.indexOf('ROUTES.TEST_HUB}/:slug'), 'comparison route precedes the dynamic Test detail route');

console.log('p7eTestGuidance: preparation, comparison, safety and accessibility contracts passed');
