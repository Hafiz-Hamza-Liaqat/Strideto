import crypto from 'crypto';
import mongoose from 'mongoose';
import { Employer } from '../../models/Employer.js';
import { Job } from '../../models/Job.js';
import { Organization } from '../../models/Organization.js';
import { EmployerMembership } from '../../models/employer/EmployerMembership.js';
import { EmployerInvitation } from '../../models/employer/EmployerInvitation.js';
import {
  ORGANIZATION_TYPES,
  ORGANIZATION_STATUSES,
  ensureUniqueOrganizationSlug,
} from '../../../../shared/international/organization.js';
import {
  EMPLOYER_ROLES,
  EMPLOYER_INVITE_STATUSES,
  EMPLOYER_INVITE_TTL_MS,
  EMPLOYER_INVITE_EMAIL_MAX,
  EMPLOYER_SEARCH_QUERY_MAX,
  isValidEmployerRole,
  capabilitiesForEmployerRole,
  canChangeMemberRole,
  canRemoveMember,
  isLastOwnerProtected,
} from '../../../../shared/employer/team.js';
import { hashResetToken } from '../../utils/tokenStore.js';

function domainError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function requireObjectId(id, code = 'NOT_FOUND', message = 'Not found') {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw domainError(404, code, message);
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function hiringOwnerIdFrom(req) {
  return req.employer?.hiringOwnerId || req.employer?.employerId;
}

export function serializeEmployerCapabilities(role) {
  return [...capabilitiesForEmployerRole(role)];
}

export async function ensureEmployerOrganization(employer) {
  if (!employer?._id) {
    throw domainError(404, 'EMPLOYER_NOT_FOUND', 'Employer not found');
  }
  const employerId = employer._id;
  const existingMembership = await EmployerMembership.findOne({
    employerId,
    active: true,
  }).lean();
  if (existingMembership) {
    const organization = await Organization.findById(existingMembership.organizationId).lean();
    if (!organization) {
      throw domainError(409, 'ORGANIZATION_MISSING', 'Organization membership is orphaned');
    }
    return {
      organization,
      membership: existingMembership,
      created: false,
    };
  }

  let organization = await Organization.findOne({ legacyEmployerId: employerId });
  if (!organization) {
    const slugExists = async (candidate) => !!(await Organization.exists({ slug: candidate }));
    const slug = await ensureUniqueOrganizationSlug(employer.companyName || 'organization', slugExists);
    organization = await Organization.create({
      organizationType: ORGANIZATION_TYPES.EMPLOYER,
      displayName: employer.companyName || 'Organization',
      legalName: employer.companyName || '',
      slug,
      website: employer.website || '',
      status: ORGANIZATION_STATUSES.ACTIVE,
      legacyEmployerId: employerId,
    });
  }

  const membership = await EmployerMembership.create({
    organizationId: organization._id,
    employerId,
    role: EMPLOYER_ROLES.OWNER,
    active: true,
    joinedAt: new Date(),
  });

  return {
    organization: organization.toObject ? organization.toObject() : organization,
    membership: membership.toObject ? membership.toObject() : membership,
    created: true,
  };
}

export async function attachEmployerOrganizationContext(req) {
  if (req.employer?.organizationId && req.employer?.teamRole) return req.employer;
  const employer = await Employer.findById(req.employer.employerId).select(
    'companyName website email'
  );
  if (!employer) {
    throw domainError(404, 'EMPLOYER_NOT_FOUND', 'Employer not found');
  }
  const { organization, membership } = await ensureEmployerOrganization(employer);
  const teamRole = membership.role;
  req.employer.organizationId = String(organization._id);
  req.employer.teamRole = teamRole;
  req.employer.hiringOwnerId = String(organization.legacyEmployerId || membership.employerId);
  req.employer.capabilities = serializeEmployerCapabilities(teamRole);
  req.employer.organizationName = organization.displayName || employer.companyName;
  return req.employer;
}

export function requireEmployerCapability(capability) {
  return (req, res, next) => {
    const caps = req.employer?.capabilities;
    if (!Array.isArray(caps) || !caps.includes(capability)) {
      return res.status(403).json({
        error: 'Insufficient employer role capability',
        code: 'EMPLOYER_CAPABILITY_DENIED',
        capability,
      });
    }
    next();
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listOrganizationTeam(organizationId, { q = '', page = 1, limit = 20 } = {}) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const filter = { organizationId, active: true };
  const query = String(q || '').trim().slice(0, EMPLOYER_SEARCH_QUERY_MAX);
  const members = await EmployerMembership.find(filter)
    .sort({ role: 1, createdAt: 1 })
    .skip((safePage - 1) * safeLimit)
    .limit(safeLimit)
    .lean();
  const total = await EmployerMembership.countDocuments(filter);
  const employerIds = members.map((m) => m.employerId);
  const employers = await Employer.find({ _id: { $in: employerIds } })
    .select('email companyName')
    .lean();
  const byId = new Map(employers.map((e) => [String(e._id), e]));
  let data = members.map((m) => {
    const emp = byId.get(String(m.employerId));
    return {
      membershipId: m._id,
      employerId: m.employerId,
      role: m.role,
      email: emp?.email || '',
      companyName: emp?.companyName || '',
      joinedAt: m.joinedAt,
    };
  });
  if (query) {
    const re = new RegExp(escapeRegex(query), 'i');
    data = data.filter((row) => re.test(row.email) || re.test(row.companyName));
  }
  return { data, total, page: safePage, limit: safeLimit };
}

export async function listOrganizationInvites(organizationId) {
  const invites = await EmployerInvitation.find({
    organizationId,
    status: EMPLOYER_INVITE_STATUSES.PENDING,
  })
    .sort({ createdAt: -1 })
    .lean();
  const now = Date.now();
  return invites.map((invite) => ({
    invitationId: invite._id,
    email: invite.email,
    role: invite.role,
    status:
      invite.expiresAt && invite.expiresAt.getTime() < now
        ? EMPLOYER_INVITE_STATUSES.EXPIRED
        : invite.status,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  }));
}

export async function createOrganizationInvite({
  organizationId,
  actorEmployerId,
  actorRole,
  email,
  role,
}) {
  if (!capabilitiesForEmployerRole(actorRole).includes('team.manage')) {
    throw domainError(403, 'EMPLOYER_CAPABILITY_DENIED', 'Insufficient employer role capability');
  }
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > EMPLOYER_INVITE_EMAIL_MAX || !normalized.includes('@')) {
    throw domainError(400, 'INVALID_INVITE_EMAIL', 'A valid invite email is required');
  }
  if (role === EMPLOYER_ROLES.OWNER || !isValidEmployerRole(role)) {
    throw domainError(400, 'INVALID_INVITE_ROLE', 'Invite role must be admin, recruiter, or viewer');
  }
  if (role === EMPLOYER_ROLES.OWNER) {
    throw domainError(400, 'INVALID_INVITE_ROLE', 'Owner seats cannot be invited');
  }

  const existingMemberEmployer = await Employer.findOne({ email: normalized }).select('_id');
  if (existingMemberEmployer) {
    const existingMembership = await EmployerMembership.findOne({
      employerId: existingMemberEmployer._id,
      active: true,
    }).lean();
    if (existingMembership && String(existingMembership.organizationId) === String(organizationId)) {
      throw domainError(409, 'ALREADY_MEMBER', 'That employer is already a member of this organization');
    }
    if (existingMembership && String(existingMembership.organizationId) !== String(organizationId)) {
      throw domainError(409, 'CROSS_ORGANIZATION_DENIED', 'That employer already belongs to another organization');
    }
  }

  const duplicate = await EmployerInvitation.findOne({
    organizationId,
    email: normalized,
    status: EMPLOYER_INVITE_STATUSES.PENDING,
  }).lean();
  if (duplicate) {
    throw domainError(409, 'DUPLICATE_INVITE', 'A pending invite already exists for this email');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const invitation = await EmployerInvitation.create({
    organizationId,
    email: normalized,
    role,
    status: EMPLOYER_INVITE_STATUSES.PENDING,
    tokenHash: hashResetToken(token),
    invitedBy: actorEmployerId,
    expiresAt: new Date(Date.now() + EMPLOYER_INVITE_TTL_MS),
  });

  return {
    invitationId: invitation._id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    token,
  };
}

export async function previewOrganizationInvite(token) {
  if (!token) throw domainError(400, 'INVITE_TOKEN_REQUIRED', 'Invitation token is required');
  const invitation = await EmployerInvitation.findOne({ tokenHash: hashResetToken(token) }).lean();
  if (!invitation) throw domainError(404, 'INVITE_NOT_FOUND', 'Invitation not found');
  const expired = invitation.expiresAt && invitation.expiresAt.getTime() < Date.now();
  const organization = await Organization.findById(invitation.organizationId).select('displayName').lean();
  return {
    email: invitation.email,
    role: invitation.role,
    status: expired && invitation.status === EMPLOYER_INVITE_STATUSES.PENDING
      ? EMPLOYER_INVITE_STATUSES.EXPIRED
      : invitation.status,
    expiresAt: invitation.expiresAt,
    organizationName: organization?.displayName || '',
  };
}

export async function acceptOrganizationInvite({ token, employer }) {
  if (!token) throw domainError(400, 'INVITE_TOKEN_REQUIRED', 'Invitation token is required');
  const invitation = await EmployerInvitation.findOne({ tokenHash: hashResetToken(token) });
  if (!invitation) throw domainError(404, 'INVITE_NOT_FOUND', 'Invitation not found');
  if (invitation.status === EMPLOYER_INVITE_STATUSES.REVOKED) {
    throw domainError(409, 'INVITE_REVOKED', 'This invitation has been revoked');
  }
  if (invitation.status === EMPLOYER_INVITE_STATUSES.ACCEPTED) {
    throw domainError(409, 'INVITE_ALREADY_ACCEPTED', 'This invitation has already been accepted');
  }
  if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
    invitation.status = EMPLOYER_INVITE_STATUSES.EXPIRED;
    await invitation.save();
    throw domainError(410, 'INVITE_EXPIRED', 'This invitation has expired');
  }
  const email = normalizeEmail(employer.email);
  if (email !== invitation.email) {
    throw domainError(403, 'INVITE_EMAIL_MISMATCH', 'Signed-in employer email does not match this invitation');
  }

  const existing = await EmployerMembership.findOne({ employerId: employer._id, active: true });
  if (existing && String(existing.organizationId) === String(invitation.organizationId)) {
    throw domainError(409, 'ALREADY_MEMBER', 'Already a member of this organization');
  }
  if (existing && String(existing.organizationId) !== String(invitation.organizationId)) {
    const ownerCount = await EmployerMembership.countDocuments({
      organizationId: existing.organizationId,
      role: EMPLOYER_ROLES.OWNER,
      active: true,
    });
    const jobOwned = await Job.countDocuments({ employerId: employer._id });
    if (existing.role === EMPLOYER_ROLES.OWNER && ownerCount <= 1 && jobOwned > 0) {
      throw domainError(409, 'CROSS_ORGANIZATION_DENIED', 'Cannot join another organization while owning active hiring data');
    }
    existing.active = false;
    existing.revokedAt = new Date();
    await existing.save();
  }

  await EmployerMembership.findOneAndUpdate(
    { organizationId: invitation.organizationId, employerId: employer._id },
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

  invitation.status = EMPLOYER_INVITE_STATUSES.ACCEPTED;
  invitation.acceptedAt = new Date();
  invitation.acceptedBy = employer._id;
  await invitation.save();

  return { organizationId: invitation.organizationId, role: invitation.role };
}

export async function revokeOrganizationInvite({ organizationId, invitationId, actorEmployerId, actorRole }) {
  if (!capabilitiesForEmployerRole(actorRole).includes('team.manage')) {
    throw domainError(403, 'EMPLOYER_CAPABILITY_DENIED', 'Insufficient employer role capability');
  }
  requireObjectId(invitationId, 'INVITE_NOT_FOUND', 'Invitation not found');
  const invitation = await EmployerInvitation.findOne({ _id: invitationId, organizationId });
  if (!invitation) throw domainError(404, 'INVITE_NOT_FOUND', 'Invitation not found');
  if (invitation.status !== EMPLOYER_INVITE_STATUSES.PENDING) {
    throw domainError(409, 'INVITE_NOT_PENDING', 'Only pending invitations can be revoked');
  }
  invitation.status = EMPLOYER_INVITE_STATUSES.REVOKED;
  invitation.revokedAt = new Date();
  invitation.revokedBy = actorEmployerId;
  await invitation.save();
  return { invitationId: invitation._id, status: invitation.status };
}

export async function changeMemberRole({
  organizationId,
  membershipId,
  actorRole,
  nextRole,
}) {
  if (!capabilitiesForEmployerRole(actorRole).includes('team.manage')) {
    throw domainError(403, 'EMPLOYER_CAPABILITY_DENIED', 'Insufficient employer role capability');
  }
  if (!isValidEmployerRole(nextRole)) {
    throw domainError(400, 'INVALID_ROLE', 'Invalid employer role');
  }
  requireObjectId(membershipId, 'MEMBER_NOT_FOUND', 'Member not found');
  const membership = await EmployerMembership.findOne({
    _id: membershipId,
    organizationId,
    active: true,
  });
  if (!membership) throw domainError(404, 'MEMBER_NOT_FOUND', 'Member not found');
  if (!canChangeMemberRole({ actorRole, targetRole: membership.role, nextRole })) {
    throw domainError(403, 'OWNERSHIP_SENSITIVE', 'This role change is ownership-sensitive');
  }
  const activeOwnerCount = await EmployerMembership.countDocuments({
    organizationId,
    role: EMPLOYER_ROLES.OWNER,
    active: true,
  });
  if (isLastOwnerProtected({ targetRole: membership.role, activeOwnerCount, nextRole })) {
    throw domainError(409, 'LAST_OWNER_PROTECTED', 'The last owner cannot be demoted');
  }
  membership.role = nextRole;
  await membership.save();
  return { membershipId: membership._id, role: membership.role };
}

export async function removeMember({ organizationId, membershipId, actorEmployerId, actorRole }) {
  if (!capabilitiesForEmployerRole(actorRole).includes('team.manage')) {
    throw domainError(403, 'EMPLOYER_CAPABILITY_DENIED', 'Insufficient employer role capability');
  }
  requireObjectId(membershipId, 'MEMBER_NOT_FOUND', 'Member not found');
  const membership = await EmployerMembership.findOne({
    _id: membershipId,
    organizationId,
    active: true,
  });
  if (!membership) throw domainError(404, 'MEMBER_NOT_FOUND', 'Member not found');
  if (String(membership.employerId) === String(actorEmployerId) && membership.role === EMPLOYER_ROLES.OWNER) {
    const activeOwnerCount = await EmployerMembership.countDocuments({
      organizationId,
      role: EMPLOYER_ROLES.OWNER,
      active: true,
    });
    if (isLastOwnerProtected({ targetRole: membership.role, activeOwnerCount })) {
      throw domainError(409, 'LAST_OWNER_PROTECTED', 'The last owner cannot leave the organization');
    }
  }
  if (!canRemoveMember({ actorRole, targetRole: membership.role })) {
    throw domainError(403, 'OWNERSHIP_SENSITIVE', 'Cannot remove an owner');
  }
  const activeOwnerCount = await EmployerMembership.countDocuments({
    organizationId,
    role: EMPLOYER_ROLES.OWNER,
    active: true,
  });
  if (isLastOwnerProtected({ targetRole: membership.role, activeOwnerCount })) {
    throw domainError(409, 'LAST_OWNER_PROTECTED', 'The last owner cannot be removed');
  }
  membership.active = false;
  membership.revokedAt = new Date();
  membership.revokedBy = actorEmployerId;
  await membership.save();
  return { membershipId: membership._id, active: false };
}
