import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const BASE = process.env.STRIDETO_QA_BASE || 'https://127.0.0.1:8443';
const widths = [320, 375, 768, 1024, 1440];
const themes = ['light', 'dark'];
const scenarios = [
  ['provider', '/agent/education/services', 'services'],
  ['provider', '/agent/education/leads', 'leads'],
  ['provider', '/agent/education/consultations', 'consultations'],
  ['provider', '/agent/education/cases', 'provider-cases'],
  ['provider', '/agent/education/clients', 'clients'],
  ['student', '/cases', 'student-cases'],
];
const id = '507f1f77bcf86cd799439020';

function response(path, realm) {
  if (path === '/api/auth/agent/refresh-token') return realm === 'provider' ? [200, { accessToken: 'p2c1-agent' }] : [401, {}];
  if (path === '/api/auth/agent/me') return realm === 'provider' ? [200, { account: { _id: id, email: 'provider@example.test', agentType: 'agent' }, memberships: [] }] : [401, {}];
  if (path === '/api/auth/refresh-token') return realm === 'student' ? [200, { accessToken: 'p2c1-student' }] : [401, {}];
  if (path === '/api/auth/me') return realm === 'student' ? [200, { user: { _id: id, name: 'Student QA', role: 'User' } }] : [401, {}];
  if (path === '/api/agent/provider-domains/context') return [200, { needsOnboarding: false, workspaces: [{ subjectType: 'agent', subjectId: id, kind: 'independent', domainId: 'education_mobility', path: '/agent/education' }] }];
  if (path === '/api/agent/profile') return [200, { profile: { agentType: 'agent', professionalName: 'P2C1 Provider' } }];
  const page = 1; const totalPages = 3; const total = 41; const limit = 20;
  if (path === '/api/agent/services') return [200, { services: [{ _id: id, title: 'Guidance', category: 'career_guidance', description: 'Guidance', pricingMode: 'free', deliveryMode: 'online', journeyType: 'other', status: 'draft' }], page, limit, total, totalPages }];
  if (path === '/api/agent/leads') return [200, { leads: [{ _id: id, displayName: 'Student', source: 'consultation_request', status: 'new', context: 'Guidance request' }], page, limit, total, totalPages }];
  if (path === '/api/agent/consultations') return [200, { consultations: [{ id, purpose: 'Planning', requestedWindow: { start: new Date().toISOString() }, timezone: 'UTC', paymentState: 'free', status: 'confirmed' }], page, limit, total, totalPages }];
  if (path === '/api/agent/cases') return [200, { cases: [{ id, title: 'Guidance case', lifecycle: 'active', currentStage: 'intake' }], page, limit, total, totalPages }];
  if (path === '/api/agent/clients') return [200, { clients: [{ userId: id, displayName: 'Student', origin: 'consultation', status: 'active', nextAction: 'Open consultation', vaultGrantCount: 0, vaultNote: 'Exact grants only.' }], page, limit, total, totalPages }];
  if (path === '/api/cases') return [200, { cases: [{ id, title: 'My guidance case', lifecycle: 'active', currentStage: 'intake', caseType: 'general_guidance' }], page, limit, total, totalPages }];
  if (path.includes('/notifications')) return [200, { notifications: [], data: [], pagination: { totalPages: 1 } }];
  return [200, {}];
}

const browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors'] });
const errors = []; let cells = 0;
try {
  for (const [realm, route, name] of scenarios) {
    for (const theme of themes) {
      const page = await browser.newPage();
      page.on('pageerror', (error) => errors.push(`${name} ${theme}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`${name} ${theme}: ${message.text()}`); });
      await page.evaluateOnNewDocument((value) => localStorage.setItem('edurozgaar-theme', value), theme);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (!url.pathname.startsWith('/api/')) return request.continue();
        const [status, body] = response(url.pathname, realm);
        return request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      for (const width of widths) {
        await page.setViewport({ width, height: width < 768 ? 1000 : 1100 });
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('h1', { timeout: 15000 });
        await page.waitForFunction(() => document.body.innerText.includes('Page 1 of 3'));
        const result = await page.evaluate(() => ({
          h1: document.querySelector('h1')?.textContent?.trim(),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          previousDisabled: [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Previous')?.disabled,
          nextLabel: [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Next'),
          dark: document.documentElement.classList.contains('dark'),
          boundary: document.body.innerText.includes('This page could not be displayed'),
        }));
        assert.ok(result.h1, `${name} ${width} ${theme}: h1`);
        assert.ok(result.overflow <= 2, `${name} ${width} ${theme}: overflow ${result.overflow}`);
        assert.equal(result.previousDisabled, true, `${name}: first-page previous disabled`);
        assert.equal(result.nextLabel, true, `${name}: labelled next button`);
        assert.equal(result.dark, theme === 'dark', `${name}: theme`);
        assert.equal(result.boundary, false, `${name}: route boundary`);
        cells += 1;
      }
      await page.close();
    }
  }
} finally { await browser.close(); }
assert.deepEqual(errors, [], errors.join('\n'));
assert.equal(cells, 60);
console.log(`P2C-1 focused responsive Education lists: PASS (${cells}/60 cells)`);

