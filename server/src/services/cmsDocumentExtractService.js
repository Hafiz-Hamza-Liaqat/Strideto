import { validateCmsDocumentBuffer } from '../utils/cmsDocumentFileValidation.js';
import { extractCmsDocumentBounded } from './cmsDocumentBoundedExtract.js';
import { extractCmsFieldsFromText } from '../../../shared/cms/cmsDocumentExtraction.js';
import { sanitizeHtml } from '../utils/htmlSanitize.js';

const CONTENT_TYPES = new Set(['blog', 'career-article']);

function mapParseError(err) {
  const code = err.code || 'corrupt_document';
  const status = err.status || 400;
  return { status, body: { error: err.message, code } };
}

/**
 * Parse uploaded CMS document — suggestions only, no database write.
 */
export async function parseCmsImportDocument(buffer, declaredMime, originalname, contentType) {
  if (!CONTENT_TYPES.has(contentType)) {
    const err = new Error('Invalid content type');
    err.code = 'invalid_content_type';
    err.status = 400;
    throw err;
  }

  const { format } = await validateCmsDocumentBuffer(buffer, declaredMime, originalname);
  let text;
  let docxHtml = '';
  try {
    const extracted = await extractCmsDocumentBounded(format, buffer);
    text = extracted.text;
    docxHtml = extracted.html || '';
  } catch (err) {
    if (err.code) throw err;
    const e = new Error(err.message || 'Parse failed');
    e.code = 'corrupt_document';
    throw e;
  }

  if (!text?.trim()) {
    const err = new Error('No extractable text found in document');
    err.code = 'no_extractable_text';
    throw err;
  }

  const { suggestions, meta } = extractCmsFieldsFromText(text, contentType, {
    contentHtml: docxHtml,
    documentText: text,
  });

  if (suggestions.content?.value && contentType === 'blog') {
    suggestions.content.value = sanitizeHtml(String(suggestions.content.value));
  }

  const warnings = [];
  if (meta.reviewCount > 0) {
    warnings.push(`${meta.reviewCount} field(s) need review before applying.`);
  }
  if (suggestions.status?.status === 'review') {
    warnings.push('Document status "published" requires manual confirmation.');
  }

  return {
    contentType,
    suggestions,
    meta: {
      ...meta,
      format,
      warnings,
    },
  };
}

export { mapParseError };
