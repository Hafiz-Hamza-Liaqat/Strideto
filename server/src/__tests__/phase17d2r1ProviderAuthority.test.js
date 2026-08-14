/**
 * Phase 17D-2R1 — explicit GBS capabilityId + protected-title evidence authority.
 * Run: node src/__tests__/phase17d2r1ProviderAuthority.test.js
 */
import assert from 'node:assert/strict';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_SUBJECT_TYPES, PROVIDER_TRUST_STATUSES } from '../../../shared/gbs/constants.js';
import { BUSINESS_SERVICES_CAPABILITY_IDS } from '../../../shared/gbs/businessServicesCapabilities.js';
import { PROTECTED_TITLE_IDS } from '../../../shared/gbs/protectedTitles.js';
import { EVIDENCE_DECISIONS, EVIDENCE_TYPES } from '../../../shared/gbs/providerEvidence.js';
import {
  authorizeGbsProviderAction,
  GBS_AUTHORITY_DENY_REASONS,
  isGbsAuthoritativeCapability,
  isLegacyProviderCapability,
} from '../../../shared/gbs/gbsProviderAuthority.js';
import {
  evaluateListingPublicationGate,
  LISTING_PUBLICATION_DENY_REASONS,
} from '../../../shared/gbs/listingPublicationGate.js';
import { validateProviderCapabilityRecord } from '../../../shared/gbs/providerCapability.js';
import {
  evaluateProtectedTitleVerification,
  PROTECTED_TITLE_POLICY_DENY_REASONS,
  resolveProtectedTitlePolicy,
} from '../../../shared/gbs/protectedTitleEvidencePolicy.js';
import {
  createMemoryProviderCapabilityStore,
  createProviderCapabilityReviewService,
  isCapabilityUsable,
} from '../services/gbs/providerCapabilityReviewService.js';
import { OPTIMISTIC_CONCURRENCY_CODE } from '../../../shared/platform/optimisticConcurrency.js';

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
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
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

const staff = { id: 'staff-1', isStaff: true, realm: 'staff', subjectType: 'staff', subjectId: 'staff-1' };
const provider = { id: 'agent-A', isStaff: false, subjectType: 'agent', subjectId: 'agent-A' };

function serviceWith(record) {
  const store = createMemoryProviderCapabilityStore([record]);
  const svc = createProviderCapabilityReviewService({ store, audit: async () => {} });
  return { svc, store };
}

function wyRaEvidence(overrides = {}) {
  return {
    evidenceType: EVIDENCE_TYPES.REGULATORY_REGISTRATION,
    evidenceClass: EVIDENCE_TYPES.REGULATORY_REGISTRATION,
    titleId: PROTECTED_TITLE_IDS.REGISTERED_AGENT,
    jurisdictionId: 'j:US-WY',
    subjectType: 'agent',
    subjectId: 'agent-A',
    decision: EVIDENCE_DECISIONS.ACCEPTED,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    ...overrides,
  };
}

function acspEvidence(overrides = {}) {
  return {
    evidenceType: EVIDENCE_TYPES.OFFICIAL_REGISTRY_STATUS,
    evidenceClass: EVIDENCE_TYPES.OFFICIAL_REGISTRY_STATUS,
    titleId: PROTECTED_TITLE_IDS.ACSP,
    jurisdictionId: 'j:GB',
    authorityClass: 'official_registry',
    subjectType: 'agent',
    subjectId: 'agent-A',
    decision: EVIDENCE_DECISIONS.ACCEPTED,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    ...overrides,
  };
}

{
  const missing = cap({ capabilityId: '' });
  const decision = authorizeGbsProviderAction({
    requested: { ...missing, capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION },
    capability: missing,
  });
  check(!decision.allowed, '9. ProviderCapability missing capabilityId cannot authorize GBS provider action');
  check(
    decision.reason === GBS_AUTHORITY_DENY_REASONS.LEGACY_NOT_AUTHORITATIVE ||
      decision.reason === GBS_AUTHORITY_DENY_REASONS.CAPABILITY_ID_MISSING,
    '9b. missing capabilityId deny reason is explicit'
  );
  check(!isGbsAuthoritativeCapability(missing), '9c. missing capabilityId is not GBS-authoritative');
}

