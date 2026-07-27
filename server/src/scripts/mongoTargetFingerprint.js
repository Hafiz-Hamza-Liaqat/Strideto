/**
 * Safe Mongo target fingerprint (no secrets). Read-only.
 * Run: node src/scripts/mongoTargetFingerprint.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { publicMongoTargetSummary, resolveMongoTarget } from '../utils/mongoTargetGuard.js';

async function jobsCollectionFingerprint() {
  const publicFilter = {
    status: 'active',
    $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
  };
  const [total, active, draft, closed, launchV1, ntsSlug, dates] = await Promise.all([
    Job.countDocuments(),
    Job.countDocuments({ status: 'active' }),
    Job.countDocuments({ status: 'draft' }),
    Job.countDocuments({ status: 'closed' }),
    Job.countDocuments({ externalId: /^launch-v1-/i }),
    Job.countDocuments({ slug: 'nts-test-invigilator-2026-punjab' }),
    Job.aggregate([
      { $group: { _id: null, newest: { $max: '$createdAt' }, oldest: { $min: '$createdAt' } } },
    ]),
  ]);

  const ntsDocs = await Job.find({ slug: 'nts-test-invigilator-2026-punjab' })
    .select('title slug externalId status source locale createdAt updatedAt')
    .lean();

  const ntsSummary = ntsDocs.map((d) => ({
    title: d.title,
    slug: d.slug,
    externalId: d.externalId,
    status: d.status,
    source: d.source,
    locale: d.locale || 'en',
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  }));

  return {
    total,
    active,
    draft,
    closed,
    launchV1,
    ntsSlugCount: ntsSlug,
    publicListFilterActiveCount: await Job.countDocuments(publicFilter),
    createdAtRange: dates[0]
      ? {
          newest: new Date(dates[0].newest).toISOString(),
          oldest: new Date(dates[0].oldest).toISOString(),
        }
      : null,
    ntsMatches: ntsSummary,
    activeDuplicateNts: ntsSummary.filter((d) => d.status === 'active').length,
  };
}

async function main() {
  const target = resolveMongoTarget();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const jobs = await jobsCollectionFingerprint();
  const connectionDbName = mongoose.connection.db?.databaseName || null;
  console.log(
    JSON.stringify(
      {
        mongoTarget: publicMongoTargetSummary(target),
        mongooseConnectedDatabaseName: connectionDbName,
        jobsCollection: jobs,
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
