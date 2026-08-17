import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const LEDGER_VERSION = 1;
export const ARTIFACT_ROOT = path.resolve('qa-artifacts', 'acceptance-runs');
export const ACCEPTANCE_CONTRACT_VERSION = 'pre-freeze-acceptance-contract-v2';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const legacyCanonical = (value) => JSON.stringify(value, Object.keys(value || {}).sort());
const digest = (value) => crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const legacyDigest = (value) => crypto.createHash('sha256').update(typeof value === 'string' ? value : legacyCanonical(value)).digest('hex');
const CHECKPOINT_RETRIES = 5;
const CHECKPOINT_DELAY_MS = 20;
let checkpointFaultInjector = null;

export function setCheckpointFaultInjector(injector) {
  const previous = checkpointFaultInjector;
  checkpointFaultInjector = injector;
  return () => { checkpointFaultInjector = previous; };
}

export function manifestFingerprint(manifest) {
  return legacyDigest({ sourceRouteRecords: manifest.sourceRouteRecords, counts: manifest.counts, routes: manifest.routes.map(({ id, persona, routePattern, classification, canonicalUrl }) => ({ id, persona, routePattern, classification, canonicalUrl })), plannedVisualCells: manifest.plannedVisualCells, redirectContractCells: manifest.redirectContractCells });
}

export function candidateFingerprint({ head, manifest, manifestFingerprint: suppliedManifestFingerprint, themes = [], widths = [], acceptanceContractVersion = ACCEPTANCE_CONTRACT_VERSION, runnerVersion = 'unknown' }) {
  if (!head || !manifest) throw new Error('Candidate fingerprint requires HEAD and manifest');
  const mf = suppliedManifestFingerprint || manifestFingerprint(manifest);
  const themeContract = themes.map((theme) => ({ id: theme.id, preference: theme.preference, media: theme.media }));
  const widthContract = [...widths];
  return digest({
    head,
    manifestFingerprint: mf,
    plannedVisualCells: manifest.plannedVisualCells,
    plannedRedirectContracts: manifest.redirectContractCells,
    renderedPersonaRouteCombinations: manifest.renderedPersonaRouteCombinations,
    themeContract,
    widthContract,
    acceptanceContractVersion,
    runnerVersion,
  });
}

export function cellKey({ persona, route, theme, width }) {
  return `${persona}|${route.id}|${route.classification}|${theme.id}|${width}`;
}

export function redirectKey(route) { return `redirect|${route.id}`; }

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  let lastError;
  try {
    for (let attempt = 1; attempt <= CHECKPOINT_RETRIES; attempt += 1) {
      try {
        checkpointFaultInjector?.({ operation: 'rename', target: file, tempPath: temp, attempt, pid: process.pid });
        fs.renameSync(temp, file);
        return;
      } catch (error) {
        lastError = error;
        if (!['EPERM', 'EBUSY'].includes(error?.code) || attempt === CHECKPOINT_RETRIES) break;
        const waiter = new Int32Array(new SharedArrayBuffer(4));
        Atomics.wait(waiter, 0, 0, CHECKPOINT_DELAY_MS * attempt);
      }
    }
    const diagnostic = new Error(`ACCEPTANCE_CHECKPOINT_REPLACE_FAILED target=${file} temp=${temp} code=${lastError?.code || 'UNKNOWN'} attempts=${CHECKPOINT_RETRIES} pid=${process.pid}`);
    diagnostic.name = 'CheckpointPersistenceError';
    diagnostic.code = lastError?.code || 'CHECKPOINT_FAILED';
    diagnostic.target = file;
    diagnostic.tempPath = temp;
    diagnostic.attempts = CHECKPOINT_RETRIES;
    diagnostic.cause = lastError;
    throw diagnostic;
  } finally {
    if (fs.existsSync(temp)) { try { fs.unlinkSync(temp); } catch { /* best effort cleanup */ } }
  }
}

function appendEntry(run, entry) { fs.appendFileSync(path.join(run.dir, 'ledger.jsonl'), `${JSON.stringify(entry)}\n`); return entry; }
function appendInfrastructure(run, error, context = {}) {
  return appendEntry(run, { kind: 'infrastructure', stage: 'CHECKPOINT_FAILURE', code: error.code || 'CHECKPOINT_FAILED', message: error.message, target: error.target, tempPath: error.tempPath, attempts: error.attempts, pid: process.pid, context, recordedAt: new Date().toISOString() });
}

