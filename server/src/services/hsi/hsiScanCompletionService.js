/**
 * Apply a scan verdict to Vault + GBS requirement with CAS.
 * Late scans cannot satisfy replacements or terminal Cases.
 */
import { GbsCase } from '../../models/gbs/GbsCase.js';
import { GbsCaseDocumentRequirement } from '../../models/gbs/GbsCaseDocumentRequirement.js';
import { GbsCaseDocumentGrant } from '../../models/gbs/GbsCaseDocumentGrant.js';
import { VaultDocumentVersion } from '../../models/vault/VaultDocumentVersion.js';
import { isCaseTerminal } from '../../../../shared/gbs/caseContract.js';
import {
  GBS_DOCUMENT_GRANT_GRANTEE_TYPES,
  GBS_DOCUMENT_GRANT_STATUSES,
  GBS_DOCUMENT_REQUIREMENT_STATUSES,
  GBS_DOCUMENT_REVIEW_STATES,
} from '../../../../shared/gbs/caseDocumentContract.js';
import { PROVIDER_SUBJECT_TYPES } from '../../../../shared/gbs/constants.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { HSI_CLAMAV_VERDICTS, HSI_STORAGE_CLASSES } from '../../../../shared/gbs/hsiSecurity.js';
import { logRequiredHsiAudit } from './hsiAudit.js';
import { markRejectedForMalwareRetention } from './hsiRetentionService.js';
import { promoteHsiVersionCiphertext } from './hsiObjectPipeline.js';

function scanStatusFromVerdict(verdict) {
  if (verdict === HSI_CLAMAV_VERDICTS.CLEAN) return 'clean';
  if (verdict === HSI_CLAMAV_VERDICTS.REJECTED) return 'rejected';
  if (verdict === HSI_CLAMAV_VERDICTS.TIMEOUT) return 'timeout';
  return 'failed';
}

async function maybeGrant(record, requirement, version) {
  const granteeType = record.providerSubjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION
    ? GBS_DOCUMENT_GRANT_GRANTEE_TYPES.AGENCY_SUBJECT
    : GBS_DOCUMENT_GRANT_GRANTEE_TYPES.INDEPENDENT_PROVIDER;
  await GbsCaseDocumentGrant.findOneAndUpdate(
    {
      requirementId: requirement._id,
      vaultVersionId: version._id,
      granteeSubjectId: String(record.providerSubjectId),
    },
    {
      $setOnInsert: {
        caseId: record._id,
        requirementId: requirement._id,
        vaultDocumentId: version.documentId,
        vaultVersionId: version._id,
        granteeType,
        granteeSubjectType: record.providerSubjectType,
        granteeSubjectId: String(record.providerSubjectId),
        status: GBS_DOCUMENT_GRANT_STATUSES.ACTIVE,
        scanStatusAtGrant: version.scanStatus,
      },
    },
    { upsert: true }
  );
}

export async function persistHsiVersionVerdict({
  versionId,
  checksumSha256,
  verdict,
  engineVersion,
  now = new Date(),
} = {}) {
  const scanStatus = scanStatusFromVerdict(verdict);
  return VaultDocumentVersion.findOneAndUpdate(
    { _id: versionId, scanStatus: 'pending', checksum: checksumSha256 },
    {
      $set: {
        scanStatus,
        scanCompletedAt: now,
        scanEngine: 'clamav-clamd',
        scanEngineVersion: engineVersion || null,
      },
    },
    { new: true }
  );
}

