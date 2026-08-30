/**
 * Runtime social-identity service bound to Mongo persistence.
 *
 * Mirrors `services/capability/userCapabilityRuntime.js`: the pure,
 * dependency-injected service lives in `socialIdentityLinking.js` and is fully
 * testable without a database; this module is the only place that names the
 * real models. Provider-neutral — no provider adapter is wired here.
 */
import { User } from '../../models/User.js';
import { UserIdentity } from '../../models/UserIdentity.js';
import { ensureReferralCode } from '../../utils/referralCode.js';
import { getUserCapabilityService } from '../capability/userCapabilityRuntime.js';
import { createSocialIdentityLinkingService } from './socialIdentityLinking.js';

const mongooseIdentityStore = {
  async findByProviderSubject(provider, subject) {
    return UserIdentity.findOne({ provider, subject }).lean();
  },
  async findByUser(userId) {
    return UserIdentity.find({ userId }).lean();
  },
  async create(doc) {
    return UserIdentity.create(doc);
  },
};

const mongooseUserStore = {
  async findById(userId) {
    return User.findById(userId);
  },
  async findByEmail(email) {
    return User.findOne({ email });
  },
  async create(doc) {
    return User.create(doc);
  },
  async findByIdForCapabilityState(userId) {
    return User.findById(userId)
      .select('role capabilitySchemaVersion capabilityInitializationState')
      .lean();
  },
};

let singleton;

export function getSocialIdentityLinkingService() {
  if (!singleton) {
    singleton = createSocialIdentityLinkingService({
      identityStore: mongooseIdentityStore,
      userStore: mongooseUserStore,
      capabilityService: getUserCapabilityService(),
      ensureReferralCode,
    });
  }
  return singleton;
}
