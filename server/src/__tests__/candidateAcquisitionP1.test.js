import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { buildJobsSearchMeasurement, hasJobSearchIntent } from '../controllers/jobsController.js';

const read = (file) => fs.readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');

test('CA-03 Jobs search intent recognizes search and supported filters only', () => {
  assert.equal(hasJobSearchIntent({ search: 'engineer' }), true);
  assert.equal(hasJobSearchIntent({ workMode: 'remote' }), true);
  assert.equal(hasJobSearchIntent({ page: '2', limit: '10' }), false);
  assert.equal(hasJobSearchIntent({ arbitrary: 'secret' }), false);
});

test('CA-03 measurement payload preserves authoritative total and bounded query', () => {
  const measurement = buildJobsSearchMeasurement({
    query: { search: `${'x'.repeat(300)}` },
    total: 37,
    responseTimeMs: 12,
    userId: null,
  });
  assert.equal(measurement.resultCount, 37);
  assert.equal(measurement.query.length, 200);
  assert.deepEqual(measurement.entityTypes, ['job']);
  assert.equal(measurement.source, 'public');
});

test('CA-03 controller logs only completed first-page searches with API total', () => {
  const source = read('server/src/controllers/jobsController.js');
  assert.match(source, /const \[data, total\] = await Promise\.all/);
  assert.match(source, /if \(page === 1 && hasJobSearchIntent\(req\.query\)\)/);
  assert.match(source, /buildJobsSearchMeasurement\(\{[\s\S]*total,[\s\S]*responseTimeMs/);
});
