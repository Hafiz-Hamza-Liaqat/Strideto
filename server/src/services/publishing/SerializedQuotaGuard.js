import mongoose from 'mongoose';
import { EmployerPublishingQuotaGuard } from '../../models/EmployerPublishingQuotaGuard.js';
import { normalizePublishingQuotaOwner } from './QuotaOwnerResolver.js';

function guardError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireActiveTransaction(session) {
  if (
    !session ||
    typeof session.inTransaction !== 'function' ||
    !session.inTransaction()
  ) {
    throw guardError(
      'QUOTA_TRANSACTION_SESSION_REQUIRED',
      'Publishing quota serialization requires an active database transaction'
    );
  }
}

/**
 * Perform the guard write that serializes quota-sensitive work for one owner.
 */
export async function acquirePublishingQuotaGuard(
  owner,
  { session, GuardModel = EmployerPublishingQuotaGuard } = {}
) {
  requireActiveTransaction(session);
  const normalizedOwner = normalizePublishingQuotaOwner(owner);

  const guard = await GuardModel.findOneAndUpdate(
    {
      _id: normalizedOwner.guardId,
      ownerType: normalizedOwner.ownerType,
      ownerId: normalizedOwner.ownerId,
    },
    {
      $inc: { revision: 1 },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      session,
    }
  );

  if (!guard) {
    throw guardError(
      'QUOTA_GUARD_ACQUIRE_FAILED',
      'Publishing quota serialization guard could not be acquired'
    );
  }

  return Object.freeze({
    owner: normalizedOwner,
    guard,
  });
}

/**
 * Transaction boundary for future submit/approve/close/expire services.
 * This module is not called by runtime routes in H2A.
 */
export async function runWithSerializedPublishingQuota(
  owner,
  work,
  {
    connection = mongoose.connection,
    GuardModel = EmployerPublishingQuotaGuard,
    transactionOptions,
  } = {}
) {
  if (typeof work !== 'function') {
    throw guardError(
      'QUOTA_TRANSACTION_WORK_REQUIRED',
      'Quota transaction work is required'
    );
  }

  const normalizedOwner = normalizePublishingQuotaOwner(owner);
  const session = await connection.startSession();
  let output;

  try {
    await session.withTransaction(async () => {
      const acquired = await acquirePublishingQuotaGuard(normalizedOwner, {
        session,
        GuardModel,
      });
      output = await work({
        session,
        owner: acquired.owner,
        guard: acquired.guard,
      });
    }, transactionOptions);
    return output;
  } finally {
    await session.endSession();
  }
}

export const SerializedQuotaGuard = Object.freeze({
  acquire: acquirePublishingQuotaGuard,
  run: runWithSerializedPublishingQuota,
});
