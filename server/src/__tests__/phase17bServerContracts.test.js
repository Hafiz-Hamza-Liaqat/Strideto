import assert from 'node:assert/strict';
import { createStepUpGrant, consumeStepUpGrant, resetStepUpGrantsForTests } from '../services/auth/stepUpAuth.js';
import { projectSavedRecord } from '../../../shared/publicDiscovery/projectSavedListing.js';
import { requireAcceptedTerms, legalAcceptanceMetadata } from '../../../shared/legal/policyVersions.js';
import { turnstileConfig } from '../../../shared/security/turnstile.js';
import { connectedAccountCatalog } from '../../../shared/auth/connectedAccounts.js';
import { validateAuthRegister, validateChangePassword } from '../validators/authValidator.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

{
  const visible = { _id: 'a1', status: 'active', launchEligible: true, title: 'Public Job' };
  const fixture = { _id: 'f1', status: 'active', isFixture: true, title: 'P13 Fixture', dataClass: 'fixture' };
  const project = (doc) => ({ _id: doc._id, title: doc.title });
  check(projectSavedRecord(visible, project).unavailable === false, 'launch-visible saved job remains listed');
  const hidden = projectSavedRecord(fixture, project);
  check(hidden.unavailable === true && !/P13|fixture/i.test(JSON.stringify(hidden)), 'fixture saved job is unavailable without fixture metadata');
}

{
  check(requireAcceptedTerms({ acceptedTerms: true }) === true, 'acceptedTerms true is required');
  check(requireAcceptedTerms({ acceptedTerms: 'true' }) === false, 'string true cannot forge consent');
  const meta = legalAcceptanceMetadata(new Date('2026-08-13T00:00:00.000Z'));
  check(meta.termsVersion && meta.privacyVersion && meta.termsAcceptedAt, 'server writes version and timestamp');
}

{
  const { termsError } = validateAuthRegister({
    email: 'a@b.co',
    password: 'ValidPass9',
    name: 'Ada',
    acceptedTerms: false,
  });
  check(!!termsError, 'register rejects missing terms');
  const { currentError, passwordError } = validateChangePassword({
    currentPassword: '',
    newPassword: 'ValidPass9',
  });
  check(!!currentError && !passwordError, 'password change requires current password');
}

{
  check(turnstileConfig({}).state === 'not_configured', 'Turnstile default is not_configured');
  check(
    turnstileConfig({
      TURNSTILE_ENABLED: '1',
      TURNSTILE_SITE_KEY: 'site',
      TURNSTILE_SECRET_KEY: 'secret',
    }).enabled === true,
    'Turnstile enables only with site key and secret'
  );
}

{
  const rows = connectedAccountCatalog({});
  check(rows.length >= 8 && rows.every((row) => row.state === 'not_configured'), 'all connected providers start not_configured');
  check(rows.every((row) => row.confersTrust === false && row.confersCanonicalAuthority === false), 'providers confer no Trust or canonical authority');
}

{
  resetStepUpGrantsForTests();
  const created = createStepUpGrant({ realm: 'user', subjectId: '507f1f77bcf86cd799439011', purpose: 'password_change' });
  check(created.ok === true, 'step-up grant can be issued after current-password proof');
  check(consumeStepUpGrant({ realm: 'user', subjectId: '507f1f77bcf86cd799439011', purpose: 'password_change' }).ok === true, 'step-up grant is single use');
  check(consumeStepUpGrant({ realm: 'user', subjectId: '507f1f77bcf86cd799439011', purpose: 'password_change' }).ok === false, 'used step-up grant cannot be reused');
}

console.log(`phase17bServerContracts.test.js: ${count} assertions passed`);
