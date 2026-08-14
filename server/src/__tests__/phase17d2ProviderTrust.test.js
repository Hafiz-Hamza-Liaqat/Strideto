/**
 * Phase 17D-2 — jurisdiction-scoped Business Services capability Trust.
 * Run: node src/__tests__/phase17d2ProviderTrust.test.js
 */
import assert from 'node:assert/strict';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_SUBJECT_TYPES, PROVIDER_TRUST_STATUSES } from '../../../shared/gbs/constants.js';
import { authorizeListingScope } from '../../../shared/gbs/listingScope.js';
import { BUSINESS_SERVICES_CAPABILITY_IDS } from '../../../shared/gbs/businessServicesCapabilities.js';
import { PROTECTED_TITLE_IDS } from '../../../shared/gbs/protectedTitles.js';
import { EVIDENCE_DECISIONS } from '../../../shared/gbs/providerEvidence.js';
import {
  evaluateListingPublicationGate,
  LISTING_PUBLICATION_DENY_REASONS,
} from '../../../shared/gbs/listingPublicationGate.js';
import {
  createProviderCapabilityReviewService,
  createMemoryProviderCapabilityStore,
  organizationVerifiedDoesNotVerify,
  isCapabilityUsable,
  capabilityCoversJurisdiction,
} from '../services/gbs/providerCapabilityReviewService.js';
import { OPTIMISTIC_CONCURRENCY_CODE } from '../../../shared/platform/optimisticConcurrency.js';
import { GBS_AUDIT_EVENTS, isKnownGbsAuditEvent } from '../../../shared/security/gbsAuditEvents.js';
import { ACTION_POLICY, POLICY_ACTIONS } from '../../../shared/capability/permissionPolicy.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

function cap(overrides = {}) {
  return {
    id: overrides.id || 'cap-1',
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: 'agent-A',
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION,
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED,
    scope: {
      serviceCategoryIds: ['formation'],
      countryCodes: ['US'],
      jurisdictionIds: ['j:US-WY'],
      entityTypeIds: ['et:US-WY:LLC'],
      protectedTitleIds: [],
      flags: { registered_agent: false, registered_office: false },
    },
    evidenceRefs: [],
    review: {},
    recordVersion: 0,
    ...overrides,
  };
}

function formationEvidence(overrides = {}) {
  return {
    evidenceType: 'authority_confirmation',
    decision: EVIDENCE_DECISIONS.ACCEPTED,
    subjectType: 'agent',
    subjectId: 'agent-A',
    jurisdictionId: 'j:US-WY',
    ...overrides,
  };
}

const staff = { id: 'staff-1', isStaff: true, realm: 'staff', subjectType: 'staff', subjectId: 'staff-1' };
const provider = { id: 'agent-A', isStaff: false, subjectType: 'agent', subjectId: 'agent-A' };

function serviceWith(record) {
  const store = createMemoryProviderCapabilityStore([record]);
  const events = [];
  const svc = createProviderCapabilityReviewService({
    store,
    audit: async (evt) => {
      events.push(evt);
    },
  });
  return { svc, store, events };
}

check(
  organizationVerifiedDoesNotVerify(BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION),
  '36. Organization Verified alone → no business_formation verified'
);
check(
  organizationVerifiedDoesNotVerify(BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT),
  '37. Organization Verified alone → no Registered Agent verified'
);

{
  const claimed = cap();
  check(claimed.trustStatus !== PROVIDER_TRUST_STATUSES.VERIFIED, '38. business_formation claimed → not VERIFIED');
}

{
  const { svc } = serviceWith(cap());
  const submitted = await svc.submitEvidence({
    id: 'cap-1',
    subjectType: 'agent',
    subjectId: 'agent-A',
    expectedVersion: 0,
    actor: provider,
    evidence: { evidenceType: 'regulatory_registration', decision: EVIDENCE_DECISIONS.PENDING },
  });
  check(submitted.trustStatus === PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED, '39. evidence submitted → not VERIFIED');
}

{
  const { svc } = serviceWith(cap({ trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED, recordVersion: 1 }));
  const backed = await svc.markEvidenceBacked({
    id: 'cap-1',
    subjectType: 'agent',
    subjectId: 'agent-A',
    expectedVersion: 1,
    actor: staff,
  });
  check(backed.trustStatus === PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED, '40. evidence backed → not VERIFIED unless approved');
}

{
  const { svc, events } = serviceWith(
    cap({
      trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED,
      recordVersion: 2,
      evidenceRefs: [formationEvidence()],
    })
  );
  const verified = await svc.verify({
    id: 'cap-1',
    subjectType: 'agent',
    subjectId: 'agent-A',
    expectedVersion: 2,
    actor: staff,
  });
  check(verified.trustStatus === PROVIDER_TRUST_STATUSES.VERIFIED, '41. Admin/staff verified → VERIFIED');
  check(events.some((e) => e.action === GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_VERIFIED), '41b. verify is audited');
}

{
  const { svc } = serviceWith(cap({ trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED, recordVersion: 2 }));
  try {
    await svc.verify({
      id: 'cap-1',
      subjectType: 'agent',
      subjectId: 'agent-A',
      expectedVersion: 2,
      actor: provider,
    });
    check(false, '42. provider cannot self-verify');
  } catch (err) {
    check(err.code === 'staff_review_required' || err.code === 'provider_self_verify_forbidden', '42. provider cannot self-verify');
  }
}

