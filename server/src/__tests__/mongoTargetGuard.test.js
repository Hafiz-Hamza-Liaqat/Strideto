/**
 * Mongo target guard and target-manifest safety tests.
 * Run: node src/__tests__/mongoTargetGuard.test.js
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  resolveMongoTarget,
  assertProductionMutationTarget,
  isLocalHostname,
  publicMongoTargetSummary,
} from '../utils/mongoTargetGuard.js';
import {
  writeTargetManifests,
  loadSafeNowManifest,
  assertManifestNotStale,
  TARGETS_ROOT,
} from '../data/remediation/targetManifestStore.js';
import { TARGET_MANIFEST_MAX_AGE_MS } from '../data/remediation/productionTrustSafeNow.js';
import {
  applyManifestEntries,
  buildRollbackManifest,
} from '../data/remediation/productionTrustRemediationStaged.js';
import { SAFE_NOW_CANDIDATE_HINTS } from '../data/remediation/productionTrustSafeNow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

assert.strictEqual(isLocalHostname('127.0.0.1'), true);
assert.strictEqual(isLocalHostname('localhost'), true);
assert.strictEqual(isLocalHostname('cluster0.example.mongodb.net'), false);

const localUri = 'mongodb://127.0.0.1:27017/edurozgaar';
process.env.MONGO_URI = localUri;
const localTarget = resolveMongoTarget(localUri);
assert.strictEqual(localTarget.isLocalDevelopmentTarget, true);
assert.ok(localTarget.fingerprintSha256);

assert.throws(
  () => assertProductionMutationTarget({ expectedFingerprint: localTarget.fingerprintSha256, allowLocal: false }),
  (e) => e.code === 'MONGO_TARGET_LOCAL_FORBIDDEN'
);

const remoteUri = 'mongodb+srv://user:secret@cluster0.example.mongodb.net/strideto_prod?retryWrites=true';
process.env.MONGO_URI = remoteUri;
const remoteTarget = resolveMongoTarget(remoteUri);
assert.strictEqual(remoteTarget.isLocalDevelopmentTarget, false);

assert.throws(
  () => assertProductionMutationTarget({ expectedFingerprint: null, allowLocal: false }),
  (e) => e.code === 'MONGO_TARGET_FINGERPRINT_REQUIRED'
);

assert.throws(
  () => assertProductionMutationTarget({ expectedFingerprint: 'deadbeef', allowLocal: false }),
  (e) => e.code === 'MONGO_TARGET_FINGERPRINT_MISMATCH'
);

const summaryText = JSON.stringify(publicMongoTargetSummary(remoteTarget));
assert.ok(!summaryText.includes('secret'));
assert.ok(!summaryText.includes('user:'));

assert.ok(!JSON.stringify(SAFE_NOW_CANDIDATE_HINTS).match(/^[a-f0-9]{24}$/m));

const fp = 'a'.repeat(64);
const sampleSafe = [{
  _id: '507f1f77bcf86cd799439011',
  collection: 'jobs',
  originalStatus: 'active',
  proposedStatus: 'draft',
  reason: 'test',
  slug: 'x',
  title: 'X',
  contentFingerprint: 'jobs|active|x||X|',
}];
const { summary } = writeTargetManifests(fp, { safeNow: sampleSafe, deferred: [], manualReview: [] });
const loaded = loadSafeNowManifest(fp);
assert.strictEqual(loaded.entries.length, 1);
assert.strictEqual(loaded.summary.fingerprintSha256, fp);

summary.generatedAt = new Date(Date.now() - TARGET_MANIFEST_MAX_AGE_MS - 1000).toISOString();
const summaryPath = path.join(TARGETS_ROOT, fp, 'target-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary));
assert.throws(() => assertManifestNotStale(summary), (e) => e.code === 'TARGET_MANIFEST_STALE');

buildRollbackManifest(sampleSafe);
const applied = await applyManifestEntries(
  { Job: { updateOne: async () => ({ modifiedCount: 1 }) } },
  sampleSafe,
  { strict: true }
);
assert.strictEqual(applied.drafted, 1);

const strictFail = await applyManifestEntries(
  { Job: { updateOne: async () => ({ modifiedCount: 0 }) } },
  sampleSafe,
  { strict: true }
);
assert.strictEqual(strictFail.failures.length, 1);

const script = fs.readFileSync(path.join(__dirname, '../scripts/remediateProductionOpportunityTrust.js'), 'utf8');
assert.ok(!script.includes('PRODUCTION_TRUST_SAFE_NOW'));
assert.ok(script.includes('--audit-target'));

fs.rmSync(path.join(TARGETS_ROOT, fp), { recursive: true, force: true });

console.log('mongoTargetGuard tests passed.');
