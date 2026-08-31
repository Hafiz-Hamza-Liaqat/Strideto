/**
 * Google Sign-In P2 — backend OIDC flow tests (no DB, no network).
 * Run: node src/__tests__/googleOidcP2.test.js
 *
 * A throwaway RSA keypair is generated in-process and published through an
 * injected JWKS fetch, so real Google tokens are never needed and no request
 * ever leaves the machine.
 */
import assert from 'assert';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/**
 * `googleOidcTransaction.js` imports `secureAuthConfig.js` for the canonical
 * JWT issuer constant, and that module builds its runtime singleton at import.
 * Same convention as `userSecureAuthFlows.test.js`: set the secrets, then
 * import dynamically.
 */
process.env.STRIDETO_SECURE_AUTH_ENABLED = '1';
process.env.JWT_SECRET = 'z'.repeat(32);
process.env.REFRESH_SECRET = 'y'.repeat(32);

const {
  buildGoogleOidcConfig,
  GOOGLE_AUTHORIZATION_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_JWKS_URI,
  GOOGLE_ACCEPTED_ISSUERS,
  GOOGLE_SCOPE_STRING,
  OAUTH_REDIRECT_ERRORS,
  isAllowlistedRedirectError,
} = await import('../services/auth/googleOidcConfig.js');
const { createGoogleJwksCache } = await import('../services/auth/googleJwksCache.js');
const {
  createGoogleIdTokenVerifier,
  GOOGLE_ID_TOKEN_RESULTS: ID,
} = await import('../services/auth/googleIdTokenVerifier.js');
const {
  createGoogleOidcTransactionService,
  deriveCodeChallenge,
  timingSafeStringEqual,
  OAUTH_TRANSACTION_RESULTS: TX,
} = await import('../services/auth/googleOidcTransaction.js');
const {
  createGoogleOidcFlows,
  GOOGLE_FLOW_RESULTS: FLOW,
  GOOGLE_PROVENANCE,
  toRedirectErrorCode,
} = await import('../services/auth/googleOidcFlows.js');
const {
  createUserIdentityIndexReadiness,
  evaluateUserIdentityIndexReadiness,
  INDEX_READINESS_RESULTS: IDX,
  REQUIRED_USER_IDENTITY_INDEX_NAMES,
} = await import('../services/auth/googleOidcIndexReadiness.js');
const { SOCIAL_IDENTITY_RESULTS: R } = await import('../services/auth/socialIdentityLinking.js');

const here = dirname(fileURLToPath(import.meta.url));
const readRepo = (rel) => readFileSync(resolve(here, '../../..', rel), 'utf8');
const codeOnly = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

// ---------------------------------------------------------------------------
// Fixtures: a local RSA keypair standing in for Google's signing key.
// ---------------------------------------------------------------------------

const CLIENT_ID = '1234567890-abcdef.apps.googleusercontent.com';
const CLIENT_SECRET = 'GOCSPX-test-client-secret-value';
const REDIRECT_URI = 'https://api.strideto.test/api/auth/oauth/google/callback';
const SIGNING_SECRET = 'p2-test-signing-secret-at-least-32-chars';
const KID = 'test-kid-1';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const PUBLIC_JWK = { ...publicKey.export({ format: 'jwk' }), kid: KID, use: 'sig', alg: 'RS256' };

const { privateKey: otherPrivate, publicKey: otherPublic } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const OTHER_PRIVATE_PEM = otherPrivate.export({ type: 'pkcs8', format: 'pem' }).toString();
const OTHER_JWK = { ...otherPublic.export({ format: 'jwk' }), kid: 'rotated-kid', use: 'sig', alg: 'RS256' };

function jwksResponse(keys) {
  return {
    ok: true,
    json: async () => ({ keys }),
  };
}

function makeJwksFetch(keys = [PUBLIC_JWK]) {
  const calls = { count: 0 };
  const fetchImpl = async () => {
    calls.count += 1;
    return jwksResponse(typeof keys === 'function' ? keys(calls.count) : keys);
  };
  return { fetchImpl, calls };
}

const NOW = () => Math.floor(Date.now() / 1000);

function signIdToken(claims = {}, { key = PRIVATE_PEM, kid = KID, algorithm = 'RS256' } = {}) {
  const payload = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    azp: CLIENT_ID,
    sub: 'google-sub-1',
    email: 'ada@example.com',
    email_verified: true,
    name: 'Ada Lovelace',
    nonce: 'test-nonce',
    iat: NOW(),
    exp: NOW() + 3600,
    ...claims,
  };
  // `noTimestamp` would strip the explicit `iat` these fixtures rely on.
  return jwt.sign(payload, key, { algorithm, keyid: kid });
}

function makeVerifier(fetchOverride) {
  const { fetchImpl, calls } = fetchOverride || makeJwksFetch();
  const cache = createGoogleJwksCache({ fetchImpl, jwksUri: GOOGLE_JWKS_URI });
  return { verifier: createGoogleIdTokenVerifier({ jwksCache: cache }), cache, calls };
}

async function verifyToken(token, overrides = {}) {
  const { verifier } = makeVerifier(overrides.fetch);
  return verifier.verify({
    idToken: token,
    clientId: overrides.clientId ?? CLIENT_ID,
    expectedNonce: overrides.nonce ?? 'test-nonce',
  });
}

