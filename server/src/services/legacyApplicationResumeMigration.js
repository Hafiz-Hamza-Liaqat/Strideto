/**
 * SEC-P1 legacy application resume migration — inventory, migrate, cleanup.
 * Application records are the source of truth; no heuristic orphan attachment.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  classifyResumeStorage,
  RESUME_STORAGE_KIND,
} from '../../../shared/application/resumeStorageDescriptor.js';
import { extractLegacyPublicUploadKey, resolveLegacyPublicUploadFile } from '../../../shared/application/legacyResumePathSafety.js';
import {
  fetchTrustedLegacyCloudinaryResume,
  validateTrustedLegacyCloudinaryResumeUrl,
} from '../../../shared/application/legacyResumeMigrationUrl.js';
import {
  uploadApplicationResumeFile,
  resolveEmployerApplicationResumeAccess,
  isApplicationResumeCloudinaryConfigured,
} from './applicationResumeStorage.js';
import { validateResumeBuffer } from '../utils/fileValidation.js';
import { Application } from '../models/Application.js';
import { resolveMongoTarget } from '../utils/mongoTargetGuard.js';
import {
  createMigrationRunId,
  descriptorFingerprint,
  legacySourceFingerprint,
  validateReportEnvelope,
  validateReportEnvironmentBinding,
  validateCleanupJournalEntryShape,
  LEGACY_RESUME_MIGRATION_REPORT_VERSION,
} from '../../../shared/application/legacyResumeMigrationReport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LEGACY_PUBLIC_UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

export const MIGRATION_RECORD_STATUS = {
  SCANNED: 'scanned',
  SKIPPED_ALREADY_PRIVATE: 'skipped_already_private',
  SKIPPED_MISSING: 'skipped_missing',
  SKIPPED_UNKNOWN: 'skipped_unknown',
  SKIPPED_NOT_ELIGIBLE: 'skipped_not_eligible',
  MIGRATED: 'migrated',
  FAILED_SOURCE_READ: 'failed_source_read',
  FAILED_VALIDATION: 'failed_validation',
  FAILED_UPLOAD: 'failed_upload',
  FAILED_VERIFY: 'failed_verify',
  DB_CONFLICT: 'db_conflict',
  CLEANUP_ELIGIBLE: 'cleanup_eligible',
  CLEANUP_COMPLETED: 'cleanup_completed',
  CLEANUP_REFUSED: 'cleanup_refused',
  CLEANUP_ALREADY_ABSENT: 'cleanup_already_absent',
  CLEANUP_MANUAL_REQUIRED: 'cleanup_manual_required',
};

const PRIVATE_KINDS = new Set([
  RESUME_STORAGE_KIND.PRIVATE_LOCAL,
  RESUME_STORAGE_KIND.PRIVATE_CLOUDINARY,
]);

const MIGRATABLE_KINDS = new Set([
  RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC,
  RESUME_STORAGE_KIND.LEGACY_CLOUDINARY_PUBLIC,
]);

const UNKNOWN_KINDS = new Set([
  RESUME_STORAGE_KIND.UNKNOWN,
  RESUME_STORAGE_KIND.LEGACY_REMOTE_PUBLIC,
]);

/** Migration classifier extends MKT-P3 for bare /uploads paths. */
export function classifyResumeForMigration(resumeURL) {
  const kind = classifyResumeStorage(resumeURL);
  if (kind !== RESUME_STORAGE_KIND.UNKNOWN) return kind;
  const raw = String(resumeURL || '').trim();
  if (!raw) return RESUME_STORAGE_KIND.MISSING;
  if (raw.startsWith('/uploads/') || /^uploads\//i.test(raw)) {
    return RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC;
  }
  return RESUME_STORAGE_KIND.UNKNOWN;
}

export function opaqueApplicationId(applicationId) {
  const id = String(applicationId || '');
  if (id.length <= 8) return id;
  return `app_${id.slice(-8)}`;
}

