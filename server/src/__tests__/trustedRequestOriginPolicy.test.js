/**
 * SEC-3C — dormant trusted-request-origin policy tests.
 * Run: node src/__tests__/trustedRequestOriginPolicy.test.js
 */
import assert from 'node:assert/strict';
import { createTrustedRequestOriginPolicy } from '../services/auth/TrustedRequestOriginPolicy.js';

let assertions = 0;
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}
function check(value, message) {
  assert.ok(value, message);
  assertions += 1;
}
function deepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}
function throwsType(fn) {
  assert.throws(fn, TypeError);
  assertions += 1;
}

const prodPolicy = createTrustedRequestOriginPolicy({
  mode: 'production',
  trustedOrigins: ['https://strideto.com', 'https://www.strideto.com'],
});
const devPolicy = createTrustedRequestOriginPolicy({
  mode: 'development',
  trustedOrigins: ['http://localhost:5173'],
});

// --- Configuration validation ---
throwsType(
  () =>
    createTrustedRequestOriginPolicy({
      mode: 'production',
      trustedOrigins: [],
    }),
  'empty trustedOrigins is rejected'
);
throwsType(
  () =>
    createTrustedRequestOriginPolicy({
      mode: 'production',
      trustedOrigins: ['*'],
    }),
  'a wildcard origin is rejected'
);
throwsType(
  () =>
    createTrustedRequestOriginPolicy({
      mode: 'production',
      trustedOrigins: ['null'],
    }),
  'a null-string origin is rejected'
);
throwsType(
  () =>
    createTrustedRequestOriginPolicy({
      mode: 'production',
      trustedOrigins: ['https://strideto.com/path'],
    }),
  'a configured origin with a path is rejected'
);
throwsType(
  () =>
    createTrustedRequestOriginPolicy({
      mode: 'production',
      trustedOrigins: ['https://strideto.com/?x=1'],
    }),
  'a configured origin with a query is rejected'
);
throwsType(
  () =>
    createTrustedRequestOriginPolicy({
      mode: 'production',
      trustedOrigins: ['https://strideto.com/#frag'],
    }),
  'a configured origin with a fragment is rejected'
);
throwsType(
  () =>
    createTrustedRequestOriginPolicy({
      mode: 'production',
      trustedOrigins: ['https://user:pass@strideto.com'],
    }),
  'a configured origin with credentials is rejected'
);
throwsType(
  () =>
    createTrustedRequestOriginPolicy({
      mode: 'production',
      trustedOrigins: ['not a url'],
    }),
  'a malformed configured origin is rejected'
);
throwsType(
  () =>
    createTrustedRequestOriginPolicy({
      mode: 'production',
      trustedOrigins: ['http://strideto.com'],
    }),
  'a non-HTTPS configured origin is rejected in production'
);
throwsType(
  () =>
    createTrustedRequestOriginPolicy({
      mode: 'staging',
      trustedOrigins: ['https://x.com'],
    }),
  'an unknown/ambiguous mode is rejected'
);
// Development may explicitly allow a non-HTTPS localhost entry.
check(
  createTrustedRequestOriginPolicy({
    mode: 'development',
    trustedOrigins: ['http://localhost:5173'],
  }).trustedOrigins.includes('http://localhost:5173'),
  'development explicitly allows a configured localhost origin'
);

// --- Exact-origin matching ---
equal(
  prodPolicy.evaluateRequestOrigin({ origin: 'https://strideto.com' }).code,
  'ORIGIN_TRUSTED',
  'strideto.com is accepted when configured'
);
equal(
  prodPolicy.evaluateRequestOrigin({ origin: 'https://www.strideto.com' }).code,
  'ORIGIN_TRUSTED',
  'www.strideto.com is accepted when configured'
);
equal(
  devPolicy.evaluateRequestOrigin({ origin: 'http://localhost:5173' }).code,
  'ORIGIN_TRUSTED',
  'localhost:5173 is accepted only in development configuration'
);
equal(
  prodPolicy.evaluateRequestOrigin({ origin: 'http://localhost:5173' }).code,
  'ORIGIN_UNTRUSTED',
  'localhost:5173 is rejected in production configuration'
);
equal(
  devPolicy.evaluateRequestOrigin({ origin: 'http://localhost:5174' }).code,
  'ORIGIN_UNTRUSTED',
  'an unlisted localhost port is rejected'
);

