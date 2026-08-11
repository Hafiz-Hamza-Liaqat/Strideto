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
import crypto from 'node:crypto';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentService } from '../models/agent/AgentService.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { AgentInvitation } from '../models/agent/AgentInvitation.js';
import { AgentLead } from '../models/agent/AgentLead.js';
import { Organization } from '../models/Organization.js';
import { Consultation } from '../models/consultation/Consultation.js';
import { ProfessionalCase } from '../models/case/ProfessionalCase.js';
import { User } from '../models/User.js';
import { DocumentAccessGrant } from '../models/vault/DocumentAccessGrant.js';
import { hashResetToken } from '../utils/tokenStore.js';
import {
  AGENT_INVITE_STATUSES,
  AGENT_INVITE_TTL_MS,
  AGENT_INVITE_EMAIL_MAX,
  isInvitableAgentRole,
  agentRoleHasCapability,
  AGENT_CAPABILITIES,
} from '../../../shared/agent/team.js';
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
  if (profile.agentType === AGENT_TYPES.AGENCY && typeof updates.legalName === 'string') {
    organizationUpdates.legalName = updates.legalName.trim();
  }
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
    price: data.price,
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
    'deliveryMode', 'pricingMode', 'price', 'durationEstimate', 'status',
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

export async function getServices(agentAccountId, { page = 1, limit = 50, q } = {}) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 50));
  const filter = { organizationId: profile.organizationId };
  const term = String(q || '').trim().slice(0, 80);
  if (term) {
    const re = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ title: re }, { description: re }];
  }
  return AgentService.find(filter)
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

export async function getOrgMembers(agentAccountId, query = {}) {
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
  const members = await AgentMembership.find({ organizationId: profile.organizationId }).lean();
  const accounts = await AgentAccount.find({ _id: { $in: members.map((m) => m.agentAccountId) } })
    .select('email')
    .lean();
  const emailById = new Map(accounts.map((a) => [String(a._id), a.email]));
  let rows = members.map((m) => ({
    ...m,
    email: emailById.get(String(m.agentAccountId)) || '',
  }));
  const q = String(query.q || '').trim();
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    rows = rows.filter((row) => re.test(row.email) || re.test(row.role));
  }
  return rows;
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

export async function getLeads(agentAccountId, { page = 1, limit = 50, q = '', status, source } = {}) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 50));
  const filter = { organizationId: profile.organizationId };
  if (status) filter.status = status;
  if (source) filter.source = source;
  if (q) filter.context = { $regex: String(q).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  return AgentLead.find(filter)
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
    .select('title category description countriesServed destinationCountries deliveryMode pricingMode price')
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

function domainError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listOrganizationInvites(agentAccountId) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) throw domainError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
  if (profile.agentType !== AGENT_TYPES.AGENCY) return [];
  const requester = await getMembership(agentAccountId, profile.organizationId);
  if (!requester) throw domainError(403, 'FORBIDDEN', 'Organization membership is inactive');
  const invites = await AgentInvitation.find({
    organizationId: profile.organizationId,
    status: AGENT_INVITE_STATUSES.PENDING,
  }).sort({ createdAt: -1 }).lean();
  const now = Date.now();
  return invites.map((invite) => ({
    invitationId: invite._id,
    email: invite.email,
    role: invite.role,
    status: invite.expiresAt && invite.expiresAt.getTime() < now
      ? AGENT_INVITE_STATUSES.EXPIRED
      : invite.status,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  }));
}

