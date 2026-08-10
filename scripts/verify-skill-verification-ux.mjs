/**
 * Applicant skill claim + evidence verification — browser acceptance.
 *
 * Focused sibling of verify-mission-24-ux.mjs, exercising only the three
 * surfaces this feature adds: the Student claim manager, the Employer skill
 * panel, and the Admin review queue. Same harness contract as Mission 24 —
 * local Chromium over CDP, every `/api/*` request intercepted and answered
 * from synthetic fixtures, resolver rules blackholing everything but loopback.
 * No network, no database, no live service.
 *
 * The fixtures deliberately include a long GitHub URL, a long Figma URL, a
 * long skill name and a full spread of trust states — the layout claims that
 * are worth testing are exactly the ones long real-world strings break.
 *
 *   node scripts/verify-skill-verification-ux.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = 'http://127.0.0.1:5173';
const cdpPort = 9336;
const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const screenshotDir = path.join(root, 'docs', 'screenshots', 'responsive');

const VIEWPORTS = [[320, 800], [375, 812], [768, 1024], [1024, 768], [1440, 900]];

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

// --- fixtures --------------------------------------------------------------
// Long on purpose: a 100-character repository path and a Figma file URL are
// what actually overflow a 320px card.
const LONG_GITHUB = 'https://github.com/an-organisation-with-a-long-name/a-repository-with-an-equally-long-name/tree/main/packages/design-system';
const LONG_FIGMA = 'https://www.figma.com/file/AbCdEfGhIjKlMnOpQrStUv/Design-System-Foundations-Components-And-Tokens?node-id=1234%3A5678';
const LONG_SKILL = 'Internationalisation & localisation engineering';

const OWN_CLAIMS = [
  {
    id: 'claim-1', skillName: LONG_SKILL, skillCategory: 'technical', claimedLevel: 'advanced',
    trustState: 'evidence_submitted', verificationScore: 0, evidenceCount: 2,
    evidence: [
      { id: 'ev-1', evidenceType: 'code_repository', url: LONG_GITHUB, hostname: 'github.com', provider: 'github', description: 'Monorepo package I maintain', status: 'submitted' },
      { id: 'ev-2', evidenceType: 'design_portfolio', url: LONG_FIGMA, hostname: 'www.figma.com', provider: 'figma', description: '', status: 'submitted' },
    ],
  },
  { id: 'claim-2', skillName: 'Figma', skillCategory: 'design', claimedLevel: 'expert', trustState: 'verified', proficiencyScore: 74, proficiencyEvidenced: true, verificationMethod: 'interview_assessment', verifiedAt: '2026-07-01T00:00:00.000Z', evidenceCount: 1, evidence: [] },
  { id: 'claim-3', skillName: 'Claimed only', skillCategory: 'other', claimedLevel: 'beginner', trustState: 'claimed', verificationScore: 0, evidenceCount: 0, evidence: [] },
  { id: 'claim-4', skillName: 'Lapsed credential', skillCategory: 'business', claimedLevel: 'intermediate', trustState: 'expired', verificationScore: 0, evidenceCount: 1, evidence: [] },
  { id: 'claim-5', skillName: 'Withdrawn', skillCategory: 'research', claimedLevel: 'advanced', trustState: 'revoked', verificationScore: 0, evidenceCount: 1, evidence: [] },
];

/*
 * Deliberately spans the three assertions that must never collapse into one:
 * evidence-backed (links a reviewer opened), credential-verified (an issuer
 * confirmed), and assessment-verified (a rubric-scored assessment, the only
 * one carrying a proficiency number).
 */
