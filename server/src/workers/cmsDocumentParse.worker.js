import { parentPort, workerData } from 'worker_threads';
import mammoth from 'mammoth';

const MAX_EXTRACTED_TEXT = 150_000;

let pdfjsPromise;

function loadPdfjs() {
  pdfjsPromise ??= (async () => {
    if (typeof globalThis.DOMMatrix === 'undefined') globalThis.DOMMatrix = class DOMMatrix {};
    const warn = console.warn;
    console.warn = () => {};
    try { return await import('pdfjs-dist/build/pdf.mjs'); } finally { console.warn = warn; }
  })();
  return pdfjsPromise;
}

async function extractFromPdf(buffer) {
  const pdfjs = await loadPdfjs();
  let task;
  let doc;
  try {
    task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
    doc = await task.promise;
    let text = '';
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false });
      text += `${content.items.filter((item) => 'str' in item).map((item) => item.str).join(' ')}\n\n`;
      if (text.length > MAX_EXTRACTED_TEXT) {
        const err = new Error('Extracted document text is too large');
        err.code = 'document_text_too_large';
        throw err;
      }
      page.cleanup();
    }
    return text.trim();
  } catch (err) {
    const message = String(err?.message || err || '').toLowerCase();
    if (err?.name === 'PasswordException' || message.includes('password') || message.includes('encrypted')) {
      const e = new Error('Password-protected PDF is not supported');
      e.code = 'password_protected_pdf';
      throw e;
    }
    const e = new Error('Could not parse PDF document');
    e.code = 'corrupt_document';
    throw e;
  } finally {
    try {
      if (doc) await doc.destroy();
      else if (task) await task.destroy();
    } catch {
      // Cleanup failure must not replace the bounded parse result.
    }
  }
}

const MAMMOTH_STYLE_MAP = [
  "p[style-name='Heading 1'] => h2:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='heading 1'] => h2:fresh",
  "p[style-name='heading 2'] => h2:fresh",
  "p[style-name='heading 3'] => h3:fresh",
];

async function extractFromDocx(buffer) {
  try {
    const options = { styleMap: MAMMOTH_STYLE_MAP };
    const [textResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer }, options),
    ]);
    return {
      text: String(textResult?.value || '').trim(),
      html: String(htmlResult?.value || '').trim(),
    };
  } catch {
    const err = new Error('Could not parse DOCX document');
    err.code = 'corrupt_document';
    throw err;
  }
}

async function run() {
  const { format, buffer } = workerData;
  try {
    if (format === 'txt') {
      const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
      parentPort.postMessage({ ok: true, text, html: '' });
      return;
    }
    if (format === 'docx') {
      const { text, html } = await extractFromDocx(buffer);
      parentPort.postMessage({ ok: true, text, html });
      return;
    }
    if (format === 'pdf') {
      const text = await extractFromPdf(buffer);
      if (!text) {
        const err = new Error('No extractable text found in document');
        err.code = 'no_extractable_text';
        throw err;
      }
      parentPort.postMessage({ ok: true, text, html: '' });
      return;
    }
    const err = new Error('Unsupported format');
    err.code = 'unsupported_format';
    throw err;
  } catch (err) {
    parentPort.postMessage({
      ok: false,
      error: err.message || 'Parse failed',
      code: err.code || 'corrupt_document',
    });
  }
}

run();
