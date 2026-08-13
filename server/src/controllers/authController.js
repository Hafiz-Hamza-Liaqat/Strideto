import crypto from 'crypto';
import { User } from '../models/User.js';
import {
  validateAuthRegister,
  validateAuthLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
} from '../validators/authValidator.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ensureReferralCode } from '../utils/referralCode.js';
import { awardBadge } from './badgesController.js';
import { queueEmail } from '../services/automationService.js';
import { isSmtpConfigured } from '../services/emailService.js';
import { logAudit, auditFromRequest } from '../services/auditService.js';
import { getPermissionsForRole } from '../config/rbac.js';
import { hashResetToken } from '../utils/tokenStore.js';
import { legalAcceptanceMetadata } from '../../../shared/legal/policyVersions.js';
import {
  applyVerificationTokenFields,
  buildVerifyEmailUrl,
  clearVerificationTokenFields,
  frontendBaseUrl,
  hashVerificationToken,
  isEmailVerificationRequired,
  VERIFY_TOKEN_TTL_MS,
} from '../utils/emailVerification.js';
import { secureAuthConfig } from '../services/auth/secureAuthConfig.js';
import { userSecureAuthFlows } from '../services/auth/userSecureAuthFlows.js';

/**
 * SEC-3E.1 — trusted-origin enforcement is composed at the route level
 * (`middleware/secureTrustedOrigin.js`), strictly before this controller is
 * ever invoked, on every route that requires it. The original SEC-3E pass
 * called an equivalent check by hand here, after this controller had
 * already performed a database read/write — a real, if narrow, defect
 * (documented in the SEC-3E report's correction record). No origin check
 * is performed in this file anymore; retaining one here would be
 * redundant at best and misleading at worst, since it could never protect
 * anything that already ran before it in the same function.
 */
function writeUserRefreshCookie(res, token) {
  secureAuthConfig.cookiePolicy.writeRefreshCookie({
    res,
    realm: 'user',
    token,
  });
}

function clearUserRefreshCookie(res) {
  secureAuthConfig.cookiePolicy.clearRefreshCookie({ res, realm: 'user' });
}

function toSafeUser(user) {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : { ...user };
  delete u.password;
  delete u.passwordResetToken;
  delete u.passwordResetExpires;
  delete u.emailVerificationToken;
  delete u.emailVerificationExpires;
  delete u.tempPasswordExpires;
  delete u.fcmToken;
  return u;
}

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const FRONTEND_BASE = frontendBaseUrl();
const GENERIC_RESEND_MESSAGE =
  'If an unverified account exists for this email, a new verification link has been sent.';

async function issueAndQueueVerification(user) {
  const rawToken = applyVerificationTokenFields(user);
  await user.save({ validateBeforeSave: false });
  const smtpOk = isSmtpConfigured();
  if (smtpOk) {
    const result = await queueEmail({
      to: user.email,
      templateKey: 'emailVerification',
      vars: {
        name: user.name,
        url: buildVerifyEmailUrl(rawToken),
        expiresMinutes: Math.round(VERIFY_TOKEN_TTL_MS / 60000),
      },
      dedupKey: `verify:${user._id}:${Date.now()}`,
    });
    // Direct send: treat hard SMTP errors as delivery unavailable for truthful client messaging.
    if (result?.error && result?.sent === false) {
      return { rawToken, smtpOk: false, sendError: result.error };
    }
  }
  return { rawToken, smtpOk };
}

export const register = asyncHandler(async (req, res) => {
  const { emailError, passwordError, name, termsError } = validateAuthRegister(req.body);
  if (emailError || passwordError || termsError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: { email: emailError, password: passwordError, acceptedTerms: termsError },
    });
  }
  const email = req.body.email.trim().toLowerCase();
  const referralCode = (req.body.referralCode || req.query.ref || '').trim();
  const existing = await User.findOne({ email });
  if (existing) {
    const { genericRegistrationResponse } = await import('../services/auth/realmEmailVerification.js');
    return res.status(201).json(await genericRegistrationResponse());
  }
  let referredBy = null;
  if (referralCode) {
    const referrer = await User.findOne({ referralCode });
    if (referrer && referrer._id) referredBy = referrer._id;
  }
  const user = await User.create({
    email,
    password: req.body.password,
    name: name || email.split('@')[0],
    role: 'User',
    referredBy,
    emailVerified: false,
    ...legalAcceptanceMetadata(),
  });
  await ensureReferralCode(user);

  const REFERRER_POINTS = 25;
  const REFEREE_POINTS = 10;
  if (referredBy) {
    await User.findByIdAndUpdate(referredBy, {
      $inc: {
        referralCount: 1,
        totalPoints: REFERRER_POINTS,
        rewardPoints: REFERRER_POINTS,
      },
    });
    await User.findByIdAndUpdate(user._id, {
      $inc: { totalPoints: REFEREE_POINTS, rewardPoints: REFEREE_POINTS },
    });
    await awardBadge(
      referredBy,
      'referral',
      'Referral Champion',
      'Referred a friend'
    );
  }

  await issueAndQueueVerification(user);
  const { genericRegistrationResponse } = await import('../services/auth/realmEmailVerification.js');
  return res.status(201).json(await genericRegistrationResponse());
});

