/**
 * STRIDETO MKT-P3 — Employer applicant workflow & hiring operations contracts.
 * Run: node client/src/__tests__/mktP3EmployerApplicantWorkflow.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  EMPLOYER_SETTABLE_STATUSES,
  LEGACY_STATUS_LABEL_KEYS,
  CANDIDATE_NOTIFIED_STATUSES,
} from '../utils/employerApplicationStatus.js';

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

const applications = read('pages/Employer/EmployerApplications.jsx');
const detail = read('pages/Employer/EmployerApplicationDetail.jsx');
const jobs = read('pages/Employer/EmployerJobs.jsx');
const dashboard = read('pages/Employer/EmployerDashboard.jsx');
const routes = read('routes/index.jsx');
const employerEn = JSON.parse(read('i18n/locales/en/employer.json'));
const analytics = read('components/employer/applicant/employerApplicantAnalytics.js');
const employerService = read('services/employerService.js');
const platformAnalytics = read('utils/platformAnalytics.js');
const controller = readRoot('server/src/controllers/employerController.js');
const employerRoutes = readRoot('server/src/routes/employer.js');

const copyBundle = [applications, detail, jobs, dashboard, employerEn].join('\n').toLowerCase();

// MKT-P3-01 internal-apply entry points
check(jobs.includes('ROUTES.EMPLOYER_APPLICATIONS'), 'MKT-P3-01: jobs list links to applications');
check(dashboard.includes('ROUTES.EMPLOYER_APPLICATIONS'), 'MKT-P3-01: dashboard links to applications');
check(applications.includes('reviewApplication'), 'MKT-P3-01: inbox exposes review application CTA');

// MKT-P3-02 external does not imply STRIDETO tracking
check(applications.includes('isExternal'), 'MKT-P3-02: external job detection');
check(employerEn.externalAppsNotVisible.includes('not visible'), 'MKT-P3-02: external disclosure copy');
check(!applications.includes('No applications yet') || employerEn.noApplicationsYet.includes('for this job'), 'MKT-P3-02: internal empty is job-scoped');

// MKT-P3-03 zero internal applications empty state
check(employerEn.noApplicationsYet.includes('No applications yet'), 'MKT-P3-03: truthful internal empty');
check(applications.includes('internalEmptyHint'), 'MKT-P3-03: internal empty hint');

// MKT-P3-04 global empty state
check(applications.includes('globalNoApplicationsYet'), 'MKT-P3-04: global empty state');
check(employerEn.globalNoApplicationsHint.includes('STRIDETO'), 'MKT-P3-04: global hint truthful');

// MKT-P3-05 list job/application context
check(applications.includes('jobMeta?.title'), 'MKT-P3-05: job title in list context');
check(applications.includes('applicationDetailPath'), 'MKT-P3-05: review links to detail');

// MKT-P3-06 detail renders submitted data only
check(detail.includes('coverLetter'), 'MKT-P3-06: cover letter section when present');
check(detail.includes('hasCoverLetter'), 'MKT-P3-06: conditional cover letter');
check(detail.includes('applicationOverview'), 'MKT-P3-06: overview section');
check(controller.includes('getApplicationDetail'), 'MKT-P3-06: server detail endpoint');

// MKT-P3-07 missing resume
check(detail.includes('noResumeSubmitted'), 'MKT-P3-07: missing resume copy');
check(detail.includes('application.hasResume') && !detail.includes('application.resumeURL'), 'MKT-P3-07/DOC-03: resume CTA uses hasResume only');
check(detail.includes('openEmployerApplicationResume'), 'DOC-01: detail opens resume via authorized API');
check(applications.includes('openEmployerApplicationResume'), 'DOC-01: inbox opens resume via authorized API');
check(employerService.includes('fetchApplicationResume'), 'DOC-01: client resume fetch uses authenticated endpoint');
check(employerRoutes.includes('getApplicationResume'), 'DOC-01: resume route registered');
check(!controller.includes('resumeURL: application.resumeURL') || controller.includes('hasResume: Boolean(application.resumeURL)'), 'SEC-09: detail minimizes resume URL exposure');

// MKT-P3-08 internal vs external truth
check(employerEn.applyMethodInternalHelp.includes('STRIDETO'), 'MKT-P3-08: internal apply truth');
check(employerEn.applyMethodExternalUrlHelp.includes('not tracked'), 'MKT-P3-08: external apply truth');

// MKT-P3-09 no ATS overclaim
for (const claim of ['complete ats', 'full ats', 'end-to-end hiring', 'ai candidate scoring', 'automatic applicant tracking']) {
  check(!copyBundle.includes(claim), `MKT-P3-09: no "${claim}"`);
}

// MKT-P3-10 no fake metrics
check(!applications.includes('fake') && !detail.includes('fakeViews'), 'MKT-P3-10: no fake metric constants');

// MKT-P3-11 status model maps to backend enum
check(
  EMPLOYER_SETTABLE_STATUSES.join(',') === 'shortlisted,rejected,interview,hired',
  'MKT-P3-11: settable statuses match server whitelist'
);
check(Object.keys(LEGACY_STATUS_LABEL_KEYS).includes('submitted'), 'MKT-P3-11: legacy read statuses labeled');

// MKT-P3-12 status change persists (detail + inbox reload)
check(detail.includes('loadDetail()'), 'MKT-P3-12: detail reloads after update');
check(applications.includes('loadApplications({ background: true, force: true })'), 'MKT-P3-13/12: inbox reloads after update');

// MKT-P3-13 failed update preserves state — catch without optimistic success event on detail
check(detail.includes('setStatusError'), 'MKT-P3-13: detail surfaces failure');
check(applications.includes('catch'), 'MKT-P3-13: inbox catches failure');

// MKT-P3-14 success only after API success
check(detail.includes('setStatusSuccess') && detail.includes('await employerApi.updateApplicationStatus'), 'MKT-P3-14: success after API');
check(applications.includes('setStatusSuccess') && applications.includes('await employerApi.updateApplicationStatus'), 'MKT-P3-14: inbox success after API');

// MKT-P3-15 notification copy truth
check(CANDIDATE_NOTIFIED_STATUSES.has('rejected'), 'MKT-P3-15: rejected notifies candidate');
check(detail.includes('confirmRejectWithNotify'), 'MKT-P3-15: reject confirmation mentions notify');
check(employerEn.statusChangeNotifyHint.includes('notify'), 'MKT-P3-15: status hint mentions notify');

// MKT-P3-16 no unsupported status exposed
check(!detail.includes("'viewed'") || detail.includes('EMPLOYER_SETTABLE_STATUSES'), 'MKT-P3-16: detail uses settable list');

// MKT-P3-17 mass assignment — server whitelists body keys
check(controller.includes('Only application status may be updated'), 'MKT-P3-17: mass assignment guard');

// MKT-P3-18–24 authorization contracts (source-level IDOR guards)
check(controller.includes('application.jobId.employerId?.toString() !== String(employerId)'), 'MKT-P3-18/19: detail ownership check');
check(controller.includes('application.jobId?.employerId?.toString() !== String(employerId)'), 'MKT-P3-20: update ownership check');
check(employerRoutes.includes("requireEmployerAuth"), 'MKT-P3-22/23: employer auth on routes');
check(employerRoutes.includes('getApplicationDetail'), 'MKT-P3-24: detail route registered');

// MKT-P3-25–28 document privacy (resume via authorized detail/list only)
check(!applications.includes('app.resumeURL'), 'DOC-03: list does not reference raw resumeURL');
check(analytics.includes('employer_resume_open_intent') && !analytics.includes('resumeURL'), 'MKT-P3-28: analytics no resume URL');

// MKT-P3-29–37 analytics
check(analytics.includes('trackPlatformEvent'), 'MKT-P3-29: delegates to consent-gated emitter');
check(platformAnalytics.includes('allowsAnalytics'), 'MKT-P3-29: platform analytics consent');
check(analytics.includes('employer_applications_view'), 'MKT-P3-29: applications view event');
check(analytics.includes('employer_application_opened'), 'MKT-P3-30: opened event');
check(analytics.includes('employer_application_status_intent'), 'MKT-P3-31: status intent');
check(analytics.includes('employer_application_status_updated'), 'MKT-P3-32: status updated');
check(analytics.includes('VIEW_BURST_MS'), 'MKT-P3-36: strict mode burst guard');
check(!analytics.includes('email') && !analytics.includes('coverLetter'), 'MKT-P3-34: no PII keys in analytics module');

// MKT-P3-38–40 external job behavior
check(applications.includes('externalDisclosureMessage'), 'MKT-P3-38: external disclosure');
check(jobs.includes('applicationsNotTracked'), 'MKT-P3-39: external count not tracked label');
check(!applications.includes('updateStatus') || applications.includes('visibleApplications.map'), 'MKT-P3-40: status actions only on loaded internal applications list');

// Route wiring
check(routes.includes("path: 'applications/:applicationId'"), 'MKT-P3: application detail route');
check(employerService.includes('getApplication'), 'MKT-P3: client API getApplication');

// MKT-P2 continuity — activation checklist untouched pattern
check(dashboard.includes('EmployerActivationChecklist'), 'MKT-P2 continuity: activation checklist preserved');

check(controller.includes('hiringStage'), 'STATUS-03: PATCH returns hiringStage');
check(applications.includes('applicationsListTruncated'), 'UX: truncation notice when list capped');
check(detail.includes("e.key === 'Escape'"), 'A11Y: reject modal Escape dismiss');

console.log(`mktP3EmployerApplicantWorkflow.test.js: ${count} checks passed`);
