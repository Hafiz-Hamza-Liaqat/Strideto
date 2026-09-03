/**
 * Canonical search index service (C.7.0.4).
 */
import { SearchDocument } from '../../models/SearchDocument.js';
import { SearchQueryLog } from '../../models/SearchQueryLog.js';
import { rankSearchResults } from '../../../../shared/search/scoring.js';
import { isPublicSearchable } from '../../../../shared/search/searchDocument.js';
import { PUBLIC_SEARCH_ENTITY_TYPES, SUGGESTION_ENTITY_TYPES } from '../../../../shared/search/entityTypes.js';
import { isSearchDomainAllowed, clampPublicSearchTypes } from '../../../../shared/platform/searchPrivacyPolicy.js';
import { publicSearchMetadata } from '../../../../shared/publicDiscovery/projectPublicDiscovery.js';
import { SEARCH_SUGGESTION_LIMIT } from '../../../../shared/search/rankingWeights.js';
import {
  buildSearchCacheKey,
  searchCacheGet,
  searchCacheInvalidatePrefix,
  searchCacheSet,
} from './searchCache.js';
import { withLaunchSearchFilter } from '../../../../shared/publicDiscovery/fixtureExclusion.js';
import { resolveSearchIntent, LOCATION_ALIASES } from '../../../../shared/search/queryIntent.js';

function buildMongoFilter(params) {
  const filter = {};
  if (!params.includeDraft) {
    filter.searchable = true;
    filter.status = { $in: ['active', 'published'] };
  }
  if (params.locale) filter.locale = params.locale;
  if (params.types?.length) filter.entityType = { $in: params.types };
  if (params.category) filter.category = new RegExp(params.category, 'i');
  if (params.province) filter.province = new RegExp(params.province, 'i');
  if (params.country) filter.country = new RegExp(params.country, 'i');
  if (params.featured) filter.featured = true;
  return withLaunchSearchFilter(filter);
}

function buildTextFilter(q) {
  if (!q) return {};
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return {
    $or: [
      { title: re },
      { slug: re },
      { summary: re },
      { searchText: re },
      { tags: re },
      { keywords: re },
      { category: re },
      { province: re },
      { country: re },
    ],
  };
}

