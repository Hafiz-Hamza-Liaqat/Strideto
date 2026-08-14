/**
 * Auditable Organization capability grants (Phase 17D-1).
 *
 * organizationType is descriptive and does not authorize.
 * Do not silently grant business_client to employers.
 * Do not silently grant business_services_provider to agencies.
 */
import {
  GRANT_STATUSES,
  grantStatusAuthorizes,
  CAPABILITY_SCHEMA_VERSION,
} from '../../../../shared/capability/grantStatus.js';
import {
  isKnownOrganizationCapability,
} from '../../../../shared/capability/organizationCapabilities.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { PERMISSION_POLICY_VERSION } from '../../../../shared/capability/permissionPolicy.js';

const EVENT_BY_STATUS = {
  [GRANT_STATUSES.ACTIVE]: GBS_AUDIT_EVENTS.ORGANIZATION_CAPABILITY_GRANTED,
  [GRANT_STATUSES.SUSPENDED]: GBS_AUDIT_EVENTS.ORGANIZATION_CAPABILITY_SUSPENDED,
  [GRANT_STATUSES.REVOKED]: GBS_AUDIT_EVENTS.ORGANIZATION_CAPABILITY_REVOKED,
};

export function createMemoryOrganizationGrantStore() {
  const rows = new Map();
  const keyOf = (organizationId, capability) => `${organizationId}:${capability}`;
  return {
    async findByOrganization(organizationId) {
      const out = [];
      for (const rec of rows.values()) {
        if (String(rec.organizationId) === String(organizationId)) out.push({ ...rec, history: [...(rec.history || [])] });
      }
      return out;
    },
    async findOne(organizationId, capability) {
      const rec = rows.get(keyOf(organizationId, capability));
      return rec ? { ...rec, history: [...(rec.history || [])] } : null;
    },
    async upsert(doc) {
      const key = keyOf(doc.organizationId, doc.capability);
      const next = { ...doc, history: [...(doc.history || [])] };
      rows.set(key, next);
      return { ...next };
    },
  };
}

function pushHistory(grant, { status, by, reason, policyVersion }) {
  const history = Array.isArray(grant.history) ? grant.history : [];
  history.push({
    status,
    at: new Date(),
    by: by || '',
    reason: reason || '',
    policyVersion: policyVersion || PERMISSION_POLICY_VERSION,
  });
  grant.history = history;
}

export function createOrganizationCapabilityService({ grantStore, audit = async () => {} } = {}) {
  if (!grantStore) throw new Error('grantStore is required');

  async function resolveOrganizationCapabilities(organization) {
    const organizationId = organization?._id || organization?.organizationId || organization?.id;
    const grants = organizationId ? await grantStore.findByOrganization(organizationId) : [];
    const active = grants.filter((g) => grantStatusAuthorizes(g.status)).map((g) => g.capability);
    return { grants, active, source: 'persisted' };
  }

  function hasActiveOrganizationCapability(resolved, capabilityId) {
    if (!isKnownOrganizationCapability(capabilityId)) return false;
    return Array.isArray(resolved?.active) && resolved.active.includes(capabilityId);
  }

  async function grantCapability({
    organizationId,
    capability,
    grantedBy,
    grantReason,
    scope = {},
    policyVersion = PERMISSION_POLICY_VERSION,
  }) {
    if (!isKnownOrganizationCapability(capability)) {
      throw Object.assign(new Error('Unknown capability'), { status: 403, code: 'unknown_capability' });
    }
    const existing = await grantStore.findOne(organizationId, capability);
    if (existing && existing.status === GRANT_STATUSES.ACTIVE) {
      return { grant: existing, created: false };
    }
    const now = new Date();
    const grant = existing || {
      organizationId,
      capability,
      scope,
      history: [],
      schemaVersion: CAPABILITY_SCHEMA_VERSION,
    };
    grant.status = GRANT_STATUSES.ACTIVE;
    grant.grantedAt = now;
    grant.grantedBy = grantedBy || 'system';
    grant.grantReason = grantReason || '';
    grant.policyVersion = policyVersion;
    pushHistory(grant, {
      status: GRANT_STATUSES.ACTIVE,
      by: grant.grantedBy,
      reason: grant.grantReason,
      policyVersion,
    });
    const saved = await grantStore.upsert(grant);
    await audit({
      action: EVENT_BY_STATUS[GRANT_STATUSES.ACTIVE],
      targetType: 'organization_capability_grant',
      targetId: String(organizationId),
      metadata: redactAuditMetadata({ capability, grantedBy: grant.grantedBy }),
    });
    return { grant: saved, created: !existing };
  }

  async function setStatus({ organizationId, capability, status, actor, reason }) {
    if (!isKnownOrganizationCapability(capability)) {
      throw Object.assign(new Error('Unknown capability'), { status: 403, code: 'unknown_capability' });
    }
    const grant = await grantStore.findOne(organizationId, capability);
    if (!grant) {
      throw Object.assign(new Error('Grant not found'), { status: 404, code: 'grant_not_found' });
    }
    const now = new Date();
    grant.status = status;
    if (status === GRANT_STATUSES.SUSPENDED) {
      grant.suspendedAt = now;
      grant.suspendedBy = actor || '';
      grant.suspensionReason = reason || '';
    }
    if (status === GRANT_STATUSES.REVOKED) {
      grant.revokedAt = now;
      grant.revokedBy = actor || '';
      grant.revocationReason = reason || '';
    }
    pushHistory(grant, { status, by: actor, reason, policyVersion: grant.policyVersion });
    const saved = await grantStore.upsert(grant);
    await audit({
      action: EVENT_BY_STATUS[status],
      targetType: 'organization_capability_grant',
      targetId: String(organizationId),
      metadata: redactAuditMetadata({ capability, actor }),
    });
    return saved;
  }

  return {
    resolveOrganizationCapabilities,
    hasActiveOrganizationCapability,
    grantCapability,
    setStatus,
  };
}
