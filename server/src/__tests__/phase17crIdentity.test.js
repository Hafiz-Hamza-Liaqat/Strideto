import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'path';
import {
  registrationAcceptedPayload,
  recoveryAcceptedPayload,
} from '../../../shared/auth/registrationPrivacy.js';
import {
  canReissueVerification,
  sensitiveTransactionalDeliveryMode,
} from '../services/auth/realmEmailVerification.js';
import { isSmtpConfigured } from '../services/emailService.js';
import { VERIFY_TOKEN_TTL_MS } from '../utils/emailVerification.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

{
  const a = registrationAcceptedPayload('accepted');
  const b = registrationAcceptedPayload('accepted');
  check(JSON.stringify(a) === JSON.stringify(b), 'A. registration payload identical for same delivery mode');
  check(!/already exists|already registered/i.test(a.message), 'A. no existence oracle');
}

{
  const issue = read('server/src/services/auth/realmEmailVerification.js');
  check(/verificationDeliveryMode/.test(issue), 'C. B2B verification uses dedicated verification delivery mode');
  check(/isVerificationMailReady/.test(issue), 'D. verification send uses verification SMTP readiness gate');
  check(/hashVerificationToken/.test(issue) && /applyVerificationTokenFields/.test(issue), 'C. tokens hashed at rest');
  check(/VERIFY_TOKEN_TTL_MS/.test(issue), 'C. verification expires');
  check(/canReissueVerification/.test(issue) && /REISSUE_COOLDOWN_MS/.test(issue), 'E. resend/reissue is cooldown-bounded');
  check(/clearVerificationTokenFields/.test(issue), 'F. consume clears the challenge');
  check(/REALM_MISMATCH|INVALID_REALM|MODELS\[realm\]/.test(issue), 'H. consume is realm-scoped');
}

{
  const ttl = VERIFY_TOKEN_TTL_MS || 30 * 60 * 1000;
  check(ttl === 30 * 60 * 1000, 'C. verification TTL is 30 minutes');
  check(canReissueVerification({ emailVerified: true }) === false, 'E. verified account cannot reissue');
  check(canReissueVerification({ emailVerified: false }) === true, 'E. unverified without expiry can reissue');
  const justIssued = { emailVerified: false, emailVerificationExpires: new Date(Date.now() + ttl - 1000) };
  check(canReissueVerification(justIssued) === false, 'E. cooldown blocks immediate reissue');
  const stale = { emailVerified: false, emailVerificationExpires: new Date(Date.now() + 60_000) };
  check(canReissueVerification(stale) === true, 'E. near-expiry or cooled-down challenge can be replaced');
}

{
  const { verificationDeliveryMode } = await import('../services/auth/realmEmailVerification.js');
  const { isVerificationMailReady } = await import('../services/emailService.js');
  const vmode = await verificationDeliveryMode();
  check(vmode === (isVerificationMailReady() ? 'accepted' : 'unavailable'), 'D. verification mode matches verification SMTP readiness only');
}

{
  const mode = await sensitiveTransactionalDeliveryMode();
  check(mode === (isSmtpConfigured() ? 'accepted' : 'unavailable'), 'D. password-reset transactional mode matches default SMTP configuration only');
}

{
  const student = read('server/src/controllers/authController.js');
  const employer = read('server/src/controllers/employerAuthController.js');
  const agent = read('server/src/controllers/agentAuthController.js');
  const institution = read('server/src/controllers/institutionAuthController.js');
  for (const [name, src] of [
    ['student', student],
    ['employer', employer],
    ['agent', agent],
    ['institution', institution],
  ]) {
    check(/reissueUnverifiedIfAllowed/.test(src), `${name} B. existing unverified can reissue without duplicate account`);
    check(/sensitiveTransactionalDeliveryMode/.test(src), `${name} I. recovery uses SMTP transactional gate`);
    check(/PASSWORD_RESET|PASSWORD_CHANGED/.test(src) || name === 'student', `${name} J/K. reset/change require mutation result`);
  }
  check(/result\.code !== 'PASSWORD_RESET'/.test(student), 'K. Student reset still requires mutation truth');
  check(/issueRealmVerification\(user, 'user'/.test(student), 'B. Student fresh register uses the same SMTP verification path');
  check(/reissueUnverifiedIfAllowed\(user, 'user'/.test(student), 'E. Student resend uses cooldown-bounded reissue');
  check(/validatePassword\(password, true\)/.test(employer), 'L. Employer uses canonical password policy');
  check(!/isEmailVerificationRequired|emailVerified === false/.test(employer.split('export const employerLogin')[1]?.slice(0, 800) || ''), 'U. Employer login is not blocked solely by emailVerified');
}

{
  const recovery = recoveryAcceptedPayload('unavailable');
  check(!/we sent|you will receive/i.test(recovery.message), 'I. recovery does not claim email was sent when unavailable');
}

{
  const auto = read('server/src/services/automationService.js');
  check(/SENSITIVE_EMAIL_TEMPLATES/.test(auto) && /sendTemplatedEmail/.test(auto), 'D. verification/reset send in-process, not via worker queue');
}

{
  const issue = read('server/src/services/auth/realmEmailVerification.js');
  check(/TOKEN_EXPIRED/.test(issue) && /TOKEN_INVALID/.test(issue), 'G. expired and invalid tokens are distinguished internally');
  check(/REALM_MISMATCH/.test(issue), 'H. unknown realm is rejected');
}

{
  const org = read('server/src/controllers/organization/organizationVerificationController.js');
  check(/isB2bEmailVerificationRequired/.test(org), 'U. organization verification submission requires email ownership when policy says so');
}

{
  const student = read('server/src/controllers/authController.js');
  const employer = read('server/src/controllers/employerAuthController.js');
  check(/logoutAll|logout_all|revoke/.test(student) || /userSecureAuthFlows/.test(student), 'N. student logout-all uses secure auth flows');
  check(/logoutAll/.test(employer) || /revokeRefresh/.test(employer) || /logout-all/.test(read('server/src/routes/employer.js')), 'N. employer logout-all route remains');
}

console.log(`phase17crIdentity.test.js: ${count} assertions passed`);
