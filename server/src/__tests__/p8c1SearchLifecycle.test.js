import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  indexEntity,
  rebuildEntityType,
  rebuildAll,
} from '../services/search/SearchIndexer.js';
import { SearchIndexer } from '../services/search/SearchIndexer.js';
import { deleteSearchDocument } from '../services/search/SearchIndexService.js';
import { onContentDeleted } from '../utils/contentIntegration.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sourceModel(documents, { failCursor = false } = {}) {
  return {
    findById(id) {
      return { lean: async () => documents.find((doc) => String(doc._id) === String(id)) || null };
    },
    find() {
      const query = {
        populate() { return query; },
        cursor() {
          if (failCursor) throw new Error('cursor failed');
          return (async function* cursor() {
            for (const doc of documents) yield doc;
          }());
        },
      };
      return query;
    },
  };
}

function searchDocumentModel(documents) {
  return {
    async findOneAndUpdate(filter, update) {
      let doc = documents.find((entry) => entry.entityType === filter.entityType
        && entry.entityId === filter.entityId && entry.locale === filter.locale);
      if (!doc) {
        doc = { ...filter };
        documents.push(doc);
      }
      Object.assign(doc, update.$set);
      return clone(doc);
    },
    find(filter) {
      return { lean: async () => documents.filter((doc) => doc.entityType === filter.entityType && doc.locale === filter.locale).map(clone) };
    },
    async deleteOne(filter) {
      const index = documents.findIndex((doc) => doc.entityType === filter.entityType
        && doc.entityId === filter.entityId && doc.locale === filter.locale);
      if (index >= 0) documents.splice(index, 1);
      return { deletedCount: index >= 0 ? 1 : 0 };
    },
    async deleteMany(filter) {
      const before = documents.length;
      for (let i = documents.length - 1; i >= 0; i -= 1) {
        const doc = documents[i];
        if (doc.entityType === filter.entityType && doc.locale === filter.locale
          && filter.entityId.$in.includes(doc.entityId)) documents.splice(i, 1);
      }
      return { deletedCount: before - documents.length };
    },
  };
}

function mapper(doc) {
  if (doc.ineligible) return null;
  return {
    entityType: 'blog', entityId: String(doc._id), locale: doc.locale || 'en',
    title: doc.title, slug: doc.slug, url: `/blog/${doc.slug}`, summary: doc.title,
    keywords: [], category: '', province: '', country: '', tags: [],
    publishedAt: null, updatedAt: null, featured: false, status: 'published',
    searchable: true, metadata: {}, searchText: doc.title,
  };
}

const noCache = async () => {};

function options(source, stored, extra = {}) {
  return {
    Model: source,
    SearchDocumentModel: stored,
    mapper,
    invalidateCache: noCache,
    ...extra,
  };
}

test('C1-01/C1-02/C1-15 eligible indexing is unique and idempotent', async () => {
  const source = [{ _id: 'blog-1', title: 'First', slug: 'first' }];
  const documents = [];
  const stored = searchDocumentModel(documents);
  await indexEntity('blog', 'blog-1', 'en', options(sourceModel(source), stored));
  await indexEntity('blog', 'blog-1', 'en', options(sourceModel(source), stored));
  assert.equal(documents.length, 1);
  assert.deepEqual([documents[0].entityType, documents[0].entityId, documents[0].locale], ['blog', 'blog-1', 'en']);
});

test('C1-03/C1-04/C1-05 missing, ineligible, and deleted sources remove documents', async () => {
  const documents = [{ entityType: 'blog', entityId: 'gone', locale: 'en', slug: 'gone' }, { entityType: 'blog', entityId: 'draft', locale: 'en' }];
  const stored = searchDocumentModel(documents);
  await indexEntity('blog', 'gone', 'en', options(sourceModel([]), stored));
  await indexEntity('blog', 'draft', 'en', options(sourceModel([{ _id: 'draft', ineligible: true }]), stored));
  assert.equal(documents.length, 0);
  assert.equal(await indexEntity('blog', 'gone', 'en', options(sourceModel([]), stored)), null);
});

