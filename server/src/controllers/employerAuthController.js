import crypto from 'crypto';
import { Employer } from '../models/Employer.js';
import { hashResetToken } from '../utils/tokenStore.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logAudit, auditFromRequest } from '../services/auditService.js';
import { notifyPasswordChanged, notifyLogoutAllCompleted } from '../services/auth/securityNotifications.js';
import { secureAuthConfig } from '../services/auth/secureAuthConfig.js';
import { employerSecureAuthFlows } from '../services/auth/employerSecureAuthFlows.js';
import {
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
} from '../validators/authValidator.js';
import { queueEmail } from '../services/automationService.js';
import { frontendBaseUrl } from '../utils/emailVerification.js';
import { ensureUniqueEmployerSlug } from '../utils/employerSlug.js';
import { legalAcceptanceMetadata, requireAcceptedTerms } from '../../../shared/legal/policyVersions.js';
import { validatePassword } from '../validators/authValidator.js';
import { isE164, normalizePhone } from '../../../shared/international/phone.js';
import {
  genericRegistrationResponse,
  genericRecoveryResponse,
  sensitiveTransactionalDeliveryMode,
  issueRealmVerification,
  reissueUnverifiedIfAllowed,
} from '../services/auth/realmEmailVerification.js';

/**
 * SEC-3E.1 — trusted-origin enforcement is composed at the route level
 * (`middleware/secureTrustedOrigin.js`), strictly before this controller is
 * ever invoked. The original SEC-3E pass called an equivalent check by
 * hand inside `issueSecureEmployerSession`, which `employerRegister` only
 * reached *after* `Employer.create` had already run — a real account
 * creation could occur before a forged cross-site request was rejected
 * (documented in the SEC-3E report's correction record). No origin check
 * is performed in this file anymore.
 */
function writeEmployerRefreshCookie(res, token) {
  secureAuthConfig.cookiePolicy.writeRefreshCookie({
    res,
    realm: 'employer',
    token,
  });
}

function clearEmployerRefreshCookie(res) {
  secureAuthConfig.cookiePolicy.clearRefreshCookie({ res, realm: 'employer' });
}

function toSafeEmployer(employer) {
  if (!employer) return null;
  const e = employer.toObject ? employer.toObject() : employer;
  delete e.password;
  delete e.passwordResetToken;
  delete e.passwordResetExpires;
  delete e.emailVerificationToken;
  delete e.emailVerificationExpires;
  return e;
}

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const FRONTEND_BASE = frontendBaseUrl();

/**
 * Canonical session issuance. Returns a safe failure result on issuance
 * failure so the caller can map it to the shared HTTP-mapping result
 * instead of guessing a status/body itself.
 */
async function issueSecureEmployerSession(res, employer) {
  const sessionResult = await employerSecureAuthFlows.issueLoginSession({
    subjectId: employer._id.toString(),
    tokenVersion: employer.tokenVersion,
  });
  if (sessionResult.code !== 'SESSION_ISSUED') {
    return {
      ok: false,
      status: sessionResult.httpStatus,
      body: sessionResult.body,
    };
  }
  writeEmployerRefreshCookie(res, sessionResult.refreshToken);
  return {
    ok: true,
    body: {
      employer: toSafeEmployer(employer),
      accessToken: sessionResult.accessToken,
      expiresIn: '15m',
    },
  };
}

