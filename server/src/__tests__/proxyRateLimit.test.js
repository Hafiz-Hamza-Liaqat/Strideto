/**
 * Focused proxy + rate-limit identity tests (no DB).
 * Run: node src/__tests__/proxyRateLimit.test.js
 */
import assert from 'assert';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { configureTrustProxy } from '../config/proxy.js';

function withEnv(key, value, fn) {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

// Production: trust exactly one hop (Render)
withEnv('NODE_ENV', 'production', () => {
  const app = express();
  configureTrustProxy(app);
  assert.strictEqual(app.get('trust proxy'), 1, 'production must trust one proxy hop');
});

// Development / test: leave default so local behavior is unchanged
for (const env of ['development', 'test', undefined]) {
  withEnv('NODE_ENV', env, () => {
    const app = express();
    configureTrustProxy(app);
    const trust = app.get('trust proxy');
    assert.ok(
      trust === false || trust === undefined || trust === 0,
      `non-production must not enable trust proxy, got ${trust} for NODE_ENV=${env}`
    );
  });
}

/**
 * Behind one forwarded proxy, req.ip and the rate-limit key use X-Forwarded-For
 * when trust proxy = 1 — the Render topology that previously raised
 * ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
 */
await new Promise((resolve, reject) => {
  const app = express();
  app.set('trust proxy', 1);

  const seenKeys = [];
  const limiter = rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const key = req.ip;
      seenKeys.push(key);
      return key;
    },
    validate: { xForwardedForHeader: true },
  });

  app.get('/ping', limiter, (req, res) => {
    res.json({ ip: req.ip });
  });

  const server = app.listen(0, '127.0.0.1', async () => {
    try {
      const { port } = server.address();
      const res = await fetch(`http://127.0.0.1:${port}/ping`, {
        headers: { 'X-Forwarded-For': '203.0.113.50' },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(
        body.ip === '203.0.113.50' || String(body.ip).startsWith('203.0.113.50'),
        `expected client IP from X-Forwarded-For, got ${body.ip}`
      );
      assert.ok(
        seenKeys.some((k) => k === '203.0.113.50' || String(k).startsWith('203.0.113.50')),
        `rate-limit key should use forwarded client IP, got ${JSON.stringify(seenKeys)}`
      );
      server.close(() => resolve());
    } catch (err) {
      server.close(() => reject(err));
    }
  });
});

console.log('proxyRateLimit tests passed.');
