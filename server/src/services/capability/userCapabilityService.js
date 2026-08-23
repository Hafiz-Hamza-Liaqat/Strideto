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
  isCapabilitySchemaInitialized,
} from '../../../../shared/capability/grantStatus.js';
import {
  isKnownUserCapability,
  USER_CAPABILITY_IDS,
} from '../../../../shared/capability/userCapabilities.js';
import { classifyLegacyUserAccount, isLegacyStaffRole } from '../../../../shared/capability/legacyUserClassification.js';
import {
  CAPABILITY_INITIALIZATION_STATES,
  isCapabilityEraIncomplete,
} from '../../../../shared/capability/capabilityInitialization.js';
import {
  ROLE_CAPABILITY_TRANSITION_MODES,
  resolveRoleCapabilityTransitionMode,
} from '../../../../shared/capability/roleCapabilityTransition.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { PERMISSION_POLICY_VERSION } from '../../../../shared/capability/permissionPolicy.js';

export const REGISTRATION_AUTHORITY_INCOMPLETE = 'registration_authority_incomplete';

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
  'capabilityInitializationState',
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
  markInitializationState,
  loadUser,
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

  async function assertActiveStudentGrant(userId) {
    const grant = await grantStore.findOne(userId, USER_CAPABILITY_IDS.STUDENT);
    if (!grant || !grantStatusAuthorizes(grant.status)) {
      throw Object.assign(new Error('Student capability grant missing'), {
        status: 503,
        code: REGISTRATION_AUTHORITY_INCOMPLETE,
      });
    }
    return grant;
  }

  async function writeInitializationState(userId, state) {
    if (typeof markInitializationState === 'function') {
      await markInitializationState(userId, state);
    }
  }

  /**
   * Genuine Student registration: grant first, then mark schema initialized/ready.
   * Never mark ready/initialized without an active student grant.
   * On grant failure, mark `failed` so legacy fallback cannot apply.
   * Retry is safe because (userId, capability) is unique and active duplicates no-op.
   */
  async function initializeCustomerUser(user, provenance = {}) {
    const userId = user._id || user.userId;
    try {
      await grantCapability({
        userId,
        capability: USER_CAPABILITY_IDS.STUDENT,
        grantedBy: provenance.grantedBy || 'system:registration',
        grantReason: provenance.grantReason || 'student_registration',
      });
      await assertActiveStudentGrant(userId);
      if (typeof markSchemaVersion === 'function') {
        await markSchemaVersion(userId, CAPABILITY_SCHEMA_VERSION);
      }
    } catch (err) {
      try {
        const grant = await grantStore.findOne(userId, USER_CAPABILITY_IDS.STUDENT);
        if (!grant || !grantStatusAuthorizes(grant.status)) {
          await writeInitializationState(userId, CAPABILITY_INITIALIZATION_STATES.FAILED);
        }
      } catch {
        /* still rethrow the original initialization error */
      }
      throw err;
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

  /**
   * Server-authoritative role ↔ capability transition.
   * Does not grant student or business_client because role changed.
   * Uninitialized accounts are marked schema-initialized so legacy fallback
   * cannot reactivate after an administrative role mutation.
   */
  async function applyRoleTransitionCapabilities({
    userId,
    priorRole,
    newRole,
    mode,
    actor = 'system:role_change',
    user: userSnapshot,
  } = {}) {
    const resolvedMode = resolveRoleCapabilityTransitionMode(mode);
    let user = userSnapshot;
    if (!user && typeof loadUser === 'function') {
      user = await loadUser(userId);
    }
    if (!user) {
      throw Object.assign(new Error('User not found for capability transition'), {
        status: 404,
        code: 'user_not_found',
      });
    }

    const grants = await listGrants(userId);
    const preservedCapabilities = grants
      .filter((g) => grantStatusAuthorizes(g.status))
      .map((g) => g.capability);

    let schemaInitializedOnTransition = false;
    if (
      !isCapabilitySchemaInitialized(user.capabilitySchemaVersion) ||
      isCapabilityEraIncomplete(user)
    ) {
      if (typeof markSchemaVersion === 'function') {
        await markSchemaVersion(userId, CAPABILITY_SCHEMA_VERSION);
        schemaInitializedOnTransition = true;
      }
    }

    let studentSuspended = false;
    if (
      resolvedMode === ROLE_CAPABILITY_TRANSITION_MODES.MAKE_STAFF_ONLY &&
      isLegacyStaffRole(newRole) &&
      preservedCapabilities.includes(USER_CAPABILITY_IDS.STUDENT)
    ) {
      await setStatus({
        userId,
        capability: USER_CAPABILITY_IDS.STUDENT,
        status: GRANT_STATUSES.SUSPENDED,
        actor,
        reason: 'role_transition_make_staff_only',
      });
      studentSuspended = true;
    }

    const action = studentSuspended
      ? GBS_AUDIT_EVENTS.ROLE_TRANSITION_STAFF_ONLY
      : schemaInitializedOnTransition
        ? GBS_AUDIT_EVENTS.ROLE_TRANSITION_SCHEMA_INITIALIZED
        : GBS_AUDIT_EVENTS.ROLE_TRANSITION_CAPABILITIES_PRESERVED;

    await audit({
      action,
      targetType: 'user',
      targetId: String(userId),
      metadata: redactAuditMetadata({
        priorRole,
        newRole,
        mode: resolvedMode,
        preservedCapabilities,
        schemaInitializedOnTransition,
        grantedStudent: false,
        grantedBusinessClient: false,
        studentSuspended,
      }),
    });

    return {
      mode: resolvedMode,
      preservedCapabilities,
      schemaInitializedOnTransition,
      grantedStudent: false,
      grantedBusinessClient: false,
      studentSuspended,
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
    applyRoleTransitionCapabilities,
    assertActiveStudentGrant,
  };
}
