/**
 * Runtime composition for the Google OIDC flow.
 *
 * Mirrors `socialIdentityRuntime.js` and `userCapabilityRuntime.js`: the pure,
 * dependency-injected pieces live in their own modules and are testable with
 * no network and no database; this is the only place that names the real
 * config, models, and session machinery.
 *
 * Built lazily so that importing the router never evaluates Google
 * configuration on a deployment where the feature is switched off.
 */
import { User } from '../../models/User.js';
import { UserIdentity } from '../../models/UserIdentity.js';
import { googleOidcConfig } from './googleOidcConfig.js';
import { googleIdTokenVerifier } from './googleIdTokenVerifier.js';
import { createGoogleOidcTransactionService } from './googleOidcTransaction.js';
import { createGoogleOidcFlows } from './googleOidcFlows.js';
import { userIdentityIndexReadiness } from './googleOidcIndexReadiness.js';
import { createAccessDenylistService } from './accessDenylist.js';
import { secureAuthConfig } from './secureAuthConfig.js';
import { userSecureAuthFlows } from './userSecureAuthFlows.js';
import { getSocialIdentityLinkingService } from './socialIdentityRuntime.js';

/**
 * Ordinary social login touches login timestamps and nothing else. Role,
 * capabilities, email, and name are never rewritten from provider data.
 */
async function recordLastLogin({ userId, identityId }) {
  const at = new Date();
  await User.updateOne({ _id: userId }, { $set: { lastLoginAt: at } });
  if (identityId) {
    await UserIdentity.updateOne({ _id: identityId }, { $set: { lastLoginAt: at } });
  }
}

let transactionSingleton;
let flowsSingleton;

export function getGoogleOidcTransactionService() {
  if (!transactionSingleton) {
    transactionSingleton = createGoogleOidcTransactionService({
      signingSecret: process.env.JWT_SECRET,
      mode: secureAuthConfig.mode,
      denylistService: createAccessDenylistService({
        requireSharedStore: secureAuthConfig.requireSharedDenylistStore || false,
      }),
    });
  }
  return transactionSingleton;
}

export function getGoogleOidcFlows() {
  if (!flowsSingleton) {
    flowsSingleton = createGoogleOidcFlows({
      config: googleOidcConfig,
      transactionService: getGoogleOidcTransactionService(),
      idTokenVerifier: googleIdTokenVerifier,
      socialIdentityService: getSocialIdentityLinkingService(),
      sessionFlows: userSecureAuthFlows,
      indexReadiness: userIdentityIndexReadiness,
      recordLastLogin,
    });
  }
  return flowsSingleton;
}
