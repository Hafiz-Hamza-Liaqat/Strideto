/**
 * Agent realm authentication controller (Mission 11).
 *
 * Mirrors employerAuthController.js for the agent realm.
 * Trusted-origin enforcement is composed at the route level.
 */
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { Organization } from '../models/Organization.js';
import { OrganizationVerification } from '../models/OrganizationVerification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logAudit } from '../services/auditService.js';
import { secureAuthConfig } from '../services/auth/secureAuthConfig.js';
import { agentSecureAuthFlows } from '../services/auth/agentSecureAuthFlows.js';
import { getOrCreateProfile } from '../services/agentProfileService.js';
import { ORGANIZATION_TYPES } from '../../../shared/international/organization.js';
import { ensureUniqueOrganizationSlug } from '../../../shared/international/organization.js';
import { normalizeCountryCode } from '../../../shared/international/country.js';
import { VERIFICATION_STATUSES } from '../../../shared/international/verification.js';
import { validateEmail, validatePassword, validateForgotPassword, validateResetPassword, validateChangePassword } from '../validators/authValidator.js';
import { legalAcceptanceMetadata, requireAcceptedTerms } from '../../../shared/legal/policyVersions.js';
import crypto from 'crypto';
import { hashResetToken } from '../utils/tokenStore.js';
import { queueEmail } from '../services/automationService.js';
import { isSmtpConfigured } from '../services/emailService.js';
import { frontendBaseUrl } from '../utils/emailVerification.js';

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const FRONTEND_BASE = frontendBaseUrl();
const GENERIC_RESET_MESSAGE =
  'If an account exists with this email, you will receive a password reset link shortly.';

function writeAgentRefreshCookie(res, token) {
  secureAuthConfig.cookiePolicy.writeRefreshCookie({ res, realm: 'agent', token });
}

function clearAgentRefreshCookie(res) {
  secureAuthConfig.cookiePolicy.clearRefreshCookie({ res, realm: 'agent' });
}

function toSafeAccount(account) {
  if (!account) return null;
  const a = account.toObject ? account.toObject() : { ...account };
  delete a.password;
  delete a.passwordResetToken;
  delete a.passwordResetExpires;
  return a;
}

async function issueSecureAgentSession(res, account) {
  const sessionResult = await agentSecureAuthFlows.issueLoginSession({
    subjectId: account._id.toString(),
    tokenVersion: account.tokenVersion,
  });
  if (sessionResult.code !== 'SESSION_ISSUED') {
    return { ok: false, status: sessionResult.httpStatus, body: sessionResult.body };
  }
  writeAgentRefreshCookie(res, sessionResult.refreshToken);
  return {
    ok: true,
    body: {
      account: toSafeAccount(account),
      accessToken: sessionResult.accessToken,
      expiresIn: '15m',
    },
  };
}

