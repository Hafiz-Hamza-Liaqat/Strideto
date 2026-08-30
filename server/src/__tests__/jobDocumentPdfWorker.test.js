/**
 * STRIDETO JOB-AUTOFILL — PDF document parse worker (pure-text pdfjs-dist path).
 *
 * The PDF path used to run on `pdf-parse`, which requires the native `@napi-rs/canvas` (Skia)
 * addon at module scope. Loading Skia into a short-lived worker isolate intermittently killed the
 * host process with SIGSEGV (exit 139) on teardown. STRIDETO only ever needs the text layer, so
 * the worker now drives `pdfjs-dist` text APIs directly and never resolves the canvas addon.
 *
 * These tests are behavioural: they build real PDFs and push them through the real
 * `extractDocumentTextBounded` → worker → pdfjs-dist path. The extracted text is asserted byte for
 * byte, because the downstream job-field parser is written against this exact shape — line breaks,
 * tab cell separators and `-- n of m --` page markers included.
 *
 * Run: node src/__tests__/jobDocumentPdfWorker.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { extractDocumentTextBounded } from '../services/boundedDocumentTextExtract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const serviceUrl = pathToFileURL(
  path.join(repoRoot, 'server/src/services/boundedDocumentTextExtract.js'),
).href;

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

// ── minimal PDF writer (uncompressed, no third-party dependency) ──
//
// Objects are emitted in the order they are pushed and referenced by 1-based index, mirroring how
// a real producer lays out a simple document: content streams, a font, page objects, a page tree
// and a catalog.

function assemble(objs, trailerExtra, rootId) {
  let out = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objs.length; i += 1) {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i += 1) {
    out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${rootId} 0 R${trailerExtra} >>\n`
    + `startxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Build a PDF from pages of `[x, y, text]` runs, one Helvetica 11pt text run each. */
function buildTextPdf(pages) {
  const objs = [];
  const push = (s) => { objs.push(s); return objs.length; };

  const contentIds = [];
  for (const runs of pages) {
    let stream = 'BT /F1 11 Tf\n';
    for (const [x, y, text] of runs) stream += `1 0 0 1 ${x} ${y} Tm (${text}) Tj\n`;
    stream += 'ET\n';
    contentIds.push(push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`));
  }
  const fontId = push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pagesId = objs.length + pages.length + 1;
  const kidIds = pages.map((_, i) => push(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] `
    + `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`,
  ));
  const actualPagesId = push(
    `<< /Type /Pages /Count ${pages.length} /Kids [${kidIds.map((i) => `${i} 0 R`).join(' ')}] >>`,
  );
  assert.equal(actualPagesId, pagesId, 'PDF fixture object numbering is self-consistent');
  const rootId = push(`<< /Type /Catalog /Pages ${actualPagesId} 0 R >>`);
  return assemble(objs, '', rootId);
}

/**
 * Build a two-column PDF whose right-hand cells live in a Form XObject.
 *
 * This matters: for runs inside one content stream pdf.js synthesises a bridging space item that
 * exactly fills the horizontal gap, so the reconstruction never sees a gap. Crossing an XObject
 * boundary is one of the real-world shapes (tables, generated reports) where it does — which is
 * what makes the tab cell separator reachable and therefore testable.
 */