// ---------------------------------------------------------------------------
// 1. Config + feature flag
// ---------------------------------------------------------------------------
{
  const disabled = buildGoogleOidcConfig({});
  check(disabled.enabled === false, 'absent OAUTH_GOOGLE_ENABLED disables Google');
  check(disabled.configurationError === null, 'a disabled provider is not an error');
  check(buildGoogleOidcConfig({ OAUTH_GOOGLE_ENABLED: '0' }).enabled === false, 'flag 0 disables');
  check(buildGoogleOidcConfig({ OAUTH_GOOGLE_ENABLED: 'true' }).enabled === false, 'only the exact string 1 enables');
  const base = {
    OAUTH_GOOGLE_ENABLED: '1',
    GOOGLE_CLIENT_ID: CLIENT_ID,
    GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: REDIRECT_URI,
    FRONTEND_URL: 'https://strideto.test',
  };

  const enabled = buildGoogleOidcConfig(base);
  check(enabled.enabled === true, 'a complete configuration enables Google');
  check(enabled.authorizationEndpoint === GOOGLE_AUTHORIZATION_ENDPOINT, 'authorization endpoint is pinned');
  check(enabled.tokenEndpoint === GOOGLE_TOKEN_ENDPOINT, 'token endpoint is pinned');
  check(enabled.jwksUri === GOOGLE_JWKS_URI, 'JWKS URI is pinned');
  check(enabled.acceptedIssuers === GOOGLE_ACCEPTED_ISSUERS, 'accepted issuers are pinned');
  check(GOOGLE_ACCEPTED_ISSUERS.includes('https://accounts.google.com'), 'https issuer accepted');
  check(GOOGLE_ACCEPTED_ISSUERS.includes('accounts.google.com'), 'bare issuer accepted');
  check(enabled.scope === 'openid email profile', 'scopes are openid email profile');
  check(
    enabled.frontendCallbackUrl === 'https://strideto.test/auth/callback',
    'frontend callback target is derived from configured origins'
  );

  for (const [missing, label] of [
    ['GOOGLE_CLIENT_ID', 'client id'],
    ['GOOGLE_CLIENT_SECRET', 'client secret'],
    ['GOOGLE_REDIRECT_URI', 'redirect uri'],
  ]) {
    assert.throws(() => buildGoogleOidcConfig({ ...base, [missing]: '' }), TypeError);
    check(true, `enabled config requires ${label}`);
  }

  assert.throws(
    () => buildGoogleOidcConfig({ ...base, NODE_ENV: 'production', GOOGLE_REDIRECT_URI: 'http://api.strideto.test/api/auth/oauth/google/callback' }),
    /HTTPS in production/
  );
  check(true, 'production redirect URI must be HTTPS');
  check(
    buildGoogleOidcConfig({ ...base, GOOGLE_REDIRECT_URI: 'http://localhost:5173/api/auth/oauth/google/callback' }).enabled === true,
    'localhost http redirect URI is accepted outside production'
  );
  assert.throws(
    () => buildGoogleOidcConfig({ ...base, GOOGLE_REDIRECT_URI: 'https://evil.test/hook' }),
    /path must be under/
  );
  check(true, 'redirect URI must live under the Google OAuth route prefix');
  assert.throws(
    () => buildGoogleOidcConfig({ ...base, GOOGLE_REDIRECT_URI: `${REDIRECT_URI}?next=x` }),
    /query string or fragment/
  );
  check(true, 'redirect URI may not carry a query string');
  assert.throws(
    () => buildGoogleOidcConfig({ ...base, GOOGLE_CLIENT_SECRET: CLIENT_ID }),
    /must not be equal/
  );
  check(true, 'client id and secret must differ');
}

// ---------------------------------------------------------------------------
// 2. Transaction: state / nonce / PKCE / cookie
// ---------------------------------------------------------------------------

function makeTransactionService(overrides = {}) {
  return createGoogleOidcTransactionService({
    signingSecret: SIGNING_SECRET,
    mode: 'development',
    ...overrides,
  });
}

function fakeRes() {
  const res = { cookies: [], cleared: [] };
  res.cookie = (name, value, options) => res.cookies.push({ name, value, options });
  res.clearCookie = (name, options) => res.cleared.push({ name, options });
  return res;
}

{
  const service = makeTransactionService();
  const a = service.createTransaction();
  const b = service.createTransaction();

  check(a.state.length >= 40, 'state carries at least 256 bits of entropy');
  check(a.nonce.length >= 40, 'nonce carries at least 256 bits of entropy');
  check(a.codeVerifier.length >= 40, 'code_verifier carries at least 256 bits of entropy');
  check(a.state !== a.nonce && a.state !== a.codeVerifier, 'state, nonce and verifier are distinct values');
  check(a.state !== b.state && a.nonce !== b.nonce, 'each transaction is unique');
  check(a.codeChallengeMethod === 'S256', 'PKCE method is S256');
  check(a.codeChallenge === deriveCodeChallenge(a.codeVerifier), 'challenge is the S256 hash of the verifier');
  check(a.codeChallenge !== a.codeVerifier, 'the challenge is not the verifier in plaintext');
  check(
    a.codeChallenge === crypto.createHash('sha256').update(a.codeVerifier).digest('base64url'),
    'challenge matches the RFC 7636 S256 derivation'
  );

  const claims = jwt.decode(a.cookieValue);
  check(claims.aud === 'strideto-oauth-transaction', 'the transaction cookie has its own audience');
  check(claims.exp - claims.iat === 600, 'the transaction expires in 10 minutes');
  check(!('userId' in claims) && !('accessToken' in claims), 'the transaction carries no identity or token');

  const res = fakeRes();
  check(service.writeCookie(res)(a.cookieValue) === true, 'the transaction cookie is written');
  const [cookie] = res.cookies;
  check(cookie.options.httpOnly === true, 'transaction cookie is HttpOnly');
  check(cookie.options.sameSite === 'lax', 'transaction cookie is SameSite=Lax');
  check(cookie.options.maxAge === 600000, 'transaction cookie Max-Age is 10 minutes');
  check(cookie.options.path === '/api/auth/oauth/google', 'transaction cookie is scoped to the OAuth route');
  check(cookie.options.secure === false, 'transaction cookie is not Secure in development');
  check(cookie.name === 'strideto_dev_oauth_tx', 'development cookie name');

  const prod = makeTransactionService({ mode: 'production' });
  const prodRes = fakeRes();
  prod.writeCookie(prodRes)(prod.createTransaction().cookieValue);
  check(prodRes.cookies[0].options.secure === true, 'transaction cookie is Secure in production');
  check(prodRes.cookies[0].name === '__Secure-strideto_oauth_tx', 'production cookie uses the __Secure- prefix');

  check(timingSafeStringEqual('abc', 'abc') === true, 'timing-safe comparison accepts equal values');
  check(timingSafeStringEqual('abc', 'abd') === false, 'timing-safe comparison rejects different values');
  check(timingSafeStringEqual('abc', 'abcdef') === false, 'timing-safe comparison rejects different lengths');
  check(timingSafeStringEqual('abc', null) === false, 'timing-safe comparison rejects non-strings');
}

