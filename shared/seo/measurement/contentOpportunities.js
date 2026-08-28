/**
 * SEO-P8 — deterministic content opportunity recommendations (advisory only).
 */
export const OPPORTUNITY_PRIORITY = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

export const OPPORTUNITY_TYPE = Object.freeze({
  HIGH_IMPRESSIONS_LOW_CTR: 'HIGH_IMPRESSIONS_LOW_CTR',
  DECLINING_IMPRESSIONS: 'DECLINING_IMPRESSIONS',
  AI_CITED_LOW_TRAFFIC: 'AI_CITED_BUT_LOW_TRAFFIC',
  CHATGPT_TRAFFIC_NO_CONVERSION: 'CHATGPT_TRAFFIC_HIGH_NO_CONVERSION',
});

/**
 * @param {object} input
 * @returns {Array<{ type: string, priority: string, reason: string }>}
 */
export function deriveContentOpportunities(input = {}) {
  const opportunities = [];
  const {
    impressions,
    ctr,
    impressionTrend,
    aiCitations,
    referralSessions,
    applicationClicks,
    isImportantPage,
  } = input;

  if (impressions >= 1000 && ctr !== null && ctr < 0.02) {
    opportunities.push({
      type: OPPORTUNITY_TYPE.HIGH_IMPRESSIONS_LOW_CTR,
      priority: isImportantPage ? OPPORTUNITY_PRIORITY.HIGH : OPPORTUNITY_PRIORITY.MEDIUM,
      reason: 'High impressions with materially low CTR — review title/meta relevance.',
    });
  }

  if (impressionTrend === 'decrease' && impressions >= 100) {
    opportunities.push({
      type: OPPORTUNITY_TYPE.DECLINING_IMPRESSIONS,
      priority: isImportantPage ? OPPORTUNITY_PRIORITY.HIGH : OPPORTUNITY_PRIORITY.MEDIUM,
      reason: 'Declining impressions on a tracked page — inspect freshness, indexing, and content.',
    });
  }

  if (aiCitations > 0 && (referralSessions === 0 || referralSessions === null)) {
    opportunities.push({
      type: OPPORTUNITY_TYPE.AI_CITED_LOW_TRAFFIC,
      priority: OPPORTUNITY_PRIORITY.LOW,
      reason: 'AI citation visibility exists without comparable referral traffic — not necessarily a failure.',
    });
  }

  if (referralSessions >= 10 && applicationClicks === 0) {
    opportunities.push({
      type: OPPORTUNITY_TYPE.CHATGPT_TRAFFIC_NO_CONVERSION,
      priority: OPPORTUNITY_PRIORITY.MEDIUM,
      reason: 'ChatGPT-attributed sessions without downstream application clicks — inspect landing-task alignment.',
    });
  }

  return opportunities;
}
