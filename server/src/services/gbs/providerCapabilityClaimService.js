/**
 * Provider capability claim / evidence metadata (Phase 17D-3).
 * Provider cannot self-verify. Forbidden trust fields are stripped.
 */
import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';
import {
  GBS_PROVIDER_BOUNDS,
  PROVIDER_TRUST_STATUSES,
} from '../../../../shared/gbs/constants.js';
import {
  capabilityAllowsSubject,
  getBusinessServicesCapability,
  isKnownBusinessServicesCapability,
} from '../../../../shared/gbs/businessServicesCapabilities.js';
import { normalizeProviderScope } from '../../../../shared/gbs/providerCapability.js';
import { validateEvidenceMetadataRow } from '../../../../shared/gbs/providerEvidenceMetadata.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import { mutateProviderCapabilityRecord } from '../platform/optimisticConcurrency.js';

const FORBIDDEN_CLAIM_FIELDS = [
  'trustStatus',
  'reviewedBy',
  'protectedTitleVerified',
  'status',
  'recordVersion',
  'review',
];

function deny(code, status = 403) {
  return Object.assign(new Error(code), { status, code });
}

function stripForbidden(body = {}) {
  const out = { ...body };
  for (const key of FORBIDDEN_CLAIM_FIELDS) delete out[key];
  return out;
}

export function publicCapabilityProjection(record) {
  if (!record) return null;
  const def = getBusinessServicesCapability(record.capabilityId);
  return {
    id: String(record._id || record.id),
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    capabilityId: record.capabilityId || '',
    publicName: def?.publicName || record.capabilityId || 'Unknown capability',
    status: record.status,
    trustStatus: record.trustStatus,
    scope: record.scope,
    evidenceRequired: def?.evidenceRequired === true,
    protectedTitleRequired: def?.protectedTitleRequired === true,
    requiredProtectedTitleId: def?.requiredProtectedTitleId || null,
    review: {
      decision: record.review?.decision || null,
      reasonCode: record.review?.reasonCode || null,
    },
    recordVersion: record.recordVersion,
    updatedAt: record.updatedAt,
    createdAt: record.createdAt,
  };
}

export async function claimProviderCapability({
  subjectType,
  subjectId,
  capabilityId,
  scope,
  actor,
} = {}) {
  const body = stripForbidden({ capabilityId, scope });
  const id = String(body.capabilityId || '').trim();
  if (!isKnownBusinessServicesCapability(id)) throw deny('unknown_capability_id', 400);
  if (!capabilityAllowsSubject(id, subjectType)) throw deny('gbs_subject_mismatch', 403);

  const def = getBusinessServicesCapability(id);
  const normalized = normalizeProviderScope({
    ...(body.scope || {}),
    flags: {
      registered_agent: id === 'registered_agent',
      registered_office: id === 'registered_office',
      ...(body.scope?.flags || {}),
      ...(id === 'registered_agent' ? { registered_agent: true } : {}),
      ...(id === 'registered_office' ? { registered_office: true } : {}),
    },
    protectedTitleIds: [
      ...(body.scope?.protectedTitleIds || []),
      ...(def.requiredProtectedTitleId ? [def.requiredProtectedTitleId] : []),
    ],
  });
  if (def.jurisdictionScoped && normalized.jurisdictionIds.length === 0) {
    throw deny('jurisdiction_scope_required', 400);
  }
  if (normalized.jurisdictionIds.length > GBS_PROVIDER_BOUNDS.JURISDICTION_IDS_MAX) {
    throw deny('jurisdiction_scope_too_large', 400);
  }

  const existing = await ProviderCapability.findOne({
    subjectType,
    subjectId: String(subjectId),
    capabilityId: id,
    status: { $ne: GRANT_STATUSES.REVOKED },
  });
  if (existing) {
    return { record: existing, created: false };
  }

  let record;
  try {
    record = await ProviderCapability.create({
      subjectType,
      subjectId: String(subjectId),
      capabilityId: id,
      status: GRANT_STATUSES.ACTIVE,
      trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED,
      scope: normalized,
      evidenceRefs: [],
      review: {},
      recordVersion: 0,
    });
  } catch (err) {
    if (err?.code === 11000) {
      const dup = await ProviderCapability.findOne({
        subjectType,
        subjectId: String(subjectId),
        capabilityId: id,
        status: { $ne: GRANT_STATUSES.REVOKED },
      });
      if (dup) return { record: dup, created: false };
    }
    throw err;
  }

  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_CLAIM_CREATED,
    targetType: 'ProviderCapability',
    targetId: String(record._id),
    metadata: redactAuditMetadata({
      subjectType,
      capabilityId: id,
      jurisdictionIds: normalized.jurisdictionIds,
    }),
  });
  return { record, created: true };
}

export async function updateClaimedCapabilityScope({
  id,
  subjectType,
  subjectId,
  expectedVersion,
  scope,
  actor,
} = {}) {
  const current = await ProviderCapability.findOne({
    _id: id,
    subjectType,
    subjectId: String(subjectId),
  });
  if (!current) throw deny('provider_capability_not_found', 404);
  if (
    current.trustStatus !== PROVIDER_TRUST_STATUSES.CLAIMED &&
    current.trustStatus !== PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED
  ) {
    throw deny('capability_scope_locked', 403);
  }
  const normalized = normalizeProviderScope(scope || {});
  const updated = await mutateProviderCapabilityRecord({
    id,
    expectedVersion,
    subjectType,
    subjectId,
    set: { scope: normalized },
    actor,
  });
  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_SCOPE_UPDATED,
    targetType: 'ProviderCapability',
    targetId: String(id),
    metadata: redactAuditMetadata({ subjectType, capabilityId: current.capabilityId }),
  });
  return updated;
}

export async function submitCapabilityEvidenceMetadata({
  id,
  subjectType,
  subjectId,
  expectedVersion,
  evidence,
  actor,
} = {}) {
  const parsed = validateEvidenceMetadataRow(evidence || {});
  if (!parsed.ok) {
    throw Object.assign(new Error(parsed.errors[0] || 'invalid_evidence'), {
      status: 400,
      code: 'invalid_evidence_metadata',
      errors: parsed.errors,
    });
  }
  const current = await ProviderCapability.findOne({
    _id: id,
    subjectType,
    subjectId: String(subjectId),
  });
  if (!current) throw deny('provider_capability_not_found', 404);
  const refs = [...(current.evidenceRefs || []), parsed.value].slice(0, GBS_PROVIDER_BOUNDS.EVIDENCE_ROWS_MAX);
  const updated = await mutateProviderCapabilityRecord({
    id,
    expectedVersion,
    subjectType,
    subjectId,
    set: {
      evidenceRefs: refs,
      trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED,
    },
    actor,
  });
  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_EVIDENCE_SUBMITTED,
    targetType: 'ProviderCapability',
    targetId: String(id),
    metadata: redactAuditMetadata({
      subjectType,
      capabilityId: current.capabilityId,
      evidenceType: parsed.value.evidenceType,
    }),
  });
  return updated;
}

export async function listSubjectCapabilities({ subjectType, subjectId } = {}) {
  return ProviderCapability.find({
    subjectType,
    subjectId: String(subjectId),
  })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
}
