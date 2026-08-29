/**
 * MKT-P5 — offer email queue failure semantics (MKT-P5-EMAIL-01..06).
 * Run: node src/__tests__/mktP5EmailQueueFailure.test.js
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
import { ApplicationOffer } from '../models/ApplicationOffer.js';
import { UserNotification } from '../models/UserNotification.js';
import { BackgroundJob } from '../models/BackgroundJob.js';
import { ApplicationMigrationService } from '../services/career/migration/ApplicationMigrationService.js';
import { provisionMktP4CommunicationIndexes } from '../services/platform/mktP4CommunicationIndexProvision.js';
import { provisionMktP5OfferIndexes } from '../services/platform/mktP5OfferIndexProvision.js';
import * as OfferService from '../services/applicationOfferService.js';

const TEST_DB = 'edurozgaar_mkt_p5_email_fail';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

async function seedFixtures() {
  const employer = await Employer.create({
    companyName: 'Offer Email Fail Employer',
    email: `mktp5-emailfail-e-${Date.now()}@example.test`,
    password: await bcrypt.hash('pass', 12),
  });
  const candidate = await User.create({
    name: 'Offer Email Fail Candidate',
    email: `mktp5-emailfail-c-${Date.now()}@example.test`,
    password: await bcrypt.hash('pass', 12),
  });
  const job = await Job.create({
    title: 'Offer Email Fail Job',
    slug: `mktp5-emailfail-j-${Date.now()}`,
    company: 'Offer Email Fail Employer',
    organization: 'Offer Email Fail Employer',
    employerId: employer._id,
    source: 'employer',
    status: 'active',
    approvalStatus: 'approved',
    applyType: 'internal',
  });
  const application = await Application.create({
    userId: candidate._id,
    jobId: job._id,
    status: 'interview',
  });
  await ApplicationMigrationService.dualWriteFromLegacyJobApplication(application.toObject(), job.toObject());
  return { employer, candidate, job, application };
}

function stubEmailQueueFailure(mode = 'throw') {
  const originalCreate = BackgroundJob.create.bind(BackgroundJob);
  BackgroundJob.create = async function patchedCreate(doc, ...rest) {
    if (doc?.type === 'email' && mode === 'throw') {
      throw new Error('injected_offer_email_queue_fail');
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
    await provisionMktP5OfferIndexes();
    const { employer, candidate, application } = await seedFixtures();

    const panelPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../client/src/components/applications/ApplicationOfferPanel.jsx'
    );
    const panelSrc = readFileSync(panelPath, 'utf8');
    const analyticsPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../client/src/components/employer/applicant/applicationOfferAnalytics.js'
    );
    const analyticsSrc = readFileSync(analyticsPath, 'utf8');

    const restoreFail = stubEmailQueueFailure('throw');
    const jobsBefore = await BackgroundJob.countDocuments({ type: 'email' });
    const result = await OfferService.sendApplicationOffer(employer._id, application._id, {
      compensationText: 'PKR 100k',
      clientCommandId: 'mktp5-email-fail-01',
    });
    restoreFail();

    check(!result.duplicate, 'MKT-P5-EMAIL-01: offer send succeeds when email queue throws');
    check(
      await ApplicationOffer.findOne({ applicationId: application._id, clientCommandId: 'mktp5-email-fail-01' }),
      'MKT-P5-EMAIL-01: ApplicationOffer persisted'
    );
    check(result.sideEffects?.emailQueued === false, 'MKT-P5-EMAIL-02: emailQueued false on queue failure');
    check(
      (await BackgroundJob.countDocuments({ type: 'email' })) === jobsBefore,
      'MKT-P5-EMAIL-01: no BackgroundJob row when queue throws'
    );

    const notif = await UserNotification.findOne({
      userId: candidate._id,
      type: 'application.offer_sent',
    }).lean();
    check(Boolean(notif), 'MKT-P5-EMAIL-01: candidate in-app notification still created');

    check(
      panelSrc.includes('if (sideEffects.emailQueued)') && panelSrc.includes('offerEmailQueued'),
      'MKT-P5-EMAIL-03: UI gates queued-email copy on emailQueued'
    );
    check(!panelSrc.includes('Email sent'), 'MKT-P5-EMAIL-03: UI does not claim email sent');
    check(!panelSrc.includes('Delivered'), 'MKT-P5-EMAIL-03: UI does not claim delivered');
    check(!analyticsSrc.includes('email_delivered'), 'MKT-P5-EMAIL-06: no email delivery analytics');

    const restoreOk = stubEmailQueueFailure('pass');
    const okApp = await seedFixtures();
    const okResult = await OfferService.sendApplicationOffer(okApp.employer._id, okApp.application._id, {
      clientCommandId: 'mktp5-email-ok-02',
    });
    restoreOk();

    check(okResult.sideEffects?.emailQueued === true, 'MKT-P5-EMAIL-04: emailQueued true when queue succeeds');
    const pendingJob = await BackgroundJob.findOne({
      type: 'email',
      dedupKey: `email:app-offer:${okApp.application._id}:${String(okResult.offer._id)}`,
    }).lean();
    check(pendingJob?.status === 'pending', 'MKT-P5-EMAIL-05: pending BackgroundJob when queue succeeds (worker stopped)');

    console.log(`mktP5EmailQueueFailure.test.js: ${count} checks passed`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
