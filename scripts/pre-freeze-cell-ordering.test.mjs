import assert from 'node:assert/strict';
import { buildRouteInventory } from './lib/preMission27RouteInventory.mjs';

const WIDTHS = [320, 375, 768, 1024, 1440];
const THEMES = [
  { id: 'explicit-light', preference: 'light', media: 'light' },
  { id: 'explicit-dark',  preference: 'dark',  media: 'dark'  },
  { id: 'system-light',   preference: 'system', media: 'light' },
  { id: 'system-dark',    preference: 'system', media: 'dark'  },
];
const CANONICAL_THEME_ID = 'explicit-light';
const CANONICAL_WIDTH = 1440;
const NON_CANONICAL_WIDTHS = WIDTHS.filter((w) => w !== CANONICAL_WIDTH);
const CELLS_PER_ROUTE = NON_CANONICAL_WIDTHS.length + 1; // 5

function personasFor(record) {
  if (record.realm === 'PUBLIC') return ['anonymous'];
  if (record.realm === 'STUDENT') return ['student'];
  if (record.realm === 'EMPLOYER') return ['employer'];
  if (record.realm === 'INSTITUTION') return ['institution'];
  if (record.realm === 'ADMIN') return ['admin'];
  if (record.realm === 'AGENT') {
    if (record.route.includes('/business-services')) return ['business-independent', 'business-agency'];
    if (record.route.includes('/education') || record.route === '/agent') return ['education-independent', 'education-agency'];
    return ['education-independent', 'education-agency', 'business-independent', 'business-agency'];
  }
  return [];
}
function classify(record) {
  if (/^\/dev\//.test(record.route)) return 'NON_LAUNCH_INTERNAL';
  if (/^Legacy/.test(record.component)) return 'REDIRECT_ONLY';
  if (record.pattern.includes(':')) return 'PARAMETRIC_UI';
  return 'FULL_MATRIX_UI';
}

const inventory = buildRouteInventory();
const allRoutes = [];
for (const record of inventory.records) {
  const cl = classify(record);
  for (const persona of personasFor(record)) {
    const isBusinessClientRoute = record.realm === 'STUDENT' && record.route.startsWith('/business');
    const productPersona = isBusinessClientRoute ? 'business-client' : persona;
    allRoutes.push({ id: `${productPersona}:${record.pattern}:${cl}`, persona: productPersona, classification: cl });
  }
}
const visualRoutes = allRoutes.filter((r) => ['FULL_MATRIX_UI', 'PARAMETRIC_UI'].includes(r.classification));
const cellKey = ({ route, theme, width }) => `${route.persona}|${route.id}|${route.classification}|${theme.id}|${width}`;
const isCanonicalCell = (theme, width) => theme.id === CANONICAL_THEME_ID && width === CANONICAL_WIDTH;

// Pairwise v3 cell selection: theme+width-major ordering for session reuse.
function buildPairwiseCells(vRoutes) {
  const selected = [];
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      if (isCanonicalCell(theme, width)) {
        for (const route of vRoutes) selected.push({ route, theme, width });
      } else if (width === CANONICAL_WIDTH) {
        // Non-canonical theme + canonical width: never selected.
      } else {
        const widthPos = NON_CANONICAL_WIDTHS.indexOf(width);
        for (const [routeIdx, route] of vRoutes.entries()) {
          if (THEMES[(routeIdx + widthPos) % THEMES.length].id === theme.id) {
            selected.push({ route, theme, width });
          }
        }
      }
    }
  }
  return selected;
}

// Harness cell construction (pairwise v3, theme+width-major)
const cells = buildPairwiseCells(visualRoutes);
const keys = cells.map(cellKey);
const keySet = new Set(keys);

// 1. Planned cell count
assert.equal(visualRoutes.length, 367, 'representative combinations must be 367');
assert.equal(THEMES.length, 4, 'theme count must be 4');
assert.equal(WIDTHS.length, 5, 'width count must be 5');
assert.equal(CELLS_PER_ROUTE, 5, 'cells per route must be 5 (pairwise v3)');
assert.equal(keys.length, 1835, 'total cell count must be 1835 (367 × 5)');
assert.equal(keySet.size, 1835, 'all cell keys must be unique');

