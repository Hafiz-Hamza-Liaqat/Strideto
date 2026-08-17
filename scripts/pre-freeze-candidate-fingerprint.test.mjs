import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACCEPTANCE_CONTRACT_VERSION, ARTIFACT_ROOT, candidateFingerprint, createRun, manifestFingerprint, openRun,
} from './lib/acceptanceLedger.mjs';

const themes = [
  { id: 'explicit-light', preference: 'light', media: 'light' },
  { id: 'explicit-dark', preference: 'dark', media: 'dark' },
  { id: 'system-light', preference: 'system', media: 'light' },
  { id: 'system-dark', preference: 'system', media: 'dark' },
];
const widths = [320, 375, 768, 1024, 1440];
const manifest = {
  sourceRouteRecords: 1,
  counts: { FULL_MATRIX_UI: 1, PARAMETRIC_UI: 0, REDIRECT_ONLY: 0, SHELL_EQUIVALENT_ALIAS: 0, NON_LAUNCH_INTERNAL: 0 },
  renderedPersonaRouteCombinations: 1,
  plannedVisualCells: 20,
  redirectContractCells: 0,
  routes: [{ id: 'qa:route', persona: 'anonymous', routePattern: '/agents', classification: 'FULL_MATRIX_UI', canonicalUrl: '/agents' }],
};
const headA = 'a'.repeat(40);
const headB = 'b'.repeat(40);
const args = (head, nextManifest = manifest, nextThemes = themes, nextWidths = widths) => ({ head, manifest: nextManifest, themes: nextThemes, widths: nextWidths, runnerVersion: 'candidate-test', acceptanceContractVersion: ACCEPTANCE_CONTRACT_VERSION });
const runIds = [`candidate-test-${process.pid}-${Date.now()}`];

try {
  const mf = manifestFingerprint(manifest);
  assert.equal(mf, manifestFingerprint(structuredClone(manifest)), 'manifest fingerprint is stable');
  const a = candidateFingerprint(args(headA));
  const b = candidateFingerprint(args(headB));
  assert.notEqual(a, b, 'HEAD must bind candidate fingerprint');
  assert.equal(a, candidateFingerprint(args(headA)), 'same candidate must be stable');
  const changedManifest = { ...manifest, plannedVisualCells: 21 };
  assert.notEqual(a, candidateFingerprint(args(headA, changedManifest)), 'manifest change must bind candidate');
  assert.notEqual(a, candidateFingerprint(args(headA, manifest, themes.slice(0, 3))), 'theme contract change must bind candidate');
  assert.notEqual(a, candidateFingerprint(args(headA, manifest, themes, [...widths, 1600])), 'width contract change must bind candidate');

  const runId = runIds[0];
  const run = createRun({ runId, head: headA, manifest, runnerVersion: 'candidate-test', themes, widths });
  const metadata = JSON.parse(fs.readFileSync(path.join(run.dir, 'run.json'), 'utf8'));
  assert.equal(metadata.head, headA);
  assert.equal(metadata.manifestFingerprint, mf);
  assert.equal(metadata.candidateFingerprint, a);
  assert.deepEqual(metadata.themeContract, themes);
  assert.deepEqual(metadata.widthContract, widths);
  assert.doesNotThrow(() => openRun(runId, { head: headA, manifest, themes, widths, runnerVersion: 'candidate-test', forResume: true }));
  assert.throws(() => openRun(runId, { head: headB, manifest, themes, widths, runnerVersion: 'candidate-test', forResume: true }), /RUN FINGERPRINT MISMATCH/);
  assert.throws(() => openRun(runId, { head: headA, manifest: changedManifest, themes, widths, runnerVersion: 'candidate-test', forResume: true }), /RUN FINGERPRINT MISMATCH/);
  assert.throws(() => openRun(runId, { head: headA, manifest, themes: themes.slice(0, 3), widths, runnerVersion: 'candidate-test', forResume: true }), /RUN FINGERPRINT MISMATCH/);
  assert.throws(() => openRun('canonical-a50-full-1', { head: headA, manifest, themes, widths, forResume: true }), /LEGACY RUN FINGERPRINT SCHEMA/);
  assert.throws(() => openRun('canonical-15b2b394-full-1', { head: headA, manifest, themes, widths, forResume: true }), /LEGACY RUN FINGERPRINT SCHEMA/);
  console.log(JSON.stringify({ manifestFingerprint: mf, candidateA: a, candidateB: b, sameManifestDifferentHead: 'PASS', stability: 'PASS', manifestChange: 'PASS', contractChange: 'PASS', resumePositive: 'PASS', resumeHeadMismatch: 'REFUSED', resumeManifestMismatch: 'REFUSED', resumeContractMismatch: 'REFUSED', historicalResume1: 'REFUSED', historicalResume2: 'REFUSED' }));
} finally {
  for (const runId of runIds) { const dir = path.join(ARTIFACT_ROOT, runId); if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); }
}
