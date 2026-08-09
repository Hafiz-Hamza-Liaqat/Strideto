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
import { asyncHandler } from '../utils/asyncHandler.js';
import { logAudit } from '../services/auditService.js';
import { secureAuthConfig } from '../services/auth/secureAuthConfig.js';
import { agentSecureAuthFlows } from '../services/auth/agentSecureAuthFlows.js';
import { getOrCreateProfile } from '../services/agentProfileService.js';
import { ORGANIZATION_TYPES } from '../../../shared/international/organization.js';
import { ensureUniqueOrganizationSlug } from '../../../shared/international/organization.js';

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
  return secureAuthConfig.cookiePolicy.readRefreshCookie({ req, realm: 'agent' });
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export const agentRegister = asyncHandler(async (req, res) => {
  const { email, password, displayName, agentType, countryCode } = req.body || {};

  if (!email || !password || !displayName || !agentType) {
    return res.status(400).json({ error: 'email, password, displayName, and agentType are required' });
  }

  const validTypes = [ORGANIZATION_TYPES.AGENT, ORGANIZATION_TYPES.AGENCY];
  if (!validTypes.includes(agentType)) {
    return res.status(400).json({ error: 'agentType must be agent or agency' });
  }

  const existing = await AgentAccount.findOne({ email: email.trim().toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  // Create the shared Organization identity first.
  const orgSlug = await ensureUniqueOrganizationSlug(
    displayName,
    (s) => Organization.exists({ slug: s })
  );

  const org = await Organization.create({
    organizationType: agentType,
    displayName: displayName.trim(),
    legalName: displayName.trim(),
    slug: orgSlug,
    countryCode: (countryCode || '').toUpperCase(),
    status: 'draft',
  });

  // Create AgentAccount
  const account = await AgentAccount.create({
    email: email.trim().toLowerCase(),
    password,
  });

  // Create profile linked to organization
  await getOrCreateProfile(account._id, { organizationId: org._id, agentType });
  await AgentMembership.create({
    organizationId: org._id,
    agentAccountId: account._id,
    role: 'owner',
    active: true,
    joinedAt: new Date(),
  });

  await logAudit({
    action: 'agent_registered',
    actor: { userId: account._id, role: 'agent' },
    metadata: { organizationId: org._id, agentType },
  });

  const result = await issueSecureAgentSession(res, account);
  if (!result.ok) return res.status(result.status).json(result.body);
  return res.status(201).json(result.body);
});

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
    cookieResult.code === 'COOKIE_FOUND' ? cookieResult.value : null;

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
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }

  const result = await agentSecureAuthFlows.changePassword({
    principal: req.agent,
    newPassword,
    presentedAccessTokenExp: req.agent.exp,
  });

  if (result.clearCookie) clearAgentRefreshCookie(res);
  if (result.code !== 'PASSWORD_CHANGED') {
    return res.status(result.httpStatus).json(result.body || { error: 'Failed to change password' });
  }
  return res.status(200).json({ message: 'Password changed. Please log in again.' });
});
