/**
 * Institution team invitations (Phase 6).
 * Mirrors Agent/Employer invite semantics: hashed token, 7-day TTL, duplicate 409,
 * last-owner protection, cross-institution denial. No real email.
 */
import crypto from 'crypto';
import { InstitutionInvitation } from '../models/institution/InstitutionInvitation.js';
import { InstitutionMembership } from '../models/institution/InstitutionMembership.js';
import { InstitutionAccount } from '../models/institution/InstitutionAccount.js';
import { Organization } from '../models/Organization.js';
import { hashResetToken } from '../utils/tokenStore.js';
import { logAudit } from './auditService.js';
import { notifyInstitutionAccount, notifyInstitutionOrganizationOwners } from './institutionInboxNotificationBridge.js';
import {
  INSTITUTION_ROLES,
  INSTITUTION_INVITE_STATUSES,
  INSTITUTION_INVITE_TTL_MS,
  INSTITUTION_INVITE_EMAIL_MAX,
  canManageTeam,
  isInvitableInstitutionRole,
} from '../../../shared/institution/institutionPortal.js';

function domainError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function countActiveOwners(organizationId) {
  return InstitutionMembership.countDocuments({
    organizationId,
    role: INSTITUTION_ROLES.OWNER,
    active: true,
  });
}

export async function assertNotLastOwner(organizationId, membership) {
  if (membership.role !== INSTITUTION_ROLES.OWNER) return;
  const owners = await countActiveOwners(organizationId);
  if (owners <= 1) {
    throw domainError(409, 'LAST_OWNER', 'The last owner cannot be removed or demoted');
  }
}

export async function listInvites(organizationId) {
  const invites = await InstitutionInvitation.find({
    organizationId,
    status: INSTITUTION_INVITE_STATUSES.PENDING,
  }).sort({ createdAt: -1 }).lean();
  const now = Date.now();
  return invites.map((invite) => ({
    invitationId: invite._id,
    email: invite.email,
    role: invite.role,
    status: invite.expiresAt && invite.expiresAt.getTime() < now
      ? INSTITUTION_INVITE_STATUSES.EXPIRED
      : invite.status,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  }));
}

export async function createInvite({ organizationId, actorAccountId, actorRole, email, role }) {
  if (!canManageTeam(actorRole)) {
    throw domainError(403, 'INSUFFICIENT_ROLE', 'Insufficient role to invite team members');
  }
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > INSTITUTION_INVITE_EMAIL_MAX || !normalized.includes('@')) {
    throw domainError(400, 'INVALID_INVITE_EMAIL', 'A valid invite email is required');
  }
  if (!isInvitableInstitutionRole(role)) {
    throw domainError(400, 'INVALID_INVITE_ROLE', 'Invite role must be admin, editor, or viewer');
  }

  const existingAccount = await InstitutionAccount.findOne({ email: normalized }).select('_id');
  if (existingAccount) {
    const existingMembership = await InstitutionMembership.findOne({
      institutionAccountId: existingAccount._id,
      active: true,
    }).lean();
    if (existingMembership && String(existingMembership.organizationId) === String(organizationId)) {
      throw domainError(409, 'ALREADY_MEMBER', 'That account is already a member of this Institution');
    }
    if (existingMembership && String(existingMembership.organizationId) !== String(organizationId)) {
      throw domainError(409, 'CROSS_ORGANIZATION_DENIED', 'That account already belongs to another Institution');
    }
  }

  const duplicate = await InstitutionInvitation.findOne({
    organizationId,
    email: normalized,
    status: INSTITUTION_INVITE_STATUSES.PENDING,
  }).lean();
  if (duplicate) throw domainError(409, 'DUPLICATE_INVITE', 'A pending invite already exists for this email');

  const token = crypto.randomBytes(32).toString('hex');
  const invitation = await InstitutionInvitation.create({
    organizationId,
    email: normalized,
    role,
    status: INSTITUTION_INVITE_STATUSES.PENDING,
    tokenHash: hashResetToken(token),
    invitedBy: actorAccountId,
    expiresAt: new Date(Date.now() + INSTITUTION_INVITE_TTL_MS),
  });

  await logAudit({
    action: 'institution_team_invited',
    actor: { userId: actorAccountId, role: 'institution', realm: 'institution' },
    metadata: { organizationId, invitationId: invitation._id, role },
  });

  if (existingAccount) {
    await notifyInstitutionAccount({
      institutionAccountId: existingAccount._id,
      category: 'system',
      type: 'institution_team.invitation',
      title: 'Institution team invitation',
      body: 'You were invited to join an Institution team on Strideto.',
      link: '/institution/accept-invitation',
      dedupeKey: `institution-invite:${invitation._id}`,
    });
  }

  return {
    invitationId: invitation._id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    token,
    emailDelivery: 'not_configured',
    acceptPath: `/institution/accept-invitation?token=${encodeURIComponent(token)}`,
  };
}

