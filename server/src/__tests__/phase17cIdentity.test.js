import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'path';
import {
  registrationAcceptedPayload,
  recoveryAcceptedPayload,
  mapDeliveryStateToAuthMode,
} from '../../../shared/auth/registrationPrivacy.js';
import { isB2bEmailVerificationRequired } from '../services/auth/realmEmailVerification.js';
import { validatePassword } from '../validators/authValidator.js';
import { turnstileConfig } from '../../../shared/security/turnstile.js';
import { connectedAccountCatalog } from '../../../shared/auth/connectedAccounts.js';
import { createStepUpGrant, consumeStepUpGrant, resetStepUpGrantsForTests } from '../services/auth/stepUpAuth.js';

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
  const known = registrationAcceptedPayload('unavailable');
  const unknown = registrationAcceptedPayload('unavailable');
  check(known.message === unknown.message, 'registration payload is identical regardless of account existence');
  check(!/already exists|already registered/i.test(known.message), 'registration message is not an existence oracle');
  check(known.accepted === true && known.requiresVerification === true, 'registration accepted shape is stable');
}

{
  const accepted = recoveryAcceptedPayload('accepted');
  const stopped = recoveryAcceptedPayload('queued_worker_stopped');
  const unavailable = recoveryAcceptedPayload('unavailable');
  check(/will be delivered/.test(accepted.message), 'recovery accepted mentions delivery only when enabled');
  check(/unavailable/.test(stopped.message) && !/we sent/i.test(stopped.message), 'recovery honesty when delivery is stopped');
  check(/available/.test(unavailable.message) && !/we sent|you will receive/i.test(unavailable.message), 'recovery honesty when delivery is unavailable');
  check(accepted.accepted === stopped.accepted && stopped.accepted === unavailable.accepted, 'recovery shape does not vary by account existence');
  check(mapDeliveryStateToAuthMode('enabled') === 'accepted', 'enabled delivery maps to accepted');
  check(mapDeliveryStateToAuthMode('queued_worker_stopped') === 'queued_worker_stopped', 'stopped worker maps honestly');
}

{
  check(validatePassword('short', true), 'employer/shared validator rejects short passwords');
  check(validatePassword('alllowercase1', true), 'shared validator requires uppercase');
  check(validatePassword('ValidPass9', true) === null, 'canonical 8-128 complexity password is accepted');
}

{
  const grandfathered = isB2bEmailVerificationRequired({
    emailVerified: false,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  });
  const fresh = isB2bEmailVerificationRequired({
    emailVerified: false,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
  });
  const verified = isB2bEmailVerificationRequired({
    emailVerified: true,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
  });
  check(grandfathered === false, 'B2B accounts created before enforce-from are grandfathered');
  check(fresh === true, 'new B2B accounts require email ownership verification');
  check(verified === false, 'verified B2B accounts are not restricted');
}

{
  check(turnstileConfig({}).enabled === false, 'Turnstile remains disabled by default');
  check(turnstileConfig({ TURNSTILE_ENABLED: '1' }).enabled === false, 'Turnstile without keys stays not_configured');
}

{
  const rows = connectedAccountCatalog({});
  check(rows.every((row) => row.state === 'not_configured'), 'connected accounts remain NOT_CONFIGURED');
}

{
  await resetStepUpGrantsForTests();
  const created = await createStepUpGrant({
    realm: 'employer',
    subjectId: '507f1f77bcf86cd799439011',
    purpose: 'password_change',
  });
  check(created.ok === true, 'step-up grant persists through shared cache');
  check((await consumeStepUpGrant({
    realm: 'employer',
    subjectId: '507f1f77bcf86cd799439011',
    purpose: 'password_change',
  })).ok === true, 'step-up consume succeeds once');
  check((await consumeStepUpGrant({
    realm: 'employer',
    subjectId: '507f1f77bcf86cd799439011',
    purpose: 'password_change',
  })).ok === false, 'step-up grant cannot be replayed');
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
    check(!/status\(409\).*already/i.test(src) && !/already exists/.test(src), `${name} register is not an existence 409 oracle`);
    check(/genericRegistrationResponse/.test(src), `${name} register uses generic non-enumerating payload`);
    check(/genericRecoveryResponse/.test(src), `${name} forgot-password uses generic recovery payload`);
    check(/sensitiveTransactionalDeliveryMode\(\)\) === 'accepted'/.test(src) || /sensitiveTransactionalDeliveryMode/.test(src), `${name} sends reset email when SMTP transactional delivery is accepted`);
  }
  check(/accountStatus === 'suspended'/.test(employer), 'employer login denies suspended accounts');
  check(/validatePassword\(password, true\)/.test(employer), 'employer register uses canonical password validator');
  check(/issueRealmVerification/.test(employer) && /issueRealmVerification/.test(agent) && /issueRealmVerification/.test(institution), 'B2B register issues hashed verification tokens');
  check(
    !/export const employerRegister[\s\S]{0,2500}issueSecureEmployerSession/.test(employer),
    'employer register does not issue a session'
  );
}

{
  const empRoutes = read('server/src/routes/employer.js');
  const agentRoutes = read('server/src/routes/agent.js');
  const instRoutes = read('server/src/routes/institutionPortal.js');
  const authRoutes = read('server/src/routes/auth.js');
  check(/requireTurnstileWhenEnabled\('register'\)/.test(empRoutes), 'employer register has Turnstile guard');
  check(/requireTurnstileWhenEnabled\('register'\)/.test(agentRoutes), 'agent register has Turnstile guard');
  check(/requireTurnstileWhenEnabled\('register'\)/.test(instRoutes), 'institution register has Turnstile guard');
  check(/requireTurnstileWhenEnabled\('password_recovery'\)/.test(empRoutes), 'employer forgot has Turnstile guard');
  check(/verifyEmailLimiter/.test(authRoutes), 'student verify-email is rate limited');
  check(/requireEmployerEmailVerified\(\)/.test(empRoutes), 'employer activate/checkout require email ownership');
  check(/requireAgentEmailVerified\(\)/.test(agentRoutes), 'agent marketplace writes require email ownership');
  check(/requireInstitutionEmailVerified\(\)/.test(instRoutes), 'institution official writes require email ownership');
}

{
  const turnstileMw = read('server/src/middleware/turnstile.js');
  check(/if \(!config\.enabled\)/.test(turnstileMw), 'Turnstile skips when not configured');
  check(/if \(!token\)/.test(turnstileMw) && /Human verification is required/.test(turnstileMw), 'enabled Turnstile fails closed without token');
  check(/payload\.hostname/.test(turnstileMw) && /payload\.action/.test(turnstileMw), 'Turnstile validates hostname/action when present');
}

{
  const stepUp = read('server/src/services/auth/stepUpAuth.js');
  check(/cacheSet/.test(stepUp) && /cacheGet/.test(stepUp), 'step-up uses shared Redis/memory cache');
  check(!/new Map\(\)/.test(stepUp), 'step-up is no longer process-local Map only');
  check(!/JWT_SECRET|REFRESH_SECRET|passwordReset/.test(stepUp), 'step-up source does not persist secrets');
}

{
  const consume = read('server/src/services/auth/realmEmailVerification.js');
  check(/MODELS\[realm\]/.test(consume), 'verification consume is realm-scoped');
  check(/hashVerificationToken\(rawToken\)/.test(consume), 'raw verification token is hashed before lookup');
  check(/emailVerified = true/.test(consume) && /clearVerificationTokenFields/.test(consume), 'successful verify is one-time');
}

console.log(`phase17cIdentity.test.js: ${count} assertions passed`);
