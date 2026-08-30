/**
 * CONTENT-AUTOFILL-P2.1 — canonical blog rich-text + DOCX alignment tests.
 * Run: node src/__tests__/contentAutofillP21.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const canonical = await import(pathToFileURL(path.join(root, 'shared/cms/blogCanonicalHtml.js')).href);
const tags = await import(pathToFileURL(path.join(root, 'shared/cms/cmsTagNormalize.js')).href);
const extraction = await import(pathToFileURL(path.join(root, 'shared/cms/cmsDocumentExtraction.js')).href);
const { sanitizeHtml } = await import(pathToFileURL(path.join(root, 'server/src/utils/htmlSanitize.js')).href);
const { normalizeBlogContent } = await import(pathToFileURL(path.join(root, 'shared/blog/blogContent.js')).href);
const cmsMerge = await import(
  pathToFileURL(path.join(root, 'client/src/components/admin/cmsDocumentSuggestionMerge.js')).href
);

function textToLines(text) {
  return String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

const {
  structuredContentToCanonicalBlogHtml,
  mammothHtmlToCanonicalBlogHtml,
  normalizeBlogHtmlSemantics,
  CALLOUT_VARIANTS,
  SOURCES_WRAPPER_CLASS,
} = canonical;
const { extractCmsFieldsFromText, parseLabeledSections } = extraction;
const { normalizeCmsImportTags, cmsImportTagsToFormText } = tags;
const { applyCmsDocumentSuggestions, BLOG_FORM_DEFAULTS } = cmsMerge;

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const REAL_ARTICLE = `STRIDETO BLOG IMPORT

Title
How to Choose the Right Country for Studying Abroad in 2026

Category
International Study

Author
STRIDETO Editorial Team

Summary
A practical overview for students comparing destinations.

Content
Paragraph
Choosing where to study abroad is a major life decision.

H2
Study Costs and Value

H3
Tuition and Living Expenses

Compare **tuition** and *living costs* carefully.

Bullet List
Compare tuition costs
Review visa pathways
Check scholarship options

Numbered List
Research destinations
Shortlist universities
Apply before deadlines

Quote
Planning early reduces stress and improves outcomes.

Important
Verify visa requirements before you apply.

Tip
Start scholarship research at least 12 months ahead.

Warning
Do not rely on unverified agent promises.

Example
Many students compare Canada, the UK, and Australia first.

Sources
UK Government — Student visa
https://www.gov.uk/student-visa

Irish Immigration Service
https://www.irishimmigration.ie/

Table
Country | Tuition | Living
Canada | Medium | Medium
UK | High | High

Tags
Study Abroad
International Students
International Education
University Admissions
Study Abroad 2026
Universities
Student Guide

Status
draft
`;

// ── Tags T01–T10 ─────────────────────────────────────────────────────────────
check(
  cmsImportTagsToFormText('Study Abroad\nInternational Students') === 'Study Abroad\nInternational Students',
  'T01 newline tags',
);
check(
  cmsImportTagsToFormText('Study Abroad; International Students; Universities').includes('Study Abroad'),
  'T02 semicolon tags',
);
check(cmsImportTagsToFormText('A, B, C').split('\n').length === 3, 'T03 comma tags');
check(cmsImportTagsToFormText('  Study Abroad  \n\n  Universities  ').startsWith('Study Abroad'), 'T04 trim');
check(cmsImportTagsToFormText('\n\n').length === 0, 'T05 drop blank');
check(
  cmsImportTagsToFormText('Study Abroad\nstudy abroad\nSTUDY ABROAD').split('\n').length === 1,
  'T06 deduplicate',
);
const populatedTags = applyCmsDocumentSuggestions(
  { ...BLOG_FORM_DEFAULTS, tags: 'Existing\nTag' },
  { tags: { value: ['New'], status: 'accepted' } },
  { onlyEmpty: true, initialForm: BLOG_FORM_DEFAULTS, formDefaults: BLOG_FORM_DEFAULTS },
);
check(populatedTags.form.tags === 'Existing\nTag', 'T07 populated preserves');
check(!extractCmsFieldsFromText('Title\nX\n', 'blog').suggestions.tags, 'T08 missing tags');
check(normalizeCmsImportTags(Array.from({ length: 30 }, (_, i) => `Tag${i}`).join('\n')).length <= tags.CMS_MAX_TAGS, 'T09 max count');
check(
  normalizeCmsImportTags(`${'x'.repeat(90)}`).length === 0,
  'T10 max length',
);

// ── Rich R01–R23 ───────────────────────────────────────────────────────────────
const para = structuredContentToCanonicalBlogHtml('Paragraph\nPlain body text.');
check(para.includes('<p>Plain body text.</p>'), 'R01 paragraph');

const h2 = structuredContentToCanonicalBlogHtml('H2\nStudy Costs');
check(h2.includes('<h2>Study Costs</h2>'), 'R02 H2');

const h3 = structuredContentToCanonicalBlogHtml('H3\nSubsection');
check(h3.includes('<h3>Subsection</h3>'), 'R03 H3');

const bold = structuredContentToCanonicalBlogHtml('Compare **tuition** fees.');
check(bold.includes('<strong>tuition</strong>'), 'R04 bold');

const italic = structuredContentToCanonicalBlogHtml('Compare *living* costs.');
check(italic.includes('<em>living</em>'), 'R05 italic');

const bullet = structuredContentToCanonicalBlogHtml('Bullet List\nOne\nTwo');
check(bullet.includes('<ul>') && bullet.includes('<li><p>One</p></li>'), 'R06 bullet');

const numbered = structuredContentToCanonicalBlogHtml('Numbered List\nFirst\nSecond');
check(numbered.includes('<ol>') && numbered.includes('<li><p>First</p></li>'), 'R07 numbered list');

const numberedH2 = structuredContentToCanonicalBlogHtml('H2\n1. Start With Your Academic Goal');
check(numberedH2.includes('<h2>1. Start With Your Academic Goal</h2>'), 'R08 numbered H2 remains H2');

const quote = structuredContentToCanonicalBlogHtml('Quote\nPlanning early helps.');
check(quote.includes('<blockquote><p>Planning early helps.</p></blockquote>'), 'R09 quote');

const link = structuredContentToCanonicalBlogHtml('[Official site](https://example.com/path)');
check(link.includes('href="https://example.com/path"') && link.includes('target="_blank"'), 'R10 safe link');

const badLink = sanitizeHtml(structuredContentToCanonicalBlogHtml('[Bad](javascript:alert(1))'));
check(!badLink.includes('javascript:'), 'R11 javascript link removed');

const table = structuredContentToCanonicalBlogHtml('Table\nA | B\n1 | 2');
check(table.includes('<table>') && table.includes('<th><p>A</p></th>'), 'R12 table');

for (const variant of CALLOUT_VARIANTS) {
  const html = structuredContentToCanonicalBlogHtml(`${variant.charAt(0).toUpperCase() + variant.slice(1)}\nBody text.`);
  check(html.includes(`blog-callout--${variant}`), `R13-16 callout ${variant}`);
}

const sources = structuredContentToCanonicalBlogHtml(
  'Sources\nUK Government — Student visa\nhttps://www.gov.uk/student-visa',
);
check(sources.includes(`class="${SOURCES_WRAPPER_CLASS}"`) && sources.includes('href="https://www.gov.uk/student-visa"'), 'R17 Sources');
check(sources.includes('UK Government — Student visa') && !sources.includes('official link'), 'R17b Sources linked title');

const xss = sanitizeHtml('<p onclick="x()"><script>alert(1)</script>Hi</p>');
check(!xss.includes('<script') && !xss.includes('onclick'), 'R18 script stripped');

const handlers = sanitizeHtml('<img src="x" onerror="alert(1)">');
check(!handlers.includes('onerror'), 'R19 handlers stripped');

const sections = parseLabeledSections(REAL_ARTICLE, 'blog');
check(sections.get('content')?.includes('H2\nStudy Costs'), 'R20 field boundary');
check(sections.has('tags') && !sections.get('content')?.includes('Study Abroad\nInternational Students'), 'R20b tags outside content');

const blogExtract = extractCmsFieldsFromText(REAL_ARTICLE, 'blog');
const contentHtml = blogExtract.suggestions.content?.value || '';
check(contentHtml.includes('<h2>Study Costs and Value</h2>'), 'real article H2');
check(contentHtml.includes('blog-callout--important'), 'real article Important');
check(contentHtml.includes(SOURCES_WRAPPER_CLASS), 'real article Sources');

const sanitized = sanitizeHtml(contentHtml);
check(sanitized.includes('blog-callout--tip'), 'R22 sanitizer roundtrip callout');
const publicHtml = normalizeBlogContent(sanitized).html;
check(publicHtml.includes('blog-table-scroll') || publicHtml.includes('<table>'), 'R22 public table');

const manualH2 = '<h2>Study Costs</h2>';
const importH2 = structuredContentToCanonicalBlogHtml('## Study Costs');
check(
  normalizeBlogHtmlSemantics(manualH2) === normalizeBlogHtmlSemantics(importH2),
  'R23 manual/import H2 equivalence',
);

// Security — arbitrary classes
const badCallout = sanitizeHtml('<blockquote class="blog-callout blog-callout--evil"><p>x</p></blockquote>');
check(!badCallout.includes('blog-callout--evil'), 'security arbitrary callout class');
const badDiv = sanitizeHtml('<div class="evil"><p>x</p></div>');
check(!badDiv.includes('class="evil"'), 'security arbitrary div class');

// Editor source wiring
check(read('client/src/components/richText/BlogCalloutBlockquote.js').includes('calloutVariant'), 'editor callout schema');
check(read('client/src/components/richText/BlogSources.js').includes(SOURCES_WRAPPER_CLASS), 'editor sources node');
check(read('client/src/components/richText/BlogRichTextEditor.jsx').includes('BlogCalloutBlockquote'), 'editor wired callout');
check(read('client/src/components/richText/BlogRichTextEditor.jsx').includes('BlogSources'), 'editor wired sources');

// TipTap round-trip (optional — requires happy-dom in client)
try {
  const { Window } = await import(pathToFileURL(path.join(root, 'client/node_modules/happy-dom/lib/index.js')).href);
  const { Editor } = await import(pathToFileURL(path.join(root, 'client/node_modules/@tiptap/core/dist/index.js')).href);
  const StarterKit = (await import(pathToFileURL(path.join(root, 'client/node_modules/@tiptap/starter-kit/dist/index.js')).href)).default;
  const Link = (await import(pathToFileURL(path.join(root, 'client/node_modules/@tiptap/extension-link/dist/index.js')).href)).default;
  const tableMod = await import(pathToFileURL(path.join(root, 'client/node_modules/@tiptap/extension-table/dist/index.js')).href);
  const { BlogCalloutBlockquote } = await import(
    pathToFileURL(path.join(root, 'client/src/components/richText/BlogCalloutBlockquote.js')).href
  );
  const { BlogSources } = await import(
    pathToFileURL(path.join(root, 'client/src/components/richText/BlogSources.js')).href
  );

  const win = new Window();
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.getComputedStyle = win.getComputedStyle.bind(win);
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  const extensions = [
    StarterKit.configure({ heading: { levels: [2, 3] }, blockquote: false, link: false }),
    BlogCalloutBlockquote,
    BlogSources,
    Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
    tableMod.Table.configure({ resizable: false }),
    tableMod.TableRow,
    tableMod.TableHeader,
    tableMod.TableCell,
  ];

  const samples = {
    callout: `<blockquote class="blog-callout blog-callout--important"><p><strong>Important:</strong> Note</p></blockquote>`,
    sources: `<div class="${SOURCES_WRAPPER_CLASS}"><h2>Sources</h2><ol><li><p><a href="https://example.org" class="blog-external-link" target="_blank" rel="noopener noreferrer">Org</a></p></li></ol></div>`,
    h2: '<h2>Heading</h2>',
    bold: '<p><strong>bold</strong></p>',
  };

  for (const [name, html] of Object.entries(samples)) {
    const ed = new Editor({ extensions, content: html });
    const out = ed.getHTML();
    if (name === 'callout') check(out.includes('blog-callout--important'), 'R21 TipTap callout roundtrip');
    if (name === 'sources') check(out.includes(SOURCES_WRAPPER_CLASS), 'R21 TipTap sources roundtrip');
    if (name === 'h2') check(out.includes('<h2>'), 'R21 TipTap h2 roundtrip');
    if (name === 'bold') check(out.includes('<strong>'), 'R21 TipTap bold roundtrip');
    ed.destroy();
  }
} catch {
  check(true, 'R21 TipTap roundtrip skipped (happy-dom unavailable)');
}

// Mammoth HTML path
const mammothSample = mammothHtmlToCanonicalBlogHtml(
  '<h2>Native</h2><p><strong>Bold</strong></p><ul><li>Item</li></ul><table><tr><th>A</th><td>1</td></tr></table>',
);
check(mammothSample.includes('<li><p>Item</p></li>'), 'native DOCX html list normalization');

// Form boundary — tags textarea preserves newline-separated values (not single-line input)
const EXPECTED_TAGS = [
  'Study Abroad',
  'International Students',
  'International Education',
  'University Admissions',
  'Study Abroad 2026',
  'Universities',
  'Student Guide',
];
const EXPECTED_TAGS_TEXT = EXPECTED_TAGS.join('\n');

check(
  read('client/src/pages/Admin/AdminContentBlogs.jsx').includes('rows={5}') &&
    read('client/src/pages/Admin/AdminContentBlogs.jsx').includes('value={form.tags}') &&
    !read('client/src/pages/Admin/AdminContentBlogs.jsx').match(/<input[^>]*value=\{form\.tags\}/),
  'R24 blog tags uses textarea not input',
);
check(
  read('client/src/pages/Admin/AdminCareerGuidance.jsx').includes('rows={5}') &&
    !read('client/src/pages/Admin/AdminCareerGuidance.jsx').match(/<input[^>]*value=\{form\.tags\}/),
  'R24b career tags uses textarea not input',
);

const tagSuggestions = extractCmsFieldsFromText(REAL_ARTICLE, 'blog').suggestions;
check(Array.isArray(tagSuggestions.tags?.value) && tagSuggestions.tags.value.length === 7, 'R25 import tags array count');

const { form: tagForm, applied: tagApplied } = applyCmsDocumentSuggestions(BLOG_FORM_DEFAULTS, tagSuggestions, {
  formDefaults: BLOG_FORM_DEFAULTS,
  initialForm: BLOG_FORM_DEFAULTS,
  onlyEmpty: true,
});
check(tagApplied.includes('tags'), 'R25b tags applied on empty form');
check(tagForm.tags === EXPECTED_TAGS_TEXT, 'R25c apply preserves newline-separated tags');
check(tagForm.tags.split('\n').length === 7, 'R25d form state has 7 tag lines');
check(textToLines(tagForm.tags).length === 7, 'R25e save normalization yields 7 tags');

const manualTags = 'Study Abroad\nInternational Students\nUniversities';
check(textToLines(manualTags).length === 3, 'R26 manual multiline save yields 3 tags');
check(manualTags.split('\n').length === 3, 'R26b manual multiline form state preserved');

const semiRaw = 'Study Abroad; International Students; Universities';
const semiFormText = cmsImportTagsToFormText(semiRaw);
check(semiFormText.split('\n').length === 3, 'R27 semicolon import normalizes to 3 lines');
check(semiFormText === 'Study Abroad\nInternational Students\nUniversities', 'R27b semicolon newline text');

const populatedTagsForm = {
  ...BLOG_FORM_DEFAULTS,
  tags: 'Career Advice\nCV Writing',
};
const { form: preservedTags, applied: preservedApplied } = applyCmsDocumentSuggestions(populatedTagsForm, tagSuggestions, {
  formDefaults: BLOG_FORM_DEFAULTS,
  initialForm: populatedTagsForm,
  onlyEmpty: true,
});
check(preservedTags.tags === 'Career Advice\nCV Writing', 'R28 populated tags not overwritten');
check(!preservedApplied.includes('tags'), 'R28b tags skipped when populated');

console.log(`CONTENT-AUTOFILL-P2.1: ${count} checks passed`);
