import { createHash } from 'node:crypto';
import {
  IDEMPOTENCY_CODES,
  IDEMPOTENCY_STORE_KINDS,
  isSharedPersistentIdempotencyStore,
} from '../../../../shared/platform/idempotency.js';
import { createMongoIdempotencyStore } from './mongoIdempotencyStore.js';

export function fingerprintRequest(parts) {
  const payload = typeof parts === 'string' ? parts : JSON.stringify(parts);
  return createHash('sha256').update(payload).digest('hex');
}

let mongoSingleton;

export function getMongoIdempotencyStore() {
  if (!mongoSingleton) {
    mongoSingleton = createMongoIdempotencyStore();
  }
  return mongoSingleton;
}

/**
 * No silent in-memory default. Production / high-value commands use Mongo.
 */
export function getIdempotencyStore({ allowInMemory = false, store } = {}) {
  if (store) return store;
  if (allowInMemory) {
    throw Object.assign(new Error('In-memory idempotency store must be constructed explicitly'), {
      status: 503,
      code: IDEMPOTENCY_CODES.STORE_REQUIRED,
    });
  }
  return getMongoIdempotencyStore();
}

export function assertHighValueIdempotencyStore(store) {
  if (!isSharedPersistentIdempotencyStore(store)) {
    throw Object.assign(new Error('High-value commands require a shared persistent idempotency store'), {
      status: 503,
      code: IDEMPOTENCY_CODES.STORE_NOT_SHARED,
    });
  }
}

export function executeHighValueIdempotentCommand(store, input) {
  assertHighValueIdempotencyStore(store);
  const fingerprint = input.fingerprint || fingerprintRequest(input.safeParts || {});
  return store.execute({ ...input, fingerprint });
}

export async function executeIdempotentCommand(input = {}) {
  if (!input.store) {
    throw Object.assign(new Error('Idempotency store must be injected'), {
      status: 503,
      code: IDEMPOTENCY_CODES.STORE_REQUIRED,
    });
  }
  if (input.highValue === true || input.store.kind === IDEMPOTENCY_STORE_KINDS.MONGO) {
    if (input.highValue === true) assertHighValueIdempotencyStore(input.store);
  }
  const fingerprint = input.fingerprint || fingerprintRequest(input.safeParts || {});
  return input.store.execute({ ...input, fingerprint });
}
