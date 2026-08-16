/**
 * GBS filing-requirement pack runtime (Phase 17D-8B2B).
 *
 * Production Wyoming pack remains draft/draft and is never selected.
 * Tests may inject an ACTIVE+REVIEWED registry clone. No HTTP injection.
 */
import { AuditLog } from '../../models/AuditLog.js';
import { GbsCase } from '../../models/gbs/GbsCase.js';
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { GbsServiceRequest } from '../../models/gbs/GbsServiceRequest.js';
import { UserCapabilityGrant } from '../../models/capability/UserCapabilityGrant.js';
import { GBS_COMMAND_IDS } from '../../../../shared/gbs/constants.js';
import { GBS_CASE_BOUNDS, isCaseTerminal, isOpaqueCaseRef } from '../../../../shared/gbs/caseContract.js';
import { parseExpectedVersion } from '../../../../shared/gbs/case.js';
import {
  DERIVED_CHECK_KEYS,
  RA_CONSENT_KEY,
  buildCasePackSnapshot,
  derivedCheckStatus,
  evaluateRequirementPackReadiness,
  resolveRequirementPack,
  validateFactValue,
  whoMaySupply,
} from '../../../../shared/gbs/requirementPackContract.js';
import { productionRequirementPackRegistry } from '../../../../shared/gbs/requirementPackRegistry.js';
import {
  allowlistedProviderCheckInput,
  allowlistedRaConsentInput,
  allowlistedRequirementFactInput,
  emptyRequirementPackProjection,
  projectRequirementPackState,
} from '../../../../shared/gbs/requirementPack.js';
import { USER_CAPABILITY_IDS } from '../../../../shared/capability/userCapabilities.js';
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import { mutateGbsCaseRecord } from '../platform/optimisticConcurrency.js';
import {
  executeHighValueIdempotentCommand,
  fingerprintRequest,
  getMongoIdempotencyStore,
} from '../platform/idempotencyService.js';
import { IDEMPOTENCY_CODES } from '../../../../shared/platform/idempotency.js';

function deny(code, status = 400, errors) {
  const err = Object.assign(new Error(code), { status, code });
  if (errors) err.errors = errors;
  return err;
}

function notFound() {
  return deny('not_found', 404);
}

function subjectFilter(subject) {
  return {
    providerSubjectType: subject.subjectType,
    providerSubjectId: String(subject.subjectId),
  };
}

function commandKey(body, headerCommandId, fallback) {
  const raw = body?.commandId || body?.creationCommandId || headerCommandId || fallback;
  return String(raw || fallback).trim().slice(0, GBS_CASE_BOUNDS.COMMAND_ID_MAX);
}

function snapshotIdentityKey(snapshot) {
  if (!snapshot) return '';
  return `${snapshot.packId}::${snapshot.packVersion}::${snapshot.sourceSnapshotHash || ''}`;
}

export function resolveSelectableRequirementPack({
  capabilityId,
  jurisdictionId,
  entityTypeId,
  registry = productionRequirementPackRegistry,
  now = new Date(),
} = {}) {
  return resolveRequirementPack({
    capabilityId,
    jurisdictionId,
    entityTypeId,
    registry,
    now,
  });
}

export function snapshotFieldsForNewCase({
  quote,
  listing,
  registry = productionRequirementPackRegistry,
  now = new Date(),
} = {}) {
  const listingEntities = Array.isArray(listing?.entityTypeIds) ? listing.entityTypeIds : [];
  const entityTypeId = quote?.entityTypeId
    || (listingEntities.length === 1 ? listingEntities[0] : null);
  const pack = resolveSelectableRequirementPack({
    capabilityId: quote?.capabilityId,
    jurisdictionId: quote?.jurisdictionId,
    entityTypeId,
    registry,
    now,
  });
  if (!pack) return {};
  return {
    requirementPackSnapshot: buildCasePackSnapshot(pack),
    requirementFacts: [],
    requirementChecks: [],
    raConsentAttestation: {
      consentKey: RA_CONSENT_KEY,
      status: 'missing',
      recordVersion: 0,
    },
  };
}

async function logRequiredPackAudit(payload) {
  try {
    await AuditLog.create({
      actorId: payload.actor?.userId || payload.actor?.agentAccountId || payload.actor?._id,
      actorEmail: payload.actor?.email || '',
      actorRole: payload.actor?.role || '',
      action: payload.action,
      targetType: payload.targetType || 'GbsCase',
      targetId: payload.targetId ? String(payload.targetId) : '',
      status: payload.status || 'success',
      metadata: redactAuditMetadata(payload.metadata || {}),
    });
  } catch (err) {
    throw Object.assign(new Error('audit_unavailable'), {
      status: 503,
      code: 'audit_unavailable',
      causeCode: err?.code,
    });
  }
}

