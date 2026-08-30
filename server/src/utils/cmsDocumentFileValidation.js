import { rejectDangerousFilename, sniffMime } from './fileValidation.js';

const MAX_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXTENSIONS = new Set(['txt', 'docx']);

const REJECTED_EXTENSIONS = new Set(['doc', 'docm', 'pdf', 'zip', 'rar', '7z', 'html', 'htm', 'exe', 'js']);

function extensionOf(name) {
  const parts = String(name || '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function isBinaryText(buffer) {
  if (!buffer?.length) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let nulls = 0;
  for (const b of sample) {
    if (b === 0) nulls += 1;
  }
  return nulls > 0;
}

function hasDocxWordDocument(buffer) {
  if (!buffer?.length) return false;
  const head = buffer.subarray(0, Math.min(buffer.length, 512 * 1024)).toString('latin1');
  return head.includes('word/document.xml');
}

/**
 * Validate CMS document upload (DOCX + TXT only).
 * @returns {{ mime: string, format: 'txt'|'docx' }}
 */
export async function validateCmsDocumentBuffer(buffer, declaredMime, originalname) {
  rejectDangerousFilename(originalname || 'upload');

  if (!buffer?.length) {
    const err = new Error('Empty file');
    err.code = 'invalid_file_content';
    err.status = 400;
    throw err;
  }
  if (buffer.length > MAX_SIZE) {
    const err = new Error('Document is too large');
    err.code = 'file_too_large';
    err.status = 400;
    throw err;
  }

  const ext = extensionOf(originalname);
  if (REJECTED_EXTENSIONS.has(ext)) {
    const err = new Error('Unsupported file format');
    err.code = 'unsupported_format';
    err.status = 400;
    throw err;
  }
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    const err = new Error('Unsupported file format');
    err.code = 'unsupported_format';
    err.status = 400;
    throw err;
  }

  const detected = sniffMime(buffer);
  let mime = detected || declaredMime;

  if (ext === 'txt') {
    if (isBinaryText(buffer)) {
      const err = new Error('TXT file contains binary content');
      err.code = 'invalid_file_content';
      err.status = 400;
      throw err;
    }
    mime = 'text/plain';
  }

  if (ext === 'docx' && detected !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const err = new Error('File is not a valid DOCX document');
    err.code = 'invalid_file_content';
    err.status = 400;
    throw err;
  }

  if (ext === 'docx' && !hasDocxWordDocument(buffer)) {
    const err = new Error('File is not a valid DOCX document');
    err.code = 'invalid_file_content';
    err.status = 400;
    throw err;
  }

  if (detected === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && ext !== 'docx') {
    const err = new Error('Unsupported file format');
    err.code = 'unsupported_format';
    err.status = 400;
    throw err;
  }

  if (!mime || !ALLOWED_MIMES.has(mime)) {
    const err = new Error('Unsupported file format');
    err.code = 'unsupported_format';
    err.status = 400;
    throw err;
  }

  const format = mime === 'text/plain' ? 'txt' : 'docx';
  return { mime, format };
}

export { MAX_SIZE as CMS_DOCUMENT_MAX_SIZE };