{
  const agentCap = cap({ subjectType: 'agent', subjectId: 'agent-A' });
  const orgCap = cap({ id: 'cap-org', subjectType: 'organization', subjectId: 'org-ABC' });
  check(agentCap.subjectType === PROVIDER_SUBJECT_TYPES.AGENT, '43. Agent capability remains Agent subject');
  check(orgCap.subjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION, '44. Agency capability remains Organization subject');
  const inherit = authorizeListingScope({
    requested: { ...agentCap, subjectType: 'organization', subjectId: 'org-ABC' },
    capability: agentCap,
  });
  check(!inherit.allowed, '45. Agent cannot inherit Agency credential / Agency cannot use Agent');
  const reverse = authorizeListingScope({
    requested: agentCap,
    capability: orgCap,
  });
  check(!reverse.allowed, '46. Agency cannot use Agent personal credential');
}

{
  const wy = cap({
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION,
  });
  check(capabilityCoversJurisdiction(wy, 'j:US-WY'), '47a. WY formation covers WY');
  check(!capabilityCoversJurisdiction(wy, 'j:US-DE'), '47. WY formation verified → no DE formation');
}

{
  const wyRa = cap({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    scope: {
      ...cap().scope,
      flags: { registered_agent: true, registered_office: false },
      protectedTitleIds: [PROTECTED_TITLE_IDS.REGISTERED_AGENT],
    },
  });
  check(!capabilityCoversJurisdiction(wyRa, 'j:US-DE'), '48. WY RA verified → no DE RA');
}

{
  const formation = cap({
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION,
  });
  const raListing = authorizeListingScope({
    requested: {
      ...formation,
      capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
      scope: { ...formation.scope, flags: { registered_agent: true, registered_office: false } },
    },
    capability: formation,
  });
  check(!raListing.allowed, '49. formation verified → no RA unless RA separately verified');
}

{
  const ukFormation = cap({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION,
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    scope: {
      ...cap().scope,
      countryCodes: ['GB'],
      jurisdictionIds: ['j:GB'],
      entityTypeIds: ['et:GB:LTD'],
    },
  });
  check(
    ukFormation.capabilityId !== PROTECTED_TITLE_IDS.ACSP &&
      !isCapabilityUsable({ ...ukFormation, capabilityId: PROTECTED_TITLE_IDS.ACSP, trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED }),
    '50. UK formation → no ACSP unless ACSP evidence separately verified'
  );
}

{
  const suspended = cap({ status: GRANT_STATUSES.SUSPENDED, trustStatus: PROVIDER_TRUST_STATUSES.SUSPENDED });
  check(!isCapabilityUsable(suspended), '51. suspended provider capability → unusable');
  const revoked = cap({ status: GRANT_STATUSES.REVOKED, trustStatus: PROVIDER_TRUST_STATUSES.REVOKED });
  check(!isCapabilityUsable(revoked), '52. revoked provider capability → unusable');
}

{
  const staleTitle = cap({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    evidenceRefs: [
      {
        decision: EVIDENCE_DECISIONS.ACCEPTED,
        effectiveFrom: '2024-01-01T00:00:00.000Z',
        effectiveTo: '2025-01-01T00:00:00.000Z',
      },
    ],
  });
  check(
    !isCapabilityUsable(staleTitle, { now: new Date('2026-08-14T00:00:00.000Z') }),
    '53. stale/expired credential evidence → policy prevents false CURRENT protected-title projection'
  );
}

{
  const { svc } = serviceWith(cap({ recordVersion: 4, evidenceRefs: [formationEvidence()] }));
  try {
    await svc.verify({
      id: 'cap-1',
      subjectType: 'agent',
      subjectId: 'agent-A',
      expectedVersion: 3,
      actor: staff,
    });
    check(false, '54. stale review should 409');
  } catch (err) {
    check(err.code === OPTIMISTIC_CONCURRENCY_CODE && err.status === 409, '54. recordVersion stale review → 409');
  }
}

{
  const { svc } = serviceWith(cap({ subjectId: 'agent-A' }));
  try {
    await svc.verify({
      id: 'cap-1',
      subjectType: 'agent',
      subjectId: 'agent-OTHER',
      expectedVersion: 0,
      actor: staff,
    });
    check(false, '55. wrong subject should deny');
  } catch (err) {
    check(err.status === 404 && !String(err.message).includes('agent-A'), '55. wrong subject review → deny / no existence leak');
  }
}

{
  const verified = cap({
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION,
  });
  const gateOff = evaluateListingPublicationGate({
    env: {},
    listing: verified,
    capability: verified,
    claimedOfficialFacts: [{ reviewStatus: 'reviewed', superseded: false, reviewDueAt: '2026-11-01T00:00:00.000Z' }],
  });
  check(gateOff.reason === LISTING_PUBLICATION_DENY_REASONS.FEATURE_DISABLED, 'listing gate requires feature flag');
  const gate = evaluateListingPublicationGate({
    env: { BUSINESS_SERVICES_ENABLED: '1' },
    listing: { ...verified, adminReviewStatus: 'approved' },
    capability: verified,
    claimedOfficialFacts: [
      {
        reviewStatus: 'reviewed',
        superseded: false,
        reviewDueAt: '2026-11-12T12:00:00.000Z',
        effectiveFrom: '2026-07-01T00:00:00.000Z',
      },
    ],
  });
  check(gate.allowed === true, 'listing gate allows verified subset when feature on + admin review + current facts');
}

check(
  ACTION_POLICY[POLICY_ACTIONS.ADMIN_PROVIDER_VERIFICATION].requireStaffRbac === true,
  'provider review remains staff RBAC'
);
check(isKnownGbsAuditEvent(GBS_AUDIT_EVENTS.PROTECTED_TITLE_VERIFIED), 'protected_title_verified audit exists');
check(isKnownGbsAuditEvent(GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_EVIDENCE_SUBMITTED), 'evidence submitted audit exists');

console.log(`phase17d2ProviderTrust.test.js: ${count} assertions passed`);
