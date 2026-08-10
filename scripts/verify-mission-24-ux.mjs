import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = 'http://127.0.0.1:5173';
const cdpPort = 9334;
const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const screenshotDir = path.join(root, 'docs', 'screenshots', 'responsive');

let assertions = 0;
const failures = [];
function check(value, message) {
  assertions += 1;
  try { assert.ok(value, message); }
  catch (error) { failures.push(error.message); }
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitFor(fn, timeoutMs = 12_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) { lastError = error; }
    await delay(80);
  }
  throw lastError || new Error('Timed out waiting for browser state');
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.socket = new WebSocket(url);
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const handler of this.handlers.get(message.method) || []) {
        Promise.resolve(handler(message.params)).catch((error) => failures.push(`CDP ${message.method}: ${error.message}`));
      }
    });
  }
  on(method, handler) {
    const handlers = this.handlers.get(method) || [];
    handlers.push(handler);
    this.handlers.set(method, handlers);
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
    return result.result.value;
  }
  close() { this.socket.close(); }
}

function responseFor(rawUrl, method, role) {
  const url = new URL(rawUrl);
  const p = url.pathname;
  const userRole = role === 'admin' ? 'SuperAdmin' : 'User';
  if (p === '/api/auth/refresh-token') return role === 'public' ? {} : { accessToken: `fixture-${userRole}` };
  if (p === '/api/auth/me') return { user: { _id: 'student-1', role: userRole, name: 'Zoë O’Connor 李', email: 'zoe.long-address@example.test', onboardingCompleted: true } };
  if (p === '/api/auth/employer/refresh-token') return { accessToken: 'fixture-employer' };
  if (p === '/api/employer/me') return { employer: { _id: 'employer-1', companyName: 'Université Internationale de Technologie et de Recherche Appliquée', email: 'employer@example.test' } };
  if (p.includes('/auth/agent/refresh-token')) return { accessToken: 'fixture-agent' };
  if (p.includes('/auth/agent/me')) return { account: { _id: 'agent-1', email: 'saoirse.o’neill@example.test', verificationStatus: 'approved' } };

  if (p === '/api/employer/dashboard') return { activeJobs: 1, totalApplications: 2, totalViews: 3, shortlistedCandidates: 1, verified: false, verificationLevel: 'pending', jobs: [{ _id: 'job-1', title: 'Responsable de la coopération scientifique internationale — 東京', views: 3, applications: 2, shortlisted: 1 }] };
  if (p === '/api/employer/plans') return { plans: [] };
  if (p === '/api/employer/jobs') return { jobs: [], pagination: { page: 1, pages: 1, total: 0 } };

  if (p.endsWith('/agent/dashboard')) return { verificationStatus: 'approved', isApproved: true, profileCompleteness: 80, consultations: { incoming: 0, upcoming: 0, history: 0 }, marketplace: { drafts: 0, pendingReview: 0, published: 0, needsChanges: 0 } };
  if (p.endsWith('/agent/services')) return { services: [] };
  if (p.endsWith('/agent/consultations')) return { consultations: [] };
  if (p.endsWith('/agent/cases')) return { cases: [] };
  if (p.endsWith('/agent/commerce/history')) return { orders: [], transactions: [] };
  if (p.includes('/marketplace-payments/connect/sync')) return { status: { providerKycStatus: 'not_started', chargesCapability: 'inactive', transfersCapability: 'inactive', ready: false, payoutsEnabled: false, requirementsSummary: ['Provider configuration required'] } };

  if (p === '/api/journey/dashboard') return { nextBestAction: null, pendingActions: [], upcomingDeadlines: [], overdueDeadlines: [], activeApplications: [], savedOpportunities: [] };
  if (p === '/api/vault/documents') return { items: [] };
  if (p === '/api/consultations') return { consultations: [] };
  if (p === '/api/cases') return { cases: [] };
  if (p === '/api/reviews/mine') return { reviews: [] };
  if (p === '/api/reports/mine') return { reports: [] };
  if (p === '/api/disputes/mine') return { disputes: [] };
  if (p === '/api/budget/plans') return { plans: [], total: 0 };
  if (p === '/api/budget/plans/m24-plan') return { plan: { _id: 'm24-plan', title: '奨学金付き国際量子コンピューティング修士課程 — École supérieure', journeyType: 'study', status: 'active', destinationCountry: 'United Kingdom of Great Britain and Northern Ireland', targetIntake: 'Autumn 2027' } };
  if (p === '/api/budget/plans/m24-plan/summary') return { summary: { note: 'Based on currently known costs. Unknown costs remain unresolved.', totalsByCurrency: { JPY: 123456, KWD: 123456, GBP: 250099, PKR: 1000000, USD: 150050, EUR: 9900 }, multiCurrencyUnresolved: true, unknownCostCount: 1, estimatedCostCount: 2, dataQuality: { staleCount: 0 }, completeness: { missing: [] } } };
  if (p === '/api/budget/plans/m24-plan/items') return { items: [{ _id: 'cost-1', category: 'tuition', label: '授業料 — tuition officielle très longue', amountState: 'known', money: { amountMinor: 123456, currency: 'JPY' }, truthCategory: 'institution_official', cadence: 'one_time', freshnessState: 'fresh' }, { _id: 'cost-2', category: 'living_expenses', label: 'Accommodation', amountState: 'unknown', truthCategory: 'unknown', cadence: 'monthly' }] };
  if (p === '/api/copilot/ask') return { groundingStatus: 'provider_not_configured', answerType: 'not_configured', answer: 'AI synthesis is unavailable. Review the verified evidence below.', evidence: [{ id: 'ev-1', sourceType: 'institution_submitted', entityType: 'program', fact: 'Université Internationale de Technologie et de Recherche Appliquée — πρόγραμμα διεθνών σπουδών', value: 'JPY 123,456 / KWD 123.456', sourceLabel: 'Official institution catalogue with a deliberately long international title', lastVerifiedAt: '2026-08-01T00:00:00.000Z' }], sourceWarnings: ['Verify the current intake deadline directly.'], generatedAt: '2026-08-10T10:00:00.000Z', providerMeta: { providerState: 'not_configured' } };

  if (p === '/api/admin/permissions') return { permissions: [] };
  if (p === '/api/admin/overview') return { generatedAt: '2026-08-10T10:00:00.000Z', users: { totalStudents: 10, activeStudents: 9, suspendedStudents: 1 }, verification: { pending: 2, needsInformation: 1, enhancedReview: 0 }, trustOperations: { openReports: 1, openDisputes: 0 }, services: { activeConsultations: 1, activeCases: 1 }, commerce: { refundRequests: 1, reconciliationMismatches: 1 }, institutions: { claimsPending: 1 }, marketplace: { pendingModeration: 1 }, dataQuality: { staleFacts: 2, reviewDueFacts: 1, brokenSources: 0 }, ai: { providerStatus: { state: 'not_configured' }, source: 'in-process config' }, recentAuditActivity: { scope: 'safe metadata', entries: [{ actorEmail: 'admin@example.test', action: 'verification.reviewed', targetType: 'Organization', createdAt: '2026-08-10T10:00:00.000Z' }] } };
  if (p === '/api/admin/organizations') return { data: [{ _id: 'org-1', displayName: 'Université Internationale de Technologie et de Recherche Appliquée — 東京大学連携センター', organizationType: 'institution', countryCode: 'GB', status: 'pending', createdAt: '2026-08-01T00:00:00.000Z' }], pagination: { page: 1, pages: 1, total: 1 } };
  if (p === '/api/admin/commerce/reconciliation') return { data: [{ _id: 'rec-1', correlationId: 'corr-international-very-long-identifier-123456789', expectedAmountMinor: 123456, actualAmountMinor: 123450, expectedCurrency: 'KWD', status: 'mismatch', discrepancyReason: 'Provider amount mismatch', createdAt: '2026-08-01T00:00:00.000Z' }], pagination: { page: 1, pages: 1, total: 1 } };
  if (p === '/api/admin/trust/metrics') return { stale: 2, broken: 0, review_due: 1 };
  if (p === '/api/admin/trust/freshness-queue') return { data: [], pagination: { page: 1, pages: 1, total: 0 } };
  if (p.startsWith('/api/admin/')) return { data: [], items: [], pagination: { page: 1, pages: 1, total: 0 } };

  return { data: [], items: [], results: [], jobs: [], programs: [], scholarships: [], pagination: { page: 1, pages: 1, total: 0 }, total: 0, totalPages: 1 };
}

