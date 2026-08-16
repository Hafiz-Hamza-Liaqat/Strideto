/**
 * High-assurance Case filing authorization (Phase 17D-9A).
 *
 * Production grant remains unavailable: Wyoming pack is draft and production
 * legal text is unapproved. Flags may disable only; they cannot activate a
 * pack or approve legal text.
 */
import { AuditLog } from '../../models/AuditLog.js';
import { GbsCase } from '../../models/gbs/GbsCase.js';
import { GbsCaseFilingAuthorization } from '../../models/gbs/GbsCaseFilingAuthorization.js';
import { GbsExternalFilingSubmission } from '../../models/gbs/GbsExternalFilingSubmission.js';
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { GbsServiceRequest } from '../../models/gbs/GbsServiceRequest.js';
import { UserCapabilityGrant } from '../../models/capability/UserCapabilityGrant.js';
import { GBS_COMMAND_IDS } from '../../../../shared/gbs/constants.js';
import { GBS_CASE_BOUNDS, isCaseTerminal, isOpaqueCaseRef } from '../../../../shared/gbs/caseContract.js';
import { parseExpectedVersion } from '../../../../shared/gbs/case.js';
import {
  FILING_AUTHORIZATION_ERROR_CODES,
  FILING_AUTHORIZATION_PURPOSE,
  FILING_AUTHORIZATION_SCOPE_KIND,
  FILING_AUTHORIZATION_STATUSES,
  FILING_AUTHORIZATION_UNAVAILABLE_REASONS as R,
  GBS_FILING_AUTHORIZATION_SCHEMA_VERSION,
  isFilingAuthorizationRevocableStatus,
  isGbsExternalFilingAttestationEnabled,
  isGbsFilingAuthorizationEnabled,
  isGbsWyomingFormationEnabled,
} from '../../../../shared/gbs/filingAuthorizationContract.js';
import {
  allowlistedFilingAuthorizationGrantInput,
  allowlistedFilingAuthorizationRevokeInput,
  customerUnavailableCopy,
  emptyFilingAuthorizationProjection,
} from '../../../../shared/gbs/filingAuthorization.js';
import { EXTERNAL_SUBMISSION_STATE } from '../../../../shared/gbs/externalFilingContract.js';
import {
  isGrantedLegalTextEffectiveForFutureUse,
  productionLegalTextRegistry,
  resolveEligibleLegalText,
} from '../../../../shared/gbs/filingAuthorizationLegalText.js';
import {
  REQUIREMENT_PACK_ACTIVATION,
  REQUIREMENT_PACK_IDS,
  resolveRequirementPack,
} from '../../../../shared/gbs/requirementPackContract.js';
import { CATALOG_REVIEW_STATUSES } from '../../../../shared/gbs/catalogConstants.js';
import { productionRequirementPackRegistry } from '../../../../shared/gbs/requirementPackRegistry.js';
import { USER_CAPABILITY_IDS } from '../../../../shared/capability/userCapabilities.js';
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { OPTIMISTIC_CONCURRENCY_CODE } from '../../../../shared/platform/optimisticConcurrency.js';
import {
  executeHighValueIdempotentCommand,
  fingerprintRequest,
  getMongoIdempotencyStore,
} from '../platform/idempotencyService.js';
import { IDEMPOTENCY_CODES } from '../../../../shared/platform/idempotency.js';
import { evaluateAttachedPackReadiness } from './gbsRequirementPackService.js';
import {
  generateClaimRef,
  generatePublicAuthorizationRef,
} from '../../utils/gbsFilingRef.js';

function deny(code, status = 400, extra = {}) {
  const err = Object.assign(new Error(code), { status, code, ...extra });
  return err;
}

function notFound() {
  return deny('not_found', 404);
}

