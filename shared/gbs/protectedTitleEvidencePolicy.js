/**
 * Source-controlled protected-title evidence policy (Phase 17D-2R1).
 *
 * Not Admin-editable. Missing/not-configured policy cannot reach VERIFIED.
 * Organization Verified and formation capability never mint a protected title.
 */
import { PROVIDER_SUBJECT_TYPES } from './constants.js';
import { BUSINESS_SERVICES_CAPABILITY_IDS } from './businessServicesCapabilities.js';
import { PROTECTED_TITLE_IDS } from './protectedTitles.js';
import { EVIDENCE_DECISIONS, EVIDENCE_TYPES, evidenceIsCurrent } from './providerEvidence.js';
import { sameProviderSubject } from './providerCapability.js';

export const PROTECTED_TITLE_POLICY_VERSION = '17d-2r1.0';

export const PROTECTED_TITLE_VERIFICATION_READINESS = Object.freeze({
  READY: 'ready',
  NOT_CONFIGURED: 'not_configured',
  NEEDS_POLICY: 'needs_policy',
});

export const PROTECTED_TITLE_EVIDENCE_CLASSES = Object.freeze({
  OFFICIAL_REGISTRY_STATUS: EVIDENCE_TYPES.OFFICIAL_REGISTRY_STATUS,
  REGULATORY_REGISTRATION: EVIDENCE_TYPES.REGULATORY_REGISTRATION,
  AUTHORITY_CONFIRMATION: EVIDENCE_TYPES.AUTHORITY_CONFIRMATION,
  PHYSICAL_REGISTERED_OFFICE_CONFIRMATION: EVIDENCE_TYPES.PHYSICAL_REGISTERED_OFFICE_CONFIRMATION,
  ORGANIZATION_ATTESTATION: EVIDENCE_TYPES.ORGANIZATION_ATTESTATION,
  WEBSITE_CLAIM: 'website_claim',
  STAFF_REVIEW_NOTE: EVIDENCE_TYPES.STAFF_REVIEW_NOTE,
});

export const PROTECTED_TITLE_POLICY_DENY_REASONS = Object.freeze({
  POLICY_NOT_CONFIGURED: 'protected_title_policy_not_configured',
  REQUIRED_EVIDENCE_ABSENT: 'required_evidence_absent',
  EVIDENCE_CLASS_INVALID: 'protected_title_evidence_class_invalid',
  EVIDENCE_EXPIRED: 'protected_title_evidence_expired',
  ORGANIZATION_VERIFIED_INSUFFICIENT: 'organization_verified_insufficient',
  WEBSITE_CLAIM_INSUFFICIENT: 'protected_title_website_claim_insufficient',
  SUBJECT_MISMATCH: 'protected_title_subject_mismatch',
  JURISDICTION_MISMATCH: 'protected_title_jurisdiction_mismatch',
  FORMATION_DOES_NOT_GRANT_TITLE: 'protected_title_formation_insufficient',
  WRONG_CAPABILITY: 'protected_title_capability_mismatch',
});

const BOTH = Object.freeze([PROVIDER_SUBJECT_TYPES.AGENT, PROVIDER_SUBJECT_TYPES.ORGANIZATION]);

function policy(row) {
  return Object.freeze({
    policyVersion: PROTECTED_TITLE_POLICY_VERSION,
    evidenceRequired: true,
    exactSubjectMatch: true,
    reviewRequired: true,
    organizationVerificationInsufficient: true,
    websiteClaimInsufficient: true,
    effectiveDateRequired: false,
    currentStatusRequired: true,
    officialRegistryPreferred: false,
    officialRegistryRequired: false,
    forbiddenCapabilityIds: Object.freeze([BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION]),
    acceptedAuthorityClasses: Object.freeze(['official_registry', 'state_registrar', 'national_registrar', 'licensing_authority']),
    ...row,
    jurisdictionScope: Object.freeze([...(row.jurisdictionScope || [])]),
    allowedSubjectTypes: Object.freeze([...(row.allowedSubjectTypes || BOTH)]),
    requiredEvidenceClasses: Object.freeze([...(row.requiredEvidenceClasses || [])]),
    acceptedEvidenceClasses: Object.freeze([...(row.acceptedEvidenceClasses || row.requiredEvidenceClasses || [])]),
    forbiddenCapabilityIds: Object.freeze([
      ...(row.forbiddenCapabilityIds || [BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION]),
    ]),
  });
}

