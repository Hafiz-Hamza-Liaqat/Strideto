/**
 * ProviderCapability review primitives (Phase 17D-2 / 17D-2R1). No Admin UI.
 * claimed != evidence_submitted != evidence_backed != verified.
 * Provider cannot self-verify. Org verified does not mint formation/RA/ACSP.
 * Missing/unknown capabilityId cannot authorize new GBS verification.
 */
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';
import { PROVIDER_TRUST_STATUSES } from '../../../../shared/gbs/constants.js';
import { sameProviderSubject } from '../../../../shared/gbs/providerCapability.js';
import {
  capabilityAllowsSubject,
  getBusinessServicesCapability,
  isKnownBusinessServicesCapability,
} from '../../../../shared/gbs/businessServicesCapabilities.js';
import { PROTECTED_TITLE_IDS } from '../../../../shared/gbs/protectedTitles.js';
import {
  EVIDENCE_DECISIONS,
  EVIDENCE_TYPES,
  canTransitionEvidenceDecision,
  evidenceIsCurrent,
  isStaffEvidenceReviewDecision,
} from '../../../../shared/gbs/providerEvidence.js';
import { evaluateProtectedTitleVerification } from '../../../../shared/gbs/protectedTitleEvidencePolicy.js';
import {
  isGbsAuthoritativeCapability,
  isLegacyProviderCapability,
} from '../../../../shared/gbs/gbsProviderAuthority.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { applyOptimisticMutation, assertExpectedVersion } from '../../../../shared/platform/optimisticConcurrency.js';
import { POLICY_ACTIONS } from '../../../../shared/capability/permissionPolicy.js';

function deny(code, status = 403) {
  return Object.assign(new Error(code), { status, code });
}

function notFound() {
  return deny('provider_capability_not_found', 404);
}

function isSelf(actor, record) {
  return sameProviderSubject(actor || {}, record || {});
}