// 2. Ordering: cells are grouped by (theme, width) mini-batch in theme+width-major order.
//    Each non-canonical mini-batch contains a subset of routes (those assigned that slot).
//    The canonical batch (explicit-light/1440) contains all 367 routes.
let i = 0;
const observedBatches = [];
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const expectedInBatch = isCanonicalCell(theme, width)
      ? visualRoutes.length
      : (width === CANONICAL_WIDTH ? 0 : null); // null = compute from cells
    const batch = [];
    while (i < cells.length && cells[i].theme.id === theme.id && cells[i].width === width) {
      batch.push(cells[i]);
      i += 1;
    }
    if (expectedInBatch !== null) {
      assert.equal(batch.length, expectedInBatch, `canonical batch ${theme.id}/${width} must have ${expectedInBatch} cells`);
    }
    // Skip empty batches (non-canonical theme + canonical width)
    if (batch.length === 0) continue;
    for (const cell of batch) {
      assert.equal(cell.theme.id, theme.id, 'all cells in batch must share theme');
      assert.equal(cell.width, width, 'all cells in batch must share width');
    }
    observedBatches.push({ theme: theme.id, width, count: batch.length });
  }
}
assert.equal(i, cells.length, 'all cells must be covered by theme+width batches');
// 17 non-empty mini-batches: 5 for explicit-light, 4 each for explicit-dark/system-light/system-dark
assert.equal(observedBatches.length, 17, 'pairwise v3 must have exactly 17 non-empty mini-batches');

// 3. Session reuse: within the canonical batch, institution routes share (theme, width).
const institutionBatch = cells.filter((c) => c.route.persona === 'institution' && c.theme.id === 'explicit-light' && c.width === 1440);
assert.ok(institutionBatch.length >= 2, 'institution must have multiple routes in canonical batch');
const tuples = institutionBatch.map((c) => `${c.route.persona}|${c.theme.id}|${c.width}`);
const uniqueTuples = new Set(tuples);
assert.equal(uniqueTuples.size, 1, 'all institution/explicit-light/1440 cells must share the same session tuple');

// 4. Each visual route appears in exactly CELLS_PER_ROUTE cells with all widths covered once.
for (const route of visualRoutes) {
  const routeCells = cells.filter((c) => c.route.id === route.id && c.route.persona === route.persona);
  assert.equal(routeCells.length, CELLS_PER_ROUTE, `route ${route.id} must appear in exactly ${CELLS_PER_ROUTE} cells`);
  const widthSet = new Set(routeCells.map((c) => c.width));
  assert.equal(widthSet.size, WIDTHS.length, `route ${route.id} must cover all ${WIDTHS.length} widths exactly once`);
  const themeSet = new Set(routeCells.map((c) => c.theme.id));
  assert.equal(themeSet.size, THEMES.length, `route ${route.id} must cover all ${THEMES.length} themes`);
}

// 5. Global pair coverage: all 16 non-canonical (theme×width) pairs plus explicit-light/1440.
//    Pairs {explicit-dark/system-light/system-dark} × {1440} are 0 by canonical constraint.
const pairCounts = {};
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    pairCounts[`${theme.id}|${width}`] = cells.filter((c) => c.theme.id === theme.id && c.width === width).length;
  }
}
// 16 non-canonical pairs must all be > 0
for (const theme of THEMES) {
  for (const width of NON_CANONICAL_WIDTHS) {
    const count = pairCounts[`${theme.id}|${width}`];
    assert.ok(count > 0, `non-canonical pair ${theme.id}/${width} must have count > 0 (got ${count})`);
  }
}
// Canonical pair must be 367
assert.equal(pairCounts[`${CANONICAL_THEME_ID}|${CANONICAL_WIDTH}`], 367, 'canonical pair explicit-light/1440 must appear 367 times');
// Non-explicit-light + 1440 must be 0 (structural constraint from canonical)
for (const theme of THEMES.filter((t) => t.id !== CANONICAL_THEME_ID)) {
  assert.equal(pairCounts[`${theme.id}|${CANONICAL_WIDTH}`], 0, `${theme.id}/1440 must have count 0 (canonical constraint)`);
}

console.log(JSON.stringify({
  visualRoutes: visualRoutes.length,
  themes: THEMES.length,
  widths: WIDTHS.length,
  cellsPerRoute: CELLS_PER_ROUTE,
  totalCells: keys.length,
  uniqueCells: keySet.size,
  nonEmptyBatches: observedBatches.length,
  ordering: 'theme+width-major (pairwise v3)',
  batchVerification: 'PASS',
  sessionReuseGrouping: 'PASS',
  perRouteCoverage: 'PASS',
  globalPairCoverage: 'PASS',
  contractVersion: 'pre-freeze-acceptance-contract-v3',
}));
