import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const BASE = process.env.STRIDETO_QA_BASE || 'https://127.0.0.1:8443';
const widths = [320, 375, 768, 1024, 1440];
const themes = ['light', 'dark'];
const fixtureCase = {
  id: '64f000000000000000000001', caseType: 'study', workflowId: 'study-case', workflowVersion: 1,
  lifecycle: 'active', currentStage: 'document_preparation', title: 'P1A Education Case (fixture)',
  destinationCountry: 'GB', assignedMembershipId: '64f000000000000000000010',
};
const application = (id, institution, program, intake, status) => ({
  id, institution: { officialName: institution, countryCode: 'GB' }, program: { name: program },
  intake: { cycleLabel: intake }, destinationCountry: 'GB', status, deadlineAt: '2027-01-31T00:00:00.000Z',
  submittedAt: status === 'provider_attested_submitted' ? '2027-01-10T00:00:00.000Z' : null,
  statusHistory: [{ id: `${id}-history`, to: status, occurredAt: '2026-08-17T10:00:00.000Z' }], statusAuthority: 'provider_maintained',
});
const detail = {
  case: fixtureCase,
  workflow: { stages: ['intake', 'document_preparation', 'application_ready'], transitions: { document_preparation: ['application_ready'] } },
  context: { provider: { name: 'P1A Provider (fixture)', type: 'agent' }, student: { name: 'P1A Student (fixture)', email: 'fixture@example.test' }, service: { id: 'service-1', title: 'University Application Support', category: 'university_application_support' } },
  applications: [
    application('64f000000000000000000101', 'North University (fixture)', 'Computing', 'Autumn 2027', 'preparing'),
    application('64f000000000000000000102', 'South College (fixture)', 'Design', 'Spring 2028', 'provider_attested_submitted'),
  ],
  tasks: [
    { id: 'task-student', title: 'Upload transcript', responsibleActor: 'student', status: 'pending', dueAt: '2026-09-01T00:00:00.000Z' },
    { id: 'task-agent', title: 'Review transcript', responsibleActor: 'agent', status: 'pending' },
  ],
  documentRequests: [{ id: 'request-1', documentType: 'Transcript', purpose: 'Application review', status: 'requested', dueAt: '2026-09-01T00:00:00.000Z' }],
  approvals: [{ id: 'approval-1', actionType: 'external_submission', explanation: 'Approve external submission step', status: 'pending' }],
  notes: [{ id: 'note-1', visibility: 'shared', body: 'Student-visible progress note.' }],
  timeline: [{ id: 'event-1', eventType: 'case_created', createdAt: '2026-08-17T10:00:00.000Z' }, { id: 'event-2', eventType: 'application_created', createdAt: '2026-08-17T11:00:00.000Z' }],
  threadId: 'thread-case-1', messagingStatus: 'open',
};

