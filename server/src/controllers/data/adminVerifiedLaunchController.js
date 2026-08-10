/**
 * Admin verified-data launch visibility (Mission 25).
 *
 * READ-ONLY. There is no import button, no apply endpoint and no mutation of
 * canonical data anywhere in this controller. It exists so an Admin can see
 * what a launch batch *would* do before anyone is allowed to do it.
 *
 * Authorization is enforced by the parent admin router (auth + staff) plus an
 * explicit `admin.data_quality.manage` permission on each route. The acting
 * identity is always derived server-side from the session — never from the body.
 */
import path from 'path';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import {
  LAUNCH_PACK_ROOT,
  LaunchPackError,
  listLaunchPacks,
  loadLaunchPack,
} from '../../services/data/verifiedLaunchPack.js';
import { ManifestStructureError } from '../../services/data/verifiedLaunchManifest.js';
import {
  buildLaunchReport,
  buildRollbackPlan,
  createCanonicalStateSnapshot,
  planLaunchBatch,
} from '../../services/data/verifiedLaunchPlanner.js';
import {
  describeApplyAtomicity,
  resolveLaunchEnvironment,
} from '../../services/data/verifiedLaunchGate.js';
import {
  BATCH_REVIEW_STATES,
  LAUNCH_LIMITS,
  MANIFEST_SCHEMA_VERSION,
  PLAN_STATES,
  canApproveLaunchBatch,
} from '../../../../shared/data/verifiedLaunch.js';

/**
 * Truthful readiness label. Never says "live", "published globally" or
 * "production verified" — none of those are true of a dry run.
 */
function readinessLabel(validation, plan) {
  if (!validation.ok) return 'Invalid records — not launchable';
  if ((plan.counts[PLAN_STATES.CONFLICT] ?? 0) > 0) return 'Conflict detected';
  if ((plan.counts[PLAN_STATES.SKIP_STALE] ?? 0) > 0) return 'Stale source';
  if ((plan.counts[PLAN_STATES.MANUAL_REVIEW] ?? 0) > 0) return 'Manual review required';
  if (validation.summary.totalRecords === 0) return 'Validated — empty pack, nothing to launch';
  return 'Ready for controlled review';
}

function summarizeBatch(filePath, validation, plan) {
  return {
    manifestFile: path.basename(filePath),
    batchId: plan.batchId,
    manifestVersion: plan.manifestVersion,
    manifestFingerprint: plan.manifestFingerprint,
    environmentIntent: plan.environmentIntent,
    reviewState: validation.reviewState,
    scope: plan.scope,
    totalRecords: validation.summary.totalRecords,
    validRecords: validation.summary.validRecords,
    invalidRecords: validation.summary.invalidRecords,
    readiness: readinessLabel(validation, plan),
    applied: false,
    appliedNote: 'Dry run only. Not applied.',
  };
}

// ── GET /admin/data/verified-launch/batches ──────────────────────────────────

export const adminListLaunchBatches = asyncHandler(async (req, res) => {
  const files = listLaunchPacks();
  const batches = [];
  const unreadable = [];

  for (const file of files) {
    try {
      const { filePath, validation } = loadLaunchPack(file);
      const plan = planLaunchBatch(validation, createCanonicalStateSnapshot({}));
      batches.push(summarizeBatch(filePath, validation, plan));
    } catch (err) {
      unreadable.push({
        manifestFile: file,
        code: err.code ?? 'unknown_error',
        message: err.message,
      });
    }
  }

  res.json({
    launchPackRoot: path.basename(LAUNCH_PACK_ROOT),
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    maxRecordsPerBatch: LAUNCH_LIMITS.MAX_RECORDS_PER_BATCH,
    batches,
    unreadable,
    lifecycleStates: Object.values(BATCH_REVIEW_STATES),
    mutationCapability: 'none_in_this_release',
  });
});

// ── GET /admin/data/verified-launch/batches/:manifestFile/dry-run ────────────

export const adminLaunchBatchDryRun = asyncHandler(async (req, res) => {
  const requested = String(req.params.manifestFile ?? '');

  let loaded;
  try {
    loaded = loadLaunchPack(requested);
  } catch (err) {
    if (err instanceof LaunchPackError || err instanceof ManifestStructureError) {
      // Reason only — never echo manifest content or filesystem paths.
      return res.status(400).json({ message: 'Launch pack rejected', code: err.code });
    }
    throw err;
  }

  const { filePath, validation } = loaded;
  const plan = planLaunchBatch(validation, createCanonicalStateSnapshot({}));
  const rollback = buildRollbackPlan(plan);
  const report = buildLaunchReport(validation, plan);
  const environment = resolveLaunchEnvironment();

  // Audit records the fact of the inspection and the batch identity only —
  // never the manifest body, never source payloads.
  await logAudit({
    ...auditFromRequest(req),
    action: 'admin.verified_launch.dry_run_viewed',
    targetType: 'VerifiedDataLaunchBatch',
    targetId: plan.batchId,
    targetLabel: path.basename(filePath),
    metadata: {
      manifestFingerprint: plan.manifestFingerprint,
      manifestVersion: plan.manifestVersion,
      totalRecords: validation.summary.totalRecords,
      planCounts: plan.counts,
      mutating: false,
    },
  });

  res.json({
    mode: 'dry_run',
    persistence: 'none',
    summary: summarizeBatch(filePath, validation, plan),
    counts: plan.counts,
    entries: plan.entries.map((entry) => ({
      recordKey: entry.recordKey,
      entityType: entry.entityType,
      planState: entry.planState,
      reason: entry.reason,
      countryCode: entry.countryCode,
      sourceAuthority: entry.sourceAuthority,
      freshnessState: entry.freshnessState,
      attribution: entry.attribution,
      conflict: entry.conflict ?? null,
      duplicateOf: entry.duplicateOf ?? entry.duplicateCandidate ?? null,
    })),
    invalidRecords: validation.invalidRecords,
    invalidSources: validation.invalidSources,
    distribution: {
      entityType: report.byEntityType,
      sourceAuthority: report.bySourceAuthority,
      freshness: report.byFreshness,
      country: report.byCountry,
    },
    sourceCoverage: report.sourceCoverage,
    absentFromManifest: report.absentFromManifest,
    rollback: {
      generatedBeforeApply: rollback.generatedBeforeApply,
      preservesImmutableHistory: rollback.preservesImmutableHistory,
      hardDeletes: rollback.hardDeletes,
      operations: rollback.operations.length,
    },
    publicationSeparation: report.publicationSeparation,
    applyGate: {
      available: false,
      environment: environment.ok ? environment.environment : null,
      environmentReason: environment.reason,
      atomicity: describeApplyAtomicity(),
      requiredApprovalRoles: ['admin', 'superadmin'],
      actorCanApprove: canApproveLaunchBatch({ role: req.user?.role }),
    },
  });
});
