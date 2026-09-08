import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPublicJobMongoFilter, isPubliclyListableJob } from '../../../shared/publicDiscovery/publicTruth.js';
import { mapJobToSearchDocument } from '../services/search/documentMappers.js';
import { buildQuery } from '../controllers/admin/adminJobsController.js';
import { buildPublicInternshipFilter } from '../controllers/internshipsController.js';

const now = new Date('2026-09-08T12:00:00.000Z');
const future = new Date('2026-09-09T12:00:00.000Z');
const past = new Date('2026-09-07T12:00:00.000Z');

const base = {
  _id: '507f1f77bcf86cd799439011',
  status: 'active',
  approvalStatus: 'approved',
  publicationState: 'active',
  launchEligible: true,
};

assert.equal(isPubliclyListableJob({ ...base, deadline: future }, now), true, 'future deadline is public');
assert.equal(isPubliclyListableJob({ ...base, deadline: past }, now), false, 'past deadline is not public');
assert.equal(isPubliclyListableJob({ ...base, type: 'internship', deadline: past }, now), false, 'expired internship is not public');
assert.equal(isPubliclyListableJob({ ...base }, now), true, 'missing deadline preserves existing public behavior');
assert.ok(JSON.stringify(buildPublicInternshipFilter({ now })).includes('deadline'), 'internship public filter contains deadline guard');

const publicFilter = buildPublicJobMongoFilter({ now });
assert.ok(JSON.stringify(publicFilter).includes('deadline'), 'public Mongo filter contains deadline guard');
assert.ok(JSON.stringify(publicFilter).includes('applicationsCloseAt'), 'public Mongo filter contains close guard');

const indexedExpired = mapJobToSearchDocument({ ...base, deadline: past });
const indexedFuture = mapJobToSearchDocument({ ...base, deadline: future });
assert.equal(indexedExpired.searchable, false, 'expired job is not newly searchable');
assert.equal(indexedFuture.searchable, true, 'future job remains searchable');

const expiredQuery = buildQuery({ status: 'expired' }, now);
assert.equal(expiredQuery.status, undefined, 'Expired admin filter does not invent a Job status enum');
assert.equal(JSON.stringify(expiredQuery).includes('deadline'), true, 'Expired admin filter uses deadline');
const activeQuery = buildQuery({ status: 'active' }, now);
assert.equal(JSON.stringify(activeQuery).includes('deadline'), true, 'Active admin filter excludes past deadlines');

const jobsController = readFileSync('server/src/controllers/jobsController.js', 'utf8');
const recommendations = readFileSync('server/src/controllers/recommendationsController.js', 'utf8');
const searchService = readFileSync('server/src/services/search/SearchIndexService.js', 'utf8');
const seoController = readFileSync('server/src/controllers/seoController.js', 'utf8');
const adminPage = readFileSync('client/src/pages/Admin/AdminContentJobs.jsx', 'utf8');
const internshipsController = readFileSync('server/src/controllers/internshipsController.js', 'utf8');
const trendingController = readFileSync('server/src/controllers/trendingController.js', 'utf8');
const monetizationController = readFileSync('server/src/controllers/monetizationController.js', 'utf8');
const publicProfileController = readFileSync('server/src/controllers/publicProfileController.js', 'utf8');
const dynamicContentService = readFileSync('server/src/services/dynamicContent/DynamicContentService.js', 'utf8');
const relatedContentService = readFileSync('server/src/services/search/RelatedContentService.js', 'utf8');

assert.match(jobsController, /buildPublicJobFilter\(\)/, 'public detail uses non-historical filter');
assert.match(recommendations, /Job\.find\(buildPublicJobMongoFilter\(\)\)/, 'recommendations use public expiry filter');
assert.match(searchService, /removeExpiredPublicJobDocuments/, 'public search rechecks live job visibility');
assert.match(seoController, /\.\.\.buildPublicJobFilter\(\)/, 'SEO job feeds use public expiry filter');
assert.match(adminPage, /value: 'expired'/, 'admin UI exposes Expired filter');
assert.match(internshipsController, /buildPublicInternshipFilter/, 'internships use deadline filter for list/detail/related');
assert.match(trendingController, /buildPublicJobMongoFilter/, 'trending uses public expiry filter');
assert.match(monetizationController, /buildPublicJobMongoFilter/, 'featured/sponsored uses public expiry filter');
assert.match(publicProfileController, /buildPublicJobMongoFilter/, 'public profiles use public expiry filter');
assert.match(dynamicContentService, /buildPublicJobMongoFilter/, 'dynamic content uses public expiry filter');
assert.match(relatedContentService, /removeExpired|buildPublicJobMongoFilter/, 'related content rechecks public expiry');

console.log('job expiry lifecycle tests: 22 passed');
