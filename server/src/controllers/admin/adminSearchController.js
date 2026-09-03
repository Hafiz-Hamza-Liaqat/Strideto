import { asyncHandler } from '../../utils/asyncHandler.js';
import { validateSearchQuery, parseSearchParams } from '../../../../shared/search/validation.js';
import { searchIndex, getIndexStats, logSearchQuery } from '../../services/search/SearchIndexService.js';
import { SearchIndexer } from '../../services/search/SearchIndexer.js';

export const adminSearch = asyncHandler(async (req, res) => {
  const params = parseSearchParams({ ...req.query, includeDraft: 'true' });
  const errors = validateSearchQuery(req.query, { allowEmpty: true });
  if (errors.length) {
    return res.status(400).json({ error: 'Invalid search query', details: errors });
  }

  const started = Date.now();
  const result = await searchIndex({ ...params, q: params.q || '' }, { admin: true });
  const elapsed = Date.now() - started;

  void logSearchQuery({
    query: params.q,
    locale: params.locale,
    entityTypes: params.types,
    resultCount: result.total,
    responseTimeMs: elapsed,
    source: 'admin',
    userId: req.user?.userId,
  });

  res.json({ ...result, elapsedTime: elapsed });
});

export const adminReindex = asyncHandler(async (req, res) => {
  const { entityType } = req.body || {};
  const dryRun = req.body?.dryRun === true;
  const results = entityType
    ? [await SearchIndexer.rebuildEntityType(entityType, { dryRun })]
    : await SearchIndexer.rebuildAll({ dryRun });
  const failed = results.reduce((count, result) => count + (result.failed || 0), 0);
  res.json({
    ok: results.every((result) => result.ok !== false),
    dryRun,
    failed,
    results,
  });
});

export const adminIndexStats = asyncHandler(async (_req, res) => {
  const stats = await getIndexStats();
  res.json(stats);
});
