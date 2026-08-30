/**
 * STRIDETO CMS-AUTOFILL — bounded CMS document parse worker lifecycle.
 *
 * `extractCmsDocumentBounded` only rejected on a NON-ZERO worker exit code. A worker that exited
 * cleanly without ever posting a message therefore settled nothing, and the caller hung until the
 * 30-second parse timeout fired — a 30s stall on an admin import request instead of an immediate
 * error. The identical bug was already fixed for the job-document worker in
 * `boundedDocumentTextExtract.js`; this suite is the CMS-side equivalent of the coverage that
 * caught it there.
 *
 * Nothing in the suite previously spawned the CMS worker at all, which is why the hang survived.
 * These tests drive the real `extractCmsDocumentBounded`.
 *
 * Run: node src/__tests__/cmsDocumentWorkerLifecycle.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  extractCmsDocumentBounded,
  CMS_DOCUMENT_PARSE_TIMEOUT_MS,
} from '../services/cmsDocumentBoundedExtract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const serviceUrl = pathToFileURL(
  path.join(repoRoot, 'server/src/services/cmsDocumentBoundedExtract.js'),
).href;

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
    .map(([text, style]) => {
      const props = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
      return `<w:p>${props}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
    })
    .join('');
  // A real styles part is included so `w:pStyle` ids resolve to the display names
  // ("Heading 1"/"Heading 2") that the CMS worker's mammoth style map keys on. Without it mammoth
  // falls back to its own default heading mapping and the style map is never exercised.
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/></w:style>'
    + '</w:styles>';

  return zip([
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        + '</Types>',
    ],
    [
      'word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + '</Relationships>',
    ],
    ['word/styles.xml', styles],
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
  ['Why Pakistani Graduates Stall At The First Interview', 'Heading1'],
  ['Most first interviews are lost before the candidate speaks.'],
  ['What Employers Actually Screen For', 'Heading2'],
  ['Evidence of shipped work, not a list of coursework.'],
]);

// ── deterministic Worker substitution ──
//
// The substitution happens in a child process, before the service is first imported, so the real
// Worker constructor is driven by the real exit path rather than by a reimplementation of it — and
// the substitution stays out of this process, where the genuine worker is still in use.
//
// Each probe reports OUTCOME|elapsedMs|detail on stdout. No sleeps anywhere: the fakes emit their
// events on setImmediate, so timing assertions compare against the 30s timeout, which is orders of
// magnitude away.

function runWorkerProbe(label, fakeWorkerSource) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `strideto-cms-${label}-`));
  const probe = path.join(tmp, 'probe.mjs');
  fs.writeFileSync(
    probe,
    "import { createRequire } from 'node:module';\n"
      + "import { EventEmitter } from 'node:events';\n"
      + 'const require = createRequire(import.meta.url);\n'
      + "const workerThreads = require('worker_threads');\n"
      + 'globalThis.__terminateCalls = 0;\n'
      + `${fakeWorkerSource}\n`
      + 'workerThreads.Worker = FakeWorker;\n'
      + `const { extractCmsDocumentBounded } = await import(${JSON.stringify(serviceUrl)});\n`
      + 'const started = Date.now();\n'
      + 'try {\n'
      + "  const r = await extractCmsDocumentBounded('docx', Buffer.from('unused'));\n"
      + "  console.log('RESOLVED|' + (Date.now() - started) + '|' + JSON.stringify(r)"
      + " + '|terminate=' + globalThis.__terminateCalls);\n"
      + '} catch (e) {\n'
      + "  console.log('REJECTED|' + (Date.now() - started) + '|' + e.code"
      + " + '|terminate=' + globalThis.__terminateCalls);\n"
      + '}\n'
      + '// Give any late exit event a turn to fire and (wrongly) overwrite the settled result.\n'
      + 'await new Promise((r) => setTimeout(r, 50));\n'
      + "console.log('DONE');\n",
  );

  const res = spawnSync(process.execPath, [probe], { encoding: 'utf8', timeout: 20_000 });
  const out = String(res.stdout || '').trim();
  fs.rmSync(tmp, { recursive: true, force: true });

  const line = out.split('\n').find((l) => l.startsWith('RESOLVED|') || l.startsWith('REJECTED|')) || '';
  const [outcome, msStr, detail, terminate] = line.split('|');
  return {
    out,
    outcome,
    elapsed: Number(msStr),
    detail,
    terminate,
    settledOnce: out.split('\n').filter((l) => /^(RESOLVED|REJECTED)\|/.test(l)).length,
  };
}

const FAKE_WORKER_PREAMBLE = 'class FakeWorker extends EventEmitter {\n'
  + '  terminate() { globalThis.__terminateCalls += 1; return Promise.resolve(0); }\n';

// ── A. normal CMS DOCX extraction still succeeds ──
{
  const result = await extractCmsDocumentBounded('docx', DOCX);
  check(result && typeof result === 'object', 'CMS-A-01 CMS worker parse returns a result object');
  check(
    result.text.includes('Why Pakistani Graduates Stall At The First Interview'),
    'CMS-A-02 heading text survives the worker hop',
  );
  check(
    result.text.includes('Evidence of shipped work, not a list of coursework.'),
    'CMS-A-03 body text survives the worker hop',
  );
  check(
    result.html.includes('<h2>Why Pakistani Graduates Stall At The First Interview</h2>'),
    `CMS-A-04 styled heading maps to canonical HTML (got ${JSON.stringify(result.html.slice(0, 120))})`,
  );
  check(result.html.includes('<p>'), 'CMS-A-05 body paragraphs survive as HTML');
}

// ── A (cont). txt is handled inline, without a worker ──
{
  const result = await extractCmsDocumentBounded('txt', Buffer.from('﻿  Plain text body  '));
  check(result.text === 'Plain text body', 'CMS-A-06 txt extraction strips BOM and trims');
  check(result.html === '', 'CMS-A-07 txt extraction returns no HTML');
}

// ── B. worker exits with code 0 before posting a message ──
//
// This is the regression. Before the fix the exit handler ignored code 0, so the promise stayed
// pending until the 30s timeout; the elapsed-time assertion is what distinguishes "rejected
// because the exit was handled" from "rejected because the timeout eventually fired".
{
  const r = runWorkerProbe(
    'exit0',
    `${FAKE_WORKER_PREAMBLE}  constructor() { super(); setImmediate(() => this.emit('exit', 0)); }\n}`,
  );
  check(r.outcome === 'REJECTED', `CMS-B-01 clean exit without a result settles rather than hanging (stdout: ${r.out})`);
  check(
    r.detail === 'corrupt_document',
    `CMS-B-02 clean exit without a result rejects as corrupt_document (got ${r.detail})`,
  );
  check(
    r.elapsed < 1_000,
    `CMS-B-03 rejection is immediate, not after the 30s timeout (${r.elapsed}ms)`,
  );
  check(r.terminate === 'terminate=1', `CMS-B-04 the worker is still terminated on settle (got ${r.terminate})`);
}

// ── C. worker exits non-zero before posting a message ──
{
  const r = runWorkerProbe(
    'exit1',
    `${FAKE_WORKER_PREAMBLE}  constructor() { super(); setImmediate(() => this.emit('exit', 1)); }\n}`,
  );
  check(r.outcome === 'REJECTED', `CMS-C-01 non-zero exit without a result rejects (stdout: ${r.out})`);
  check(
    r.detail === 'corrupt_document',
    `CMS-C-02 non-zero exit rejects as corrupt_document (got ${r.detail})`,
  );
  check(r.elapsed < 1_000, `CMS-C-03 non-zero exit rejection is immediate (${r.elapsed}ms)`);
}

// ── D. timeout behaviour is unchanged ──
//
// 1ms cannot outrun worker bootstrap, so this is deterministic, not a race.
{
  const started = Date.now();
  let code = null;
  try {
    await extractCmsDocumentBounded('docx', DOCX, 1);
  } catch (e) {
    code = e.code;
  }
  const elapsed = Date.now() - started;
  check(code === 'parse_timeout', `CMS-D-01 sub-parse timeout rejects as parse_timeout (got ${code})`);
  check(elapsed < 5_000, `CMS-D-02 timeout rejection is prompt (${elapsed}ms)`);
  check(CMS_DOCUMENT_PARSE_TIMEOUT_MS === 30_000, 'CMS-D-03 default parse timeout unchanged at 30s');
}

// ── E. a successful message settles once; a later exit cannot overwrite it ──
//
// The settled guard is what makes the new unconditional exit rejection safe: the real worker exits
// with code 0 right after posting its result, and that exit must not turn a delivered result into
// a corrupt_document rejection.
{
  const r = runWorkerProbe(
    'msgthenexit',
    `${FAKE_WORKER_PREAMBLE}  constructor() {\n`
      + '    super();\n'
      + '    setImmediate(() => {\n'
      + "      this.emit('message', { ok: true, text: 'Parsed body', html: '<p>Parsed body</p>' });\n"
      + "      setImmediate(() => this.emit('exit', 0));\n"
      + '    });\n'
      + '  }\n}',
  );
  check(r.outcome === 'RESOLVED', `CMS-E-01 a delivered message resolves (stdout: ${r.out})`);
  check(
    r.detail === JSON.stringify({ text: 'Parsed body', html: '<p>Parsed body</p>' }),
    `CMS-E-02 the resolved value is the worker's result (got ${r.detail})`,
  );
  check(r.settledOnce === 1, `CMS-E-03 the promise settles exactly once (got ${r.settledOnce} settlements)`);
  check(r.out.includes('DONE'), 'CMS-E-04 the later exit event does not crash or re-settle the probe');
  check(r.terminate === 'terminate=1', `CMS-E-05 terminate runs once, not once per event (got ${r.terminate})`);
}

// ── F. unsupported format behaviour is unchanged ──
{
  for (const format of ['pdf', 'rtf', 'odt', '']) {
    let code = null;
    try {
      await extractCmsDocumentBounded(format, DOCX);
    } catch (e) {
      code = e.code;
    }
    check(code === 'unsupported_format', `CMS-F-01 '${format}' rejects as unsupported_format (got ${code})`);
  }
}

// ── G. the real Worker constructor survives the probes ──
{
  const result = await extractCmsDocumentBounded('docx', DOCX);
  check(
    result.text.includes('Why Pakistani Graduates Stall At The First Interview'),
    'CMS-G-01 real worker path still healthy after the substitution probes',
  );
}

// ── H. job and CMS exit-before-result semantics are aligned ──
//
// The two services are deliberately kept separate (no shared abstraction in this pass), so this
// asserts the invariant that must hold in both rather than the code that implements it.
{
  const cmsSrc = fs.readFileSync(
    path.join(repoRoot, 'server/src/services/cmsDocumentBoundedExtract.js'),
    'utf8',
  );
  const jobSrc = fs.readFileSync(
    path.join(repoRoot, 'server/src/services/boundedDocumentTextExtract.js'),
    'utf8',
  );
  for (const [name, src] of [['cms', cmsSrc], ['job', jobSrc]]) {
    const exitHandler = src.slice(src.indexOf("worker.on('exit'"));
    check(
      !/code\s*!==\s*0/.test(exitHandler),
      `CMS-H-01 the ${name} exit handler does not gate rejection on a non-zero code`,
    );
  }
}

console.log(`cmsDocumentWorkerLifecycle.test.js: ${count} assertions passed`);
