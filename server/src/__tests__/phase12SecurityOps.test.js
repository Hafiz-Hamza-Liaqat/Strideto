/**
 * Phase 12 — security / devops / scalability / operations contracts.
 * Synthetic + source + isolated process only. No protected volumes, no worker start.
 * Run: node src/__tests__/phase12SecurityOps.test.js
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { getCorsOptions } from '../config/cors.js';
import { getHelmetOptions, PERMISSIONS_POLICY, buildCspDirectives } from '../config/security.js';
import { createAuthCookiePolicy } from '../services/auth/AuthCookiePolicy.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { requestId } from '../middleware/requestId.js';
import { redactMeta } from '../utils/logger.js';
import { isShuttingDown } from '../config/shutdown.js';
import { rejectDangerousFilename } from '../utils/fileValidation.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
const root = path.resolve(serverSrc, '..', '..');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

function isPlaceholder(text) {
  return /replace-with|REPLACE_WITH|your-super-secret|example\.com|placeholder|synthetic|\.\.\.|localhost|127\.0\.0\.1|edurozgaar/i.test(text);
}

function walkJs(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkJs(full, acc);
    else if (/\.(js|jsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

function corsDecision(options, origin) {
  let result;
  options.origin(origin, (_err, allowed) => {
    result = allowed;
  });
  return result;
}

// --- CORS / origin ---
{
  const previous = { ...process.env };
  process.env.NODE_ENV = 'production';
  process.env.SITE_URL = 'https://localhost:8443';
  process.env.FRONTEND_URL = 'https://localhost:8443';
  delete process.env.CORS_ORIGINS;
  delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;
  const cors = getCorsOptions();
  check(cors.credentials === true, 'credentialed CORS enabled');
  check(corsDecision(cors, 'https://localhost:8443') === true, 'trusted local HTTPS origin allowed');
  check(corsDecision(cors, 'https://evil.example') === false, 'untrusted origin denied');
  check(corsDecision(cors, 'not a url') === false, 'malformed origin denied in production');
  check(corsDecision(cors, undefined) === true, 'missing Origin allowed for non-browser');
  check(!read('server/src/config/cors.js').includes("origin: '*'"), 'no wildcard credentialed CORS');
  for (const [k, v] of Object.entries(previous)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

// --- Cookie flags (names + flags only; never print values) ---
{
  const policy = createAuthCookiePolicy({
    mode: 'production',
    apiOrigin: 'https://localhost:8443',
    trustedOrigins: ['https://localhost:8443'],
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  });
  const names = [];
  for (const realm of ['user', 'employer', 'agent', 'institution']) {
    const res = { cookieCalls: [], cookie(name, _value, options) { this.cookieCalls.push({ name, options }); } };
    const written = policy.writeRefreshCookie({ res, realm, token: 'x'.repeat(50) });
    check(written.code === 'COOKIE_WRITTEN', `${realm} refresh cookie writes`);
    const call = res.cookieCalls[0];
    names.push(call.name);
    check(call.options.httpOnly === true, `${realm} refresh cookie is HttpOnly`);
    check(call.options.secure === true, `${realm} production refresh cookie is Secure`);
    check(call.options.sameSite === 'lax', `${realm} SameSite=Lax`);
    check(typeof call.options.path === 'string' && call.options.path.startsWith('/api/auth/'), `${realm} cookie path is realm-scoped`);
  }
  check(new Set(names).size === 4, 'realm cookie names do not collide');
}

// --- Helmet / API CSP ---
{
  const apiCsp = buildCspDirectives({ forApi: true });
  check(apiCsp.defaultSrc.includes("'none'"), 'API CSP default-src none');
  check(apiCsp.frameAncestors.includes("'none'"), 'API CSP frame-ancestors none');
  const helmetOpts = getHelmetOptions();
  check(helmetOpts.frameguard.action === 'deny', 'X-Frame-Options DENY');
  check(helmetOpts.noSniff === true, 'X-Content-Type-Options nosniff');
  check(helmetOpts.referrerPolicy.policy === 'strict-origin-when-cross-origin', 'Referrer-Policy configured');
  check(PERMISSIONS_POLICY.includes('camera=()'), 'Permissions-Policy denies camera');
}

// --- Request id + safe 500 ---
{
  const app = express();
  app.use(requestId);
  app.get('/boom', () => {
    const err = new Error('E11000 duplicate key secret=super-secret');
    err.status = 500;
    throw err;
  });
  app.use(errorHandler);

  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/boom`, {
    headers: { 'x-request-id': 'phase12-corr-1' },
  });
  const body = await res.json();
  check(res.status === 500, 'synthetic 500 status');
  check(body.error === 'Internal Server Error', 'production 500 is sanitized');
  check(body.requestId === 'phase12-corr-1', '500 returns correlation id');
  check(!JSON.stringify(body).includes('super-secret'), '500 does not echo secret');
  check(!body.stack, 'production 500 has no stack');
  check(res.headers.get('x-request-id') === 'phase12-corr-1', 'X-Request-Id is reflected');
  process.env.NODE_ENV = prev;
  await new Promise((resolve) => server.close(resolve));
}

// --- Helmet headers on a mini API ---
{
  const app = express();
  app.use(helmet(getHelmetOptions()));
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });
  app.get('/h', (_req, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/h`);
  check(res.headers.get('x-content-type-options') === 'nosniff', 'nosniff header present');
  check(/DENY/i.test(res.headers.get('x-frame-options') || ''), 'frame deny header present');
  check((res.headers.get('referrer-policy') || '').includes('strict-origin'), 'referrer-policy present');
  check((res.headers.get('content-security-policy') || '').includes("default-src 'none'"), 'API CSP present');
  check((res.headers.get('permissions-policy') || '').includes('camera=()'), 'permissions-policy present');
  await new Promise((resolve) => server.close(resolve));
}

// --- Log redaction ---
{
  const redacted = redactMeta({
    password: 'hunter2',
    authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.aaa.bbb',
    cookie: 'rt=abc',
    stripe: 'sk_live_not_a_real_key_value',
    requestId: 'ok-id',
    message: 'Bearer eyJhbGciOiJIUzI1NiJ9.aaa.bbb failed',
  });
  check(redacted.password === '[redacted]', 'password redacted');
  check(redacted.authorization === '[redacted]', 'authorization redacted');
  check(redacted.cookie === '[redacted]', 'cookie redacted');
  check(redacted.stripe === '[redacted]', 'stripe key field redacted');
  check(redacted.requestId === 'ok-id', 'correlation id preserved');
  check(!String(redacted.message).includes('eyJ'), 'JWT material stripped from strings');
}

// --- Path / upload safety ---
{
  let threw = false;
  try {
    rejectDangerousFilename('../etc/passwd.exe');
  } catch {
    threw = true;
  }
  check(threw, 'path traversal + executable rejected');
  threw = false;
  try {
    rejectDangerousFilename('payload.svg');
  } catch {
    threw = true;
  }
  check(threw, 'svg upload rejected');
}

// --- Shutdown flag starts closed ---
check(isShuttingDown() === false, 'process is not shutting down during tests');

const shutdown = spawnSync(process.execPath, [path.join(here, 'phase12ShutdownProbe.mjs')], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, NODE_ENV: 'test', SHUTDOWN_TIMEOUT_MS: '4000' },
  timeout: 12_000,
});
check(shutdown.status === 0, 'isolated graceful shutdown exits 0');

// --- Source contracts ---
{
  const index = read('server/src/index.js');
  const health = read('server/src/routes/health.js');
  const worker = read('server/src/worker.js');
  const composeLocal = read('docker-compose.sec3f-local.yml');
  const rateLimit = read('server/src/middleware/rateLimit.js');
  const formField = read('client/src/components/forms/FormFieldInput.jsx');
  const authClient = read('client/src/context/AuthContext.jsx');
  const jobs = read('server/src/controllers/jobsController.js');
  const email = read('server/src/services/emailService.js');
  const loginReturn = read('client/src/utils/loginReturn.js');

  check(index.includes("express.json({ limit: '1mb' })"), 'JSON body bounded to 1mb');
  check(index.includes("urlencoded({ extended: false, limit: '1mb' })"), 'urlencoded body bounded to 1mb');
  check(index.includes('requestId'), 'request id middleware wired');
  check(health.includes('isShuttingDown()'), 'readiness fails closed during shutdown');
  check(health.includes("REQUIRE_REDIS === '1'"), 'Redis required flag honored by readiness');
  check(worker.includes('running = false'), 'worker has a clean stop contract');
  check(composeLocal.includes('sec3f-worker-disabled'), 'local overlay keeps worker stopped by profile');
  check(rateLimit.includes("res.setHeader('Retry-After'"), '429 sets Retry-After');
  check(rateLimit.includes('max: isDev ? 50 : 5'), 'login limiter not weakened');
  check(rateLimit.includes('createRedisRateLimitStore'), 'rate limits share Redis across replicas');
  check(formField.includes('sanitizeHtmlForRender'), 'form richtext uses sanitizer');
  check(!/localStorage\.(set|get)Item\(\s*['"`]?(edurozgaar-token|token)/.test(authClient), 'no access token in localStorage');
  check(jobs.includes('MAX_LIMIT = 50'), 'public jobs list is page-bounded');
  check(email.includes('isSmtpConfigured'), 'email provider has configured/not_configured gate');
  check(!/window\.location\s*=/.test(loginReturn), 'login return is not an open redirect');
}

// --- Tracked-source secret scan (paths/types only; never print values) ---
{
  const listed = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', timeout: 20_000 });
  check(listed.status === 0, 'git ls-files succeeded');
  const files = listed.stdout.split(/\r?\n/).filter(Boolean);
  const findings = [];
  const liveKey = /sk_live_[A-Za-z0-9]{16,}/;
  const awsKey = /AKIA[0-9A-Z]{16}/;
  const pem = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
  const mongoCred = /mongodb(?:\+srv)?:\/\/(?!USER:PASS)(?!username:password)([^/\s:]{3,}):([^@\s]{6,})@([^\s/"']+)/;

  for (const rel of files) {
    if (!/\.(js|jsx|mjs|cjs|ts|tsx|json|yml|yaml|md|env|example|html|sh)$/i.test(rel)) continue;
    if (rel.startsWith('docs/') && rel.includes('AUDIT')) continue;
    let text;
    try {
      text = readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue;
    }
    if (liveKey.test(text) && !isPlaceholder(text)) findings.push({ path: rel, type: 'stripe_live_key' });
    if (awsKey.test(text) && !isPlaceholder(text)) findings.push({ path: rel, type: 'aws_access_key' });
    if (pem.test(text) && text.length > 400) findings.push({ path: rel, type: 'private_key_pem' });
    const mongo = text.match(mongoCred);
    const mongoHost = mongo?.[3] || '';
    if (
      mongo &&
      !isPlaceholder(mongo[0]) &&
      !/change-me|replace|xxxxx|example\.invalid|example\.mongodb\.net|example\.com|localhost|127\.0\.0\.1/i.test(mongoHost)
    ) {
      findings.push({ path: rel, type: 'mongo_uri_credentials' });
    }
  }
  check(findings.length === 0, `tracked secret scan clean (${findings.length} findings)`);
}

// --- Frontend must not import server secret env names ---
{
  const forbidden = /process\.env\.(JWT_SECRET|REFRESH_SECRET|MONGO_URI|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET)/;
  const hits = [];
  for (const file of walkJs(path.join(root, 'client', 'src'))) {
    const text = readFileSync(file, 'utf8');
    if (forbidden.test(text)) hits.push(path.relative(root, file));
  }
  check(hits.length === 0, 'frontend source has no server secret env usage');
}

console.log(`phase12SecurityOps.test.js: ${count} assertions passed`);
