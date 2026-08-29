/**
 * MKT-P4 — email queue failure semantics (FAIL-EMAIL-01..05).
 * Run: node src/__tests__/mktP4EmailQueueFailure.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Employer } from '../models/Employer.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { Application } from '../models/Application.js';
import { ApplicationMessage } from '../models/ApplicationMessage.js';
import { ApplicationInterviewInvitation } from '../models/ApplicationInterviewInvitation.js';
import { UserNotification } from '../models/UserNotification.js';
import { BackgroundJob } from '../models/BackgroundJob.js';
import { ApplicationMigrationService } from '../services/career/migration/ApplicationMigrationService.js';
import { provisionMktP4CommunicationIndexes } from '../services/platform/mktP4CommunicationIndexProvision.js';
import * as CommunicationService from '../services/applicationCommunicationService.js';

const TEST_DB = 'edurozgaar_mkt_p4_email_fail';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

async function seedFixtures() {
  const employer = await Employer.create({
    companyName: 'Email Fail Employer',
    email: `mktp4-emailfail-e-${Date.now()}@example.test`,
    password: await bcrypt.hash('pass', 12),
  });
  const candidate = await User.create({
    name: 'Email Fail Candidate',
    email: `mktp4-emailfail-c-${Date.now()}@example.test`,
    password: await bcrypt.hash('pass', 12),
  });
  const job = await Job.create({
    title: 'Email Fail Job',
    slug: `mktp4-emailfail-j-${Date.now()}`,
    company: 'Email Fail Employer',
    organization: 'Email Fail Employer',
    employerId: employer._id,
    source: 'employer',
    status: 'active',
    approvalStatus: 'approved',
    applyType: 'internal',
  });
  const application = await Application.create({
    userId: candidate._id,
    jobId: job._id,
    status: 'submitted',
  });
  await ApplicationMigrationService.dualWriteFromLegacyJobApplication(application.toObject(), job.toObject());
  return { employer, candidate, job, application };
}

function stubEmailQueueFailure(mode = 'throw') {
  const originalCreate = BackgroundJob.create.bind(BackgroundJob);
  BackgroundJob.create = async function patchedCreate(doc, ...rest) {
    if (doc?.type === 'email') {
      if (mode === 'throw') throw new Error('injected_email_queue_fail');
      return { _id: new mongoose.Types.ObjectId(), ...doc, enqueued: false };
    }
    return originalCreate(doc, ...rest);
  };
  return () => {
    BackgroundJob.create = originalCreate;
  };
}

async function main() {
  const uri = process.env.MONGO_URI || `mongodb://127.0.0.1:27017/${TEST_DB}`;
  await mongoose.connect(uri, { autoIndex: false });
  try {
    await mongoose.connection.db.dropDatabase();
    await provisionMktP4CommunicationIndexes();
    const { employer, candidate, application } = await seedFixtures();

    const restoreQueue = stubEmailQueueFailure('throw');
    const jobsBefore = await BackgroundJob.countDocuments({ type: 'email' });
    const r1 = await CommunicationService.sendEmployerMessage(employer._id, application._id, {
      body: 'Core message survives queue fail',
      clientMessageId: 'fail-email-01',
    });
    restoreQueue();

    check(!r1.duplicate, 'FAIL-EMAIL-01: message send succeeds');
    check(
      await ApplicationMessage.findOne({ applicationId: application._id, clientMessageId: 'fail-email-01' }),
      'FAIL-EMAIL-01: ApplicationMessage persisted'
    );
    check(r1.sideEffects?.emailQueued === false, 'FAIL-EMAIL-02: emailQueued false when queue fails');

    const analyticsPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../client/src/components/employer/applicant/applicationCommunicationAnalytics.js'
    );
    const analyticsSrc = readFileSync(analyticsPath, 'utf8');
    check(!analyticsSrc.includes('email_delivered'), 'FAIL-EMAIL-03: no email delivery analytics action');
    check(!analyticsSrc.includes('email_sent'), 'FAIL-EMAIL-03: no email_sent analytics action');

    const emailJobsAfter = await BackgroundJob.find({ type: 'email' }).lean();
    check(emailJobsAfter.length === jobsBefore, 'FAIL-EMAIL-05: no new email BackgroundJob when queue throws');
    check(
      emailJobsAfter.every((j) => j.status !== 'completed'),
      'FAIL-EMAIL-05: worker-stopped — no completed email jobs'
    );

    const notif = await UserNotification.findOne({ userId: candidate._id, type: 'application.message' }).lean();
    check(Boolean(notif), 'FAIL-EMAIL-01: in-app notification may still persist when thrown after notification step');

    const restoreInterview = stubEmailQueueFailure('throw');
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    future.setUTCMinutes(0, 0, 0);
    const invite = await CommunicationService.createInterviewInvitation(employer._id, application._id, {
      scheduledAt: future.toISOString(),
      timeZone: 'Asia/Karachi',
      method: 'video',
      meetingUrl: 'https://meet.example.test/fail-room',
    });
    restoreInterview();

    check(invite.invitation?.status === 'pending', 'FAIL-EMAIL-04: invitation pending after email throw');
    check(invite.message?.messageType === 'interview_invitation', 'FAIL-EMAIL-04: system message persisted');
    const invRow = await ApplicationInterviewInvitation.findById(invite.invitation._id).lean();
    check(invRow?.status === 'pending', 'FAIL-EMAIL-04: invitation row persisted');
    check(invite.emailQueued === false, 'FAIL-EMAIL-04: interview emailQueued false on queue failure');

    console.log(`mktP4EmailQueueFailure.test.js: ${count} checks passed on ${mongoose.connection.db.databaseName}`);
  } finally {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
