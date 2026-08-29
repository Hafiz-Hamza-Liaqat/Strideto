/**
 * CONTENT-AUTOFILL-P1 — blog & career-guidance admin metadata autofill.
 * Run: node src/__tests__/contentAutofillP1.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const autofill = await import(pathToFileURL(path.join(root, 'shared/cms/contentAutofill.js')).href);
const { estimateReadingMinutes } = await import(pathToFileURL(path.join(root, 'shared/blog/readingTime.js')).href);

const {
  deriveContentSlug,
  deriveSafeSeoTitle,
  deriveMetaDescriptionFromEnteredSummary,
  applyContentAutofillPatch,
  buildBlogAutofillPatch,
  buildCareerArticleAutofillPatch,
  isEmptyContentField,
} = autofill;

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const SAMPLE_TITLE = 'Study in Australia from Pakistan 2026';
const SAMPLE_SLUG = 'study-in-australia-from-pakistan-2026';

// ── BLOG (B-AF01–B-AF10) ─────────────────────────────────────────────────────

check(
  deriveContentSlug(SAMPLE_TITLE) === SAMPLE_SLUG,
  'B-AF01 title → slug',
);

check(
  applyContentAutofillPatch(
    { title: SAMPLE_TITLE, slug: 'custom-slug' },
    buildBlogAutofillPatch({ title: SAMPLE_TITLE, slug: 'custom-slug' }, estimateReadingMinutes),
  ).form.slug === 'custom-slug',
  'B-AF02 manual slug preserved',
);

check(
  deriveSafeSeoTitle(SAMPLE_TITLE) === SAMPLE_TITLE,
  'B-AF03 safe SEO title derived from title only',
);

check(
  applyContentAutofillPatch(
    { title: SAMPLE_TITLE, seoTitle: 'Custom SEO' },
    buildBlogAutofillPatch({ title: SAMPLE_TITLE, seoTitle: 'Custom SEO' }, estimateReadingMinutes),
  ).form.seoTitle === 'Custom SEO',
  'B-AF04 existing SEO title preserved',
);

check(
  deriveMetaDescriptionFromEnteredSummary({ excerpt: '', content: '', title: SAMPLE_TITLE }) === '',
  'B-AF05 meta description does not invent facts from title alone',
);

check(
  deriveMetaDescriptionFromEnteredSummary({ excerpt: 'Real summary from admin.' }) === 'Real summary from admin.',
  'B-AF05b meta description uses admin-entered excerpt',
);

const blogPatchNoSource = buildBlogAutofillPatch({ title: SAMPLE_TITLE }, estimateReadingMinutes);
check(!blogPatchNoSource.canonicalUrl, 'B-AF06 source URL never fabricated');
check(!blogPatchNoSource.imageUrl, 'B-AF07 image never fabricated');

check(
  applyContentAutofillPatch({ title: SAMPLE_TITLE, status: 'draft' }, { status: 'published' }).form.status === 'draft',
  'B-AF08 status never auto-published',
);

check(
  applyContentAutofillPatch(
    { title: SAMPLE_TITLE, category: 'Career Advice', authorName: 'Jane', tags: 'jobs' },
    buildBlogAutofillPatch(
      { title: SAMPLE_TITLE, category: 'Career Advice', authorName: 'Jane', tags: 'jobs' },
      estimateReadingMinutes,
    ),
  ).form.category === 'Career Advice'
    && applyContentAutofillPatch(
      { title: SAMPLE_TITLE, category: 'Career Advice', authorName: 'Jane', tags: 'jobs' },
      buildBlogAutofillPatch(
        { title: SAMPLE_TITLE, category: 'Career Advice', authorName: 'Jane', tags: 'jobs' },
        estimateReadingMinutes,
      ),
    ).form.authorName === 'Jane',
  'B-AF09 populated fields not overwritten',
);

const xssTitle = '<script>alert(1)</script>';
const xssSlug = deriveContentSlug(xssTitle);
check(!xssSlug.includes('<') && !xssSlug.includes('>'), 'B-AF10 invalid/malicious slug input remains URL-safe text');
check(
  deriveSafeSeoTitle(xssTitle) === xssTitle,
  'B-AF10b malicious title stored as plain text for SEO helper (sanitized on save server-side)',
);

// ── CAREER GUIDANCE (CG-AF01–CG-AF10) ────────────────────────────────────────

check(
  deriveContentSlug(SAMPLE_TITLE) === SAMPLE_SLUG,
  'CG-AF01 title → slug',
);

check(
  applyContentAutofillPatch(
    { title: SAMPLE_TITLE, slug: 'kept-slug' },
    buildCareerArticleAutofillPatch({ title: SAMPLE_TITLE, slug: 'kept-slug' }),
  ).form.slug === 'kept-slug',
  'CG-AF02 manual slug preserved',
);

check(
  deriveSafeSeoTitle(SAMPLE_TITLE) === SAMPLE_TITLE,
  'CG-AF03 safe SEO title derived',
);

check(
  applyContentAutofillPatch(
    { title: SAMPLE_TITLE, seoTitle: 'Existing' },
    buildCareerArticleAutofillPatch({ title: SAMPLE_TITLE, seoTitle: 'Existing' }),
  ).form.seoTitle === 'Existing',
  'CG-AF04 existing SEO title preserved',
);

check(
  deriveMetaDescriptionFromEnteredSummary({ excerpt: '', content: '', title: SAMPLE_TITLE }) === '',
  'CG-AF05 meta description does not invent facts',
);

check(
  !buildCareerArticleAutofillPatch({ title: SAMPLE_TITLE }).sourceUrl,
  'CG-AF06 source URL never fabricated (field absent)',
);

check(
  !buildCareerArticleAutofillPatch({ title: SAMPLE_TITLE }).imageUrl,
  'CG-AF07 image never fabricated',
);

check(
  applyContentAutofillPatch({ title: SAMPLE_TITLE, status: 'draft' }, { status: 'published' }).form.status === 'draft',
  'CG-AF08 status never auto-published',
);

check(
  applyContentAutofillPatch(
    { title: SAMPLE_TITLE, category: 'Visas', tags: 'visa' },
    buildCareerArticleAutofillPatch({ title: SAMPLE_TITLE, category: 'Visas', tags: 'visa' }),
  ).form.category === 'Visas',
  'CG-AF09 populated fields not overwritten',
);

check(
  !deriveContentSlug(xssTitle).includes('<'),
  'CG-AF10 malicious input remains safe in slug helper',
);

// ── Shared helpers ───────────────────────────────────────────────────────────

check(isEmptyContentField(''), 'isEmptyContentField empty string');
check(!isEmptyContentField(false), 'isEmptyContentField false is populated');
check(
  applyContentAutofillPatch({ ogImageUrl: '', imageUrl: 'https://cdn.example/a.jpg' }, { ogImageUrl: 'https://cdn.example/a.jpg' }).applied === 1,
  'blog ogImageUrl derived from entered imageUrl when empty',
);

const adminBlogs = read('client/src/pages/Admin/AdminContentBlogs.jsx');
const adminCareer = read('client/src/pages/Admin/AdminCareerGuidance.jsx');
check(adminBlogs.includes('AdminContentAutofillBar'), 'blog admin wires autofill bar');
check(adminCareer.includes('AdminContentAutofillBar'), 'career admin wires autofill bar');
check(adminBlogs.includes('buildBlogAutofillPatch'), 'blog admin uses shared patch builder');
check(adminCareer.includes('buildCareerArticleAutofillPatch'), 'career admin uses shared patch builder');

console.log(`CONTENT-AUTOFILL-P1: ${count} checks passed`);
