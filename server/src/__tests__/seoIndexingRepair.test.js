import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEO_ROUTES } from '../../../scripts/prerender-seo.mjs';
import { renderSeoShell } from '../../../shared/seo/jobHtmlShell.js';
import { INDEXABLE_STATIC_PATHS } from '../../../shared/seo/publicIndexablePages.js';
import { getApiRobots } from '../controllers/seoController.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const baseHtml = readFileSync(path.join(repo, 'client/index.html'), 'utf8');
const vercel = JSON.parse(readFileSync(path.join(repo, 'client/vercel.json'), 'utf8'));
const seoHead = readFileSync(path.join(repo, 'client/src/components/seo/SeoHead.jsx'), 'utf8');

const legal = [
  ['/privacy-policy', 'https://www.strideto.com/privacy-policy'],
  ['/cookie-policy', 'https://www.strideto.com/cookie-policy'],
  ['/refund-policy', 'https://www.strideto.com/refund-policy'],
];

for (const [routePath, canonical] of legal) {
  const route = SEO_ROUTES.find((item) => item.path === routePath);
  assert.ok(route, `${routePath} is in the prerender route list`);
  const html = renderSeoShell(baseHtml, route);
  assert.match(html, new RegExp(`href="${canonical.replaceAll('.', '\\.') }"`));
  assert.doesNotMatch(html, /href="https:\/\/www\.strideto\.com\/"\s*\/>/);
  assert.match(html, /name="robots"[^>]+content="index, follow"/);
  assert.match(html, /<main data-seo-shell="page">[\s\S]+<h1>/);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
}

assert.ok(!INDEXABLE_STATIC_PATHS.includes('/cookies'), 'legacy cookies route is absent from sitemap policy');
assert.ok(INDEXABLE_STATIC_PATHS.includes('/cookie-policy'), 'canonical cookie route remains indexable');
assert.ok(INDEXABLE_STATIC_PATHS.includes('/privacy-policy'), 'privacy route remains indexable');
assert.ok(INDEXABLE_STATIC_PATHS.includes('/refund-policy'), 'refund route remains indexable');
assert.ok(INDEXABLE_STATIC_PATHS.every((item) => !item.includes('?')), 'sitemap paths contain no query strings');
assert.ok(INDEXABLE_STATIC_PATHS.every((item) => !item.startsWith('http')), 'sitemap paths are relative/canonicalized');
assert.ok(INDEXABLE_STATIC_PATHS.includes('/'), 'public root remains indexable');
assert.ok(INDEXABLE_STATIC_PATHS.every((item) => !item.includes('api.strideto.com')), 'API root is absent from sitemap policy');
assert.equal(vercel.redirects?.find((item) => item.source === '/cookies')?.destination, '/cookie-policy');
assert.equal(vercel.redirects?.find((item) => item.source === '/cookies')?.permanent, true);
assert.doesNotMatch(seoHead, /buildAlternateUrls\(canonical\)/, 'query-based alternates are not emitted automatically');

const headers = {};
let body = '';
getApiRobots({}, {
  setHeader(name, value) { headers[name] = value; },
  type() { return this; },
  send(value) { body = value; },
});
assert.equal(headers['X-Robots-Tag'], 'noindex, nofollow');
assert.match(body, /Disallow: \/\n/);
assert.doesNotMatch(body, /Sitemap:/);

console.log('seoIndexingRepair.test.js: all assertions passed');