async function requireActiveBusinessClient(userId) {
  const grant = await UserCapabilityGrant.findOne({
    userId,
    capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
    status: GRANT_STATUSES.ACTIVE,
  }).lean();
  if (!grant) throw deny('business_client_required', 403);
}

async function loadOwnedCustomerCase(userId, caseRef) {
  if (!isOpaqueCaseRef(caseRef)) throw notFound();
  const record = await GbsCase.findOne({ publicCaseRef: caseRef, requesterUserId: userId });
  if (!record) throw notFound();
  return record;
}

async function loadExactProviderCase(subject, caseRef) {
  if (!isOpaqueCaseRef(caseRef)) throw notFound();
  const record = await GbsCase.findOne({ publicCaseRef: caseRef, ...subjectFilter(subject) });
  if (!record) throw notFound();
  return record;
}

async function assertProfessionalAuthority(record, env, now) {
  const { evaluateCaseProfessionalAuthority } = await import('./gbsCaseService.js');
  const listing = await GbsServiceListing.findById(record.listingId).lean();
  const request = await GbsServiceRequest.findById(record.serviceRequestId).lean();
  const gate = await evaluateCaseProfessionalAuthority({
    listing,
    storedRequest: request || {
      providerSubjectType: record.providerSubjectType,
      providerSubjectId: record.providerSubjectId,
      capabilityId: record.capabilityId,
    },
    env,
    now,
  });
  if (!gate.allowed) throw deny(gate.reason || 'authority_denied', 409);
}

async function professionalAuthorityAllowed(record, env, now) {
  try {
    await assertProfessionalAuthority(record, env, now);
    return true;
  } catch {
    return false;
  }
}

function requireSnapshot(record) {
  if (!record.requirementPackSnapshot) throw deny('no_active_requirement_pack', 409);
  return record.requirementPackSnapshot;
}

function factDef(snapshot, factKey) {
  return (snapshot.facts || []).find((row) => row.factKey === factKey) || null;
}

function nextFacts(record, factKey, nextRow) {
  const current = [...(record.requirementFacts || [])];
  const idx = current.findIndex((row) => row.factKey === factKey);
  if (idx >= 0) current[idx] = nextRow;
  else current.push(nextRow);
  return current;
}

function nextChecks(record, checkKey, nextRow) {
  const current = [...(record.requirementChecks || [])];
  const idx = current.findIndex((row) => row.checkKey === checkKey);
  if (idx >= 0) current[idx] = nextRow;
  else current.push(nextRow);
  return current;
}

function canonicalFactFingerprint(value) {
  return fingerprintRequest({ value });
}

export async function attachRequirementPackSnapshot({
  record,
  registry = productionRequirementPackRegistry,
  expectedVersion,
  actor = {},
  now = new Date(),
} = {}) {
  const listing = record.listingId
    ? await GbsServiceListing.findById(record.listingId).lean()
    : null;
  const listingEntities = Array.isArray(listing?.entityTypeIds) ? listing.entityTypeIds : [];
  const entityTypeId = record.entityTypeId
    || record.requirementPackSnapshot?.entityTypeId
    || (listingEntities.length === 1 ? listingEntities[0] : null);
  const pack = resolveSelectableRequirementPack({
    capabilityId: record.capabilityId,
    jurisdictionId: record.jurisdictionId,
    entityTypeId,
    registry,
    now,
  });
  if (!pack) return record;
  const snapshot = buildCasePackSnapshot(pack);
  const existing = record.requirementPackSnapshot;
  if (existing) {
    if (snapshotIdentityKey(existing) === snapshotIdentityKey(snapshot)) return record;
    throw deny('requirement_pack_upgrade_required', 409);
  }
  const expected = parseExpectedVersion(expectedVersion ?? record.recordVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  const updated = await GbsCase.findOneAndUpdate(
      {
        _id: record._id,
        recordVersion: expected,
        $or: [
          { requirementPackSnapshot: { $exists: false } },
          { requirementPackSnapshot: null },
        ],
      },
      {
        $set: {
          requirementPackSnapshot: snapshot,
          requirementFacts: record.requirementFacts || [],
          requirementChecks: record.requirementChecks || [],
          raConsentAttestation: record.raConsentAttestation || {
            consentKey: RA_CONSENT_KEY,
            status: 'missing',
            recordVersion: 0,
          },
        },
        $inc: { recordVersion: 1 },
      },
      { new: true }
    );
    if (updated) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.GBS_CASE_REQUIREMENT_PACK_ATTACHED,
        targetType: 'GbsCase',
        targetId: String(updated._id),
        metadata: redactAuditMetadata({
          publicCaseRef: updated.publicCaseRef,
          packId: snapshot.packId,
          packVersion: snapshot.packVersion,
          sourceSetId: snapshot.sourceSetId,
        }),
      });
      return updated;
    }
  const current = await GbsCase.findById(record._id);
  if (!current) throw notFound();
  if (current.requirementPackSnapshot
    && snapshotIdentityKey(current.requirementPackSnapshot) === snapshotIdentityKey(snapshot)) {
    return current;
  }
  if (current.requirementPackSnapshot) throw deny('requirement_pack_upgrade_required', 409);
  throw Object.assign(new Error('optimistic_concurrency_conflict'), {
    status: 409,
    code: 'optimistic_concurrency_conflict',
    currentVersion: current.recordVersion,
    expectedVersion: expected,
  });
}