export function createEmptySummary() {
  return {
    scanned: 0,
    missing: 0,
    alreadyPrivate: 0,
    legacyLocal: 0,
    legacyCloudinary: 0,
    legacyRemote: 0,
    unknown: 0,
    eligibleForMigration: 0,
    migrated: 0,
    skippedAlreadyPrivate: 0,
    skippedMissing: 0,
    skippedUnknown: 0,
    failedSourceRead: 0,
    failedValidation: 0,
    failedUpload: 0,
    failedVerify: 0,
    dbConflict: 0,
    cleanupEligible: 0,
    cleanupCompleted: 0,
    cleanupRefused: 0,
    cleanupManualRequired: 0,
    writesPerformed: 0,
    deletionsPerformed: 0,
    errors: 0,
  };
}

/**
 * @param {import('mongoose').Document|{ _id: unknown, resumeURL?: string|null, createdAt?: Date, appliedDate?: Date }} application
 */
export function inventoryApplication(application) {
  const resumeURL = application?.resumeURL;
  const kind = classifyResumeForMigration(resumeURL);
  const summaryKey = kindToSummaryKey(kind);
  const eligible = MIGRATABLE_KINDS.has(kind);
  const ageDays = computeAgeDays(application);
  return { kind, summaryKey, eligible, ageDays, resumeURL: resumeURL ?? null };
}

function kindToSummaryKey(kind) {
  switch (kind) {
    case RESUME_STORAGE_KIND.MISSING: return 'missing';
    case RESUME_STORAGE_KIND.PRIVATE_LOCAL:
    case RESUME_STORAGE_KIND.PRIVATE_CLOUDINARY:
      return 'alreadyPrivate';
    case RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC: return 'legacyLocal';
    case RESUME_STORAGE_KIND.LEGACY_CLOUDINARY_PUBLIC: return 'legacyCloudinary';
    case RESUME_STORAGE_KIND.LEGACY_REMOTE_PUBLIC: return 'legacyRemote';
    default: return 'unknown';
  }
}

function computeAgeDays(application) {
  const ts = application?.appliedDate || application?.createdAt;
  if (!ts) return null;
  const ms = Date.now() - new Date(ts).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function ageBand(days) {
  if (days == null) return 'unknown_age';
  if (days < 30) return 'lt_30d';
  if (days <= 90) return 'd30_90';
  return 'gt_90d';
}

/**
 * Production mutation requires double opt-in; dry-run never requires mutation guards.
 * @param {{ execute?: boolean, allowProduction?: boolean }} opts execute=true for migrate or cleanup apply
 */
export function assertMigrationExecutionAllowed({
  execute = false,
  allowProduction = false,
} = {}) {
  if (!execute) {
    return { ok: true, dryRun: true };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    if (process.env.ALLOW_LEGACY_RESUME_MIGRATION !== '1') {
      return { ok: false, error: 'production_guard_missing', dryRun: false };
    }
    if (!allowProduction) {
      return { ok: false, error: 'production_allow_flag_missing', dryRun: false };
    }
    if (!isApplicationResumeCloudinaryConfigured()) {
      return { ok: false, error: 'cloudinary_not_configured', dryRun: false };
    }
  }

  return { ok: true, dryRun: false };
}

/** @param {string|undefined} raw */
export function parseMigrationLimitArg(raw) {
  if (raw == null || raw === '') return { ok: true, limit: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    return { ok: false, error: 'invalid_limit', limit: null };
  }
  return { ok: true, limit: n };
}

export function getCurrentReportEnvironment() {
  const mongo = resolveMongoTarget();
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoFingerprintSha256: mongo.fingerprintSha256,
    isLocalDevelopmentTarget: mongo.isLocalDevelopmentTarget,
  };
}

export function buildMigrationReportEnvelope({
  migrationRunId,
  mode,
  dryRun,
  summary,
  ageBands,
  journal,
}) {
  const env = getCurrentReportEnvironment();
  return {
    reportVersion: LEGACY_RESUME_MIGRATION_REPORT_VERSION,
    migrationRunId: migrationRunId || createMigrationRunId(),
    generatedAt: new Date().toISOString(),
    environment: {
      nodeEnv: env.nodeEnv,
      mongoFingerprintSha256: env.mongoFingerprintSha256,
      isLocalDevelopmentTarget: env.isLocalDevelopmentTarget,
    },
    mode,
    dryRun,
    summary,
    ageBands,
    journal: journal.map(sanitizeJournalEntryForReport),
  };
}

