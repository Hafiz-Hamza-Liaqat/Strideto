/**
 * SEO-P5 — Freshness, IndexNow, and sitemap submission architecture.
 *
 * Run: node server/src/__tests__/seoP5FreshnessIndexNow.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PRODUCTION_PUBLIC_ORIGIN } from '../../../shared/seo/publicSiteOrigin.js';
import {
  resolveEntitySitemapLastmod,
  evaluateSeoChange,
  dedupeSeoNotificationUrls,
  SEO_ENTITY_TYPES,
  SEO_CHANGE_ACTION,
  hasMeaningfulPublicContentChange,
  contentResourceToSeoEntity,
  isSeoEntityIndexable,
} from '../../../shared/seo/freshnessPolicy.js';
import { resolveSitemapLastmod } from '../../../shared/seo/sitemapPolicy.js';
import {
  isValidIndexNowKey,
  validateIndexNowCanonicalUrl,
  normalizeIndexNowUrlList,
  buildIndexNowPayload,
  INDEXNOW_PROTOCOL_MAX_URLS,
} from '../../../shared/seo/indexNowUrlPolicy.js';
import {
  evaluateGoogleIndexingApiEligibility,
  assertNotGoogleIndexingApiGeneralContent,
} from '../../../shared/seo/googleIndexingApiPolicy.js';
import { buildRobotsTxt } from '../../../shared/seo/robotsPolicy.js';
import { isIntlScholarshipDetailEligible } from '../../../shared/seo/entityDetailSeoPolicy.js';
import {
  readIndexNowConfig,
  isIndexNowProductionContext,
} from '../services/seo/indexNowConfig.js';
import {
  submitIndexNowUrls,
  setIndexNowFetchForTests,
  resetIndexNowFetchForTests,
  INDEXNOW_TIMEOUT_MS,
} from '../services/seo/indexNowService.js';
import {
  resetSeoNotificationSuppressCacheForTests,
  notifySeoChange,
} from '../services/seo/seoChangeNotificationService.js';
import { evaluateJobPostingEligibility, JOB_POSTING_SURFACES } from '../../../shared/seo/jobPostingEligibility.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '../../..');
const read = (rel) => readFileSync(path.join(repo, rel), 'utf8');

const ORIGIN = PRODUCTION_PUBLIC_ORIGIN;
const publicJob = {
  slug: 'engineer-lahore',
  status: 'active',
  approvalStatus: 'approved',
  publicationState: 'active',
  title: 'Engineer',
  company: 'Acme',
  updatedAt: new Date('2026-02-01T12:00:00.000Z'),
  publishedAt: new Date('2026-01-15T08:00:00.000Z'),
  publicationUpdatedAt: new Date('2026-02-01T12:00:00.000Z'),
};

const PROD_ENV = {
  INDEXNOW_ENABLED: '1',
  INDEXNOW_KEY: 'abcdefgh12345678',
  SITE_URL: 'https://www.strideto.com',
  NODE_ENV: 'production',
};

// SEO-P5-LASTMOD-01 — persisted meaningful updatedAt used
{
  const lastmod = resolveEntitySitemapLastmod(SEO_ENTITY_TYPES.JOB, publicJob);
  check(lastmod === '2026-02-01', 'SEO-P5-LASTMOD-01: publicationUpdatedAt drives job lastmod');
}

// SEO-P5-LASTMOD-02 — publishedAt fallback
{
  const blog = { status: 'published', slug: 'x', publishedAt: new Date('2026-01-10T00:00:00.000Z') };
  const lastmod = resolveEntitySitemapLastmod(SEO_ENTITY_TYPES.BLOG, blog);
  check(lastmod === '2026-01-10', 'SEO-P5-LASTMOD-02: publishedAt fallback for blog');
}

// SEO-P5-LASTMOD-03 — request current time never used
{
  const future = resolveSitemapLastmod(new Date('2099-01-01T00:00:00.000Z'), {
    now: new Date('2026-01-01T00:00:00.000Z'),
  });
  check(future === undefined, 'SEO-P5-LASTMOD-03: future timestamps omitted');
  const seoController = read('server/src/controllers/seoController.js');
  check(!seoController.includes('new Date()'), 'SEO-P5-LASTMOD-03: sitemap controller does not use new Date() for lastmod');
}

// SEO-P5-LASTMOD-04 — invalid timestamp omitted safely
{
  check(resolveEntitySitemapLastmod(SEO_ENTITY_TYPES.BLOG, { slug: 'x', updatedAt: 'not-a-date' }) === undefined,
    'SEO-P5-LASTMOD-04: invalid timestamp omitted');
}

// SEO-P5-LASTMOD-05 — private entity never enters sitemap policy helpers
{
  check(isSeoEntityIndexable(SEO_ENTITY_TYPES.JOB, { slug: 'x', status: 'draft' }) === false,
    'SEO-P5-LASTMOD-05: draft job not indexable');
}

// SEO-P5-LASTMOD-06 — same unchanged entity yields stable lastmod
{
  const a = resolveEntitySitemapLastmod(SEO_ENTITY_TYPES.JOB, publicJob);
  const b = resolveEntitySitemapLastmod(SEO_ENTITY_TYPES.JOB, { ...publicJob });
  check(a === b && a === '2026-02-01', 'SEO-P5-LASTMOD-06: stable lastmod for unchanged entity');
}

// SEO-P5-IN-01 — disabled config → safe no-op
{
  const cfg = readIndexNowConfig({ NODE_ENV: 'test' });
  check(cfg.enabled === false && cfg.reason === 'not_production_env', 'SEO-P5-IN-01: disabled outside production');
}

// SEO-P5-IN-02 — missing key → safe no-op
{
  const cfg = readIndexNowConfig({
    INDEXNOW_ENABLED: '1',
    SITE_URL: 'https://www.strideto.com',
    NODE_ENV: 'production',
  });
  check(cfg.enabled === false && cfg.reason === 'missing_key', 'SEO-P5-IN-02: missing key fails closed');
}

// SEO-P5-IN-03 — invalid key rejected
{
  check(isValidIndexNowKey('') === false, 'SEO-P5-IN-03: empty key invalid');
  check(isValidIndexNowKey('short') === false, 'SEO-P5-IN-03: too short');
  check(isValidIndexNowKey('has space here') === false, 'SEO-P5-IN-03: whitespace invalid');
}

// SEO-P5-IN-04 — key never logged (static audit)
{
  const svc = read('server/src/services/seo/indexNowService.js');
  check(!svc.includes('config.key') || !svc.includes('logger.info') || !/logger\.(info|warn|error)\([^)]*config\.key/.test(svc),
    'SEO-P5-IN-04: service does not log config.key in log calls');
}

// SEO-P5-IN-05 — canonical host = www.strideto.com
{
  const url = validateIndexNowCanonicalUrl('/jobs/test-job');
  check(url === `${ORIGIN}/jobs/test-job`, 'SEO-P5-IN-05: canonical host accepted');
}

// SEO-P5-IN-06 — foreign host rejected
{
  check(validateIndexNowCanonicalUrl('https://evil.com/jobs/x') === null, 'SEO-P5-IN-06: foreign host rejected');
  check(validateIndexNowCanonicalUrl('https://api.strideto.com/jobs/x') === null, 'SEO-P5-IN-06: api host rejected');
}

// SEO-P5-IN-07 — localhost rejected
{
  check(validateIndexNowCanonicalUrl('https://localhost:8443/jobs/x') === null, 'SEO-P5-IN-07: localhost rejected');
}

// SEO-P5-IN-08 — query URL rejected
{
  check(validateIndexNowCanonicalUrl(`${ORIGIN}/jobs?search=dev`) === null, 'SEO-P5-IN-08: query URL rejected');
}

// SEO-P5-IN-09 — duplicate URLs deduped
{
  const list = normalizeIndexNowUrlList([
    `${ORIGIN}/jobs/a`,
    `${ORIGIN}/jobs/a`,
    `${ORIGIN}/jobs/b`,
  ]);
  check(list.length === 2, 'SEO-P5-IN-09: duplicates deduped');
}

// SEO-P5-IN-10 — batch bounded to protocol policy
{
  const urls = Array.from({ length: INDEXNOW_PROTOCOL_MAX_URLS + 50 }, (_, i) => `${ORIGIN}/jobs/job-${i}`);
  check(normalizeIndexNowUrlList(urls).length === INDEXNOW_PROTOCOL_MAX_URLS,
    'SEO-P5-IN-10: batch capped at protocol max');
}

// SEO-P5-KEY-01/02/03/04 — key file architecture
{
  const indexJs = read('server/src/index.js');
  const vercel = read('client/vercel.json');
  const controller = read('server/src/controllers/indexNowController.js');
  check(indexJs.includes('/indexnow-key.txt'), 'SEO-P5-KEY-01: server route exists');
  check(vercel.includes('/indexnow-key.txt'), 'SEO-P5-KEY-01: vercel rewrite exists');
  check(controller.includes("type('text/plain')"), 'SEO-P5-KEY-01: text/plain response');
  check(controller.includes('config.key'), 'SEO-P5-KEY-02: content equals configured key');
  check(controller.includes('status(404)'), 'SEO-P5-KEY-03: missing config does not expose placeholder');
  check(!controller.includes('index.html'), 'SEO-P5-KEY-04: no SPA HTML for verification URL');
}

// SEO-P5-HTTP-01 through 08 — HTTP response handling (mocked)
{
  resetIndexNowFetchForTests();
  const calls = [];
  setIndexNowFetchForTests(async () => {
    calls.push(1);
    return { status: 200, ok: true };
  });

  const env = PROD_ENV;

  const r1 = await submitIndexNowUrls([`${ORIGIN}/jobs/a`], { env });
  check(r1.ok === true && r1.category === 'accepted', 'SEO-P5-HTTP-01: 200 accepted');

  setIndexNowFetchForTests(async () => ({ status: 202, ok: true }));
  const r2 = await submitIndexNowUrls([`${ORIGIN}/jobs/b`], { env });
  check(r2.ok === true && r2.status === 202, 'SEO-P5-HTTP-02: 202 accepted');

  setIndexNowFetchForTests(async () => ({ status: 400, ok: false }));
  const r3 = await submitIndexNowUrls([`${ORIGIN}/jobs/c`], { env });
  check(r3.category === 'permanent_failure', 'SEO-P5-HTTP-03: 400 permanent failure');

  setIndexNowFetchForTests(async () => ({ status: 403, ok: false }));
  const r4 = await submitIndexNowUrls([`${ORIGIN}/jobs/d`], { env });
  check(r4.category === 'permanent_failure', 'SEO-P5-HTTP-04: 403 key failure');

  setIndexNowFetchForTests(async () => ({ status: 422, ok: false }));
  const r5 = await submitIndexNowUrls([`${ORIGIN}/jobs/e`], { env });
  check(r5.category === 'permanent_failure', 'SEO-P5-HTTP-05: 422 mismatch');

  setIndexNowFetchForTests(async () => ({ status: 429, ok: false }));
  const r6 = await submitIndexNowUrls([`${ORIGIN}/jobs/f`], { env });
  check(r6.category === 'rate_limited', 'SEO-P5-HTTP-06: 429 rate limited');

  setIndexNowFetchForTests(async () => { throw new Error('network'); });
  const r7 = await submitIndexNowUrls([`${ORIGIN}/jobs/g`], { env });
  check(r7.ok === false && r7.category === 'network_error', 'SEO-P5-HTTP-07: network does not throw to caller');

  check(calls.length === 1, 'SEO-P5-HTTP-08: no automatic retry storm on success path');
  check(INDEXNOW_TIMEOUT_MS <= 10000, 'SEO-P5-HTTP-07: bounded timeout configured');
  resetIndexNowFetchForTests();
}

// SEO-P5-EVENT-01 through 08 — publication events
{
  resetSeoNotificationSuppressCacheForTests();
  const draft = { slug: 'post', status: 'draft', title: 'A' };
  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.BLOG,
    previous: draft,
    next: { ...draft },
  }).action === SEO_CHANGE_ACTION.NO_OP, 'SEO-P5-EVENT-01: draft→draft no notification');

  const pub = evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.BLOG,
    previous: draft,
    next: { ...draft, status: 'published', publishedAt: new Date() },
  });
  check(pub.action === SEO_CHANGE_ACTION.URL_UPDATED && pub.urls[0] === '/blog/post',
    'SEO-P5-EVENT-02: draft→published notifies');

  const prevPub = { slug: 'post', status: 'published', title: 'A', content: 'old' };
  const nextPub = { slug: 'post', status: 'published', title: 'A', content: 'new' };
  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.BLOG,
    previous: prevPub,
    next: nextPub,
  }).action === SEO_CHANGE_ACTION.URL_UPDATED, 'SEO-P5-EVENT-03: meaningful published edit');

  const unpub = evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.BLOG,
    previous: prevPub,
    next: { ...prevPub, status: 'archived' },
  });
  check(unpub.action === SEO_CHANGE_ACTION.URL_REMOVED, 'SEO-P5-EVENT-04: unpublish notifies previous URL');

  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.BLOG,
    previous: draft,
    action: 'delete',
  }).action === SEO_CHANGE_ACTION.NO_OP, 'SEO-P5-EVENT-05: never-public deletion');

  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.BLOG,
    previous: prevPub,
    action: 'delete',
  }).action === SEO_CHANGE_ACTION.URL_REMOVED, 'SEO-P5-EVENT-06: previously-public deletion');

  check(validateIndexNowCanonicalUrl('/employer/jobs/1') === null,
    'SEO-P5-EVENT-07: private workspace path rejected by URL policy');

  check(validateIndexNowCanonicalUrl(`${ORIGIN}/jobs?search=x`) === null,
    'SEO-P5-EVENT-08: filter URL never notified');
}

// SEO-P5-JOB-01 through 08
{
  const draftJob = { slug: 'j', status: 'draft', approvalStatus: 'pending' };
  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.JOB,
    previous: draftJob,
    next: publicJob,
  }).action === SEO_CHANGE_ACTION.URL_UPDATED, 'SEO-P5-JOB-01: public job publication');

  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.JOB,
    previous: publicJob,
    next: { ...publicJob, title: 'Senior Engineer' },
  }).action === SEO_CHANGE_ACTION.URL_UPDATED, 'SEO-P5-JOB-02: meaningful job update');

  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.JOB,
    previous: publicJob,
    next: { ...publicJob, status: 'closed' },
  }).action === SEO_CHANGE_ACTION.URL_REMOVED, 'SEO-P5-JOB-03: job closure removal signal');

  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.JOB,
    previous: draftJob,
    next: draftJob,
  }).action === SEO_CHANGE_ACTION.NO_OP, 'SEO-P5-JOB-04: draft job no notification');

  const curated = { ...publicJob, jobsGraphEligible: false, source: 'manual' };
  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.JOB,
    previous: null,
    next: curated,
  }).action === SEO_CHANGE_ACTION.URL_UPDATED, 'SEO-P5-JOB-05: curated public job may use IndexNow');

  const googleCurated = evaluateGoogleIndexingApiEligibility('job', curated);
  check(googleCurated.eligible === false, 'SEO-P5-JOB-06: curated job not Google Indexing API eligible');

  const employerJob = {
    ...publicJob,
    jobsGraphEligible: true,
    employerId: 'emp1',
    description: 'Build things',
    countryCode: 'PK',
    city: 'Lahore',
  };
  const googleEmployer = evaluateGoogleIndexingApiEligibility('job', employerJob);
  check(googleEmployer.eligible === true, 'SEO-P5-JOB-07: eligible employer JobPosting policy unchanged');

  const inOnly = evaluateSeoChange({ entityType: SEO_ENTITY_TYPES.JOB, previous: null, next: employerJob });
  check(inOnly.action === SEO_CHANGE_ACTION.URL_UPDATED && googleEmployer.eligible === true,
    'SEO-P5-JOB-08: IndexNow and Google API eligibility are separate');
}

// SEO-P5-BLOG / SCH / INST / PROG / INT
{
  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.BLOG,
    previous: { slug: 'b', status: 'draft' },
    next: { slug: 'b', status: 'draft' },
  }).action === SEO_CHANGE_ACTION.NO_OP, 'SEO-P5-BLOG-01');

  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.BLOG,
    previous: { slug: 'b', status: 'draft' },
    next: { slug: 'b', status: 'published' },
  }).urls[0] === '/blog/b', 'SEO-P5-BLOG-02');

  check(contentResourceToSeoEntity('scholarships') === SEO_ENTITY_TYPES.SCHOLARSHIP,
    'SEO-P5-SCH-01: scholarship route ownership preserved');

  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.SCHOLARSHIP,
    previous: { slug: 's', status: 'draft' },
    next: { slug: 's', status: 'draft' },
  }).action === SEO_CHANGE_ACTION.NO_OP, 'SEO-P5-SCH-02');

  const thinInst = {
    slug: 'uni',
    status: 'published',
    officialName: 'Uni',
    countryCode: 'PK',
    sources: [],
  };
  check(isSeoEntityIndexable(SEO_ENTITY_TYPES.CANONICAL_INSTITUTION, thinInst) === false,
    'SEO-P5-INST-01: thin institution not indexable');

  check(isSeoEntityIndexable(SEO_ENTITY_TYPES.CANONICAL_INSTITUTION, thinInst, { programCount: 1 }) === true,
    'SEO-P5-INST-02: density-eligible with program');

  const thinProg = { slug: 'p', status: 'published', name: 'CS', institutionId: 'x' };
  check(isSeoEntityIndexable(SEO_ENTITY_TYPES.PROGRAM, thinProg) === false, 'SEO-P5-PROG-01');

  const richProg = { ...thinProg, description: 'Full program' };
  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.PROGRAM,
    previous: thinProg,
    next: richProg,
  }).action === SEO_CHANGE_ACTION.URL_UPDATED, 'SEO-P5-PROG-02');

  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.INTERNSHIP,
    previous: { slug: 'i', status: 'draft' },
    next: { slug: 'i', status: 'active', title: 'Intern' },
  }).urls[0] === '/internships/i', 'SEO-P5-INT-01');

  const internshipGoogle = evaluateGoogleIndexingApiEligibility('internship', { type: 'internship' });
  check(internshipGoogle.eligible === false, 'SEO-P5-INT-02');
}

// SEO-P5-GOOGLE-01 through 05
{
  const repoText = read('server/src/controllers/seoController.js')
    + read('server/src/services/seo/indexNowService.js');
  check(!repoText.includes('google.com/ping'), 'SEO-P5-GOOGLE-01: no deprecated sitemap ping');
  check(!repoText.includes('indexing.googleapis.com'), 'SEO-P5-GOOGLE-02: no general Google Indexing API client');
  check(assertNotGoogleIndexingApiGeneralContent('blog') === false, 'SEO-P5-GOOGLE-02b');
  check(evaluateGoogleIndexingApiEligibility('internship', {}).eligible === false, 'SEO-P5-GOOGLE-03');
  check(evaluateGoogleIndexingApiEligibility('job', { ...publicJob, jobsGraphEligible: false }).eligible === false,
    'SEO-P5-GOOGLE-04');
  const unauthorized = evaluateJobPostingEligibility({ ...publicJob, jobsGraphEligible: false }, {
    surface: JOB_POSTING_SURFACES.DETAIL,
  });
  check(unauthorized.eligible === false, 'SEO-P5-GOOGLE-05: jobsGraphEligible gate preserved');
}

// SEO-P5-SITEMAP-01 through 07
{
  const robots = buildRobotsTxt(ORIGIN);
  check(robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`), 'SEO-P5-SITEMAP-01');
  const seoController = read('server/src/controllers/seoController.js');
  check(seoController.includes('resolveEntitySitemapLastmod'), 'SEO-P5-SITEMAP-05: truthful lastmod helper');
  check(seoController.includes('isJobDetailPubliclyEligible'), 'SEO-P5-SITEMAP-07: P3 inclusion policy unchanged');
  check(seoController.includes('isSitemapEligiblePath'), 'SEO-P5-SITEMAP-03: sitemap eligibility guard used');
}

// Meaningful change ignores analytics-only job fields
{
  check(hasMeaningfulPublicContentChange(
    SEO_ENTITY_TYPES.JOB,
    { ...publicJob, views: 1 },
    { ...publicJob, views: 99 }
  ) === false, 'views increment alone is not meaningful freshness');
}

// Payload shape
{
  const payload = buildIndexNowPayload({
    key: 'abcdefgh12345678',
    keyLocation: `${ORIGIN}/indexnow-key.txt`,
    urls: [`${ORIGIN}/jobs/a`],
  });
  check(payload.host === 'www.strideto.com' && payload.urlList.length === 1,
    'IndexNow payload uses www host and urlList');
}

// Integration hook present
{
  const integration = read('server/src/utils/contentIntegration.js');
  check(integration.includes('scheduleSeoChangeNotification'), 'contentIntegration wires SEO notifications');
}

// SEO-P5-SLUG-01 through 06 — canonical slug/path changes
{
  const published = { slug: 'same-slug', status: 'published', title: 'A', content: 'old' };
  const updated = { slug: 'same-slug', status: 'published', title: 'A', content: 'new' };
  const sameSlug = evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.BLOG,
    previous: published,
    next: updated,
  });
  check(sameSlug.urls.length === 1 && sameSlug.urls[0] === '/blog/same-slug',
    'SEO-P5-SLUG-01: public same slug meaningful update → one URL');

  const slugChange = evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.BLOG,
    previous: { slug: 'old-slug', status: 'published', title: 'A' },
    next: { slug: 'new-slug', status: 'published', title: 'A' },
  });
  check(
    slugChange.urls.length === 2
      && slugChange.urls.includes('/blog/old-slug')
      && slugChange.urls.includes('/blog/new-slug'),
    'SEO-P5-SLUG-02: public old slug → public new slug → old + new URL'
  );

  check(
    dedupeSeoNotificationUrls(['/blog/a', '/blog/a', '/blog/b']).length === 2,
    'SEO-P5-SLUG-03: old/new URL batch deduplicated'
  );

  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.BLOG,
    previous: { slug: 'old', status: 'draft' },
    next: { slug: 'new', status: 'draft' },
  }).action === SEO_CHANGE_ACTION.NO_OP, 'SEO-P5-SLUG-04: draft slug change → no URL');

  const toPrivate = evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.BLOG,
    previous: { slug: 'old-slug', status: 'published', title: 'A' },
    next: { slug: 'new-slug', status: 'draft', title: 'A' },
  });
  check(
    toPrivate.urls.length === 1 && toPrivate.urls[0] === '/blog/old-slug',
    'SEO-P5-SLUG-05: public old slug → non-public new slug → old URL only'
  );

  const normalized = normalizeIndexNowUrlList([
    `${ORIGIN}/employer/jobs/1`,
    `${ORIGIN}/jobs?search=x`,
    `${ORIGIN}/jobs/ok`,
  ]);
  check(normalized.length === 1 && normalized[0] === `${ORIGIN}/jobs/ok`,
    'SEO-P5-SLUG-06: query/private URLs can never enter old/new URL set');
}

// SEO-P5-ENV-01 through 08 — production-only network gate
{
  let fetchCalls = 0;
  setIndexNowFetchForTests(async () => { fetchCalls += 1; return { status: 200, ok: true }; });

  const eligible = readIndexNowConfig(PROD_ENV);
  check(eligible.enabled === true, 'SEO-P5-ENV-01: production + enabled + valid config is network eligible');
  await submitIndexNowUrls([`${ORIGIN}/jobs/env-prod`], { env: PROD_ENV });
  check(fetchCalls === 1, 'SEO-P5-ENV-01b: production config may submit');

  fetchCalls = 0;
  await submitIndexNowUrls([`${ORIGIN}/jobs/dev`], {
    env: { ...PROD_ENV, NODE_ENV: 'development' },
  });
  check(fetchCalls === 0, 'SEO-P5-ENV-02: development never submits');

  fetchCalls = 0;
  await submitIndexNowUrls([`${ORIGIN}/jobs/test`], {
    env: { ...PROD_ENV, NODE_ENV: 'test' },
  });
  check(fetchCalls === 0, 'SEO-P5-ENV-03: test never submits');

  fetchCalls = 0;
  await submitIndexNowUrls([`${ORIGIN}/jobs/noenv`], {
    env: { ...PROD_ENV, NODE_ENV: undefined },
  });
  check(fetchCalls === 0, 'SEO-P5-ENV-04: missing NODE_ENV never submits');

  fetchCalls = 0;
  await submitIndexNowUrls([`${ORIGIN}/jobs/local`], {
    env: { ...PROD_ENV, SITE_URL: 'https://localhost:8443' },
  });
  check(fetchCalls === 0, 'SEO-P5-ENV-05: localhost SITE_URL never submits');

  fetchCalls = 0;
  await submitIndexNowUrls([`${ORIGIN}/jobs/preview`], {
    env: { ...PROD_ENV, SITE_URL: 'https://strideto-preview.vercel.app' },
  });
  check(fetchCalls === 0, 'SEO-P5-ENV-06: Vercel preview SITE_URL never submits');

  fetchCalls = 0;
  await submitIndexNowUrls([`${ORIGIN}/jobs/nokey`], {
    env: { INDEXNOW_ENABLED: '1', SITE_URL: 'https://www.strideto.com', NODE_ENV: 'production' },
  });
  check(fetchCalls === 0, 'SEO-P5-ENV-07: production without key never submits');

  const svc = read('server/src/services/seo/indexNowService.js');
  check(!svc.includes('config.key') || !/logger\.(info|warn|error)\([^)]*config\.key/.test(svc),
    'SEO-P5-ENV-08: key never logged');

  check(isIndexNowProductionContext(PROD_ENV).ok === true, 'SEO-P5-ENV-01c: production context helper');
  resetIndexNowFetchForTests();
}

// SEO-P5-KEY-FINAL-01 through 04
{
  const controller = read('server/src/controllers/indexNowController.js');
  const cfg = readIndexNowConfig(PROD_ENV);
  check(cfg.enabled === true, 'SEO-P5-KEY-FINAL-01: valid production config enables key file');
  check(controller.includes("type('text/plain')"), 'SEO-P5-KEY-FINAL-01b: text/plain response');
  check(readIndexNowConfig({ ...PROD_ENV, INDEXNOW_KEY: '' }).enabled === false,
    'SEO-P5-KEY-FINAL-02: missing key does not enable serving');
  check(readIndexNowConfig({ ...PROD_ENV, INDEXNOW_KEY: 'short' }).enabled === false,
    'SEO-P5-KEY-FINAL-03: invalid key does not enable serving');
  check(!controller.includes('index.html'), 'SEO-P5-KEY-FINAL-04: never SPA HTML');
}

// SEO-P5-INTLSCH-01 through 07
{
  const intlCtrl = read('server/src/controllers/admin/adminIntlScholarshipsController.js');
  check(intlCtrl.includes('scheduleSeoChangeNotification'), 'SEO-P5-INTLSCH hook: controller wired');
  check(intlCtrl.includes("entityType: 'intl-scholarship'"), 'SEO-P5-INTLSCH hook: correct entity type');

  const activeDoc = { slug: 'uk-masters', status: 'active', title: 'UK Masters' };
  check(isSeoEntityIndexable(SEO_ENTITY_TYPES.INTL_SCHOLARSHIP, activeDoc)
    === isIntlScholarshipDetailEligible(activeDoc),
    'SEO-P5-INTLSCH-07: uses isIntlScholarshipDetailEligible via isSeoEntityIndexable');

  const draftToActive = evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.INTL_SCHOLARSHIP,
    previous: { slug: 'uk-masters', status: 'draft', title: 'UK Masters' },
    next: activeDoc,
  });
  check(draftToActive.urls[0] === '/intl-scholarships/uk-masters', 'SEO-P5-INTLSCH-01: draft → active');

  const meaningful = evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.INTL_SCHOLARSHIP,
    previous: activeDoc,
    next: { ...activeDoc, description: 'Updated details' },
  });
  check(meaningful.action === SEO_CHANGE_ACTION.URL_UPDATED, 'SEO-P5-INTLSCH-02: active meaningful edit');

  const slugChange = evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.INTL_SCHOLARSHIP,
    previous: activeDoc,
    next: { ...activeDoc, slug: 'uk-masters-2026' },
  });
  check(
    slugChange.urls.includes('/intl-scholarships/uk-masters')
      && slugChange.urls.includes('/intl-scholarships/uk-masters-2026'),
    'SEO-P5-INTLSCH-03: active slug change notifies old + new'
  );

  const closed = evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.INTL_SCHOLARSHIP,
    previous: activeDoc,
    next: { ...activeDoc, status: 'closed' },
  });
  check(closed.urls[0] === '/intl-scholarships/uk-masters', 'SEO-P5-INTLSCH-04: active → closed');

  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.INTL_SCHOLARSHIP,
    previous: { slug: 'draft-only', status: 'draft' },
    action: 'delete',
  }).action === SEO_CHANGE_ACTION.NO_OP, 'SEO-P5-INTLSCH-05: never-public delete');

  check(evaluateSeoChange({
    entityType: SEO_ENTITY_TYPES.INTL_SCHOLARSHIP,
    previous: activeDoc,
    action: 'delete',
  }).action === SEO_CHANGE_ACTION.URL_REMOVED, 'SEO-P5-INTLSCH-06: previously-public delete');
}

// SEO-P5 fire-and-forget rejection safety
{
  resetSeoNotificationSuppressCacheForTests();
  setIndexNowFetchForTests(async () => { throw new Error('boom'); });
  const savedEnv = {
    NODE_ENV: process.env.NODE_ENV,
    INDEXNOW_ENABLED: process.env.INDEXNOW_ENABLED,
    INDEXNOW_KEY: process.env.INDEXNOW_KEY,
    SITE_URL: process.env.SITE_URL,
  };
  Object.assign(process.env, PROD_ENV);
  let unhandled = false;
  const handler = () => { unhandled = true; };
  process.on('unhandledRejection', handler);
  try {
    await notifySeoChange({
      entityType: SEO_ENTITY_TYPES.BLOG,
      previous: { slug: 'x', status: 'published' },
      next: { slug: 'x', status: 'published', content: 'changed' },
    });
    await new Promise((r) => setTimeout(r, 50));
  } finally {
    process.env.NODE_ENV = savedEnv.NODE_ENV;
    process.env.INDEXNOW_ENABLED = savedEnv.INDEXNOW_ENABLED;
    process.env.INDEXNOW_KEY = savedEnv.INDEXNOW_KEY;
    process.env.SITE_URL = savedEnv.SITE_URL;
    process.removeListener('unhandledRejection', handler);
    resetIndexNowFetchForTests();
  }
  check(unhandled === false, 'SEO-P5 fire-and-forget: no unhandled rejection');
}

console.log(`seoP5FreshnessIndexNow: ${count} checks passed`);