// Transaction consumption: missing / mismatch / expired / replay.
function makeDenylist() {
  const burned = new Set();
  return {
    burned,
    async isJtiDenylisted(jti) {
      return { code: 'CHECKED', denylisted: burned.has(jti) };
    },
    async denylistJti(jti) {
      burned.add(jti);
      return { code: 'DENYLISTED' };
    },
  };
}

{
  const denylistService = makeDenylist();
  const service = makeTransactionService({ denylistService });
  const tx = service.createTransaction();
  const header = `${service.cookieName}=${tx.cookieValue}`;

  const missing = await service.consumeTransaction({ cookieHeader: '', presentedState: tx.state });
  check(missing.code === TX.MISSING, 'a missing transaction cookie is rejected');

  const noState = await service.consumeTransaction({ cookieHeader: header, presentedState: '' });
  check(noState.code === TX.STATE_MISMATCH, 'a missing state parameter is rejected');

  const wrongState = await service.consumeTransaction({ cookieHeader: header, presentedState: 'not-the-state' });
  check(wrongState.code === TX.STATE_MISMATCH, 'a mismatched state is rejected');

  const ok = await service.consumeTransaction({ cookieHeader: header, presentedState: tx.state });
  check(ok.code === TX.VALID, 'a matching state is accepted');
  check(ok.nonce === tx.nonce && ok.codeVerifier === tx.codeVerifier, 'the transaction returns its nonce and verifier');

  const replay = await service.consumeTransaction({ cookieHeader: header, presentedState: tx.state });
  check(replay.code === TX.REPLAYED, 'the same transaction cannot be used twice');

  const tampered = `${service.cookieName}=${tx.cookieValue.slice(0, -3)}abc`;
  const bad = await service.consumeTransaction({ cookieHeader: tampered, presentedState: tx.state });
  check(bad.code === TX.INVALID, 'a tampered transaction cookie is rejected');

  const foreign = jwt.sign({ state: 'x', nonce: 'y', cv: 'z' }, SIGNING_SECRET, {
    algorithm: 'HS256',
    issuer: 'strideto-api',
    audience: 'strideto-user-access',
    expiresIn: 600,
    jwtid: 'foreign',
  });
  const wrongAud = await service.consumeTransaction({
    cookieHeader: `${service.cookieName}=${foreign}`,
    presentedState: 'x',
  });
  check(wrongAud.code === TX.INVALID, 'an access-token audience is not accepted as a transaction');

  const expiredToken = jwt.sign({ state: 'x', nonce: 'y', cv: 'z' }, SIGNING_SECRET, {
    algorithm: 'HS256',
    issuer: 'strideto-api',
    audience: 'strideto-oauth-transaction',
    expiresIn: -10,
    jwtid: 'expired',
  });
  const expired = await service.consumeTransaction({
    cookieHeader: `${service.cookieName}=${expiredToken}`,
    presentedState: 'x',
  });
  check(expired.code === TX.EXPIRED, 'an expired transaction is rejected');

  const dupHeader = `${service.cookieName}=a; ${service.cookieName}=b`;
  const dup = await service.consumeTransaction({ cookieHeader: dupHeader, presentedState: 'a' });
  check(dup.code === TX.MISSING, 'a duplicated transaction cookie is refused as ambiguous');

  const failingDenylist = {
    async isJtiDenylisted() { return { code: 'STORAGE_FAILURE' }; },
    async denylistJti() { return { code: 'DENYLISTED' }; },
  };
  const failing = makeTransactionService({ denylistService: failingDenylist });
  const ftx = failing.createTransaction();
  const storageFail = await failing.consumeTransaction({
    cookieHeader: `${failing.cookieName}=${ftx.cookieValue}`,
    presentedState: ftx.state,
  });
  check(storageFail.code === TX.STORAGE_FAILURE, 'replay protection fails closed when its store is down');
}

