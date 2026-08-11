/**
 * Institution realm authentication controller (Mission 18).
 *
 * Mirrors agentAuthController.js for the 'institution' realm.
 * Isolated from User, Employer, Agent realms.
 *
 * Security boundaries enforced at route level:
 *   - secureTrustedOrigin on auth mutations
 *   - requireInstitutionAuth on portal routes
 *   - User/Employer/Agent cannot invoke Institution mutations
 */
import { InstitutionAccount } from '../models/institution/InstitutionAccount.js';
import { InstitutionMembership } from '../models/institution/InstitutionMembership.js';
import { InstitutionProfile } from '../models/institution/InstitutionProfile.js';
import { OrganizationVerification } from '../models/OrganizationVerification.js';
import { Organization } from '../models/Organization.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logAudit } from '../services/auditService.js';
import { secureAuthConfig } from '../services/auth/secureAuthConfig.js';
import { institutionSecureAuthFlows } from '../services/auth/institutionSecureAuthFlows.js';
import {
  ensureUniqueOrganizationSlug,
  ORGANIZATION_TYPES as _ORGANIZATION_TYPES,
} from '../../../shared/international/organization.js';
import {
  INSTITUTION_ROLES,
  isInstitutionOrgType,
} from '../../../shared/institution/institutionPortal.js';
import { VERIFICATION_STATUSES } from '../../../shared/international/verification.js';
import { normalizeCountryCode } from '../../../shared/international/country.js';
import { validateEmail, validatePassword } from '../validators/authValidator.js';

function writeInstitutionRefreshCookie(res, token) {
  secureAuthConfig.cookiePolicy.writeRefreshCookie({ res, realm: 'institution', token });
}

function clearInstitutionRefreshCookie(res) {
  secureAuthConfig.cookiePolicy.clearRefreshCookie({ res, realm: 'institution' });
}

function readInstitutionRefreshCookie(req) {
  return secureAuthConfig.cookiePolicy.extractRefreshToken({
    cookieHeader: req.headers.cookie,
    realm: 'institution',
  });
}

function toSafeAccount(account) {
  if (!account) return null;
  const a = account.toObject ? account.toObject() : { ...account };
  delete a.password;
  delete a.passwordResetToken;
  delete a.passwordResetExpires;
  return a;
}

