import mongoose from 'mongoose';
import {
  BETA_QUOTA_OWNER_TYPE,
  QUOTA_OWNER_TYPES,
  buildPublishingQuotaGuardId,
} from '../../config/freeBetaPublishingPolicy.js';

function resolverError(code, message) {
  const error = new TypeError(message);
  error.code = code;
  return error;
}

function canonicalObjectId(value) {
  const raw = String(value || '').trim();
  if (!mongoose.isObjectIdOrHexString(raw)) {
    throw resolverError(
      'INVALID_QUOTA_OWNER_ID',
      'Publishing quota owner ID is invalid'
    );
  }

  const objectId = new mongoose.Types.ObjectId(raw);
  if (objectId.toString() !== raw.toLowerCase()) {
    throw resolverError(
      'INVALID_QUOTA_OWNER_ID',
      'Publishing quota owner ID is not canonical'
    );
  }
  return objectId;
}

/**
 * Normalize a trusted domain owner reference.
 *
 * @param {{ownerType: string, ownerId: unknown}} owner
 */
export function normalizePublishingQuotaOwner(owner) {
  if (!owner || !QUOTA_OWNER_TYPES.includes(owner.ownerType)) {
    throw resolverError(
      'INVALID_QUOTA_OWNER_TYPE',
      'Publishing quota owner type is invalid'
    );
  }

  const ownerId = canonicalObjectId(owner.ownerId);
  return Object.freeze({
    ownerType: owner.ownerType,
    ownerId,
    guardId: buildPublishingQuotaGuardId(owner.ownerType, ownerId),
  });
}

/**
 * Beta boundary: one Employer account is one quota owner.
 *
 * @param {unknown} employerOrId Employer document/lean object or Employer ID
 */
export function resolveEmployerPublishingQuotaOwner(employerOrId) {
  const employerId =
    employerOrId && typeof employerOrId === 'object'
      ? employerOrId._id || employerOrId.employerId
      : employerOrId;

  return normalizePublishingQuotaOwner({
    ownerType: BETA_QUOTA_OWNER_TYPE,
    ownerId: employerId,
  });
}

export const QuotaOwnerResolver = Object.freeze({
  resolveEmployer: resolveEmployerPublishingQuotaOwner,
  normalize: normalizePublishingQuotaOwner,
});
