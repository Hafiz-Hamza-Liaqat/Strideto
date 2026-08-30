import { validateCmsDocumentBuffer } from '../utils/cmsDocumentFileValidation.js';
import { extractCmsDocumentBounded } from './cmsDocumentBoundedExtract.js';
import { extractCmsFieldsFromText, parseLabeledSections } from '../../../shared/cms/cmsDocumentExtraction.js';
import { importPlainTextToBlogHtml } from '../../../shared/cms/importContentHtml.js';
import { sanitizeHtml } from '../utils/htmlSanitize.js';

const CONTENT_TYPES = new Set(['blog', 'career-article']);

function mapParseError(err) {
  const code = err.code || 'corrupt_document';
  const status = err.status || 400;
  return { status, body: { error: err.message, code } };
}

function sanitizeContentSuggestion(suggestions, rawText, contentType) {
  if (!suggestions?.content?.value) return;
  const sections = parseLabeledSections(rawText, contentType);
  const plain = sections.get('content') || suggestions.content.value;
  const html = importPlainTextToBlogHtml(plain);
  suggestions.content.value = sanitizeHtml(html);
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
  try {
    const extracted = await extractCmsDocumentBounded(format, buffer);
    text = extracted.text;
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

  const { suggestions, meta } = extractCmsFieldsFromText(text, contentType);
  sanitizeContentSuggestion(suggestions, text, contentType);

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
