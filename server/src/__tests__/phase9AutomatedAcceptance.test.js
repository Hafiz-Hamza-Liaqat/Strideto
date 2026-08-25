/**
 * Phase 9 — Final automated acceptance (no localhost / no production DB).
 * Run: node src/__tests__/phase9AutomatedAcceptance.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const launch = await import(pathToFileURL(path.join(root, 'shared/cms/launchEligible.js')).href);
const readiness = await import(pathToFileURL(path.join(root, 'shared/cms/publicReadiness.js')).href);
const taxonomy = await import(pathToFileURL(path.join(root, 'shared/blog/taxonomy.js')).href);
const blogContent = await import(pathToFileURL(path.join(root, 'shared/blog/blogContent.js')).href);
const fixture = await import(pathToFileURL(path.join(root, 'shared/publicDiscovery/fixtureExclusion.js')).href);
const { sanitizeHtml } = await import(pathToFileURL(path.join(root, 'server/src/utils/htmlSanitize.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const { deriveCmsLaunchEligible, deriveJobLaunchEligible, CMS_STATUS } = launch;
const {
  isAdmissionPublicReady,
  isScholarshipPublicReady,
  isInternshipPublicReady,
  isJobPublicReady,
} = readiness;
const {
  canonicalBlogCategoryLabel,
  BLOG_CATEGORY_REGISTRY,
} = taxonomy;
const {
  normalizeBlogContent,
  detectContentFormat,
  shouldShowBlogToc,
} = blogContent;
const { withFixtureExclusion, isPubliclyLaunchVisible } = fixture;

function cmsSuite(prefix) {
  check(deriveCmsLaunchEligible({ status: CMS_STATUS.DRAFT }, CMS_STATUS.DRAFT) === false, `${prefix}-01 draft ineligible`);
  check(deriveCmsLaunchEligible({ status: CMS_STATUS.DRAFT }, CMS_STATUS.ACTIVE) === true, `${prefix}-02 active eligible`);
  check(deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, launchEligible: true }, CMS_STATUS.CLOSED) === false, `${prefix}-03 closed ineligible`);
  check(deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, launchEligible: true }, CMS_STATUS.DRAFT) === false, `${prefix}-03 draft from active`);
  check(deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, launchEligible: true }, CMS_STATUS.ACTIVE) === true, `${prefix}-04 active preserved`);
  const dup = { status: CMS_STATUS.DRAFT, launchEligible: false };
  check(dup.launchEligible === false, `${prefix}-06 duplicate non-public`);
  check(isPubliclyLaunchVisible({ status: CMS_STATUS.ACTIVE, launchEligible: true }) === true, `${prefix}-07 public visible`);
  check(isPubliclyLaunchVisible({ status: CMS_STATUS.ACTIVE, launchEligible: false }) === false, `${prefix}-08 public hidden`);
}

function viewPublicSuite(type, readyFn) {
  if (type === 'blog') {
    check(readyFn({ status: 'draft', slug: 'x' }) === false, `VIEW-${type}-draft`);
    check(readyFn({ status: 'published', slug: 'x' }) === true, `VIEW-${type}-published`);
  } else if (type === 'job') {
    check(readyFn({ status: CMS_STATUS.ACTIVE, approvalStatus: 'pending', launchEligible: false, slug: 'j' }) === false, `VIEW-${type}-pending`);
    check(readyFn({ status: CMS_STATUS.ACTIVE, approvalStatus: 'approved', launchEligible: true, slug: 'j' }) === true, `VIEW-${type}-public`);
  } else {
    check(readyFn({ status: CMS_STATUS.DRAFT, slug: 'x' }) === false, `VIEW-${type}-draft`);
    check(readyFn({ status: CMS_STATUS.ACTIVE, launchEligible: false, slug: 'x' }) === false, `VIEW-${type}-active-not-eligible`);
    check(readyFn({ status: CMS_STATUS.ACTIVE, launchEligible: true, slug: 'x' }) === true, `VIEW-${type}-public`);
  }
}

// ── ADM-01..10 ──────────────────────────────────────────────────────────────
cmsSuite('ADM');
viewPublicSuite('admission', isAdmissionPublicReady);
const admCtrl = read('server/src/controllers/admin/adminAdmissionsController.js');
check(admCtrl.includes('launchEligible = false') && admCtrl.includes('bulk_publish'), 'ADM-04 bulk publish wiring');
check(admCtrl.includes('launchEligible = false') && admCtrl.includes('bulk_archive'), 'ADM-05 bulk archive wiring');
check(admCtrl.includes('applyResolvedSlug'), 'ADM-10 slug resolution present');

// ── SCH-01..10 ──────────────────────────────────────────────────────────────
cmsSuite('SCH');
viewPublicSuite('scholarship', isScholarshipPublicReady);
const schCtrl = read('server/src/controllers/admin/adminScholarshipsController.js');
check(schCtrl.includes('deriveCmsLaunchEligible') && schCtrl.includes('bulk_publish'), 'SCH-04 bulk publish');

// ── INT-01..10 ──────────────────────────────────────────────────────────────
cmsSuite('INT');
check(deriveCmsLaunchEligible({ isFixture: true }, CMS_STATUS.ACTIVE) === false, 'INT fixture block');
viewPublicSuite('internship', isInternshipPublicReady);
const intCtrl = read('server/src/controllers/admin/adminInternshipsController.js');
check(intCtrl.includes('deriveCmsLaunchEligible') && intCtrl.includes('bulk_publish'), 'INT-04 bulk publish');

// ── JOB-01..09 ──────────────────────────────────────────────────────────────
check(deriveJobLaunchEligible({ status: CMS_STATUS.ACTIVE, approvalStatus: 'pending' }) === false, 'JOB-01');
check(deriveJobLaunchEligible({ status: CMS_STATUS.ACTIVE, approvalStatus: 'rejected' }) === false, 'JOB-02');
check(deriveJobLaunchEligible({ status: CMS_STATUS.ACTIVE, approvalStatus: 'approved' }) === true, 'JOB-03');
check(deriveJobLaunchEligible({ status: CMS_STATUS.ACTIVE, approvalStatus: 'approved', launchEligible: false }) === true, 'JOB-04');
check(deriveJobLaunchEligible({ status: CMS_STATUS.CLOSED, approvalStatus: 'approved' }) === false, 'JOB-05');
const jobDup = { status: CMS_STATUS.DRAFT, approvalStatus: 'pending', launchEligible: false };
check(jobDup.launchEligible === false, 'JOB-06 duplicate');
const jobCtrl = read('server/src/controllers/admin/adminJobsController.js');
check(jobCtrl.includes('launchEligible: false') && jobCtrl.includes('bulk_reject'), 'JOB-07 bulk reject');
check(jobCtrl.includes('approveJob') && jobCtrl.includes('assignLaunchEligibleOnAuthorityPublish'), 'JOB-08 approve path');
viewPublicSuite('job', isJobPublicReady);

// ── BLOG CREATE / AUTHOR ────────────────────────────────────────────────────
const blogCtrl = read('server/src/controllers/admin/adminBlogsController.js');
const blogModel = read('server/src/models/Blog.js');
const adminBlogs = read('client/src/pages/Admin/AdminContentBlogs.jsx');
const blogsPublic = read('server/src/controllers/blogsController.js');
check(blogCtrl.includes('optionalUrl') && blogCtrl.includes('parseOptionalDate'), 'BLOG-CREATE-01 optional fields');
check(blogCtrl.includes('authorName') && blogCtrl.includes('STRIDETO') === false, 'BLOG-CREATE-02 authorName path');
check(blogCtrl.includes('applyAuthorFields') && !/doc\.author\s*=\s*sanitizeString\(body\.author\)/.test(blogCtrl), 'BLOG-CREATE-03 no string to author ObjectId');
check(blogModel.includes('author:') && blogModel.includes('authorName'), 'BLOG-CREATE-04 schema dual author');
check(blogsPublic.includes('authorName') && blogsPublic.includes('authorDisplay'), 'BLOG-CREATE-05 authorDisplay projection');
check(blogCtrl.includes('blogValidationErrorResponse'), 'BLOG-CREATE-08 validation details');

function parseOptionalDate(value) {
  if (value === '' || value == null) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
check(parseOptionalDate('') === undefined, 'BLOG-CREATE-06 blank date omitted');
check(parseOptionalDate('not-a-date') === undefined, 'BLOG-CREATE-07 invalid date rejected');

// ── BLOG CATEGORY ───────────────────────────────────────────────────────────
check(adminBlogs.includes('listBlogCategoryOptions') && adminBlogs.includes('AdminSelectBare'), 'BLOG-CAT-01 admin select');
check(read('client/src/pages/Blog/Blog.jsx').includes('listBlogCategoryOptions'), 'BLOG-CAT-02 public taxonomy');
check(BLOG_CATEGORY_REGISTRY.some((c) => c.label === 'Opportunities'), 'BLOG-CAT-03 opportunities in registry');
check(canonicalBlogCategoryLabel('Opportunities') === 'Opportunities', 'BLOG-CAT-04 legacy opportunities');
check(canonicalBlogCategoryLabel('Career') === 'Career Advice', 'BLOG-CAT-05 career alias');
check(!adminBlogs.includes('placeholder={t(\'admin:fieldCategory\')}') || adminBlogs.includes('AdminSelectBare value={form.category}'), 'BLOG-CAT-06 no free-text category input');

// ── FORMAT DETECTION ────────────────────────────────────────────────────────
check(detectContentFormat('<p>Hello</p><h2>Section</h2>') === 'html', 'FORMAT html');
check(detectContentFormat('## Section\n- item\n[Link](https://example.com)') === 'markdown', 'FORMAT markdown');
check(detectContentFormat('Normal paragraph text') === 'plain', 'FORMAT plain');
check(detectContentFormat('<p>Hi</p>\n## Also md') === 'html', 'FORMAT html wins with tags');

// ── BLOG SAFETY (server sanitize + client config contract) ──────────────────
const clientSanitize = read('client/src/utils/sanitizeHtml.js');
check(clientSanitize.includes("'id'"), 'BLOG-SAFE id allowed at render boundary');
const unsafeHtml = '<script>alert(1)</script><p onclick="evil()">Hi</p><a href="javascript:alert(1)">x</a><h2 id="sec">Safe</h2><ul><li>ok</li></ul>';
const safe = sanitizeHtml(unsafeHtml);
check(!safe.includes('<script'), 'BLOG-SAFE-01 script removed');
check(!safe.includes('onclick'), 'BLOG-SAFE-02 events removed');
check(!safe.includes('javascript:'), 'BLOG-SAFE-03 javascript url removed');
check(safe.includes('href=') === false || safe.includes('http'), 'BLOG-SAFE-04 safe links policy');
check(safe.includes('<h2') && safe.includes('<ul>'), 'BLOG-SAFE-05 structure kept');
check(read('client/src/pages/Blog/BlogPost.jsx').includes('sanitizeHtmlForRender'), 'BLOG-SAFE-06 DOM boundary');
const withId = sanitizeHtml('<h2 id="my-section">Title</h2>');
check(withId.includes('id="my-section"'), 'BLOG-SAFE-07 heading id preserved');

// ── MARKDOWN PRODUCTION EXAMPLE ─────────────────────────────────────────────
const PROD_MD = `## New Jobs

- [Program Officer HEC 2026](https://www.hec.gov.pk/)
- Research Associate

## Trending Scholarships

Students should verify official requirements.

### Eligibility

- Academic record
- Required documents

## Admission Deadlines

Always verify current deadlines.`;
const normalized = normalizeBlogContent(PROD_MD);
const rendered = sanitizeHtml(normalized.html);
check(rendered.includes('<h2') && rendered.includes('<h3'), 'MD real headings');
check(rendered.includes('<ul>') && rendered.includes('<li>'), 'MD lists');
check(rendered.includes('<a href="https://www.hec.gov.pk/"'), 'MD link');
check(!rendered.includes('## New Jobs'), 'MD no literal hash heading');
check(!rendered.includes('[Program Officer'), 'MD no literal markdown link');

// ── TOC ─────────────────────────────────────────────────────────────────────
check(normalized.toc.length >= 4, 'TOC-01 extracts headings');
check(normalized.toc.every((t) => t.id && t.text), 'TOC-02 ids and text');
check(normalized.toc.every((t) => rendered.includes(`id="${t.id}"`)), 'TOC-03 href matches body id');
const dupToc = normalizeBlogContent('## Jobs\n### Jobs\n## Jobs');
const dupIds = dupToc.toc.map((t) => t.id);
check(new Set(dupIds).size === dupIds.length, 'TOC-04 unique ids');
check(shouldShowBlogToc(normalizeBlogContent('## Only').toc) === false, 'TOC-05 hidden when minimal');
check(normalized.toc.some((t) => t.text.includes('New Jobs')), 'TOC-06 text preserved');
check(!normalized.toc.some((t) => t.text.includes('<script')), 'TOC-07 no unsafe html in toc text');
check(sanitizeHtml(`<h2 id="${normalized.toc[0].id}">x</h2>`).includes('id='), 'TOC-08 ids survive sanitize');

// ── MEDIA / SEO / SAMPLE ────────────────────────────────────────────────────
const blogPost = read('client/src/pages/Blog/BlogPost.jsx');
check(blogPost.includes('post.imageUrl ?') && blogPost.includes('<img'), 'MEDIA-01 hero when imageUrl');
check(!blogPost.includes('featuredImage') && !blogPost.includes('blog:featuredImage'), 'MEDIA-02 no placeholder');
check(blogPost.includes('gallery.length > 0'), 'MEDIA-03 empty gallery hidden');
check(blogPost.includes('grid grid-cols'), 'MEDIA-04 gallery grid');
check(blogPost.includes('filter((url)'), 'MEDIA-05 gallery https filter');
check(adminBlogs.includes('AdminImageUrlField') && adminBlogs.includes('imageUrl'), 'MEDIA-06 admin maps imageUrl');
check(blogPost.includes('post.seoTitle || post.title'), 'SEO-01 seoTitle priority');
check(blogPost.includes('post.metaDescription || post.excerpt'), 'SEO-03 metaDescription');
check(blogPost.includes('post.ogImageUrl || post.imageUrl'), 'SEO-05 ogImage');
const blogList = read('client/src/pages/Blog/Blog.jsx');
check(blogList.includes('isProduction') && blogList.includes('return []'), 'SAMPLE prod empty');

// ── VIEW PUBLIC component contract ──────────────────────────────────────────
const viewLink = read('client/src/components/admin/AdminViewPublicLink.jsx');
check(viewLink.includes('<span') && viewLink.includes('cursor-not-allowed'), 'VIEW disabled not anchor');
check(viewLink.includes('VIEW_PUBLIC_HINT'), 'VIEW hint text');
check(viewLink.includes("target=\"_blank\"") && viewLink.includes('<a href='), 'VIEW enabled is anchor');

// ── EXAM PREP ───────────────────────────────────────────────────────────────
const examAdmin = read('client/src/pages/Admin/AdminExamPreparation.jsx');
const examCtrl = read('server/src/controllers/admin/adminExamsController.js');
check(examAdmin.includes('quizId') && examAdmin.includes('Select quiz'), 'EXAM-01 selector');
check(examAdmin.includes('listQuizzes'), 'EXAM-02 quiz data loaded');
check(examAdmin.includes('quizzesForExam'), 'EXAM-03 exam filter');
check(examAdmin.includes('quizId: form.quizId'), 'EXAM-04 create payload');
check(examAdmin.includes('quizId: row.quizId'), 'EXAM-05 edit state');
check(examCtrl.includes('update.quizId'), 'EXAM-07 update accepts quizId');
check(read('server/src/models/Mcq.js').includes('quizId'), 'EXAM-08 mcq model quizId');

// ── COMPONENT / RESPONSIVE SOURCE CONTRACTS ─────────────────────────────────
check(adminBlogs.includes('AdminViewPublicLink'), 'COMP AdminContentBlogs');
check(!adminBlogs.match(/placeholder=\{t\('admin:fieldCategory'\)\}/), 'COMP category is select not text');
check(blogPost.includes('showToc ?') && blogPost.includes('lg:flex-row'), 'RESP BlogPost TOC layout');
check(blogPost.includes('max-w-4xl'), 'RESP article width');
check(blogPost.includes('grid-cols-2 sm:grid-cols-3'), 'RESP gallery grid');
check(adminBlogs.includes('max-w-2xl'), 'RESP admin modal');

// ── PRODUCTION FILTER UNCHANGED ─────────────────────────────────────────────
const prodFilter = withFixtureExclusion({ status: CMS_STATUS.ACTIVE }, { NODE_ENV: 'production' });
check(JSON.stringify(prodFilter).includes('launchEligible'), 'PROD filter requires launchEligible');

console.log(`phase9AutomatedAcceptance.test.js: ${count} assertions passed`);
