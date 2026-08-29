/**
 * MKT-P6 — Mongo E2E: reconsideration, history, hiringStage sync, offer preservation.
 * Run:
 *   set MKT_P6_INTEGRATION_TEST=1
 *   node server/src/__tests__/mktP6ApplicationReconsideration.mongo.test.js
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { resolveMongoTarget } from '../utils/mongoTargetGuard.js';
import { Employer } from '../models/Employer.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { Application } from '../models/Application.js';
import { ApplicationOffer } from '../models/ApplicationOffer.js';
import { OpportunityApplication } from '../models/career/OpportunityApplication.js';
import { AuditLog } from '../models/AuditLog.js';
import { UserNotification } from '../models/UserNotification.js';
import { BackgroundJob } from '../models/BackgroundJob.js';
import { updateApplicationStatus } from '../controllers/employerController.js';
import { ApplicationMigrationService } from '../services/career/migration/ApplicationMigrationService.js';
import { mapLegacyApplicationStatus } from '../../../shared/career/migrationMap.js';
import { provisionMktP4CommunicationIndexes } from '../services/platform/mktP4CommunicationIndexProvision.js';
import { provisionMktP5OfferIndexes } from '../services/platform/mktP5OfferIndexProvision.js';
import * as OfferService from '../services/applicationOfferService.js';

const TEST_DB = 'edurozgaar_mkt_p6_reconsideration';

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

function employerReq(employerId, params = {}, body = {}) {
  return {
    employer: { employerId: String(employerId) },
    params,
    body,
    query: {},
    headers: {},
    socket: {},
  };
}

async function invoke(handler, req) {
  const res = mockRes();
  await handler(req, res, (err) => {
    if (err) throw err;
  });
  return res;
}

async function patchStatus(employerId, applicationId, status, extra = {}) {
  return invoke(
    updateApplicationStatus,
    employerReq(employerId, { id: String(applicationId) }, { status, ...extra })
  );
}

async function assertStage(applicationId, expectedLegacyStatus, label) {
  const app = await Application.findById(applicationId).lean();
  const oa = await OpportunityApplication.findOne({ legacyApplicationId: applicationId }).lean();
  assert.equal(app.status, expectedLegacyStatus, `${label}: Application.status`);
  assert.equal(
    oa.pipelineStage,
    mapLegacyApplicationStatus(expectedLegacyStatus),
    `${label}: OpportunityApplication.pipelineStage`
  );
}

async function main() {
  if (process.env.MKT_P6_INTEGRATION_TEST !== '1') {
    console.log('mktP6ApplicationReconsideration.mongo: skipped (set MKT_P6_INTEGRATION_TEST=1)');
    return;
  }

  const uri = process.env.MONGO_URI || `mongodb://127.0.0.1:27017/${TEST_DB}`;
  const target = resolveMongoTarget(uri);
  if (!target.isLocalDevelopmentTarget) {
    console.error('mktP6ApplicationReconsideration.mongo: refused — non-local Mongo target');
    process.exit(1);
  }

  let count = 0;
  const check = (cond, msg) => {
    assert.ok(cond, msg);
    count += 1;
  };

  await mongoose.connect(uri);
  try {
    await mongoose.connection.db.dropDatabase();
    await provisionMktP4CommunicationIndexes();
    await provisionMktP5OfferIndexes();

    const [employerA, employerB] = await Employer.create([
      {
        companyName: 'Employer A P6',
        email: `mktp6-a-${Date.now()}@example.test`,
        password: await bcrypt.hash('test-pass', 12),
      },
      {
        companyName: 'Employer B P6',
        email: `mktp6-b-${Date.now()}@example.test`,
        password: await bcrypt.hash('test-pass', 12),
      },
    ]);

    const [jobA, jobB] = await Job.create([
      {
        title: 'P6 Internal Role',
        slug: `mktp6-a-${Date.now()}`,
        company: employerA.companyName,
        organization: employerA.companyName,
        employerId: employerA._id,
        source: 'employer',
        status: 'active',
        approvalStatus: 'approved',
        applyType: 'internal',
      },
      {
        title: 'P6 Role B',
        slug: `mktp6-b-${Date.now()}`,
        company: employerB.companyName,
        organization: employerB.companyName,
        employerId: employerB._id,
        source: 'employer',
        status: 'active',
        approvalStatus: 'approved',
        applyType: 'internal',
      },
    ]);

    const applicant = await User.create({
      name: 'Applicant P6',
      email: `mktp6-applicant-${Date.now()}@example.test`,
      password: await bcrypt.hash('user-pass', 12),
    });

    const applicant2 = await User.create({
      name: 'Applicant P6 B',
      email: `mktp6-applicant2-${Date.now()}@example.test`,
      password: await bcrypt.hash('user-pass', 12),
    });
    const applicant3 = await User.create({
      name: 'Applicant P6 C',
      email: `mktp6-applicant3-${Date.now()}@example.test`,
      password: await bcrypt.hash('user-pass', 12),
    });

    const application = await Application.create({
      userId: applicant._id,
      jobId: jobA._id,
      status: 'submitted',
      coverLetter: 'P6 fixture cover letter.',
      resumeSource: 'none',
    });

    await ApplicationMigrationService.dualWriteFromLegacyJobApplication(
      application.toObject(),
      jobA.toObject()
    );

    // Flow: Applied → Screening → Not selected → Reconsider → Screening → Interview
    let res = await patchStatus(employerA._id, application._id, 'shortlisted');
    check(res.statusCode === 200, 'P6-E03: screening transition succeeds');
    await assertStage(application._id, 'shortlisted', 'after screening');

    res = await patchStatus(employerA._id, application._id, 'rejected');
    check(res.statusCode === 200, 'P6-E01: not selected succeeds');
    await assertStage(application._id, 'rejected', 'after not selected');

    const historyAfterReject = await OpportunityApplication.findOne({
      legacyApplicationId: application._id,
    }).lean();
    check(historyAfterReject.stageHistory.length >= 2, 'P6-E05: history entries after reject');

    res = await patchStatus(employerA._id, application._id, 'shortlisted');
    check(res.statusCode === 200 && res.body?.reconsidered === true, 'P6-E02: reconsider succeeds');
    await assertStage(application._id, 'shortlisted', 'after reconsider');

    const historyAfterReconsider = await OpportunityApplication.findOne({
      legacyApplicationId: application._id,
    }).lean();
    check(
      historyAfterReconsider.stageHistory.some((h) => h.toStage === 'rejected'),
      'P6-E05: prior rejected stage remains in history'
    );

    const reconsiderEntry = historyAfterReconsider.stageHistory.find(
      (h) => h.reason === 'employer_reconsideration'
    );
    check(Boolean(reconsiderEntry), 'P6-E05: reconsideration history reason recorded');

    res = await patchStatus(employerA._id, application._id, 'interview');
    check(res.statusCode === 200, 'P6-E04: screening → interview succeeds');
    await assertStage(application._id, 'interview', 'after interview');

    const auditReconsider = await AuditLog.findOne({
      action: 'application.reconsidered',
      targetId: String(application._id),
    }).lean();
    check(auditReconsider?.metadata?.fromStatus === 'rejected', 'P6: audit records reconsideration');

    const cross = await patchStatus(employerB._id, application._id, 'shortlisted');
    check(cross.statusCode === 404, 'P6-SEC02: employer B cannot reopen employer A application');
    await assertStage(application._id, 'interview', 'after cross-employer denied');

    // Same-status idempotency
    const noop = await patchStatus(employerA._id, application._id, 'interview');
    check(noop.statusCode === 200 && noop.body?.unchanged === true, 'P6: duplicate transition no-op');
    const historyLenBefore = (await OpportunityApplication.findOne({
      legacyApplicationId: application._id,
    }).lean()).stageHistory.length;
    const noop2 = await patchStatus(employerA._id, application._id, 'interview');
    check(noop2.body?.unchanged === true, 'P6: repeated same status no duplicate write');
    const historyLenAfter = (await OpportunityApplication.findOne({
      legacyApplicationId: application._id,
    }).lean()).stageHistory.length;
    check(historyLenBefore === historyLenAfter, 'P6: no duplicate history on no-op');

    // Mass assignment
    const mass = await invoke(
      updateApplicationStatus,
      employerReq(employerA._id, { id: String(application._id) }, {
        status: 'shortlisted',
        hiringStage: 'offer',
        offerStatus: 'accepted',
      })
    );
    check(mass.statusCode === 400, 'P6-SEC05: hiringStage override rejected');

    // rejected → interview without special server flag
    const appRejInterview = await Application.create({
      userId: applicant2._id,
      jobId: jobA._id,
      status: 'submitted',
      resumeSource: 'none',
    });
    await ApplicationMigrationService.dualWriteFromLegacyJobApplication(
      appRejInterview.toObject(),
      jobA.toObject()
    );
    await patchStatus(employerA._id, appRejInterview._id, 'rejected');
    const rejToInterview = await patchStatus(employerA._id, appRejInterview._id, 'interview');
    check(rejToInterview.statusCode === 200 && rejToInterview.body?.reconsidered === true, 'P6: rejected → interview succeeds');
    await assertStage(appRejInterview._id, 'interview', 'rejected → interview');

    // Hired reopen server protection
    const hiredApp = await Application.create({
      userId: applicant3._id,
      jobId: jobA._id,
      status: 'hired',
      resumeSource: 'none',
    });
    await ApplicationMigrationService.dualWriteFromLegacyJobApplication(
      hiredApp.toObject(),
      jobA.toObject()
    );
    await OpportunityApplication.updateOne(
      { legacyApplicationId: hiredApp._id },
      { $set: { pipelineStage: 'accepted' } }
    );

    const blockedShort = await patchStatus(employerA._id, hiredApp._id, 'shortlisted');
    check(blockedShort.statusCode === 400, 'P6-H01: hired → shortlisted without intent rejected');
    check(blockedShort.body?.code === 'HIRING_REOPEN_REQUIRED', 'P6-H01: reopen required code');

    const blockedInterview = await patchStatus(employerA._id, hiredApp._id, 'interview');
    check(blockedInterview.statusCode === 400, 'P6-H02: hired → interview without intent rejected');

    const reopenShort = await patchStatus(employerA._id, hiredApp._id, 'shortlisted', {
      confirmReopen: true,
    });
    check(reopenShort.statusCode === 200 && reopenShort.body?.reopened === true, 'P6-H03: explicit reopen → shortlisted');
    await assertStage(hiredApp._id, 'shortlisted', 'after hired reopen shortlisted');

    await Application.findByIdAndUpdate(hiredApp._id, { status: 'hired' });
    await OpportunityApplication.updateOne(
      { legacyApplicationId: hiredApp._id },
      { $set: { pipelineStage: 'accepted' } }
    );
    const reopenInterview = await patchStatus(employerA._id, hiredApp._id, 'interview', {
      confirmReopen: true,
    });
    check(reopenInterview.statusCode === 200, 'P6-H04: explicit reopen → interview');

    const hiredHistory = await OpportunityApplication.findOne({
      legacyApplicationId: hiredApp._id,
    }).lean();
    check(
      hiredHistory.stageHistory.some((h) => h.reason === 'employer_reopen'),
      'P6-H05: employer_reopen history event'
    );
    check(
      hiredHistory.stageHistory.some((h) => h.metadata?.legacyFromStatus === 'hired'),
      'P6-H05: prior hired state preserved in history metadata'
    );
    check(
      hiredHistory.pipelineStage === mapLegacyApplicationStatus('interview'),
      'P6-H06: hiringStage synchronized after reopen'
    );

    const crossHired = await patchStatus(employerB._id, hiredApp._id, 'shortlisted', {
      confirmReopen: true,
    });
    check(crossHired.statusCode === 404, 'P6-H07: employer B cannot reopen employer A hired app');

    const studentReopen = await invoke(updateApplicationStatus, {
      user: { userId: String(applicant3._id), role: 'User' },
      params: { id: String(hiredApp._id) },
      body: { status: 'shortlisted', confirmReopen: true },
      headers: {},
      socket: {},
    });
    check(studentReopen.statusCode === 404, 'P6-H08: candidate cannot reopen hired application');

    const massReopen = await invoke(
      updateApplicationStatus,
      employerReq(employerA._id, { id: String(hiredApp._id) }, {
        status: 'shortlisted',
        confirmReopen: true,
        offerStatus: 'accepted',
      })
    );
    check(massReopen.statusCode === 400, 'P6-H09: malicious fields with reopen rejected');

    const hiredNoopApp = await Application.create({
      userId: applicant2._id,
      jobId: jobB._id,
      status: 'hired',
      resumeSource: 'none',
    });
    await ApplicationMigrationService.dualWriteFromLegacyJobApplication(
      hiredNoopApp.toObject(),
      jobB.toObject()
    );
    const hiredNoop = await patchStatus(employerB._id, hiredNoopApp._id, 'hired');
    check(hiredNoop.statusCode === 200 && hiredNoop.body?.unchanged === true, 'P6-H10: hired → hired no-op');

    // Offer reconsideration E2E
    const offerApp = await Application.create({
      userId: applicant._id,
      jobId: jobB._id,
      status: 'interview',
      resumeSource: 'none',
    });
    await ApplicationMigrationService.dualWriteFromLegacyJobApplication(
      offerApp.toObject(),
      jobB.toObject()
    );

    const sent = await OfferService.sendApplicationOffer(
      employerB._id,
      offerApp._id,
      { compensationText: 'P6 test offer', message: 'Join us', clientCommandId: 'p6-offer-1' },
      { ip: '127.0.0.1' }
    );
    check(sent.offer?.status === 'sent', 'P6 offer: sent');

    const oaOffer = await OpportunityApplication.findOne({ legacyApplicationId: offerApp._id }).lean();
    const declined = await OfferService.respondToApplicationOffer(
      applicant._id,
      oaOffer._id,
      sent.offer._id,
      { response: 'declined' },
      { ip: '127.0.0.1' }
    );
    check(declined.offer?.status === 'declined', 'P6 offer: declined by candidate');

    await patchStatus(employerB._id, offerApp._id, 'rejected');
    const reconsiderOffer = await patchStatus(employerB._id, offerApp._id, 'shortlisted');
    check(reconsiderOffer.statusCode === 200, 'P6 offer: reconsider after decline + reject');

    const oldOffer = await ApplicationOffer.findById(sent.offer._id).lean();
    check(oldOffer.status === 'declined', 'P6-E10: old offer remains declined');

    const activeOffers = await ApplicationOffer.countDocuments({
      applicationId: offerApp._id,
      status: 'sent',
    });
    check(activeOffers === 0, 'P6 offer: no new offer auto-created');

    const notif = await UserNotification.findOne({
      userId: applicant._id,
      type: 'application.reconsidered',
    }).lean();
    check(Boolean(notif), 'P6: candidate reconsideration notification persisted');

    const emailJobs = await BackgroundJob.countDocuments({ type: 'email' });
    if (emailJobs > 0) {
      check(true, 'P6: email jobs may be queued (worker stopped)');
    }

    console.log(`mktP6ApplicationReconsideration.mongo.test.js: ${count} checks passed`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