function sanitizeJournalEntryForReport(entry) {
  return {
    applicationId: entry.applicationId,
    opaqueId: entry.opaqueId,
    status: entry.status,
    legacyKind: entry.legacyKind,
    reason: entry.reason,
    cleanupEligible: entry.cleanupEligible,
    legacySourceFingerprint: entry.legacySourceFingerprint,
    destinationFingerprint: entry.destinationFingerprint,
    cleanupMeta: entry.cleanupMeta
      ? {
        type: entry.cleanupMeta.type,
        key: entry.cleanupMeta.key,
        cloudName: entry.cleanupMeta.cloudName,
        publicId: entry.cleanupMeta.publicId,
      }
      : undefined,
  };
}

/**
 * Revalidate cleanup against live DB — report is checkpoint input only.
 * @param {object} journalEntry
 * @param {{ resumeURL?: string|null }} application
 */
export function revalidateCleanupAgainstDatabase(journalEntry, application) {
  const shape = validateCleanupJournalEntryShape(journalEntry);
  if (!shape.ok) return shape;

  if (!application) {
    return { ok: false, error: 'application_not_found' };
  }

  const currentKind = classifyResumeForMigration(application.resumeURL);
  if (currentKind !== RESUME_STORAGE_KIND.PRIVATE_LOCAL
    && currentKind !== RESUME_STORAGE_KIND.PRIVATE_CLOUDINARY) {
    return { ok: false, error: 'db_still_legacy' };
  }

  const currentFp = descriptorFingerprint(application.resumeURL);
  if (currentFp !== journalEntry.destinationFingerprint) {
    return { ok: false, error: 'destination_fingerprint_mismatch' };
  }

  if (journalEntry.cleanupMeta.type === 'legacy_local') {
    if (journalEntry.legacyKind !== RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC) {
      return { ok: false, error: 'legacy_kind_mismatch' };
    }
    const key = journalEntry.cleanupMeta.key;
    if (!key || legacySourceFingerprint({ type: 'legacy_local', key }) !== journalEntry.legacySourceFingerprint) {
      return { ok: false, error: 'legacy_source_mismatch' };
    }
    return { ok: true };
  }

  if (journalEntry.cleanupMeta.type === 'legacy_cloudinary') {
    return { ok: false, error: 'cloudinary_manual_only' };
  }

  return { ok: false, error: 'unknown_cleanup_type' };
}

function inferMimeFromPath(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return 'application/octet-stream';
}

function inferOriginalName(filepath) {
  return path.basename(filepath) || 'resume.pdf';
}

/**
 * @typedef {object} MigrationDeps
 * @property {typeof uploadApplicationResumeFile} [uploadFn]
 * @property {typeof fetch} [fetchImpl]
 * @property {string} [uploadsRoot]
 * @property {string|null} [expectedCloudName]
 * @property {import('mongoose').Model} [ApplicationModel]
 */

/**
 * @param {import('mongoose').Document|{ _id: unknown, resumeURL?: string|null }} application
 * @param {{ execute?: boolean, deps?: MigrationDeps, journal?: Array<object> }} opts
 */
