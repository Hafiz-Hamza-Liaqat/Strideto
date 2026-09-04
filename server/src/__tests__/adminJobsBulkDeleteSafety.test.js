import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { AuditLog } from '../models/AuditLog.js';
import { SearchIndexer } from '../services/search/SearchIndexer.js';
import { bulkAction } from '../controllers/admin/adminJobsController.js';

const IDS = {
  a: new mongoose.Types.ObjectId().toString(),
  b: new mongoose.Types.ObjectId().toString(),
};

let deleteCalls;
let removalCalls;
let auditCalls;
let originalDeleteMany;
let originalRemoveEntity;
let originalAuditCreate;

function request(ids, action = 'delete') {
  return {
    body: { action, ...(ids === undefined ? {} : { ids }) },
    user: { userId: new mongoose.Types.ObjectId().toString(), role: 'Admin', email: 'admin@example.test' },
    headers: {},
    socket: {},
  };
}

function response() {
  const out = { statusCode: 200, body: undefined };
  return {
    out,
    status(code) {
      out.statusCode = code;
      return this;
    },
    json(body) {
      out.body = body;
      return body;
    },
  };
}

async function invoke(ids) {
  const res = response();
  const nextErrors = [];
  await bulkAction(request(ids), res, (err) => nextErrors.push(err));
  assert.deepEqual(nextErrors, [], 'bulk handler should not delegate an error');
  return res.out;
}

beforeEach(() => {
  deleteCalls = [];
  removalCalls = [];
  auditCalls = [];
  originalDeleteMany = Job.deleteMany;
  originalRemoveEntity = SearchIndexer.removeEntity;
  originalAuditCreate = AuditLog.create;

  Job.deleteMany = async (filter) => {
    deleteCalls.push(filter);
    return { deletedCount: new Set(filter._id.$in.map(String)).size };
  };
  SearchIndexer.removeEntity = async (entityType, entityId, locale) => {
    removalCalls.push({ entityType, entityId, locale });
  };
  AuditLog.create = async (payload) => {
    auditCalls.push(payload);
    return payload;
  };
});

afterEach(() => {
  Job.deleteMany = originalDeleteMany;
  SearchIndexer.removeEntity = originalRemoveEntity;
  AuditLog.create = originalAuditCreate;
});

test('JOB-BULK-01/07 empty or missing ids perform no deletion', async () => {
  for (const ids of [[], undefined]) {
    const result = await invoke(ids);
    assert.equal(result.statusCode, 400);
    assert.equal(deleteCalls.length, 0);
    assert.equal(removalCalls.length, 0);
    assert.equal(auditCalls.length, 0);
  }
});

test('JOB-BULK-02 all-invalid ids perform no deletion or fallback query', async () => {
  const result = await invoke(['bad', 'not-an-object-id']);
  assert.equal(result.statusCode, 400);
  assert.equal(deleteCalls.length, 0);
  assert.equal(removalCalls.length, 0);
  assert.equal(auditCalls.length, 0);
});

test('JOB-BULK-03/04 one and multiple valid ids use only the explicit allowlist', async () => {
  const one = await invoke([IDS.a]);
  assert.equal(one.statusCode, 200);
  assert.deepEqual(deleteCalls[0], { _id: { $in: [IDS.a] } });
  assert.deepEqual(removalCalls, [{ entityType: 'job', entityId: IDS.a, locale: 'en' }]);

  deleteCalls = [];
  removalCalls = [];
  auditCalls = [];
  const many = await invoke([IDS.a, IDS.b]);
  assert.equal(many.statusCode, 200);
  assert.deepEqual(deleteCalls[0], { _id: { $in: [IDS.a, IDS.b] } });
  assert.deepEqual(removalCalls, [
    { entityType: 'job', entityId: IDS.a, locale: 'en' },
    { entityType: 'job', entityId: IDS.b, locale: 'en' },
  ]);
});

test('JOB-BULK-05 duplicate ids remain bounded by Mongo $in semantics', async () => {
  const result = await invoke([IDS.a, IDS.a, IDS.b]);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(deleteCalls[0], { _id: { $in: [IDS.a, IDS.a, IDS.b] } });
  assert.equal(new Set(deleteCalls[0]._id.$in).size, 2);
  assert.deepEqual(removalCalls.map((call) => call.entityId), [IDS.a, IDS.a, IDS.b]);
  assert.equal(result.body.affected, 2);
});

test('JOB-BULK-06 mixed ids forwards only valid explicit ids', async () => {
  const result = await invoke([IDS.a, 'bad', IDS.b]);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(deleteCalls[0], { _id: { $in: [IDS.a, IDS.b] } });
  assert.deepEqual(removalCalls.map((call) => call.entityId), [IDS.a, IDS.b]);
  assert.equal(result.body.affected, 2);
});

test('JOB-BULK-08 bounded explicit lists do not expand scope', async () => {
  const ids = Array.from({ length: 25 }, () => new mongoose.Types.ObjectId().toString());
  const result = await invoke(ids);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(deleteCalls[0], { _id: { $in: ids } });
  assert.deepEqual(removalCalls.map((call) => call.entityId), ids);
  assert.equal(result.body.affected, ids.length);
});

test('JOB-BULK-09/10/11 route and operation contracts remain authorized, bounded, and explicit', () => {
  const controller = fs.readFileSync(path.resolve('server/src/controllers/admin/adminJobsController.js'), 'utf8');
  const routes = fs.readFileSync(path.resolve('server/src/routes/admin.js'), 'utf8');
  assert.match(routes, /adminRouter\.post\('\/jobs\/bulk', requirePermission\(PERMISSIONS\.CONTENT_JOBS\), adminJobs\.bulkAction\)/);
  assert.doesNotMatch(controller, /deleteMany\(\{\s*\}\)/);
  assert.doesNotMatch(controller, /deleteMany\(filterFromQuery/);
  assert.match(controller, /metadata: \{ ids: validIds, deleted: result\.deletedCount \}/);
});

test('JOB-BULK-12 source path has no implicit delete-all or global select-all behavior', () => {
  const controller = fs.readFileSync(path.resolve('server/src/controllers/admin/adminJobsController.js'), 'utf8');
  const table = fs.readFileSync(path.resolve('client/src/components/admin/AdminDataTable.jsx'), 'utf8');
  assert.doesNotMatch(controller, /deleteMany\(\{\s*\$or:/);
  assert.doesNotMatch(controller, /deleteMany\(\{\s*status:/);
  assert.match(table, /onSelectionChange\(data\.map\(\(row\) => row\[rowKey\]\)\)/);
});

console.log('adminJobsBulkDeleteSafety.test.js: explicit-ID bulk delete safety coverage loaded');
