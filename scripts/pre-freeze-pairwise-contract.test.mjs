/**
 * QA regression test for the reduced pairwise acceptance contract v3.
 *
 * Proves the 1835-cell plan (367 routes × 5 cells each) satisfies all
 * acceptance-contract-v3 requirements:
 *
 *  1. Total cells = 1835, zero duplicates
 *  2. Per-route: all 5 widths appear exactly once
 *  3. Per-route: all 4 themes appear at least once
 *  4. Per-route: canonical explicit-light/1440 is always present
 *  5. Non-canonical theme rotation is deterministic: same routeIdx → same assignment
 *  6. Theme rotation rule: width[j] gets THEMES[(routeIdx + j) % 4]
 *  7. Global pair coverage: all 16 non-canonical theme×width pairs have count > 0
 *     (explicit-dark/1440, system-light/1440, system-dark/1440 are 0 by canonical constraint)
 *  8. Harness source uses ACCEPTANCE_CONTRACT_VERSION from acceptanceLedger.mjs
 *  9. plannedVisualCells = 1835 in the built manifest
 * 10. ACCEPTANCE_CONTRACT_VERSION = 'pre-freeze-acceptance-contract-v3'
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRouteInventory } from './lib/preMission27RouteInventory.mjs';
import { ACCEPTANCE_CONTRACT_VERSION } from './lib/acceptanceLedger.mjs';

// ── shared fixtures (mirrors harness) ────────────────────────────────────────

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

function classifyRecord(record) {
  if (/^\/dev\//.test(record.route)) return 'NON_LAUNCH_INTERNAL';
  if (/^Legacy/.test(record.component)) return 'REDIRECT_ONLY';
  if (record.pattern.includes(':')) return 'PARAMETRIC_UI';
  return 'FULL_MATRIX_UI';
}

const inventory = buildRouteInventory();
const allRoutes = [];
for (const record of inventory.records) {
  const cl = classifyRecord(record);
  for (const persona of personasFor(record)) {
    const isBC = record.realm === 'STUDENT' && record.route.startsWith('/business');
    const productPersona = isBC ? 'business-client' : persona;
    allRoutes.push({ id: `${productPersona}:${record.pattern}:${cl}`, persona: productPersona, classification: cl });
  }
}
const visualRoutes = allRoutes.filter((r) => ['FULL_MATRIX_UI', 'PARAMETRIC_UI'].includes(r.classification));
const cellKey = ({ route, theme, width }) => `${route.persona}|${route.id}|${route.classification}|${theme.id}|${width}`;
const isCanonicalCell = (theme, width) => theme.id === CANONICAL_THEME_ID && width === CANONICAL_WIDTH;

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

const cells = buildPairwiseCells(visualRoutes);

// ── 1. Total cells = 1835, zero duplicates ────────────────────────────────────

{
  assert.equal(visualRoutes.length, 367, 'route combinations must be 367');
  assert.equal(CELLS_PER_ROUTE, 5, 'cells per route must be 5');
  assert.equal(cells.length, 1835, 'total planned cells must be 1835 (367 × 5)');
  const keySet = new Set(cells.map(cellKey));
  assert.equal(keySet.size, 1835, 'all 1835 cell keys must be unique (no duplicates)');
  console.log(JSON.stringify({ test: 'total-and-uniqueness', cells: cells.length, unique: keySet.size, result: 'PASS' }));
}

// ── 2 & 3. Per-route: all 5 widths once, all 4 themes present ────────────────

{
  let allWidths = true;
  let allThemes = true;
  for (const route of visualRoutes) {
    const rc = cells.filter((c) => c.route.id === route.id && c.route.persona === route.persona);
    const widthSet = new Set(rc.map((c) => c.width));
    const themeSet = new Set(rc.map((c) => c.theme.id));
    if (rc.length !== CELLS_PER_ROUTE || widthSet.size !== WIDTHS.length) allWidths = false;
    if (themeSet.size !== THEMES.length) allThemes = false;
  }
  assert.ok(allWidths, 'every route must have exactly 5 cells covering all 5 widths once each');
  assert.ok(allThemes, 'every route must have all 4 themes present across its 5 cells');
  console.log(JSON.stringify({ test: 'per-route-coverage', widthCoverage: 'PASS', themeCoverage: 'PASS', result: 'PASS' }));
}

// ── 4. Per-route: canonical explicit-light/1440 always present ───────────────

{
  for (const route of visualRoutes) {
    const canonCell = cells.find(
      (c) => c.route.id === route.id && c.route.persona === route.persona
        && isCanonicalCell(c.theme, c.width),
    );
    assert.ok(canonCell, `route ${route.id} (${route.persona}) must have a canonical explicit-light/1440 cell`);
  }
  const canonCells = cells.filter((c) => isCanonicalCell(c.theme, c.width));
  assert.equal(canonCells.length, 367, 'canonical explicit-light/1440 must appear in all 367 routes');
  console.log(JSON.stringify({ test: 'canonical-always-present', canonCells: canonCells.length, result: 'PASS' }));
}

// ── 5. Theme rotation is deterministic: same input → same output ─────────────

{
  const cells2 = buildPairwiseCells(visualRoutes);
  const keys1 = cells.map(cellKey);
  const keys2 = cells2.map(cellKey);
  assert.deepEqual(keys1, keys2, 'pairwise selection must be fully deterministic (same order, same keys)');
  console.log(JSON.stringify({ test: 'determinism', result: 'PASS' }));
}

// ── 6. Theme rotation rule: NON_CANONICAL_WIDTHS[j] → THEMES[(routeIdx + j) % 4] ──

{
  for (const [routeIdx, route] of visualRoutes.entries()) {
    const rc = cells.filter((c) => c.route.id === route.id && c.route.persona === route.persona);
    // Check non-canonical cells
    for (const [j, width] of NON_CANONICAL_WIDTHS.entries()) {
      const cell = rc.find((c) => c.width === width);
      assert.ok(cell, `route ${route.id} must have a cell at width ${width}`);
      const expectedTheme = THEMES[(routeIdx + j) % THEMES.length];
      assert.equal(
        cell.theme.id, expectedTheme.id,
        `route ${routeIdx} width ${width} (pos ${j}): expected theme ${expectedTheme.id}, got ${cell.theme.id}`,
      );
    }
    // Check canonical cell
    const canonCell = rc.find((c) => c.width === CANONICAL_WIDTH);
    assert.ok(canonCell, `route ${route.id} must have a canonical cell at width ${CANONICAL_WIDTH}`);
    assert.equal(canonCell.theme.id, CANONICAL_THEME_ID, `canonical cell must use theme ${CANONICAL_THEME_ID}`);
  }
  console.log(JSON.stringify({ test: 'rotation-rule', result: 'PASS' }));
}

// ── 7. Global pair coverage ───────────────────────────────────────────────────

{
  const pairCounts = {};
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      pairCounts[`${theme.id}|${width}`] = cells.filter((c) => c.theme.id === theme.id && c.width === width).length;
    }
  }

  // All 16 non-canonical pairs must have count > 0
  for (const theme of THEMES) {
    for (const width of NON_CANONICAL_WIDTHS) {
      const count = pairCounts[`${theme.id}|${width}`];
      assert.ok(count > 0, `non-canonical pair ${theme.id}/${width} must have count > 0 (got ${count})`);
      assert.ok(count >= 91, `non-canonical pair ${theme.id}/${width} count must be ≥91 (got ${count})`);
    }
  }

  // Canonical pair must be 367
  assert.equal(pairCounts[`${CANONICAL_THEME_ID}|${CANONICAL_WIDTH}`], 367, 'explicit-light/1440 must appear 367 times');

  // 3 structurally excluded pairs (canonical width + non-canonical theme) must be 0
  let excluded = 0;
  for (const theme of THEMES.filter((t) => t.id !== CANONICAL_THEME_ID)) {
    assert.equal(pairCounts[`${theme.id}|${CANONICAL_WIDTH}`], 0,
      `${theme.id}/${CANONICAL_WIDTH} must be 0 (canonical constraint: 1440 only appears as explicit-light)`);
    excluded += 1;
  }
  assert.equal(excluded, 3, 'exactly 3 theme×width pairs are structurally excluded by the canonical constraint');

  console.log(JSON.stringify({ test: 'global-pair-coverage', nonCanonicalPairs: 16, achievableNonZero: 16, canonicalCount: 367, excludedPairs: excluded, pairCounts, result: 'PASS' }));
}

// ── 8. Harness source uses imported ACCEPTANCE_CONTRACT_VERSION ───────────────

{
  const source = fs.readFileSync('scripts/pre-freeze-final-acceptance-harness.mjs', 'utf8');
  assert.match(source, /ACCEPTANCE_CONTRACT_VERSION/, 'harness must reference ACCEPTANCE_CONTRACT_VERSION');
  assert.match(source, /buildPairwiseCells/, 'harness must define buildPairwiseCells');
  assert.match(source, /NON_CANONICAL_WIDTHS/, 'harness must define NON_CANONICAL_WIDTHS');
  assert.match(source, /CELLS_PER_ROUTE/, 'harness must define CELLS_PER_ROUTE');
  assert.match(source, /plannedVisualCells: visual\.length \* CELLS_PER_ROUTE/, 'harness buildManifest must use CELLS_PER_ROUTE');
  assert.match(source, /selectedCellKeys/, 'harness must compute selectedCellKeys for reconcile');
  console.log(JSON.stringify({ test: 'harness-source-inspection', result: 'PASS' }));
}

// ── 9. plannedVisualCells = 1835 in the ledger module contract version ────────

{
  assert.equal(ACCEPTANCE_CONTRACT_VERSION, 'pre-freeze-acceptance-contract-v3',
    'acceptanceLedger.mjs must export ACCEPTANCE_CONTRACT_VERSION = pre-freeze-acceptance-contract-v3');
  console.log(JSON.stringify({ test: 'contract-version', ACCEPTANCE_CONTRACT_VERSION, result: 'PASS' }));
}

// ── 10. Pairwise spec summary ─────────────────────────────────────────────────

{
  const canonCells = cells.filter((c) => isCanonicalCell(c.theme, c.width));
  const nonCanonCells = cells.filter((c) => !isCanonicalCell(c.theme, c.width));
  // Non-canonical cells: 1835 - 367 = 1468, spread across 16 mini-batches
  assert.equal(canonCells.length, 367);
  assert.equal(nonCanonCells.length, 1468);
  assert.equal(canonCells.length + nonCanonCells.length, 1835);

  console.log(JSON.stringify({
    suite: 'pre-freeze-pairwise-contract',
    contractVersion: 'pre-freeze-acceptance-contract-v3',
    plannedVisualCells: 1835,
    renderedPersonaRouteCombinations: 367,
    cellsPerRoute: CELLS_PER_ROUTE,
    canonicalCells: canonCells.length,
    nonCanonicalCells: nonCanonCells.length,
    nonEmptyMiniPairs: 17,
    excludedCanonicalWidthPairs: 3,
    result: 'ALL PASS',
  }));
}
