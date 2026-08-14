/**
 * Future User capability backfill (Phase 17D-1).
 *
 * DRY-RUN by default. Requires --apply to write.
 * NEVER run against persistent Docker / staging / production in this phase.
 *
 * Classification uses the same helper as the runtime legacy resolver.
 * Never grants business_client. Staff/admin-only receive no student.
 * Ambiguous accounts are skipped. Reports counts only — no secrets.
 *
 * Usage:
 *   node src/scripts/backfillUserCapabilities.js
 *   node src/scripts/backfillUserCapabilities.js --apply
 */
import { classifyLegacyUserAccount } from '../../../shared/capability/legacyUserClassification.js';
import { USER_CAPABILITY_IDS } from '../../../shared/capability/userCapabilities.js';
import { CAPABILITY_SCHEMA_VERSION } from '../../../shared/capability/grantStatus.js';

const BATCH_SIZE = 200;

export function parseBackfillMode(argv = process.argv.slice(2)) {
  const apply = argv.includes('--apply');
  return { apply, dryRun: !apply };
}

export function classifyUserForBackfill(user) {
  return classifyLegacyUserAccount(user);
}

export async function backfillUserCapabilities({
  userCursor,
  grantStudent,
  markInitialized,
  apply = false,
  batchSize = BATCH_SIZE,
  log = console.log,
} = {}) {
  const counts = {
    scanned: 0,
    wouldGrantStudent: 0,
    wouldInitializeStaff: 0,
    skippedInitialized: 0,
    skippedAmbiguous: 0,
    skippedCapabilityEraIncomplete: 0,
    grantedStudent: 0,
    initializedStaff: 0,
    errors: 0,
  };

  for await (const user of userCursor) {
    counts.scanned += 1;
    const classification = classifyUserForBackfill(user);
    if (classification.kind === 'initialized') {
      counts.skippedInitialized += 1;
      continue;
    }
    if (classification.kind === 'capability_era_incomplete') {
      counts.skippedCapabilityEraIncomplete += 1;
      continue;
    }
    if (classification.failClosed || classification.kind === 'ambiguous') {
      counts.skippedAmbiguous += 1;
      continue;
    }

    if (classification.grantStudentOnBackfill) {
      counts.wouldGrantStudent += 1;
      if (apply) {
        try {
          await grantStudent(user, {
            grantedBy: 'system:backfill_user_capabilities',
            grantReason: 'legacy_student_customer',
          });
          await markInitialized(user);
          counts.grantedStudent += 1;
        } catch {
          counts.errors += 1;
        }
      }
      continue;
    }

    counts.wouldInitializeStaff += 1;
    if (apply) {
      try {
        await markInitialized(user);
        counts.initializedStaff += 1;
      } catch {
        counts.errors += 1;
      }
    }
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    capability: USER_CAPABILITY_IDS.STUDENT,
    neverGranted: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
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
  const { connectMongo } = await import('../config/db.js').catch(() => ({ connectMongo: null }));
  if (!connectMongo) {
    console.error('Database connector unavailable; aborting without writes');
    process.exit(1);
  }
  throw new Error('Live User capability backfill is not permitted in Phase 17D-1');
}

const isDirect = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('backfillUserCapabilities.js');
if (isDirect) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
