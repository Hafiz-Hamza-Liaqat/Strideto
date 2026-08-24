import { VerificationCapabilityOverride } from '../../models/VerificationCapabilityOverride.js';
import { logAudit } from '../auditService.js';
import { createOverrideService } from './overrideService.js';

const mongooseOverrideStore = {
  async findByOrganization(organizationId) {
    return VerificationCapabilityOverride.findOne({ organizationId })
      .sort({ grantedAt: -1 })
      .lean();
  },
  async save(doc) {
    const { _id, ...fields } = doc;
    if (_id) {
      return VerificationCapabilityOverride.findByIdAndUpdate(_id, fields, {
        new: true,
        lean: true,
      });
    }
    return VerificationCapabilityOverride.findOneAndUpdate(
      { organizationId: doc.organizationId },
      { $set: fields },
      { upsert: true, new: true, lean: true, setDefaultsOnInsert: true }
    );
  },
};

let singleton;

export function getOverrideService() {
  if (!singleton) {
    singleton = createOverrideService({
      overrideStore: mongooseOverrideStore,
      audit: logAudit,
    });
  }
  return singleton;
}
