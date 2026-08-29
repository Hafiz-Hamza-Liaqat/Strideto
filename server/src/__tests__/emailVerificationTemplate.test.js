/**
 * Verification email template UI polish — focused rendering and isolation checks.
 * Run: node server/src/__tests__/emailVerificationTemplate.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderEmailTemplate } from '../templates/emailTemplates.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
const read = (rel) => readFileSync(path.join(serverSrc, rel), 'utf8');

const VERIFY_URL = 'https://strideto.com/verify-email?token=test-token-ui';
const rendered = renderEmailTemplate('emailVerification', 'en', {
  name: 'Alex',
  url: VERIFY_URL,
  expiresMinutes: 30,
});

// EMAIL-UI-01 — tagline renders exactly
{
  check(rendered.html.includes('Every Step Toward Success.'), 'EMAIL-UI-01: tagline present in HTML');
  check(!rendered.html.includes('Every Steps Toward Success.'), 'EMAIL-UI-01: no plural typo');
  check(!rendered.html.includes('Every Step Towards Success.'), 'EMAIL-UI-01: no towards typo');
}

// EMAIL-UI-02 — primary button label
{
  check(rendered.html.includes('Verify email'), 'EMAIL-UI-02: Verify email label in HTML');
}

// EMAIL-UI-03 — verification URL inserted in button href and plain-link fallback
{
  check(rendered.html.includes(`href="${VERIFY_URL}"`), 'EMAIL-UI-03: URL in href attributes');
  check(rendered.html.includes(VERIFY_URL), 'EMAIL-UI-03: URL visible in fallback link text');
  check(rendered.text.includes(VERIFY_URL), 'EMAIL-UI-03: URL in plain-text part');
}

// EMAIL-UI-04 — token/URL generation implementation untouched
{
  const tokenSrc = read('utils/emailVerification.js');
  check(/hashVerificationToken/.test(tokenSrc), 'EMAIL-UI-04: hashVerificationToken still present');
  check(/VERIFY_TOKEN_TTL_MS/.test(tokenSrc), 'EMAIL-UI-04: VERIFY_TOKEN_TTL_MS still present');
  check(/buildVerifyEmailUrl/.test(tokenSrc), 'EMAIL-UI-04: buildVerifyEmailUrl still present');
  check(/applyVerificationTokenFields/.test(tokenSrc), 'EMAIL-UI-04: applyVerificationTokenFields still present');
  check(!/emailTemplates/.test(tokenSrc), 'EMAIL-UI-04: token module does not import templates');
}

// EMAIL-UI-05 — verification SMTP configuration code untouched
{
  const emailServiceSrc = read('services/emailService.js');
  check(/VERIFICATION_MAIL_USER/.test(emailServiceSrc), 'EMAIL-UI-05: VERIFICATION_MAIL_USER handling intact');
  check(/VERIFICATION_MAIL_PASS/.test(emailServiceSrc), 'EMAIL-UI-05: VERIFICATION_MAIL_PASS handling intact');
  check(/VERIFICATION_MAIL_HOST/.test(emailServiceSrc), 'EMAIL-UI-05: VERIFICATION_MAIL_HOST handling intact');
  check(/VERIFICATION_MAIL_PORT/.test(emailServiceSrc), 'EMAIL-UI-05: VERIFICATION_MAIL_PORT handling intact');
  check(/VERIFICATION_MAIL_SECURE/.test(emailServiceSrc), 'EMAIL-UI-05: VERIFICATION_MAIL_SECURE handling intact');
  check(/VERIFICATION_EMAIL_FROM/.test(emailServiceSrc), 'EMAIL-UI-05: VERIFICATION_EMAIL_FROM handling intact');
  check(/getVerificationTransport/.test(emailServiceSrc), 'EMAIL-UI-05: getVerificationTransport intact');
}

// EMAIL-UI-06 — password reset template/transport behavior untouched
{
  const resetRendered = renderEmailTemplate('passwordReset', 'en', {
    url: 'https://strideto.com/reset?token=reset-only',
    expiresMinutes: 60,
  });
  check(resetRendered.html.includes('Reset password'), 'EMAIL-UI-06: password reset button label intact');
  check(resetRendered.html.includes('background:#F8FAFC'), 'EMAIL-UI-06: password reset still uses shared layout background');
  check(!resetRendered.html.includes('verificationLayout'), 'EMAIL-UI-06: password reset does not use verification layout');
}

// EMAIL-UI-07 — Super Admin configuration untouched
{
  const superAdminScript = read('scripts/provisionProductionSuperAdmin.js');
  check(/STRIDETO_SUPERADMIN_EMAIL/.test(superAdminScript), 'EMAIL-UI-07: STRIDETO_SUPERADMIN_EMAIL config intact');
  check(!/emailVerification/.test(superAdminScript), 'EMAIL-UI-07: Super Admin script does not reference verification template');
}

console.log(`emailVerificationTemplate tests passed (${count} checks).`);
