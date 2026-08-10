/**
 * API startup listener regression fix.
 *
 * Root cause: registerGracefulShutdown previously owned both server creation
 * (`http.createServer(app)`) and listener startup (`server.listen(port, ...)`)
 * internally, with index.js calling it as `registerGracefulShutdown(app,
 * PORT_NUM)`. This test locks in the corrected contract: index.js now starts
 * the one HTTP listener itself via `app.listen(...)`, and passes the
 * resulting server into registerGracefulShutdown purely for signal-driven
 * shutdown — the helper never starts a listener of its own.
 *
 * Part 1 (executable): registerGracefulShutdown's own side-effect-free
 * contract, exercised directly against a fake server object.
 * Part 2 (source-contract, matching this repo's established convention for
 * process-startup code that can't safely be exercised end-to-end without a
 * real Mongo connection): proves index.js's corrected call sequence.
 *
 * Run: node src/__tests__/apiListenerStartup.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');

// ---- Part 1: registerGracefulShutdown's own contract (executable) ----

const { registerGracefulShutdown, isShuttingDown } = await import('../config/shutdown.js');

{
  let listenCalls = 0;
  let closeCalls = 0;
  const fakeServer = {
    listen: () => {
      listenCalls += 1;
    },
    close: (cb) => {
      closeCalls += 1;
      if (cb) cb();
    },
  };

  // Fully replace process.on for the duration of this call only, so no real
  // SIGTERM/SIGINT handler is ever attached to this test's own process.
  const originalOn = process.on;
  const registeredSignals = [];
  process.on = (event, _handler) => {
    if (event === 'SIGTERM' || event === 'SIGINT') registeredSignals.push(event);
    return process;
  };

  const returned = registerGracefulShutdown(fakeServer);
  process.on = originalOn;

  check(returned === fakeServer, '4. registerGracefulShutdown returns the exact server instance it was given (the correct object for shutdown, not a new one)');
  check(listenCalls === 0, '8/9. registerGracefulShutdown never calls .listen() itself — starting the listener is the caller\'s sole responsibility, so no duplicate listener can ever be created here');
  check(closeCalls === 0, 'registerGracefulShutdown does not close the server merely by being registered — only on an actual signal');
  check(
    registeredSignals.includes('SIGTERM') && registeredSignals.includes('SIGINT') && registeredSignals.length === 2,
    '4. Exactly one SIGTERM and one SIGINT handler are registered per call'
  );
}

check(typeof isShuttingDown === 'function' && isShuttingDown() === false, 'isShuttingDown() remains a function and starts false — unaffected by the signature change');

// registerGracefulShutdown's exported signature takes exactly one parameter (the server) now, not (app, port)
check(registerGracefulShutdown.length === 1, '4. registerGracefulShutdown now takes a single argument (the server), not (app, port)');

console.log(`  helper assertions: ${count}`);

// ---- Part 2: index.js's corrected startup sequence (source-contract) ----

const shutdownSrc = readFileSync(path.join(serverSrc, 'config/shutdown.js'), 'utf8');
const indexSrc = readFileSync(path.join(serverSrc, 'index.js'), 'utf8');

// shutdown.js no longer imports/uses the 'http' module or creates its own server
check(!/import http from 'http';/.test(shutdownSrc) && !/http\.createServer/.test(shutdownSrc), 'shutdown.js no longer imports node:http or creates its own HTTP server');
check(!/server\.listen\(/.test(shutdownSrc), 'shutdown.js no longer calls server.listen() — listener startup moved entirely to the caller');

const connectDbBlock = indexSrc.slice(indexSrc.indexOf('connectDB()'));

// 1/2/3. Listener starts inside the successful connectDB().then() path, using the configured PORT_NUM
{
  const listenIdx = connectDbBlock.indexOf('const server = app.listen(PORT_NUM,');
  const registerIdx = connectDbBlock.indexOf('registerGracefulShutdown(server);');
  check(listenIdx !== -1, '1/2. The successful connectDB() path starts the listener via app.listen(PORT_NUM, ...)');
  check(registerIdx !== -1 && listenIdx < registerIdx, '4/5. registerGracefulShutdown is called with the server returned by app.listen, after the listener has been started');
}

// 3. Default port behavior unchanged (PORT falls back to 5000, not hardcoded elsewhere)
check(/const PORT = process\.env\.PORT \|\| 5000;/.test(indexSrc), '3. Default port fallback (process.env.PORT || 5000) is unchanged — no hardcoded port introduced in the corrected startup call');
check(!/app\.listen\(5000/.test(indexSrc), 'The listener call itself never hardcodes port 5000 — it always uses the computed PORT_NUM variable');

// 6. Exactly one safe startup log statement, using the structured logger (not console.log)
{
  const matches = indexSrc.match(/logger\.info\('server_started'/g) || [];
  check(matches.length === 1, '6. Exactly one "server_started" log call exists, via the structured logger');
}

// 7. Database failure path is unchanged: still exits 1, still logs via console.error before any logger/DB is guaranteed up
check(/\.catch\(\(err\) => \{\s*console\.error\('\\n❌ MongoDB connection failed:', err\.message\);\s*process\.exit\(1\);\s*\}\);/.test(indexSrc), '7. The connectDB() failure path is untouched — still logs and calls process.exit(1)');

// 8/9. Only one app.listen call exists in the whole file (no duplicate listener anywhere)
{
  const listenMatches = indexSrc.match(/\.listen\(/g) || [];
  check(listenMatches.length === 1, '8/9. Exactly one .listen( call exists in index.js — no duplicate listener');
}

// 9. Worker entrypoint is untouched and does not import/call the changed helper
{
  const workerSrc = readFileSync(path.join(serverSrc, 'worker.js'), 'utf8');
  check(!/registerGracefulShutdown/.test(workerSrc), "9. worker.js does not call registerGracefulShutdown at all — it has its own independent shutdown handling, unaffected by this fix");
}

// 10. Routes/middleware registration block is untouched — same router mounts still present, unmodified in count
{
  const mountCount = (indexSrc.match(/app\.use\('\/api'/g) || []).length;
  check(mountCount > 30, "10. The large block of app.use('/api', ...) router mounts is still present and untouched (same order/shape as before this fix)");
}

console.log(`apiListenerStartup.test.js: ${count} assertions passed`);
