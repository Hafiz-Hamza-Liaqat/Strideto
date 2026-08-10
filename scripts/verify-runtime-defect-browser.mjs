import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const BASE_URL = process.env.RUNTIME_BASE_URL || 'https://localhost:8443';
const widths = [320, 768, 1440];
const publicRoutes = [
  ['/agent/login', 'Agent Portal Login'],
  ['/agent/register', 'Create Agent Account'],
  ['/institution/login', 'Institution sign in'],
  ['/institution/register', 'Create Institution representative account'],
];
const agentProtected = [
  '/agent', '/agent/onboarding', '/agent/profile', '/agent/services', '/agent/marketplace',
  '/agent/marketplace/new', '/agent/consultations', '/agent/cases', '/agent/trust',
  '/agent/commerce', '/agent/availability', '/agent/verification', '/agent/team',
  '/agent/leads', '/agent/clients', '/agent/settings',
];
const institutionProtected = [
  '/institution', '/institution/onboarding', '/institution/profile',
  '/institution/programs', '/institution/programs/new',
  '/institution/data-quality', '/institution/team',
];
const talentTabs = [
  'Personal', 'Contact', 'Career', 'Education', 'Tests & Exams', 'Goals & Preferences',
  'Experience', 'Skills', 'Languages', 'Certifications', 'Portfolio',
];
const legacyTalentFixture = {
  displayName: 'Historical Student',
  headline: 'Historical headline',
  personal: { phone: null, timeZone: undefined },
  socialProfile: null,
  preferences: { preferredCountries: 'PK', salaryExpectation: null },
  education: [{ institution: 'Historical University', gpa: '4.2', gradingSystem: 'unknown_legacy_scale' }],
  experience: { company: 'Historical Employer', achievements: null },
  skills: ['JavaScript'],
  languages: ['English'],
  certificationReferences: ['Historical certificate'],
  portfolioReferences: [{ title: 'Historical project', technologies: 'React' }],
  examScores: [{ testType: null, testDate: null }],
  studyGoals: [{ destinationCountries: 'GB', targetYear: null }],
  studentPreferences: null,
  budgetProfile: null,
};

