import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const LEDGER_VERSION = 1;
export const ARTIFACT_ROOT = path.resolve('qa-artifacts', 'acceptance-runs');

const canonical = (value) => JSON.stringify(value, Object.keys(value || {}).sort());
const digest = (value) => crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');

export function manifestFingerprint(manifest) {
  return digest({ sourceRouteRecords: manifest.sourceRouteRecords, counts: manifest.counts, routes: manifest.routes.map(({ id, persona, routePattern, classification, canonicalUrl }) => ({ id, persona, routePattern, classification, canonicalUrl })), plannedVisualCells: manifest.plannedVisualCells, redirectContractCells: manifest.redirectContractCells });
}

export function cellKey({ persona, route, theme, width }) {
  return `${persona}|${route.id}|${route.classification}|${theme.id}|${width}`;
}

export function redirectKey(route) { return `redirect|${route.id}`; }

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temp, file);
}

export function createRun({ head, manifest, runnerVersion, mode = 'full', runId = `run-${new Date().toISOString().replace(/[:.]/g, '-')}` }) {
  const dir = path.join(ARTIFACT_ROOT, runId);
  ensureDir(dir);
  const metadata = { ledgerVersion: LEDGER_VERSION, runId, head, manifestFingerprint: manifestFingerprint(manifest), manifestVersion: 'preMission27RouteInventory', manifestPath: 'scripts/lib/preMission27RouteInventory.mjs', plannedVisualCells: manifest.plannedVisualCells, plannedRedirectContracts: manifest.redirectContractCells, startTimestamp: new Date().toISOString(), lastUpdateTimestamp: new Date().toISOString(), runnerVersion, mode, status: 'RUNNING' };
  writeJsonAtomic(path.join(dir, 'run.json'), metadata);
  fs.writeFileSync(path.join(dir, 'ledger.jsonl'), '', { flag: 'a' });
  return { dir, metadata };
}

export function openRun(runId, { head, manifest, allowMismatch = false } = {}) {
  const dir = path.join(ARTIFACT_ROOT, runId);
  const file = path.join(dir, 'run.json');
  if (!fs.existsSync(file)) throw new Error(`ACCEPTANCE RESUME BLOCKED - run not found: ${runId}`);
  const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
  const mismatch = head && manifest && (metadata.head !== head || metadata.manifestFingerprint !== manifestFingerprint(manifest) || metadata.plannedVisualCells !== manifest.plannedVisualCells || metadata.plannedRedirectContracts !== manifest.redirectContractCells);
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
  const entry = { ...result, recordedAt: new Date().toISOString() };
  fs.appendFileSync(path.join(run.dir, 'ledger.jsonl'), `${JSON.stringify(entry)}\n`);
  const metadata = JSON.parse(fs.readFileSync(path.join(run.dir, 'run.json'), 'utf8'));
  metadata.lastUpdateTimestamp = entry.recordedAt;
  writeJsonAtomic(path.join(run.dir, 'run.json'), metadata);
  return entry;
}

export function reconcile(run, manifest, themes, widths) {
  const entries = readLedger(run);
  const visual = manifest.routes.filter((r) => ['FULL_MATRIX_UI', 'PARAMETRIC_UI'].includes(r.classification));
  const expected = new Set(visual.flatMap((route) => themes.flatMap((theme) => widths.map((width) => cellKey({ persona: route.persona, route, theme, width })) )));
  const counts = { PASS: 0, FAIL: 0, INCOMPLETE: 0 };
  const seen = new Map();
  for (const entry of entries) { if (entry.kind === 'redirect') continue; counts[entry.status] = (counts[entry.status] || 0) + 1; seen.set(entry.key, (seen.get(entry.key) || 0) + 1); }
  const duplicates = [...seen].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count }));
  const recorded = new Set(seen.keys());
  const unseen = [...expected].filter((key) => !recorded.has(key));
  const redirectEntries = entries.filter((entry) => entry.kind === 'redirect');
  const summary = { plannedVisualCells: expected.size, uniqueVisualCellsRecorded: recorded.size, ...counts, unseen: unseen.length, duplicateCellKeys: duplicates, themeCounts: Object.fromEntries(themes.map((theme) => [theme.id, entries.filter((e) => e.theme === theme.id).length])), widthCounts: Object.fromEntries(widths.map((width) => [width, entries.filter((e) => e.width === width).length])), redirectPlanned: manifest.redirectContractCells, redirectRecorded: redirectEntries.length, redirectIncomplete: Math.max(0, manifest.redirectContractCells - new Set(redirectEntries.map((e) => e.key)).size), complete: recorded.size === expected.size && counts.INCOMPLETE === 0 && counts.FAIL === 0 && duplicates.length === 0 && redirectEntries.length === manifest.redirectContractCells };
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
