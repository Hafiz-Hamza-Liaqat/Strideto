/**
 * SEO-P8 — KPI taxonomy grouped by measurement category.
 */

export const KPI_CATEGORY = Object.freeze({
  SEARCH_DISCOVERY: 'search_discovery',
  AI_VISIBILITY: 'ai_visibility',
  ACQUISITION: 'acquisition',
  ENGAGEMENT_CONVERSION: 'engagement_conversion',
  CONTENT_PERFORMANCE: 'content_performance',
  TECHNICAL_HEALTH: 'technical_health',
  FRESHNESS_OPERATIONS: 'freshness_operations',
});

/** @type {Record<string, { id: string, category: string, unit: string, source: string, automated: boolean, manual: boolean }>} */
export const KPI_DEFINITIONS = Object.freeze({
  google_impressions: {
    id: 'google_impressions',
    category: KPI_CATEGORY.SEARCH_DISCOVERY,
    unit: 'impressions',
    source: 'google_search_console_traditional',
    automated: true,
    manual: false,
  },
  google_clicks: {
    id: 'google_clicks',
    category: KPI_CATEGORY.SEARCH_DISCOVERY,
    unit: 'clicks',
    source: 'google_search_console_traditional',
    automated: true,
    manual: false,
  },
  google_ctr: {
    id: 'google_ctr',
    category: KPI_CATEGORY.SEARCH_DISCOVERY,
    unit: 'ratio',
    source: 'google_search_console_traditional',
    automated: true,
    manual: false,
  },
  google_avg_position: {
    id: 'google_avg_position',
    category: KPI_CATEGORY.SEARCH_DISCOVERY,
    unit: 'position',
    source: 'google_search_console_traditional',
    automated: true,
    manual: false,
  },
  google_genai_impressions: {
    id: 'google_genai_impressions',
    category: KPI_CATEGORY.AI_VISIBILITY,
    unit: 'impressions',
    source: 'google_search_console_generative_ai_report',
    automated: false,
    manual: true,
  },
  google_genai_visible_pages: {
    id: 'google_genai_visible_pages',
    category: KPI_CATEGORY.AI_VISIBILITY,
    unit: 'pages',
    source: 'google_search_console_generative_ai_report',
    automated: false,
    manual: true,
  },
  bing_impressions: {
    id: 'bing_impressions',
    category: KPI_CATEGORY.SEARCH_DISCOVERY,
    unit: 'impressions',
    source: 'bing_webmaster_search_performance',
    automated: true,
    manual: false,
  },
  bing_clicks: {
    id: 'bing_clicks',
    category: KPI_CATEGORY.SEARCH_DISCOVERY,
    unit: 'clicks',
    source: 'bing_webmaster_search_performance',
    automated: true,
    manual: false,
  },
  bing_ai_total_citations: {
    id: 'bing_ai_total_citations',
    category: KPI_CATEGORY.AI_VISIBILITY,
    unit: 'citations',
    source: 'bing_webmaster_ai_performance',
    automated: false,
    manual: true,
  },
  bing_ai_avg_cited_pages: {
    id: 'bing_ai_avg_cited_pages',
    category: KPI_CATEGORY.AI_VISIBILITY,
    unit: 'pages_per_answer',
    source: 'bing_webmaster_ai_performance',
    automated: false,
    manual: true,
  },
  chatgpt_referral_sessions: {
    id: 'chatgpt_referral_sessions',
    category: KPI_CATEGORY.ACQUISITION,
    unit: 'sessions',
    source: 'first_party_analytics_utm_chatgpt',
    automated: true,
    manual: false,
  },
  application_clicks: {
    id: 'application_clicks',
    category: KPI_CATEGORY.ENGAGEMENT_CONVERSION,
    unit: 'events',
    source: 'first_party_analytics',
    automated: true,
    manual: false,
  },
  page_group_sessions: {
    id: 'page_group_sessions',
    category: KPI_CATEGORY.CONTENT_PERFORMANCE,
    unit: 'sessions',
    source: 'first_party_analytics',
    automated: true,
    manual: false,
  },
  sitemap_availability: {
    id: 'sitemap_availability',
    category: KPI_CATEGORY.TECHNICAL_HEALTH,
    unit: 'status',
    source: 'operational_probe',
    automated: true,
    manual: false,
  },
  indexnow_operational: {
    id: 'indexnow_operational',
    category: KPI_CATEGORY.FRESHNESS_OPERATIONS,
    unit: 'status',
    source: 'operational_config',
    automated: true,
    manual: false,
  },
});

export function listKpisByCategory(category) {
  return Object.values(KPI_DEFINITIONS).filter((k) => k.category === category);
}