// ---------------------------------------------------------------------------
// 3. ID token verification
// ---------------------------------------------------------------------------
{
  const valid = await verifyToken(signIdToken());
  check(valid.code === ID.VERIFIED, 'a well-formed Google id_token verifies');
  check(valid.assertion.provider === 'google', 'assertion names the google provider');
  check(valid.assertion.subject === 'google-sub-1', 'assertion carries the verified sub');
  check(valid.assertion.email === 'ada@example.com', 'assertion carries the verified email');
  check(valid.assertion.emailVerified === true, 'assertion asserts a verified email');
  check(valid.assertion.displayName === 'Ada Lovelace', 'assertion carries a safe display name');
  check(!('picture' in valid.assertion) && !('hd' in valid.assertion), 'extra provider claims are dropped');

  const bareIssuer = await verifyToken(signIdToken({ iss: 'accounts.google.com' }));
  check(bareIssuer.code === ID.VERIFIED, 'the bare accounts.google.com issuer is accepted');

  const cases = [
    [signIdToken({ iss: 'https://evil.test' }), ID.ISSUER_INVALID, 'wrong issuer'],
    [signIdToken({ aud: 'other-client' }), ID.AUDIENCE_INVALID, 'wrong audience'],
    [signIdToken({ azp: 'other-client' }), ID.AZP_INVALID, 'wrong azp'],
    [signIdToken({ exp: NOW() - 3600, iat: NOW() - 7200 }), ID.EXPIRED, 'expired token'],
    [signIdToken({ iat: NOW() + 3600 }), ID.IAT_INVALID, 'excessively future iat'],
    [signIdToken({ nonce: 'a-different-nonce' }), ID.NONCE_MISMATCH, 'nonce mismatch'],
    [signIdToken({ sub: undefined }), ID.SUBJECT_MISSING, 'missing sub'],
    [signIdToken({ email: undefined }), ID.EMAIL_MISSING, 'missing email'],
    [signIdToken({ email_verified: false }), ID.EMAIL_UNVERIFIED, 'email_verified false'],
    [signIdToken({ email_verified: 'true' }), ID.EMAIL_UNVERIFIED, 'email_verified must be boolean true'],
  ];
  for (const [token, expected, label] of cases) {
    const result = await verifyToken(token);
    check(result.code === expected, `id_token rejected: ${label}`);
  }

  const noneToken = `${Buffer.from(JSON.stringify({ alg: 'none', kid: KID })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'x' })).toString('base64url')}.`;
  check((await verifyToken(noneToken)).code === ID.UNSUPPORTED_ALGORITHM, 'id_token rejected: alg none');

  const hs256 = jwt.sign({ iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'x', nonce: 'test-nonce' }, 'secret', {
    algorithm: 'HS256',
    keyid: KID,
  });
  check((await verifyToken(hs256)).code === ID.UNSUPPORTED_ALGORITHM, 'id_token rejected: HS256');

  const wrongKey = signIdToken({}, { key: OTHER_PRIVATE_PEM, kid: KID });
  check((await verifyToken(wrongKey)).code === ID.SIGNATURE_INVALID, 'id_token rejected: wrong signing key');

  const valid2 = signIdToken();
  const tampered = `${valid2.slice(0, valid2.lastIndexOf('.'))}.${'A'.repeat(342)}`;
  check((await verifyToken(tampered)).code === ID.SIGNATURE_INVALID, 'id_token rejected: tampered signature');

  const noKid = jwt.sign({ iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'x', nonce: 'test-nonce' }, PRIVATE_PEM, {
    algorithm: 'RS256',
  });
  check((await verifyToken(noKid)).code === ID.UNKNOWN_KEY, 'id_token rejected: no kid');

  check((await verifyToken('not-a-jwt')).code === ID.MALFORMED, 'id_token rejected: malformed');
  check((await verifyToken(signIdToken(), { nonce: '' })).code === ID.NONCE_MISMATCH, 'verification requires an expected nonce');
}

// Unknown kid triggers exactly one bounded refetch, then resolves.
{
  const fetchState = makeJwksFetch((callNumber) => (callNumber === 1 ? [OTHER_JWK] : [OTHER_JWK, PUBLIC_JWK]));
  const cache = createGoogleJwksCache({ fetchImpl: fetchState.fetchImpl, minRefetchIntervalMs: 0 });
  // Warm the cache with the pre-rotation key set first; the refetch path under
  // test is "fresh cache, kid it has never seen", not "cold cache".
  await cache.getSigningKey('rotated-kid');
  check(fetchState.calls.count === 1, 'warming the cache costs one fetch');
  const verifier = createGoogleIdTokenVerifier({ jwksCache: cache });
  const result = await verifier.verify({ idToken: signIdToken(), clientId: CLIENT_ID, expectedNonce: 'test-nonce' });
  check(result.code === ID.VERIFIED, 'an unknown kid on a fresh cache is resolved by a single JWKS refetch');
  check(fetchState.calls.count === 2, 'the refetch happens exactly once, not in a loop');
}

// A kid that stays unknown does not retry forever.
{
  const fetchState = makeJwksFetch([OTHER_JWK]);
  const cache = createGoogleJwksCache({ fetchImpl: fetchState.fetchImpl, minRefetchIntervalMs: 0 });
  const verifier = createGoogleIdTokenVerifier({ jwksCache: cache });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await verifier.verify({ idToken: signIdToken(), clientId: CLIENT_ID, expectedNonce: 'test-nonce' });
    check(result.code === ID.UNKNOWN_KEY, 'a permanently unknown kid is rejected');
  }
  check(fetchState.calls.count <= 6, 'an unknown kid never triggers unbounded refetching');
}

// JWKS unavailable fails closed.
{
  for (const [impl, label] of [
    [async () => { throw new Error('network down'); }, 'network failure'],
    [async () => ({ ok: false }), 'non-200 response'],
    [async () => ({ ok: true, json: async () => ({}) }), 'malformed document'],
  ]) {
    const cache = createGoogleJwksCache({ fetchImpl: impl });
    const verifier = createGoogleIdTokenVerifier({ jwksCache: cache });
    const result = await verifier.verify({ idToken: signIdToken(), clientId: CLIENT_ID, expectedNonce: 'test-nonce' });
    check(result.code === ID.KEYS_UNAVAILABLE, `JWKS ${label} fails closed`);
  }
}

// Cache bounds and TTL.
{
  const many = Array.from({ length: 50 }, (_, i) => ({ ...PUBLIC_JWK, kid: `k-${i}` }));
  const cache = createGoogleJwksCache({ fetchImpl: makeJwksFetch(many).fetchImpl, maxKeys: 4 });
  await cache.getSigningKey('k-0');
  check(cache.inspect().size === 4, 'the JWKS cache never accumulates beyond its bound');

  const fetchState = makeJwksFetch();
  let clock = 0;
  const ttlCache = createGoogleJwksCache({ fetchImpl: fetchState.fetchImpl, now: () => clock, ttlMs: 1000 });
  await ttlCache.getSigningKey(KID);
  await ttlCache.getSigningKey(KID);
  check(fetchState.calls.count === 1, 'a fresh cache is reused rather than refetched');
  clock = 5000;
  await ttlCache.getSigningKey(KID);
  check(fetchState.calls.count === 2, 'the cache refetches after its TTL expires');
  check(ttlCache.inspect().fresh === true, 'the cache reports freshness after a reload');
  // Non-RSA and encryption keys are dropped rather than cached.
  const mixed = createGoogleJwksCache({
    fetchImpl: makeJwksFetch([{ kty: 'EC', kid: 'ec' }, { ...PUBLIC_JWK, use: 'enc' }, PUBLIC_JWK]).fetchImpl,
  });
  await mixed.getSigningKey(KID);
  check(mixed.inspect().size === 1, 'only usable RSA signing keys are cached');
}

// ---------------------------------------------------------------------------
// 4. Index readiness
// ---------------------------------------------------------------------------

