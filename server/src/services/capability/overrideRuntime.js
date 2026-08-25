import { VerificationCapabilityOverride } from '../../models/VerificationCapabilityOverride.js';
import { Organization } from '../../models/Organization.js';
import { InstitutionMembership } from '../../models/institution/InstitutionMembership.js';
import { EmployerMembership } from '../../models/employer/EmployerMembership.js';
import { logAudit } from '../auditService.js';
import { createOverrideService } from './overrideService.js';
import { notifyAgentOrganizationOwners } from '../agentInboxNotificationBridge.js';
import { notifyInstitution, notifyEmployer } from '../notificationService.js';
import { ORGANIZATION_TYPES } from '../../../../shared/international/organization.js';
import { INSTITUTION_ROLES } from '../../../../shared/institution/institutionPortal.js';
import { EMPLOYER_ROLES } from '../../../../shared/employer/team.js';

const AGENT_ORG_TYPES = new Set([ORGANIZATION_TYPES.AGENT, ORGANIZATION_TYPES.AGENCY]);
const INSTITUTION_ORG_TYPES = new Set([
  ORGANIZATION_TYPES.UNIVERSITY,
  ORGANIZATION_TYPES.COLLEGE,
  ORGANIZATION_TYPES.INSTITUTE,
  ORGANIZATION_TYPES.SCHOOL,
  ORGANIZATION_TYPES.TRAINING_CENTER,
]);
const EMPLOYER_ORG_TYPES = new Set([ORGANIZATION_TYPES.EMPLOYER]);
const INSTITUTION_NOTIFY_ROLES = [INSTITUTION_ROLES.OWNER, INSTITUTION_ROLES.ADMIN];
const EMPLOYER_NOTIFY_ROLES = [EMPLOYER_ROLES.OWNER, EMPLOYER_ROLES.ADMIN];

const mongooseOverrideStore = {
  async findByOrganization(organizationId) {
    return VerificationCapabilityOverride.findOne({ organizationId })
      .sort({ grantedAt: -1 })
      .lean();
  },
  async save(doc) {
    const { _id, ...fields } = doc;
    if (_id) {
      return VerificationCapabilityOverride.findByIdAndUpdate(_id, { $set: fields }, {
        new: true,
        lean: true,
      });
    }
    // Two-step upsert to preserve grantedAt across retries of an already-active grant.
    // Step 1: update an INACTIVE record (re-grant after revoke → always uses new grantedAt).
    const { grantedAt, ...mutableFields } = fields;
    const reactivated = await VerificationCapabilityOverride.findOneAndUpdate(
      { organizationId: doc.organizationId, active: false },
      { $set: fields },
      { new: true, lean: true }
    );
    if (reactivated) return reactivated;
    // Step 2: upsert — new records get grantedAt from $setOnInsert; active records
    // being retried keep their original grantedAt (mutableFields excludes it).
    return VerificationCapabilityOverride.findOneAndUpdate(
      { organizationId: doc.organizationId },
      { $set: mutableFields, $setOnInsert: { grantedAt } },
      { upsert: true, new: true, lean: true, setDefaultsOnInsert: true }
    );
  },
};

async function notifyProviderOrganization({ action, organizationId, overrideType, capabilities, expiresAt, grantedAt, revokedAt }) {
  const org = await Organization.findById(organizationId).select('organizationType').lean();
  if (!org) return;

  const isGrant = action === 'granted';
  const capList = Array.isArray(capabilities) && capabilities.length
    ? capabilities.join(', ')
    : 'selected capabilities';
  const title = isGrant
    ? 'Temporary QA capability access granted'
    : 'Temporary QA capability access revoked';
  const parts = [`Capabilities: ${capList}`];
  if (isGrant && expiresAt) {
    parts.push(`Expires: ${new Date(expiresAt).toISOString().slice(0, 10)}`);
  }
  const body = parts.join(' · ');
  const type = isGrant ? 'qa_override_granted' : 'qa_override_revoked';
  // For grants: discriminator encodes grantedAt + sorted capabilities + expiresAt so that:
  //   - an exact retry (same caps, same expiry) → same discriminator → same dedupeKey (idempotent)
  //   - a real mutation (different caps or expiry) while active → different discriminator → new notification
  const capFingerprint = isGrant && Array.isArray(capabilities)
    ? [...capabilities].sort().join(',')
    : '';
  const expFingerprint = isGrant && expiresAt ? new Date(expiresAt).getTime() : 0;
  const discriminator = isGrant
    ? `${grantedAt ? new Date(grantedAt).getTime() : Date.now()}_${capFingerprint}_${expFingerprint}`
    : (revokedAt ? new Date(revokedAt).getTime() : Date.now());

  if (AGENT_ORG_TYPES.has(org.organizationType)) {
    await notifyAgentOrganizationOwners({
      organizationId,
      category: 'trust',
      type,
      title,
      body,
      link: '/agent/organization/capabilities',
      dedupeKey: `qa_override:${action}:${organizationId}:${discriminator}`,
    });
    return;
  }

  if (INSTITUTION_ORG_TYPES.has(org.organizationType)) {
    const members = await InstitutionMembership.find({
      organizationId,
      active: true,
      role: { $in: INSTITUTION_NOTIFY_ROLES },
    }).select('institutionAccountId').lean();
    for (const member of members) {
      await notifyInstitution(member.institutionAccountId, {
        category: 'trust',
        type,
        title,
        body,
        link: '/institution/verification',
        dedupeKey: `qa_override:${action}:${organizationId}:${discriminator}:inst:${member.institutionAccountId}`,
      });
    }
    return;
  }

  if (EMPLOYER_ORG_TYPES.has(org.organizationType)) {
    const members = await EmployerMembership.find({
      organizationId,
      active: true,
      role: { $in: EMPLOYER_NOTIFY_ROLES },
    }).select('employerId').lean();
    for (const member of members) {
      await notifyEmployer(member.employerId, {
        category: 'trust',
        type,
        title,
        body,
        link: '/employer/verification',
        dedupeKey: `qa_override:${action}:${organizationId}:${discriminator}:emp:${member.employerId}`,
      });
    }
    return;
  }
  // business_client is not a concrete organization type in the current architecture
  // and has no resolvable account ownership model. Other unknown types skip quietly.
}

let singleton;

export function getOverrideService() {
  if (!singleton) {
    singleton = createOverrideService({
      overrideStore: mongooseOverrideStore,
      audit: logAudit,
      notify: (evt) => notifyProviderOrganization(evt).catch(() => {}),
    });
  }
  return singleton;
}
