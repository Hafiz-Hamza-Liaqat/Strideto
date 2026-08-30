/**
 * STRIDETO JOB-AUTOFILL — bounded document parse worker lifecycle.
 *
 * `pdf-parse` loads the native `@napi-rs/canvas` (Skia) addon at module scope. While the job
 * worker imported it at the top level, every DOCX parse loaded that addon into a short-lived
 * worker isolate and the host process intermittently died with SIGSEGV (exit 139) on worker
 * teardown — DOCX-only traffic crashed on PDF machinery it never used. The import is now lazy.
 *
 * Nothing in the suite previously spawned a worker; the only coverage was source-text greps,
 * which is why the crash shipped. These tests drive the real `extractDocumentTextBounded` path.
 *
 * Run: node src/__tests__/jobDocumentWorkerLifecycle.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  extractDocumentTextBounded,
  DOCUMENT_PARSE_TIMEOUT_MS,
} from '../services/boundedDocumentTextExtract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

// ── minimal DOCX writer (deflated zip, no third-party dependency) ──

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = Buffer.from(text, 'utf8');
    const data = deflateRawSync(raw);
    const crc = crc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    local.push(lh, nameBuf, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);

    offset += 30 + nameBuf.length + data.length;
  }
  const localBuf = Buffer.concat(local);
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(localBuf.length, 16);
  return Buffer.concat([localBuf, centralBuf, end]);
}

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildDocx(paragraphs) {
  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`)
    .join('');
  return zip([
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '</Types>',
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        + '</Relationships>',
    ],
    [
      'word/document.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        + `<w:body>${body}</w:body></w:document>`,
    ],
  ]);
}

const DOCX = buildDocx([
  'Job Title',
  'AI Agent Engineer',
  'Location',
  'Remote — Pakistan',
  'About the Role',
  'Design, build and operate production LLM agent systems end to end.',
]);

// ── A. DOCX worker parse succeeds ──
{
  const text = await extractDocumentTextBounded('docx', DOCX);
  check(typeof text === 'string' && text.length > 0, 'WORKER-A-01 DOCX worker parse returns text');
  check(text.includes('AI Agent Engineer'), 'WORKER-A-02 DOCX worker parse returns document content');
  check(text.includes('production LLM agent systems'), 'WORKER-A-03 full body text survives the worker hop');
}

// ── B. 25 sequential DOCX worker parses in one parent process ──
//
// The regression this guards is a native SIGSEGV: a crash kills this process outright, so
// reaching the assertion below is itself the proof that 25 spawn/teardown cycles are safe.
{
  const ITERATIONS = 25;
  let ok = 0;
  for (let i = 0; i < ITERATIONS; i += 1) {
    const text = await extractDocumentTextBounded('docx', DOCX);
    if (text.includes('AI Agent Engineer')) ok += 1;
  }
  check(ok === ITERATIONS, `WORKER-B-01 ${ITERATIONS} sequential DOCX worker parses all succeeded (got ${ok})`);
}

// ── C. the DOCX worker path never loads pdf-parse ──
//
// Runtime proof, not a source grep: a child process registers an ESM resolve hook that makes
// `pdf-parse` unresolvable. Loader hooks propagate into worker threads, so a DOCX parse that
// still succeeds provably never resolved `pdf-parse`. The same child then parses a PDF and must
// fail — that second half proves the hook is in force, so the first half is not a false negative.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'strideto-worker-'));
  const docxPath = path.join(tmp, 'probe.docx');
  const pdfPath = path.join(repoRoot, 'docs/archive/qa/qa-sprint-b2/short-1page.pdf');
  fs.writeFileSync(docxPath, DOCX);

  fs.writeFileSync(
    path.join(tmp, 'hook.mjs'),
    "export async function resolve(specifier, context, next) {\n"
      + "  if (specifier === 'pdf-parse') throw new Error('PDF_PARSE_RESOLVED');\n"
      + "  return next(specifier, context);\n"
      + "}\n",
  );
  fs.writeFileSync(
    path.join(tmp, 'register.mjs'),
    "import { register } from 'node:module';\n"
      + "register(new URL('./hook.mjs', import.meta.url));\n",
  );
  const serviceUrl = pathToFileURL(
    path.join(repoRoot, 'server/src/services/boundedDocumentTextExtract.js'),
  ).href;
  fs.writeFileSync(
    path.join(tmp, 'probe.mjs'),
    "import fs from 'node:fs';\n"
      + `const { extractDocumentTextBounded } = await import(${JSON.stringify(serviceUrl)});\n`
      + "try {\n"
      + "  const t = await extractDocumentTextBounded('docx', fs.readFileSync(process.argv[2]));\n"
      + "  console.log(t.includes('AI Agent Engineer') ? 'DOCX_OK' : 'DOCX_EMPTY');\n"
      + "} catch (e) { console.log('DOCX_FAIL:' + (e.code || e.message)); }\n"
      + "try {\n"
      + "  await extractDocumentTextBounded('pdf', fs.readFileSync(process.argv[3]));\n"
      + "  console.log('PDF_OK');\n"
      + "} catch { console.log('PDF_BLOCKED'); }\n",
  );

  const res = spawnSync(
    process.execPath,
    [
      '--import',
      pathToFileURL(path.join(tmp, 'register.mjs')).href,
      path.join(tmp, 'probe.mjs'),
      docxPath,
      pdfPath,
    ],
    { encoding: 'utf8' },
  );
  const out = String(res.stdout || '');

  check(out.includes('DOCX_OK'), `WORKER-C-01 DOCX parses with pdf-parse unresolvable (stdout: ${out.trim()})`);
  check(out.includes('PDF_BLOCKED'), `WORKER-C-02 hook proven in force — PDF path blocked (stdout: ${out.trim()})`);

  const workerSrc = fs.readFileSync(
    path.join(repoRoot, 'server/src/workers/jobDescriptionDocumentParse.worker.js'),
    'utf8',
  );
  check(!/^import[^\n]*'pdf-parse'/m.test(workerSrc), 'WORKER-C-03 no top-level pdf-parse import in the worker');
  check(workerSrc.includes("await import('pdf-parse')"), 'WORKER-C-04 pdf-parse imported lazily inside the PDF path');

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── D. unsupported format still rejects ──
{
  for (const format of ['rtf', 'odt', '']) {
    let code = null;
    try {
      await extractDocumentTextBounded(format, DOCX);
    } catch (e) {
      code = e.code;
    }
    check(code === 'unsupported_format', `WORKER-D-01 '${format}' rejects as unsupported_format (got ${code})`);
  }
}

// ── E. timeout still bounds the parse ──
//
// 1ms cannot outrun worker bootstrap (~90ms measured), so this is deterministic, not a race.
{
  const started = Date.now();
  let code = null;
  try {
    await extractDocumentTextBounded('docx', DOCX, 1);
  } catch (e) {
    code = e.code;
  }
  const elapsed = Date.now() - started;
  check(code === 'parse_timeout', `WORKER-E-01 sub-parse timeout rejects as parse_timeout (got ${code})`);
  check(elapsed < 5_000, `WORKER-E-02 timeout rejection is prompt (${elapsed}ms)`);
  check(DOCUMENT_PARSE_TIMEOUT_MS === 30_000, 'WORKER-E-03 default parse timeout unchanged at 30s');
}

// ── F. worker exits with code 0 before posting a result ──
//
// Previously the 'exit' handler ignored code 0, leaving the promise pending until the 30s
// timeout. This runs in a child process so the Worker constructor can be substituted before the
// service is first imported — that drives the real exit path rather than a reimplementation of
// it, and keeps the substitution out of this process, where the real worker is still in use.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'strideto-exit0-'));
  const serviceUrl = pathToFileURL(
    path.join(repoRoot, 'server/src/services/boundedDocumentTextExtract.js'),
  ).href;
  const probe = path.join(tmp, 'exit-zero.mjs');
  fs.writeFileSync(
    probe,
    "import { createRequire } from 'node:module';\n"
      + "import { EventEmitter } from 'node:events';\n"
      + "const require = createRequire(import.meta.url);\n"
      + "const workerThreads = require('worker_threads');\n"
      + "class ExitsCleanlyWithoutMessage extends EventEmitter {\n"
      + "  constructor() { super(); setImmediate(() => this.emit('exit', 0)); }\n"
      + "  terminate() { return Promise.resolve(0); }\n"
      + "}\n"
      + "workerThreads.Worker = ExitsCleanlyWithoutMessage;\n"
      + `const { extractDocumentTextBounded } = await import(${JSON.stringify(serviceUrl)});\n`
      + "const started = Date.now();\n"
      + "try {\n"
      + "  await extractDocumentTextBounded('docx', Buffer.from('unused'));\n"
      + "  console.log('RESOLVED|' + (Date.now() - started));\n"
      + "} catch (e) { console.log('REJECTED|' + (Date.now() - started) + '|' + e.code); }\n",
  );

  const res = spawnSync(process.execPath, [probe], { encoding: 'utf8', timeout: 20_000 });
  const out = String(res.stdout || '').trim();
  const [outcome, msStr, code] = out.split('|');
  const elapsed = Number(msStr);

  check(outcome === 'REJECTED', `WORKER-F-01 clean exit without a result settles rather than hanging (stdout: ${out})`);
  check(code === 'corrupt_document', `WORKER-F-02 clean exit without a result rejects as corrupt_document (got ${code})`);
  check(elapsed < 1_000, `WORKER-F-03 rejection is immediate, not after the 30s timeout (${elapsed}ms)`);

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── G. the real Worker constructor survives the probe ──
{
  const text = await extractDocumentTextBounded('docx', DOCX);
  check(text.includes('AI Agent Engineer'), 'WORKER-G-01 real worker path still healthy after the exit-0 probe');
}

console.log(`jobDocumentWorkerLifecycle.test.js: ${count} assertions passed`);
