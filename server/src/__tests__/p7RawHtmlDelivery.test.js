/** MKT-P7 raw HTML SEO delivery contract. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { renderSeoShell, SEO_ROUTES, SEO_ORIGIN } from '../../../scripts/prerender-seo.mjs';

const read = (file) => fs.readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');

test('Vercel runs SEO build and preserves existing rewrites', () => {
  const vercel = JSON.parse(read('client/vercel.json'));
  assert.equal(vercel.buildCommand, 'npm run build:seo');
  assert.equal(vercel.outputDirectory, 'dist');
  assert.ok(vercel.rewrites.some((r) => r.source === '/sitemap.xml' && r.destination.includes('/sitemap.xml')));
  assert.ok(vercel.rewrites.some((r) => r.source === '/indexnow-key.txt' && r.destination.includes('/indexnow-key.txt')));
  assert.ok(vercel.rewrites.some((r) => r.destination === '/index.html'));
  assert.match(read('client/package.json'), /"build:seo": "vite build && node \.\.\/scripts\/prerender-seo\.mjs"/);
});

test('P7 shells are route-specific, canonical, and network-free', () => {
  const paths = SEO_ROUTES.map((route) => route.path);
  for (const route of ['/tests', '/tests/compare', '/tests/ielts', '/tests/toefl-ibt', '/tests/pte-academic', '/tests/duolingo-english-test', '/tests/gre', '/tests/gmat', '/exam-prep']) {
    assert.ok(paths.includes(route), `manifest contains ${route}`);
  }
  const base = '<html><head><meta content="generic" data-rh="true" name="description"><meta content="index, follow" name="robots"><title data-rh="true">Generic</title><link href="https://old.example/" data-rh="true" rel="canonical" /></head></html>';
  const ielts = renderSeoShell(base, SEO_ROUTES.find((route) => route.path === '/tests/ielts'));
  assert.match(ielts, /<title data-rh="true">/);
  assert.match(ielts, /<title data-rh="true">IELTS Guide/);
  assert.match(ielts, /name="description" data-rh="true" content="[^"]*IELTS/);
  assert.match(ielts, /name="robots" data-rh="true" content="index, follow"/);
  assert.match(ielts, new RegExp(`rel="canonical" data-rh="true" href="${SEO_ORIGIN}/tests/ielts"`));
  assert.equal((ielts.match(/rel="canonical"/g) || []).length, 1);
  assert.doesNotMatch(ielts, /old\.example/);
  assert.match(ielts, /name="description" data-rh="true"/);
  const legacy = renderSeoShell(base, SEO_ROUTES.find((route) => route.path === '/exam-prep'));
  assert.match(legacy, /name="robots" data-rh="true" content="noindex, follow"/);
  assert.doesNotMatch(legacy, /name="robots"[^>]*content="index, follow"/);
  assert.doesNotMatch(legacy, /rel="canonical"/);
  assert.doesNotMatch(read('scripts/prerender-seo.mjs'), /\b(?:fetch|mongoose)\s*\(|from\s+['"]mongoose['"]/i);
});

test('static metadata uses the application Helmet reconciliation shape', () => {
  const seoHead = read('client/src/components/seo/SeoHead.jsx');
  const indexHtml = read('client/index.html');
  const hub = SEO_ROUTES.find((route) => route.path === '/tests');
  const compare = SEO_ROUTES.find((route) => route.path === '/tests/compare');
  assert.match(seoHead, /react-helmet-async/);
  assert.match(indexHtml, /name="description"[^>]*data-rh="true"/);
  assert.match(indexHtml, /name="robots"[^>]*data-rh="true"/);
  assert.match(indexHtml, /property="og:url"[^>]*data-rh="true"/);
  assert.match(renderSeoShell('<html><head></head></html>', hub), /International tests for study, admissions and career pathways\./);
  assert.match(renderSeoShell('<html><head></head></html>', compare), /Compare international English-proficiency and graduate-admissions tests/);
  const hydratedShape = renderSeoShell('<html><head><meta content="old" name="description"><meta name="robots" content="index, follow"><link rel="canonical" href="https://old.example/" /></head></html>', hub);
  assert.equal((hydratedShape.match(/name="description"/g) || []).length, 1);
  assert.equal((hydratedShape.match(/name="robots"/g) || []).length, 1);
  assert.equal((hydratedShape.match(/rel="canonical"/g) || []).length, 1);
});

test('generated shell routes precede the generic SPA fallback', () => {
  const vercel = JSON.parse(read('client/vercel.json'));
  const fallback = vercel.rewrites.findIndex((r) => r.destination === '/index.html');
  for (const route of ['/tests', '/tests/compare', '/tests/ielts', '/tests/toefl-ibt', '/tests/pte-academic', '/tests/duolingo-english-test', '/tests/gre', '/tests/gmat', '/exam-prep']) {
    const index = vercel.rewrites.findIndex((r) => r.source === route);
    assert.ok(index >= 0 && index < fallback, `${route} precedes SPA fallback`);
  }
  assert.ok(vercel.rewrites.some((r) => r.source === '/exam-prep/:path*' && r.destination === '/exam-prep/index.html'));
  for (const source of ['/exam-prep', '/exam-prep/:path*']) {
    const legacyHeader = vercel.headers.find((rule) => rule.source === source);
    assert.equal(legacyHeader.headers.find((h) => h.key === 'X-Robots-Tag')?.value, 'noindex, follow');
  }
});
