import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';

const WORKER_FILE = fileURLToPath(new URL('../workers/cmsDocumentParse.worker.js', import.meta.url));
export const CMS_DOCUMENT_PARSE_TIMEOUT_MS = 30_000;

/**
 * Extract raw text + optional HTML from CMS DOCX/TXT in worker thread.
 */
export function extractCmsDocumentBounded(format, buffer, timeoutMs = CMS_DOCUMENT_PARSE_TIMEOUT_MS) {
  if (format === 'txt') {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
    return Promise.resolve({ text, html: '' });
  }

  if (format !== 'docx') {
    const err = new Error('Unsupported format');
    err.code = 'unsupported_format';
    return Promise.reject(err);
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_FILE, { workerData: { format, buffer } });
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      fn(value);
    };

    const timer = setTimeout(() => {
      const err = new Error('Document parsing timed out');
      err.code = 'parse_timeout';
      finish(reject, err);
    }, timeoutMs);

    worker.on('message', (msg) => {
      if (msg?.ok) {
        finish(resolve, { text: msg.text || '', html: msg.html || '' });
        return;
      }
      const err = new Error(msg?.error || 'Parse failed');
      err.code = msg?.code || 'corrupt_document';
      finish(reject, err);
    });

    worker.on('error', (err) => finish(reject, err));

    // A worker that exits before posting a result never settles the promise on its own, so an
    // exit code of 0 must reject here too rather than leave the caller waiting for the timeout.
    worker.on('exit', () => {
      if (settled) return;
      const err = new Error('Document parser worker exited unexpectedly');
      err.code = 'corrupt_document';
      finish(reject, err);
    });
  });
}
