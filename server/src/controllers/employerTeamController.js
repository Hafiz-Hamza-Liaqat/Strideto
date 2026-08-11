import { asyncHandler } from '../utils/asyncHandler.js';
import { Employer } from '../models/Employer.js';
import {
  listOrganizationTeam,
  listOrganizationInvites,
  createOrganizationInvite,
  previewOrganizationInvite,
  acceptOrganizationInvite,
  revokeOrganizationInvite,
  changeMemberRole,
  removeMember,
} from '../services/employer/employerOrganizationService.js';
import { EMPLOYER_CAPABILITIES } from '../../../shared/employer/team.js';

function orgId(req) {
  return req.employer.organizationId;
}

export const listTeam = asyncHandler(async (req, res) => {
  const result = await listOrganizationTeam(orgId(req), {
    q: req.query.q,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json({
    ...result,
    organizationId: orgId(req),
    role: req.employer.teamRole,
  });
});

export const listInvites = asyncHandler(async (req, res) => {
  const invites = await listOrganizationInvites(orgId(req));
  res.json({ data: invites });
});

export const createInvite = asyncHandler(async (req, res) => {
  try {
    const result = await createOrganizationInvite({
      organizationId: orgId(req),
      actorEmployerId: req.employer.employerId,
      actorRole: req.employer.teamRole,
      email: req.body?.email,
      role: req.body?.role,
    });
    res.status(201).json({
      invitationId: result.invitationId,
      email: result.email,
      role: result.role,
      expiresAt: result.expiresAt,
      acceptPath: `/employer/accept-invitation?token=${encodeURIComponent(result.token)}`,
      emailDelivery: 'not_configured',
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    throw err;
  }
});

export const revokeInvite = asyncHandler(async (req, res) => {
  try {
    const result = await revokeOrganizationInvite({
      organizationId: orgId(req),
      invitationId: req.params.invitationId,
      actorEmployerId: req.employer.employerId,
      actorRole: req.employer.teamRole,
    });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    throw err;
  }
});

export const updateMember = asyncHandler(async (req, res) => {
  try {
    const result = await changeMemberRole({
      organizationId: orgId(req),
      membershipId: req.params.membershipId,
      actorRole: req.employer.teamRole,
      nextRole: req.body?.role,
    });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    throw err;
  }
});

export const deleteMember = asyncHandler(async (req, res) => {
  try {
    const result = await removeMember({
      organizationId: orgId(req),
      membershipId: req.params.membershipId,
      actorEmployerId: req.employer.employerId,
      actorRole: req.employer.teamRole,
    });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    throw err;
  }
});

export const previewInvite = asyncHandler(async (req, res) => {
  try {
    const result = await previewOrganizationInvite(req.query.token || req.params.token);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    throw err;
  }
});

export const acceptInvite = asyncHandler(async (req, res) => {
  const employer = await Employer.findById(req.employer.employerId).select('email companyName');
  if (!employer) return res.status(404).json({ error: 'Employer not found' });
  try {
    const result = await acceptOrganizationInvite({
      token: req.body?.token || req.query.token,
      employer,
    });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    throw err;
  }
});

export const TEAM_CAPABILITIES = EMPLOYER_CAPABILITIES;
