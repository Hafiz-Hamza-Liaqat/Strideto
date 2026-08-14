import { assertExpectedVersion } from '../../../../shared/platform/optimisticConcurrency.js';
import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';

/**
 * Atomically apply a ProviderCapability mutation when expectedVersion matches.
 * Stale writes throw 409 and emit optimistic_concurrency_conflict.
 */
export async function mutateProviderCapabilityRecord({
  id,
  expectedVersion,
  apply,
  actor = {},
}) {
  const doc = await ProviderCapability.findById(id);
  if (!doc) {
    throw Object.assign(new Error('ProviderCapability not found'), {
      status: 404,
      code: 'provider_capability_not_found',
    });
  }
  let nextVersion;
  try {
    nextVersion = assertExpectedVersion(doc.recordVersion, expectedVersion);
  } catch (err) {
    if (err.code === 'optimistic_concurrency_conflict') {
      await logAudit({
        action: GBS_AUDIT_EVENTS.OPTIMISTIC_CONCURRENCY_CONFLICT,
        status: 'failure',
        targetType: 'ProviderCapability',
        targetId: String(id),
        metadata: redactAuditMetadata({
          expectedVersion,
          currentVersion: doc.recordVersion,
        }),
        actor,
      });
    }
    throw err;
  }

  apply(doc);
  doc.recordVersion = nextVersion;
  try {
    await doc.save();
  } catch (err) {
    if (err?.name === 'VersionError') {
      const conflict = Object.assign(new Error('Conflict'), {
        status: 409,
        code: 'optimistic_concurrency_conflict',
      });
      throw conflict;
    }
    throw err;
  }
  return doc;
}
