/**
 * SEC-3B — refresh-token hash primitive tests.
 * Run: node src/__tests__/refreshTokenHash.test.js
 */
import assert from 'node:assert/strict';
import { hashRefreshToken } from '../services/auth/refreshTokenHash.js';

let assertions = 0;
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}
function check(value, message) {
  assert.ok(value, message);
  assertions += 1;
}
function throws(fn, message) {
  assert.throws(fn);
  assertions += 1;
  void message;
}

const tokenA = 'a'.repeat(64);
const tokenB = 'b'.repeat(64);

// Deterministic.
const hashA1 = hashRefreshToken(tokenA);
const hashA2 = hashRefreshToken(tokenA);
equal(hashA1, hashA2, 'hashing the same token twice produces the same hash');

// Different tokens produce different hashes.
const hashB = hashRefreshToken(tokenB);
check(hashA1 !== hashB, 'different tokens produce different hashes');

// Output shape — lowercase hex, 64 chars (SHA-256).
check(
  /^[0-9a-f]{64}$/.test(hashA1),
  'output is deterministic lowercase hex, 64 characters'
);

// Raw token is never returned.
check(hashA1 !== tokenA, 'the hash is never equal to the raw token');

// Rejects empty/non-string input.
throws(() => hashRefreshToken(''), 'empty string is rejected');
throws(() => hashRefreshToken(null), 'null is rejected');
throws(() => hashRefreshToken(undefined), 'undefined is rejected');
throws(() => hashRefreshToken(12345), 'number is rejected');
throws(() => hashRefreshToken({}), 'object is rejected');
throws(() => hashRefreshToken([]), 'array is rejected');

// SEC-3B.1: whitespace-only input policy is explicit — rejected, not
// silently hashed as if it were meaningful token material.
throws(() => hashRefreshToken(' '), 'a single space is rejected');
throws(() => hashRefreshToken('   '), 'multiple spaces are rejected');
throws(
  () => hashRefreshToken('\t\n\r '),
  'tabs/newlines/mixed whitespace are rejected'
);

// SEC-3B.1: a valid, non-whitespace-only token is hashed using its exact
// supplied bytes — it is never trimmed before hashing.
const padded = `  ${tokenA}  `;
const hashPadded = hashRefreshToken(padded);
const hashTrimmed = hashRefreshToken(padded.trim());
check(
  hashPadded !== hashTrimmed,
  'a token is hashed using its exact bytes, never implicitly trimmed'
);
equal(
  hashPadded,
  hashRefreshToken(padded),
  'hashing the padded token remains deterministic'
);

console.log(`refreshTokenHash.test.js: ${assertions} assertions passed`);