const READY_INDEXES = [
  { name: 'user_identity_provider_subject_unique', key: { provider: 1, subject: 1 }, unique: true },
  { name: 'user_identity_user_provider_unique', key: { userId: 1, provider: 1 }, unique: true },
];

{
  check(REQUIRED_USER_IDENTITY_INDEX_NAMES.length === 2, 'two physical unique indexes are required');
  check(evaluateUserIdentityIndexReadiness(READY_INDEXES).code === IDX.READY, 'correct physical indexes are accepted');
  check(evaluateUserIdentityIndexReadiness([]).code === IDX.MISSING, 'an empty index list is not ready');
  check(
    evaluateUserIdentityIndexReadiness([READY_INDEXES[0]]).code === IDX.MISSING,
    'a partially provisioned collection is not ready'
  );
  const nonUnique = [{ ...READY_INDEXES[0], unique: false }, READY_INDEXES[1]];
  check(
    evaluateUserIdentityIndexReadiness(nonUnique).code === IDX.MISMATCHED,
    'a non-unique index of the right name is a mismatch, not readiness'
  );
  check(evaluateUserIdentityIndexReadiness(null).code === IDX.UNAVAILABLE, 'an unreadable index list is unavailable');

  const readiness = createUserIdentityIndexReadiness({
    readIndexes: async () => { throw new Error('mongo down'); },
  });
  check((await readiness.assertReady()).code === IDX.UNAVAILABLE, 'a database failure fails closed');

  const nsError = Object.assign(new Error('ns'), { codeName: 'NamespaceNotFound' });
  const missingNs = createUserIdentityIndexReadiness({ readIndexes: async () => { throw nsError; } });
  check((await missingNs.assertReady()).code === IDX.MISSING, 'a missing collection reports missing indexes');

  let reads = 0;
  const cached = createUserIdentityIndexReadiness({
    readIndexes: async () => { reads += 1; return READY_INDEXES; },
  });
  await cached.assertReady();
  await cached.assertReady();
  check(reads === 1, 'a ready verdict is cached');
}

// ---------------------------------------------------------------------------
// 5. Flow: start
// ---------------------------------------------------------------------------

const ENABLED_CONFIG = Object.freeze({
  enabled: true,
  production: false,
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
  frontendCallbackUrl: 'https://strideto.test/auth/callback',
  authorizationEndpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
  tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
  jwksUri: GOOGLE_JWKS_URI,
  acceptedIssuers: GOOGLE_ACCEPTED_ISSUERS,
  scope: GOOGLE_SCOPE_STRING,
});

function makeSocialService(behaviour = {}) {
  const calls = [];
  return {
    calls,
    async resolveIdentity(assertion) {
      calls.push({ method: 'resolveIdentity', assertion });
      return behaviour.resolve || { code: R.ELIGIBLE_FOR_NEW_ACCOUNT };
    },
    async resolveOrCreate(assertion, provenance) {
      calls.push({ method: 'resolveOrCreate', assertion, provenance });
      return behaviour.resolveOrCreate || {
        code: R.IDENTITY_RESOLVED,
        user: { _id: 'u-1', tokenVersion: 3 },
        identity: { _id: 'i-1' },
      };
    },
  };
}

function makeSessionFlows(result) {
  const calls = [];
  return {
    calls,
    async issueLoginSession(input) {
      calls.push(input);
      return result || { code: 'SESSION_ISSUED', accessToken: 'ACCESS.TOKEN.VALUE', refreshToken: 'REFRESH.TOKEN.VALUE' };
    },
  };
}

function makeFlows({
  config = ENABLED_CONFIG,
  indexes = READY_INDEXES,
  social = makeSocialService(),
  session = makeSessionFlows(),
  tokenResponse,
  denylistService = makeDenylist(),
  jwksKeys = [PUBLIC_JWK],
} = {}) {
  const base = makeTransactionService({ denylistService });
  // Capture the live transaction so the stubbed token endpoint can mint an
  // id_token bound to the real nonce, exactly as Google would.
  const issued = [];
  const transactionService = Object.freeze({
    ...base,
    createTransaction() {
      const transaction = base.createTransaction();
      issued.push(transaction);
      return transaction;
    },
  });
  const currentNonce = () => (issued.length ? issued[issued.length - 1].nonce : 'test-nonce');
  const cache = createGoogleJwksCache({ fetchImpl: makeJwksFetch(jwksKeys).fetchImpl });
  const lastLogin = [];
  const flows = createGoogleOidcFlows({
    config,
    transactionService,
    idTokenVerifier: createGoogleIdTokenVerifier({ jwksCache: cache }),
    socialIdentityService: social,
    sessionFlows: session,
    indexReadiness: createUserIdentityIndexReadiness({ readIndexes: async () => indexes }),
    fetchImpl:
      tokenResponse
      || (async () => ({ ok: true, json: async () => ({ id_token: signIdToken({ nonce: currentNonce() }) }) })),
    recordLastLogin: async (input) => { lastLogin.push(input); },
  });
  return { flows, transactionService, social, session, lastLogin, currentNonce };
}

{
  const { flows } = makeFlows();
  const result = await flows.start();
  check(result.code === FLOW.AUTHORIZATION_REDIRECT, 'start produces an authorization redirect');

  const url = new URL(result.authorizationUrl);
  check(`${url.origin}${url.pathname}` === GOOGLE_AUTHORIZATION_ENDPOINT, 'start targets the pinned authorization endpoint');
  check(url.searchParams.get('response_type') === 'code', 'response_type is code');
  check(url.searchParams.get('client_id') === CLIENT_ID, 'client_id is sent');
  check(url.searchParams.get('redirect_uri') === REDIRECT_URI, 'redirect_uri is the configured value');
  check(url.searchParams.get('scope') === 'openid email profile', 'scope is openid email profile');
  check(url.searchParams.get('code_challenge_method') === 'S256', 'code_challenge_method is S256');
  check((url.searchParams.get('state') || '').length >= 40, 'state is present and high entropy');
  check((url.searchParams.get('nonce') || '').length >= 40, 'nonce is present and high entropy');
  check((url.searchParams.get('code_challenge') || '').length >= 40, 'code_challenge is present');
  check(!url.searchParams.has('client_secret'), 'the client secret is never in the authorization URL');
  check(!url.searchParams.has('code_verifier'), 'the code_verifier is never in the authorization URL');

  const claims = jwt.decode(result.cookieValue);
  check(claims.state === url.searchParams.get('state'), 'the cookie binds the state sent to Google');
  check(claims.nonce === url.searchParams.get('nonce'), 'the cookie binds the nonce sent to Google');
  check(
    deriveCodeChallenge(claims.cv) === url.searchParams.get('code_challenge'),
    'the cookie holds the verifier for the challenge sent to Google'
  );
}

