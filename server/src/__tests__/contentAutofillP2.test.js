/**
 * CONTENT-AUTOFILL-P2 — CMS DOCX/TXT structured import tests.
 * Run: node src/__tests__/contentAutofillP2.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const extraction = await import(pathToFileURL(path.join(root, 'shared/cms/cmsDocumentExtraction.js')).href);
const contracts = await import(pathToFileURL(path.join(root, 'shared/cms/cmsDocumentFieldContracts.js')).href);
const { sanitizeHtml } = await import(pathToFileURL(path.join(root, 'server/src/utils/htmlSanitize.js')).href);
const { validateCmsDocumentBuffer, CMS_DOCUMENT_MAX_SIZE } = await import(
  pathToFileURL(path.join(root, 'server/src/utils/cmsDocumentFileValidation.js')).href
);
const cmsMerge = await import(
  pathToFileURL(path.join(root, 'client/src/components/admin/cmsDocumentSuggestionMerge.js')).href
);
const { parseCmsImportDocument } = await import(
  pathToFileURL(path.join(root, 'server/src/services/cmsDocumentExtractService.js')).href
);

const { extractCmsFieldsFromText } = extraction;
const { isAllowlistedCmsField, CMS_DANGEROUS_KEYS } = contracts;
const {
  applyCmsDocumentSuggestions,
  buildSuggestionConflicts,
  BLOG_FORM_DEFAULTS,
} = cmsMerge;

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const BLOG_FIXTURE = `STRIDETO BLOG IMPORT

Title
How to Choose the Right Country for Studying Abroad in 2026

Category
International Study

Author
STRIDETO Editorial Team

Summary
A practical overview for students comparing destinations.

Content
## Why country choice matters
Choosing where to study is a major decision.

- Compare tuition costs
- Review visa pathways

Tags
Study Abroad
International Students

Featured Image URL
https://cdn.example.com/blog/hero.jpg

Featured Image Alt Text
Students reviewing a world map

Gallery URLs
https://cdn.example.com/blog/g1.jpg
https://cdn.example.com/blog/g2.jpg

Reading Time
7

Published At
2026-08-30T10:00

Status
draft

SEO Slug
how-to-choose-the-right-country-for-studying-abroad-in-2026

SEO Title
How to Choose the Right Country for Studying Abroad in 2026

Meta Description
A practical overview for students comparing destinations.

Canonical URL
https://www.strideto.com/blog/how-to-choose-the-right-country-for-studying-abroad-in-2026

Open Graph Image URL
https://cdn.example.com/blog/og.jpg

Featured
false
`;

const CAREER_FIXTURE = `STRIDETO CAREER GUIDANCE IMPORT

Title
Building a CV for International Applications

Category
Career Advice

Summary
Steps to prepare a CV for global employers.

Content
## Start with a clear profile
Keep your summary concise and factual.

Tags
CV
International Jobs

Featured Image URL
https://cdn.example.com/career/hero.jpg

Scheduled At
2026-09-01T09:00

Status
draft

SEO Slug
building-a-cv-for-international-applications

SEO Title
Building a CV for International Applications

Meta Description
Steps to prepare a CV for global employers.

Featured
false
`;

// ── Blog extraction ───────────────────────────────────────────────────────────

const blogExtract = extractCmsFieldsFromText(BLOG_FIXTURE, 'blog');
const bs = blogExtract.suggestions;

check(Object.keys(bs).length >= 15, 'DOC-B01 valid document parses most blog fields');
check(bs.title?.value?.includes('Choose the Right Country'), 'DOC-B02 title');
check(bs.category?.value === 'International Study', 'DOC-B03 category enum');
check(bs.authorName?.value === 'STRIDETO Editorial Team', 'DOC-B04 author');
check(bs.excerpt?.value?.includes('practical overview'), 'DOC-B05 excerpt');
check(bs.content?.value?.includes('<h2'), 'DOC-B06 rich content html');
check(bs.imageUrl?.value?.startsWith('https://'), 'DOC-B07 image URL');
check(bs.imageAlt?.value?.includes('world map'), 'DOC-B08 image alt');
check(Array.isArray(bs.gallery?.value) && bs.gallery.value.length === 2, 'DOC-B09 gallery');
check(bs.readingTime?.value === 7, 'DOC-B10 reading time');
check(Array.isArray(bs.tags?.value) && bs.tags.value.includes('Study Abroad'), 'DOC-B11 tags');
check(String(bs.publishedAt?.value).startsWith('2026-08-30'), 'DOC-B12 publishedAt');
check(bs.status?.value === 'draft' && bs.status?.status === 'accepted', 'DOC-B13 draft status');
check(bs.slug?.value?.includes('studying-abroad'), 'DOC-B14 slug');
check(bs.seoTitle?.value?.includes('2026'), 'DOC-B15 SEO title');
check(bs.metaDescription?.value?.includes('practical'), 'DOC-B16 meta description');
check(bs.canonicalUrl?.value?.startsWith('https://'), 'DOC-B17 canonical URL');
check(bs.ogImageUrl?.value?.includes('og.jpg'), 'DOC-B18 OG image URL');
check(bs.isFeatured?.value === false, 'DOC-B19 featured false');

const blogSparse = extractCmsFieldsFromText('Title\nOnly Title\n\nContent\nBody only.', 'blog');
check(blogSparse.suggestions.title && !blogSparse.suggestions.category, 'DOC-B20 missing fields handled');

const badCat = extractCmsFieldsFromText('Title\nT\n\nCategory\nNot A Real Category Label XYZ\n\nContent\nX', 'blog');
check(!badCat.suggestions.category, 'DOC-B21 invalid category rejected');

check(!extractCmsFieldsFromText('Title\nT\n\nFeatured Image URL\nnot-a-url\n\nContent\nX', 'blog').suggestions.imageUrl, 'DOC-B22 invalid URL rejected');

const malicious = extractCmsFieldsFromText('Title\nT\n\nContent\n<script>alert(1)</script>\n\nNormal paragraph.', 'blog');
const safeHtml = sanitizeHtml(malicious.suggestions.content?.value || '');
check(!safeHtml.includes('<script'), 'DOC-B23 malicious content safe after sanitize');

const populated = { ...BLOG_FORM_DEFAULTS, title: 'Existing Title', category: 'Career Advice' };
const { form: mergedBlog, applied } = applyCmsDocumentSuggestions(populated, bs, {
  formDefaults: BLOG_FORM_DEFAULTS,
  initialForm: populated,
  onlyEmpty: true,
});
check(mergedBlog.title === 'Existing Title', 'DOC-B24 populated title preserved');
check(mergedBlog.category === 'Career Advice', 'DOC-B24b populated category preserved');
check(applied.includes('slug') || applied.includes('excerpt'), 'DOC-B24c empty fields still applied');

check(!read('server/src/controllers/cmsDocumentExtractController.js').includes('.save('), 'DOC-B25 no DB write in controller');
check(!read('server/src/controllers/cmsDocumentExtractController.js').includes('publish'), 'DOC-B26 no publish in controller');

check(read('server/src/routes/admin.js').includes("requirePermission(PERMISSIONS.CONTENT_BLOGS)"), 'DOC-B27 blog route requires CONTENT_BLOGS');
check(read('server/src/routes/admin.js').includes("requirePermission(PERMISSIONS.CONTENT_CAREER)"), 'DOC-CG-27 career route requires CONTENT_CAREER');

check(!isAllowlistedCmsField('blog', '__proto__'), 'DOC-B29 unknown keys ignored');
check(CMS_DANGEROUS_KEYS.has('constructor'), 'DOC-B29b dangerous keys blocked');

try {
  await validateCmsDocumentBuffer(Buffer.from('not a docx'), 'application/octet-stream', 'bad.docx');
  check(false, 'DOC-B30 malformed DOCX should throw');
} catch (err) {
  check(err.code === 'invalid_file_content' || err.code === 'unsupported_format', 'DOC-B30 malformed DOCX rejected');
}

try {
  await validateCmsDocumentBuffer(Buffer.alloc(CMS_DOCUMENT_MAX_SIZE + 1), 'text/plain', 'big.txt');
  check(false, 'DOC size limit should throw');
} catch (err) {
  check(err.code === 'file_too_large', 'DOC size limit enforced');
}

const publishedDoc = extractCmsFieldsFromText('Title\nT\n\nStatus\npublished\n\nContent\nX', 'blog');
check(publishedDoc.suggestions.status?.status === 'review', 'DOC status published requires review not auto-apply');

// ── Career extraction ─────────────────────────────────────────────────────────

const careerExtract = extractCmsFieldsFromText(CAREER_FIXTURE, 'career-article');
const cs = careerExtract.suggestions;

check(cs.title?.value?.includes('CV'), 'DOC-CG-01 career title');
check(cs.category?.value === 'Career Advice', 'DOC-CG-02 career category');
check(cs.excerpt?.value?.includes('CV'), 'DOC-CG-03 career excerpt');
check(cs.content?.value?.includes('<h2'), 'DOC-CG-04 career content');
check(Array.isArray(cs.tags?.value), 'DOC-CG-05 career tags');
check(cs.imageUrl?.value?.startsWith('https://'), 'DOC-CG-06 career image');
check(String(cs.scheduledAt?.value).startsWith('2026-09-01'), 'DOC-CG-07 scheduledAt');
check(cs.status?.value === 'draft', 'DOC-CG-08 career status draft');
check(cs.slug?.value?.includes('international-applications'), 'DOC-CG-09 career slug');
check(cs.seoTitle?.value?.includes('CV'), 'DOC-CG-10 career SEO title');
check(cs.metaDescription?.value?.includes('CV'), 'DOC-CG-11 career meta');
check(cs.isFeatured?.value === false, 'DOC-CG-12 career featured');

const txtResult = await parseCmsImportDocument(Buffer.from(BLOG_FIXTURE, 'utf8'), 'text/plain', 'import.txt', 'blog');
check(txtResult.suggestions.title?.value, 'DOC parse service txt blog');
check(txtResult.meta.format === 'txt', 'DOC txt format meta');

// ── Wiring ────────────────────────────────────────────────────────────────────

check(read('client/src/pages/Admin/AdminContentBlogs.jsx').includes('CmsDocumentUploadPanel'), 'blog UI wired');
check(read('client/src/pages/Admin/AdminCareerGuidance.jsx').includes('CmsDocumentUploadPanel'), 'career UI wired');
check(read('client/src/pages/Admin/AdminContentBlogs.jsx').includes('AdminContentAutofillBar'), 'P1 autofill still on blog');
check(read('client/src/components/admin/CmsDocumentUploadPanel.jsx').includes('Apply all valid fields'), 'apply button copy');
check(read('client/src/components/admin/CmsDocumentUploadPanel.jsx').includes('Clear import'), 'clear import copy');

const conflicts = buildSuggestionConflicts(
  { ...BLOG_FORM_DEFAULTS, title: 'Manual' },
  { title: bs.title, slug: bs.slug },
  {
    formDefaults: BLOG_FORM_DEFAULTS,
    initialForm: BLOG_FORM_DEFAULTS,
    touchedFields: new Set(['title']),
  },
);
check(conflicts.some((c) => c.field === 'title'), 'conflict detection for populated title');

console.log(`CONTENT-AUTOFILL-P2: ${count} checks passed`);
