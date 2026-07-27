/**
 * Disposable MongoDB employer application journey (E.1F-E).
 * Run only on local Mongo:
 *   set EMPLOYER_INTEGRATION_TEST=1
 *   node server/src/__tests__/employerPortalIntegration.test.js
 */
import assert from 'assert';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { resolveMongoTarget } from '../utils/mongoTargetGuard.js';
import { Employer } from '../models/Employer.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { Application } from '../models/Application.js';
import { computeEmployerDashboardMetrics } from '../services/employerDashboardMetrics.js';
import { enrichEmployerJobsWithApplicationCounts } from '../services/employerApplicationCounts.js';
import { syncOpportunityApplicationFromLegacyStatus } from '../services/employerOpportunityApplicationSync.js';

import { buildEmployerProfileUpdates } from '../utils/employerProfileValidation.js';

const TEST_DB = 'edurozgaar_employer_e1fe_integration';

async function main() {
  if (process.env.EMPLOYER_INTEGRATION_TEST !== '1') {
    console.log('employerPortalIntegration: skipped (set EMPLOYER_INTEGRATION_TEST=1 to run)');
    return;
  }

  const uri = process.env.MONGO_URI || `mongodb://127.0.0.1:27017/${TEST_DB}`;
  const target = resolveMongoTarget(uri);
  if (!target.isLocalDevelopmentTarget) {
    console.error('employerPortalIntegration: refused — non-local Mongo target');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const dbName = mongoose.connection.db.databaseName;
  try {
    await mongoose.connection.db.dropDatabase();

    const employer = await Employer.create({
      companyName: 'E1FE Test Co',
      email: `e1fe-${Date.now()}@example.test`,
      password: await bcrypt.hash('test-pass-only', 12),
      verified: false,
    });
    const employerId = employer._id.toString();

    const profilePatch = buildEmployerProfileUpdates({
      companyName: 'E1FE Test Co Updated',
      website: 'https://strideto.com',
      phone: '+920000000000',
    });
    assert.strictEqual(profilePatch.ok, true);
    await Employer.findByIdAndUpdate(employer._id, { $set: profilePatch.updates });

    const internalJob = await Job.create({
      title: 'Internal QA Role',
      slug: `internal-qa-${Date.now()}`,
      company: employer.companyName,
      organization: employer.companyName,
      employerId: employer._id,
      source: 'employer',
      status: 'active',
      approvalStatus: 'approved',
      applyType: 'internal',
    });

    const externalJob = await Job.create({
      title: 'External QA Role',
      slug: `external-qa-${Date.now()}`,
      company: employer.companyName,
      organization: employer.companyName,
      employerId: employer._id,
      source: 'employer',
      status: 'active',
      approvalStatus: 'approved',
      applyType: 'external',
      applicationLink: 'https://example.test/apply',
    });

    const user = await User.create({
      name: 'Applicant One',
      email: `applicant-${Date.now()}@example.test`,
      password: await bcrypt.hash('user-pass', 12),
    });

    const application = await Application.create({
      userId: user._id,
      jobId: internalJob._id,
      status: 'submitted',
    });

    await syncOpportunityApplicationFromLegacyStatus(application, {
      employerId,
      previousStatus: 'submitted',
      newStatus: 'shortlisted',
    });

    application.status = 'shortlisted';
    await application.save();

    let duplicateRejected = false;
    try {
      await Application.create({ userId: user._id, jobId: internalJob._id, status: 'submitted' });
    } catch (e) {
      duplicateRejected = e?.code === 11000;
    }
    assert.ok(duplicateRejected, 'duplicate application should be rejected');

    const metrics = await computeEmployerDashboardMetrics(employerId);
    assert.strictEqual(metrics.totalInternalApplications, 1);

    const [enrichedInternal] = await enrichEmployerJobsWithApplicationCounts([internalJob.toObject()]);
    const [enrichedExternal] = await enrichEmployerJobsWithApplicationCounts([externalJob.toObject()]);
    assert.strictEqual(enrichedInternal.submittedApplicationsCount, 1);
    assert.strictEqual(enrichedExternal.applicationsTracked, false);
    assert.strictEqual(enrichedExternal.submittedApplicationsCount, null);

    const otherEmployer = await Employer.create({
      companyName: 'Other Co',
      email: `other-${Date.now()}@example.test`,
      password: await bcrypt.hash('x', 12),
    });
    const foreignApp = await Application.findById(application._id).populate('jobId');
    assert.notStrictEqual(String(foreignApp.jobId.employerId), String(otherEmployer._id));

    internalJob.status = 'closed';
    await internalJob.save();
    assert.strictEqual((await Job.findById(internalJob._id)).status, 'closed');
    internalJob.status = 'draft';
    await internalJob.save();
    assert.strictEqual((await Job.findById(internalJob._id)).status, 'draft');

    const metricsAfter = await computeEmployerDashboardMetrics(employerId);
    assert.strictEqual(metricsAfter.totalInternalApplications, 1);

    console.log(`employerPortalIntegration: passed on ${dbName}`);
  } finally {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
