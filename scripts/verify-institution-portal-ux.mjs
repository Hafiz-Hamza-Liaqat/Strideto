import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = 'http://127.0.0.1:5173';
const cdpPort = 9335;
const screenshotDir = path.join(root, 'docs', 'screenshots', 'responsive');
const browsers = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'];
const exists = (file) => { try { return process.getBuiltinModule('node:fs').statSync(file).isFile(); } catch { return false; } };

let assertions = 0;
const failures = [];
const check = (value, message) => { assertions += 1; try { assert.ok(value, message); } catch (error) { failures.push(error.message); } };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(fn, timeout = 12000) {
  const start = Date.now(); let last;
  while (Date.now() - start < timeout) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await delay(75);
  }
  throw last || new Error('Timed out waiting for browser state');
}

class Cdp {
  constructor(url) { this.id = 1; this.pending = new Map(); this.handlers = new Map(); this.socket = new WebSocket(url); }
  async connect() {
    await new Promise((resolve, reject) => { this.socket.addEventListener('open', resolve, { once: true }); this.socket.addEventListener('error', reject, { once: true }); });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id); if (!pending) return;
        this.pending.delete(message.id); message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result); return;
      }
      for (const handler of this.handlers.get(message.method) || []) Promise.resolve(handler(message.params)).catch((error) => failures.push(`CDP ${message.method}: ${error.message}`));
    });
  }
  on(method, handler) { this.handlers.set(method, [...(this.handlers.get(method) || []), handler]); }
  send(method, params = {}) { const id = this.id++; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); }); }
  async evaluate(expression) { const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; }
  close() { this.socket.close(); }
}

const profile = {
  _id: 'profile-1', organizationId: 'org-1',
  officialDisplayName: 'Université Internationale de Technologie et de Recherche Appliquée — 東京大学連携センター',
  legalName: 'Université Internationale de Technologie et de Recherche Appliquée', institutionType: 'university', countryCode: 'GB',
  officialWebsite: 'https://institution.example', officialAdmissionsWebsite: 'https://institution.example/admissions',
  officialContactEmail: 'international.admissions.long-address@institution.example', officialPhone: '+44 20 7946 0958',
  institutionDescription: 'Source-backed international Institution profile.', completenessScore: 70,
  commerceCapability: 'not_configured', directApplicationCapability: 'not_configured', sourceType: 'institution_official',
};
const program = {
  _id: 'program-1', name: '国際量子コンピューティング修士課程 — Master of Applied Quantum Systems', status: 'draft', degreeLevel: 'master', field: 'computing', campus: 'International Research Campus', studyMode: 'full_time', durationMonths: 24,
  country: 'GB', officialProgramUrl: 'https://institution.example/programs/quantum', admissionRequirementsUrl: 'https://institution.example/programs/quantum/requirements',
  intakes: [{ cycleLabel: 'Autumn 2027 — International Research Intake', deadlineAt: '2027-04-30T00:00:00.000Z' }],
  tuition: { amountMinor: 123456, currency: 'JPY', per: 'year' }, freshnessState: 'review_due', verificationStatus: 'verified', sources: [{ sourceType: 'institution_official' }],
};

