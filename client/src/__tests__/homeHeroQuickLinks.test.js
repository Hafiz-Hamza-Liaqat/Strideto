import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/home/HomeHeroVisual.jsx', import.meta.url), 'utf8');

assert.match(source, /import \{ Link \} from 'react-router-dom'/, 'HOME-LINK-05: cards use semantic React Router links');
assert.match(source, /route: ROUTES\.JOBS/, 'HOME-LINK-01: Jobs card uses /jobs');
assert.match(source, /route: ROUTES\.INTERNSHIPS/, 'HOME-LINK-02: Internships card uses /internships');
assert.match(source, /route: ROUTES\.SCHOLARSHIPS/, 'HOME-LINK-03: Scholarships card uses /scholarships');
assert.match(source, /to=\{ROUTES\.FOR_EMPLOYERS\}/, 'HOME-LINK-04: Employer card uses /employers');
assert.match(source, /focus-visible:outline/, 'HOME-LINK-06: cards expose visible keyboard focus styling');
assert.match(source, /aria-hidden="true"/, 'HOME-LINK-07: decorative layers remain aria-hidden');
assert.match(source, /grid grid-cols-2 gap-3 sm:gap-4/, 'HOME-LINK-08: hero grid layout remains unchanged');
assert.match(source, /overflow-hidden rounded-2xl border border-white\/20 bg-white\/10 p-4 sm:p-5 backdrop-blur-sm/, 'HOME-LINK-08: category card visual classes remain unchanged');
assert.match(source, /col-span-2 cursor-pointer overflow-hidden rounded-2xl border border-white\/25 bg-white\/12 p-4 sm:p-5 backdrop-blur-sm/, 'HOME-LINK-08: employer card visual classes remain unchanged');
assert.doesNotMatch(source, /<Link[\s\S]*<button|<Link[\s\S]*<a\s/, 'HOME-LINK-05: no nested interactive control is introduced');

console.log('homeHeroQuickLinks.test.js: 11 checks passed');
