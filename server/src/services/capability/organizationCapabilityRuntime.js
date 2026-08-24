import { OrganizationCapabilityGrant } from '../../models/capability/OrganizationCapabilityGrant.js';
import { OrganizationVerification } from '../../models/OrganizationVerification.js';
import { logAudit } from '../auditService.js';
import { createOrganizationCapabilityService } from './organizationCapabilityService.js';
import { getOverrideService } from './overrideRuntime.js';
import { isBlocked, isSuspendedOrRevoked } from '../../../../shared/international/verification.js';
import { OVERRIDE_TYPES } from './overrideService.js';

const mongooseGrantStore = {
  async findByOrganization(organizationId) {
    return OrganizationCapabilityGrant.find({ organizationId }).lean();
  },
  async findOne(organizationId, capability) {
    return OrganizationCapabilityGrant.findOne({ organizationId, capability });
  },
  async upsert(doc) {
    if (doc.save) {
      await doc.save();
      return doc;
    }
    const existing = await OrganizationCapabilityGrant.findOne({
      organizationId: doc.organizationId,
      capability: doc.capability,
    });
    if (existing) {
      Object.assign(existing, doc);
      await existing.save();
      return existing;
    }
    return OrganizationCapabilityGrant.create(doc);
  },
};

let singleton;

export function getOrganizationCapabilityService() {
  if (!singleton) {
    singleton = createOrganizationCapabilityService({
      grantStore: mongooseGrantStore,
      audit: logAudit,
    });
  }
  return singleton;
}

export async function resolveOrganizationCapabilitiesForRequest(req, organization) {
  const cacheKey = `_orgCapabilities:${organization?._id || organization?.id || ''}`;
  if (req[cacheKey]) return req[cacheKey];
  const service = getOrganizationCapabilityService();
  const resolved = await service.resolveOrganizationCapabilities(organization);

  // Merge active super-admin override capabilities at the canonical decision boundary.
  // This is the single integration point — no route or controller duplicates this logic.
  const organizationId = organization?._id || organization?.organizationId || organization?.id;
  if (organizationId) {
    try {
      const overrideSvc = getOverrideService();
      const override = await overrideSvc.getActiveOverride(String(organizationId));
      if (override?.capabilities?.length) {
        // Hard deny gate: suspended and revoked are absolute — no override type lifts them.
        // REJECTED is a hard deny for manual_exception (and unknown types) but qa_test
        // overrides may bypass REJECTED so cross-role QA workflows can be exercised without
        // mutating verification truth.
        const verRecord = await OrganizationVerification.findOne(
          { organizationId },
          { status: 1 }
        ).lean();
        const isHardBlocked = override.overrideType === OVERRIDE_TYPES.QA_TEST
          ? isSuspendedOrRevoked(verRecord?.status)
          : isBlocked(verRecord?.status);
        if (!verRecord?.status || !isHardBlocked) {
          const extra = override.capabilities.filter((c) => !resolved.active.includes(c));
          if (extra.length) resolved.active = [...resolved.active, ...extra];
          resolved.overrideActive = true;
          resolved.overrideCapabilities = override.capabilities;
          resolved.override = override;
        }
      }
    } catch {
      // Override lookup failure must not block normal capability resolution.
    }
  }

  req[cacheKey] = resolved;
  return req[cacheKey];
}
