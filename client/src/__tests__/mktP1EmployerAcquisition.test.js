/**
 * STRIDETO MKT-P1 — Employer acquisition & conversion contracts.
 * Run: node client/src/__tests__/mktP1EmployerAcquisition.test.js
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

const employerPage = read('pages/Public/EmployerAcquisition.jsx');
const employerLayout = read('components/employer/acquisition/EmployerAcquisitionLayout.jsx');
const employerAnalytics = read('components/employer/acquisition/employerAcquisitionAnalytics.js');
const employerConversion = read('components/employer/acquisition/EmployerConversionCta.jsx');
const employerVisual = read('components/employer/acquisition/EmployerHeroVisual.jsx');
const employerRegister = read('pages/Employer/EmployerRegister.jsx');
const employerLogin = read('pages/Employer/EmployerLogin.jsx');
const accountMenu = read('components/layout/UserAccountMenu.jsx');
const home = read('pages/Home/Home.jsx');
const workSection = read('components/home/HomeWorkWithStrideto.jsx');
const navConfig = read('components/layout/navConfig.js');
const schemasSource = readRoot('client/src/seo/schemas.js');
const jobDetailSource = readRoot('client/src/pages/Jobs/JobDetail.jsx');
const staticRobots = readRoot('client/public/robots.txt').split('\r\n').join('\n');
const employerEn = read('i18n/locales/en/employer.json');

const publicCopyBundle = [
  employerPage,
  employerLayout,
  employerVisual,
  employerConversion,
  employerRegister,
  employerLogin,
].join('\n');

const marketingCopyBundle = [
  employerPage,
  employerLayout,
  employerVisual,
  employerConversion,
].join('\n');

// MKT-P1-01 — primary CTA → /employer/register
check(employerLayout.includes('ROUTES.EMPLOYER_REGISTER'), 'MKT-P1-01: register route in layout');
check(
  employerLayout.includes('Create Employer Account') && employerLayout.indexOf('Create Employer Account') < employerLayout.indexOf('Post a Job'),
  'MKT-P1-01: Create Employer Account precedes Post a Job in hero'
);

// MKT-P1-02 — employer sign-in → /employer/login
check(employerLayout.includes('ROUTES.EMPLOYER_LOGIN'), 'MKT-P1-02: login route in layout');
check(employerLayout.includes('Employer Sign In'), 'MKT-P1-02: Employer Sign In label');

// MKT-P1-03 — Post a Job follows protected employer flow
check(employerLayout.includes('ROUTES.EMPLOYER_POST_JOB'), 'MKT-P1-03: Post a Job route wired');
check(read('components/employer/ProtectedEmployerRoute.jsx').includes('ROUTES.EMPLOYER_LOGIN'), 'MKT-P1-03: post job protected by employer auth');

// MKT-P1-04 — STRIDETO-submitted applications qualified
check(
  publicCopyBundle.includes('submitted through STRIDETO') || publicCopyBundle.includes('submitted through Strideto'),
  'MKT-P1-04: STRIDETO-submitted qualifier present'
);
check(
  employerPage.includes('Review STRIDETO-submitted applicants') || employerLayout.includes('Review STRIDETO-submitted applicants'),
  'MKT-P1-04: review copy qualified'
);

// MKT-P1-05 — external application truthfully described
check(
  publicCopyBundle.includes('External application') || publicCopyBundle.includes('external application'),
  'MKT-P1-05: external application section present'
);
check(
  publicCopyBundle.includes('not tracked') || publicCopyBundle.includes('not visible') || publicCopyBundle.includes('outside STRIDETO'),
  'MKT-P1-05: external apps not managed in STRIDETO'
);

// MKT-P1-06 — no unsupported statistics
const forbiddenStats = ['348 Applicants', '92% Match', '1,250 Candidates', 'trusted by thousands', '#1 recruitment'];
for (const stat of forbiddenStats) {
  check(!publicCopyBundle.includes(stat), `MKT-P1-06: no "${stat}"`);
}

// MKT-P1-07 — no fake testimonials/partner logos
const forbiddenSocial = ['testimonial', 'partner logo', 'Trusted partner', 'Verified employer badge'];
for (const item of forbiddenSocial) {
  check(!publicCopyBundle.toLowerCase().includes(item.toLowerCase()), `MKT-P1-07: no "${item}"`);
}
check(!employerVisual.includes('<img'), 'MKT-P1-07: hero visual has no fake avatar images');

// MKT-P1-08 — registration has acquisition context
check(employerRegister.includes('ROUTES.FOR_EMPLOYERS'), 'MKT-P1-08: register links to employer benefits');
check(employerEn.includes('Create your employer account'), 'MKT-P1-08: registration heading updated');
check(publicCopyBundle.includes('Create your employer account') || employerEn.includes('Create your employer account'), 'MKT-P1-08: registration context in locale');

// MKT-P1-09 — anonymous account menu retains employer registration
check(accountMenu.includes('ROUTES.EMPLOYER_REGISTER'), 'MKT-P1-09: employer register in menu');
check(accountMenu.includes('Create Employer Account'), 'MKT-P1-09: Create Employer Account label');

// MKT-P1-10 — normal user auth entries remain
check(accountMenu.includes('ROUTES.LOGIN') && accountMenu.includes('ROUTES.REGISTER'), 'MKT-P1-10: student auth retained');

// MKT-P1-11 — homepage employer CTA remains /employers
check(home.includes('ROUTES.FOR_EMPLOYERS') && home.includes('forEmployersCta'), 'MKT-P1-11: homepage For Employers CTA');
check(home.includes('data-cta="homepage-for-employers"'), 'MKT-P1-11: homepage employer data-cta retained');

// MKT-P1-12 — Coming Soon gates unchanged
check(isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.INSTITUTION, {}) === false, 'MKT-P1-12: institution gated');
check(isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY, {}) === false, 'MKT-P1-12: education gated');
check(isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES, {}) === false, 'MKT-P1-12: business gated');

// MKT-P1-13 — JobPosting policy unchanged
check(/evaluateJobPostingEligibility/.test(schemasSource), 'MKT-P1-13: JobPosting eligibility intact');
check(
  jobDetailSource.includes('jobPostingSchema') || jobDetailSource.includes('evaluateJobPostingEligibility'),
  'MKT-P1-13: JobDetail wired to JobPosting policy'
);

// MKT-P1-14 — canonical/indexability unchanged
check(!isPrivateSeoPath('/employers'), 'MKT-P1-14: /employers public');
check(INDEXABLE_STATIC_PATHS.includes('/employers'), 'MKT-P1-14: /employers in sitemap');
check(staticRobots === buildRobotsTxt(PRODUCTION_PUBLIC_ORIGIN), 'MKT-P1-14: robots.txt unchanged');

// MKT-P1-15 — no unsupported free/unlimited pricing claims on public employer surfaces
const pricingClaims = ['free job posting', 'unlimited jobs', 'unlimited applicants', 'unlimited hiring', 'First Job Free'];
for (const claim of pricingClaims) {
  check(!marketingCopyBundle.toLowerCase().includes(claim.toLowerCase()), `MKT-P1-15: no "${claim}" on public surfaces`);
}

// MKT-P1-16 — analytics emit no personal form data
check(employerAnalytics.includes('cta_click'), 'MKT-P1-16: uses cta_click taxonomy');
check(employerAnalytics.includes('shouldEmitEmployerPageView'), 'MKT-P1-16: employer page view burst dedup');
check(read('components/employer/acquisition/employerPageViewBurst.js').includes('STRICT_MODE_BURST_MS'), 'MKT-P1-16: strict-mode burst window only');
check(!read('components/employer/acquisition/employerPageViewBurst.js').includes('sessionStorage'), 'MKT-P1-16: no session-wide page view suppression');
check(!read('components/employer/acquisition/employerPageViewBurst.js').includes('trackedEmployerPageViews'), 'MKT-P1-16: no permanent navigation registry');
check(!employerAnalytics.includes('email'), 'MKT-P1-16: analytics helper has no email fields');
check(!employerAnalytics.includes('password'), 'MKT-P1-16: analytics helper has no password fields');

// MKT-P1-17 — final conversion CTA block
check(employerConversion.includes('EmployerConversionCta'), 'MKT-P1-17: conversion component exists');
check(employerLayout.includes('EmployerConversionCta'), 'MKT-P1-17: final conversion block wired');
check(employerLayout.includes('Ready to start hiring?') || employerConversion.includes('Ready to start hiring?'), 'MKT-P1-17: final CTA heading');

// MKT-P1-18 — no misleading ATS / external applicant management claim
const misleadingAts = [
  'full applicant tracking',
  'end-to-end ATS',
  'manage every applicant',
  'track all applications',
];
for (const claim of misleadingAts) {
  check(!publicCopyBundle.toLowerCase().includes(claim), `MKT-P1-18: no "${claim}"`);
}

// Analytics events defined
check(employerAnalytics.includes('employer_signup_intent'), 'MKT-P1: signup intent action');
check(employerAnalytics.includes('employer_page_view'), 'MKT-P1: page view action');
check(home.includes('homepage_employer_cta') || home.includes('HOMEPAGE_EMPLOYER_CTA'), 'MKT-P1: homepage employer analytics');

// Hero visual safety
check(employerVisual.includes('aria-hidden="true"'), 'MKT-P1: hero visual decorative');
check(employerVisual.includes('pointer-events-none'), 'MKT-P1: hero visual non-interactive');

// Navbar decision — defer For Employers (crowded nav)
check(!navConfig.includes('/employers'), 'MKT-P1: For Employers not forced into primary nav');

// Homepage work section continuity
check(workSection.includes('ROUTES.FOR_EMPLOYERS'), 'MKT-P1: work section links to /employers');

// FAQ without FAQPage schema
check(employerLayout.includes('Employer FAQ'), 'MKT-P1: visible FAQ section');
check(!employerLayout.includes('FAQPage'), 'MKT-P1: no FAQPage schema added');

check(employerLayout.includes('navigationKey: location.key'), 'MKT-P1: page view wired to router navigation key');

// Application methods section
check(employerPage.includes('Apply through STRIDETO'), 'MKT-P1: internal apply method copy');
check(employerPage.includes('External application'), 'MKT-P1: external apply method copy');

// ---------------------------------------------------------------------------
// ANALYTICS-01..09 — employer page-view navigation semantics (behavioral)
// ---------------------------------------------------------------------------
const burstModule = await import('../components/employer/acquisition/employerPageViewBurst.js');
const {
  shouldEmitEmployerPageView,
  resetEmployerPageViewBurstState,
  advanceEmployerPageViewClock,
} = burstModule;

resetEmployerPageViewBurstState();
check(shouldEmitEmployerPageView('nav-first'), 'ANALYTICS-01: initial /employers visit emits one page view');

resetEmployerPageViewBurstState();
check(shouldEmitEmployerPageView('nav-strict'), 'ANALYTICS-02a: first strict-mode mount allowed');
check(!shouldEmitEmployerPageView('nav-strict'), 'ANALYTICS-02: strict-mode duplicate mount suppressed');

check(
  employerLayout.includes('[canonical, location.key]') && employerLayout.includes('useEffect'),
  'ANALYTICS-03: page-view effect keyed to navigation only (rerender without key change does not refire)'
);

resetEmployerPageViewBurstState();
check(shouldEmitEmployerPageView('nav-visit-1'), 'ANALYTICS-04a: first link visit allowed');
check(shouldEmitEmployerPageView('nav-visit-2'), 'ANALYTICS-04: new link navigation emits new page view immediately');

resetEmployerPageViewBurstState();
check(shouldEmitEmployerPageView('nav-back-key'), 'ANALYTICS-05a: initial /employers visit allowed');
advanceEmployerPageViewClock(300);
check(shouldEmitEmployerPageView('nav-back-key'), 'ANALYTICS-05: browser Back revisit emits new page view');

resetEmployerPageViewBurstState();
check(shouldEmitEmployerPageView('nav-forward-key'), 'ANALYTICS-06a: initial visit allowed');
advanceEmployerPageViewClock(300);
check(shouldEmitEmployerPageView('nav-forward-key'), 'ANALYTICS-06: browser Forward revisit emits new page view');

check(
  employerAnalytics.includes('trackPlatformEvent') && read('utils/platformAnalytics.js').includes('allowsAnalytics'),
  'ANALYTICS-07: page views delegate to consent-gated trackPlatformEvent'
);
check(!employerAnalytics.includes('analyticsEventApi'), 'ANALYTICS-07: employer analytics does not bypass consent gate');

check(
  employerAnalytics.includes('navigationKey, ...safeExtra') || employerAnalytics.includes('{ navigationKey, ...safeExtra }'),
  'ANALYTICS-08: navigationKey stripped from page-view metadata (not sent as payload field)'
);
check(!employerAnalytics.includes('password'), 'ANALYTICS-08: no password in analytics helper');

check(
  read('utils/platformAnalytics.js').includes('getSessionAcquisitionMetadata'),
  'ANALYTICS-09: UTM acquisition metadata preserved via trackPlatformEvent'
);
check(
  employerAnalytics.includes('...safeExtra') && employerAnalytics.includes('trackPlatformEvent'),
  'ANALYTICS-09: employer page view still routes through platform analytics pipeline'
);

console.log(`mktP1EmployerAcquisition.test.js: ${count} checks passed`);
