/**
 * Provider-attested manual external filing provenance (Phase 17D-9A / 17D-8C).
 *
 * STRIDETO does not transmit to Wyoming. submitted_externally means only that
 * the exact authorized Provider attested the external filing was performed.
 */
import { GbsCaseFilingAuthorization } from '../../models/gbs/GbsCaseFilingAuthorization.js';
import { GbsExternalFilingSubmission } from '../../models/gbs/GbsExternalFilingSubmission.js';
import { GBS_COMMAND_IDS } from '../../../../shared/gbs/constants.js';
import { GBS_CASE_BOUNDS, isCaseTerminal } from '../../../../shared/gbs/caseContract.js';
import { parseExpectedVersion } from '../../../../shared/gbs/case.js';
import { GBS_EXTERNAL_FILING_SCHEMA_VERSION } from '../../../../shared/gbs/externalFilingContract.js';
import { allowlistedExternalFilingAttestationInput } from '../../../../shared/gbs/externalFiling.js';
import {
  FILING_AUTHORIZATION_ERROR_CODES,
  FILING_AUTHORIZATION_STATUSES,
  FILING_AUTHORIZATION_UNAVAILABLE_REASONS as R,
  isGbsExternalFilingAttestationEnabled,
  isGbsWyomingFormationEnabled,
} from '../../../../shared/gbs/filingAuthorizationContract.js';
import { GBS_AUDIT_EVENTS } from '../../../../shared/security/gbsAuditEvents.js';
import { OPTIMISTIC_CONCURRENCY_CODE } from '../../../../shared/platform/optimisticConcurrency.js';
import {
  executeHighValueIdempotentCommand,
  fingerprintRequest,
  getMongoIdempotencyStore,
} from '../platform/idempotencyService.js';
import { IDEMPOTENCY_CODES } from '../../../../shared/platform/idempotency.js';
import { generatePublicSubmissionRef } from '../../utils/gbsFilingRef.js';
import { productionLegalTextRegistry } from '../../../../shared/gbs/filingAuthorizationLegalText.js';
import {
  claimAuthorizationForSubmission,
  deriveFilingReadiness,
  getProviderFilingAuthorization,
  loadExactProviderCase,
  logRequiredAuthAudit,
  markAuthorizationUsed,
  professionalAuthorityAllowed,
} from './gbsFilingAuthorizationService.js';

function deny(code, status = 400) {
  return Object.assign(new Error(code), { status, code });
}

function notFound() {
  return deny('not_found', 404);
}

function isMongoDuplicateKey(err) {
  return Number(err?.code) === 11000 || err?.codeName === 'DuplicateKey';
}

function commandKey(body, headerCommandId, fallback) {
  const raw = body?.commandId || body?.creationCommandId || headerCommandId || fallback;
  return String(raw || fallback).trim().slice(0, GBS_CASE_BOUNDS.COMMAND_ID_MAX);
}

