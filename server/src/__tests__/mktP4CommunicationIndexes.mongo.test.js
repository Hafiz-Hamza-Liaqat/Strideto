/**
 * MKT-P4 — physical index idempotency on local Mongo.
 * Run:
 *   set MKT_P4_INTEGRATION_TEST=1
 *   node server/src/__tests__/mktP4CommunicationIndexes.mongo.test.js
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { resolveMongoTarget } from '../utils/mongoTargetGuard.js';
import { ApplicationMessage } from '../models/ApplicationMessage.js';
import {
  provisionMktP4CommunicationIndexes,
  verifyMktP4CommunicationIndexes,
} from '../services/platform/mktP4CommunicationIndexProvision.js';
import { sendEmployerMessage } from '../services/applicationCommunicationService.js';
import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { Employer } from '../models/Employer.js';
import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';

const TEST_DB = 'edurozgaar_mkt_p4_indexes';

async function main() {
  if (process.env.MKT_P4_INTEGRATION_TEST !== '1') {
    console.log('mktP4CommunicationIndexes.mongo: skipped (set MKT_P4_INTEGRATION_TEST=1)');
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

    let report = await verifyMktP4CommunicationIndexes();
    check(!report.ok, 'IDX-02: indexes missing before provision');

    await provisionMktP4CommunicationIndexes();
    report = await verifyMktP4CommunicationIndexes();
    check(report.ok, 'IDX-07: provision idempotent — indexes ready');

    await provisionMktP4CommunicationIndexes();
    report = await verifyMktP4CommunicationIndexes();
    check(report.ok, 'IDX-07: second provision pass still ready');

    const employer = await Employer.create({
      companyName: 'Idx Employer',
      email: `idx-${Date.now()}@example.test`,
      password: await bcrypt.hash('x', 12),
    });
    const user = await User.create({
      name: 'Idx Candidate',
      email: `idx-u-${Date.now()}@example.test`,
      password: await bcrypt.hash('x', 12),
    });
    const job = await Job.create({
      title: 'Idx Job',
      slug: `idx-${Date.now()}`,
      company: 'Idx',
      organization: 'Idx',
      employerId: employer._id,
      source: 'employer',
      status: 'active',
      approvalStatus: 'approved',
      applyType: 'internal',
    });
    const app = await Application.create({ userId: user._id, jobId: job._id, status: 'submitted' });

    const clientMessageId = 'physical-idem-key';
    const [a, b] = await Promise.all([
      sendEmployerMessage(employer._id, app._id, { body: 'A', clientMessageId }),
      sendEmployerMessage(employer._id, app._id, { body: 'B', clientMessageId }),
    ]);
    const rows = await ApplicationMessage.countDocuments({ applicationId: app._id, clientMessageId });
    check(rows === 1, 'IDX-03: physical unique index prevents duplicate messages');
    check(a.duplicate || b.duplicate, 'IDX-03: duplicate flag on retry path');

    console.log(`mktP4CommunicationIndexes.mongo.test.js: ${count} checks passed`);
  } finally {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
