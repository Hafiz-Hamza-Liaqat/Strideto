import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../pages/Jobs/JobDetail.jsx', import.meta.url), 'utf8');

test('Job Details stacks identity and details below desktop breakpoint', () => {
  assert.match(source, /className="flex flex-col lg:flex-row items-start gap-3"/);
  assert.match(source, /className="mt-4 lg:hidden space-y-4 border-t .* pt-4 w-full"/);
  assert.match(source, /className="min-w-0 flex-1"/);
});

test('Job Details mobile actions retain full-width responsive behavior', () => {
  assert.match(source, /w-full sm:w-auto/);
  assert.match(source, /<button type="button" onClick=\{handleShare\}/);
  assert.match(source, /<SaveButton type="job"/);
});

test('Job Details preserves desktop two-column presentation and avoids fixed layout hacks', () => {
  assert.match(source, /lg:grid lg:grid-cols-\[minmax\(0,1fr\)_minmax\(16rem,22rem\)\]/);
  assert.doesNotMatch(source, /position:\s*absolute|position:\s*fixed/);
});
