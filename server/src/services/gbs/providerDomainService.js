/**
 * Provider Domain enrollment and workspace authority (Phase 17D-3R).
 *
 * Domain selection ≠ professional verification.
 * Agent self enrollment ≠ Agency enrollment.
 * No live backfill. Missing initialization = legacy education_mobility only.
 */
import { ProviderDomainEnrollment } from '../../models/gbs/ProviderDomainEnrollment.js';
import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { AgentProfile } from '../../models/agent/AgentProfile.js';
import { AgentMembership } from '../../models/agent/AgentMembership.js';
import { AgentService } from '../../models/agent/AgentService.js';
import { AgentLead } from '../../models/agent/AgentLead.js';
import { Organization } from '../../models/Organization.js';
import { OrganizationVerification } from '../../models/OrganizationVerification.js';
import {
  PROVIDER_DOMAIN_ENROLLMENT_STATUSES,
  PROVIDER_DOMAIN_IDS,
  PROVIDER_DOMAIN_INITIALIZATION_STATES,
  PROVIDER_DOMAIN_ONBOARDING_STATUSES,
  PROVIDER_DOMAIN_SCHEMA_VERSION,
  isKnownProviderDomainId,
  publicProviderDomainProjection,
} from '../../../../shared/provider/providerDomains.js';
import {
  needsRequiredProviderDomainOnboarding,
  resolveProviderDomainInitializationState,
  validateRequiredProviderDomainSelection,
} from '../../../../shared/provider/providerDomainSelection.js';
import {
  defaultPermissionsForInvite,
  legacyEducationPermissionsForRole,
  membershipHasDomainPermission,
  normalizeDomainAccessList,
  PROVIDER_DOMAIN_PERMISSIONS,
  viewPermissionForDomain,
} from '../../../../shared/provider/providerDomainPermissions.js';
import { PROVIDER_SUBJECT_TYPES, isBusinessServicesProviderEnabled, isBusinessServicesPublicMarketplaceEnabled } from '../../../../shared/gbs/constants.js';
import { ORGANIZATION_TYPES } from '../../../../shared/international/organization.js';
import { AGENT_MEMBER_ROLES, AGENT_SERVICE_STATUSES } from '../../../../shared/agent/constants.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import {
  assertAuthorizedProviderSubject,
  resolveAuthorizedProviderSubjects,
} from './providerSubjectContext.js';

function deny(code, status = 403, extras = {}) {
  return Object.assign(new Error(code), { status, code, ...extras });
}

export function effectiveInitializationState(profile) {
  return resolveProviderDomainInitializationState(profile?.providerDomainInitializationState);
}

export async function listEnrollmentsForSubject(subjectType, subjectId) {
  return ProviderDomainEnrollment.find({
    subjectType,
    subjectId: String(subjectId),
  }).lean();
}

async function findEnrollment(subjectType, subjectId, domainId) {
  return ProviderDomainEnrollment.findOne({
    subjectType,
    subjectId: String(subjectId),
    domainId,
  });
}

/**
 * Legacy compatibility: genuine existing rows with no initialization
 * effectively have education_mobility only. Not persisted.
 */
export function effectiveLegacyDomainIds(profile) {
  if (effectiveInitializationState(profile) !== PROVIDER_DOMAIN_INITIALIZATION_STATES.LEGACY) {
    return [];
  }
  return [PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY];
}

export async function enrollProviderDomains({
  subjectType,
  subjectId,
  domainIds,
  selectedBy,
  actor = {},
  auditAction = GBS_AUDIT_EVENTS.PROVIDER_DOMAIN_SELECTED,
} = {}) {
  if (!Object.values(PROVIDER_SUBJECT_TYPES).includes(subjectType)) {
    throw deny('invalid_provider_subject', 400);
  }
  if (!subjectId) throw deny('invalid_provider_subject', 400);
  const unique = [...new Set((domainIds || []).filter(isKnownProviderDomainId))];
  if (!unique.length) throw deny('provider_domain_selection_required', 400);

  const results = [];
  for (const domainId of unique) {
    if (
      domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES &&
      !isBusinessServicesProviderEnabled(process.env)
    ) {
      throw deny('provider_domain_not_available', 400);
    }
    const existing = await findEnrollment(subjectType, subjectId, domainId);
    if (existing) {
      results.push(existing.toObject ? existing.toObject() : existing);
      continue;
    }
    try {
      const created = await ProviderDomainEnrollment.create({
        subjectType,
        subjectId: String(subjectId),
        domainId,
        status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.SETUP,
        onboardingStatus: PROVIDER_DOMAIN_ONBOARDING_STATUSES.COMPLETE,
        selectedAt: new Date(),
        selectedBy: selectedBy ? String(selectedBy) : '',
        schemaVersion: PROVIDER_DOMAIN_SCHEMA_VERSION,
        recordVersion: 0,
      });
      results.push(created.toObject());
      await logAudit({
        actor,
        action: auditAction,
        metadata: redactAuditMetadata({
          subjectType,
          domainId,
          enrollmentCreated: true,
        }),
      });
    } catch (err) {
      if (err?.code === 11000) {
        const raced = await findEnrollment(subjectType, subjectId, domainId);
        if (raced) {
          results.push(raced.toObject ? raced.toObject() : raced);
          continue;
        }
      }
      throw err;
    }
  }
  return results;
}

