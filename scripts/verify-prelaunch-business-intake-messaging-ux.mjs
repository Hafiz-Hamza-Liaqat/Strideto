import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const BASE = process.env.STRIDETO_QA_BASE || 'https://127.0.0.1:8443';
const widths = [320, 375, 768, 1024, 1440];
const themes = ['light', 'dark'];
const request = { publicRequestRef: 'REQ-P1B', title: 'Private formation support', status: 'ready_for_quote', recordVersion: 1, providerDisplayName: 'P1B Provider', providerKind: 'independent', capabilityPublicName: 'Business Formation', jurisdictionName: 'Wyoming', actingFor: 'self', customerSummary: 'Prepare a formation request.', createdAt: '2026-08-17T10:00:00Z' };
const quote = { publicQuoteRef: 'QUOTE-P1B', requestPublicRef: request.publicRequestRef, title: request.title, status: 'sent', effectiveStatus: 'sent', recordVersion: 1, providerDisplayName: 'P1B Provider', providerKind: 'independent', capabilityPublicName: 'Business Formation', jurisdictionName: 'Wyoming', professionalFeeLines: [{ label: 'Professional preparation', amountMinor: 10000, currency: 'USD' }], officialFeeLines: [], subtotalProfessionalMinor: 10000, currency: 'USD', includedItems: [], excludedItems: [], sentAt: '2026-08-17T11:00:00Z' };
const gbsCase = { publicCaseRef: 'CASE-P1B', requestPublicRef: request.publicRequestRef, publicQuoteRef: quote.publicQuoteRef, title: request.title, status: 'in_progress', currentMilestoneKey: 'preparation_started', recordVersion: 1, providerDisplayName: 'P1B Provider', providerKind: 'independent', customerDisplayName: 'P1B Client', capabilityPublicName: 'Business Formation', jurisdictionName: 'Wyoming', actingFor: 'self', workflowTemplateKey: 'generic_professional_service', customerTasks: [], timelineEvents: [], requirementPack: { attached: false } };

function responseFor(path, realm) {
  if (path === '/api/auth/refresh-token') return realm === 'buyer' ? [200, { accessToken: 'buyer-fixture' }] : [401, { error: 'no_student_session' }];
  if (path === '/api/auth/me') return realm === 'buyer' ? [200, { user: { _id: 'buyer-1', role: 'User', name: 'P1B Client', email: 'buyer@example.test', onboardingCompleted: true } }] : [401, { error: 'no_student_session' }];
  if (path === '/api/auth/agent/refresh-token') return realm === 'provider' ? [200, { accessToken: 'provider-fixture' }] : [401, { error: 'no_provider_session' }];
  if (path === '/api/auth/agent/me') return realm === 'provider' ? [200, { account: { _id: 'agent-1', email: 'provider@example.test', agentType: 'agent' }, memberships: [] }] : [403, {}];
  if (path === '/api/agent/provider-domains/context') return [200, { needsOnboarding: false, workspaces: [{ subjectType: 'agent', subjectId: 'agent-1', kind: 'independent', domainId: 'business_services', path: '/agent/business-services' }] }];
  if (path === '/api/agent/profile') return [200, { profile: { agentType: 'agent' } }];
  if (path === '/api/agent/business-services/enabled') return [200, { enabled: true }];
  if (path === '/api/agent/business-services/context') return [200, { enabled: true, subjects: [{ subjectType: 'agent', subjectId: 'agent-1', label: 'P1B Provider', displayName: 'P1B Provider' }] }];
  if (path === '/api/agent/business-services/catalog') return [200, { launchCountryCodes: ['US'], capabilities: [], jurisdictions: [{ id: 'j:US-WY', name: 'Wyoming', countryCode: 'US', launchCandidate: true, currentReviewed: false }], entityTypes: [] }];
  if (path === '/api/agent/business-services/capabilities') return [200, { items: [{ id: 'cap-1', capabilityId: 'business_formation', publicName: 'Business Formation', status: 'active', trustStatus: 'evidence_backed', scope: { jurisdictionIds: ['j:US-WY'], entityTypeIds: ['et:US-WY:LLC'], protectedTitleIds: [] }, jurisdictionReadiness: [{ jurisdictionId: 'j:US-WY', state: 'candidate', productionReady: false }], productionAuthority: false, review: { decision: 'approved' } }] }];
  if (path === '/api/business/enabled') return [200, { enabled: true }];
  if (path === '/api/business/overview') return [200, { requestCounts: {}, quoteCounts: {}, caseCounts: {} }];
  if (path === '/api/business/private-beta/services/p1b-private') return [200, { item: { listingSlug: 'p1b-private', title: request.title, providerDisplayName: 'P1B Provider', jurisdictionName: 'Wyoming', entityTypeIds: ['et:US-WY:LLC'], privateBeta: true } }];
  if (path === `/api/business/requests/${request.publicRequestRef}` || path === `/api/agent/business-services/requests/${request.publicRequestRef}`) return [200, { item: request }];
  if (path === `/api/business/quotes/${quote.publicQuoteRef}` || path === `/api/agent/business-services/quotes/${quote.publicQuoteRef}`) return [200, { item: quote }];
  if (path === `/api/business/cases/${gbsCase.publicCaseRef}` || path === `/api/agent/business-services/cases/${gbsCase.publicCaseRef}`) return [200, { item: gbsCase }];
  if (path.endsWith('/document-requirements')) return [200, { items: [], canManageDocuments: false, security: { uploadEnabled: false } }];
  if (path.endsWith('/filing-authorization')) return [200, { item: null }];
  if (path.endsWith('/messages')) return [200, { items: [{ id: `${path}-message`, senderActorType: 'business_client', text: 'Contextual fixture message', createdAt: '2026-08-17T12:00:00Z' }], page: 1, limit: 20, total: 1, totalPages: 1 }];
  if (path === '/api/agent/business-services/messages') return [200, { items: [{ id: 'thread-1', contextType: 'request', contextPublicRef: request.publicRequestRef, title: request.title, lastMessageAt: '2026-08-17T12:00:00Z' }], page: 1, totalPages: 1 }];
  if (path.includes('/notifications')) return [200, { notifications: [], count: 0, unreadCount: 0 }];
  return [200, { items: [] }];
}

