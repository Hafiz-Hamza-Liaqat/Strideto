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
import { resolveEmailDeliveryState } from '../emailDeliveryState.js';
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

export function isB2bEmailVerificationRequired(account) {
  if (!account) return false;
  if (account.emailVerified === true) return false;
  const from = new Date(B2B_EMAIL_VERIFY_ENFORCE_FROM);
  if (!Number.isNaN(from.getTime()) && account.createdAt && new Date(account.createdAt) < from) {
    return false;
  }
  return true;
}

export async function authDeliveryMode() {
  const state = await resolveEmailDeliveryState();
  return mapDeliveryStateToAuthMode(state.effectiveState);
}

export async function genericRegistrationResponse() {
  const emailMode = await authDeliveryMode();
  return registrationAcceptedPayload(emailMode, Math.round(VERIFY_TOKEN_TTL_MS / 60000));
}

export async function genericRecoveryResponse() {
  const emailMode = await authDeliveryMode();
  return recoveryAcceptedPayload(emailMode);
}

export async function issueRealmVerification(account, realm, name) {
  const rawToken = applyVerificationTokenFields(account);
  await account.save({ validateBeforeSave: false });
  const emailMode = await authDeliveryMode();
  if (emailMode === 'accepted') {
    await queueEmail({
      to: account.email,
      templateKey: 'emailVerification',
      vars: {
        name: name || account.email,
        url: buildVerifyEmailUrl(rawToken, realm),
        expiresMinutes: Math.round(VERIFY_TOKEN_TTL_MS / 60000),
      },
      dedupKey: `verify:${realm}:${account._id}:${Date.now()}`,
    });
  }
  return { emailMode, rawToken: undefined };
}

export async function resendRealmVerification(realm, email, req) {
  const Model = MODELS[realm];
  if (!Model) return { status: 400, body: { error: 'Invalid verification realm' } };
  const generic = {
    message: 'If an unverified account exists for this email, a verification challenge was accepted.',
    accepted: true,
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
    return { status: 200, body: generic };
  }
  await issueRealmVerification(account, realm, account.companyName || account.email);
  return { status: 200, body: { ...generic, emailMode: await authDeliveryMode() } };
}

export async function consumeRealmVerificationToken(realm, rawToken) {
  const Model = MODELS[realm];
  if (!Model) return { ok: false, code: 'INVALID_REALM' };
  const account = await Model.findOne({
    emailVerificationToken: hashVerificationToken(rawToken),
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires');
  if (!account) return { ok: false, code: 'INVALID_TOKEN' };
  account.emailVerified = true;
  account.emailVerifiedAt = new Date();
  clearVerificationTokenFields(account);
  await account.save({ validateBeforeSave: false });
  return { ok: true, realm, email: account.email };
}