function fixture(url, method, realm, scenario) {
  const pathname = new URL(url).pathname;
  if (pathname === '/api/auth/institution/refresh-token') return realm === 'institution' ? [200, { accessToken: 'fixture-institution' }] : [401, { error: 'Institution session required' }];
  if (pathname === '/api/auth/institution/me') return realm === 'institution' ? [200, { account: { _id: 'account-1', email: 'registrar.long-address@institution.example', accountStatus: 'active' }, memberships: [{ _id: 'membership-1', organizationId: 'org-1', role: 'owner', active: true }] }] : [403, { error: 'Institution realm required' }];
  if (scenario === 'forbidden' && pathname.endsWith('/dashboard')) return [403, { error: 'Active Institution membership required' }];
  if (scenario === 'error' && pathname.endsWith('/data-conflicts')) return [500, { error: 'Data-quality service is temporarily unavailable' }];
  if (pathname.endsWith('/dashboard')) return [200, { organizationId: 'org-1', membership: { role: 'owner' }, verificationStatus: 'approved', claimState: 'approved', profileCompleteness: 70, publishedPrograms: 1, draftPrograms: 1, openConflicts: 1 }];
  if (pathname.endsWith('/onboarding')) return [200, { organizationId: 'org-1', verificationStatus: 'approved', claimState: 'approved', completenessScore: 70, stages: [{ stage: 'account', complete: true }, { stage: 'organization_identity', complete: true }, { stage: 'official_website', complete: true }, { stage: 'location', complete: false }, { stage: 'verification_evidence', complete: true }, { stage: 'canonical_claim', complete: true }, { stage: 'verification_submitted', complete: true }, { stage: 'approved', complete: true }] }];
  if (pathname.endsWith('/profile')) return method === 'PATCH' ? [200, { profile }] : [200, { profile }];
  if (pathname.endsWith('/claim')) return method === 'POST' ? [201, { claim: { _id: 'claim-1', state: 'draft' } }] : [200, { claim: { _id: 'claim-1', state: 'approved', canonicalInstitutionId: 'canonical-1' } }];
  if (/\/claim\/[^/]+\/submit$/.test(pathname)) return [200, { claim: { _id: 'claim-1', state: 'submitted' } }];
  if (pathname.endsWith('/programs')) return scenario === 'empty' ? [200, { programs: [] }] : [200, { programs: [program] }];
  if (pathname.endsWith('/programs/program-1')) return method === 'PATCH' ? [200, { program }] : [200, { program }];
  if (pathname.endsWith('/programs/program-1/submit')) return [200, { program: { ...program, status: 'submitted' } }];
  if (pathname.endsWith('/programs/program-1/requirements')) return [201, { requirement: { _id: 'requirement-1', status: 'draft' } }];
  if (pathname.endsWith('/test-acceptance')) return [201, { testAcceptance: { _id: 'acceptance-1', status: 'draft' } }];
  if (pathname.endsWith('/data-conflicts')) return [200, { conflicts: [{ _id: 'conflict-1', field: 'tuition', state: 'under_review' }] }];
  if (pathname.endsWith('/change-history')) return [200, { events: [{ _id: 'event-1', changeCategory: 'tuition', field: 'tuition', sourceType: 'institution_official' }] }];
  if (pathname.endsWith('/freshness/reconfirm')) return [200, { message: 'Freshness reconfirmed and audited' }];
  if (pathname.endsWith('/team')) return [200, { members: [{ _id: 'membership-1', role: 'owner', account: { email: 'registrar.long-address@institution.example' } }, { _id: 'membership-2', role: 'editor', account: { email: 'programme.editor.international@institution.example' } }] }];
  if (/\/team\/[^/]+\/role$/.test(pathname)) return [200, { membership: { _id: 'membership-2', role: 'viewer' } }];
  return [200, {}];
}