// Disabled and not-ready providers refuse to start.
{
  const disabled = makeFlows({ config: { enabled: false } });
  check((await disabled.flows.start()).code === FLOW.DISABLED, 'a disabled provider does not start a flow');

  const notReady = makeFlows({ indexes: [] });
  const result = await notReady.flows.start();
  check(result.code === FLOW.NOT_READY, 'missing physical indexes block the flow from starting');
  check(result.readiness === IDX.MISSING, 'the readiness reason is reported internally');

  const mismatched = makeFlows({ indexes: [{ ...READY_INDEXES[0], unique: false }, READY_INDEXES[1]] });
  check((await mismatched.flows.start()).code === FLOW.NOT_READY, 'mismatched indexes block the flow');
}

// ---------------------------------------------------------------------------
// 6. Flow: callback
// ---------------------------------------------------------------------------

async function runCallback(setup = {}, overrides = {}) {
  const harness = makeFlows(setup);
  const started = await harness.flows.start();
  const state = new URL(started.authorizationUrl).searchParams.get('state');
  const cookieHeader = `${harness.transactionService.cookieName}=${started.cookieValue}`;
  const result = await harness.flows.callback({
    code: 'auth-code',
    state,
    cookieHeader,
    ...overrides,
  });
  return { ...harness, result, state, cookieHeader, started };
}

{
  const { result, session, social, lastLogin, flows } = await runCallback();
  check(result.code === FLOW.SESSION_ISSUED, 'a complete callback issues a session');
  check(result.clearTransactionCookie === true, 'a successful callback clears the transaction');
  check(session.calls.length === 1, 'the existing issueLoginSession is called exactly once');
  check(session.calls[0].subjectId === 'u-1', 'the session is issued for the resolved user');
  check(session.calls[0].tokenVersion === 3, 'the session carries the user tokenVersion');
  check(result.refreshToken === 'REFRESH.TOKEN.VALUE', 'the existing refresh token is returned for the cookie');
  check(!('accessToken' in result), 'the access token is not carried out of the flow');
  check(lastLogin.length === 1 && lastLogin[0].userId === 'u-1', 'lastLoginAt is recorded after authentication');

  const call = social.calls.find((c) => c.method === 'resolveOrCreate');
  check(call.assertion.provider === 'google', 'the P1 service receives a google assertion');
  check(call.assertion.subject === 'google-sub-1', 'the assertion subject is the verified sub');
  check(call.assertion.emailVerified === true, 'the assertion is verified');
  check(call.provenance.grantedBy === 'system:oauth_google', 'Google provenance grantedBy is correct');
  check(call.provenance.grantReason === 'student_registration_google', 'Google provenance grantReason is correct');
  check(GOOGLE_PROVENANCE.grantedBy === 'system:oauth_google', 'exported provenance matches');

  const redirect = new URL(flows.buildFrontendRedirect(result));
  check(redirect.origin + redirect.pathname === 'https://strideto.test/auth/callback', 'success redirects to the frontend callback');
  check(redirect.searchParams.get('status') === 'success', 'success carries only a status marker');
  check(redirect.hash === '', 'no fragment is used');
  check([...redirect.searchParams.keys()].length === 1, 'the success redirect carries exactly one parameter');
  const raw = flows.buildFrontendRedirect(result);
  check(!/REFRESH|ACCESS|token/i.test(raw), 'no token appears in the redirect URL');
  check(!/ada@example\.com|google-sub-1/.test(raw), 'no email or subject appears in the redirect URL');
}

// Callback failure modes.
{
  const missingCookie = await runCallback({}, { cookieHeader: '' });
  check(missingCookie.result.code === FLOW.TRANSACTION_INVALID, 'a missing transaction cookie is rejected');
  check(missingCookie.result.clearTransactionCookie === true, 'the transaction is cleared on a missing cookie');
  check(missingCookie.session.calls.length === 0, 'no session is issued without a transaction');

  const badState = await runCallback({}, { state: 'forged-state' });
  check(badState.result.code === FLOW.TRANSACTION_INVALID, 'a mismatched state is rejected');
  check(badState.result.reason === TX.STATE_MISMATCH, 'the state mismatch reason is recorded');

  const providerError = await runCallback({}, { providerError: 'access_denied' });
  check(providerError.result.code === FLOW.PROVIDER_ERROR, 'a provider error callback is rejected');
  check(providerError.result.clearTransactionCookie === true, 'the transaction is cleared on a provider error');
  check(providerError.session.calls.length === 0, 'no session is issued on a provider error');

  const noCode = await runCallback({}, { code: '' });
  check(noCode.result.code === FLOW.CODE_MISSING, 'a callback without a code is rejected');
  check(noCode.result.clearTransactionCookie === true, 'the transaction is cleared when the code is missing');

  const exchangeFailed = await runCallback({ tokenResponse: async () => ({ ok: false }) });
  check(exchangeFailed.result.code === FLOW.TOKEN_EXCHANGE_FAILED, 'a failed token exchange is rejected');
  check(exchangeFailed.result.clearTransactionCookie === true, 'the transaction is cleared on exchange failure');
  check(exchangeFailed.session.calls.length === 0, 'no session is issued on exchange failure');

  const exchangeThrew = await runCallback({ tokenResponse: async () => { throw new Error('boom'); } });
  check(exchangeThrew.result.code === FLOW.TOKEN_EXCHANGE_FAILED, 'a thrown token exchange is contained');

  const noIdToken = await runCallback({ tokenResponse: async () => ({ ok: true, json: async () => ({ access_token: 'x' }) }) });
  check(noIdToken.result.code === FLOW.TOKEN_EXCHANGE_FAILED, 'a token response without an id_token is rejected');

  const badToken = await runCallback({
    tokenResponse: async () => ({ ok: true, json: async () => ({ id_token: signIdToken({ aud: 'other' }) }) }),
  });
  check(badToken.result.code === FLOW.ID_TOKEN_INVALID, 'an id_token with the wrong audience is rejected');
  check(badToken.result.reason === ID.AUDIENCE_INVALID, 'the id_token failure reason is recorded internally');
  check(badToken.session.calls.length === 0, 'no session is issued for an invalid id_token');

  const nonceReplay = await runCallback({
    tokenResponse: async () => ({ ok: true, json: async () => ({ id_token: signIdToken({ nonce: 'stale-nonce' }) }) }),
  });
  check(nonceReplay.result.code === FLOW.ID_TOKEN_INVALID, 'an id_token bound to another nonce is rejected');
}