function buildTwoColumnPdf(rows) {
  const objs = [];
  const push = (s) => { objs.push(s); return objs.length; };

  // One XObject per right-hand cell, invoked immediately after its own left-hand cell, so the
  // page's text items come out in reading order (left, right, left, right, …) rather than
  // column-major.
  const fontId = push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  assert.equal(fontId, 1, 'XObject font reference matches the emitted font object');

  const xobjIds = rows.map(([, right, y]) => {
    const cell = `BT /F1 11 Tf 1 0 0 1 320 ${y} Tm (${right}) Tj ET\n`;
    return push(
      '<< /Type /XObject /Subtype /Form /BBox [0 0 612 792] '
      + `/Resources << /Font << /F1 ${fontId} 0 R >> >> `
      + `/Length ${cell.length} >>\nstream\n${cell}endstream`,
    );
  });

  let stream = '';
  rows.forEach(([left, , y], i) => {
    stream += `BT /F1 11 Tf 1 0 0 1 72 ${y} Tm (${left}) Tj ET\n/X${i + 1} Do\n`;
  });
  const contentId = push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);

  const xobjectDict = xobjIds.map((id, i) => `/X${i + 1} ${id} 0 R`).join(' ');
  const pagesId = objs.length + 2;
  const pageId = push(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] `
    + `/Resources << /Font << /F1 ${fontId} 0 R >> /XObject << ${xobjectDict} >> >> `
    + `/Contents ${contentId} 0 R >>`,
  );
  const actualPagesId = push(`<< /Type /Pages /Count 1 /Kids [${pageId} 0 R] >>`);
  assert.equal(actualPagesId, pagesId, 'PDF fixture object numbering is self-consistent');
  const rootId = push(`<< /Type /Catalog /Pages ${actualPagesId} 0 R >>`);
  return assemble(objs, '', rootId);
}

/**
 * Build a PDF whose trailer declares the standard security handler (RC4 40-bit). The /O and /U
 * values are arbitrary, so pdf.js cannot validate the empty user password and raises
 * PasswordException — the same path a real password-protected upload takes.
 */
function buildEncryptedPdf() {
  const hex = (n, seed) => Array.from(
    { length: n },
    (_, i) => ((i * 7 + seed) & 0xff).toString(16).padStart(2, '0'),
  ).join('');

  const objs = [];
  const push = (s) => { objs.push(s); return objs.length; };

  const stream = 'BT /F1 11 Tf 1 0 0 1 72 720 Tm (Confidential job description) Tj ET\n';
  const contentId = push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  const fontId = push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pagesId = objs.length + 2;
  const pageId = push(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] `
    + `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
  );
  const actualPagesId = push(`<< /Type /Pages /Count 1 /Kids [${pageId} 0 R] >>`);
  assert.equal(actualPagesId, pagesId, 'PDF fixture object numbering is self-consistent');
  const rootId = push(`<< /Type /Catalog /Pages ${actualPagesId} 0 R >>`);
  const encId = push(
    `<< /Filter /Standard /V 1 /R 2 /Length 40 /P -1 /O <${hex(32, 3)}> /U <${hex(32, 11)}> >>`,
  );
  return assemble(objs, ` /Encrypt ${encId} 0 R /ID [<${hex(16, 1)}> <${hex(16, 1)}>]`, rootId);
}

// ── fixtures ──

function jobPage(pageNumber) {
  const runs = [];
  let y = 740;
  runs.push([72, y, `Senior Backend Engineer - Page ${pageNumber}`]); y -= 24;
  runs.push([72, y, 'Company: Strideto Technologies']); y -= 18;
  runs.push([72, y, 'Location: Lahore, Pakistan']);
  runs.push([320, y, 'Type: Full-time']);
  y -= 18;
  runs.push([72, y, 'Salary: PKR 400,000 - 600,000 per month']); y -= 30;
  runs.push([72, y, 'Responsibilities:']); y -= 16;
  for (let i = 1; i <= 8; i += 1) {
    runs.push([90, y, `- Responsibility item number ${i} for page ${pageNumber}.`]);
    y -= 15;
  }
  y -= 12;
  runs.push([72, y, 'Requirements:']); y -= 16;
  for (const skill of ['Node.js', 'MongoDB', 'Redis', 'Docker']) {
    runs.push([90, y, `- ${skill} experience required.`]);
    y -= 15;
  }
  return runs;
}

const PDF_1PAGE = buildTextPdf([jobPage(1)]);
const PDF_3PAGE = buildTextPdf([jobPage(1), jobPage(2), jobPage(3)]);
const PDF_NO_TEXT = buildTextPdf([[]]);
const PDF_TRUNCATED = PDF_3PAGE.subarray(0, Math.floor(PDF_3PAGE.length * 0.6));
const PDF_GARBAGE = Buffer.concat([
  Buffer.from('%PDF-1.4\n'),
  Buffer.from('garbage not a pdf at all'.repeat(50)),
]);
const PDF_ENCRYPTED = buildEncryptedPdf();
const PDF_TWO_COLUMN = buildTwoColumnPdf([
  ['Node.js', '5 years', 700],
  ['MongoDB', '3 years', 680],
  ['Docker', '2 years', 660],
]);

// ── A. an ordinary text PDF parses successfully ──
{
  const text = await extractDocumentTextBounded('pdf', PDF_1PAGE);
  check(typeof text === 'string' && text.length > 0, 'PDF-A-01 PDF worker parse returns text');
  check(text.includes('Senior Backend Engineer'), 'PDF-A-02 heading text survives the worker hop');
  check(
    text.includes('Salary: PKR 400,000 - 600,000 per month'),
    'PDF-A-03 body text survives the worker hop',
  );
  check(text.endsWith('-- 1 of 1 --'), 'PDF-A-04 single-page output ends with its page marker');
}

// ── B. text-rich multi-page output is exact ──
//
// The golden is spelled out here rather than derived from the fixture builder, so a change in
// reconstruction (ordering, line breaks, separators, markers) fails loudly instead of moving the
// expectation along with the code.
{
  const page = (n) => [
    `Senior Backend Engineer - Page ${n}`,
    'Company: Strideto Technologies',
    'Location: Lahore, Pakistan Type: Full-time',
    'Salary: PKR 400,000 - 600,000 per month',
    'Responsibilities:',
    ...Array.from({ length: 8 }, (_, i) => `- Responsibility item number ${i + 1} for page ${n}.`),
    'Requirements:',
    '- Node.js experience required.',
    '- MongoDB experience required.',
    '- Redis experience required.',
    '- Docker experience required.',
  ].join('\n');

  const expected = [1, 2, 3].map((n) => `${page(n)}\n\n-- ${n} of 3 --`).join('\n\n');

  const text = await extractDocumentTextBounded('pdf', PDF_3PAGE);
  check(text === expected, 'PDF-B-01 three-page extraction is byte-identical to the golden output');

  // I. page joiners specifically — asserted on their own so a joiner regression is unambiguous.
  const markers = text.match(/\n-- \d+ of \d+ --/g) || [];
  check(
    JSON.stringify(markers)
      === JSON.stringify(['\n-- 1 of 3 --', '\n-- 2 of 3 --', '\n-- 3 of 3 --']),
    `PDF-I-01 page joiners are byte-compatible (got ${JSON.stringify(markers)})`,
  );
  check(
    text.split('\n')[0] === 'Senior Backend Engineer - Page 1'
      && text.includes('-- 1 of 3 --\n\nSenior Backend Engineer - Page 2'),
    'PDF-I-02 pages are emitted in order with the joiner between them',
  );
}

// ── B (cont). tab cell separators ──
{
  const text = await extractDocumentTextBounded('pdf', PDF_TWO_COLUMN);
  check(
    text === 'Node.js\t5 years\nMongoDB\t3 years\nDocker\t2 years\n\n-- 1 of 1 --',
    `PDF-B-02 two-column cells are separated by tabs (got ${JSON.stringify(text)})`,
  );
}

// ── C. 25 sequential PDF parses in one parent process ──
//
// The regression this guards is a native SIGSEGV: a crash kills this process outright, so reaching
// the assertion below is itself the proof that 25 spawn/parse/teardown cycles are safe.
{
  const ITERATIONS = 25;
  let ok = 0;
  for (let i = 0; i < ITERATIONS; i += 1) {
    const text = await extractDocumentTextBounded('pdf', PDF_3PAGE);
    if (text.includes('-- 3 of 3 --')) ok += 1;
  }
  check(
    ok === ITERATIONS,
    `PDF-C-01 ${ITERATIONS} sequential PDF worker parses all succeeded (got ${ok})`,
  );
}

// ── D. the PDF path loads no native addon ──
//
// Runtime proof, not a source grep. A fresh child process performs one real PDF parse and then
// reports every `.node` binary the process has loaded; `pdf-parse` would have pulled in
// `@napi-rs/canvas`'s Skia addon by this point. A child is used because this process must stay
// free of anything another test may have loaded.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'strideto-pdf-addon-'));
  const pdfPath = path.join(tmp, 'text.pdf');
  fs.writeFileSync(pdfPath, PDF_3PAGE);
  const probe = path.join(tmp, 'addons.mjs');
  fs.writeFileSync(
    probe,
    "import fs from 'node:fs';\n"
      + `const { extractDocumentTextBounded } = await import(${JSON.stringify(serviceUrl)});\n`
      + "const addons = () => process.report.getReport().sharedObjects"
      + ".filter((s) => /\\.node$/i.test(s));\n"
      + "const before = addons();\n"
      + "const text = await extractDocumentTextBounded('pdf', fs.readFileSync(process.argv[2]));\n"
      + "console.log('PARSED:' + text.length);\n"
      + "console.log('BEFORE:' + JSON.stringify(before));\n"
      + "console.log('AFTER:' + JSON.stringify(addons()));\n",
  );

  const res = spawnSync(process.execPath, [probe, pdfPath], { encoding: 'utf8', timeout: 60_000 });
  const out = String(res.stdout || '');
  const afterMatch = out.match(/^AFTER:(.*)$/m);
  const after = JSON.parse(afterMatch ? afterMatch[1] : '["probe-produced-no-output"]');
  const canvasAddons = after.filter((s) => /napi-rs|canvas|skia/i.test(s));

  check(
    /^PARSED:[1-9]\d*$/m.test(out),
    `PDF-D-01 child process parsed the PDF (stdout: ${out.trim()})`,
  );
  check(
    canvasAddons.length === 0,
    `PDF-D-02 no @napi-rs/canvas Skia addon loaded (got ${JSON.stringify(canvasAddons)})`,
  );
  check(
    after.length === 0,
    `PDF-D-03 the PDF path loads no native .node addon at all (got ${JSON.stringify(after)})`,
  );

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── E. PDF extraction succeeds with @napi-rs/canvas unresolvable ──
//
// `pdfjs-dist` reaches the canvas addon through a CommonJS `require` inside its canvas factory, so
// the block uses synchronous module hooks, which intercept `require` as well as `import`. Worker
// threads inherit the parent's execArgv, so `--import` installs the hook in the worker too — the
// first assertion proves that, which is what stops the second from being a false negative.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'strideto-pdf-canvas-'));
  const pdfPath = path.join(tmp, 'text.pdf');
  fs.writeFileSync(pdfPath, PDF_3PAGE);

  fs.writeFileSync(
    path.join(tmp, 'register.mjs'),
    "import { registerHooks } from 'node:module';\n"
      + 'registerHooks({\n'
      + '  resolve(specifier, context, next) {\n'
      + "    if (specifier === '@napi-rs/canvas' || specifier.startsWith('@napi-rs/canvas/')) {\n"
      + "      throw new Error('NAPI_CANVAS_RESOLVED');\n"
      + '    }\n'
      + '    return next(specifier, context);\n'
      + '  },\n'
      + '});\n',
  );
  fs.writeFileSync(
    path.join(tmp, 'hookProbeWorker.mjs'),
    "import { parentPort } from 'node:worker_threads';\n"
      + "import { createRequire } from 'node:module';\n"
      + 'const require = createRequire(import.meta.url);\n'
      + 'let blocked = false;\n'
      + "try { require('@napi-rs/canvas'); }\n"
      + 'catch (e) { blocked = /NAPI_CANVAS_RESOLVED/.test(String(e && e.message)); }\n'
      + 'parentPort.postMessage({ blocked });\n',
  );
  fs.writeFileSync(
    path.join(tmp, 'probe.mjs'),
    "import fs from 'node:fs';\n"
      + "import { Worker } from 'node:worker_threads';\n"
      + "import { fileURLToPath } from 'node:url';\n"
      + `const { extractDocumentTextBounded } = await import(${JSON.stringify(serviceUrl)});\n`
      + 'const blocked = await new Promise((resolve) => {\n'
      + "  const w = new Worker(fileURLToPath(new URL('./hookProbeWorker.mjs', import.meta.url)));\n"
      + "  w.on('message', (m) => { resolve(m.blocked); w.terminate().catch(() => {}); });\n"
      + "  w.on('error', () => resolve(false));\n"
      + '});\n'
      + "console.log('HOOK:' + (blocked ? 'BLOCKED' : 'NOT_BLOCKED'));\n"
      + 'try {\n'
      + "  const t = await extractDocumentTextBounded('pdf', fs.readFileSync(process.argv[2]));\n"
      + "  console.log('PDF:' + (t.includes('-- 3 of 3 --') ? 'OK' : 'EMPTY') + ':' + t.length);\n"
      + "} catch (e) { console.log('PDF:FAIL:' + (e.code || e.message)); }\n",
  );

  const res = spawnSync(
    process.execPath,
    [
      '--import',
      pathToFileURL(path.join(tmp, 'register.mjs')).href,
      path.join(tmp, 'probe.mjs'),
      pdfPath,
    ],
    { encoding: 'utf8', timeout: 60_000 },
  );
  const out = String(res.stdout || '');

  check(out.includes('HOOK:BLOCKED'), `PDF-E-01 the block reaches worker threads (stdout: ${out.trim()})`);
  check(
    /^PDF:OK:\d+$/m.test(out),
    `PDF-E-02 PDF extraction succeeds with @napi-rs/canvas unresolvable (stdout: ${out.trim()})`,
  );

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── F. password-protected PDF ──
{
  let code = null;
  try {
    await extractDocumentTextBounded('pdf', PDF_ENCRYPTED);
  } catch (e) {
    code = e.code;
  }
  check(
    code === 'password_protected_pdf',
    `PDF-F-01 encrypted PDF rejects as password_protected_pdf (got ${code})`,
  );
}

// ── G. corrupt / truncated PDF ──
{
  for (const [name, buffer] of [['truncated', PDF_TRUNCATED], ['garbage', PDF_GARBAGE]]) {
    let code = null;
    try {
      await extractDocumentTextBounded('pdf', buffer);
    } catch (e) {
      code = e.code;
    }
    check(code === 'corrupt_document', `PDF-G-01 ${name} PDF rejects as corrupt_document (got ${code})`);
  }
}

// ── H. timeout still bounds the PDF parse ──
//
// 1ms cannot outrun worker bootstrap, so this is deterministic rather than a race.
{
  const started = Date.now();
  let code = null;
  try {
    await extractDocumentTextBounded('pdf', PDF_3PAGE, 1);
  } catch (e) {
    code = e.code;
  }
  const elapsed = Date.now() - started;
  check(code === 'parse_timeout', `PDF-H-01 sub-parse timeout rejects as parse_timeout (got ${code})`);
  check(elapsed < 5_000, `PDF-H-02 timeout rejection is prompt (${elapsed}ms)`);
}

// ── J. image-only PDF still reaches the scanned-PDF path ──
//
// A page with no text operators yields nothing but the page marker. The service layer's
// `isLikelyScannedPdf` check (text under 40 chars) is what turns that into
// `scanned_pdf_unsupported`; this asserts the worker still hands it the same short marker-only
// text it used to. The known hole for 3+ page image-only PDFs is unchanged here by design.
{
  const text = await extractDocumentTextBounded('pdf', PDF_NO_TEXT);
  check(
    text === '-- 1 of 1 --',
    `PDF-J-01 image-only page yields marker-only text (got ${JSON.stringify(text)})`,
  );
  check(text.trim().length < 40, 'PDF-J-02 marker-only text still trips the scanned-PDF heuristic');
}

console.log(`jobDocumentPdfWorker.test.js: ${count} assertions passed`);
