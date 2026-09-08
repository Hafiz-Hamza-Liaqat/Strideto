/**
 * Related content engine (C.7.0.4). No UI coupling.
 */
import { SearchDocument } from '../../models/SearchDocument.js';
import { rankSearchResults } from '../../../../shared/search/scoring.js';
import { withLaunchSearchFilter } from '../../../../shared/publicDiscovery/fixtureExclusion.js';
import { Job } from '../../models/Job.js';
import { buildPublicJobMongoFilter } from '../../../../shared/publicDiscovery/publicTruth.js';

/**
 * @param {{
 *   entityType: string;
 *   entityId: string;
 *   locale?: string;
 *   limit?: number;
 * }} input
 */
export async function findRelatedContent(input) {
  const { entityType, entityId, locale = 'en', limit = 6 } = input;
  const source = await SearchDocument.findOne({ entityType, entityId, locale }).lean();
  if (!source) return { items: [], total: 0 };

  const or = [];
  if (source.category) or.push({ category: source.category });
  if (source.province) or.push({ province: source.province });
  if (source.country) or.push({ country: source.country });
  if (source.tags?.length) or.push({ tags: { $in: source.tags } });
  if (source.keywords?.length) or.push({ keywords: { $in: source.keywords } });

  if (!or.length) {
    or.push({ entityType: source.entityType });
  }

  const filter = withLaunchSearchFilter({
    searchable: true,
    status: { $in: ['active', 'published'] },
    locale,
    entityId: { $ne: entityId },
    $or: or,
  });

  let candidates = await SearchDocument.find(filter).limit(50).lean();
  const jobIds = candidates.filter((doc) => doc.entityType === 'job').map((doc) => doc.entityId);
  if (jobIds.length) {
    const visibleJobs = await Job.find({ ...buildPublicJobMongoFilter(), _id: { $in: jobIds } }).select('_id').lean();
    const visibleIds = new Set(visibleJobs.map((doc) => String(doc._id)));
    candidates = candidates.filter((doc) => doc.entityType !== 'job' || visibleIds.has(String(doc.entityId)));
  }
  const query = [source.title, source.category, ...(source.tags || [])].filter(Boolean).join(' ');
  const ranked = rankSearchResults(candidates, query, 'relevance').slice(0, limit);

  return {
    items: ranked.map((doc) => ({
      id: doc.entityId,
      entityType: doc.entityType,
      title: doc.title,
      url: doc.url,
      summary: doc.summary,
      score: doc._score,
    })),
    total: ranked.length,
  };
}

export class RelatedContentService {
  static findRelated = findRelatedContent;
}