{
  const unknown = cap({ capabilityId: 'not_a_gbs_capability', trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED });
  const decision = authorizeGbsProviderAction({
    requested: { ...unknown, capabilityId: 'not_a_gbs_capability' },
    capability: unknown,
  });
  check(!decision.allowed && decision.reason === GBS_AUTHORITY_DENY_REASONS.CAPABILITY_ID_UNKNOWN, '10. unknown capabilityId → deny');
}

{
  const formation = cap();
  const allowed = authorizeGbsProviderAction({
    requested: {
      subjectType: formation.subjectType,
      subjectId: formation.subjectId,
      capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION,
      scope: formation.scope,
    },
    capability: formation,
  });
  check(allowed.allowed === true, '11. explicit business_formation VERIFIED → formation action allowed within scope');
}

{
  const formation = cap();
  const ra = authorizeGbsProviderAction({
    requested: {
      subjectType: formation.subjectType,
      subjectId: formation.subjectId,
      capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
      scope: { ...formation.scope, flags: { registered_agent: true, registered_office: false } },
    },
    capability: formation,
  });
  check(!ra.allowed, '12. business_formation VERIFIED → registered_agent denied');
}

{
  const wyRa = cap({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
    scope: {
      ...cap().scope,
      flags: { registered_agent: true, registered_office: false },
      protectedTitleIds: [PROTECTED_TITLE_IDS.REGISTERED_AGENT],
    },
    evidenceRefs: [wyRaEvidence()],
  });
  const de = authorizeGbsProviderAction({
    requested: {
      subjectType: wyRa.subjectType,
      subjectId: wyRa.subjectId,
      capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
      scope: { ...wyRa.scope, jurisdictionIds: ['j:US-DE'] },
    },
    capability: wyRa,
  });
  check(!de.allowed, '13. registered_agent VERIFIED WY → registered_agent DE denied');
}

{
  const legacy = {
    subjectType: 'agent',
    subjectId: 'agent-legacy',
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    scope: cap().scope,
  };
  const parsed = validateProviderCapabilityRecord(legacy);
  check(parsed.ok === true && parsed.value.capabilityId === '', '14. legacy ProviderCapability without capabilityId remains historically readable');
  check(isLegacyProviderCapability(parsed.value), '14b. legacy row is classified as legacy');
  const pub = evaluateListingPublicationGate({
    env: { BUSINESS_SERVICES_ENABLED: '1' },
    listing: { ...parsed.value, capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION, adminReviewStatus: 'approved' },
    capability: parsed.value,
  });
  check(!pub.allowed, '14. legacy ProviderCapability is NOT GBS publication-authoritative');
  check(pub.reason === LISTING_PUBLICATION_DENY_REASONS.CAPABILITY_ID_REQUIRED, '14c. publication requires explicit capabilityId');
}

{
  const agentCap = cap({ subjectType: 'agent', subjectId: 'agent-A' });
  const orgCap = cap({ subjectType: 'organization', subjectId: 'org-ABC' });
  const agencyUsingAgent = authorizeGbsProviderAction({
    requested: { ...orgCap, capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION },
    capability: agentCap,
  });
  check(!agencyUsingAgent.allowed && agencyUsingAgent.reason === GBS_AUTHORITY_DENY_REASONS.SUBJECT_MISMATCH, '15. Agency cannot use Agent capability');
  const agentUsingAgency = authorizeGbsProviderAction({
    requested: { ...agentCap, capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION },
    capability: orgCap,
  });
  check(!agentUsingAgency.allowed, '16. Agent cannot use Agency capability');
}

