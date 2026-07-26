/**
 * Auth + email-verification policy tests (no DB).
 * Run: node src/__tests__/auth.test.js && node src/__tests__/emailVerification.test.js
 */
import assert from 'assert';
import {
  clearVerificationTokenFields,
  createRawVerificationToken,
  hashVerificationToken,
  isEmailVerificationRequired,
  EMAIL_VERIFY_ENFORCE_FROM,
} from '../utils/emailVerification.js';
import { hashResetToken } from '../utils/tokenStore.js';

function validateEmail(email) {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string') return 'Email is required';
  if (!EMAIL_REGEX.test(String(email).trim().toLowerCase())) return 'Invalid email format';
  return null;
}

function validatePasswordMinLength(pwd) {
  if (!pwd || pwd.length < 8) return 'Password must be at least 8 characters';
  return null;
}

assert(validateEmail('') === 'Email is required');
assert(validateEmail('bad') === 'Invalid email format');
assert(validateEmail('a@b.c') === null);
assert(validatePasswordMinLength('short') !== null);
assert(validatePasswordMinLength('longenough') === null);

// Token hashing — raw never equals stored; hashResetToken === hashVerificationToken
const raw = createRawVerificationToken();
const hashed = hashVerificationToken(raw);
assert.notStrictEqual(raw, hashed);
assert.strictEqual(hashed, hashResetToken(raw));

// One-time clear semantics
const doc = { emailVerificationToken: hashed, emailVerificationExpires: new Date() };
clearVerificationTokenFields(doc);
assert.strictEqual(doc.emailVerificationToken, undefined);
assert.strictEqual(doc.emailVerificationExpires, undefined);

// Login enforcement matrix
const cutoff = new Date(EMAIL_VERIFY_ENFORCE_FROM);
assert.strictEqual(isEmailVerificationRequired({ emailVerified: true, role: 'User', createdAt: new Date() }), false);
assert.strictEqual(isEmailVerificationRequired({ emailVerified: false, role: 'Admin', createdAt: new Date() }), false);
assert.strictEqual(isEmailVerificationRequired({ emailVerified: false, role: 'SuperAdmin', createdAt: new Date() }), false);
assert.strictEqual(
  isEmailVerificationRequired({ emailVerified: false, role: 'User', createdAt: new Date(cutoff.getTime() - 1) }),
  false,
);
assert.strictEqual(
  isEmailVerificationRequired({ emailVerified: false, role: 'User', createdAt: new Date(cutoff.getTime() + 1) }),
  true,
);

console.log('Auth validator + verification policy tests passed.');
