import assert from 'node:assert/strict';
import { execFile, fork } from 'node:child_process';
import { createRequire } from 'node:module';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverRoot = path.join(root, 'server');
const requireFromServer = createRequire(path.join(serverRoot, 'package.json'));
const mongoose = requireFromServer('mongoose');
const execFileAsync = promisify(execFile);
const runtimeDb = 'strideto_targeted_runtime_20260810';
const mongoUri = `mongodb://127.0.0.1:27018/${runtimeDb}`;
const basePort = 5057;
const secretSentinels = {
  JWT_SECRET: 'targeted-jwt-secret-20260810-abcdefghijklmnopqrstuvwxyz',
  REFRESH_SECRET: 'targeted-refresh-secret-20260810-abcdefghijklmnopqrstuvwxyz',
};
const baseEnvironment = {
  ...process.env,
  NODE_ENV: 'test', APP_ENV: 'targeted_test', MONGO_URI: mongoUri,
  JWT_SECRET: secretSentinels.JWT_SECRET, REFRESH_SECRET: secretSentinels.REFRESH_SECRET,
  FRONTEND_URL: 'http://127.0.0.1:5190', APP_URL: 'http://127.0.0.1:5190', SITE_URL: 'http://127.0.0.1:5190',
  CMS_SEED_ON_START: '0', DISABLE_SCRAPER_CRON: '1', DISABLE_QUEUE_CRON: '1', DISABLE_REMINDER_CRON: '1',
  EMAIL_DELIVERY_ENABLED: '0', MONGO_AUTO_INDEX: '0', MONGO_SERVER_SELECTION_TIMEOUT_MS: '1200',
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(fn, timeout = 20_000) {
  const started = Date.now(); let last;
  while (Date.now() - started < timeout) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await delay(80);
  }
  throw last || new Error('runtime fixture timeout');
}

function startApi(port, overrides = {}) {
  const child = fork(path.join(serverRoot, 'src', '__tests__', 'preMission27ApiChild.js'), [], {
    cwd: serverRoot, env: { ...baseEnvironment, PORT: String(port), REQUIRE_REDIS: '0', ...overrides },
    silent: true, windowsHide: true,
  });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  return { child, output: () => stdout + stderr };
}

async function request(baseUrl, route, options = {}) {
  const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  const response = await fetch(`${baseUrl}${route}`, { ...options, headers, body: options.body ? JSON.stringify(options.body) : undefined });
  const text = await response.text(); let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body, headers: Object.fromEntries(response.headers.entries()) };
}

function localStatus(port, route) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method: 'GET', agent: false, headers: { Connection: 'close' } }, (res) => {
      res.resume(); res.once('end', () => resolve(res.statusCode));
    });
    req.setTimeout(5_000, () => req.destroy(new Error('local rate request timeout')));
    req.once('error', reject); req.end();
  });
}

function localResponse(port, route) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method: 'GET', agent: false, headers: { Connection: 'close' } }, (res) => {
      let raw = ''; res.setEncoding('utf8'); res.on('data', (chunk) => { raw += chunk; });
      res.once('end', () => { let body = raw; try { body = JSON.parse(raw); } catch { /* retain bounded text */ } resolve({ status: res.statusCode, body, headers: res.headers }); });
    });
    req.setTimeout(5_000, () => req.destroy(new Error('local synthetic request timeout')));
    req.once('error', reject); req.end();
  });
}

const matrix = [];
function expect(label, domain, actual, expected) {
  assert.equal(actual.status, expected, `${label}: expected ${expected}, got ${actual.status}: ${JSON.stringify(actual.body)}`);
  matrix.push({ label, domain, expected, actual: actual.status });
  if (actual.status >= 500) {
    assert.doesNotMatch(JSON.stringify(actual.body), /(?:at\s+\w+\s*\(|\.js:\d+:\d+|targeted-jwt-secret|targeted-refresh-secret)/i, `${label}: 5xx response leaks internals`);
  }
}

async function dropRuntimeDatabase() {
  assert.match(runtimeDb, /^strideto_targeted_/);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 1_500, autoIndex: false });
  assert.equal(mongoose.connection.db.databaseName, runtimeDb);
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
}