export async function projectCustomerRequirementPack(record, { env, now } = {}) {
  if (!record?.requirementPackSnapshot) return emptyRequirementPackProjection();
  const allowed = await professionalAuthorityAllowed(record, env, now);
  return projectRequirementPackState(record, { lane: 'customer', professionalAuthorityAllowed: allowed });
}

export async function projectProviderRequirementPack(record, { env, now } = {}) {
  if (!record?.requirementPackSnapshot) return emptyRequirementPackProjection();
  const allowed = await professionalAuthorityAllowed(record, env, now);
  return projectRequirementPackState(record, { lane: 'provider', professionalAuthorityAllowed: allowed });
}

export function evaluateAttachedPackReadiness(record, { professionalAuthorityAllowed = true } = {}) {
  if (!record?.requirementPackSnapshot) {
    return { attached: false, ready: true, reasons: [], b2bRequirementsReady: false, authorizedForExternalFiling: false };
  }
  return evaluateRequirementPackReadiness({
    snapshot: record.requirementPackSnapshot,
    facts: record.requirementFacts || [],
    checks: record.requirementChecks || [],
    raConsent: record.raConsentAttestation,
    professionalAuthorityAllowed,
  });
}

async function runFactMutation({
  record,
  lane,
  actor,
  expected,
  body,
  headerCommandId,
  principalId,
  tenantId,
  extraOwnership,
}) {
  if (isCaseTerminal(record.status)) throw deny('invalid_status_transition', 409);
  const snapshot = requireSnapshot(record);
  const parsed = allowlistedRequirementFactInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const def = factDef(snapshot, parsed.value.factKey);
  if (!def) throw deny('unknown_fact_key', 400);
  if (!whoMaySupply(def, lane)) throw deny('fact_lane_denied', 403);
  const validated = validateFactValue(def, parsed.value.rawValue);
  if (!validated.ok) throw deny(validated.error, 400);
  const existing = (record.requirementFacts || []).find((row) => row.factKey === def.factKey);
  if (existing?.suppliedByLane === 'customer' && lane === 'provider') {
    /* Provider may update mixed-lane values but cannot rewrite customer provenance. */
  }
  const suppliedByLane = existing?.suppliedByLane === 'customer' && lane === 'provider'
    ? 'customer'
    : lane;
  const nextRow = {
    factKey: def.factKey,
    value: validated.value,
    suppliedByLane,
    actorType: lane,
    actorUserId: actor.userId || null,
    actorProviderSubjectType: extraOwnership.providerSubjectType || null,
    actorProviderSubjectId: extraOwnership.providerSubjectId || null,
    definitionVersion: def.definitionVersion || 1,
    recordVersion: (existing?.recordVersion || 0) + 1,
    updatedAt: new Date(),
  };
  if (lane === 'customer') {
    nextRow.actorProviderSubjectType = null;
    nextRow.actorProviderSubjectId = null;
  }
  if (suppliedByLane === 'customer' && lane === 'provider') {
    nextRow.actorUserId = existing.actorUserId || null;
    nextRow.actorProviderSubjectType = extraOwnership.providerSubjectType;
    nextRow.actorProviderSubjectId = extraOwnership.providerSubjectId;
  }
  const commandId = commandKey(body, headerCommandId, `${record.publicCaseRef}:fact:${def.factKey}:${expected}`);
  const store = getMongoIdempotencyStore();
  let performed = false;
  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId,
      tenantId,
      commandType: GBS_COMMAND_IDS.CASE_REQUIREMENT_FACT_UPDATE,
      idempotencyKey: commandId,
      fingerprint: fingerprintRequest({
        command: GBS_COMMAND_IDS.CASE_REQUIREMENT_FACT_UPDATE,
        caseRef: record.publicCaseRef,
        factKey: def.factKey,
        expectedVersion: expected,
        valueFingerprint: canonicalFactFingerprint(validated.value),
      }),
      perform: async () => {
        const updatedRow = await mutateGbsCaseRecord({
          id: record._id,
          expectedVersion: expected,
          ownershipFilter: extraOwnership.requesterUserId
            ? { requesterUserId: extraOwnership.requesterUserId }
            : subjectFilter({
              subjectType: extraOwnership.providerSubjectType,
              subjectId: extraOwnership.providerSubjectId,
            }),
          set: { requirementFacts: nextFacts(record, def.factKey, nextRow) },
          actor,
        });
        performed = true;
        return { caseId: String(updatedRow._id) };
      },
    });
    const updated = await GbsCase.findById(result.result?.caseId || record._id);
    if (performed && !result.replay) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.GBS_CASE_REQUIREMENT_FACT_UPDATED,
        targetType: 'GbsCase',
        targetId: String(updated._id),
        metadata: redactAuditMetadata({
          publicCaseRef: updated.publicCaseRef,
          packId: snapshot.packId,
          packVersion: snapshot.packVersion,
          factKey: def.factKey,
          lane,
        }),
      });
    }
    return updated;
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    throw err;
  }
}

