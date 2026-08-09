/**
 * agentProfileService — Agent profile, services, completeness, and
 * lead/client relationship management (Mission 11).
 *
 * Verification state is authoritative from OrganizationVerification via
 * verificationService — never duplicated here.
 *
 * VAULT ACCESS: Agent authentication alone grants ZERO vault access.
 * Vault access requires an explicit active DocumentAccessGrant from Mission 10.
 */
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentService } from '../models/agent/AgentService.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { AgentLead } from '../models/agent/AgentLead.js';
import { Organization } from '../models/Organization.js';
import { OrganizationVerification } from '../models/OrganizationVerification.js';
import { logAudit } from './auditService.js';
import {
  AGENT_TYPES,
  AGENT_ONBOARDING_STEPS,
  AGENT_SERVICE_STATUSES,
  AGENT_LEAD_STATUSES,
  AGENT_MEMBER_ROLES,
  GUARANTEE_FORBIDDEN_PHRASES,
  COMPLETENESS_SECTIONS,
} from '../../../shared/agent/constants.js';
import { ORGANIZATION_TYPES } from '../../../shared/international/organization.js';
import {
  canExercisePrivilegedCapability,
  deriveBadges,
  VERIFICATION_STATUSES,
} from '../../../shared/international/verification.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function slugify(text) {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'agent';
}

async function uniqueAgentSlug(base) {
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await AgentProfile.exists({ slug: candidate });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function containsGuaranteeLanguage(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return GUARANTEE_FORBIDDEN_PHRASES.some((phrase) => lower.includes(phrase));
}

function assertNoGuaranteeLanguage(fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (containsGuaranteeLanguage(value)) {
      const err = new Error(
        `Field "${key}" contains forbidden guarantee language. Agents may not claim guaranteed outcomes.`
      );
      err.status = 422;
      throw err;
    }
  }
}

/**
 * Compute profile completeness score and sections.
 * Returns { score, completed, missing }.
 * Verification status is SEPARATE from completeness (100% ≠ verified).
 */
function computeCompleteness(profile) {
  const completed = [];
  const missing = [];
  let score = 0;

  for (const section of COMPLETENESS_SECTIONS) {
    const value = profile[section.key];
    const hasValue =
      value !== null &&
      value !== undefined &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0) &&
      !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

    if (hasValue) {
      score += section.weight;
      completed.push(section);
    } else {
      missing.push(section);
    }
  }

  return { score, completed, missing };
}

/**
 * Derive granular trust badges from Mission 2 accepted evidence only.
 * Never auto-promotes self-declared profile fields.
 */
async function deriveTrustBadges(organizationId) {
  const { VerificationEvidence } = await import('../models/VerificationEvidence.js');
  const evidenceRecords = await VerificationEvidence.find(
    { organizationId, status: 'accepted' }
  ).lean();
  return deriveBadges(evidenceRecords);
}

// ---------------------------------------------------------------------------
// Account / Auth
// ---------------------------------------------------------------------------

export async function findAgentAccountById(agentAccountId) {
  return AgentAccount.findById(agentAccountId).lean();
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/**
 * Get or create the agent's profile. Called after registration when
 * the organization has been linked.
 */
export async function getOrCreateProfile(agentAccountId, { organizationId, agentType } = {}) {
  let profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (profile) return profile;

  const org = await Organization.findById(organizationId).lean();
  if (!org) {
    const err = new Error('Organization not found');
    err.status = 404;
    throw err;
  }
  const validTypes = [ORGANIZATION_TYPES.AGENT, ORGANIZATION_TYPES.AGENCY];
  if (!validTypes.includes(org.organizationType)) {
    const err = new Error('Organization must be of type agent or agency');
    err.status = 422;
    throw err;
  }

  const type = agentType || org.organizationType;
  if (type !== org.organizationType || !Object.values(AGENT_TYPES).includes(type)) {
    const err = new Error('Agent profile type must match its organization type');
    err.status = 422;
    throw err;
  }
  const base = slugify(org.displayName || org.legalName || 'agent');
  const slug = await uniqueAgentSlug(base);

  profile = await AgentProfile.create({
    agentAccountId,
    organizationId,
    agentType: type,
    slug,
    professionalName: org.displayName || '',
    countryCode: org.countryCode || '',
  });

  return profile.toObject();
}

export async function getProfileByAccountId(agentAccountId) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }
  return profile;
}

