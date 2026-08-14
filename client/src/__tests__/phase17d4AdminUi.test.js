import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Phase 17D-4 Admin GBS UI contract (no jsdom).
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..');
function read(rel) {
  return readFileSync(path.join(src, rel), 'utf8');
}

const capQueue = read('pages/Admin/AdminGbsCapabilityQueue.jsx');
const capReview = read('pages/Admin/AdminGbsCapabilityReview.jsx');
const listQueue = read('pages/Admin/AdminGbsListingQueue.jsx');
const listReview = read('pages/Admin/AdminGbsListingReview.jsx');
const table = read('components/admin/AdminGbsQueueTable.jsx');
const nav = read('config/adminNavConfig.js');
const routes = read('routes/index.jsx');
const api = read('services/gbsAdminApi.js');
const listings = read('pages/Agent/business-services/GbsListings.jsx');
const editor = read('pages/Agent/business-services/GbsListingEditor.jsx');
const caps = read('pages/Agent/business-services/GbsCapabilities.jsx');

check(nav.includes("id: 'business-services'"), 'Business Services admin nav group');
check(nav.includes("gbsCapabilityReviews") && nav.includes("gbsListingReviews"), 'capability and listing review nav items');
check(routes.includes("path: 'gbs/capabilities/:id'"), 'capability detail route');
check(routes.includes("path: 'gbs/listings/:id'"), 'listing detail route');
check(!routes.includes("path: '/business-services'"), 'no public marketplace navigation');

check(capQueue.includes('AdminRouteGuard') && capQueue.includes('VERIFICATION_READ'), 'capability queue is staff-gated');
check(listQueue.includes('AdminRouteGuard') && listQueue.includes('VERIFICATION_READ'), 'listing queue is staff-gated');
check(capQueue.includes('gbsIndependent') && capQueue.includes('gbsAgency'), 'Independent vs Agency labels');
check(listQueue.includes('gbsIndependent') && listQueue.includes('gbsAgency'), 'listing queue distinguishes subjects');
check(listQueue.includes('gbsApprovedNotPublic'), 'approved is not treated as public');
check(listReview.includes('gbsApprovedNotPublic'), 'listing detail distinguishes approved vs public');

check(capQueue.includes('aria-busy') || table.includes('aria-busy'), 'capability queue loading state');
check(table.includes('emptyLabel') && capQueue.includes('gbsCapabilityEmpty'), 'capability empty state');
check(table.includes('role="alert"') && capQueue.includes('error'), 'queue error state');
check(listQueue.includes('gbsListingEmpty'), 'listing empty state');
check(table.includes('AdminGbsPagination') || capQueue.includes('AdminGbsPagination'), 'pagination present');
check(capQueue.includes('htmlFor') || capQueue.includes('AdminSelect'), 'labelled filters');
check(table.includes('overflow-x-auto') && table.includes('min-w-0'), 'intentional inner table scroll, no body overflow pattern');
check(table.includes('break-words') && capQueue.includes('break-words'), 'long names wrap');
check(capReview.includes('AdminConfirmDialog') && listReview.includes('AdminConfirmDialog'), 'destructive actions use AdminConfirmDialog');
check(capReview.includes('open={Boolean(confirm)}') && listReview.includes('open={Boolean(confirm)}'), 'confirm dialogs default closed');
check(!capReview.includes('window.confirm') && !listReview.includes('window.confirm'), 'no native confirm()');
check(capReview.includes('gbsStaleConflict') && listReview.includes('gbsStaleConflict'), 'stale conflict handling');
check(capReview.includes('gbsEvidenceMetadata'), 'safe evidence metadata section');
check(listReview.includes('gbsStaffActions') && capReview.includes('gbsStaffActions'), 'explicit staff actions');
check(capReview.includes('focus:ring-2') && listReview.includes('min-h-[44px]'), 'visible focus and reachable actions');

check(!/import \{ AdminDataTable \}/.test(capQueue + listQueue), 'does not use protected AdminDataTable');
check(!/import \{ AdminTableFilters \}/.test(capQueue + listQueue), 'does not use protected AdminTableFilters');
check(!capReview.includes('common/FormField') && !listReview.includes('common/FormField'), 'does not use protected FormField');

check(api.includes('/admin/gbs/capabilities/queue') && api.includes('/admin/gbs/listings/queue'), 'admin GBS API client');
check(!api.includes('/business-services'), 'admin API client has no public marketplace paths');

check(listings.includes('adminReviewStatus'), 'provider listings show admin review status');
check(editor.includes('adminReviewStatus'), 'provider editor shows admin review status');
check(caps.includes('Staff review:'), 'provider capability review state is visible');
check(!listings.includes('Publish') && !editor.includes('Publish'), 'provider still has no publish control');

console.log(`phase17d4AdminUi.test.js: ${count} assertions passed`);
