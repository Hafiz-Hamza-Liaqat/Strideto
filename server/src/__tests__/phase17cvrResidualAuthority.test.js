import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  canonicalizeStoredPhone,
  formatPhoneE164,
  normalizeNationalNumberInput,
} from '../../../shared/international/phone.js';
import { publicEmailVerifyFailure } from '../services/auth/realmEmailVerification.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
function read(rel) {
  return readFileSync(path.join(serverSrc, rel), 'utf8');
}

const auth = read('controllers/authController.js');
check(/consumeRealmVerificationToken/.test(auth), 'student verify uses the shared realm consume path');
check(/publicEmailVerifyFailure/.test(auth), 'student verify returns the shared public failure mapper');
check(!/error: 'Verification token is required'/.test(auth), 'missing token does not use an enumerating required-token message');

const expired = publicEmailVerifyFailure('TOKEN_EXPIRED');
check(expired.body.code === 'INVALID_OR_EXPIRED', 'expired tokens stay INVALID_OR_EXPIRED');
check(!String(expired.body.error).includes('Mongo') && !String(expired.body.error).includes('account'), 'expired copy is safe');
const used = publicEmailVerifyFailure('TOKEN_INVALID');
check(used.body.code === 'ALREADY_USED', 'unknown/consumed tokens map to ALREADY_USED without revealing existence');
check(used.body.error.includes('can no longer be used'), 'replay copy is the non-enumerating used-link message');

const realmCtrl = read('controllers/realmVerifyEmailController.js');
check(/publicEmailVerifyFailure/.test(realmCtrl), 'legacy realm verify controller uses the same public mapper');

check(canonicalizeStoredPhone('letters-only').ok === false, 'backend rejects malformed phone');
check(canonicalizeStoredPhone('+923317911012').ok === true, 'backend accepts canonical PK E.164');
check(formatPhoneE164({ countryCode: 'US', nationalNumber: '4155552671' }) === '+14155552671', 'US stored E.164');
check(normalizeNationalNumberInput('abc331xyz') === '331', 'shared digits-only normalizer');
check(canonicalizeStoredPhone({ e164: '+14155552671', phoneVerified: true, country: 'US' }).value === '+14155552671', 'client country/verified metadata is not trusted');

const employerReg = read('controllers/employerAuthController.js');
check(/canonicalizeStoredPhone\(phone\)/.test(employerReg), 'employer register no longer persists raw malformed phone');
check(!/normalizePhone\(raw\) \|\| raw/.test(employerReg), 'employer register does not fall back to raw text');

console.log(`phase17cvrResidualAuthority.test.js: ${count} assertions passed`);
