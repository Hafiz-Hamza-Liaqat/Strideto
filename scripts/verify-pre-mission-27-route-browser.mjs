import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildRouteInventory, highRiskRoute, materializeRoute, repoRoot } from './lib/preMission27RouteInventory.mjs';
import { mission26FixtureResponse } from './verify-mission-26-cross-role-ux.mjs';

const baseUrl = 'http://127.0.0.1:5187';
const cdpPort = 9387;
const browserCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(fn, timeout = 15_000) {
  const started = Date.now();
  let error;
  while (Date.now() - started < timeout) {
    try { const result = await fn(); if (result) return result; } catch (caught) { error = caught; }
    await delay(60);
  }
  throw error || new Error('Timed out waiting for local browser state');
}

class Cdp {
  constructor(url) { this.nextId = 1; this.pending = new Map(); this.handlers = new Map(); this.socket = new WebSocket(url); }
  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id); if (!pending) return;
        this.pending.delete(message.id);
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      } else for (const handler of this.handlers.get(message.method) || []) Promise.resolve(handler(message.params));
    });
  }
  on(method, handler) { this.handlers.set(method, [...(this.handlers.get(method) || []), handler]); }
  waitForEvent(method, timeout = 20_000) {
    return new Promise((resolve, reject) => {
      const handler = (params) => {
        clearTimeout(timer);
        this.handlers.set(method, (this.handlers.get(method) || []).filter((entry) => entry !== handler));
        resolve(params);
      };
      const timer = setTimeout(() => {
        this.handlers.set(method, (this.handlers.get(method) || []).filter((entry) => entry !== handler));
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeout);
      this.on(method, handler);
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  close() { this.socket.close(); }
}

const fixtureId = '507f1f77bcf86cd799439011';
const fixtureRecord = {
  _id: fixtureId, id: fixtureId, slug: 'fixture', title: 'Deterministic fixture record', name: 'Deterministic fixture record',
  status: 'active', state: 'active', description: 'Synthetic local browser fixture.', summary: 'Synthetic local browser fixture.',
  email: 'fixture@example.test', role: 'User', organizationId: 'fixture-organization', createdAt: '2026-08-01T00:00:00.000Z',
  purpose: 'Deterministic fixture consultation', requestedWindow: { start: '2026-08-20T09:00:00.000Z', end: '2026-08-20T09:45:00.000Z' },
  timezone: 'UTC', durationMinutes: 45, meetingMode: 'video', paymentState: 'not_configured', lifecycle: 'active',
  currentStage: 'document_collection', workflowVersion: 1, type: 'fixture', eventType: 'created', currency: 'PKR', amountMinor: 0,
  companyName: 'Fixture Employer', companySize: '1-10', professionalName: 'Fixture Advisor', agentType: 'agent', countryCode: 'PK',
  languages: [], destinationCountries: [], specialties: [], services: [], trustBadges: [], earnedBadges: [], requirements: [],
};
function fixtureResponse(rawUrl, method, realm) {
  const established = mission26FixtureResponse(rawUrl, method, realm.toLowerCase(), 'normal');
  const pathname = new URL(rawUrl).pathname;
  if (pathname === '/api/auth/refresh-token') return ['STUDENT', 'ADMIN'].includes(realm)
    ? [200, { accessToken: `fixture-${realm.toLowerCase()}` }]
    : [401, { error: 'No user fixture session' }];
  if (pathname === '/api/auth/me') return ['STUDENT', 'ADMIN'].includes(realm)
    ? [200, { user: { ...fixtureRecord, role: realm === 'ADMIN' ? 'SuperAdmin' : 'User', onboardingCompleted: true } }]
    : [401, { error: 'Authentication required' }];
  if (pathname === '/api/auth/employer/refresh-token') return realm === 'EMPLOYER' ? [200, { accessToken: 'fixture-employer' }] : [401, { error: 'Employer session required' }];
  if (pathname === '/api/employer/me') return realm === 'EMPLOYER'
    ? [200, { employer: { ...fixtureRecord, companyName: 'Fixture Employer', verificationStatus: 'verified' } }]
    : [403, { error: 'Employer realm required' }];
  if (pathname.includes('/auth/agent/refresh-token')) return realm === 'AGENT' ? [200, { accessToken: 'fixture-agent' }] : [401, { error: 'Agent session required' }];
  if (pathname.includes('/auth/agent/me')) return realm === 'AGENT'
    ? [200, { account: { ...fixtureRecord, verificationStatus: 'approved' }, memberships: [{ ...fixtureRecord, organizationId: 'fixture-organization', role: 'owner', active: true }] }]
    : [403, { error: 'Agent realm required' }];
  if (pathname === '/api/auth/institution/refresh-token') return realm === 'INSTITUTION' ? [200, { accessToken: 'fixture-institution' }] : [401, { error: 'Institution session required' }];
  if (pathname === '/api/auth/institution/me') return realm === 'INSTITUTION'
    ? [200, { account: { ...fixtureRecord, accountStatus: 'active' }, memberships: [{ ...fixtureRecord, organizationId: 'fixture-organization', role: 'owner', active: true }] }]
    : [403, { error: 'Institution realm required' }];
  if (pathname === '/api/agent/team') return [200, { members: [] }];
  if (pathname === '/api/agent/leads') return [200, { leads: [] }];
  if (pathname === '/api/agent/clients') return [200, { clients: [] }];
  if (pathname === '/api/agent/verification') return [200, { organizationId: 'fixture-organization', verificationStatus: 'draft', trustBadges: [] }];
  if (pathname === '/api/organizations/fixture-organization/verification') return [200, { status: 'draft', earnedBadges: [] }];
  if (pathname.includes('/marketplace-payments/connect/sync') || pathname.includes('/marketplace-payments/connect/status')) {
    return [200, { status: { providerKycStatus: 'not_started', chargesCapability: 'inactive', transfersCapability: 'inactive', ready: false, payoutsEnabled: false, requirementsSummary: [] } }];
  }
  if (pathname === '/api/admin/cms/homepage') return [200, { locale: 'en', hero: {}, sections: {}, stats: [] }];
  if (pathname === '/api/admin/cms/navigation') return [200, { locale: 'en', placement: 'header', items: [], columns: [], socialLinks: [] }];
  if (pathname === '/api/admin/cms/pages' || pathname === '/api/admin/cms/banners') return [200, { data: [], pagination: { page: 1, pages: 1, total: 0 } }];
  if (established[0] !== 200) return established;
  const fallback = {
    success: true, data: [], items: [], results: [], records: [], jobs: [], applications: [], candidates: [], programs: [],
    scholarships: [], admissions: [], posts: [], notifications: [], consultations: [], cases: [], documents: [], grants: [], plans: [],
    user: fixtureRecord, employer: fixtureRecord, account: fixtureRecord, organization: 'Fixture Organization', profile: fixtureRecord,
    job: fixtureRecord, application: fixtureRecord, program: 'Fixture Program', scholarship: 'Fixture Scholarship', institution: 'Fixture Institution',
    company: 'Fixture Company', country: 'Pakistan', level: 'Graduate', consultation: fixtureRecord,
    case: fixtureRecord, document: fixtureRecord, plan: fixtureRecord, counts: {}, stats: {}, metrics: {}, unreadCount: 0,
    history: [], workflow: { stages: [] }, tasks: [], documentRequests: [], approvals: [], timeline: [], threadId: fixtureId,
    reviews: [], reports: [], disputes: [], orders: [], transactions: [], messages: [], profiles: [], members: [], leads: [], clients: [],
    aggregate: { averageRating: null, reviewCount: 0 }, verifiedMeaning: 'Verified interaction only.',
    status: 'draft', organizationId: 'fixture-organization', verificationStatus: 'draft', trustBadges: [], earnedBadges: [],
    test: { ...fixtureRecord, providerId: null, shortName: 'FIXTURE', officialWebsite: '', formatSections: [] }, prepGuide: null, resources: [], alerts: [],
    form: { _id: fixtureId, name: 'Fixture form', slug: 'fixture-form', category: 'general', description: '', successMessage: 'Submitted', redirectUrl: '', fields: [], notifications: {}, spamSettings: {} },
    total: 0, totalPages: 1, page: 1, limit: 20, pagination: { page: 1, pages: 1, total: 0, limit: 20 },
  };
  return [200, { ...fallback, ...established[1] }];
}

const inventory = buildRouteInventory();
const onlyRealmDenials = process.env.STRIDETO_ONLY_REALM_DENIALS === '1';
const selectedRecords = onlyRealmDenials ? [] : process.env.STRIDETO_TARGET_ROUTE_PATTERN
  ? inventory.records.filter((record) => new RegExp(process.env.STRIDETO_TARGET_ROUTE_PATTERN, 'i').test(`${record.realm} ${record.route}`))
  : inventory.records;
const failures = [];
const checks = [];
const accessibilityFindings = [];
const controls = { cards: 0, forms: 0, filters: 0, sorting: 0, pagination: 0, counters: 0, search: 0, notifications: 0, progressTracking: 0 };
const addCheck = (condition, message) => { checks.push(message); if (!condition) failures.push(message); };

async function run() {
  const browser = browserCandidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(browser, 'a local Chrome or Edge binary is required');
  const profile = await mkdtemp(path.join(os.tmpdir(), 'strideto-targeted-routes-'));
  let vite; let chrome; let cdp;
  try {
    vite = spawn(process.execPath, [path.join(repoRoot, 'client', 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5187', '--strictPort'], {
      cwd: path.join(repoRoot, 'client'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let viteError = ''; vite.stderr.on('data', (chunk) => { viteError += chunk.toString(); });
    await waitFor(async () => { if (vite.exitCode != null) throw new Error(viteError); try { return (await fetch(baseUrl)).ok; } catch { return false; } });
    chrome = spawn(browser, [
      '--headless=new', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', '--disable-features=Translate',
      '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost', 'about:blank',
    ], { windowsHide: true, stdio: 'ignore' });
    const targets = await waitFor(async () => { try { const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`); return response.ok ? response.json() : null; } catch { return null; } });
    cdp = new Cdp(targets.find((target) => target.type === 'page').webSocketDebuggerUrl); await cdp.connect();
    let realm = 'PUBLIC'; let navigation = 0; const runtimeErrors = []; const externalRequests = []; const fixtureDecisions = [];
    cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => runtimeErrors.push({ navigation, text: exceptionDetails.exception?.description || exceptionDetails.text }));
    cdp.on('Fetch.requestPaused', async ({ requestId, request }) => {
      const url = new URL(request.url);
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.push(`${request.method} ${url.origin}${url.pathname}`);
      const [status, body] = fixtureResponse(request.url, request.method, realm);
      fixtureDecisions.push({ navigation, realm, path: url.pathname, status });
      await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [
        { name: 'Content-Type', value: 'application/json; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' },
        { name: 'Access-Control-Allow-Origin', value: baseUrl }, { name: 'Access-Control-Allow-Credentials', value: 'true' },
        { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Idempotency-Key' },
        { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
      ], body: Buffer.from(JSON.stringify(body)).toString('base64') });
    });
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Fetch.enable', { patterns: [
      { urlPattern: `${baseUrl}/api/*`, requestStage: 'Request' }, { urlPattern: 'http://localhost:5000/api/*', requestStage: 'Request' },
      { urlPattern: 'http://*/api/*', requestStage: 'Request' }, { urlPattern: 'https://*/api/*', requestStage: 'Request' },
    ] });

    let lastRealm = null;
    for (let recordIndex = 0; recordIndex < selectedRecords.length; recordIndex += 1) {
      const record = selectedRecords[recordIndex]; realm = record.realm;
      console.log(`route start ${recordIndex + 1}/${selectedRecords.length} ${record.realm} ${record.route}`);
      const route = materializeRoute(record.route); const viewports = [[320, 800], [768, 1024], [1440, 900]];
      if (highRiskRoute(record)) viewports.push([375, 812], [1024, 768]);
      record.browserEvidence = []; record.mobileEvidence = []; record.desktopEvidence = [];
      for (let viewportIndex = 0; viewportIndex < viewports.length; viewportIndex += 1) {
        const [width, height] = viewports[viewportIndex]; navigation += 1;
        await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
        const realmChanged = lastRealm !== realm || recordIndex === 0;
        const navigateRoute = viewportIndex === 0;
        if (navigateRoute && realmChanged) {
          const localDocument = await cdp.evaluate(`location.origin === ${JSON.stringify(baseUrl)}`);
          if (localDocument && realmChanged) await cdp.evaluate('localStorage.clear(); sessionStorage.clear()');
          const loaded = cdp.waitForEvent('Page.loadEventFired');
          await cdp.send('Page.navigate', { url: `${baseUrl}${route}` });
          await loaded;
          lastRealm = realm;
        } else if (navigateRoute) {
          await cdp.evaluate(`history.pushState({}, '', ${JSON.stringify(route)}); dispatchEvent(new PopStateEvent('popstate'))`);
          await waitFor(() => cdp.evaluate(`location.pathname === ${JSON.stringify(route)}`));
          await delay(150);
        }
        await waitFor(() => cdp.evaluate(`document.readyState === 'complete' && !!document.getElementById('root')`));
        try { await waitFor(() => cdp.evaluate(`document.body.innerText.trim().length >= 20 && !/^Loading(?:\u2026|\.\.\.)?$/i.test(document.body.innerText.trim())`), navigateRoute ? 40_000 : 2_000); }
        catch { /* the structural assertion below records any unresolved loading-only surface */ }
        await delay(40);
        const state = await cdp.evaluate(`(() => {
          const visible = (el) => (typeof el.checkVisibility === 'function' ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
          const scrollReachable = (el) => { let parent = el.parentElement; while (parent) { if (['auto','scroll'].includes(getComputedStyle(parent).overflowX) && parent.scrollWidth > parent.clientWidth) return true; parent = parent.parentElement; } return false; };
          const interactive = [...document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,[role="button"]')].filter(visible);
          const text = document.body.innerText.trim();
          const labelsMissing = [...document.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(visible).filter(el => !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.labels?.length && !el.placeholder).length;
          return {
            path: location.pathname, textLength: text.length, heading: document.querySelector('h1,h2,[role="heading"]')?.textContent?.trim() || '',
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            interactive: interactive.length,
            clippedControls: interactive.filter(el => { const r = el.getBoundingClientRect(); const intersects = r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; return intersects && !scrollReachable(el) && (r.right > innerWidth + 2 || r.left < -2); }).length,
            clipped: interactive.filter(el => { const r = el.getBoundingClientRect(); const intersects = r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; return intersects && !scrollReachable(el) && (r.right > innerWidth + 2 || r.left < -2); }).slice(0, 5).map(el => { const r = el.getBoundingClientRect(); return { tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }; }),
            cards: document.querySelectorAll('[class*="card"],[class*="rounded"][class*="border"]').length,
            forms: document.querySelectorAll('form').length,
            filters: [...document.querySelectorAll('button,label,select')].filter(el => /filter|clear|reset/i.test(el.textContent || el.getAttribute('aria-label') || '')).length,
            sorting: [...document.querySelectorAll('button,label,select')].filter(el => /sort/i.test(el.textContent || el.getAttribute('aria-label') || '')).length,
            pagination: [...document.querySelectorAll('button,a')].filter(el => /next|previous|page \d/i.test(el.textContent || el.getAttribute('aria-label') || '')).length,
            counters: [...document.querySelectorAll('[aria-label],span,div')].filter(el => /count|unread|total/i.test(el.getAttribute('aria-label') || '')).length,
            search: document.querySelectorAll('input[type="search"],input[placeholder*="search" i]').length,
            notifications: [...document.querySelectorAll('a,button,h1,h2')].filter(el => /notification|unread/i.test(el.textContent || el.getAttribute('aria-label') || '')).length,
            progress: [...document.querySelectorAll('[role="progressbar"],a,h1,h2')].filter(el => /progress|journey|tracking|pipeline/i.test(el.textContent || el.getAttribute('aria-label') || '')).length,
            labelsMissing,
          };
        })()`);
        const label = `${record.realm} ${record.route} ${width}x${height}`;
        const errors = runtimeErrors.filter((entry) => entry.navigation === navigation);
        addCheck(state.path === route, `${label}: route remains loaded`);
        addCheck(state.textLength >= 20 && Boolean(state.heading || state.interactive), `${label}: primary content exists`);
        addCheck(errors.length === 0, `${label}: no uncaught runtime error${errors[0] ? ` (${errors[0].text})` : ''}`);
        addCheck(state.overflow <= 2, `${label}: no page-level horizontal overflow (${state.overflow}px)`);
        addCheck(state.clippedControls === 0, `${label}: primary controls fit viewport`);
        const evidence = { viewport: `${width}x${height}`, passed: errors.length === 0 && state.overflow <= 2 && state.clippedControls === 0 && state.textLength >= 20, heading: state.heading, actualPath: state.path, overflow: state.overflow, clippedControls: state.clippedControls, clipped: state.clipped, textLength: state.textLength, runtimeErrors: errors.map((entry) => entry.text) };
        record.browserEvidence.push(evidence); (width < 768 ? record.mobileEvidence : record.desktopEvidence).push(evidence);
        for (const key of Object.keys(controls)) {
          const sourceKey = key === 'progressTracking' ? 'progress' : key;
          controls[key] += state[sourceKey] || 0;
        }
        if (state.forms && state.labelsMissing) accessibilityFindings.push({ route: record.route, realm: record.realm, viewport: `${width}x${height}`, missingAccessibleNames: state.labelsMissing });
      }
    }

    // Shared guard denial: each authenticated realm is denied by every other realm's representative route.
    const representative = { STUDENT: '/dashboard', EMPLOYER: '/employer', AGENT: '/agent', INSTITUTION: '/institution', ADMIN: '/admin' };
    let realmDenials = 0; const realmDenialFailures = [];
    const denialRealms = process.env.STRIDETO_TARGET_ROUTE_PATTERN && !onlyRealmDenials ? [] : Object.keys(representative);
    for (const sourceRealm of denialRealms) for (const [targetRealm, route] of Object.entries(representative)) {
      if (sourceRealm === targetRealm) continue;
      realm = sourceRealm; navigation += 1;
      if (!await cdp.evaluate(`location.origin === ${JSON.stringify(baseUrl)}`)) {
        const initialized = cdp.waitForEvent('Page.loadEventFired');
        await cdp.send('Page.navigate', { url: baseUrl }); await initialized;
      }
      await cdp.evaluate('localStorage.clear(); sessionStorage.clear()');
      await cdp.evaluate(`history.pushState({}, '', ${JSON.stringify(route)}); dispatchEvent(new PopStateEvent('popstate'))`); await delay(150);
      await waitFor(() => cdp.evaluate(`document.readyState === 'complete' && !!document.getElementById('root')`));
      let denied = false;
      try { denied = await waitFor(() => cdp.evaluate(`location.pathname !== ${JSON.stringify(route)} || /login|log in|sign in|access denied|not authorized|forbidden|insufficient|permission/i.test(document.body.innerText)`), 10_000); }
      catch { denied = false; }
      const deniedAuthRequests = fixtureDecisions.filter((entry) => entry.navigation === navigation && entry.status >= 401 && entry.status <= 403 && /auth|refresh|\/me(?:\/|$)/i.test(entry.path));
      if (!denied && deniedAuthRequests.length) {
        const protectedContentAbsent = await cdp.evaluate(`!/(fixture employer|fixture advisor|admin control|student dashboard|institution dashboard)/i.test(document.body.innerText)`);
        denied = protectedContentAbsent;
      }
      addCheck(denied, `${sourceRealm} fixture denied from ${targetRealm} route ${route}`); if (denied) realmDenials += 1; else {
        const observed = await cdp.evaluate(`({ path: location.pathname, text: document.body.innerText.trim().slice(0, 240) })`);
        realmDenialFailures.push({ sourceRealm, targetRealm, route, observed, deniedAuthRequests });
      }
    }
    addCheck(externalRequests.length === 0, 'browser emitted no external request');
    inventory.realmTotals = Object.fromEntries(['PUBLIC', 'STUDENT', 'EMPLOYER', 'AGENT', 'INSTITUTION', 'ADMIN'].map((name) => [name, inventory.records.filter((record) => record.realm === name).length]));
    inventory.browserSummary = { routeRecords: selectedRecords.length, viewportCombinations: selectedRecords.reduce((sum, record) => sum + record.browserEvidence.length, 0), assertions: checks.length, failures: failures.length, realmDenials, realmDenialFailures, controls, accessibilityFindings: accessibilityFindings.length, accessibilityRoutes: [...new Set(accessibilityFindings.map((item) => item.route))], externalRequests: externalRequests.length };
    const matrixPath = path.join(repoRoot, '.tmp', 'pre-mission27-route-browser-matrix.json');
    await mkdir(path.dirname(matrixPath), { recursive: true }); await writeFile(matrixPath, JSON.stringify(inventory, null, 2));
    console.log(JSON.stringify({ ...inventory.browserSummary, realmTotals: inventory.realmTotals, matrix: path.relative(repoRoot, matrixPath).replaceAll('\\', '/') }, null, 2));
    if (failures.length) {
      console.error(JSON.stringify({ failures: failures.slice(0, 100), omitted: Math.max(0, failures.length - 100) }, null, 2)); process.exitCode = 1;
    }
  } finally {
    cdp?.close();
    if (chrome && chrome.exitCode == null) { chrome.kill(); await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(2_000)]); }
    if (vite && vite.exitCode == null) { vite.kill(); await Promise.race([new Promise((resolve) => vite.once('exit', resolve)), delay(2_000)]); }
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try { await rm(profile, { recursive: true, force: true }); break; }
      catch (error) { if (attempt === 3) throw error; await delay(300); }
    }
  }
}

run().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
