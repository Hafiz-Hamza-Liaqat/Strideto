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
export const IDEMPOTENCY_STATUSES = Object.freeze({
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CONFLICT: 'conflict',
});

export const IDEMPOTENCY_CODES = Object.freeze({
  REPLAY: 'idempotency_replay',
  CONFLICT: 'idempotency_conflict',
  IN_FLIGHT: 'idempotency_in_flight',
});

/** Default retention: 7 days. Bounded; not infinite. */
export const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function idempotencyRecordKey({ principalId, tenantId, commandType, idempotencyKey }) {
  return [principalId || '', tenantId || '', commandType || '', idempotencyKey || ''].join(':');
}

export function createIdempotencyStore({ ttlMs = IDEMPOTENCY_TTL_MS } = {}) {
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
      }

      const now = new Date();
      const rec = {
        principalId,
        tenantId,
        commandType,
        idempotencyKey,
        fingerprint,
        status: IDEMPOTENCY_STATUSES.IN_PROGRESS,
        result: null,
        createdAt: now,
        expiresAt: new Date(now.getTime() + ttlMs),
      };
      records.set(key, rec);

      const result = await perform();
      rec.status = IDEMPOTENCY_STATUSES.COMPLETED;
      rec.result = result;
      return { replay: false, code: 'performed', result };
    });
  }

  function size() {
    return records.size;
  }

  return { execute, size, purgeExpired, _records: records };
}
