import { parentPort, workerData } from 'worker_threads';
import mammoth from 'mammoth';

/**
 * PDF text extraction runs directly on `pdfjs-dist`, not on `pdf-parse`.
 *
 * `pdf-parse` requires the native `@napi-rs/canvas` (Skia) addon at module scope. Loading that
 * addon into a short-lived worker isolate intermittently segfaulted the host process on worker
 * teardown. STRIDETO only ever needs the text layer, so the render dependency is pure liability:
 * this path calls the pdfjs-dist text APIs and never resolves `@napi-rs/canvas` at all.
 *
 * The MODERN build (`pdfjs-dist/build/pdf.mjs`) is deliberate. The `legacy` build eagerly wires up
 * Node canvas support and pulls the Skia addon back in; the modern build only `require`s it from
 * inside its canvas factory, which text extraction never reaches.
 *
 * The import stays lazy so the DOCX path never loads PDF machinery.
 */

/** Line/cell reconstruction constants — these reproduce the `pdf-parse` output the job-description
 * field parser is written against. Changing them changes extracted text, so they are fixed here. */
const LINE_THRESHOLD = 4.6;
const CELL_THRESHOLD = 7;
const CELL_SEPARATOR = '\t';
/** Emitted verbatim after every page; the downstream parser sees these markers. */
const PAGE_JOINER = '\n-- page_number of total_number --';

let pdfjsPromise;

function installDomMatrixShim() {
  if (typeof globalThis.DOMMatrix !== 'undefined') return;
  /**
   * `pdfjs-dist/build/pdf.mjs` evaluates `new DOMMatrix()` while the module initialises, on its
   * canvas-rendering path. Node has no DOMMatrix, so the import throws without this.
   *
   * STRIDETO extracts text only and never renders a page, so this shim intentionally implements
   * NOTHING: no transform math, no canvas, no `@napi-rs/canvas`. It exists purely to let module
   * initialisation complete. Any property access beyond construction means something reached the
   * rendering path, which is unsupported here — better to fail loudly than to return silently
   * wrong geometry.
   */
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      this.init = init;
    }
  };
}

function loadPdfjs() {
  pdfjsPromise ??= (async () => {
    installDomMatrixShim();
    // The modern build warns "Please use the `legacy` build in Node.js environments." at module
    // scope. Using the legacy build is exactly what reintroduces the Skia addon, so the advice is
    // wrong for this worker; silence that one line rather than log it on every PDF parse. Nothing
    // else runs in this worker while the import is in flight.
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      return await import('pdfjs-dist/build/pdf.mjs');
    } finally {
      console.warn = originalWarn;
    }
  })();
  return pdfjsPromise;
}

/**
 * Rebuild a page's plain text from its text items, inserting line breaks and cell separators the
 * same way `pdf-parse` did (lineEnforce enabled, LINE_THRESHOLD / CELL_THRESHOLD above).
 */
async function getPageText(page) {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent({
    includeMarkedContent: false,
    disableNormalization: false,
  });

  const parts = [];
  let lastX;
  let lastY;
  let lineHeight = 0;

  for (const item of content.items) {
    if (!('str' in item)) continue;
    const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);

    if (lastY !== undefined && Math.abs(lastY - y) > LINE_THRESHOLD) {
      const previous = parts.length ? parts[parts.length - 1] : undefined;
      const itemStartsNewLine = item.str.startsWith('\n') || (item.str.trim() === '' && item.hasEOL);
      if (previous?.endsWith('\n') === false && !itemStartsNewLine) {
        // A vertical jump larger than one line height is a blank line, not just a wrap.
        if (Math.abs(lastY - y) - 1 > lineHeight) parts.push('\n');
        parts.push('\n');
      }
    } else if (lastX !== undefined && x - lastX > CELL_THRESHOLD) {
      parts.push(CELL_SEPARATOR);
    }

    parts.push(item.str);
    if (item.hasEOL) parts.push('\n');

    lastX = x + (item.width || 0);
    lastY = y;
    lineHeight = item.height || lineHeight;
  }

  return parts.join('');
}

async function extractTextFromPdf(buffer) {
  const pdfjs = await loadPdfjs();
  let loadingTask;
  let doc;
  try {
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0,
    });
    doc = await loadingTask.promise;

    const total = doc.numPages;
    let text = '';
    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const pageText = await getPageText(page);
      page.cleanup();
      const joiner = PAGE_JOINER
        .replace('page_number', String(pageNumber))
        .replace('total_number', String(total));
      text += `${pageText}\n${joiner}\n\n`;
    }
    return text.trim();
  } catch (err) {
    const name = String(err?.name || '');
    const msg = String(err?.message || err || '').toLowerCase();
    if (name === 'PasswordException' || msg.includes('password') || msg.includes('encrypted')) {
      const e = new Error('Password-protected PDF is not supported');
      e.code = 'password_protected_pdf';
      throw e;
    }
    const e = new Error('Could not parse PDF document');
    e.code = 'corrupt_document';
    throw e;
  } finally {
    try {
      // `destroy()` on the document also tears down its loading task; when the document never
      // resolved, the loading task still has to be destroyed on its own.
      if (doc) await doc.destroy();
      else if (loadingTask) await loadingTask.destroy();
    } catch {
      // ignore cleanup errors
    }
  }
}

async function extractTextFromDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return String(result?.value || '').trim();
  } catch {
    const err = new Error('Could not parse DOCX document');
    err.code = 'corrupt_document';
    throw err;
  }
}

async function run() {
  const { format, buffer } = workerData;
  try {
    let text = '';
    if (format === 'pdf') text = await extractTextFromPdf(buffer);
    else if (format === 'docx') text = await extractTextFromDocx(buffer);
    else {
      const err = new Error('Unsupported format');
      err.code = 'unsupported_format';
      throw err;
    }
    parentPort.postMessage({ ok: true, text });
  } catch (err) {
    parentPort.postMessage({
      ok: false,
      error: err.message || 'Parse failed',
      code: err.code || 'corrupt_document',
    });
  }
}

run();
