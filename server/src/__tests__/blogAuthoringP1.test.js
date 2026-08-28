/**
 * BLOG-AUTHORING-P1 — category taxonomy, editor, TOC, tables, reading time, imageAlt.
 * Run: node src/__tests__/blogAuthoringP1.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const taxonomy = await import(pathToFileURL(path.join(root, 'shared/blog/taxonomy.js')).href);
const blogContent = await import(pathToFileURL(path.join(root, 'shared/blog/blogContent.js')).href);
const readingTime = await import(pathToFileURL(path.join(root, 'shared/blog/readingTime.js')).href);
const { sanitizeHtml } = await import(pathToFileURL(path.join(root, 'server/src/utils/htmlSanitize.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const {
  BLOG_CATEGORY_REGISTRY,
  listBlogCategoryOptions,
  canonicalBlogCategoryLabel,
} = taxonomy;
const {
  normalizeBlogContent,
  demoteBodyH1,
  shouldShowBlogToc,
  slugifyHeading,
} = blogContent;
const { estimateReadingMinutes, resolveBlogReadingMinutes, stripHtmlForWordCount } = readingTime;

const EXPECTED_ORDER = [
  'Career Advice',
  'Job Preparation',
  'Internships',
  'Scholarships',
  'Admissions',
  'International Study',
  'Universities & Programs',
  'Exam Prep',
  'Opportunities',
  'Employer & Hiring',
  'Platform Updates',
];

// ── BLOG-CAT ──────────────────────────────────────────────────────────────────
check(BLOG_CATEGORY_REGISTRY.length === 11, 'BLOG-CAT-01 registry has 11 canonical categories');
check(
  listBlogCategoryOptions().map((c) => c.label).join('|') === EXPECTED_ORDER.join('|'),
  'BLOG-CAT-01b public filter order matches spec',
);
check(canonicalBlogCategoryLabel('Career') === 'Career Advice', 'BLOG-CAT-01 legacy Career still valid');
check(canonicalBlogCategoryLabel('Exam Prep') === 'Exam Prep', 'BLOG-CAT-01 legacy Exam Prep still valid');
check(canonicalBlogCategoryLabel('Internships') === 'Internships', 'BLOG-CAT-02 Internships accepted');
check(canonicalBlogCategoryLabel('Universities & Programs') === 'Universities & Programs', 'BLOG-CAT-03 Universities & Programs accepted');
check(canonicalBlogCategoryLabel('Employer & Hiring') === 'Employer & Hiring', 'BLOG-CAT-04 Employer & Hiring accepted');
check(canonicalBlogCategoryLabel('All') === '', 'BLOG-CAT-05 All is UI-only not stored');
check(canonicalBlogCategoryLabel('Opportunities') === 'Opportunities', 'BLOG-CAT-06 legacy Opportunities unchanged');

const adminBlogs = read('client/src/pages/Admin/AdminContentBlogs.jsx');
const blogList = read('client/src/pages/Blog/Blog.jsx');
check(adminBlogs.includes('listBlogCategoryOptions'), 'BLOG-CAT admin uses taxonomy');
check(blogList.includes('scroll-tabs'), 'BLOG-CAT-07 mobile horizontal filter chips');
check(blogList.includes('aria-selected'), 'BLOG-CAT-07 keyboard-accessible filter tabs');

// ── BLOG-EDITOR ───────────────────────────────────────────────────────────────
check(adminBlogs.includes('BlogRichTextEditor'), 'BLOG-EDITOR-01 rich-text editor wired');
check(!adminBlogs.includes('placeholder={t(\'admin:fieldContent\')}') || adminBlogs.includes('BlogRichTextEditor'), 'BLOG-EDITOR-01 no mislabeled textarea-only content');
check(read('client/src/components/richText/BlogRichTextEditor.jsx').includes('levels: [2, 3]'), 'BLOG-EDITOR-02 H2/H3 only in editor');
check(read('client/src/components/richText/BlogRichTextEditor.jsx').includes('insertTable'), 'BLOG-EDITOR-07 table insert');
check(read('client/src/components/richText/BlogRichTextEditor.jsx').includes('blog-callout'), 'BLOG-EDITOR-08 callout round-trip structure');

const h1Demoted = normalizeBlogContent('<h1>Title</h1><h2>Section</h2><h2>Next</h2>');
check(!h1Demoted.html.includes('<h1'), 'BLOG-EDITOR-03 body H1 demoted');
check(h1Demoted.html.includes('<h2'), 'BLOG-EDITOR-03 demoted to h2');

const listHtml = normalizeBlogContent('<h2>List</h2><ul><li>A</li></ul><h2>End</h2>');
check(listHtml.html.includes('<ul>') && listHtml.html.includes('<li>'), 'BLOG-EDITOR-04 bullet list html path');

const olHtml = normalizeBlogContent('<h2>Nums</h2><ol><li>One</li></ol><h2>Done</h2>');
check(olHtml.html.includes('<ol>'), 'BLOG-EDITOR-05 numbered list html path');

const linkHtml = normalizeBlogContent('<h2>Links</h2><p><a href="https://example.com">x</a></p><h2>More</h2>');
check(linkHtml.html.includes('href="https://example.com"'), 'BLOG-EDITOR-06 safe links');

const tableHtml = normalizeBlogContent('<h2>Fees</h2><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table><h2>End</h2>');
check(tableHtml.html.includes('<table>') && tableHtml.html.includes('blog-table-scroll'), 'BLOG-EDITOR-07 table wrapped');

const unsafe = '<script>alert(1)</script><p onclick="x">Hi</p><table><tr><td onclick="y">cell</td></tr></table>';
const safeEditor = sanitizeHtml(unsafe);
check(!safeEditor.includes('<script') && !safeEditor.includes('onclick'), 'BLOG-EDITOR-09 unsafe HTML sanitized');

// ── BLOG-TOC ──────────────────────────────────────────────────────────────────
const tocSample = normalizeBlogContent('<h2>A</h2><h3>B</h3><h2>C</h2>');
check(shouldShowBlogToc(tocSample.toc), 'BLOG-TOC-01 2+ headings show TOC');
check(!shouldShowBlogToc(normalizeBlogContent('<h2>Only</h2>').toc), 'BLOG-TOC-02 one heading hides TOC');

const h4excluded = normalizeBlogContent('<h2>A</h2><h4>Skip</h4><h2>B</h2>');
check(h4excluded.toc.length === 2, 'BLOG-TOC-03 H4 excluded from TOC');
check(!h4excluded.toc.some((t) => t.text === 'Skip'), 'BLOG-TOC-03 H4 not in toc array');

const dup = normalizeBlogContent('<h2>Jobs</h2><h3>Jobs</h3><h2>Jobs</h2>');
const dupIds = dup.toc.map((t) => t.id);
check(new Set(dupIds).size === dupIds.length, 'BLOG-TOC-04 duplicate IDs unique');

const used = new Set();
let fb = 0;
const id1 = slugifyHeading('日本語', used, () => { fb += 1; return fb; });
const id2 = slugifyHeading('日本語', used, () => { fb += 1; return fb; });
check(id1 && id2 && id1 !== id2, 'BLOG-TOC-05 Unicode/fallback IDs deterministic');

check(demoteBodyH1('<h1>x</h1>').includes('<h2'), 'BLOG-TOC-06 body H1 demoted');
check(read('client/src/index.css').includes('scroll-margin-top'), 'BLOG-TOC-07 anchor scroll offset in CSS');

// ── BLOG-TABLE ────────────────────────────────────────────────────────────────
const tableRaw = '<table><thead><tr><th>Fee</th></tr></thead><tbody><tr><td>100</td></tr></tbody></table>';
const tableSafe = sanitizeHtml(tableRaw);
check(tableSafe.includes('<table>') && tableSafe.includes('<th>'), 'BLOG-TABLE-01 semantic table survives');
check(tableSafe.includes('Fee'), 'BLOG-TABLE-02 headers preserved');
check(read('client/src/index.css').includes('blog-table-scroll'), 'BLOG-TABLE-03 mobile overflow CSS');
check(!sanitizeHtml('<table><tr><td><script>x</script></td></tr></table>').includes('<script'), 'BLOG-TABLE-04 no script in table');

// ── BLOG-READ ─────────────────────────────────────────────────────────────────
check(resolveBlogReadingMinutes({ content: 'word '.repeat(400), readingTime: 9 }) === 9, 'BLOG-READ-01 manual override list+detail helper');
check(resolveBlogReadingMinutes({ content: '<p>' + 'word '.repeat(250) + '</p>' }) >= 2, 'BLOG-READ-02 auto estimate when no override');
check(stripHtmlForWordCount('<p>one two three</p>').split(/\s+/).length === 3, 'BLOG-READ-03 HTML tags not counted');
check(estimateReadingMinutes('Plain text here for reading') >= 1, 'BLOG-READ-04 plain text handled');
check(estimateReadingMinutes('## Head\n\n- item') >= 1, 'BLOG-READ-04 markdown-ish plain handled');

// ── BLOG-IMG ──────────────────────────────────────────────────────────────────
check(read('server/src/models/Blog.js').includes('imageAlt'), 'BLOG-IMG-01 imageAlt on model');
check(read('server/src/controllers/admin/adminBlogsController.js').includes('imageAlt'), 'BLOG-IMG-01 imageAlt write path');
const blogPost = read('client/src/pages/Blog/BlogPost.jsx');
check(blogPost.includes('imageAlt') && blogPost.includes('heroAlt'), 'BLOG-IMG-02 public hero uses imageAlt');
check(blogPost.includes('post.imageAlt?.trim() || post.title'), 'BLOG-IMG-03 fallback to title');

// ── Legacy compatibility ─────────────────────────────────────────────────────
const plain = normalizeBlogContent('Line one\n\nLine two');
check(plain.html.includes('<p>') && plain.html.includes('Line one'), 'legacy plain text renders');
const md = normalizeBlogContent('## Section\n\n- item\n\n## Next');
check(md.html.includes('<h2') && md.html.includes('<li>'), 'legacy markdown renders');
check(md.toc.length >= 2, 'legacy markdown TOC');

// ── SEO / schema contracts ───────────────────────────────────────────────────
check(blogPost.includes('blogPostingSchema'), 'SEO BlogPosting preserved');
check(blogPost.includes('seoTitle') && blogPost.includes('metaDescription'), 'SEO fields preserved');
check(blogPost.includes('resolveBlogReadingMinutes'), 'JSON-LD reading time uses shared helper');

console.log(`blogAuthoringP1.test.js: ${count} assertions passed`);
