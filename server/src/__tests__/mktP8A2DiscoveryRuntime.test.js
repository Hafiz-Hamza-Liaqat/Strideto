import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { handler } from '../../../client/api/seo/entity.js';
import { buildEntityDiscovery, buildEntityJsonLd, renderEntitySeoShell } from '../../../shared/seo/entityDiscovery.js';

const baseHtml = '<!doctype html><html><head><title>STRIDETO</title><meta name="description" content="Generic"><meta name="robots" content="index, follow"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';

function response(status, body, headers = {}) {
  return { ok: status >= 200 && status < 300, status, text: async () => body, json: async () => JSON.parse(body), headers };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[key] = value; },
    end(body = '') { this.body = body; },
  };
}

const originalFetch = globalThis.fetch;
try {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/index.html')) return response(200, baseHtml);
    return response(200, JSON.stringify({
      type: 'blog',
      slug: 'safe-post',
      title: '</script><script>alert(1)</script>',
      description: 'A & useful <summary>',
      excerpt: 'A & useful <summary>',
      facts: [{ label: 'Category', value: 'Career' }],
      author: 'Author',
      publishedAt: '2026-01-01',
    }));
  };
  const res = mockRes();
  await handler({ method: 'GET', query: { type: 'blog', slug: 'safe-post' } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /<title>&lt;\/script&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/title>/);
  assert.match(res.body, /https:\/\/www\.strideto\.com\/blog\/safe-post/);
  assert.match(res.body, /id="seo-discovery"/);
  assert.match(res.body, /A &amp; useful &lt;summary&gt;/);
  assert.doesNotMatch(res.body, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(res.body, /<meta name="robots" content="index">/);
  assert.ok(calls.some((url) => url.endsWith('/index.html')));
  assert.ok(calls.some((url) => url.includes('/api/seo/entity/blog/safe-post')));
  assert.equal(res.headers['Content-Type'], 'text/html; charset=utf-8');

  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/index.html')) return response(200, baseHtml);
    return response(404, JSON.stringify({ error: 'not found' }));
  };
  const missing = mockRes();
  await handler({ method: 'GET', query: { type: 'scholarship', slug: 'missing' } }, missing);
  assert.equal(missing.statusCode, 404);
  assert.match(missing.body, /Content not found/);
  assert.match(missing.body, /noindex, follow/);
  assert.doesNotMatch(missing.body, /rel="canonical"/);
  assert.doesNotMatch(missing.body, /application\/ld\+json/);

  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/index.html')) return response(200, baseHtml);
    return response(500, JSON.stringify({ error: 'backend failure' }));
  };
  const failed = mockRes();
  await handler({ method: 'GET', query: { type: 'blog', slug: 'safe-post' } }, failed);
  assert.equal(failed.statusCode, 502);
  assert.equal(failed.headers['Cache-Control'], 'no-store');

  for (const type of ['scholarship', 'institution', 'test', 'program']) {
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('/index.html')) return response(200, baseHtml);
      return response(200, JSON.stringify({ type, slug: 'safe-post', name: `Safe ${type}`, description: `Public ${type}` }));
    };
    const successfulType = mockRes();
    await handler({ method: 'GET', query: { type, slug: 'safe-post' } }, successfulType);
    assert.equal(successfulType.statusCode, 200, `${type} SEO success`);
    assert.match(successfulType.body, /id="seo-discovery"/);
  }

  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/index.html')) return response(200, baseHtml);
    return response(200, '{not-json');
  };
  const malformed = mockRes();
  await handler({ method: 'GET', query: { type: 'blog', slug: 'safe-post' } }, malformed);
  assert.equal(malformed.statusCode, 502);
  assert.equal(malformed.headers['Cache-Control'], 'no-store');

  const method = mockRes();
  await handler({ method: 'POST', query: { type: 'blog', slug: 'safe-post' } }, method);
  assert.equal(method.statusCode, 405);
  const invalid = mockRes();
  await handler({ method: 'GET', query: { type: 'private', slug: 'safe-post' } }, invalid);
  assert.equal(invalid.statusCode, 404);

  const schema = buildEntityJsonLd('program', {
    slug: 'data-science', name: 'Data Science', description: 'A program', institutionName: 'Example University', degreeLevel: 'master', durationMonths: 24,
  });
  assert.equal(schema['@type'], 'Course');
  const safeShell = renderEntitySeoShell(baseHtml, {
    title: 'Safe', description: 'Safe', robots: 'index, follow', canonical: 'https://www.strideto.com/blog/safe', heading: 'Safe', summary: 'Safe', facts: [], jsonLd: { '@type': 'BlogPosting', description: '</script>' },
  });
  assert.doesNotMatch(safeShell, /<\/script>"?\s*<script/);
  assert.match(safeShell, /\\u003C\/script\\u003E/);
  for (const type of ['scholarship', 'blog', 'institution', 'test', 'program']) {
    const discovery = buildEntityDiscovery(type, { slug: 'known', name: 'Known entity', description: 'Public summary' });
    assert.equal(discovery.status, 'public');
    const prefix = { scholarship: 'scholarships', blog: 'blog', institution: 'institutions', test: 'tests', program: 'program-explorer' }[type];
    assert.equal(discovery.canonical, `https://www.strideto.com/${prefix}/known`);
    assert.equal(buildEntityJsonLd(type, { slug: 'known', name: 'Known entity', description: 'Public summary' })['@context'], 'https://schema.org');
  }
  assert.equal(buildEntityDiscovery('blog', { slug: 'bad slug', name: 'No route' }), null);
  const vercel = JSON.parse(readFileSync(new URL('../../../client/vercel.json', import.meta.url), 'utf8'));
  const compareIndex = vercel.rewrites.findIndex((rule) => rule.source === '/tests/compare');
  const testDetailIndex = vercel.rewrites.findIndex((rule) => rule.source === '/tests/:slug');
  assert.ok(compareIndex >= 0 && compareIndex < testDetailIndex);
  const seoRules = new Map(vercel.rewrites.map((rule) => [rule.source, rule.destination]));
  assert.equal(seoRules.get('/jobs/:slug'), '/api/seo/jobs?slug=:slug');
  assert.equal(seoRules.get('/scholarships/:slug'), '/api/seo/entity?type=scholarship&slug=:slug');
  assert.equal(seoRules.get('/blog/:slug'), '/api/seo/entity?type=blog&slug=:slug');
  assert.equal(seoRules.get('/institutions/:slug'), '/api/seo/entity?type=institution&slug=:slug');
  assert.equal(seoRules.get('/tests/:slug'), '/api/seo/entity?type=test&slug=:slug');
  assert.equal(seoRules.get('/program-explorer/:slug'), '/api/seo/entity?type=program&slug=:slug');
  const catchAllIndex = vercel.rewrites.findIndex((rule) => rule.destination === '/index.html' && rule.source.includes('((?!assets/).*)'));
  assert.ok(catchAllIndex > testDetailIndex);
  assert.ok(catchAllIndex > vercel.rewrites.findIndex((rule) => rule.source === '/jobs/:slug'));
  assert.ok(catchAllIndex > vercel.rewrites.findIndex((rule) => rule.source === '/program-explorer/:slug'));
  assert.equal(readFileSync(new URL('../../../client/api/seo/jobs.js', import.meta.url), 'utf8').includes("req.query?.slug"), true);
  assert.equal(readFileSync(new URL('../../../client/api/seo/entity.js', import.meta.url), 'utf8').includes("req.query?.type"), true);
  assert.equal(readFileSync(new URL('../../../client/api/seo/entity.js', import.meta.url), 'utf8').includes("req.query?.slug"), true);
  assert.equal(existsSync(new URL('../../../client/api/seo/jobs/[slug].js', import.meta.url)), false, 'obsolete dynamic Job handler removed');
  assert.equal(existsSync(new URL('../../../client/api/seo/entity/[type]/[slug].js', import.meta.url)), false, 'obsolete dynamic Entity handler removed');
  const seoController = readFileSync(new URL('../controllers/seoController.js', import.meta.url), 'utf8');
  assert.match(seoController, /if \(doc\) entity = \{/);
  assert.doesNotMatch(seoController, /entity = \{\.\.\.doc/);
  assert.match(seoController, /findLocalizedBySlug\(Blog, slug, \{ status: 'published' \}/);
  assert.match(seoController, /Test\.findOne\(\{ slug, status: PUB_STATUSES\.PUBLISHED \}\)/);
  assert.match(seoController, /isTestPubliclyPromotable\(doc\)/);
  assert.match(seoController, /withFixtureExclusion\(\{ status: 'active' \}\)/);
  assert.match(seoController, /withFixtureExclusion\(\{ slug, status: PUB_STATUSES\.PUBLISHED \}\)/);
  assert.doesNotMatch(vercel.rewrites.map((rule) => rule.source).join('\n'), /\/api/);
  console.log('mktP8A2DiscoveryRuntime: 45 checks passed');
} finally {
  globalThis.fetch = originalFetch;
}
