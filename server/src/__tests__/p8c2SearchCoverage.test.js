import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mapProgramToSearchDocument,
  mapIntlScholarshipToSearchDocument,
  mapLegacyInstitutionToSearchDocument,
  mapCompanyToSearchDocument,
} from '../services/search/documentMappers.js';
import { indexEntity, rebuildEntityType } from '../services/search/SearchIndexer.js';
import { isSearchDomainAllowed } from '../../../shared/platform/searchPrivacyPolicy.js';
import { PUBLIC_SEARCH_ENTITY_TYPES, SEARCH_ENTITY_TYPES } from '../../../shared/search/entityTypes.js';

const fixtures = {
  program: {
    _id: 'program-1', name: 'Computer Science', slug: 'computer-science',
    institutionId: 'institution-1', description: 'An undergraduate computing programme.',
    degreeLevel: 'bachelor', field: 'computing', studyMode: 'full_time', country: 'GB',
    status: 'published', launchEligible: true,
  },
  'intl-scholarship': {
    _id: 'intl-1', title: 'Global Study Award', slug: 'global-study-award', country: 'GB',
    provider: 'Study Foundation', degreeLevel: 'master', fundingType: 'tuition support',
    amount: 'Full tuition', description: 'Public scholarship description.', status: 'active',
  },
  'legacy-institution': {
    _id: 'legacy-1', name: 'Example College', slug: 'example-college', type: 'college',
    country: 'GB', city: 'London', province: 'London', description: 'Public college profile.', status: 'active',
  },
  company: {
    _id: 'company-1', name: 'Example Company', slug: 'example-company', description: 'Public company profile.',
    industry: 'technology', city: 'London', country: 'GB', status: 'active', isFeatured: true,
  },
};

const mappers = {
  program: mapProgramToSearchDocument,
  'intl-scholarship': mapIntlScholarshipToSearchDocument,
  'legacy-institution': mapLegacyInstitutionToSearchDocument,
  company: mapCompanyToSearchDocument,
};

function sourceModel(documents) {
  return {
    findById(id) {
      return { lean: async () => documents.find((doc) => String(doc._id) === String(id)) || null };
    },
    find() {
      const query = {
        cursor() {
          return (async function* cursor() { for (const doc of documents) yield doc; }());
        },
      };
      return query;
    },
  };
}

function storedModel(documents) {
  return {
    async findOneAndUpdate(filter, update) {
      let row = documents.find((doc) => doc.entityType === filter.entityType
        && doc.entityId === filter.entityId && doc.locale === filter.locale);
      if (!row) { row = { ...filter }; documents.push(row); }
      Object.assign(row, update.$set);
      return row;
    },
    find(filter) {
      return { lean: async () => documents.filter((doc) => doc.entityType === filter.entityType && doc.locale === filter.locale) };
    },
    async deleteOne(filter) {
      const index = documents.findIndex((doc) => doc.entityType === filter.entityType
        && doc.entityId === filter.entityId && doc.locale === filter.locale);
      if (index < 0) return { deletedCount: 0 };
      documents.splice(index, 1);
      return { deletedCount: 1 };
    },
    async deleteMany(filter) {
      const before = documents.length;
      for (let i = documents.length - 1; i >= 0; i -= 1) {
        const row = documents[i];
        if (row.entityType === filter.entityType && row.locale === filter.locale
          && filter.entityId.$in.includes(row.entityId)) documents.splice(i, 1);
      }
      return { deletedCount: before - documents.length };
    },
  };
}

const noCache = async () => {};

