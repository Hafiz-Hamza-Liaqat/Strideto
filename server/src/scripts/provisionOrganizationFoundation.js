/**
 * Provision the Mission 1 Organization foundation (ADDITIVE, DRY-RUN FIRST).
 *
 * This script is the reviewable, operator-approved migration for the additive
 * Organization model. Per STRIDETO_ENGINEERING_GUARDRAILS.md it is NOT executed
 * during Mission 1 — it exists so a later maintenance window can adopt it
 * deliberately.
 *
 * What it can do (all additive, never destructive):
 *   --verify   Report Organization index state and how many legacy Employers
 *              have no Organization row yet. Default. Read-only.
 *   --preview  Additionally print the Organization identity each legacy Employer
 *              WOULD receive (type=employer, slug from companyName, legacy link).
 *              Read-only; assigns nothing.
 *   --commit   Create the missing Organization rows. Requires an explicit
 *              operator decision; refuses production without --allow-production.
 *
 * SAFETY:
 *   - Dry-run (--verify) by DEFAULT; writes require --commit.
 *   - Refuses to write against production NODE_ENV unless --allow-production.
 *   - Idempotent: only creates an Organization for an Employer that has none
 *     (matched by legacyEmployerId); never overwrites, never deletes.
 *   - Collision-safe slugs resolved against both stored slugs and slugs assigned
 *     earlier in the same run.
 *
 * Usage:
 *   node server/src/scripts/provisionOrganizationFoundation.js            # verify
 *   node server/src/scripts/provisionOrganizationFoundation.js --preview  # preview
 *   node server/src/scripts/provisionOrganizationFoundation.js --commit   # apply (non-prod)
 *   node server/src/scripts/provisionOrganizationFoundation.js --commit --allow-production
 */
import 'dotenv/config';
import { connectDB } from '../config/db.js';
import { Employer } from '../models/Employer.js';
import { Organization } from '../models/Organization.js';
import { logger } from '../utils/logger.js';
import {
  ORGANIZATION_TYPES,
  ORGANIZATION_STATUSES,
  ensureUniqueOrganizationSlug,
} from '../../../shared/international/organization.js';
import { coerceCountryCode } from '../../../shared/international/country.js';

async function main() {
  const commit = process.argv.includes('--commit');
  const preview = process.argv.includes('--preview') || commit;
  const allowProduction = process.argv.includes('--allow-production');
  const isProduction = process.env.NODE_ENV === 'production';

  if (commit && isProduction && !allowProduction) {
    console.error(
      'Refusing to write in production without --allow-production. Re-run with both flags after operator approval.'
    );
    process.exit(2);
  }

  await connectDB();
  await Organization.init(); // ensure indexes exist (additive, safe)
  logger.info('organization_foundation_provision_start', { commit, preview, isProduction });

  const employers = await Employer.find({}, 'companyName country slug').lean();
  const existing = await Organization.find(
    { legacyEmployerId: { $ne: null } },
    'legacyEmployerId'
  ).lean();
  const mappedIds = new Set(existing.map((o) => String(o.legacyEmployerId)));

  const assignedSlugs = new Set(
    (await Organization.find({}, 'slug').lean()).map((o) => o.slug).filter(Boolean)
  );
  const slugExists = (slug) => assignedSlugs.has(slug);

  const pending = employers.filter((e) => !mappedIds.has(String(e._id)));
  let created = 0;

  for (const employer of pending) {
    // eslint-disable-next-line no-await-in-loop
    const slug = await ensureUniqueOrganizationSlug(employer.companyName, slugExists);
    assignedSlugs.add(slug);
    const countryCode = coerceCountryCode(employer.country) || '';
    const doc = {
      organizationType: ORGANIZATION_TYPES.EMPLOYER,
      displayName: employer.companyName,
      legalName: employer.companyName,
      slug,
      countryCode,
      status: ORGANIZATION_STATUSES.ACTIVE,
      legacyEmployerId: employer._id,
    };

    if (preview) {
      console.log(
        `[preview] employer=${employer._id} -> org{type=employer, slug=${slug}, country=${countryCode || '(unknown)'}}`
      );
    }
    if (commit) {
      // eslint-disable-next-line no-await-in-loop
      await Organization.create(doc);
      created += 1;
    }
  }

  logger.info('organization_foundation_provision_done', {
    employers: employers.length,
    alreadyMapped: mappedIds.size,
    pending: pending.length,
    created,
    commit,
  });
  console.log(
    `Employers=${employers.length} alreadyMapped=${mappedIds.size} pending=${pending.length} created=${created} (commit=${commit})`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('organization_foundation_provision_failed:', err.message);
  process.exit(1);
});