function readAgentRefreshCookie(req) {
  return secureAuthConfig.cookiePolicy.extractRefreshToken({
    cookieHeader: req.headers.cookie,
    realm: 'agent',
  });
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export function createAgentRegisterHandler({
  agentAccountModel = AgentAccount,
  organizationModel = Organization,
  agentMembershipModel = AgentMembership,
  organizationVerificationModel = OrganizationVerification,
  createProfile = getOrCreateProfile,
  writeAudit = logAudit,
  issueSession = issueSecureAgentSession,
} = {}) {
  return async (req, res) => {
  const { email, password, displayName, agentType, countryCode } = req.body || {};

  if (!email || !password || !displayName || !agentType) {
    return res.status(400).json({ error: 'email, password, displayName, and agentType are required' });
  }
  if (!requireAcceptedTerms(req.body)) {
    return res.status(400).json({ error: 'You must agree to the Terms of Service and Privacy Policy' });
  }

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';
  const normalizedCountryCode = countryCode ? normalizeCountryCode(countryCode) : '';
  const emailError = validateEmail(normalizedEmail);
  const passwordError = validatePassword(password, true);
  if (emailError) return res.status(422).json({ error: emailError });
  if (passwordError) return res.status(422).json({ error: passwordError });
  if (!normalizedDisplayName) return res.status(422).json({ error: 'Organization / professional name is required' });
  if (countryCode && !normalizedCountryCode) {
    return res.status(422).json({ error: 'countryCode must be a valid ISO 3166-1 alpha-2 code' });
  }

  const validTypes = [ORGANIZATION_TYPES.AGENT, ORGANIZATION_TYPES.AGENCY];
  if (!validTypes.includes(agentType)) {
    return res.status(400).json({ error: 'agentType must be agent or agency' });
  }

  const existing = await agentAccountModel.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ error: 'An Agent account with this email already exists' });
  }

  // Create the shared Organization identity first.
  const orgSlug = await ensureUniqueOrganizationSlug(
    normalizedDisplayName,
    (s) => organizationModel.exists({ slug: s })
  );

  const org = await organizationModel.create({
    organizationType: agentType,
    displayName: normalizedDisplayName,
    legalName: normalizedDisplayName,
    slug: orgSlug,
    countryCode: normalizedCountryCode || '',
    status: 'draft',
  });

  // Create AgentAccount
  const account = await agentAccountModel.create({
    email: normalizedEmail,
    password,
    ...legalAcceptanceMetadata(),
  });

  // Create profile linked to organization
  await createProfile(account._id, { organizationId: org._id, agentType });
  await agentMembershipModel.create({
    organizationId: org._id,
    agentAccountId: account._id,
    role: 'owner',
    active: true,
    joinedAt: new Date(),
  });

  await organizationVerificationModel.create({
    organizationId: org._id,
    organizationType: agentType,
    countryCode: normalizedCountryCode || '',
    status: VERIFICATION_STATUSES.DRAFT,
  });

  await writeAudit({
    action: 'agent_registered',
    actor: { userId: account._id, role: 'agent' },
    metadata: { organizationId: org._id, agentType },
  });

  const result = await issueSession(res, account);
  if (!result.ok) return res.status(result.status).json(result.body);
  return res.status(201).json(result.body);
  };
}

export const agentRegister = asyncHandler(createAgentRegisterHandler());

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const agentLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const account = await AgentAccount.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!account) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await account.comparePassword(password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (account.accountStatus === 'suspended') {
    return res.status(403).json({ error: 'Account is suspended' });
  }
  if (account.accountStatus === 'deleted') {
    return res.status(403).json({ error: 'Account not found' });
  }

  account.lastLoginAt = new Date();
  await account.save();

  const result = await issueSecureAgentSession(res, account);
  if (!result.ok) return res.status(result.status).json(result.body);
  return res.status(200).json(result.body);
});

// ---------------------------------------------------------------------------
// Me (authenticated self)
// ---------------------------------------------------------------------------

export const agentMe = asyncHandler(async (req, res) => {
  const account = await AgentAccount.findById(req.agent.agentAccountId).lean();
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const profile = await AgentProfile.findOne({ agentAccountId: account._id }).lean();

  return res.status(200).json({ account: toSafeAccount(account), profile: profile || null });
});

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