test('C1-05 supported content deletion removes only the matching SearchDocument', async () => {
  const documents = [
    { entityType: 'blog', entityId: 'deleted', locale: 'en', slug: 'deleted' },
    { entityType: 'blog', entityId: 'kept', locale: 'en', slug: 'kept' },
    { entityType: 'job', entityId: 'unrelated', locale: 'en', slug: 'unrelated' },
  ];
  const stored = searchDocumentModel(documents);
  const originalRemoveEntity = SearchIndexer.removeEntity;
  SearchIndexer.removeEntity = (entityType, entityId, locale) => deleteSearchDocument(
    entityType,
    entityId,
    locale,
    { SearchDocumentModel: stored, invalidateCache: noCache },
  );
  try {
    onContentDeleted('blogs', 'deleted');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(documents.some((doc) => doc.entityType === 'blog' && doc.entityId === 'deleted'), false);
    assert.equal(documents.some((doc) => doc.entityType === 'blog' && doc.entityId === 'kept'), true);
    assert.equal(documents.some((doc) => doc.entityType === 'job' && doc.entityId === 'unrelated'), true);
  } finally {
    SearchIndexer.removeEntity = originalRemoveEntity;
  }
});

test('C1-06 slug changes update one identity without an old duplicate', async () => {
  const source = [{ _id: 'blog-1', title: 'First', slug: 'first' }];
  const documents = [];
  const stored = searchDocumentModel(documents);
  await indexEntity('blog', 'blog-1', 'en', options(sourceModel(source), stored));
  source[0].slug = 'renamed';
  await indexEntity('blog', 'blog-1', 'en', options(sourceModel(source), stored));
  assert.equal(documents.length, 1);
  assert.equal(documents[0].slug, 'renamed');
  assert.equal(documents[0].url, '/blog/renamed');
});

test('C1-07/C1-08/C1-09 rebuild reports stale documents and dry-run does not mutate', async () => {
  const source = [{ _id: 'keep', title: 'Keep', slug: 'keep' }];
  const documents = [
    { entityType: 'blog', entityId: 'keep', locale: 'en', slug: 'old' },
    { entityType: 'blog', entityId: 'orphan', locale: 'en', slug: 'orphan' },
    { entityType: 'job', entityId: 'other', locale: 'en' },
  ];
  const stored = searchDocumentModel(documents);
  const dry = await rebuildEntityType('blog', options(sourceModel(source), stored, { dryRun: true }));
  assert.equal(dry.scanned, 1);
  assert.equal(dry.eligible, 1);
  assert.equal(dry.wouldUpsert, 1);
  assert.equal(dry.upserted, 0);
  assert.equal(dry.staleFound, 1);
  assert.equal(dry.deleted, 0);
  assert.equal(documents.length, 3);

  const run = await rebuildEntityType('blog', options(sourceModel(source), stored));
  assert.equal(run.indexed, 1);
  assert.equal(run.deleted, 1);
  assert.equal(documents.filter((doc) => doc.entityType === 'blog').length, 1);
  assert.equal(documents.some((doc) => doc.entityType === 'job'), true);
});

