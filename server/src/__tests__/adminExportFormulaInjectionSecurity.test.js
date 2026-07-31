/**
 * Spreadsheet formula-injection security tests (STRIDETO-SEC-2).
 * Run: node src/__tests__/adminExportFormulaInjectionSecurity.test.js
 *
 * No database connection, no file written inside the repository, no network
 * call. Exercises the real, exported neutralizeExportRows()/toCsv() from
 * exportController.js plus the real `xlsx` package to inspect actual
 * worksheet cell values.
 */
import assert from 'assert';
import XLSX from 'xlsx';
import {
  neutralizeExportRows,
  toCsv,
} from '../controllers/admin/exportController.js';

let assertions = 0;
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}
function deepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}
function ok(value, message) {
  assert.ok(value, message);
  assertions += 1;
}

const DANGEROUS_STRINGS = [
  '=SUM(A1:A2)',
  '=HYPERLINK("https://example.invalid","click")',
  '+CMD',
  '-1+2',
  '@SUM(A1:A2)',
  '\t=SUM(A1:A2)', // leading-tab formula
  '\r=SUM(A1:A2)', // leading-CR formula
  '\n=SUM(A1:A2)', // leading-LF formula
  ' =SUM(A1:A2)', // spaces before formula
  '    =SUM(A1:A2)', // multiple spaces before formula
];

const HARMLESS_STRINGS = [
  'ordinary text',
  'user@example.com', // ordinary email — '@' is not the first character
  'https://example.com/path', // ordinary URL
  '-5', // negative numeric string
  '+5', // positive-signed numeric string
  '0', // zero as a string
  '-5.25', // negative decimal numeric string
  "'=SUM(A1:A2)", // already-neutralized value
  'مرحبا بالعالم', // Unicode (Arabic)
  '你好，世界', // Unicode (Chinese)
  '😀 emoji lead', // Unicode emoji lead
];

// ---------------------------------------------------------------------------
// 1. Dangerous strings are neutralized (top-level string field)
// ---------------------------------------------------------------------------
for (const dangerous of DANGEROUS_STRINGS) {
  const [row] = neutralizeExportRows([{ title: dangerous }]);
  ok(
    row.title.startsWith("'"),
    `dangerous value ${JSON.stringify(dangerous)} is neutralized with a literal-text prefix`
  );
  ok(
    row.title.endsWith(dangerous),
    `neutralized value for ${JSON.stringify(dangerous)} still contains the original content as literal text`
  );
}

// ---------------------------------------------------------------------------
// 2. Harmless strings remain unchanged
// ---------------------------------------------------------------------------
for (const harmless of HARMLESS_STRINGS) {
  const [row] = neutralizeExportRows([{ title: harmless }]);
  equal(
    row.title,
    harmless,
    `harmless value ${JSON.stringify(harmless)} is left unchanged`
  );
}

// ---------------------------------------------------------------------------
// 3. The "-1+2" / "+1+2" family: not pure numeric, must be neutralized
// ---------------------------------------------------------------------------
for (const notPureNumeric of ['-1+2', '+1+2', '-1-2', '+SUM(1,2)']) {
  const [row] = neutralizeExportRows([{ v: notPureNumeric }]);
  ok(
    row.v.startsWith("'"),
    `${JSON.stringify(notPureNumeric)} is not a pure numeric string and must be neutralized`
  );
}

// ---------------------------------------------------------------------------
// 4. Numbers, booleans, null, undefined, Date, zero — preserved exactly
// ---------------------------------------------------------------------------
{
  const now = new Date('2026-01-15T00:00:00.000Z');
  const source = {
    actualNegativeNumber: -42,
    actualPositiveNumber: 42,
    zeroNumber: 0,
    boolTrue: true,
    boolFalse: false,
    nullValue: null,
    undefinedValue: undefined,
    dateValue: now,
  };
  const [row] = neutralizeExportRows([source]);
  equal(
    row.actualNegativeNumber,
    -42,
    'a real negative JS number is untouched'
  );
  equal(row.actualPositiveNumber, 42, 'a real positive JS number is untouched');
  equal(row.zeroNumber, 0, 'a real zero number is untouched');
  equal(row.boolTrue, true, 'boolean true is untouched');
  equal(row.boolFalse, false, 'boolean false is untouched');
  equal(row.nullValue, null, 'null is untouched');
  equal(row.undefinedValue, undefined, 'undefined is untouched');
  ok(row.dateValue instanceof Date, 'Date instance type is preserved');
  equal(
    row.dateValue.getTime(),
    now.getTime(),
    'Date value is preserved exactly'
  );
}

