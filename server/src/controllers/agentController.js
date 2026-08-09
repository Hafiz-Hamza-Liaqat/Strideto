/**
 * Agent portal controller — profile, services, team, leads, dashboard (Mission 11).
 *
 * All routes require Agent realm authentication (req.agent).
 * No User or Employer realm can invoke these mutations.
 *
 * VAULT: Agent auth alone grants zero Vault access.
 * Even an approved agent with a lead relationship has zero Vault access
 * without an explicit DocumentAccessGrant from Mission 10.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getProfileByAccountId,
  updateProfile,
  getProfileCompleteness,
  advanceOnboardingStep,
  getVerificationStatus,
  getTrustBadges,
  assertApprovedVerification,
  createService,
  updateService,
  getServices,
  getOrgMembers,
  updateMemberRole,
  updateMemberStatus,
  getLeads,
  updateLeadStatus,
  getPublicProfileBySlug,
  getPublicDirectory,
} from '../services/agentProfileService.js';
import { canExercisePrivilegedCapability } from '../../../shared/international/verification.js';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const getDashboard = asyncHandler(async (req, res) => {
  const { agentAccountId } = req.agent;

  const profile = await getProfileByAccountId(agentAccountId).catch(() => null);
  if (!profile) {
    return res.status(200).json({
      onboarding: true,
      message: 'Complete your onboarding to access the dashboard.',
    });
  }

  const verificationStatus = await getVerificationStatus(profile.organizationId);
  const isApproved = canExercisePrivilegedCapability(verificationStatus);

  return res.status(200).json({
    onboarding: !profile.onboardingCompletedAt,
    onboardingStep: profile.onboardingStep,
    profileCompleteness: profile.completenessScore,
    verificationStatus,
    isApproved,
    // Deferred — Mission 12–17
    leadsCount: null,
    clientsCount: null,
    consultationsCount: null,
    casesCount: null,
    earningsTotal: null,
    comingSoon: ['leads', 'consultations', 'cases', 'payments'],
  });
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await getProfileByAccountId(req.agent.agentAccountId);
  return res.status(200).json({ profile });
});

export const patchProfile = asyncHandler(async (req, res) => {
  const profile = await updateProfile(req.agent.agentAccountId, req.body);
  return res.status(200).json({ profile });
});

export const getCompleteness = asyncHandler(async (req, res) => {
  const completeness = await getProfileCompleteness(req.agent.agentAccountId);
  return res.status(200).json({ completeness });
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export const submitOnboardingStep = asyncHandler(async (req, res) => {
  const { step } = req.body || {};
  const profile = await advanceOnboardingStep(req.agent.agentAccountId, step);
  return res.status(200).json({ profile });
});

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export const getVerification = asyncHandler(async (req, res) => {
  const profile = await getProfileByAccountId(req.agent.agentAccountId);
  const status = await getVerificationStatus(profile.organizationId);
  const badges = await getTrustBadges(profile.organizationId);

  return res.status(200).json({
    organizationId: profile.organizationId,
    verificationStatus: status,
    isApproved: canExercisePrivilegedCapability(status),
    trustBadges: badges,
    note: 'Verification is managed through the organization verification system.',
  });
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const listServices = asyncHandler(async (req, res) => {
  const services = await getServices(req.agent.agentAccountId, req.query);
  return res.status(200).json({ services });
});

export const addService = asyncHandler(async (req, res) => {
  const service = await createService(req.agent.agentAccountId, req.body);
  return res.status(201).json({ service });
});

export const editService = asyncHandler(async (req, res) => {
  const service = await updateService(req.agent.agentAccountId, req.params.serviceId, req.body);
  return res.status(200).json({ service });
});

// ---------------------------------------------------------------------------
// Team (Agency only)
// ---------------------------------------------------------------------------

export const listTeamMembers = asyncHandler(async (req, res) => {
  const members = await getOrgMembers(req.agent.agentAccountId);
  return res.status(200).json({ members });
});

export const changeMemberRole = asyncHandler(async (req, res) => {
  const { targetAgentAccountId, role } = req.body || {};
  if (!targetAgentAccountId || !role) {
    return res.status(400).json({ error: 'targetAgentAccountId and role are required' });
  }
  const updated = await updateMemberRole(req.agent.agentAccountId, targetAgentAccountId, role);
  return res.status(200).json({ membership: updated });
});

export const changeMemberStatus = asyncHandler(async (req, res) => {
  const { targetAgentAccountId, active } = req.body || {};
  if (!targetAgentAccountId || typeof active !== 'boolean') {
    return res.status(400).json({ error: 'targetAgentAccountId and boolean active are required' });
  }
  const updated = await updateMemberStatus(req.agent.agentAccountId, targetAgentAccountId, active);
  return res.status(200).json({ membership: updated });
});

// ---------------------------------------------------------------------------
// Leads (foundation — Mission 12+ will expand)
// ---------------------------------------------------------------------------

export const listLeads = asyncHandler(async (req, res) => {
  const leads = await getLeads(req.agent.agentAccountId, req.query);
  return res.status(200).json({
    leads,
    note: 'Leads arise only through explicit user actions. Agent cannot browse all users.',
  });
});

export const patchLeadStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });
  const lead = await updateLeadStatus(req.agent.agentAccountId, req.params.leadId, status);
  return res.status(200).json({ lead });
});

// Clients — relationship foundation only; no Student profile exposure
export const listClients = asyncHandler(async (req, res) => {
  return res.status(200).json({
    clients: [],
    note: 'Client relationships are established in Mission 13 (Consultations). No Student profile is accessible without explicit consent.',
    comingSoon: true,
  });
});

// ---------------------------------------------------------------------------
// Public profile (approved-only, no auth required)
// ---------------------------------------------------------------------------

export const getPublicProfile = asyncHandler(async (req, res) => {
  const profile = await getPublicProfileBySlug(req.params.slug);
  return res.status(200).json({ profile });
});

// Public directory
export const listPublicAgents = asyncHandler(async (req, res) => {
  const {
    agentType,
    countryCode,
    destinationCountry,
    language,
    serviceCategory,
    page,
    limit,
  } = req.query;

  const result = await getPublicDirectory({
    agentType,
    countryCode,
    destinationCountry,
    language,
    serviceCategory,
    page,
    limit,
  });

  return res.status(200).json(result);
});

// ---------------------------------------------------------------------------
// Privileged capability guard example
// ---------------------------------------------------------------------------

export const checkPrivilegedAccess = asyncHandler(async (req, res) => {
  const profile = await getProfileByAccountId(req.agent.agentAccountId);
  await assertApprovedVerification(profile.organizationId);
  return res.status(200).json({ privileged: true });
});
