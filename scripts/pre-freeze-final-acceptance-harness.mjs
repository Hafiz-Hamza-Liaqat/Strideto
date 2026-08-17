import assert from 'node:assert/strict';
/* eslint-env browser */
import puppeteer from 'puppeteer';
import { buildRouteInventory } from './lib/preMission27RouteInventory.mjs';
import { createRun, openRun, cellKey, recordResult, recordLifecycle, reconcile, markRunStatus, readLedger } from './lib/acceptanceLedger.mjs';
import { FIXTURE, mockResponse } from './lib/acceptanceFixtures.mjs';

const BASE = process.env.STRIDETO_QA_BASE || 'https://127.0.0.1:8443';
const WIDTHS = [320, 375, 768, 1024, 1440];
const THEMES = [
  { id: 'explicit-light', preference: 'light', media: 'light' },
  { id: 'explicit-dark', preference: 'dark', media: 'dark' },
  { id: 'system-light', preference: 'system', media: 'light' },
  { id: 'system-dark', preference: 'system', media: 'dark' },
];

async function serializeConsoleMessage(message) {
  const location = typeof message.location === 'function' ? message.location() : {};
  const args = [];
  for (const handle of (typeof message.args === 'function' ? message.args() : [])) {
    try {
      args.push(await handle.evaluate((value) => {
        if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
        return value;
      }));
    } catch {
      try { args.push(handle.remoteObject?.().description || '[unserializable console argument]'); }
      catch { args.push('[unserializable console argument]'); }
    }
  }
  return { type: message.type(), text: message.text(), args, location: { url: location.url || null, line: location.lineNumber ?? null, column: location.columnNumber ?? null } };
}

function serializePageError(error) {
  return { name: error.name, message: error.message, stack: error.stack || null };
}