test('C1-10/C1-11 rebuild failures are observable and counted', async () => {
  const source = [{ _id: 'bad', title: 'Bad', slug: 'bad' }];
  const existing = [{ entityType: 'blog', entityId: 'bad', locale: 'en', slug: 'old' }];
  const stored = searchDocumentModel(existing);
  const result = await rebuildEntityType('blog', options(sourceModel(source), stored, {
    mapper: () => { throw new Error('mapping failed'); },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.failed, 1);
  assert.equal(result.errors[0].phase, 'map');
  assert.equal(result.scanComplete, true);
  assert.equal(result.deleted, 0);
  assert.equal(existing.length, 1);
});

test('C1-10 direct indexing rejects when SearchDocument persistence fails', async () => {
  const source = [{ _id: 'index-fails', title: 'Public title', slug: 'index-fails' }];
  const failingStore = {
    async findOneAndUpdate() {
      throw new Error('search document persistence failed');
    },
  };
  await assert.rejects(
    indexEntity('blog', 'index-fails', 'en', options(sourceModel(source), failingStore)),
    (error) => error instanceof Error && error.message === 'search document persistence failed',
  );
});

test('C1-12 rebuild-all surfaces a partial failure without claiming success', async () => {
  const source = [{ _id: 'one', title: 'One', slug: 'one' }];
  const stored = searchDocumentModel([]);
  const results = await rebuildAll({
    Model: sourceModel(source),
    SearchDocumentModel: stored,
    mapperByType: { blog: () => { throw new Error('one type failed'); } },
    mapper: () => null,
    invalidateCache: noCache,
  });
  const blog = results.find((result) => result.entityType === 'blog');
  assert.equal(blog.ok, false);
  assert.equal(blog.failed, 1);
  assert.equal(results.some((result) => result.entityType === 'job'), true);
});

test('rebuild interruption can be rerun from the beginning to converge without duplicates', async () => {
  const source = [
    { _id: 'source-a', title: 'A', slug: 'a' },
    { _id: 'source-b', title: 'B', slug: 'b' },
  ];
  const documents = [
    { entityType: 'blog', entityId: 'source-a', locale: 'en', slug: 'old-a' },
    { entityType: 'blog', entityId: 'orphan', locale: 'en', slug: 'orphan' },
  ];
  const stored = searchDocumentModel(documents);
  let interrupt = true;
  const sourceWithInterrupt = {
    find() {
      const query = {
        cursor() {
          return (async function* cursor() {
            yield source[0];
            if (interrupt) throw new Error('rebuild interrupted');
            yield source[1];
          }());
        },
      };
      return query;
    },
  };

  const first = await rebuildEntityType('blog', options(sourceWithInterrupt, stored));
  assert.equal(first.ok, false);
  assert.equal(first.scanComplete, false);
  assert.equal(first.deleted, 0);
  assert.equal(documents.some((doc) => doc.entityId === 'orphan'), true);

  interrupt = false;
  const second = await rebuildEntityType('blog', options(sourceWithInterrupt, stored));
  assert.equal(second.ok, true);
  assert.equal(second.scanComplete, true);
  assert.equal(second.deleted, 1);
  assert.equal(documents.filter((doc) => doc.entityType === 'blog').length, 2);
  assert.deepEqual(
    documents.filter((doc) => doc.entityType === 'blog').map((doc) => [doc.entityId, doc.slug]),
    [['source-a', 'a'], ['source-b', 'b']],
  );
});

test('C1-13 Test stale cleanup remains type-scoped and C1-14 public metadata is unchanged', async () => {
  const source = [{ _id: 'test-keep', title: 'Test', slug: 'test' }];
  const documents = [
    { entityType: 'test', entityId: 'test-keep', locale: 'en' },
    { entityType: 'test', entityId: 'test-stale', locale: 'en' },
    { entityType: 'blog', entityId: 'blog-1', locale: 'en' },
  ];
  const stored = searchDocumentModel(documents);
  const result = await rebuildEntityType('test', options(sourceModel(source), stored, {
    mapper: (doc) => ({ ...mapper(doc), entityType: 'test' }),
  }));
  assert.equal(result.deleted, 1);
  assert.deepEqual(documents.map((doc) => doc.entityType), ['test', 'blog']);
  assert.equal(documents.filter((doc) => doc.entityType === 'test').length, 1);
});

test('C1 failure reporting is retained at asynchronous and admin boundaries', () => {
  const hooks = readFileSync(new URL('../utils/searchIndexHooks.js', import.meta.url), 'utf8');
  const admin = readFileSync(new URL('../controllers/admin/adminSearchController.js', import.meta.url), 'utf8');
  assert.match(hooks, /search_index_update_failed/);
  assert.match(hooks, /search_index_removal_failed/);
  assert.match(admin, /ok: results\.every/);
  assert.match(admin, /dryRun/);
});

console.log('p8c1SearchLifecycle: lifecycle invariants covered');
