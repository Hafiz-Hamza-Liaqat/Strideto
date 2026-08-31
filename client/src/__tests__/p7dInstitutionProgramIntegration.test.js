/** MKT-P7-D Institution/Program TestAcceptance integration contracts. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK } from '../../../server/src/seed/internationalTestAcceptances.js';
import { mergeProgramAcceptanceWithInstitutionFallback } from '../../../shared/education/acceptanceExplorer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..', '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const program = read('client/src/pages/Tests/ProgramExplorer.jsx');
const institution = read('client/src/pages/Education/InstitutionExplorer.jsx');
const testDetail = read('client/src/pages/Tests/TestDetail.jsx');
const controller = read('server/src/controllers/education/testAcceptanceController.js');

const trinityClaims = INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.filter((claim) => claim.institutionSlug === 'trinity-college-dublin');
const resolved = mergeProgramAcceptanceWithInstitutionFallback(
  trinityClaims.filter((claim) => claim.programSlug === 'trinity-college-dublin-computer-science-data-science' && claim.testSlug === 'ielts').map((claim) => ({ ...claim, testId: claim.testSlug })),
  trinityClaims.filter((claim) => !claim.programSlug).map((claim) => ({ ...claim, testId: claim.testSlug })),
);

assert.equal(resolved.programClaims.filter((claim) => claim.testId === 'ielts').length, 1);
assert.equal(resolved.institutionFallback.some((claim) => claim.testId === 'ielts'), false);
assert.equal(resolved.institutionFallback.some((claim) => claim.testId === 'toefl-ibt'), true);
assert.match(program, /institution-level guidance/i);
assert.match(program, /Program-specific requirement/);
assert.match(program, /No verified test requirement is currently available/);
assert.match(program, /Test requirements could not be loaded/);
assert.match(program, /testId\.slug/);
assert.match(program, /View official requirement/);
assert.match(institution, /Test requirements could not be loaded/);
assert.match(institution, /No verified test requirement is currently available/);
assert.match(institution, /Institution-level guidance/);
assert.match(testDetail, /Program-specific requirement/);
assert.match(testDetail, /testScoreScale/);
assert.match(testDetail, /claim\.sources\[0\]\.sourceUrl/);
assert.match(controller, /getProgramAcceptance/);
assert.match(controller, /mergeProgramAcceptanceWithInstitutionFallback/);
assert.equal(INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.length, 35);
assert.equal(INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.filter((claim) => claim.scholarship || claim.funding).length, 0);

console.log('p7dInstitutionProgramIntegration: 17 checks passed');