{
  check(
    !isCapabilityUsable(
      cap({
        trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED,
        evidenceRefs: [{ evidenceType: EVIDENCE_TYPES.ORGANIZATION_ATTESTATION, decision: EVIDENCE_DECISIONS.ACCEPTED }],
      })
    ),
    '17. Org Verified alone → no GBS capability'
  );
  const { svc } = serviceWith(
    cap({
      trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED,
      evidenceRefs: [{ evidenceType: EVIDENCE_TYPES.ORGANIZATION_ATTESTATION, decision: EVIDENCE_DECISIONS.ACCEPTED }],
    })
  );
  try {
    await svc.verify({
      id: 'cap-1',
      subjectType: 'agent',
      subjectId: 'agent-A',
      expectedVersion: 0,
      actor: staff,
      organizationVerified: true,
    });
    check(false, '17b. org verified verify should deny');
  } catch (err) {
    check(err.code === 'organization_verified_insufficient', '17. Org Verified alone cannot verify GBS capability');
  }
}

{
  const ukFormation = cap({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION,
    scope: {
      ...cap().scope,
      countryCodes: ['GB'],
      jurisdictionIds: ['j:GB'],
      entityTypeIds: ['et:GB:LTD'],
    },
  });
  const acspFromFormation = evaluateProtectedTitleVerification({
    titleId: PROTECTED_TITLE_IDS.ACSP,
    jurisdictionId: 'j:GB',
    subject: ukFormation,
    evidence: [acspEvidence()],
  });
  check(!acspFromFormation.ok, '18. UK formation → no ACSP');
  check(
    acspFromFormation.code === PROTECTED_TITLE_POLICY_DENY_REASONS.FORMATION_DOES_NOT_GRANT_TITLE,
    '18b. formation capability is forbidden from granting ACSP'
  );
}

{
  const holder = cap({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.DOCUMENT_PREPARATION,
    trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED,
    scope: {
      ...cap().scope,
      countryCodes: ['GB'],
      jurisdictionIds: ['j:GB'],
      entityTypeIds: ['et:GB:LTD'],
      protectedTitleIds: [PROTECTED_TITLE_IDS.ACSP],
    },
    evidenceRefs: [],
  });
  const { svc } = serviceWith(holder);
  try {
    await svc.verify({
      id: 'cap-1',
      subjectType: 'agent',
      subjectId: 'agent-A',
      expectedVersion: 0,
      actor: staff,
      titleId: PROTECTED_TITLE_IDS.ACSP,
    });
    check(false, '19. ACSP missing evidence should deny');
  } catch (err) {
    check(err.code === 'required_evidence_absent', '19. ACSP evidence missing → deny verification');
  }
}

{
  const holder = cap({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.DOCUMENT_PREPARATION,
    trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED,
    scope: {
      ...cap().scope,
      countryCodes: ['GB'],
      jurisdictionIds: ['j:GB'],
      protectedTitleIds: [PROTECTED_TITLE_IDS.ACSP],
    },
    evidenceRefs: [acspEvidence()],
  });
  const { svc } = serviceWith(holder);
  try {
    await svc.verify({
      id: 'cap-1',
      subjectType: 'agent',
      subjectId: 'agent-OTHER',
      expectedVersion: 0,
      actor: staff,
      titleId: PROTECTED_TITLE_IDS.ACSP,
    });
    check(false, '20. ACSP wrong subject should deny');
  } catch (err) {
    check(err.status === 404 && !String(err.message).includes('agent-A'), '20. ACSP wrong subject → deny without existence leak');
  }
}

{
  const attorney = evaluateProtectedTitleVerification({
    titleId: PROTECTED_TITLE_IDS.ATTORNEY,
    jurisdictionId: 'j:US-WY',
    subject: cap(),
    evidence: [wyRaEvidence({ titleId: PROTECTED_TITLE_IDS.ATTORNEY })],
  });
  check(!attorney.ok && attorney.code === PROTECTED_TITLE_POLICY_DENY_REASONS.POLICY_NOT_CONFIGURED, '21. protected-title policy missing/not configured → cannot verify title');
  check(
    resolveProtectedTitlePolicy({ titleId: PROTECTED_TITLE_IDS.COMPANY_SECRETARY, jurisdictionId: 'j:GB' }).verificationReadiness !==
      'ready',
    '21b. unresearched titles stay needs_policy'
  );
}

