/** MKT-P7-A canonical Tests and legacy exam isolation contracts. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INDEXABLE_STATIC_PATHS } from '../../../shared/seo/publicIndexablePages.js';
import { isPrivateSeoPath } from '../../../shared/seo/robotsPolicy.js';
import { isTestPubliclyPromotable } from '../../../shared/education/testPublicationPolicy.js';
import { mapTestToSearchDocument } from '../../../server/src/services/search/documentMappers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const root = path.resolve(clientSrc, '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const check = (condition, message) => assert.ok(condition, message);

const nav = read('client/src/components/layout/navConfig.js');
const footer = read('client/src/components/layout/Footer.jsx');
const home = read('client/src/pages/Home/Home.jsx');
const career = read('client/src/pages/CareerGuidance/CareerGuidance.jsx');
const dashboard = read('client/src/pages/Dashboard/LegacyDashboard.jsx');
const sitemap = read('client/src/pages/Static/HumanSitemap.jsx');
const legacyAdmin = read('client/src/pages/Admin/AdminExamPreparation.jsx');
const adminRoutes = read('server/src/routes/admin.js');
const examPage = read('client/src/pages/ExamPrep/ExamPrep.jsx');
const testHub = read('client/src/pages/Tests/TestHub.jsx');
const robots = read('client/public/robots.txt');
const staticIndex = read('shared/seo/publicIndexablePages.js');
const seoController = read('server/src/controllers/seoController.js');
const searchHooks = read('server/src/utils/searchIndexHooks.js');
const searchIndexer = read('server/src/services/search/SearchIndexer.js');

check(INDEXABLE_STATIC_PATHS.includes('/tests'), 'P7A-01: /tests remains indexable');
check(!isPrivateSeoPath('/tests'), 'P7A-02: /tests remains public');
check(testHub.includes('International tests for study, admissions and career pathways.'), 'P7A-03: canonical positioning is explicit');
check(testHub.includes('Which test do I need?'), 'P7A-04: core test-selection question is present');
for (const source of [nav, footer, home, career, dashboard, sitemap]) {
  check(!source.includes('ROUTES.EXAM_PREP') || source === dashboard && source.includes('ROUTES.TEST_HUB'), 'P7A-05: discovery surfaces do not promote legacy Exam Prep');
}
check(examPage.includes('legacy exam-preparation content'), 'P7A-06: legacy landing remains truthful and accessible');
check(robots.includes('Disallow: /exam-prep/quiz/'), 'P7A-07: legacy quiz route remains non-indexable');
check(!INDEXABLE_STATIC_PATHS.includes('/exam-prep') && !staticIndex.includes("'/exam-prep'"), 'P7A-08: legacy landing is no longer sitemap-promoted');
check(!seoController.includes('`/exam-prep/${e.slug}`'), 'P7A-09: legacy detail URLs are not sitemap-promoted');
check(legacyAdmin.includes('Deprecated read/archive area'), 'P7A-10: legacy admin is visibly read/archive only');
for (const route of ["adminRouter.post('/exams'", "adminRouter.post('/past-papers'", "adminRouter.post('/mcqs'", "adminRouter.post('/quizzes'"]) {
  check(adminRoutes.includes(`${route}, requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.legacyExamCreationDisabled`), `P7A-11: ${route} creation is frozen`);
}
const provider = { name: 'Official Provider', status: 'active', officialWebsite: 'https://provider.example' };
const eligible = { _id: '1', name: 'IELTS', slug: 'ielts', status: 'published', providerId: provider, sources: [{ sourceType: 'official_test_org', sourceUrl: 'https://provider.example/ielts' }] };
check(isTestPubliclyPromotable(eligible), 'P7A-12: source-backed published test is promotable');
check(!isTestPubliclyPromotable({ ...eligible, status: 'draft' }), 'P7A-13: unpublished test is not promotable');
check(mapTestToSearchDocument(eligible).url === '/tests/ielts', 'P7A-14: canonical Test mapper uses /tests URL');
check(mapTestToSearchDocument({ ...eligible, status: 'draft' }) === null, 'P7A-15: ineligible Test is not indexed');
check(robots.includes('Disallow: /exam-prep/quiz$') && robots.includes('Disallow: /exam-prep/quiz/'), 'P7A-16: quiz URL is private to SEO');
check(searchIndexer.includes("test: Test") && searchIndexer.includes("entityType === 'test'"), 'P7A-17: Test is registered with the indexer');
check(searchHooks.includes("test: 'test'"), 'P7A-18: Test writes use the incremental search hook');
console.log(`mktP7aCanonicalTestFoundation: ${18} checks passed`);
