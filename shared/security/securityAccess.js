/**
 * Normalized security-access decision (Phase 17D-1).
 *
 * usable | security_denied, with a safe reason code.
 * Global deny short-circuits before ordinary capability checks and can deny
 * READ, WRITE, DOWNLOAD, TRANSITION, GRANT, ADMINISTRATIVE ACTION.
 * Retention of data does not grant access.
 */
export const SECURITY_ACCESS = Object.freeze({
  USABLE: 'usable',
  SECURITY_DENIED: 'security_denied',
});

export const SECURITY_DENY_REASONS = Object.freeze({
  ACCOUNT_SUSPENDED: 'account_suspended',
  ACCOUNT_DISABLED: 'account_disabled',
  ORGANIZATION_SUSPENDED: 'organization_suspended',
  ORGANIZATION_ARCHIVED: 'organization_archived',
  PRINCIPAL_MISSING: 'principal_missing',
});

export const SECURITY_DENIED_ACTIONS = Object.freeze([
  'READ',
  'WRITE',
  'DOWNLOAD',
  'TRANSITION',
  'GRANT',
  'ADMINISTRATIVE_ACTION',
]);

export function isSecurityDeniedAction(action) {
  return SECURITY_DENIED_ACTIONS.includes(action);
}

/**
 * Normalize existing accountStatus / organization status fields.
 * Does not invent a second suspension system.
 *
 * @param {{ accountStatus?: string, status?: string, disabled?: boolean, banned?: boolean }} principal
 */
export function resolveSecurityAccess(principal = {}) {
  if (!principal || typeof principal !== 'object') {
    return {
      decision: SECURITY_ACCESS.SECURITY_DENIED,
      reason: SECURITY_DENY_REASONS.PRINCIPAL_MISSING,
    };
  }

  if (principal.banned === true || principal.disabled === true) {
    return {
      decision: SECURITY_ACCESS.SECURITY_DENIED,
      reason: SECURITY_DENY_REASONS.ACCOUNT_DISABLED,
    };
  }

  const accountStatus = principal.accountStatus || principal.status;
  if (accountStatus === 'suspended') {
    const orgLike = principal.organizationType != null || principal.legalName != null;
    return {
      decision: SECURITY_ACCESS.SECURITY_DENIED,
      reason: orgLike
        ? SECURITY_DENY_REASONS.ORGANIZATION_SUSPENDED
        : SECURITY_DENY_REASONS.ACCOUNT_SUSPENDED,
    };
  }
  if (accountStatus === 'archived' || accountStatus === 'deleted') {
    return {
      decision: SECURITY_ACCESS.SECURITY_DENIED,
      reason:
        accountStatus === 'archived'
          ? SECURITY_DENY_REASONS.ORGANIZATION_ARCHIVED
          : SECURITY_DENY_REASONS.ACCOUNT_DISABLED,
    };
  }

  return { decision: SECURITY_ACCESS.USABLE, reason: null };
}

export function securityAccessAllows(decision) {
  return decision?.decision === SECURITY_ACCESS.USABLE;
}