function responseFor(path, realm) {
  if (path === '/api/auth/refresh-token') return realm === 'student' ? [200, { accessToken: 'fixture-student' }] : [401, { error: 'No Student session' }];
  if (path === '/api/auth/me') return realm === 'student' ? [200, { user: { _id: 'student-1', role: 'User', name: 'P1A Student', email: 'fixture@example.test', onboardingCompleted: true } }] : [401, { error: 'No Student session' }];
  if (path === '/api/auth/agent/refresh-token') return realm === 'agent' ? [200, { accessToken: 'fixture-agent' }] : [401, { error: 'No Provider session' }];
  if (path === '/api/auth/agent/me') return realm === 'agent' ? [200, { account: { _id: 'agent-1', email: 'provider@example.test', agentType: 'agent' }, memberships: [{ _id: 'membership-1', organizationId: 'org-1', role: 'owner', active: true }] }] : [403, { error: 'No Provider session' }];
  if (path === '/api/agent/provider-domains/context') return [200, { needsOnboarding: false, workspaces: [{ subjectType: 'agent', subjectId: 'agent-1', kind: 'independent', domainId: 'education_mobility', path: '/agent/education' }] }];
  if (path === '/api/agent/profile') return [200, { profile: { agentType: 'agent' } }];
  if (path === '/api/agent/business-services/enabled') return [200, { enabled: false }];
  if (path === '/api/cases') return [200, { cases: [fixtureCase], total: 1 }];
  if (path === `/api/cases/${fixtureCase.id}`) return [200, detail];
  if (path === `/api/cases/${fixtureCase.id}/messages`) return [200, { messages: [{ id: 'message-1', senderActorType: 'agent', text: 'Case-scoped update.' }], total: 1 }];
  if (path === '/api/agent/cases') return [200, { cases: [fixtureCase], total: 1 }];
  if (path === `/api/agent/cases/${fixtureCase.id}`) return [200, detail];
  if (path === `/api/agent/cases/${fixtureCase.id}/messages`) return [200, { messages: [{ id: 'message-1', senderActorType: 'student', text: 'Case-scoped question.' }], total: 1 }];
  if (path === '/api/agent/vault/grants') return [200, { grants: [] }];
  if (path === '/api/education/institutions' || path === '/api/education/programs') return [200, { data: [], total: 0 }];
  if (path === '/api/vault/documents') return [200, { items: [{ _id: 'doc-1', displayName: 'Transcript (fixture)', documentType: 'transcript', status: 'active' }], total: 1 }];
  if (path === '/api/reviews/eligibility') return [200, { eligible: false, reason: 'Interaction is not review eligible' }];
  if (path === '/api/reviews/mine') return [200, { reviews: [] }];
  if (path === '/api/reports/mine') return [200, { reports: [] }];
  if (path === '/api/disputes/mine') return [200, { disputes: [] }];
  if (path === '/api/consultations/64f000000000000000000201') return [200, { consultation: { id: '64f000000000000000000201', status: 'completed', purpose: 'Completed consultation (fixture)', requestedWindow: { start: '2026-08-01T10:00:00.000Z' }, confirmedStart: '2026-08-01T10:00:00.000Z', timezone: 'UTC', durationMinutes: 60, meetingMode: 'video', paymentState: 'free', completion: { completedAt: '2026-08-01T11:00:00.000Z' } }, history: [{ id: 'history-1', createdAt: '2026-08-01T11:00:00.000Z', toStatus: 'completed' }], threadId: 'consultation-thread-1' }];
  if (path === '/api/consultations/threads/consultation-thread-1/messages') return [200, { messages: [], total: 0 }];
  if (path.includes('/notifications') || path.includes('/inbox/')) return [200, { notifications: [], count: 0, unreadCount: 0 }];
  return [200, {}];
}

const browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors'] });
const errors = [];
let cells = 0;
try {
  for (const realm of ['student', 'agent']) {
    const routes = realm === 'student'
      ? ['/cases', `/cases/${fixtureCase.id}`, '/trust-center', '/consultations/64f000000000000000000201']
      : ['/agent/education/cases', `/agent/education/cases/${fixtureCase.id}`];
    for (const theme of themes) {
      const page = await browser.newPage();
      page.on('pageerror', (error) => errors.push(`${realm} ${theme} pageerror: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`${realm} ${theme} console: ${message.text()}`); });
      await page.evaluateOnNewDocument((preference) => localStorage.setItem('edurozgaar-theme', preference), theme);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (!url.pathname.startsWith('/api/')) return request.continue();
        if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers: { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' } });
        const [status, body] = responseFor(url.pathname, realm);
        return request.respond({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' } });
      });
      for (const width of widths) {
        for (const route of routes) {
          await page.setViewport({ width, height: width < 768 ? 900 : 1000, deviceScaleFactor: 1 });
          await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          await page.waitForSelector('h1', { timeout: 15_000 });
          await page.waitForFunction(() => !document.body.innerText.includes('Loading Case…'), { timeout: 15_000 }).catch(() => {});
          const result = await page.evaluate(() => {
            const visible = (element) => Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
            const fields = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(visible);
            return {
              h1: document.querySelector('h1')?.textContent?.trim() || '',
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              unlabeledFields: fields.filter((element) => !(element.labels?.length || element.getAttribute('aria-label') || element.getAttribute('aria-labelledby'))).length,
              errorBoundary: document.body.innerText.includes('This page could not be displayed'),
              dark: document.documentElement.classList.contains('dark'),
            };
          });
          assert.ok(result.h1, `${realm} ${route} ${theme} ${width}: h1 missing`);
          assert.ok(result.overflow <= 2, `${realm} ${route} ${theme} ${width}: overflow ${result.overflow}px`);
          assert.equal(result.unlabeledFields, 0, `${realm} ${route} ${theme} ${width}: unlabeled fields`);
          assert.equal(result.errorBoundary, false, `${realm} ${route} ${theme} ${width}: route error boundary`);
          assert.equal(result.dark, theme === 'dark', `${realm} ${route} ${theme} ${width}: theme not applied`);
          cells += 1;
        }
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
assert.deepEqual(errors, [], `Browser errors:\n${errors.join('\n')}`);
console.log(`P1A responsive Education Case/Trust acceptance: ${cells}/${cells} light/dark cells passed at 320, 375, 768, 1024, 1440.`);
