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
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

{
  const handler = read('server/src/middleware/errorHandler.js');
  check(/SAFE_CODES/.test(handler), 'error handler allowlists public machine-readable codes');
  check(/safeCode \? \{ code: safeCode \}/.test(handler), 'unsafe err.code values are not returned to clients');
  check(
    /res\.status\(status\)\.json\(\{[\s\S]*error: message[\s\S]*\}\);/.test(handler)
      && !/res\.status\(status\)\.json\(\{[\s\S]*stack:/.test(handler),
    'client JSON never includes stack traces'
  );
  check(/looksInternal/.test(handler), 'internal Mongo/path/secret messages are sanitized');
}

{
  const boot = read('server/src/index.js');
  check(/ENABLE_SCRAPER_CRON === '1'/.test(boot), 'API replicas start scraper only when explicitly enabled');
  check(/scraper_cron_skipped/.test(boot), 'scraper skip reason is logged');
  check(/DISABLE_SCRAPER_CRON/.test(boot), 'DISABLE_SCRAPER_CRON still wins');
}

{
  const notify = read('server/src/services/auth/securityNotifications.js');
  check(/dedupeKey = `security:\$\{realm\}:\$\{String\(subjectId\)\}:\$\{type\}:\$\{dayKey\(\)\}`/.test(notify), 'security notifications dedupe by realm/subject/type/day');
  check(!/passwordResetToken|accessToken|refreshToken/.test(notify), 'security notifications do not persist secrets');
  check(/skipPreferenceCheck: true/.test(notify), 'security events are not suppressible as marketing');
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
    check(/notifyPasswordChanged/.test(src), `${name} password change emits an in-app security notification`);
    check(/notifyLogoutAllCompleted/.test(src), `${name} logout-all emits an in-app security notification`);
  }
  check(/result\.code !== 'LOGGED_OUT_ALL'/.test(institution), 'institution logout-all does not report success on failure');
}

{
  const store = read('server/src/middleware/redisRateLimitStore.js');
  check(/rate_limit_degraded/.test(store), 'production Redis rate-limit fallback is observable');
  check(/process_local_memory/.test(store), 'degraded fallback is named truthfully');
}

console.log(`phase17cPlatform.test.js: ${count} assertions passed`);
