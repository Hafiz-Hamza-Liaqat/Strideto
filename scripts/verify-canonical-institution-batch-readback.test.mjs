import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('final canonical batch verifier is read-only and canonical-endpoint-only', async () => {
  const source = await fs.readFile('scripts/verify-canonical-institution-batch-readback.mjs', 'utf8');
  assert.match(source, /createProductionReadClient/);
  assert.match(source, /allowedPrefixes: \[INSTITUTION_PATH\]/);
  assert.match(source, /findCanonicalMatches/);
  assert.match(source, /compareReadback/);
  assert.doesNotMatch(source, /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(source, /fetch\([^\n]+method/i);
  assert.match(source, /productionWrites: 0/);
  assert.match(source, /updates: 0/);
  assert.match(source, /deletes: 0/);
  assert.match(source, /legacyEndpointRequests/);
});
