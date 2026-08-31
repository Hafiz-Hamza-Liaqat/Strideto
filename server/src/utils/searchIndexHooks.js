/**
 * Search index hooks — call from admin write paths (C.7.0.4).
 */
import { SearchIndexer } from '../services/search/SearchIndexer.js';
import { searchCacheInvalidatePrefix } from '../services/search/searchCache.js';

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
  void SearchIndexer.indexEntity(entityType, String(entityId), locale).catch(() => {});
  searchCacheInvalidatePrefix('search:');
}

/**
 * @param {string} entity
 * @param {string} entityId
 * @param {string} [locale]
 */
export function scheduleSearchIndexRemoval(entity, entityId, locale = 'en') {
  const entityType = ENTITY_TYPE_ALIASES[entity] || entity;
  if (!entityType || !entityId) return;
  void SearchIndexer.removeEntity(entityType, String(entityId), locale).catch(() => {});
  searchCacheInvalidatePrefix('search:');
}
