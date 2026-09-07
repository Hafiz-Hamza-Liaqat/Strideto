import assert from 'node:assert/strict';
import { normalizeAdminPagination } from '../hooks/adminPagination.js';

const full = normalizeAdminPagination({ pagination: { page: 1, limit: 25, total: 648, totalPages: 26 } });
assert.deepEqual(full, { page: 1, limit: 25, total: 648, pages: 26 });

const onePage = normalizeAdminPagination({ pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } });
assert.equal(onePage.pages, 1);

const partial = normalizeAdminPagination({ pagination: { page: 2, limit: 25, total: 26, totalPages: 2 } });
assert.deepEqual(partial, { page: 2, limit: 25, total: 26, pages: 2 });

const empty = normalizeAdminPagination({ pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } });
assert.equal(empty.pages, 0);

const legacy = normalizeAdminPagination({ pagination: { page: 1, limit: 25, total: 26, pages: 2 } });
assert.equal(legacy.pages, 2);

console.log('admin pagination normalization: PASS');
