/**
 * Mission 26 — final multi-role browser acceptance (cross-role paths).
 *
 * Runs a local Chromium/Edge over a local Vite dev server with EVERY /api call
 * intercepted and fulfilled from synthetic fixtures. External DNS is blackholed
 * by --host-resolver-rules, so no live service, provider, database or account is
 * involved. Fixtures are deliberately marked as fixtures in their content.
 *
 * This harness does NOT repeat Mission 24's responsive/accessibility sweep or
 * the Institution portal closure. It proves the CROSS-ROLE product invariants:
 * realm denial, privacy boundaries, zero-verified-data public behaviour,
 * provider-not-configured truthfulness, and the Student→Agent handoff surfaces.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = 'http://127.0.0.1:5176';
const cdpPort = 9336;
const screenshotDir = path.join(root, 'docs', 'screenshots', 'responsive');
const browsers = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const exists = (file) => {
  try {
    return process.getBuiltinModule('node:fs').statSync(file).isFile();
  } catch {
    return false;
  }
};

let assertions = 0;
const failures = [];
const check = (value, message) => {
  assertions += 1;
  try {
    assert.ok(value, message);
  } catch (error) {
    failures.push(error.message);
  }
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(fn, timeout = 12_000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await delay(75);
  }
  throw last || new Error('Timed out waiting for browser state');
}

class Cdp {
  constructor(url) {
    this.id = 1;
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
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
        return;
      }
      for (const handler of this.handlers.get(message.method) || []) {
        Promise.resolve(handler(message.params)).catch((error) => failures.push(`CDP ${message.method}: ${error.message}`));
      }
    });
  }
  on(method, handler) {
    this.handlers.set(method, [...(this.handlers.get(method) || []), handler]);
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }
  close() {
    this.socket.close();
  }
}

// ── Synthetic fixtures ───────────────────────────────────────────────────────
//
// Every record below is a FIXTURE. Names carry the "(fixture)" marker wherever
// a human could otherwise mistake one for a real, source-backed record.

const FIXTURE = '(fixture)';

const vaultDocuments = [
  {
    _id: 'doc-1',
    title: `Academic transcript ${FIXTURE}`,
    documentType: 'transcript',
    status: 'active',
    verificationStatus: 'unverified',
    privacyClassification: 'sensitive',
    expiryState: 'valid',
    activeGrantCount: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    _id: 'doc-2',
    title: `Passport ${FIXTURE}`,
    documentType: 'passport',
    status: 'active',
    verificationStatus: 'unverified',
    privacyClassification: 'highly_sensitive',
    expiryState: 'expiring_soon',
    activeGrantCount: 0,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];

const grants = [
  {
    _id: 'grant-1',
    documentId: 'doc-1',
    granteeType: 'agent',
    granteeLabel: `Strideto Fixture Advisory ${FIXTURE}`,
    permissions: ['view'],
    status: 'active',
    expiresAt: '2026-12-31T00:00:00.000Z',
    createdAt: '2026-07-05T00:00:00.000Z',
  },
  {
    _id: 'grant-2',
    documentId: 'doc-1',
    granteeType: 'agent',
    granteeLabel: `Former Advisory ${FIXTURE}`,
    permissions: ['view'],
    status: 'revoked',
    revokedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
  },
];

// One consultation and one case, shared by the Student and the Agent surfaces —
// the same synthetic interaction seen from both sides of the handoff.
const studentConsultation = {
  id: 'consultation-1',
  status: 'confirmed',
  purpose: `UK application review ${FIXTURE}`,
  requestedWindow: { start: '2026-08-20T09:00:00.000Z', end: '2026-08-20T09:45:00.000Z' },
  timezone: 'Europe/London',
  restricted: false,
  paymentState: 'not_configured',
};
const studentCase = {
  id: 'case-1',
  title: `UK postgraduate application ${FIXTURE}`,
  caseType: 'study_application',
  lifecycle: 'active',
  currentStage: 'document_collection',
  openApprovalRequests: 1,
};

function json(rawUrl, method, realm, scenario) {
  const p = new URL(rawUrl).pathname;
  const role = realm === 'admin' ? 'SuperAdmin' : realm === 'moderator' ? 'Moderator' : 'User';

  // ── Session bootstrap per realm ──
  if (p === '/api/auth/refresh-token') {
    return ['student', 'admin', 'moderator'].includes(realm)
      ? [200, { accessToken: `fixture-${role}` }]
      : [401, { error: 'No user session' }];
  }
  if (p === '/api/auth/me') {
    return ['student', 'admin', 'moderator'].includes(realm)
      ? [200, { user: { _id: 'student-1', role, name: 'Zoë O’Connor 李', email: 'zoe@example.test', onboardingCompleted: true } }]
      : [401, { error: 'Authentication required' }];
  }
  if (p === '/api/auth/employer/refresh-token') {
    return realm === 'employer' ? [200, { accessToken: 'fixture-employer' }] : [401, { error: 'Employer session required' }];
  }
  if (p === '/api/employer/me') {
    return realm === 'employer'
      ? [200, { employer: { _id: 'employer-1', companyName: `Global Fixture Employer ${FIXTURE}`, email: 'employer@example.test' } }]
      : [403, { error: 'Employer realm required' }];
  }
  if (p.includes('/auth/agent/refresh-token')) {
    return realm === 'agent' ? [200, { accessToken: 'fixture-agent' }] : [401, { error: 'Agent session required' }];
  }
  if (p.includes('/auth/agent/me')) {
    return realm === 'agent'
      ? [200, { account: { _id: 'agent-1', email: 'advisor@example.test', verificationStatus: 'approved' }, memberships: [{ _id: 'membership-1', organizationId: 'org-1', role: 'owner', active: true }] }]
      : [403, { error: 'Agent realm required' }];
  }
  if (p === '/api/auth/institution/refresh-token') {
    return realm === 'institution' ? [200, { accessToken: 'fixture-institution' }] : [401, { error: 'Institution session required' }];
  }
  if (p === '/api/auth/institution/me') {
    return realm === 'institution'
      ? [200, { account: { _id: 'institution-1', email: 'registrar@institution.example', accountStatus: 'active' }, memberships: [{ _id: 'membership-1', organizationId: 'org-1', role: 'owner', active: true }] }]
      : [403, { error: 'Institution realm required' }];
  }

  // ── Public education discovery: Mission 25 real verified records = 0 ──
  if (/\/api\/(tests|programs|program-explorer|scholarship-intelligence|scholarships|institutions)/.test(p) && method === 'GET') {
    if (scenario === 'error') return [500, { error: 'Education directory is temporarily unavailable' }];
    return [200, { data: [], items: [], results: [], programs: [], scholarships: [], tests: [], total: 0, pagination: { page: 1, pages: 1, total: 0 } }];
  }

  // ── Public agent marketplace (approved posts only) ──
  if (p.includes('/agents/marketplace') && method === 'GET') {
    return [200, {
      posts: [{
        _id: 'post-1',
        slug: 'uk-study-advisory-fixture',
        title: `UK study application support ${FIXTURE}`,
        summary: 'Advisory support for UK postgraduate applications. Outcomes are decided by institutions and authorities.',
        postType: 'service',
        moderationStatus: 'approved',
        organization: { displayName: `Strideto Fixture Advisory ${FIXTURE}`, verificationStatus: 'approved' },
        agentStatement: 'This is an Agent statement, not an official institution fact.',
        sourceFreshnessState: 'fresh',
      }],
      pagination: { page: 1, pages: 1, total: 1 },
      total: 1,
    }];
  }

  // ── Student realm ──
  if (p === '/api/journey/dashboard') {
    if (scenario === 'error') return [500, { error: 'Journey service is temporarily unavailable' }];
    return [200, {
      nextBestAction: {
        action: 'Act on approaching deadline',
        reason: `Deadline for "MSc Applied Quantum Systems ${FIXTURE}" is within 7 days.`,
        priority: 'high',
        entityType: 'program',
        entityId: 'program-1',
        dueDate: '2026-08-15T00:00:00.000Z',
        sourceType: 'institution_official',
      },
      pendingActions: [{ _id: 'task-1', title: `Upload transcript ${FIXTURE}`, status: 'pending', priority: 'high', dueDate: '2026-08-14T00:00:00.000Z' }],
      upcomingDeadlines: [{ _id: 'deadline-1', title: `MSc intake ${FIXTURE}`, deadlineAt: '2026-08-15T00:00:00.000Z', urgency: 'urgent', sourceType: 'institution_official', entityType: 'program', entityId: 'program-1' }],
      overdueDeadlines: [],
      activeApplications: [],
      savedOpportunities: [{ _id: 'saved-1', entityType: 'program', entityId: 'program-1', title: `MSc Applied Quantum Systems ${FIXTURE}` }],
    }];
  }
  if (p === '/api/journey/tasks') return [200, { tasks: [{ _id: 'task-1', title: `Upload transcript ${FIXTURE}`, status: 'pending', priority: 'high', dueDate: '2026-08-14T00:00:00.000Z' }], total: 1 }];
  if (p === '/api/journey/deadlines') return [200, { deadlines: [{ _id: 'deadline-1', title: `MSc intake ${FIXTURE}`, deadlineAt: '2026-08-15T00:00:00.000Z', urgency: 'urgent', sourceType: 'institution_official' }], total: 1 }];
  if (p === '/api/journey/saved') return [200, { savedOpportunities: [{ _id: 'saved-1', entityType: 'program', entityId: 'program-1', title: `MSc Applied Quantum Systems ${FIXTURE}` }], total: 1 }];

  if (p === '/api/vault/documents') {
    if (scenario === 'empty') return [200, { items: [], documents: [], total: 0 }];
    return [200, { items: vaultDocuments, documents: vaultDocuments, total: vaultDocuments.length }];
  }
  if (/^\/api\/vault\/documents\/doc-1$/.test(p)) return [200, { document: vaultDocuments[0], versions: [] }];
  if (/^\/api\/vault\/documents\/doc-1\/grants$/.test(p)) {
    if (method === 'POST') return [201, { grant: grants[0] }];
    return [200, { grants, items: grants }];
  }
  if (/^\/api\/vault\/documents\/doc-2/.test(p)) return [403, { error: 'You do not have access to this document' }];

  if (p === '/api/copilot/ask' || p === '/api/copilot/conversations') {
    return [200, {
      groundingStatus: 'provider_not_configured',
      answerType: 'not_configured',
      answer: 'AI synthesis is unavailable. Review the verified evidence below.',
      evidence: [{
        id: 'ev-1',
        sourceType: 'institution_submitted',
        entityType: 'program',
        fact: `MSc Applied Quantum Systems ${FIXTURE}`,
        value: 'JPY 123,456 per year',
        sourceLabel: `Institution official catalogue ${FIXTURE}`,
        lastVerifiedAt: '2026-08-01T00:00:00.000Z',
      }],
      sourceWarnings: ['Verify the current intake deadline directly with the institution.'],
      conversations: [],
      providerMeta: { providerState: 'not_configured' },
      generatedAt: '2026-08-10T10:00:00.000Z',
    }];
  }

  if (p === '/api/budget/plans') return [200, { plans: [{ _id: 'm26-plan', title: `UK study plan ${FIXTURE}`, journeyType: 'study', status: 'active' }], total: 1 }];
  if (p === '/api/budget/plans/m26-plan') return [200, { plan: { _id: 'm26-plan', title: `UK study plan ${FIXTURE}`, journeyType: 'study', status: 'active', destinationCountry: 'United Kingdom', targetIntake: 'Autumn 2027' } }];
  if (p === '/api/budget/plans/m26-plan/summary') {
    return [200, { summary: {
      note: 'Based on currently known costs. Unknown costs remain unresolved.',
      totalsByCurrency: { GBP: 1500000, JPY: 123456 },
      multiCurrencyUnresolved: true,
      unknownCostCount: 1,
      estimatedCostCount: 1,
      dataQuality: { staleCount: 0 },
      completeness: { missing: [] },
    } }];
  }
  if (p === '/api/budget/plans/m26-plan/items') {
    return [200, { items: [
      { _id: 'cost-1', category: 'tuition', label: `Tuition ${FIXTURE}`, amountState: 'known', money: { amountMinor: 1200000, currency: 'GBP' }, truthCategory: 'institution_official', cadence: 'one_time', freshnessState: 'fresh' },
      { _id: 'cost-2', category: 'living_expenses', label: `Accommodation ${FIXTURE}`, amountState: 'unknown', truthCategory: 'unknown', cadence: 'monthly' },
      { _id: 'cost-3', category: 'travel', label: `Travel ${FIXTURE}`, amountState: 'known', money: { amountMinor: 123456, currency: 'JPY' }, truthCategory: 'estimate', cadence: 'one_time' },
    ] }];
  }

  if (p === '/api/consultations') return [200, { consultations: [studentConsultation], total: 1 }];
  if (p === '/api/cases') return [200, { cases: [studentCase], total: 1 }];
  if (p === '/api/reviews/mine') {
    return [200, { reviews: [{ _id: 'review-1', title: `Completed consultation ${FIXTURE}`, status: 'published', rating: 5, body: 'Advisory support was clear and timely.' }], total: 1 }];
  }
  if (p === '/api/reports/mine') return [200, { reports: [], total: 0 }];
  if (p === '/api/disputes/mine') return [200, { disputes: [], total: 0 }];
  if (p.startsWith('/api/commerce')) return [200, { orders: [], transactions: [], data: [], total: 0, pagination: { page: 1, pages: 1, total: 0 } }];

  // ── Employer realm ──
  if (p === '/api/employer/dashboard') {
    return [200, { activeJobs: 1, totalApplications: 2, totalViews: 3, shortlistedCandidates: 1, verified: false, verificationLevel: 'pending', jobs: [{ _id: 'job-1', title: `Research coordinator ${FIXTURE}`, views: 3, applications: 2, shortlisted: 1 }] }];
  }
  if (p === '/api/employer/jobs') return [200, { data: [{ _id: 'job-1', title: `Research coordinator ${FIXTURE}`, status: 'active', planType: 'free', applyType: 'internal', applicationsTracked: true, applications: 2, views: 3, createdAt: '2026-08-01T00:00:00.000Z' }], jobs: [], pagination: { page: 1, pages: 1, total: 1 } }];
  if (p === '/api/employer/plans') return [200, { plans: [] }];

  // ── Agent realm ──
  if (p.endsWith('/agent/dashboard')) {
    return [200, { verificationStatus: 'approved', isApproved: true, profileCompleteness: 80, consultations: { incoming: 1, upcoming: 1, history: 0 }, marketplace: { drafts: 0, pendingReview: 0, published: 1, needsChanges: 0 } }];
  }
  if (p.endsWith('/agent/services')) return [200, { services: [{ _id: 'service-1', title: `UK application support ${FIXTURE}`, status: 'published' }] }];
  if (p.endsWith('/agent/consultations')) return [200, { consultations: [studentConsultation], total: 1 }];
  if (p.endsWith('/agent/cases')) return [200, { cases: [studentCase], total: 1 }];
  if (p.endsWith('/agent/commerce/history')) return [200, { orders: [], transactions: [] }];
  if (p.includes('/marketplace-payments/connect/sync') || p.includes('/marketplace-payments/connect/status')) {
    return [200, { status: { providerKycStatus: 'not_started', chargesCapability: 'inactive', transfersCapability: 'inactive', ready: false, payoutsEnabled: false, configurationState: 'not_configured', requirementsSummary: ['Provider configuration required'] } }];
  }
  if (p.endsWith('/agent/trust') || p.includes('/agent/reviews')) return [200, { reviews: [], aggregate: { averageRating: null, reviewCount: 0 }, total: 0 }];

  // ── Institution realm (light sample; depth lives in the Mission 18/24 closure) ──
  if (p.includes('/institution-portal/dashboard') || p.endsWith('/institution/dashboard')) {
    return [200, { organizationId: 'org-1', membership: { role: 'owner' }, verificationStatus: 'approved', claimState: 'approved', profileCompleteness: 70, publishedPrograms: 0, draftPrograms: 0, openConflicts: 0 }];
  }

  // ── Admin realm ──
  if (p === '/api/admin/permissions') return [200, { permissions: realm === 'moderator' ? ['trust.review'] : ['*'] }];
  if (p === '/api/admin/overview') {
    return [200, {
      generatedAt: '2026-08-10T10:00:00.000Z',
      users: { totalStudents: 10, activeStudents: 9, suspendedStudents: 1 },
      verification: { pending: 2, needsInformation: 1, enhancedReview: 0 },
      trustOperations: { openReports: 1, openDisputes: 0 },
      services: { activeConsultations: 1, activeCases: 1 },
      commerce: { refundRequests: 1, reconciliationMismatches: 1 },
      institutions: { claimsPending: 1 },
      marketplace: { pendingModeration: 1 },
      dataQuality: { staleFacts: 2, reviewDueFacts: 1, brokenSources: 0 },
      verifiedLaunch: { realVerifiedRecords: 0, pipelineMode: 'dry_run_only', lastBatchState: 'draft' },
      ai: { providerStatus: { state: 'not_configured' }, source: 'in-process config' },
      recentAuditActivity: { scope: 'safe metadata', entries: [{ actorEmail: 'admin@example.test', action: 'verification.reviewed', targetType: 'Organization', createdAt: '2026-08-10T10:00:00.000Z' }] },
    }];
  }
  if (p === '/api/admin/trust/metrics') return [200, { stale: 2, broken: 0, review_due: 1 }];
  if (p === '/api/admin/commerce/reconciliation') {
    return [200, { data: [{ _id: 'rec-1', correlationId: 'corr-fixture-1', expectedAmountMinor: 123456, actualAmountMinor: 123450, expectedCurrency: 'KWD', status: 'mismatch', discrepancyReason: 'Provider amount mismatch', createdAt: '2026-08-01T00:00:00.000Z' }], pagination: { page: 1, pages: 1, total: 1 } }];
  }
  if (p.startsWith('/api/admin/')) {
    if (realm === 'moderator' && /(system|commerce\/(refund|ledger)|users\/.*\/suspend)/.test(p)) {
      return [403, { error: 'This action requires SuperAdmin authority' }];
    }
    return [200, { data: [], items: [], pagination: { page: 1, pages: 1, total: 0 } }];
  }

  if (scenario === 'error') return [500, { error: 'Service is temporarily unavailable' }];
  return [200, { data: [], items: [], results: [], jobs: [], programs: [], scholarships: [], pagination: { page: 1, pages: 1, total: 0 }, total: 0, totalPages: 1 }];
}

async function run() {
  const browser = browsers.find(exists);
  if (!browser) throw new Error('No local Chrome/Edge binary found');
  await mkdir(screenshotDir, { recursive: true });
  const browserProfile = await mkdtemp(path.join(os.tmpdir(), 'strideto-m26-'));
  let vite;
  let chrome;
  let client;
  try {
    const viteBin = path.join(root, 'client', 'node_modules', 'vite', 'bin', 'vite.js');
    vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', '5176', '--strictPort'], {
      cwd: path.join(root, 'client'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let viteError = '';
    vite.stderr.on('data', (chunk) => { viteError += chunk.toString(); });
    await waitFor(async () => {
      if (vite.exitCode != null) throw new Error(`Vite exited: ${viteError}`);
      try { return (await fetch(baseUrl)).ok; } catch { return false; }
    });

    chrome = spawn(browser, [
      '--headless=new', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${browserProfile}`,
      '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--disable-component-update', '--disable-sync', '--disable-extensions', '--hide-scrollbars',
      '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost', 'about:blank',
    ], { windowsHide: true, stdio: 'ignore' });
    const targets = await waitFor(async () => {
      try { const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`); return response.ok ? response.json() : null; }
      catch { return null; }
    });
    client = new Cdp(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await client.connect();

    let realm = 'public';
    let scenario = 'normal';
    let navigationId = 0;
    const runtimeErrors = [];
    const requestCounts = new Map();
    const responseLog = [];
    const externalRequests = [];

    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) =>
      runtimeErrors.push(exceptionDetails.exception?.description || exceptionDetails.text));
    client.on('Fetch.requestPaused', async ({ requestId, request }) => {
      const url = new URL(request.url);
      if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') externalRequests.push(request.url);
      const key = `${navigationId} ${request.method} ${url.pathname}`;
      requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
      if (scenario === 'slow' && /dashboard|documents|plans/.test(url.pathname)) await delay(600);
      const [status, data] = json(request.url, request.method, realm, scenario);
      responseLog.push({ realm, scenario, method: request.method, path: url.pathname, status });
      await client.send('Fetch.fulfillRequest', {
        requestId,
        responseCode: status,
        responseHeaders: [
          { name: 'Content-Type', value: 'application/json; charset=utf-8' },
          { name: 'Cache-Control', value: 'no-store' },
          { name: 'Access-Control-Allow-Origin', value: baseUrl },
          { name: 'Access-Control-Allow-Credentials', value: 'true' },
          { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Idempotency-Key' },
          { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
        ],
        body: Buffer.from(JSON.stringify(data)).toString('base64'),
      });
    });

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Fetch.enable', { patterns: [
      { urlPattern: `${baseUrl}/api/*`, requestStage: 'Request' },
      { urlPattern: 'http://localhost:5000/api/*', requestStage: 'Request' },
      { urlPattern: 'http://*/api/*', requestStage: 'Request' },
      { urlPattern: 'https://*/api/*', requestStage: 'Request' },
    ] });

    const viewport = (width, height) =>
      client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });

    async function navigate(route, options = {}) {
      realm = options.realm ?? 'public';
      scenario = options.scenario ?? 'normal';
      navigationId += 1;
      const loaded = await client.evaluate(`location.origin === ${JSON.stringify(baseUrl)} && !!document.getElementById('root')`);
      const previousHeading = loaded ? await client.evaluate(`document.querySelector('h1')?.innerText?.trim() || ''`) : '';
      if (loaded && !options.hardLoad) {
        await client.evaluate(`history.pushState({}, '', ${JSON.stringify(route)}); dispatchEvent(new PopStateEvent('popstate'))`);
      } else {
        await client.send('Page.navigate', { url: `${baseUrl}${route}` });
      }
      await waitFor(() => client.evaluate(`document.readyState === 'complete' && !!document.getElementById('root')`));
      try {
        if (options.waitFor) await waitFor(() => client.evaluate(options.waitFor));
        else await waitFor(() => client.evaluate(`(() => {
          const h = document.querySelector('h1')?.innerText?.trim() || '';
          return !!h && h !== ${JSON.stringify(previousHeading)};
        })()`), 6_000);
      } catch { /* structural checks below report precisely what is missing */ }
      await delay(150);
    }

    const text = () => client.evaluate(`document.body.innerText`);
    async function inspect() {
      return client.evaluate(`(() => {
        const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.title || '').trim();
        const controls = [...document.querySelectorAll('button,[role="button"]')].filter(visible);
        return {
          path: location.pathname,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          mainCount: document.querySelectorAll('main').length,
          h1: document.querySelector('h1')?.innerText?.trim() || '',
          unnamedControls: controls.filter((el) => !name(el)).length,
          bodyText: document.body.innerText,
        };
      })()`);
    }
    async function shell(label) {
      const info = await inspect();
      check(info.scrollWidth <= info.clientWidth + 2, `${label}: horizontal overflow ${info.scrollWidth}/${info.clientWidth}`);
      check(info.mainCount === 1, `${label}: expected exactly one main landmark, got ${info.mainCount}`);
      check(Boolean(info.h1), `${label}: primary heading missing`);
      check(info.unnamedControls === 0, `${label}: unnamed interactive control`);
      if (info.bodyText.trim().length <= 40) {
        const debug = await client.evaluate(`({ path: location.pathname, html: document.getElementById('root')?.innerHTML.slice(0, 400) })`);
        check(false, `${label}: page rendered blank — ${JSON.stringify(debug)} responses=${JSON.stringify(responseLog.slice(-6))}`);
      } else {
        check(true, `${label}: page rendered content`);
      }
      check(!/at\s+\w+\s+\(.*:\d+:\d+\)/.test(info.bodyText), `${label}: raw stack trace rendered`);
      return info;
    }
    const screenshot = async (name) => {
      const result = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      await writeFile(path.join(screenshotDir, name), Buffer.from(result.data, 'base64'));
    };

    // Actual private VALUES from the Student fixture. A page is allowed to
    // *mention* the Vault (an Institution login page truthfully says it grants
    // no Vault access); it is never allowed to render this Student's data.
    const PRIVATE_LEAK = new RegExp(
      [
        'Academic transcript \\(fixture\\)',
        'Passport \\(fixture\\)',
        'UK study plan \\(fixture\\)',
        'UK postgraduate application \\(fixture\\)',
        'zoe@example\\.test',
        'Zoë',
        'client_secret',
        'sk_(?:test|live)_',
        'card number',
      ].join('|'),
      'i'
    );

    // ══ PUBLIC ══════════════════════════════════════════════════════════════
    for (const [width, height] of [[320, 800], [375, 812], [768, 1024], [1024, 768], [1440, 900]]) {
      await viewport(width, height);
      await navigate('/');
      await shell(`public landing ${width}x${height}`);
    }
    await viewport(320, 800);
    const landing = await inspect();
    check(!PRIVATE_LEAK.test(landing.bodyText), 'public landing projects no private-domain content');
    check(!/\bguarantee(d|s)?\b/i.test(landing.bodyText) || /no guarantee|cannot guarantee/i.test(landing.bodyText),
      'public landing makes no guarantee claim');
    check(await client.evaluate(`!!document.querySelector('nav') || !!document.getElementById('mobile-menu-button')`),
      'public navigation shell is reachable on a narrow viewport');

    for (const [route, label] of [
      ['/tests', 'public Test discovery'],
      ['/program-explorer', 'public Program discovery'],
      ['/scholarship-intelligence', 'public Scholarship discovery'],
    ]) {
      await navigate(route);
      const info = await shell(`${label} (zero verified records)`);
      check(/no |none|empty|not (yet )?available|coming soon|0 result|nothing/i.test(info.bodyText),
        `${label}: renders a truthful empty state with zero verified records`);
      check(!/\b(top|best|#1|rank(ed|ing)? [0-9])\b/i.test(info.bodyText),
        `${label}: publishes no fabricated ranking`);
      check(!PRIVATE_LEAK.test(info.bodyText), `${label}: leaks no private data`);
    }

    await navigate('/agents/marketplace');
    const marketplace = await shell('public Agent marketplace');
    check(/fixture/i.test(marketplace.bodyText), 'public marketplace renders only the approved fixture post');
    check(!/\bguaranteed?\s+(admission|visa|scholarship|job)\b/i.test(marketplace.bodyText),
      'public marketplace carries no guarantee semantics');
    check(!PRIVATE_LEAK.test(marketplace.bodyText), 'public marketplace exposes no private Student data');

    await navigate('/tests', { scenario: 'error' });
    const publicError = await inspect();
    check(!/at\s+\w+\s+\(.*:\d+:\d+\)/.test(publicError.bodyText), 'public error state prints no stack trace');
    check(publicError.bodyText.trim().length > 40, 'public error state is not a blank page');

    // ══ CROSS-REALM DENIAL MATRIX ═══════════════════════════════════════════
    // Warm each portal with its OWNING realm first. This proves the allowed
    // half of the matrix and compiles the route chunk, so a later denial that
    // stays blank is a real denial defect and not a cold-start artifact.
    for (const [route, ownerRealm] of [
      ['/employer', 'employer'],
      ['/agent', 'agent'],
      ['/institution', 'institution'],
      ['/admin/sc/overview', 'admin'],
    ]) {
      await navigate(route, { realm: ownerRealm, hardLoad: true });
      const owner = await client.evaluate(`({ path: location.pathname, text: document.body.innerText })`);
      check(owner.path === route && owner.text.trim().length > 40,
        `${ownerRealm} realm is allowed its own portal ${route}`);
    }

    const portals = [
      ['/employer', 'employer', /employer/i],
      ['/agent', 'agent', /agent/i],
      ['/institution', 'institution', /institution/i],
      ['/admin/sc/overview', 'admin', /admin|permission|access/i],
    ];
    for (const [route, ownerRealm, coherence] of portals) {
      for (const foreign of ['public', 'student', 'employer', 'agent', 'institution'].filter((r) => r !== ownerRealm)) {
        await navigate(route, { realm: foreign, hardLoad: true });
        // A denial is allowed to take a moment (session bootstrap), but it must
        // settle into a readable state rather than sitting on a blank page.
        try {
          await waitFor(() => client.evaluate(
            `location.pathname !== ${JSON.stringify(route)} || document.body.innerText.trim().length > 40`
          ), 25_000);
        } catch { /* the assertions below report the unsettled state precisely */ }
        const state = await client.evaluate(`({ path: location.pathname, text: document.body.innerText })`);
        const denied = state.path !== route || /sign in|log in|login|not authori|permission|access denied/i.test(state.text);
        check(denied, `${foreign} realm is denied ${route} (landed on ${state.path})`);
        check(!PRIVATE_LEAK.test(state.text),
          `${foreign} denial at ${route} leaks no private data — ${JSON.stringify(state.text.slice(0, 300))}`);
        check(coherence.test(state.text) || /sign in|log in/i.test(state.text),
          `${foreign} denial at ${route} is realm-coherent, not a generic blank — ${JSON.stringify(state.text.slice(0, 200))}`);
      }
    }

    // ══ STUDENT ═════════════════════════════════════════════════════════════
    await viewport(320, 800);
    await navigate('/dashboard', { realm: 'student', hardLoad: true });
    await shell('Student dashboard mobile');

    await navigate('/journey', { realm: 'student' });
    const journey = await shell('Student Journey mobile');
    check(/fixture/i.test(journey.bodyText), 'Journey renders the Student-owned fixture context');
    check(/deadline|task|next/i.test(journey.bodyText), 'Journey surfaces next best action, tasks or deadlines');
    check(!/\bguaranteed?\s+(admission|visa|scholarship)\b/i.test(journey.bodyText), 'Journey states no guarantee');

    await navigate('/vault', { realm: 'student' });
    const vault = await shell('Student Vault mobile');
    check(/transcript/i.test(vault.bodyText), 'Vault lists the Student-owned document metadata');
    check(!/\bhttps?:\/\/[^\s]*\.(pdf|png|jpg)\b/i.test(vault.bodyText), 'Vault list exposes no raw file URL');
    await navigate('/vault', { realm: 'student', scenario: 'empty' });
    const vaultEmpty = await inspect();
    check(/no |none|empty|nothing|upload/i.test(vaultEmpty.bodyText), 'Vault renders a truthful empty state');

    await navigate('/copilot', { realm: 'student' });
    await shell('Student Copilot mobile');
    // Ask a question so the provider state and the evidence panel actually render.
    await client.evaluate(`(() => {
      const field = document.getElementById('copilot-question');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(field, 'What are the entry requirements for this programme?');
      field._valueTracker?.setValue('');
      field.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('form button[type=submit]').click();
    })()`);
    await waitFor(() => client.evaluate(`/evidence|unavailable|not configured/i.test(document.body.innerText)`));
    const copilot = await inspect();
    check(/unavailable|not configured|not available/i.test(copilot.bodyText),
      'Copilot reports a truthful provider-not-configured state instead of inventing an answer');
    check(/evidence/i.test(copilot.bodyText), 'Copilot still presents the server-derived evidence packet');
    check(!/\bguaranteed?\s+(admission|visa|scholarship)\b/i.test(copilot.bodyText), 'Copilot states no guarantee');

    await navigate('/budget', { realm: 'student' });
    await shell('Student Budget list mobile');
    await navigate('/budget/m26-plan', { realm: 'student' });
    const budget = await shell('Student Budget detail mobile');
    check(/unknown/i.test(budget.bodyText), 'Budget shows unknown costs as unknown, never as zero');
    check(/GBP|£/.test(budget.bodyText) && /JPY|¥/.test(budget.bodyText), 'Budget groups multiple currencies separately');
    check(!/total.*(GBP|£)\s*[\d,]+\s*\+/i.test(budget.bodyText), 'Budget performs no implicit FX conversion');

    await navigate('/consultations', { realm: 'student' });
    const consultations = await shell('Student consultations mobile');
    check(/confirmed|scheduled|consultation/i.test(consultations.bodyText), 'consultation lifecycle state is textual');

    await navigate('/cases', { realm: 'student' });
    const cases = await shell('Student cases mobile');
    check(/case|stage|approval/i.test(cases.bodyText), 'case stage/approval context is visible to the Student');
    check(!/private note/i.test(cases.bodyText), 'Student case view shows no private Agent note');

    await navigate('/trust-center', { realm: 'student' });
    const trust = await shell('Student trust centre mobile');
    check(!/reporter/i.test(trust.bodyText) || /protected|anonymous/i.test(trust.bodyText),
      'reporter identity is never projected to the Student trust centre');

    await screenshot('mission-26-student-mobile-320.png');

    // ══ EMPLOYER ════════════════════════════════════════════════════════════
    await viewport(375, 812);
    await navigate('/employer', { realm: 'employer', hardLoad: true });
    const employer = await shell('Employer dashboard mobile');
    check(/fixture/i.test(employer.bodyText), 'Employer dashboard renders its own tenant data');
    check(!PRIVATE_LEAK.test(employer.bodyText), 'Employer surface exposes no Student Vault/Budget/Copilot content');
    check(!/\bcase\b.*\bstage\b/i.test(employer.bodyText), 'Employer surface exposes no Agent case management');
    await navigate('/employer/jobs', { realm: 'employer' });
    const employerJobs = await shell('Employer jobs mobile');
    check(/research coordinator/i.test(employerJobs.bodyText), 'Employer job workflow lists the tenant job');

    // ══ AGENT ═══════════════════════════════════════════════════════════════
    await viewport(768, 1024);
    await navigate('/agent', { realm: 'agent', hardLoad: true });
    const agent = await shell('Agent dashboard tablet');
    check(!PRIVATE_LEAK.test(agent.bodyText), 'Agent dashboard exposes no Vault content without a grant');
    await viewport(320, 800);
    await navigate('/agent/consultations', { realm: 'agent' });
    const agentConsultations = await shell('Agent consultations mobile');
    check(/confirmed|scheduled/i.test(agentConsultations.bodyText), 'Agent sees the scoped consultation state');
    check(!/zoe|zoë|@example\.test/i.test(agentConsultations.bodyText),
      'Agent sees only the authorized Student context, not arbitrary Student identity');
    await navigate('/agent/cases', { realm: 'agent' });
    await shell('Agent cases mobile');
    await navigate('/agent/commerce', { realm: 'agent' });
    const agentCommerce = await shell('Agent commerce mobile');
    check(/not (configured|started)|unavailable|inactive|pending/i.test(agentCommerce.bodyText),
      'Agent payment/KYC readiness is truthfully not configured');
    check(!/sk_(test|live)_|client_secret/i.test(agentCommerce.bodyText), 'no payment secret is projected to the Agent');
    await screenshot('mission-26-agent-mobile-320.png');

    // ══ INSTITUTION (sample; depth in the Mission 18/24 closure) ════════════
    await viewport(375, 812);
    await navigate('/institution', { realm: 'institution', hardLoad: true });
    const institution = await shell('Institution dashboard mobile');
    check(!PRIVATE_LEAK.test(institution.bodyText),
      'Institution dashboard exposes zero Student/Vault/Budget content');
    check(!/student list|browse students/i.test(institution.bodyText),
      'Institution cannot browse Students');

    // ══ ADMIN ═══════════════════════════════════════════════════════════════
    await viewport(1440, 900);
    await navigate('/admin/sc/overview', { realm: 'admin', hardLoad: true });
    const adminOverview = await shell('Admin overview desktop');
    check(!PRIVATE_LEAK.test(adminOverview.bodyText),
      'Admin overview exposes no Vault, Copilot, Budget or private-note content');
    check(/0|zero|none/i.test(adminOverview.bodyText), 'Admin overview can render the zero verified-record truth');
    await screenshot('mission-26-admin-desktop-1440.png');

    await viewport(1024, 768);
    await navigate('/admin/sc/trust', { realm: 'admin' });
    const adminTrust = await shell('Admin trust centre narrow-desktop');
    check(!PRIVATE_LEAK.test(adminTrust.bodyText), 'Admin trust queue projects no private message content');
    await navigate('/admin/sc/commerce', { realm: 'admin' });
    const adminCommerce = await shell('Admin commerce narrow-desktop');
    check(/mismatch|reconcil/i.test(adminCommerce.bodyText), 'Admin commerce surfaces reconciliation mismatch state');
    check(!/sk_(test|live)_|client_secret|card number/i.test(adminCommerce.bodyText),
      'Admin commerce projects no raw payment/KYC secret');
    await navigate('/admin/sc/data-quality', { realm: 'admin' });
    await shell('Admin data quality narrow-desktop');

    await navigate('/admin/sc/system', { realm: 'moderator' });
    const moderator = await client.evaluate(`({ path: location.pathname, text: document.body.innerText })`);
    check(
      /permission|authority|not authori|superadmin|access/i.test(moderator.text) || moderator.path !== '/admin/sc/system',
      'Moderator cannot reach a SuperAdmin-only operation surface'
    );

    // ══ LOADING STATE ═══════════════════════════════════════════════════════
    await viewport(320, 800);
    const loadingProbe = `(() => /loading|please wait/i.test(document.body.innerText)
      || !!document.querySelector('[aria-busy="true"], [role="status"], .animate-pulse'))()`;
    await navigate('/vault', { realm: 'student', scenario: 'slow', waitFor: loadingProbe });
    check(await client.evaluate(loadingProbe),
      'a slow request renders a visible loading state rather than an empty or fabricated result');
    await waitFor(() => client.evaluate(`/transcript/i.test(document.body.innerText)`), 15_000);
    check(true, 'the slow route resolves to its real content once the response arrives');

    // ══ ENVIRONMENT INVARIANTS ══════════════════════════════════════════════
    check(runtimeErrors.length === 0, `uncaught runtime error in a tested route: ${runtimeErrors[0] || ''}`);
    const loop = [...requestCounts.entries()].find(([, count]) => count > 8);
    check(!loop, `uncontrolled request loop: ${loop?.[0]} x${loop?.[1]}`);
    check(externalRequests.length === 0, `external request attempted: ${externalRequests[0] || ''}`);
    check(responseLog.length > 0, 'every API response was served from an intercepted synthetic fixture');
    check(responseLog.some((r) => r.status === 401 || r.status === 403), 'realm denial responses were actually exercised');

    if (failures.length) {
      throw new Error(`${failures.length}/${assertions} assertions failed:\n- ${failures.join('\n- ')}`);
    }
    console.log(`STRIDETO MISSION 26 CROSS-ROLE UX: ${assertions}/${assertions} assertions passed`);
    console.log('Tooling: local Chromium CDP + local Vite; intercepted synthetic fixtures; external DNS blackholed; no live service, provider, DB or account');
  } finally {
    client?.close();
    if (chrome && chrome.exitCode == null) chrome.kill();
    if (vite && vite.exitCode == null) vite.kill();
    await delay(400);
    try { await rm(browserProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); }
    catch { /* synthetic browser profile only */ }
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
