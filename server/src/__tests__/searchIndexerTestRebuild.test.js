import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { removeStaleTestSearchDocuments } from '../services/search/SearchIndexer.js';

const source = readFileSync(new URL('../services/search/SearchIndexer.js', import.meta.url), 'utf8');
assert.match(source, /const eligibleIds = new Set\(\)/);
assert.match(source, /result\.scanComplete && result\.failed === 0/);
assert.match(source, /staleFound/);
assert.match(source, /SearchDocumentModel\.deleteMany\(\{[\s\S]*entityType: 'test'/);
assert.match(source, /entityId: \{ \$nin: eligibleIds \}/);
assert.match(source, /return result\.deletedCount \|\| 0/);
assert.match(source, /searchCacheInvalidatePrefix\('search:'\)/);
assert.doesNotMatch(source, /deleteMany\(\{[\s\S]*entityType: \{ \$ne: 'test'/);

const documents = [
  { entityType: 'test', entityId: 'eligible', locale: 'en' },
  { entityType: 'test', entityId: 'stale', locale: 'en' },
  { entityType: 'job', entityId: 'job-1', locale: 'en' },
];
const deletedQueries = [];
const fakeSearchDocument = {
  async deleteMany(query) {
    deletedQueries.push(query);
    const before = documents.length;
    for (let index = documents.length - 1; index >= 0; index -= 1) {
      const doc = documents[index];
      if (doc.entityType === query.entityType && doc.locale === query.locale && !query.entityId.$nin.includes(doc.entityId)) documents.splice(index, 1);
    }
    return { deletedCount: before - documents.length };
  },
};
assert.equal(await removeStaleTestSearchDocuments(['eligible'], fakeSearchDocument), 1, 'stale Test document is removed');
assert.deepEqual(documents, [
  { entityType: 'test', entityId: 'eligible', locale: 'en' },
  { entityType: 'job', entityId: 'job-1', locale: 'en' },
], 'non-Test documents remain untouched');
assert.deepEqual(deletedQueries[0], { entityType: 'test', locale: 'en', entityId: { $nin: ['eligible'] } });
assert.equal(await removeStaleTestSearchDocuments(['eligible'], fakeSearchDocument), 0, 'rebuild is idempotent');
console.log('searchIndexerTestRebuild: stale Test documents are removed without broad entity deletion');
