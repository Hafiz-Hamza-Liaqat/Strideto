import assert from 'node:assert/strict';
import { buildReadHeaders, createProductionReadClient, extractAccessToken } from './productionReadAuth.mjs';

assert.equal(extractAccessToken({ accessToken: 'secret' }), 'secret');
assert.equal(extractAccessToken({ data: { accessToken: 'nested' } }), '', 'runner contract is top-level accessToken');

const headers = buildReadHeaders({ token: 'secret', cookie: 'sid=memory-only' });
assert.equal(headers.authorization, 'Bearer secret');
assert.equal(headers.cookie, 'sid=memory-only');
assert.equal(headers.origin, 'https://www.strideto.com');
assert.equal(headers.referer, 'https://www.strideto.com/');
assert.equal(JSON.stringify(headers).includes('password'), false);

const tokenless = buildReadHeaders();
assert.equal(tokenless.authorization, undefined);
assert.equal(tokenless.cookie, undefined);

console.log('production read auth contract: PASS');

const originalFetch = globalThis.fetch;
const originalToken = process.env.STRIDETO_ADMIN_TOKEN;
process.env.STRIDETO_ADMIN_TOKEN = 'test-only-token';
globalThis.fetch = async (_url, options) => {
  assert.equal(options.method, undefined, 'diagnostic requests are GET');
  assert.equal(options.headers.authorization, 'Bearer test-only-token');
  assert.equal(options.headers.origin, 'https://www.strideto.com');
  assert.equal(options.headers.referer, 'https://www.strideto.com/');
  return { ok: false, status: 401 };
};
try {
  const client = await createProductionReadClient({ allowedPrefixes: ['/admin/jobs'] });
  await assert.rejects(
    () => client.get('/admin/jobs?page=1&limit=100'),
    /HTTP 401; auth diagnostics:.*authorizationAttached.*true/,
  );
} finally {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.STRIDETO_ADMIN_TOKEN;
  else process.env.STRIDETO_ADMIN_TOKEN = originalToken;
}

console.log('production read auth 401 diagnostic: PASS');