export async function markProviderDomainInitialization({ agentAccountId, state }) {
  if (!['pending', 'ready', 'legacy'].includes(state)) {
    throw deny('invalid_initialization_state', 400);
  }
  await AgentProfile.updateOne(
    { agentAccountId },
    { $set: { providerDomainInitializationState: state } }
  );
}

export async function completeProviderDomainOnboarding({
  agentAccountId,
  domainIds,
  actor = {},
} = {}) {
  const profile = await AgentProfile.findOne({ agentAccountId });
  if (!profile) throw deny('PROFILE_NOT_FOUND', 404);
  if (effectiveInitializationState(profile) === PROVIDER_DOMAIN_INITIALIZATION_STATES.READY) {
    const enrollments = await listEnrollmentsForSubject(
      PROVIDER_SUBJECT_TYPES.AGENT,
      agentAccountId
    );
    return { initializationState: 'ready', enrollments, alreadyComplete: true };
  }
  if (effectiveInitializationState(profile) === PROVIDER_DOMAIN_INITIALIZATION_STATES.LEGACY) {
    return { initializationState: 'legacy', enrollments: [], alreadyComplete: true };
  }

  const allowBusiness = isBusinessServicesProviderEnabled(process.env);
  const selection = validateRequiredProviderDomainSelection(domainIds, {
    allowBusinessServices: allowBusiness,
  });
  if (!selection.ok) {
    throw deny(selection.error, 400, { unknown: selection.unknown });
  }

  const subjectType =
    profile.agentType === 'agency' ? PROVIDER_SUBJECT_TYPES.ORGANIZATION : PROVIDER_SUBJECT_TYPES.AGENT;
  const subjectId =
    subjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION
      ? String(profile.organizationId)
      : String(agentAccountId);

  const enrollments = await enrollProviderDomains({
    subjectType,
    subjectId,
    domainIds: selection.domainIds,
    selectedBy: agentAccountId,
    actor,
    auditAction: GBS_AUDIT_EVENTS.PROVIDER_DOMAIN_ONBOARDING_COMPLETED,
  });

  if (subjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION) {
    await ensureOwnerDomainAccess({
      organizationId: profile.organizationId,
      agentAccountId,
      domainIds: selection.domainIds,
      actor,
    });
  }

  profile.providerDomainInitializationState = PROVIDER_DOMAIN_INITIALIZATION_STATES.READY;
  await profile.save();

  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.PROVIDER_DOMAIN_ONBOARDING_COMPLETED,
    metadata: redactAuditMetadata({
      domainCount: selection.domainIds.length,
      subjectType,
    }),
  });

  return { initializationState: 'ready', enrollments, alreadyComplete: false };
}

export async function addProviderDomain({
  agentAccountId,
  subjectType,
  subjectId,
  domainId,
  actor = {},
} = {}) {
  if (!isKnownProviderDomainId(domainId)) throw deny('unknown_provider_domain', 400);
  const subject = await assertAuthorizedProviderSubject({
    agentAccountId,
    subjectType,
    subjectId,
    actor,
  });

  if (subject.kind === 'agency') {
    const membership = await AgentMembership.findOne({
      agentAccountId,
      organizationId: subjectId,
      active: true,
    }).lean();
    if (!membership || ![AGENT_MEMBER_ROLES.OWNER, AGENT_MEMBER_ROLES.ADMIN].includes(membership.role)) {
      throw deny('provider_domain_access_denied', 403);
    }
  }

  const existing = await findEnrollment(subjectType, subjectId, domainId);
  if (existing) {
    return { enrollment: existing.toObject(), alreadyActive: true };
  }

  const [enrollment] = await enrollProviderDomains({
    subjectType,
    subjectId,
    domainIds: [domainId],
    selectedBy: agentAccountId,
    actor,
    auditAction:
      subject.kind === 'agency'
        ? GBS_AUDIT_EVENTS.AGENCY_PROVIDER_DOMAIN_ACTIVATED
        : GBS_AUDIT_EVENTS.PROVIDER_DOMAIN_ADDED,
  });

  if (subject.kind === 'agency') {
    await ensureOwnerDomainAccess({
      organizationId: subjectId,
      agentAccountId,
      domainIds: [domainId],
      actor,
    });
  }

  return { enrollment, alreadyActive: false };
}

