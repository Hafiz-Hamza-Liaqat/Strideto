/**
 * STRIDETO MKT-P2 — Employer onboarding & activation contracts.
 * Run: node client/src/__tests__/mktP2EmployerActivation.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  deriveEmployerActivationChecklist,
  evaluateEmployerProfileCompleteness,
} from '../../../shared/employer/employerActivationState.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const repoRoot = path.resolve(clientSrc, '../..');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');
const readRoot = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8');

const dashboard = read('pages/Employer/EmployerDashboard.jsx');
const jobs = read('pages/Employer/EmployerJobs.jsx');
const postJob = read('pages/Employer/EmployerPostJob.jsx');
const settings = read('pages/Employer/EmployerSettings.jsx');
const login = read('pages/Employer/EmployerLogin.jsx');
const checklist = read('components/employer/activation/EmployerActivationChecklist.jsx');
const activationAnalytics = read('components/employer/activation/employerActivationAnalytics.js');
const acquisitionAnalytics = read('components/employer/acquisition/employerAcquisitionAnalytics.js');
const home = read('pages/Home/Home.jsx');
const employerEn = read('i18n/locales/en/employer.json');
const autofillMerge = read('components/jobs/jobDocumentSuggestionMerge.js');
const protectedRoute = read('components/employer/ProtectedEmployerRoute.jsx');

const activationCopyBundle = [dashboard, jobs, postJob, checklist, employerEn].join('\n');

check(dashboard.includes('EmployerActivationChecklist'), 'MKT-P2-01: activation checklist on dashboard');
check(dashboard.includes('zeroJobsPrimaryCta'), 'MKT-P2-02: dashboard zero-job primary CTA');
check(jobs.includes('zeroJobsPrimaryCta'), 'MKT-P2-02: jobs page zero-job CTA');
check(jobs.includes('ROUTES.EMPLOYER_POST_JOB'), 'MKT-P2-03: post job uses canonical route');
check(protectedRoute.includes('ROUTES.EMPLOYER_LOGIN'), 'MKT-P2-03: employer post job protected');
check(checklist.includes('ROUTES.EMPLOYER_SETTINGS'), 'MKT-P2-04: profile step links to settings');

check(checklist.includes('deriveEmployerActivationChecklist'), 'MKT-P2-05: checklist uses derived state');
const incomplete = deriveEmployerActivationChecklist({
  employer: { companyName: 'Acme' },
  dashboard: { totalJobs: 0, jobs: [] },
});
check(!incomplete.items.find((i) => i.id === 'profile').complete, 'MKT-P2-05: incomplete profile not marked done');

const withJob = deriveEmployerActivationChecklist({
  employer: {
    companyName: 'Acme',
    email: 'hr@acme.com',
    companyDescription: 'We build things.',
    industry: 'Technology',
    city: 'London',
  },
  dashboard: {
    totalJobs: 1,
    jobs: [{ applyType: 'internal', status: 'active', approvalStatus: 'pending' }],
    pendingApprovalJobs: 1,
  },
});
check(withJob.activationComplete, 'MKT-P2-05: full activation derived from data');

const experienced = deriveEmployerActivationChecklist({
  employer: {
    companyName: 'Acme',
    email: 'hr@acme.com',
    companyDescription: 'Desc',
    industry: 'Tech',
    location: 'NYC',
  },
  dashboard: {
    totalJobs: 3,
    activeJobs: 2,
    jobs: [{ applyType: 'external', applicationLink: 'https://example.com/jobs', status: 'active' }],
    pendingApprovalJobs: 1,
  },
});
check(experienced.activationComplete, 'MKT-P2-06: experienced published employer complete');

check(employerEn.includes('submit through STRIDETO'), 'MKT-P2-07: internal apply STRIDETO wording');
check(employerEn.includes('not tracked or managed inside STRIDETO'), 'MKT-P2-08: external not tracked');

for (const claim of ['manage every applicant', 'track every application', 'complete ATS']) {
  check(!activationCopyBundle.toLowerCase().includes(claim), `MKT-P2-09: no "${claim}"`);
}
for (const claim of ['Post for free', 'Unlimited jobs', 'Forever free']) {
  check(!activationCopyBundle.includes(claim), `MKT-P2-10: no "${claim}"`);
}

check(postJob.includes('RequiredMark') && postJob.includes('OptionalMark'), 'MKT-P2-11: required/optional marks');
check(postJob.includes('validateApplyMethodSelection'), 'MKT-P2-13: apply method validation');
check(postJob.includes('employerApi.activateJob'), 'MKT-P2-16: activate via employer API');
check(postJob.includes("step === 'success'"), 'MKT-P2-19: publish success step');
check(employerEn.includes('No applications yet'), 'MKT-P2-23: zero applicant copy');

check(activationAnalytics.includes('employer_onboarding_view'), 'MKT-P2-25: onboarding view event');
check(activationAnalytics.includes('employer_job_published'), 'MKT-P2-30: job published event');
check(home.includes('trackHomepageEmployerCtaFromUrl'), 'MKT-P2-33: CMS hero employer CTA hook');
check(home.includes('HOMEPAGE_EMPLOYER_CTA'), 'MKT-P2-34: fallback hero employer CTA analytics');
check(acquisitionAnalytics.includes('shouldEmitEmployerCtaClick'), 'MKT-P2-35: login click dedup');

const clickBurstMod = await import('../components/employer/acquisition/employerCtaClickBurst.js');
clickBurstMod.resetEmployerCtaClickBurstState();
check(clickBurstMod.shouldEmitEmployerCtaClick('employer_login_intent:hero'), 'MKT-P2-35a: first login click');
check(!clickBurstMod.shouldEmitEmployerCtaClick('employer_login_intent:hero'), 'MKT-P2-35: duplicate suppressed');
clickBurstMod.advanceEmployerCtaClickClock(300);
check(clickBurstMod.shouldEmitEmployerCtaClick('employer_login_intent:hero'), 'MKT-P2-36: later click allowed');

check(read('utils/platformAnalytics.js').includes('getSessionAcquisitionMetadata'), 'MKT-P2-38: UTM metadata');
check(!login.includes('ROUTES.HOME'), 'MKT-P2: employer login avoids student home redirect');
check(autofillMerge.includes('EMPLOYER_SUGGESTION_FIELD_MAP'), 'MKT-P2-18: autofill map intact');

const profileFields = evaluateEmployerProfileCompleteness({
  companyName: 'Co',
  email: 'a@b.com',
  companyDescription: 'About',
  industry: 'Tech',
  city: 'City',
});
check(profileFields.complete, 'MKT-P2: profile completeness helper');

// STATE parity — profile fields align with EmployerSubmissionEligibility publish profile checks
const eligibility = readRoot('server/src/services/publishing/EmployerSubmissionEligibility.js');
check(eligibility.includes('companyDescription'), 'STATE-01: backend requires companyDescription');
check(eligibility.includes('industry'), 'STATE-01: backend requires industry');
check(
  activationAnalytics.includes('trackEmployerActivationEvent'),
  'ANALYTICS-01: activation_completed uses activation event helper'
);
check(
  !dashboard.includes('trackEmployerActivationCompletedOnce'),
  'ANALYTICS-02: dashboard does not emit activation_completed on mount'
);
check(
  postJob.includes('ACTIVATION_COMPLETED') && postJob.includes('activationCompletedTracked'),
  'ANALYTICS-01: publish success emits activation_completed on transition'
);
check(
  settings.includes('profileBeforeSave') && settings.includes('PROFILE_COMPLETED'),
  'ANALYTICS-05: profile_completed fires on incomplete→complete transition'
);
check(
  postJob.includes('finishPublishSuccess') && postJob.includes('EMPLOYER_ACTIVATION_ACTIONS.JOB_PUBLISHED'),
  'ANALYTICS-03: job_published emitted from success handler only'
);
check(
  postJob.includes('publishReadinessOrgVerification'),
  'verification UX distinguishes organization verification'
);
check(
  postJob.includes('publishReadinessEmailVerification'),
  'verification UX distinguishes account email verification'
);

const milestonesMod = await import('../components/employer/activation/employerActivationMilestones.js');
milestonesMod.resetEmployerActivationMilestonesForTests();
let activationFires = 0;
check(
  milestonesMod.emitEmployerActivationMilestoneOnce('user-1', 'activation_completed', () => {
    activationFires += 1;
  }) === false,
  'ANALYTICS-CONSENT: milestone suppressed when analytics consent denied (test env default)'
);
check(activationFires === 0, 'ANALYTICS-CONSENT: no fire without consent');

console.log(`mktP2EmployerActivation.test.js: ${count} checks passed`);