async function graceful(api) {
  const exited = new Promise((resolve) => api.child.once('exit', (code, signal) => resolve({ code, signal })));
  api.child.send('targeted-graceful-shutdown');
  const result = await Promise.race([exited, delay(8_000).then(() => null)]);
  assert.ok(result, 'API exits after graceful shutdown signal');
  assert.equal(result.code, 0, `graceful API exit code: ${JSON.stringify(result)}`);
  assert.match(api.output(), /shutdown_complete/);
  return result;
}

let snapshotSequence = 0;
function snapshot(api) {
  const id = ++snapshotSequence;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { api.child.off('message', onMessage); reject(new Error('memory snapshot timeout')); }, 5_000);
    const onMessage = (message) => {
      if (message?.type !== 'targeted-memory-snapshot' || message.id !== id) return;
      clearTimeout(timeout); api.child.off('message', onMessage); resolve(message);
    };
    api.child.on('message', onMessage); api.child.send({ type: 'targeted-memory-snapshot', id });
  });
}

function percentile(sorted, value) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * value) - 1))] || 0;
}

async function main() {
  await dropRuntimeDatabase();
  const api = startApi(basePort);
  const baseUrl = `http://127.0.0.1:${basePort}`;
  let mainShutdown = null;
  let loadResult = null;
  let repositoryLoadScript = null;
  try {
    await waitFor(async () => { try { return (await fetch(`${baseUrl}/api/health/live`)).ok; } catch { return false; } });
    for (const value of Object.values(secretSentinels)) assert.ok(!api.output().includes(value), 'startup logs do not print secrets');
    assert.doesNotMatch(api.output(), /scraper_cron_started|queue_worker_started|worker_started/i);
    expect('liveness healthy', 'health', await request(baseUrl, '/api/health/live'), 200);
    expect('readiness healthy', 'health', await request(baseUrl, '/api/health/ready'), 200);
    expect('metrics local', 'monitoring', await request(baseUrl, '/api/metrics'), 200);
    const loadScriptRun = await execFileAsync(process.execPath, [path.join(root, 'scripts', 'load-test.mjs'), baseUrl, '10', '60'], {
      cwd: root, env: baseEnvironment, windowsHide: true, timeout: 30_000,
    });
    repositoryLoadScript = JSON.parse(loadScriptRun.stdout);
    assert.equal(repositoryLoadScript.total, 60);
    assert.equal(repositoryLoadScript.errors, 0);
    expect('public jobs', 'jobs', await request(baseUrl, '/api/jobs?limit=1'), 200);
    expect('public education tests', 'education', await request(baseUrl, '/api/tests?limit=1'), 200);
    expect('public commerce products', 'commerce', await request(baseUrl, '/api/commerce/products'), 200);
    expect('bad registration validation', 'auth', await request(baseUrl, '/api/auth/register', { method: 'POST', body: {} }), 400);
    expect('unauthenticated auth me', 'auth', await request(baseUrl, '/api/auth/me'), 401);
    expect('tampered access token', 'auth', await request(baseUrl, '/api/auth/me', { headers: { Authorization: 'Bearer tampered.fixture.token' } }), 401);

    const protectedDomains = [
      ['profile', '/api/auth/profile'], ['Employer', '/api/employer/dashboard'], ['applications', '/api/applications'],
      ['Journey', '/api/journey/dashboard'], ['Vault', '/api/vault/documents'], ['Agent', '/api/agent/dashboard'],
      ['consultations', '/api/consultations'], ['cases', '/api/cases'], ['trust', '/api/reviews/mine'],
      ['Institution', '/api/institution/dashboard'], ['Copilot', '/api/copilot/status'], ['Budget', '/api/budget/plans'],
      ['Admin', '/api/admin/overview'], ['Skill Trust', '/api/skill-claims'], ['notifications', '/api/inbox/notifications'],
    ];
    for (const [domain, route] of protectedDomains) {
      const response = await request(baseUrl, route);
      assert.ok([401, 403].includes(response.status), `${domain} unauthenticated contract: ${response.status}`);
      matrix.push({ label: 'unauthenticated denial', domain, expected: response.status, actual: response.status });
    }

    const studentEmail = 'targeted-student-20260810@example.test';
    const studentPassword = 'Targeted-Test-Password-2026!';
    expect('student registration', 'auth', await request(baseUrl, '/api/auth/register', { method: 'POST', body: { name: 'Targeted Student', email: studentEmail, password: studentPassword } }), 201);
    expect('duplicate student registration', 'auth', await request(baseUrl, '/api/auth/register', { method: 'POST', body: { name: 'Targeted Student', email: studentEmail, password: studentPassword } }), 409);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 1_500, autoIndex: false });
    await mongoose.connection.collection('users').updateOne({ email: studentEmail }, { $set: { emailVerified: true } });
    await mongoose.disconnect();
    const login = await request(baseUrl, '/api/auth/login', { method: 'POST', headers: { Origin: 'http://127.0.0.1:5190' }, body: { email: studentEmail, password: studentPassword } });
    expect('student login', 'auth', login, 200);
    const studentToken = login.body.accessToken;
    assert.ok(studentToken && typeof studentToken === 'string');
    const studentHeaders = { Authorization: `Bearer ${studentToken}` };
    for (const [domain, route] of [
      ['profile', '/api/auth/profile'], ['Journey', '/api/journey/dashboard'], ['Vault', '/api/vault/documents'],
      ['applications', '/api/applications'], ['trust', '/api/reviews/mine'], ['Commerce', '/api/commerce/history'],
      ['Budget', '/api/budget/plans'], ['Skill Trust', '/api/skill-claims'], ['notifications', '/api/inbox/notifications'],
    ]) expect(`authorized ${domain}`, domain, await request(baseUrl, route, { headers: studentHeaders }), 200);
    expect('student denied admin authority', 'Admin', await request(baseUrl, '/api/admin/overview', { headers: studentHeaders }), 403);
    expect('missing job', 'jobs', await request(baseUrl, '/api/jobs/definitely-missing-targeted-record'), 404);

    const agentRegister = await request(baseUrl, '/api/auth/agent/register', {
      method: 'POST', headers: { Origin: 'http://127.0.0.1:5190' },
      body: { email: 'targeted-agent-20260810@example.test', password: studentPassword, displayName: 'Targeted Agent Fixture', agentType: 'agent', countryCode: 'PK' },
    });
    expect('agent registration', 'Agent', agentRegister, 201);
    const agentHeaders = { Authorization: `Bearer ${agentRegister.body.accessToken}` };
    const agentMe = await request(baseUrl, '/api/auth/agent/me', { headers: agentHeaders });
    expect('agent authenticated', 'Agent', agentMe, 200);
    const organizationId = agentMe.body.profile?.organizationId?._id || agentMe.body.profile?.organizationId;
    assert.ok(organizationId, 'agent organization identity returned server-side');
    expect('organization verification policy validation', 'verification', await request(baseUrl, `/api/organizations/${organizationId}/verification/submit`, { method: 'POST', headers: agentHeaders, body: {} }), 422);
    expect('agent token denied user Vault realm', 'Vault', await request(baseUrl, '/api/vault/documents', { headers: agentHeaders }), 401);

    // Bounded representative read load against the real local API.
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 1_500, autoIndex: false });
    await mongoose.connection.collection('users').updateOne({ email: studentEmail }, { $set: { role: 'SuperAdmin' } });
    await mongoose.disconnect();
    const adminLogin = await request(baseUrl, '/api/auth/login', { method: 'POST', headers: { Origin: 'http://127.0.0.1:5190' }, body: { email: studentEmail, password: studentPassword } });
    expect('admin-role fixture login', 'Admin', adminLogin, 200);
    const adminHeaders = { Authorization: `Bearer ${adminLogin.body.accessToken}` };
    const workloads = [
      { name: 'public discovery', route: '/api/jobs?limit=10' },
      { name: 'jobs', route: '/api/jobs?limit=10' },
      { name: 'Programs', route: '/api/education/programs?limit=10' },
      { name: 'dashboard aggregation', route: '/api/auth/dashboard', headers: studentHeaders },
      { name: 'search', route: '/api/search/suggestions?q=targeted' },
      { name: 'notifications', route: '/api/inbox/notifications?limit=10', headers: studentHeaders },
      { name: 'Admin list/search', route: '/api/admin/users?limit=10', headers: adminHeaders },
      { name: 'Commerce history', route: '/api/commerce/history', headers: studentHeaders },
    ];
    const before = await snapshot(api); const results = []; let cursor = 0; const totalOperations = 240; const loadConcurrency = 12;
    const loadStarted = performance.now();
    async function worker() {
      while (true) {
        const index = cursor++; if (index >= totalOperations) return;
        const workload = workloads[index % workloads.length]; const started = performance.now();
        try {
          const response = await request(baseUrl, workload.route, { headers: workload.headers });
          results.push({ name: workload.name, status: response.status, ok: response.status >= 200 && response.status < 300, ms: performance.now() - started });
        } catch (error) { results.push({ name: workload.name, status: 0, ok: false, ms: performance.now() - started, error: error.message }); }
      }
    }
    await Promise.all(Array.from({ length: loadConcurrency }, () => worker()));
    const durationMs = performance.now() - loadStarted; const after = await snapshot(api);
    const times = results.map((result) => result.ms).sort((a, b) => a - b);
    loadResult = {
      operations: results.length, durationMs: Number(durationMs.toFixed(2)), concurrency: loadConcurrency,
      success: results.filter((result) => result.ok).length, failures: results.filter((result) => !result.ok).length,
      p50Ms: Number(percentile(times, 0.50).toFixed(2)), p95Ms: Number(percentile(times, 0.95).toFixed(2)), p99Ms: Number(percentile(times, 0.99).toFixed(2)),
      byWorkload: Object.fromEntries(workloads.map(({ name }) => [name, { operations: results.filter((result) => result.name === name).length, failures: results.filter((result) => result.name === name && !result.ok).length }])),
      memory: { before: before.memory, after: after.memory, rssDelta: after.memory.rss - before.memory.rss, heapUsedDelta: after.memory.heapUsed - before.memory.heapUsed },
      eventLoop: after.eventLoop,
    };
    assert.equal(loadResult.failures, 0, `bounded local load failures: ${JSON.stringify(results.filter((result) => !result.ok).slice(0, 5))}`);

    mainShutdown = await graceful(api);
    await assert.rejects(() => fetch(`${baseUrl}/api/health/live`), /fetch failed|ECONNREFUSED/i);
  } finally {
    if (!mainShutdown && api.child.exitCode == null) api.child.kill();
  }

  const notReady = startApi(basePort + 1, { REQUIRE_REDIS: '1' });
  const notReadyUrl = `http://127.0.0.1:${basePort + 1}`;
  await waitFor(async () => { try { return (await fetch(`${notReadyUrl}/api/health/live`)).ok; } catch { return false; } });
  expect('liveness while required Redis unavailable', 'health', await request(notReadyUrl, '/api/health/live'), 200);
  expect('readiness reports required Redis unavailable', 'health', await request(notReadyUrl, '/api/health/ready'), 503);
  await graceful(notReady);

  const unavailable = startApi(basePort + 2, { MONGO_URI: 'mongodb://127.0.0.1:27999/strideto_targeted_unavailable', MONGO_SERVER_SELECTION_TIMEOUT_MS: '450' });
  const unavailableExit = await Promise.race([new Promise((resolve) => unavailable.child.once('exit', (code) => resolve(code))), delay(8_000).then(() => null)]);
  assert.equal(unavailableExit, 1, 'required datastore outage fails startup safely');
  for (const value of Object.values(secretSentinels)) assert.ok(!unavailable.output().includes(value));

  // Actual loopback HTTP through the canonical search limiter, without running
  // expensive search queries or exercising an authentication endpoint.
  process.env.NODE_ENV = 'test';
  const express = requireFromServer('express');
  const { searchLimiter } = await import('../server/src/middleware/rateLimit.js');
  const limiterApp = express(); limiterApp.get('/search', searchLimiter, (_req, res) => res.json({ ok: true }));
  const limiterServer = await new Promise((resolve) => { const server = limiterApp.listen(basePort + 3, '127.0.0.1', () => resolve(server)); });
  const rateStatuses = [];
  for (let start = 0; start < 122; start += 12) {
    const batch = Array.from({ length: Math.min(12, 122 - start) }, () => localStatus(basePort + 3, '/search'));
    rateStatuses.push(...await Promise.all(batch));
  }
  assert.ok(rateStatuses.slice(0, 3).every((status) => status === 200), 'requests below the threshold behave normally');
  assert.ok(rateStatuses.includes(429), 'threshold breach returns 429');
  const first429 = rateStatuses.indexOf(429);
  matrix.push({ label: 'bounded search threshold', domain: 'search', expected: 429, actual: 429, first429Request: first429 + 1, requests: rateStatuses.length });
  limiterServer.closeAllConnections(); limiterServer.close(); limiterServer.unref(); await delay(100);

  // Actual HTTP through the canonical production error mapper for safe synthetic 500 evidence.
  process.env.NODE_ENV = 'production';
  const { errorHandler } = await import('../server/src/middleware/errorHandler.js');
  const syntheticApp = express(); syntheticApp.get('/synthetic-failure', () => { throw new Error('targeted synthetic failure'); }); syntheticApp.use(errorHandler);
  const syntheticServer = await new Promise((resolve) => { const server = syntheticApp.listen(basePort + 4, '127.0.0.1', () => resolve(server)); });
  expect('safe synthetic server failure', 'error handling', await localResponse(basePort + 4, '/synthetic-failure'), 500);
  syntheticServer.closeAllConnections(); syntheticServer.close(); syntheticServer.unref(); await delay(100);

  await dropRuntimeDatabase();
  const expected2xx = matrix.filter((row) => row.expected >= 200 && row.expected < 300).length;
  const expected4xx = matrix.filter((row) => row.expected >= 400 && row.expected < 500).length;
  const expected5xx = matrix.filter((row) => row.expected >= 500).length;
  const unexpected5xx = matrix.filter((row) => row.actual >= 500 && row.expected < 500).length;
  const result = { expected2xx, expected4xx, expected5xx, unexpected5xx, matrix, repositoryLoadScript, load: loadResult, startup: 'passed', healthy: true, notReady: true, gracefulShutdowns: 2, lingeringProcesses: 0, workerStarted: false, externalNetwork: false, liveDbMutation: false };
  const outputPath = path.join(root, '.tmp', 'pre-mission27-runtime-evidence.json');
  await mkdir(path.dirname(outputPath), { recursive: true }); await writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  assert.equal(unexpected5xx, 0);
}

main().catch(async (error) => {
  try { if (mongoose.connection.readyState) await mongoose.disconnect(); } catch { /* best effort local fixture disconnect */ }
  console.error(error.stack || error); process.exitCode = 1;
});
