import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const BASE = process.env.STRIDETO_QA_BASE || 'https://127.0.0.1:8443';
const widths = [320, 375, 768, 1024, 1440];
const themes = ['light', 'dark'];
const capId = '507f1f77bcf86cd799439011';
const scope = { countryCodes: ['US'], jurisdictionIds: ['j:US-WY'], entityTypeIds: ['et:US-WY:LLC'], protectedTitleIds: [] };
const capability = { id: capId, subjectType: 'agent', subjectId: 'agent-p1c', subjectKind: 'Independent', subjectLabel: 'P1C Provider', capabilityId: 'business_formation', publicName: 'Business Formation', status: 'active', trustStatus: 'evidence_submitted', scope, jurisdictionReadiness: [{ jurisdictionId: 'j:US-WY', name: 'Wyoming', productionReady: false, state: 'draft' }], evidenceRequired: true, evidence: [{ evidenceIndex: 0, evidenceType: 'regulatory_registration', decision: 'pending', jurisdictionId: 'j:US-WY', referenceNumber: 'P1C-REF', officialRegistryUrl: 'https://example.test/registry/P1C-REF', issuingAuthorityId: 'auth:test', notes: 'Disposable evidence' }], review: {}, recordVersion: 0 };

function responseFor(path, realm) {
  if (path === '/api/auth/refresh-token') return realm === 'admin' ? [200, { accessToken: 'admin-fixture' }] : [401, {}];
  if (path === '/api/auth/me') return realm === 'admin' ? [200, { user: { _id: 'admin-p1c', role: 'SuperAdmin', name: 'P1C Admin', email: 'admin@example.test' } }] : [401, {}];
  if (path === '/api/auth/agent/refresh-token') return realm === 'provider' ? [200, { accessToken: 'provider-fixture' }] : [401, {}];
  if (path === '/api/auth/agent/me') return realm === 'provider' ? [200, { account: { _id: 'agent-p1c', agentType: 'agent', email: 'provider@example.test' }, memberships: [] }] : [403, {}];
  if (path === '/api/admin/permissions') return [200, { permissions: ['verification.read', 'verification.review', 'verification.approve'] }];
  if (path.startsWith('/api/admin/verification/queue')) return [200, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } }];
  if (path === `/api/admin/gbs/capabilities/${capId}`) return [200, { capability, history: [] }];
  if (path === '/api/agent/provider-domains/context') return [200, { needsOnboarding: false, workspaces: [{ subjectType: 'agent', subjectId: 'agent-p1c', domainId: 'business_services', path: '/agent/business-services' }] }];
  if (path === '/api/agent/profile') return [200, { profile: { agentType: 'agent' } }];
  if (path === '/api/agent/business-services/enabled') return [200, { enabled: true }];
  if (path === '/api/agent/business-services/context') return [200, { enabled: true, subjects: [{ subjectType: 'agent', subjectId: 'agent-p1c', displayName: 'P1C Provider' }] }];
  if (path === '/api/agent/business-services/catalog') return [200, { launchCountryCodes: ['US'], capabilities: [{ capabilityId: 'business_formation', publicName: 'Business Formation' }], jurisdictions: [{ id: 'j:US-WY', name: 'Wyoming', countryCode: 'US', reviewStatus: 'draft', currentReviewed: false, structural: true }], entityTypes: [{ entityTypeId: 'et:US-WY:LLC', jurisdictionId: 'j:US-WY', displayName: 'LLC' }] }];
  if (path.startsWith('/api/agent/business-services/capabilities')) return [200, { items: [capability] }];
  if (path.includes('/notifications')) return [200, { notifications: [], count: 0, unreadCount: 0 }];
  return [200, { items: [] }];
}

const routes = {
  admin: ['/admin/verification-queue', `/admin/gbs/capabilities/${capId}`],
  provider: ['/agent/business-services/capabilities'],
};
const browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors'] });
const errors = [];
let cells = 0;
try {
  for (const [realm, paths] of Object.entries(routes)) {
    for (const theme of themes) {
      const page = await browser.newPage();
      page.on('pageerror', (error) => errors.push(`${realm} ${theme}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`${realm} ${theme}: ${message.text()}`); });
      await page.evaluateOnNewDocument((value) => localStorage.setItem('edurozgaar-theme', value), theme);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname.startsWith('/api/')) {
          const [status, body] = responseFor(url.pathname, realm);
          request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
        } else request.continue();
      });
      for (const route of paths) {
        for (const width of widths) {
          await page.setViewport({ width, height: 900 });
          await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
          const result = await page.evaluate(() => ({
            h1: document.querySelector('h1')?.textContent?.trim() || '',
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          }));
          assert.ok(result.h1, `${route} has an h1 at ${width}px ${theme}`);
          assert.equal(result.overflow, false, `${route} has no body overflow at ${width}px ${theme}`);
          cells += 1;
        }
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
assert.deepEqual(errors, [], errors.join('\n'));
assert.equal(cells, 30);
console.log(`prelaunchAdminEvidenceJurisdiction UX: PASS (${cells}/30 cells)`);