export async function applyHsiScanOutcomeToRequirement({
  version,
  env = process.env,
  now = new Date(),
} = {}) {
  const requirement = await GbsCaseDocumentRequirement.findOne({
    activeVaultVersionId: version._id,
  });
  if (!requirement) {
    return { applied: false, reason: 'not_active_version' };
  }
  const record = await GbsCase.findById(requirement.caseId);
  if (!record || isCaseTerminal(record.status)) {
    return { applied: false, reason: 'case_terminal' };
  }

  let professionalAllowed = true;
  try {
    const { evaluateCaseProfessionalAuthority } = await import('../gbs/gbsCaseService.js');
    const { GbsServiceListing } = await import('../../models/gbs/GbsServiceListing.js');
    const { GbsServiceRequest } = await import('../../models/gbs/GbsServiceRequest.js');
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
    professionalAllowed = gate.allowed === true;
  } catch {
    professionalAllowed = false;
  }

  if (version.scanStatus === 'clean' && professionalAllowed) {
    await GbsCaseDocumentRequirement.updateOne(
      { _id: requirement._id, activeVaultVersionId: version._id },
      {
        $set: {
          scanStatus: 'clean',
          status: GBS_DOCUMENT_REQUIREMENT_STATUSES.AVAILABLE_FOR_REVIEW,
          reviewState: GBS_DOCUMENT_REVIEW_STATES.NONE,
        },
        $inc: { recordVersion: 1 },
      }
    );
    await maybeGrant(record, requirement, version);
    return { applied: true, reason: 'clean_active' };
  }

  if (version.scanStatus === 'rejected') {
    await GbsCaseDocumentRequirement.updateOne(
      { _id: requirement._id, activeVaultVersionId: version._id },
      {
        $set: {
          scanStatus: 'rejected',
          status: GBS_DOCUMENT_REQUIREMENT_STATUSES.REJECTED,
        },
        $inc: { recordVersion: 1 },
      }
    );
    return { applied: true, reason: 'rejected_active' };
  }

  await GbsCaseDocumentRequirement.updateOne(
    { _id: requirement._id, activeVaultVersionId: version._id },
    {
      $set: { scanStatus: version.scanStatus },
      $inc: { recordVersion: 1 },
    }
  );
  return { applied: true, reason: 'non_clean_active' };
}

export async function finalizeHsiScanVerdict({
  job,
  verdict,
  engineVersion,
  env = process.env,
  now = new Date(),
  actor = {},
} = {}) {
  const version = await persistHsiVersionVerdict({
    versionId: job.vaultDocumentVersionId,
    checksumSha256: job.checksumSha256,
    verdict,
    engineVersion,
    now,
  });
  if (!version) {
    return { promoted: false, duplicate: true, applied: false };
  }

  let promoted = false;
  if (verdict === HSI_CLAMAV_VERDICTS.CLEAN) {
    const promotedRef = await promoteHsiVersionCiphertext(version, { env });
    await VaultDocumentVersion.updateOne(
      { _id: version._id, scanStatus: 'clean' },
      {
        $set: {
          storageClass: HSI_STORAGE_CLASSES.CLEAN,
          cleanBucket: promotedRef.bucket,
        },
      }
    );
    version.storageClass = HSI_STORAGE_CLASSES.CLEAN;
    version.cleanBucket = promotedRef.bucket;
    promoted = true;
    await logRequiredHsiAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_HSI_DOCUMENT_PROMOTED,
      targetType: 'VaultDocumentVersion',
      targetId: String(version._id),
      metadata: redactAuditMetadata({
        checksum: version.checksum,
        scanStatus: 'clean',
      }),
    });
  } else if (verdict === HSI_CLAMAV_VERDICTS.REJECTED) {
    await markRejectedForMalwareRetention(version, { now, env });
  }

  const outcome = await applyHsiScanOutcomeToRequirement({ version, env, now, actor });
  await logRequiredHsiAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_SCAN_COMPLETED,
    targetType: 'VaultDocumentVersion',
    targetId: String(version._id),
    metadata: redactAuditMetadata({
      checksum: version.checksum,
      scanStatus: version.scanStatus,
      applied: outcome.applied,
      reason: outcome.reason,
    }),
  });
  return { promoted, duplicate: false, applied: outcome.applied, reason: outcome.reason, version };
}
