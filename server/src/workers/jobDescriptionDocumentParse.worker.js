import { parentPort, workerData } from 'worker_threads';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

async function extractTextFromPdf(buffer) {
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
