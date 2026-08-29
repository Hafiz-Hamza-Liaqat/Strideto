/**
 * SEC-P1 migration report schema — checkpoint input, not deletion authority.
 */
import crypto from 'crypto';
import { RESUME_STORAGE_KIND } from './resumeStorageDescriptor.js';

export const LEGACY_RESUME_MIGRATION_REPORT_VERSION = 1;

export function createMigrationRunId() {
  return crypto.randomUUID();
}

/** @param {string} descriptor */
export function descriptorFingerprint(descriptor) {
  return crypto.createHash('sha256').update(String(descriptor || '')).digest('hex').slice(0, 16);
}

/** @param {{ type: string, key?: string, publicId?: string, cloudName?: string }} meta */
export function legacySourceFingerprint(meta) {
  if (!meta?.type) return null;
  if (meta.type === 'legacy_local') {
    const key = String(meta.key || '').replace(/\\/g, '/');
    return crypto.createHash('sha256').update(`legacy_local|${key}`).digest('hex').slice(0, 16);
  }
  if (meta.type === 'legacy_cloudinary') {
    return crypto
      .createHash('sha256')
      .update(`legacy_cloudinary|${meta.cloudName || ''}|${meta.publicId || ''}`)
      .digest('hex')
      .slice(0, 16);
  }
  return null;
}

/**
 * @param {object} report
 * @returns {{ ok: true, report: object } | { ok: false, error: string }}
 */
export function validateReportEnvelope(report) {
  if (!report || typeof report !== 'object') {
    return { ok: false, error: 'report_invalid' };
  }
  if (report.reportVersion !== LEGACY_RESUME_MIGRATION_REPORT_VERSION) {
    return { ok: false, error: 'report_version_unsupported' };
  }
  if (!report.migrationRunId || typeof report.migrationRunId !== 'string') {
    return { ok: false, error: 'report_missing_run_id' };
  }
  if (!report.environment || typeof report.environment !== 'object') {
    return { ok: false, error: 'report_missing_environment' };
  }
  if (!report.generatedAt) {
    return { ok: false, error: 'report_missing_timestamp' };
  }
  return { ok: true, report };
}

/**
 * @param {object} report
 * @param {{ nodeEnv?: string, mongoFingerprintSha256?: string|null }} current
 */
export function validateReportEnvironmentBinding(report, current) {
  const envelope = validateReportEnvelope(report);
  if (!envelope.ok) return envelope;

  const env = report.environment;
  const currentNodeEnv = current.nodeEnv || 'development';
  if (env.nodeEnv && env.nodeEnv !== currentNodeEnv) {
    return { ok: false, error: 'report_environment_mismatch' };
  }

  if (
    currentNodeEnv === 'production'
    && env.isLocalDevelopmentTarget === true
  ) {
    return { ok: false, error: 'report_dev_on_production' };
  }

  if (
    env.mongoFingerprintSha256
    && current.mongoFingerprintSha256
    && env.mongoFingerprintSha256 !== current.mongoFingerprintSha256
  ) {
    return { ok: false, error: 'report_database_mismatch' };
  }

  return { ok: true, report };
}

/**
 * Validate a journal entry shape for cleanup consideration (not authority).
 * @param {object} entry
 */
export function validateCleanupJournalEntryShape(entry) {
  if (!entry || typeof entry !== 'object') {
    return { ok: false, error: 'entry_invalid' };
  }
  if (!entry.applicationId) {
    return { ok: false, error: 'entry_missing_application_id' };
  }
  if (entry.status !== 'migrated') {
    return { ok: false, error: 'entry_not_migrated' };
  }
  if (!entry.cleanupEligible) {
    return { ok: false, error: 'entry_not_cleanup_eligible' };
  }
  if (!entry.destinationFingerprint) {
    return { ok: false, error: 'entry_missing_destination_fingerprint' };
  }
  if (!entry.legacySourceFingerprint) {
    return { ok: false, error: 'entry_missing_legacy_fingerprint' };
  }
  if (entry.legacyKind !== RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC
    && entry.legacyKind !== RESUME_STORAGE_KIND.LEGACY_CLOUDINARY_PUBLIC) {
    return { ok: false, error: 'entry_invalid_legacy_kind' };
  }
  if (!entry.cleanupMeta?.type) {
    return { ok: false, error: 'entry_missing_cleanup_meta' };
  }
  const metaFp = legacySourceFingerprint(entry.cleanupMeta);
  if (!metaFp || metaFp !== entry.legacySourceFingerprint) {
    return { ok: false, error: 'entry_cleanup_meta_tampered' };
  }
  return { ok: true, entry };
}
