import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createRun, readLedger, recordResult, reconcile, setCheckpointFaultInjector,
} from './lib/acceptanceLedger.mjs';
import {
  FIXTURE, mockResponse, consultationFixtureFor, consultationNegativeResponse,
  serializeConsoleError,
} from './lib/acceptanceFixtures.mjs';

const themes = [{ id: 'explicit-light' }];
const widths = [320];
const manifest = {
  sourceRouteRecords: 1,
  counts: { FULL_MATRIX_UI: 1, PARAMETRIC_UI: 0, REDIRECT_ONLY: 0, SHELL_EQUIVALENT_ALIAS: 0, NON_LAUNCH_INTERNAL: 0 },
  plannedVisualCells: 1,
  redirectContractCells: 0,
  routes: [{ id: 'qa:consultation', persona: 'education-independent', routePattern: '/agent/education/consultations/:consultationId', classification: 'PARAMETRIC_UI', canonicalUrl: `/agent/education/consultations/${FIXTURE.consultationId}` }],
};

const runIds = [];
function newRun() { const runId = `closure-test-${process.pid}-${Date.now()}-${runIds.length}`; runIds.push(runId); return createRun({ runId, head: 'test-head', manifest, runnerVersion: 'closure-test' }); }

try {
  const independent = consultationFixtureFor('education-independent');
  const agency = consultationFixtureFor('education-agency');
  assert.equal(mockResponse(`/api/agent/consultations/${FIXTURE.consultationId}`, 'education-independent')[0], 200);
  assert.equal(independent.consultation.assignedMembershipId, independent.graph.membershipId);
  assert.equal(agency.consultation.organizationId, agency.graph.organizationId);
  assert.notEqual(independent.consultation.organizationId, agency.consultation.organizationId);
  assert.equal(consultationNegativeResponse('education-independent', 'education-agency')[0], 403);
  assert.equal(mockResponse('/api/agent/marketplace', 'education-independent')[1].posts.length, 0);
  assert.ok(mockResponse('/api/agent/marketplace/counts', 'education-agency')[1].counts);
  assert.equal(mockResponse('/api/agent/verification', 'education-agency')[1].isApproved, true);
  assert.throws(() => mockResponse('/api/unknown', 'education-independent', { method: 'GET', routeId: 'qa:unknown' }), (error) => error.code === 'UNHANDLED_ACCEPTANCE_API' && /method=GET/.test(error.message) && /routeId=qa:unknown/.test(error.message));

  const transientRun = newRun();
  let transientAttempts = 0;
  const restoreTransient = setCheckpointFaultInjector(({ target, attempt }) => { if (target.endsWith('run.json') && attempt === 1) { transientAttempts += 1; const error = new Error('injected transient lock'); error.code = 'EPERM'; throw error; } });
  recordResult(transientRun, { key: 'education-independent|qa:consultation|PARAMETRIC_UI|explicit-light|320', kind: 'visual', status: 'PASS' });
  restoreTransient();
  assert.equal(transientAttempts, 1);
  let summary = reconcile(transientRun, manifest, themes, widths);
  assert.equal(summary.PASS, 1); assert.equal(summary.duplicateTerminalKeys, 0); assert.equal(summary.recordedVisualCells, 1);
  assert.throws(() => recordResult(transientRun, { key: 'education-independent|qa:consultation|PARAMETRIC_UI|explicit-light|320', kind: 'visual', status: 'FAIL' }), (error) => error.code === 'DUPLICATE_TERMINAL_CELL');

  const persistentRun = newRun();
  const restorePersistent = setCheckpointFaultInjector(() => { const error = new Error('injected persistent lock'); error.code = 'EPERM'; throw error; });
  assert.throws(() => recordResult(persistentRun, { key: 'education-independent|qa:consultation|PARAMETRIC_UI|explicit-light|320', kind: 'visual', status: 'PASS' }), /ACCEPTANCE_CHECKPOINT_REPLACE_FAILED/);
  restorePersistent();
  const persistentLedger = readLedger(persistentRun);
  assert.equal(persistentLedger.filter((entry) => entry.kind === 'visual').length, 1);
  assert.equal(persistentLedger.filter((entry) => entry.kind === 'infrastructure').length, 1);
  summary = reconcile(persistentRun, manifest, themes, widths);
  assert.equal(summary.PASS, 1); assert.equal(summary.duplicateTerminalKeys, 0);

  const duplicateRun = newRun();
  const key = 'education-independent|qa:consultation|PARAMETRIC_UI|explicit-light|320';
  recordResult(duplicateRun, { key, kind: 'visual', status: 'PASS' });
  fs.appendFileSync(path.join(duplicateRun.dir, 'ledger.jsonl'), `${JSON.stringify({ key, kind: 'visual', status: 'PASS', recordedAt: new Date().toISOString() })}\n`);
  summary = reconcile(duplicateRun, manifest, themes, widths);
  assert.equal(summary.rawTerminalRecords, 2); assert.equal(summary.uniqueVisualCellsRecorded, 1); assert.equal(summary.duplicateTerminalKeys, 1); assert.equal(summary.complete, false);

  const browserError = serializeConsoleError(new TypeError('controlled QA browser error'), { url: 'https://localhost/assets/test.js', lineNumber: 12, columnNumber: 4 });
  assert.equal(browserError.name, 'TypeError'); assert.equal(browserError.message, 'controlled QA browser error'); assert.match(browserError.stack, /TypeError/); assert.equal(browserError.location.line, 12); assert.notEqual(browserError.message, 'JSHandle@error');
  console.log(JSON.stringify({ fixtureContracts: 'PASS', unknownApi: 'FAIL_CLOSED', transientCheckpoint: 'PASS', persistentCheckpoint: 'PASS', duplicateDetection: 'PASS', consoleSerialization: 'PASS' }));
} finally {
  for (const runId of runIds) { const dir = path.resolve('qa-artifacts', 'acceptance-runs', runId); if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); }
}
