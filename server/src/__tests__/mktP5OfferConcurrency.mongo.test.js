/**
 * MKT-P5 — active-offer concurrency + expiry replacement (Mongo).
 * Run:
 *   set MKT_P5_INTEGRATION_TEST=1
 *   node server/src/__tests__/mktP5OfferConcurrency.mongo.test.js
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
import { ApplicationMigrationService } from '../services/career/migration/ApplicationMigrationService.js';
import { provisionMktP4CommunicationIndexes } from '../services/platform/mktP4CommunicationIndexProvision.js';
import { provisionMktP5OfferIndexes } from '../services/platform/mktP5OfferIndexProvision.js';
import * as OfferService from '../services/applicationOfferService.js';
import { persistExpiredSentOffers } from '../utils/applicationOfferLifecycle.js';
import { serializeOffer } from '../utils/applicationOfferView.js';

const TEST_DB = 'edurozgaar_mkt_p5_offer_concurrency';

async function seedApp() {
  const employer = await Employer.create({
    companyName: 'Concurrency Employer',
    email: `mktp5-conc-e-${Date.now()}@example.test`,
    password: await bcrypt.hash('pass', 12),
  });
  const candidate = await User.create({
    name: 'Concurrency Candidate',
    email: `mktp5-conc-c-${Date.now()}@example.test`,
    password: await bcrypt.hash('pass', 12),
  });
  const job = await Job.create({
    title: 'Concurrency Job',
    slug: `mktp5-conc-j-${Date.now()}`,
    company: 'Concurrency Employer',
    organization: 'Concurrency Employer',
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
  return { employer, application };
}

async function main() {
  if (process.env.MKT_P5_INTEGRATION_TEST !== '1') {
    console.log('mktP5OfferConcurrency.mongo: skipped (set MKT_P5_INTEGRATION_TEST=1)');
    return;
  }

  const uri = process.env.MONGO_URI || `mongodb://127.0.0.1:27017/${TEST_DB}`;
  if (!resolveMongoTarget(uri).isLocalDevelopmentTarget) {
    console.error('refused — non-local Mongo');
    process.exit(1);
  }

  let count = 0;
  const check = (c, m) => {
    assert.ok(c, m);
    count += 1;
  };

  await mongoose.connect(uri, { autoIndex: false });
  try {
    await mongoose.connection.db.dropDatabase();
    await provisionMktP4CommunicationIndexes();
    await provisionMktP5OfferIndexes();

    const { employer, application } = await seedApp();

    const cmd = 'concurrent-same-cmd';
    const [r1, r2] = await Promise.all([
      OfferService.sendApplicationOffer(employer._id, application._id, { clientCommandId: cmd }),
      OfferService.sendApplicationOffer(employer._id, application._id, { clientCommandId: cmd }),
    ]);
    const sentAfterIdem = await ApplicationOffer.countDocuments({ applicationId: application._id, status: 'sent' });
    check(sentAfterIdem <= 1, 'CONC-01: same command concurrent → at most one sent offer');
    check(
      (r1.duplicate || r2.duplicate) || r1.offer?._id?.toString() === r2.offer?._id?.toString(),
      'CONC-01: same command concurrent → one logical offer'
    );

    await ApplicationOffer.deleteMany({ applicationId: application._id });

    const outcomes = await Promise.allSettled([
      OfferService.sendApplicationOffer(employer._id, application._id, { clientCommandId: 'diff-a' }),
      OfferService.sendApplicationOffer(employer._id, application._id, { clientCommandId: 'diff-b' }),
    ]);
    const sentCount = await ApplicationOffer.countDocuments({ applicationId: application._id, status: 'sent' });
    check(sentCount === 1, 'CONC-02: different command concurrent → exactly one active sent offer');
    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled').length;
    const rejected = outcomes.filter((o) => o.status === 'rejected').length;
    check(fulfilled === 1 && rejected === 1, 'CONC-02: one success and one conflict on concurrent different commands');

    await ApplicationOffer.deleteMany({ applicationId: application._id });

    const past = new Date(Date.now() - 60_000);
    await ApplicationOffer.create({
      applicationId: application._id,
      status: 'sent',
      expiresAt: past,
      createdByEmployerId: employer._id,
      clientCommandId: 'expired-old',
    });
    check(
      (await ApplicationOffer.countDocuments({ applicationId: application._id, status: 'sent' })) === 1,
      'EXPIRY-01: seeded past sent offer'
    );

    await persistExpiredSentOffers(application._id);
    check(
      (await ApplicationOffer.countDocuments({ applicationId: application._id, status: 'expired' })) === 1,
      'EXPIRY-02: persistExpiredSentOffers moves past sent → expired'
    );
    check(
      (await ApplicationOffer.countDocuments({ applicationId: application._id, status: 'sent' })) === 0,
      'EXPIRY-03: expired row no longer counts as sent for uniqueness'
    );

    const replacement = await OfferService.sendApplicationOffer(employer._id, application._id, {
      clientCommandId: 'after-expiry',
      compensationText: 'Replacement terms',
    });
    check(replacement.duplicate === false, 'EXPIRY-04: replacement offer after expiry succeeds');
    check(
      (await ApplicationOffer.countDocuments({ applicationId: application._id, status: 'sent' })) === 1,
      'EXPIRY-04: one new sent offer after expiry'
    );

    const serialized = serializeOffer(
      await ApplicationOffer.findOne({ clientCommandId: 'expired-old' }).lean()
    );
    check(serialized.effectiveStatus === 'expired', 'EXPIRY-05: historical expired row serializes as expired');

    const appB = await seedApp();
    await OfferService.sendApplicationOffer(appB.employer._id, appB.application._id, {
      clientCommandId: cmd,
    });
    check(true, 'IDEM-02: same clientCommandId on different application allowed');

    console.log(`mktP5OfferConcurrency.mongo: ${count} passed`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
