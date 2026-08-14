/**
 * ProviderCapability review primitives (Phase 17D-2). No Admin UI.
 * claimed != evidence_submitted != evidence_backed != verified.
 * Provider cannot self-verify. Org verified does not mint formation/RA/ACSP.
 */
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';
import { PROVIDER_TRUST_STATUSES } from '../../../../shared/gbs/constants.js';
import { sameProviderSubject } from '../../../../shared/gbs/providerCapability.js';
import { getBusinessServicesCapability } from '../../../../shared/gbs/businessServicesCapabilities.js';
import { PROTECTED_TITLE_IDS } from '../../../../shared/gbs/protectedTitles.js';
import { EVIDENCE_DECISIONS, evidenceIsCurrent } from '../../../../shared/gbs/providerEvidence.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { applyOptimisticMutation } from '../../../../shared/platform/optimisticConcurrency.js';
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

export function createProviderCapabilityReviewService({
  store,
  audit = async () => {},
  mutateRecord = null,
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

    async markEvidenceBacked({ id, subjectType, subjectId, expectedVersion, actor }) {
      if (!actor?.isStaff) throw deny('staff_review_required');
      const current = await loadExact(subjectType, subjectId, id);
      const next = bump(current, expectedVersion, {
        trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED,
      });
      return write(next, actor, GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_EVIDENCE_BACKED);
    },

    async verify({ id, subjectType, subjectId, expectedVersion, actor, organizationVerified = false }) {
      if (!actor?.isStaff) throw deny('staff_review_required');
      const current = await loadExact(subjectType, subjectId, id);
      if (isSelf(actor, current)) throw deny('provider_self_verify_forbidden');
      if (organizationVerified && organizationVerifiedDoesNotVerify(current.capabilityId)) {
        throw deny('organization_verified_insufficient');
      }
      const next = bump(current, expectedVersion, {
        trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
        status: GRANT_STATUSES.ACTIVE,
      });
      const action =
        current.capabilityId === 'registered_agent' || current.capabilityId === 'registered_office'
          ? GBS_AUDIT_EVENTS.PROTECTED_TITLE_VERIFIED
          : GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_VERIFIED;
      return write(next, actor, action);
    },

    async needsInformation({ id, subjectType, subjectId, expectedVersion, actor, reasonCode }) {
      if (!actor?.isStaff) throw deny('staff_review_required');
      const current = await loadExact(subjectType, subjectId, id);
      const next = bump(current, expectedVersion, {
        review: { ...(current.review || {}), decision: 'needs_information', reasonCode },
      });
      return write(next, actor, GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_NEEDS_INFORMATION, { reasonCode });
    },

    async reject({ id, subjectType, subjectId, expectedVersion, actor, reasonCode }) {
      if (!actor?.isStaff) throw deny('staff_review_required');
      const current = await loadExact(subjectType, subjectId, id);
      const next = bump(current, expectedVersion, {
        trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED,
        review: { ...(current.review || {}), decision: 'rejected', reasonCode },
      });
      return write(next, actor, GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_REJECTED, { reasonCode });
    },

    async suspend({ id, subjectType, subjectId, expectedVersion, actor, reasonCode }) {
      if (!actor?.isStaff) throw deny('staff_review_required');
      const current = await loadExact(subjectType, subjectId, id);
      const next = bump(current, expectedVersion, {
        status: GRANT_STATUSES.SUSPENDED,
        trustStatus: PROVIDER_TRUST_STATUSES.SUSPENDED,
      });
      return write(next, actor, GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_SUSPENDED, { reasonCode });
    },

    async revoke({ id, subjectType, subjectId, expectedVersion, actor, reasonCode }) {
      if (!actor?.isStaff) throw deny('staff_review_required');
      const current = await loadExact(subjectType, subjectId, id);
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
  if (record.status !== GRANT_STATUSES.ACTIVE) return false;
  if (record.trustStatus !== PROVIDER_TRUST_STATUSES.VERIFIED) return false;
  if (jurisdictionId && !capabilityCoversJurisdiction(record, jurisdictionId)) return false;
  const evidence = (record.evidenceRefs || []).find((e) => e?.decision === EVIDENCE_DECISIONS.ACCEPTED);
  if (record.capabilityId === 'registered_agent' || record.capabilityId === PROTECTED_TITLE_IDS.ACSP) {
    if (evidence && !evidenceIsCurrent(evidence, { now })) return false;
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