export const agentRefreshToken = asyncHandler(async (req, res) => {
  const cookieResult = readAgentRefreshCookie(req);
  const cookieToken =
    cookieResult.code === 'COOKIE_FOUND' ? cookieResult.token : null;

  const result = await agentSecureAuthFlows.refresh({
    cookieToken,
    origin: req.headers.origin,
    referer: req.headers.referer,
  });

  if (result.clearCookie) clearAgentRefreshCookie(res);
  if (result.httpStatus !== 200 && result.httpStatus !== 409) {
    return res.status(result.httpStatus).json(result.body);
  }
  if (result.httpStatus === 409) {
    return res.status(409).json(result.body);
  }

  writeAgentRefreshCookie(res, result.refreshToken);
  return res.status(200).json({
    accessToken: result.accessToken,
    expiresIn: '15m',
  });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export const agentLogout = asyncHandler(async (req, res) => {
  const result = await agentSecureAuthFlows.logoutCurrent({
    principal: req.agent,
    presentedAccessTokenExp: req.agent.exp,
    origin: req.headers.origin,
    referer: req.headers.referer,
  });

  if (result.clearCookie) clearAgentRefreshCookie(res);
  if (result.code !== 'LOGGED_OUT') {
    return res.status(result.httpStatus).json(result.body);
  }
  return res.status(200).json({ message: 'Logged out' });
});

export const agentLogoutAll = asyncHandler(async (req, res) => {
  const result = await agentSecureAuthFlows.logoutAll({
    principal: req.agent,
    presentedAccessTokenExp: req.agent.exp,
    origin: req.headers.origin,
    referer: req.headers.referer,
  });

  if (result.clearCookie) clearAgentRefreshCookie(res);
  if (result.code !== 'LOGGED_OUT_ALL') {
    return res.status(result.httpStatus).json(result.body);
  }
  return res.status(200).json({ message: 'Logged out from all devices' });
});

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------

export const agentChangePassword = asyncHandler(async (req, res) => {
  const { currentError, passwordError } = validateChangePassword(req.body);
  if (currentError || passwordError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: { currentPassword: currentError, newPassword: passwordError },
    });
  }
  const account = await AgentAccount.findById(req.agent.subjectId || req.agent.agentAccountId).select('+password');
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (!(await account.comparePassword(req.body.currentPassword))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const result = await agentSecureAuthFlows.changePassword({
    principal: req.agent,
    newPassword: req.body.newPassword,
    presentedAccessTokenExp: req.agent.exp,
  });

  if (result.clearCookie) clearAgentRefreshCookie(res);
  if (result.code !== 'PASSWORD_CHANGED') {
    return res.status(result.httpStatus).json(result.body || { error: 'Failed to change password' });
  }
  return res.status(200).json({ message: 'Password changed. Please log in again.' });
});

export const agentForgotPassword = asyncHandler(async (req, res) => {
  const { emailError } = validateForgotPassword(req.body);
  if (emailError) {
    return res.status(400).json({ error: 'Validation failed', details: { email: emailError } });
  }
  const email = req.body.email.trim().toLowerCase();
  const account = await AgentAccount.findOne({ email }).select('+passwordResetToken +passwordResetExpires');
  if (!account) return res.status(200).json({ message: GENERIC_RESET_MESSAGE });

  const token = crypto.randomBytes(32).toString('hex');
  account.passwordResetToken = hashResetToken(token);
  account.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
  await account.save({ validateBeforeSave: false });
  if (isSmtpConfigured()) {
    await queueEmail({
      to: account.email,
      templateKey: 'passwordReset',
      vars: {
        url: `${FRONTEND_BASE}/agent/reset-password?token=${encodeURIComponent(token)}`,
        expiresMinutes: 60,
      },
      dedupKey: `agent_password_reset:${account._id}:${Date.now()}`,
    });
  }
  return res.status(200).json({ message: GENERIC_RESET_MESSAGE });
});

export const agentResetPassword = asyncHandler(async (req, res) => {
  const { tokenError, passwordError } = validateResetPassword(req.body);
  if (tokenError || passwordError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: { token: tokenError, password: passwordError },
    });
  }
  const result = await agentSecureAuthFlows.resetPassword({
    hashedToken: hashResetToken(req.body.token.trim()),
    newPassword: req.body.password,
  });
  if (result.code !== 'PASSWORD_RESET') {
    if (result.code === 'STORAGE_FAILURE') {
      return res.status(result.httpStatus).json(result.body);
    }
    return res.status(400).json({
      error: 'Invalid or expired reset link. Please request a new password reset.',
    });
  }
  clearAgentRefreshCookie(res);
  return res.status(200).json({
    message: 'Password reset successfully. You can now sign in with your new password.',
  });
});
