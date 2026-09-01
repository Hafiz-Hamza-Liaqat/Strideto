/** Mobile Test Hub overflow contract. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/Tests/TestHub.jsx', import.meta.url), 'utf8');

test('Test Hub constrains cards and allows content to wrap on narrow screens', () => {
  assert.match(source, /w-full min-w-0 max-w-5xl mx-auto px-4 py-8/);
  assert.equal((source.match(/grid w-full min-w-0 sm:grid-cols-2 gap-4/g) || []).length, 2);
  assert.match(source, /block w-full min-w-0 max-w-full/);
  assert.match(source, /flex min-w-0 items-start justify-between gap-3/);
  assert.match(source, /shrink min-w-0 max-w-full[^\n]*text-center[^\n]*whitespace-normal[^\n]*break-words-safe/);
  assert.match(source, /mt-3 flex min-w-0 flex-wrap gap-2/);
  assert.doesNotMatch(source, /TestCard[\s\S]*overflow-x-auto/);
  assert.doesNotMatch(source, /TestCard[\s\S]*min-w-\[/);
  assert.doesNotMatch(source, /category[^\n]*flex-shrink-0/);
});
