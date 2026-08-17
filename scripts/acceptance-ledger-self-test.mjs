import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRun, openRun, cellKey, recordResult, reconcile, readLedger } from './lib/acceptanceLedger.mjs';

const themes = [
  { id: 'explicit-light' }, { id: 'explicit-dark' }, { id: 'system-light' }, { id: 'system-dark' },
];
const widths = [320, 1440];
const routes = [
  { id: 'student:/cases/:caseId:PARAMETRIC_UI', persona: 'student', routePattern: '/cases/:caseId', classification: 'PARAMETRIC_UI', canonicalUrl: '/cases/fixture' },
  { id: 'anonymous:/agents:FULL_MATRIX_UI', persona: 'anonymous', routePattern: '/agents', classification: 'FULL_MATRIX_UI', canonicalUrl: '/agents' },
];
const manifest = { sourceRouteRecords: 2, counts: { FULL_MATRIX_UI: 1, PARAMETRIC_UI: 1, REDIRECT_ONLY: 1, SHELL_EQUIVALENT_ALIAS: 0, NON_LAUNCH_INTERNAL: 0 }, routes, plannedVisualCells: routes.length * themes.length * widths.length, redirectContractCells: 1 };
const runId = `durability-self-test-${process.pid}`;
const run = createRun({ head: 'test-head', manifest, runnerVersion: 'self-test', runId });
try {
  const first = { route: routes[0], theme: themes[0], width: 320 };
  const firstKey = cellKey({ persona: first.route.persona, route: first.route, theme: first.theme, width: first.width });
  recordResult(run, { key: firstKey, kind: 'visual', persona: first.route.persona, routeId: first.route.id, theme: first.theme.id, width: first.width, status: 'PASS' });
  recordResult(run, { key: 'synthetic-failure', kind: 'visual', persona: 'student', routeId: 'fixture', theme: 'explicit-light', width: 1440, status: 'FAIL', error: 'synthetic failure' });
  recordResult(run, { key: 'synthetic-incomplete', kind: 'visual', persona: 'student', routeId: 'fixture', theme: 'system-light', width: 320, status: 'INCOMPLETE', error: 'synthetic interruption' });
  const partial = reconcile(run, manifest, themes, widths);
  assert.equal(partial.PASS, 1);
  assert.equal(partial.FAIL, 1);
  assert.equal(partial.INCOMPLETE, 1);
  assert.ok(partial.unseen > 0);
  assert.throws(() => openRun(runId, { head: 'different-head', manifest }), /RUN FINGERPRINT MISMATCH/);
  const changedManifest = { ...manifest, plannedVisualCells: 999 };
  assert.throws(() => openRun(runId, { head: 'test-head', manifest: changedManifest }), /RUN FINGERPRINT MISMATCH/);
  recordResult(run, { key: 'synthetic-duplicate', kind: 'visual', persona: 'anonymous', routeId: 'fixture', theme: 'explicit-dark', width: 320, status: 'PASS' });
  recordResult(run, { key: 'synthetic-duplicate', kind: 'visual', persona: 'anonymous', routeId: 'fixture', theme: 'explicit-dark', width: 320, status: 'PASS' });
  const duplicate = reconcile(run, manifest, themes, widths);
  assert.ok(duplicate.duplicateCellKeys.some((item) => item.key === 'synthetic-duplicate'));
  recordResult(run, { key: 'redirect|legacy', kind: 'redirect', status: 'PASS', sourceRoute: '/legacy', target: '/canonical' });
  const complete = reconcile(run, manifest, themes, widths);
  assert.equal(complete.redirectRecorded, 1);
  assert.equal(readLedger(run).length, 6);
  console.log(JSON.stringify({ interruption: { retained: partial.PASS + partial.FAIL + partial.INCOMPLETE, unseen: partial.unseen }, mismatchRefusal: true, duplicateDetection: duplicate.duplicateCellKeys.length > 0, failedCellPreserved: readLedger(run).some((entry) => entry.status === 'FAIL'), redirectCheckpoint: complete.redirectRecorded === 1 }, null, 2));
} finally {
  fs.rmSync(run.dir, { recursive: true, force: true });
}
