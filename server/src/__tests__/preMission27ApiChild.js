import { monitorEventLoopDelay } from 'node:perf_hooks';

const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();

// Local-only runtime fixture: imports the real API entrypoint and converts an
// IPC test message into the same graceful signal used by orchestrators.
process.on('message', (message) => {
  if (message === 'targeted-graceful-shutdown') process.emit('SIGTERM');
  if (message?.type === 'targeted-memory-snapshot') {
    const memory = process.memoryUsage();
    process.send?.({ type: 'targeted-memory-snapshot', id: message.id, memory, eventLoop: {
      minMs: Number(loopDelay.min) / 1e6,
      maxMs: Number(loopDelay.max) / 1e6,
      meanMs: Number(loopDelay.mean) / 1e6,
      p95Ms: Number(loopDelay.percentile(95)) / 1e6,
      p99Ms: Number(loopDelay.percentile(99)) / 1e6,
    } });
  }
});

await import('../index.js');
