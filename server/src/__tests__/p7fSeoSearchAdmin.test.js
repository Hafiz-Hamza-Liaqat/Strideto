/** P7-F — SEO, canonical Test search, and editorial operations contract. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

test('canonical Test SEO and sitemap policy is explicit', () => {
  const indexable = read('shared/seo/publicIndexablePages.js');
  const sitemap = read('server/src/controllers/seoController.js');
  const hub = read('client/src/pages/Tests/TestHub.jsx');
  const detail = read('client/src/pages/Tests/TestDetail.jsx');
  const compare = read('client/src/pages/Tests/TestCompare.jsx');

  assert.match(indexable, /['"]\/tests['"]/);
  assert.match(indexable, /['"]\/tests\/compare['"]/);
  assert.match(sitemap, /isTestPubliclyPromotable/);
  assert.match(sitemap, /`\/tests\/\$\{t\.slug\}`/);
  assert.match(hub, /ROUTES\.TEST_HUB/);
  assert.match(detail, /ROUTES\.TEST_HUB.*slug/);
  assert.match(compare, /ROUTES\.TEST_COMPARE/);
  assert.doesNotMatch(compare, /ielts-vs-toefl|toefl-vs-pte/);
});

test('legacy exam pages remain directly accessible but are not index-promoted', () => {
  const landing = read('client/src/pages/ExamPrep/ExamPrep.jsx');
  const detail = read('client/src/pages/ExamPrep/ExamDetail.jsx');
  const quiz = read('client/src/pages/ExamPrep/QuizTake.jsx');
  const indexable = read('shared/seo/publicIndexablePages.js');

  assert.match(landing, /noindex/);
  assert.match(detail, /noindex/);
  assert.match(quiz, /noindex/);
  assert.doesNotMatch(indexable, /['"]\/exam-prep['"]/);
});

test('Test-only admin rebuild is explicit and remains server-permission gated', () => {
  const admin = read('client/src/pages/Admin/AdminGlobalSearch.jsx');
  const routes = read('server/src/routes/admin.js');
  assert.match(admin, /adminReindex\(\{ entityType: 'test' \}\)/);
  assert.match(admin, /Rebuild Test Search/);
  assert.match(routes, /post\('\/search\/reindex', requirePermission\(PERMISSIONS\.CONTENT_SITE\)/);
});

test('editorial Test resources already have bounded, authenticated CRUD endpoints', () => {
  const routes = read('server/src/routes/adminEducation.js');
  const controller = read('server/src/controllers/education/adminEducationController.js');
  const prepModel = read('server/src/models/education/TestPrepGuide.js');
  const resourceModel = read('server/src/models/education/ExternalTestResource.js');
  const alertModel = read('server/src/models/education/TestAlert.js');
  assert.match(routes, /prep-guides/);
  assert.match(routes, /resources/);
  assert.match(routes, /alerts/);
  assert.match(controller, /isValidHttpUrl/);
  assert.match(controller, /parseSources/);
  const editorial = read('client/src/pages/Admin/AdminEducationEditorial.jsx');
  const api = read('client/src/services/adminContentApi.js');
  assert.match(editorial, /Test editorial content/);
  assert.match(editorial, /No question authoring/);
  assert.match(api, /educationPrepGuides/);
  assert.match(api, /educationResources/);
  assert.match(api, /educationAlerts/);
  assert.match(editorial, /verifiedAt/);
  assert.match(editorial, /retrievedAt/);
  assert.match(editorial, /nextReviewAt/);
  assert.match(editorial, /Last verified/);
  assert.match(editorial, /Review state/);
  assert.match(editorial, /sourceUrl/);
  assert.match(controller, /Published prep guides require at least one valid source/);
  assert.match(controller, /Published resources require at least one valid source/);
  assert.match(controller, /Published alerts require at least one valid source/);
  assert.match(controller, /parseOptionalReviewDate/);
  assert.match(controller, /deriveEditorialFreshness/);
  assert.match(controller, /nextReviewAt/);
  assert.match(prepModel, /nextReviewAt: \{ type: Date, default: null/);
  assert.match(resourceModel, /nextReviewAt: \{ type: Date, default: null/);
  assert.match(alertModel, /nextReviewAt: \{ type: Date, default: null/);
  assert.doesNotMatch(controller, /body\.freshnessState/);
});
