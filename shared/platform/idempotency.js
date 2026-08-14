/**
 * Idempotent command contract (Phase 17D-1).
 *
 * Same key + same logical request → one logical side effect.
 * Same key + different fingerprint → conflict.
 * Concurrent duplicates → no duplicate effect.
 * Do not persist secrets or full sensitive bodies.
 *
 * Hashing is injected so this module stays free of Node-only crypto.
 */
export const IDEMPOTENCY_STORE_KINDS = Object.freeze({
  IN_MEMORY: 'in_memory',
  MONGO: 'mongo',
});

export const IDEMPOTENCY_STATUSES = Object.freeze({
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CONFLICT: 'conflict',
  FAILED: 'failed',
});

export const IDEMPOTENCY_CODES = Object.freeze({
  REPLAY: 'idempotency_replay',
  CONFLICT: 'idempotency_conflict',
  IN_FLIGHT: 'idempotency_in_flight',
  STORE_NOT_SHARED: 'idempotency_store_not_shared',
  STORE_REQUIRED: 'idempotency_store_required',
});

/** Default retention: 7 days. Bounded; not infinite. */
export const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Abandoned IN_PROGRESS reservations older than this may be retried.
 * They are never rewritten as COMPLETED by recovery.
 */
export const IDEMPOTENCY_IN_PROGRESS_STALE_MS = 5 * 60 * 1000;

/** Bounded wait when another replica holds IN_PROGRESS. Do not hold forever. */
export const IDEMPOTENCY_IN_FLIGHT_MAX_WAIT_MS = 2000;
export const IDEMPOTENCY_IN_FLIGHT_POLL_MS = 50;

export function idempotencyRecordKey({ principalId, tenantId, commandType, idempotencyKey }) {
  return [principalId || '', tenantId || '', commandType || '', idempotencyKey || ''].join(':');
}

/**
 * Process-local store. TEST / isolated-dev only.
 * Must not be the silent production default for high-value commands.
 */
export function createInMemoryIdempotencyStore({ ttlMs = IDEMPOTENCY_TTL_MS } = {}) {
  const records = new Map();
  const locks = new Map();

  async function withLock(key, fn) {
    const prev = locks.get(key) || Promise.resolve();
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    locks.set(
      key,
      prev.then(() => gate)
    );
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (locks.get(key) === gate) locks.delete(key);
    }
  }

  function purgeExpired(now = Date.now()) {
    for (const [key, rec] of records) {
      if (rec.expiresAt && rec.expiresAt.getTime() <= now) records.delete(key);
    }
  }

  async function execute({
    principalId,
    tenantId,
    commandType,
    idempotencyKey,
    fingerprint,
    perform,
  }) {
    if (!idempotencyKey || !commandType || !fingerprint) {
      throw Object.assign(new Error('Idempotency key, command type, and fingerprint are required'), {
        status: 400,
        code: 'idempotency_required',
      });
    }
    const key = idempotencyRecordKey({ principalId, tenantId, commandType, idempotencyKey });
    return withLock(key, async () => {
      purgeExpired();
      const existing = records.get(key);
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          existing.status = IDEMPOTENCY_STATUSES.CONFLICT;
          throw Object.assign(new Error('Idempotency key reused with a different request'), {
            status: 409,
            code: IDEMPOTENCY_CODES.CONFLICT,
          });
        }
        if (existing.status === IDEMPOTENCY_STATUSES.COMPLETED) {
          return {
            replay: true,
            code: IDEMPOTENCY_CODES.REPLAY,
            result: existing.result,
          };
        }
        if (existing.status === IDEMPOTENCY_STATUSES.IN_PROGRESS) {
          throw Object.assign(new Error('Idempotent command is already in progress'), {
            status: 409,
            code: IDEMPOTENCY_CODES.IN_FLIGHT,
          });
        }
      }

      const now = new Date();
      const rec = existing && existing.status === IDEMPOTENCY_STATUSES.FAILED
        ? existing
        : {
            principalId,
            tenantId,
            commandType,
            idempotencyKey,
            fingerprint,
            result: null,
            createdAt: now,
            expiresAt: new Date(now.getTime() + ttlMs),
          };
      rec.fingerprint = fingerprint;
      rec.status = IDEMPOTENCY_STATUSES.IN_PROGRESS;
      rec.createdAt = now;
      rec.expiresAt = new Date(now.getTime() + ttlMs);
      records.set(key, rec);

      try {
        const result = await perform();
        rec.status = IDEMPOTENCY_STATUSES.COMPLETED;
        rec.result = result;
        return { replay: false, code: 'performed', result };
      } catch (err) {
        rec.status = IDEMPOTENCY_STATUSES.FAILED;
        throw err;
      }
    });
  }

  function size() {
    return records.size;
  }

  return {
    kind: IDEMPOTENCY_STORE_KINDS.IN_MEMORY,
    execute,
    size,
    purgeExpired,
    _records: records,
  };
}

/** @deprecated Alias for tests that still import the 17D-1 name. In-memory only. */
export function createIdempotencyStore(options) {
  return createInMemoryIdempotencyStore(options);
}

export function isSharedPersistentIdempotencyStore(store) {
  return Boolean(store && store.kind === IDEMPOTENCY_STORE_KINDS.MONGO);
}
