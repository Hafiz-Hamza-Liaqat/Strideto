/**
 * PF-TRACK-B2 — Hiring Intelligence / Dashboard composition must scope
 * Employer-facing Application aggregation to canonically-internal Jobs only,
 * not merely rely on the apply endpoint's historical invariant.
 *
 * No test-Mongo/mocking harness exists in this repo for these two
 * DB-backed composition services (confirmed in the committed role-tracking
 * audit), so this test proves two things independently, matching this
 * repo's existing conventions:
 *  (a) the exact filter logic now shipped in both files, reimplemented
 *      locally against the real, imported `resolveJobApplyType` (same
 *      pattern as employerApplicationCountsEnrich.test.js);
 *  (b) that both files actually call that filter before querying
 *      Application, via direct source-text assertions (same pattern as
 *      employerDashboardFreshness.test.js).
 *
 * Run: node src/__tests__/employerIntelligenceApplicationScope.test.js
 */
import assert from 'assert';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const { resolveJobApplyType } = await import(
  pathToFileURL(path.resolve(__dirname, '../services/employerApplicationCounts.js')).href
);

// Mirrors the exact expression now used in both edited files:
//   jobs.filter((j) => resolveJobApplyType(j) === 'internal').map((j) => j._id)
function internalJobIdsOf(jobs) {
  return jobs.filter((j) => resolveJobApplyType(j) === 'internal').map((j) => j._id);
}

// Mirrors: internalJobIds.length ? Application.find({ jobId: { $in: internalJobIds } }) : []
function scopedApplications(jobs, applications) {
  const internalIds = new Set(internalJobIdsOf(jobs).map(String));
  if (!internalIds.size) return [];
  return applications.filter((a) => internalIds.has(String(a.jobId)));
}

// ---- Fixtures: two Employers, mixed internal/external Jobs, one orphaned Application ----
const employerX = 'employerX';
const employerY = 'employerY';

const jobsForEmployerX = [
  { _id: 'jobX-internal', employerId: employerX, applyType: 'internal' },
  { _id: 'jobX-external-applyType', employerId: employerX, applyType: 'external' },
  { _id: 'jobX-external-link', employerId: employerX, applicationLink: 'https://apply.example.com' }, // applyType unset — resolved via canonical helper, not a duplicate ad hoc rule
];
const jobsForEmployerY = [{ _id: 'jobY-internal', employerId: employerY, applyType: 'internal' }];

const allApplications = [
  { _id: 'app1', jobId: 'jobX-internal', status: 'submitted' },
  { _id: 'app2', jobId: 'jobX-external-applyType', status: 'submitted' }, // stray legacy record on an external Job
  { _id: 'app3', jobId: 'jobX-external-link', status: 'shortlisted' }, // stray legacy record on the applicationLink-inferred external Job
  { _id: 'app4', jobId: 'jobY-internal', status: 'submitted' }, // belongs to a different Employer entirely
  { _id: 'app5', jobId: 'job-deleted', status: 'submitted' }, // orphaned — no matching Job in either Employer's set
];

// --- 1/8. Authenticated Employer's internal Job Application is counted, via the canonical resolver ---
{
  const scoped = scopedApplications(jobsForEmployerX, allApplications);
  check(
    scoped.some((a) => a._id === 'app1'),
    "1/8. Employer X's internal Job (jobX-internal) Application is included, derived through resolveJobApplyType"
  );
}

// --- 2/9. External Job's stray Application is excluded, for both applyType and applicationLink-inferred external Jobs ---
{
  const scoped = scopedApplications(jobsForEmployerX, allApplications);
  check(
    !scoped.some((a) => a._id === 'app2'),
    '2. External Job (explicit applyType) stray Application is excluded even though it exists in the Application collection'
  );
  check(
    !scoped.some((a) => a._id === 'app3'),
    '9. External Job inferred only via applicationLink (no separate ad hoc applyType-only rule) is also excluded — proves the canonical resolveJobApplyType contract is used, not a narrower duplicate check'
  );
}

// --- 3/17. Another Employer's internal Job Application is excluded (cross-Employer isolation) ---
{
  const scoped = scopedApplications(jobsForEmployerX, allApplications);
  check(
    !scoped.some((a) => a._id === 'app4'),
    "3/17. Employer Y's internal Job Application never enters Employer X's scoped result, because Employer X's Job set (already scoped by employerId upstream) never contains jobY-internal"
  );
}

// --- 5. Employer with only external Jobs returns zero ---
{
  const onlyExternal = [{ _id: 'jobX-ext-only', employerId: employerX, applyType: 'external' }];
  const scoped = scopedApplications(onlyExternal, [{ _id: 'appZ', jobId: 'jobX-ext-only', status: 'submitted' }]);
  check(scoped.length === 0, '5. Employer with only external Jobs yields zero qualifying Applications');
}

