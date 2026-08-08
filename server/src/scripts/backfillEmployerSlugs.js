/**
 * Backfill deterministic public-profile slugs for existing Employers that were
 * created before slug generation existed (Mission 0 — Employer stabilization).
 *
 * SAFETY (per STRIDETO_ENGINEERING_GUARDRAILS.md):
 *   - Dry-run by DEFAULT. It only reports the planned slug for each employer.
 *   - Writes require the explicit `--commit` flag.
 *   - Refuses to write against a production NODE_ENV unless `--allow-production`
 *     is ALSO passed, forcing a deliberate operator decision.
 *   - Only fills employers whose slug is missing/empty; never overwrites an
 *     existing slug, so it is idempotent and re-runnable.
 *   - Resolves collisions against both already-stored slugs and slugs assigned
 *     earlier in the same run.
 *
 * This script is NOT executed during Mission 0. It is provided for a later,
 * operator-approved maintenance window.
 *
 * Usage:
 *   node server/src/scripts/backfillEmployerSlugs.js                 # dry-run
 *   node server/src/scripts/backfillEmployerSlugs.js --commit        # apply (non-prod)
 *   node server/src/scripts/backfillEmployerSlugs.js --commit --allow-production
 */
import 'dotenv/config';
import { connectDB } from '../config/db.js';
import { Employer } from '../models/Employer.js';
import { ensureUniqueEmployerSlug } from '../utils/employerSlug.js';
import { logger } from '../utils/logger.js';

async function main() {
  const commit = process.argv.includes('--commit');
  const allowProduction = process.argv.includes('--allow-production');
  const isProduction = process.env.NODE_ENV === 'production';

  if (commit && isProduction && !allowProduction) {
    console.error(
      'Refusing to write in production without --allow-production. Re-run with both flags after operator approval.'
    );
    process.exit(2);
  }

  await connectDB();
  logger.info('employer_slug_backfill_start', { commit, isProduction });

  const employers = await Employer.find({
    $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }],
  })
    .select('_id companyName slug')
    .lean();

  // Seed the taken-set with every slug already stored so we never collide with
  // an employer that already has one.
  const taken = new Set(
    (await Employer.find({ slug: { $exists: true, $nin: [null, ''] } })
      .select('slug')
      .lean()).map((e) => e.slug)
  );

  const planned = [];
  for (const emp of employers) {
    // eslint-disable-next-line no-await-in-loop
    const slug = await ensureUniqueEmployerSlug(emp.companyName, (candidate) =>
      taken.has(candidate)
    );
    taken.add(slug);
    planned.push({ id: String(emp._id), companyName: emp.companyName, slug });
  }

  console.log(`Employers missing a slug: ${planned.length}`);
  planned.forEach((p) => console.log(`  ${p.id}  ${p.slug}  <- ${p.companyName}`));

  if (!commit) {
    console.log('\nDRY RUN — no changes written. Re-run with --commit to apply.');
    logger.info('employer_slug_backfill_dry_run_complete', { count: planned.length });
    process.exit(0);
  }

  let updated = 0;
  for (const p of planned) {
    // eslint-disable-next-line no-await-in-loop
    const result = await Employer.updateOne(
      { _id: p.id, $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] },
      { $set: { slug: p.slug } }
    );
    if (result.modifiedCount === 1) updated += 1;
  }
  console.log(`\nCommitted. Slugs written: ${updated}`);
  logger.info('employer_slug_backfill_commit_complete', { planned: planned.length, updated });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
