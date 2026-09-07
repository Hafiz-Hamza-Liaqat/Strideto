import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAll, isReadOnlyAudit, runDiagnostic } from './production-admin-public-job-diff.mjs';

test('inventory uses GET-only client calls', async () => {
  const calls = [];
  const client = {
    requestAudit: [{ method: 'POST', path: '/auth/login', status: 200 }],
    get: async (path) => { calls.push(path); if (path.startsWith('/admin/jobs')) return { data: [{ id: 'admin-1', externalId: 'e1' }], pagination: { total: 1, totalPages: 1 } }; return { data: [{ id: 'public-1', externalId: 'p1' }], pagination: { total: 1, totalPages: 1 } }; },
  };
  const report = await runDiagnostic({ client });
  assert.equal(report.adminOnlyCount, 1);
  assert.equal(report.readOnlyAudit, true);
  assert.deepEqual(calls, ['/admin/jobs?page=1&limit=100', '/jobs?page=1&limit=50']);
});

test('read-only audit rejects arbitrary write-like requests', () => {
  assert.equal(isReadOnlyAudit([{ method: 'POST', path: '/auth/login' }, { method: 'GET', path: '/jobs' }]), true);
  assert.equal(isReadOnlyAudit([{ method: 'POST', path: '/jobs' }]), false);
  assert.equal(isReadOnlyAudit([{ method: 'PATCH', path: '/admin/jobs/1' }]), false);
});

test('pagination helper stops from reported total', async () => {
  let count = 0;
  const result = await fetchAll({ get: async () => { count += 1; return { jobs: [{ id: count }], total: 1 }; } }, '/jobs', 50);
  assert.equal(result.rows.length, 1);
  assert.equal(count, 1);
});
