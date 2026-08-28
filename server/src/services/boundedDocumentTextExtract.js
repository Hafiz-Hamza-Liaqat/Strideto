import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';

const WORKER_FILE = fileURLToPath(new URL('../workers/jobDescriptionDocumentParse.worker.js', import.meta.url));
export const DOCUMENT_PARSE_TIMEOUT_MS = 30_000;

/**
 * Extract text from PDF/DOCX in an isolated worker thread.
 * On timeout the worker is terminated so CPU-bound parsing cannot block the main event loop.
 */
export function extractDocumentTextBounded(format, buffer, timeoutMs = DOCUMENT_PARSE_TIMEOUT_MS) {
  if (format === 'txt') {
    return Promise.resolve(
      buffer.toString('utf8').replace(/^\uFEFF/, '').trim()
    );
  }

  if (format !== 'pdf' && format !== 'docx') {
    const err = new Error('Unsupported format');
    err.code = 'unsupported_format';
    return Promise.reject(err);
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_FILE, {
      workerData: { format, buffer },
    });

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
        finish(resolve, msg.text);
        return;
      }
      const err = new Error(msg?.error || 'Parse failed');
      err.code = msg?.code || 'corrupt_document';
      finish(reject, err);
    });

    worker.on('error', (err) => finish(reject, err));

    worker.on('exit', (code) => {
      if (settled) return;
      if (code !== 0) {
        const err = new Error('Document parser worker exited unexpectedly');
        err.code = 'corrupt_document';
        finish(reject, err);
      }
    });
  });
}