export const employerRegister = asyncHandler(async (req, res) => {
  const { companyName, email, phone, website, companyDescription, password } =
    req.body;
  if (!companyName || !email || !password) {
    return res
      .status(400)
      .json({ error: 'companyName, email and password are required' });
  }
  if (!requireAcceptedTerms(req.body)) {
    return res.status(400).json({ error: 'You must agree to the Terms of Service and Privacy Policy' });
  }
  const passwordError = validatePassword(password, true);
  if (passwordError) {
    return res.status(400).json({ error: 'Validation failed', details: { password: passwordError } });
  }
  const emailNorm = email.trim().toLowerCase();
  const existing = await Employer.findOne({ email: emailNorm }).select(
    '+emailVerificationToken +emailVerificationExpires'
  );
  if (existing) {
    if (!existing.emailVerified) {
      await reissueUnverifiedIfAllowed(existing, 'employer', existing.companyName);
    }
    return res.status(201).json(await genericRegistrationResponse());
  }
  const companyNameTrimmed = (companyName || '').trim();
  // Deterministic, collision-safe public-profile slug generated at creation
  // time (Mission 0). The unique+sparse index on `slug` is the ultimate
  // authority; the rare create-time race is retried once with a fresh candidate.
  const slugExists = async (candidate) => !!(await Employer.exists({ slug: candidate }));
  let employer;
  for (let attempt = 0; attempt < 2 && !employer; attempt += 1) {
    const slug = await ensureUniqueEmployerSlug(companyNameTrimmed, slugExists);
    try {
      employer = await Employer.create({
        companyName: companyNameTrimmed,
        slug,
        email: emailNorm,
        phone: (() => {
          const raw = typeof phone === 'string' ? phone.trim() : '';
          if (!raw) return '';
          if (isE164(raw)) return raw;
          return normalizePhone(raw) || raw;
        })(),
        website: (website || '').trim(),
        companyDescription: (companyDescription || '').trim(),
        password,
        emailVerified: false,
        ...legalAcceptanceMetadata(),
      });
    } catch (err) {
      // Only a concurrent slug collision is retryable here; a duplicate email
      // (already checked above) or any other error must surface unchanged.
      if (err?.code === 11000 && err?.keyPattern?.slug && attempt === 0) continue;
      throw err;
    }
  }
  const freshEmployer = await Employer.findById(employer._id);
  await issueRealmVerification(freshEmployer, 'employer', freshEmployer.companyName);
  return res.status(201).json(await genericRegistrationResponse());
});

export const employerLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const emailNorm = email.trim().toLowerCase();
  const employer = await Employer.findOne({ email: emailNorm }).select(
    '+password'
  );
  if (!employer || !(await employer.comparePassword(password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (employer.accountStatus === 'suspended') {
    return res.status(403).json({ error: 'Account suspended' });
  }
  const freshEmployer = await Employer.findById(employer._id);

  const result = await issueSecureEmployerSession(res, freshEmployer);
  if (!result.ok) return res.status(result.status).json(result.body);
  return res.json(result.body);
});

export const employerMe = asyncHandler(async (req, res) => {
  const employer = await Employer.findById(req.employer.employerId);
  if (!employer) return res.status(404).json({ error: 'Employer not found' });
  const safe = toSafeEmployer(employer);
  res.json({
    employer: {
      ...safe,
      organizationId: req.employer.organizationId || null,
      teamRole: req.employer.teamRole || null,
      hiringOwnerId: req.employer.hiringOwnerId || String(employer._id),
      capabilities: req.employer.capabilities || [],
      organizationName: req.employer.organizationName || safe.companyName,
    },
  });
});

export const employerLogout = asyncHandler(async (req, res) => {
  const principal = req.employer;
  const result = await employerSecureAuthFlows.logoutCurrent({
    principal: {
      subjectId: principal.employerId,
      sid: principal.sid,
      jti: principal.jti,
    },
    presentedAccessTokenExp: principal.exp,
    origin: req.headers.origin,
    referer: req.headers.referer,
  });
  if (result.code !== 'LOGGED_OUT') {
    return res.status(result.httpStatus).json(result.body);
  }
  clearEmployerRefreshCookie(res);
  await logAudit({
    ...auditFromRequest(req),
    actor: { employerId: principal.employerId, role: 'employer' },
    action: 'auth.employer.logout',
    targetType: 'employer',
    targetId: principal.employerId,
  });
  return res.json({ message: 'Logged out' });
});

export const employerLogoutAll = asyncHandler(async (req, res) => {
  const principal = req.employer;
  const result = await employerSecureAuthFlows.logoutAll({
    principal: {
      subjectId: principal.employerId,
      sid: principal.sid,
      jti: principal.jti,
      tokenVersion: principal.tokenVersion,
    },
    presentedAccessTokenExp: principal.exp,
    origin: req.headers.origin,
    referer: req.headers.referer,
  });
  if (result.code !== 'LOGGED_OUT_ALL') {
    return res.status(result.httpStatus).json(result.body);
  }
  clearEmployerRefreshCookie(res);
  await logAudit({
    ...auditFromRequest(req),
    actor: { employerId: principal.employerId, role: 'employer' },
    action: 'auth.employer.logout_all',
    targetType: 'employer',
    targetId: principal.employerId,
  });
  await notifyLogoutAllCompleted('employer', principal.employerId);
  res.json({ message: 'Logged out of all sessions' });
});

export const employerForgotPassword = asyncHandler(async (req, res) => {
  const { emailError } = validateForgotPassword(req.body);
  if (emailError) {
    return res
      .status(400)
      .json({ error: 'Validation failed', details: { email: emailError } });
  }
  const email = req.body.email.trim().toLowerCase();
  const employer = await Employer.findOne({ email }).select(
    '+passwordResetToken +passwordResetExpires'
  );
  if (employer) {
    const token = crypto.randomBytes(32).toString('hex');
    employer.passwordResetToken = hashResetToken(token);
    employer.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await employer.save({ validateBeforeSave: false });
    if ((await sensitiveTransactionalDeliveryMode()) === 'accepted') {
      await queueEmail({
        to: employer.email,
        templateKey: 'passwordReset',
        vars: {
          url: `${FRONTEND_BASE}/employer/reset-password?token=${encodeURIComponent(token)}`,
          expiresMinutes: 60,
        },
        dedupKey: `employer_password_reset:${employer._id}:${Date.now()}`,
      });
    }
  }
  return res.status(200).json(await genericRecoveryResponse());
});

export const employerResetPassword = asyncHandler(async (req, res) => {
  const { tokenError, passwordError } = validateResetPassword(req.body);
  if (tokenError || passwordError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: { token: tokenError, password: passwordError },
    });
  }
  const result = await employerSecureAuthFlows.resetPassword({
    hashedToken: hashResetToken(req.body.token.trim()),
    newPassword: req.body.password,
  });
  if (result.code !== 'PASSWORD_RESET') {
    if (result.code === 'STORAGE_FAILURE') {
      return res.status(result.httpStatus).json(result.body);
    }
    return res.status(400).json({
      error:
        'Invalid or expired reset link. Please request a new password reset.',
    });
  }
  clearEmployerRefreshCookie(res);
  return res.status(200).json({
    message:
      'Password reset successfully. You can now sign in with your new password.',
  });
});