export async function migrateApplicationRecord(application, { execute = false, deps = {}, journal = [] } = {}) {
  const appId = application._id;
  const opaqueId = opaqueApplicationId(appId);
  const originalResumeURL = application.resumeURL ?? null;
  const inv = inventoryApplication(application);
  const baseEntry = {
    applicationId: String(appId),
    opaqueId,
    legacyKind: inv.kind,
    status: MIGRATION_RECORD_STATUS.SCANNED,
    at: new Date().toISOString(),
  };

  if (PRIVATE_KINDS.has(inv.kind)) {
    const entry = { ...baseEntry, status: MIGRATION_RECORD_STATUS.SKIPPED_ALREADY_PRIVATE };
    journal.push(entry);
    return { ...entry, summary: 'skippedAlreadyPrivate' };
  }
  if (inv.kind === RESUME_STORAGE_KIND.MISSING) {
    const entry = { ...baseEntry, status: MIGRATION_RECORD_STATUS.SKIPPED_MISSING };
    journal.push(entry);
    return { ...entry, summary: 'skippedMissing' };
  }
  if (UNKNOWN_KINDS.has(inv.kind)) {
    const entry = { ...baseEntry, status: MIGRATION_RECORD_STATUS.SKIPPED_UNKNOWN };
    journal.push(entry);
    return { ...entry, summary: 'skippedUnknown' };
  }
  if (!MIGRATABLE_KINDS.has(inv.kind)) {
    const entry = { ...baseEntry, status: MIGRATION_RECORD_STATUS.SKIPPED_NOT_ELIGIBLE };
    journal.push(entry);
    return { ...entry, summary: 'skippedUnknown' };
  }

  if (!execute) {
    const entry = { ...baseEntry, status: MIGRATION_RECORD_STATUS.SCANNED, dryRunCandidate: true };
    journal.push(entry);
    return { ...entry, summary: 'eligibleForMigration' };
  }

  const uploadFn = deps.uploadFn || uploadApplicationResumeFile;
  const uploadsRoot = deps.uploadsRoot || LEGACY_PUBLIC_UPLOADS_ROOT;
  const expectedCloudName = deps.expectedCloudName ?? process.env.CLOUDINARY_CLOUD_NAME ?? null;
  const ApplicationModel = deps.ApplicationModel || Application;

  try {
    let buffer;
    let originalname;
    let mimetype;

    if (inv.kind === RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC) {
      const resolved = resolveLegacyPublicUploadFile(originalResumeURL, uploadsRoot);
      if (!resolved.ok) {
        const entry = { ...baseEntry, status: MIGRATION_RECORD_STATUS.FAILED_SOURCE_READ, reason: resolved.error };
        journal.push(entry);
        return { ...entry, summary: 'failedSourceRead' };
      }
      try {
        buffer = await fs.readFile(resolved.filepath);
      } catch {
        const entry = { ...baseEntry, status: MIGRATION_RECORD_STATUS.FAILED_SOURCE_READ, reason: 'file_missing' };
        journal.push(entry);
        return { ...entry, summary: 'failedSourceRead' };
      }
      originalname = inferOriginalName(resolved.filepath);
      mimetype = inferMimeFromPath(resolved.filepath);
    } else if (inv.kind === RESUME_STORAGE_KIND.LEGACY_CLOUDINARY_PUBLIC) {
      const fetchImpl = deps.fetchImpl || globalThis.fetch;
      try {
        const fetched = await fetchTrustedLegacyCloudinaryResume(originalResumeURL, {
          expectedCloudName,
          fetchImpl,
        });
        buffer = fetched.buffer;
        originalname = `${fetched.publicId.split('/').pop() || 'resume'}.pdf`;
        mimetype = 'application/pdf';
      } catch (err) {
        const entry = {
          ...baseEntry,
          status: MIGRATION_RECORD_STATUS.FAILED_SOURCE_READ,
          reason: err.code || 'fetch_failed',
        };
        journal.push(entry);
        return { ...entry, summary: 'failedSourceRead' };
      }
    }

    try {
      mimetype = await validateResumeBuffer(buffer, mimetype);
    } catch (err) {
      const entry = {
        ...baseEntry,
        status: MIGRATION_RECORD_STATUS.FAILED_VALIDATION,
        reason: err.message || 'validation_failed',
      };
      journal.push(entry);
      return { ...entry, summary: 'failedValidation' };
    }

    let uploaded;
    try {
      uploaded = await uploadFn({ buffer, originalname, mimetype });
    } catch {
      const entry = { ...baseEntry, status: MIGRATION_RECORD_STATUS.FAILED_UPLOAD };
      journal.push(entry);
      return { ...entry, summary: 'failedUpload' };
    }

    const newDescriptor = uploaded.resumeURL;
    const updateResult = await ApplicationModel.updateOne(
      { _id: appId, resumeURL: originalResumeURL },
      { $set: { resumeURL: newDescriptor } }
    );
    if (!updateResult.modifiedCount) {
      const entry = { ...baseEntry, status: MIGRATION_RECORD_STATUS.DB_CONFLICT };
      journal.push(entry);
      return { ...entry, summary: 'dbConflict' };
    }

    const access = deps.verifyFn
      ? await deps.verifyFn({ resumeURL: newDescriptor })
      : await resolveEmployerApplicationResumeAccess({ resumeURL: newDescriptor });
    if (!access.ok) {
      await ApplicationModel.updateOne(
        { _id: appId, resumeURL: newDescriptor },
        { $set: { resumeURL: originalResumeURL } }
      );
      const entry = { ...baseEntry, status: MIGRATION_RECORD_STATUS.FAILED_VERIFY, reason: access.reason };
      journal.push(entry);
      return { ...entry, summary: 'failedVerify' };
    }

    const cleanupMeta = buildCleanupMeta(inv.kind, originalResumeURL, expectedCloudName);
    const entry = {
      ...baseEntry,
      status: MIGRATION_RECORD_STATUS.MIGRATED,
      cleanupEligible: true,
      cleanupMeta,
      legacySourceFingerprint: legacySourceFingerprint(cleanupMeta),
      destinationFingerprint: descriptorFingerprint(newDescriptor),
      storageKind: access.storageKind,
    };
    journal.push(entry);
    return { ...entry, summary: 'migrated', writesPerformed: 1 };
  } catch {
    const entry = { ...baseEntry, status: MIGRATION_RECORD_STATUS.FAILED_UPLOAD };
    journal.push(entry);
    return { ...entry, summary: 'failedUpload' };
  }
}