const EMPLOYER_SKILLS = [
  { id: 'claim-1', skillName: LONG_SKILL, skillCategory: 'technical', claimedLevel: 'advanced', trustState: 'evidence_backed', trustLabel: 'Evidence-backed', isCurrentlyVerified: false, proficiencyScore: null, proficiencyEvidenced: false, verificationMethod: 'manual_evidence_review', evidenceCount: 2, evidence: [{ evidenceType: 'code_repository', provider: 'github', hostname: 'github.com', url: LONG_GITHUB, description: 'Monorepo package' }] },
  { id: 'claim-2', skillName: 'Figma', skillCategory: 'design', claimedLevel: 'expert', trustState: 'verified', trustLabel: 'Assessment verified', isCurrentlyVerified: true, proficiencyScore: 74, proficiencyEvidenced: true, verificationMethod: 'interview_assessment', verifiedAt: '2026-07-01T00:00:00.000Z', evidenceCount: 1, evidence: [{ evidenceType: 'design_portfolio', provider: 'figma', hostname: 'www.figma.com', url: LONG_FIGMA, description: '' }] },
  { id: 'claim-6', skillName: 'PMP', skillCategory: 'business', claimedLevel: 'advanced', trustState: 'verified', trustLabel: 'Credential verified', isCurrentlyVerified: true, proficiencyScore: null, proficiencyEvidenced: false, verificationMethod: 'issuer_confirmation', verifiedAt: '2026-07-01T00:00:00.000Z', evidenceCount: 1, evidence: [] },
  { id: 'claim-3', skillName: 'Claimed only', skillCategory: 'other', claimedLevel: 'beginner', trustState: 'claimed', trustLabel: 'Claimed', isCurrentlyVerified: false, proficiencyScore: null, proficiencyEvidenced: false, evidenceCount: 0, evidence: [] },
  { id: 'claim-4', skillName: 'Lapsed credential', skillCategory: 'business', claimedLevel: 'intermediate', trustState: 'expired', trustLabel: 'Expired', isCurrentlyVerified: false, proficiencyScore: null, proficiencyEvidenced: false, evidenceCount: 1, evidence: [] },
  { id: 'claim-5', skillName: 'Withdrawn', skillCategory: 'research', claimedLevel: 'advanced', trustState: 'revoked', trustLabel: 'Revoked', isCurrentlyVerified: false, proficiencyScore: null, proficiencyEvidenced: false, evidenceCount: 1, evidence: [] },
];

const REVIEW_QUEUE = [
  {
    id: 'claim-1', applicantUserId: 'student-1', skillName: LONG_SKILL, skillCategory: 'technical',
    claimedLevel: 'advanced', yearsOfExperience: 6, trustState: 'verification_pending',
    statusChangedAt: '2026-08-01T00:00:00.000Z',
    evidence: [
      { id: 'ev-1', evidenceType: 'code_repository', provider: 'github', hostname: 'github.com', url: LONG_GITHUB, description: 'Monorepo package I maintain', status: 'submitted', submittedAt: '2026-08-01T00:00:00.000Z' },
      { id: 'ev-2', evidenceType: 'design_portfolio', provider: 'figma', hostname: 'www.figma.com', url: LONG_FIGMA, description: '', status: 'submitted', submittedAt: '2026-08-01T00:00:00.000Z' },
    ],
  },
  { id: 'claim-6', applicantUserId: 'student-2', skillName: 'Technical writing', skillCategory: 'other', claimedLevel: 'intermediate', yearsOfExperience: null, trustState: 'evidence_submitted', statusChangedAt: '2026-08-02T00:00:00.000Z', evidence: [] },
];

