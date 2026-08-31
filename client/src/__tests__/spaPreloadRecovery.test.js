import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { shouldAttemptRecovery } from '../runtime/preloadRecovery.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const recovery = readFileSync(path.join(root, 'client', 'src', 'runtime', 'preloadRecovery.js'), 'utf8');
const main = readFileSync(path.join(root, 'client', 'src', 'main.jsx'), 'utf8');
const vite = readFileSync(path.join(root, 'client', 'vite.config.js'), 'utf8');
const vercel = JSON.parse(readFileSync(path.join(root, 'client', 'vercel.json'), 'utf8'));
const routeError = readFileSync(path.join(root, 'client', 'src', 'components', 'common', 'RouteErrorBoundary.jsx'), 'utf8');

assert.deepEqual(
  shouldAttemptRecovery({ production: true, previousState: null, cycleId: 'deployment:a' }),
  { shouldReload: true, alreadyConsumed: false }
);
assert.deepEqual(
  shouldAttemptRecovery({ production: true, previousState: { cycleId: 'deployment:a', attempted: true }, cycleId: 'deployment:a' }),
  { shouldReload: false, alreadyConsumed: true }
);
assert.deepEqual(
  shouldAttemptRecovery({ production: true, previousState: { cycleId: 'deployment:a', attempted: true }, cycleId: 'deployment:b' }),
  { shouldReload: true, alreadyConsumed: false }
);
assert.deepEqual(
  shouldAttemptRecovery({ production: false, previousState: null, cycleId: 'entry:dev' }),
  { shouldReload: false, alreadyConsumed: false }
);
assert.match(recovery, /vite:preloadError/);
assert.match(recovery, /const payload = event\.payload/);
assert.match(recovery, /sessionStorage/);
assert.match(recovery, /if \(!shouldReload\) return/);
assert.match(recovery, /window\.location\.reload\(\)/);
assert.match(recovery, /!import\.meta\.env\.PROD/);
assert.match(recovery, /event\.preventDefault\(\)/);
assert.match(main, /installPreloadErrorRecovery\(\)/);
assert.equal(vite.includes('VERCEL_URL'), false);
assert.equal(vite.includes('base: isVercelBuild'), false);
assert.equal(vite.includes("base: '/'"), true);
const assetHeaders = vercel.headers.find((rule) => rule.source === '/assets/(.*)').headers;
assert.equal(assetHeaders.find((header) => header.key === 'Access-Control-Allow-Origin'), undefined);
assert.equal(assetHeaders.find((header) => header.key === 'Cache-Control')?.value, 'public, max-age=31536000, immutable');
assert.equal(vercel.headers.find((rule) => rule.source === '/index.html').headers[0].value, 'no-cache');
assert.equal(vercel.headers.find((rule) => rule.source.includes('assets/|.*\\.')).headers[0].value, 'no-cache');
assert.match(routeError, /preloadRecovery/);
assert.match(recovery, /attempted/);
assert.match(recovery, /alreadyConsumed/);
assert.match(recovery, /redacted-email/);
assert.match(routeError, /redacted-email/);

console.log('spaPreloadRecovery.test.js: 22 assertions passed');
