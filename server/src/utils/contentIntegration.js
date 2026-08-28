/**
 * Canonical content mutation integration (C.7.0.7.1).
 * Single entry point for search, workflow, dynamic cache, and analytics cache invalidation.
 */
import { scheduleSearchIndexUpdate, scheduleSearchIndexRemoval } from './searchIndexHooks.js';
import { syncWorkflowAfterSave } from '../services/workflow/workflowIntegration.js';
import { syncWorkflowPublished } from '../services/workflow/workflowPublishIntegration.js';
import { invalidateDynamicContentForEntity } from './dynamicContentCache.js';
import { cacheClear as clearDynamicCache } from '../services/dynamicContent/memoryCache.js';
import { searchCacheInvalidatePrefix } from '../services/search/searchCache.js';
import { analyticsCacheClear } from '../services/analytics/analyticsCache.js';
import { findGlobalBlockUsage } from '../services/globalBlockUsageService.js';
import { CmsPageLayout } from '../models/CmsPageLayout.js';
import { scheduleSeoChangeNotification } from '../services/seo/seoChangeNotificationService.js';

/** Workflow / admin resource key → search entity type */
export const CONTENT_TO_SEARCH_ENTITY = {
  job: 'job',
  jobs: 'job',
  scholarship: 'scholarship',
  scholarships: 'scholarship',
  admission: 'admission',
  admissions: 'admission',
  university: 'university',
  universities: 'university',
  blog: 'blog',
  blogs: 'blog',
  'career-guidance': 'career-guidance',
  career: 'career-guidance',
  'cms-page': 'cms-page',
  'page-builder': 'page-builder-page',
  'page-builder-page': 'page-builder-page',
  form: 'form',
  forms: 'form',
  media: 'media',
};

/** Career domain entity types → search index type (C.8.0.2A) */
export const CAREER_TO_SEARCH_ENTITY = {
  'talent-profile': 'talent-profile',
  credential: 'credential',
  assessment: 'assessment',
  'opportunity-application': 'opportunity-application',
};

/** Workflow resource key → dynamic cache entity */
export const CONTENT_TO_DYNAMIC_ENTITY = {
  job: 'job',
  jobs: 'job',
  scholarship: 'scholarship',
  scholarships: 'scholarship',
  admission: 'admission',
  admissions: 'admission',
  blog: 'blog',
  blogs: 'blog',
  career: 'career',
  'career-guidance': 'career',
};

/**
 * @param {string} resource
 */
export function toSearchEntityType(resource) {
  return CONTENT_TO_SEARCH_ENTITY[resource] || resource;
}

function invalidateRelatedCaches() {
  searchCacheInvalidatePrefix('search:');
  searchCacheInvalidatePrefix('related:');
  analyticsCacheClear();
}

/**
 * After create or update (non-delete).
 * @param {string} resource - workflow or search resource key
 * @param {object} doc - mongoose doc or plain object with _id
 * @param {{ locale?: string }} [options]
 */
export function onContentSaved(resource, doc, options = {}) {
  const entityId = doc?._id;
  if (!entityId) return;
  const locale = options.locale || doc.locale || 'en';
  const searchType = toSearchEntityType(resource);

  void syncWorkflowAfterSave(resource, doc).catch(() => {});
  scheduleSearchIndexUpdate(searchType, entityId, locale);

  const dynamicKey = CONTENT_TO_DYNAMIC_ENTITY[resource];
  if (dynamicKey) invalidateDynamicContentForEntity(dynamicKey);

  invalidateRelatedCaches();

  scheduleSeoChangeNotification({
    resource,
    previous: options.previous || null,
    next: doc,
    action: 'save',
    context: options.seoContext,
  });
}

/**
 * @param {string} resource
 * @param {string} entityId
 * @param {{ locale?: string }} [options]
 */
export function onContentDeleted(resource, entityId, options = {}) {
  if (!entityId) return;
  const locale = options.locale || 'en';
  scheduleSearchIndexRemoval(toSearchEntityType(resource), entityId, locale);
  invalidateRelatedCaches();

  if (options.previous) {
    scheduleSeoChangeNotification({
      resource,
      previous: options.previous,
      action: 'delete',
      context: options.seoContext,
    });
  }
}

/**
 * After publish — sync workflow overlay + search index.
 * @param {string} resource
 * @param {string} entityId
 * @param {object} [actor]
 * @param {{ locale?: string; title?: string }} [options]
 */
export async function onContentPublished(resource, entityId, actor, options = {}) {
  if (!entityId) return;
  const locale = options.locale || 'en';
  await syncWorkflowPublished(resource, entityId, actor, options).catch(() => {});
  scheduleSearchIndexUpdate(toSearchEntityType(resource), entityId, locale);
  invalidateRelatedCaches();
}

/**
 * Bulk index update after bulk publish/modify.
 * @param {string} resource
 * @param {string[]} entityIds
 * @param {{ locale?: string }} [options]
 */
export function onContentBulkUpdated(resource, entityIds = [], options = {}) {
  const locale = options.locale || 'en';
  const searchType = toSearchEntityType(resource);
  for (const id of entityIds) {
    scheduleSearchIndexUpdate(searchType, id, locale);
  }
  const dynamicKey = CONTENT_TO_DYNAMIC_ENTITY[resource];
  if (dynamicKey) invalidateDynamicContentForEntity(dynamicKey);
  invalidateRelatedCaches();
}

/**
 * Bulk removal from search index.
 */
export function onContentBulkDeleted(resource, entityIds = [], options = {}) {
  const locale = options.locale || 'en';
  const searchType = toSearchEntityType(resource);
  for (const id of entityIds) {
    scheduleSearchIndexRemoval(searchType, id, locale);
  }
  invalidateRelatedCaches();
}

/**
 * Global block change → reindex referencing page layouts + clear dynamic cache.
 * @param {string} globalBlockId
 */
export async function onGlobalBlockMutated(globalBlockId) {
  await clearDynamicCache();
  const usage = await findGlobalBlockUsage(globalBlockId);
  for (const u of usage) {
    const layout = await CmsPageLayout.findOne({ pageKey: u.pageKey, locale: u.locale }).select('_id').lean();
    if (layout?._id) {
      scheduleSearchIndexUpdate('page-builder-page', layout._id, u.locale || 'en');
    }
  }
  invalidateRelatedCaches();
}

/**
 * Block template change → invalidate dynamic block cache.
 */
export async function onBlockTemplateMutated() {
  await clearDynamicCache();
  invalidateRelatedCaches();
}

/**
 * Career entity save — search index hooks only (C.8.0.2A).
 * @param {string} entityType - talent-profile | credential | assessment
 * @param {string|import('mongoose').Types.ObjectId} entityId
 * @param {{ locale?: string }} [options]
 */
export function onCareerEntitySaved(entityType, entityId, options = {}) {
  const searchType = CAREER_TO_SEARCH_ENTITY[entityType] || entityType;
  if (!entityId) return;
  const locale = options.locale || 'en';
  scheduleSearchIndexUpdate(searchType, String(entityId), locale);
  invalidateRelatedCaches();
}

/**
 * @param {string} entityType
 * @param {string|import('mongoose').Types.ObjectId} entityId
 * @param {{ locale?: string }} [options]
 */
export function onCareerEntityDeleted(entityType, entityId, options = {}) {
  const searchType = CAREER_TO_SEARCH_ENTITY[entityType] || entityType;
  if (!entityId) return;
  const locale = options.locale || 'en';
  scheduleSearchIndexRemoval(searchType, String(entityId), locale);
  invalidateRelatedCaches();
}