const CANDIDATE = {
  userId: 'student-1',
  basic: { displayName: 'Zoë O’Connor 李', email: 'zoe@example.test', avatarUrl: null },
  headline: 'Design systems engineer', location: 'Lahore, Pakistan', workPreference: 'remote',
  readiness: null, resumeStrength: null, jobMatch: null, hiringRecommendations: [],
  verifiedSkills: [], credentials: [], documents: [], timelineSummary: [],
  pipelineStage: 'applied', legacyApplicationId: 'app-1', jobId: 'job-1', jobTitle: 'Frontend engineer',
  ranking: { percent: 71, factors: [] }, interviewStatus: null,
  applicationSkillSnapshot: {
    capturedAt: '2026-06-01T00:00:00.000Z',
    skills: [
      { skillName: LONG_SKILL, skillCategory: 'technical', claimedLevel: 'advanced', trustState: 'claimed', isCurrentlyVerified: false, verificationMethod: null, proficiencyScore: null, proficiencyEvidenced: false, evidenceCount: 0 },
      { skillName: 'Figma', skillCategory: 'design', claimedLevel: 'expert', trustState: 'evidence_submitted', isCurrentlyVerified: false, verificationMethod: null, proficiencyScore: null, proficiencyEvidenced: false, evidenceCount: 1 },
    ],
  },
};

function responseFor(rawUrl, method, role) {
  const p = new URL(rawUrl).pathname;
  const userRole = role === 'admin' ? 'SuperAdmin' : 'User';

  if (p === '/api/auth/refresh-token') return role === 'public' ? {} : { accessToken: `fixture-${userRole}` };
  if (p === '/api/auth/me') return { user: { _id: 'student-1', role: userRole, name: 'Zoë O’Connor 李', email: 'zoe@example.test', onboardingCompleted: true } };
  if (p === '/api/auth/employer/refresh-token') return { accessToken: 'fixture-employer' };
  if (p === '/api/employer/me') return { employer: { _id: 'employer-1', companyName: 'Example Employer', email: 'employer@example.test' } };

  // --- the surfaces under test ---
  if (p === '/api/skill-claims') return method === 'GET' ? { data: OWN_CLAIMS } : { data: OWN_CLAIMS[0] };
  if (/^\/api\/employer\/applicants\/[^/]+\/skills$/.test(p)) return { data: EMPLOYER_SKILLS };
  if (p === '/api/admin/skill-claims') return { data: REVIEW_QUEUE };
  if (p === '/api/admin/skill-verification/options') {
    return { data: { reviewableStatuses: ['evidence_backed', 'verified', 'needs_information', 'rejected', 'revoked'], methods: ['manual_evidence_review', 'document_review'] } };
  }
  if (/^\/api\/employer\/intelligence\/candidates\/[^/]+$/.test(p)) return { data: CANDIDATE };

  if (p === '/api/talent/me') return { data: { displayName: 'Zoë O’Connor 李', skills: [], visibility: 'private' } };
  if (p === '/api/admin/permissions') return { permissions: [] };
  if (p.startsWith('/api/admin/')) return { data: [], items: [], pagination: { page: 1, pages: 1, total: 0 } };

  return { data: [], items: [], results: [], pagination: { page: 1, pages: 1, total: 0 }, total: 0, totalPages: 1 };
}