export async function attestProviderExternalFiling({
  subject,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
  legalTextRegistry = productionLegalTextRegistry,
} = {}) {
  if (!isGbsExternalFilingAttestationEnabled(env) || !isGbsWyomingFormationEnabled(env)) {
    throw deny('external_filing_not_available', 409);
  }
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  const parsed = allowlistedExternalFilingAttestationInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const record = await loadExactProviderCase(subject, caseRef);
  if (isCaseTerminal(record.status)) throw deny(R.CASE_TERMINAL, 409);
  if (Number(record.recordVersion) !== expected) {
    throw Object.assign(new Error('Conflict'), {
      status: 409,
      code: OPTIMISTIC_CONCURRENCY_CODE,
      currentVersion: record.recordVersion,
      expectedVersion: expected,
    });
  }
  const derived = await deriveFilingReadiness({ record, env, now, legalTextRegistry });
  if (!derived.requirementsReady) throw deny('requirements_not_ready', 409);
  const providerOk = await professionalAuthorityAllowed(record, env, now);
  if (!providerOk) throw deny(R.PROVIDER_AUTHORITY_LOST, 409);

  let auth = derived.authorization;
  if (!auth) throw deny(FILING_AUTHORIZATION_ERROR_CODES.NOT_CLAIMABLE, 409);
  if (auth.providerSubjectType !== subject.subjectType
    || String(auth.providerSubjectId) !== String(subject.subjectId)) {
    throw notFound();
  }
  if (auth.status === FILING_AUTHORIZATION_STATUSES.REVOKED
    || auth.status === FILING_AUTHORIZATION_STATUSES.INVALIDATED
    || auth.status === FILING_AUTHORIZATION_STATUSES.SUPERSEDED) {
    throw deny(FILING_AUTHORIZATION_ERROR_CODES.NOT_CLAIMABLE, 409);
  }

  const commandId = commandKey(
    body,
    headerCommandId,
    `${record.publicCaseRef}:external-filing-attest:${auth.publicAuthorizationRef}`
  );
  const fingerprint = fingerprintRequest({
    command: GBS_COMMAND_IDS.CASE_EXTERNAL_FILING_ATTEST,
    caseRef: record.publicCaseRef,
    publicAuthorizationRef: auth.publicAuthorizationRef,
    filingMethod: parsed.value.filingMethod,
    authorityId: parsed.value.authorityId,
    optionalProviderReference: parsed.value.optionalProviderReference || null,
  });
  const store = getMongoIdempotencyStore();
  let createdSubmissionId = null;
  let claimedHere = false;
  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId: String(actor.agentAccountId || subject.subjectId),
      tenantId: `${subject.subjectType}:${subject.subjectId}`,
      commandType: GBS_COMMAND_IDS.CASE_EXTERNAL_FILING_ATTEST,
      idempotencyKey: commandId,
      fingerprint,
      perform: async () => {
        let working = await GbsCaseFilingAuthorization.findById(auth._id);
        if (!working) throw notFound();
        const existing = await GbsExternalFilingSubmission.findOne({ authorizationId: working._id }).lean();
        if (existing || working.status === FILING_AUTHORIZATION_STATUSES.USED) {
          throw deny('external_filing_already_recorded', 409);
        }
        if (working.status === FILING_AUTHORIZATION_STATUSES.ACTIVE) {
          working = await claimAuthorizationForSubmission({
            authorizationId: working._id,
            record,
            subject,
            actor,
            env,
            now,
            expectedVersion: working.recordVersion,
            legalTextRegistry,
          });
          claimedHere = true;
        }
        if (working.status !== FILING_AUTHORIZATION_STATUSES.CLAIMED_FOR_SUBMISSION) {
          throw deny(FILING_AUTHORIZATION_ERROR_CODES.NOT_CLAIMABLE, 409);
        }
        const stillAllowed = await professionalAuthorityAllowed(record, env, now);
        if (!stillAllowed) throw deny(R.PROVIDER_AUTHORITY_LOST, 409);

        let publicSubmissionRef = generatePublicSubmissionRef();
        for (let i = 0; i < 5; i += 1) {
          const clash = await GbsExternalFilingSubmission.findOne({ publicSubmissionRef }).select('_id').lean();
          if (!clash) break;
          publicSubmissionRef = generatePublicSubmissionRef();
        }
        const submission = await GbsExternalFilingSubmission.create({
          publicSubmissionRef,
          caseId: record._id,
          casePublicRef: record.publicCaseRef,
          authorizationId: working._id,
          publicAuthorizationRef: working.publicAuthorizationRef,
          customerUserId: working.customerUserId,
          providerSubjectType: working.providerSubjectType,
          providerSubjectId: String(working.providerSubjectId),
          providerActorUserId: actor.userId || null,
          providerActorAgentAccountId: actor.agentAccountId || null,
          capabilityId: working.capabilityId,
          jurisdictionId: working.jurisdictionId,
          entityTypeId: working.entityTypeId,
          packId: working.packId,
          packVersion: working.packVersion,
          sourceSetId: working.sourceSetId,
          sourceSnapshotHash: working.sourceSnapshotHash,
          legalTextId: working.legalTextId,
          legalTextVersion: working.legalTextVersion,
          legalTextHash: working.legalTextHash,
          filingMethod: parsed.value.filingMethod,
          authorityId: parsed.value.authorityId,
          submissionStatus: 'submitted_externally',
          providerAttestedAt: now,
          externalSubmittedAt: parsed.value.externalSubmittedAt ? new Date(parsed.value.externalSubmittedAt) : now,
          optionalProviderReference: parsed.value.optionalProviderReference,
          evidenceRef: null,
          recordVersion: 0,
          schemaVersion: GBS_EXTERNAL_FILING_SCHEMA_VERSION,
          retentionClass: 'submitted_filing_evidence',
        });
        createdSubmissionId = String(submission._id);
        const used = await markAuthorizationUsed({ authorization: working, actor, now });
        return {
          submissionId: String(submission._id),
          publicSubmissionRef: submission.publicSubmissionRef,
          authorizationId: String(used._id),
        };
      },
    });
    const saved = await GbsExternalFilingSubmission.findById(result.result?.submissionId);
    if (createdSubmissionId && !result.replay) {
      try {
        await logRequiredAuthAudit({
          actor,
          action: GBS_AUDIT_EVENTS.GBS_CASE_EXTERNAL_FILING_ATTESTED,
          targetType: 'GbsExternalFilingSubmission',
          targetId: String(saved._id),
          metadata: {
            publicCaseRef: record.publicCaseRef,
            publicAuthorizationRef: saved.publicAuthorizationRef,
            publicSubmissionRef: saved.publicSubmissionRef,
            providerSubjectType: saved.providerSubjectType,
            providerSubjectId: String(saved.providerSubjectId),
            providerActorAgentAccountId: saved.providerActorAgentAccountId,
            filingMethod: saved.filingMethod,
            authorityId: saved.authorityId,
            result: 'submitted_externally',
          },
        });
        await logRequiredAuthAudit({
          actor,
          action: GBS_AUDIT_EVENTS.GBS_CASE_EXTERNAL_FILING_SUBMISSION_CREATED,
          targetType: 'GbsExternalFilingSubmission',
          targetId: String(saved._id),
          metadata: {
            publicCaseRef: record.publicCaseRef,
            publicSubmissionRef: saved.publicSubmissionRef,
            publicAuthorizationRef: saved.publicAuthorizationRef,
          },
        });
      } catch (auditErr) {
        await GbsExternalFilingSubmission.deleteOne({ _id: saved._id });
        await GbsCaseFilingAuthorization.updateOne(
          { _id: auth._id, status: FILING_AUTHORIZATION_STATUSES.USED },
          {
            $set: {
              status: claimedHere
                ? FILING_AUTHORIZATION_STATUSES.ACTIVE
                : FILING_AUTHORIZATION_STATUSES.CLAIMED_FOR_SUBMISSION,
              usedAt: null,
              ...(claimedHere ? { claimedAt: null, claimRef: null } : {}),
            },
            $inc: { recordVersion: 1 },
          }
        );
        throw auditErr;
      }
    }
    return getProviderFilingAuthorization({ subject, caseRef, env, now, legalTextRegistry });
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    if (isMongoDuplicateKey(err)) throw deny('external_filing_already_recorded', 409);
    throw err;
  }
}
