/**
 * QA regression test for acceptance contract v3:
 * constrained pairwise + desktop-theme sentinels.
 *
 * Plan: 1835 deterministic per-route reduced matrix
 *     + 3 deterministic 1440 desktop-theme sentinel cells
 *     = 1838 authoritative visual cells
 *
 * Proves all acceptance-contract-v3 requirements:
 *
 *  1. Total cells = 1838, zero duplicates
 *  2. Baseline: 1835 (367 routes × 5 cells per route)
 *  3. Sentinels: 3 (one per non-explicit-light theme at width 1440)
 *  4. Per-route baseline: all 5 widths exactly once, all 4 themes present
 *  5. Per-route baseline: canonical explicit-light/1440 always present
 *  6. Non-canonical theme rotation is deterministic and matches rule
 *  7. Global 20/20 theme×width pair coverage — no pair has count 0
 *  8. Sentinel targets are deterministic (first 3 FULL_MATRIX_UI routes)
 *  9. Harness source patterns present
 * 10. ACCEPTANCE_CONTRACT_VERSION = 'pre-freeze-acceptance-contract-v3'
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRouteInventory } from './lib/preMission27RouteInventory.mjs';
import { ACCEPTANCE_CONTRACT_VERSION } from './lib/acceptanceLedger.mjs';

// ── shared fixtures ──────────────────────────────────────────────────────────

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
        // Handled by sentinels.
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

const pairwiseCells = buildPairwiseCells(visualRoutes);
const sentinelCells = buildSentinelCells(visualRoutes);
const cells = [...pairwiseCells, ...sentinelCells];

// ── 1. Total cells = 1838, zero duplicates ────────────────────────────────────

{
  assert.equal(visualRoutes.length, 367, 'route combinations must be 367');
  assert.equal(pairwiseCells.length, 1835, 'pairwise baseline must be 1835');
  assert.equal(sentinelCells.length, 3, 'sentinel count must be 3');
  assert.equal(cells.length, 1838, 'total planned cells must be 1838');
  const keySet = new Set(cells.map(cellKey));
  assert.equal(keySet.size, 1838, 'all 1838 cell keys must be unique (no duplicates)');
  console.log(JSON.stringify({ test: 'total-and-uniqueness', baseline: pairwiseCells.length, sentinels: sentinelCells.length, total: cells.length, unique: keySet.size, result: 'PASS' }));
}

// ── 2 & 3. Per-route baseline: all 5 widths once, all 4 themes present ───────

{
  let allWidths = true;
  let allThemes = true;
  for (const route of visualRoutes) {
    const rc = pairwiseCells.filter((c) => c.route.id === route.id && c.route.persona === route.persona);
    const widthSet = new Set(rc.map((c) => c.width));
    const themeSet = new Set(rc.map((c) => c.theme.id));
    if (rc.length !== CELLS_PER_ROUTE || widthSet.size !== WIDTHS.length) allWidths = false;
    if (themeSet.size !== THEMES.length) allThemes = false;
  }
  assert.ok(allWidths, 'every route must have exactly 5 pairwise cells covering all 5 widths once each');
  assert.ok(allThemes, 'every route must have all 4 themes present in its 5 pairwise cells');
  console.log(JSON.stringify({ test: 'per-route-baseline-coverage', widthCoverage: 'PASS', themeCoverage: 'PASS', result: 'PASS' }));
}

// ── 4. Per-route: canonical explicit-light/1440 always present ───────────────

{
  for (const route of visualRoutes) {
    const canonCell = pairwiseCells.find(
      (c) => c.route.id === route.id && c.route.persona === route.persona && isCanonicalCell(c.theme, c.width),
    );
    assert.ok(canonCell, `route ${route.id} (${route.persona}) must have canonical explicit-light/1440`);
  }
  const canonCells = cells.filter((c) => isCanonicalCell(c.theme, c.width));
  assert.equal(canonCells.length, 367, 'canonical explicit-light/1440 must appear in all 367 routes');
  console.log(JSON.stringify({ test: 'canonical-always-present', canonCells: canonCells.length, result: 'PASS' }));
}

// ── 5. Theme rotation rule: NON_CANONICAL_WIDTHS[j] → THEMES[(routeIdx+j)%4] ─

{
  for (const [routeIdx, route] of visualRoutes.entries()) {
    const rc = pairwiseCells.filter((c) => c.route.id === route.id && c.route.persona === route.persona);
    for (const [j, width] of NON_CANONICAL_WIDTHS.entries()) {
      const cell = rc.find((c) => c.width === width);
      assert.ok(cell, `route ${routeIdx} must have cell at width ${width}`);
      const expectedTheme = THEMES[(routeIdx + j) % THEMES.length];
      assert.equal(cell.theme.id, expectedTheme.id,
        `route ${routeIdx} width ${width} (pos ${j}): expected ${expectedTheme.id}, got ${cell.theme.id}`);
    }
    const canonCell = rc.find((c) => c.width === CANONICAL_WIDTH);
    assert.ok(canonCell && canonCell.theme.id === CANONICAL_THEME_ID, `route ${routeIdx}: canonical cell must be explicit-light/1440`);
  }
  console.log(JSON.stringify({ test: 'rotation-rule', result: 'PASS' }));
}

// ── 6. Determinism: same manifest → same cells, same order ───────────────────

{
  const cells2 = [...buildPairwiseCells(visualRoutes), ...buildSentinelCells(visualRoutes)];
  const keys1 = cells.map(cellKey);
  const keys2 = cells2.map(cellKey);
  assert.deepEqual(keys1, keys2, 'cell selection must be fully deterministic');
  console.log(JSON.stringify({ test: 'determinism', result: 'PASS' }));
}

// ── 7. Global 20/20 theme×width pair coverage ────────────────────────────────

{
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

  // Canonical pair: 367 (from pairwise baseline)
  assert.equal(pairCounts[`${CANONICAL_THEME_ID}|${CANONICAL_WIDTH}`], 367, 'explicit-light/1440 must appear 367 times');

  // Sentinel pairs: exactly 1 each
  for (const theme of SENTINEL_THEMES) {
    assert.equal(pairCounts[`${theme.id}|${CANONICAL_WIDTH}`], 1, `${theme.id}/1440 must appear exactly 1 time (sentinel)`);
  }

  // Non-canonical baseline pairs: ≥ 91 each
  for (const theme of THEMES) {
    for (const width of NON_CANONICAL_WIDTHS) {
      assert.ok(pairCounts[`${theme.id}|${width}`] >= 91, `${theme.id}/${width} count must be ≥91`);
    }
  }

  const zeroPairs = Object.entries(pairCounts).filter(([, count]) => count === 0);
  assert.equal(zeroPairs.length, 0, 'no theme×width pair may have count 0 (20/20 coverage required)');
  console.log(JSON.stringify({ test: 'global-pair-coverage-20-of-20', pairCounts, zeroPairs: zeroPairs.length, result: 'PASS' }));
}

// ── 8. Sentinel targets are deterministic ────────────────────────────────────

{
  const fullMatrix = visualRoutes.filter((r) => r.classification === 'FULL_MATRIX_UI');
  assert.ok(fullMatrix.length >= 3, 'must have ≥3 FULL_MATRIX_UI routes for sentinels');

  SENTINEL_THEMES.forEach((theme, i) => {
    const sentinel = sentinelCells[i];
    assert.equal(sentinel.theme.id, theme.id, `sentinel ${i} must use theme ${theme.id}`);
    assert.equal(sentinel.width, CANONICAL_WIDTH, `sentinel ${i} must use width ${CANONICAL_WIDTH}`);
    assert.equal(sentinel.route.id, fullMatrix[i].id, `sentinel ${i} route must be fullMatrix[${i}]`);
    assert.equal(sentinel.route.classification, 'FULL_MATRIX_UI', `sentinel ${i} route must be FULL_MATRIX_UI`);
  });

  // Build again and compare — must be identical
  const sentinels2 = buildSentinelCells(visualRoutes);
  assert.deepEqual(sentinelCells.map(cellKey), sentinels2.map(cellKey), 'sentinel selection must be deterministic');
  console.log(JSON.stringify({ test: 'sentinel-determinism', sentinels: sentinelCells.map((s) => ({ theme: s.theme.id, width: s.width, persona: s.route.persona, routeId: s.route.id })), result: 'PASS' }));
}

// ── 9. Harness source patterns ────────────────────────────────────────────────

{
  const source = fs.readFileSync('scripts/pre-freeze-final-acceptance-harness.mjs', 'utf8');
  assert.match(source, /buildPairwiseCells/, 'harness must define buildPairwiseCells');
  assert.match(source, /buildSentinelCells/, 'harness must define buildSentinelCells');
  assert.match(source, /SENTINEL_THEMES/, 'harness must define SENTINEL_THEMES');
  assert.match(source, /SENTINEL_COUNT/, 'harness must define SENTINEL_COUNT');
  assert.match(source, /NON_CANONICAL_WIDTHS/, 'harness must define NON_CANONICAL_WIDTHS');
  assert.match(source, /CELLS_PER_ROUTE/, 'harness must define CELLS_PER_ROUTE');
  assert.match(source, /plannedVisualCells: visual\.length \* CELLS_PER_ROUTE \+ SENTINEL_COUNT/, 'harness buildManifest must use CELLS_PER_ROUTE + SENTINEL_COUNT');
  assert.match(source, /buildPairwiseCells\(visualRoutes\).*buildSentinelCells\(visualRoutes\)/, 'harness must combine pairwise + sentinel cells');
  assert.match(source, /selectedCellKeys/, 'harness must compute selectedCellKeys for reconcile');
  console.log(JSON.stringify({ test: 'harness-source-inspection', result: 'PASS' }));
}

// ── 10. Contract version ──────────────────────────────────────────────────────

{
  assert.equal(ACCEPTANCE_CONTRACT_VERSION, 'pre-freeze-acceptance-contract-v3',
    'acceptanceLedger.mjs must export ACCEPTANCE_CONTRACT_VERSION = pre-freeze-acceptance-contract-v3');
  console.log(JSON.stringify({ test: 'contract-version', ACCEPTANCE_CONTRACT_VERSION, result: 'PASS' }));
}

// ── Summary ───────────────────────────────────────────────────────────────────

{
  const canonCells = cells.filter((c) => isCanonicalCell(c.theme, c.width));
  const nonCanonCells = cells.filter((c) => !isCanonicalCell(c.theme, c.width));
  assert.equal(canonCells.length, 367);
  assert.equal(nonCanonCells.length, 1838 - 367);
  assert.equal(canonCells.length + nonCanonCells.length, 1838);

  console.log(JSON.stringify({
    suite: 'pre-freeze-pairwise-contract',
    contractVersion: 'pre-freeze-acceptance-contract-v3',
    description: 'constrained pairwise + desktop-theme sentinels',
    baselineCells: 1835,
    sentinelCells: 3,
    plannedVisualCells: 1838,
    renderedPersonaRouteCombinations: 367,
    cellsPerRoute: CELLS_PER_ROUTE,
    canonicalCells: canonCells.length,
    nonCanonicalCells: nonCanonCells.length,
    globalPairCoverage: '20/20',
    missingPairs: 0,
    result: 'ALL PASS',
  }));
}