function notConfiguredTitle(titleId, extra = {}) {
  return policy({
    titleId,
    jurisdictionScope: [],
    capabilityId: null,
    verificationReadiness: PROTECTED_TITLE_VERIFICATION_READINESS.NEEDS_POLICY,
    requiredEvidenceClasses: [],
    acceptedEvidenceClasses: [],
    notes: 'Regulatory evidence rules are not researched for this title/jurisdiction. Cannot VERIFIED.',
    ...extra,
  });
}

/**
 * Jurisdiction-specific policies first. Empty jurisdictionScope is a fallback stub only.
 */
export const PROTECTED_TITLE_EVIDENCE_POLICIES = Object.freeze([
  policy({
    titleId: PROTECTED_TITLE_IDS.ACSP,
    jurisdictionScope: ['j:GB'],
    capabilityId: null,
    allowedSubjectTypes: BOTH,
    verificationReadiness: PROTECTED_TITLE_VERIFICATION_READINESS.READY,
    requiredEvidenceClasses: [PROTECTED_TITLE_EVIDENCE_CLASSES.OFFICIAL_REGISTRY_STATUS],
    acceptedEvidenceClasses: [
      PROTECTED_TITLE_EVIDENCE_CLASSES.OFFICIAL_REGISTRY_STATUS,
      PROTECTED_TITLE_EVIDENCE_CLASSES.REGULATORY_REGISTRATION,
    ],
    acceptedAuthorityClasses: Object.freeze(['official_registry', 'national_registrar']),
    officialRegistryPreferred: true,
    officialRegistryRequired: true,
    effectiveDateRequired: true,
    currentStatusRequired: true,
    forbiddenCapabilityIds: Object.freeze([
      BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION,
      BUSINESS_SERVICES_CAPABILITY_IDS.FORMATION_CONSULTATION,
      BUSINESS_SERVICES_CAPABILITY_IDS.EIN_ASSISTANCE,
    ]),
    notes: 'UK ACSP requires official Companies House / GOV.UK registry-class evidence on the exact subject. Ordinary Agent verification, Organization Verified, and UK business_formation do not grant ACSP. Official list is preferred/required evidence class; not scraped in this phase.',
  }),
  policy({
    titleId: PROTECTED_TITLE_IDS.REGISTERED_AGENT,
    jurisdictionScope: ['j:US-WY'],
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
    verificationReadiness: PROTECTED_TITLE_VERIFICATION_READINESS.READY,
    requiredEvidenceClasses: [PROTECTED_TITLE_EVIDENCE_CLASSES.REGULATORY_REGISTRATION],
    acceptedEvidenceClasses: [
      PROTECTED_TITLE_EVIDENCE_CLASSES.REGULATORY_REGISTRATION,
      PROTECTED_TITLE_EVIDENCE_CLASSES.AUTHORITY_CONFIRMATION,
    ],
    officialRegistryPreferred: true,
    officialRegistryRequired: false,
    notes: 'Wyoming Registered Agent is jurisdiction-scoped. SOS commercial registered-agent registration is the preferred evidence class. Organization Verified and formation capability do not grant this title.',
  }),
  policy({
    titleId: PROTECTED_TITLE_IDS.REGISTERED_AGENT,
    jurisdictionScope: ['j:US-DE'],
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
    verificationReadiness: PROTECTED_TITLE_VERIFICATION_READINESS.READY,
    requiredEvidenceClasses: [PROTECTED_TITLE_EVIDENCE_CLASSES.PHYSICAL_REGISTERED_OFFICE_CONFIRMATION],
    acceptedEvidenceClasses: [
      PROTECTED_TITLE_EVIDENCE_CLASSES.PHYSICAL_REGISTERED_OFFICE_CONFIRMATION,
      PROTECTED_TITLE_EVIDENCE_CLASSES.AUTHORITY_CONFIRMATION,
    ],
    officialRegistryPreferred: false,
    officialRegistryRequired: false,
    notes: 'Delaware requires a Registered Agent with a physical Delaware street address. The state does not publish a government RA license registry; do not invent one. Organization Verified and formation capability do not grant this title.',
  }),
  policy({
    titleId: PROTECTED_TITLE_IDS.REGISTERED_AGENT,
    jurisdictionScope: ['j:US-TX'],
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
    verificationReadiness: PROTECTED_TITLE_VERIFICATION_READINESS.READY,
    requiredEvidenceClasses: [PROTECTED_TITLE_EVIDENCE_CLASSES.AUTHORITY_CONFIRMATION],
    acceptedEvidenceClasses: [
      PROTECTED_TITLE_EVIDENCE_CLASSES.AUTHORITY_CONFIRMATION,
      PROTECTED_TITLE_EVIDENCE_CLASSES.REGULATORY_REGISTRATION,
    ],
    officialRegistryPreferred: true,
    officialRegistryRequired: false,
    notes: 'Texas Registered Agent is jurisdiction-scoped and distinct from Wyoming/Delaware. Organization Verified and formation capability do not grant this title.',
  }),
  policy({
    titleId: PROTECTED_TITLE_IDS.REGISTERED_AGENT,
    jurisdictionScope: ['j:US-FL'],
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
    verificationReadiness: PROTECTED_TITLE_VERIFICATION_READINESS.READY,
    requiredEvidenceClasses: [PROTECTED_TITLE_EVIDENCE_CLASSES.AUTHORITY_CONFIRMATION],
    acceptedEvidenceClasses: [
      PROTECTED_TITLE_EVIDENCE_CLASSES.AUTHORITY_CONFIRMATION,
      PROTECTED_TITLE_EVIDENCE_CLASSES.REGULATORY_REGISTRATION,
    ],
    officialRegistryPreferred: true,
    officialRegistryRequired: false,
    notes: 'Florida Registered Agent is jurisdiction-scoped. Organization Verified and formation capability do not grant this title.',
  }),
  notConfiguredTitle(PROTECTED_TITLE_IDS.REGISTERED_OFFICE_PROVIDER, {
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_OFFICE,
  }),
  notConfiguredTitle(PROTECTED_TITLE_IDS.CSP),
  notConfiguredTitle(PROTECTED_TITLE_IDS.ATTORNEY),
  notConfiguredTitle(PROTECTED_TITLE_IDS.TAX_PROFESSIONAL),
  notConfiguredTitle(PROTECTED_TITLE_IDS.ACCOUNTANT),
  notConfiguredTitle(PROTECTED_TITLE_IDS.COMPANY_SECRETARY),
  notConfiguredTitle(PROTECTED_TITLE_IDS.OTHER_REGULATED),
]);

