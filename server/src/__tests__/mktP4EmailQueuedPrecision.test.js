/**
 * MKT-P4 — interview emailQueued response-truth precision.
 * Run: node src/__tests__/mktP4EmailQueuedPrecision.test.js
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
import { ApplicationInterviewInvitation } from '../models/ApplicationInterviewInvitation.js';
import { BackgroundJob } from '../models/BackgroundJob.js';
import { ApplicationMigrationService } from '../services/career/migration/ApplicationMigrationService.js';
import { provisionMktP4CommunicationIndexes } from '../services/platform/mktP4CommunicationIndexProvision.js';
import * as CommunicationService from '../services/applicationCommunicationService.js';

const TEST_DB = 'edurozgaar_mkt_p4_email_precision';
const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '../../../client/src');
const readClient = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

function futureIso(daysAhead = 7) {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

function stubEmailQueueFailure() {
  const originalCreate = BackgroundJob.create.bind(BackgroundJob);
  BackgroundJob.create = async function patchedCreate(doc, ...rest) {
    if (doc?.type === 'email') throw new Error('injected_email_queue_fail');
    return originalCreate(doc, ...rest);
  };
  return () => {
    BackgroundJob.create = originalCreate;
  };
}

async function seedFixtures({ candidateEmail = `mktp4-precision-c-${Date.now()}@example.test` } = {}) {
  const employer = await Employer.create({
    companyName: 'Precision Employer',
    email: `mktp4-precision-e-${Date.now()}@example.test`,
    password: await bcrypt.hash('pass', 12),
  });
  const candidate = await User.create({
    name: 'Precision Candidate',
    email: candidateEmail,
    password: await bcrypt.hash('pass', 12),
  });
  const job = await Job.create({
    title: 'Precision Job',
    slug: `mktp4-precision-j-${Date.now()}`,
    company: 'Precision Employer',
    organization: 'Precision Employer',
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

async function main() {
  const serviceSrc = readFileSync(
    path.resolve(here, '../services/applicationCommunicationService.js'),
    'utf8'
  );
  check(
    serviceSrc.includes('queueInterviewInvitationEmail') &&
      serviceSrc.includes('Boolean(emailResult?.enqueued)') &&
      !serviceSrc.includes('notify: false'),
    'EMAIL-PRECISION-01: interview emailQueued derives from queueEmail result, not notify:false no-op'
  );

  const panel = readClient('components/applications/ApplicationCommunicationPanel.jsx');
  check(
    panel.includes('result?.emailQueued') && panel.includes('communicationEmailQueued'),
    'EMAIL-PRECISION-06: interview UI appends queued copy only when emailQueued true'
  );
  check(
    !panel.includes('communicationEmailQueued') ||
      (panel.match(/communicationEmailQueued/g) || []).length <= 2,
    'EMAIL-PRECISION-06: queued copy is gated, not unconditional'
  );

  const uri = process.env.MONGO_URI || `mongodb://127.0.0.1:27017/${TEST_DB}`;
  await mongoose.connect(uri, { autoIndex: false });
  try {
    await mongoose.connection.db.dropDatabase();
    await provisionMktP4CommunicationIndexes();

    const { employer, application } = await seedFixtures();
    const successInvite = await CommunicationService.createInterviewInvitation(employer._id, application._id, {
      scheduledAt: futureIso(8),
      timeZone: 'Asia/Karachi',
      method: 'video',
      meetingUrl: 'https://meet.example.test/precision-ok',
    });
    check(successInvite.emailQueued === true, 'EMAIL-PRECISION-02: successful queue insertion → emailQueued true');
    const queuedJob = await BackgroundJob.findOne({ type: 'email' }).sort({ createdAt: -1 }).lean();
    check(queuedJob?.status === 'pending', 'EMAIL-PRECISION-05: worker-stopped queue row remains pending');

    const restore = stubEmailQueueFailure();
    const { employer: employer2, application: application2 } = await seedFixtures({
      candidateEmail: `mktp4-precision-c2-${Date.now()}@example.test`,
    });
    const failInvite = await CommunicationService.createInterviewInvitation(employer2._id, application2._id, {
      scheduledAt: futureIso(9),
      timeZone: 'Europe/Dublin',
      method: 'phone',
    });
    restore();
    check(failInvite.emailQueued === false, 'EMAIL-PRECISION-03: queue failure → emailQueued false');
    check(failInvite.invitation?.status === 'pending', 'EMAIL-PRECISION-04: core invitation persists on queue failure');
    check(
      await ApplicationInterviewInvitation.findById(failInvite.invitation._id),
      'EMAIL-PRECISION-04: invitation row persisted on queue failure'
    );

    const { employer: employer3, application: application3 } = await seedFixtures({
      candidateEmail: `mktp4-precision-noemail-${Date.now()}@example.test`,
    });
    await User.findByIdAndUpdate(application3.userId, { $unset: { email: 1 } });
    const noEmailApp = await Application.findById(application3._id).populate('jobId').populate('userId', 'name email');
    const noEmailInvite = await CommunicationService.createInterviewInvitation(employer3._id, noEmailApp._id, {
      scheduledAt: futureIso(10),
      timeZone: 'Asia/Karachi',
      method: 'video',
      meetingUrl: 'https://meet.example.test/no-email',
    });
    check(noEmailInvite.emailQueued === false, 'EMAIL-PRECISION-01: no queue attempt without candidate email → false');

    console.log(`mktP4EmailQueuedPrecision.test.js: ${count} checks passed on ${mongoose.connection.db.databaseName}`);
  } finally {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
