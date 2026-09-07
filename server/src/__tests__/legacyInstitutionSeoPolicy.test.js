import test from 'node:test';
import assert from 'node:assert/strict';
import { isLegacyInstitutionIndexable } from '../../../shared/seo/legacyInstitutionSeoPolicy.js';
import fs from 'node:fs/promises';

const strong = {
  status: 'active',
  slug: 'verified-college',
  name: 'Verified College',
  website: 'https://college.example.edu',
  country: 'Pakistan',
  province: 'Punjab',
  city: 'Lahore',
  description: 'A substantive official profile describing the institution, its location, and the education services it provides to students.',
};

test('legacy placeholder-quality records are not sitemap/detail indexable', () => {
  assert.equal(isLegacyInstitutionIndexable({ status: 'active', slug: 'sdn', name: 'akdsna', city: 'lhr', province: 'aksd' }), false);
  assert.equal(isLegacyInstitutionIndexable({ ...strong, website: '' }), false);
  assert.equal(isLegacyInstitutionIndexable({ ...strong, description: '', programs: [] }), false);
});

test('strong legacy records remain compatible when they have conservative evidence', () => {
  assert.equal(isLegacyInstitutionIndexable(strong), true);
  assert.equal(isLegacyInstitutionIndexable({ ...strong, status: 'draft' }), false);
  assert.equal(isLegacyInstitutionIndexable({ ...strong, website: 'not-a-url' }), false);
});

test('SEO wiring uses the shared policy and weak details are noindex-follow', async () => {
  const sitemap = await fs.readFile(new URL('../controllers/seoController.js', import.meta.url), 'utf8');
  const detail = await fs.readFile(new URL('../../../client/src/pages/SchoolsAndColleges/InstitutionDetail.jsx', import.meta.url), 'utf8');
  const prerender = await fs.readFile(new URL('../../../scripts/prerender-seo.mjs', import.meta.url), 'utf8');
  assert.match(sitemap, /isLegacyInstitutionIndexable/);
  assert.match(detail, /noindex=\{item\.seoIndexable === false\}/);
  assert.match(detail, /noindex, follow/);
  assert.match(prerender, /path: '\/schools-and-colleges'/);
  assert.match(prerender, /path: '\/institutions'/);
});
