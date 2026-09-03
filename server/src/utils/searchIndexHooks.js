/**
 * Search index hooks — call from admin write paths (C.7.0.4).
 */
import { SearchIndexer } from '../services/search/SearchIndexer.js';
import { searchCacheInvalidatePrefix } from '../services/search/searchCache.js';
import { logger } from './logger.js';

const ENTITY_TYPE_ALIASES = {
  job: 'job',
  scholarship: 'scholarship',
  admission: 'admission',
  university: 'university',
  blog: 'blog',
  career: 'career-guidance',
  'career-article': 'career-guidance',
  'career_article': 'career-guidance',
  'cms-page': 'cms-page',
  cmsPage: 'cms-page',
  'page-builder-page': 'page-builder-page',
  pageLayout: 'page-builder-page',
  form: 'form',
  media: 'media',
  'talent-profile': 'talent-profile',
  test: 'test',
  tests: 'test',
};

/**
 * Schedule incremental index update (non-blocking).
 * @param {string} entity
 * @param {string} entityId
 * @param {string} [locale]
 */
export function scheduleSearchIndexUpdate(entity, entityId, locale = 'en') {
  const entityType = ENTITY_TYPE_ALIASES[entity] || entity;
  if (!entityType || !entityId) return;
  const operation = SearchIndexer.indexEntity(entityType, String(entityId), locale);
  void operation.catch((error) => {
    logger.error('search_index_update_failed', {
      entityType, entityId: String(entityId), locale, error: error?.name || 'index_failed',
    });
  });
  searchCacheInvalidatePrefix('search:');
  return operation;
}

/**
 * @param {string} entity
 * @param {string} entityId
 * @param {string} [locale]
 */
export function scheduleSearchIndexRemoval(entity, entityId, locale = 'en') {
  const entityType = ENTITY_TYPE_ALIASES[entity] || entity;
  if (!entityType || !entityId) return;
  const operation = SearchIndexer.removeEntity(entityType, String(entityId), locale);
  void operation.catch((error) => {
    logger.error('search_index_removal_failed', {
      entityType, entityId: String(entityId), locale, error: error?.name || 'removal_failed',
    });
  });
  searchCacheInvalidatePrefix('search:');
  return operation;
}
