/**
 * Exact provider-subject resolver (Phase 17D-3).
 * Preference / localStorage / URL org id have ZERO authority.
 */
import { AgentAccount } from '../../models/agent/AgentAccount.js';
import { AgentProfile } from '../../models/agent/AgentProfile.js';
import { AgentMembership } from '../../models/agent/AgentMembership.js';
import { Organization } from '../../models/Organization.js';
import { PROVIDER_SUBJECT_TYPES } from '../../../../shared/gbs/constants.js';
import { ORGANIZATION_TYPES, ORGANIZATION_STATUSES } from '../../../../shared/international/organization.js';
import { resolveSecurityAccess, SECURITY_ACCESS } from '../../../../shared/security/securityAccess.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';

function deny(code, status = 403) {
  return Object.assign(new Error(code), { status, code });
}

export async function resolveAuthorizedProviderSubjects(agentAccountId) {
  const account = await AgentAccount.findById(agentAccountId).lean();
  if (!account) throw deny('provider_subject_context_denied', 403);
  const access = resolveSecurityAccess({ accountStatus: account.accountStatus });
  if (access.decision !== SECURITY_ACCESS.USABLE) {
    throw deny(access.reason || 'account_suspended', 403);
  }

  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  const agentLabel =
    profile?.professionalName ||
    profile?.displayName ||
    account.email ||
    'Independent';

  const subjects = [
    {
      subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
      subjectId: String(agentAccountId),
      label: `${agentLabel} — Independent`,
      kind: 'independent',
    },
  ];

  const memberships = await AgentMembership.find({
    agentAccountId,
    active: true,
  }).lean();

  const orgIds = memberships.map((m) => m.organizationId).filter(Boolean);
  const orgs = orgIds.length
    ? await Organization.find({ _id: { $in: orgIds } }).lean()
    : [];
  const orgById = new Map(orgs.map((o) => [String(o._id), o]));

  for (const membership of memberships) {
    const org = orgById.get(String(membership.organizationId));
    if (!org) continue;
    if (org.organizationType !== ORGANIZATION_TYPES.AGENCY) continue;
    if (org.status === ORGANIZATION_STATUSES.SUSPENDED || org.status === ORGANIZATION_STATUSES.ARCHIVED) {
      continue;
    }
    subjects.push({
      subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
      subjectId: String(org._id),
      label: `${org.displayName || org.legalName || 'Agency'} — Agency`,
      kind: 'agency',
      membershipRole: membership.role,
      organizationStatus: org.status,
    });
  }

  return { account, profile, subjects };
}

export async function assertAuthorizedProviderSubject({
  agentAccountId,
  subjectType,
  subjectId,
  actor = {},
} = {}) {
  const { subjects } = await resolveAuthorizedProviderSubjects(agentAccountId);
  const match = subjects.find(
    (s) => s.subjectType === subjectType && String(s.subjectId) === String(subjectId)
  );
  if (!match) {
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.PROVIDER_SUBJECT_CONTEXT_DENIED,
      status: 'failure',
      metadata: redactAuditMetadata({
        requestedSubjectType: subjectType,
        requestedSubjectPresent: Boolean(subjectId),
      }),
    });
    throw deny('provider_subject_context_denied', 404);
  }
  return match;
}
