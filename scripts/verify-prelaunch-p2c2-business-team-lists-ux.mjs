import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const BASE = process.env.STRIDETO_QA_BASE || 'https://127.0.0.1:8443';
const widths = [320, 375, 768, 1024, 1440];
const themes = ['light', 'dark'];
const scenarios = [
  ['/agent/business-services/messages', 'messages'],
  ['/agent/business-services/services', 'listings'],
  ['/agent/business-services/team', 'business-team'],
  ['/agent/education/team', 'education-team'],
];
const id = '507f1f77bcf86cd799439020';
const subject = { subjectType: 'agent', subjectId: id, displayName: 'Bounded Provider' };

function response(url) {
  const { pathname } = url;
  if (pathname === '/api/auth/agent/refresh-token') return [200, { accessToken: 'p2c2-agent' }];
  if (pathname === '/api/auth/agent/me') return [200, { account: { _id: id, email: 'provider@example.test', agentType: 'agency' }, memberships: [] }];
  if (pathname === '/api/agent/business-services/context') return [200, { enabled: true, subjects: [subject] }];
  if (pathname === '/api/agent/business-services/catalog') return [200, { capabilities: [], jurisdictions: [], entityTypes: [] }];
  if (pathname === '/api/agent/provider-domains/context') return [200, { needsOnboarding: false, workspaces: [
    { ...subject, kind: 'agency', domainId: 'education_mobility', path: '/agent/education' },
    { ...subject, kind: 'agency', domainId: 'business_services', path: '/agent/business-services' },
  ] }];
  if (pathname === '/api/agent/profile') return [200, { profile: { agentType: 'agency', professionalName: 'Bounded Provider' } }];
  if (pathname === '/api/agent/business-services/messages') return [200, { items: [{ id, contextType: 'request', contextPublicRef: 'GBS-REQ-P2C2', title: 'Formation request' }], page: 1, limit: 20, total: 41, totalPages: 3 }];
  if (pathname === '/api/agent/business-services/listings') return [200, { items: [{ id, title: 'Formation service', capabilityId: 'business_formation', jurisdictionId: 'j:US-WY', moderationStatus: 'draft', adminReviewStatus: 'pending', publicationStatus: 'private' }], page: 1, limit: 20, total: 41, totalPages: 3 }];
  if (pathname === '/api/agent/team') return [200, { members: [{ _id: id, agentAccountId: id, email: 'member@example.test', role: 'member', active: true, domainAccess: [{ domainId: url.searchParams.get('focusDomainId') || 'business_services', permissions: [] }] }], page: 1, limit: 20, total: 41, totalPages: 3 }];
  if (pathname === '/api/agent/team/invites') return [200, { data: [] }];
  if (pathname.includes('/notifications')) return [200, { notifications: [], data: [], pagination: { totalPages: 1 } }];
  return [200, {}];
}

const browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors'] });
const errors = []; let cells = 0;
try {
  for (const [route, name] of scenarios) {
    for (const theme of themes) {
      const page = await browser.newPage();
      page.on('pageerror', (error) => errors.push(`${name} ${theme}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`${name} ${theme}: ${message.text()}`); });
      await page.evaluateOnNewDocument((value) => localStorage.setItem('edurozgaar-theme', value), theme);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (!url.pathname.startsWith('/api/')) return request.continue();
        const [status, body] = response(url);
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
assert.equal(cells, 40);
console.log(`P2C-2 focused responsive Business/Team lists: PASS (${cells}/40 cells)`);
