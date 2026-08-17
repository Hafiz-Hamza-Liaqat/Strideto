import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const BASE = process.env.STRIDETO_QA_BASE || 'https://127.0.0.1:8443';
const widths = [320, 375, 768, 1024, 1440];
const themes = ['light', 'dark'];
const service = {
  _id: '507f1f77bcf86cd799439020', title: 'University application planning', category: 'university_application_support',
  description: 'Provider-maintained application planning.', eligibilityNotes: 'Confirm final requirements with each institution.',
  countriesServed: ['PK'], destinationCountries: ['GB'], journeyType: 'study_abroad', deliveryMode: 'online',
  pricingMode: 'fixed_price', price: { amountMinor: 15025, currency: 'USD' }, durationEstimate: 'About 2 weeks', status: 'active',
};
const publicProfile = {
  slug: 'p2a-provider', professionalName: 'P2A Education Provider', agentType: 'agent', countryCode: 'PK',
  destinationCountries: ['GB'], languages: ['en'], specialties: ['university_application_support'], professionalSummary: 'Truthful Education guidance.',
  educationProfessionalVerification: { verified: true, scope: 'education_mobility' }, trustBadges: [], services: [service],
};

function responseFor(path, realm) {
  if (path === '/api/auth/agent/refresh-token') return realm === 'provider' ? [200, { accessToken: 'p2a-provider-token' }] : [401, {}];
  if (path === '/api/auth/agent/me') return realm === 'provider' ? [200, { account: { _id: 'agent-p2a', email: 'provider@example.test', agentType: 'agent' }, memberships: [] }] : [401, {}];
  if (path === '/api/auth/refresh-token') return [200, {}];
  if (path === '/api/auth/me') return [200, { user: null }];
  if (path === '/api/agent/provider-domains/context') return [200, { needsOnboarding: false, workspaces: [{ subjectType: 'agent', subjectId: 'agent-p2a', kind: 'independent', domainId: 'education_mobility', path: '/agent/education' }] }];
  if (path === '/api/agent/profile') return [200, { profile: { agentType: 'agent', professionalName: 'P2A Education Provider' } }];
  if (path === '/api/agent/services') return [200, { services: [service] }];
  if (path === '/api/agents') return [200, { profiles: [publicProfile], total: 1, page: 1, limit: 20, pages: 1 }];
  if (path === '/api/agents/p2a-provider/reviews') return [200, { aggregate: { averageRating: null, reviewCount: 0 }, reviews: [], verifiedMeaning: '' }];
  if (path === '/api/agents/p2a-provider') return [200, { profile: publicProfile }];
  if (path.includes('/notifications')) return [200, { notifications: [], data: [], count: 0, unreadCount: 0, pagination: { totalPages: 1 } }];
  return [200, { items: [] }];
}

const scenarios = [
  { realm: 'provider', route: '/agent/education/services', name: 'create-service' },
  { realm: 'provider', route: '/agent/education/services', name: 'edit-service', edit: true },
  { realm: 'public', route: '/agents?serviceCategory=university_application_support&countryCode=PK', name: 'directory' },
  { realm: 'public', route: '/agents/p2a-provider', name: 'public-profile' },
];

const browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors'] });
const errors = [];
let cells = 0;
try {
  for (const scenario of scenarios) {
    for (const theme of themes) {
      const page = await browser.newPage();
      page.on('pageerror', (error) => errors.push(`${scenario.name} ${theme}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`${scenario.name} ${theme}: ${message.text()}`); });
      await page.evaluateOnNewDocument((value) => localStorage.setItem('edurozgaar-theme', value), theme);
      await page.setRequestInterception(true);
      page.on('request', (incoming) => {
        const url = new URL(incoming.url());
        if (!url.pathname.startsWith('/api/')) return incoming.continue();
        const [status, body] = responseFor(url.pathname, scenario.realm);
        return incoming.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      for (const width of widths) {
        await page.setViewport({ width, height: width < 768 ? 1000 : 1100 });
        await page.goto(`${BASE}${scenario.route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForSelector('h1', { timeout: 15_000 });
        if (scenario.edit) {
          await page.waitForSelector('button');
          await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Edit')?.click());
          await page.waitForFunction(() => document.body.innerText.includes('Save changes'));
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        const result = await page.evaluate((name) => {
          const visible = (node) => Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
          const fields = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(visible);
          return {
            h1: document.querySelector('h1')?.textContent?.trim() || '',
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            unlabeled: fields.filter((node) => !(node.labels?.length || node.closest('label') || node.getAttribute('aria-label') || node.getAttribute('aria-labelledby'))).length,
            boundary: document.body.innerText.includes('This page could not be displayed'),
            dark: document.documentElement.classList.contains('dark'),
            categoryOptions: name.includes('service') ? [...document.querySelectorAll('select[id$="-category"]')].map((select) => select.options.length) : null,
            serviceFilterOptions: name === 'directory' ? document.querySelectorAll('#agent-directory-service-category option').length : null,
            price: name === 'public-profile' ? document.body.innerText.includes('150.25 USD') : true,
          };
        }, scenario.name);
        assert.ok(result.h1, `${scenario.name} ${width} ${theme}: h1`);
        assert.ok(result.overflow <= 2, `${scenario.name} ${width} ${theme}: overflow ${result.overflow}`);
        assert.equal(result.unlabeled, 0, `${scenario.name} ${width} ${theme}: unlabeled controls`);
        assert.equal(result.boundary, false, `${scenario.name} ${width} ${theme}: route boundary`);
        assert.equal(result.dark, theme === 'dark', `${scenario.name} ${width} ${theme}: theme`);
        if (result.categoryOptions != null) assert.ok(result.categoryOptions.length > 0 && result.categoryOptions.every((count) => count === 9), `${scenario.name}: nine canonical categories`);
        if (result.serviceFilterOptions != null) assert.equal(result.serviceFilterOptions, 10, 'directory has all-services plus nine categories');
        assert.equal(result.price, true, 'public price shows human amount and currency');
        cells += 1;
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
assert.deepEqual(errors, [], errors.join('\n'));
assert.equal(cells, 40);
console.log(`P2A responsive Education service/discovery acceptance: PASS (${cells}/40 cells)`);