export const login = asyncHandler(async (req, res) => {
  const { emailError, passwordError } = validateAuthLogin(req.body);
  if (emailError || passwordError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: { email: emailError, password: passwordError },
    });
  }
  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select(
    '+password +tempPasswordExpires'
  );
  if (!user || !(await user.comparePassword(req.body.password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.accountStatus === 'suspended') {
    return res.status(403).json({ error: 'Account suspended' });
  }
  if (user.tempPasswordExpires && user.tempPasswordExpires < new Date()) {
    return res.status(403).json({
      error: 'Temporary password has expired. Contact an administrator.',
    });
  }
  if (isEmailVerificationRequired(user)) {
    return res.status(403).json({
      error: 'Please verify your email before signing in.',
      code: 'email_verification_required',
      email: user.email,
    });
  }
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  const safe = toSafeUser(await User.findById(user._id));
  await logAudit({
    actor: { userId: user._id.toString(), email: user.email, role: user.role },
    action: 'auth.login',
    targetType: 'user',
    targetId: user._id.toString(),
    targetLabel: user.email,
    ip:
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '',
  });

  const sessionResult = await userSecureAuthFlows.issueLoginSession({
    subjectId: user._id.toString(),
    tokenVersion: user.tokenVersion,
  });
  if (sessionResult.code !== 'SESSION_ISSUED') {
    return res.status(sessionResult.httpStatus).json(sessionResult.body);
  }
  writeUserRefreshCookie(res, sessionResult.refreshToken);
  return res.json({
    user: safe,
    accessToken: sessionResult.accessToken,
    expiresIn: '15m',
    mustChangePassword: !!user.mustChangePassword,
  });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const safe = toSafeUser(user);
  res.json({
    user: safe,
    permissions: getPermissionsForRole(user.role),
  });
});

