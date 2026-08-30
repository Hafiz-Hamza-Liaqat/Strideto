import { parentPort, workerData } from 'worker_threads';
import mammoth from 'mammoth';

/**
 * `pdf-parse` pulls in the native `@napi-rs/canvas` (Skia) addon at module scope. Loading that
 * addon into a short-lived worker isolate intermittently segfaults the host process on worker
 * teardown, which crashed DOCX parses that never touch PDF code. Import it lazily so the DOCX
 * path never loads it. PDF extraction semantics are unchanged.
 */
async function extractTextFromPdf(buffer) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer, isEvalSupported: false });
  try {
    const result = await parser.getText();
    return String(result?.text || '').trim();
  } catch (err) {
    const msg = String(err?.message || err || '').toLowerCase();
    if (msg.includes('password') || msg.includes('encrypted')) {
      const e = new Error('Password-protected PDF is not supported');
      e.code = 'password_protected_pdf';
      throw e;
    }
    const e = new Error('Could not parse PDF document');
    e.code = 'corrupt_document';
    throw e;
  } finally {
    try {
      await parser.destroy();
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
