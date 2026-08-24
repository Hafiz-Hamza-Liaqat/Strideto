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
  AGENT_SERVICE_CATEGORIES,
  AGENT_LEAD_STATUSES,
  AGENT_MEMBER_ROLES,
  GUARANTEE_FORBIDDEN_PHRASES,
  COMPLETENESS_SECTIONS,
} from '../../../shared/agent/constants.js';
import { ORGANIZATION_TYPES } from '../../../shared/international/organization.js';
import {
  canExercisePrivilegedCapability,
  isSuspendedOrRevoked,
  deriveBadges,
  VERIFICATION_STATUSES,
} from '../../../shared/international/verification.js';
import { OVERRIDE_TYPES } from './capability/overrideService.js';
import { coerceCountryCode } from '../../../shared/international/country.js';
import { canonicalizeStoredPhone } from '../../../shared/international/phone.js';
import { validateAgentOnboardingStep } from '../../../shared/agent/onboardingPolicy.js';
import { BUSINESS_SERVICES_CAPABILITY_IDS } from '../../../shared/gbs/businessServicesCapabilities.js';
import {
  defaultPermissionsForInvite,
  normalizeDomainAccessList,
} from '../../../shared/provider/providerDomainPermissions.js';
import { isKnownProviderDomainId } from '../../../shared/provider/providerDomains.js';
import { listAgencyActivatedDomains } from './gbs/providerDomainService.js';
import { assertProviderDomainAccess } from './gbs/providerDomainService.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { PROVIDER_SUBJECT_TYPES } from '../../../shared/gbs/constants.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../shared/security/gbsAuditEvents.js';
import {
  isPubliclyLaunchVisible,
  withFixtureExclusion,
} from '../../../shared/publicDiscovery/fixtureExclusion.js';

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
export async function getOrCreateProfile(agentAccountId, { organizationId, agentType, providerDomainInitializationState } = {}) {
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
    ...(providerDomainInitializationState
      ? { providerDomainInitializationState }
      : {}),
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

function coerceYearsOfExperience(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 99) {
    const err = new Error('Validation failed');
    err.status = 400;
    throw err;
  }
  return Math.trunc(n);
}

function sanitizeOfficeLocation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return {
    addressLine1: String(value.addressLine1 || '').trim(),
    city: String(value.city || '').trim(),
    region: String(value.region || '').trim(),
    postalCode: String(value.postalCode || '').trim(),
    countryCode: coerceCountryCode(value.countryCode) || '',
  };
}