async function run() {
  const browser = chromeCandidates.find((candidate) => existsSync(candidate));
  if (!browser) throw new Error('No locally installed Chrome or Edge binary found');
  await mkdir(screenshotDir, { recursive: true });
  const profileDir = await mkdtemp(path.join(os.tmpdir(), 'strideto-skills-'));
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
    client = new CdpClient(targets.find((item) => item.type === 'page').webSocketDebuggerUrl);
    await client.connect();

    let activeRole = 'public';
    const runtimeErrors = [];
    /*
     * Evidence-provider hosts specifically. Chrome's resolver rules already
     * blackhole every non-loopback host, so nothing leaves the machine either
     * way — but the claim being accepted here is narrower and sharper: this
     * feature must never *attempt* to reach a provider, because an evidence
     * link is stored and displayed, never fetched, resolved or previewed.
     */
    const PROVIDER_HOSTS = /(^|\.)(github\.com|githubusercontent\.com|gitlab\.com|bitbucket\.org|figma\.com|behance\.net|dribbble\.com|linkedin\.com|credly\.com|orcid\.org)$/i;
    const providerRequests = new Set();
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => runtimeErrors.push(exceptionDetails.exception?.description || exceptionDetails.text));
    client.on('Network.requestWillBeSent', ({ request }) => {
      if (request.url.startsWith('data:') || request.url.startsWith('blob:')) return;
      const host = new URL(request.url).hostname;
      if (PROVIDER_HOSTS.test(host)) providerRequests.add(`${request.method} ${request.url}`);
    });
    client.on('Fetch.requestPaused', async ({ requestId, request }) => {
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
      const appLoaded = await client.evaluate(`location.origin === ${JSON.stringify(baseUrl)} && !!document.getElementById('root')`);
      if (appLoaded) {
        await client.evaluate(`history.pushState({}, '', ${JSON.stringify(route)}); dispatchEvent(new PopStateEvent('popstate'))`);
      } else {
        await client.send('Page.navigate', { url: `${baseUrl}${route}` });
      }
      await waitFor(async () => client.evaluate(`document.readyState === 'complete' && !document.body.innerText.includes('Loading...')`));
      await delay(250);
    }
    async function click(selectorText) {
      return client.evaluate(`(() => {
        const target = [...document.querySelectorAll('button, [role="tab"], a')]
          .find(el => (el.innerText || '').trim().toLowerCase().includes(${JSON.stringify(selectorText.toLowerCase())}));
        if (!target) return false;
        target.click();
        return true;
      })()`);
    }
    async function inspect() {
      return client.evaluate(`(() => {
        const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        const name = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(/\\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ') || el.textContent || el.title || '').trim();
        const fields = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(visible);
        const buttons = [...document.querySelectorAll('button, [role="button"]')].filter(visible);
        const ids = [...document.querySelectorAll('[id]')].map(el => el.id).filter(Boolean);
        // Any element wider than the viewport is a layout break, and long URLs
        // are the usual culprit — so report the widest offender by name.
        // Scoped to this feature's own surfaces (marked data-skill-surface):
        // surrounding chrome has its own intentional full-bleed elements and is
        // not what this run is accepting.
        const clientWidth = document.documentElement.clientWidth;
        const overflowing = [...document.querySelectorAll('[data-skill-surface], [data-skill-surface] *')]
          .filter(visible)
          .filter(el => el.getBoundingClientRect().width > clientWidth + 2)
          .map(el => el.tagName + '.' + (el.className || '').toString().slice(0, 40));
        return {
          clientWidth, scrollWidth: document.documentElement.scrollWidth,
          text: document.body.innerText,
          unlabeledFields: fields.filter(el => !(el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))).map(el => el.outerHTML.slice(0, 120)),
          unlabeledButtons: buttons.filter(el => !name(el)).map(el => el.outerHTML.slice(0, 120)),
          duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
          smallTargets: buttons.filter(el => el.getBoundingClientRect().height < 20).length,
          // A trust label clipped to "Cl…" beside a neighbouring "Verified" is
          // exactly the confusion the badge exists to prevent, so a truncated
          // label is a defect and not a cosmetic detail.
          clippedBadges: [...document.querySelectorAll('[data-skill-surface] [title]')]
            .flatMap(badge => [...badge.querySelectorAll('span')])
            .filter(el => el.scrollWidth > el.clientWidth + 1)
            .map(el => (el.textContent || '').trim()),
          overflowing: [...new Set(overflowing)].slice(0, 3),
          focusable: [...document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')].filter(visible).length,
        };
      })()`);
    }
    async function responsiveChecks(label) {
      const info = await inspect();
      check(info.scrollWidth <= info.clientWidth + 2, `${label}: page overflows horizontally ${info.scrollWidth}/${info.clientWidth}`);
      check(info.overflowing.length === 0, `${label}: element wider than viewport — ${info.overflowing.join(', ')}`);
      check(info.unlabeledFields.length === 0, `${label}: unlabeled field ${info.unlabeledFields[0] || ''}`);
      check(info.unlabeledButtons.length === 0, `${label}: unnamed control ${info.unlabeledButtons[0] || ''}`);
      check(info.duplicateIds.length === 0, `${label}: duplicate ids ${info.duplicateIds.join(', ')}`);
      check(info.focusable > 0, `${label}: nothing keyboard-focusable`);
      check(info.clippedBadges.length === 0, `${label}: trust label visually clipped — '${info.clippedBadges[0] || ''}'`);
      return info;
    }
    async function screenshot(name) {
      const result = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      await writeFile(path.join(screenshotDir, name), Buffer.from(result.data, 'base64'));
    }

    // === Student: claim manager ============================================
    for (const [width, height] of VIEWPORTS) {
      await viewport(width, height);
      await navigate('/talent-profile', 'student');
      await click('Skills');
      await delay(250);
      const info = await responsiveChecks(`student skills ${width}x${height}`);
      check(/Skills & evidence/i.test(info.text), `student skills ${width}: claim manager rendered`);
      // Distinct trust states, never one generic checkmark. Note "Assessment
      // verified" rather than a bare "Verified": the method is part of the claim.
      for (const state of ['Claimed', 'Assessment verified', 'Expired', 'Revoked', 'Evidence submitted']) {
        check(info.text.includes(state), `student skills ${width}: '${state}' state shown distinctly`);
      }
      // The long skill name and the long GitHub host must not force a scroll
      check(info.text.includes(LONG_SKILL), `student skills ${width}: long skill name rendered`);
    }
    await viewport(320, 800);
    await screenshot('skill-verification-student-mobile-320.png');

    // Evidence form: labelled fields, reachable submit, visible validation
    check(await click('Add evidence'), 'student: evidence form opens');
    await delay(200);
    const evidenceForm = await responsiveChecks('student evidence form 320');
    check(/Evidence type/i.test(evidenceForm.text), 'student: evidence type selector present');
    check(/Link/i.test(evidenceForm.text), 'student: evidence link field present');
    // A private-network link is refused in the UI before it ever reaches the server
    await client.evaluate(`(() => {
      const input = [...document.querySelectorAll('input[type="url"]')].pop();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'https://127.0.0.1/secret');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.form.requestSubmit();
    })()`);
    await delay(250);
    const afterInvalid = await inspect();
    check(/publicly reachable link|valid https/i.test(afterInvalid.text), 'student: unsafe evidence URL surfaces a visible error');
    check(afterInvalid.scrollWidth <= afterInvalid.clientWidth + 2, 'student: error state does not break layout');
    /*
     * "Visible" has to mean on screen, not merely in the DOM: at 320px the
     * form sits well below the fold, so scroll to the alert and assert it is
     * actually within the viewport. This also makes the captured screenshot
     * show the error rather than the unchanged top of the page.
     */
    /*
     * "Visible" is asserted as the properties that actually make an error
     * perceivable, rather than as scroll position: the alert is rendered with
     * real size, is not hidden by CSS, carries role="alert" so it is
     * announced, and the offending field points at it via aria-describedby
     * while reporting aria-invalid. Scroll offset is a property of where the
     * user happens to be looking, not of whether the UI reported the problem.
     */
    const errorContract = await client.evaluate(`(() => {
      const alert = [...document.querySelectorAll('[role="alert"]')]
        .find(el => /publicly reachable link|valid https/i.test(el.textContent || ''));
      if (!alert) return null;
      const box = alert.getBoundingClientRect();
      const style = getComputedStyle(alert);
      const field = document.getElementById(alert.id)
        ? document.querySelector('[aria-describedby~="' + alert.id + '"]')
        : null;
      return {
        rendered: box.width > 0 && box.height > 0,
        shown: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0,
        describes: !!field,
        invalid: field?.getAttribute('aria-invalid') === 'true',
        // Document coordinates, so the region can be captured regardless of scroll
        clip: { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height },
      };
    })()`);
    check(errorContract?.rendered, 'student: the validation error is rendered with real size');
    check(errorContract?.shown, 'student: the validation error is not hidden by CSS');
    check(errorContract?.describes, 'student: the offending field points at the error via aria-describedby');
    check(errorContract?.invalid, 'student: the offending field reports aria-invalid');
    if (errorContract?.clip) {
      // Capture the error region itself, so the artifact shows the error and
      // not merely the top of a long page.
      const shot = await client.send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true,
        clip: { ...errorContract.clip, x: 0, width: 320, height: Math.max(errorContract.clip.height + 240, 240), scale: 1 },
      });
      await writeFile(path.join(screenshotDir, 'skill-verification-student-evidence-error-320.png'), Buffer.from(shot.data, 'base64'));
    }

    // === Employer: applicant skill panel ===================================
    /*
     * Crossing from the User realm to the Employer realm lands on the employer
     * login page first: the employer auth bootstrap only runs once the route
     * prefix is an employer one, so the guard redirects before the session
     * exists. That first navigation is what starts the refresh — this warms it
     * so each viewport below measures a settled page, not a redirect in flight.
     */
    await viewport(375, 812);
    await navigate('/employer', 'employer');
    await delay(600);

    for (const [width, height] of VIEWPORTS) {
      await viewport(width, height);
      await navigate('/employer/intelligence/candidates/app-1', 'employer');
      // The panel loads on its own request; wait for it rather than racing it.
      await waitFor(() => client.evaluate(`!!document.querySelector('[data-skill-surface="employer"]')`));
      const info = await responsiveChecks(`employer skills ${width}x${height}`);
      check(/Skills & evidence/i.test(info.text), `employer skills ${width}: panel rendered`);
      check(/Evidence-backed/i.test(info.text), `employer skills ${width}: evidence-backed shown as its own state`);
      /*
       *   Evidence-backed != Skill verified != Assessment verified
       * All three are on screen at once here, and each must read differently.
       */
      check(/Assessment verified/i.test(info.text), `employer skills ${width}: assessment-verified named distinctly`);
      check(/Credential verified/i.test(info.text), `employer skills ${width}: credential-verified named distinctly`);
      check(
        !/(^|[^t])\bVerified\b(?! )/m.test(info.text.replace(/Assessment verified|Credential verified|Reference verified|Verified \d/gi, '')),
        `employer skills ${width}: no bare "Verified" badge that hides the method`
      );
      // A score appears only against the assessed skill, never the others
      check(/Assessed proficiency: 74\/100/.test(info.text), `employer skills ${width}: measured score shown`);
      check(
        (info.text.match(/Assessed proficiency/g) || []).length === 1,
        `employer skills ${width}: only the assessed skill may show a score`
      );
      // A self-reported level must never read as substantiated
      check(/self-reported: beginner/i.test(info.text), `employer skills ${width}: claimed level marked self-reported`);
      check(
        !/self-reported: expert/i.test(info.text),
        `employer skills ${width}: an assessed skill shows its measured result, not a self-reported level`
      );
      check(/At time of application/i.test(info.text), `employer skills ${width}: application-time snapshot distinguished from current`);
      check(/Current profile/i.test(info.text), `employer skills ${width}: current profile labelled`);
      check(info.smallTargets === 0, `employer skills ${width}: control smaller than a usable target`);
    }
    await viewport(320, 800);
    await screenshot('skill-verification-employer-mobile-320.png');
    await viewport(1440, 900);
    await navigate('/employer/intelligence/candidates/app-1', 'employer');
    await screenshot('skill-verification-employer-desktop-1440.png');

    // Trust filter is a lens, not a judgement — and it is a real control
    await viewport(375, 812);
    await navigate('/employer/intelligence/candidates/app-1', 'employer');
    const filterExists = await client.evaluate(`[...document.querySelectorAll('select')].some(s => [...s.options].some(o => /verified only/i.test(o.textContent)))`);
    check(filterExists, 'employer: server-backed trust filter offered');
    const filterDefault = await client.evaluate(`(() => {
      const select = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => /verified only/i.test(o.textContent)));
      return select ? select.value : null;
    })()`);
    check(filterDefault === 'any', `employer: trust filter defaults to inclusive, got '${filterDefault}'`);

    // === Admin: manual review queue ========================================
    for (const [width, height] of VIEWPORTS) {
      await viewport(width, height);
      await navigate('/admin/sc/trust', 'admin');
      check(await click('Skill Claims'), `admin ${width}: skill claims tab reachable`);
      await delay(250);
      const info = await responsiveChecks(`admin skill review ${width}x${height}`);
      check(/never fetched or previewed/i.test(info.text), `admin ${width}: evidence-fetch boundary stated`);
      check(info.text.includes('github.com'), `admin ${width}: evidence host shown`);
    }
    await viewport(320, 800);
    await navigate('/admin/sc/trust', 'admin');
    await click('Skill Claims');
    await delay(250);
    check(await click('Record decision'), 'admin: decision form opens');
    await delay(250);
    const decision = await responsiveChecks('admin decision form 320');
    check(/Method \(required\)/i.test(decision.text), 'admin: method is required and labelled');
    /*
     * The policy invariant, as the reviewer actually meets it: with manual
     * evidence review selected — the method for reading someone's GitHub or
     * Figma link — "Verify skill" is not offered at all. It is withheld rather
     * than shown and then refused.
     */
    const outcomeOptions = await client.evaluate(`(() => {
      // Match on the decision verbs, not on "evidence-backed" alone — the
      // queue's own status filter also carries that word.
      const select = [...document.querySelectorAll('[data-skill-surface="review"] select')]
        .find(s => [...s.options].some(o => /Mark evidence-backed|Request information/i.test(o.textContent)));
      return select ? [...select.options].map(o => o.textContent.trim()) : null;
    })()`);
    check(Array.isArray(outcomeOptions), 'admin: outcome selector present');
    check(
      (outcomeOptions || []).some((o) => /Mark evidence-backed/i.test(o)),
      'admin: evidence-backed offered for a link review'
    );
    check(
      !(outcomeOptions || []).some((o) => /Verify skill/i.test(o)),
      `admin: manual evidence review must not offer verification — got ${JSON.stringify(outcomeOptions)}`
    );
    check(
      /stops at evidence-backed/i.test(decision.text),
      'admin: the reviewer is told why this method cannot verify'
    );
    check(/Reason \(required/i.test(decision.text), 'admin: reason is required and labelled');
    check(/Evidence this decision rests on \(required\)/i.test(decision.text), 'admin: evidence citation is required');
    // The submit stays disabled until every requirement the server enforces is met
    const submitDisabled = await client.evaluate(`(() => {
      const btn = [...document.querySelectorAll('button[type="submit"]')].find(b => /record decision/i.test(b.innerText));
      return btn ? btn.disabled : null;
    })()`);
    check(submitDisabled === true, 'admin: decision cannot be submitted without method, reason and evidence');
    await screenshot('skill-verification-admin-review-mobile-320.png');

    // === Boundaries ========================================================
    check(runtimeErrors.length === 0, `uncaught browser runtime exceptions: ${runtimeErrors[0] || ''}`);
    check(providerRequests.size === 0, `evidence provider contacted — links must never be fetched: ${[...providerRequests][0] || ''}`);

    if (failures.length) throw new Error(`${failures.length}/${assertions} assertions failed:\n- ${failures.join('\n- ')}`);
    console.log(`STRIDETO SKILL VERIFICATION BROWSER UX: ${assertions}/${assertions} assertions passed`);
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
    catch { /* Windows may retain Crashpad metrics briefly; the profile holds only synthetic fixture state. */ }
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