function checkpointMetadata(run, update) {
  const file = path.join(run.dir, 'run.json');
  const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(metadata, update);
  writeJsonAtomic(file, metadata);
}

export function createRun({ head, manifest, runnerVersion, mode = 'full', runId = `run-${new Date().toISOString().replace(/[:.]/g, '-')}`, themes = [], widths = [], acceptanceContractVersion = ACCEPTANCE_CONTRACT_VERSION }) {
  const dir = path.join(ARTIFACT_ROOT, runId);
  ensureDir(dir);
  const mf = manifestFingerprint(manifest);
  const metadata = { ledgerVersion: LEDGER_VERSION, runId, head, manifestFingerprint: mf, candidateFingerprint: candidateFingerprint({ head, manifest, manifestFingerprint: mf, themes, widths, acceptanceContractVersion, runnerVersion }), manifestVersion: 'preMission27RouteInventory', manifestPath: 'scripts/lib/preMission27RouteInventory.mjs', plannedVisualCells: manifest.plannedVisualCells, plannedRedirectContracts: manifest.redirectContractCells, renderedPersonaRouteCombinations: manifest.renderedPersonaRouteCombinations, themeContract: themes.map((theme) => ({ id: theme.id, preference: theme.preference, media: theme.media })), widthContract: [...widths], acceptanceContractVersion, startTimestamp: new Date().toISOString(), lastUpdateTimestamp: new Date().toISOString(), runnerVersion, mode, status: 'RUNNING' };
  writeJsonAtomic(path.join(dir, 'run.json'), metadata);
  fs.writeFileSync(path.join(dir, 'ledger.jsonl'), '', { flag: 'a' });
  return { dir, metadata };
}

export function openRun(runId, { head, manifest, themes = [], widths = [], runnerVersion, acceptanceContractVersion = ACCEPTANCE_CONTRACT_VERSION, allowMismatch = false, forResume = false } = {}) {
  const dir = path.join(ARTIFACT_ROOT, runId);
  const file = path.join(dir, 'run.json');
  if (!fs.existsSync(file)) throw new Error(`ACCEPTANCE RESUME BLOCKED - run not found: ${runId}`);
  const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
  const currentManifestFingerprint = manifest && manifestFingerprint(manifest);
  const expectedCandidateFingerprint = head && manifest && candidateFingerprint({ head, manifest, manifestFingerprint: currentManifestFingerprint, themes, widths, acceptanceContractVersion, runnerVersion: runnerVersion || metadata.runnerVersion });
  if (forResume && !metadata.candidateFingerprint) throw new Error('ACCEPTANCE RESUME BLOCKED - LEGACY RUN FINGERPRINT SCHEMA');
  const mismatch = head && manifest && (metadata.head !== head || metadata.manifestFingerprint !== currentManifestFingerprint || (forResume && metadata.candidateFingerprint !== expectedCandidateFingerprint) || metadata.plannedVisualCells !== manifest.plannedVisualCells || metadata.plannedRedirectContracts !== manifest.redirectContractCells || (metadata.acceptanceContractVersion && metadata.acceptanceContractVersion !== acceptanceContractVersion));
  if (mismatch && !allowMismatch) throw new Error('ACCEPTANCE RESUME BLOCKED - RUN FINGERPRINT MISMATCH');
  return { dir, metadata };
}

