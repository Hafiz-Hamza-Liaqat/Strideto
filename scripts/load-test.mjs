#!/usr/bin/env node
/**
 * Lightweight load test (C.7.0.9) — no external deps.
 * Usage: node scripts/load-test.mjs [baseUrl] [concurrency] [requests]
 * LOAD_TEST_PATHS=/api/health/live,/api/jobs  NODE_TLS_REJECT_UNAUTHORIZED=0
 */
const baseUrl = process.argv[2] || process.env.LOAD_TEST_URL || 'http://localhost:5000';
const concurrency = Number(process.argv[3]) || 10;
const total = Number(process.argv[4]) || 100;
const timeoutMs = Number(process.env.LOAD_TEST_TIMEOUT_MS) || 15_000;
const paths = (process.env.LOAD_TEST_PATHS || '/api/health/live,/api/health/ready,/api/jobs')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function fetchOne(path) {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, { signal: ac.signal });
    return { ok: res.ok, ms: Date.now() - t0, status: res.status, timeout: false };
  } catch (err) {
    const timedOut = err?.name === 'AbortError' || /abort/i.test(err?.message || '');
    return {
      ok: false,
      ms: Date.now() - t0,
      error: timedOut ? 'timeout' : err.message,
      timeout: timedOut,
      status: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < total) {
      const n = i++;
      const path = paths[n % paths.length];
      results.push(await fetchOne(path));
    }
  }
  const t0 = Date.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsed = Date.now() - t0;
  const ok = results.filter((r) => r.ok).length;
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const unexpected5xx = results.filter((r) => r.status >= 500).length;
  const timeouts = results.filter((r) => r.timeout).length;
  const summary = {
    baseUrl,
    concurrency,
    total,
    paths,
    elapsedMs: elapsed,
    successes: ok,
    failures: total - ok,
    successRate: `${((ok / total) * 100).toFixed(1)}%`,
    rps: (total / (elapsed / 1000)).toFixed(1),
    p50Ms: percentile(times, 50),
    p95Ms: percentile(times, 95),
    p99Ms: percentile(times, 99),
    maxMs: times[times.length - 1] || 0,
    timeouts,
    unexpected5xx,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (ok < total * 0.95 || unexpected5xx > 0) process.exit(1);
}

run();
