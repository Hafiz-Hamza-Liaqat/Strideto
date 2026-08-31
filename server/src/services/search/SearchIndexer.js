/**
 * Intelligent indexing engine (C.7.0.4).
 */
import { Job } from '../../models/Job.js';
import { Scholarship } from '../../models/Scholarship.js';
import { Admission } from '../../models/Admission.js';
import { University } from '../../models/University.js';
import { Blog } from '../../models/Blog.js';
import { CareerArticle } from '../../models/CareerArticle.js';
import { CmsStaticPage } from '../../models/CmsStaticPage.js';
import { CmsPageLayout } from '../../models/CmsPageLayout.js';
import { FormDefinition } from '../../models/FormDefinition.js';
import { MediaAsset } from '../../models/MediaAsset.js';
import { TalentProfile } from '../../models/career/TalentProfile.js';
import { Credential } from '../../models/career/Credential.js';
import { Test } from '../../models/education/Test.js';
import { SearchDocument } from '../../models/SearchDocument.js';
import { SEARCH_ENTITY_TYPES } from '../../../../shared/search/entityTypes.js';
import { SEARCH_DOCUMENT_MAPPERS } from './documentMappers.js';
import { deleteSearchDocument, upsertSearchDocument } from './SearchIndexService.js';
import { searchCacheInvalidatePrefix } from './searchCache.js';

const ENTITY_MODELS = {
  job: Job,
  scholarship: Scholarship,
  admission: Admission,
  university: University,
  blog: Blog,
  'career-guidance': CareerArticle,
  'cms-page': CmsStaticPage,
  'page-builder-page': CmsPageLayout,
  form: FormDefinition,
  media: MediaAsset,
  'talent-profile': TalentProfile,
  credential: Credential,
  test: Test,
};

export async function removeStaleTestSearchDocuments(eligibleIds, SearchDocumentModel = SearchDocument) {
  const result = await SearchDocumentModel.deleteMany({
    entityType: 'test',
    locale: 'en',
    entityId: { $nin: eligibleIds },
  });
  return result.deletedCount || 0;
}

/**
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} [locale]
 */
export async function indexEntity(entityType, entityId, locale = 'en') {
  const mapper = SEARCH_DOCUMENT_MAPPERS[entityType];
  const Model = ENTITY_MODELS[entityType];
  if (!mapper || !Model) return null;

  let query = Model.findById(entityId);
  if (entityType === 'test') query = query.populate('providerId', 'name officialWebsite status');
  const doc = await query.lean();
  if (!doc) {
    await deleteSearchDocument(entityType, entityId, locale);
    return null;
  }

  const normalized = mapper(doc);
  if (!normalized) {
    await deleteSearchDocument(entityType, entityId, locale);
    return null;
  }

  return upsertSearchDocument(normalized);
}

export async function removeEntity(entityType, entityId, locale = 'en') {
  return deleteSearchDocument(entityType, entityId, locale);
}

/**
 * @param {string} entityType
 */
export async function rebuildEntityType(entityType) {
  const Model = ENTITY_MODELS[entityType];
  const mapper = SEARCH_DOCUMENT_MAPPERS[entityType];
  if (!Model || !mapper) return { entityType, indexed: 0 };

  let query = Model.find();
  if (entityType === 'test') query = query.populate('providerId', 'name officialWebsite status');
  const cursor = query.cursor();
  let indexed = 0;
  const eligibleIds = [];
  for await (const doc of cursor) {
    const normalized = mapper(doc);
    if (normalized?.searchable) {
      await upsertSearchDocument(normalized);
      indexed += 1;
      if (entityType === 'test') eligibleIds.push(String(doc._id));
    }
  }
  let removed = 0;
  if (entityType === 'test') {
    removed = await removeStaleTestSearchDocuments(eligibleIds);
  }
  searchCacheInvalidatePrefix('search:');
  return { entityType, indexed, removed };
}

export async function rebuildAll() {
  const results = [];
  for (const entityType of SEARCH_ENTITY_TYPES) {
    results.push(await rebuildEntityType(entityType));
  }
  return results;
}

export class SearchIndexer {
  static indexEntity = indexEntity;
  static removeEntity = removeEntity;
  static rebuildEntityType = rebuildEntityType;
  static rebuildAll = rebuildAll;
  static removeStaleTestSearchDocuments = removeStaleTestSearchDocuments;
}
