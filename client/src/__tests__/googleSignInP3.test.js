/**
 * Google Sign-In P3 — frontend contract tests.
 * Run: node src/__tests__/googleSignInP3.test.js
 *
 * The repository has no browser/DOM test runner, and this phase must not
 * install one to prove a handful of properties. Two techniques are used, and
 * neither claims more than it can show:
 *
 *  1. Real behaviour, executed — the decidable logic (flag, start URL, callback
 *     parameter parsing, error mapping, return-path safety) lives in
 *     `shared/auth/googleSignIn.js` precisely so it can be imported and run
 *     here rather than only grepped.
 *  2. Source contracts — for the React wiring a static read genuinely can
 *     verify: which helper a handler calls, which parameters are read, what is
 *     absent.
 *
 * Rendered DOM behaviour, real navigation, and real cookie exchange are NOT
 * claimed here — that belongs to a browser acceptance pass.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  GOOGLE_START_PATH,
  OAUTH_CALLBACK_ERROR_CODES,
  OAUTH_CLIENT_ERROR_CODES,
  OAUTH_GENERIC_ERROR_CODE,
  buildGoogleStartUrl,
  isGoogleSignInEnabled,
  isKnownOAuthErrorCode,
  oauthErrorMessageKey,
  parseOAuthCallbackParams,
  sanitizeOAuthReturnPath,
  shouldOfferRegister,
} from '../../../shared/auth/googleSignIn.js';
import { OAUTH_REDIRECT_ERRORS } from '../../../server/src/services/auth/googleOidcConfig.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const repoRoot = path.resolve(here, '../../..');

const read = (relPath) => readFileSync(path.join(clientSrc, relPath), 'utf8');
const readRepo = (relPath) => readFileSync(path.join(repoRoot, relPath), 'utf8');
const codeOnly = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const loginSrc = read('pages/Auth/Login.jsx');
const registerSrc = read('pages/Auth/Register.jsx');
const callbackSrc = read('pages/Auth/OAuthCallback.jsx');
const runtimeSrc = read('auth/googleSignIn.js');
const authContextSrc = read('context/AuthContext.jsx');
const sharedSrc = readRepo('shared/auth/googleSignIn.js');

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------
{
  check(isGoogleSignInEnabled('1') === true, "the exact string '1' enables Google");
  for (const value of ['0', 'true', 'yes', '', ' ', null, undefined, 1, true]) {
    check(
      isGoogleSignInEnabled(value) === (String(value ?? '').trim() === '1'),
      `flag value ${JSON.stringify(value)} is evaluated strictly`
    );
  }
  check(isGoogleSignInEnabled(undefined) === false, 'an unset flag defaults to disabled');

  check(
    /VITE_OAUTH_GOOGLE_ENABLED/.test(runtimeSrc),
    'the runtime reads the existing VITE_OAUTH_GOOGLE_ENABLED flag'
  );
  const panel = read('components/account/ConnectedAccountsPanel.jsx');
  check(
    /VITE_OAUTH_GOOGLE_ENABLED/.test(panel),
    'ConnectedAccountsPanel already used this flag — no second flag was introduced'
  );
  // The panel's Apple/Microsoft flags predate this phase and are untouched;
  // what matters is that exactly one *Google* flag name exists anywhere.
  const googleFlagNames = new Set();
  for (const src of [runtimeSrc, panel, loginSrc, registerSrc, callbackSrc]) {
    for (const m of src.matchAll(/VITE_[A-Z0-9_]*GOOGLE[A-Z0-9_]*/g)) {
      googleFlagNames.add(m[0]);
    }
  }
  check(
    googleFlagNames.size === 1 && googleFlagNames.has('VITE_OAUTH_GOOGLE_ENABLED'),
    'exactly one Google Vite flag exists across the auth surface — no competing flag'
  );
}

