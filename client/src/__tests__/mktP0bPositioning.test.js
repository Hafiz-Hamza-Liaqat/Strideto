/**
 * STRIDETO MKT-P0B — Positioning & conversion implementation contracts.
 * Run: node client/src/__tests__/mktP0bPositioning.test.js
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
  resolveHomepageHeroHeadline,
  resolveHomepageHeroSubheadline,
  resolveHomepageHeroCtas,
} from '../utils/homepageCmsSafety.js';
import { BRAND_TAGLINE } from '../design-system/brand.js';

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

const home = read('pages/Home/Home.jsx');
const homeEn = read('i18n/locales/en/home.json');
const workSection = read('components/home/HomeWorkWithStrideto.jsx');
const employerPage = read('pages/Public/EmployerAcquisition.jsx');
const employerLayout = read('components/employer/acquisition/EmployerAcquisitionLayout.jsx');
const employerAcquisitionSource = `${employerPage}\n${employerLayout}`;
const studentPage = read('pages/Public/StudentAcquisition.jsx');
const accountMenu = read('components/layout/UserAccountMenu.jsx');
const schemasSource = readRoot('client/src/seo/schemas.js');
const jobDetailSource = readRoot('client/src/pages/Jobs/JobDetail.jsx');
const staticRobots = readRoot('client/public/robots.txt').split('\r\n').join('\n');
const cmsSeed = readRoot('server/src/seed/cmsSiteContent.js');

// MKT-P0B-01 — homepage canonical headline renders
check(
  homeEn.includes('Opportunities for talent. Better hiring for employers.'),
  'MKT-P0B-01: canonical headline in en/home.json'
);
check(home.includes("t('home:heroTitle')"), 'MKT-P0B-01: Home.jsx uses i18n heroTitle fallback');

// MKT-P0B-02 — Explore Opportunities routes to /jobs
check(home.includes('ROUTES.JOBS') && home.includes('exploreOpportunities'), 'MKT-P0B-02: Explore Opportunities CTA present');
check(home.includes('data-cta="homepage-explore-opportunities"'), 'MKT-P0B-02: primary CTA data attribute');

// MKT-P0B-03 — For Employers routes to /employers
check(home.includes('ROUTES.FOR_EMPLOYERS') && home.includes('forEmployersCta'), 'MKT-P0B-03: For Employers CTA present');
check(home.includes('data-cta="homepage-for-employers"'), 'MKT-P0B-03: employer CTA data attribute');

// MKT-P0B-04 — Build Your Resume is no longer a competing primary hero CTA
const heroBlock = home.split('HomeHeroVisual')[0];
check(!heroBlock.includes('ROUTES.RESUME_BUILDER'), 'MKT-P0B-04: Resume Builder removed from hero block');
check(home.includes('buildYourResume') || homeEn.includes('buildYourResume'), 'MKT-P0B-04: resume string retained for lower sections');

// MKT-P0B-05 — employer acquisition page routes signup to /employer/register
check(employerAcquisitionSource.includes('ROUTES.EMPLOYER_REGISTER'), 'MKT-P0B-05: employer register route');
check(employerAcquisitionSource.includes('Create Employer Account'), 'MKT-P0B-05: Create Employer Account label');

// MKT-P0B-06 — employer copy qualifies applicant management correctly
check(
  employerAcquisitionSource.includes('submitted through STRIDETO') || employerAcquisitionSource.includes('submitted through Strideto'),
  'MKT-P0B-06: applicant management qualified to STRIDETO submissions'
);
check(
  employerPage.includes('External applications') || employerPage.includes('external link') || employerAcquisitionSource.includes('External application'),
  'MKT-P0B-06: external application path acknowledged'
);

// MKT-P0B-07 — student acquisition page retains /jobs + /auth/register paths
check(studentPage.includes('ROUTES.JOBS'), 'MKT-P0B-07: student page links to jobs');
check(studentPage.includes('ROUTES.REGISTER'), 'MKT-P0B-07: student page links to register');
check(studentPage.includes('Explore Opportunities'), 'MKT-P0B-07: Explore Opportunities label');

// MKT-P0B-08 — anonymous account menu exposes employer registration
check(accountMenu.includes('ROUTES.EMPLOYER_REGISTER'), 'MKT-P0B-08: employer register in account menu');
check(accountMenu.includes('ROUTES.LOGIN') && accountMenu.includes('ROUTES.REGISTER'), 'MKT-P0B-08: student auth retained');

// MKT-P0B-09 — Coming Soon workspace gates remain unchanged
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.INSTITUTION, {}) === false,
  'MKT-P0B-09: institution workspace still gated'
);
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY, {}) === false,
  'MKT-P0B-09: education workspace still gated'
);
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES, {}) === false,
  'MKT-P0B-09: business workspace still gated'
);
check(workSection.includes('Coming Soon'), 'MKT-P0B-09: Coming Soon badges retained');

// MKT-P0B-10 — no unsupported homepage aggregate/statistic is introduced
check(home.includes('filterSafeHomepageStats'), 'MKT-P0B-10: CMS stats filtered in Home.jsx');
check(isUnsupportedHomepageStat({ label: 'Jobs', value: '1000+' }), 'MKT-P0B-10: blocks 1000+ style stats');
check(filterSafeHomepageStats([{ label: 'Jobs', value: '1000+' }]) === null, 'MKT-P0B-10: filter removes unsafe stats');
check(!cmsSeed.includes("value: '1000+'"), 'MKT-P0B-10: seed no longer inserts 1000+ stats');

// MKT-P0B-11 — SEO canonical/indexability contracts remain unchanged
check(!isPrivateSeoPath('/employers'), 'MKT-P0B-11: /employers public');
check(!isPrivateSeoPath('/students'), 'MKT-P0B-11: /students public');
check(INDEXABLE_STATIC_PATHS.includes('/employers'), 'MKT-P0B-11: /employers in sitemap');
check(staticRobots === buildRobotsTxt(PRODUCTION_PUBLIC_ORIGIN), 'MKT-P0B-11: robots.txt unchanged');

// MKT-P0B-12 — no JobPosting policy change
check(/evaluateJobPostingEligibility/.test(schemasSource), 'MKT-P0B-12: JobPosting eligibility policy intact');
check(
  jobDetailSource.includes('jobPostingSchema') || jobDetailSource.includes('evaluateJobPostingEligibility'),
  'MKT-P0B-12: JobDetail still wired to JobPosting policy'
);

// MKT-P0B-13 — responsive hero has no obvious overflow-prone fixed widths
check(home.includes('minmax(0,') || home.includes('min-w-0'), 'MKT-P0B-13: hero uses min-w-0 / minmax grid');
check(!/w-\[\d{3,}px\]/.test(home.split('HomeHeroVisual')[0]), 'MKT-P0B-13: no large fixed px widths in hero content');

// MKT-P0B-14 — no unsupported trust/count/partner claims in public copy
const publicCopyBundle = [homeEn, employerAcquisitionSource, studentPage, workSection, read('i18n/locales/en/footer.json')].join('\n');
const forbiddenClaims = [
  'trusted by thousands',
  'verified talent',
  '100% authentic',
  'guaranteed jobs',
  'Only 2 days left',
];
for (const claim of forbiddenClaims) {
  check(!publicCopyBundle.toLowerCase().includes(claim), `MKT-P0B-14: no "${claim}" claim`);
}

// Brand alignment
check(BRAND_TAGLINE === 'Opportunities for talent. Better hiring for employers.', 'MKT-P0B: brand tagline locked');

// Employer homepage section — no anonymous dashboard CTA
check(!workSection.includes('Employer Dashboard'), 'MKT-P0B: no Employer Dashboard on homepage work section');
check(workSection.includes('ROUTES.FOR_EMPLOYERS'), 'MKT-P0B: employer work section links to acquisition page');
check(workSection.includes('ROUTES.EMPLOYER_REGISTER'), 'MKT-P0B: employer work section links to register');

// Hero visual component exists
check(home.includes('HomeHeroVisual'), 'MKT-P0B: hero visual composition wired');

// Trust micro-layer
check(home.includes('heroTrustBrowse'), 'MKT-P0B: trust layer present');

// Legacy CMS hero normalization
check(home.includes('resolveHomepageHeroHeadline'), 'MKT-P0B-HARDEN: legacy headline resolver wired');
check(home.includes('resolveHomepageHeroSubheadline'), 'MKT-P0B-HARDEN: legacy subheadline resolver wired');
check(home.includes('resolveHomepageHeroCtas'), 'MKT-P0B-HARDEN: legacy CTA resolver wired');
check(isLegacyHomepageHeroHeadline('Every Step Toward Success.'), 'MKT-P0B-HARDEN: detects legacy tagline headline');
check(
  isLegacyHomepageHeroHeadline('Find jobs, scholarships, admissions, and career resources worldwide'),
  'MKT-P0B-HARDEN: detects legacy seed headline'
);
check(
  !isLegacyHomepageHeroHeadline('Opportunities for talent. Better hiring for employers.'),
  'MKT-P0B-HARDEN: preserves canonical headline when CMS-authored'
);
check(
  resolveHomepageHeroHeadline('Every Step Toward Success.', 'canonical'),
  'MKT-P0B-HARDEN: legacy headline falls back to canonical'
);
check(
  isLegacyHomepageHeroSubheadline(
    'Discover jobs, scholarships, admissions, internships, and study opportunities — all in one place.'
  ),
  'MKT-P0B-HARDEN: detects legacy seed subheadline'
);
check(
  resolveHomepageHeroSubheadline(
    'Discover jobs, scholarships, admissions, internships, and study opportunities — all in one place.',
    'canonical sub'
  ) === 'canonical sub',
  'MKT-P0B-HARDEN: legacy subheadline falls back'
);
check(
  isLegacyHomepageHeroCtas([
    { label: 'Jobs', url: '/jobs' },
    { label: 'Scholarships', url: '/scholarships' },
    { label: 'Admissions', url: '/admissions' },
    { label: 'Internships', url: '/internships' },
  ]),
  'MKT-P0B-HARDEN: detects legacy four-chip CTA set'
);
check(resolveHomepageHeroCtas(null) === null, 'MKT-P0B-HARDEN: empty CMS CTAs use fallback hierarchy');

const heroVisual = read('components/home/HomeHeroVisual.jsx');
check(heroVisual.includes('<Link'), 'MKT-P0B-HARDEN: hero visual uses semantic navigation links');
check(heroVisual.includes('aria-hidden="true"'), 'MKT-P0B-HARDEN: decorative hero layers remain hidden');
check(!heroVisual.includes('pointer-events-none'), 'MKT-P0B-HARDEN: hero visual links remain pointer-interactive');

console.log(`mktP0bPositioning.test.js: ${count} checks passed`);
