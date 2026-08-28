/**
 * SEO-P8 — Measurement, AI visibility, referral attribution, KPI monitoring.
 *
 * Run: node server/src/__tests__/seoP8MeasurementContinuousOptimization.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  MEASUREMENT_STATE,
  TREND_DIRECTION,
  formatMetricValue,
  resolveNumericMetricState,
} from '../../../shared/seo/measurement/dataStates.js';
import {
  normalizeCanonicalPublicPath,
  analyzePublicUrl,
} from '../../../shared/seo/measurement/canonicalPath.js';
import {
  PAGE_GROUP,
  classifyPageGroup,
} from '../../../shared/seo/measurement/pageGroups.js';
import {
  CHATGPT_UTM_SOURCE,
  normalizeUtmSource,
  isChatGptUtmSource,
  isChatGptReferrerHost,
  classifyChatGptAttribution,
  isLooseAiSourceMisclassification,
} from '../../../shared/seo/measurement/chatgptAttribution.js';
import {
  extractApprovedAttributionParams,
  buildLandingAttributionMetadata,
} from '../../../shared/seo/measurement/landingAttribution.js';
import {
  compareTrend,
  resolveComparisonDateRanges,
} from '../../../shared/seo/measurement/trendComparison.js';
import {
  KPI_CATEGORY,
  KPI_DEFINITIONS,
  listKpisByCategory,
} from '../../../shared/seo/measurement/kpiTaxonomy.js';
import {
  OPPORTUNITY_TYPE,
  deriveContentOpportunities,
} from '../../../shared/seo/measurement/contentOpportunities.js';
import {
  resolveGoogleGenAiMetric,
  resolveGoogleGenAiSnapshotState,
} from '../../../shared/seo/measurement/genaiMetricPolicy.js';
import { validateManualSeoSnapshotInput } from '../../../shared/seo/measurement/snapshotValidation.js';
import { hasPermission, PERMISSIONS, ROLES } from '../config/rbac.js';
import { readGscConfig, getGoogleGenAiApiAvailability, GSC_READONLY_SCOPE } from '../services/seo/measurement/gscConfig.js';
import { getGscConnectionStatus } from '../services/seo/measurement/gscSearchAnalyticsService.js';
import {
  readBingWebmasterConfig,
  getBingAiPerformanceApiAvailability,
  BING_WEBMASTER_REST_BASE,
} from '../services/seo/measurement/bingWebmasterConfig.js';
import { getBingConnectionStatus } from '../services/seo/measurement/bingSearchStatsService.js';
import { getSeoTechnicalHealth } from '../services/seo/measurement/seoTechnicalHealthService.js';
import { createServiceAccountAssertion } from '../services/seo/measurement/gscAuth.js';
import { ANALYTICS_EVENT_TYPES } from '../../../shared/analytics/eventTypes.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '../../..');
const read = (rel) => readFileSync(path.join(repo, rel), 'utf8');

const p8Doc = read('docs/SEO_P8_MEASUREMENT_CONTINUOUS_OPTIMIZATION.md');
const adminRoutes = read('server/src/routes/admin.js');
const platformAnalytics = read('client/src/utils/platformAnalytics.js');
const jobDetail = read('client/src/pages/Jobs/JobDetail.jsx');
const scholarshipDetail = read('client/src/pages/Scholarships/ScholarshipDetail.jsx');
const adminSeoPage = read('client/src/pages/Admin/AdminSeoMeasurement.jsx');
const gscService = read('server/src/services/seo/measurement/gscSearchAnalyticsService.js');
const bingConfig = read('server/src/services/seo/measurement/bingWebmasterConfig.js');
const measurementService = read('server/src/services/seo/measurement/seoMeasurementService.js');

// --- Data states (SEO-P8-KPI) ---
check(formatMetricValue(0, MEASUREMENT_STATE.NOT_CONFIGURED) === null, 'SEO-P8-KPI-01: unavailable not shown as zero');
check(resolveNumericMetricState(null, { hasSource: false }) === MEASUREMENT_STATE.NOT_CONFIGURED, 'SEO-P8-KPI-01b: not configured');
check(resolveNumericMetricState(0, { hasSource: true, sourceReportedZero: true }) === MEASUREMENT_STATE.ZERO, 'SEO-P8-KPI-01c: explicit zero distinct');
check(compareTrend(2, 0).direction === TREND_DIRECTION.NEW_ACTIVITY, 'SEO-P8-KPI-02: previous zero avoids divide-by-zero');
check(compareTrend(2, 1).rawCurrent === 2 && compareTrend(2, 1).rawPrevious === 1, 'SEO-P8-KPI-03: raw values retained');
check(compareTrend(5, 10, { lowerIsBetter: true }).direction === TREND_DIRECTION.INCREASE, 'SEO-P8-KPI-04: avg position direction');
check(compareTrend(1, 2).direction === TREND_DIRECTION.INSUFFICIENT_DATA, 'SEO-P8-KPI-07: low volume safety');
check(!p8Doc.includes('SEO Score:'), 'SEO-P8-KPI-10: no fake universal SEO score');

// --- Trend ---
const ranges = resolveComparisonDateRanges('28d', new Date('2026-08-29T12:00:00Z'));
check(ranges.days === 28, 'SEO-P8: 28d comparison range');
check(ranges.current.end > ranges.current.start, 'SEO-P8: current range valid');

// --- Page groups (SEO-P8-GROUP) ---
check(classifyPageGroup('/jobs/example').pageGroup === PAGE_GROUP.JOB_DETAIL, 'SEO-P8-GROUP-01: job detail');
check(classifyPageGroup('/scholarships/foo').pageGroup === PAGE_GROUP.SCHOLARSHIP_DETAIL, 'SEO-P8-GROUP-02: scholarship detail');
check(classifyPageGroup('/schools-and-colleges/mit').pageGroup === PAGE_GROUP.INSTITUTION_DETAIL, 'SEO-P8-GROUP-03: institution detail');
check(classifyPageGroup('/programs/cs-ms').pageGroup === PAGE_GROUP.PROGRAM_DETAIL, 'SEO-P8-GROUP-04: program detail');
check(classifyPageGroup('/blog/my-post').pageGroup === PAGE_GROUP.BLOG_ARTICLE, 'SEO-P8-GROUP-05: blog article');
check(classifyPageGroup('/students').pageGroup === PAGE_GROUP.STUDENTS_PERSONA, 'SEO-P8-GROUP-06: persona page');
check(classifyPageGroup('/jobs?search=engineer').pageGroup === PAGE_GROUP.FACET_LANDING, 'SEO-P8-GROUP-07: facet not approved landing');
check(!classifyPageGroup('/admin/jobs').isApprovedLanding, 'SEO-P8-GROUP-08: private dashboard excluded');
check(classifyPageGroup('/unknown-path-xyz').pageGroup === PAGE_GROUP.OTHER_PUBLIC, 'SEO-P8-GROUP-09: unknown route');

// --- Canonical path ---
check(normalizeCanonicalPublicPath('/jobs/') === '/jobs', 'SEO-P8: trailing slash normalized');
check(analyzePublicUrl('/jobs?utm_source=chatgpt.com').hasTrackingParams, 'SEO-P8: tracking params detected');
check(!analyzePublicUrl('/jobs/engineer').hasFacetParams, 'SEO-P8: clean path no facet');

// --- ChatGPT (SEO-P8-CGPT) ---
check(isChatGptUtmSource('chatgpt.com'), 'SEO-P8-CGPT-01: utm_source recognized');
check(isChatGptUtmSource('ChatGPT.com'), 'SEO-P8-CGPT-02: case normalized');
check(!isChatGptUtmSource('www.chatgpt.com'), 'SEO-P8-CGPT-STRICT-03: www not official UTM');
check(!isChatGptUtmSource('google'), 'SEO-P8-CGPT-03: google not ChatGPT');
check(!isChatGptUtmSource('my-ai-tool'), 'SEO-P8-CGPT-04: generic ai not ChatGPT');
check(isLooseAiSourceMisclassification('openai-tools'), 'SEO-P8-CGPT-04b: loose ai detectable');
const landing = buildLandingAttributionMetadata('/jobs/foo', '?utm_source=chatgpt.com&utm_medium=search&token=secret');
check(landing.chatgptAttributed && landing.acquisitionSource === 'chatgpt', 'SEO-P8-CGPT-01b: landing metadata');
check(!('token' in extractApprovedAttributionParams('?token=secret&utm_source=chatgpt.com')), 'SEO-P8-CGPT-05: no arbitrary query persistence');
check(landing.landingPage === '/jobs/foo', 'SEO-P8-CGPT-06: landing page preserved');
check(landing.pageGroup === PAGE_GROUP.JOB_DETAIL, 'SEO-P8-CGPT-07: page group classified');
check(CHATGPT_UTM_SOURCE === 'chatgpt.com', 'SEO-P8-CGPT: constant');
check(isChatGptReferrerHost('https://chatgpt.com/'), 'SEO-P8-CGPT: referrer host fallback');
check(isChatGptReferrerHost('https://www.chatgpt.com/'), 'SEO-P8-CGPT-STRICT-04: www referrer fallback separate');
check(classifyChatGptAttribution({ utmSource: 'www.chatgpt.com' }).signal !== 'utm_source', 'SEO-P8-CGPT-STRICT-03b: www UTM not primary signal');
check(classifyChatGptAttribution({ referrer: 'https://www.chatgpt.com/' }).signal === 'referrer_host', 'SEO-P8-CGPT-STRICT-04b: referrer fallback path');
check(!classifyChatGptAttribution({ utmSource: 'bing' }).isChatGpt, 'SEO-P8-CGPT-03b');
check(!classifyChatGptAttribution({ utmSource: 'openai-search' }).isChatGpt, 'SEO-P8-CGPT-STRICT-05: openai heuristic rejected');
check(!classifyChatGptAttribution({ utmSource: 'my-gpt-tool' }).isChatGpt, 'SEO-P8-CGPT-STRICT-05b: gpt substring rejected');
check(!p8Doc.toLowerCase().includes('chatgpt prompt'), 'SEO-P8-CGPT-STRICT-06: no prompt claim');
check(!p8Doc.toLowerCase().includes('chatgpt citation'), 'SEO-P8-CGPT-STRICT-07: no citation claim');

// --- Privacy ---
check(!platformAnalytics.includes('fingerprint'), 'SEO-P8-PRIV-02: no fingerprinting');
check(!platformAnalytics.includes('localStorage.setItem') || platformAnalytics.includes('edurozgaar-lang'), 'SEO-P8-PRIV: session attribution only');
check(!adminSeoPage.includes('student@'), 'SEO-P8-PRIV-03: no individual student exposure');
check(!gscService.includes('res.json(credentials'), 'SEO-P8-PRIV-05: no credential leak in GSC service');
check(gscService.includes('Authorization'), 'SEO-P8-GSC-07: server-only bearer');

// --- GSC (SEO-P8-GSC) ---
const gscMissing = readGscConfig({ NODE_ENV: 'production' });
check(!gscMissing.configured, 'SEO-P8-GSC-01: credentials missing → not configured');
check(gscMissing.state === MEASUREMENT_STATE.NOT_CONFIGURED, 'SEO-P8-GSC-01b');
check(GSC_READONLY_SCOPE.includes('readonly'), 'SEO-P8-GSC-03: readonly scope');
const gscPartial = readGscConfig({ GSC_SITE_URL: 'https://example.com', NODE_ENV: 'production' });
check(!gscPartial.configured && gscPartial.reason === 'missing_gsc_service_account', 'SEO-P8-GSC-04: property required with creds');
check(!adminRoutes.includes('GSC_SERVICE_ACCOUNT'), 'SEO-P8-GSC-07: no env in routes');
check(getGscConnectionStatus({}).state === MEASUREMENT_STATE.NOT_CONFIGURED, 'SEO-P8-GSC-09: no fake data');
const genAiApi = getGoogleGenAiApiAvailability();
check(!genAiApi.automated, 'SEO-P8-GSC-10: no GenAI API claim');
check(genAiApi.state === MEASUREMENT_STATE.MANUAL_IMPORT_REQUIRED, 'SEO-P8-GAI-06: manual export documented');

// --- Google GenAI (SEO-P8-GAI) ---
check(p8Doc.includes('AI Overviews'), 'SEO-P8-GAI-07: AI Overviews wording');
check(p8Doc.includes('AI Mode'), 'SEO-P8-GAI-07b: AI Mode wording');
check(!p8Doc.toLowerCase().includes('ai ctr metric'), 'SEO-P8-GAI-03: no AI CTR metric invented');
check(!p8Doc.toLowerCase().includes('ai click metric'), 'SEO-P8-GAI-02: no AI click metric');
check(!p8Doc.includes('AI prompt metric'), 'SEO-P8-GAI-04: no prompt metric KPI');
check(!KPI_DEFINITIONS.google_genai_impressions.unit.includes('prompt'), 'SEO-P8-GAI-04b: no prompt in KPI');
check(p8Doc.includes('not_available_to_property') || p8Doc.includes('not available'), 'SEO-P8-GAI-05: unavailable state');
check(!measurementService.includes('searchAppearance'), 'SEO-P8-GAI: no invented API filter');

// --- Google GenAI zero policy (SEO-P8-GAI-ZERO) ---
check(resolveGoogleGenAiMetric('impressions', 0, { impressions: MEASUREMENT_STATE.ZERO }).state === MEASUREMENT_STATE.ZERO,
  'SEO-P8-GAI-ZERO-01: confirmed numeric zero');
check(resolveGoogleGenAiMetric('impressions', null, { impressions: MEASUREMENT_STATE.UNAVAILABLE }).state === MEASUREMENT_STATE.UNAVAILABLE,
  'SEO-P8-GAI-ZERO-02: unavailable distinct from zero');
check(resolveGoogleGenAiMetric('impressions', 0, {}).state === MEASUREMENT_STATE.NO_SUFFICIENT_DATA,
  'SEO-P8-GAI-ZERO-04: export zero not authoritative without confirmation');
check(resolveGoogleGenAiMetric('impressions', 0, {}).value === null,
  'SEO-P8-GAI-ZERO-04b: ambiguous export zero hidden');
check(resolveGoogleGenAiMetric('impressions', null, {}).state === MEASUREMENT_STATE.NO_DATA_AVAILABLE,
  'SEO-P8-GAI-ZERO-03: insufficient/missing distinct from zero');
check(!KPI_DEFINITIONS.google_genai_impressions.unit.includes('click'), 'SEO-P8-GAI-ZERO-05: no AI clicks');
check(!Object.keys(KPI_DEFINITIONS).some((k) => k.includes('genai') && k.includes('ctr')), 'SEO-P8-GAI-ZERO-06: no AI CTR KPI');
check(!KPI_DEFINITIONS.google_genai_impressions.source.includes('prompt'), 'SEO-P8-GAI-ZERO-07: no prompt field');
check(p8Doc.includes('~'), 'SEO-P8-GAI-ZERO: tilde export ambiguity documented');
check(p8Doc.includes('metricStates'), 'SEO-P8-GAI-ZERO: operator confirmation documented');
check(resolveGoogleGenAiSnapshotState({
  impressions: { state: MEASUREMENT_STATE.VALID_DATA },
}) === MEASUREMENT_STATE.VALID_DATA, 'SEO-P8-GAI-ZERO: snapshot aggregate valid');

// --- Bing (SEO-P8-BING) ---
check(!bingConfig.includes('soap.envelope') && !bingConfig.includes('SoapClient'), 'SEO-P8-BING-07: no SOAP client');
check(!bingConfig.includes('pox.'), 'SEO-P8-BING-08: no POX client');
check(BING_WEBMASTER_REST_BASE.includes('/json'), 'SEO-P8-BING-09: REST JSON');
const bingAi = getBingAiPerformanceApiAvailability();
check(!bingAi.automated, 'SEO-P8-BING-05: no undocumented AI endpoint');
check(bingAi.legacyApiProhibited.includes('soap'), 'SEO-P8-BING-07b');
check(p8Doc.includes('citation'), 'SEO-P8-BING-01: citations documented');
check(p8Doc.includes('grounding'), 'SEO-P8-BING-02: grounding queries not prompts');
check(!p8Doc.includes('AI ranking'), 'SEO-P8-BING-04: no AI ranking claim');
check(readBingWebmasterConfig({}).state === MEASUREMENT_STATE.NOT_CONFIGURED, 'SEO-P8-BING-06: manual path');

// --- KPI taxonomy ---
check(KPI_DEFINITIONS.google_impressions.category === KPI_CATEGORY.SEARCH_DISCOVERY, 'SEO-P8: google impressions category');
check(KPI_DEFINITIONS.google_genai_impressions.category === KPI_CATEGORY.AI_VISIBILITY, 'SEO-P8: genai separate');
check(KPI_DEFINITIONS.chatgpt_referral_sessions.source.includes('utm'), 'SEO-P8: chatgpt source');
check(listKpisByCategory(KPI_CATEGORY.TECHNICAL_HEALTH).length >= 1, 'SEO-P8: technical KPIs');

// --- Opportunities ---
const opps = deriveContentOpportunities({ impressions: 5000, ctr: 0.01, isImportantPage: true });
check(opps.some((o) => o.type === OPPORTUNITY_TYPE.HIGH_IMPRESSIONS_LOW_CTR), 'SEO-P8: CTR opportunity');
check(!p8Doc.includes('automatically rewrite'), 'SEO-P8: no auto content modification');

// --- Application tracking ---
check(ANALYTICS_EVENT_TYPES.includes('application_click'), 'SEO-P8: application_click event');
check(jobDetail.includes('trackApplicationClick'), 'SEO-P8: job apply tracked');
check(scholarshipDetail.includes('trackApplicationClick'), 'SEO-P8: scholarship apply tracked');

// --- Admin dashboard & authorization ---
check(adminRoutes.includes('/seo-measurement'), 'SEO-P8: admin route');
check(/get\('\/seo-measurement'.*ANALYTICS_READ/si.test(adminRoutes), 'SEO-P8-AUTH-01: GET requires analytics read');
check(adminRoutes.includes("post('/seo-measurement/snapshots', requirePermission(PERMISSIONS.DATA_QUALITY_MANAGE)"), 'SEO-P8-AUTH-04: POST requires data quality manage');
check(!adminRoutes.includes("post('/seo-measurement/snapshots', requirePermission(PERMISSIONS.ANALYTICS_READ)"), 'SEO-P8-AUTH-03: read permission cannot POST snapshot');
check(hasPermission(ROLES.EDITOR, PERMISSIONS.ANALYTICS_READ), 'SEO-P8-AUTH-01b: editor can read analytics');
check(!hasPermission(ROLES.EDITOR, PERMISSIONS.DATA_QUALITY_MANAGE), 'SEO-P8-AUTH-03b: editor cannot import snapshot');
check(hasPermission(ROLES.ADMIN, PERMISSIONS.DATA_QUALITY_MANAGE), 'SEO-P8-AUTH-04b: admin can import snapshot');
check(!read('server/src/index.js').includes('/seo-measurement'), 'SEO-P8-AUTH-07: no public SEO metrics route');
check(adminSeoPage.includes('not configured') || adminSeoPage.includes('Not configured'), 'SEO-P8: unavailable states in UI');
check(adminSeoPage.includes('not summed') || adminSeoPage.includes('separate units'), 'SEO-P8: source separation');
check(adminSeoPage.includes('<table'), 'SEO-P8: accessible tables');
check(adminSeoPage.includes('aria-labelledby'), 'SEO-P8: semantic headings');

// --- Technical health ---
const health = getSeoTechnicalHealth({ SITE_URL: 'https://strideto.com', NODE_ENV: 'production' });
check(health.robots.state === MEASUREMENT_STATE.HEALTHY, 'SEO-P8: robots healthy');
check(health.sitemap.url?.includes('sitemap.xml'), 'SEO-P8: sitemap path');
check(!JSON.stringify(health).includes('INDEXNOW_KEY'), 'SEO-P8: no indexnow key in health');

// --- P0-P7 freeze ---
check(!jobDetail.includes('data-nosnippet'), 'SEO-P8: P7 nosnippet unchanged');
check(read('shared/seo/robotsPolicy.js').includes('User-agent: *'), 'SEO-P8: robots policy preserved');

// --- Worker ---
check(measurementService.includes('stopped_by_policy'), 'SEO-P8: worker stopped');
check(p8Doc.includes('STOPPED'), 'SEO-P8: worker documented');

// --- Documentation ---
check(p8Doc.includes('Source-of-truth matrix'), 'SEO-P8: source matrix');
check(p8Doc.includes('SEO-P0 through SEO-P8'), 'SEO-P8: roadmap completion');
check(p8Doc.includes('JOB-AUTOFILL-P2'), 'SEO-P8: next handoff 1');
check(p8Doc.includes('COPILOT-P1'), 'SEO-P8: next handoff 2');
check(p8Doc.includes('Weekly'), 'SEO-P8: weekly process');
check(p8Doc.includes('Monthly'), 'SEO-P8: monthly process');
check(p8Doc.includes('Quarterly'), 'SEO-P8: quarterly process');

// --- No scraping ---
check(!read('server/src/services/seo/measurement/seoMeasurementService.js').includes('serp'), 'SEO-P8: no SERP scraping');
check(!p8Doc.toLowerCase().includes('scrape google'), 'SEO-P8: no scrape docs');

// --- GSC auth structure ---
check(typeof createServiceAccountAssertion === 'function', 'SEO-P8-GSC-02: server auth module');

// --- Bing connection ---
const bingConn = getBingConnectionStatus({});
check(bingConn.search.state === MEASUREMENT_STATE.NOT_CONFIGURED, 'SEO-P8: bing not configured');
check(bingConn.aiPerformance.manualImportRequired !== false || bingConn.aiPerformance.state, 'SEO-P8-BING-06b');

// --- ChatGPT KPI separation ---
check(KPI_DEFINITIONS.bing_ai_total_citations.unit === 'citations', 'SEO-P8-KPI-05: citations unit');
check(KPI_DEFINITIONS.chatgpt_referral_sessions.unit === 'sessions', 'SEO-P8-KPI-05b: sessions unit');

// --- Stale state ---
check(MEASUREMENT_STATE.STALE === 'stale', 'SEO-P8-KPI-08: stale state exists');
check(MEASUREMENT_STATE.ERROR === 'error', 'SEO-P8-KPI-09: error state');

// --- Normalize UTM ---
check(normalizeUtmSource('  ChatGPT.COM ') === 'chatgpt.com', 'SEO-P8-CGPT-02b');

// --- Intl scholarship page group ---
check(classifyPageGroup('/intl-scholarships/fulbright').pageGroup === PAGE_GROUP.INTL_SCHOLARSHIP_DETAIL, 'SEO-P8: intl scholarship');

// --- Scholarship intelligence ---
check(classifyPageGroup('/scholarships/intelligence/foo').pageGroup === PAGE_GROUP.SCHOLARSHIP_INTELLIGENCE, 'SEO-P8: scholarship intelligence');

// --- Employer persona ---
check(classifyPageGroup('/employers').pageGroup === PAGE_GROUP.EMPLOYERS_PERSONA, 'SEO-P8: employers persona');

// --- Home ---
check(classifyPageGroup('/').pageGroup === PAGE_GROUP.HOME, 'SEO-P8: home group');

// --- Application click nonblocking ---
const appTrack = read('client/src/utils/applicationClickTracking.js');
check(appTrack.includes('destinationType'), 'SEO-P8-PRIV-04: safe metadata only');
check(!appTrack.includes('email@'), 'SEO-P8-PRIV-04b: no PII');
check(appTrack.includes('trackPlatformEvent'), 'SEO-P8: fire-and-forget application click');
check(!appTrack.includes('preventDefault'), 'SEO-P8: application click helper does not block navigation');
check((jobDetail.match(/onClick=\{\(\) => trackApplicationClick/g) || []).length >= 2, 'SEO-P8: deliberate apply click handlers only');

// --- Snapshot model ---
check(read('server/src/models/SeoMetricsSnapshot.js').includes('manual_import'), 'SEO-P8: snapshot model');

// --- Failure isolation ---
check(measurementService.includes('resolvedMetrics'), 'SEO-P8-GAI: dashboard resolves genai metrics');

// --- Compare flat ---
check(compareTrend(100, 101).direction === TREND_DIRECTION.FLAT || compareTrend(100, 100).direction === TREND_DIRECTION.FLAT, 'SEO-P8: flat trend');

// --- GenAI impressions distinct ---
check(KPI_DEFINITIONS.google_genai_impressions.id !== KPI_DEFINITIONS.google_clicks.id, 'SEO-P8-KPI-06: AI impressions not clicks');

// --- Not comparable ---
check(compareTrend(0, 0).direction === TREND_DIRECTION.FLAT, 'SEO-P8: zero-zero flat');

// --- Platform analytics acquisition key ---
check(platformAnalytics.includes('er_acquisition_attribution'), 'SEO-P8: first-touch session key');
check(platformAnalytics.includes('buildLandingAttributionMetadata'), 'SEO-P8: landing attribution wired');

// --- Admin nav ---
check(read('client/src/config/adminNavConfig.js').includes('seo-measurement'), 'SEO-P8: nav entry');

// --- Routes ---
check(read('client/src/routes/index.jsx').includes('AdminSeoMeasurement'), 'SEO-P8: client route');

// --- API client ---
check(read('client/src/services/seoMeasurementApi.js').includes('/admin/seo-measurement'), 'SEO-P8: API client');

// --- Audit log on import ---
check(read('server/src/controllers/admin/seoMeasurementController.js').includes('logAudit'), 'SEO-P8: audit on manual import');

// --- Snapshot validation (SEO-P8-AUTH-05/06) ---
const validSnapshot = validateManualSeoSnapshotInput({
  provider: 'google',
  dataset: 'generative_ai_performance',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-28',
  metrics: { impressions: 120 },
  metricStates: { impressions: MEASUREMENT_STATE.VALID_DATA },
});
check(validSnapshot.ok, 'SEO-P8-AUTH-04c: valid snapshot accepted');
const invalidSnapshot = validateManualSeoSnapshotInput({
  provider: 'evil',
  dataset: 'generative_ai_performance',
  periodStart: '2026-08-28',
  periodEnd: '2026-08-01',
  metrics: { impressions: -1 },
});
check(!invalidSnapshot.ok, 'SEO-P8-AUTH-05: invalid snapshot rejected');
const secretSnapshot = validateManualSeoSnapshotInput({
  provider: 'google',
  dataset: 'generative_ai_performance',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-28',
  metrics: { impressions: 1, api_key: 'secret' },
});
check(!secretSnapshot.ok, 'SEO-P8-AUTH-06: credential field rejected');
const protoSnapshot = validateManualSeoSnapshotInput({
  provider: 'google',
  dataset: 'generative_ai_performance',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-28',
  metrics: { impressions: 1, constructor: { polluted: true } },
});
check(!protoSnapshot.ok, 'SEO-P8-AUTH-06b: prototype pollution rejected');

// --- No fake alerts ---
check(!adminSeoPage.includes('SEO critical'), 'SEO-P8: no fake critical banners');

// --- Percent change with previous ---
const pct = compareTrend(10, 5);
check(pct.percentChange === 100, 'SEO-P8-KPI-03b: percent when comparable');

// --- Provider failure state in doc ---
check(p8Doc.includes('failure'), 'SEO-P8: failure isolation documented');

console.log(`SEO-P8 measurement tests passed (${count} assertions).`);