function buildLocationFilter(locationText, aliases = []) {
  const terms = aliases.length ? aliases : [locationText];
  const re = new RegExp(terms.map((term) => String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
  if (LOCATION_ALIASES.has(String(locationText || '').toLowerCase())) {
    return { country: re };
  }
  return {
    $or: [
      { country: re },
      { province: re },
      { summary: re },
      { searchText: re },
      { tags: re },
      { keywords: re },
    ],
  };
}

function toResultDto(doc, { publicProjection = true } = {}) {
  return {
    id: doc.entityId,
    entityType: doc.entityType,
    title: doc.title,
    slug: doc.slug,
    url: doc.url,
    summary: doc.summary,
    category: doc.category,
    province: doc.province,
    country: doc.country,
    tags: doc.tags,
    featured: doc.featured,
    publishedAt: doc.publishedAt,
    updatedAt: doc.updatedAt,
    status: doc.status,
    metadata: publicProjection ? publicSearchMetadata(doc.metadata) : doc.metadata,
    score: doc._score,
  };
}

function buildFacets(docs) {
  const facets = {
    entityType: {},
    category: {},
    province: {},
    country: {},
  };
  for (const doc of docs) {
    if (doc.entityType) facets.entityType[doc.entityType] = (facets.entityType[doc.entityType] || 0) + 1;
    if (doc.category) facets.category[doc.category] = (facets.category[doc.category] || 0) + 1;
    if (doc.province) facets.province[doc.province] = (facets.province[doc.province] || 0) + 1;
    if (doc.country) facets.country[doc.country] = (facets.country[doc.country] || 0) + 1;
  }
  return facets;
}

/**
 * @param {ReturnType<import('../../../../shared/search/validation.js').parseSearchParams>} params
 * @param {object} [options]
 */
export async function searchIndex(params, options = {}) {
  const started = Date.now();
  const intent = !params.types?.length ? resolveSearchIntent(params.q) : null;
  const cacheKey = buildSearchCacheKey({
    ...params,
    inferredTypes: intent?.entityTypes || [],
    mode: options.admin ? 'admin' : 'public',
  });
  const cached = await searchCacheGet(cacheKey);
  if (cached) return { ...cached, elapsedTime: Date.now() - started, cached: true };

  const filter = { ...buildMongoFilter(params) };
  if (intent?.contextual) {
    const contextualFilters = [];
    if (intent.locationText && !params.country) contextualFilters.push(buildLocationFilter(intent.locationText, intent.locationAliases));
    if (intent.roleQuery) contextualFilters.push(buildTextFilter(intent.roleQuery));
    if (contextualFilters.length) filter.$and = contextualFilters;
  } else if (!intent?.entityTypes) Object.assign(filter, buildTextFilter(params.q));

  let types = params.types?.length ? params.types : (intent?.entityTypes || null);
  if (!types) types = options.admin ? null : PUBLIC_SEARCH_ENTITY_TYPES;
  if (!options.admin && types?.length) {
    types = clampPublicSearchTypes(types).allowed;
    if (!types.length) types = PUBLIC_SEARCH_ENTITY_TYPES;
  }
  if (types) filter.entityType = { $in: types };
  if (!options.admin) {
    params.includeDraft = false;
    filter.searchable = true;
    filter.status = { $in: ['active', 'published'] };
  }

  const candidates = await SearchDocument.find(filter).limit(500).lean();
  const rankingQuery = intent?.contextual
    ? (intent.roleQuery || (params.country ? '' : intent.locationText))
    : (intent?.entityTypes ? '' : params.q);
  const ranked = rankingQuery
    ? rankSearchResults(candidates, rankingQuery, params.sort)
    : rankSearchResults(candidates, '', params.sort === 'relevance' ? 'newest' : params.sort);
  const total = ranked.length;
  const pageResults = ranked.slice(params.skip, params.skip + params.limit)
    .map((doc) => toResultDto(doc, { publicProjection: !options.admin }));
  const facets = buildFacets(ranked);

  const payload = {
    results: pageResults,
    facets,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
    total,
    elapsedTime: Date.now() - started,
    cached: false,
  };

  await searchCacheSet(cacheKey, payload);
  return payload;
}

/**
 * @param {string} q
 * @param {object} [options]
 */
export async function searchSuggestions(q, options = {}) {
  const explicitTypes = Array.isArray(options.types) ? options.types.filter(Boolean) : [];
  const intent = explicitTypes.length ? null : resolveSearchIntent(q, { includeNavigation: true });
  const params = {
    q,
    types: explicitTypes.length ? explicitTypes : SUGGESTION_ENTITY_TYPES,
    locale: options.locale || 'en',
    limit: SEARCH_SUGGESTION_LIMIT * SUGGESTION_ENTITY_TYPES.length,
    page: 1,
    skip: 0,
    sort: 'relevance',
    includeDraft: false,
    featured: false,
    category: '',
    province: options.province || '',
    country: options.country || '',
  };

  const filter = { ...buildMongoFilter(params) };
  if (intent?.contextual) {
    const contextualFilters = [];
    if (intent.locationText && !params.country) contextualFilters.push(buildLocationFilter(intent.locationText, intent.locationAliases));
    if (intent.roleQuery) contextualFilters.push(buildTextFilter(intent.roleQuery));
    if (contextualFilters.length) filter.$and = contextualFilters;
  } else if (!intent?.entityTypes) Object.assign(filter, buildTextFilter(q));
  filter.entityType = { $in: intent?.entityTypes || (explicitTypes.length ? explicitTypes : SUGGESTION_ENTITY_TYPES) };

  const candidates = await SearchDocument.find(filter).limit(100).lean();
  const rankingQuery = intent?.contextual
    ? (intent.roleQuery || (params.country ? '' : intent.locationText))
    : (intent?.entityTypes ? '' : q);
  const ranked = rankSearchResults(candidates, rankingQuery, 'relevance');

  /** @type {Record<string, object[]>} */
  const groups = {};
  for (const type of SUGGESTION_ENTITY_TYPES) groups[type] = [];

  for (const doc of ranked) {
    const list = groups[doc.entityType];
    if (list && list.length < SEARCH_SUGGESTION_LIMIT) {
      list.push(toResultDto({ ...doc, _score: doc._score }));
    }
  }

  return { query: q, groups, quickLinks: intent?.navigation ? [intent.navigation] : [], elapsedTime: 0 };
}

/**
 * @param {object} normalizedDoc
 */
export async function upsertSearchDocument(normalizedDoc, options = {}) {
  if (!normalizedDoc?.entityType || !normalizedDoc?.entityId) return null;
  if (!isSearchDomainAllowed(normalizedDoc.entityType, 'public')) {
    return null;
  }

  const SearchDocumentModel = options.SearchDocumentModel || SearchDocument;
  const invalidate = options.invalidateCache || searchCacheInvalidatePrefix;

  const doc = await SearchDocumentModel.findOneAndUpdate(
    {
      entityType: normalizedDoc.entityType,
      entityId: normalizedDoc.entityId,
      locale: normalizedDoc.locale || 'en',
    },
    {
      $set: {
        title: normalizedDoc.title,
        slug: normalizedDoc.slug,
        url: normalizedDoc.url,
        summary: normalizedDoc.summary,
        keywords: normalizedDoc.keywords,
        category: normalizedDoc.category,
        province: normalizedDoc.province,
        country: normalizedDoc.country,
        tags: normalizedDoc.tags,
        publishedAt: normalizedDoc.publishedAt ? new Date(normalizedDoc.publishedAt) : undefined,
        updatedAt: normalizedDoc.updatedAt ? new Date(normalizedDoc.updatedAt) : new Date(),
        featured: normalizedDoc.featured,
        status: normalizedDoc.status,
        searchable: normalizedDoc.searchable,
        metadata: normalizedDoc.metadata,
        searchText: normalizedDoc.searchText,
        indexedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  await invalidate('');
  return doc;
}

export async function deleteSearchDocument(entityType, entityId, locale = 'en', options = {}) {
  const SearchDocumentModel = options.SearchDocumentModel || SearchDocument;
  const invalidate = options.invalidateCache || searchCacheInvalidatePrefix;
  await SearchDocumentModel.deleteOne({ entityType, entityId, locale });
  await invalidate('');
}

export async function logSearchQuery({
  query,
  locale = 'en',
  entityTypes = [],
  resultCount = 0,
  responseTimeMs = 0,
  source = 'public',
  userId = null,
  ipHash = '',
}) {
  try {
    await SearchQueryLog.create({
      query,
      locale,
      entityTypes,
      resultCount,
      responseTimeMs,
      source,
      userId,
      ipHash,
    });
  } catch {
    // analytics must not break search
  }
}

export async function logSearchClick({
  query,
  clickedResult,
  source = 'public',
  userId = null,
}) {
  try {
    await SearchQueryLog.create({
      query,
      clickedResult,
      source,
      userId,
      resultCount: 0,
    });
  } catch { /* ignore */ }
}

export async function getIndexStats() {
  const total = await SearchDocument.countDocuments();
  const byType = await SearchDocument.aggregate([
    { $group: { _id: '$entityType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return { total, byType };
}

export { isPublicSearchable };
