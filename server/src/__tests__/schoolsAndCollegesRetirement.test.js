import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');

test('Schools & Colleges retirement removes active discovery while preserving routes', () => {
  const footer = read('client/src/components/layout/Footer.jsx');
  const sitemap = read('client/src/pages/Static/HumanSitemap.jsx');
  const explorer = read('client/src/pages/Education/InstitutionExplorer.jsx');
  const acquisition = read('client/src/pages/Public/InstitutionAcquisition.jsx');
  const registry = read('shared/pageRegistry.js');
  const staticPaths = read('shared/seo/publicIndexablePages.js');
  const prerender = read('scripts/prerender-seo.mjs');
  const seo = read('server/src/controllers/seoController.js');
  const routes = read('server/src/routes/institutions.js');
  const clientRoutes = read('client/src/routes/index.jsx');
  const list = read('client/src/pages/SchoolsAndColleges/SchoolsAndColleges.jsx');
  const detail = read('client/src/pages/SchoolsAndColleges/InstitutionDetail.jsx');
  const university = read('client/src/pages/Education/InstitutionExplorer.jsx');

  assert.doesNotMatch(footer, /ROUTES\.SCHOOLS_AND_COLLEGES/);
  assert.doesNotMatch(sitemap, /ROUTES\.SCHOOLS_AND_COLLEGES/);
  assert.doesNotMatch(explorer, /Link to=\{ROUTES\.SCHOOLS_AND_COLLEGES\}/);
  assert.doesNotMatch(acquisition, /ROUTES\.SCHOOLS_AND_COLLEGES/);
  assert.match(registry, /route: '\/schools-and-colleges'[\s\S]{0,180}seoEnabled: false[\s\S]{0,80}searchable: false/);
  assert.doesNotMatch(staticPaths, /'\/schools-and-colleges'/);
  assert.match(prerender, /path: '\/schools-and-colleges'[\s\S]{0,260}robots: 'noindex, follow'/);
  assert.doesNotMatch(seo, /addUrl\(`\/schools-and-colleges\/\$\{i\.slug\}/);
  assert.match(routes, /get\('\/schools-and-colleges'/);
  assert.match(routes, /get\('\/schools-and-colleges\/:slug'/);
  assert.match(clientRoutes, /ROUTES\.SCHOOLS_AND_COLLEGES/);
  assert.match(clientRoutes, /InstitutionDetail/);
  assert.match(list, /noindex/);
  assert.match(detail, /robots="noindex, follow"/);
  assert.match(university, /ROUTES\.EDUCATION_INSTITUTIONS/);
});

test('retired legacy institutions are excluded from public search mapping', async () => {
  const { mapLegacyInstitutionToSearchDocument } = await import('../services/search/documentMappers.js');
  assert.equal(mapLegacyInstitutionToSearchDocument({ _id: 'legacy-1', status: 'active', slug: 'example' }), null);
});