const routes = {
  buyer: ['/business', '/business/requests', `/business/requests/new?channel=private-beta&listingSlug=p1b-private`, `/business/requests/${request.publicRequestRef}`, '/business/quotes', `/business/quotes/${quote.publicQuoteRef}`, '/business/cases', `/business/cases/${gbsCase.publicCaseRef}`],
  provider: ['/agent/business-services', '/agent/business-services/profile', '/agent/business-services/requests', `/agent/business-services/requests/${request.publicRequestRef}`, '/agent/business-services/quotes', `/agent/business-services/quotes/${quote.publicQuoteRef}`, '/agent/business-services/cases', `/agent/business-services/cases/${gbsCase.publicCaseRef}`, '/agent/business-services/capabilities', '/agent/business-services/jurisdictions', '/agent/business-services/listings', '/agent/business-services/listings/new', '/agent/business-services/verification', '/agent/business-services/team', '/agent/business-services/messages', '/agent/business-services/notifications', '/agent/business-services/help', '/agent/business-services/settings'],
};

const browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors'] });
const errors = [];
let cells = 0;
try {
  for (const realm of Object.keys(routes)) {
    for (const theme of themes) {
      const page = await browser.newPage();
      page.on('pageerror', (error) => errors.push(`${realm} ${theme}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`${realm} ${theme}: ${message.text()}`); });
      await page.evaluateOnNewDocument((value) => localStorage.setItem('edurozgaar-theme', value), theme);
      await page.setRequestInterception(true);
      page.on('request', (incoming) => {
        const url = new URL(incoming.url());
        if (!url.pathname.startsWith('/api/')) return incoming.continue();
        if (incoming.method() === 'OPTIONS') return incoming.respond({ status: 204 });
        const [status, body] = responseFor(url.pathname, realm);
        return incoming.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      for (const width of widths) {
        for (const route of routes[realm]) {
          await page.setViewport({ width, height: width < 768 ? 900 : 1000 });
          await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          await page.waitForSelector('main', { timeout: 15_000 });
          await new Promise((resolve) => setTimeout(resolve, 250));
          const result = await page.evaluate(() => {
            const visible = (node) => Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
            const fields = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(visible);
            const headings = [...document.querySelectorAll('h1')].filter(visible);
            return { h1: headings[0]?.textContent?.trim() || '', h1Count: headings.length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, unlabeled: fields.filter((node) => !(node.labels?.length || node.getAttribute('aria-label') || node.getAttribute('aria-labelledby'))).length, boundary: document.body.innerText.includes('This page could not be displayed'), dark: document.documentElement.classList.contains('dark') };
          });
          assert.ok(result.h1, `${realm} ${route} ${theme} ${width}: route h1 missing`);
          assert.equal(result.h1Count, 1, `${realm} ${route} ${theme} ${width}: expected one visible h1`);
          assert.ok(result.overflow <= 2, `${realm} ${route} ${theme} ${width}: overflow ${result.overflow}`);
          assert.equal(result.unlabeled, 0, `${realm} ${route} ${theme} ${width}: unlabeled fields`);
          assert.equal(result.boundary, false, `${realm} ${route} ${theme} ${width}: error boundary`);
          assert.equal(result.dark, theme === 'dark', `${realm} ${route} ${theme} ${width}: theme`);
          cells += 1;
        }
      }
      await page.close();
    }
  }
} finally { await browser.close(); }
assert.deepEqual(errors, [], `Browser errors:\n${errors.join('\n')}`);
console.log(`P2B responsive Business verification/route semantics acceptance: ${cells}/${cells} light/dark cells passed at 320, 375, 768, 1024, 1440.`);