function buildCleanupMeta(kind, resumeURL, expectedCloudName) {
  if (kind === RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC) {
    const key = extractLegacyPublicUploadKey(resumeURL);
    return key ? { type: 'legacy_local', key } : null;
  }
  if (kind === RESUME_STORAGE_KIND.LEGACY_CLOUDINARY_PUBLIC) {
    const parsed = validateTrustedLegacyCloudinaryResumeUrl(resumeURL, { expectedCloudName });
    if (!parsed.ok) return null;
    return { type: 'legacy_cloudinary', publicId: parsed.publicId, cloudName: parsed.cloudName };
  }
  return null;
}

/**
 * @param {object} journalEntry from migrate report with cleanupEligible
 * @param {{ apply?: boolean, deps?: MigrationDeps, application?: { resumeURL?: string|null }|null }} opts
 */
export async function cleanupMigratedLegacyArtifact(
  journalEntry,
  { apply = false, deps = {}, application = null } = {}
) {
  const opaqueId = journalEntry.opaqueId || opaqueApplicationId(journalEntry.applicationId);
  const base = {
    applicationId: journalEntry.applicationId,
    opaqueId,
    status: MIGRATION_RECORD_STATUS.CLEANUP_REFUSED,
    at: new Date().toISOString(),
  };

  const dbCheck = revalidateCleanupAgainstDatabase(journalEntry, application);
  if (!dbCheck.ok) {
    if (dbCheck.error === 'cloudinary_manual_only') {
      return {
        ...base,
        status: MIGRATION_RECORD_STATUS.CLEANUP_MANUAL_REQUIRED,
        reason: 'cloudinary_revoke_requires_operator',
      };
    }
    return { ...base, status: MIGRATION_RECORD_STATUS.CLEANUP_REFUSED, reason: dbCheck.error };
  }

  const meta = journalEntry.cleanupMeta;
  if (meta.type === 'legacy_cloudinary') {
    return {
      ...base,
      status: MIGRATION_RECORD_STATUS.CLEANUP_MANUAL_REQUIRED,
      reason: 'cloudinary_revoke_requires_operator',
      publicIdHint: meta.publicId ? `…${String(meta.publicId).slice(-12)}` : null,
    };
  }

  if (!apply) {
    return { ...base, status: MIGRATION_RECORD_STATUS.CLEANUP_ELIGIBLE, dryRun: true };
  }

  if (meta.type === 'legacy_local') {
    const uploadsRoot = deps.uploadsRoot || LEGACY_PUBLIC_UPLOADS_ROOT;
    const resolved = resolveLegacyPublicUploadFile(`/uploads/${meta.key}`, uploadsRoot);
    if (!resolved.ok) {
      return { ...base, status: MIGRATION_RECORD_STATUS.CLEANUP_REFUSED, reason: resolved.error };
    }
    try {
      await fs.unlink(resolved.filepath);
      return { ...base, status: MIGRATION_RECORD_STATUS.CLEANUP_COMPLETED, deletionsPerformed: 1 };
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        return { ...base, status: MIGRATION_RECORD_STATUS.CLEANUP_ALREADY_ABSENT, deletionsPerformed: 0 };
      }
      return { ...base, status: MIGRATION_RECORD_STATUS.CLEANUP_REFUSED, reason: 'delete_failed' };
    }
  }

  return { ...base, status: MIGRATION_RECORD_STATUS.CLEANUP_MANUAL_REQUIRED, reason: 'unknown_source' };
}