function isMongoDuplicateKey(err) {
  return Number(err?.code) === 11000 || err?.codeName === 'DuplicateKey';
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

async function logRequiredAuthAudit(payload) {
  try {
    await AuditLog.create({
      actorId: payload.actor?.userId || payload.actor?.agentAccountId || payload.actor?._id,
      actorEmail: payload.actor?.email || '',
      actorRole: payload.actor?.role || '',
      action: payload.action,
      targetType: payload.targetType || 'GbsCaseFilingAuthorization',
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

async function hasActiveBusinessClient(userId) {
  const grant = await UserCapabilityGrant.findOne({
    userId,
    capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
    status: GRANT_STATUSES.ACTIVE,
  }).lean();
  return Boolean(grant);
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

async function professionalAuthorityAllowed(record, env, now) {
  try {
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
    return gate.allowed === true;
  } catch {
    return false;
  }
}

function snapshotOf(record) {
  return record?.requirementPackSnapshot || null;
}

function authorizationMatchesCase(auth, record) {
  const snap = snapshotOf(record);
  if (!auth || !record || !snap) return false;
  return String(auth.caseId) === String(record._id)
    && String(auth.customerUserId) === String(record.requesterUserId)
    && auth.providerSubjectType === record.providerSubjectType
    && String(auth.providerSubjectId) === String(record.providerSubjectId)
    && auth.packId === snap.packId
    && Number(auth.packVersion) === Number(snap.packVersion)
    && auth.sourceSetId === snap.sourceSetId
    && auth.sourceSnapshotHash === snap.sourceSnapshotHash
    && auth.capabilityId === record.capabilityId
    && auth.jurisdictionId === record.jurisdictionId;
}

function isExpired(auth, now) {
  if (!auth?.expiresAt) return false;
  return new Date(auth.expiresAt).getTime() <= new Date(now).getTime();
}

function mismatchReason(auth, record) {
  const snap = snapshotOf(record);
  if (!snap) return R.REQUIREMENT_PACK_NOT_ATTACHED;
  if (auth.providerSubjectType !== record.providerSubjectType
    || String(auth.providerSubjectId) !== String(record.providerSubjectId)) {
    return FILING_AUTHORIZATION_STATUSES.INVALIDATED;
  }
  if (Number(auth.packVersion) !== Number(snap.packVersion) || auth.packId !== snap.packId) {
    return 'pack_version_changed';
  }
  if (auth.sourceSnapshotHash !== snap.sourceSnapshotHash) return 'source_snapshot_changed';
  return null;
}

export async function resolveCaseFilingAuthorizationAvailability({
  record,
  userId = null,
  requireOwner = false,
  env = process.env,
  now = new Date(),
  registry = productionRequirementPackRegistry,
  legalTextRegistry = productionLegalTextRegistry,
} = {}) {
  if (!record) {
    return { available: false, reason: 'not_found', canGrant: false, eligibleLegalText: null, packSelectable: false };
  }
  if (requireOwner && userId && String(record.requesterUserId) !== String(userId)) {
    return { available: false, reason: 'not_found', canGrant: false, eligibleLegalText: null, packSelectable: false };
  }
  if (isCaseTerminal(record.status)) {
    return { available: false, reason: R.CASE_TERMINAL, canGrant: false, eligibleLegalText: null, packSelectable: false };
  }
  if (!record.providerSubjectType || !record.providerSubjectId) {
    return { available: false, reason: R.PROVIDER_NOT_ATTACHED, canGrant: false, eligibleLegalText: null, packSelectable: false };
  }

  const listing = record.listingId ? await GbsServiceListing.findById(record.listingId).lean() : null;
  const listingEntities = Array.isArray(listing?.entityTypeIds) ? listing.entityTypeIds : [];
  const entityTypeId = record.entityTypeId
    || record.requirementPackSnapshot?.entityTypeId
    || (listingEntities.length === 1 ? listingEntities[0] : null);
  const selectable = resolveRequirementPack({
    capabilityId: record.capabilityId,
    jurisdictionId: record.jurisdictionId,
    entityTypeId,
    registry,
    now,
  });
  if (!selectable) {
    return {
      available: false,
      reason: R.REQUIREMENT_PACK_NOT_ACTIVE,
      canGrant: false,
      eligibleLegalText: null,
      packSelectable: false,
    };
  }
  if (selectable.activationStatus !== REQUIREMENT_PACK_ACTIVATION.ACTIVE) {
    return { available: false, reason: R.REQUIREMENT_PACK_NOT_ACTIVE, canGrant: false, eligibleLegalText: null, packSelectable: false };
  }
  if (selectable.reviewStatus !== CATALOG_REVIEW_STATUSES.REVIEWED) {
    return { available: false, reason: R.REQUIREMENT_PACK_NOT_REVIEWED, canGrant: false, eligibleLegalText: null, packSelectable: false };
  }
  if (selectable.packId === REQUIREMENT_PACK_IDS.US_WY_LLC && !isGbsWyomingFormationEnabled(env)) {
    return {
      available: false,
      reason: R.WYOMING_PRODUCT_DISABLED,
      canGrant: false,
      eligibleLegalText: null,
      packSelectable: true,
    };
  }
  const snap = snapshotOf(record);
  if (!snap) {
    return { available: false, reason: R.REQUIREMENT_PACK_NOT_ATTACHED, canGrant: false, eligibleLegalText: null, packSelectable: true };
  }
  if (snap.packId !== selectable.packId || Number(snap.packVersion) !== Number(selectable.packVersion)
    || snap.sourceSnapshotHash !== selectable.sourceSnapshotHash) {
    return { available: false, reason: R.REQUIREMENT_PACK_NOT_ACTIVE, canGrant: false, eligibleLegalText: null, packSelectable: true };
  }

  const legalText = resolveEligibleLegalText({
    capabilityId: record.capabilityId,
    jurisdictionId: record.jurisdictionId,
    entityTypeId: record.entityTypeId || snap.entityTypeId,
    purpose: FILING_AUTHORIZATION_PURPOSE.INITIAL_FORMATION,
    registry: legalTextRegistry,
    now,
  });
  if (!legalText) {
    return { available: false, reason: R.LEGAL_TEXT_NOT_APPROVED, canGrant: false, eligibleLegalText: null, packSelectable: true };
  }

  if (!isGbsFilingAuthorizationEnabled(env)) {
    return { available: false, reason: R.FEATURE_DISABLED, canGrant: false, eligibleLegalText: null, packSelectable: true };
  }

  const providerOk = await professionalAuthorityAllowed(record, env, now);
  if (!providerOk) {
    return { available: false, reason: R.PROVIDER_AUTHORITY_LOST, canGrant: false, eligibleLegalText: legalText, packSelectable: true };
  }

  const conflicting = await GbsCaseFilingAuthorization.findOne({
    caseId: record._id,
    providerSubjectType: record.providerSubjectType,
    providerSubjectId: String(record.providerSubjectId),
    packId: snap.packId,
    packVersion: snap.packVersion,
    sourceSnapshotHash: snap.sourceSnapshotHash,
    purpose: FILING_AUTHORIZATION_PURPOSE.INITIAL_FORMATION,
    status: { $in: [
      FILING_AUTHORIZATION_STATUSES.ACTIVE,
      FILING_AUTHORIZATION_STATUSES.CLAIMED_FOR_SUBMISSION,
      FILING_AUTHORIZATION_STATUSES.USED,
    ] },
  }).lean();
  if (conflicting) {
    return {
      available: false,
      reason: R.CONFLICTING_AUTHORIZATION,
      canGrant: false,
      eligibleLegalText: legalText,
      packSelectable: true,
      conflicting,
    };
  }

  const clientOk = userId ? await hasActiveBusinessClient(userId) : false;
  if (userId && !clientOk) {
    return {
      available: false,
      reason: R.BUSINESS_CLIENT_REQUIRED,
      canGrant: false,
      eligibleLegalText: legalText,
      packSelectable: true,
    };
  }

  return {
    available: true,
    reason: null,
    canGrant: Boolean(userId && clientOk),
    eligibleLegalText: legalText,
    packSelectable: true,
  };
}

function projectLegalText(entry) {
  if (!entry) return null;
  return {
    legalTextId: entry.legalTextId,
    legalTextVersion: entry.legalTextVersion,
    legalTextHash: entry.legalTextHash,
    paragraphs: [...(entry.paragraphs || [])],
    testOnly: entry.testOnly === true,
  };
}

function projectAuthorizationRow(row) {
  if (!row) return null;
  return {
    publicAuthorizationRef: row.publicAuthorizationRef,
    status: row.status,
    purpose: row.purpose,
    packId: row.packId,
    packVersion: row.packVersion,
    sourceSetId: row.sourceSetId,
    legalTextId: row.legalTextId,
    legalTextVersion: row.legalTextVersion,
    legalTextHash: row.legalTextHash,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
    invalidatedAt: row.invalidatedAt,
    invalidationReasonCode: row.invalidationReasonCode,
    claimedAt: row.claimedAt,
    usedAt: row.usedAt,
    expiresAt: row.expiresAt,
    recordVersion: row.recordVersion,
    providerDisplayNameSnapshot: row.providerDisplayNameSnapshot || '',
  };
}

async function loadHistory(caseId, limit = 20) {
  const rows = await GbsCaseFilingAuthorization.find({ caseId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((row) => ({
    publicAuthorizationRef: row.publicAuthorizationRef,
    status: row.status,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
    invalidatedAt: row.invalidatedAt,
    invalidationReasonCode: row.invalidationReasonCode,
    claimedAt: row.claimedAt,
    usedAt: row.usedAt,
  }));
}

export async function deriveFilingReadiness({
  record,
  env = process.env,
  now = new Date(),
  authorization = null,
  submission = null,
  legalTextRegistry = productionLegalTextRegistry,
} = {}) {
  const snap = snapshotOf(record);
  const providerOk = await professionalAuthorityAllowed(record, env, now);
  const packReady = evaluateAttachedPackReadiness(record, { professionalAuthorityAllowed: providerOk });
  const requirementsReady = packReady.b2bRequirementsReady === true;
  const auth = authorization || await GbsCaseFilingAuthorization.findOne({
    caseId: record._id,
    status: { $in: [
      FILING_AUTHORIZATION_STATUSES.ACTIVE,
      FILING_AUTHORIZATION_STATUSES.CLAIMED_FOR_SUBMISSION,
      FILING_AUTHORIZATION_STATUSES.USED,
      FILING_AUTHORIZATION_STATUSES.REVOKED,
      FILING_AUTHORIZATION_STATUSES.INVALIDATED,
    ] },
  }).sort({ createdAt: -1 }).lean();
  const sub = submission || (auth ? await GbsExternalFilingSubmission.findOne({ authorizationId: auth._id }).lean() : null);

  let externalSubmissionState = EXTERNAL_SUBMISSION_STATE.NONE;
  if (sub?.submissionStatus === 'submitted_externally') {
    externalSubmissionState = EXTERNAL_SUBMISSION_STATE.SUBMITTED_EXTERNALLY;
  } else if (auth?.status === FILING_AUTHORIZATION_STATUSES.CLAIMED_FOR_SUBMISSION) {
    externalSubmissionState = EXTERNAL_SUBMISSION_STATE.AUTHORIZATION_CLAIMED;
  }

  const matches = auth && authorizationMatchesCase(auth, record);
  const active = auth?.status === FILING_AUTHORIZATION_STATUSES.ACTIVE;
  const claimed = auth?.status === FILING_AUTHORIZATION_STATUSES.CLAIMED_FOR_SUBMISSION;
  const expired = isExpired(auth, now);
  const grantedTextStillApproved = !active || isGrantedLegalTextEffectiveForFutureUse(auth, legalTextRegistry);
  const productEnabled = isGbsWyomingFormationEnabled(env);
  const filingEnabled = isGbsFilingAuthorizationEnabled(env);
  const authorizedForExternalFiling = Boolean(
    requirementsReady
    && providerOk
    && productEnabled
    && filingEnabled
    && !isCaseTerminal(record.status)
    && active
    && matches
    && !expired
    && grantedTextStillApproved
    && snap
  );
  const externalSubmissionEligible = Boolean(
    requirementsReady
    && providerOk
    && productEnabled
    && filingEnabled
    && !isCaseTerminal(record.status)
    && matches
    && !expired
    && grantedTextStillApproved
    && snap
    && !sub
    && (active || claimed)
    && isGbsExternalFilingAttestationEnabled(env)
  );

  return {
    requirementsReady,
    filingAuthorizationActive: active && matches && !expired,
    authorizedForExternalFiling,
    externalSubmissionEligible,
    externalSubmissionState,
    providerAuthorityAllowed: providerOk,
    authorization: auth,
    submission: sub,
  };
}

export async function getCustomerFilingAuthorization({
  userId,
  caseRef,
  env = process.env,
  now = new Date(),
  registry = productionRequirementPackRegistry,
  legalTextRegistry = productionLegalTextRegistry,
} = {}) {
  const record = await loadOwnedCustomerCase(userId, caseRef);
  const availability = await resolveCaseFilingAuthorizationAvailability({
    record,
    userId,
    requireOwner: true,
    env,
    now,
    registry,
    legalTextRegistry,
  });
  const derived = await deriveFilingReadiness({
    record,
    env,
    now,
    authorization: availability.conflicting || null,
    legalTextRegistry,
  });
  const current = derived.authorization && String(derived.authorization.customerUserId) === String(userId)
    ? derived.authorization
    : null;
  const canRevoke = Boolean(
    current
    && isFilingAuthorizationRevocableStatus(current.status)
    && String(record.requesterUserId) === String(userId)
    && !isExpired(current, now)
  );
  const history = await loadHistory(record._id);
  const projection = emptyFilingAuthorizationProjection();
  return {
    ...projection,
    available: availability.available === true,
    reason: availability.reason,
    message: availability.available ? '' : customerUnavailableCopy(availability.reason),
    canGrant: availability.canGrant === true,
    canRevoke,
    requirementsReady: derived.requirementsReady,
    filingAuthorizationActive: derived.filingAuthorizationActive,
    authorizedForExternalFiling: derived.authorizedForExternalFiling,
    externalSubmissionEligible: derived.externalSubmissionEligible,
    externalSubmissionState: derived.externalSubmissionState,
    current: projectAuthorizationRow(current),
    eligibleLegalText: availability.available ? projectLegalText(availability.eligibleLegalText) : null,
    history,
    providerDisplayName: record.providerDisplayNameSnapshot || '',
    casePublicRef: record.publicCaseRef,
    jurisdictionId: record.jurisdictionId,
    entityTypeId: record.entityTypeId,
    capabilityId: record.capabilityId,
    packId: snapshotOf(record)?.packId || null,
    packVersion: snapshotOf(record)?.packVersion || null,
    recordVersion: record.recordVersion,
  };
}

export async function getProviderFilingAuthorization({
  subject,
  caseRef,
  env = process.env,
  now = new Date(),
  legalTextRegistry = productionLegalTextRegistry,
} = {}) {
  const record = await loadExactProviderCase(subject, caseRef);
  const derived = await deriveFilingReadiness({ record, env, now, legalTextRegistry });
  const current = derived.authorization;
  const matchesProvider = current
    && current.providerSubjectType === subject.subjectType
    && String(current.providerSubjectId) === String(subject.subjectId);
  return {
    available: false,
    canGrant: false,
    canRevoke: false,
    canAttest: derived.externalSubmissionEligible === true,
    requirementsReady: derived.requirementsReady,
    filingAuthorizationActive: derived.filingAuthorizationActive,
    authorizedForExternalFiling: derived.authorizedForExternalFiling,
    externalSubmissionEligible: derived.externalSubmissionEligible,
    externalSubmissionState: derived.externalSubmissionState,
    current: matchesProvider ? projectAuthorizationRow(current) : null,
    statusLabel: providerStatusLabel(derived, matchesProvider ? current : null),
    submission: derived.submission ? {
      publicSubmissionRef: derived.submission.publicSubmissionRef,
      submissionStatus: derived.submission.submissionStatus,
      filingMethod: derived.submission.filingMethod,
      providerAttestedAt: derived.submission.providerAttestedAt,
      externalSubmittedAt: derived.submission.externalSubmittedAt,
    } : null,
    providerDisplayName: record.providerDisplayNameSnapshot || '',
    casePublicRef: record.publicCaseRef,
    recordVersion: record.recordVersion,
    history: matchesProvider ? await loadHistory(record._id) : [],
  };
}

function providerStatusLabel(derived, current) {
  if (derived.externalSubmissionState === EXTERNAL_SUBMISSION_STATE.SUBMITTED_EXTERNALLY) {
    return 'Submitted externally — Provider attested';
  }
  if (derived.externalSubmissionState === EXTERNAL_SUBMISSION_STATE.AUTHORIZATION_CLAIMED) {
    return 'Claimed for submission';
  }
  if (!current) return 'Not authorized';
  if (current.status === FILING_AUTHORIZATION_STATUSES.REVOKED) return 'Revoked';
  if (current.status === FILING_AUTHORIZATION_STATUSES.INVALIDATED) return 'Invalidated';
  if (current.status === FILING_AUTHORIZATION_STATUSES.ACTIVE && derived.filingAuthorizationActive) {
    return 'Authorized';
  }
  if (current.status === FILING_AUTHORIZATION_STATUSES.ACTIVE) return 'Authorized (not currently usable)';
  return current.status;
}

export async function grantCustomerFilingAuthorization({
  userId,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
  registry = productionRequirementPackRegistry,
  legalTextRegistry = productionLegalTextRegistry,
} = {}) {
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  const parsed = allowlistedFilingAuthorizationGrantInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const record = await loadOwnedCustomerCase(userId, caseRef);
  if (Number(record.recordVersion) !== expected) {
    throw Object.assign(new Error('Conflict'), {
      status: 409,
      code: OPTIMISTIC_CONCURRENCY_CODE,
      currentVersion: record.recordVersion,
      expectedVersion: expected,
    });
  }
  const snap = snapshotOf(record);
  const commandId = commandKey(body, headerCommandId, `${record.publicCaseRef}:filing-auth-grant:${expected}`);
  const fingerprint = fingerprintRequest({
    command: GBS_COMMAND_IDS.CASE_FILING_AUTHORIZATION_GRANT,
    caseRef: record.publicCaseRef,
    legalTextId: parsed.value.legalTextId,
    legalTextVersion: parsed.value.legalTextVersion,
    legalTextHash: parsed.value.legalTextHash,
    packId: snap?.packId || null,
    packVersion: snap?.packVersion || null,
    sourceSnapshotHash: snap?.sourceSnapshotHash || null,
    expectedVersion: expected,
  });
  const store = getMongoIdempotencyStore();
  let createdId = null;
  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId: String(userId),
      tenantId: `user:${userId}`,
      commandType: GBS_COMMAND_IDS.CASE_FILING_AUTHORIZATION_GRANT,
      idempotencyKey: commandId,
      fingerprint,
      perform: async () => {
        const availability = await resolveCaseFilingAuthorizationAvailability({
          record,
          userId,
          requireOwner: true,
          env,
          now,
          registry,
          legalTextRegistry,
        });
        if (!availability.available || !availability.canGrant) {
          throw deny(availability.reason || FILING_AUTHORIZATION_ERROR_CODES.NOT_AVAILABLE, 409);
        }
        const legal = availability.eligibleLegalText;
        if (
          parsed.value.legalTextId !== legal.legalTextId
          || Number(parsed.value.legalTextVersion) !== Number(legal.legalTextVersion)
          || parsed.value.legalTextHash !== legal.legalTextHash
        ) {
          throw deny(FILING_AUTHORIZATION_ERROR_CODES.TEXT_CHANGED, 409);
        }
        let publicAuthorizationRef = generatePublicAuthorizationRef();
        for (let i = 0; i < 5; i += 1) {
          const clash = await GbsCaseFilingAuthorization.findOne({ publicAuthorizationRef }).select('_id').lean();
          if (!clash) break;
          publicAuthorizationRef = generatePublicAuthorizationRef();
        }
        const doc = await GbsCaseFilingAuthorization.create({
          publicAuthorizationRef,
          caseId: record._id,
          casePublicRef: record.publicCaseRef,
          customerUserId: record.requesterUserId,
          providerSubjectType: record.providerSubjectType,
          providerSubjectId: String(record.providerSubjectId),
          providerDisplayNameSnapshot: record.providerDisplayNameSnapshot || '',
          capabilityId: record.capabilityId,
          jurisdictionId: record.jurisdictionId,
          entityTypeId: record.entityTypeId || snap.entityTypeId || null,
          packId: snap.packId,
          packVersion: snap.packVersion,
          schemaVersion: GBS_FILING_AUTHORIZATION_SCHEMA_VERSION,
          packSchemaVersion: snap.schemaVersion || null,
          sourceSetId: snap.sourceSetId,
          sourceSnapshotHash: snap.sourceSnapshotHash,
          legalTextId: legal.legalTextId,
          legalTextVersion: legal.legalTextVersion,
          legalTextHash: legal.legalTextHash,
          purpose: FILING_AUTHORIZATION_PURPOSE.INITIAL_FORMATION,
          scope: { kind: FILING_AUTHORIZATION_SCOPE_KIND, oneTime: true },
          status: FILING_AUTHORIZATION_STATUSES.ACTIVE,
          grantedAt: now,
          expiresAt: null,
          recordVersion: 0,
          retentionClass: 'filing_consent',
        });
        createdId = String(doc._id);
        return { authorizationId: createdId, publicAuthorizationRef: doc.publicAuthorizationRef };
      },
    });
    const saved = await GbsCaseFilingAuthorization.findById(result.result?.authorizationId);
    if (createdId && !result.replay) {
      try {
        await logRequiredAuthAudit({
          actor,
          action: GBS_AUDIT_EVENTS.GBS_CASE_FILING_AUTHORIZATION_GRANTED,
          targetId: String(saved._id),
          metadata: {
            publicCaseRef: record.publicCaseRef,
            publicAuthorizationRef: saved.publicAuthorizationRef,
            providerSubjectType: saved.providerSubjectType,
            providerSubjectId: String(saved.providerSubjectId),
            packId: saved.packId,
            packVersion: saved.packVersion,
            legalTextId: saved.legalTextId,
            legalTextVersion: saved.legalTextVersion,
            legalTextHash: saved.legalTextHash,
            purpose: saved.purpose,
          },
        });
      } catch (auditErr) {
        await GbsCaseFilingAuthorization.deleteOne({ _id: saved._id, recordVersion: saved.recordVersion });
        throw auditErr;
      }
    }
    return getCustomerFilingAuthorization({
      userId,
      caseRef,
      env,
      now,
      registry,
      legalTextRegistry,
    });
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    if (isMongoDuplicateKey(err)) throw deny(R.CONFLICTING_AUTHORIZATION, 409);
    throw err;
  }
}

export async function revokeCustomerFilingAuthorization({
  userId,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
  registry = productionRequirementPackRegistry,
  legalTextRegistry = productionLegalTextRegistry,
} = {}) {
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  const parsed = allowlistedFilingAuthorizationRevokeInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const record = await loadOwnedCustomerCase(userId, caseRef);
  const current = await GbsCaseFilingAuthorization.findOne({
    caseId: record._id,
    customerUserId: userId,
    publicAuthorizationRef: parsed.value.publicAuthorizationRef,
  });
  if (!current) throw notFound();
  if (!isFilingAuthorizationRevocableStatus(current.status)) {
    if (current.status === FILING_AUTHORIZATION_STATUSES.REVOKED) {
      return getCustomerFilingAuthorization({ userId, caseRef, env, now, registry, legalTextRegistry });
    }
    throw deny(FILING_AUTHORIZATION_ERROR_CODES.NOT_REVOCABLE, 409);
  }
  if (Number(current.recordVersion) !== expected) {
    throw Object.assign(new Error('Conflict'), {
      status: 409,
      code: OPTIMISTIC_CONCURRENCY_CODE,
      currentVersion: current.recordVersion,
      expectedVersion: expected,
    });
  }
  const commandId = commandKey(body, headerCommandId, `${record.publicCaseRef}:filing-auth-revoke:${current.publicAuthorizationRef}:${expected}`);
  const fingerprint = fingerprintRequest({
    command: GBS_COMMAND_IDS.CASE_FILING_AUTHORIZATION_REVOKE,
    caseRef: record.publicCaseRef,
    publicAuthorizationRef: current.publicAuthorizationRef,
    expectedVersion: expected,
  });
  const store = getMongoIdempotencyStore();
  let performed = false;
  const previousStatus = current.status;
  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId: String(userId),
      tenantId: `user:${userId}`,
      commandType: GBS_COMMAND_IDS.CASE_FILING_AUTHORIZATION_REVOKE,
      idempotencyKey: commandId,
      fingerprint,
      perform: async () => {
        const updated = await GbsCaseFilingAuthorization.findOneAndUpdate(
          {
            _id: current._id,
            customerUserId: userId,
            caseId: record._id,
            status: FILING_AUTHORIZATION_STATUSES.ACTIVE,
            recordVersion: expected,
          },
          {
            $set: {
              status: FILING_AUTHORIZATION_STATUSES.REVOKED,
              revokedAt: now,
            },
            $inc: { recordVersion: 1 },
          },
          { new: true }
        );
        if (!updated) {
          const raced = await GbsCaseFilingAuthorization.findById(current._id).lean();
          if (raced?.status === FILING_AUTHORIZATION_STATUSES.REVOKED) {
            return { authorizationId: String(raced._id), replaySafe: true };
          }
          throw deny(FILING_AUTHORIZATION_ERROR_CODES.NOT_REVOCABLE, 409);
        }
        performed = true;
        return { authorizationId: String(updated._id) };
      },
    });
    const saved = await GbsCaseFilingAuthorization.findById(result.result?.authorizationId);
    if (performed && !result.replay) {
      try {
        await logRequiredAuthAudit({
          actor,
          action: GBS_AUDIT_EVENTS.GBS_CASE_FILING_AUTHORIZATION_REVOKED,
          targetId: String(saved._id),
          metadata: {
            publicCaseRef: record.publicCaseRef,
            publicAuthorizationRef: saved.publicAuthorizationRef,
            providerSubjectType: saved.providerSubjectType,
            providerSubjectId: String(saved.providerSubjectId),
            previousStatus,
          },
        });
      } catch (auditErr) {
        await GbsCaseFilingAuthorization.updateOne(
          { _id: saved._id, recordVersion: saved.recordVersion, status: FILING_AUTHORIZATION_STATUSES.REVOKED },
          { $set: { status: previousStatus, revokedAt: null }, $inc: { recordVersion: 1 } }
        );
        throw auditErr;
      }
    }
    return getCustomerFilingAuthorization({ userId, caseRef, env, now, registry, legalTextRegistry });
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    throw err;
  }
}

export async function invalidateFilingAuthorization({
  authorizationId,
  reasonCode,
  extraFilter = {},
  actor = {},
  now = new Date(),
} = {}) {
  const current = await GbsCaseFilingAuthorization.findById(authorizationId);
  if (!current) throw notFound();
  if (current.status !== FILING_AUTHORIZATION_STATUSES.ACTIVE) return current;
  const previousStatus = current.status;
  const updated = await GbsCaseFilingAuthorization.findOneAndUpdate(
    {
      _id: current._id,
      status: FILING_AUTHORIZATION_STATUSES.ACTIVE,
      recordVersion: current.recordVersion,
      ...extraFilter,
    },
    {
      $set: {
        status: FILING_AUTHORIZATION_STATUSES.INVALIDATED,
        invalidatedAt: now,
        invalidationReasonCode: reasonCode,
      },
      $inc: { recordVersion: 1 },
    },
    { new: true }
  );
  if (!updated) return current;
  try {
    await logRequiredAuthAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_CASE_FILING_AUTHORIZATION_INVALIDATED,
      targetId: String(updated._id),
      metadata: {
        publicCaseRef: updated.casePublicRef,
        publicAuthorizationRef: updated.publicAuthorizationRef,
        invalidationReasonCode: reasonCode,
        providerSubjectType: updated.providerSubjectType,
        providerSubjectId: String(updated.providerSubjectId),
      },
    });
  } catch (auditErr) {
    await GbsCaseFilingAuthorization.updateOne(
      { _id: updated._id, recordVersion: updated.recordVersion, status: FILING_AUTHORIZATION_STATUSES.INVALIDATED },
      {
        $set: { status: previousStatus, invalidatedAt: null, invalidationReasonCode: null },
        $inc: { recordVersion: 1 },
      }
    );
    throw auditErr;
  }
  return updated;
}

