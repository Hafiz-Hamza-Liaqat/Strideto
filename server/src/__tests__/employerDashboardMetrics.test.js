/**
 * Employer dashboard metric contracts (E.1F-E).
 * PF-EDM-B1 added draftJobsFilter — a rejected Job keeps status:'draft'
 * (rejection only changes approvalStatus), so it must not count as an
 * ordinary draft.
 * Run: node server/src/__tests__/employerDashboardMetrics.test.js
 */
import assert from 'assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computeConversionRate, draftJobsFilter } from '../services/employerDashboardMetrics.js';
import { resolveJobApplyType } from '../services/employerApplicationCounts.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

assert.strictEqual(computeConversionRate(2, 100), 2);
assert.strictEqual(computeConversionRate(0, 0), null);
assert.strictEqual(computeConversionRate(1, 0), null);
assert.strictEqual(computeConversionRate(1, 3), 33.33);
count += 4;

assert.strictEqual(resolveJobApplyType({ applyType: 'external' }), 'external');
assert.strictEqual(resolveJobApplyType({ applicationLink: 'https://x.com' }), 'external');
assert.strictEqual(resolveJobApplyType({}), 'internal');
count += 3;

// --- draftJobsFilter: real boolean evaluation against representative Job-shaped objects, not just shape-matching ---
// (No live Mongo in this audit's scope — this small matcher faithfully
// replicates the exact operators draftJobsFilter uses: equality + $ne.)
function matchesFilter(filter, job) {
  if (String(job.employerId) !== String(filter.employerId)) return false;
  if (job.status !== filter.status) return false;
  if (filter.approvalStatus && typeof filter.approvalStatus === 'object' && '$ne' in filter.approvalStatus) {
    if (job.approvalStatus === filter.approvalStatus.$ne) return false;
  }
  return true;
}

const employerA = 'employer-a';
const employerB = 'employer-b';
const filterA = draftJobsFilter({ employerId: employerA });

check(
  matchesFilter(filterA, { employerId: employerA, status: 'draft', approvalStatus: 'pending' }) === true,
  '1. A genuine Employer-owned draft (draft + pending, never reviewed) is counted'
);
check(
  matchesFilter(filterA, { employerId: employerA, status: 'draft', approvalStatus: 'rejected' }) === false,
  '2. A rejected Job (draft + rejected) is excluded — the confirmed defect this phase fixes'
);
check(
  matchesFilter(filterA, { employerId: employerB, status: 'draft', approvalStatus: 'pending' }) === false,
  '4. Another Employer\'s draft Job never matches Employer A\'s filter (ownership preserved)'
);
check(
  matchesFilter(filterA, { employerId: employerA, status: 'active', approvalStatus: 'approved' }) === false,
  'An active/approved Job never matches the draft filter regardless of approvalStatus'
);
check(
  JSON.stringify(draftJobsFilter({ employerId: employerA })) === JSON.stringify({ employerId: employerA, status: 'draft', approvalStatus: { $ne: 'rejected' } }),
  'draftJobsFilter produces exactly {employerFilter, status:"draft", approvalStatus:{$ne:"rejected"}} — smallest possible query correction'
);

// --- 3/5/6/7/8/9/10/11/12. Everything else in the aggregation is untouched (source-level regression check) ---
{
  const here = path.dirname(fileURLToPath(import.meta.url));
  const serverSrc = path.resolve(here, '..');
  const svc = readFileSync(path.join(serverSrc, 'services/employerDashboardMetrics.js'), 'utf8');

  check(
    /Job\.countDocuments\(employerFilter\),/.test(svc),
    '3. Total Jobs query unchanged (no status/approval filter, counts every Job)'
  );
  check(
    /Job\.countDocuments\(\{ \.\.\.employerFilter, approvalStatus: 'pending' \}\),/.test(svc),
    '5. Pending Approval query unchanged (still approvalStatus only, no status filter added)'
  );
  check(
    /Job\.countDocuments\(\{ \.\.\.employerFilter, status: 'active', approvalStatus: 'approved' \}\),/.test(svc),
    '6. Active Jobs query unchanged'
  );
  check(
    /Job\.countDocuments\(\{ \.\.\.employerFilter, status: 'closed' \}\),/.test(svc),
    '7. Closed Jobs query unchanged'
  );
  check(
    /const totalViews = jobRows\.reduce\(\(s, j\) => s \+ \(j\.views \|\| 0\), 0\);/.test(svc),
    '8. Total Views computation unchanged'
  );
  check(
    /Application\.countDocuments\(\{ jobId: \{ \$in: internalJobIds \} \}\),/.test(svc)
      && /Application\.aggregate\(\[/.test(svc),
    '9. Application counters (Total/status buckets) unchanged'
  );
  check(
    /return \{\s*totalJobs,\s*activeJobs,\s*draftJobs,\s*pendingApprovalJobs,\s*closedJobs,/.test(svc),
    '10. Response field names unchanged (draftJobs still the property name)'
  );
  check(
    !/Job\.updateOne|Job\.updateMany|\.save\(\)/.test(svc),
    '11. No Job document is mutated by this module (read-only aggregation)'
  );
}

console.log(`employerDashboardMetrics.test.js: ${count} assertions passed`);