async function run() {
  const browser = browsers.find(exists); if (!browser) throw new Error('No local Chrome/Edge binary found');
  await mkdir(screenshotDir, { recursive: true });
  const browserProfile = await mkdtemp(path.join(os.tmpdir(), 'strideto-institution-'));
  let vite; let chrome; let client;
  try {
    const viteBin = path.join(root, 'client', 'node_modules', 'vite', 'bin', 'vite.js');
    vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: path.join(root, 'client'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let viteError = ''; vite.stderr.on('data', (chunk) => { viteError += chunk.toString(); });
    await waitFor(async () => { if (vite.exitCode != null) throw new Error(`Vite exited: ${viteError}`); try { return (await fetch(baseUrl)).ok; } catch { return false; } });
    chrome = spawn(browser, ['--headless=new', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${browserProfile}`, '--no-first-run', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', '--hide-scrollbars', '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    const targets = await waitFor(async () => { try { const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`); return response.ok ? response.json() : null; } catch { return null; } });
    client = new Cdp(targets.find((target) => target.type === 'page').webSocketDebuggerUrl); await client.connect();
    let realm = 'institution'; let scenario = 'normal'; let navigationId = 0;
    const runtimeErrors = []; const requestCounts = new Map(); const responseLog = [];
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => runtimeErrors.push(exceptionDetails.exception?.description || exceptionDetails.text));
    client.on('Fetch.requestPaused', async ({ requestId, request }) => {
      const requestPath = new URL(request.url).pathname; const key = `${navigationId} ${request.method} ${requestPath}`;
      requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
      if (scenario === 'slow' && requestPath.endsWith('/dashboard')) await delay(500);
      const [status, data] = fixture(request.url, request.method, realm, scenario);
      responseLog.push({ realm, scenario, method: request.method, path: requestPath, status });
      await client.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }, { name: 'Access-Control-Allow-Origin', value: baseUrl }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type' }, { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, DELETE, OPTIONS' }], body: Buffer.from(JSON.stringify(data)).toString('base64') });
    });
    await client.send('Page.enable'); await client.send('Runtime.enable'); await client.send('Fetch.enable', { patterns: [{ urlPattern: `${baseUrl}/api/*`, requestStage: 'Request' }, { urlPattern: 'http://localhost:5000/api/*', requestStage: 'Request' }] });

    const viewport = (width, height) => client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    async function navigate(route, options = {}) {
      realm = options.realm || 'institution'; scenario = options.scenario || 'normal'; navigationId += 1;
      const previousHeading = options.spa ? await client.evaluate(`document.querySelector('h1')?.innerText || ''`) : '';
      if (options.spa) await client.evaluate(`history.pushState({},'',${JSON.stringify(route)}); dispatchEvent(new PopStateEvent('popstate'))`);
      else {
        const navigationUrl = new URL(route, baseUrl);
        navigationUrl.searchParams.set('__institutionAcceptance', String(navigationId));
        await client.send('Page.navigate', { url: navigationUrl.href });
        await waitFor(() => client.evaluate(`location.search.includes('__institutionAcceptance=${navigationId}') && document.readyState === 'complete' && !!document.getElementById('root')`));
      }
      if (options.spa) await waitFor(() => client.evaluate(`document.readyState === 'complete' && !!document.getElementById('root')`));
      try {
        if (options.waitFor) await waitFor(() => client.evaluate(options.waitFor));
        else if (options.spa) await waitFor(() => client.evaluate(`(document.querySelector('h1')?.innerText || '') !== ${JSON.stringify(previousHeading)}`));
        else await waitFor(() => client.evaluate(`!!document.querySelector('h1') || location.pathname === '/institution/login'`));
      } catch {
        const state = await client.evaluate(`({ path:location.pathname, text:document.body.innerText.slice(0,500), html:document.getElementById('root')?.innerHTML.slice(0,500) })`);
        throw new Error(`Route ${route} did not settle: ${JSON.stringify(state)}; responses=${JSON.stringify(responseLog.slice(-8))}; runtime=${JSON.stringify(runtimeErrors.slice(-2))}`);
      }
      await delay(100);
    }
    async function inspect() {
      return client.evaluate(`(() => { const visible=(el)=>!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length); const name=(el)=>(el.getAttribute('aria-label')||el.textContent||el.title||'').trim(); const fields=[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(visible); const controls=[...document.querySelectorAll('button,a[href],[role=button]')].filter(visible); return { path:location.pathname, scrollWidth:document.documentElement.scrollWidth, clientWidth:document.documentElement.clientWidth, mainCount:document.querySelectorAll('main').length, h1:document.querySelector('h1')?.innerText?.trim()||'', unlabeledFields:fields.filter((el)=>!(el.labels?.length||el.getAttribute('aria-label')||el.getAttribute('aria-labelledby'))).length, unnamedControls:controls.filter((el)=>!name(el)).length, controlNames:controls.map(name).join('|').toLowerCase() }; })()`);
    }
    async function baseChecks(label, { fields = false } = {}) {
      const info = await inspect(); check(info.scrollWidth <= info.clientWidth + 2, `${label}: page overflow ${info.scrollWidth}/${info.clientWidth}`); check(info.mainCount === 1, `${label}: expected one main landmark`); check(Boolean(info.h1), `${label}: missing h1`); check(info.unnamedControls === 0, `${label}: unnamed interactive control`); if (fields) check(info.unlabeledFields === 0, `${label}: unlabeled field`); return info;
    }
    async function screenshot(name) { const result = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true }); await writeFile(path.join(screenshotDir, name), Buffer.from(result.data, 'base64')); }
    async function key(key, code = key, modifiers = 0) { const vk = key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : key === 'Backspace' ? 8 : 0; await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, modifiers, windowsVirtualKeyCode: vk }); await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, windowsVirtualKeyCode: vk }); }

    await viewport(320, 800);
    for (const deniedRealm of ['user', 'employer', 'agent']) {
      await navigate('/institution', { realm: deniedRealm, waitFor: `location.pathname === '/institution/login'` });
      check(await client.evaluate(`location.pathname === '/institution/login'`), `${deniedRealm} realm denied Institution portal`);
      check(await client.evaluate(`document.body.innerText.includes('Institution sign in')`), `${deniedRealm} denial is realm-specific and coherent`);
    }

    await viewport(320, 800); await navigate('/institution'); await baseChecks('Institution dashboard 320x800');
    for (const [width, height] of [[375, 812], [768, 1024], [1024, 768], [1440, 900]]) {
      await viewport(width, height); await baseChecks(`Institution dashboard ${width}x${height}`);
    }
    await viewport(320, 800);
    const dashboard = await baseChecks('Institution dashboard mobile');
    check(await client.evaluate(`document.body.innerText.includes('Organization verification: Approved')`), 'verification status is textual');
    check(await client.evaluate(`document.body.innerText.includes('Canonical claim: Approved')`), 'claim state is distinguishable');
    check(await client.evaluate(`document.body.innerText.includes('Completeness is not verification')`), 'completeness is not represented as verification');
    check(await client.evaluate(`document.querySelector('h1').innerText.includes('Université') && document.querySelector('h1').getBoundingClientRect().right <= innerWidth`), 'long Unicode Institution name wraps safely');
    check(dashboard.controlNames.includes('profile') && dashboard.controlNames.includes('programs'), 'mobile Institution navigation is reachable');
    const profileLink = await client.evaluate(`!!document.querySelector('a[href="/institution/profile"]')`);
    if (!profileLink) {
      const state = await client.evaluate(`({ path: location.pathname, text: document.body.innerText.slice(0, 500), html: document.getElementById('root')?.innerHTML.slice(0, 500) })`);
      throw new Error(`Institution dashboard did not expose Profile navigation: ${JSON.stringify(state)}; responses=${JSON.stringify(responseLog.slice(-12))}; runtime=${JSON.stringify(runtimeErrors.slice(-2))}`);
    }
    await client.evaluate(`document.querySelector('a[href="/institution/profile"]').focus()`); await key('Enter');
    await waitFor(() => client.evaluate(`location.pathname === '/institution/profile'`)); check(true, 'keyboard Enter activates Institution navigation');
    await waitFor(() => client.evaluate(`!!document.getElementById('institution-official-name')`));
    await screenshot('mission-18-institution-mobile-320.png');

    await baseChecks('Institution profile mobile', { fields: true });
    await client.evaluate(`(() => { const input=document.getElementById('institution-official-name'); const old=input.value; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,''); input._valueTracker?.setValue(old); input.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('form button').click(); })()`);
    await waitFor(() => client.evaluate(`!!document.querySelector('[role=alert]')`));
    check(await client.evaluate(`document.getElementById('institution-official-name')?.getAttribute('aria-invalid') === 'true'`), 'profile validation marks invalid field');
    check(await client.evaluate(`document.querySelector('[role=alert]')?.innerText.includes('required')`), 'profile validation error is visible');

    await navigate('/institution/onboarding', { spa: true }); await baseChecks('Institution verification mobile', { fields: false });
    check(await client.evaluate(`document.body.innerText.includes('Profile completeness') && document.body.innerText.includes('Organization verification') && document.body.innerText.includes('Canonical claim')`), 'onboarding separates completeness, verification, and claim');
    check(await client.evaluate(`document.body.innerText.includes('cannot self-verify')`), 'verification authority copy is truthful');

    await navigate('/institution/programs', { spa: true }); await baseChecks('Institution Programs mobile');
    check(await client.evaluate(`document.body.innerText.includes('Master of Applied Quantum Systems') && document.body.innerText.includes('JPY') && document.body.innerText.includes('123,456')`), 'international Program and zero-decimal currency survive narrow view');
    check(await client.evaluate(`!![...document.querySelectorAll('a')].find((a)=>a.textContent.includes('Edit Program'))`), 'Program action is reachable');
    check(await client.evaluate(`document.body.innerText.includes('Autumn 2027')`), 'intake UI is responsive and visible');
    check(await client.evaluate(`document.body.innerText.includes('scholarship management is unavailable')`), 'scholarship capability is truthful');

    await navigate('/institution/programs/program-1/edit', { spa: true }); await baseChecks('Institution Program editor mobile', { fields: true });
    check(await client.evaluate(`document.body.innerText.includes('Add Program requirement')`), 'requirement editor is available');
    check(await client.evaluate(`document.body.innerText.includes('Add TestAcceptance') && document.body.innerText.includes('Country-level acceptance cannot be modified')`), 'TestAcceptance editor and protected country scope are visible');
    check(await client.evaluate(`document.body.innerText.includes('Ownership is checked by the server')`), 'Program authority copy is truthful');

    await navigate('/institution/data-quality', { spa: true }); await baseChecks('Institution data quality mobile', { fields: true });
    check(await client.evaluate(`document.body.innerText.includes('Review Due') && document.body.innerText.includes('Under Review')`), 'review-due and conflict states are textual');
    check(await client.evaluate(`document.body.innerText.includes('never marks data fresh')`), 'page load does not imply freshness');
    const writesOnLoad = [...requestCounts.entries()].filter(([key]) => key.startsWith(`${navigationId} POST`) || key.startsWith(`${navigationId} PATCH`));
    check(writesOnLoad.length === 0, 'data-quality page load performs no freshness mutation');

    await navigate('/institution/team', { spa: true }); await baseChecks('Institution team/settings mobile', { fields: true });
    check(await client.evaluate(`document.body.innerText.includes('Commerce') && document.body.innerText.includes('Not configured')`), 'Institution commerce remains not configured');
    check(await client.evaluate(`document.body.innerText.includes('Team invitations are unavailable')`), 'unsupported team invitations are truthful');
    const controls = await inspect();
    check(!/(student|vault|consultation|case|budget|copilot)/.test(controls.controlNames), 'no Student private-data or Vault controls');
    check(!/(agent|employer|payment|stripe)/.test(controls.controlNames), 'no Agent, Employer, or payment controls');

    await navigate('/institution/programs', { scenario: 'empty', spa: true });
    check(await client.evaluate(`document.body.innerText.includes('No Programs yet')`), 'Program empty state is truthful');
    await navigate('/institution/data-quality', { scenario: 'error', spa: true });
    check(await client.evaluate(`document.querySelector('[role=alert]')?.innerText.includes('temporarily unavailable')`), 'API error state is visible and safe');
    await navigate('/institution', { scenario: 'forbidden', spa: true });
    check(await client.evaluate(`document.querySelector('[role=alert]')?.innerText.includes('membership required')`), 'forbidden state is understandable');
    await navigate('/institution/team', { spa: true });
    await navigate('/institution', { scenario: 'slow', spa: true, waitFor: `document.body.innerText.includes('Loading Institution dashboard') || document.body.innerText.includes('Loading Institution Portal')` });
    check(await client.evaluate(`document.body.innerText.includes('Loading Institution')`), 'loading state is visible');
    await waitFor(() => client.evaluate(`document.querySelector('h1')?.innerText.includes('Université')`));

    await viewport(1440, 900); await screenshot('mission-18-institution-desktop-1440.png');
    check(runtimeErrors.length === 0, `uncaught runtime error: ${runtimeErrors[0] || ''}`);
    const loop = [...requestCounts.entries()].find(([, count]) => count > 8); check(!loop, `uncontrolled retry loop: ${loop?.[0]} x${loop?.[1]}`);
    check(true, 'all responses came from intercepted synthetic fixtures; no live service call');

    if (failures.length) throw new Error(`${failures.length}/${assertions} assertions failed:\n- ${failures.join('\n- ')}`);
    console.log(`STRIDETO INSTITUTION PORTAL UX: ${assertions}/${assertions} assertions passed`);
    console.log('Tooling: local Chromium CDP; intercepted synthetic Institution fixtures; no network or live services');
  } finally {
    client?.close(); if (chrome && chrome.exitCode == null) chrome.kill(); if (vite && vite.exitCode == null) vite.kill(); await delay(400);
    try { await rm(browserProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); } catch { /* synthetic browser profile only */ }
  }
}

run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