// ---------------------------------------------------------------------------
// 5. Idempotency — running the neutralizer twice does not double-prefix
// ---------------------------------------------------------------------------
{
  const [once] = neutralizeExportRows([{ title: '=SUM(A1:A2)' }]);
  const [twice] = neutralizeExportRows([once]);
  equal(
    once.title,
    twice.title,
    'applying neutralization twice yields the same result (idempotent)'
  );
  equal(
    (twice.title.match(/'/g) || []).length,
    1,
    'no double-prefixing occurs on a second pass'
  );
}

// ---------------------------------------------------------------------------
// 6. Very long malicious value — handled without pathological slowdown
// ---------------------------------------------------------------------------
{
  const longPayload = `=${'A'.repeat(200000)}`;
  const start = Date.now();
  const [row] = neutralizeExportRows([{ title: longPayload }]);
  const elapsedMs = Date.now() - start;
  ok(
    row.title.startsWith("'"),
    'a very long malicious value is still neutralized'
  );
  ok(
    elapsedMs < 1000,
    `neutralizing a very long value completes quickly (took ${elapsedMs}ms)`
  );
}

// ---------------------------------------------------------------------------
// 7. Source input is never mutated
// ---------------------------------------------------------------------------
{
  const source = [{ title: '=SUM(A1:A2)', count: 5, nested: { note: '+CMD' } }];
  const snapshot = JSON.parse(JSON.stringify(source));
  neutralizeExportRows(source);
  deepEqual(
    source,
    snapshot,
    'neutralizeExportRows never mutates its input rows'
  );
}

// ---------------------------------------------------------------------------
// 8. Every user-controlled column passes through the boundary (multi-field row)
// ---------------------------------------------------------------------------
{
  const source = [
    {
      title: '=SUM(A1:A2)',
      company: '+CMD',
      description: '@SUM(A1:A2)',
      message: '-1+2',
      safeName: 'Acme Corp',
      views: 42,
    },
  ];
  const [row] = neutralizeExportRows(source);
  ok(row.title.startsWith("'"), 'title column neutralized');
  ok(row.company.startsWith("'"), 'company column neutralized');
  ok(row.description.startsWith("'"), 'description column neutralized');
  ok(row.message.startsWith("'"), 'message column neutralized');
  equal(row.safeName, 'Acme Corp', 'unrelated safe column is untouched');
  equal(row.views, 42, 'unrelated numeric column is untouched');
}

// ---------------------------------------------------------------------------
// 9. Nested/prototype-pollution-shaped values are handled safely
// ---------------------------------------------------------------------------
{
  const polluted = JSON.parse(
    '{"__proto__": {"polluted": true}, "safe": "=SUM(A1:A2)"}'
  );
  const [row] = neutralizeExportRows([{ job: polluted }]);
  equal(
    Object.prototype.polluted,
    undefined,
    'neutralization never pollutes Object.prototype'
  );
  ok(
    !Object.prototype.hasOwnProperty.call(row.job, '__proto__') ||
      row.job.__proto__ === Object.prototype,
    '__proto__-named key is not copied as an own data property'
  );
  ok(
    row.job.safe.startsWith("'"),
    'nested plain-object string fields are also neutralized'
  );

  const nestedArray = { items: ['=SUM(A1:A2)', 'ordinary', '+CMD'] };
  const [arrRow] = neutralizeExportRows([nestedArray]);
  ok(arrRow.items[0].startsWith("'"), 'array item 0 (dangerous) neutralized');
  equal(arrRow.items[1], 'ordinary', 'array item 1 (harmless) unchanged');
  ok(arrRow.items[2].startsWith("'"), 'array item 2 (dangerous) neutralized');
}

// ---------------------------------------------------------------------------
// 10. CSV integration — output stays syntactically valid and escaping intact
// ---------------------------------------------------------------------------
{
  const rows = neutralizeExportRows([
    { title: '=SUM(A1:A2)', note: 'contains "quotes" and, a comma' },
    { title: 'ordinary', note: 'plain' },
  ]);
  const csv = toCsv(rows);
  const lines = csv.split('\n');
  equal(lines.length, 3, 'CSV has a header row plus one row per record');
  ok(
    lines[1].includes(`"'=SUM(A1:A2)"`),
    'the neutralized formula is present as quoted literal text in the CSV row'
  );
  ok(
    lines[1].includes('""quotes""'),
    'embedded double quotes are still escaped by doubling, per existing CSV quoting behavior'
  );
  ok(
    lines[1].includes('a comma'),
    'embedded commas remain safely inside a quoted field'
  );
  // Every field is wrapped in quotes — verify structural validity by counting quote pairs per line.
  for (const line of lines) {
    const quoteCount = (line.match(/"/g) || []).length;
    equal(
      quoteCount % 2,
      0,
      `line has a balanced number of quote characters: ${JSON.stringify(line)}`
    );
  }
}
{
  // Formula neutralization survives even through CSV's own quoting logic —
  // proving quoting alone was never relied upon as the control.
  const rows = neutralizeExportRows([{ title: '=cmd|"/c calc"!A1' }]);
  const csv = toCsv(rows);
  const dataLine = csv.split('\n')[1];
  ok(
    dataLine.startsWith('"\''),
    'even a value containing embedded quotes starts with the neutralizing apostrophe once unescaped'
  );
}

// ---------------------------------------------------------------------------
// 11. XLSX integration — cells hold safe literal string values, never formulas
// ---------------------------------------------------------------------------
{
  const rows = neutralizeExportRows([
    { title: '=SUM(A1:A2)', count: 42, active: true, note: null },
    { title: 'ordinary title', count: 7, active: false, note: 'fine' },
  ]);
  const ws = XLSX.utils.json_to_sheet(rows);
  const dangerousCell = ws['A2']; // header row is row 1, first data row is row 2
  ok(
    dangerousCell,
    'the worksheet contains the expected cell for the neutralized title'
  );
  equal(
    dangerousCell.t,
    's',
    'the neutralized value is stored as a string-type cell, not a numeric/formula cell'
  );
  ok(
    String(dangerousCell.v).startsWith("'"),
    'the raw cell value carries the literal-text prefix'
  );
  ok(
    !('f' in dangerousCell),
    'no formula (f) property exists on the cell — it is data, never an executable formula'
  );

  const countCell = ws['B2'];
  equal(
    countCell.t,
    'n',
    'a genuine numeric column is still stored as a numeric-type cell'
  );
  equal(countCell.v, 42, 'the numeric value is preserved exactly');

  const ordinaryCell = ws['A3'];
  equal(
    ordinaryCell.v,
    'ordinary title',
    'an ordinary string in the same column is untouched'
  );
}

// ---------------------------------------------------------------------------
// 12. No sensitive exported values are logged by the neutralization boundary
// ---------------------------------------------------------------------------
{
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const lines = [];
  console.log = (...args) => lines.push(args.map(String).join(' '));
  console.warn = (...args) => lines.push(args.map(String).join(' '));
  console.error = (...args) => lines.push(args.map(String).join(' '));
  try {
    neutralizeExportRows([
      {
        email: 'confidential-applicant@example.com',
        notes: '=SUM(SECRET_SALARY_COLUMN)',
      },
    ]);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
  equal(
    lines.length,
    0,
    'neutralizeExportRows performs no logging of exported row content'
  );
}

console.log(
  `adminExportFormulaInjectionSecurity.test.js: ${assertions} assertions passed`
);