export async function updateProfile(agentAccountId, updates) {
  // Guarantee language check
  assertNoGuaranteeLanguage({
    professionalSummary: updates.professionalSummary,
    specialties: Array.isArray(updates.specialties) ? updates.specialties.join(' ') : '',
  });

  const profile = await AgentProfile.findOne({ agentAccountId });
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }

  const allowed = [
    'professionalName', 'professionalSummary', 'countryCode',
    'serviceCountries', 'destinationCountries', 'languages', 'specialties',
    'yearsOfExperience', 'website', 'officialEmail', 'phone',
    'officeLocation', 'credentialReferences', 'profileImageId',
  ];
  for (const key of allowed) {
    if (key in updates) profile[key] = updates[key];
  }

  // Recompute completeness
  const { score } = computeCompleteness(profile.toObject());
  profile.completenessScore = score;

  await profile.save();

  // Keep the canonical Organization contact identity aligned without copying
  // any verification claims into self-declared profile data.
  const organizationUpdates = {};
  if ('professionalName' in updates) organizationUpdates.displayName = profile.professionalName;
  if ('countryCode' in updates) organizationUpdates.countryCode = profile.countryCode;
  if ('website' in updates) organizationUpdates.website = profile.website;
  if ('phone' in updates) organizationUpdates.phone = profile.phone;
  if ('officeLocation' in updates) organizationUpdates.address = profile.officeLocation;
  if (Object.keys(organizationUpdates).length) {
    await Organization.updateOne(
      { _id: profile.organizationId, organizationType: profile.agentType },
      { $set: organizationUpdates }
    );
  }

  await logAudit({
    action: 'agent_profile_updated',
    actor: { userId: agentAccountId, role: 'agent' },
    metadata: { organizationId: profile.organizationId },
  });

  return profile.toObject();
}

export async function getProfileCompleteness(agentAccountId) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }
  const { score, completed, missing } = computeCompleteness(profile);
  const nextStep = missing[0]?.label || null;

  return {
    overall: score,
    completed: completed.map((s) => ({ key: s.key, label: s.label })),
    missing: missing.map((s) => ({ key: s.key, label: s.label })),
    nextStep,
    // Verification is separate — 100% completeness does NOT mean verified
    verificationNote: 'Profile completeness does not reflect verification status.',
  };
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export async function advanceOnboardingStep(agentAccountId, step) {
  const validSteps = Object.values(AGENT_ONBOARDING_STEPS);
  if (!validSteps.includes(step)) {
    const err = new Error('Invalid onboarding step');
    err.status = 422;
    throw err;
  }

  const profile = await AgentProfile.findOne({ agentAccountId });
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }

  profile.onboardingStep = step;
  if (step === AGENT_ONBOARDING_STEPS.REVIEW) {
    profile.onboardingCompletedAt = new Date();
  }
  await profile.save();

  await logAudit({
    action: 'agent_onboarding_step_updated',
    actor: { userId: agentAccountId, role: 'agent' },
    metadata: { organizationId: profile.organizationId, step },
  });

  return profile.toObject();
}

// ---------------------------------------------------------------------------
// Verification gating
// ---------------------------------------------------------------------------

/**
 * Assert the organization has approved verification status.
 * Throws 403 if not approved.
 */
export async function assertApprovedVerification(organizationId) {
  const record = await OrganizationVerification.findOne({ organizationId }, { status: 1 }).lean();
  const status = record?.status || VERIFICATION_STATUSES.DRAFT;

  if (!canExercisePrivilegedCapability(status)) {
    const err = new Error(
      'This feature requires approved verification status. Current status: ' + status
    );
    err.status = 403;
    err.verificationStatus = status;
    throw err;
  }
}

/**
 * Get the verification status for an organization (returns the VS string).
 */
export async function getVerificationStatus(organizationId) {
  const record = await OrganizationVerification.findOne({ organizationId }, { status: 1 }).lean();
  return record?.status || VERIFICATION_STATUSES.DRAFT;
}

// ---------------------------------------------------------------------------
// Trust badges — from Mission 2 evidence only
// ---------------------------------------------------------------------------

export async function getTrustBadges(organizationId) {
  return deriveTrustBadges(organizationId);
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export async function createService(agentAccountId, data) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }

  // Guarantee language check
  assertNoGuaranteeLanguage({
    title: data.title,
    description: data.description,
    eligibilityNotes: data.eligibilityNotes,
  });

  const slugBase = slugify(data.title || 'service');
  // Unique within org
  let slug = slugBase;
  for (let i = 1; i < 100; i++) {
    const taken = await AgentService.exists({ organizationId: profile.organizationId, slug });
    if (!taken) break;
    slug = `${slugBase}-${i + 1}`;
  }

  const service = await AgentService.create({
    organizationId: profile.organizationId,
    agentProfileId: profile._id,
    title: data.title,
    slug,
    category: data.category,
    description: data.description || '',
    eligibilityNotes: data.eligibilityNotes || '',
    countriesServed: data.countriesServed || [],
    destinationCountries: data.destinationCountries || [],
    journeyType: data.journeyType,
    deliveryMode: data.deliveryMode,
    pricingMode: data.pricingMode,
    durationEstimate: data.durationEstimate || '',
    status: AGENT_SERVICE_STATUSES.DRAFT,
  });

  await logAudit({
    action: 'agent_service_created',
    actor: { userId: agentAccountId, role: 'agent' },
    metadata: { serviceId: service._id, organizationId: profile.organizationId },
  });

  return service.toObject();
}