export async function updateProfile(agentAccountId, updates) {
  updates = updates && typeof updates === 'object' ? updates : {};

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

  const membership = await getMembership(agentAccountId, profile.organizationId);
  const canWriteOrg = !membership
    || agentRoleHasCapability(membership.role, AGENT_CAPABILITIES.PROFILE_WRITE);
  if (profile.agentType === AGENT_TYPES.AGENCY && typeof updates.legalName === 'string' && !canWriteOrg) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  const allowed = [
    'professionalName', 'professionalSummary', 'countryCode',
    'serviceCountries', 'destinationCountries', 'languages', 'specialties',
    'yearsOfExperience', 'website', 'officialEmail', 'phone',
    'officeLocation', 'credentialReferences', 'profileImageId',
  ];
  for (const key of allowed) {
    if (!(key in updates)) continue;
    if (key === 'serviceCountries' || key === 'destinationCountries') {
      const list = Array.isArray(updates[key]) ? updates[key] : [];
      profile[key] = list.map((value) => coerceCountryCode(value)).filter(Boolean);
      continue;
    }
    if (key === 'countryCode') {
      profile.countryCode = coerceCountryCode(updates.countryCode) || '';
      continue;
    }
    if (key === 'phone') {
      const result = canonicalizeStoredPhone(updates.phone);
      if (!result.ok) {
        const err = new Error(result.error);
        err.status = 400;
        throw err;
      }
      profile.phone = result.value;
      continue;
    }
    if (key === 'yearsOfExperience') {
      profile.yearsOfExperience = coerceYearsOfExperience(updates.yearsOfExperience);
      continue;
    }
    if (key === 'officialEmail') {
      profile.officialEmail = String(updates.officialEmail || '').trim().toLowerCase();
      continue;
    }
    if (key === 'website') {
      profile.website = String(updates.website || '').trim();
      continue;
    }
    if (key === 'professionalSummary') {
      const text = String(updates.professionalSummary || '');
      if (text.length > 2000) {
        const err = new Error('Validation failed');
        err.status = 400;
        throw err;
      }
      profile.professionalSummary = text;
      continue;
    }
    if (key === 'officeLocation') {
      profile.officeLocation = sanitizeOfficeLocation(updates.officeLocation);
      continue;
    }
    if (key === 'languages' || key === 'specialties' || key === 'credentialReferences') {
      const list = Array.isArray(updates[key]) ? updates[key] : [];
      profile[key] = list.map((item) => String(item || '').trim()).filter(Boolean);
      continue;
    }
    profile[key] = updates[key];
  }

  // Recompute completeness
  const { score } = computeCompleteness(profile.toObject());
  profile.completenessScore = score;

  try {
    await profile.save();
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError' || err.name === 'StrictModeError') {
      err.status = 400;
      err.message = 'Validation failed';
    }
    throw err;
  }

  // Keep the canonical Organization contact identity aligned without copying
  // any verification claims into self-declared profile data.
  const organizationUpdates = {};
  if (canWriteOrg) {
    if ('professionalName' in updates) {
      const name = String(profile.professionalName || '').trim();
      if (name) organizationUpdates.displayName = name;
    }
    if ('countryCode' in updates) organizationUpdates.countryCode = profile.countryCode;
    if ('website' in updates) organizationUpdates.website = profile.website;
    if ('phone' in updates) organizationUpdates.phone = profile.phone;
    if ('officeLocation' in updates) organizationUpdates.address = profile.officeLocation;
    if (profile.agentType === AGENT_TYPES.AGENCY && typeof updates.legalName === 'string') {
      organizationUpdates.legalName = updates.legalName.trim();
    }
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

export async function advanceOnboardingStep(agentAccountId, step, { skip = false } = {}) {
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

  const org = await Organization.findById(profile.organizationId).select('legalName').lean();
  const verdict = validateAgentOnboardingStep(step, {
    ...profile.toObject(),
    legalName: org?.legalName || '',
  }, { skip: Boolean(skip) });
  if (!verdict.ok) {
    const err = new Error(verdict.message || 'Complete the required fields before continuing.');
    err.status = 422;
    err.details = verdict.errors;
    throw err;
  }

  profile.onboardingStep = step;
  const skipped = new Set(profile.onboardingSkippedSteps || []);
  if (skip) skipped.add(step);
  else skipped.delete(step);
  profile.onboardingSkippedSteps = [...skipped];
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

  // Absolute hard deny: suspended and revoked are terminal — no override type lifts them.
  if (isSuspendedOrRevoked(status)) {
    const err = new Error(
      'Organization is blocked from exercising capabilities. Current status: ' + status
    );
    err.status = 403;
    err.verificationStatus = status;
    err.code = 'BLOCKED';
    throw err;
  }

  if (!canExercisePrivilegedCapability(status)) {
    // Active super-admin override may bypass the pre-approval gate.
    // For qa_test overrides: REJECTED is not a hard blocker (cross-role QA testing).
    // For manual_exception and other types: REJECTED is still a hard deny.
    const { getOverrideService } = await import('./capability/overrideRuntime.js');
    const override = await getOverrideService().getActiveOverride(String(organizationId));
    const isRejected = status === VERIFICATION_STATUSES.REJECTED;
    const isQaTestOverride = override?.overrideType === OVERRIDE_TYPES.QA_TEST;
    if (!override || (isRejected && !isQaTestOverride)) {
      const err = new Error(
        'This feature requires approved verification status. Current status: ' + status
      );
      err.status = 403;
      err.verificationStatus = status;
      err.code = isRejected ? 'BLOCKED' : 'VERIFICATION_REQUIRED';
      throw err;
    }
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

  if (data?.capabilityId) {
    const err = new Error('Education services do not accept Business Services capabilityId');
    err.status = 400;
    err.code = 'education_service_rejects_gbs_capability';
    throw err;
  }
  const gbsIds = new Set(Object.values(BUSINESS_SERVICES_CAPABILITY_IDS));
  if (data?.category && gbsIds.has(data.category)) {
    const err = new Error('Education service categories cannot include Business Services capabilities');
    err.status = 400;
    err.code = 'education_service_category_invalid';
    throw err;
  }
  if (data?.category && !Object.values(AGENT_SERVICE_CATEGORIES).includes(data.category)) {
    const err = new Error('Unknown education service category');
    err.status = 400;
    err.code = 'education_service_category_invalid';
    throw err;
  }

  const subjectType = profile.agentType === AGENT_TYPES.AGENCY
    ? PROVIDER_SUBJECT_TYPES.ORGANIZATION
    : PROVIDER_SUBJECT_TYPES.AGENT;
  const subjectId = subjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION
    ? String(profile.organizationId)
    : String(agentAccountId);
  await assertProviderDomainAccess({
    agentAccountId,
    subjectType,
    subjectId,
    domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
    permissionId: PROVIDER_DOMAIN_PERMISSIONS.EDUCATION_SERVICES_MANAGE,
    actor: { agentAccountId, role: 'agent' },
  });

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

  if (data?.capabilityId) {
    const err = new Error('Education services do not accept Business Services capabilityId');
    err.status = 400;
    err.code = 'education_service_rejects_gbs_capability';
    throw err;
  }
  const gbsIds = new Set(Object.values(BUSINESS_SERVICES_CAPABILITY_IDS));
  if (data?.category && (gbsIds.has(data.category) || !Object.values(AGENT_SERVICE_CATEGORIES).includes(data.category))) {
    const err = new Error('Unknown education service category');
    err.status = 400;
    err.code = 'education_service_category_invalid';
    throw err;
  }

  const subjectType = profile.agentType === AGENT_TYPES.AGENCY
    ? PROVIDER_SUBJECT_TYPES.ORGANIZATION
    : PROVIDER_SUBJECT_TYPES.AGENT;
  const subjectId = subjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION
    ? String(profile.organizationId)
    : String(agentAccountId);
  await assertProviderDomainAccess({
    agentAccountId,
    subjectType,
    subjectId,
    domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
    permissionId: PROVIDER_DOMAIN_PERMISSIONS.EDUCATION_SERVICES_MANAGE,
    actor: { agentAccountId, role: 'agent' },
  });

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
  const [services, total] = await Promise.all([
    AgentService.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    AgentService.countDocuments(filter),
  ]);
  return { services, page: pageNum, limit: limitNum, total, totalPages: Math.max(1, Math.ceil(total / limitNum)) };
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
    return { members: [], page: 1, limit: 20, total: 0, totalPages: 1 };
  }
  const requester = await getMembership(agentAccountId, profile.organizationId);
  if (!requester) {
    const err = new Error('Organization membership is inactive');
    err.status = 403;
    throw err;
  }
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const focusDomainId = String(query.focusDomainId || '').trim();
  if (focusDomainId && !isKnownProviderDomainId(focusDomainId)) {
    const err = new Error('Unknown provider domain'); err.status = 400; throw err;
  }
  const match = { organizationId: profile.organizationId };
  if (focusDomainId) match.domainAccess = { $elemMatch: { domainId: focusDomainId } };
  const q = String(query.q || '').trim().slice(0, 100);
  const pipeline = [
    { $match: match },
    { $lookup: {
      from: AgentAccount.collection.name,
      let: { accountId: '$agentAccountId' },
      pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$accountId'] } } }, { $project: { _id: 0, email: 1 } }],
      as: 'account',
    } },
    { $set: { email: { $ifNull: [{ $first: '$account.email' }, ''] } } },
  ];
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pipeline.push({ $match: { $or: [{ email: { $regex: escaped, $options: 'i' } }, { role: { $regex: escaped, $options: 'i' } }] } });
  }
  pipeline.push(
    { $sort: { createdAt: 1, _id: 1 } },
    { $facet: {
      members: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: { account: 0 } }],
      metadata: [{ $count: 'total' }],
    } },
  );
  const [result = { members: [], metadata: [] }] = await AgentMembership.aggregate(pipeline);
  const total = result.metadata?.[0]?.total || 0;
  return { members: result.members || [], page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
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
    action: active ? 'agent_member_status_changed' : GBS_AUDIT_EVENTS.TEAM_DOMAIN_ACCESS_REMOVED,
    actor: { userId: agentAccountId, role: 'agent' },
    metadata: redactAuditMetadata({ active, organizationPresent: true }),
  });
  return updated;
}

