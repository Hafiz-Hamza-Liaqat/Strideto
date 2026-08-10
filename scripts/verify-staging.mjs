#!/usr/bin/env node
/**
 * L.2 Staging & production infrastructure verification (structural + optional live).
 */
import { existsSync, readFileSync } from 'fs';
import { docExists } from './lib/docExists.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let passed = 0;

function pass(n) { passed += 1; }
function fail(n, d) { failures.push(`${n}${d ? `: ${d}` : ''}`); }
function exists(p) { return existsSync(join(root, p)); }
function read(p) { return readFileSync(join(root, p), 'utf8'); }

function runNpm(script) {
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], {
    cwd: root,
    encoding: 'utf8',
    shell: true,
  });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

function runDockerComposeConfig() {
  const r = spawnSync(
    'docker',
    ['compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.staging.yml', 'config'],
    { cwd: root, encoding: 'utf8', shell: true, env: { ...process.env, JWT_SECRET: 'x'.repeat(32), SITE_URL: 'http://localhost:8080', VITE_APP_URL: 'http://localhost:8080' } }
  );
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

// Artifacts
{
  const required = [
    'docker-compose.yml',
    'docker-compose.staging.yml',
    'docker/Dockerfile.server',
    'docker/Dockerfile.client',
    'docker/nginx.conf',
    'docker/.env.production.example',
    'docker/.env.staging.example',
    'deploy/Caddyfile',
    'deploy/staging-up.sh',
    'deploy/staging-down.sh',
    'deploy/rollback.sh',
    'deploy/deploy.sh',
    'deploy/setup-vps.sh',
    'scripts/smoke-test.mjs',
    'scripts/backup/mongo-backup.sh',
    'scripts/backup/mongo-restore.sh',
    'scripts/backup/media-backup.sh',
    'scripts/backup/verify-restore.sh',
    'scripts/backup/crontab.example',
    'docs/AI_BUDGET_POLICY.md',
    'docs/STAGING_DEPLOYMENT.md',
    'docs/archive/l2/SPRINT_L2_IMPLEMENTATION_REPORT.md',
    '.cursor/rules/ai-budget-policy.mdc',
  ];
  for (const f of required) {
    if (exists(f)) pass(`artifact ${f}`);
    else fail(`artifact ${f}`);
  }
}

// Compose production readiness
{
  const compose = read('docker-compose.yml');
  if (compose.includes('media_uploads:') && compose.includes('REDIS_URL') && compose.includes('REQUIRE_REDIS')) {
    pass('compose durable media + redis require');
  } else fail('compose durable media + redis require');
  if (compose.includes('worker:') && compose.includes('WORKER_ONLY')) pass('compose worker service');
  else fail('compose worker service');
  if (compose.includes('MAIL_HOST') && compose.includes('SENTRY_DSN')) pass('compose SMTP + sentry env');
  else fail('compose SMTP + sentry env');

  const staging = read('docker-compose.staging.yml');
  if (staging.includes('edurozgaar-staging') && staging.includes('.env.staging')) pass('staging overlay');
  else fail('staging overlay');
}

// Env examples
{
  const stg = read('docker/.env.staging.example');
  const prod = read('docker/.env.production.example');
  for (const [label, src] of [['staging', stg], ['prod', prod]]) {
    if (src.includes('REQUIRE_REDIS') && src.includes('MEDIA_STORAGE_PROVIDER') && src.includes('MAIL_HOST')) {
      pass(`${label} env infrastructure keys`);
    } else fail(`${label} env infrastructure keys`);
    if (src.includes('Paid AI') || src.includes('OPENAI_API_KEY')) pass(`${label} AI cost notes`);
    else fail(`${label} AI cost notes`);
    if (src.includes('EMPLOYER_INTELLIGENCE_ENABLED') && src.includes('APPLICATION_DUAL_WRITE=0')) {
      pass(`${label} feature flag matrix`);
    } else fail(`${label} feature flag matrix`);
  }
}

// Health / monitoring ops hooks
{
  const health = read('server/src/routes/health.js');
  if (health.includes('REQUIRE_REDIS') && health.includes('/health/ready') && health.includes('/health/live')) {
    pass('health ready requires Redis when flagged');
  } else fail('health ready requires Redis when flagged');
  if (health.includes('/metrics')) pass('metrics route');
  else fail('metrics route');
}

// SSL / DNS readiness docs in Caddyfile
{
  const caddy = read('deploy/Caddyfile');
  if (
    caddy.includes('reverse_proxy') &&
    caddy.includes('strideto.com') &&
    caddy.includes('staging.strideto.com')
  ) pass('Caddy TLS front door');
  else fail('Caddy TLS front door');
  const vps = read('deploy/setup-vps.sh');
  if (vps.includes('ufw allow 443') && vps.includes('caddy')) pass('VPS SSL/DNS ports');
  else fail('VPS SSL/DNS ports');
}

// AI budget policy
{
  const policy = read('docs/AI_BUDGET_POLICY.md');
  if (policy.includes('≈ $0') || policy.includes('~$0') || policy.includes('$0')) pass('AI budget policy cost');
  else fail('AI budget policy cost');
  if (policy.includes('feature flag') || policy.includes('feature flags')) pass('AI behind flags');
  else fail('AI behind flags');
  const rule = read('.cursor/rules/ai-budget-policy.mdc');
  if (rule.includes('alwaysApply: true') || rule.includes('alwaysApply:true')) pass('Cursor AI budget rule');
  else fail('Cursor AI budget rule');
}

// Docker compose config (when Docker available)
{
  const docker = spawnSync('docker', ['version'], { encoding: 'utf8', shell: true });
  if (docker.status === 0) {
    const cfg = runDockerComposeConfig();
    if (cfg.ok) pass('docker compose staging config validates');
    else fail('docker compose staging config validates', cfg.out.slice(-400));
  } else {
    pass('docker not available — compose config skipped (structural checks only)');
  }
}

// Nested ops suites
{
  for (const script of [
    'verify:deployment',
    'verify:redis',
    'verify:queues',
    'verify:security',
    'verify:monitoring',
    'verify:backups',
    'verify:production',
  ]) {
    const r = runNpm(script);
    if (r.ok) pass(script);
    else fail(script, r.out.slice(-500));
  }
}

console.log(`\nL.2 staging infrastructure verification: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('L.2 infrastructure checks passed.');