/**
 * One Mongo atomic CAS reservation. Claim is not submission and is not
 * government filing. Concurrent revoke vs claim: exactly one winner.
 */
export async function claimAuthorizationForSubmission({
  authorizationId,
  record,
  subject,
  actor = {},
  env = process.env,
  now = new Date(),
  expectedVersion = null,
  legalTextRegistry = productionLegalTextRegistry,
} = {}) {
  const current = await GbsCaseFilingAuthorization.findById(authorizationId);
  if (!current) throw notFound();
  if (current.status !== FILING_AUTHORIZATION_STATUSES.ACTIVE) {
    throw deny(FILING_AUTHORIZATION_ERROR_CODES.NOT_CLAIMABLE, 409);
  }
  if (!isGbsWyomingFormationEnabled(env) || !isGbsFilingAuthorizationEnabled(env)) {
    throw deny(FILING_AUTHORIZATION_ERROR_CODES.NOT_CLAIMABLE, 409);
  }
  if (!isGrantedLegalTextEffectiveForFutureUse(current, legalTextRegistry)) {
    throw deny(FILING_AUTHORIZATION_ERROR_CODES.NOT_CLAIMABLE, 409);
  }
  if (isExpired(current, now)) throw deny(R.EXPIRED, 409);
  if (isCaseTerminal(record.status)) throw deny(R.CASE_TERMINAL, 409);
  if (!authorizationMatchesCase(current, record)) {
    throw deny(FILING_AUTHORIZATION_ERROR_CODES.NOT_CLAIMABLE, 409);
  }
  if (current.providerSubjectType !== subject.subjectType
    || String(current.providerSubjectId) !== String(subject.subjectId)) {
    throw notFound();
  }
  const providerOk = await professionalAuthorityAllowed(record, env, now);
  if (!providerOk) throw deny(R.PROVIDER_AUTHORITY_LOST, 409);
  const expected = expectedVersion == null ? current.recordVersion : Number(expectedVersion);
  const claimRef = generateClaimRef();
  const updated = await GbsCaseFilingAuthorization.findOneAndUpdate(
    {
      _id: current._id,
      status: FILING_AUTHORIZATION_STATUSES.ACTIVE,
      recordVersion: expected,
      caseId: record._id,
      providerSubjectType: subject.subjectType,
      providerSubjectId: String(subject.subjectId),
      packId: current.packId,
      packVersion: current.packVersion,
      sourceSnapshotHash: current.sourceSnapshotHash,
      legalTextId: current.legalTextId,
      legalTextVersion: current.legalTextVersion,
      legalTextHash: current.legalTextHash,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    },
    {
      $set: {
        status: FILING_AUTHORIZATION_STATUSES.CLAIMED_FOR_SUBMISSION,
        claimedAt: now,
        claimRef,
      },
      $inc: { recordVersion: 1 },
    },
    { new: true }
  );
  if (!updated) {
    const raced = await GbsCaseFilingAuthorization.findById(current._id).lean();
    throw deny(
      raced?.status === FILING_AUTHORIZATION_STATUSES.REVOKED
        ? FILING_AUTHORIZATION_ERROR_CODES.NOT_CLAIMABLE
        : FILING_AUTHORIZATION_ERROR_CODES.NOT_CLAIMABLE,
      409
    );
  }
  try {
    await logRequiredAuthAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_CASE_FILING_AUTHORIZATION_CLAIMED,
      targetId: String(updated._id),
      metadata: {
        publicCaseRef: updated.casePublicRef,
        publicAuthorizationRef: updated.publicAuthorizationRef,
        claimRef: updated.claimRef,
        providerSubjectType: updated.providerSubjectType,
        providerSubjectId: String(updated.providerSubjectId),
        providerActorAgentAccountId: actor.agentAccountId || null,
      },
    });
  } catch (auditErr) {
    await GbsCaseFilingAuthorization.updateOne(
      {
        _id: updated._id,
        recordVersion: updated.recordVersion,
        status: FILING_AUTHORIZATION_STATUSES.CLAIMED_FOR_SUBMISSION,
      },
      {
        $set: {
          status: FILING_AUTHORIZATION_STATUSES.ACTIVE,
          claimedAt: null,
          claimRef: null,
        },
        $inc: { recordVersion: 1 },
      }
    );
    throw auditErr;
  }
  return updated;
}