export async function createOrganizationInvite({ agentAccountId, email, role }) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) throw domainError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
  if (profile.agentType !== AGENT_TYPES.AGENCY) {
    throw domainError(403, 'NOT_AGENCY', 'Team invitations are available for agency accounts only');
  }
  const requester = await getMembership(agentAccountId, profile.organizationId);
  if (!requester || !agentRoleHasCapability(requester.role, AGENT_CAPABILITIES.TEAM_MANAGE)) {
    throw domainError(403, 'EMPLOYER_CAPABILITY_DENIED', 'Insufficient agent role capability');
  }
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > AGENT_INVITE_EMAIL_MAX || !normalized.includes('@')) {
    throw domainError(400, 'INVALID_INVITE_EMAIL', 'A valid invite email is required');
  }
  if (!isInvitableAgentRole(role)) {
    throw domainError(400, 'INVALID_INVITE_ROLE', 'Invite role must be admin or member');
  }

  const existingAccount = await AgentAccount.findOne({ email: normalized }).select('_id');
  if (existingAccount) {
    const existingMembership = await AgentMembership.findOne({
      agentAccountId: existingAccount._id,
      active: true,
    }).lean();
    if (existingMembership && String(existingMembership.organizationId) === String(profile.organizationId)) {
      throw domainError(409, 'ALREADY_MEMBER', 'That agent is already a member of this organization');
    }
    if (existingMembership && String(existingMembership.organizationId) !== String(profile.organizationId)) {
      throw domainError(409, 'CROSS_ORGANIZATION_DENIED', 'That agent already belongs to another organization');
    }
  }

  const duplicate = await AgentInvitation.findOne({
    organizationId: profile.organizationId,
    email: normalized,
    status: AGENT_INVITE_STATUSES.PENDING,
  }).lean();
  if (duplicate) throw domainError(409, 'DUPLICATE_INVITE', 'A pending invite already exists for this email');

  const token = crypto.randomBytes(32).toString('hex');
  const invitation = await AgentInvitation.create({
    organizationId: profile.organizationId,
    email: normalized,
    role,
    status: AGENT_INVITE_STATUSES.PENDING,
    tokenHash: hashResetToken(token),
    invitedBy: agentAccountId,
    expiresAt: new Date(Date.now() + AGENT_INVITE_TTL_MS),
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
  const invitation = await AgentInvitation.findOne({ tokenHash: hashResetToken(token) }).lean();
  if (!invitation) throw domainError(404, 'INVITE_NOT_FOUND', 'Invitation not found');
  const expired = invitation.expiresAt && invitation.expiresAt.getTime() < Date.now();
  const organization = await Organization.findById(invitation.organizationId).select('displayName').lean();
  return {
    email: invitation.email,
    role: invitation.role,
    status: expired && invitation.status === AGENT_INVITE_STATUSES.PENDING
      ? AGENT_INVITE_STATUSES.EXPIRED
      : invitation.status,
    expiresAt: invitation.expiresAt,
    organizationName: organization?.displayName || '',
  };
}

export async function acceptOrganizationInvite({ token, agentAccount }) {
  if (!token) throw domainError(400, 'INVITE_TOKEN_REQUIRED', 'Invitation token is required');
  const invitation = await AgentInvitation.findOne({ tokenHash: hashResetToken(token) });
  if (!invitation) throw domainError(404, 'INVITE_NOT_FOUND', 'Invitation not found');
  if (invitation.status === AGENT_INVITE_STATUSES.REVOKED) {
    throw domainError(409, 'INVITE_REVOKED', 'This invitation has been revoked');
  }
  if (invitation.status === AGENT_INVITE_STATUSES.ACCEPTED) {
    throw domainError(409, 'INVITE_ALREADY_ACCEPTED', 'This invitation has already been accepted');
  }
  if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
    invitation.status = AGENT_INVITE_STATUSES.EXPIRED;
    await invitation.save();
    throw domainError(410, 'INVITE_EXPIRED', 'This invitation has expired');
  }
  const email = normalizeEmail(agentAccount.email);
  if (email !== invitation.email) {
    throw domainError(403, 'INVITE_EMAIL_MISMATCH', 'Signed-in agent email does not match this invitation');
  }

  const existing = await AgentMembership.findOne({ agentAccountId: agentAccount._id, active: true });
  if (existing && String(existing.organizationId) === String(invitation.organizationId)) {
    throw domainError(409, 'ALREADY_MEMBER', 'Already a member of this organization');
  }
  if (existing && String(existing.organizationId) !== String(invitation.organizationId)) {
    throw domainError(409, 'CROSS_ORGANIZATION_DENIED', 'Cannot join another agency while an active membership exists');
  }

  await AgentMembership.findOneAndUpdate(
    { organizationId: invitation.organizationId, agentAccountId: agentAccount._id },
    {
      $set: {
        role: invitation.role,
        active: true,
        invitedAt: invitation.createdAt,
        joinedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  invitation.status = AGENT_INVITE_STATUSES.ACCEPTED;
  invitation.acceptedAt = new Date();
  invitation.acceptedBy = agentAccount._id;
  await invitation.save();
  return { organizationId: invitation.organizationId, role: invitation.role };
}

export async function revokeOrganizationInvite({ agentAccountId, invitationId }) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) throw domainError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
  const requester = await getMembership(agentAccountId, profile.organizationId);
  if (!requester || !agentRoleHasCapability(requester.role, AGENT_CAPABILITIES.TEAM_MANAGE)) {
    throw domainError(403, 'FORBIDDEN', 'Insufficient agent role capability');
  }
  if (!invitationId) throw domainError(404, 'INVITE_NOT_FOUND', 'Invitation not found');
  const invitation = await AgentInvitation.findOne({ _id: invitationId, organizationId: profile.organizationId });
  if (!invitation) throw domainError(404, 'INVITE_NOT_FOUND', 'Invitation not found');
  if (invitation.status !== AGENT_INVITE_STATUSES.PENDING) {
    throw domainError(409, 'INVITE_NOT_PENDING', 'Only pending invitations can be revoked');
  }
  invitation.status = AGENT_INVITE_STATUSES.REVOKED;
  invitation.revokedAt = new Date();
  invitation.revokedBy = agentAccountId;
  await invitation.save();
  return { invitationId: invitation._id, status: invitation.status };
}

function studentSafeName(name) {
  const raw = String(name || '').trim();
  if (!raw) return 'Student';
  return raw.split(/\s+/)[0].slice(0, 40);
}

export async function listClientsForAgent(agentAccountId, query = {}) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) throw domainError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
  const membership = await getMembership(agentAccountId, profile.organizationId);
  if (!membership) throw domainError(403, 'FORBIDDEN', 'Organization membership is inactive');

  const orgWide = [AGENT_MEMBER_ROLES.OWNER, AGENT_MEMBER_ROLES.ADMIN].includes(membership.role);
  const pageNum = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 20));

  const [leads, consultations, cases] = await Promise.all([
    AgentLead.find({ organizationId: profile.organizationId })
      .select('userId source status context createdAt')
      .lean(),
    Consultation.find(orgWide
      ? { organizationId: profile.organizationId }
      : { organizationId: profile.organizationId, assignedMembershipId: membership._id })
      .select('studentUserId status assignedMembershipId')
      .lean(),
    ProfessionalCase.find(orgWide
      ? { organizationId: profile.organizationId }
      : { organizationId: profile.organizationId, authorizedMembershipIds: membership._id })
      .select('studentUserId lifecycle title assignedMembershipId')
      .lean(),
  ]);

  const allowedUserIds = new Set();
  if (orgWide) leads.forEach((lead) => allowedUserIds.add(String(lead.userId)));
  consultations.forEach((row) => allowedUserIds.add(String(row.studentUserId)));
  cases.forEach((row) => allowedUserIds.add(String(row.studentUserId)));
  if (!orgWide) {
    leads.forEach((lead) => {
      if (allowedUserIds.has(String(lead.userId))) allowedUserIds.add(String(lead.userId));
    });
  }

  const userIds = [...allowedUserIds];
  const users = await User.find({ _id: { $in: userIds } }).select('name').lean();
  const nameById = new Map(users.map((u) => [String(u._id), studentSafeName(u.name)]));

  const grantCounts = await DocumentAccessGrant.aggregate([
    {
      $match: {
        granteeType: 'agent',
        granteeId: String(membership._id),
        ownerUserId: { $in: userIds },
        status: 'active',
      },
    },
    { $group: { _id: '$ownerUserId', count: { $sum: 1 } } },
  ]).catch(() => []);
  const grantsByUser = new Map(grantCounts.map((row) => [String(row._id), row.count]));

  let clients = userIds.map((userId) => {
    const lead = leads.find((row) => String(row.userId) === userId);
    const relatedConsultations = consultations.filter((row) => String(row.studentUserId) === userId);
    const relatedCases = cases.filter((row) => String(row.studentUserId) === userId);
    return {
      userId,
      displayName: nameById.get(userId) || 'Student',
      origin: lead?.source || (relatedConsultations.length ? 'consultation' : relatedCases.length ? 'case' : 'relationship'),
      context: lead?.context || '',
      status: lead?.status || relatedCases[0]?.lifecycle || relatedConsultations[0]?.status || 'active',
      nextAction: relatedCases.some((c) => c.lifecycle === 'awaiting_student_acceptance')
        ? 'Await Student case acceptance'
        : relatedConsultations.length
          ? 'Open consultation'
          : 'Review relationship',
      consultationCount: relatedConsultations.length,
      caseCount: relatedCases.length,
      vaultAccess: false,
      vaultGrantCount: grantsByUser.get(userId) || 0,
      vaultNote: 'Client relationship grants zero Vault access. Only an exact active grant allows document access.',
    };
  });

  const q = String(query.q || '').trim();
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    clients = clients.filter((row) => re.test(row.displayName) || re.test(row.origin) || re.test(row.status));
  }
  if (query.status) clients = clients.filter((row) => row.status === query.status);

  const total = clients.length;
  const sliced = clients.slice((pageNum - 1) * limitNum, pageNum * limitNum);
  return {
    clients: sliced,
    total,
    page: pageNum,
    limit: limitNum,
    note: 'Client relationship grants zero Vault access and no full Student profile.',
  };
}

export const agentProfileServiceInternals = Object.freeze({
  containsGuaranteeLanguage,
  computeCompleteness,
  slugify,
  mapsCannotAloneVerify: () => true,
});
