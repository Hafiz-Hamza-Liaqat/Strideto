import { authorizeListingScopeAgainstCapabilities } from '../../../../shared/gbs/listingScope.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';

export function authorizeProviderListingScope(requested, capabilities, { audit = logAudit } = {}) {
  const decision = authorizeListingScopeAgainstCapabilities(requested, capabilities);
  if (!decision.allowed && typeof audit === 'function') {
    Promise.resolve(
      audit({
        action: GBS_AUDIT_EVENTS.LISTING_SCOPE_DENIED,
        status: 'failure',
        metadata: redactAuditMetadata({
          reason: decision.reason,
          subjectType: requested.subjectType,
          subjectId: requested.subjectId,
        }),
      })
    ).catch(() => {});
  }
  return decision;
}
