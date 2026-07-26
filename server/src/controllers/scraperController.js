import { asyncHandler } from '../utils/asyncHandler.js';
import { runScraper, getScraperSources } from '../services/scraperService.js';
import { ScraperRun, resolveScraperErrorDetails } from '../models/ScraperRun.js';
import { ScraperConfig } from '../models/ScraperConfig.js';
import { SCRAPER_REGISTRY } from '../services/scrapers/index.js';

export const triggerScraper = asyncHandler(async (req, res) => {
  const onlySources = req.body?.sources && Array.isArray(req.body.sources) ? req.body.sources : null;
  const result = await runScraper({ onlySources });
  res.json({
    message: 'Scraper run completed',
    runId: result.run._id,
    jobsAdded: result.jobsAdded,
    admissionsAdded: result.admissionsAdded,
    jobsSkipped: result.jobsSkipped,
    status: result.run.status,
    durationMs: result.run.durationMs,
    errors: result.errors,
    errorDetails: result.errors,
  });
});

export const getScraperRuns = asyncHandler(async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const runs = await ScraperRun.find().sort({ runAt: -1 }).limit(limit).lean();
  const data = runs.map((run) => {
    const errorDetails = resolveScraperErrorDetails(run);
    const { errors: _legacy, ...rest } = run;
    return { ...rest, errorDetails, errors: errorDetails };
  });
  res.json({ data });
});

export const getScraperSourcesList = asyncHandler(async (_req, res) => {
  const sources = getScraperSources();
  res.json({ data: sources });
});

export const getScraperConfig = asyncHandler(async (_req, res) => {
  const configs = await ScraperConfig.find({}).lean();
  const byKey = Object.fromEntries(configs.map((c) => [c.sourceKey, c]));
  const list = Object.keys(SCRAPER_REGISTRY).map((key) => ({
    sourceKey: key,
    name: SCRAPER_REGISTRY[key].name,
    enabled: byKey[key]?.enabled ?? true,
    lastRunAt: byKey[key]?.lastRunAt,
    lastJobCount: byKey[key]?.lastJobCount ?? 0,
  }));
  res.json({ data: list });
});

export const updateScraperConfig = asyncHandler(async (req, res) => {
  const { sourceKey, enabled } = req.body;
  if (!sourceKey || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'sourceKey and enabled (boolean) required' });
  }
  const entry = SCRAPER_REGISTRY[sourceKey];
  if (!entry) return res.status(404).json({ error: 'Unknown scraper source' });
  const config = await ScraperConfig.findOneAndUpdate(
    { sourceKey },
    { $set: { enabled, name: entry.name } },
    { upsert: true, new: true }
  );
  res.json({ data: config });
});
