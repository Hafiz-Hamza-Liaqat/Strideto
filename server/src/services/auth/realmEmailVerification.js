import { User } from '../../models/User.js';
import { Employer } from '../../models/Employer.js';
import { AgentAccount } from '../../models/agent/AgentAccount.js';
import { InstitutionAccount } from '../../models/institution/InstitutionAccount.js';
import {
  applyVerificationTokenFields,
  B2B_EMAIL_VERIFY_ENFORCE_FROM,
  buildVerifyEmailUrl,
  clearVerificationTokenFields,
  hashVerificationToken,
  VERIFY_TOKEN_TTL_MS,
} from '../../utils/emailVerification.js';
import { queueEmail } from '../automationService.js';
import { isVerificationMailReady } from '../emailService.js';
import { resolveEmailDeliveryState } from '../emailDeliveryState.js';
import { logger } from '../../utils/logger.js';
import {
  mapDeliveryStateToAuthMode,
  registrationAcceptedPayload,
  recoveryAcceptedPayload,
} from '../../../../shared/auth/registrationPrivacy.js';

const MODELS = {
  user: User,
  employer: Employer,
  agent: AgentAccount,
  institution: InstitutionAccount,
};

const REISSUE_COOLDOWN_MS = 60_000;

export function isB2bEmailVerificationRequired(account) {
  if (!account) return false;
  if (account.emailVerified === true) return false;
  const from = new Date(B2B_EMAIL_VERIFY_ENFORCE_FROM);
  if (!Number.isNaN(from.getTime()) && account.createdAt && new Date(account.createdAt) < from) {
    return false;
  }
  return true;
}

/** Worker-aware mode for queued (non-secret) mail such as welcome. */
export async function authDeliveryMode() {
  const state = await resolveEmailDeliveryState();
  return mapDeliveryStateToAuthMode(state.effectiveState);
}

/**
 * User email verification delivery (registration + resend) — dedicated verification SMTP only.
 */
export async function verificationDeliveryMode() {
  return isVerificationMailReady() ? 'accepted' : 'unavailable';
}

/**
 * Password-reset and other sensitive non-verification mail — default transactional SMTP.
 * They must not wait for a worker heartbeat.
 */
export async function sensitiveTransactionalDeliveryMode() {
  const { isSmtpConfigured } = await import('../emailService.js');
  return isSmtpConfigured() ? 'accepted' : 'unavailable';
}

export async function genericRegistrationResponse() {
  const emailMode = await verificationDeliveryMode();
  return registrationAcceptedPayload(emailMode, Math.round(VERIFY_TOKEN_TTL_MS / 60000));
}

export async function genericRecoveryResponse() {
  const emailMode = await verificationDeliveryMode();
  return recoveryAcceptedPayload(emailMode);
}

export function canReissueVerification(account) {
  if (!account || account.emailVerified) return false;
  const exp = account.emailVerificationExpires;
  if (!exp) return true;
  const remaining = new Date(exp).getTime() - Date.now();
  if (Number.isNaN(remaining) || remaining <= 0) return true;
  return remaining < VERIFY_TOKEN_TTL_MS - REISSUE_COOLDOWN_MS;
}

function logAuthOutcome({ realm, outcome, delivery, accountId, requestId }) {
  logger.info('auth_identity_outcome', {
    realm,
    outcome,
    delivery,
    accountId: accountId ? String(accountId) : undefined,
    requestId,
  });
}

export async function issueRealmVerification(account, realm, name) {
  const rawToken = applyVerificationTokenFields(account);
  await account.save({ validateBeforeSave: false });
  const emailMode = await verificationDeliveryMode();
  let delivery = 'DELIVERY_NOT_CONFIGURED';
  if (emailMode === 'accepted') {
    const result = await queueEmail({
      to: account.email,
      templateKey: 'emailVerification',
      vars: {
        name: name || account.email,
        url: buildVerifyEmailUrl(rawToken, realm),
        expiresMinutes: Math.round(VERIFY_TOKEN_TTL_MS / 60000),
      },
      dedupKey: `verify:${realm}:${account._id}:${Date.now()}`,
    });
    if (result?.sent) delivery = 'DELIVERY_ACCEPTED';
    else if (result?.placeholder || !result?.smtpConfigured) delivery = 'DELIVERY_NOT_CONFIGURED';
    else delivery = 'DELIVERY_FAILED';
    if (delivery !== 'DELIVERY_ACCEPTED') {
      logger.warn('auth_verification_delivery_failed', {
        realm,
        accountId: String(account._id),
        delivery,
      });
    }
  }
  logAuthOutcome({
    realm,
    outcome: 'CHALLENGE_CREATED',
    delivery,
    accountId: account._id,
  });
  return { emailMode, delivery, rawToken: undefined };
}

