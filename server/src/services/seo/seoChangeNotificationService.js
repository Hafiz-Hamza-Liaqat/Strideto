/**
 * SEO-P5 — lifecycle-driven SEO change notification orchestrator.
 *
 * Best-effort IndexNow acceleration; sitemap lastmod remains durable fallback.
 * Never blocks content publication on external API outcome.
 */
import { logger } from '../../utils/logger.js';
import { submitIndexNowUrls } from './indexNowService.js';
import {
  evaluateSeoChange,
  contentResourceToSeoEntity,
  SEO_ENTITY_TYPES,
  SEO_CHANGE_ACTION,
} from '../../../../shared/seo/freshnessPolicy.js';
import { Program } from '../../models/education/Program.js';
import { TestAcceptance } from '../../models/education/TestAcceptance.js';
import { currentAcceptanceMongoFilter } from '../../../../shared/publicDiscovery/publicTruth.js';
import { PUB_STATUSES } from '../../../../shared/education/taxonomy.js';
import { withFixtureExclusion } from '../../../../shared/publicDiscovery/fixtureExclusion.js';

const recentUrlSuppressMs = 3000;
const recentUrlCache = new Map();

function shouldSuppressRecentUrl(url) {
  const now = Date.now();
  const last = recentUrlCache.get(url);
  if (last && now - last < recentUrlSuppressMs) return true;
  recentUrlCache.set(url, now);
  if (recentUrlCache.size > 500) {
    const cutoff = now - recentUrlSuppressMs;
    for (const [key, ts] of recentUrlCache) {
      if (ts < cutoff) recentUrlCache.delete(key);
    }
  }
  return false;
}

async function resolveInstitutionContext(institution) {
  if (!institution?._id) {
    return { programCount: 0, acceptedTestCount: 0 };
  }
  const institutionId = institution._id;
  const [programCount, acceptedTestCount] = await Promise.all([
    Program.countDocuments(withFixtureExclusion({
      status: PUB_STATUSES.PUBLISHED,
      institutionId,
    })),
    TestAcceptance.countDocuments({
      institutionId,
      ...currentAcceptanceMongoFilter(),
    }),
  ]);
  return { programCount, acceptedTestCount };
}

function toPlainDoc(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === 'function') return doc.toObject();
  return doc;
}

/**
 * @param {{
 *   entityType?: string,
 *   resource?: string,
 *   previous?: object|null,
 *   next?: object|null,
 *   action?: 'save'|'delete',
 *   context?: object,
 * }} params
 */
export async function notifySeoChange({
  entityType,
  resource,
  previous = null,
  next = null,
  action = 'save',
  context = {},
}) {
  const resolvedType = entityType || contentResourceToSeoEntity(resource);
  if (!resolvedType) return { action: SEO_CHANGE_ACTION.NO_OP, urls: [] };

  let mergedContext = { ...context };
  const institutionDoc = resolvedType === SEO_ENTITY_TYPES.CANONICAL_INSTITUTION
    ? (next || previous)
    : null;
  if (institutionDoc && (mergedContext.programCount == null || mergedContext.acceptedTestCount == null)) {
    const counts = await resolveInstitutionContext(institutionDoc);
    mergedContext = { ...mergedContext, ...counts };
  }

  const prevPlain = toPlainDoc(previous);
  const nextPlain = toPlainDoc(next);
  const decision = evaluateSeoChange({
    entityType: resolvedType,
    previous: prevPlain,
    next: nextPlain,
    action,
    context: mergedContext,
  });

  if (!decision.urls?.length) {
    return decision;
  }

  const urls = decision.urls.filter((u) => !shouldSuppressRecentUrl(u));
  if (!urls.length) {
    return { ...decision, suppressed: true };
  }

  void submitIndexNowUrls(urls).catch((err) => {
    logger.warn('seo.indexnow.notify_error', { error: err?.message || 'unknown' });
  });

  return decision;
}

/**
 * Fire-and-forget wrapper for controllers — never throws to caller.
 */
export function scheduleSeoChangeNotification(params) {
  void notifySeoChange(params).catch((err) => {
    logger.warn('seo.change_notification_error', { error: err?.message || 'unknown' });
  });
}

export function resetSeoNotificationSuppressCacheForTests() {
  recentUrlCache.clear();
}