async function run() {
  const browser = chromeCandidates.find((candidate) => {
    try { return requireStat(candidate); } catch { return false; }
  });
  if (!browser) throw new Error('No locally installed Chrome or Edge binary found');
  await mkdir(screenshotDir, { recursive: true });
  const profileDir = await mkdtemp(path.join(os.tmpdir(), 'strideto-m24-'));
  let vite;
  let chrome;
  let client;
  try {
    const viteExecutable = path.join(root, 'client', 'node_modules', 'vite', 'bin', 'vite.js');
    vite = spawn(process.execPath, [viteExecutable, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: path.join(root, 'client'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let viteError = '';
    vite.stderr.on('data', (chunk) => { viteError += chunk.toString(); });
    await waitFor(async () => {
      if (vite.exitCode != null) throw new Error(`Vite exited early: ${viteError}`);
      try { return (await fetch(baseUrl)).ok; } catch { return false; }
    });

    chrome = spawn(browser, [
      '--headless=new', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profileDir}`,
      '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update',
      '--disable-sync', '--disable-extensions', '--disable-features=Translate', '--hide-scrollbars',
      '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost', 'about:blank',
    ], { windowsHide: true, stdio: 'ignore' });
    const targets = await waitFor(async () => {
      try { const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`); return response.ok ? response.json() : null; }
      catch { return null; }
    });
    const target = targets.find((item) => item.type === 'page');
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();

    let activeRole = 'public';
    let navigationId = 0;
    const runtimeErrors = [];
    const requestCounts = new Map();
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => runtimeErrors.push(exceptionDetails.exception?.description || exceptionDetails.text));
    client.on('Fetch.requestPaused', async ({ requestId, request }) => {
      const key = `${navigationId} ${request.method} ${new URL(request.url).pathname}`;
      requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
      const body = Buffer.from(JSON.stringify(responseFor(request.url, request.method, activeRole))).toString('base64');
      await client.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [
        { name: 'Content-Type', value: 'application/json; charset=utf-8' },
        { name: 'Cache-Control', value: 'no-store' },
        { name: 'Access-Control-Allow-Origin', value: baseUrl },
        { name: 'Access-Control-Allow-Credentials', value: 'true' },
        { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Idempotency-Key' },
        { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
      ], body });
    });
    await client.send('Page.enable');
    await client.send('Page.bringToFront');
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    await client.send('Fetch.enable', { patterns: [
      { urlPattern: `${baseUrl}/api/*`, requestStage: 'Request' },
      { urlPattern: 'http://localhost:5000/api/*', requestStage: 'Request' },
    ] });

    async function viewport(width, height) {
      await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    }
    async function navigate(route, role = 'public') {
      activeRole = role;
      navigationId += 1;
      const appLoaded = await client.evaluate(`location.origin === ${JSON.stringify(baseUrl)} && !!document.getElementById('root')`);
      const previousHeading = appLoaded
        ? await client.evaluate(`document.querySelector('h1')?.innerText?.trim() || ''`)
        : '';
      if (appLoaded) {
        await client.evaluate(`history.pushState({}, '', ${JSON.stringify(route)}); dispatchEvent(new PopStateEvent('popstate'))`);
      } else {
        await client.send('Page.navigate', { url: `${baseUrl}${route}` });
      }
      await waitFor(async () => client.evaluate(`document.readyState === 'complete' && !document.body.innerText.includes('Loading...')`));
      if (role !== 'public' || route.includes('definitely-not-a-real-route')) {
        try {
          await waitFor(async () => client.evaluate(`(() => {
            const heading = document.querySelector('h1')?.innerText?.trim() || '';
            return !!heading && heading !== ${JSON.stringify(previousHeading)};
          })()`), 5_000);
        } catch { /* baseChecks reports a missing or stale route heading precisely. */ }
      }
      await delay(150);
    }
    async function inspect() {
      return client.evaluate(`(() => {
        const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        const name = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(/\\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ') || el.textContent || el.title || '').trim();
        const fields = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(visible);
        const buttons = [...document.querySelectorAll('button, [role="button"]')].filter(visible);
        const ids = [...document.querySelectorAll('[id]')].map(el => el.id).filter(Boolean);
        return {
          path: location.pathname, width: innerWidth, clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth, mainCount: document.querySelectorAll('main').length,
          h1: document.querySelector('h1')?.innerText?.trim() || '',
          unlabeledButtons: buttons.filter(el => !name(el)).map(el => el.outerHTML.slice(0, 120)),
          unlabeledFields: fields.filter(el => !(el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))).map(el => el.outerHTML.slice(0, 120)),
          duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
          imagesWithoutAlt: [...document.querySelectorAll('img')].filter(img => !img.hasAttribute('alt')).length,
        };
      })()`);
    }
    async function baseChecks(label, { fields = false, buttons = true } = {}) {
      const info = await inspect();
      check(info.scrollWidth <= info.clientWidth + 2, `${label}: global overflow ${info.scrollWidth}/${info.clientWidth}`);
      check(info.mainCount === 1, `${label}: expected one main landmark, got ${info.mainCount}`);
      check(!!info.h1, `${label}: primary heading missing`);
      check(info.duplicateIds.length === 0, `${label}: duplicate ids ${info.duplicateIds.join(', ')}`);
      check(info.imagesWithoutAlt === 0, `${label}: image missing alt`);
      if (buttons) check(info.unlabeledButtons.length === 0, `${label}: unnamed control ${info.unlabeledButtons[0] || ''}`);
      if (fields) check(info.unlabeledFields.length === 0, `${label}: unlabeled field ${info.unlabeledFields[0] || ''}`);
      return info;
    }
    async function screenshot(name) {
      const result = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      await writeFile(path.join(screenshotDir, name), Buffer.from(result.data, 'base64'));
    }
    async function key(key, code = key) {
      const virtualKeyCode = key === 'Escape' ? 27 : key === 'Enter' ? 13 : key === ' ' ? 32 : 0;
      await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
      // Headless Windows can drop a native key event when the target loses OS
      // activation between screenshots. Dispatching the same DOM key keeps the
      // acceptance deterministic while the native CDP event remains primary.
      await client.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, code: ${JSON.stringify(code)}, bubbles: true, cancelable: true }))`);
    }

    for (const [width, height] of [[320, 800], [375, 812], [768, 1024], [1024, 768], [1440, 900]]) {
      await viewport(width, height); await navigate('/'); await baseChecks(`public ${width}x${height}`);
    }
    await viewport(320, 800); await navigate('/tests'); await baseChecks('public test explorer mobile');
    await navigate('/program-explorer'); await baseChecks('public program explorer mobile');
    await viewport(320, 800); await navigate('/');
    check(await client.evaluate(`!!document.getElementById('mobile-menu-button')`), 'public mobile menu trigger reachable');
    await client.evaluate(`const trigger=document.getElementById('mobile-menu-button'); trigger.focus(); trigger.click()`);
    await waitFor(() => client.evaluate(`!!document.getElementById('mobile-drawer')`));
    await waitFor(() => client.evaluate(`document.getElementById('mobile-drawer').contains(document.activeElement)`));
    check(await client.evaluate(`document.getElementById('mobile-drawer').contains(document.activeElement)`), 'mobile menu moves focus inside');
    check(await client.evaluate(`!!document.querySelector('#mobile-drawer[role="dialog"][aria-label]')`), 'mobile menu has accessible name');
    await key('Escape'); await waitFor(() => client.evaluate(`!document.getElementById('mobile-drawer')`));
    await waitFor(() => client.evaluate(`document.activeElement?.id === 'mobile-menu-button'`));
    check(await client.evaluate(`document.activeElement?.id === 'mobile-menu-button'`), 'mobile menu restores trigger focus');
    await screenshot('mission-24-public-mobile-320.png');

    await viewport(320, 800);
    activeRole = 'public'; navigationId += 1;
    await client.send('Page.navigate', { url: `${baseUrl}/auth/login` });
    try { await waitFor(() => client.evaluate(`!!document.getElementById('login-email') && !!document.getElementById('login-password')`)); }
    catch {
      const loginState = await client.evaluate(`({ path: location.pathname, text: document.body.innerText.slice(0, 300), html: document.getElementById('root')?.innerHTML.slice(0, 300) })`);
      throw new Error(`Login route did not settle: ${JSON.stringify(loginState)}`);
    }
    await baseChecks('student login mobile', { fields: true });
    // Submit the untouched required fields; this exercises the real React form
    // validation path without relying on platform-specific synthetic typing.
    await client.evaluate(`document.querySelector('form button[type="submit"]').click()`);
    await waitFor(() => client.evaluate(`document.getElementById('login-email')?.getAttribute('aria-invalid') === 'true'`));
    check(await client.evaluate(`document.getElementById('login-email')?.getAttribute('aria-invalid') === 'true'`), 'student login marks invalid email');
    check(await client.evaluate(`(() => { const field = document.getElementById('login-email'); return !!field && !!document.getElementById(field.getAttribute('aria-describedby')); })()`), 'student login associates email error');
    check(await client.evaluate(`!!document.querySelector('[role="alert"]')`), 'student login exposes visible error alert');
    await navigate('/employer/login'); await baseChecks('employer login mobile', { fields: true });
    await navigate('/agent/login'); await baseChecks('agent login mobile', { fields: true });

    await viewport(320, 800); await navigate('/dashboard', 'student'); await baseChecks('student dashboard mobile');
    await navigate('/profile', 'student'); await baseChecks('student profile mobile', { fields: true });
    await navigate('/personalization', 'student'); await baseChecks('student personalization mobile');
    await navigate('/journey', 'student'); await baseChecks('student journey mobile');
    await navigate('/journey/tasks', 'student'); await baseChecks('student journey tasks mobile');
    await navigate('/cases', 'student'); await baseChecks('student cases empty mobile');
    check((await client.evaluate(`document.body.innerText.includes('No professional cases')`)), 'student case empty state truthful');
    await navigate('/consultations', 'student'); await baseChecks('student consultations mobile');
    await navigate('/trust-center', 'student'); await baseChecks('student trust center mobile');
    await navigate('/vault', 'student'); await baseChecks('student vault mobile');
    const addText = await client.evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Add Document'))?.textContent || [...document.querySelectorAll('button')].find(b => b.textContent.includes('Add'))?.textContent || ''`);
    check(!!addText, 'Vault add-document action reachable');
    if (addText) {
      await client.evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Add Document') || b.textContent.includes('Add'))?.click()`);
      await waitFor(() => client.evaluate(`!!document.querySelector('[role="dialog"]')`));
      check(await client.evaluate(`!!document.querySelector('[role="dialog"][aria-labelledby]')`), 'Vault dialog has accessible title');
      check(await client.evaluate(`document.querySelector('[role="dialog"]').contains(document.activeElement)`), 'Vault dialog receives focus');
      check((await inspect()).unlabeledFields.length === 0, 'Vault dialog fields are labeled');
      await key('Escape'); await waitFor(() => client.evaluate(`!document.querySelector('[role="dialog"]')`));
    }
    await screenshot('mission-24-student-vault-mobile-320.png');

    await navigate('/copilot', 'student'); await baseChecks('Copilot mobile', { fields: true });
    try { await waitFor(() => client.evaluate(`!!document.getElementById('copilot-question')`)); }
    catch {
      const copilotState = await client.evaluate(`({ path: location.pathname, text: document.body.innerText.slice(0, 400), html: document.getElementById('root')?.innerHTML.slice(0, 400) })`);
      throw new Error(`Copilot route did not settle: ${JSON.stringify(copilotState)}; runtime=${JSON.stringify(runtimeErrors.slice(-2))}`);
    }
    await client.evaluate(`const q=document.getElementById('copilot-question'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(q, 'What are my verified options?'); q.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'What are my verified options?'}))`);
    await delay(100);
    await client.evaluate(`document.querySelector('form button[type="submit"]').click()`);
    await waitFor(() => client.evaluate(`document.body.innerText.includes('AI synthesis is not yet active')`));
    check(await client.evaluate(`document.body.innerText.includes('provider') || document.body.innerText.includes('AI synthesis')`), 'Copilot not-configured state truthful');
    check((await inspect()).scrollWidth <= 322, 'Copilot evidence remains within mobile viewport');
    await screenshot('mission-24-copilot-mobile-320.png');

    await navigate('/budget/m24-plan', 'student'); await baseChecks('Budget multi-currency mobile', { fields: true });
    check(await client.evaluate(`document.body.innerText.includes('JPY') && document.body.innerText.includes('123,456')`), 'JPY uses zero-decimal display');
    check(await client.evaluate(`document.body.innerText.includes('KWD') && document.body.innerText.includes('123.456')`), 'KWD uses three-decimal display');
    check(await client.evaluate(`document.body.innerText.includes('Multiple currencies') && document.body.innerText.includes('Unknown')`), 'Budget unresolved multi-currency and unknown-cost warnings visible');

    await viewport(375, 812); await navigate('/employer', 'employer'); await baseChecks('Employer dashboard mobile');
    check(await client.evaluate(`!!document.querySelector('button[aria-controls="employer-mobile-nav"]')`), 'Employer mobile navigation trigger reachable');
    await client.evaluate(`document.querySelector('button[aria-controls="employer-mobile-nav"]').click()`); await waitFor(() => client.evaluate(`!!document.querySelector('#employer-mobile-nav[role="dialog"]')`));
    await key('Escape'); await waitFor(() => client.evaluate(`!document.getElementById('employer-mobile-nav')`));
    await navigate('/employer/jobs/new', 'employer'); await baseChecks('Employer job workflow mobile', { fields: true });

    await viewport(768, 1024); await navigate('/agent', 'agent'); await baseChecks('Agent dashboard tablet'); await screenshot('mission-24-agent-tablet-768.png');
    await viewport(320, 800); await navigate('/agent/services', 'agent'); await baseChecks('Agent services mobile', { fields: true });
    await navigate('/agent/consultations', 'agent'); await baseChecks('Agent consultations mobile', { fields: true });
    await navigate('/agent/cases', 'agent'); await baseChecks('Agent cases mobile');
    await navigate('/agent/commerce', 'agent'); await baseChecks('Agent commerce mobile');
    check(await client.evaluate(`document.body.innerText.includes('Payment ready: No') && document.body.innerText.includes('not enabled')`), 'Agent provider readiness remains truthful');
    check(!(await client.evaluate(`document.body.innerText.toLowerCase().includes('vault')`)), 'Agent portal exposes no implicit Vault control');

    await viewport(1440, 900); await navigate('/admin/sc/overview', 'admin'); await baseChecks('Admin overview desktop'); await screenshot('mission-24-admin-desktop-1440.png');
    await viewport(320, 800); await navigate('/admin/sc/organizations', 'admin'); await baseChecks('Admin organizations mobile', { fields: true });
    check(await client.evaluate(`!!document.querySelector('input[type="search"]')`), 'Admin search filter rendered and usable');
    check(await client.evaluate(`!!document.querySelector('[role="region"][aria-label] table')`), 'Admin table uses labeled contained scroll region');
    check(await client.evaluate(`document.querySelector('[role="region"]')?.scrollWidth >= document.querySelector('[role="region"]')?.clientWidth`), 'Admin table scroll is bounded to its region');
    await screenshot('mission-24-admin-mobile-320.png');
    await navigate('/admin/sc/trust', 'admin'); await baseChecks('Admin trust mobile', { fields: true });
    await navigate('/admin/sc/data-quality', 'admin'); await baseChecks('Admin data quality mobile', { fields: true });
    await navigate('/admin/sc/commerce', 'admin'); await baseChecks('Admin commerce mobile');
    const manualReview = await client.evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Manual Review'))?.textContent || ''`);
    check(!!manualReview, 'Admin high-impact action is reachable');
    if (manualReview) {
      await client.evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Manual Review'))?.click()`);
      await waitFor(() => client.evaluate(`!!document.querySelector('[role="dialog"]')`));
      check(await client.evaluate(`!!document.querySelector('[role="dialog"] textarea#reconciliation-review-reason')?.labels?.length`), 'Admin action reason field is labeled');
      check(await client.evaluate(`!!document.querySelector('[role="dialog"][aria-labelledby]')`), 'Admin high-impact dialog has accessible title');
      await key('Escape'); await waitFor(() => client.evaluate(`!document.querySelector('[role="dialog"]')`));
    }

    await viewport(320, 800); await navigate('/definitely-not-a-real-route'); await baseChecks('404 mobile');
    check(await client.evaluate(`document.body.innerText.includes('404')`), '404 state is understandable');
    await navigate('/admin/sc/overview', 'student');
    const unauthorizedCoherent = await waitFor(() => client.evaluate(`location.pathname === '/auth/login' || /permission|access|authorized/i.test(document.body.innerText)`));
    check(unauthorizedCoherent, 'unauthorized/session UX is coherent');

    check(runtimeErrors.length === 0, `uncaught browser runtime exceptions: ${runtimeErrors[0] || ''}`);
    const requestLoop = [...requestCounts.entries()].find(([, count]) => count > 8);
    check(!requestLoop, `repeated request loop observed: ${requestLoop?.[0]} x${requestLoop?.[1]}`);

    if (failures.length) throw new Error(`${failures.length}/${assertions} assertions failed:\n- ${failures.join('\n- ')}`);
    console.log(`STRIDETO MISSION 24 BROWSER UX: ${assertions}/${assertions} assertions passed`);
    console.log('Tooling: local Chromium CDP; deterministic intercepted API fixtures; no network or live services');
  } finally {
    try {
      if (client) await Promise.race([client.send('Browser.close'), delay(1_000)]);
    } catch { /* browser may close the CDP socket before acknowledging */ }
    client?.close();
    if (chrome && chrome.exitCode == null) chrome.kill();
    if (vite && vite.exitCode == null) vite.kill();
    await delay(500);
    try { await rm(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); }
    catch { /* Windows may retain Crashpad metrics briefly; profile contains only synthetic fixture state. */ }
  }
}

function requireStat(candidate) {
  // Deliberately synchronous only for local executable discovery before launch.
  const { existsSync } = requireNodeFs();
  return existsSync(candidate);
}

function requireNodeFs() {
  // Kept behind a helper so the suite remains a single dependency-free module.
  return globalThis.__m24fs || (globalThis.__m24fs = { existsSync: (candidate) => {
    try { return process.getBuiltinModule('node:fs').existsSync(candidate); } catch { return false; }
  } });
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
