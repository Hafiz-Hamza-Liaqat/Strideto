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
import { notifyPasswordChanged, notifyLogoutAllCompleted } from '../services/auth/securityNotifications.js';
import { getPermissionsForRole } from '../config/rbac.js';
import { hashResetToken } from '../utils/tokenStore.js';
import { legalAcceptanceMetadata } from '../../../shared/legal/policyVersions.js';
import {
  accountHasPassword,
  PASSWORD_NOT_SET_CODE,
  PASSWORD_NOT_SET_MESSAGE,
} from '../../../shared/auth/passwordAccountState.js';
import {
  frontendBaseUrl,
  isEmailVerificationRequired,
} from '../utils/emailVerification.js';
import { secureAuthConfig } from '../services/auth/secureAuthConfig.js';
import { userSecureAuthFlows } from '../services/auth/userSecureAuthFlows.js';
import { normalizeAttribution } from '../../../shared/seo/measurement/landingAttribution.js';
import { safeRecordRegistrationEvent } from '../services/analytics/acquisitionEvents.js';

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

/** Additive capability projection for User-realm UX. Never invents grants. */
async function withActiveCapabilities(safeUser) {
  if (!safeUser) return null;
  try {
    const { getUserCapabilityService } = await import('../services/capability/userCapabilityRuntime.js');
    const resolved = await getUserCapabilityService().resolveUserCapabilities(safeUser);
    return {
      ...safeUser,
      capabilities: Array.isArray(resolved?.active) ? resolved.active : [],
    };
  } catch {
    return { ...safeUser, capabilities: [] };
  }
}

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const FRONTEND_BASE = frontendBaseUrl();

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
  const existing = await User.findOne({ email }).select('+emailVerificationToken +emailVerificationExpires');
  if (existing) {
    const { genericRegistrationResponse, reissueUnverifiedIfAllowed } = await import('../services/auth/realmEmailVerification.js');
    const { shouldRetryCapabilityEraRegistration } = await import('../../../shared/capability/legacyUserClassification.js');
    if (shouldRetryCapabilityEraRegistration(existing)) {
      try {
        const { getUserCapabilityService } = await import('../services/capability/userCapabilityRuntime.js');
        await getUserCapabilityService().initializeCustomerUser(existing, {
          grantedBy: 'system:registration',
          grantReason: 'student_registration_retry',
        });
      } catch {
        // Anti-enumeration: existing-email responses stay generic. Compensation is retried next attempt.
      }
    }
    if (!existing.emailVerified) {
      await reissueUnverifiedIfAllowed(existing, 'user', existing.name);
    }
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
    capabilityInitializationState: 'pending',
    ...legalAcceptanceMetadata(),
  });
  await safeRecordRegistrationEvent({ realm: 'user', subjectId: user._id, attribution: normalizeAttribution(req.body?.attribution) });
  const { getUserCapabilityService } = await import('../services/capability/userCapabilityRuntime.js');
  await getUserCapabilityService().initializeCustomerUser(user, {
    grantedBy: 'system:registration',
    grantReason: 'student_registration',
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

  const { genericRegistrationResponse, issueRealmVerification } = await import('../services/auth/realmEmailVerification.js');
  await issueRealmVerification(user, 'user', user.name);
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
  // A social-only account (hasPassword === false) has no password at all and
  // can never satisfy this flow. It is refused with the identical generic
  // response as a wrong password, so this route stays non-enumerating about
  // which accounts are social-only.
  if (!user || !accountHasPassword(user)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!(await user.comparePassword(req.body.password))) {
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
  const safe = await withActiveCapabilities(toSafeUser(await User.findById(user._id)));
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
  const safe = await withActiveCapabilities(toSafeUser(user));
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
  await notifyLogoutAllCompleted('user', principal.userId);
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
    '+password +passwordResetToken +passwordResetExpires'
  );
  const { genericRecoveryResponse, sensitiveTransactionalDeliveryMode } = await import('../services/auth/realmEmailVerification.js');
  /**
   * A social-only account must never be issued a password-reset token. Doing
   * so would let anyone with mailbox access *set* a first password on an
   * account that deliberately has none, silently converting it into a password
   * account and creating a second, weaker authentication path around the
   * provider. The response stays byte-identical to every other outcome, so
   * this remains non-enumerating.
   */
  if (user && accountHasPassword(user)) {
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hashResetToken(token);
    user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await user.save({ validateBeforeSave: false });
    const resetUrl = `${FRONTEND_BASE}/auth/reset-password?token=${encodeURIComponent(token)}`;
    if ((await sensitiveTransactionalDeliveryMode()) === 'accepted') {
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
  if (!token) {
    return res.status(400).json({
      error: 'This verification link is invalid or has expired. Request a new verification link.',
      code: 'INVALID_OR_EXPIRED',
    });
  }

  const {
    consumeRealmVerificationToken,
    publicEmailVerifyFailure,
  } = await import('../services/auth/realmEmailVerification.js');
  const result = await consumeRealmVerificationToken(realm, token);
  if (!result.ok) {
    const failure = publicEmailVerifyFailure(result.code);
    return res.status(failure.status).json(failure.body);
  }

  if (realm === 'user' && isSmtpConfigured() && result.accountId) {
    const user = await User.findById(result.accountId).select('email name');
    if (user) {
      await queueEmail({
        to: user.email,
        templateKey: 'welcome',
        vars: { name: user.name || user.email.split('@')[0] },
        dedupKey: `welcome:${user._id}`,
      });
    }
  }

  return res.json({ message: 'Email verified successfully', emailVerified: true, realm: result.realm });
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
  /**
   * Authenticated, own account — an explicit reason is safe and correct here;
   * there is nothing to enumerate. "Current password is incorrect" would be a
   * dead end for a social-only account that has no current password to give.
   * Setting a first password belongs to a later, deliberate flow, not to a
   * route whose entire contract is proving possession of an existing one.
   */
  if (!accountHasPassword(user)) {
    return res.status(400).json({
      error: PASSWORD_NOT_SET_MESSAGE,
      code: PASSWORD_NOT_SET_CODE,
    });
  }
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
  await notifyPasswordChanged('user', user._id);
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
      const { genericRegistrationResponse } = await import('../services/auth/realmEmailVerification.js');
      return res.json(await genericRegistrationResponse());
    }
  }

  const { reissueUnverifiedIfAllowed, genericRegistrationResponse } = await import('../services/auth/realmEmailVerification.js');
  await reissueUnverifiedIfAllowed(user, 'user', user.name);
  return res.json(await genericRegistrationResponse());
});
