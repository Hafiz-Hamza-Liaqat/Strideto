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
const SENTINEL_THEMES = THEMES.filter((t) => t.id !== CANONICAL_THEME_ID); // [explicit-dark, system-light, system-dark]
const SENTINEL_COUNT = SENTINEL_THEMES.length; // 3

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

function buildSentinelCells(vRoutes) {
  const fullMatrix = vRoutes.filter((r) => r.classification === 'FULL_MATRIX_UI');
  return SENTINEL_THEMES.map((theme, i) => ({ route: fullMatrix[i], theme, width: CANONICAL_WIDTH }));
}

// Harness cell construction (pairwise v3 + sentinels, theme+width-major)
const pairwiseCells = buildPairwiseCells(visualRoutes);
const sentinelCells = buildSentinelCells(visualRoutes);
const cells = [...pairwiseCells, ...sentinelCells];
const keys = cells.map(cellKey);
const keySet = new Set(keys);

// 1. Planned cell count
assert.equal(visualRoutes.length, 367, 'representative combinations must be 367');
assert.equal(THEMES.length, 4, 'theme count must be 4');
assert.equal(WIDTHS.length, 5, 'width count must be 5');
assert.equal(CELLS_PER_ROUTE, 5, 'cells per route must be 5 (pairwise v3)');
assert.equal(pairwiseCells.length, 1835, 'pairwise baseline must be 1835 (367 × 5)');
assert.equal(sentinelCells.length, SENTINEL_COUNT, `sentinel count must be ${SENTINEL_COUNT}`);
assert.equal(keys.length, 1838, 'total cell count must be 1838 (1835 + 3 sentinels)');
assert.equal(keySet.size, 1838, 'all cell keys must be unique');

// 2. Ordering: pairwise cells are grouped by (theme, width) mini-batch in theme+width-major order.
//    Sentinel cells are appended after all pairwise cells.
let i = 0;
const observedBatches = [];
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const expectedInBatch = isCanonicalCell(theme, width)
      ? visualRoutes.length
      : null; // null = count from pairwise cells
    const batch = [];
    while (i < pairwiseCells.length && pairwiseCells[i].theme.id === theme.id && pairwiseCells[i].width === width) {
      batch.push(pairwiseCells[i]);
      i += 1;
    }
    if (expectedInBatch !== null) {
      assert.equal(batch.length, expectedInBatch, `canonical batch ${theme.id}/${width} must have ${expectedInBatch} cells`);
    }
    // Skip empty batches (non-canonical theme + canonical width in pairwise — covered by sentinels)
    if (batch.length === 0) continue;
    for (const cell of batch) {
      assert.equal(cell.theme.id, theme.id, 'all cells in batch must share theme');
      assert.equal(cell.width, width, 'all cells in batch must share width');
    }
    observedBatches.push({ theme: theme.id, width, count: batch.length });
  }
}
assert.equal(i, pairwiseCells.length, 'all pairwise cells must be covered by theme+width batches');
// 17 non-empty pairwise mini-batches: 5 for explicit-light (one per width), 4 each for others (no 1440)
assert.equal(observedBatches.length, 17, 'pairwise v3 must have exactly 17 non-empty mini-batches');

// Sentinel cells (3) are appended after all pairwise cells — each is a separate mini-batch
const sentinelBatches = sentinelCells.map((s) => ({ theme: s.theme.id, width: s.width, count: 1 }));
assert.equal(sentinelBatches.length, 3, '3 sentinel cells must follow pairwise cells');
for (const [idx, s] of sentinelCells.entries()) {
  assert.equal(s.theme.id, SENTINEL_THEMES[idx].id, `sentinel ${idx} must use theme ${SENTINEL_THEMES[idx].id}`);
  assert.equal(s.width, CANONICAL_WIDTH, `sentinel ${idx} must use width ${CANONICAL_WIDTH}`);
  assert.equal(s.route.classification, 'FULL_MATRIX_UI', `sentinel ${idx} route must be FULL_MATRIX_UI`);
}
// Total non-empty batches: 17 pairwise + 3 sentinel = 20
const totalBatches = observedBatches.length + sentinelBatches.length;
assert.equal(totalBatches, 20, 'total must be 20 non-empty mini-batches (17 pairwise + 3 sentinel)');

