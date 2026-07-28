import { PublishingOutboxIntent } from '../../../models/PublishingOutboxIntent.js';
import {
  mapPublishingOutboxIntentBatch,
  PublishingOutboxContractError,
} from './PublishingOutboxContracts.js';

function invalidContract() {
  return new PublishingOutboxContractError(
    'OUTBOX_CONTRACT_INVALID',
    'The publishing outbox intent is invalid.'
  );
}

function validateSession(options) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    !options.session ||
    typeof options.session !== 'object'
  ) {
    throw invalidContract();
  }

  const { session } = options;
  if (
    session.hasEnded === true ||
    typeof session.inTransaction !== 'function'
  ) {
    throw invalidContract();
  }

  let inTransaction;
  try {
    inTransaction = session.inTransaction();
  } catch {
    throw invalidContract();
  }
  if (inTransaction !== true) {
    throw invalidContract();
  }
  return session;
}

function isDuplicateKeyError(error) {
  return (
    error &&
    typeof error === 'object' &&
    (error.code === 11000 || error.code === 11001)
  );
}

function isMongooseContractError(error) {
  return (
    error &&
    typeof error === 'object' &&
    ['ValidationError', 'CastError', 'StrictModeError'].includes(error.name)
  );
}

export function createMongoosePublishingOutboxRepository({
  model = PublishingOutboxIntent,
  clock = () => new Date(),
} = {}) {
  if (!model || typeof model.create !== 'function') {
    throw new TypeError('A publishing outbox model is required.');
  }
  if (typeof clock !== 'function') {
    throw new TypeError('A publishing outbox clock is required.');
  }

  async function enqueueMany(intents, options) {
    const session = validateSession(options);
    const now = clock();
    const documents = mapPublishingOutboxIntentBatch(intents, { now });

    try {
      await model.create(documents, {
        session,
        ordered: true,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new PublishingOutboxContractError(
          'OUTBOX_DEDUPLICATION_CONFLICT',
          'The publishing outbox intent conflicts with an existing intent.'
        );
      }
      if (isMongooseContractError(error)) {
        throw invalidContract();
      }
      throw error;
    }

    return Object.freeze({
      insertedCount: documents.length,
    });
  }

  return Object.freeze({
    enqueueMany,
  });
}
