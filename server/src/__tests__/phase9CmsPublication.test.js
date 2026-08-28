/**
 * Phase 9 — CMS publication, Blog author/render, View Public, Exam MCQ quiz.
 * Run: node src/__tests__/phase9CmsPublication.test.js
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

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const { deriveCmsLaunchEligible, deriveJobLaunchEligible, CMS_STATUS } = launch;
const {
  isBlogPublicReady,
  isAdmissionPublicReady,
  isScholarshipPublicReady,
  isInternshipPublicReady,
} = readiness;
const { normalizeBlogContent, detectContentFormat, shouldShowBlogToc } = blogContent;
const { withFixtureExclusion } = fixture;

// ── ADMISSION-PUB ───────────────────────────────────────────────────────────
check(deriveCmsLaunchEligible({ status: CMS_STATUS.DRAFT }, CMS_STATUS.DRAFT) === false, 'ADMISSION-PUB-01 draft create ineligible');
check(deriveCmsLaunchEligible({ status: CMS_STATUS.DRAFT }, CMS_STATUS.ACTIVE) === true, 'ADMISSION-PUB-02 active publish eligible');
check(deriveCmsLaunchEligible({ status: CMS_STATUS.DRAFT, launchEligible: false }, CMS_STATUS.ACTIVE) === true, 'ADMISSION-PUB-02b explicit false draft publish reconciles');
check(deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, launchEligible: false }, CMS_STATUS.ACTIVE) === true, 'ADMISSION-PUB-02c active re-save reconciles false');
check(deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, launchEligible: true }, CMS_STATUS.CLOSED) === false, 'ADMISSION-PUB-03 active to closed false');
check(deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, launchEligible: true }, CMS_STATUS.ACTIVE) === true, 'ADMISSION-PUB-03b active edit preserves eligible');
check(deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, launchEligible: true }, CMS_STATUS.DRAFT) === false, 'ADMISSION-PUB-03c active to draft false');

const dupAdmission = { status: CMS_STATUS.DRAFT, launchEligible: false };
check(dupAdmission.status === CMS_STATUS.DRAFT && dupAdmission.launchEligible === false, 'ADMISSION-PUB-05 duplicate starts non-public');

const prodAdmissionFilter = withFixtureExclusion({ status: CMS_STATUS.ACTIVE }, { NODE_ENV: 'production' });
check(JSON.stringify(prodAdmissionFilter).includes('launchEligible'), 'ADMISSION-PUB-06 production requires launchEligible');

// ── SCHOLARSHIP-PUB ─────────────────────────────────────────────────────────
check(deriveCmsLaunchEligible({ status: CMS_STATUS.DRAFT }, CMS_STATUS.DRAFT) === false, 'SCHOLARSHIP-PUB-01');
check(deriveCmsLaunchEligible({}, CMS_STATUS.ACTIVE) === true, 'SCHOLARSHIP-PUB-02');
check(deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, launchEligible: true }, CMS_STATUS.CLOSED) === false, 'SCHOLARSHIP-PUB-03');
check(isScholarshipPublicReady({ status: CMS_STATUS.ACTIVE, launchEligible: true, slug: 'x' }) === true, 'SCHOLARSHIP-PUB-06 public ready');

// ── INTERNSHIP-PUB ──────────────────────────────────────────────────────────
check(deriveCmsLaunchEligible({ isFixture: true }, CMS_STATUS.ACTIVE) === false, 'INTERNSHIP-PUB-02 fixture not eligible');
check(isInternshipPublicReady({ status: CMS_STATUS.ACTIVE, launchEligible: true, slug: 'i' }) === true, 'INTERNSHIP-PUB-06');

// ── JOB-PUB ─────────────────────────────────────────────────────────────────
check(deriveJobLaunchEligible({ status: CMS_STATUS.ACTIVE, approvalStatus: 'pending' }) === false, 'JOB-PUB-01 pending active not eligible');
check(deriveJobLaunchEligible({ status: CMS_STATUS.ACTIVE, approvalStatus: 'approved' }) === true, 'JOB-PUB-02 approved active eligible');
check(
  deriveJobLaunchEligible({ status: CMS_STATUS.ACTIVE, approvalStatus: 'approved', launchEligible: false }) === true,
  'JOB-PUB-03 direct update sets eligible'
);
check(deriveJobLaunchEligible({ status: CMS_STATUS.CLOSED, approvalStatus: 'approved' }) === false, 'JOB-PUB-04 closed removes eligibility');
check(deriveJobLaunchEligible({ status: CMS_STATUS.ACTIVE, approvalStatus: 'rejected' }) === false, 'JOB-PUB-04b rejected not eligible');

// ── BLOG AUTHOR / VALIDATION (source + model) ───────────────────────────────
const blogModel = read('server/src/models/Blog.js');
const blogCtrl = read('server/src/controllers/admin/adminBlogsController.js');
const adminBlogs = read('client/src/pages/Admin/AdminContentBlogs.jsx');
check(blogModel.includes('authorName'), 'BLOG-AUTHOR-01 authorName field exists');
check(blogCtrl.includes('authorName') && blogCtrl.includes('applyAuthorFields'), 'BLOG-AUTHOR-01 editorial author via authorName');
check(blogCtrl.includes('Validation failed') && blogCtrl.includes('details'), 'BLOG-VALIDATION-04 actionable details');
check(blogCtrl.includes('parseOptionalDate') && blogCtrl.includes('optionalUrl'), 'BLOG-VALIDATION-02/03 optional normalization');
check(adminBlogs.includes('authorName'), 'BLOG-AUTHOR-02 admin uses authorName');

// ── BLOG RENDER ─────────────────────────────────────────────────────────────
const htmlSample = normalizeBlogContent('<h2>Section</h2><p>Hello <strong>world</strong></p><ul><li>One</li></ul>');
check(htmlSample.html.includes('<h2') && htmlSample.html.includes('<strong>'), 'BLOG-RENDER-01 html elements');
const mdSample = normalizeBlogContent('## New Jobs\n- [Program Officer HEC 2026](https://example.com/jobs)');
check(mdSample.html.includes('<h2') && mdSample.html.includes('<a href=') && mdSample.html.includes('<li>'), 'BLOG-RENDER-02 markdown');
const plainSample = normalizeBlogContent('Plain line one\n\nPlain line two');
check(plainSample.html.includes('<p>') && plainSample.html.includes('Plain line one'), 'BLOG-RENDER-03 plain readable in paragraphs');
check(detectContentFormat('<script>x</script><p>Safe</p>') === 'html', 'BLOG-RENDER-04 html detected for sanitize at render');
check(mdSample.toc.some((t) => t.id && t.text === 'New Jobs'), 'BLOG-RENDER-05 toc matches heading');
const dupHeadings = normalizeBlogContent('## Jobs\n\n### Jobs\n\n## Jobs');
const ids = dupHeadings.toc.map((t) => t.id);
check(new Set(ids).size === ids.length, 'BLOG-RENDER-06 duplicate heading ids unique');
check(shouldShowBlogToc(normalizeBlogContent('## Only one').toc) === false, 'BLOG-RENDER-07 toc hidden with one heading');

const blogPost = read('client/src/pages/Blog/BlogPost.jsx');
check(blogPost.includes('sanitizeHtmlForRender'), 'BLOG-RENDER-04 render boundary sanitizes');
check(blogPost.includes('post.imageUrl') && !blogPost.includes('featuredImage ?'), 'BLOG-RENDER-08/09 imageUrl not featuredImage placeholder');
check(blogPost.includes('gallery') && blogPost.includes('normalizeBlogContent'), 'BLOG-RENDER-10 gallery + normalize');

// ── BLOG TAXONOMY / SEO / SAMPLE ────────────────────────────────────────────
check(taxonomy.listBlogCategoryOptions().length >= 11, 'BLOG-CATEGORY-01 canonical options');
check(read('client/src/pages/Blog/Blog.jsx').includes('listBlogCategoryOptions'), 'BLOG-CATEGORY-02 public uses canonical');
check(taxonomy.canonicalBlogCategoryLabel('Career') === 'Career Advice', 'BLOG-CATEGORY-03 legacy career maps');
check(blogPost.includes('seoTitle') && blogPost.includes('metaDescription') && blogPost.includes('ogImageUrl'), 'BLOG-SEO-01..03');
const blogList = read('client/src/pages/Blog/Blog.jsx');
check(blogList.includes('isProduction') && blogList.includes('SAMPLE_BLOGS'), 'BLOG-SAMPLE-01 prod gate for samples');

// ── VIEW PUBLIC ─────────────────────────────────────────────────────────────
check(read('client/src/pages/Admin/AdminContentBlogs.jsx').includes('AdminViewPublicLink'), 'VIEW-PUBLIC-01 blog');
check(read('client/src/pages/Admin/AdminContentAdmissions.jsx').includes('AdminViewPublicLink'), 'VIEW-PUBLIC-02 admission');
check(read('client/src/pages/Admin/AdminContentScholarships.jsx').includes('AdminViewPublicLink'), 'VIEW-PUBLIC-03 scholarship');
check(read('client/src/pages/Admin/AdminContentJobs.jsx').includes('AdminViewPublicLink'), 'VIEW-PUBLIC-04 job');
check(read('client/src/pages/Admin/AdminContentInternships.jsx').includes('AdminViewPublicLink'), 'VIEW-PUBLIC-05 internship');
check(isBlogPublicReady({ status: 'published', slug: 'x' }) === true, 'VIEW-PUBLIC-06 blog published ready');
check(isAdmissionPublicReady({ status: CMS_STATUS.DRAFT, slug: 'x' }) === false, 'VIEW-PUBLIC-02 draft admission not ready');

// ── EXAM PREP ───────────────────────────────────────────────────────────────
const examAdmin = read('client/src/pages/Admin/AdminExamPreparation.jsx');
const examCtrl = read('server/src/controllers/admin/adminExamsController.js');
check(examAdmin.includes('quizId') && examAdmin.includes('Select quiz'), 'EXAM-MCQ-01 quiz selector');
check(examAdmin.includes('quizId: form.quizId'), 'EXAM-MCQ-02 payload includes quizId');
check(examAdmin.includes('row.quizId'), 'EXAM-MCQ-03 edit preserves quizId');
check(examCtrl.includes('quizId: body.quizId'), 'EXAM-MCQ-04 API accepts quizId');

// ── Schema fields ───────────────────────────────────────────────────────────
check(read('server/src/models/Admission.js').includes('launchEligible'), 'Admission schema launchEligible');
check(read('server/src/models/Scholarship.js').includes('launchEligible'), 'Scholarship schema launchEligible');

console.log(`phase9CmsPublication.test.js: ${count} assertions passed`);
