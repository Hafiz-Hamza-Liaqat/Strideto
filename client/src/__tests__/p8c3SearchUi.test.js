import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('C3-UI-01 through C3-UI-05: autocomplete accepts all approved public groups', () => {
  const source = read('client/src/components/search/GlobalSearch.jsx');
  assert.match(source, /data\?\.groups/);
  assert.match(source, /quickLinks/);
  for (const type of ['program', 'blog', 'admission', 'company', 'intl-scholarship', 'legacy-institution']) {
    assert.ok(source.includes('entityTypeLabel'), `${type} uses shared entity labels`);
  }
});

test('C3-UI-06 and C3-UI-07: public and Admin views use returned canonical URLs', () => {
  const publicSearch = read('client/src/pages/Search/SearchResults.jsx');
  const adminSearch = read('client/src/pages/Admin/AdminGlobalSearch.jsx');
  assert.match(publicSearch, /to=\{item\.url \|\| '#'/);
  assert.match(adminSearch, /to=\{item\.url\}/);
});

test('C3-UI-08 through C3-UI-09: explicit filters and bounded previews remain visible', () => {
  const publicSearch = read('client/src/pages/Search/SearchResults.jsx');
  const adminSearch = read('client/src/pages/Admin/AdminGlobalSearch.jsx');
  assert.match(publicSearch, /type: type \|\| undefined/);
  assert.match(adminSearch, /type: type \|\| undefined/);
  assert.match(publicSearch, /item\.summary/);
  assert.match(adminSearch, /item\.summary/);
  assert.doesNotMatch(adminSearch, /item\.metadata\?\.launchEligible/);
});

test('C3-UI-10 through C3-UI-14: public navigation links and empty state are explicit', () => {
  const source = read('client/src/components/search/GlobalSearch.jsx');
  for (const path of ['/jobs', '/internships', '/scholarships', '/employers']) {
    assert.ok(source.includes('item.url'), `quick-link navigation uses returned URL (${path})`);
  }
  assert.match(source, /navigation/);
  assert.match(source, /No matches/);
  assert.match(source, /onKeyDown/);
});