export async function updateService(agentAccountId, serviceId, data) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }

  // Guarantee language check
  assertNoGuaranteeLanguage({
    title: data.title,
    description: data.description,
    eligibilityNotes: data.eligibilityNotes,
  });

  const service = await AgentService.findOne({
    _id: serviceId,
    organizationId: profile.organizationId,
  });
  if (!service) {
    const err = new Error('Service not found');
    err.status = 404;
    throw err;
  }

  if (data.status === AGENT_SERVICE_STATUSES.ACTIVE) {
    await assertApprovedVerification(profile.organizationId);
  }

  const allowed = [
    'title', 'category', 'description', 'eligibilityNotes',
    'countriesServed', 'destinationCountries', 'journeyType',
    'deliveryMode', 'pricingMode', 'durationEstimate', 'status',
  ];
  for (const key of allowed) {
    if (key in data) service[key] = data[key];
  }

  await service.save();

  await logAudit({
    action: 'agent_service_updated',
    actor: { userId: agentAccountId, role: 'agent' },
    metadata: { serviceId, organizationId: profile.organizationId },
  });

  return service.toObject();
}

export async function getServices(agentAccountId, { page = 1, limit = 50 } = {}) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 50));
  return AgentService.find({ organizationId: profile.organizationId })
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .lean();
}

// ---------------------------------------------------------------------------
// Team / Membership (Agency)
// ---------------------------------------------------------------------------

export async function getMembership(agentAccountId, organizationId) {
  return AgentMembership.findOne({
    agentAccountId,
    organizationId,
    active: true,
  }).lean();
}

export async function getOrgMembers(agentAccountId) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }
  // Only agency type shows team
  if (profile.agentType !== AGENT_TYPES.AGENCY) {
    return [];
  }
  const requester = await getMembership(agentAccountId, profile.organizationId);
  if (!requester) {
    const err = new Error('Organization membership is inactive');
    err.status = 403;
    throw err;
  }
  return AgentMembership.find({ organizationId: profile.organizationId })
    .lean();
}

export async function updateMemberRole(agentAccountId, targetAgentAccountId, newRole) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }

  // Only owner/admin can change roles
  const membership = await AgentMembership.findOne({
    agentAccountId,
    organizationId: profile.organizationId,
    active: true,
  }).lean();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  const validRoles = Object.values(AGENT_MEMBER_ROLES);
  if (!validRoles.includes(newRole)) {
    const err = new Error('Invalid role');
    err.status = 422;
    throw err;
  }
  const target = await AgentMembership.findOne({
    agentAccountId: targetAgentAccountId,
    organizationId: profile.organizationId,
  }).lean();
  if (target?.role === AGENT_MEMBER_ROLES.OWNER) {
    const err = new Error('Organization owner role cannot be changed');
    err.status = 409;
    throw err;
  }

  const updated = await AgentMembership.findOneAndUpdate(
    { agentAccountId: targetAgentAccountId, organizationId: profile.organizationId },
    { $set: { role: newRole } },
    { new: true }
  ).lean();

  if (!updated) {
    const err = new Error('Member not found');
    err.status = 404;
    throw err;
  }

  await logAudit({
    action: 'agent_member_role_changed',
    actor: { userId: agentAccountId, role: 'agent' },
    metadata: {
      targetAgentAccountId,
      newRole,
      organizationId: profile.organizationId,
    },
  });

  return updated;
}

export async function updateMemberStatus(agentAccountId, targetAgentAccountId, active) {
  if (typeof active !== 'boolean') {
    const err = new Error('active must be a boolean'); err.status = 422; throw err;
  }
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile || profile.agentType !== AGENT_TYPES.AGENCY) {
    const err = new Error('Agency profile not found'); err.status = 404; throw err;
  }
  const requester = await getMembership(agentAccountId, profile.organizationId);
  if (!requester || ![AGENT_MEMBER_ROLES.OWNER, AGENT_MEMBER_ROLES.ADMIN].includes(requester.role)) {
    const err = new Error('Insufficient permissions'); err.status = 403; throw err;
  }
  const target = await AgentMembership.findOne({
    agentAccountId: targetAgentAccountId,
    organizationId: profile.organizationId,
  }).lean();
  if (!target) { const err = new Error('Member not found'); err.status = 404; throw err; }
  if (target.role === AGENT_MEMBER_ROLES.OWNER) {
    const err = new Error('Organization owner cannot be deactivated'); err.status = 409; throw err;
  }
  const updated = await AgentMembership.findOneAndUpdate(
    { _id: target._id, organizationId: profile.organizationId },
    { $set: { active } },
    { new: true }
  ).lean();
  await logAudit({
    action: 'agent_member_status_changed',
    actor: { userId: agentAccountId, role: 'agent' },
    metadata: { targetAgentAccountId, active, organizationId: profile.organizationId },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Leads — lead may only arise through explicit user action
// ---------------------------------------------------------------------------

export async function getLeads(agentAccountId, { page = 1, limit = 50 } = {}) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }
  // Returns lead list for org — no User profile data exposed
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 50));
  return AgentLead.find({ organizationId: profile.organizationId })
    .select('userId source context status createdAt updatedAt')
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .lean();
}

