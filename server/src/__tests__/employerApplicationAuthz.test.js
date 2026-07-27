/**
 * Application flow ownership / authorization contracts (E.1F-D).
 * Pure logic mirroring employerController ownership checks.
 * Run: node src/__tests__/employerApplicationAuthz.test.js
 */
import assert from 'assert';

function canEmployerAccessJob(job, employerId) {
  if (!job) return false;
  return String(job.employerId) === String(employerId);
}

function canEmployerUpdateApplication(application, employerId) {
  if (!application?.jobId) return false;
  const jobEmployerId = application.jobId.employerId ?? application.jobId;
  return String(jobEmployerId) === String(employerId);
}

function shouldIncrementCountOnApply({ applyType, createSucceeded, wasDuplicate }) {
  if (applyType === 'external') return false;
  if (wasDuplicate || !createSucceeded) return false;
  return true;
}

function displayCount({ applyType, liveCount }) {
  if (applyType === 'external') return null; // Not tracked
  return liveCount;
}

const employerA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const employerB = 'bbbbbbbbbbbbbbbbbbbbbbbb';

assert.strictEqual(canEmployerAccessJob({ employerId: employerA }, employerA), true);
assert.strictEqual(canEmployerAccessJob({ employerId: employerA }, employerB), false);
assert.strictEqual(
  canEmployerUpdateApplication({ jobId: { employerId: employerA } }, employerB),
  false
);
assert.strictEqual(
  canEmployerUpdateApplication({ jobId: { employerId: employerA } }, employerA),
  true
);

assert.strictEqual(
  shouldIncrementCountOnApply({ applyType: 'external', createSucceeded: true, wasDuplicate: false }),
  false
);
assert.strictEqual(
  shouldIncrementCountOnApply({ applyType: 'internal', createSucceeded: true, wasDuplicate: false }),
  true
);
assert.strictEqual(
  shouldIncrementCountOnApply({ applyType: 'internal', createSucceeded: false, wasDuplicate: true }),
  false
);

assert.strictEqual(displayCount({ applyType: 'external', liveCount: 0 }), null);
assert.strictEqual(displayCount({ applyType: 'internal', liveCount: 1 }), 1);

console.log('employerApplicationAuthz.test.js: all assertions passed');
