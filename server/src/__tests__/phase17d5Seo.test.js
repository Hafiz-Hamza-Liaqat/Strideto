/**
 * Phase 17D-5 — public marketplace SEO / sitemap / robots contract.
 * Run: node src/__tests__/phase17d5Seo.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { INDEXABLE_STATIC_PATHS, isForbiddenSitemapPath } from '../../../shared/seo/publicIndexablePages.js';
import { isPrivateSeoPath } from '../../../shared/seo/robotsPolicy.js';
import { isBusinessServicesPublicMarketplaceEnabled } from '../../../shared/gbs/constants.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

check(isBusinessServicesPublicMarketplaceEnabled({}) === false, 'SEO default marketplace OFF');
check(!INDEXABLE_STATIC_PATHS.includes('/business-services'), 'hub is not a static always-on indexable path');
check(isForbiddenSitemapPath('/business-services') === false, 'eligible hub is not a forbidden sitemap path');
check(isForbiddenSitemapPath('/business-services/wyoming-llc') === false, 'eligible listing path is not forbidden');
check(isPrivateSeoPath('/business-services') === false, 'public hub is not a private SEO prefix');
check(isPrivateSeoPath('/agent/business-services') === true, 'provider workspace remains private SEO');

const controller = read('server/src/controllers/seoController.js');
check(controller.includes('listEligibleMarketplaceSitemapPaths'), 'sitemap generator calls live GBS eligibility');
check(controller.includes('gbsPaths.forEach'), 'eligible GBS paths are added only from the helper');

const helper = read('server/src/services/gbs/gbsMarketplaceService.js');
check(helper.includes('if (!marketplaceEnabled(env)) return []'), 'flag OFF yields no GBS sitemap URLs');
check(helper.includes("paths = ['/business-services']"), 'flag ON includes hub');
check(helper.includes('isEligible(row'), 'every sitemap listing re-runs live eligibility');
check(!helper.includes("publicationStatus: 'public'"), 'sitemap does not treat stored public status as authority');

const hub = read('client/src/pages/Public/BusinessServicesMarketplace.jsx');
check(hub.includes('<SeoHead'), 'hub has SeoHead');
check(hub.includes('canonical={ROUTES.BUSINESS_SERVICES}'), 'hub canonical');
check(hub.includes('collectionPageSchema'), 'hub collection JSON-LD');
check(hub.includes('noindex'), 'loading/unavailable hub uses noindex');

const detail = read('client/src/pages/Public/BusinessServicesListingDetail.jsx');
check(detail.includes('<SeoHead'), 'detail has SeoHead');
check(detail.includes('canonical={canonical}'), 'detail canonical');
check(detail.includes("title={`${item.title} | Strideto`}"), 'detail title');
check(!/AggregateRating|aggregateRating/.test(detail), 'no fake ratings structured data');
check(detail.includes("'@type': 'Offer'"), 'Offer JSON-LD exists for real priced listings');
check(detail.includes("kind === 'quote_required'"), 'quote_required does not invent Offer price');
check(detail.includes('noindex'), 'missing listing is noindex via NotFound/loading');

const robots = read('client/public/robots.txt');
check(!/Allow:\s*\/business-services/.test(robots), 'robots does not advertise GBS while committed OFF');
check(!/Disallow:\s*\/business-services$/.test(robots), 'robots does not blanket-disallow a future indexable hub');

const pageReg = read('shared/pageRegistry.js');
check(!/\/business-services/.test(pageReg), 'pageRegistry does not make disabled GBS indexable');

check(!/baseSalary/.test(detail), 'GBS JSON-LD does not invent salary');

console.log(`phase17d5Seo.test.js: ${count} assertions passed`);
