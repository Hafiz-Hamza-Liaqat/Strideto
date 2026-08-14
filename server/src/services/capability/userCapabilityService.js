/**
 * Auditable User capability grants (Phase 17D-1).
 *
 * Grants are additive. History is retained. Only status=active authorizes.
 * Request bodies cannot set grant metadata. No public self-grant for business_client.
 */
import {
  GRANT_STATUSES,
  grantStatusAuthorizes,
  CAPABILITY_SCHEMA_VERSION,
} from '../../../../shared/capability/grantStatus.js';
import {
  isKnownUserCapability,
  USER_CAPABILITY_IDS,
} from '../../../../shared/capability/userCapabilities.js';
import { classifyLegacyUserAccount } from '../../../../shared/capability/legacyUserClassification.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { PERMISSION_POLICY_VERSION } from '../../../../shared/capability/permissionPolicy.js';

const UNTRUSTED_GRANT_KEYS = Object.freeze([
  'capability',
  'capabilities',
  'grant',
  'grants',
  'grantedBy',
  'grantedAt',
  'grantReason',
  'policyVersion',
  'status',
  'capabilitySchemaVersion',
  'suspendedAt',
  'suspendedBy',
  'revokedAt',
  'revokedBy',
]);

export function stripUntrustedGrantFields(body = {}) {
  if (!body || typeof body !== 'object') return {};
  const out = { ...body };
  for (const key of UNTRUSTED_GRANT_KEYS) delete out[key];
  return out;
}

export function bodyAttemptsGrantMassAssignment(body = {}) {
  if (!body || typeof body !== 'object') return false;
  return UNTRUSTED_GRANT_KEYS.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

export function createMemoryGrantStore() {
  const rows = new Map();
  const keyOf = (userId, capability) => `${userId}:${capability}`;
  return {
    async findByUser(userId) {
      const out = [];
      for (const rec of rows.values()) {
        if (String(rec.userId) === String(userId)) out.push({ ...rec, history: [...(rec.history || [])] });
      }
      return out;
    },
    async findOne(userId, capability) {
      const rec = rows.get(keyOf(userId, capability));
      return rec ? { ...rec, history: [...(rec.history || [])] } : null;
    },
    async upsert(doc) {
      const key = keyOf(doc.userId, doc.capability);
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

export function createUserCapabilityService({
  grantStore,
  markSchemaVersion,
  audit = async () => {},
} = {}) {
  if (!grantStore) throw new Error('grantStore is required');

  async function listGrants(userId) {
    return grantStore.findByUser(userId);
  }

  async function grantCapability({
    userId,
    capability,
    grantedBy,
    grantReason,
    scope = {},
    policyVersion = PERMISSION_POLICY_VERSION,
  }) {
    if (!isKnownUserCapability(capability)) {
      const err = Object.assign(new Error('Unknown capability'), {
        status: 403,
        code: 'unknown_capability',
      });
      throw err;
    }
    const now = new Date();
    const existing = await grantStore.findOne(userId, capability);
    if (existing && existing.status === GRANT_STATUSES.ACTIVE) {
      return { grant: existing, created: false };
    }
    const grant = existing || {
      userId,
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
    grant.suspendedAt = null;
    grant.suspendedBy = '';
    grant.suspensionReason = '';
    grant.revokedAt = null;
    grant.revokedBy = '';
    grant.revocationReason = '';
    pushHistory(grant, {
      status: GRANT_STATUSES.ACTIVE,
      by: grant.grantedBy,
      reason: grant.grantReason,
      policyVersion,
    });
    const saved = await grantStore.upsert(grant);
    await audit({
      action: GBS_AUDIT_EVENTS.USER_CAPABILITY_GRANTED,
      targetType: 'user_capability_grant',
      targetId: String(userId),
      metadata: redactAuditMetadata({ capability, grantedBy: grant.grantedBy }),
    });
    return { grant: saved, created: !existing };
  }

  async function setStatus({ userId, capability, status, actor, reason }) {
    if (!isKnownUserCapability(capability)) {
      throw Object.assign(new Error('Unknown capability'), { status: 403, code: 'unknown_capability' });
    }
    const grant = await grantStore.findOne(userId, capability);
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
    const action =
      status === GRANT_STATUSES.SUSPENDED
        ? GBS_AUDIT_EVENTS.USER_CAPABILITY_SUSPENDED
        : GBS_AUDIT_EVENTS.USER_CAPABILITY_REVOKED;
    await audit({
      action,
      targetType: 'user_capability_grant',
      targetId: String(userId),
      metadata: redactAuditMetadata({ capability, actor }),
    });
    return saved;
  }

  async function resolveUserCapabilities(user) {
    const userId = user?._id || user?.userId || user?.id;
    const classification = classifyLegacyUserAccount(user);
    const grants = userId ? await listGrants(userId) : [];
    const persistedActive = grants
      .filter((g) => grantStatusAuthorizes(g.status))
      .map((g) => g.capability);

    if (classification.usePersistedGrants) {
      return {
        source: 'persisted',
        classification: classification.kind,
        grants,
        active: persistedActive,
      };
    }

    const active = [...persistedActive];
    if (classification.effectiveStudent && !active.includes(USER_CAPABILITY_IDS.STUDENT)) {
      active.push(USER_CAPABILITY_IDS.STUDENT);
    }
    return {
      source: 'legacy_compatibility',
      classification: classification.kind,
      grants,
      active,
      failClosed: classification.failClosed,
    };
  }

  function hasActiveUserCapability(resolved, capabilityId) {
    if (!isKnownUserCapability(capabilityId)) return false;
    return Array.isArray(resolved?.active) && resolved.active.includes(capabilityId);
  }

  async function initializeCustomerUser(user, provenance = {}) {
    const userId = user._id || user.userId;
    await grantCapability({
      userId,
      capability: USER_CAPABILITY_IDS.STUDENT,
      grantedBy: provenance.grantedBy || 'system:registration',
      grantReason: provenance.grantReason || 'student_registration',
    });
    if (typeof markSchemaVersion === 'function') {
      await markSchemaVersion(userId, CAPABILITY_SCHEMA_VERSION);
    }
  }

  async function initializeStaffUser(user, provenance = {}) {
    const userId = user._id || user.userId;
    if (typeof markSchemaVersion === 'function') {
      await markSchemaVersion(userId, CAPABILITY_SCHEMA_VERSION);
    }
    return {
      grantedStudent: false,
      grantedBy: provenance.grantedBy || 'system:staff_create',
    };
  }

  return {
    listGrants,
    grantCapability,
    setStatus,
    resolveUserCapabilities,
    hasActiveUserCapability,
    initializeCustomerUser,
    initializeStaffUser,
  };
}
