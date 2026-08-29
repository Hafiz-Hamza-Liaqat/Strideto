/**
 * STRIDETO MKT-P0C — CMS & public metadata alignment contracts.
 * Run: node client/src/__tests__/mktP0cMetadata.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PRODUCTION_PUBLIC_ORIGIN } from '../../../shared/seo/publicSiteOrigin.js';
import {
  buildRobotsTxt,
  isPrivateSeoPath,
} from '../../../shared/seo/robotsPolicy.js';
import { INDEXABLE_STATIC_PATHS } from '../../../shared/seo/publicIndexablePages.js';
import { isWorkspaceLaunched, WORKSPACE_LAUNCH_IDS } from '../../../shared/launch/workspaceLaunchGates.js';
import {
  isUnsupportedHomepageStat,
  filterSafeHomepageStats,
  isLegacyHomepageHeroHeadline,
  isLegacyHomepageHeroSubheadline,
  isLegacyHomepageHeroCtas,
  isLegacyHomepageSeoTitle,
  isLegacyHomepageMetaDescription,
  resolveHomepageHeroHeadline,
  resolveHomepageHeroSubheadline,
  resolveHomepageHeroCtas,
  resolveHomepageSeoTitle,
  resolveHomepageMetaDescription,
} from '../utils/homepageCmsSafety.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const repo = path.resolve(clientSrc, '../..');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');
const readRoot = (rel) => readFileSync(path.join(repo, rel), 'utf8');

const CANONICAL_HEADLINE = 'Opportunities for talent. Better hiring for employers.';
const CANONICAL_SUBHEADLINE =
  'Discover jobs, internships, scholarships, and career resources — or publish opportunities and manage hiring through the STRIDETO employer workspace.';
const CANONICAL_SEO_TITLE = 'Jobs, Internships, Scholarships & Hiring | STRIDETO';
const CANONICAL_SEO_DESCRIPTION =
  'Discover jobs, internships, scholarships, and career resources, or publish opportunities and manage supported hiring workflows with STRIDETO.';

const LEGACY_CMS_SUBHEADLINE =
  'Find jobs, scholarships, admissions, and study abroad opportunities — all in one place. Only on Strideto.com';
const LEGACY_CMS_SEO_TITLE = 'Strideto – Jobs & Education Portal Pakistan';
const LEGACY_CMS_META_DESCRIPTION =
  "Pakistan's job and education portal. Find jobs, scholarships, admissions, internships, and study abroad opportunities. Avai the Opportunities";

const home = read('pages/Home/Home.jsx');
const homeEn = read('i18n/locales/en/home.json');
const seoEn = read('i18n/locales/en/seo.json');
const indexHtml = readRoot('client/index.html');
const seoConfig = read('seo/config.js');
const cmsSeed = readRoot('server/src/seed/cmsSiteContent.js');
const schemasSource = readRoot('client/src/seo/schemas.js');
const jobDetailSource = readRoot('client/src/pages/Jobs/JobDetail.jsx');
const staticRobots = readRoot('client/public/robots.txt').split('\r\n').join('\n');

// MKT-P0C-01 — homepage fallback H1 unchanged
check(homeEn.includes(CANONICAL_HEADLINE), 'MKT-P0C-01: canonical headline in en/home.json');
check(
  resolveHomepageHeroHeadline('Every Step Toward Success.', CANONICAL_HEADLINE) === CANONICAL_HEADLINE,
  'MKT-P0C-01: legacy headline still falls back to canonical H1'
);

// MKT-P0C-02 — homepage fallback subheadline matches approved MKT-P0B copy
check(homeEn.includes(CANONICAL_SUBHEADLINE), 'MKT-P0C-02: canonical subheadline in en/home.json');

// MKT-P0C-03 — known legacy CMS subheadline falls back
check(
  isLegacyHomepageHeroSubheadline(LEGACY_CMS_SUBHEADLINE),
  'MKT-P0C-03: detects production legacy CMS subheadline'
);
check(
  resolveHomepageHeroSubheadline(LEGACY_CMS_SUBHEADLINE, CANONICAL_SUBHEADLINE) === CANONICAL_SUBHEADLINE,
  'MKT-P0C-03: legacy CMS subheadline falls back to canonical'
);

// MKT-P0C-04 — arbitrary authored CMS subheadline still wins
const authoredSub = 'Join our spring hiring campaign for engineering roles across Europe.';
check(
  resolveHomepageHeroSubheadline(authoredSub, CANONICAL_SUBHEADLINE) === authoredSub,
  'MKT-P0C-04: intentional CMS subheadline preserved'
);

// MKT-P0C-05 — Pakistan-scoped legacy CMS headline remains suppressed
check(
  isLegacyHomepageHeroHeadline('Find jobs, scholarships, admissions, and career resources worldwide'),
  'MKT-P0C-05: legacy seed headline still detected'
);
check(home.includes('pakistanScoped'), 'MKT-P0C-05: Pakistan-scoped headline guard still wired');
check(
  /pakistanScoped\(rawHeadline\)/.test(home),
  'MKT-P0C-05: Pakistan-scoped CMS headline nulled before resolver'
);

// MKT-P0C-06 — legacy CTA suppression intact
check(
  isLegacyHomepageHeroCtas([
    { label: 'Jobs', url: '/jobs' },
    { label: 'Scholarships', url: '/scholarships' },
    { label: 'Admissions', url: '/admissions' },
    { label: 'Internships', url: '/internships' },
  ]),
  'MKT-P0C-06: legacy four-chip CTA set still detected'
);
check(resolveHomepageHeroCtas(null) === null, 'MKT-P0C-06: empty CMS CTAs still use fallback hierarchy');

// MKT-P0C-07 — unsupported aggregate stats remain suppressed
check(isUnsupportedHomepageStat({ label: 'Jobs', value: '1000+' }), 'MKT-P0C-07: blocks 1000+ style stats');
check(filterSafeHomepageStats([{ label: 'Jobs', value: '1000+' }]) === null, 'MKT-P0C-07: filter removes unsafe stats');

// MKT-P0C-08 — homepage fallback SEO title has no Pakistan-only positioning
check(homeEn.includes(CANONICAL_SEO_TITLE), 'MKT-P0C-08: canonical SEO title in en/home.json');
check(seoConfig.includes(CANONICAL_SEO_TITLE), 'MKT-P0C-08: canonical SEO title in seo/config.js');
check(isLegacyHomepageSeoTitle(LEGACY_CMS_SEO_TITLE), 'MKT-P0C-08: legacy Pakistan SEO title detected');
check(
  resolveHomepageSeoTitle(LEGACY_CMS_SEO_TITLE, CANONICAL_SEO_TITLE) === CANONICAL_SEO_TITLE,
  'MKT-P0C-08: legacy CMS SEO title falls back'
);
check(!CANONICAL_SEO_TITLE.toLowerCase().includes('pakistan'), 'MKT-P0C-08: canonical title not Pakistan-only');

// MKT-P0C-09 — homepage fallback meta description has no typo
check(homeEn.includes(CANONICAL_SEO_DESCRIPTION), 'MKT-P0C-09: canonical meta description in en/home.json');
check(isLegacyHomepageMetaDescription(LEGACY_CMS_META_DESCRIPTION), 'MKT-P0C-09: legacy CMS meta description detected');
check(
  resolveHomepageMetaDescription(LEGACY_CMS_META_DESCRIPTION, CANONICAL_SEO_DESCRIPTION) === CANONICAL_SEO_DESCRIPTION,
  'MKT-P0C-09: legacy CMS meta description falls back'
);
check(!CANONICAL_SEO_DESCRIPTION.includes('Avai the Opportunities'), 'MKT-P0C-09: no typo in canonical description');
check(home.includes('resolveHomepageSeoTitle'), 'MKT-P0C-09: SEO title resolver wired in Home.jsx');
check(home.includes('resolveHomepageMetaDescription'), 'MKT-P0C-09: meta description resolver wired in Home.jsx');

// MKT-P0C-10 — pre-hydration static title aligned
check(indexHtml.includes(CANONICAL_SEO_TITLE), 'MKT-P0C-10: static title in index.html');
check(!indexHtml.includes('Every Step Toward Success'), 'MKT-P0C-10: no legacy tagline in static title block');

// MKT-P0C-11 — pre-hydration static description aligned
check(indexHtml.includes(CANONICAL_SEO_DESCRIPTION), 'MKT-P0C-11: static description in index.html');
check(!indexHtml.toLowerCase().includes('every step toward success'), 'MKT-P0C-11: no legacy tagline in static shell');

// MKT-P0C-12 — no canonical/indexability change
check(!isPrivateSeoPath('/employers'), 'MKT-P0C-12: /employers public');
check(!isPrivateSeoPath('/students'), 'MKT-P0C-12: /students public');
check(INDEXABLE_STATIC_PATHS.includes('/employers'), 'MKT-P0C-12: /employers in sitemap');
check(staticRobots === buildRobotsTxt(PRODUCTION_PUBLIC_ORIGIN), 'MKT-P0C-12: robots.txt unchanged');

// MKT-P0C-13 — JobPosting policy unchanged
check(/evaluateJobPostingEligibility/.test(schemasSource), 'MKT-P0C-13: JobPosting eligibility policy intact');
check(
  jobDetailSource.includes('jobPostingSchema') || jobDetailSource.includes('evaluateJobPostingEligibility'),
  'MKT-P0C-13: JobDetail still wired to JobPosting policy'
);

// MKT-P0C-14 — Coming Soon workspace policy unchanged
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.INSTITUTION, {}) === false,
  'MKT-P0C-14: institution workspace still gated'
);
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY, {}) === false,
  'MKT-P0C-14: education workspace still gated'
);
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES, {}) === false,
  'MKT-P0C-14: business workspace still gated'
);

// MKT-P0C-15 — no unsupported aggregate/fake marketing claim introduced
const metadataBundle = [homeEn, seoEn, seoConfig, indexHtml, cmsSeed].join('\n').toLowerCase();
for (const claim of ['trusted by thousands', '1000+ jobs', 'guaranteed jobs', 'best platform']) {
  check(!metadataBundle.includes(claim), `MKT-P0C-15: no "${claim}" in metadata bundle`);
}

// Open Graph / Twitter static fallbacks aligned
check(indexHtml.includes(`property="og:title"`), 'MKT-P0C: og:title present in static shell');
check(indexHtml.includes(`name="twitter:title"`), 'MKT-P0C: twitter:title present in static shell');
check(!indexHtml.includes('Every Step Toward Success. Discover jobs'), 'MKT-P0C: legacy og/twitter description removed');

// CMS seed alignment
check(cmsSeed.includes(CANONICAL_HEADLINE), 'MKT-P0C: seed homepage headline aligned');
check(cmsSeed.includes(CANONICAL_SUBHEADLINE), 'MKT-P0C: seed homepage subheadline aligned');
check(cmsSeed.includes(CANONICAL_SEO_TITLE), 'MKT-P0C: seed SEO title aligned');
check(!cmsSeed.includes("value: '1000+'"), 'MKT-P0C: seed has no fake stats');

// Global seo.json fallback aligned (non-homepage default path)
check(seoEn.includes(CANONICAL_SEO_TITLE), 'MKT-P0C: seo.json defaultTitle aligned');
check(seoEn.includes(CANONICAL_SEO_DESCRIPTION), 'MKT-P0C: seo.json defaultDescription aligned');

// Config exports match canonical values
check(seoConfig.includes(`DEFAULT_TITLE = '${CANONICAL_SEO_TITLE}'`), 'MKT-P0C: DEFAULT_TITLE export aligned');
check(seoConfig.includes(CANONICAL_SEO_DESCRIPTION), 'MKT-P0C: DEFAULT_DESCRIPTION export aligned');

console.log(`mktP0cMetadata.test.js: ${count} checks passed`);
