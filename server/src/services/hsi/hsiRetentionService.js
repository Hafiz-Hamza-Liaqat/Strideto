/**
 * Retention class mechanics. Durations are never guessed.
 * Missing production policy → HSI capability fail-closed.
 */
import { VaultDocumentVersion } from '../../models/vault/VaultDocumentVersion.js';
import { HSI_RETENTION_CLASSES, HSI_STORAGE_CLASSES } from '../../../../shared/gbs/hsiSecurity.js';
import { parseHsiRetentionPolicy } from '../../config/hsiSecurityConfig.js';
import { deleteHsiObject } from './minioOpaqueStorageAdapter.js';
import { logRequiredHsiAudit } from './hsiAudit.js';
import { GBS_AUDIT_EVENTS } from '../../../../shared/security/gbsAuditEvents.js';

export function resolveRetentionDurationSeconds(retentionClass, env = process.env) {
  const policy = parseHsiRetentionPolicy(env);
  if (!policy.ready) return null;
  const n = policy.durationsSeconds?.[retentionClass];
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function retentionEligibleAt(retentionClass, from, env = process.env) {
  const seconds = resolveRetentionDurationSeconds(retentionClass, env);
  if (seconds == null) return null;
  return new Date(new Date(from).getTime() + seconds * 1000);
}

export async function markRejectedForMalwareRetention(version, { now = new Date(), env = process.env } = {}) {
  const eligibleAt = retentionEligibleAt(HSI_RETENTION_CLASSES.SCANNER_REJECTED_MALWARE, now, env);
  await VaultDocumentVersion.updateOne(
    { _id: version._id },
    {
      $set: {
        retentionClass: HSI_RETENTION_CLASSES.SCANNER_REJECTED_MALWARE,
        retentionEligibleAt: eligibleAt,
      },
    }
  );
  return eligibleAt;
}

export async function destroyExpiredHsiCiphertext({
  client,
  version,
  actor = {},
} = {}) {
  const bucket = version.storageClass === HSI_STORAGE_CLASSES.CLEAN
    ? version.cleanBucket
    : version.quarantineBucket;
  if (version.storageKey && bucket) {
    await deleteHsiObject(client, { bucket, key: version.storageKey });
  }
  const updated = await VaultDocumentVersion.findOneAndUpdate(
    {
      _id: version._id,
      destroyedAt: null,
      retentionEligibleAt: { $lte: new Date() },
    },
    {
      $set: {
        storageClass: HSI_STORAGE_CLASSES.DESTROYED,
        destroyedAt: new Date(),
        storageKey: version.storageKey,
      },
    },
    { new: true }
  );
  if (!updated) return null;
  await logRequiredHsiAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_HSI_DOCUMENT_DESTROYED,
    targetType: 'VaultDocumentVersion',
    targetId: String(version._id),
    metadata: {
      checksum: version.checksum,
      scanStatus: version.scanStatus,
      retentionClass: version.retentionClass,
      verdictEngine: version.scanEngine,
    },
  });
  return updated;
}

export async function purgeEligibleHsiObjects({ client, env = process.env, now = new Date(), actor = {} } = {}) {
  const rows = await VaultDocumentVersion.find({
    retentionClass: HSI_RETENTION_CLASSES.SCANNER_REJECTED_MALWARE,
    retentionEligibleAt: { $lte: now },
    destroyedAt: null,
  }).lean();
  const destroyed = [];
  for (const row of rows) {
    if (!resolveRetentionDurationSeconds(row.retentionClass, env)) continue;
    const out = await destroyExpiredHsiCiphertext({ client, version: row, actor });
    if (out) destroyed.push(String(out._id));
  }
  return destroyed;
}