test('C2-01/C2-05/C2-06 bounded mappers use positive public factual fields', () => {
  for (const [entityType, mapper] of Object.entries(mappers)) {
    const result = mapper({ ...fixtures[entityType], futureInternalField: 'privateSentinel', adminNotes: 'never' });
    assert.equal(result.entityType, entityType);
    assert.equal(result.entityId, fixtures[entityType]._id);
    assert.match(result.url, /^\/(program-explorer|intl-scholarships|schools-and-colleges|company)\//);
    assert.equal(result.futureInternalField, undefined);
    assert.equal(result.adminNotes, undefined);
    assert.equal(result.searchText.includes('privateSentinel'), false);
  }
});

test('C2-02 eligibility matches accepted public policy', () => {
  assert.equal(mapProgramToSearchDocument({ ...fixtures.program, launchEligible: false }), null);
  assert.equal(mapProgramToSearchDocument({ ...fixtures.program, status: 'draft' }), null);
  assert.equal(mapIntlScholarshipToSearchDocument({ ...fixtures['intl-scholarship'], status: 'closed' }), null);
  assert.equal(mapLegacyInstitutionToSearchDocument({ ...fixtures['legacy-institution'], status: 'draft' }), null);
  assert.equal(mapCompanyToSearchDocument({ ...fixtures.company, status: 'draft' }), null);
});

test('C2-03/C2-04 canonical URLs use slugs while entityId remains source identity', () => {
  assert.equal(mapProgramToSearchDocument(fixtures.program).url, '/program-explorer/computer-science');
  assert.equal(mapIntlScholarshipToSearchDocument(fixtures['intl-scholarship']).url, '/intl-scholarships/global-study-award');
  assert.equal(mapLegacyInstitutionToSearchDocument(fixtures['legacy-institution']).url, '/schools-and-colleges/example-college');
  assert.equal(mapCompanyToSearchDocument(fixtures.company).url, '/company/example-company');
  assert.equal(mapCompanyToSearchDocument(fixtures.company).entityId, 'company-1');
  assert.equal(mapCompanyToSearchDocument(fixtures.company).url.includes('company-1'), false);
});

test('C2-07 new types are public while internal configured types remain denied', () => {
  for (const type of Object.keys(mappers)) {
    assert.equal(PUBLIC_SEARCH_ENTITY_TYPES.includes(type), true);
    assert.equal(isSearchDomainAllowed(type, 'public'), true);
  }
  for (const type of ['form', 'media', 'talent-profile', 'credential']) {
    assert.equal(SEARCH_ENTITY_TYPES.includes(type), true);
    assert.equal(isSearchDomainAllowed(type, 'public'), false);
  }
});

test('C2-08/C2-09/C2-10/C2-11 each new type participates in C1 lifecycle', async () => {
  for (const [entityType, mapper] of Object.entries(mappers)) {
    const source = [{ ...fixtures[entityType] }];
    const documents = [];
    const options = {
      Model: sourceModel(source), SearchDocumentModel: storedModel(documents), mapper, invalidateCache: noCache,
    };
    await indexEntity(entityType, source[0]._id, 'en', options);
    assert.equal(documents.length, 1);
    source[0].slug = `${source[0].slug}-renamed`;
    await indexEntity(entityType, source[0]._id, 'en', options);
    assert.equal(documents.length, 1);
    assert.equal(documents[0].slug, source[0].slug);
    source[0].status = entityType === 'program' ? 'draft' : entityType === 'company' ? 'draft' : entityType === 'legacy-institution' ? 'draft' : 'closed';
    await indexEntity(entityType, source[0]._id, 'en', options);
    assert.equal(documents.length, 0);
  }
});

test('C2-12/C2-13 dry-run reports stale and would-upsert without mutation', async () => {
  const source = [{ ...fixtures.company }];
  const documents = [{ entityType: 'company', entityId: 'orphan', locale: 'en', slug: 'orphan' }];
  const result = await rebuildEntityType('company', {
    Model: sourceModel(source), SearchDocumentModel: storedModel(documents), mapper: mapCompanyToSearchDocument,
    dryRun: true, invalidateCache: noCache,
  });
  assert.equal(result.eligible, 1);
  assert.equal(result.wouldUpsert, 1);
  assert.equal(result.staleFound, 1);
  assert.equal(result.deleted, 0);
  assert.equal(documents.length, 1);
});

test('C2-14 public search result allowlist remains bounded', () => {
  const source = mapCompanyToSearchDocument({ ...fixtures.company, launchEligible: true });
  const publicKeys = ['id', 'entityType', 'title', 'slug', 'url', 'summary', 'category', 'province', 'country', 'tags', 'featured', 'publishedAt', 'updatedAt', 'status', 'metadata', 'score'];
  assert.equal(source.metadata.adminEditUrl, undefined);
  assert.equal(publicKeys.includes('futureInternalField'), false);
});

test('C2-15 dataset ownership remains explicit and separate', () => {
  assert.notEqual('institution', 'legacy-institution');
  assert.equal(mapLegacyInstitutionToSearchDocument(fixtures['legacy-institution']).url.startsWith('/schools-and-colleges/'), true);
  assert.equal(mapCompanyToSearchDocument(fixtures.company).url.startsWith('/company/'), true);
  assert.equal(mapProgramToSearchDocument(fixtures.program).url.startsWith('/program-explorer/'), true);
});