function classify(record) {
  if (/^\/dev\//.test(record.route)) return { classification: 'NON_LAUNCH_INTERNAL', reason: 'development-only visual fixture route' };
  if (/^Legacy/.test(record.component)) return { classification: 'REDIRECT_ONLY', reason: 'legacy compatibility redirect component' };
  if (record.pattern.includes(':')) return { classification: 'PARAMETRIC_UI', reason: 'rendered route requires disposable fixture parameter' };
  return { classification: 'FULL_MATRIX_UI', reason: 'rendered launch route' };
}

function personasFor(record) {
  if (record.realm === 'PUBLIC') return ['anonymous'];
  if (record.realm === 'STUDENT') return ['student'];
  if (record.realm === 'EMPLOYER') return ['employer'];
  if (record.realm === 'INSTITUTION') return ['institution'];
  if (record.realm === 'ADMIN') return ['admin'];
  if (record.realm === 'AGENT') {
    if (record.route.includes('/business-services')) return ['business-independent', 'business-agency'];
    if (record.route.includes('/education') || record.route === '/agent') return ['education-independent', 'education-agency'];
    return ['education-independent', 'education-agency', 'business-independent', 'business-agency'];
  }
  return [];
}

function materialize(pattern) {
  return pattern.replace(/:([A-Za-z0-9_]+)/g, (_, name) => FIXTURE[name] || 'fixture');
}

function expectedH1(record) {
  return { kind: 'visible-primary', routePattern: record.pattern, predicate: 'one visible h1 with non-empty text' };
}

function buildManifest() {
  const inventory = buildRouteInventory();
  const routes = [];
  const sourceCounts = { FULL_MATRIX_UI: 0, PARAMETRIC_UI: 0, REDIRECT_ONLY: 0, SHELL_EQUIVALENT_ALIAS: 0, NON_LAUNCH_INTERNAL: 0 };
  for (const record of inventory.records) {
    const { classification, reason } = classify(record);
    sourceCounts[classification] += 1;
    for (const persona of personasFor(record)) {
      const id = `${persona}:${record.pattern}:${classification}`;
      routes.push({
        id, persona, product: record.realm, routePattern: record.pattern, classification,
        canonicalUrl: materialize(record.route), fixtureRequirement: record.pattern.includes(':') ? 'disposable fixture resolver' : 'none',
        expectedH1: expectedH1(record), expectedActiveNav: record.realm === 'PUBLIC' ? { applies: false, reason: 'public route' } : { applies: true, routePattern: record.pattern },
        authRealm: record.realm.toLowerCase(), requiredCapabilityDomain: record.realm === 'AGENT' ? (record.route.includes('/business-services') ? 'business_services' : 'education_mobility') : null,
        sourceComponent: record.component, sourcePage: record.page, reason,
      });
    }
  }
  const counts = sourceCounts;
  const visual = routes.filter((r) => ['FULL_MATRIX_UI', 'PARAMETRIC_UI'].includes(r.classification));
  return { generatedFrom: 'scripts/lib/preMission27RouteInventory.mjs → client/src/routes/index.jsx', sourceRouteRecords: inventory.records.length, routes, counts, renderedPersonaRouteCombinations: visual.length, plannedVisualCells: visual.length * THEMES.length * WIDTHS.length, redirectContractCells: counts.REDIRECT_ONLY, aliasContractCells: counts.SHELL_EQUIVALENT_ALIAS, findings: inventory.findings };
}


function assertManifest(manifest) {
  const ids = manifest.routes.map((route) => route.id);
  assert.equal(new Set(ids).size, ids.length, 'manifest IDs must be unique');
  for (const route of manifest.routes) {
    assert.ok(route.persona && route.routePattern && route.classification && route.reason);
    if (['FULL_MATRIX_UI', 'PARAMETRIC_UI'].includes(route.classification)) assert.ok(route.expectedH1 && route.expectedActiveNav);
    if (route.classification === 'PARAMETRIC_UI') assert.equal(route.fixtureRequirement, 'disposable fixture resolver');
  }
  assert.equal(manifest.plannedVisualCells, manifest.renderedPersonaRouteCombinations * 20);
  assert.equal(manifest.sourceRouteRecords, 329);
  assert.equal(Object.values(manifest.counts).reduce((sum, value) => sum + value, 0), manifest.sourceRouteRecords);
}

function assertIsolationSelfTest() {
  assert.equal(mockResponse('/api/auth/agent/refresh-token', 'student')[0], 401, 'Student must not obtain Agent auth');
  assert.equal(mockResponse('/api/auth/agent/refresh-token', 'business-client')[0], 401, 'Business Client must not obtain Agent auth');
  assert.equal(mockResponse('/api/agent/business-services/enabled', 'education-independent')[0], 403, 'Education Provider must not obtain Business domain');
  assert.equal(mockResponse('/api/agent/education/enabled', 'business-independent')[0], 403, 'Business Provider must not obtain Education domain');
  assert.equal(mockResponse('/api/business/quotes/other', 'business-client')[0], 403, 'Business Client must not open another Client resource');
  assert.notEqual(mockResponse('/api/admin/auth/refresh-token', 'admin')[0], 401, 'Admin fixture must be independently authenticated');
  assert.notEqual(mockResponse('/api/auth/agent/refresh-token', 'education-independent')[0], 401, 'Education Provider fixture must authenticate independently');
}

async function runSelfTest(manifest) {
  assertManifest(manifest);
  assertIsolationSelfTest();
  const representatives = [
    ['anonymous', '/agents'], ['education-independent', '/agent/education'], ['education-agency', '/agent/education'], ['education-independent', '/agent/education/cases/507f1f77bcf86cd799439011'],
    ['student', '/cases/507f1f77bcf86cd799439011'], ['business-independent', '/agent/business-services'], ['business-agency', '/agent/business-services'], ['business-independent', '/agent/business-services/cases/GBSC-QA-CASE'],
    ['business-client', '/business/quotes/GBSQ-QA-QUOTE'], ['employer', '/employer'], ['institution', '/institution'], ['admin', '/admin/agent-marketplace'], ['student', '/notifications'],
  ];
  const browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors'] });
  const results = []; const failures = [];
  try {
    for (const [persona, route] of representatives) for (const theme of THEMES) for (const width of [320, 1440]) {
      const page = await browser.newPage(); const errors = []; const failed = []; const consoleTasks = []; let expectedAuth401 = 0; let expectedDomain403 = 0;
      page.on('pageerror', (error) => errors.push(serializePageError(error)));
      page.on('console', (message) => { if (message.type() !== 'error' || message.text().includes('icon from the Manifest')) return; if (message.text().includes('401 (Unauthorized)') && expectedAuth401 > 0) { expectedAuth401 -= 1; return; } if (message.text().includes('403 (Forbidden)') && expectedDomain403 > 0) { expectedDomain403 -= 1; return; } consoleTasks.push(serializeConsoleMessage(message).then((detail) => errors.push(detail))); });
      page.on('requestfailed', (request) => failed.push(`${request.url()} ${request.failure()?.errorText || ''}`));
      await page.evaluateOnNewDocument((value) => localStorage.setItem('edurozgaar-theme', value), theme.preference);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (!url.pathname.startsWith('/api/')) return request.continue();
        let status; let body;
        try { [status, body] = mockResponse(url.pathname, persona, { method: request.method(), routeId: `self-test:${route}` }); }
        catch (error) { errors.push({ name: error.name, message: error.message, code: error.code }); status = 599; body = { error: error.code, message: error.message }; }
        if (status === 401 && (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/admin/auth/'))) expectedAuth401 += 1;
        if (status === 403 && (url.pathname.includes('/business-services/') || url.pathname.includes('/education/'))) expectedDomain403 += 1;
        return request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme.media }]);
      await page.setViewport({ width, height: width < 768 ? 1000 : 1100 });
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('h1', { timeout: 15000 });
      } catch (error) {
        failures.push({ persona, route, theme: theme.id, width, error: error.message, errors, failed });
        results.push({ persona, route, theme: theme.id, width, pass: false });
        await page.close();
        continue;
      }
      await Promise.allSettled(consoleTasks);
      const result = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent?.trim(), overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth, dark: document.documentElement.classList.contains('dark'), selectsNamed: [...document.querySelectorAll('select')].every((field) => field.labels?.length || field.getAttribute('aria-label')), duplicateH1: document.querySelectorAll('h1').length !== 1, systemPreference: localStorage.getItem('edurozgaar-theme') === 'system' }));
      const expectedDark = theme.media === 'dark';
      try { assert.ok(result.h1); assert.ok(result.overflow <= 2, `overflow ${result.overflow}`); assert.equal(result.dark, expectedDark); assert.equal(result.duplicateH1, false); assert.equal(errors.length, 0, errors.join('\n')); assert.equal(failed.length, 0, failed.join('\n')); } catch (error) { failures.push({ persona, route, theme: theme.id, width, error: error.message, result, errors, failed }); }
      results.push({ persona, route, theme: theme.id, width, pass: failures.length === 0 });
      await page.close();
    }
  } finally { await browser.close(); }
  const system = results.filter((row) => row.theme.startsWith('system'));
  assert.ok(system.length > 0, 'system theme cells must execute');
  assert.equal(results.length, representatives.length * THEMES.length * 2);
  console.log(JSON.stringify({ selfTest: { representatives: representatives.length, planned: results.length, passed: results.filter((r) => r.pass).length, failed: failures.length, systemLight: system.filter((r) => r.theme === 'system-light').length, systemDark: system.filter((r) => r.theme === 'system-dark').length }, manifest: { sourceRouteRecords: manifest.sourceRouteRecords, counts: manifest.counts, renderedPersonaRouteCombinations: manifest.renderedPersonaRouteCombinations, plannedVisualCells: manifest.plannedVisualCells }, failures }, null, 2));
  assert.deepEqual(failures, [], failures.map((failure) => JSON.stringify(failure)).join('\n'));
}

