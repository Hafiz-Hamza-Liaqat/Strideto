/**
 * Enrich employer jobs with live counts (mocked Application aggregate).
 * Run: node src/__tests__/employerApplicationCountsEnrich.test.js
 */
import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { resolveJobApplyType } = await import(
  pathToFileURL(path.resolve(__dirname, '../services/employerApplicationCounts.js')).href
);

function enrichLocal(jobs, countMap) {
  return jobs.map((j) => {
    const applyType = resolveJobApplyType(j);
    const tracked = applyType === 'internal';
    const live = tracked ? countMap.get(String(j._id)) ?? 0 : null;
    return {
      ...j,
      applyType,
      applicationsTracked: tracked,
      submittedApplicationsCount: live,
      applicationsCount: tracked ? live : j.applicationsCount ?? 0,
    };
  });
}

const jobs = [
  { _id: '1', title: 'Internal', applyType: 'internal', applicationsCount: 99 },
  { _id: '2', title: 'External', applyType: 'external', applicationsCount: 5, applicationLink: 'https://x.com' },
];
const map = new Map([['1', 1]]);
const out = enrichLocal(jobs, map);

assert.strictEqual(out[0].applicationsTracked, true);
assert.strictEqual(out[0].submittedApplicationsCount, 1);
assert.strictEqual(out[0].applicationsCount, 1); // live overrides stale 99
assert.strictEqual(out[1].applicationsTracked, false);
assert.strictEqual(out[1].submittedApplicationsCount, null);

console.log('employerApplicationCountsEnrich.test.js: all assertions passed');