function evidenceClassOf(evidence = {}) {
  return String(evidence.evidenceClass || evidence.evidenceType || '').trim();
}

export function resolveProtectedTitlePolicy({ titleId, jurisdictionId } = {}) {
  const id = titleId ? String(titleId) : '';
  if (!id) return null;
  const matches = PROTECTED_TITLE_EVIDENCE_POLICIES.filter((p) => p.titleId === id);
  const scoped = matches.find((p) => jurisdictionId && p.jurisdictionScope.includes(jurisdictionId));
  if (scoped) return scoped;
  const stub = matches.find((p) => p.jurisdictionScope.length === 0);
  return stub || null;
}

function deny(code, status = 403) {
  return { ok: false, code, status };
}

/**
 * @returns {{ ok: boolean, code: string | null, status?: number, policy?: object | null }}
 */
export function evaluateProtectedTitleVerification({
  titleId,
  jurisdictionId,
  subject = {},
  evidence,
  organizationVerified = false,
  now = new Date(),
} = {}) {
  const policyRow = resolveProtectedTitlePolicy({ titleId, jurisdictionId });
  if (!policyRow || policyRow.verificationReadiness !== PROTECTED_TITLE_VERIFICATION_READINESS.READY) {
    return deny(PROTECTED_TITLE_POLICY_DENY_REASONS.POLICY_NOT_CONFIGURED);
  }

  if (organizationVerified) {
    return deny(PROTECTED_TITLE_POLICY_DENY_REASONS.ORGANIZATION_VERIFIED_INSUFFICIENT);
  }

  if (
    subject.capabilityId &&
    policyRow.forbiddenCapabilityIds.includes(String(subject.capabilityId))
  ) {
    return deny(PROTECTED_TITLE_POLICY_DENY_REASONS.FORMATION_DOES_NOT_GRANT_TITLE);
  }
  if (policyRow.capabilityId && subject.capabilityId && subject.capabilityId !== policyRow.capabilityId) {
    return deny(PROTECTED_TITLE_POLICY_DENY_REASONS.WRONG_CAPABILITY);
  }
  if (!policyRow.allowedSubjectTypes.includes(subject.subjectType)) {
    return { ...deny(PROTECTED_TITLE_POLICY_DENY_REASONS.SUBJECT_MISMATCH, 404) };
  }

  const list = Array.isArray(evidence) ? evidence : evidence ? [evidence] : [];
  if (list.some((row) => evidenceClassOf(row) === PROTECTED_TITLE_EVIDENCE_CLASSES.WEBSITE_CLAIM)) {
    return deny(PROTECTED_TITLE_POLICY_DENY_REASONS.WEBSITE_CLAIM_INSUFFICIENT);
  }

  const orgOnly =
    list.length > 0 &&
    list.every((row) => evidenceClassOf(row) === PROTECTED_TITLE_EVIDENCE_CLASSES.ORGANIZATION_ATTESTATION);
  if (orgOnly || (list.length === 0 && organizationVerified)) {
    return deny(PROTECTED_TITLE_POLICY_DENY_REASONS.ORGANIZATION_VERIFIED_INSUFFICIENT);
  }

  const accepted = list.filter((row) => {
    if (row.decision !== EVIDENCE_DECISIONS.ACCEPTED) return false;
    if (policyRow.exactSubjectMatch && (row.subjectType || row.subjectId) && !sameProviderSubject(row, subject)) {
      return false;
    }
    if (row.jurisdictionId && row.jurisdictionId !== jurisdictionId) return false;
    if (row.titleId && row.titleId !== titleId) return false;
    const cls = evidenceClassOf(row);
    return policyRow.acceptedEvidenceClasses.includes(cls);
  });

  if (accepted.some((row) => row.subjectType && row.subjectId && !sameProviderSubject(row, subject))) {
    return { ...deny(PROTECTED_TITLE_POLICY_DENY_REASONS.SUBJECT_MISMATCH, 404) };
  }

  const requiredHit = accepted.filter((row) =>
    policyRow.requiredEvidenceClasses.includes(evidenceClassOf(row))
  );
  if (!requiredHit.length) {
    return deny(PROTECTED_TITLE_POLICY_DENY_REASONS.REQUIRED_EVIDENCE_ABSENT);
  }

  if (policyRow.officialRegistryRequired) {
    const registryHit = requiredHit.some(
      (row) =>
        evidenceClassOf(row) === PROTECTED_TITLE_EVIDENCE_CLASSES.OFFICIAL_REGISTRY_STATUS ||
        row.authorityClass === 'official_registry' ||
        row.authorityClass === 'national_registrar'
    );
    if (!registryHit) {
      return deny(PROTECTED_TITLE_POLICY_DENY_REASONS.REQUIRED_EVIDENCE_ABSENT);
    }
  }

  if (policyRow.currentStatusRequired) {
    const current = requiredHit.find((row) => evidenceIsCurrent(row, { now }));
    if (!current) {
      return deny(PROTECTED_TITLE_POLICY_DENY_REASONS.EVIDENCE_EXPIRED);
    }
  }

  if (policyRow.effectiveDateRequired && requiredHit.every((row) => !row.effectiveFrom)) {
    return deny(PROTECTED_TITLE_POLICY_DENY_REASONS.REQUIRED_EVIDENCE_ABSENT);
  }

  return { ok: true, code: null, status: 200, policy: policyRow };
}

export function protectedTitleMayProjectCurrent(args) {
  return evaluateProtectedTitleVerification(args).ok === true;
}
