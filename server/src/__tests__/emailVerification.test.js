/**
 * Pure-function tests for email verification policy & token hashing.
 * Run: node src/__tests__/emailVerification.test.js
 */
import assert from 'assert';
import {
  applyVerificationTokenFields,
  clearVerificationTokenFields,
  createRawVerificationToken,
  hashVerificationToken,
  isEmailVerificationRequired,
  EMAIL_VERIFY_ENFORCE_FROM,
  VERIFY_TOKEN_TTL_MS,
} from '../utils/emailVerification.js';

assert.strictEqual(VERIFY_TOKEN_TTL_MS, 30 * 60 * 1000);

const raw = createRawVerificationToken();
assert.ok(raw.length >= 32);
assert.strictEqual(hashVerificationToken(raw), hashVerificationToken(raw));
assert.notStrictEqual(hashVerificationToken(raw), hashVerificationToken(`${raw}x`));

const enforceFrom = new Date(EMAIL_VERIFY_ENFORCE_FROM);

assert.strictEqual(
  isEmailVerificationRequired({ emailVerified: true, role: 'User', createdAt: new Date() }),
  false,
);
assert.strictEqual(
  isEmailVerificationRequired({ emailVerified: false, role: 'Admin', createdAt: new Date() }),
  false,
);
assert.strictEqual(
  isEmailVerificationRequired({
    emailVerified: false,
    role: 'User',
    createdAt: new Date(enforceFrom.getTime() - 60_000),
  }),
  false,
  'legacy users before enforce-from remain usable',
);
assert.strictEqual(
  isEmailVerificationRequired({
    emailVerified: false,
    role: 'User',
    createdAt: new Date(enforceFrom.getTime() + 60_000),
  }),
  true,
  'new unverified users must verify',
);

const fakeUser = {};
const issued = applyVerificationTokenFields(fakeUser, 'abc123token');
assert.strictEqual(issued, 'abc123token');
assert.ok(fakeUser.emailVerificationToken);
assert.ok(fakeUser.emailVerificationExpires instanceof Date);
clearVerificationTokenFields(fakeUser);
assert.strictEqual(fakeUser.emailVerificationToken, undefined);
assert.strictEqual(fakeUser.emailVerificationExpires, undefined);

console.log('emailVerification tests passed.');