export const employerChangePassword = asyncHandler(async (req, res) => {
  const { currentError, passwordError } = validateChangePassword(req.body);
  if (currentError || passwordError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: { currentPassword: currentError, newPassword: passwordError },
    });
  }
  const employer = await Employer.findById(req.employer.employerId).select(
    '+password'
  );
  if (!employer) return res.status(404).json({ error: 'Employer not found' });
  if (!(await employer.comparePassword(req.body.currentPassword))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const principal = req.employer;
  const result = await employerSecureAuthFlows.changePassword({
    principal: {
      subjectId: employer._id.toString(),
      tokenVersion: principal.tokenVersion,
      jti: principal.jti,
    },
    newPassword: req.body.newPassword,
    presentedAccessTokenExp: principal.exp,
  });
  if (result.code !== 'PASSWORD_CHANGED') {
    return res.status(result.httpStatus).json(result.body);
  }
  clearEmployerRefreshCookie(res);
  await logAudit({
    ...auditFromRequest(req),
    actor: { employerId: employer._id, role: 'employer' },
    action: 'auth.employer.change_password',
    targetType: 'employer',
    targetId: employer._id,
  });
  await notifyPasswordChanged('employer', employer._id);
  return res.json({ message: 'Password changed successfully' });
});

export const employerRefreshToken = asyncHandler(async (req, res) => {
  const extraction = secureAuthConfig.cookiePolicy.extractRefreshToken({
    cookieHeader: req.headers.cookie,
    realm: 'employer',
  });
  const cookieToken =
    extraction.code === 'COOKIE_FOUND' ? extraction.token : null;
  const result = await employerSecureAuthFlows.refresh({
    cookieToken,
    origin: req.headers.origin,
    referer: req.headers.referer,
  });
  if (result.clearCookie) {
    clearEmployerRefreshCookie(res);
  }
  if (result.code === 'REFRESH_ROTATED') {
    writeEmployerRefreshCookie(res, result.refreshToken);
    return res.json({ accessToken: result.accessToken, expiresIn: '15m' });
  }
  if (result.code === 'CONFLICT_BENIGN') {
    res.set('Retry-After', String(result.retryAfterSeconds));
    return res.status(result.httpStatus).json(result.body);
  }
  return res.status(result.httpStatus).json(result.body);
});