export async function ensureOwnerDomainAccess({
  organizationId,
  agentAccountId,
  domainIds,
  actor = {},
} = {}) {
  const owners = await AgentMembership.find({
    organizationId,
    role: AGENT_MEMBER_ROLES.OWNER,
    active: true,
  });
  for (const membership of owners) {
    const next = normalizeDomainAccessList(membership.domainAccess || []);
    const byDomain = new Map(next.map((row) => [row.domainId, row]));
    for (const domainId of domainIds) {
      byDomain.set(domainId, {
        domainId,
        permissions: defaultPermissionsForInvite({
          domainId,
          role: AGENT_MEMBER_ROLES.OWNER,
        }),
      });
    }
    membership.domainAccess = [...byDomain.values()];
    membership.recordVersion = (membership.recordVersion || 0) + 1;
    await membership.save();
  }
  await logAudit({
    actor: actor.agentAccountId ? actor : { agentAccountId, role: 'agent' },
    action: GBS_AUDIT_EVENTS.TEAM_DOMAIN_ACCESS_GRANTED,
    metadata: redactAuditMetadata({ organizationPresent: Boolean(organizationId) }),
  });
}

function membershipDomainAccessOrLegacy(membership, orgHasLegacyEducation) {
  if (Array.isArray(membership.domainAccess) && membership.domainAccess.length) {
    return normalizeDomainAccessList(membership.domainAccess);
  }
  if (orgHasLegacyEducation) {
    return [
      {
        domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
        permissions: legacyEducationPermissionsForRole(membership.role),
      },
    ];
  }
  return [];
}

export async function resolveAccessibleWorkspaces(agentAccountId) {
  const { account, profile, subjects } = await resolveAuthorizedProviderSubjects(agentAccountId);
  const initializationState = effectiveInitializationState(profile);
  const pending = needsRequiredProviderDomainOnboarding(profile?.providerDomainInitializationState);

  const workspaces = [];
  for (const subject of subjects) {
    const enrollments = await listEnrollmentsForSubject(subject.subjectType, subject.subjectId);
    let domainIds = enrollments.map((row) => row.domainId);

    if (
      initializationState === PROVIDER_DOMAIN_INITIALIZATION_STATES.LEGACY &&
      domainIds.length === 0
    ) {
      domainIds = [PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY];
    }

    let allowed = domainIds;
    if (subject.kind === 'agency') {
      const membership = await AgentMembership.findOne({
        agentAccountId,
        organizationId: subject.subjectId,
        active: true,
      }).lean();
      if (!membership) continue;
      const orgLegacy =
        initializationState === PROVIDER_DOMAIN_INITIALIZATION_STATES.LEGACY &&
        enrollments.length === 0;
      const access = membershipDomainAccessOrLegacy(membership, orgLegacy);
      const accessIds = new Set(access.map((row) => row.domainId));
      allowed = domainIds.filter((id) => accessIds.has(id));
    }

    for (const domainId of allowed) {
      const enrollment = enrollments.find((row) => row.domainId === domainId) || null;
      workspaces.push({
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
        kind: subject.kind,
        label: subject.label,
        membershipRole: subject.membershipRole || null,
        domainId,
        domain: publicProviderDomainProjection(domainId),
        enrollmentStatus: enrollment?.status || (initializationState === 'legacy' ? 'active' : 'setup'),
        path:
          domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES
            ? '/agent/business-services'
            : '/agent/education',
      });
    }
  }

  return {
    accountId: String(account._id),
    initializationState,
    needsOnboarding: pending,
    businessServicesProviderEnabled: isBusinessServicesProviderEnabled(process.env),
    publicMarketplaceEnabled: isBusinessServicesPublicMarketplaceEnabled(process.env),
    workspaces,
    addableDomains: listAddableDomains(workspaces, isBusinessServicesProviderEnabled(process.env)),
  };
}

function listAddableDomains(workspaces, businessEnabled) {
  const independent = workspaces.filter((w) => w.kind === 'independent').map((w) => w.domainId);
  const candidates = [PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY];
  if (businessEnabled) candidates.push(PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES);
  return candidates
    .filter((id) => !independent.includes(id))
    .map(publicProviderDomainProjection)
    .filter(Boolean);
}