async function runFullMatrix(manifest) {
  assertManifest(manifest);
  const lifecycle = { stage: 'MANIFEST_VALIDATED' };
  const cells = manifest.routes
    .filter((route) => ['FULL_MATRIX_UI', 'PARAMETRIC_UI'].includes(route.classification))
    .flatMap((route) => THEMES.flatMap((theme) => WIDTHS.map((width) => ({ route, theme, width }))));
  const head = process.env.STRIDETO_QA_HEAD || (await import('node:child_process')).execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const runIdArg = process.argv.find((arg) => arg.startsWith('--run-id='))?.slice('--run-id='.length);
  const resume = process.argv.includes('--resume');
  const run = resume ? openRun(runIdArg, { head, manifest }) : createRun({ head, manifest, runnerVersion: 'b9c5978', mode: 'full', runId: runIdArg });
  if (resume) markRunStatus(run, 'RUNNING');
  recordLifecycle(run, lifecycle);
  reconcile(run, manifest, THEMES, WIDTHS);
  const completed = new Set(readLedger(run).filter((entry) => entry.kind === 'visual').map((entry) => entry.key));
  const stageTimeout = Number(process.env.STRIDETO_QA_STAGE_TIMEOUT_MS || 45000);
  const stage = (name, promise) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`QA stage timeout: ${name}`)), stageTimeout);
    Promise.resolve(promise).then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
  recordLifecycle(run, { stage: 'BROWSER_LAUNCH_START' });
  const browser = await stage('browser-launch', puppeteer.launch({ headless: true, ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors'] }));
  recordLifecycle(run, { stage: 'BROWSER_LAUNCHED' });
  const failures = [];
  const maxCells = Number(process.argv.find((arg) => arg.startsWith('--max-cells='))?.slice('--max-cells='.length) || Infinity);
  const personaFilter = process.argv.find((arg) => arg.startsWith('--persona='))?.slice('--persona='.length);
  const routeFilter = process.argv.find((arg) => arg.startsWith('--route='))?.slice('--route='.length);
  const themeFilter = process.argv.find((arg) => arg.startsWith('--theme='))?.slice('--theme='.length);
  const widthFilter = Number(process.argv.find((arg) => arg.startsWith('--width='))?.slice('--width='.length) || 0);
  const selectedCells = cells.filter(({ route, theme, width }) => (!personaFilter || route.persona === personaFilter) && (!routeFilter || route.routePattern === routeFilter || route.canonicalUrl === routeFilter) && (!themeFilter || theme.id === themeFilter) && (!widthFilter || width === widthFilter)).slice(0, maxCells);
  const diagnosticRun = Number.isFinite(maxCells) || Boolean(personaFilter || routeFilter || themeFilter || widthFilter);
  if (!selectedCells.length) throw new Error('No matrix cells matched the requested diagnostic filters');
  let currentCell;
  const heartbeat = setInterval(() => { const summary = reconcile(run, manifest, THEMES, WIDTHS); console.log(JSON.stringify({ runId: run.metadata.runId, head, completed: summary.uniqueVisualCellsRecorded, planned: selectedCells.length, passed: summary.PASS, failed: summary.FAIL, incomplete: summary.INCOMPLETE, remaining: Math.max(0, selectedCells.length - summary.uniqueVisualCellsRecorded), current: currentCell || null, stage: run.metadata.current?.stage || 'IDLE', elapsedMs: Date.now() - new Date(run.metadata.startTimestamp).getTime() })); }, 10000);
  try {
    for (const { route, theme, width } of selectedCells) {
      const key = cellKey({ persona: route.persona, route, theme, width });
      if (completed.has(key)) continue;
      const startedAt = new Date().toISOString();
      currentCell = { key, persona: route.persona, routeId: route.id, theme: theme.id, width };
      recordLifecycle(run, { stage: 'CELL_START', key, persona: route.persona, routeId: route.id, theme: theme.id, width });
      const page = await stage('context-create', browser.newPage()); const errors = []; const failed = []; const consoleTasks = []; let expectedAuth401 = 0; let expectedDomain403 = 0;
      page.on('pageerror', (error) => errors.push(serializePageError(error)));
      page.on('console', (message) => { if (message.type() !== 'error' || message.text().includes('icon from the Manifest')) return; if (message.text().includes('401 (Unauthorized)') && expectedAuth401 > 0) { expectedAuth401 -= 1; return; } if (message.text().includes('403 (Forbidden)') && expectedDomain403 > 0) { expectedDomain403 -= 1; return; } consoleTasks.push(serializeConsoleMessage(message).then((detail) => errors.push(detail))); });
      page.on('requestfailed', (request) => failed.push(`${request.url()} ${request.failure()?.errorText || ''}`));
      recordLifecycle(run, { stage: 'THEME_SETUP', key, persona: route.persona, routeId: route.id, theme: theme.id, width });
      await stage('theme-setup', page.evaluateOnNewDocument((value) => localStorage.setItem('edurozgaar-theme', value), theme.preference));
      await page.setRequestInterception(true);
      page.on('request', (request) => { const url = new URL(request.url()); if (!url.pathname.startsWith('/api/')) return request.continue(); let status; let body; try { [status, body] = mockResponse(url.pathname, route.persona, { method: request.method(), routeId: route.id }); } catch (error) { errors.push({ name: error.name, message: error.message, code: error.code }); status = 599; body = { error: error.code, message: error.message }; } if (status === 401 && (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/admin/auth/'))) expectedAuth401 += 1; if (status === 403 && (url.pathname.includes('/business-services/') || url.pathname.includes('/education/'))) expectedDomain403 += 1; return request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) }); });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme.media }]);
      await page.setViewport({ width, height: width < 768 ? 1000 : 1100 });
      let result;
      try {
        recordLifecycle(run, { stage: 'NAVIGATION_START', key, persona: route.persona, routeId: route.id, theme: theme.id, width });
        await stage('navigation', page.goto(`${BASE}${route.canonicalUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 }));
        recordLifecycle(run, { stage: 'NAVIGATION_COMPLETE', key, persona: route.persona, routeId: route.id, theme: theme.id, width });
        await stage('readiness-h1', page.waitForSelector('h1', { timeout: 15000 }));
        recordLifecycle(run, { stage: 'ASSERTIONS_START', key, persona: route.persona, routeId: route.id, theme: theme.id, width });
        await Promise.allSettled(consoleTasks);
        result = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent?.trim(), overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth, dark: document.documentElement.classList.contains('dark'), duplicateH1: document.querySelectorAll('h1').length !== 1 }));
        assert.ok(result.h1); assert.ok(result.overflow <= 2); assert.equal(result.dark, theme.media === 'dark'); assert.equal(result.duplicateH1, false); assert.deepEqual(errors, []); assert.deepEqual(failed, []);
        recordResult(run, { key, kind: 'visual', persona: route.persona, routeId: route.id, url: route.canonicalUrl, theme: theme.id, width, startedAt, endedAt: new Date().toISOString(), status: 'PASS', h1: result.h1, overflow: result.overflow, errors, failed });
        recordLifecycle(run, { stage: 'CELL_PERSISTED', key, persona: route.persona, routeId: route.id, theme: theme.id, width });
        recordLifecycle(run, { stage: 'ASSERTIONS_COMPLETE', key, persona: route.persona, routeId: route.id, theme: theme.id, width });
      } catch (error) {
        if (error?.name === 'CheckpointPersistenceError' || error?.code === 'DUPLICATE_TERMINAL_CELL') throw error;
        const status = error?.name === 'AbortError' ? 'INCOMPLETE' : 'FAIL';
        const entry = { key, kind: 'visual', persona: route.persona, routeId: route.id, url: route.canonicalUrl, theme: theme.id, width, startedAt, endedAt: new Date().toISOString(), status, h1: result?.h1 || null, overflow: result?.overflow ?? null, error: error.message, errors, failed };
        recordResult(run, entry); if (status === 'FAIL') failures.push(entry);
      }
      await stage('context-close', page.close());
      recordLifecycle(run, { stage: 'CONTEXT_CLOSED', key, persona: route.persona, routeId: route.id, theme: theme.id, width });
      const current = reconcile(run, manifest, THEMES, WIDTHS);
      if ((current.uniqueVisualCellsRecorded % 25) === 0) console.log(JSON.stringify({ runId: run.metadata.runId, head, completed: current.uniqueVisualCellsRecorded, planned: current.plannedVisualCells, passed: current.PASS, failed: current.FAIL, incomplete: current.INCOMPLETE, remaining: current.unseen, persona: route.persona, route: route.id, theme: theme.id, width }));
    }
    markRunStatus(run, 'COMPLETED');
  } catch (error) { if (currentCell) recordLifecycle(run, { stage: 'CELL_INTERRUPTED', ...currentCell, error: error.message }); markRunStatus(run, 'INTERRUPTED'); throw error; } finally {
    clearInterval(heartbeat);
    try { await stage('browser-close', browser.close()); recordLifecycle(run, { stage: 'BROWSER_CLOSED' }); }
    catch (error) { recordLifecycle(run, { stage: 'BROWSER_CLOSE_TIMEOUT', error: error.message }); markRunStatus(run, 'INTERRUPTED'); throw error; } // eslint-disable-line no-unsafe-finally
  }
  const summary = reconcile(run, manifest, THEMES, WIDTHS);
  console.log(JSON.stringify({ matrix: summary, failures: failures.slice(0, 20) }, null, 2));
  if (!diagnosticRun) { assert.equal(summary.INCOMPLETE, 0); assert.equal(summary.FAIL, 0); }
}

const manifest = buildManifest();
if (process.argv.includes('--manifest')) { console.log(JSON.stringify(manifest, null, 2)); process.exit(0); }
if (process.argv.includes('--full')) await runFullMatrix(manifest);
if (process.argv.includes('--reconcile')) {
  const runId = process.argv.find((arg) => arg.startsWith('--run-id='))?.slice('--run-id='.length);
  const run = openRun(runId, { head: process.env.STRIDETO_QA_HEAD || (await import('node:child_process')).execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), manifest });
  console.log(JSON.stringify(reconcile(run, manifest, THEMES, WIDTHS), null, 2));
}
if (process.argv.includes('--self-test') || process.argv.length === 2) await runSelfTest(manifest);
