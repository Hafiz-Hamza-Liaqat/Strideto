/**
 * Phase 17D-8B2A — ClamAV adapter fail-closed mapping (no daemon required).
 * Run: node src/__tests__/phase17d8b2aClamavAdapter.test.js
 */
import assert from 'node:assert/strict';
import { clamdInstream, mapClamdResponse } from '../services/hsi/clamavClamdAdapter.js';

assert.equal(mapClamdResponse('stream: OK').verdict, 'clean');
assert.equal(mapClamdResponse('stream: Win.Test.EICAR_HDB-1 FOUND').verdict, 'rejected');
assert.equal(mapClamdResponse('INSTREAM size limit exceeded ERROR').verdict, 'failed');
assert.equal(mapClamdResponse('').verdict, 'failed');
assert.equal(mapClamdResponse('HTTP 200').verdict, 'failed');

const down = await clamdInstream(Buffer.from('hello'), {
  host: '127.0.0.1',
  port: 9,
  timeoutMs: 400,
});
assert.equal(down.verdict, 'failed');
assert.equal(down.code, 'connection_failure');

const empty = await clamdInstream(Buffer.alloc(0), { host: '127.0.0.1', port: 3310, timeoutMs: 200 });
assert.equal(empty.verdict, 'failed');
assert.equal(empty.code, 'size_protocol_failure');

console.log('phase17d8b2aClamavAdapter.test.js: assertions passed');
