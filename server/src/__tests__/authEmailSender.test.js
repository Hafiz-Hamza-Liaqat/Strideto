/**
 * Verification-mail SMTP security boundary (registration + resend only).
 * Run: node server/src/__tests__/authEmailSender.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const saved = {
  VERIFICATION_EMAIL_FROM: process.env.VERIFICATION_EMAIL_FROM,
  VERIFICATION_EMAIL_FROM_NAME: process.env.VERIFICATION_EMAIL_FROM_NAME,
  VERIFICATION_EMAIL_FROM_ADDRESS: process.env.VERIFICATION_EMAIL_FROM_ADDRESS,
  VERIFICATION_MAIL_HOST: process.env.VERIFICATION_MAIL_HOST,
  VERIFICATION_MAIL_PORT: process.env.VERIFICATION_MAIL_PORT,
  VERIFICATION_MAIL_USER: process.env.VERIFICATION_MAIL_USER,
  VERIFICATION_MAIL_PASS: process.env.VERIFICATION_MAIL_PASS,
  MAIL_USER: process.env.MAIL_USER,
  MAIL_FROM: process.env.MAIL_FROM,
  MAIL_PASS: process.env.MAIL_PASS,
  MAIL_HOST: process.env.MAIL_HOST,
  NODE_ENV: process.env.NODE_ENV,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const emailSrc = read('server/src/services/emailService.js');
const automationSrc = read('server/src/services/automationService.js');
const realmSrc = read('server/src/services/auth/realmEmailVerification.js');

const {
  getVerificationEmailFromAddress,
  getVerificationSmtpCredentials,
  isVerificationEmailFromConfigured,
  isVerificationSmtpConfigured,
  isVerificationMailReady,
  isLegacyPersonalAuthSender,
  VERIFICATION_EMAIL_TEMPLATE_KEYS,
  DEFAULT_DEV_VERIFICATION_EMAIL_FROM,
  sendTemplatedEmail,
  getDefaultTransport,
  getVerificationTransport,
} = await import('../services/emailService.js');

// VERIFY-SMTP-01 — emailVerification uses verification-specific SMTP credentials
{
  check(/getVerificationTransport/.test(emailSrc), 'VERIFY-SMTP-01: dedicated getVerificationTransport exists');
  check(/VERIFICATION_MAIL_USER/.test(emailSrc), 'VERIFY-SMTP-01: verification transport reads VERIFICATION_MAIL_USER');
  check(/transportKind: 'verification'/.test(emailSrc), 'VERIFY-SMTP-01: verification templates use verification transport');
  check(VERIFICATION_EMAIL_TEMPLATE_KEYS.has('emailVerification'), 'VERIFY-SMTP-01: emailVerification is verification-only template');
}

// VERIFY-SMTP-02 — resend verification uses the same verification transport
{
  check(/templateKey: 'emailVerification'/.test(realmSrc), 'VERIFY-SMTP-02: resend issues emailVerification template');
  check(/verificationDeliveryMode/.test(realmSrc), 'VERIFY-SMTP-02: registration/resend gated by verificationDeliveryMode');
  check(/isVerificationMailReady/.test(automationSrc), 'VERIFY-SMTP-02: automation queue uses verification readiness for emailVerification');
}

// VERIFY-SMTP-03 — verification does not use MAIL_USER or MAIL_PASS in production
{
  process.env.NODE_ENV = 'production';
  process.env.VERIFICATION_EMAIL_FROM = 'Strideto <strideto@gmail.com>';
  process.env.VERIFICATION_MAIL_HOST = 'smtp.gmail.com';
  delete process.env.VERIFICATION_MAIL_USER;
  delete process.env.VERIFICATION_MAIL_PASS;
  process.env.MAIL_HOST = 'smtp.transactional.test';
  process.env.MAIL_USER = 'transactional@example.test';
  process.env.MAIL_PASS = 'transactional-pass-placeholder';
  check(getVerificationSmtpCredentials() === null, 'VERIFY-SMTP-03: production verification creds do not fall back to MAIL_USER/PASS');
  check(isVerificationSmtpConfigured() === false, 'VERIFY-SMTP-03: production verification SMTP not configured without VERIFICATION_MAIL_*');
}

// VERIFY-SMTP-04 — password reset still uses original default SMTP transport
{
  check(!VERIFICATION_EMAIL_TEMPLATE_KEYS.has('passwordReset'), 'VERIFY-SMTP-04: passwordReset excluded from verification transport');
  check(/getDefaultTransport/.test(emailSrc), 'VERIFY-SMTP-04: default transport remains for transactional mail');
  check(/function getFromAddress\(\)/.test(emailSrc), 'VERIFY-SMTP-04: password reset continues MAIL_FROM / MAIL_USER resolver');
  check(/sensitiveTransactionalDeliveryMode/.test(realmSrc), 'VERIFY-SMTP-04: password reset keeps sensitiveTransactionalDeliveryMode on default SMTP');
}

// VERIFY-SMTP-05 — other transactional mail remains on original transport
{
  for (const key of ['welcome', 'applicationReceived', 'contactConfirmation', 'staffInvitation']) {
    check(!VERIFICATION_EMAIL_TEMPLATE_KEYS.has(key), `VERIFY-SMTP-05: ${key} is not routed through verification transport`);
  }
  check(/transportKind = 'default'/.test(emailSrc) || /transportKind: 'default'/.test(emailSrc), 'VERIFY-SMTP-05: default transportKind is default');
}

// VERIFY-SMTP-06 — missing verification SMTP config fails closed in production
{
  process.env.NODE_ENV = 'production';
  process.env.VERIFICATION_EMAIL_FROM = 'Strideto <strideto@gmail.com>';
  delete process.env.VERIFICATION_MAIL_USER;
  delete process.env.VERIFICATION_MAIL_PASS;
  delete process.env.VERIFICATION_MAIL_HOST;
  process.env.MAIL_HOST = 'smtp.example.test';
  process.env.MAIL_USER = 'smtp-user@example.test';
  process.env.MAIL_PASS = 'smtp-pass-placeholder';
  const result = await sendTemplatedEmail('user@example.test', 'emailVerification', 'en', {
    name: 'Test',
    url: 'https://example.test/verify?token=secret-token-value',
  });
  check(
    result.sent === false && result.error === 'verification_smtp_not_configured',
    'VERIFY-SMTP-06: production missing verification SMTP fails with verification_smtp_not_configured'
  );
}

// VERIFY-SMTP-07 — missing verification From config fails closed in production
{
  process.env.NODE_ENV = 'production';
  delete process.env.VERIFICATION_EMAIL_FROM;
  delete process.env.VERIFICATION_EMAIL_FROM_ADDRESS;
  delete process.env.VERIFICATION_EMAIL_FROM_NAME;
  process.env.VERIFICATION_MAIL_HOST = 'smtp.gmail.com';
  process.env.VERIFICATION_MAIL_USER = 'strideto@gmail.com';
  process.env.VERIFICATION_MAIL_PASS = 'app-password-placeholder';
  check(getVerificationEmailFromAddress() === null, 'VERIFY-SMTP-07: production without From config returns null');
  const result = await sendTemplatedEmail('user@example.test', 'emailVerification', 'en', {
    name: 'Test',
    url: 'https://example.test/verify',
  });
  check(
    result.sent === false && result.error === 'verification_sender_not_configured',
    'VERIFY-SMTP-07: production missing verification From fails with verification_sender_not_configured'
  );
}

// VERIFY-SMTP-08 — no fallback to hamza4h761@gmail.com
{
  process.env.NODE_ENV = 'production';
  process.env.VERIFICATION_EMAIL_FROM = 'Strideto <strideto@gmail.com>';
  process.env.VERIFICATION_MAIL_HOST = 'smtp.gmail.com';
  process.env.VERIFICATION_MAIL_USER = 'hamza4h761@gmail.com';
  process.env.VERIFICATION_MAIL_PASS = 'app-password-placeholder';
  check(isVerificationMailReady() === false, 'VERIFY-SMTP-08: legacy personal Gmail blocked for verification SMTP');
  process.env.VERIFICATION_MAIL_USER = 'strideto@gmail.com';
  delete process.env.VERIFICATION_EMAIL_FROM;
  delete process.env.VERIFICATION_EMAIL_FROM_ADDRESS;
  process.env.MAIL_USER = 'hamza4h761@gmail.com';
  const devFrom = getVerificationEmailFromAddress();
  check(!isLegacyPersonalAuthSender(devFrom), 'VERIFY-SMTP-08: verification From does not resolve to legacy personal Gmail');
}

// VERIFY-SMTP-09 — Super Admin identity/configuration unchanged
{
  const ensureAdmin = read('server/src/seed/ensureAdmin.js');
  const superAdmin = read('server/src/scripts/provisionProductionSuperAdmin.js');
  const localSuperAdmin = read('server/src/scripts/provisionLocalSuperAdmin.js');
  check(/ADMIN_EMAIL/.test(ensureAdmin), 'VERIFY-SMTP-09: bootstrap admin uses ADMIN_EMAIL only');
  check(/STRIDETO_SUPERADMIN_EMAIL/.test(superAdmin), 'VERIFY-SMTP-09: SuperAdmin uses STRIDETO_SUPERADMIN_EMAIL only');
  check(/ADMIN_EMAIL/.test(localSuperAdmin), 'VERIFY-SMTP-09: local SuperAdmin provision uses ADMIN_EMAIL');
  check(!/VERIFICATION_MAIL_USER/.test(ensureAdmin), 'VERIFY-SMTP-09: admin bootstrap does not reference verification SMTP');
  check(!/VERIFICATION_MAIL_USER/.test(superAdmin), 'VERIFY-SMTP-09: SuperAdmin provision does not reference verification SMTP');
}

// VERIFY-SMTP-10 — no SMTP credentials exposed through client VITE variables
{
  const clientFiles = [
    'client/vite.config.js',
    'client/src/constants/index.js',
    'client/src/main.jsx',
    'client/src/components/auth/TurnstileField.jsx',
    'client/src/config/careerFeatureFlags.js',
  ];
  for (const rel of clientFiles) {
    const src = read(rel);
    check(!/VITE_VERIFICATION_MAIL_/i.test(src), `VERIFY-SMTP-10: ${rel} has no VITE_VERIFICATION_MAIL_*`);
    check(!/VITE_MAIL_PASS|VITE_SMTP_/i.test(src), `VERIFY-SMTP-10: ${rel} has no VITE mail secret variables`);
    check(!/VERIFICATION_MAIL_PASS|MAIL_PASS/.test(src), `VERIFY-SMTP-10: ${rel} has no server SMTP password references`);
  }
}

// VERIFY-SMTP-11 — no credential/token leakage in verification error logs
{
  check(/verification_email_send_failed/.test(emailSrc), 'VERIFY-SMTP-11: verification send failures use safe log category');
  check(/verification_smtp_not_configured/.test(emailSrc), 'VERIFY-SMTP-11: missing SMTP uses safe error category');
  check(!/logger\.(warn|error)\([^)]*pass/i.test(emailSrc), 'VERIFY-SMTP-11: logs do not include SMTP password fields');
  check(!/logger\.(warn|error)\([^)]*vars\.url/i.test(emailSrc), 'VERIFY-SMTP-11: logs do not include verification URL vars');
  check(!/logger\.(warn|error|info)\([^)]*auth\s*:/i.test(emailSrc), 'VERIFY-SMTP-11: logs do not include SMTP auth objects');
}

// VERIFY-SMTP-12 — development/test behavior remains deterministic and non-secret
{
  process.env.NODE_ENV = 'development';
  delete process.env.VERIFICATION_EMAIL_FROM;
  delete process.env.VERIFICATION_EMAIL_FROM_ADDRESS;
  delete process.env.VERIFICATION_MAIL_USER;
  delete process.env.VERIFICATION_MAIL_PASS;
  delete process.env.VERIFICATION_MAIL_HOST;
  delete process.env.MAIL_HOST;
  delete process.env.MAIL_USER;
  delete process.env.MAIL_PASS;
  check(
    getVerificationEmailFromAddress() === DEFAULT_DEV_VERIFICATION_EMAIL_FROM,
    'VERIFY-SMTP-12: dev verification From uses canonical non-secret default'
  );
  const result = await sendTemplatedEmail('user@example.test', 'emailVerification', 'en', {
    name: 'Test',
    url: 'https://example.test/verify',
  });
  check(result.sent === false && result.placeholder === true, 'VERIFY-SMTP-12: dev without SMTP uses placeholder transport');
  process.env.VERIFICATION_EMAIL_FROM_NAME = 'Strideto';
  process.env.VERIFICATION_EMAIL_FROM_ADDRESS = 'strideto@gmail.com';
  check(
    getVerificationEmailFromAddress() === 'Strideto <strideto@gmail.com>',
    'VERIFY-SMTP-12: configured VERIFICATION_EMAIL_FROM_* resolves deterministically'
  );
}

// Structural isolation — transports are separate entry points
{
  check(typeof getDefaultTransport === 'function', 'VERIFY-SMTP-04: getDefaultTransport exported');
  check(typeof getVerificationTransport === 'function', 'VERIFY-SMTP-01: getVerificationTransport exported');
  check(!/getVerificationTransport\(\)[\s\S]*MAIL_USER/.test(emailSrc.split('getDefaultTransport')[0] || ''), 'VERIFY-SMTP-03: verification transport builder is isolated from default MAIL_USER block');
}

{
  delete process.env.VERIFICATION_EMAIL_FROM;
  delete process.env.VERIFICATION_EMAIL_FROM_ADDRESS;
  check(isVerificationEmailFromConfigured() === false, 'VERIFY-SMTP-07: isVerificationEmailFromConfigured false when unset');
}

restoreEnv();

console.log(`authEmailSender.test.js: ${count} assertions passed`);