async function issueInstitutionSession(res, account) {
  const sessionResult = await institutionSecureAuthFlows.issueLoginSession({
    subjectId: account._id.toString(),
    tokenVersion: account.tokenVersion,
  });
  if (sessionResult.code !== 'SESSION_ISSUED') {
    return { ok: false, status: sessionResult.httpStatus, body: sessionResult.body };
  }
  writeInstitutionRefreshCookie(res, sessionResult.refreshToken);
  return {
    ok: true,
    body: { account: toSafeAccount(account), accessToken: sessionResult.accessToken, expiresIn: '15m' },
  };
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export const institutionRegister = asyncHandler(async (req, res) => {
  const { email, password, displayName, institutionType, countryCode } = req.body || {};

  if (!email || !password || !displayName || !institutionType) {
    return res.status(400).json({ error: 'email, password, displayName, and institutionType are required' });
  }

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';
  const normalizedCountryCode = countryCode ? normalizeCountryCode(countryCode) : '';
  const emailError = validateEmail(normalizedEmail);
  const passwordError = validatePassword(password, true);
  if (emailError) return res.status(422).json({ error: emailError });
  if (passwordError) return res.status(422).json({ error: passwordError });
  if (!normalizedDisplayName) return res.status(422).json({ error: 'Institution name is required' });
  if (countryCode && !normalizedCountryCode) {
    return res.status(422).json({ error: 'countryCode must be a valid ISO 3166-1 alpha-2 code' });
  }

  if (!isInstitutionOrgType(institutionType)) {
    return res.status(400).json({
      error: 'institutionType must be one of: university, college, institute, school, training_center',
    });
  }

  const existing = await InstitutionAccount.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ error: 'An Institution account with this email already exists' });
  }

  // Create shared Organization identity
  const orgSlug = await ensureUniqueOrganizationSlug(normalizedDisplayName, (s) => Organization.exists({ slug: s }));
  const org = await Organization.create({
    organizationType: institutionType,
    displayName: normalizedDisplayName,
    legalName: normalizedDisplayName,
    slug: orgSlug,
    countryCode: normalizedCountryCode || '',
    status: 'draft',
  });

  // Create InstitutionAccount
  const account = await InstitutionAccount.create({ email: normalizedEmail, password });

  // Create owner membership
  await InstitutionMembership.create({
    organizationId: org._id,
    institutionAccountId: account._id,
    role: INSTITUTION_ROLES.OWNER,
    active: true,
    joinedAt: new Date(),
  });

  // Initialize profile
  await InstitutionProfile.create({ organizationId: org._id });

  // Initialize verification record (draft)
  await OrganizationVerification.create({
    organizationId: org._id,
    organizationType: institutionType,
    countryCode: normalizedCountryCode || '',
    status: VERIFICATION_STATUSES.DRAFT,
  });

  await logAudit({
    action: 'institution_registered',
    actor: { userId: account._id, role: 'institution' },
    metadata: { organizationId: org._id, institutionType },
  });

  const result = await issueInstitutionSession(res, account);
  if (!result.ok) return res.status(result.status).json(result.body);
  return res.status(201).json({ ...result.body, organizationId: org._id });
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const institutionLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const account = await InstitutionAccount.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!account) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await account.comparePassword(password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  if (account.accountStatus === 'suspended') return res.status(403).json({ error: 'Account is suspended' });
  if (account.accountStatus === 'deleted') return res.status(403).json({ error: 'Account not found' });

  account.lastLoginAt = new Date();
  await account.save();

  const result = await issueInstitutionSession(res, account);
  if (!result.ok) return res.status(result.status).json(result.body);
  return res.status(200).json(result.body);
});

// ---------------------------------------------------------------------------
// Me (authenticated self + active memberships)
// ---------------------------------------------------------------------------

export const institutionMe = asyncHandler(async (req, res) => {
  const account = await InstitutionAccount.findById(req.institution.institutionAccountId).lean();
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const memberships = await InstitutionMembership.find({
    institutionAccountId: account._id,
    active: true,
  }).lean();

  return res.status(200).json({ account: toSafeAccount(account), memberships });
});

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

export const institutionRefreshToken = asyncHandler(async (req, res) => {
  const cookieResult = readInstitutionRefreshCookie(req);
  const cookieToken =
    cookieResult.code === 'COOKIE_FOUND' ? cookieResult.token : null;

  const result = await institutionSecureAuthFlows.refresh({
    cookieToken,
    origin: req.headers.origin,
    referer: req.headers.referer,
  });

  if (result.code === 'REFRESH_ROTATED') {
    writeInstitutionRefreshCookie(res, result.refreshToken);
    return res.status(200).json({ accessToken: result.accessToken, expiresIn: '15m' });
  }
  if (result.clearCookie) clearInstitutionRefreshCookie(res);
  return res.status(result.httpStatus).json(result.body || { error: 'Refresh failed' });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export const institutionLogout = asyncHandler(async (req, res) => {
  const result = await institutionSecureAuthFlows.logoutCurrent({
    principal: req.institution,
    presentedAccessTokenExp: req.institution.exp,
    origin: req.headers.origin,
    referer: req.headers.referer,
  });
  if (result.clearCookie) clearInstitutionRefreshCookie(res);
  return res.status(200).json({ message: 'Logged out' });
});

export const institutionLogoutAll = asyncHandler(async (req, res) => {
  const result = await institutionSecureAuthFlows.logoutAll({
    principal: req.institution,
    presentedAccessTokenExp: req.institution.exp,
    origin: req.headers.origin,
    referer: req.headers.referer,
  });
  if (result.clearCookie) clearInstitutionRefreshCookie(res);
  return res.status(200).json({ message: 'All sessions revoked' });
});
