import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const BASE = process.env.STRIDETO_QA_BASE || 'https://127.0.0.1:8443';
const widths = [320, 375, 768, 1024, 1440];
const themes = ['light', 'dark'];
const caseId = '64f000000000000000000001';
const pageMeta = { page: 1, limit: 20, total: 45, totalPages: 3 };
const detail = {
  case: { id: caseId, caseType: 'study', workflowId: 'study-case', workflowVersion: 1, lifecycle: 'active', currentStage: 'intake', title: 'Bounded Education Case', destinationCountry: 'GB', assignedMembershipId: '64f000000000000000000010' },
  workflow: { stages: ['intake', 'profile_review'], transitions: { intake: ['profile_review'] } },
  context: { provider: { name: 'Bounded Provider', type: 'agent' }, student: { name: 'Bounded Student', email: 'student@example.test' }, service: { title: 'University Application Support', category: 'university_application_support', source: 'engagement_snapshot' } },
  applications: [{ id: 'app-1', institution: { officialName: 'Bounded University' }, program: { name: 'Computing' }, intake: { cycleLabel: 'Autumn' }, status: 'preparing', statusHistory: [] }],
  tasks: [{ id: 'task-1', title: 'Current task', responsibleActor: 'student', status: 'pending' }],
  documentRequests: [{ id: 'docreq-1', documentType: 'Transcript', purpose: 'Case review', status: 'requested' }],
  approvals: [{ id: 'approval-1', actionType: 'scope_change', explanation: 'Review scope', status: 'pending' }],
  notes: [{ id: 'note-1', visibility: 'shared', body: 'Shared bounded note' }],
  timeline: [{ id: 'event-1', eventType: 'case_created', createdAt: '2026-08-18T00:00:00.000Z' }],
  childPagination: { applications: pageMeta, tasks: pageMeta, documentRequests: pageMeta, approvals: pageMeta, notes: pageMeta, timeline: pageMeta },
  threadId: null, messagingStatus: 'open', taskStatus: 'open',
};

function response(path, realm) {
  if (path === '/api/auth/agent/refresh-token') return ['agent', 'public'].includes(realm) ? [200, { accessToken: 'p2c3-agent' }] : [401, {}];
  if (path === '/api/auth/agent/me') return ['agent', 'public'].includes(realm) ? [200, { account: { _id: 'agent-1', email: 'provider@example.test', agentType: 'agent' }, memberships: [] }] : [401, {}];
  if (path === '/api/auth/refresh-token') return ['student', 'public'].includes(realm) ? [200, { accessToken: 'p2c3-student' }] : [401, {}];
  if (path === '/api/auth/me') return ['student', 'public'].includes(realm) ? [200, { user: { _id: 'student-1', name: 'Bounded Student', role: 'User' } }] : [401, {}];
  if (path === '/api/agent/provider-domains/context') return [200, { needsOnboarding: false, workspaces: [{ subjectType: 'agent', subjectId: 'agent-1', kind: 'independent', domainId: 'education_mobility', path: '/agent/education' }] }];
  if (path === '/api/agent/profile') return [200, { profile: { agentType: 'agent', professionalName: 'Bounded Provider' } }];
  if (path === '/api/agent/business-services/enabled') return [200, { enabled: false }];
  if (path === '/api/agents') return [200, { profiles: [{ slug: 'bounded-provider', professionalName: 'Bounded Provider', agentType: 'agent', countryCode: 'PK', destinationCountries: ['GB'], specialties: ['university_application_support'], professionalSummary: 'Public safe summary', educationProfessionalVerification: { verified: true, scope: 'education_mobility' } }], page: 1, limit: 20, total: 45, pages: 3 }];
  if (path === `/api/agent/cases/${caseId}` || path === `/api/cases/${caseId}`) return [200, detail];
  if (path === '/api/education/institutions' || path === '/api/education/programs') return [200, { data: [], total: 0 }];
  if (path === '/api/vault/documents') return [200, { items: [] }];
  if (path.includes('/notifications')) return [200, { notifications: [], data: [] }];
  return [200, {}];
}

const scenarios = [['public', '/agents'], ['agent', `/agent/education/cases/${caseId}`], ['student', `/cases/${caseId}`]];
const browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors'] });
const errors = []; let cells = 0;
try {
  for (const [realm, route] of scenarios) for (const theme of themes) {
    const page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(`${realm} ${theme}: ${error.message}`));
    page.on('console', (message) => { const value = message.text(); if (message.type() === 'error' && !value.includes('icon from the Manifest')) errors.push(`${realm} ${theme}: ${value}`); });
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
        h1: document.querySelector('h1')?.textContent?.trim(), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        previous: [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Previous'),
        next: [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Next'),
        dark: document.documentElement.classList.contains('dark'), boundary: document.body.innerText.includes('This page could not be displayed'),
      }));
      assert.ok(result.h1); assert.ok(result.overflow <= 2, `${realm} ${width}: overflow ${result.overflow}`);
      assert.equal(result.previous, true); assert.equal(result.next, true); assert.equal(result.dark, theme === 'dark'); assert.equal(result.boundary, false); cells += 1;
    }
    await page.close();
  }
} finally { await browser.close(); }
assert.deepEqual(errors, [], errors.join('\n')); assert.equal(cells, 30);
console.log(`P2C-3 focused responsive directory/Case history: PASS (${cells}/30 cells)`);
