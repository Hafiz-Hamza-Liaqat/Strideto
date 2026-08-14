/**
 * Future Organization capability backfill (Phase 17D-1).
 *
 * DRY-RUN by default. Maps organizationType=employer → employer capability ONLY.
 * Does NOT grant business_client or business_services_provider.
 *
 * NEVER run against persistent Docker / staging / production in this phase.
 *
 * Usage:
 *   node src/scripts/backfillOrganizationCapabilities.js
 *   node src/scripts/backfillOrganizationCapabilities.js --apply
 */
import { ORGANIZATION_TYPES } from '../../../shared/international/organization.js';
import { ORGANIZATION_CAPABILITY_IDS } from '../../../shared/capability/organizationCapabilities.js';

const BATCH_SIZE = 200;

export function parseBackfillMode(argv = process.argv.slice(2)) {
  const apply = argv.includes('--apply');
  return { apply, dryRun: !apply };
}

export function organizationBackfillAction(organization = {}) {
  if (organization.organizationType === ORGANIZATION_TYPES.EMPLOYER) {
    return {
      grant: ORGANIZATION_CAPABILITY_IDS.EMPLOYER,
      skip: false,
    };
  }
  return { grant: null, skip: true, reason: 'not_employer' };
}

export async function backfillOrganizationCapabilities({
  organizationCursor,
  grantEmployer,
  apply = false,
  batchSize = BATCH_SIZE,
  log = console.log,
} = {}) {
  const counts = {
    scanned: 0,
    wouldGrantEmployer: 0,
    skipped: 0,
    grantedEmployer: 0,
    errors: 0,
  };

  for await (const org of organizationCursor) {
    counts.scanned += 1;
    const action = organizationBackfillAction(org);
    if (action.skip) {
      counts.skipped += 1;
      continue;
    }
    counts.wouldGrantEmployer += 1;
    if (apply) {
      try {
        await grantEmployer(org, {
          grantedBy: 'system:backfill_organization_capabilities',
          grantReason: 'legacy_employer_organization_type',
        });
        counts.grantedEmployer += 1;
      } catch {
        counts.errors += 1;
      }
    }
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    capability: ORGANIZATION_CAPABILITY_IDS.EMPLOYER,
    neverGranted: [
      ORGANIZATION_CAPABILITY_IDS.BUSINESS_CLIENT,
      ORGANIZATION_CAPABILITY_IDS.BUSINESS_SERVICES_PROVIDER,
    ],
    batchSize,
    ...counts,
  };
  log(JSON.stringify(summary));
  return summary;
}

async function main() {
  const { apply } = parseBackfillMode();
  if (apply && process.env.STRIDETO_CAPABILITY_BACKFILL_CONFIRM !== '1') {
    console.error('Refusing --apply without STRIDETO_CAPABILITY_BACKFILL_CONFIRM=1');
    process.exit(2);
  }
  throw new Error('Live Organization capability backfill is not permitted in Phase 17D-1');
}

const isDirect = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('backfillOrganizationCapabilities.js');
if (isDirect) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
