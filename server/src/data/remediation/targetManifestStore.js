import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TARGET_MANIFEST_MAX_AGE_MS, DRY_RUN_VALIDITY_MS } from './productionTrustSafeNow.js';
import { summarizeManifestEntries } from './productionTrustManifestBuilder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TARGETS_ROOT = path.join(__dirname, '../../../.remediation-targets');

export function targetDirForFingerprint(fingerprintSha256) {
  if (!fingerprintSha256 || typeof fingerprintSha256 !== 'string') {
    throw new Error('target_manifest: fingerprint required');
  }
  return path.join(TARGETS_ROOT, fingerprintSha256);
}

export function writeTargetManifests(fingerprintSha256, payload) {
  const dir = targetDirForFingerprint(fingerprintSha256);
  fs.mkdirSync(dir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const summary = {
    fingerprintSha256,
    generatedAt,
    safeNow: summarizeManifestEntries(payload.safeNow),
    deferred: summarizeManifestEntries(payload.deferred),
    manualReview: {
      total: payload.manualReview.length,
      byCollection: payload.manualReview.reduce((acc, row) => {
        acc[row.collection] = (acc[row.collection] || 0) + 1;
        return acc;
      }, {}),
    },
    lastDryRunAt: null,
  };
  fs.writeFileSync(path.join(dir, 'safe-now.json'), JSON.stringify(payload.safeNow, null, 2));
  fs.writeFileSync(path.join(dir, 'deferred.json'), JSON.stringify(payload.deferred, null, 2));
  fs.writeFileSync(path.join(dir, 'manual-review.json'), JSON.stringify(payload.manualReview, null, 2));
  fs.writeFileSync(path.join(dir, 'target-summary.json'), JSON.stringify(summary, null, 2));
  return { dir, summary };
}

export function loadTargetSummary(fingerprintSha256) {
  const filePath = path.join(targetDirForFingerprint(fingerprintSha256), 'target-summary.json');
  if (!fs.existsSync(filePath)) {
    const err = new Error('target_manifest: target-summary.json not found for fingerprint');
    err.code = 'TARGET_MANIFEST_MISSING';
    throw err;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadSafeNowManifest(fingerprintSha256) {
  const summary = loadTargetSummary(fingerprintSha256);
  if (summary.fingerprintSha256 !== fingerprintSha256) {
    const err = new Error('target_manifest: summary fingerprint mismatch');
    err.code = 'TARGET_MANIFEST_FINGERPRINT_MISMATCH';
    throw err;
  }
  const filePath = path.join(targetDirForFingerprint(fingerprintSha256), 'safe-now.json');
  if (!fs.existsSync(filePath)) {
    const err = new Error('target_manifest: safe-now.json not found');
    err.code = 'TARGET_MANIFEST_MISSING';
    throw err;
  }
  const entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return { summary, entries };
}

export function assertManifestNotStale(summary, maxAgeMs = TARGET_MANIFEST_MAX_AGE_MS) {
  const generatedAt = new Date(summary.generatedAt).getTime();
  if (Number.isNaN(generatedAt)) {
    const err = new Error('target_manifest: invalid generatedAt');
    err.code = 'TARGET_MANIFEST_STALE';
    throw err;
  }
  if (Date.now() - generatedAt > maxAgeMs) {
    const err = new Error('target_manifest: manifest older than allowed window; re-run --audit-target');
    err.code = 'TARGET_MANIFEST_STALE';
    throw err;
  }
}

export function markDryRunCompleted(fingerprintSha256) {
  const summaryPath = path.join(targetDirForFingerprint(fingerprintSha256), 'target-summary.json');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  summary.lastDryRunAt = new Date().toISOString();
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  return summary;
}

export function assertFreshDryRun(summary, maxAgeMs = DRY_RUN_VALIDITY_MS) {
  if (!summary.lastDryRunAt) {
    const err = new Error('target_manifest: run --dry-run-target-safe before apply');
    err.code = 'DRY_RUN_REQUIRED';
    throw err;
  }
  const t = new Date(summary.lastDryRunAt).getTime();
  if (Number.isNaN(t) || Date.now() - t > maxAgeMs) {
    const err = new Error('target_manifest: dry-run stamp expired; re-run --dry-run-target-safe');
    err.code = 'DRY_RUN_EXPIRED';
    throw err;
  }
}