export async function updateMemberDomainAccess({
  agentAccountId,
  targetAgentAccountId,
  domainAccess,
  expectedVersion,
} = {}) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile || profile.agentType !== AGENT_TYPES.AGENCY) {
    throw domainError(404, 'PROFILE_NOT_FOUND', 'Agency profile not found');
  }
  const requester = await getMembership(agentAccountId, profile.organizationId);
  if (!requester || !agentRoleHasCapability(requester.role, AGENT_CAPABILITIES.TEAM_MANAGE)) {
    throw domainError(403, 'FORBIDDEN', 'Insufficient agent role capability');
  }
  const activated = await listAgencyActivatedDomains(profile.organizationId);
  // Empty domainAccess is allowed so Education (or Business) assignment can be
  // removed without deleting the shared membership row used by the other portal.
  const next = normalizeDomainAccessList(domainAccess);
  for (const row of next) {
    if (!activated.includes(row.domainId)) {
      throw domainError(400, 'provider_domain_not_available', 'Agency has not activated that provider domain');
    }
  }
  const target = await AgentMembership.findOne({
    agentAccountId: targetAgentAccountId,
    organizationId: profile.organizationId,
  });
  if (!target) throw domainError(404, 'MEMBER_NOT_FOUND', 'Member not found');
  if (typeof expectedVersion === 'number' && target.recordVersion !== expectedVersion) {
    const err = domainError(409, 'optimistic_concurrency_conflict', 'Membership was updated by another request');
    throw err;
  }
  target.domainAccess = next;
  target.recordVersion = (target.recordVersion || 0) + 1;
  await target.save();
  await logAudit({
    action: GBS_AUDIT_EVENTS.TEAM_DOMAIN_ACCESS_UPDATED,
    actor: { userId: agentAccountId, role: 'agent' },
    metadata: redactAuditMetadata({ domainCount: next.length }),
  });
  return target.toObject();
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
  const [leads, total] = await Promise.all([
    AgentLead.find(filter)
      .select('userId source context status createdAt updatedAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    AgentLead.countDocuments(filter),
  ]);
  const userIds = [...new Set(leads.map((lead) => lead.userId).filter(Boolean))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('name').lean()
    : [];
  const names = new Map(users.map((user) => [String(user._id), user.name]));
  const items = leads.map((lead) => ({
    _id: lead._id,
    source: lead.source,
    context: lead.context,
    status: lead.status,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    displayName: names.get(String(lead.userId)) || 'Relationship',
  }));
  return { leads: items, page: pageNum, limit: limitNum, total, totalPages: Math.max(1, Math.ceil(total / limitNum)) };
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
  // Normal path: launch-eligible, fixture-excluded profile.
  let profile = await AgentProfile.findOne(withFixtureExclusion({ slug })).lean();
  let qaTestAccess = false;

  if (!profile || !isPubliclyLaunchVisible(profile)) {
    // QA direct-link path: find without launch/fixture filter, then require an active
    // qa_test super-admin override. Profile does NOT become organically verified.
    const rawProfile = await AgentProfile.findOne({ slug }).lean();
    if (!rawProfile) {
      const err = new Error('Profile not found');
      err.status = 404;
      throw err;
    }
    const rawVerStatus = await getVerificationStatus(rawProfile.organizationId);
    // Suspended/revoked are absolute — even qa_test cannot expose these.
    if (isSuspendedOrRevoked(rawVerStatus)) {
      const err = new Error('Profile not found');
      err.status = 404;
      throw err;
    }
    const { getOverrideService } = await import('./capability/overrideRuntime.js');
    const override = await getOverrideService().getActiveOverride(String(rawProfile.organizationId));
    if (!override || override.overrideType !== OVERRIDE_TYPES.QA_TEST) {
      const err = new Error('Profile not found');
      err.status = 404;
      throw err;
    }
    profile = rawProfile;
    qaTestAccess = true;
  }

  // Mission 2 is the only authority for public visibility. Profile
  // completeness/status never promotes an organization to verified.
  const verStatus = await getVerificationStatus(profile.organizationId);
  if (!qaTestAccess && !canExercisePrivilegedCapability(verStatus)) {
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
    .select('title category description eligibilityNotes countriesServed destinationCountries deliveryMode pricingMode price durationEstimate')
    .lean();

  // Education public "Verified by Strideto" uses the same OrganizationVerification
  // APPROVED gate as assertApprovedVerification / Education Marketplace privilege.
  // Business capability approval is separate and must not fabricate this mark.
  // QA test providers are never organically verified — the badge is always false.
  const educationVerified = !qaTestAccess && canExercisePrivilegedCapability(verStatus);

  return {
    slug: profile.slug,
    professionalName: profile.professionalName,
    agentType: profile.agentType,
    countryCode: coerceCountryCode(profile.countryCode) || profile.countryCode,
    serviceCountries: (profile.serviceCountries || []).map((c) => coerceCountryCode(c) || c).filter(Boolean),
    destinationCountries: (profile.destinationCountries || []).map((c) => coerceCountryCode(c) || c).filter(Boolean),
    languages: profile.languages,
    specialties: profile.specialties,
    yearsOfExperience: profile.yearsOfExperience,
    professionalSummary: profile.professionalSummary,
    website: profile.website,
    phone: profile.phone,
    officeLocation: profile.officeLocation || null,
    verificationStatus: verStatus,
    ...(qaTestAccess ? { qaTestProvider: true, qaTestLabel: 'QA Test Provider — Not Verified' } : {}),
    educationProfessionalVerification: {
      verified: educationVerified,
      scope: 'education_mobility',
    },
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
  const extras = {};
  if (agentType && Object.values(AGENT_TYPES).includes(agentType)) {
    extras.agentType = agentType;
  }
  if (countryCode) extras.countryCode = countryCode.toUpperCase();
  if (destinationCountry) extras.destinationCountries = destinationCountry.toUpperCase();
  if (language) extras.languages = language.toLowerCase();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const pipeline = [
    { $match: withFixtureExclusion(extras) },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $lookup: {
        from: OrganizationVerification.collection.name,
        let: { organizationId: '$organizationId' },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ['$organizationId', '$$organizationId'] },
            { $eq: ['$status', VERIFICATION_STATUSES.APPROVED] },
          ] } } },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: 'educationVerification',
      },
    },
    { $match: { 'educationVerification.0': { $exists: true } } },
  ];
  if (serviceCategory) {
    pipeline.push(
      {
        $lookup: {
          from: AgentService.collection.name,
          let: { organizationId: '$organizationId' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$organizationId', '$$organizationId'] },
              { $eq: ['$category', serviceCategory] },
              { $eq: ['$status', AGENT_SERVICE_STATUSES.ACTIVE] },
            ] } } },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: 'eligibleServices',
        },
      },
      { $match: { 'eligibleServices.0': { $exists: true } } }
    );
  }
  pipeline.push(
    {
      $facet: {
        profiles: [
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
          { $project: { slug: 1, professionalName: 1, agentType: 1, countryCode: 1, serviceCountries: 1, destinationCountries: 1, languages: 1, specialties: 1, professionalSummary: 1, website: 1 } },
        ],
        total: [{ $count: 'value' }],
      },
    }
  );
  const [result] = await AgentProfile.aggregate(pipeline);
  const profiles = result?.profiles || [];
  const total = result?.total?.[0]?.value || 0;

  // Directory membership already requires OrganizationVerification APPROVED.
  // Expose the same Education verification projection as profile detail.
  const projected = profiles.map((profile) => ({
    ...profile,
    educationProfessionalVerification: {
      verified: true,
      scope: 'education_mobility',
    },
  }));

  return {
    profiles: projected,
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
    domainAccess: invite.domainAccess || [],
    status: invite.expiresAt && invite.expiresAt.getTime() < now
      ? AGENT_INVITE_STATUSES.EXPIRED
      : invite.status,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  }));
}

