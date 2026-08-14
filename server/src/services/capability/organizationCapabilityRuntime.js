import { OrganizationCapabilityGrant } from '../../models/capability/OrganizationCapabilityGrant.js';
import { logAudit } from '../auditService.js';
import { createOrganizationCapabilityService } from './organizationCapabilityService.js';

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
  req[cacheKey] = await service.resolveOrganizationCapabilities(organization);
  return req[cacheKey];
}
