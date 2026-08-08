/**
 * Safe, bounded inspection + optional cleanup for the BackgroundJob queue
 * (Mission 0 — Employer stabilization, queue hygiene readiness).
 *
 * The staging queue accumulates old acceptance artifacts — stale interview
 * invitations, terminal jobs, and rows whose dedupKey ended up `undefined`.
 * This tool lets an operator INSPECT that debris and, only with explicit
 * confirmation, remove a TARGETED, BOUNDED slice of it.
 *
 * SAFETY (per STRIDETO_ENGINEERING_GUARDRAILS.md):
 *   - INSPECT by default: prints counts + a bounded sample, deletes nothing.
 *   - Deletion requires the explicit `--delete` flag.
 *   - Deletion is TARGETED: it only ever touches terminal rows
 *     (status in {completed, dead, failed}) older than `--older-than-days`
 *     (default 30). It never deletes pending/processing work.
 *   - Deletion is BOUNDED by `--limit` (default 200, hard max 1000) per run.
 *   - Refuses to delete in production unless `--allow-production` is also given.
 *   - Every deletion run logs a structured audit line via the logger.
 *   - This script does NOT auto-run anywhere and is NOT executed during
 *     Mission 0. It requires the worker to remain stopped; it only reads/removes
 *     rows, it never processes or dispatches them.
 *
 * Usage:
 *   node server/src/scripts/inspectQueueHygiene.js                      # inspect
 *   node server/src/scripts/inspectQueueHygiene.js --older-than-days=60  # inspect older slice
 *   node server/src/scripts/inspectQueueHygiene.js --delete --limit=100  # delete (non-prod)
 *   node server/src/scripts/inspectQueueHygiene.js --delete --allow-production
 */
import 'dotenv/config';
import { connectDB } from '../config/db.js';
import { BackgroundJob } from '../models/BackgroundJob.js';
import { logger } from '../utils/logger.js';

const TERMINAL_STATUSES = ['completed', 'dead', 'failed'];
const HARD_MAX_LIMIT = 1000;

function parseIntArg(name, fallback) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const value = parseInt(raw.split('=')[1], 10);
  return Number.isFinite(value) ? value : fallback;
}

async function main() {
  const del = process.argv.includes('--delete');
  const allowProduction = process.argv.includes('--allow-production');
  const isProduction = process.env.NODE_ENV === 'production';
  const olderThanDays = Math.max(0, parseIntArg('older-than-days', 30));
  const limit = Math.min(HARD_MAX_LIMIT, Math.max(1, parseIntArg('limit', 200)));
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  if (del && isProduction && !allowProduction) {
    console.error('Refusing to delete in production without --allow-production.');
    process.exit(2);
  }

  await connectDB();

  // Inspection: how the queue breaks down, plus the two known debris classes.
  const byStatus = await BackgroundJob.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  console.log('Queue by status:');
  byStatus.forEach((r) => console.log(`  ${r._id}: ${r.count}`));

  const targetFilter = {
    status: { $in: TERMINAL_STATUSES },
    createdAt: { $lt: cutoff },
  };
  const targetCount = await BackgroundJob.countDocuments(targetFilter);
  const undefinedDedup = await BackgroundJob.countDocuments({ dedupKey: 'undefined' });
  const staleInterviews = await BackgroundJob.countDocuments({
    ...targetFilter,
    'payload.templateKey': /interview/i,
  });

  console.log(
    `\nTerminal rows older than ${olderThanDays}d (deletable): ${targetCount}`
  );
  console.log(`  of which stale interview-related: ${staleInterviews}`);
  console.log(`Rows with literal "undefined" dedupKey: ${undefinedDedup}`);

  const sample = await BackgroundJob.find(targetFilter)
    .select('_id type status dedupKey createdAt processedAt')
    .sort({ createdAt: 1 })
    .limit(10)
    .lean();
  console.log('\nSample of deletable rows (oldest first):');
  sample.forEach((r) =>
    console.log(`  ${r._id}  ${r.type}/${r.status}  dedup=${r.dedupKey}  created=${r.createdAt?.toISOString?.()}`)
  );

  if (!del) {
    console.log('\nINSPECT ONLY — no rows deleted. Re-run with --delete to remove a bounded slice.');
    process.exit(0);
  }

  // Bounded, targeted deletion: fetch up to `limit` ids first, then delete
  // exactly those, so a single run can never exceed the bound.
  const ids = (
    await BackgroundJob.find(targetFilter).select('_id').sort({ createdAt: 1 }).limit(limit).lean()
  ).map((r) => r._id);
  const result = await BackgroundJob.deleteMany({ _id: { $in: ids } });

  logger.info('queue_hygiene_delete', {
    isProduction,
    olderThanDays,
    limit,
    requested: ids.length,
    deleted: result.deletedCount,
  });
  console.log(`\nDeleted ${result.deletedCount} terminal rows (bounded by limit=${limit}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