export async function createOrganizationInvite({ agentAccountId, email, role, domainAccess }) {
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

  const activated = await listAgencyActivatedDomains(profile.organizationId);
  const requested = normalizeDomainAccessList(domainAccess);
  if (!requested.length) {
    throw domainError(400, 'provider_domain_selection_required', 'At least one provider domain is required');
  }
  for (const row of requested) {
    if (!isKnownProviderDomainId(row.domainId)) {
      throw domainError(400, 'unknown_provider_domain', 'Unknown provider domain');
    }
    if (!activated.includes(row.domainId)) {
      throw domainError(400, 'provider_domain_not_available', 'Agency has not activated that provider domain');
    }
    if (!row.permissions.length) {
      row.permissions = defaultPermissionsForInvite({ domainId: row.domainId, role });
    }
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
    domainAccess: requested,
    status: AGENT_INVITE_STATUSES.PENDING,
    tokenHash: hashResetToken(token),
    invitedBy: agentAccountId,
    expiresAt: new Date(Date.now() + AGENT_INVITE_TTL_MS),
  });

  await logAudit({
    action: GBS_AUDIT_EVENTS.TEAM_DOMAIN_ACCESS_GRANTED,
    actor: { userId: agentAccountId, role: 'agent' },
    metadata: redactAuditMetadata({ domainCount: requested.length }),
  });

  return {
    invitationId: invitation._id,
    email: invitation.email,
    role: invitation.role,
    domainAccess: invitation.domainAccess,
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
    domainAccess: invitation.domainAccess || [],
    status: expired && invitation.status === AGENT_INVITE_STATUSES.PENDING
      ? AGENT_INVITE_STATUSES.EXPIRED
      : invitation.status,
    expiresAt: invitation.expiresAt,
    organizationName: organization?.displayName || '',
  };
}