export function readLedger(run) {
  const file = path.join(run.dir, 'ledger.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

export function recordResult(run, result) {
  if (!result.key || !['PASS', 'FAIL', 'INCOMPLETE'].includes(result.status)) throw new Error('Invalid acceptance ledger result');
  const duplicate = readLedger(run).find((entry) => entry.kind === 'visual' && entry.key === result.key);
  if (duplicate) {
    const invariant = new Error(`ACCEPTANCE_LEDGER_INVARIANT duplicate terminal cell key: ${result.key}`);
    invariant.code = 'DUPLICATE_TERMINAL_CELL';
    throw invariant;
  }
  const entry = { ...result, recordedAt: new Date().toISOString() };
  appendEntry(run, entry);
  try { checkpointMetadata(run, { lastUpdateTimestamp: entry.recordedAt }); }
  catch (error) { appendInfrastructure(run, error, { kind: 'visual', key: result.key, status: result.status }); throw error; }
  return entry;
}

export function recordLifecycle(run, event) {
  const entry = { kind: 'lifecycle', ...event, recordedAt: new Date().toISOString() };
  appendEntry(run, entry);
  try { checkpointMetadata(run, { lastUpdateTimestamp: entry.recordedAt, current: { key: event.key, stage: event.stage, persona: event.persona, routeId: event.routeId, theme: event.theme, width: event.width } }); }
  catch (error) { appendInfrastructure(run, error, { kind: 'lifecycle', stage: event.stage, key: event.key }); throw error; }
  return entry;
}

export function reconcile(run, manifest, themes, widths) {
  const entries = readLedger(run);
  const visual = manifest.routes.filter((r) => ['FULL_MATRIX_UI', 'PARAMETRIC_UI'].includes(r.classification));
  const expected = new Set(visual.flatMap((route) => themes.flatMap((theme) => widths.map((width) => cellKey({ persona: route.persona, route, theme, width })) )));
  const rawCounts = { PASS: 0, FAIL: 0, INCOMPLETE: 0 };
  const grouped = new Map();
  for (const entry of entries) { if (entry.kind !== 'visual') continue; rawCounts[entry.status] = (rawCounts[entry.status] || 0) + 1; if (!grouped.has(entry.key)) grouped.set(entry.key, []); grouped.get(entry.key).push(entry); }
  const duplicates = [...grouped].filter(([, values]) => values.length > 1).map(([key, values]) => ({ key, count: values.length }));
  const unique = [...grouped].filter(([, values]) => values.length === 1).map(([, values]) => values[0]);
  const counts = { PASS: unique.filter((entry) => entry.status === 'PASS').length, FAIL: unique.filter((entry) => entry.status === 'FAIL').length, INCOMPLETE: unique.filter((entry) => entry.status === 'INCOMPLETE').length };
  const recorded = new Set(grouped.keys());
  const unseen = [...expected].filter((key) => !recorded.has(key));
  const redirectEntries = entries.filter((entry) => entry.kind === 'redirect');
  const active = entries.filter((e) => e.kind === 'lifecycle' && e.stage === 'CELL_START').map((start) => ({ ...start, terminal: entries.some((e) => e.kind === 'visual' && e.key === start.key) })).filter((entry) => !entry.terminal);
  const summary = { plannedVisualCells: expected.size, recordedVisualCells: entries.filter((entry) => entry.kind === 'visual').length, uniqueVisualCellsRecorded: recorded.size, rawTerminalRecords: entries.filter((entry) => entry.kind === 'visual').length, rawPASS: rawCounts.PASS, rawFAIL: rawCounts.FAIL, rawINCOMPLETE: rawCounts.INCOMPLETE, ...counts, unseen: unseen.length, duplicateTerminalKeys: duplicates.length, duplicateCellKeys: duplicates, activeCells: active, themeCounts: Object.fromEntries(themes.map((theme) => [theme.id, entries.filter((e) => e.kind === 'visual' && e.theme === theme.id).length])), widthCounts: Object.fromEntries(widths.map((width) => [width, entries.filter((e) => e.kind === 'visual' && e.width === width).length])), redirectPlanned: manifest.redirectContractCells, redirectRecorded: redirectEntries.length, redirectIncomplete: Math.max(0, manifest.redirectContractCells - new Set(redirectEntries.map((e) => e.key)).size), complete: recorded.size === expected.size && counts.INCOMPLETE === 0 && counts.FAIL === 0 && duplicates.length === 0 && active.length === 0 && redirectEntries.length === manifest.redirectContractCells };
  writeJsonAtomic(path.join(run.dir, 'summary.json'), summary);
  return summary;
}

export function markRunStatus(run, status) {
  const file = path.join(run.dir, 'run.json');
  const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
  metadata.status = status;
  metadata.lastUpdateTimestamp = new Date().toISOString();
  writeJsonAtomic(file, metadata);
}

export function progress(run, manifest, themes, widths) { return reconcile(run, manifest, themes, widths); }