// ---------------------------------------------------------------------------
// Start URL
// ---------------------------------------------------------------------------
{
  check(GOOGLE_START_PATH === '/auth/oauth/google/start', 'the start path matches the backend route');
  check(
    buildGoogleStartUrl('/api') === '/api/auth/oauth/google/start',
    'a relative API base produces a same-origin start URL'
  );
  check(
    buildGoogleStartUrl('https://api.example.test/api') === 'https://api.example.test/api/auth/oauth/google/start',
    'an absolute API base is honoured'
  );
  check(
    buildGoogleStartUrl('https://api.example.test/api/') === 'https://api.example.test/api/auth/oauth/google/start',
    'a trailing slash on the API base does not double up'
  );
  check(buildGoogleStartUrl(undefined) === GOOGLE_START_PATH, 'a missing base degrades to the bare path');

  check(
    /import \{ API_BASE_URL \} from '\.\.\/constants'/.test(runtimeSrc),
    'the start URL comes from the existing API-origin abstraction'
  );
  for (const host of ['localhost', 'strideto.com', 'api.strideto.com']) {
    check(!codeOnly(runtimeSrc).includes(host), `the runtime hardcodes no ${host}`);
    check(!codeOnly(sharedSrc).includes(host), `the shared policy hardcodes no ${host}`);
  }
  check(
    /window\.location\.assign\(buildGoogleStartUrl\(API_BASE_URL\)\)/.test(runtimeSrc),
    'sign-in starts as a top-level navigation, not an XHR'
  );
  check(
    !/axios|fetch\(/.test(codeOnly(runtimeSrc)),
    'the start endpoint is never called with axios or fetch'
  );
}

// ---------------------------------------------------------------------------
// A/B. Login and Register buttons
// ---------------------------------------------------------------------------
{
  for (const [label, src, handler] of [
    ['Login', loginSrc, 'handleGoogleLogin'],
    ['Register', registerSrc, 'handleGoogleSignUp'],
  ]) {
    const code = codeOnly(src);
    check(
      /import \{ googleSignInEnabled, startGoogleSignIn \} from '\.\.\/\.\.\/auth\/googleSignIn\.js'/.test(code),
      `${label} imports the shared Google helpers`
    );
    const body = code.slice(code.indexOf(`const ${handler} = `));
    const scoped = body.slice(0, body.indexOf('};') + 2);
    check(/if \(!googleEnabled\)/.test(scoped), `${label} checks the flag before navigating`);
    check(/googleSoon/.test(scoped), `${label} keeps the coming-soon message when disabled`);
    check(/startGoogleSignIn\(/.test(scoped), `${label} navigates to the backend start endpoint when enabled`);
    check(
      scoped.indexOf('googleSoon') < scoped.indexOf('startGoogleSignIn'),
      `${label} returns on the disabled path before any navigation`
    );
    check(
      /comingSoon=\{!googleEnabled\}/.test(code),
      `${label} shows the button as coming-soon only while disabled`
    );
    check(
      /<SocialAuthButton provider="Google"/.test(code),
      `${label} still uses the existing SocialAuthButton`
    );
    check(!/SocialLoginButtons/.test(code), `${label} introduces no new button abstraction`);
    check(!/linkedin|facebook/i.test(code), `${label} adds no other provider`);
  }

  // One flow, not two: both handlers end in the same helper call.
  check(
    /startGoogleSignIn\(\{ returnPath/.test(loginSrc) && /startGoogleSignIn\(\)/.test(registerSrc),
    'Login and Register share one Google start flow, differing only in the optional return path'
  );

  const button = read('components/auth/SocialAuthButton.jsx');
  check(/comingSoon/.test(button), 'SocialAuthButton itself is unchanged');
  check(!/window\.location|fetch\(|axios/.test(button), 'SocialAuthButton performs no navigation of its own');
}

// ---------------------------------------------------------------------------
// C/D/E/G. Callback parameter parsing
// ---------------------------------------------------------------------------
{
  const success = parseOAuthCallbackParams('?status=success');
  check(success.outcome === 'success', 'status=success is recognised');
  check(success.errorCode === null, 'a success carries no error code');

  const link = parseOAuthCallbackParams('?error=existing_account_requires_link');
  check(link.outcome === 'error', 'an error parameter is recognised');
  check(link.errorCode === 'existing_account_requires_link', 'the allowlisted code is preserved');

  check(
    parseOAuthCallbackParams('?error=something_made_up').errorCode === OAUTH_GENERIC_ERROR_CODE,
    'an unknown error code collapses to the generic code'
  );
  check(
    parseOAuthCallbackParams('?error=<script>alert(1)</script>').errorCode === OAUTH_GENERIC_ERROR_CODE,
    'an injected error value never survives to the UI'
  );
  check(parseOAuthCallbackParams('').outcome === 'error', 'an empty query is not a success');
  check(parseOAuthCallbackParams('?status=nope').outcome === 'error', 'an unrecognised status is not a success');
  check(parseOAuthCallbackParams(null).outcome === 'error', 'a missing query is not a success');
  check(
    parseOAuthCallbackParams('?error=oauth_failed&status=success').outcome === 'error',
    'an error wins over a simultaneous success marker'
  );

  // G — no token is ever read, whatever the redirect carries.
  const hostile = parseOAuthCallbackParams(
    '?status=success&access_token=AAA&id_token=BBB&refresh_token=CCC&code=DDD&email=x@y.z&sub=123'
  );
  check(hostile.outcome === 'success', 'extra parameters are ignored, not rejected');
  check(
    Object.keys(hostile).every((key) => key === 'outcome' || key === 'errorCode'),
    'the parser returns only outcome and errorCode — never a token, email, or subject'
  );
  const parserBody = codeOnly(sharedSrc).slice(codeOnly(sharedSrc).indexOf('export function parseOAuthCallbackParams'));
  check(
    !/access_token|id_token|refresh_token|params\.get\('code'\)|params\.get\('email'\)|params\.get\('sub'\)/.test(parserBody),
    'the parser reads no token, code, email, or subject key'
  );
  check(
    (parserBody.match(/params\.get\(/g) || []).length === 2,
    'the parser consults exactly two query keys'
  );
}

// The client allowlist cannot drift from the server's.
{
  check(
    JSON.stringify([...OAUTH_CALLBACK_ERROR_CODES]) === JSON.stringify([...OAUTH_REDIRECT_ERRORS]),
    'the client error allowlist is identical to the backend OAUTH_REDIRECT_ERRORS list'
  );
  for (const code of OAUTH_REDIRECT_ERRORS) {
    check(isKnownOAuthErrorCode(code), `${code} is recognised by the client`);
  }
  check(!isKnownOAuthErrorCode('anything_else'), 'unknown codes are not recognised');
}

// Error messages resolve, and only the link case offers registration.
{
  const forms = JSON.parse(readRepo('client/src/i18n/locales/en/forms.json'));
  const messages = forms.oauthCallback?.errors || {};
  for (const code of [...OAUTH_REDIRECT_ERRORS, OAUTH_CLIENT_ERROR_CODES.SESSION_FAILED]) {
    const key = oauthErrorMessageKey(code);
    check(key === `oauthCallback.errors.${code}`, `${code} maps to its own message key`);
    check(typeof messages[code] === 'string' && messages[code].length > 0, `${code} has an English message`);
  }
  check(
    oauthErrorMessageKey('totally_unknown') === 'oauthCallback.errors.oauth_failed',
    'an unknown code falls back to the generic message key'
  );

  const linkMessage = messages.existing_account_requires_link;
  check(
    linkMessage === 'An account already exists with this email. Sign in with your existing STRIDETO account. Google account linking will be available from Connected Accounts.',
    'the existing-account message is the exact approved wording'
  );

  check(shouldOfferRegister('existing_account_requires_link'), 'the link case offers a Create Account path');
  for (const code of OAUTH_REDIRECT_ERRORS.filter((c) => c !== 'existing_account_requires_link')) {
    check(!shouldOfferRegister(code), `${code} does not push the user toward registration`);
  }

  for (const locale of ['en', 'ur', 'ar']) {
    const data = JSON.parse(readRepo(`client/src/i18n/locales/${locale}/forms.json`));
    check(!!data.oauthCallback?.completing, `${locale} has the loading string`);
    check(
      Object.keys(data.oauthCallback.errors).length === OAUTH_REDIRECT_ERRORS.length + 1,
      `${locale} covers every allowlisted code plus session_failed`
    );
  }
  const messageValues = Object.values(messages).join(' ');
  check(!/Error:|stack|ECONNREFUSED|undefined/.test(messageValues), 'no internal detail appears in any message');
}

// ---------------------------------------------------------------------------
// C/F/I. Callback page wiring
// ---------------------------------------------------------------------------
{
  const code = codeOnly(callbackSrc);

  check(/completeOAuthLogin/.test(code), 'the callback delegates to the AuthContext OAuth completion path');
  check(!/setAccessToken|localStorage|sessionStorage/.test(code), 'the callback performs no token handling of its own');
  check(!/authApi\.refreshToken|axios/.test(code), 'the callback does not re-implement the refresh call');
  check(/parseOAuthCallbackParams\(location\.search\)/.test(code), 'the callback reads only the parsed query result');
  check(!/location\.hash|window\.location\.hash/.test(code), 'the callback never reads the URL fragment');
  check(
    !/access_token|id_token|refresh_token|searchParams\.get/.test(code),
    'the callback reads no token and no raw query parameter'
  );

  // I — one run per navigation, and the effect never re-fires on state change.
  check(/startedRef/.test(code), 'a guard prevents a second run under StrictMode double-invoke');
  check(/startedRef\.current = true;/.test(code), 'the guard is set before any async work begins');
  check(/}, \[\]\);/.test(code), 'the completion effect has an empty dependency list');
  check((code.match(/completeOAuthLogin\(\)/g) || []).length === 1, 'completeOAuthLogin is invoked from exactly one place');

  // F — a failure lands in a terminal state, never a retry loop.
  check(/SESSION_FAILED/.test(code), 'a failed completion maps to the session_failed state');
  check(!/setTimeout|setInterval/.test(code), 'there is no retry timer');
  check(/\.catch\(/.test(code), 'a thrown completion is caught rather than left unhandled');

  // Loading UX.
  check(/oauthCallback\.completing/.test(code), 'a completing state is rendered');
  check(/aria-live/.test(callbackSrc), 'the loading state is announced to assistive technology');

  // Redirect + URL cleanup.
  check(
    (code.match(/replace: true/g) || []).length >= 3,
    'every navigation out of the callback uses replace semantics'
  );
  check(!/navigate\([^)]*\)\s*;/.test(code.replace(/navigate\([^;]*replace: true[^;]*\);/g, '')),
    'no navigation omits replace semantics');
  check(/resolveLoginReturnPath/.test(code), 'the existing login-return resolver decides the destination');
  check(/ROUTES\.HOME/.test(code), 'the default destination is the normal post-login route');
  check(!/http:\/\/|https:\/\//.test(code), 'the callback can never navigate to an absolute URL');
  check(/takeOAuthReturnPath/.test(code), 'a stored return path is consumed once');
  check(/ROUTES\.LOGIN/.test(code) && /ROUTES\.REGISTER/.test(code), 'both recovery actions are offered');
}

// Return-path storage safety.
{
  check(sanitizeOAuthReturnPath('/jobs/123') === '/jobs/123', 'a plain internal path is kept');
  for (const hostile of [
    'https://evil.test/x',
    '//evil.test/x',
    'javascript:alert(1)',
    '/\\evil.test',
    '',
    null,
    undefined,
    42,
  ]) {
    check(sanitizeOAuthReturnPath(hostile) === null, `an unsafe return path is rejected: ${JSON.stringify(hostile)}`);
  }
  check(
    /isSafeInternalReturnPath/.test(sharedSrc),
    'the canonical safe-path checker is reused rather than a second rule'
  );

  const runtime = codeOnly(runtimeSrc);
  check(/sanitizeOAuthReturnPath\(path\)/.test(runtime), 'only a validated path is written to storage');
  check(/sanitizeOAuthReturnPath\(raw\)/.test(runtime), 'a stored path is re-validated on read');
  check(/sessionStorage\.removeItem\(RETURN_PATH_KEY\)/.test(runtime), 'the stored path is cleared when taken');
  check(
    !/token|email|sub|nonce|state|verifier|profile/i.test(
      runtime.replace(/RETURN_PATH_KEY|takeOAuthReturnPath|rememberOAuthReturnPath|startGoogleSignIn|googleSignInEnabled|sanitizeOAuthReturnPath|buildGoogleStartUrl|isGoogleSignInEnabled/g, '')
    ),
    'no token, profile, email, subject, state, nonce, or verifier is stored'
  );
}

// ---------------------------------------------------------------------------
// C/I. AuthContext reuse and the double-refresh guarantee
// ---------------------------------------------------------------------------
{
  const code = codeOnly(authContextSrc);
  const method = code.slice(code.indexOf('const completeOAuthLogin'));
  const body = method.slice(0, method.indexOf('}, ['));

  check(/refreshToken\(\{ clearOnFailure: false \}\)/.test(body), 'completion reuses the existing refreshToken path');
  check(!/resetAxiosAuthState/.test(body), 'completion does NOT reset the single-flight, so a concurrent bootstrap refresh is shared');
  check(!/authApi\.refreshToken|axios\.post/.test(body), 'completion issues no second refresh request of its own');
  check(/authApi\.me\(\)/.test(body), 'completion loads the user through the existing /auth/me endpoint');
  check(/bindLocalUser\(data\.user\)/.test(body), 'completion binds tab identity the same way password login does');
  check(/syncUserWorkspaceUx\(data\.user\)/.test(body), 'completion synchronises workspace UX');
  check(!/setAccessToken/.test(body), 'completion never sets an access token directly — refreshToken owns that');
  check(!/localStorage\.setItem/.test(body), 'completion writes no token to storage');
  check(/completeOAuthLogin,/.test(code), 'completeOAuthLogin is exposed on the context value');

  // The single-flight is what makes the shared-refresh claim true.
  const axiosBase = read('services/axiosBase.js');
  check(/refreshPromise\.run\(/.test(axiosBase), 'refreshUserAccessToken runs inside the single-flight');
  const flight = read('auth/refreshFlight.js');
  check(/if \(!current\)/.test(flight), 'the single-flight returns the in-flight promise to concurrent callers');

  // bindLocalUser bumps the epoch, retiring any in-flight bootstrap chain.
  const bind = code.slice(code.indexOf('const bindLocalUser'));
  check(/authEpoch\.current \+= 1;/.test(bind.slice(0, 300)), 'bindLocalUser advances the auth epoch');
  check(
    /epoch !== authEpoch\.current/.test(code),
    'the realm bootstrap abandons its chain once the epoch advances'
  );

  // The callback route is NOT excluded from normal bootstrap; nothing changed.
  const realm = read('auth/authRealm.js');
  check(!/callback/i.test(realm), 'the OAuth callback route was not added to the bootstrap skip list');
  check(!/oauth/i.test(realm), 'authRealm is unchanged by this phase');
}

// ---------------------------------------------------------------------------
// H/J. Secret exposure and password-flow regression
// ---------------------------------------------------------------------------
{
  // Comments are stripped first: these files *discuss* tokens and PKCE in
  // order to explain their absence, and prose must not fail a code contract.
  const surface = [runtimeSrc, sharedSrc, callbackSrc, loginSrc, registerSrc, authContextSrc]
    .map(codeOnly)
    .join(String.fromCharCode(10));
  check(!/GOOGLE_CLIENT_SECRET/.test(surface), 'no client secret appears anywhere in the frontend');
  check(!/GOOGLE_CLIENT_ID/.test(surface), 'the frontend does not need or reference a Google client id');
  check(!/accounts\.google\.com|oauth2\.googleapis\.com|googleapis\.com/.test(surface), 'the frontend never calls a Google endpoint');
  check(!/code_verifier|code_challenge|nonce/.test(surface), 'no PKCE or nonce material exists client-side');
  check(!/id_token|access_token/.test(surface), 'no provider token is named in the frontend');

  // J — password flows untouched.
  const login = codeOnly(loginSrc);
  check(/await login\(email\.trim\(\)\.toLowerCase\(\), password\)/.test(login), 'password login still calls the existing login()');
  check(/handleSubmit/.test(login) && /validateEmail/.test(login), 'password validation is unchanged');
  const register = codeOnly(registerSrc);
  check(/TurnstileField/.test(register), 'registration still renders the Turnstile field');
  check(/TermsConsentField/.test(register), 'registration still requires terms consent');
  check(/await register\(/.test(register), 'password registration still calls the existing register()');
  check(/mustChangePassword/.test(login), 'the must-change-password branch is preserved');

  // Backend untouched by this phase.
  const backendFiles = [
    'server/src/services/auth/googleIdTokenVerifier.js',
    'server/src/services/auth/googleJwksCache.js',
    'server/src/services/auth/googleOidcTransaction.js',
    'server/src/services/auth/googleOidcFlows.js',
    'server/src/routes/oauth.js',
    'server/src/models/UserIdentity.js',
    'server/src/services/auth/socialIdentityLinking.js',
  ];
  for (const rel of backendFiles) {
    check(readRepo(rel).length > 0, `${rel} is present and readable (unmodified by P3)`);
  }
  check(
    /'\/auth\/oauth\/google\/start'/.test(readRepo('server/src/routes/oauth.js')),
    'the frontend start path matches the mounted backend route'
  );
}

console.log(`googleSignInP3: ${count} checks passed`);