// 3. Session reuse: within the canonical batch, institution routes share (theme, width).
const institutionBatch = cells.filter((c) => c.route.persona === 'institution' && c.theme.id === 'explicit-light' && c.width === 1440);
assert.ok(institutionBatch.length >= 2, 'institution must have multiple routes in canonical batch');
const tuples = institutionBatch.map((c) => `${c.route.persona}|${c.theme.id}|${c.width}`);
const uniqueTuples = new Set(tuples);
assert.equal(uniqueTuples.size, 1, 'all institution/explicit-light/1440 cells must share the same session tuple');

// 4. Each visual route appears in exactly CELLS_PER_ROUTE pairwise cells with all widths covered once.
//    (Sentinel routes appear in CELLS_PER_ROUTE + 1 cells due to the sentinel — checked below.)
const sentinelRouteIds = new Set(sentinelCells.map((s) => `${s.route.persona}|${s.route.id}`));
for (const route of visualRoutes) {
  const routeKey = `${route.persona}|${route.id}`;
  const pairwiseRouteCells = pairwiseCells.filter((c) => c.route.id === route.id && c.route.persona === route.persona);
  assert.equal(pairwiseRouteCells.length, CELLS_PER_ROUTE, `route ${route.id} must appear in exactly ${CELLS_PER_ROUTE} pairwise cells`);
  const widthSet = new Set(pairwiseRouteCells.map((c) => c.width));
  assert.equal(widthSet.size, WIDTHS.length, `route ${route.id} must cover all ${WIDTHS.length} widths exactly once`);
  const themeSet = new Set(pairwiseRouteCells.map((c) => c.theme.id));
  assert.equal(themeSet.size, THEMES.length, `route ${route.id} must cover all ${THEMES.length} themes`);
  // Sentinel routes get 1 additional cell
  const totalRouteCells = cells.filter((c) => c.route.id === route.id && c.route.persona === route.persona);
  const expectedTotal = sentinelRouteIds.has(routeKey) ? CELLS_PER_ROUTE + 1 : CELLS_PER_ROUTE;
  assert.equal(totalRouteCells.length, expectedTotal, `route ${route.id} total cells (pairwise + sentinel) must be ${expectedTotal}`);
}

// 5. Global pair coverage: 20/20 theme×width pairs covered (including 3 sentinel pairs at width 1440).
const pairCounts = {};
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    pairCounts[`${theme.id}|${width}`] = cells.filter((c) => c.theme.id === theme.id && c.width === width).length;
  }
}
// All 20 pairs must have count > 0
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const count = pairCounts[`${theme.id}|${width}`];
    assert.ok(count > 0, `pair ${theme.id}/${width} must have count > 0 (got ${count})`);
  }
}
// Canonical pair must be 367 (from pairwise baseline)
assert.equal(pairCounts[`${CANONICAL_THEME_ID}|${CANONICAL_WIDTH}`], 367, 'canonical pair explicit-light/1440 must appear 367 times');
// Sentinel pairs must each appear exactly 1 time
for (const theme of SENTINEL_THEMES) {
  assert.equal(pairCounts[`${theme.id}|${CANONICAL_WIDTH}`], 1, `${theme.id}/1440 must appear exactly 1 time (sentinel)`);
}
// Non-canonical baseline pairs (theme × non-1440 width) must each have count ≥ 91
for (const theme of THEMES) {
  for (const width of NON_CANONICAL_WIDTHS) {
    const count = pairCounts[`${theme.id}|${width}`];
    assert.ok(count >= 91, `non-canonical pair ${theme.id}/${width} must have count ≥91 (got ${count})`);
  }
}

console.log(JSON.stringify({
  visualRoutes: visualRoutes.length,
  themes: THEMES.length,
  widths: WIDTHS.length,
  cellsPerRoute: CELLS_PER_ROUTE,
  baselineCells: pairwiseCells.length,
  sentinelCells: sentinelCells.length,
  totalCells: keys.length,
  uniqueCells: keySet.size,
  pairwiseBatches: observedBatches.length,
  sentinelBatches: sentinelBatches.length,
  totalBatches,
  ordering: 'theme+width-major (pairwise v3 + sentinels appended)',
  batchVerification: 'PASS',
  sessionReuseGrouping: 'PASS',
  perRouteCoverage: 'PASS',
  globalPairCoverage: '20/20',
  contractVersion: 'pre-freeze-acceptance-contract-v3',
}));