// The token exchange itself sends the right parameters, server-side only.
{
  const seen = [];
  const harness = makeFlows({
    tokenResponse: async (url, init) => {
      seen.push({ url, body: init.body.toString(), method: init.method });
      return { ok: true, json: async () => ({ id_token: signIdToken() }) };
    },
  });
  const started = await harness.flows.start();
  const state = new URL(started.authorizationUrl).searchParams.get('state');
  await harness.flows.callback({
    code: 'auth-code',
    state,
    cookieHeader: `${harness.transactionService.cookieName}=${started.cookieValue}`,
  });
  const [exchange] = seen;
  const params = new URLSearchParams(exchange.body);
  check(exchange.url === GOOGLE_TOKEN_ENDPOINT, 'the exchange targets the pinned token endpoint');
  check(exchange.method === 'POST', 'the exchange is a POST');
  check(params.get('grant_type') === 'authorization_code', 'the exchange uses the authorization_code grant');
  check(params.get('code') === 'auth-code', 'the exchange sends the authorization code');
  check(params.get('client_id') === CLIENT_ID, 'the exchange sends the client id');
  check(params.get('client_secret') === CLIENT_SECRET, 'the exchange sends the client secret server-side');
  check(params.get('redirect_uri') === REDIRECT_URI, 'the exchange repeats the configured redirect_uri');
  check(
    deriveCodeChallenge(params.get('code_verifier')) === new URL(started.authorizationUrl).searchParams.get('code_challenge'),
    'the exchange proves possession of the PKCE verifier'
  );
}

// Replay of a whole callback is refused by the burned transaction.
{
  const harness = makeFlows();
  const started = await harness.flows.start();
  const state = new URL(started.authorizationUrl).searchParams.get('state');
  const cookieHeader = `${harness.transactionService.cookieName}=${started.cookieValue}`;
  const first = await harness.flows.callback({ code: 'auth-code', state, cookieHeader });
  const second = await harness.flows.callback({ code: 'auth-code', state, cookieHeader });
  check(first.code === FLOW.SESSION_ISSUED, 'the first callback succeeds');
  check(second.code === FLOW.TRANSACTION_INVALID, 'a replayed callback is rejected');
  check(second.reason === TX.REPLAYED, 'the replay is identified as such');
  check(harness.session.calls.length === 1, 'a replayed callback issues no second session');
}

// ---------------------------------------------------------------------------
// 7. Identity policy outcomes reaching the flow
// ---------------------------------------------------------------------------
{
  const policyCases = [
    [R.EXISTING_ACCOUNT_REQUIRES_LINK, 'existing_account_requires_link', 'an existing STRIDETO email requires deliberate linking'],
    [R.ACCOUNT_SUSPENDED, 'account_suspended', 'a suspended account is refused'],
    [R.PROVIDER_EMAIL_UNVERIFIED, 'provider_email_unverified', 'an unverified provider email is refused'],
    [R.CAPABILITY_INITIALIZATION_FAILED, 'oauth_failed', 'a capability initialization failure issues no session'],
    [R.STORAGE_FAILURE, 'oauth_failed', 'a storage failure issues no session'],
    [R.IDENTITY_ORPHANED, 'oauth_failed', 'an orphaned identity issues no session'],
  ];
  for (const [resolutionCode, redirectCode, label] of policyCases) {
    const harness = await runCallback({
      social: makeSocialService({ resolveOrCreate: { code: resolutionCode } }),
    });
    check(harness.result.code === FLOW.POLICY_REJECTED, `policy rejection: ${label}`);
    check(harness.session.calls.length === 0, `no session issued: ${label}`);
    check(harness.result.clearTransactionCookie === true, `transaction cleared: ${label}`);
    const redirect = new URL(harness.flows.buildFrontendRedirect(harness.result));
    check(redirect.searchParams.get('error') === redirectCode, `redirect code for ${label}`);
    check(!redirect.searchParams.has('status'), `no success marker for ${label}`);
  }
}

// A known Google subject logs in without any account mutation.
{
  const harness = await runCallback({
    social: makeSocialService({
      resolveOrCreate: {
        code: R.IDENTITY_RESOLVED,
        user: { _id: 'u-known', tokenVersion: 7, role: 'User' },
        identity: { _id: 'i-known' },
      },
    }),
  });
  check(harness.result.code === FLOW.SESSION_ISSUED, 'a known Google subject signs in');
  check(harness.result.createdAccount === false, 'a known subject is not reported as a new account');
  check(harness.session.calls[0].subjectId === 'u-known', 'the linked user is the session subject');
  check(harness.lastLogin[0].identityId === 'i-known', 'the identity login timestamp is recorded');
}

// A new Google user is reported as created.
{
  const harness = await runCallback({
    social: makeSocialService({
      resolveOrCreate: {
        code: R.IDENTITY_RESOLVED,
        user: { _id: 'u-new', tokenVersion: 0 },
        identity: { _id: 'i-new' },
        created: true,
      },
    }),
  });
  check(harness.result.code === FLOW.SESSION_ISSUED, 'a new Google user signs in after creation');
  check(harness.result.createdAccount === true, 'a newly created account is reported as such');
  check(harness.session.calls[0].tokenVersion === 0, 'a new account starts at tokenVersion 0');
}

