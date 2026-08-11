import { asyncHandler } from '../utils/asyncHandler.js';
import { validateSearchQuery, parseSearchParams } from '../../../shared/search/validation.js';
import { clampPublicSearchTypes } from '../../../shared/platform/searchPrivacyPolicy.js';
import {
  searchIndex,
  searchSuggestions,
  logSearchQuery,
  logSearchClick,
} from '../services/search/SearchIndexService.js';
import { findRelatedContent } from '../services/search/RelatedContentService.js';

export const getSearch = asyncHandler(async (req, res) => {
  const params = parseSearchParams(req.query);
  params.includeDraft = false;
  const errors = validateSearchQuery(req.query);
  if (errors.length) return res.status(400).json({ error: 'Invalid search query', details: errors });
  if (params.types?.length) {
    const clamped = clampPublicSearchTypes(params.types);
    if (clamped.denied.length) {
      return res.status(400).json({
        error: 'Invalid search query',
        details: clamped.denied.map((t) => `Search domain denied: ${t}`),
      });
    }
    params.types = clamped.allowed;
  }

  const started = Date.now();
  const result = await searchIndex(params);
  const elapsed = Date.now() - started;

  void logSearchQuery({
    query: params.q,
    locale: params.locale,
    entityTypes: params.types,
    resultCount: result.total,
    responseTimeMs: elapsed,
    source: 'public',
    ipHash: String(req.ip || '').slice(0, 64),
  });

  res.json({ ...result, elapsedTime: elapsed });
});

export const getSuggestions = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q || q.length < 2) {
    return res.json({ query: q, groups: {}, elapsedTime: 0 });
  }

  const started = Date.now();
  const result = await searchSuggestions(q, { locale: req.query.locale || 'en' });
  const elapsed = Date.now() - started;

  void logSearchQuery({
    query: q,
    locale: req.query.locale || 'en',
    resultCount: Object.values(result.groups).reduce((n, g) => n + g.length, 0),
    responseTimeMs: elapsed,
    source: 'suggestions',
    ipHash: String(req.ip || '').slice(0, 64),
  });

  res.json({ ...result, elapsedTime: elapsed });
});

export const postSearchClick = asyncHandler(async (req, res) => {
  const { query, entityType, entityId, url } = req.body || {};
  void logSearchClick({
    query: String(query || ''),
    clickedResult: { entityType, entityId, url },
    source: 'public',
    userId: req.user?.userId,
  });
  res.json({ ok: true });
});

export const getRelated = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const limit = Math.min(12, Number(req.query.limit) || 6);
  const result = await findRelatedContent({
    entityType,
    entityId,
    locale: req.query.locale || 'en',
    limit,
  });
  res.json(result);
});
