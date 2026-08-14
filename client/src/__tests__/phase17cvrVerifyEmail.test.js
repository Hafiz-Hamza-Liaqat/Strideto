import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  VERIFY_EMAIL_STATES,
  VERIFY_EMAIL_REALMS,
  VERIFY_EMAIL_MESSAGES,
  captureVerifyEmailSecrets,
  initialVerifyEmailStatus,
  isWellFormedVerifyToken,
  mapResendHttpResult,
  mapVerifyEmailHttpError,
  nextConsumeGate,
  shouldStartVerification,
  stripSecretQueryParams,
  verifiedSearchParams,
} from '../auth/verifyEmailLifecycle.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
function read(rel) {
  return readFileSync(path.join(clientSrc, rel), 'utf8');
}

const hex = 'a'.repeat(64);
const page = read('pages/Auth/VerifyEmail.jsx');
const hook = read('hooks/useSecretQueryToken.js');
const routes = read('routes/index.jsx');
const axiosBase = read('services/axiosBase.js');

check(initialVerifyEmailStatus({ token: '', pending: false, verified: false }) === VERIFY_EMAIL_STATES.IDLE, 'A. no-token route is IDLE (resend form)');
check(initialVerifyEmailStatus({ token: hex, pending: false, verified: false }) === VERIFY_EMAIL_STATES.VERIFYING, 'B. valid token first render is VERIFYING, not generic loading');
check(VERIFY_EMAIL_MESSAGES.VERIFYING === 'Verifying…', 'B. verifying copy is bounded Verifying…');
check(!/window\.location\.reload\(/.test(page), 'B. no hard reload');
check(!/setInterval\(/.test(page), 'B. no polling');

check(mapVerifyEmailHttpError({ response: { status: 400, data: { code: 'INVALID_OR_EXPIRED' } } }).state === VERIFY_EMAIL_STATES.INVALID_OR_EXPIRED, 'C/D. invalid/expired maps to INVALID_OR_EXPIRED');
check(mapVerifyEmailHttpError({ response: { status: 400, data: { code: 'TOKEN_EXPIRED' } } }).message.includes('invalid or has expired'), 'D. expired uses the safe expired copy');
check(mapVerifyEmailHttpError({ response: { status: 400, data: { code: 'ALREADY_USED' } } }).state === VERIFY_EMAIL_STATES.ALREADY_USED, 'E. consumed/replay maps to ALREADY_USED');
check(mapVerifyEmailHttpError({ response: { status: 400, data: { code: 'TOKEN_INVALID' } } }).message.includes('can no longer be used'), 'E. replay copy does not enumerate accounts');
check(!isWellFormedVerifyToken('not-a-token'), 'F. malformed token is rejected before consume');
check(isWellFormedVerifyToken(hex), 'F. 32-byte hex token is well-formed');

for (const realm of VERIFY_EMAIL_REALMS) {
  const snap = captureVerifyEmailSecrets(`token=${hex}&realm=${realm}`);
  check(snap.realm === realm && snap.token === hex, `G-J. ${realm} realm is captured from the query`);
}

const stripped = stripSecretQueryParams(`token=${hex}&realm=agent&pending=1`);
check(!stripped.get('token') && stripped.get('realm') === 'agent', 'K. token is stripped; realm remains');
check(verifiedSearchParams('employer').get('verified') === '1' && verifiedSearchParams('employer').get('realm') === 'employer', 'K. success URL is verified=1 without the secret');
check(verifiedSearchParams('user').get('realm') == null, 'K. student success URL has no realm param');

const first = nextConsumeGate(false);
const second = nextConsumeGate(first.alreadyStarted);
check(first.start && !second.start, 'L. StrictMode/rerender does not start a second consume');
check(!shouldStartVerification({ token: hex, alreadyStarted: true }), 'L. already-started gate blocks duplicate consume');

check(mapVerifyEmailHttpError({ message: 'Network Error' }).state === VERIFY_EMAIL_STATES.ERROR_SAFE, 'M. network failure exits VERIFYING');
check(mapResendHttpResult(null).state === VERIFY_EMAIL_STATES.RESEND_ACCEPTED, 'N. resend success is RESEND_ACCEPTED');
check(mapResendHttpResult({ response: { status: 429 } }).state === VERIFY_EMAIL_STATES.RATE_LIMITED, 'O. resend 429 is RATE_LIMITED');

const mapped = mapVerifyEmailHttpError({ response: { status: 500, data: { error: 'MongoServerError E11000 userId=abc' } } });
check(!mapped.message.includes('Mongo') && !mapped.message.includes('userId') && !mapped.message.includes('E11000'), 'P. user-facing errors are non-enumerating');
check(!/err\.response\?\.data\?\.error/.test(page), 'P. verify page does not render raw API errors');
check(!/localStorage\.(set|get|remove)Item|sessionStorage\./.test(page) && !/localStorage\.(set|get|remove)Item|sessionStorage\./.test(hook), 'token is not persisted in web storage');
check(!/console\.(log|info|debug)\(.*token/.test(page), 'raw token is not logged');

check(/consumedRef/.test(page) && /nextConsumeGate/.test(page), 'consume gate is wired in the page');
check(!/let cancelled = false/.test(page) && !/if \(cancelled\) return/.test(page), 'in-flight verify is not cancelled when the URL is replaced');
check(/import VerifyEmail from '\.\.\/pages\/Auth\/VerifyEmail'/.test(routes), 'verify-email is eagerly imported so Mailpit first-navigation is not stuck on the lazy fallback');
check(/\/auth\/verify-email/.test(axiosBase), 'verify-email is on the no-refresh allowlist');
check(/useSecretQueryToken/.test(page) && /setSearchParams\(next, \{ replace: true \}\)/.test(page), 'token is captured then replaced from history');
check(/does not verify an organization/.test(page), 'email verify does not imply org verification');
check(/30 minutes/.test(page) && /once/.test(page), 'pending copy still explains expiry and one-time use');
check(/handleResend/.test(page) && /resendVerification\(target, realm\)/.test(page), 'resend remains realm-aware and available without refresh');
check(/VERIFYING/.test(page) && !/status === 'loading'/.test(page), 'generic loading status is gone');

console.log(`phase17cvrVerifyEmail.test.js: ${count} assertions passed`);
