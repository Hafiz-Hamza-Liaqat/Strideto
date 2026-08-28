import { validateJobDescriptionBuffer } from '../utils/jobDescriptionFileValidation.js';
import { extractDocumentTextBounded } from './boundedDocumentTextExtract.js';
import {
  extractJobFieldsFromText,
  filterSuggestionsForMode,
  JOB_DOCUMENT_PROTECTED_FIELDS,
} from '../../../shared/jobs/jobDocumentExtraction.js';

function isLikelyScannedPdf(text) {
  const trimmed = String(text || '').trim();
  return trimmed.length < 40;
}

/**
 * Parse uploaded job description and return suggestions only (no Job mutation).
 * PDF/DOCX parsing runs in a worker thread with hard timeout + terminate.
 * @param {Buffer} buffer
 * @param {string} declaredMime
 * @param {string} originalname
 * @param {'employer'|'admin'} mode
 */
export async function parseJobDescriptionDocument(buffer, declaredMime, originalname, mode = 'employer') {
  const { format } = await validateJobDescriptionBuffer(buffer, declaredMime, originalname);

  let text;
  try {
    text = await extractDocumentTextBounded(format, buffer);
  } catch (err) {
    if (err.code) throw err;
    const e = new Error(err.message || 'Parse failed');
    e.code = 'corrupt_document';
    throw e;
  }

  if (!text) {
    if (format === 'pdf') {
      const err = new Error('No extractable text found. Scanned/image-only PDFs are not supported in V1.');
      err.code = 'scanned_pdf_unsupported';
      throw err;
    }
    const err = new Error('No extractable text found in document');
    err.code = 'no_extractable_text';
    throw err;
  }

  if (format === 'pdf' && isLikelyScannedPdf(text)) {
    const err = new Error('No extractable text found. Scanned/image-only PDFs are not supported in V1.');
    err.code = 'scanned_pdf_unsupported';
    throw err;
  }

  const { suggestions, meta } = extractJobFieldsFromText(text, { mode });
  const filtered = filterSuggestionsForMode(suggestions, mode);

  for (const key of JOB_DOCUMENT_PROTECTED_FIELDS) {
    delete filtered[key];
  }

  const fieldCount = Object.keys(filtered).length;
  return {
    suggestions: filtered,
    meta: {
      ...meta,
      format,
      partial: fieldCount === 0,
      protectedFieldsBlocked: JOB_DOCUMENT_PROTECTED_FIELDS,
    },
  };
}
