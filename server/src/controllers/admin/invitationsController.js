import crypto from 'crypto';
import { StaffInvitation } from '../../models/StaffInvitation.js';
import { User } from '../../models/User.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { queueEmail } from '../../services/automationService.js';
import { hashResetToken } from '../../utils/tokenStore.js';
import { isSmtpConfigured } from '../../services/emailService.js';

const FRONTEND_BASE = process.env.FRONTEND_URL || process.env.APP_URL || process.env.SITE_URL || 'http://localhost:5173';
const INVITE_EXPIRY_MS = 72 * 60 * 60 * 1000;

const SUPER_ADMIN_INVITABLE = ['Editor', 'Moderator', 'Admin'];
const ADMIN_INVITABLE = ['Editor', 'Moderator'];

function inviterCanAssignRole(inviterRole, targetRole) {
  if (inviterRole === 'SuperAdmin') return SUPER_ADMIN_INVITABLE.includes(targetRole);
  if (inviterRole === 'Admin') return ADMIN_INVITABLE.includes(targetRole);
  return false;
}

async function expireStaleInvitations() {
  await StaffInvitation.updateMany(
    { status: 'pending', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
}

function invitationEmailMeta(enqueued) {
  if (isSmtpConfigured()) return { emailQueued: true, emailMode: 'live' };
  return {
    emailQueued: !!enqueued,
    emailMode: 'placeholder',
    emailNotice: 'Email queued (SMTP not configured)',
  };
}

async function sendInvitationEmail(invitation, rawToken, inviter) {
  const acceptUrl = `${FRONTEND_BASE.replace(/\/$/, '')}/auth/accept-invitation?token=${rawToken}`;
  const result = await queueEmail({
    to: invitation.email,
    templateKey: 'staffInvitation',
    vars: {
      url: acceptUrl,
      role: invitation.role,
      inviterName: inviter?.name || inviter?.email || 'Strideto Admin',
      message: invitation.message || '',
      expiresHours: 72,
    },
    dedupKey: `staff_invite:${invitation._id}:${Date.now()}`,
  });
  return invitationEmailMeta(result?.enqueued !== false);
}

export const listInvitations = asyncHandler(async (req, res) => {
  await expireStaleInvitations();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const skip = (page - 1) * limit;
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    const re = new RegExp(req.query.search, 'i');
    filter.email = re;
  }

  const [data, total] = await Promise.all([
    StaffInvitation.find(filter)
      .select('-tokenHash')
      .populate('invitedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StaffInvitation.countDocuments(filter),
  ]);

  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const createInvitation = asyncHandler(async (req, res) => {
  const { email: rawEmail, role, message } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (!['Editor', 'Moderator', 'Admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (!inviterCanAssignRole(req.user.role, role)) {
    return res.status(403).json({ error: 'You cannot invite users with this role' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ error: 'A user with this email already exists' });
  }

  await expireStaleInvitations();
  const pending = await StaffInvitation.findOne({ email, status: 'pending', expiresAt: { $gt: new Date() } });
  if (pending) {
    return res.status(409).json({ error: 'A pending invitation already exists for this email' });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const inviter = await User.findById(req.user.userId).select('name email role').lean();

  const invitation = await StaffInvitation.create({
    email,
    role,
    tokenHash: hashResetToken(rawToken),
    status: 'pending',
    expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
    invitedBy: req.user.userId,
    invitedByEmail: inviter?.email || '',
    message: String(message || '').trim().slice(0, 500),
  });

  const emailMeta = await sendInvitationEmail(invitation, rawToken, inviter);

  await logAudit({
    ...auditFromRequest(req),
    action: 'invitation.create',
    targetType: 'invitation',
    targetId: invitation._id,
    targetLabel: email,
    metadata: { role, ...emailMeta },
  });

  res.status(201).json({
    invitation: {
      _id: invitation._id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    },
    ...emailMeta,
  });
});

export const resendInvitation = asyncHandler(async (req, res) => {
  const invitation = await StaffInvitation.findById(req.params.id).select('+tokenHash');
  if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
  if (invitation.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending invitations can be resent' });
  }
  if (invitation.expiresAt <= new Date()) {
    invitation.status = 'expired';
    await invitation.save();
    return res.status(400).json({ error: 'Invitation has expired' });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  invitation.tokenHash = hashResetToken(rawToken);
  invitation.expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);
  await invitation.save();

  const inviter = await User.findById(invitation.invitedBy).select('name email').lean();
  const emailMeta = await sendInvitationEmail(invitation, rawToken, inviter);

  await logAudit({
    ...auditFromRequest(req),
    action: 'invitation.resend',
    targetType: 'invitation',
    targetId: invitation._id,
    targetLabel: invitation.email,
    metadata: emailMeta,
  });

  res.json({ message: 'Invitation resent', ...emailMeta });
});

export const revokeInvitation = asyncHandler(async (req, res) => {
  const invitation = await StaffInvitation.findById(req.params.id);
  if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
  if (invitation.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending invitations can be revoked' });
  }

  invitation.status = 'revoked';
  await invitation.save();

  await logAudit({
    ...auditFromRequest(req),
    action: 'invitation.revoke',
    targetType: 'invitation',
    targetId: invitation._id,
    targetLabel: invitation.email,
  });

  res.json({ message: 'Invitation revoked' });
});

export const getInvitationByToken = asyncHandler(async (req, res) => {
  const token = (req.query.token || '').trim();
  if (!token) return res.status(400).json({ error: 'Token is required' });

  await expireStaleInvitations();
  const invitation = await StaffInvitation.findOne({
    tokenHash: hashResetToken(token),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).select('-tokenHash').lean();

  if (!invitation) return res.status(400).json({ error: 'Invalid or expired invitation' });

  res.json({
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  });
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const token = (req.body?.token || req.query?.token || '').trim();
  const name = String(req.body?.name || '').trim();
  const password = req.body?.password;

  if (!token) return res.status(400).json({ error: 'Token is required' });
  if (!name || name.length < 2) return res.status(400).json({ error: 'Name is required' });
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const invitation = await StaffInvitation.findOne({
    tokenHash: hashResetToken(token),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).select('+tokenHash');

  if (!invitation) return res.status(400).json({ error: 'Invalid or expired invitation' });

  const existingUser = await User.findOne({ email: invitation.email });
  if (existingUser) {
    invitation.status = 'revoked';
    await invitation.save();
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const user = await User.create({
    email: invitation.email,
    name,
    password,
    role: invitation.role,
    emailVerified: true,
  });
  const { getUserCapabilityService } = await import('../../services/capability/userCapabilityRuntime.js');
  await getUserCapabilityService().initializeStaffUser(user, {
    grantedBy: 'system:staff_invitation',
    grantReason: 'staff_account_created',
  });

  invitation.status = 'accepted';
  invitation.acceptedAt = new Date();
  await invitation.save();

  await logAudit({
    ...auditFromRequest(req),
    action: 'invitation.accept',
    targetType: 'invitation',
    targetId: invitation._id,
    targetLabel: invitation.email,
    metadata: { userId: user._id, role: invitation.role },
  });

  res.status(201).json({
    message: 'Account created successfully. You can now sign in.',
    email: user.email,
    role: user.role,
  });
});
