import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const BASE = process.env.STRIDETO_QA_BASE || 'https://127.0.0.1:8443';
const widths = [320, 375, 768, 1024, 1440];
const themes = ['light', 'dark'];
const caseId = '64f000000000000000000001';
const subject = { subjectType: 'agent', subjectId: 'agent-1', label: 'P2D Provider' };
const attention = { limit: 5, providerTasks: [{ id: 'task-1', caseId, title: 'Review application', status: 'pending', dueAt: '2026-09-01' }], applications: [], documentRequests: [], unreadMessages: 2 };

function response(path, realm) {
  if (path === '/api/auth/agent/refresh-token') return ['agent', 'admin'].includes(realm) ? [200, { accessToken: 'agent-token' }] : [401, {}];
  if (path === '/api/auth/agent/me') return ['agent', 'admin'].includes(realm) ? [200, { account: { _id: 'agent-1', email: 'provider@example.test', agentType: 'agent' }, memberships: [] }] : [401, {}];
  if (path === '/api/auth/refresh-token') return ['student', 'business', 'notifications', 'admin'].includes(realm) ? [200, { accessToken: 'user-token' }] : [401, {}];
  if (path === '/api/auth/me') return ['student', 'business', 'notifications', 'admin'].includes(realm) ? [200, { user: { _id: 'student-1', name: 'P2D Student', role: realm === 'admin' ? 'SuperAdmin' : 'User', permissions: realm === 'admin' ? ['workflow.review', 'workflow.approve'] : [], capabilities: ['business_client'] } }] : [401, {}];
  if (path === '/api/admin/auth/refresh-token') return realm === 'admin' ? [200, { accessToken: 'admin-token' }] : [401, {}];
  if (path === '/api/admin/auth/me') return realm === 'admin' ? [200, { admin: { _id: 'admin-1', email: 'admin@example.test', role: 'super_admin', permissions: ['*'] } }] : [401, {}];
  if (path === '/api/agent/provider-domains/context') return [200, { accountId: 'agent-1', needsOnboarding: false, workspaces: [{ ...subject, kind: 'independent', domainId: 'education_mobility', path: '/agent/education' }, { ...subject, kind: 'independent', domainId: 'business_services', path: '/agent/business-services' }] }];
  if (path === '/api/agent/profile') return [200, { profile: { agentType: 'agent', professionalName: 'P2D Provider' } }];
  if (path === '/api/agent/dashboard') return [200, { verificationStatus: 'approved', profileCompleteness: 90, cards: {}, consultations: {}, marketplace: {}, attention }];
  if (path === '/api/agent/business-services/enabled') return [200, { enabled: true, publicMarketplaceEnabled: false }];
  if (path === '/api/agent/business-services/context') return [200, { enabled: true, subjects: [subject] }];
  if (path === '/api/agent/business-services/overview') return [200, { counters: {}, attention: { limit: 5, requests: [{ ref: 'GBSR-P2D', title: 'Formation request', status: 'submitted' }], quotes: [], cases: [], messages: [] } }];
  if (path === '/api/cases') return [200, { cases: [{ id: caseId, title: 'Student Case', lifecycle: 'active', caseType: 'study', currentStage: 'intake' }], page: 1, totalPages: 1, attention: { limit: 5, proposals: [], tasks: [{ id: 'task-1', caseId, title: 'Upload details', status: 'pending' }], applications: [], documentRequests: [], approvals: [] } }];
  if (path === '/api/business/enabled') return [200, { activated: true }];
  if (path === '/api/business/overview') return [200, { counts: {}, caseCounts: {}, recent: [], attention: { limit: 5, pendingQuotes: [{ publicQuoteRef: 'GBSQ-P2D', titleSnapshot: 'Formation quote' }], customerCases: [], documentExchange: 'unavailable_private_beta', filingAuthorization: 'unavailable' } }];
  if (path.includes('/notifications')) return [200, { data: [], pagination: { totalPages: 1 }, unreadCount: 0 }];
  if (path.includes('/admin/agent-marketplace')) return [200, { posts: [], permissions: [] }];
  if (path.includes('/announcements')) return [200, { items: [] }];
  return [200, {}];
}

const scenarios = [
  ['notifications', '/notifications', 'Notifications'],
  ['agent', '/agent/education', 'Education & Mobility'],
  ['student', '/cases', 'My professional cases'],
  ['agent', '/agent/business-services', 'Overview'],
  ['business', '/business', 'Business Overview'],
];
const browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors'] });
const errors = []; let cells = 0;
async function pageFor(realm, theme) {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(`${realm} ${theme}: ${error.message}`));
  page.on('console', (message) => { const value = message.text(); if (message.type() === 'error' && !value.includes('icon from the Manifest')) errors.push(`${realm} ${theme}: ${value}`); });
  await page.evaluateOnNewDocument((value) => localStorage.setItem('edurozgaar-theme', value), theme);
  await page.setRequestInterception(true);
  page.on('request', (request) => { const url = new URL(request.url()); if (!url.pathname.startsWith('/api/')) return request.continue(); const [status, body] = response(url.pathname, realm); return request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) }); });
  return page;
}
try {
  for (const [realm, route, expectedH1] of scenarios) for (const theme of themes) {
    const page = await pageFor(realm, theme);
    for (const width of widths) {
      await page.setViewport({ width, height: width < 768 ? 1000 : 1100 });
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('h1', { timeout: 15000 });
      const result = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent?.trim(), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, dark: document.documentElement.classList.contains('dark'), boundary: document.body.innerText.includes('This page could not be displayed'), title: document.title, labels: [...document.querySelectorAll('select')].every((field) => field.labels?.length || field.getAttribute('aria-label')) }));
      assert.equal(result.h1, expectedH1); assert.ok(result.overflow <= 2, `${realm} ${width}: overflow ${result.overflow}`); assert.equal(result.dark, theme === 'dark'); assert.equal(result.boundary, false); assert.ok(result.title.includes('Strideto')); if (realm === 'notifications') assert.equal(result.labels, true); cells += 1;
    }
    await page.close();
  }
  for (const theme of ['light', 'dark', 'system-light', 'system-dark']) {
    const page = await pageFor('admin', theme.startsWith('system') ? 'system' : theme);
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme.endsWith('dark') ? 'dark' : 'light' }]);
    await page.setViewport({ width: 1024, height: 1100 });
    await page.goto(`${BASE}/admin/agent-marketplace`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 15000 });
    const result = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent?.trim(), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, boundary: document.body.innerText.includes('This page could not be displayed') }));
    assert.equal(result.h1, 'Agent marketplace moderation'); assert.ok(result.overflow <= 2); assert.equal(result.boundary, false); cells += 1; await page.close();
  }
} finally { await browser.close(); }
assert.deepEqual(errors, [], errors.join('\n')); assert.equal(cells, 54);
console.log(`P2D focused responsive/actionability/accessibility: PASS (${cells}/54 cells)`);