export async function updateCustomerRequirementFact({
  userId,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
} = {}) {
  await requireActiveBusinessClient(userId);
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  const record = await loadOwnedCustomerCase(userId, caseRef);
  return runFactMutation({
    record,
    lane: 'customer',
    actor,
    expected,
    body,
    headerCommandId,
    principalId: String(userId),
    tenantId: `user:${userId}`,
    extraOwnership: { requesterUserId: record.requesterUserId },
  });
}

export async function updateProviderRequirementFact({
  subject,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  const record = await loadExactProviderCase(subject, caseRef);
  await assertProfessionalAuthority(record, env, now);
  return runFactMutation({
    record,
    lane: 'provider',
    actor,
    expected,
    body,
    headerCommandId,
    principalId: String(actor.agentAccountId || subject.subjectId),
    tenantId: `${subject.subjectType}:${subject.subjectId}`,
    extraOwnership: {
      providerSubjectType: record.providerSubjectType,
      providerSubjectId: record.providerSubjectId,
    },
  });
}

export async function updateProviderRequirementCheck({
  subject,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  const record = await loadExactProviderCase(subject, caseRef);
  if (isCaseTerminal(record.status)) throw deny('invalid_status_transition', 409);
  await assertProfessionalAuthority(record, env, now);
  const snapshot = requireSnapshot(record);
  const parsed = allowlistedProviderCheckInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  if (DERIVED_CHECK_KEYS.includes(parsed.value.checkKey)) throw deny('check_is_derived', 409);
  const def = (snapshot.providerChecks || []).find((row) => row.checkKey === parsed.value.checkKey);
  if (!def) throw deny('unknown_check_key', 400);
  const existing = (record.requirementChecks || []).find((row) => row.checkKey === def.checkKey);
  const nextRow = {
    checkKey: def.checkKey,
    status: 'attested',
    selectedMethod: parsed.value.selectedMethod || null,
    attestedByLane: 'provider',
    attestedByProviderSubjectType: record.providerSubjectType,
    attestedByProviderSubjectId: String(record.providerSubjectId),
    attestedAt: now,
    definitionVersion: def.definitionVersion || 1,
    packVersion: snapshot.packVersion,
    recordVersion: (existing?.recordVersion || 0) + 1,
  };
  const commandId = commandKey(body, headerCommandId, `${record.publicCaseRef}:check:${def.checkKey}:${expected}`);
  const store = getMongoIdempotencyStore();
  let performed = false;
  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId: String(actor.agentAccountId || subject.subjectId),
      tenantId: `${subject.subjectType}:${subject.subjectId}`,
      commandType: GBS_COMMAND_IDS.CASE_REQUIREMENT_PROVIDER_CHECK_UPDATE,
      idempotencyKey: commandId,
      fingerprint: fingerprintRequest({
        command: GBS_COMMAND_IDS.CASE_REQUIREMENT_PROVIDER_CHECK_UPDATE,
        caseRef: record.publicCaseRef,
        checkKey: def.checkKey,
        expectedVersion: expected,
        selectedMethod: parsed.value.selectedMethod || null,
      }),
      perform: async () => {
        const updatedRow = await mutateGbsCaseRecord({
          id: record._id,
          expectedVersion: expected,
          ownershipFilter: subjectFilter(subject),
          set: { requirementChecks: nextChecks(record, def.checkKey, nextRow) },
          actor,
        });
        performed = true;
        return { caseId: String(updatedRow._id) };
      },
    });
    const updated = await GbsCase.findById(result.result?.caseId || record._id);
    if (performed && !result.replay) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.GBS_CASE_REQUIREMENT_CHECK_UPDATED,
        targetType: 'GbsCase',
        targetId: String(updated._id),
        metadata: redactAuditMetadata({
          publicCaseRef: updated.publicCaseRef,
          packId: snapshot.packId,
          packVersion: snapshot.packVersion,
          checkKey: def.checkKey,
          providerSubjectType: record.providerSubjectType,
          providerSubjectId: String(record.providerSubjectId),
        }),
      });
    }
    return updated;
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    throw err;
  }
}