function uniqueIds(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (!value) continue;
    const id = String(value);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function evidenceListOf(record) {
  return Array.isArray(record?.evidenceRefs) ? record.evidenceRefs : [];
}

export function assertRequiredAcceptedEvidence(record) {
  const capabilityId = record?.capabilityId ? String(record.capabilityId).trim() : '';
  if (!capabilityId) throw deny('gbs_capability_id_missing');
  if (!isKnownBusinessServicesCapability(capabilityId)) throw deny('gbs_capability_id_unknown');
  const def = getBusinessServicesCapability(capabilityId);
  const evidenceList = evidenceListOf(record);
  const orgOnly =
    evidenceList.length > 0 &&
    evidenceList.every((row) => (row.evidenceType || row.evidenceClass) === EVIDENCE_TYPES.ORGANIZATION_ATTESTATION);
  if (orgOnly) throw deny('organization_verified_insufficient');
  if (def?.evidenceRequired) {
    const accepted = evidenceList.filter((row) => row.decision === EVIDENCE_DECISIONS.ACCEPTED);
    if (!accepted.length) throw deny('required_evidence_absent');
  }
}

function evidenceReviewAuditAction(decision) {
  if (decision === EVIDENCE_DECISIONS.ACCEPTED) {
    return GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_EVIDENCE_ACCEPTED;
  }
  if (decision === EVIDENCE_DECISIONS.REJECTED) {
    return GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_EVIDENCE_REJECTED;
  }
  return GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_EVIDENCE_REVIEWED;
}

export function organizationVerifiedDoesNotVerify(capabilityId) {
  const protectedCaps = new Set([
    'business_formation',
    'registered_agent',
    'registered_office',
    'ein_assistance',
  ]);
  return protectedCaps.has(capabilityId) || Boolean(getBusinessServicesCapability(capabilityId)?.reviewRequired);
}

export function capabilityCoversJurisdiction(record, jurisdictionId) {
  const ids = record?.scope?.jurisdictionIds || [];
  return ids.includes(jurisdictionId);
}

function assertMayVerify({ record, actor, organizationVerified = false, titleId = null, now = new Date(), readinessResolver = null }) {
  if (!actor?.isStaff) throw deny('staff_review_required');
  if (isSelf(actor, record)) throw deny('provider_self_verify_forbidden');

  const capabilityId = record?.capabilityId ? String(record.capabilityId).trim() : '';
  if (!capabilityId) throw deny('gbs_capability_id_missing');
  if (!isKnownBusinessServicesCapability(capabilityId)) throw deny('gbs_capability_id_unknown');
  if (!capabilityAllowsSubject(capabilityId, record.subjectType)) {
    throw deny('gbs_subject_mismatch', 404);
  }
  if (organizationVerified) throw deny('organization_verified_insufficient');

  const def = getBusinessServicesCapability(capabilityId);
  const evidenceList = evidenceListOf(record);
  const orgOnly =
    evidenceList.length > 0 &&
    evidenceList.every((row) => (row.evidenceType || row.evidenceClass) === EVIDENCE_TYPES.ORGANIZATION_ATTESTATION);
  if (orgOnly) throw deny('organization_verified_insufficient');

  const titleIds = uniqueIds([
    titleId,
    def.protectedTitleRequired ? def.requiredProtectedTitleId : null,
    ...(record.scope?.protectedTitleIds || []),
  ]);

  if (titleIds.length) {
    const jurisdictionIds = record.scope?.jurisdictionIds || [];
    if (!jurisdictionIds.length) throw deny('protected_title_jurisdiction_mismatch');
    for (const t of titleIds) {
      for (const jurisdictionId of jurisdictionIds) {
        const decision = evaluateProtectedTitleVerification({
          titleId: t,
          jurisdictionId,
          subject: record,
          evidence: evidenceList,
          organizationVerified,
          now,
        });
        if (!decision.ok) {
          throw deny(decision.code, decision.status || 403);
        }
      }
    }
  } else if (def.evidenceRequired) {
    assertRequiredAcceptedEvidence(record);
  }
  if (readinessResolver) {
    for (const jurisdictionId of record.scope?.jurisdictionIds || []) {
      if (readinessResolver(jurisdictionId, { now }).productionReady !== true) {
        throw deny('jurisdiction_not_current_reviewed');
      }
    }
  }
}

export function createProviderCapabilityReviewService({
  store,
  audit = async () => {},
  mutateRecord = null,
  readinessResolver = null,
} = {}) {
  async function loadExact(subjectType, subjectId, id) {
    const record = await store.getById(id);
    if (!record || !sameProviderSubject(record, { subjectType, subjectId })) {
      throw notFound();
    }
    return record;
  }

  async function write(record, actor, action, extra = {}) {
    if (mutateRecord) {
      await mutateRecord({
        id: record._id || record.id,
        expectedVersion: record.recordVersion - 1,
        subjectType: record.subjectType,
        subjectId: record.subjectId,
        set: record,
        actor,
      });
    } else {
      await store.put(record);
    }
    await audit({
      action,
      status: 'success',
      policyVersion: '17d-2.0',
      metadata: redactAuditMetadata({
        subjectType: record.subjectType,
        subjectId: record.subjectId,
        capabilityId: record.capabilityId,
        jurisdictionIds: record.scope?.jurisdictionIds,
        trustStatus: record.trustStatus,
        recordVersion: record.recordVersion,
        reasonCode: extra.reasonCode || null,
        actorId: actor?.id || null,
        evidenceIndex: extra.evidenceIndex ?? null,
        evidenceType: extra.evidenceType || null,
        oldDecision: extra.oldDecision || null,
        newDecision: extra.newDecision || null,
      }),
    });
    return record;
  }

  function bump(current, expectedVersion, patch) {
    const { result } = applyOptimisticMutation({
      currentVersion: current.recordVersion,
      expectedVersion,
      mutate: (recordVersion) => ({ ...current, ...patch, recordVersion }),
    });
    return result;
  }

  return {
    policyAction: POLICY_ACTIONS.ADMIN_PROVIDER_VERIFICATION,

    async submitEvidence({ id, subjectType, subjectId, expectedVersion, actor, evidence }) {
      const current = await loadExact(subjectType, subjectId, id);
      if (!isSelf(actor, current) && !actor?.isStaff) throw deny('evidence_submit_forbidden');
      const next = bump(current, expectedVersion, {
        trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED,
        evidenceRefs: [...(current.evidenceRefs || []), evidence].slice(0, 50),
      });
      return write(next, actor, GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_EVIDENCE_SUBMITTED);
    },

    async reviewEvidence({
      id,
      subjectType,
      subjectId,
      expectedVersion,
      actor,
      evidenceIndex,
      decision,
      reasonCode,
    }) {
      if (!actor?.isStaff) throw deny('staff_review_required');
      const current = await loadExact(subjectType, subjectId, id);
      if (isSelf(actor, current)) throw deny('provider_self_review_forbidden');
      if (!isStaffEvidenceReviewDecision(decision)) throw deny('unknown_evidence_decision', 400);
      if (!Number.isInteger(evidenceIndex) || evidenceIndex < 0) {
        throw deny('invalid_evidence_index', 400);
      }
      const refs = evidenceListOf(current);
      const row = refs[evidenceIndex];
      if (!row) throw deny('evidence_not_found', 404);
      const oldDecision = row.decision || EVIDENCE_DECISIONS.PENDING;
      if (!canTransitionEvidenceDecision(oldDecision, decision)) {
        throw deny('invalid_evidence_decision', 400);
      }
      if (oldDecision === decision) {
        assertExpectedVersion(current.recordVersion, expectedVersion);
        return current;
      }
      const nextRefs = refs.map((item, index) =>
        index === evidenceIndex ? { ...item, decision } : { ...item }
      );
      const next = bump(current, expectedVersion, {
        evidenceRefs: nextRefs,
      });
      return write(next, actor, evidenceReviewAuditAction(decision), {
        reasonCode,
        evidenceIndex,
        evidenceType: row.evidenceType || row.evidenceClass || null,
        oldDecision,
        newDecision: decision,
      });
    },

    async markEvidenceBacked({ id, subjectType, subjectId, expectedVersion, actor }) {
      if (!actor?.isStaff) throw deny('staff_review_required');
      const current = await loadExact(subjectType, subjectId, id);
      if (isSelf(actor, current)) throw deny('provider_self_review_forbidden');
      assertRequiredAcceptedEvidence(current);
      if (
        current.trustStatus === PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED ||
        current.trustStatus === PROVIDER_TRUST_STATUSES.VERIFIED
      ) {
        assertExpectedVersion(current.recordVersion, expectedVersion);
        return current;
      }
      const next = bump(current, expectedVersion, {
        trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED,
      });
      return write(next, actor, GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_EVIDENCE_BACKED);
    },

    async verify({
      id,
      subjectType,
      subjectId,
      expectedVersion,
      actor,
      organizationVerified = false,
      titleId = null,
      now = new Date(),
    }) {
      const current = await loadExact(subjectType, subjectId, id);
      if (current.trustStatus === PROVIDER_TRUST_STATUSES.VERIFIED && current.status === GRANT_STATUSES.ACTIVE) {
        assertExpectedVersion(current.recordVersion, expectedVersion);
        return current;
      }
      assertMayVerify({ record: current, actor, organizationVerified, titleId, now, readinessResolver });
      const next = bump(current, expectedVersion, {
        trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
        status: GRANT_STATUSES.ACTIVE,
      });
      const action =
        current.capabilityId === 'registered_agent' ||
        current.capabilityId === 'registered_office' ||
        titleId ||
        (current.scope?.protectedTitleIds || []).length
          ? GBS_AUDIT_EVENTS.PROTECTED_TITLE_VERIFIED
          : GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_VERIFIED;
      return write(next, actor, action);
    },

    async needsInformation({ id, subjectType, subjectId, expectedVersion, actor, reasonCode }) {
      if (!actor?.isStaff) throw deny('staff_review_required');
      const current = await loadExact(subjectType, subjectId, id);
      if (current.review?.decision === 'needs_information') {
        assertExpectedVersion(current.recordVersion, expectedVersion);
        return current;
      }
      const next = bump(current, expectedVersion, {
        review: { ...(current.review || {}), decision: 'needs_information', reasonCode },
      });
      return write(next, actor, GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_NEEDS_INFORMATION, { reasonCode });
    },

    async reject({ id, subjectType, subjectId, expectedVersion, actor, reasonCode }) {
      if (!actor?.isStaff) throw deny('staff_review_required');
      const current = await loadExact(subjectType, subjectId, id);
      if (current.review?.decision === 'rejected') {
        assertExpectedVersion(current.recordVersion, expectedVersion);
        return current;
      }
      const next = bump(current, expectedVersion, {
        trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED,
        review: { ...(current.review || {}), decision: 'rejected', reasonCode },
      });
      return write(next, actor, GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_REJECTED, { reasonCode });
    },

    async suspend({ id, subjectType, subjectId, expectedVersion, actor, reasonCode }) {
      if (!actor?.isStaff) throw deny('staff_review_required');
      const current = await loadExact(subjectType, subjectId, id);
      if (current.trustStatus === PROVIDER_TRUST_STATUSES.SUSPENDED && current.status === GRANT_STATUSES.SUSPENDED) {
        assertExpectedVersion(current.recordVersion, expectedVersion);
        return current;
      }
      const next = bump(current, expectedVersion, {
        status: GRANT_STATUSES.SUSPENDED,
        trustStatus: PROVIDER_TRUST_STATUSES.SUSPENDED,
      });
      return write(next, actor, GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_SUSPENDED, { reasonCode });
    },

    async revoke({ id, subjectType, subjectId, expectedVersion, actor, reasonCode }) {
      if (!actor?.isStaff) throw deny('staff_review_required');
      const current = await loadExact(subjectType, subjectId, id);
      if (current.trustStatus === PROVIDER_TRUST_STATUSES.REVOKED && current.status === GRANT_STATUSES.REVOKED) {
        assertExpectedVersion(current.recordVersion, expectedVersion);
        return current;
      }
      const next = bump(current, expectedVersion, {
        status: GRANT_STATUSES.REVOKED,
        trustStatus: PROVIDER_TRUST_STATUSES.REVOKED,
      });
      return write(next, actor, GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_REVOKED, { reasonCode });
    },
  };
}

export function createMemoryProviderCapabilityStore(initial = []) {
  const rows = [...initial];
  return {
    async getById(id) {
      return rows.find((r) => String(r.id || r._id) === String(id)) || null;
    },
    async put(record) {
      const idx = rows.findIndex((r) => String(r.id || r._id) === String(record.id || record._id));
      if (idx >= 0) rows[idx] = record;
      else rows.push(record);
    },
    list() {
      return rows;
    },
  };
}

export function isCapabilityUsable(record, { jurisdictionId, now } = {}) {
  if (!record) return false;
  if (isLegacyProviderCapability(record) || !isGbsAuthoritativeCapability(record)) return false;
  if (record.status !== GRANT_STATUSES.ACTIVE) return false;
  if (record.trustStatus !== PROVIDER_TRUST_STATUSES.VERIFIED) return false;
  if (jurisdictionId && !capabilityCoversJurisdiction(record, jurisdictionId)) return false;
  const def = getBusinessServicesCapability(record.capabilityId);
  const evidence = (record.evidenceRefs || []).find((e) => e?.decision === EVIDENCE_DECISIONS.ACCEPTED);
  if (record.capabilityId === 'registered_agent' || record.capabilityId === PROTECTED_TITLE_IDS.ACSP) {
    if (evidence && !evidenceIsCurrent(evidence, { now })) return false;
  }
  const titleIds = uniqueIds([
    def?.protectedTitleRequired ? def.requiredProtectedTitleId : null,
    ...(record.scope?.protectedTitleIds || []),
  ]);
  if (titleIds.length) {
    const jIds = jurisdictionId ? [jurisdictionId] : record.scope?.jurisdictionIds || [];
    if (!jIds.length) return false;
    for (const titleId of titleIds) {
      for (const jid of jIds) {
        const decision = evaluateProtectedTitleVerification({
          titleId,
          jurisdictionId: jid,
          subject: record,
          evidence: record.evidenceRefs,
          now,
        });
        if (!decision.ok) return false;
      }
    }
  }
  return true;
}

export function ukFormationDoesNotGrantAcsp(formationRecord, acspRecord) {
  if (!formationRecord || formationRecord.capabilityId !== 'business_formation') return true;
  if (!acspRecord) return true;
  return !(
    formationRecord.trustStatus === PROVIDER_TRUST_STATUSES.VERIFIED &&
    acspRecord.trustStatus === PROVIDER_TRUST_STATUSES.VERIFIED &&
    acspRecord.capabilityId === 'acsp'
  )
    ? true
    : formationRecord.capabilityId !== acspRecord.capabilityId;
}
