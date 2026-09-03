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
export async function indexEntity(entityType, entityId, locale = 'en', options = {}) {
  const mapper = options.mapper || SEARCH_DOCUMENT_MAPPERS[entityType];
  const Model = options.Model || ENTITY_MODELS[entityType];
  const remove = options.remove || ((type, id, selectedLocale) => deleteSearchDocument(
    type,
    id,
    selectedLocale,
    { SearchDocumentModel: options.SearchDocumentModel, invalidateCache: options.invalidateCache },
  ));
  const upsert = options.upsert || ((normalized) => upsertSearchDocument(normalized, {
    SearchDocumentModel: options.SearchDocumentModel,
    invalidateCache: options.invalidateCache,
  }));
  if (!mapper || !Model) return null;

  let query = Model.findById(entityId);
  if (entityType === 'test') query = query.populate('providerId', 'name officialWebsite status');
  const doc = await query.lean();
  if (!doc) {
    await remove(entityType, entityId, locale);
    return null;
  }

  const normalized = mapper(doc);
  if (!normalized) {
    await remove(entityType, entityId, locale);
    return null;
  }

  return upsert(normalized);
}

export async function removeEntity(entityType, entityId, locale = 'en') {
  return deleteSearchDocument(entityType, entityId, locale);
}

/**
 * Rebuild one indexed entity type. The source scan must complete before stale
 * documents are removed; this makes interruption safe to rerun.
 *
 * @param {string} entityType
 * @param {{ dryRun?: boolean; locale?: string; batchSize?: number; Model?: object; SearchDocumentModel?: object }} [options]
 */
export async function rebuildEntityType(entityType, options = {}) {
  const Model = options.ModelByType?.[entityType] || options.Model || ENTITY_MODELS[entityType];
  const mapper = options.mapperByType?.[entityType] || options.mapper || SEARCH_DOCUMENT_MAPPERS[entityType];
  const SearchDocumentModel = options.SearchDocumentModel || SearchDocument;
  const locale = options.locale || 'en';
  const dryRun = options.dryRun === true;
  const result = {
    entityType,
    locale,
    dryRun,
    scanned: 0,
    eligible: 0,
    indexed: 0,
    upserted: 0,
    wouldUpsert: 0,
    skipped: 0,
    failed: 0,
    staleFound: 0,
    deleted: 0,
    scanComplete: false,
    ok: true,
    errors: [],
  };

  if (!Model || !mapper) {
    result.ok = false;
    result.failed = 1;
    result.errors.push({ phase: 'configuration', code: 'unsupported_entity_type' });
    return result;
  }

  const eligibleIds = new Set();
  try {
    let query = Model.find();
    if (entityType === 'test') query = query.populate('providerId', 'name officialWebsite status');
    const cursor = query.cursor({ batchSize: options.batchSize || 500 });

    for await (const doc of cursor) {
      result.scanned += 1;
      let normalized;
      try {
        normalized = mapper(doc);
      } catch (error) {
        result.failed += 1;
        result.ok = false;
        if (result.errors.length < 20) result.errors.push({
          phase: 'map',
          entityId: String(doc?._id || ''),
          code: error?.name || 'mapper_failed',
        });
        continue;
      }

      if (!normalized?.searchable || normalized.locale !== locale) {
        result.skipped += 1;
        continue;
      }

      const sourceId = String(doc._id);
      eligibleIds.add(sourceId);
      result.eligible += 1;
      if (dryRun) {
        result.wouldUpsert += 1;
        continue;
      }

      try {
        const stored = await (options.upsert || ((value) => upsertSearchDocument(value, {
          SearchDocumentModel,
          invalidateCache: options.invalidateCache,
        })))(normalized);
        if (stored) {
          result.indexed += 1;
          result.upserted += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.failed += 1;
        result.ok = false;
        if (result.errors.length < 20) result.errors.push({
          phase: 'upsert',
          entityId: sourceId,
          code: error?.name || 'upsert_failed',
        });
      }
    }
    result.scanComplete = true;
  } catch (error) {
    result.failed += 1;
    result.ok = false;
    if (result.errors.length < 20) result.errors.push({
      phase: 'scan',
      code: error?.name || 'scan_failed',
    });
  }

  // Never clean stale documents after an interrupted/incomplete source scan.
  // A failed scan/map/upsert does not establish a complete eligible set.
  // Retain existing documents until a clean rebuild can prove they are stale.
  if (result.scanComplete && result.failed === 0) {
    try {
      const existing = await SearchDocumentModel.find({ entityType, locale }).lean();
      const staleIds = existing
        .map((doc) => String(doc.entityId || ''))
        .filter((id) => id && !eligibleIds.has(id));
      result.staleFound = staleIds.length;
      if (!dryRun && staleIds.length) {
        const deletion = await (options.deleteMany || ((query) => SearchDocumentModel.deleteMany(query)))({
          entityType,
          locale,
          entityId: { $in: staleIds },
        });
        result.deleted = deletion.deletedCount || 0;
      }
    } catch (error) {
      result.failed += 1;
      result.ok = false;
      if (result.errors.length < 20) result.errors.push({
        phase: 'stale_cleanup',
        code: error?.name || 'cleanup_failed',
      });
    }
  }

  if (!dryRun) await searchCacheInvalidatePrefix('search:');
  return result;
}

export async function rebuildAll(options = {}) {
  const results = [];
  for (const entityType of SEARCH_ENTITY_TYPES) {
    try {
      results.push(await rebuildEntityType(entityType, options));
    } catch (error) {
      results.push({
        entityType,
        dryRun: options.dryRun === true,
        scanned: 0,
        eligible: 0,
        indexed: 0,
        upserted: 0,
        wouldUpsert: 0,
        skipped: 0,
        failed: 1,
        staleFound: 0,
        deleted: 0,
        scanComplete: false,
        ok: false,
        errors: [{ phase: 'rebuild', code: error?.name || 'rebuild_failed' }],
      });
    }
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
