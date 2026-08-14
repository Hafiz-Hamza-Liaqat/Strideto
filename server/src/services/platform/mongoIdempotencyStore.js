import {
  IDEMPOTENCY_CODES,
  IDEMPOTENCY_IN_FLIGHT_MAX_WAIT_MS,
  IDEMPOTENCY_IN_FLIGHT_POLL_MS,
  IDEMPOTENCY_IN_PROGRESS_STALE_MS,
  IDEMPOTENCY_STATUSES,
  IDEMPOTENCY_STORE_KINDS,
  IDEMPOTENCY_TTL_MS,
} from '../../../../shared/platform/idempotency.js';
import { IdempotencyRecord } from '../../models/platform/IdempotencyRecord.js';

function isDuplicateKey(err) {
  return (
    err?.code === 11000 ||
    err?.code === 11001 ||
    err?.cause?.code === 11000 ||
    err?.cause?.code === 11001
  );
}

function conflictError() {
  return Object.assign(new Error('Idempotency key reused with a different request'), {
    status: 409,
    code: IDEMPOTENCY_CODES.CONFLICT,
  });
}

function inFlightError() {
  return Object.assign(new Error('Idempotent command is already in progress'), {
    status: 409,
    code: IDEMPOTENCY_CODES.IN_FLIGHT,
  });
}

function logicalKey(input) {
  return {
    principalId: input.principalId || '',
    tenantId: input.tenantId || '',
    commandType: input.commandType,
    idempotencyKey: input.idempotencyKey,
  };
}

function sleep(ms, sleepFn) {
  return sleepFn(ms);
}

/**
 * Shared Mongo idempotency store. Safe across api-a / api-b replicas.
 * Reservation uses the unique (principal, tenant, commandType, idempotencyKey) index.
 */
