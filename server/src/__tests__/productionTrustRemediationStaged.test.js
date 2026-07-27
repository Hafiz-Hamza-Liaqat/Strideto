/**
 * Staged remediation policy tests (no committed production ObjectIds).
 * Run: node src/__tests__/productionTrustRemediationStaged.test.js
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  applyManifestEntries,
  buildRollbackManifest,
  buildRollbackOperations,
  assertManifestDisjoint,
} from '../data/remediation/productionTrustRemediationStaged.js';
import { buildTargetManifestsFromDatasets } from '../data/remediation/productionTrustManifestBuilder.js';
import { SAFE_NOW_CANDIDATE_HINTS } from '../data/remediation/productionTrustSafeNow.js';
import {
  evaluateTrustedContentGate,
  buildTrustAuditReport,
} from '../data/opportunityTrustRemediation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const now = new Date('2026-07-27T00:00:00.000Z');
const future = new Date('2026-09-01T00:00:00.000Z');

const datasets = {
  jobs: [
    {
      _id: 'job-invalid',
      status: 'active',
      title: 'QA Import Test Job',
      slug: 'qa-import-test-job-punjab',
      company: 'Test',
      province: 'Punjab',
      deadline: future,
    },
    {
      _id: 'job-launch',
      externalId: 'launch-v1-job-1',
      status: 'active',
      title: 'Launch Synthetic Job',
      company: 'Demo Org',
      applicationLink: 'https://example.gov.pk/post',
      deadline: future,
    },
    {
      _id: 'job-manual',
      status: 'active',
      title: 'Private Internal Role',
      company: 'Private Org',
      province: 'Sindh',
      deadline: future,
    },
  ],
  scholarships: [],
  admissions: [],
  internships: [],
  intlScholarships: [],
};

const built = buildTargetManifestsFromDatasets(datasets, now);
assert.strictEqual(built.safeNow.length, 1);
assert.strictEqual(built.deferred.length, 1);
assert.strictEqual(built.manualReview.length, 1);
assertManifestDisjoint(built.safeNow, built.deferred, built.manualReview);

assert.ok(SAFE_NOW_CANDIDATE_HINTS.jobs.length >= 1);
assert.ok(!fs.readFileSync(path.join(__dirname, '../data/remediation/productionTrustSafeNow.js'), 'utf8').includes('6a4fe795'));

const rollback = buildRollbackManifest(built.safeNow.slice(0, 1), '2026-07-27T12:00:00.000Z');
assert.strictEqual(rollback[0].originalStatus, 'active');
const ops = buildRollbackOperations(rollback);
assert.deepStrictEqual(ops[0].filter.status, 'draft');

let updates = [];
const modelStub = () => ({
  updateOne: async (filter, update) => {
    updates.push({ filter, update });
    return { modifiedCount: 1 };
  },
});
await applyManifestEntries({ Job: modelStub() }, built.safeNow, { strict: true });
assert.strictEqual(updates.length, 1);
assert.ok(updates[0].filter._id);

const sparseAudit = buildTrustAuditReport({
  jobs: [{
    _id: 'j1',
    status: 'active',
    title: 'Verified Role',
    company: 'Gov',
    sourceUrl: 'https://example.gov.pk/j',
    applicationLink: 'https://example.gov.pk/j/apply',
    deadline: future,
  }],
  scholarships: [],
  admissions: [],
  internships: [],
  intlScholarships: [],
}, now);
assert.strictEqual(evaluateTrustedContentGate(sparseAudit.classified).passed, false);

const script = fs.readFileSync(path.join(__dirname, '../scripts/remediateProductionOpportunityTrust.js'), 'utf8');
assert.ok(!script.includes('deleteMany'));
assert.ok(!script.includes('updateMany'));
assert.ok(!script.includes('console.log(process.env.MONGO_URI'));
assert.ok(script.includes('--dry-run-target-safe'));
assert.ok(script.includes('--apply-target-safe'));

console.log('productionTrustRemediationStaged tests passed.');
