import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.join(here, '..', relative), 'utf8');
const page = read('pages/Admin/AdminContentJobs.jsx');
const table = read('components/admin/AdminDataTable.jsx');
const list = read('hooks/useAdminList.js');
const locale = read('i18n/locales/en/admin.json');

assert.match(list, /const DEFAULT_LIMIT = 25/);
assert.match(list, /const setLimit = useCallback\(\(limit\) =>/);
assert.match(list, /limit, page: 1/);
assert.match(page, /pageSizeOptions=\{\[25, 50, 100\]\}/);
assert.match(page, /onPageSizeChange=\{\(limit\) =>/);
assert.match(page, /setSelectedIds\(\[\]\); setLimit\(limit\)/);
assert.match(table, /selectedCountPage/);
assert.match(table, /selectAllPage/);
assert.match(table, /onSelectionChange\(data\.map\(\(row\) => row\[rowKey\]\)\)/);
assert.match(page, /post\('\/admin\/jobs\/bulk', \{ action, ids \}\)/);
assert.match(locale, /"selectedCountPage": "\{\{count\}\} selected on this page"/);
assert.match(locale, /"selectAllPage": "Select all jobs on this page"/);
assert.match(locale, /"pageSize": "Rows per page"/);

console.log('adminJobsSelection.test.js: page-size and page-scoped selection assertions passed');
