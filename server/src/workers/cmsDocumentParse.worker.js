import { parentPort, workerData } from 'worker_threads';
import mammoth from 'mammoth';

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