/**
 * @param {{ batchSize?: number, limit?: number|null, execute?: boolean, cleanup?: boolean, deps?: MigrationDeps, onBatch?: Function }} opts
 */
export async function runLegacyResumeMigration({
  batchSize = 100,
  limit = null,
  execute = false,
  allowProduction = false,
  deps = {},
  journal = [],
} = {}) {
  const guard = assertMigrationExecutionAllowed({ execute, allowProduction });
  if (!guard.ok) {
    return { ok: false, error: guard.error, summary: createEmptySummary() };
  }

  const summary = createEmptySummary();
  const ageBands = { lt_30d: 0, d30_90: 0, gt_90d: 0, unknown_age: 0 };
  const ApplicationModel = deps.ApplicationModel || Application;
  const query = {};
  const cursor = ApplicationModel.find(query).select('_id resumeURL appliedDate createdAt').cursor();
  let migratedCount = 0;

  for await (const doc of cursor) {
    if (limit != null && summary.scanned >= limit) break;
    summary.scanned += 1;

    const inv = inventoryApplication(doc);
    summary[inv.summaryKey] = (summary[inv.summaryKey] || 0) + 1;
    const band = ageBand(inv.ageDays);
    ageBands[band] = (ageBands[band] || 0) + 1;

    if (inv.eligible) summary.eligibleForMigration += 1;

    const result = await migrateApplicationRecord(doc, { execute, deps, journal });
    if (result.writesPerformed) summary.writesPerformed += result.writesPerformed;
    if (result.status === MIGRATION_RECORD_STATUS.MIGRATED) {
      migratedCount += 1;
      summary.migrated += 1;
    } else if (result.status === MIGRATION_RECORD_STATUS.FAILED_SOURCE_READ) {
      summary.failedSourceRead += 1;
      summary.errors += 1;
    } else if (result.status === MIGRATION_RECORD_STATUS.FAILED_VALIDATION) {
      summary.failedValidation += 1;
      summary.errors += 1;
    } else if (result.status === MIGRATION_RECORD_STATUS.FAILED_UPLOAD) {
      summary.failedUpload += 1;
      summary.errors += 1;
    } else if (result.status === MIGRATION_RECORD_STATUS.FAILED_VERIFY) {
      summary.failedVerify += 1;
      summary.errors += 1;
    } else if (result.status === MIGRATION_RECORD_STATUS.DB_CONFLICT) {
      summary.dbConflict += 1;
      summary.errors += 1;
    }

    if (summary.scanned % batchSize === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return {
    ok: true,
    dryRun: !execute,
    mode: execute ? 'execute' : 'dry-run',
    summary,
    ageBands,
    journalCount: journal.length,
    migratedCount,
  };
}

/**
 * Cleanup processes report journal entries sequentially; report is the batch boundary.
 */
export async function runCleanupFromReport({
  report,
  apply = false,
  allowProduction = false,
  limit = null,
  deps = {},
  journal = [],
} = {}) {
  const guard = assertMigrationExecutionAllowed({ execute: apply, allowProduction });
  if (!guard.ok) {
    return { ok: false, error: guard.error, summary: createEmptySummary() };
  }

  const envCheck = validateReportEnvironmentBinding(report, getCurrentReportEnvironment());
  if (!envCheck.ok) {
    return { ok: false, error: envCheck.error, summary: createEmptySummary() };
  }

  const summary = createEmptySummary();
  const ApplicationModel = deps.ApplicationModel || Application;
  const entries = (report.journal || []).filter((e) => e.cleanupEligible);
  let processed = 0;

  for (const entry of entries) {
    if (limit != null && processed >= limit) break;
    processed += 1;
    summary.scanned += 1;

    const app = await ApplicationModel.findById(entry.applicationId).select('_id resumeURL').lean();
    const cleanupResult = await cleanupMigratedLegacyArtifact(entry, {
      apply,
      deps,
      application: app,
    });
    journal.push(cleanupResult);

    if (cleanupResult.deletionsPerformed) summary.deletionsPerformed += 1;
    if (cleanupResult.status === MIGRATION_RECORD_STATUS.CLEANUP_COMPLETED) summary.cleanupCompleted += 1;
    else if (cleanupResult.status === MIGRATION_RECORD_STATUS.CLEANUP_ALREADY_ABSENT) {
      summary.cleanupCompleted += 1;
    } else if (cleanupResult.status === MIGRATION_RECORD_STATUS.CLEANUP_REFUSED) summary.cleanupRefused += 1;
    else if (cleanupResult.status === MIGRATION_RECORD_STATUS.CLEANUP_MANUAL_REQUIRED) {
      summary.cleanupManualRequired += 1;
    } else if (cleanupResult.status === MIGRATION_RECORD_STATUS.CLEANUP_ELIGIBLE) {
      summary.cleanupEligible += 1;
    }
  }

  return {
    ok: true,
    dryRun: !apply,
    mode: apply ? 'cleanup-apply' : 'cleanup-dry-run',
    summary,
    journalCount: journal.length,
    migrationRunId: report.migrationRunId,
  };
}

export function loadAndValidateCleanupReport(rawReport) {
  const envelope = validateReportEnvelope(rawReport);
  if (!envelope.ok) return envelope;
  return validateReportEnvironmentBinding(rawReport, getCurrentReportEnvironment());
}

export function formatMigrationSummaryOutput(result) {
  const modeLabel = result.mode === 'cleanup-apply'
    ? 'CLEANUP APPLY'
    : result.mode === 'cleanup-dry-run'
      ? 'CLEANUP DRY RUN'
      : result.mode === 'execute'
        ? 'EXECUTE'
        : 'DRY RUN';
  const s = result.summary || createEmptySummary();
  const lines = [
    `Mode: ${modeLabel}`,
    `Scanned: ${s.scanned}`,
    `Already private: ${s.alreadyPrivate || 0}`,
    `Legacy local: ${s.legacyLocal || 0}`,
    `Legacy Cloudinary: ${s.legacyCloudinary || 0}`,
    `Unknown: ${s.unknown || 0}`,
    `Eligible for migration: ${s.eligibleForMigration || 0}`,
    `Writes performed: ${s.writesPerformed || 0}`,
    `Deletions performed: ${s.deletionsPerformed || 0}`,
  ];
  if (result.ageBands) {
    lines.push(`Age <30d: ${result.ageBands.lt_30d || 0}`);
    lines.push(`Age 30-90d: ${result.ageBands.d30_90 || 0}`);
    lines.push(`Age 90+d: ${result.ageBands.gt_90d || 0}`);
  }
  return lines.join('\n');
}

export const LegacyApplicationResumeMigration = {
  classifyResumeForMigration,
  inventoryApplication,
  migrateApplicationRecord,
  cleanupMigratedLegacyArtifact,
  revalidateCleanupAgainstDatabase,
  runLegacyResumeMigration,
  runCleanupFromReport,
  loadAndValidateCleanupReport,
  assertMigrationExecutionAllowed,
  parseMigrationLimitArg,
  buildMigrationReportEnvelope,
  getCurrentReportEnvironment,
  formatMigrationSummaryOutput,
  createEmptySummary,
  opaqueApplicationId,
  MIGRATION_RECORD_STATUS,
  LEGACY_PUBLIC_UPLOADS_ROOT,
};