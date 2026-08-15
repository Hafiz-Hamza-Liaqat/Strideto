/**
 * Explicit Business Client activation (Phase 17D-6).
 *
 * Grants only `business_client` via userCapabilityService.grantCapability.
 * Idempotent. Never auto-granted by registration/login/marketplace.
 */
import { USER_CAPABILITY_IDS } from '../../../../shared/capability/userCapabilities.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import { getUserCapabilityService } from '../capability/userCapabilityRuntime.js';
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';

const ACTIVATION_BODY_REJECT = Object.freeze([
  'capability',
  'grantStatus',
  'grantedBy',
  'staff',
  'role',
  'userId',
]);

export function assertActivationBodySafe(body) {
  if (body == null || body === '') return;
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(new Error('invalid_body'), { status: 400, code: 'invalid_body' });
  }
  for (const key of Object.keys(body)) {
    if (ACTIVATION_BODY_REJECT.includes(key)) {
      throw Object.assign(new Error('untrusted_field'), { status: 400, code: 'untrusted_field' });
    }
  }
}

export async function activateBusinessClient({ userId, actor = {}, body } = {}) {
  assertActivationBodySafe(body);
  if (!userId) {
    throw Object.assign(new Error('Authentication required'), { status: 401, code: 'unauthenticated' });
  }
  const service = getUserCapabilityService();
  const result = await service.grantCapability({
    userId,
    capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
    grantedBy: String(userId),
    grantReason: 'explicit_business_client_activation',
  });
  if (result.created !== false) {
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_BUSINESS_CLIENT_ACTIVATED,
      targetType: 'user_capability_grant',
      targetId: String(userId),
      metadata: redactAuditMetadata({
        capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
        idempotent: result.created === false,
      }),
    });
  } else {
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_BUSINESS_CLIENT_ACTIVATED,
      targetType: 'user_capability_grant',
      targetId: String(userId),
      metadata: redactAuditMetadata({
        capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
        idempotent: true,
      }),
    });
  }
  return {
    activated: true,
    capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
    status: GRANT_STATUSES.ACTIVE,
    idempotent: result.created === false,
  };
}

export async function getBusinessClientEnabled(userId) {
  const service = getUserCapabilityService();
  const grants = await service.listGrants(userId);
  const grant = (grants || []).find(
    (row) => row.capability === USER_CAPABILITY_IDS.BUSINESS_CLIENT && row.status === GRANT_STATUSES.ACTIVE
  );
  return {
    available: true,
    activated: Boolean(grant),
    capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
  };
}