export async function previewInvite(token) {
  if (!token) throw domainError(400, 'INVITE_TOKEN_REQUIRED', 'Invitation token is required');
  const invitation = await InstitutionInvitation.findOne({ tokenHash: hashResetToken(token) }).lean();
  if (!invitation) throw domainError(404, 'INVITE_NOT_FOUND', 'Invitation not found');
  const expired = invitation.expiresAt && invitation.expiresAt.getTime() < Date.now();
  const organization = await Organization.findById(invitation.organizationId).select('displayName').lean();
  return {
    email: invitation.email,
    role: invitation.role,
    status: expired && invitation.status === INSTITUTION_INVITE_STATUSES.PENDING
      ? INSTITUTION_INVITE_STATUSES.EXPIRED
      : invitation.status,
    expiresAt: invitation.expiresAt,
    organizationName: organization?.displayName || '',
  };
}

export async function acceptInvite({ token, institutionAccount }) {
  if (!token) throw domainError(400, 'INVITE_TOKEN_REQUIRED', 'Invitation token is required');
  const invitation = await InstitutionInvitation.findOne({ tokenHash: hashResetToken(token) });
  if (!invitation) throw domainError(404, 'INVITE_NOT_FOUND', 'Invitation not found');
  if (invitation.status === INSTITUTION_INVITE_STATUSES.REVOKED) {
    throw domainError(409, 'INVITE_REVOKED', 'This invitation has been revoked');
  }
  if (invitation.status === INSTITUTION_INVITE_STATUSES.ACCEPTED) {
    throw domainError(409, 'INVITE_ALREADY_ACCEPTED', 'This invitation has already been accepted');
  }
  if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
    invitation.status = INSTITUTION_INVITE_STATUSES.EXPIRED;
    await invitation.save();
    throw domainError(410, 'INVITE_EXPIRED', 'This invitation has expired');
  }
  const email = normalizeEmail(institutionAccount.email);
  if (email !== invitation.email) {
    throw domainError(403, 'INVITE_EMAIL_MISMATCH', 'Signed-in Institution email does not match this invitation');
  }

  const existing = await InstitutionMembership.findOne({
    institutionAccountId: institutionAccount._id,
    active: true,
  });
  if (existing && String(existing.organizationId) === String(invitation.organizationId)) {
    throw domainError(409, 'ALREADY_MEMBER', 'Already a member of this Institution');
  }
  if (existing && String(existing.organizationId) !== String(invitation.organizationId)) {
    throw domainError(409, 'CROSS_ORGANIZATION_DENIED', 'Cannot join another Institution while an active membership exists');
  }

  await InstitutionMembership.findOneAndUpdate(
    { organizationId: invitation.organizationId, institutionAccountId: institutionAccount._id },
    {
      $set: {
        role: invitation.role,
        active: true,
        invitedBy: invitation.invitedBy,
        joinedAt: new Date(),
        revokedAt: null,
        revokedBy: null,
      },
    },
    { upsert: true, new: true }
  );

  invitation.status = INSTITUTION_INVITE_STATUSES.ACCEPTED;
  invitation.acceptedAt = new Date();
  invitation.acceptedBy = institutionAccount._id;
  await invitation.save();

  await notifyInstitutionOrganizationOwners({
    organizationId: invitation.organizationId,
    category: 'system',
    type: 'institution_team.accepted',
    title: 'Team membership accepted',
    body: 'A team invitation was accepted.',
    link: '/institution/team',
    dedupeKey: `institution-invite-accepted:${invitation._id}`,
  });

  return { organizationId: invitation.organizationId, role: invitation.role };
}

export async function revokeInvite({ organizationId, invitationId, actorAccountId, actorRole }) {
  if (!canManageTeam(actorRole)) {
    throw domainError(403, 'INSUFFICIENT_ROLE', 'Insufficient role to revoke invitations');
  }
  if (!invitationId) throw domainError(404, 'INVITE_NOT_FOUND', 'Invitation not found');
  const invitation = await InstitutionInvitation.findOne({ _id: invitationId, organizationId });
  if (!invitation) throw domainError(404, 'INVITE_NOT_FOUND', 'Invitation not found');
  if (invitation.status !== INSTITUTION_INVITE_STATUSES.PENDING) {
    throw domainError(409, 'INVITE_NOT_PENDING', 'Only pending invitations can be revoked');
  }
  invitation.status = INSTITUTION_INVITE_STATUSES.REVOKED;
  invitation.revokedAt = new Date();
  invitation.revokedBy = actorAccountId;
  await invitation.save();
  return { revoked: true };
}
