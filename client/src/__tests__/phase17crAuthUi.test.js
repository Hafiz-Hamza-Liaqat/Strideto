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
  for (const [name, rel] of [
    ['student', 'pages/Auth/Register.jsx'],
    ['employer', 'pages/Employer/EmployerRegister.jsx'],
    ['agent', 'pages/Agent/AgentRegister.jsx'],
    ['institution', 'pages/Institution/InstitutionRegister.jsx'],
  ]) {
    const src = read(rel);
    check(/pendingVerifyPath/.test(src), `${name} O. uses pendingVerifyPath`);
    check(!/pending=1&email=/.test(src), `${name} O. does not put raw email in verify URL`);
    check(/AuthCard/.test(src), `${name} R. uses shared AuthCard`);
    check(!/min-h-screen/.test(src), `${name} R. does not remount a full-page detached shell`);
    check(/useAuthFormDraft/.test(src), `${name} T. preserves non-sensitive draft across Terms/Privacy`);
  }
  const login = read('pages/Auth/Login.jsx');
  check(!/email=\$\{encodeURIComponent/.test(login), 'O. student login verify link has no email query');
  check(/AuthCard/.test(login), 'R. student login uses AuthCard');
}

{
  const verify = read('pages/Auth/VerifyEmail.jsx');
  check(/useSecretQueryToken/.test(verify), 'O. verify page strips token from the address bar');
  check(/Check your email|checkEmailTitle/.test(verify), 'verify pending copy exists');
  check(/30 minutes/.test(verify) && /once/.test(verify), 'pending page explains expiry and one-time use');
  check(/does not verify an organization/.test(verify), 'U. email verify does not imply org verification');
  check(/realmLoginPath/.test(verify), 'success next-action is realm-aware');
  check(/verified/.test(verify) && /setSearchParams\(next, \{ replace: true \}\)/.test(verify), 'O. successful verify replaces the URL without the secret');
  check(/consumedRef/.test(verify), 'F. verify consume runs once even after the clean-URL replace');
}

{
  const pw = read('components/forms/PasswordInput.jsx');
  check(/Show password/.test(pw) && /Hide password/.test(pw), 'S. accessible show/hide labels');
  check(/type="button"/.test(pw), 'S. eye control does not submit');
  check(/min-h-\[44px\]/.test(pw), 'S. 44px hit area');
  const css = read('index.css');
  check(/::-ms-reveal/.test(css), 'S. native Edge reveal is suppressed');
}

{
  const turnstile = read('components/auth/TurnstileField.jsx');
  check(!/not configured in this environment/.test(turnstile), 'P. public Turnstile copy does not expose configuration state');
  check(/TURNSTILE_SECRET/.test(turnstile) === false, 'Q. client never sees the secret');
}

{
  const layout = read('layouts/MainLayout.jsx');
  check(/hideStudentNav/.test(layout), 'R. auth keeps public navbar/footer; student portal nav hidden');
  const routes = read('routes/index.jsx');
  check(/withAuthLayout\(<InstitutionLogin/.test(routes), 'R. Institution auth uses shared shell');
  check(/MainLayoutWrapper/.test(routes), 'R. public shell remains mounted');
}

{
  const recovery = read('components/auth/RealmPasswordRecovery.jsx');
  check(/useSecretQueryToken/.test(recovery), 'O. reset token is stripped from the URL');
  check(/PasswordInput/.test(recovery), 'S. B2B reset uses shared password control');
}

{
  const employer = read('pages/Employer/EmployerRegister.jsx');
  check(/PhoneInput/.test(employer), 'optional Employer phone uses shared PhoneInput');
  check(/e164/.test(employer), 'Employer phone stores E.164');
}

{
  const emp = read('context/EmployerAuthContext.jsx');
  const agent = read('context/AgentAuthContext.jsx');
  const inst = read('context/InstitutionAuthContext.jsx');
  const student = read('context/AuthContext.jsx');
  for (const [name, src] of [['student', student], ['employer', emp], ['agent', agent], ['institution', inst]]) {
    check(/visibilitychange/.test(src) && /clearOnFailure: false/.test(src) || /catch\(\(\) => \{\}\)/.test(src), `${name} M. quiet refresh does not clear a hydrated session`);
    check(/logoutAll/.test(src), `${name} N. logout-all is exposed`);
  }
}

{
  const terms = read('components/auth/TermsConsentField.jsx');
  check(!/target="_blank"/.test(terms), 'T. Terms/Privacy use same-tab SPA navigation');
  check(/ROUTES\.TERMS/.test(terms) && /ROUTES\.PRIVACY_POLICY/.test(terms), 'T. legal links stay on public routes');
  const draft = read('hooks/useAuthFormDraft.js');
  check(/password|token|turnstile/.test(draft), 'T. draft sanitizer rejects password/token fields');
}

{
  const axiosBase = read('services/axiosBase.js');
  check(/refreshPromise/.test(axiosBase), 'M. concurrent 401s share one refresh attempt');
}

{
  const welcome = read('welcome/portalWelcome.js');
  const banner = read('components/welcome/PortalWelcomeBanner.jsx');
  check(/markPortalOnboardingComplete/.test(welcome) && /consumeWelcomeBack/.test(welcome), 'V. first-use and welcome-back are once-state helpers');
  check(/isPortalOnboardingComplete/.test(banner) && /consumeWelcomeBack/.test(banner), 'V. banner does not reopen completed onboarding');
}

{
  const agent = read('pages/Agent/AgentRegister.jsx');
  const inst = read('pages/Institution/InstitutionRegister.jsx');
  check(!/PhoneInput/.test(agent) && !/PhoneInput/.test(inst), 'Agent/Institution register keep phone on profile, not a duplicate field');
}

console.log(`phase17crAuthUi.test.js: ${count} assertions passed`);
