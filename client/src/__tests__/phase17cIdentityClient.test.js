import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'path';

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

{
  const turnstile = read('components/auth/TurnstileField.jsx');
  check(/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/.test(turnstile), 'Turnstile loads official Cloudflare widget script');
  check(/VITE_TURNSTILE_SITE_KEY/.test(turnstile) && !/TURNSTILE_SECRET/.test(turnstile), 'client receives only the site key');
  check(/not configured in this environment/.test(turnstile), 'disabled Turnstile states local/not-configured truth');
  check(/api\.render/.test(turnstile), 'enabled Turnstile renders the official widget');
}

{
  for (const [name, rel] of [
    ['employer', 'pages/Employer/EmployerRegister.jsx'],
    ['agent', 'pages/Agent/AgentRegister.jsx'],
    ['institution', 'pages/Institution/InstitutionRegister.jsx'],
  ]) {
    const src = read(rel);
    check(/PasswordInput/.test(src), `${name} register uses shared PasswordInput`);
    check(/VERIFY_EMAIL/.test(src), `${name} register continues to verify-email instead of forging a session`);
    check(/requiresVerification/.test(src), `${name} register handles generic 201 without accessToken`);
  }
}

{
  const settings = read('pages/Employer/EmployerSettings.jsx');
  check(/ConnectedAccountsPanel/.test(settings), 'Employer Settings includes Connected Accounts panel');
  check(/PasswordInput/.test(settings), 'Employer Settings password fields use shared PasswordInput');
}

{
  const recovery = read('components/auth/RealmPasswordRecovery.jsx');
  const forgot = read('pages/Auth/ForgotPassword.jsx');
  check(/successMessage/.test(recovery) && /data\?\.message/.test(recovery), 'B2B recovery shows server-truthful message');
  check(/successMessage/.test(forgot) && /data\?\.message/.test(forgot), 'Student recovery shows server-truthful message');
}

{
  const verify = read('pages/Auth/VerifyEmail.jsx');
  check(/realm/.test(verify) && /verifyEmail\(\{ token, realm \}\)/.test(verify), 'verify-email page is realm-aware');
}

console.log(`phase17cIdentityClient.test.js: ${count} assertions passed`);
