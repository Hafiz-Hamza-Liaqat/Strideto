import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createAccessDenylistService } from '../services/auth/accessDenylist.js';

assert.strictEqual(
  mongoose.connection.readyState,
  0,
  'must not be connected to MongoDB'
);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

function fakeRedisClient() {
  const store = new Map();
  return {
    store,
    async set(key, value, mode, ttlSeconds) {
      assert.strictEqual(mode, 'EX');
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
  };
}

// --- Input validation --------------------------------------------------------
{
  const svc = createAccessDenylistService({ getClient: async () => null });
  const badWrite = await svc.denylistJti('', 60);
  check(badWrite.code === 'INVALID_INPUT', 'empty jti rejected on write');
  const badCheck = await svc.isJtiDenylisted(null);
  check(badCheck.code === 'INVALID_INPUT', 'non-string jti rejected on check');
}

// --- Already-expired token requires no denylist entry -----------------------
{
  const client = fakeRedisClient();
  const svc = createAccessDenylistService({ getClient: async () => client });
  const result = await svc.denylistJti('jti-1', 0);
  check(result.code === 'DENYLIST_SKIPPED_EXPIRED', 'zero TTL skips the write');
  check(
    client.store.size === 0,
    'no entry written for an already-expired token'
  );

  const negative = await svc.denylistJti('jti-2', -5);
  check(
    negative.code === 'DENYLIST_SKIPPED_EXPIRED',
    'negative TTL also skips the write'
  );
}

// --- Shared store: write then check ------------------------------------------
{
  const client = fakeRedisClient();
  const svc = createAccessDenylistService({ getClient: async () => client });

  const before = await svc.isJtiDenylisted('jti-3');
  check(
    before.code === 'CHECKED' && before.denylisted === false,
    'not denylisted before write'
  );

  const write = await svc.denylistJti('jti-3', 300);
  check(write.code === 'DENYLISTED', 'write succeeds');

  const after = await svc.isJtiDenylisted('jti-3');
  check(
    after.code === 'CHECKED' && after.denylisted === true,
    'denylisted after write'
  );
}

// --- Idempotent repeat write --------------------------------------------------
{
  const client = fakeRedisClient();
  const svc = createAccessDenylistService({ getClient: async () => client });
  await svc.denylistJti('jti-4', 100);
  const second = await svc.denylistJti('jti-4', 10);
  check(
    second.code === 'DENYLISTED',
    'repeated write with a shorter TTL is safe'
  );
  const check1 = await svc.isJtiDenylisted('jti-4');
  check(
    check1.denylisted === true,
    'still denylisted after the second, shorter write'
  );
}

// --- Storage failure on write/check -------------------------------------------
{
  const throwingClient = {
    async set() {
      throw new Error('redis down');
    },
    async get() {
      throw new Error('redis down');
    },
  };
  const svc = createAccessDenylistService({
    getClient: async () => throwingClient,
  });
  const write = await svc.denylistJti('jti-5', 60);
  check(
    write.code === 'STORAGE_FAILURE',
    'write failure maps to STORAGE_FAILURE'
  );
  const readResult = await svc.isJtiDenylisted('jti-5');
  check(
    readResult.code === 'STORAGE_FAILURE',
    'read failure maps to STORAGE_FAILURE'
  );
}

// --- Required-shared-store mode: no client available fails closed, never falls back to Map ---
{
  const svc = createAccessDenylistService({
    requireSharedStore: true,
    getClient: async () => null,
  });
  const write = await svc.denylistJti('jti-6', 60);
  check(
    write.code === 'STORAGE_FAILURE',
    'required-store write with no client fails closed'
  );
  const readResult = await svc.isJtiDenylisted('jti-6');
  check(
    readResult.code === 'STORAGE_FAILURE',
    'required-store read with no client fails closed'
  );
}

// --- getClient() itself throwing is treated identically to a null client ------
{
  const svc = createAccessDenylistService({
    requireSharedStore: true,
    getClient: async () => {
      throw new Error('connect failed');
    },
  });
  const write = await svc.denylistJti('jti-7', 60);
  check(
    write.code === 'STORAGE_FAILURE',
    'getClient() throwing fails closed under required-store mode'
  );
}

// --- Non-required mode: no client falls back to an in-memory store, still usable ---
{
  const svc = createAccessDenylistService({
    requireSharedStore: false,
    getClient: async () => null,
  });
  const write = await svc.denylistJti('jti-8', 60);
  check(
    write.code === 'DENYLISTED',
    'fallback write succeeds outside required-store mode'
  );
  const readResult = await svc.isJtiDenylisted('jti-8');
  check(
    readResult.denylisted === true,
    'fallback check reflects the fallback write'
  );
}

console.log(`accessDenylist.test.js: ${count} assertions passed`);