export async function markAuthorizationUsed({
  authorization,
  actor = {},
  now = new Date(),
} = {}) {
  const updated = await GbsCaseFilingAuthorization.findOneAndUpdate(
    {
      _id: authorization._id,
      status: FILING_AUTHORIZATION_STATUSES.CLAIMED_FOR_SUBMISSION,
      recordVersion: authorization.recordVersion,
    },
    {
      $set: {
        status: FILING_AUTHORIZATION_STATUSES.USED,
        usedAt: now,
      },
      $inc: { recordVersion: 1 },
    },
    { new: true }
  );
  if (!updated) throw deny(FILING_AUTHORIZATION_ERROR_CODES.NOT_CLAIMABLE, 409);
  try {
    await logRequiredAuthAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_CASE_FILING_AUTHORIZATION_USED,
      targetId: String(updated._id),
      metadata: {
        publicCaseRef: updated.casePublicRef,
        publicAuthorizationRef: updated.publicAuthorizationRef,
        providerSubjectType: updated.providerSubjectType,
        providerSubjectId: String(updated.providerSubjectId),
      },
    });
  } catch (auditErr) {
    await GbsCaseFilingAuthorization.updateOne(
      { _id: updated._id, recordVersion: updated.recordVersion, status: FILING_AUTHORIZATION_STATUSES.USED },
      {
        $set: { status: FILING_AUTHORIZATION_STATUSES.CLAIMED_FOR_SUBMISSION, usedAt: null },
        $inc: { recordVersion: 1 },
      }
    );
    throw auditErr;
  }
  return updated;
}

export {
  authorizationMatchesCase,
  hasActiveBusinessClient,
  isExpired,
  loadExactProviderCase,
  loadOwnedCustomerCase,
  logRequiredAuthAudit,
  mismatchReason,
  professionalAuthorityAllowed,
};
