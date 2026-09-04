import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const extraction = await import(pathToFileURL(path.join(root, 'shared/cms/cmsDocumentExtraction.js')).href);
const canonical = await import(pathToFileURL(path.join(root, 'shared/cms/blogCanonicalHtml.js')).href);
const contracts = await import(pathToFileURL(path.join(root, 'shared/cms/cmsDocumentFieldContracts.js')).href);
const { validateCmsDocumentBuffer } = await import(pathToFileURL(path.join(root, 'server/src/utils/cmsDocumentFileValidation.js')).href);
const { parseCmsImportDocument } = await import(pathToFileURL(path.join(root, 'server/src/services/cmsDocumentExtractService.js')).href);

const { extractCmsFieldsFromText, parseLabeledSections } = extraction;
const { structuredContentToCanonicalBlogHtml } = canonical;
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };

function onePagePdf(text) {
  const escaped = text.replace(/([\\()])/g, '\\$1');
  const objects = [
    '<< /Length 0 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 4 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 2 0 R >> >> /Contents 1 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Catalog /Pages 4 0 R >>',
  ];
  const stream = `BT /F1 11 Tf 72 720 Tm (${escaped}) Tj ET`;
  objects[0] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) { offsets.push(out.length); out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const ordered = `Title\nA Factual Blog\nCategory\nExam Prep\nAuthor Name\nEditorial Team\nSummary / Excerpt\nA short summary.\nContent\n## Introduction\nA long article body.\n\nSources\n[Official](https://example.org/source)\nTags\nIELTS, Study Abroad\nReading Time: 8\nPublished At\n2026-08-20\nStatus\ndraft\nSEO Slug\na-factual-blog\nSEO Title\nA Factual Blog\nMeta Description\nA factual description.\nCanonical Link\nhttps://www.strideto.com/blog/a-factual-blog\nFeatured\nfalse`;
const shuffled = `Sources\n[Official](https://example.org/source)\nSEO Title: A Factual Blog\nTags: IELTS, Study Abroad\nContent\n## Introduction\nA long article body.\n\nSources are discussed here as ordinary article text.\nFeatured: false\nBlog Title: A Factual Blog\nCanonical URL: https://www.strideto.com/blog/a-factual-blog\nSummary: A short summary.\nPublication Status: draft\nAuthor: Editorial Team\nMeta Description: A factual description.\nRead Time: 8\nBlog Category: Exam Prep\nPublish Date: 2026-08-20\nURL Slug: a-factual-blog`;

const first = extractCmsFieldsFromText(ordered, 'blog').suggestions;
const second = extractCmsFieldsFromText(shuffled, 'blog').suggestions;
for (const field of ['title', 'category', 'authorName', 'excerpt', 'content', 'tags', 'readingTime', 'status', 'slug', 'seoTitle', 'metaDescription', 'canonicalUrl', 'isFeatured']) {
  check(first[field] && second[field], `BLOG-AF order field ${field}`);
}
check(second.title.value === 'A Factual Blog', 'BLOG-AF-28 inline title');
check(second.category.value === 'Exam Prep', 'BLOG-AF-09 category normalization');
check(second.tags.value.length === 2 && second.tags.value.includes('Study Abroad'), 'BLOG-AF-08 tags normalization');
check(second.isFeatured.value === false, 'BLOG-AF-12 explicit featured false');
check(second.content.value.includes('Sources are discussed here'), 'BLOG-AF-31 content does not truncate ordinary Sources text');
check(second.content.value.includes('blog-sources'), 'BLOG-AF-07 source block remains canonical content');
check(!second.content.value.includes('<script'), 'BLOG-AF-34 content is safe');

const natural = extractCmsFieldsFromText(
  `How to Prepare for IELTS — A Factual Guide\n\nIntroduction\n\nUse official guidance and plan early.\n\nPreparation Strategy\n\nBuild a weekly study plan.`,
  'blog',
).suggestions;
check(natural.title?.value.startsWith('How to Prepare'), 'BLOG-AF-30 natural title inference');
check(natural.content?.value.includes('Preparation Strategy'), 'BLOG-AF-30 natural body preserved');
check(!natural.content?.value.includes('How to Prepare for IELTS — A Factual Guide</p>'), 'BLOG-AF-30 natural title is not duplicated in content');
check(!natural.category && !natural.authorName && !natural.isFeatured, 'BLOG-AF-27 natural metadata is not fabricated');

const unsafe = extractCmsFieldsFromText('Title: Safe\nCanonical URL: javascript:alert(1)\nFeatured: maybe\nStatus: published', 'blog').suggestions;
check(!unsafe.canonicalUrl && !unsafe.isFeatured, 'BLOG-AF-11/12 unsafe values rejected');
check(unsafe.status?.status === 'review', 'BLOG-AF-13 published remains review-only');
check(!contracts.isAllowlistedCmsField('blog', 'author'), 'BLOG-AF-22 privileged author relation denied');
check(!contracts.isAllowlistedCmsField('blog', 'createdBy'), 'BLOG-AF-22 protected owner field denied');

try {
  await validateCmsDocumentBuffer(Buffer.from('not pdf'), 'application/pdf', 'article.pdf');
  check(false, 'BLOG-AF-17 malformed PDF rejected');
} catch (err) {
  check(err.code === 'invalid_file_content', 'BLOG-AF-17 malformed PDF rejected');
}
const pdfHeader = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n', 'ascii');
check((await validateCmsDocumentBuffer(pdfHeader, 'application/pdf', 'article.pdf')).format === 'pdf', 'BLOG-AF-18 PDF format accepted at validation boundary');
const pdfResult = await parseCmsImportDocument(onePagePdf('Title: PDF Article'), 'application/pdf', 'article.pdf', 'blog');
check(pdfResult.meta.format === 'pdf' && pdfResult.suggestions.title?.value === 'PDF Article', 'BLOG-AF-18 text PDF reaches CMS parser');
try {
  await validateCmsDocumentBuffer(Buffer.from('x'), 'text/plain', 'article.doc');
  check(false, 'BLOG-AF-17 legacy DOC rejected');
} catch (err) {
  check(err.code === 'unsupported_format', 'BLOG-AF-17 legacy DOC rejected');
}

const sections = parseLabeledSections('Title: Inline\nContent\nBody\nMeta Title: SEO\nFeatured: false', 'blog');
check(sections.get('title') === 'Inline' && sections.get('seoTitle') === 'SEO', 'BLOG-AF-29 mixed inline/multiline labels');
check(structuredContentToCanonicalBlogHtml('## Heading\n- One\n1. Two').includes('<h2>Heading</h2>'), 'BLOG-AF-33 headings/lists canonicalize');

console.log(`BLOG-DOCUMENT-AUTOFILL: ${checks} checks passed`);
