/**
 * Unit regression for the harness browser-close EBUSY recovery logic.
 *
 * Covers:
 *  - Normal browser.close → BROWSER_CLOSED lifecycle event, no throw
 *  - Simulated EBUSY after browser process has already exited → BROWSER_CLOSE_EBUSY_DEFERRED,
 *    no rethrow (nonfatal cleanup warning)
 *  - Non-EBUSY close error → BROWSER_CLOSE_TIMEOUT lifecycle event + rethrow
 */

import assert from 'node:assert/strict';

// Replicate the handler logic extracted from the harness finally block.
// The logic is small enough to inline here so changes to the harness are caught
// by the source-inspection assertion in pre-freeze-hybrid-navigation.test.mjs.
async function runBrowserCloseHandler({ closeError, processExited }) {
  const mockProc = { exitCode: processExited ? 0 : null, killed: false };
  const mockBrowser = {
    connected: !processExited,
    process: () => mockProc,
    close: async () => {
      if (closeError) throw closeError;
    },
  };

  const lifecycle = [];
  const recordLifecycle = (entry) => lifecycle.push(entry);
  let threw = null;

  try {
    await mockBrowser.close();
    recordLifecycle({ stage: 'BROWSER_CLOSED' });
  } catch (err) {
    if (err?.code === 'EBUSY') {
      // Bounded wait (shortened from 500 ms for test speed)
      await new Promise((resolve) => setTimeout(resolve, 0));
      const proc = mockBrowser.process?.();
      const gone = !proc || proc.exitCode !== null || proc.killed || !mockBrowser.connected;
      if (gone) {
        recordLifecycle({ stage: 'BROWSER_CLOSE_EBUSY_DEFERRED', error: err.message });
      } else {
        recordLifecycle({ stage: 'BROWSER_CLOSE_TIMEOUT', error: err.message });
        threw = err;
      }
    } else {
      recordLifecycle({ stage: 'BROWSER_CLOSE_TIMEOUT', error: err.message });
      threw = err;
    }
  }

  return { lifecycle, threw };
}

// ── 1. Normal browser close ───────────────────────────────────────────────────
{
  const { lifecycle, threw } = await runBrowserCloseHandler({ closeError: null, processExited: false });
  assert.equal(threw, null, 'normal close must not throw');
  assert.equal(lifecycle.length, 1, 'normal close must record exactly one lifecycle event');
  assert.equal(lifecycle[0].stage, 'BROWSER_CLOSED', 'normal close must record BROWSER_CLOSED');
  console.log(JSON.stringify({ test: 'browser-close-normal', result: 'PASS' }));
}

// ── 2. EBUSY after browser process has already exited ─────────────────────────
{
  const ebusyError = new Error('EPATHTOTEMPORARYDIR: resource busy or locked, unlink first_party_sets.db');
  ebusyError.code = 'EBUSY';
  const { lifecycle, threw } = await runBrowserCloseHandler({ closeError: ebusyError, processExited: true });
  assert.equal(threw, null, 'EBUSY after process exit must not rethrow');
  assert.equal(lifecycle.length, 1, 'must record exactly one lifecycle event');
  assert.equal(lifecycle[0].stage, 'BROWSER_CLOSE_EBUSY_DEFERRED', 'must record BROWSER_CLOSE_EBUSY_DEFERRED');
  assert.ok(lifecycle[0].error, 'EBUSY_DEFERRED entry must carry the error message');
  console.log(JSON.stringify({ test: 'browser-close-ebusy-process-exited', result: 'PASS' }));
}

// ── 3. Non-EBUSY error still surfaces ────────────────────────────────────────
{
  const realError = new Error('WebSocket is not open: readyState 3 (CLOSED)');
  realError.code = 'ERR_WS_CLOSED';
  const { lifecycle, threw } = await runBrowserCloseHandler({ closeError: realError, processExited: false });
  assert.ok(threw, 'non-EBUSY error must rethrow');
  assert.equal(threw, realError, 'rethrown error must be the original error object');
  assert.equal(lifecycle[0].stage, 'BROWSER_CLOSE_TIMEOUT', 'non-EBUSY error must record BROWSER_CLOSE_TIMEOUT');
  console.log(JSON.stringify({ test: 'browser-close-non-ebusy-propagates', result: 'PASS' }));
}

console.log(JSON.stringify({ suite: 'pre-freeze-browser-close', result: 'ALL PASS' }));