// --- Null / missing Origin ---
equal(
  prodPolicy.evaluateRequestOrigin({ origin: 'null' }).code,
  'ORIGIN_NULL',
  'Origin: null is rejected'
);
equal(
  prodPolicy.evaluateRequestOrigin({}).code,
  'ORIGIN_MISSING',
  'missing Origin and Referer is rejected'
);

// --- Referer fallback, only when Origin is absent ---
{
  const result = prodPolicy.evaluateRequestOrigin({
    referer: 'https://strideto.com/dashboard',
  });
  equal(
    result.code,
    'REFERER_TRUSTED',
    'a trusted Referer is accepted only when Origin is absent'
  );
}
{
  const result = prodPolicy.evaluateRequestOrigin({
    referer: 'not a valid url',
  });
  equal(result.code, 'REFERER_MALFORMED', 'a malformed Referer is rejected');
}
{
  const result = prodPolicy.evaluateRequestOrigin({
    origin: 'https://evil.example',
    referer: 'https://strideto.com/dashboard',
  });
  equal(
    result.code,
    'ORIGIN_UNTRUSTED',
    'an untrusted Origin is never rescued by a trusted Referer'
  );
}
{
  // Origin present but malformed still does not fall back to Referer.
  const result = prodPolicy.evaluateRequestOrigin({
    origin: 'not a url',
    referer: 'https://strideto.com/dashboard',
  });
  equal(
    result.code,
    'ORIGIN_MALFORMED',
    'a malformed Origin does not fall back to Referer even though Referer is trusted'
  );
}
{
  const result = prodPolicy.evaluateRequestOrigin({
    origin: 'null',
    referer: 'https://strideto.com/dashboard',
  });
  equal(
    result.code,
    'ORIGIN_NULL',
    'a null Origin does not fall back to Referer'
  );
}

// --- Evil-suffix and open-redirect-style protection ---
equal(
  prodPolicy.evaluateRequestOrigin({
    origin: 'https://strideto.com.evil.example',
  }).code,
  'ORIGIN_UNTRUSTED',
  'https://strideto.com.evil.example is rejected (no suffix trust)'
);
equal(
  prodPolicy.evaluateRequestOrigin({
    referer: 'https://evil.example/?next=https://strideto.com',
  }).code,
  'REFERER_UNTRUSTED',
  'a Referer whose origin is evil.example is rejected regardless of its query string'
);

// --- Multiple / comma-separated Origin values ---
equal(
  prodPolicy.evaluateRequestOrigin({
    origin: 'https://strideto.com, https://evil.example',
  }).code,
  'ORIGIN_MALFORMED',
  'a comma-separated Origin value is rejected as malformed'
);

// --- SEC-3C.1: no forced-preflight marker evaluator exists. §19 point 4
// introduces the header only as a hedged illustrative example ("e.g.
// X-Strideto-Client: web"), not an adopted, exact contract — no marker
// evaluator is implemented, and none is asserted here as a stand-in
// future name. Exact marker selection, if any, is deferred to SEC-3E. ---
{
  const policy = prodPolicy;
  check(
    typeof policy.evaluateForcedPreflightMarker === 'undefined',
    'no forced-preflight marker evaluator is exposed on the policy'
  );
  deepEqual(
    Object.keys(policy).sort(),
    ['evaluateRequestOrigin', 'mode', 'trustedOrigins'].sort(),
    'the policy surface exposes only Origin/Referer evaluation, mode, and the configured trusted origins — no marker capability of any kind'
  );
}

// --- No raw Origin/Referer values in safe results ---
{
  const result = prodPolicy.evaluateRequestOrigin({
    origin: 'https://evil.example',
  });
  const serialized = JSON.stringify(result);
  check(
    !serialized.includes('evil.example'),
    'no raw Origin value appears in the safe result'
  );
  equal(Object.keys(result).length, 1, 'the safe result carries only a code');
}

console.log(
  `trustedRequestOriginPolicy.test.js: ${assertions} assertions passed`
);
