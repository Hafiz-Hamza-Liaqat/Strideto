/**
 * SEO-P8 — first-party SEO metrics from AnalyticsEvent (ChatGPT, page groups, conversions).
 */
import { AnalyticsEvent } from '../../../models/AnalyticsEvent.js';
import { classifyChatGptAttribution } from '../../../../../shared/seo/measurement/chatgptAttribution.js';
import { classifyPageGroup } from '../../../../../shared/seo/measurement/pageGroups.js';
import { normalizeCanonicalPublicPath } from '../../../../../shared/seo/measurement/canonicalPath.js';
import { MEASUREMENT_STATE } from '../../../../../shared/seo/measurement/dataStates.js';

/**
 * @param {Date} start
 * @param {Date} end
 */
export async function aggregateChatGptReferralMetrics(start, end) {
  const match = {
    createdAt: { $gte: start, $lte: end },
    eventType: { $in: ['page_view', 'job_view', 'scholarship_view', 'admission_view', 'blog_view', 'cta_click', 'application_click'] },
  };

  const events = await AnalyticsEvent.find(match)
    .select('page sessionId metadata referrer createdAt eventType')
    .lean();

  if (!events.length) {
    return {
      state: MEASUREMENT_STATE.NO_DATA_AVAILABLE,
      sessions: null,
      landingPages: [],
      applicationClicks: null,
    };
  }

  const sessionSet = new Set();
  const landingCounts = new Map();
  let applicationClicks = 0;

  for (const event of events) {
    const meta = event.metadata || {};
    const utmSource = meta.acquisitionSource || meta.utm_source;
    const chatgpt = classifyChatGptAttribution({ utmSource, referrer: event.referrer });

    if (!chatgpt.isChatGpt) continue;

    if (event.sessionId) sessionSet.add(event.sessionId);

    const landing = meta.landingPage || normalizeCanonicalPublicPath(event.page);
    landingCounts.set(landing, (landingCounts.get(landing) || 0) + 1);

    if (event.eventType === 'application_click' || (event.eventType === 'cta_click' && meta.action === 'application')) {
      applicationClicks += 1;
    }
  }

  if (sessionSet.size === 0 && applicationClicks === 0) {
    return {
      state: MEASUREMENT_STATE.NO_DATA_AVAILABLE,
      sessions: 0,
      landingPages: [],
      applicationClicks: 0,
      sourceReportedZero: true,
    };
  }

  const landingPages = [...landingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([page, count]) => {
      const { pageGroup } = classifyPageGroup(page);
      return { page, count, pageGroup };
    });

  return {
    state: MEASUREMENT_STATE.VALID_DATA,
    sessions: sessionSet.size,
    landingPages,
    applicationClicks,
    sourceReportedZero: true,
  };
}

/**
 * @param {Date} start
 * @param {Date} end
 */
export async function aggregatePageGroupMetrics(start, end) {
  const events = await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        eventType: { $in: ['page_view', 'job_view', 'scholarship_view', 'admission_view', 'blog_view', 'career_view', 'page_builder_view'] },
      },
    },
    {
      $group: {
        _id: '$page',
        views: { $sum: 1 },
      },
    },
    { $sort: { views: -1 } },
    { $limit: 100 },
  ]);

  if (!events.length) {
    return { state: MEASUREMENT_STATE.NO_DATA_AVAILABLE, groups: [] };
  }

  const groupMap = new Map();
  for (const row of events) {
    const { pageGroup } = classifyPageGroup(row._id || '/');
    groupMap.set(pageGroup, (groupMap.get(pageGroup) || 0) + row.views);
  }

  const groups = [...groupMap.entries()]
    .map(([pageGroup, views]) => ({ pageGroup, views }))
    .sort((a, b) => b.views - a.views);

  return { state: MEASUREMENT_STATE.VALID_DATA, groups };
}