export async function assertProviderDomainAccess({
  agentAccountId,
  subjectType,
  subjectId,
  domainId,
  permissionId,
  actor = {},
} = {}) {
  if (!isKnownProviderDomainId(domainId)) throw deny('unknown_provider_domain', 400);
  const subject = await assertAuthorizedProviderSubject({
    agentAccountId,
    subjectType,
    subjectId,
    actor,
  });

  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (needsRequiredProviderDomainOnboarding(profile?.providerDomainInitializationState)) {
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.PROVIDER_WORKSPACE_CONTEXT_DENIED,
      status: 'failure',
      metadata: redactAuditMetadata({ reason: 'onboarding_pending', domainId }),
    });
    throw deny('provider_domain_onboarding_required', 403);
  }

  const enrollments = await listEnrollmentsForSubject(subjectType, subjectId);
  const enrolled = enrollments.some((row) => row.domainId === domainId);
  const legacyEducation =
    effectiveInitializationState(profile) === PROVIDER_DOMAIN_INITIALIZATION_STATES.LEGACY &&
    domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY &&
    enrollments.length === 0;

  if (!enrolled && !legacyEducation) {
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.PROVIDER_DOMAIN_ACCESS_DENIED,
      status: 'failure',
      metadata: redactAuditMetadata({ domainId, reason: 'not_enrolled' }),
    });
    throw deny('provider_domain_access_denied', 403);
  }

  if (subject.kind === 'independent') {
    return { subject, domainId };
  }

  const membership = await AgentMembership.findOne({
    agentAccountId,
    organizationId: subjectId,
    active: true,
  }).lean();
  if (!membership) throw deny('provider_domain_access_denied', 403);

  const access = membershipDomainAccessOrLegacy(membership, legacyEducation);
  const required = permissionId || viewPermissionForDomain(domainId);
  if (!membershipHasDomainPermission(access, domainId, required)) {
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.PROVIDER_DOMAIN_ACCESS_DENIED,
      status: 'failure',
      metadata: redactAuditMetadata({ domainId, reason: 'permission' }),
    });
    throw deny('provider_domain_access_denied', 403);
  }
  return { subject, domainId, membership };
}

export async function getProviderHomeSummary(agentAccountId) {
  const resolved = await resolveAccessibleWorkspaces(agentAccountId);
  const cards = [];
  for (const workspace of resolved.workspaces) {
    cards.push({
      ...workspace,
      counters: await domainCounters(workspace),
    });
  }
  return { ...resolved, cards };
}

async function domainCounters(workspace) {
  const { subjectType, subjectId, domainId } = workspace;
  if (domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) {
    const [capabilities, listings, verified] = await Promise.all([
      ProviderCapability.countDocuments({ subjectType, subjectId: String(subjectId) }),
      GbsServiceListing.countDocuments({ subjectType, subjectId: String(subjectId) }),
      ProviderCapability.countDocuments({
        subjectType,
        subjectId: String(subjectId),
        trustStatus: 'verified',
      }),
    ]);
    return {
      verifiedCapabilities: verified,
      capabilities,
      listings,
    };
  }

  const orgId = subjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION ? subjectId : null;
  let organizationId = orgId;
  if (!organizationId && subjectType === PROVIDER_SUBJECT_TYPES.AGENT) {
    const profile = await AgentProfile.findOne({ agentAccountId: subjectId }).select('organizationId').lean();
    organizationId = profile?.organizationId;
  }
  const [services, leads, verification] = await Promise.all([
    organizationId
      ? AgentService.countDocuments({
          organizationId,
          status: AGENT_SERVICE_STATUSES.ACTIVE,
        })
      : 0,
    organizationId ? AgentLead.countDocuments({ organizationId }) : 0,
    organizationId
      ? OrganizationVerification.findOne({ organizationId }).select('status').lean()
      : null,
  ]);
  return {
    verificationStatus: verification?.status || 'draft',
    activeServices: services,
    leads,
  };
}

export async function listAgencyActivatedDomains(organizationId) {
  const enrollments = await listEnrollmentsForSubject(
    PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    organizationId
  );
  if (enrollments.length) return enrollments.map((row) => row.domainId);
  const org = await Organization.findById(organizationId).lean();
  if (org?.organizationType === ORGANIZATION_TYPES.AGENCY) {
    const owner = await AgentMembership.findOne({
      organizationId,
      role: AGENT_MEMBER_ROLES.OWNER,
    }).lean();
    if (owner) {
      const profile = await AgentProfile.findOne({ agentAccountId: owner.agentAccountId }).lean();
      if (effectiveInitializationState(profile) === PROVIDER_DOMAIN_INITIALIZATION_STATES.LEGACY) {
        return [PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY];
      }
    }
  }
  return [];
}

export { PROVIDER_DOMAIN_PERMISSIONS };