export async function attestProviderRaConsent({
  subject,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  const record = await loadExactProviderCase(subject, caseRef);
  if (isCaseTerminal(record.status)) throw deny('invalid_status_transition', 409);
  await assertProfessionalAuthority(record, env, now);
  const snapshot = requireSnapshot(record);
  const parsed = allowlistedRaConsentInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const consentDef = (snapshot.consents || []).find((row) => row.consentKey === RA_CONSENT_KEY);
  if (!consentDef || consentDef.waivable === true) throw deny('ra_consent_not_attestable', 409);
  const previous = record.raConsentAttestation || { status: 'missing', consentKey: RA_CONSENT_KEY, recordVersion: 0 };
  const nextAttestation = {
    consentKey: RA_CONSENT_KEY,
    status: 'attested',
    attestedByProviderSubjectType: record.providerSubjectType,
    attestedByProviderSubjectId: String(record.providerSubjectId),
    attestedAt: now,
    packVersion: snapshot.packVersion,
    requirementVersion: consentDef.definitionVersion || 1,
    recordVersion: (previous.recordVersion || 0) + 1,
  };
  const commandId = commandKey(body, headerCommandId, `${record.publicCaseRef}:ra-consent:${expected}`);
  const store = getMongoIdempotencyStore();
  let performed = false;
  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId: String(actor.agentAccountId || subject.subjectId),
      tenantId: `${subject.subjectType}:${subject.subjectId}`,
      commandType: GBS_COMMAND_IDS.CASE_RA_CONSENT_ATTEST,
      idempotencyKey: commandId,
      fingerprint: fingerprintRequest({
        command: GBS_COMMAND_IDS.CASE_RA_CONSENT_ATTEST,
        caseRef: record.publicCaseRef,
        expectedVersion: expected,
        attested: true,
      }),
      perform: async () => {
        const updatedRow = await mutateGbsCaseRecord({
          id: record._id,
          expectedVersion: expected,
          ownershipFilter: subjectFilter(subject),
          set: { raConsentAttestation: nextAttestation },
          actor,
        });
        performed = true;
        return { caseId: String(updatedRow._id) };
      },
    });
    const updated = await GbsCase.findById(result.result?.caseId || record._id);
    if (performed && !result.replay) {
      try {
        await logRequiredPackAudit({
          actor,
          action: GBS_AUDIT_EVENTS.GBS_CASE_RA_CONSENT_ATTESTED,
          targetId: String(updated._id),
          metadata: {
            publicCaseRef: updated.publicCaseRef,
            packId: snapshot.packId,
            packVersion: snapshot.packVersion,
            consentKey: RA_CONSENT_KEY,
            providerSubjectType: record.providerSubjectType,
            providerSubjectId: String(record.providerSubjectId),
            result: 'attested',
          },
        });
      } catch (auditErr) {
        await GbsCase.updateOne(
          { _id: updated._id, 'raConsentAttestation.recordVersion': nextAttestation.recordVersion },
          { $set: { raConsentAttestation: previous } }
        );
        throw auditErr;
      }
    }
    return updated;
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    throw err;
  }
}

export { derivedCheckStatus };