// A session-issuance failure never reports success.
{
  const harness = await runCallback({
    session: makeSessionFlows({ code: 'STORAGE_FAILURE', httpStatus: 503 }),
  });
  check(harness.result.code === FLOW.SESSION_FAILED, 'a failed session issuance is reported as a failure');
  check(harness.lastLogin.length === 0, 'no login is recorded when the session fails');
  const redirect = new URL(harness.flows.buildFrontendRedirect(harness.result));
  check(redirect.searchParams.get('error') === 'oauth_failed', 'a session failure redirects with a generic code');
}

// ---------------------------------------------------------------------------
// 8. Redirect safety
// ---------------------------------------------------------------------------
{
  const { flows } = makeFlows();
  for (const code of OAUTH_REDIRECT_ERRORS) {
    check(isAllowlistedRedirectError(code), `${code} is an allowlisted redirect code`);
  }
  check(!isAllowlistedRedirectError('anything_else'), 'unknown codes are not allowlisted');
  check(toRedirectErrorCode('some_internal_thing') === 'oauth_failed', 'unknown internal codes collapse to oauth_failed');
  check(toRedirectErrorCode(undefined) === 'oauth_failed', 'an absent code collapses to oauth_failed');

  const leaky = flows.buildFrontendRedirect({
    code: FLOW.POLICY_REJECTED,
    reason: 'Error: connect ECONNREFUSED 10.0.0.1:27017',
  });
  check(new URL(leaky).searchParams.get('error') === 'oauth_failed', 'exception text never reaches the redirect');
  check(!/ECONNREFUSED|10\.0\.0\.1/.test(leaky), 'no internal detail leaks into the redirect');

  const target = new URL(flows.buildFrontendRedirect({ code: FLOW.SESSION_ISSUED }));
  check(target.origin === 'https://strideto.test', 'the redirect origin is always the configured frontend');
}

// ---------------------------------------------------------------------------
// 9. Source contracts
// ---------------------------------------------------------------------------
{
  const routes = readRepo('server/src/routes/oauth.js');
  check(/\/auth\/oauth\/google\/start/.test(routes), 'the start route is mounted');
  check(/\/auth\/oauth\/google\/callback/.test(routes), 'the callback route is mounted');
  check(/oauthStartLimiter/.test(routes) && /oauthCallbackLimiter/.test(routes), 'both OAuth routes are rate limited');
  check(!codeOnly(routes).includes('secureTrustedOrigin'), 'secureTrustedOrigin is not applied to the Google callback');

  const authRoutes = readRepo('server/src/routes/auth.js');
  check(/authRouter\.post\('\/auth\/login', authLimiter, secureTrustedOrigin, login\)/.test(authRoutes), 'password login keeps its trusted-origin guard');
  check(!/oauth/i.test(authRoutes), 'the password auth router is untouched');

  const controller = readRepo('server/src/controllers/oauthController.js');
  check(/issueLoginSession/.test(readRepo('server/src/services/auth/googleOidcFlows.js')), 'the flow reuses issueLoginSession');
  check(/cookiePolicy\.writeRefreshCookie/.test(controller), 'the controller reuses the existing refresh cookie writer');
  check(/realm: 'user'/.test(controller), 'the Google session is an ordinary user-realm session');
  check(!/accessToken/.test(codeOnly(controller)), 'the controller never handles an access token');

  const flowsSrc = codeOnly(readRepo('server/src/services/auth/googleOidcFlows.js'));
  check(!/jwt\.sign/.test(flowsSrc), 'the flow mints no JWT of its own');
  check(!/res\.|req\./.test(flowsSrc), 'the flow layer is framework-agnostic');
  check(!/role|capability|grantCapability/.test(flowsSrc.replace(/GOOGLE_PROVENANCE|grantedBy|grantReason/g, '')), 'the flow never touches role or capabilities');

  const verifier = readRepo('server/src/services/auth/googleIdTokenVerifier.js');
  check(/algorithms: ALLOWED_ALGORITHMS/.test(verifier), 'the verifier pins its algorithm list');
  check(/'RS256'/.test(verifier) && !/'HS256'/.test(verifier), 'only RS256 is allowed');

  const pkg = readRepo('server/package.json');
  check(!/passport|express-session|openid-client|google-auth-library|oauth4webapi/.test(pkg), 'no OAuth library or session middleware was installed');

  const identityModel = codeOnly(readRepo('server/src/models/UserIdentity.js'));
  check(!/accessToken|refreshToken|id_token/.test(identityModel), 'no OAuth material is persisted');

  for (const rel of [
    'client/src/components/auth/SocialAuthButton.jsx',
    'client/src/pages/Auth/Login.jsx',
    'client/src/pages/Auth/Register.jsx',
  ]) {
    check(/comingSoon/.test(readRepo(rel)), `${rel} is untouched (still coming-soon)`);
  }
  const clientSrc = readRepo('client/src/components/account/ConnectedAccountsPanel.jsx');
  check(!/GOOGLE_CLIENT_SECRET|GOOGLE_REDIRECT_URI/.test(clientSrc), 'no Google server variable reached the frontend');

  const linking = codeOnly(readRepo('server/src/services/auth/socialIdentityLinking.js'));
  check(!/google/i.test(linking), 'the P1 linking service stayed provider-neutral');
  check(!/linkedin|facebook/i.test(codeOnly(readRepo('server/src/services/auth/googleOidcFlows.js'))), 'no LinkedIn or Facebook implementation was added');

  const envValidation = readRepo('server/src/config/validateEnv.js');
  check(/OAUTH_GOOGLE_ENABLED === '1'/.test(envValidation), 'production validates an enabled Google configuration');
  check(/buildGoogleOidcConfig\(process\.env\)/.test(envValidation), 'production reuses the same config builder');
}

console.log(`googleOidcP2: ${count} checks passed`);
