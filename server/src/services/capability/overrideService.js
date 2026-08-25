/**
 * Super-admin capability override service.
 *
 * Override records are SEPARATE from real verification evidence and grant state.
 * Evidence status (pending/approved/rejected) is never mutated here.
 * The override adds synthetic capability access for QA/exception purposes only;
 * it does not represent organic verification.
 */
import { isKnownOrganizationCapability } from '../../../../shared/capability/organizationCapabilities.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';

export const OVERRIDE_TYPES = Object.freeze({
  QA_TEST: 'qa_test',
  MANUAL_EXCEPTION: 'manual_exception',
});

export function createMemoryOverrideStore() {
  const rows = new Map();
  return {
    async findByOrganization(organizationId) {
      const row = rows.get(String(organizationId));
      return row ? { ...row } : null;
    },
    async save(doc) {
      const key = String(doc.organizationId);
      const existing = rows.get(key);
      // Preserve grantedAt when retrying an already-active grant so the
      // dedupeKey timestamp stays stable across retries.
      const saved = { ...doc };
      if (existing?.active && doc.active && existing.grantedAt) {
        saved.grantedAt = existing.grantedAt;
      }
      rows.set(key, saved);
      return { ...saved };
    },
  };
}

export function createOverrideService({ overrideStore, audit = async () => {}, notify = async () => {} } = {}) {
  if (!overrideStore) throw new Error('overrideStore is required');

  function isExpired(override) {
    if (!override?.expiresAt) return false;
    return new Date(override.expiresAt) < new Date();
  }

  async function getActiveOverride(organizationId) {
    const row = await overrideStore.findByOrganization(organizationId);
    if (!row || !row.active) return null;
    if (isExpired(row)) return null;
    return row;
  }

  async function hasOverrideForCapability(organizationId, capabilityId) {
    if (!isKnownOrganizationCapability(capabilityId)) return false;
    const override = await getActiveOverride(organizationId);
    if (!override) return false;
    return Array.isArray(override.capabilities) && override.capabilities.includes(capabilityId);
  }

  async function grantOverride({
    actorId,
    actorRole,
    organizationId,
    overrideType,
    reason,
    capabilities,
    expiresAt = null,
  }) {
    if (!Object.values(OVERRIDE_TYPES).includes(overrideType)) {
      throw Object.assign(new Error('Invalid overrideType'), { status: 400, code: 'invalid_override_type' });
    }
    if (!reason?.trim()) {
      throw Object.assign(new Error('Reason is required'), { status: 400, code: 'reason_required' });
    }
    if (!Array.isArray(capabilities) || capabilities.length === 0) {
      throw Object.assign(
        new Error('At least one capability must be selected'),
        { status: 400, code: 'capabilities_required' }
      );
    }
    for (const cap of capabilities) {
      if (!isKnownOrganizationCapability(cap)) {
        throw Object.assign(
          new Error(`Unknown capability: ${cap}`),
          { status: 400, code: 'unknown_capability' }
        );
      }
    }

    const existing = await overrideStore.findByOrganization(organizationId);
    const now = new Date();
    const doc = {
      ...(existing || {}),
      organizationId,
      overrideType,
      active: true,
      capabilities: [...new Set(capabilities)],
      reason: reason.trim(),
      grantedByUserId: String(actorId),
      grantedByRole: actorRole || '',
      grantedAt: now,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      revokedAt: null,
      revokedByUserId: null,
      revokeReason: '',
    };

    const saved = await overrideStore.save(doc);
    await audit({
      action: GBS_AUDIT_EVENTS.CAPABILITY_OVERRIDE_GRANTED,
      actor: { userId: actorId, role: actorRole },
      targetType: 'organization_capability_override',
      targetId: String(organizationId),
      metadata: redactAuditMetadata({
        overrideType,
        capabilities: doc.capabilities,
        expiresAt: doc.expiresAt,
      }),
      reason: doc.reason,
      before: existing
        ? { active: existing.active, capabilities: existing.capabilities }
        : null,
      after: { active: true, capabilities: doc.capabilities, expiresAt: doc.expiresAt },
    });
    await notify({
      action: 'granted',
      organizationId,
      overrideType,
      capabilities: saved.capabilities,
      expiresAt: saved.expiresAt,
      // Use the persisted grantedAt so the dedupeKey is stable on retry.
      grantedAt: saved.grantedAt,
    });
    return saved;
  }

  async function revokeOverride({ actorId, actorRole, organizationId, reason }) {
    if (!reason?.trim()) {
      throw Object.assign(
        new Error('Reason is required for revocation'),
        { status: 400, code: 'reason_required' }
      );
    }
    const existing = await overrideStore.findByOrganization(organizationId);
    if (!existing || !existing.active) {
      throw Object.assign(
        new Error('No active override to revoke'),
        { status: 404, code: 'override_not_found' }
      );
    }
    const now = new Date();
    const doc = {
      ...existing,
      active: false,
      revokedAt: now,
      revokedByUserId: String(actorId),
      revokeReason: reason.trim(),
    };
    const saved = await overrideStore.save(doc);
    await audit({
      action: GBS_AUDIT_EVENTS.CAPABILITY_OVERRIDE_REVOKED,
      actor: { userId: actorId, role: actorRole },
      targetType: 'organization_capability_override',
      targetId: String(organizationId),
      metadata: redactAuditMetadata({ revokedAt: now }),
      reason: reason.trim(),
      before: { active: true, capabilities: existing.capabilities },
      after: { active: false, revokedAt: now },
    });
    await notify({
      action: 'revoked',
      organizationId,
      overrideType: existing.overrideType,
      capabilities: existing.capabilities,
      revokedAt: now,
    });
    return saved;
  }

  return { grantOverride, revokeOverride, getActiveOverride, hasOverrideForCapability };
}