export async function acceptOrganizationInvite({ token, agentAccount, acceptedDomainIds }) {
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

  const invitedAccess = normalizeDomainAccessList(invitation.domainAccess);
  let acceptedAccess = invitedAccess;
  if (invitedAccess.length) {
    const accepted = new Set(
      (Array.isArray(acceptedDomainIds) ? acceptedDomainIds : []).filter(isKnownProviderDomainId)
    );
    if (!accepted.size) {
      throw domainError(400, 'provider_domain_selection_required', 'Confirm at least one invited provider domain');
    }
    acceptedAccess = invitedAccess.filter((row) => accepted.has(row.domainId));
    if (!acceptedAccess.length) {
      throw domainError(400, 'provider_domain_selection_required', 'Confirm at least one invited provider domain');
    }
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
        domainAccess: acceptedAccess,
      },
    },
    { upsert: true, new: true }
  );

  invitation.status = AGENT_INVITE_STATUSES.ACCEPTED;
  invitation.acceptedAt = new Date();
  invitation.acceptedBy = agentAccount._id;
  await invitation.save();
  return {
    organizationId: invitation.organizationId,
    role: invitation.role,
    domainAccess: acceptedAccess,
  };
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

  const consultationMatch = orgWide
    ? { organizationId: profile.organizationId }
    : { organizationId: profile.organizationId, assignedMembershipId: membership._id };
  const caseMatch = orgWide
    ? { organizationId: profile.organizationId }
    : { organizationId: profile.organizationId, authorizedMembershipIds: membership._id };
  const term = String(query.q || '').trim().slice(0, 80);
  const escapedTerm = term ? escapeRegex(term) : '';
  const pipeline = [
    { $match: { organizationId: profile.organizationId } },
    { $project: { userId: 1, leadOrigin: '$source', context: 1, leadStatus: '$status', latestAt: { $ifNull: ['$updatedAt', '$createdAt'] }, consultationCount: { $literal: 0 }, caseCount: { $literal: 0 } } },
    { $unionWith: { coll: Consultation.collection.name, pipeline: [
      { $match: consultationMatch },
      { $project: { userId: '$studentUserId', origin: { $literal: 'consultation' }, consultationStatus: '$status', latestAt: { $ifNull: ['$updatedAt', '$createdAt'] }, consultationCount: { $literal: 1 }, caseCount: { $literal: 0 } } },
    ] } },
    { $unionWith: { coll: ProfessionalCase.collection.name, pipeline: [
      { $match: caseMatch },
      { $project: { userId: '$studentUserId', origin: { $literal: 'case' }, caseStatus: '$lifecycle', latestAt: { $ifNull: ['$updatedAt', '$createdAt'] }, consultationCount: { $literal: 0 }, caseCount: { $literal: 1 } } },
    ] } },
    { $group: {
      _id: '$userId', latestAt: { $max: '$latestAt' }, leadOrigin: { $max: '$leadOrigin' }, context: { $max: '$context' },
      leadStatus: { $max: '$leadStatus' }, caseStatus: { $max: '$caseStatus' }, consultationStatus: { $max: '$consultationStatus' },
      consultationCount: { $sum: '$consultationCount' }, caseCount: { $sum: '$caseCount' },
    } },
  ];
  if (!orgWide) pipeline.push({ $match: { $or: [{ consultationCount: { $gt: 0 } }, { caseCount: { $gt: 0 } }] } });
  pipeline.push(
    { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', as: 'student' } },
    { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    { $set: {
      displayName: { $ifNull: ['$student.name', 'Student'] },
      origin: { $cond: [{ $ne: [{ $ifNull: ['$leadStatus', ''] }, ''] }, '$leadOrigin', { $cond: [{ $gt: ['$consultationCount', 0] }, 'consultation', 'case'] }] },
      status: { $ifNull: ['$leadStatus', { $ifNull: ['$caseStatus', { $ifNull: ['$consultationStatus', 'active'] }] }] },
    } },
  );
  if (escapedTerm) pipeline.push({ $match: { $or: [
    { displayName: { $regex: escapedTerm, $options: 'i' } }, { origin: { $regex: escapedTerm, $options: 'i' } }, { status: { $regex: escapedTerm, $options: 'i' } },
  ] } });
  if (query.status) pipeline.push({ $match: { status: String(query.status).slice(0, 80) } });
  pipeline.push(
    { $sort: { latestAt: -1, _id: -1 } },
    { $facet: {
      rows: [{ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum }, { $project: { student: 0 } }],
      metadata: [{ $count: 'total' }],
    } },
  );
  const [result = { rows: [], metadata: [] }] = await AgentLead.aggregate(pipeline);
  const rows = result.rows || [];
  const userIds = rows.map((row) => String(row._id));

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

  const clients = rows.map((row) => {
    const userId = String(row._id);
    return {
      userId,
      displayName: studentSafeName(row.displayName),
      origin: row.origin || 'relationship',
      context: row.context || '',
      status: row.status || 'active',
      nextAction: row.caseStatus === 'awaiting_student_acceptance'
        ? 'Await Student case acceptance'
        : row.consultationCount > 0
          ? 'Open consultation'
          : 'Review relationship',
      consultationCount: row.consultationCount,
      caseCount: row.caseCount,
      vaultAccess: false,
      vaultGrantCount: grantsByUser.get(userId) || 0,
      vaultNote: 'Client relationship grants zero Vault access. Only an exact active grant allows document access.',
    };
  });

  const total = result.metadata?.[0]?.total || 0;
  return {
    clients,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
    note: 'Client relationship grants zero Vault access and no full Student profile.',
  };
}

export const agentProfileServiceInternals = Object.freeze({
  containsGuaranteeLanguage,
  computeCompleteness,
  slugify,
  mapsCannotAloneVerify: () => true,
});