export function createMongoIdempotencyStore({
  model = IdempotencyRecord,
  ttlMs = IDEMPOTENCY_TTL_MS,
  staleMs = IDEMPOTENCY_IN_PROGRESS_STALE_MS,
  maxWaitMs = IDEMPOTENCY_IN_FLIGHT_MAX_WAIT_MS,
  pollMs = IDEMPOTENCY_IN_FLIGHT_POLL_MS,
  now = () => Date.now(),
  sleep: sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  async function load(key) {
    return model.findOne(key);
  }

  async function waitForCompletion(key, fingerprint) {
    const deadline = now() + maxWaitMs;
    while (now() < deadline) {
      await sleep(pollMs, sleepFn);
      const rec = await load(key);
      if (!rec) return null;
      if (rec.fingerprint !== fingerprint) throw conflictError();
      if (rec.status === IDEMPOTENCY_STATUSES.COMPLETED) {
        return {
          replay: true,
          code: IDEMPOTENCY_CODES.REPLAY,
          result: rec.resultMeta,
        };
      }
      if (rec.status === IDEMPOTENCY_STATUSES.FAILED) return rec;
      if (rec.status === IDEMPOTENCY_STATUSES.IN_PROGRESS && isStale(rec)) return rec;
    }
    throw inFlightError();
  }

  function isStale(rec) {
    const created = rec.createdAt ? new Date(rec.createdAt).getTime() : 0;
    return now() - created >= staleMs;
  }

  async function tryTakeOverStale(key, fingerprint) {
    const staleBefore = new Date(now() - staleMs);
    return model.findOneAndUpdate(
      {
        ...key,
        fingerprint,
        status: IDEMPOTENCY_STATUSES.IN_PROGRESS,
        createdAt: { $lte: staleBefore },
      },
      {
        $set: {
          createdAt: new Date(now()),
          expiresAt: new Date(now() + ttlMs),
        },
      },
      { new: true }
    );
  }

  async function tryResumeFailed(key, fingerprint) {
    return model.findOneAndUpdate(
      {
        ...key,
        fingerprint,
        status: IDEMPOTENCY_STATUSES.FAILED,
      },
      {
        $set: {
          status: IDEMPOTENCY_STATUSES.IN_PROGRESS,
          createdAt: new Date(now()),
          expiresAt: new Date(now() + ttlMs),
          resultMeta: {},
          resultRef: '',
        },
      },
      { new: true }
    );
  }

  async function performAndComplete(key, fingerprint, perform) {
    try {
      const result = await perform();
      const completed = await model.findOneAndUpdate(
        { ...key, fingerprint, status: IDEMPOTENCY_STATUSES.IN_PROGRESS },
        {
          $set: {
            status: IDEMPOTENCY_STATUSES.COMPLETED,
            resultMeta: result && typeof result === 'object' ? result : { value: result },
          },
        },
        { new: true }
      );
      if (!completed) {
        const rec = await load(key);
        if (rec?.status === IDEMPOTENCY_STATUSES.COMPLETED && rec.fingerprint === fingerprint) {
          return { replay: true, code: IDEMPOTENCY_CODES.REPLAY, result: rec.resultMeta };
        }
        throw Object.assign(new Error('Idempotency reservation lost'), {
          status: 503,
          code: 'idempotency_reservation_lost',
        });
      }
      return { replay: false, code: 'performed', result };
    } catch (err) {
      if (err?.code === IDEMPOTENCY_CODES.CONFLICT || err?.code === IDEMPOTENCY_CODES.IN_FLIGHT) {
        throw err;
      }
      await model.findOneAndUpdate(
        { ...key, fingerprint, status: IDEMPOTENCY_STATUSES.IN_PROGRESS },
        { $set: { status: IDEMPOTENCY_STATUSES.FAILED } }
      );
      throw err;
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
    if (typeof perform !== 'function') {
      throw Object.assign(new Error('perform is required'), {
        status: 400,
        code: 'idempotency_perform_required',
      });
    }

    const key = logicalKey({ principalId, tenantId, commandType, idempotencyKey });
    const createdAt = new Date(now());
    try {
      await model.create({
        ...key,
        fingerprint,
        status: IDEMPOTENCY_STATUSES.IN_PROGRESS,
        resultMeta: {},
        resultRef: '',
        createdAt,
        expiresAt: new Date(createdAt.getTime() + ttlMs),
      });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      const existing = await load(key);
      if (!existing) {
        throw Object.assign(new Error('Idempotency reservation raced'), {
          status: 503,
          code: 'idempotency_reservation_lost',
        });
      }
      if (existing.fingerprint !== fingerprint) throw conflictError();
      if (existing.status === IDEMPOTENCY_STATUSES.COMPLETED) {
        return {
          replay: true,
          code: IDEMPOTENCY_CODES.REPLAY,
          result: existing.resultMeta,
        };
      }
      if (existing.status === IDEMPOTENCY_STATUSES.IN_PROGRESS && !isStale(existing)) {
        const waited = await waitForCompletion(key, fingerprint);
        if (waited && waited.replay) return waited;
        if (waited && waited.status === IDEMPOTENCY_STATUSES.FAILED) {
          const resumed = await tryResumeFailed(key, fingerprint);
          if (resumed) return performAndComplete(key, fingerprint, perform);
        }
        if (waited && waited.status === IDEMPOTENCY_STATUSES.IN_PROGRESS) {
          const taken = await tryTakeOverStale(key, fingerprint);
          if (taken) return performAndComplete(key, fingerprint, perform);
        }
        throw inFlightError();
      }
      if (existing.status === IDEMPOTENCY_STATUSES.IN_PROGRESS && isStale(existing)) {
        const taken = await tryTakeOverStale(key, fingerprint);
        if (!taken) {
          const waited = await waitForCompletion(key, fingerprint);
          if (waited && waited.replay) return waited;
          throw inFlightError();
        }
        return performAndComplete(key, fingerprint, perform);
      }
      if (existing.status === IDEMPOTENCY_STATUSES.FAILED) {
        const resumed = await tryResumeFailed(key, fingerprint);
        if (!resumed) {
          const rec = await load(key);
          if (rec?.status === IDEMPOTENCY_STATUSES.COMPLETED && rec.fingerprint === fingerprint) {
            return { replay: true, code: IDEMPOTENCY_CODES.REPLAY, result: rec.resultMeta };
          }
          if (rec?.fingerprint && rec.fingerprint !== fingerprint) throw conflictError();
          throw inFlightError();
        }
        return performAndComplete(key, fingerprint, perform);
      }
      throw conflictError();
    }

    return performAndComplete(key, fingerprint, perform);
  }

  return {
    kind: IDEMPOTENCY_STORE_KINDS.MONGO,
    execute,
  };
}