{
  const expired = evaluateProtectedTitleVerification({
    titleId: PROTECTED_TITLE_IDS.REGISTERED_AGENT,
    jurisdictionId: 'j:US-WY',
    subject: cap({
      capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
      scope: { ...cap().scope, protectedTitleIds: [PROTECTED_TITLE_IDS.REGISTERED_AGENT] },
    }),
    evidence: [wyRaEvidence({ effectiveFrom: '2024-01-01T00:00:00.000Z', effectiveTo: '2025-01-01T00:00:00.000Z' })],
    now: new Date('2026-08-14T00:00:00.000Z'),
  });
  check(!expired.ok && expired.code === PROTECTED_TITLE_POLICY_DENY_REASONS.EVIDENCE_EXPIRED, '22. expired evidence where current status is required → cannot project protected title as current');
}

{
  const { svc } = serviceWith(
    cap({
      trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED,
      evidenceRefs: [{ evidenceType: EVIDENCE_TYPES.AUTHORITY_CONFIRMATION, decision: EVIDENCE_DECISIONS.ACCEPTED }],
    })
  );
  try {
    await svc.verify({
      id: 'cap-1',
      subjectType: 'agent',
      subjectId: 'agent-A',
      expectedVersion: 0,
      actor: provider,
    });
    check(false, '23. provider self-verify should deny');
  } catch (err) {
    check(err.code === 'staff_review_required' || err.code === 'provider_self_verify_forbidden', '23. provider self-verify → deny');
  }
}

{
  const record = cap({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
    trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED,
    scope: {
      ...cap().scope,
      flags: { registered_agent: true, registered_office: false },
      protectedTitleIds: [PROTECTED_TITLE_IDS.REGISTERED_AGENT],
    },
    evidenceRefs: [wyRaEvidence()],
  });
  const { svc } = serviceWith(record);
  const verified = await svc.verify({
    id: 'cap-1',
    subjectType: 'agent',
    subjectId: 'agent-A',
    expectedVersion: 0,
    actor: staff,
  });
  check(verified.trustStatus === PROVIDER_TRUST_STATUSES.VERIFIED, '24. staff review + valid required evidence + exact subject + correct policy → may reach VERIFIED');
}

{
  const { svc } = serviceWith(
    cap({
      capabilityId: '',
      trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED,
      evidenceRefs: [{ evidenceType: EVIDENCE_TYPES.AUTHORITY_CONFIRMATION, decision: EVIDENCE_DECISIONS.ACCEPTED }],
    })
  );
  try {
    await svc.verify({
      id: 'cap-1',
      subjectType: 'agent',
      subjectId: 'agent-A',
      expectedVersion: 0,
      actor: staff,
    });
    check(false, 'missing capabilityId verify should deny');
  } catch (err) {
    check(err.code === 'gbs_capability_id_missing', 'review refuses VERIFIED when capabilityId missing');
  }
}

{
  const wy = cap({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
    evidenceRefs: [wyRaEvidence()],
    scope: { ...cap().scope, protectedTitleIds: [PROTECTED_TITLE_IDS.REGISTERED_AGENT] },
  });
  const dePolicy = evaluateProtectedTitleVerification({
    titleId: PROTECTED_TITLE_IDS.REGISTERED_AGENT,
    jurisdictionId: 'j:US-DE',
    subject: { ...wy, scope: { ...wy.scope, jurisdictionIds: ['j:US-DE'] } },
    evidence: [wyRaEvidence()],
  });
  check(!dePolicy.ok, 'WY RA evidence does not satisfy Delaware RA policy');
}

{
  const { svc } = serviceWith(
    cap({
      recordVersion: 4,
      evidenceRefs: [{ evidenceType: EVIDENCE_TYPES.AUTHORITY_CONFIRMATION, decision: EVIDENCE_DECISIONS.ACCEPTED }],
    })
  );
  try {
    await svc.verify({
      id: 'cap-1',
      subjectType: 'agent',
      subjectId: 'agent-A',
      expectedVersion: 3,
      actor: staff,
    });
    check(false, 'stale review should 409');
  } catch (err) {
    check(err.code === OPTIMISTIC_CONCURRENCY_CODE && err.status === 409, 'recordVersion stale review → 409');
  }
}

console.log(`phase17d2r1ProviderAuthority.test.js: ${count} assertions passed`);
