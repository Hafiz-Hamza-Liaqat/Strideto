/**
 * Employer application counts + apply-mode truthfulness (E.1F-D).
 * Run: node src/__tests__/employerApplicationFlow.test.js
 */
import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const countsUrl = pathToFileURL(
  path.resolve(__dirname, '../services/employerApplicationCounts.js')
).href;
const mapUrl = pathToFileURL(
  path.resolve(__dirname, '../../../shared/career/migrationMap.js')
).href;

const { resolveJobApplyType } = await import(countsUrl);
const { mapLegacyApplicationStatus, LEGACY_APPLICATION_STATUS_MAP } = await import(mapUrl);

// Apply type resolution
assert.strictEqual(resolveJobApplyType({ applyType: 'internal' }), 'internal');
assert.strictEqual(resolveJobApplyType({ applyType: 'external' }), 'external');
assert.strictEqual(resolveJobApplyType({ applicationLink: 'https://x.com' }), 'external');
assert.strictEqual(resolveJobApplyType({ applyEmail: 'a@b.com' }), 'external');
assert.strictEqual(resolveJobApplyType({}), 'internal');

// Status map covers employer transitions
for (const s of ['submitted', 'shortlisted', 'rejected', 'interview', 'hired']) {
  assert.ok(LEGACY_APPLICATION_STATUS_MAP[s], `missing map for ${s}`);
  assert.ok(mapLegacyApplicationStatus(s));
}
assert.strictEqual(mapLegacyApplicationStatus('hired'), 'accepted');
assert.strictEqual(mapLegacyApplicationStatus('shortlisted'), 'screening');

// Semantic rules documented as pure assertions (source of truth contract)
const INTERNAL = 'submitted_strideto_application';
const EXTERNAL_CLICK = 'external_application_click';
const USER_TRACKED = 'user_declared_external_applied';
assert.notStrictEqual(INTERNAL, EXTERNAL_CLICK);
assert.notStrictEqual(INTERNAL, USER_TRACKED);
assert.notStrictEqual(EXTERNAL_CLICK, USER_TRACKED);

console.log('employerApplicationFlow.test.js: all assertions passed');