export async function reissueUnverifiedIfAllowed(account, realm, name) {
  if (!canReissueVerification(account)) {
    logAuthOutcome({
      realm,
      outcome: 'CHALLENGE_RATE_LIMITED',
      accountId: account?._id,
    });
    return { reissued: false, emailMode: await verificationDeliveryMode() };
  }
  const result = await issueRealmVerification(account, realm, name);
  logAuthOutcome({
    realm,
    outcome: 'CHALLENGE_REISSUED',
    delivery: result.delivery,
    accountId: account._id,
  });
  return { reissued: true, ...result };
}

export async function resendRealmVerification(realm, email, req) {
  const Model = MODELS[realm];
  if (!Model) return { status: 400, body: { error: 'Invalid verification realm' } };
  const generic = await genericRegistrationResponse();
  const publicBody = {
    message: generic.message,
    accepted: true,
    emailMode: generic.emailMode,
  };
  const subjectId =
    req?.employer?.employerId || req?.agent?.agentAccountId || req?.institution?.institutionAccountId;
  let account = null;
  if (subjectId) {
    account = await Model.findById(subjectId).select('+emailVerificationToken +emailVerificationExpires');
  } else if (email) {
    account = await Model.findOne({ email }).select('+emailVerificationToken +emailVerificationExpires');
  } else {
    return { status: 400, body: { error: 'Email is required' } };
  }
  if (!account || account.emailVerified) {
    logAuthOutcome({ realm, outcome: 'ACCOUNT_ALREADY_PRESENT' });
    return { status: 200, body: publicBody };
  }
  await reissueUnverifiedIfAllowed(account, realm, account.companyName || account.email);
  return { status: 200, body: publicBody };
}

export async function consumeRealmVerificationToken(realm, rawToken) {
  const Model = MODELS[realm];
  if (!Model) return { ok: false, code: 'REALM_MISMATCH' };
  const hashed = hashVerificationToken(rawToken);
  const live = await Model.findOne({
    emailVerificationToken: hashed,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires');
  if (live) {
    live.emailVerified = true;
    live.emailVerifiedAt = new Date();
    clearVerificationTokenFields(live);
    await live.save({ validateBeforeSave: false });
    logAuthOutcome({ realm, outcome: 'VERIFICATION_COMPLETED', accountId: live._id });
    return { ok: true, realm, code: 'VERIFICATION_COMPLETED', accountId: live._id };
  }
  const stale = await Model.findOne({ emailVerificationToken: hashed }).select(
    '+emailVerificationToken +emailVerificationExpires'
  );
  if (stale) {
    logAuthOutcome({ realm, outcome: 'TOKEN_EXPIRED', accountId: stale._id });
    return { ok: false, code: 'TOKEN_EXPIRED' };
  }
  logAuthOutcome({ realm, outcome: 'TOKEN_INVALID' });
  return { ok: false, code: 'TOKEN_INVALID' };
}

export function publicEmailVerifyFailure(code) {
  if (code === 'TOKEN_EXPIRED') {
    return {
      status: 400,
      body: {
        error: 'This verification link is invalid or has expired. Request a new verification link.',
        code: 'INVALID_OR_EXPIRED',
      },
    };
  }
  if (code === 'TOKEN_INVALID' || code === 'ALREADY_USED') {
    return {
      status: 400,
      body: {
        error: 'This verification link can no longer be used. Request a new link if needed.',
        code: 'ALREADY_USED',
      },
    };
  }
  if (code === 'REALM_MISMATCH') {
    return {
      status: 400,
      body: {
        error: 'This verification link is invalid or has expired. Request a new verification link.',
        code: 'INVALID_OR_EXPIRED',
      },
    };
  }
  return {
    status: 400,
    body: {
      error: 'This verification link is invalid or has expired. Request a new verification link.',
      code: 'INVALID_OR_EXPIRED',
    },
  };
}