export async function updateLeadStatus(agentAccountId, leadId, status) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }
  if (!Object.values(AGENT_LEAD_STATUSES).includes(status)) {
    const err = new Error('Invalid lead status');
    err.status = 422;
    throw err;
  }
  const lead = await AgentLead.findOneAndUpdate(
    { _id: leadId, organizationId: profile.organizationId },
    { $set: { status } },
    { new: true }
  ).lean();
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }

  await logAudit({
    action: 'agent_lead_status_changed',
    actor: { userId: agentAccountId, role: 'agent' },
    metadata: { leadId, newStatus: status, organizationId: profile.organizationId },
  });

  return lead;
}

// ---------------------------------------------------------------------------
// Public profile (approved-only)
// ---------------------------------------------------------------------------

export async function getPublicProfileBySlug(slug) {
  const profile = await AgentProfile.findOne({ slug }).lean();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }

  // Mission 2 is the only authority for public visibility. Profile
  // completeness/status never promotes an organization to verified.
  const verStatus = await getVerificationStatus(profile.organizationId);
  if (!canExercisePrivilegedCapability(verStatus)) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }

  const org = await Organization.findById(profile.organizationId).lean();

  const badges = await deriveTrustBadges(profile.organizationId);
  const services = await AgentService.find({
    organizationId: profile.organizationId,
    status: AGENT_SERVICE_STATUSES.ACTIVE,
  })
    .select('title category description countriesServed destinationCountries deliveryMode pricingMode')
    .lean();

  return {
    slug: profile.slug,
    professionalName: profile.professionalName,
    agentType: profile.agentType,
    countryCode: profile.countryCode,
    serviceCountries: profile.serviceCountries,
    destinationCountries: profile.destinationCountries,
    languages: profile.languages,
    specialties: profile.specialties,
    yearsOfExperience: profile.yearsOfExperience,
    professionalSummary: profile.professionalSummary,
    website: profile.website,
    phone: profile.phone,
    officeLocation: profile.officeLocation || null,
    verificationStatus: verStatus,
    trustBadges: badges,
    services,
    organization: org
      ? {
          displayName: org.displayName,
          countryCode: org.countryCode,
          website: org.website,
        }
      : null,
  };
}

/**
 * Public agent directory — approved organizations only.
 * No ranking by payment or promotion.
 */
export async function getPublicDirectory({
  agentType,
  countryCode,
  destinationCountry,
  language,
  serviceCategory,
  page = 1,
  limit = 20,
} = {}) {
  const approvedOrgs = await OrganizationVerification.find(
    { status: VERIFICATION_STATUSES.APPROVED },
    { organizationId: 1 }
  ).lean();
  const approvedOrgIds = approvedOrgs.map((r) => r.organizationId);

  const query = {
    organizationId: { $in: approvedOrgIds },
  };
  if (agentType && Object.values(AGENT_TYPES).includes(agentType)) {
    query.agentType = agentType;
  }
  if (countryCode) query.countryCode = countryCode.toUpperCase();
  if (destinationCountry) query.destinationCountries = destinationCountry.toUpperCase();
  if (language) query.languages = language.toLowerCase();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

  let q = AgentProfile.find(query)
    .select('slug professionalName agentType countryCode serviceCountries destinationCountries languages specialties professionalSummary website')
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  if (serviceCategory) {
    const svcOrgs = await AgentService.distinct('organizationId', {
      category: serviceCategory,
      status: AGENT_SERVICE_STATUSES.ACTIVE,
    });
    query.organizationId = { $in: approvedOrgIds.filter((id) =>
      svcOrgs.some((s) => String(s) === String(id))
    )};
    q = AgentProfile.find(query)
      .select('slug professionalName agentType countryCode serviceCountries destinationCountries languages specialties professionalSummary website')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 });
  }

  const [profiles, total] = await Promise.all([
    q.lean(),
    AgentProfile.countDocuments(query),
  ]);

  return {
    profiles,
    total,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum),
  };
}

export const agentProfileServiceInternals = Object.freeze({
  containsGuaranteeLanguage,
  computeCompleteness,
  slugify,
});