// --- 6. Employer with no Jobs returns safe empty result without needing an $in query ---
{
  const noJobs = [];
  const internalIds = internalJobIdsOf(noJobs);
  check(internalIds.length === 0, '6. No Jobs -> empty internal-id set');
  const scoped = scopedApplications(noJobs, allApplications);
  check(scoped.length === 0, '6. No Jobs -> safe empty aggregation, matching the source `internalJobIds.length ? Application.find(...) : []` short-circuit');
}

// --- 7. Mixed internal/external Jobs count only the internal Application ---
{
  const scoped = scopedApplications(jobsForEmployerX, allApplications);
  check(
    scoped.length === 1 && scoped[0]._id === 'app1',
    '7. Employer X (mixed internal + 2 external Jobs) yields exactly the one internal-Job Application'
  );
}

// --- 10. Orphaned Application (no matching Job at all) never enters the result ---
{
  const scoped = scopedApplications(jobsForEmployerX, allApplications);
  check(!scoped.some((a) => a._id === 'app5'), '10. Application referencing a missing/orphaned Job is excluded');
}

// ---- Source-wiring checks: prove both files actually call this logic before querying Application ----
function read(relPath) {
  return readFileSync(path.resolve(__dirname, relPath), 'utf8');
}

const intelligenceSvc = read('../services/career/EmployerIntelligenceService.js');
const dashboardCompositionSvc = read('../services/career/EmployerDashboardCompositionService.js');

// --- 4/20. The scope fix itself reads no OpportunityApplication and performs no write/mutation ---
{
  const loadCardsFn = intelligenceSvc.slice(
    intelligenceSvc.indexOf('async function loadCardsForEmployer'),
    intelligenceSvc.indexOf('function eventForPipelineStage')
  );
  check(
    !/OpportunityApplication/.test(loadCardsFn),
    '4. loadCardsForEmployer (the function this fix changed) does not reference OpportunityApplication anywhere in its body — private tracker stays out of this aggregation'
  );
  check(
    !/\.save\(\)|\.updateOne\(|\.updateMany\(|\.deleteOne\(|\.create\(/.test(loadCardsFn),
    '20. loadCardsForEmployer performs no write/mutation of any kind — read-only aggregation'
  );
}

// --- 8/15. Internal Job IDs are derived via the canonical resolver import, in both files ---
{
  check(
    /import \{ resolveJobApplyType \} from '\.\.\/employerApplicationCounts\.js';/.test(intelligenceSvc),
    '8. EmployerIntelligenceService.js imports the canonical resolveJobApplyType helper (no independent applyType-only rule introduced)'
  );
  check(
    /const internalJobIds = jobs\.filter\(\(j\) => resolveJobApplyType\(j\) === 'internal'\)\.map\(\(j\) => j\._id\);/.test(intelligenceSvc),
    '8. loadCardsForEmployer derives internalJobIds via the canonical resolver'
  );
  check(
    /Application\.find\(\{ jobId: \{ \$in: internalJobIds \} \}\)/.test(intelligenceSvc),
    '15. Application query is scoped to internalJobIds (response contract/query shape otherwise unchanged: still Application.find({ jobId: { $in: ... } }))'
  );

  check(
    /import \{ resolveJobApplyType \} from '\.\.\/employerApplicationCounts\.js';/.test(dashboardCompositionSvc),
    '8. EmployerDashboardCompositionService.js imports the canonical resolveJobApplyType helper'
  );
  check(
    /const internalJobIds = jobs\.filter\(\(j\) => resolveJobApplyType\(j\) === 'internal'\)\.map\(\(j\) => j\._id\);/.test(dashboardCompositionSvc),
    '8. loadSharedContext derives internalJobIds via the canonical resolver'
  );
  check(
    /internalJobIds\.length\s*\?\s*await Application\.find\(\{ jobId: \{ \$in: internalJobIds \} \}\)/.test(dashboardCompositionSvc),
    '6/15. loadSharedContext short-circuits to an empty array when no internal Job exists, instead of querying Application with an empty/unbounded $in'
  );
}

// --- 14. Open-position counts remain untouched (they read the stored Job.applicationsCount, not the Application aggregate) ---
{
  check(
    /applicationsCount: j\.applicationsCount \|\| 0,/.test(dashboardCompositionSvc),
    "14. openPositionsProvider still reads the stored per-Job applicationsCount field directly — it was never derived from ctx.applications, so it needed no change and none was made"
  );
}

// --- 16. Employer identity is still only ever a function parameter, never read from req.body/query/header in either file ---
{
  check(
    !/req\.body\.employerId|req\.query\.employerId|req\.headers\[.?employerId/i.test(intelligenceSvc)
      && !/req\.body\.employerId|req\.query\.employerId|req\.headers\[.?employerId/i.test(dashboardCompositionSvc),
    '16. Neither file accepts a client-supplied employerId — ownership remains a function parameter sourced from the authenticated controller layer'
  );
}

console.log(`employerIntelligenceApplicationScope.test.js: ${count} assertions passed`);