export const logout = asyncHandler(async (req, res) => {
  const principal = req.user;
  const result = await userSecureAuthFlows.logoutCurrent({
    principal: {
      subjectId: principal.userId,
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
  clearUserRefreshCookie(res);
  await logAudit({
    ...auditFromRequest(req),
    actor: { userId: principal.userId, role: principal.role },
    action: 'auth.logout',
    targetType: 'user',
    targetId: principal.userId,
  });
  return res.json({ message: 'Logged out' });
});

export const logoutAll = asyncHandler(async (req, res) => {
  const principal = req.user;
  const result = await userSecureAuthFlows.logoutAll({
    principal: {
      subjectId: principal.userId,
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
  clearUserRefreshCookie(res);
  await logAudit({
    ...auditFromRequest(req),
    actor: { userId: principal.userId, role: principal.role },
    action: 'auth.logout_all',
    targetType: 'user',
    targetId: principal.userId,
  });
  res.json({ message: 'Logged out of all sessions' });
});

export const refreshToken = asyncHandler(async (req, res) => {
  const extraction = secureAuthConfig.cookiePolicy.extractRefreshToken({
    cookieHeader: req.headers.cookie,
    realm: 'user',
  });
  const cookieToken =
    extraction.code === 'COOKIE_FOUND' ? extraction.token : null;
  const result = await userSecureAuthFlows.refresh({
    cookieToken,
    origin: req.headers.origin,
    referer: req.headers.referer,
  });
  if (result.clearCookie) {
    clearUserRefreshCookie(res);
  }
  if (result.code === 'REFRESH_ROTATED') {
    writeUserRefreshCookie(res, result.refreshToken);
    return res.json({ accessToken: result.accessToken, expiresIn: '15m' });
  }
  if (result.code === 'CONFLICT_BENIGN') {
    res.set('Retry-After', String(result.retryAfterSeconds));
    return res.status(result.httpStatus).json(result.body);
  }
  return res.status(result.httpStatus).json(result.body);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { emailError } = validateForgotPassword(req.body);
  if (emailError) {
    return res
      .status(400)
      .json({ error: 'Validation failed', details: { email: emailError } });
  }
  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select(
    '+passwordResetToken +passwordResetExpires'
  );
  const { genericRecoveryResponse, authDeliveryMode } = await import('../services/auth/realmEmailVerification.js');
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hashResetToken(token);
    user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await user.save({ validateBeforeSave: false });
    const resetUrl = `${FRONTEND_BASE}/auth/reset-password?token=${encodeURIComponent(token)}`;
    if ((await authDeliveryMode()) === 'accepted') {
      await queueEmail({
        to: user.email,
        templateKey: 'passwordReset',
        vars: { url: resetUrl, expiresMinutes: 60 },
        dedupKey: `password_reset:${user._id}:${Date.now()}`,
      });
    }
  }
  return res.status(200).json(await genericRecoveryResponse());
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const token = (req.query.token || req.body?.token || '').trim();
  const realm = String(req.query.realm || req.body?.realm || 'user').trim();
  if (!token)
    return res.status(400).json({ error: 'Verification token is required' });

  if (realm && realm !== 'user') {
    const { consumeRealmVerificationToken } = await import('../services/auth/realmEmailVerification.js');
    const result = await consumeRealmVerificationToken(realm, token);
    if (!result.ok) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }
    return res.json({ message: 'Email verified successfully', emailVerified: true, realm: result.realm });
  }

  const user = await User.findOne({
    emailVerificationToken: hashVerificationToken(token),
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user)
    return res
      .status(400)
      .json({ error: 'Invalid or expired verification link' });

  user.emailVerified = true;
  clearVerificationTokenFields(user);
  await user.save({ validateBeforeSave: false });

  if (isSmtpConfigured()) {
    await queueEmail({
      to: user.email,
      templateKey: 'welcome',
      vars: { name: user.name || user.email.split('@')[0] },
      dedupKey: `welcome:${user._id}`,
    });
  }

  res.json({ message: 'Email verified successfully', emailVerified: true, realm: 'user' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { tokenError, passwordError } = validateResetPassword(req.body);
  if (tokenError || passwordError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: { token: tokenError, password: passwordError },
    });
  }
  const token = req.body.token.trim();
  const result = await userSecureAuthFlows.resetPassword({
    hashedToken: hashResetToken(token),
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
  if (result.clearCookie) clearUserRefreshCookie(res);
  return res.status(200).json({
    message:
      'Password reset successfully. You can now sign in with your new password.',
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentError, passwordError } = validateChangePassword(req.body);
  if (currentError || passwordError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: { currentPassword: currentError, newPassword: passwordError },
    });
  }
  const user = await User.findById(req.user.userId).select('+password');
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!(await user.comparePassword(req.body.currentPassword))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const principal = req.user;
  const result = await userSecureAuthFlows.changePassword({
    principal: {
      subjectId: user._id.toString(),
      tokenVersion: principal.tokenVersion,
      jti: principal.jti,
    },
    newPassword: req.body.newPassword,
    presentedAccessTokenExp: principal.exp,
  });
  if (result.code !== 'PASSWORD_CHANGED') {
    return res
      .status(result.httpStatus)
      .json(result.body || { error: 'Could not change password' });
  }
  clearUserRefreshCookie(res);
  await logAudit({
    ...auditFromRequest(req),
    action: 'auth.change_password',
    targetType: 'user',
    targetId: user._id,
    targetLabel: user.email,
  });
  return res.json({ message: 'Password changed successfully' });
});

export const resendVerification = asyncHandler(async (req, res) => {
  const emailFromBody = (req.body?.email || '').trim().toLowerCase();
  const realm = String(req.body?.realm || req.query?.realm || 'user').trim();
  if (realm && realm !== 'user') {
    const { resendRealmVerification } = await import('../services/auth/realmEmailVerification.js');
    const result = await resendRealmVerification(realm, emailFromBody, req);
    return res.status(result.status).json(result.body);
  }
  let user = null;

  if (req.user?.userId) {
    user = await User.findById(req.user.userId).select(
      '+emailVerificationToken +emailVerificationExpires'
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) {
      return res.json({
        message: 'Email is already verified',
        emailVerified: true,
      });
    }
  } else {
    if (!emailFromBody) {
      return res.status(400).json({ error: 'Email is required' });
    }
    user = await User.findOne({ email: emailFromBody }).select(
      '+emailVerificationToken +emailVerificationExpires'
    );
    if (!user || user.emailVerified) {
      return res.json({ message: GENERIC_RESEND_MESSAGE });
    }
  }

  const { smtpOk } = await issueAndQueueVerification(user);

  if (!smtpOk) {
    if (req.user?.userId) {
      return res.status(503).json({
        error: 'Email delivery is not configured. Try again later.',
        code: 'smtp_not_configured',
        emailQueued: false,
        emailMode: 'unavailable',
      });
    }
    return res.json({
      message: GENERIC_RESEND_MESSAGE,
      emailQueued: false,
      emailMode: 'unavailable',
    });
  }

  if (req.user?.userId) {
    return res.json({
      message: 'Verification email sent',
      emailQueued: true,
      emailMode: 'live',
      expiresInMinutes: Math.round(VERIFY_TOKEN_TTL_MS / 60000),
    });
  }

  return res.json({
    message: GENERIC_RESEND_MESSAGE,
    emailQueued: true,
    emailMode: 'live',
  });
});
