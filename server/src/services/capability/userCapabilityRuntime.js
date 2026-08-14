/**
 * Runtime User capability service bound to Mongo persistence.
 * Request-scoped resolution is cached on `req` only — never across requests.
 */
import { User } from '../../models/User.js';
import { UserCapabilityGrant } from '../../models/capability/UserCapabilityGrant.js';
import { logAudit } from '../auditService.js';
import { createUserCapabilityService } from './userCapabilityService.js';
import { CAPABILITY_SCHEMA_VERSION } from '../../../../shared/capability/grantStatus.js';

const mongooseGrantStore = {
  async findByUser(userId) {
    return UserCapabilityGrant.find({ userId }).lean();
  },
  async findOne(userId, capability) {
    return UserCapabilityGrant.findOne({ userId, capability });
  },
  async upsert(doc) {
    if (doc._id) {
      await doc.save();
      return doc;
    }
    const existing = await UserCapabilityGrant.findOne({
      userId: doc.userId,
      capability: doc.capability,
    });
    if (existing) {
      Object.assign(existing, doc);
      await existing.save();
      return existing;
    }
    return UserCapabilityGrant.create(doc);
  },
};

async function markSchemaVersion(userId, version = CAPABILITY_SCHEMA_VERSION) {
  await User.updateOne({ _id: userId }, { $set: { capabilitySchemaVersion: version } });
}

async function loadUser(userId) {
  return User.findById(userId).select('role capabilitySchemaVersion').lean();
}

let singleton;

export function getUserCapabilityService() {
  if (!singleton) {
    singleton = createUserCapabilityService({
      grantStore: mongooseGrantStore,
      markSchemaVersion,
      loadUser,
      audit: logAudit,
    });
  }
  return singleton;
}

export async function resolveUserCapabilitiesForRequest(req) {
  if (req._userCapabilities) return req._userCapabilities;
  const service = getUserCapabilityService();
  const user = req.userRecord || {
    _id: req.user?.userId,
    userId: req.user?.userId,
    role: req.user?.role,
    accountStatus: req.user?.accountStatus,
    capabilitySchemaVersion: req.user?.capabilitySchemaVersion ?? 0,
  };
  req._userCapabilities = await service.resolveUserCapabilities(user);
  return req._userCapabilities;
}