const browser = await puppeteer.launch({
  headless: true,
  args: ['--ignore-certificate-errors'],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15_000);

  for (const width of widths) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    for (const [path, heading] of publicRoutes) {
      console.log(`checking ${path} at ${width}px`);
      const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction((text) => document.body.innerText.includes(text), {}, heading);
      assert.equal(response.status(), 200, `${path} at ${width}px must return the app shell`);
      assert.equal(
        await page.$eval('body', (body, text) => body.innerText.includes(text), heading),
        true,
        `${path} must show ${heading}`
      );
      const layout = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        errorBoundary: document.body.innerText.includes('This page could not be displayed'),
      }));
      assert.equal(layout.errorBoundary, false, `${path} must not hit the route error boundary`);
      assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `${path} overflows at ${width}px`);
    }
  }

  await page.setViewport({ width: 320, height: 900, deviceScaleFactor: 1 });
  console.log('checking Agent validation error UX');
  await page.goto(`${BASE_URL}/agent/register`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[placeholder="Your agency or professional name"]');
  await page.type('input[placeholder="Your agency or professional name"]', 'Runtime Validation Only');
  await page.type('input[placeholder="e.g. PK, GB, US"]', 'XX');
  await page.type('input[type="email"]', `no-write-agent-${Date.now()}@example.test`);
  await page.type('input[type="password"]', 'ValidPass9');
  assert.equal(await page.$eval('form', (form) => form.checkValidity()), true, 'Agent validation fixture must satisfy client constraints');
  const agentResponsePromise = page.waitForResponse((response) => response.url().includes('/auth/agent/register'));
  await page.$eval('form', (form) => form.requestSubmit());
  const agentResponse = await agentResponsePromise;
  assert.equal(agentResponse.url(), `${BASE_URL}/api/auth/agent/register`);
  assert.equal(agentResponse.status(), 422);
  await page.waitForFunction(() => document.body.innerText.includes('ISO 3166-1'));

  console.log('checking Institution validation error UX');
  await page.goto(`${BASE_URL}/institution/register`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#institution-register-name');
  await page.type('#institution-register-name', 'Runtime Validation Only');
  await page.type('#institution-register-country', 'XX');
  await page.type('#institution-register-email', `no-write-institution-${Date.now()}@example.test`);
  await page.type('#institution-register-password', 'ValidPass9');
  assert.equal(await page.$eval('form', (form) => form.checkValidity()), true, 'Institution validation fixture must satisfy client constraints');
  const institutionResponsePromise = page.waitForResponse((response) => response.url().includes('/auth/institution/register'));
  await page.$eval('form', (form) => form.requestSubmit());
  const institutionResponse = await institutionResponsePromise;
  assert.equal(institutionResponse.url(), `${BASE_URL}/api/auth/institution/register`);
  assert.equal(institutionResponse.status(), 422);
  await page.waitForFunction(() => document.body.innerText.includes('ISO 3166-1'));

  for (const path of agentProtected) {
    console.log(`checking unauthenticated ${path}`);
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => location.pathname === '/agent/login');
    assert.equal(new URL(page.url()).pathname, '/agent/login', `${path} must deny unauthenticated access`);
  }
  for (const path of institutionProtected) {
    console.log(`checking unauthenticated ${path}`);
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => location.pathname === '/institution/login');
    assert.equal(new URL(page.url()).pathname, '/institution/login', `${path} must deny unauthenticated access`);
  }

  console.log('checking rebuilt Talent Profile route with legacy/current regression fixture');
  const talentPage = await browser.newPage();
  let talentMutationCount = 0;
  await talentPage.setRequestInterception(true);
  talentPage.on('request', async (request) => {
    const url = new URL(request.url());
    if (url.origin !== BASE_URL || !url.pathname.startsWith('/api/')) return request.continue();
    const respond = (body) => request.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
    if (url.pathname === '/api/auth/refresh-token') return respond({ accessToken: 'fixture-access-token' });
    if (url.pathname === '/api/auth/me') return respond({ user: { _id: 'fixture-user', email: 'fixture@example.test', name: 'Historical Student', role: 'User' } });
    if (url.pathname === '/api/talent/me') {
      if (request.method() !== 'GET') talentMutationCount += 1;
      return respond(legacyTalentFixture);
    }
    if (url.pathname === '/api/skill-claims') return respond({ data: [] });
    return respond({});
  });
  talentPage.setDefaultTimeout(15_000);
  for (const width of widths) {
    await talentPage.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
    await talentPage.goto(`${BASE_URL}/talent-profile`, { waitUntil: 'domcontentloaded' });
    await talentPage.waitForFunction(() => document.body.innerText.includes('My Profile'));
    for (const label of talentTabs) {
      await talentPage.evaluate((tabLabel) => {
        const button = [...document.querySelectorAll('button')]
          .find((candidate) => candidate.textContent.trim() === tabLabel);
        if (!button) throw new Error(`Missing tab: ${tabLabel}`);
        button.click();
      }, label);
      await talentPage.waitForFunction((tabLabel) => [...document.querySelectorAll('button')]
        .some((button) => button.textContent.trim() === tabLabel && button.getAttribute('aria-current') === 'page'), {}, label);
      assert.equal(
        await talentPage.$eval('body', (body) => body.innerText.includes('This page could not be displayed')),
        false,
        `${label} must render at ${width}px`
      );
    }
    assert.equal(
      await talentPage.$eval('body', (body) => body.innerText.includes('This page could not be displayed')),
      false
    );
    const layout = await talentPage.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `Talent Profile overflows at ${width}px`);
  }
  assert.equal(talentMutationCount, 0, 'loading/rendering legacy profile data must not persist changes');
  await talentPage.close();

  console.log('checking unauthenticated /talent-profile');
  const talentResponse = await page.goto(`${BASE_URL}/talent-profile`, { waitUntil: 'domcontentloaded' });
  assert.equal(talentResponse.status(), 200);
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const talentState = await page.evaluate(() => ({
    pathname: location.pathname,
    text: document.body.innerText,
  }));
  assert.equal(talentState.text.includes('This page could not be displayed'), false);
  assert.ok(
    talentState.pathname === '/login' || /sign in|loading/i.test(talentState.text),
    'Talent Profile must remain Student-auth protected'
  );

  console.log(`Runtime browser acceptance passed at ${widths.join(', ')}px.`);
  console.log(`Public routes: ${publicRoutes.length}; Agent protected: ${agentProtected.length}; Institution protected: ${institutionProtected.length}.`);
  console.log('Agent and Institution validation requests returned actionable HTTP 422 without creating accounts.');
} finally {
  await browser.close();
}
