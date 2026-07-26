/**
 * Smart Job Scraper – runs modular scrapers with rate limiting, dedup, and config.
 */
import { Job } from '../models/Job.js';
import { ScraperRun } from '../models/ScraperRun.js';
import { ScraperConfig } from '../models/ScraperConfig.js';
import { jobSlug } from '../utils/slugify.js';
import { SCRAPER_REGISTRY, delay, RATE_LIMIT_DELAY_MS } from './scrapers/index.js';

function makeSlugUnique(baseSlug, existingSlugs, index = 0) {
  const slug = index === 0 ? baseSlug : `${baseSlug}-${index}`;
  if (existingSlugs.has(slug)) return makeSlugUnique(baseSlug, existingSlugs, index + 1);
  return slug;
}

/**
 * Get enabled source keys. If no config exists, all registry keys are enabled.
 */
async function getEnabledSourceKeys() {
  const configs = await ScraperConfig.find({ enabled: true }).select('sourceKey').lean();
  const configured = configs.map((c) => c.sourceKey);
  if (configured.length > 0) return configured;
  return Object.keys(SCRAPER_REGISTRY);
}

export async function runScraper(options = {}) {
  const { onlySources = null, skipAdmissions: _skipAdmissions = true } = options;
  const run = await ScraperRun.create({
    status: 'running',
    sources: onlySources || Object.keys(SCRAPER_REGISTRY),
    runAt: new Date(),
  });
  const start = Date.now();
  let jobsAdded = 0;
  let admissionsAdded = 0;
  let jobsSkipped = 0;
  const errors = [];

  const existingExternalIds = new Set((await Job.find({ externalId: { $exists: true, $ne: null } }).select('externalId').lean()).map((j) => j.externalId));
  const existingJobSlugs = new Set((await Job.find({}).select('slug').lean()).map((j) => j.slug));

  /** Duplicate rule: title + organization + deadline (used when externalId is missing) */
  async function isDuplicateByTitleOrgDeadline(title, organization, deadline) {
    const org = (organization || '').trim();
    const q = { title: (title || '').trim(), $or: [{ organization: org }, { company: org }] };
    if (deadline) q.deadline = deadline;
    else q.deadline = { $in: [null, undefined] };
    const existing = await Job.findOne(q).select('_id').lean();
    return !!existing;
  }

  const sourceKeys = onlySources && onlySources.length ? onlySources : await getEnabledSourceKeys();

  for (let i = 0; i < sourceKeys.length; i++) {
    const sourceKey = sourceKeys[i];
    if (i > 0) await delay(RATE_LIMIT_DELAY_MS);

    const entry = SCRAPER_REGISTRY[sourceKey];
    if (!entry || !entry.scrape) {
      errors.push(`${sourceKey}: scraper not found`);
      continue;
    }

    try {
      const jobs = await entry.scrape();
      if (!Array.isArray(jobs)) continue;

      for (const j of jobs) {
        if (j.externalId && existingExternalIds.has(j.externalId)) {
          jobsSkipped++;
          continue;
        }
        if (!j.externalId && (await isDuplicateByTitleOrgDeadline(j.title, j.organization || j.company, j.deadline))) {
          jobsSkipped++;
          continue;
        }
        const baseSlug = jobSlug(j.title, j.province || j.location || '');
        const slug = makeSlugUnique(baseSlug, existingJobSlugs);
        existingJobSlugs.add(slug);
        if (j.externalId) existingExternalIds.add(j.externalId);

        await Job.create({
          title: j.title,
          slug,
          company: j.company || j.organization,
          organization: j.organization,
          location: j.location,
          province: j.province,
          city: j.city,
          jobType: j.jobType || 'Private',
          educationRequirement: j.educationRequirement,
          experience: j.experience,
          deadline: j.deadline,
          applicationLink: j.applicationLink,
          sourceUrl: j.sourceUrl,
          sourceWebsite: j.sourceWebsite,
          externalId: j.externalId,
          description: j.description,
          category: j.category,
          type: 'full-time',
          applyType: 'external',
          status: 'active',
          source: 'scraper',
          scrapedAt: new Date(),
          approvalStatus: 'approved',
        });
        jobsAdded++;
      }

      await ScraperConfig.findOneAndUpdate(
        { sourceKey },
        { $set: { lastRunAt: new Date(), lastJobCount: jobs.length } },
        { upsert: true }
      );
    } catch (err) {
      errors.push(`${sourceKey}: ${err.message}`);
    }
  }

  run.status = errors.length === 0 ? 'success' : 'partial';
  run.jobsAdded = jobsAdded;
  run.admissionsAdded = admissionsAdded;
  run.jobsSkipped = jobsSkipped;
  run.errorDetails = errors;
  run.durationMs = Date.now() - start;
  await run.save();

  return { run, jobsAdded, admissionsAdded, jobsSkipped, errors };
}

export function getScraperSources() {
  return Object.entries(SCRAPER_REGISTRY).map(([key, v]) => ({ key, name: v.name }));
}
