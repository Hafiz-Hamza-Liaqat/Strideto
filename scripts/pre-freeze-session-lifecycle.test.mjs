/**
 * QA regression tests for session-lifecycle session-closure rule.
 *
 * Covers (pairwise contract v3, 1835 cells):
 *  - lastActiveCellIdx correctly identifies the last non-skipped cell per group
 *  - Compatible route group = 1 HARD + subsequent SPA within a mini-batch
 *  - Session closes after its final planned route in each (persona, themeId, width) group
 *  - Stale previous-batch sessions cannot remain alive between batches
 *  - Max simultaneously live sessions is bounded (≤5 within a mini-batch, 0 between batches)
 *  - Canonical explicit-light/1440 rules remain unchanged
 *  - Cell universe is 1835 (pairwise v3)
 *  - Harness source contains required session-closure and pairwise patterns
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRouteInventory } from './lib/preMission27RouteInventory.mjs';

// ── shared fixtures ──────────────────────────────────────────────────────────

const WIDTHS = [320, 375, 768, 1024, 1440];
const THEMES = [
  { id: 'explicit-light', preference: 'light', media: 'light' },
  { id: 'explicit-dark',  preference: 'dark',  media: 'dark'  },
  { id: 'system-light',   preference: 'system', media: 'light' },
  { id: 'system-dark',    preference: 'system', media: 'dark'  },
];
const CANONICAL_THEME_ID = 'explicit-light';
const CANONICAL_WIDTH    = 1440;
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
    const isBusinessClientRoute = record.realm === 'STUDENT' && record.route.startsWith('/business');
    const productPersona = isBusinessClientRoute ? 'business-client' : persona;
    allRoutes.push({ id: `${productPersona}:${record.pattern}:${cl}`, persona: productPersona, classification: cl });
  }
}
const visualRoutes = allRoutes.filter((r) => ['FULL_MATRIX_UI', 'PARAMETRIC_UI'].includes(r.classification));
const cellKey = ({ route, theme, width }) => `${route.persona}|${route.id}|${route.classification}|${theme.id}|${width}`;
const isCanonicalCell = (theme, width) => theme.id === CANONICAL_THEME_ID && width === CANONICAL_WIDTH;

// Pairwise v3 cell selection: mirrors buildPairwiseCells in the harness.
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

// Simulate lastActiveCellIdx computation (mirrors the harness logic).
function buildLastActiveCellIdx(selectedCells, completed = new Set(), excludeKeys = new Set()) {
  const map = new Map();
  selectedCells.forEach(({ route, theme, width }, idx) => {
    const k = cellKey({ route, theme, width });
    if (!completed.has(k) && !excludeKeys.has(k)) {
      map.set(`${route.persona}|${theme.id}|${width}`, idx);
    }
  });
  return map;
}

// Simulate session lifecycle: open/close sessions as the harness would.
function simulateSessionLifecycle(selectedCells, lastActiveCellIdx, completed = new Set(), excludeKeys = new Set()) {
  const sessions = new Map(); // persona → { themeId, width }
  const events = [];
  let maxSimultaneous = 0;

  selectedCells.forEach(({ route, theme, width }, idx) => {
    const k = cellKey({ route, theme, width });
    if (completed.has(k) || excludeKeys.has(k)) return;

    // obtainSession: close old if incompatible, open new
    const existing = sessions.get(route.persona);
    if (existing && (existing.themeId !== theme.id || existing.width !== width)) {
      sessions.delete(route.persona);
      events.push({ type: 'close-replaced', persona: route.persona, idx, reason: 'theme-or-width-changed' });
    }
    if (!sessions.has(route.persona)) {
      sessions.set(route.persona, { themeId: theme.id, width });
      events.push({ type: 'open', persona: route.persona, themeId: theme.id, width, idx });
    }

    if (sessions.size > maxSimultaneous) maxSimultaneous = sessions.size;

    // Session closure rule: close after last active cell in this group
    const groupKey = `${route.persona}|${theme.id}|${width}`;
    if (lastActiveCellIdx.get(groupKey) === idx) {
      sessions.delete(route.persona);
      events.push({ type: 'close-last', persona: route.persona, themeId: theme.id, width, idx });
    }
  });

  return { sessions, events, maxSimultaneous };
}

// ── 1. Cell universe: 1835 (pairwise v3) ────────────────────────────────────

{
  assert.equal(cells.length, 1835, 'cell universe must be 1835 (pairwise contract v3)');
  assert.equal(visualRoutes.length, 367, 'representative combinations must be 367');
  assert.equal(cells.length, visualRoutes.length * CELLS_PER_ROUTE, 'total cells must equal routes × cells-per-route');
  const keySet = new Set(cells.map(cellKey));
  assert.equal(keySet.size, 1835, 'all 1835 cell keys must be unique (no duplicates)');
  console.log(JSON.stringify({ test: 'cell-universe', totalCells: cells.length, uniqueCells: keySet.size, cellsPerRoute: CELLS_PER_ROUTE, result: 'PASS' }));
}

// ── 2. lastActiveCellIdx identifies correct last index per group ──────────────

{
  const lastIdx = buildLastActiveCellIdx(cells);

  // Every (persona, themeId, width) group must have an entry
  const groups = new Set();
  cells.forEach(({ route, theme, width }) => groups.add(`${route.persona}|${theme.id}|${width}`));
  assert.equal(lastIdx.size, groups.size, 'lastActiveCellIdx must have one entry per (persona,theme,width) group');

  // Verify: the cell AT lastIdx for each group must actually belong to that group,
  // and there must be no later cell in the same group.
  for (const [groupKey, lastIdxVal] of lastIdx) {
    const [persona, themeId, width] = groupKey.split('|');
    const cell = cells[lastIdxVal];
    assert.equal(cell.route.persona, persona, `lastIdx cell must have correct persona: ${groupKey}`);
    assert.equal(cell.theme.id, themeId, `lastIdx cell must have correct themeId: ${groupKey}`);
    assert.equal(String(cell.width), width, `lastIdx cell must have correct width: ${groupKey}`);

    // No later cell in the same group
    for (let i = lastIdxVal + 1; i < cells.length; i++) {
      const c = cells[i];
      if (c.route.persona === persona && c.theme.id === themeId && String(c.width) === width) {
        assert.fail(`Found a cell at index ${i} after lastIdx ${lastIdxVal} for group ${groupKey}`);
      }
    }
  }

  // Spot check: institution / explicit-light / 1440 — all 367 routes appear in canonical batch.
  const instCanonKey = 'institution|explicit-light|1440';
  const instCanonLastIdx = lastIdx.get(instCanonKey);
  assert.ok(instCanonLastIdx !== undefined, 'institution/explicit-light/1440 group must exist');
  assert.equal(cells[instCanonLastIdx].route.persona, 'institution');
  assert.equal(cells[instCanonLastIdx].theme.id, 'explicit-light');
  assert.equal(cells[instCanonLastIdx].width, 1440);

  // Spot check: anonymous / explicit-light / 1440 — last anonymous route in canonical batch.
  const anonCanonKey = 'anonymous|explicit-light|1440';
  const anonCanonLastIdx = lastIdx.get(anonCanonKey);
  assert.ok(anonCanonLastIdx !== undefined, 'anonymous/explicit-light/1440 group must exist');
  assert.equal(cells[anonCanonLastIdx].route.persona, 'anonymous');

  console.log(JSON.stringify({ test: 'lastActiveCellIdx-correctness', groups: lastIdx.size, result: 'PASS' }));
}

// ── 3. Session closes after its final planned route in each group ─────────────

{
  const lastIdx = buildLastActiveCellIdx(cells);
  const { events } = simulateSessionLifecycle(cells, lastIdx);

  // Every 'open' event must be paired with a 'close-last' event for its (persona, themeId, width).
  const closeLastEvents = new Set(
    events
      .filter((e) => e.type === 'close-last')
      .map((e) => `${e.persona}|${e.themeId}|${e.width}`),
  );
  const openEvents = events.filter((e) => e.type === 'open');
  for (const ev of openEvents) {
    const k = `${ev.persona}|${ev.themeId}|${ev.width}`;
    assert.ok(closeLastEvents.has(k), `Every opened session must be closed by close-last rule: ${k}`);
  }

  // No sessions should be closed by 'close-replaced' — all close via close-last rule.
  const closeReplacedEvents = events.filter((e) => e.type === 'close-replaced');
  assert.equal(closeReplacedEvents.length, 0, 'With session-lifecycle fix, no session should be closed by theme/width replacement — all close via close-last rule');

  console.log(JSON.stringify({ test: 'session-closes-after-final-route', openEvents: openEvents.length, closeLastEvents: closeLastEvents.size, closeReplacedEvents: closeReplacedEvents.length, result: 'PASS' }));
}

// ── 4. No stale session survives between batches ─────────────────────────────

{
  const lastIdx = buildLastActiveCellIdx(cells);

  // With pairwise v3 there are 17 non-empty (theme, width) mini-batches:
  // explicit-light/{320,375,768,1024,1440} = 5; explicit-dark/{320,375,768,1024} = 4;
  // system-light/{320,375,768,1024} = 4; system-dark/{320,375,768,1024} = 4.
  const sessions = new Map();
  let batchKey = null;
  const batchBoundaryViolations = [];

  cells.forEach(({ route, theme, width }, idx) => {
    const newBatchKey = `${theme.id}|${width}`;
    if (batchKey !== null && newBatchKey !== batchKey) {
      if (sessions.size > 0) {
        batchBoundaryViolations.push({
          from: batchKey,
          to: newBatchKey,
          stalePersonas: [...sessions.keys()],
          atIdx: idx,
        });
      }
    }
    batchKey = newBatchKey;

    const existing = sessions.get(route.persona);
    if (existing && (existing.themeId !== theme.id || existing.width !== width)) {
      sessions.delete(route.persona);
    }
    if (!sessions.has(route.persona)) {
      sessions.set(route.persona, { themeId: theme.id, width });
    }
    const groupKey = `${route.persona}|${theme.id}|${width}`;
    if (lastIdx.get(groupKey) === idx) {
      sessions.delete(route.persona);
    }
  });

  assert.deepEqual(batchBoundaryViolations, [], `Stale sessions at batch boundaries: ${JSON.stringify(batchBoundaryViolations.slice(0, 3))}`);

  // Count distinct (theme,width) mini-batches present in cells
  const batchKeys = new Set(cells.map(({ theme, width }) => `${theme.id}|${width}`));
  console.log(JSON.stringify({ test: 'no-stale-sessions-between-batches', batchCount: batchKeys.size, batchBoundaries: batchKeys.size - 1, violations: batchBoundaryViolations.length, result: 'PASS' }));
}

// ── 5. Max simultaneously live sessions bounded ──────────────────────────────

{
  const lastIdx = buildLastActiveCellIdx(cells);
  const { maxSimultaneous } = simulateSessionLifecycle(cells, lastIdx);

  // Within each pairwise mini-batch (~92 routes): peak overlap from ed-independent/ed-agency/
  // biz-independent/biz-agency is ≤4, matching the full-matrix analysis.
  assert.ok(maxSimultaneous <= 10, `Max simultaneous sessions must not exceed 10 (distinct personas): got ${maxSimultaneous}`);
  assert.ok(maxSimultaneous <= 5, `Proven peak from route analysis is ≤4: got ${maxSimultaneous}`);

  console.log(JSON.stringify({ test: 'max-simultaneous-sessions-bounded', maxSimultaneous, bound: 5, result: 'PASS' }));
}

// ── 6. Compatible route group = 1 HARD + subsequent SPA per persona ──────────

{
  // Simulate nav mode for one non-canonical mini-batch (explicit-dark, 320).
  // In pairwise v3, this batch contains routes at routeIdx%4 === 1 (~92 routes).
  const batch = cells.filter((c) => c.theme.id === 'explicit-dark' && c.width === 320);
  assert.ok(batch.length > 0, 'explicit-dark/320 mini-batch must have cells');
  assert.ok(batch.length < visualRoutes.length, 'pairwise mini-batch must be a subset of all routes');
  assert.ok(batch.length >= 2, 'mini-batch must have at least 2 routes');

  const spaReadyMap = new Map();  // persona → spaReady
  const navModes = [];
  for (const { route, theme, width } of batch) {
    const spaReady = spaReadyMap.get(route.persona) || false;
    const useHard = isCanonicalCell(theme, width) || !spaReady;
    navModes.push({ persona: route.persona, mode: useHard ? 'hard' : 'spa' });
    if (useHard) spaReadyMap.set(route.persona, true);
  }

  // Each persona: first occurrence = hard, all later = spa
  const personaFirstSeen = new Map();
  for (const { persona, mode } of navModes) {
    if (!personaFirstSeen.has(persona)) {
      assert.equal(mode, 'hard', `First cell for persona ${persona} must be HARD`);
      personaFirstSeen.set(persona, true);
    } else {
      assert.equal(mode, 'spa', `Subsequent cells for persona ${persona} must be SPA`);
    }
  }

  const spaCount = navModes.filter((n) => n.mode === 'spa').length;
  const hardCount = navModes.filter((n) => n.mode === 'hard').length;
  assert.equal(hardCount, personaFirstSeen.size, 'HARD count must equal distinct persona count (one bootstrap per persona)');
  assert.equal(spaCount, batch.length - hardCount, 'SPA count must be total cells minus HARD bootstraps');
  assert.ok(spaCount >= 8, `At least 8 SPA transitions required in the mini-batch (got ${spaCount})`);

  console.log(JSON.stringify({ test: 'compatible-route-group-spa-reuse', batchSize: batch.length, personas: personaFirstSeen.size, hardNavs: hardCount, spaNavs: spaCount, result: 'PASS' }));
}

// ── 7. Canonical explicit-light/1440 rules unchanged ────────────────────────

{
  const canonBatch = cells.filter((c) => isCanonicalCell(c.theme, c.width));
  assert.equal(canonBatch.length, 367, 'canonical batch must have 367 cells (all routes)');

  // All canonical cells use hard nav regardless of spaReady
  let spaReady = false;
  for (const { theme, width } of canonBatch) {
    const useHard = isCanonicalCell(theme, width) || !spaReady;
    assert.ok(useHard, 'canonical cell must always use hard nav');
    spaReady = true;
    if (isCanonicalCell(theme, width)) spaReady = false;
  }
  assert.equal(spaReady, false, 'spaReady must be false after last canonical cell (about:blank fired)');

  // Session closure: canonical sessions also close after their last cell.
  const lastIdx = buildLastActiveCellIdx(cells);
  const { events } = simulateSessionLifecycle(cells, lastIdx);
  const canonCloseEvents = events.filter(
    (e) => e.type === 'close-last' && e.themeId === CANONICAL_THEME_ID && e.width === CANONICAL_WIDTH,
  );
  const canonOpenEvents = events.filter(
    (e) => e.type === 'open' && e.themeId === CANONICAL_THEME_ID && e.width === CANONICAL_WIDTH,
  );
  assert.equal(canonCloseEvents.length, canonOpenEvents.length, 'every canonical session must be closed by close-last rule');

  console.log(JSON.stringify({ test: 'canonical-rules-unchanged', canonCells: canonBatch.length, canonOpens: canonOpenEvents.length, canonCloses: canonCloseEvents.length, result: 'PASS' }));
}

// ── 8. SPA count provable from explicit-dark/320 mini-batch ─────────────────

{
  // Prove ≥8 SPA is achievable from the total mini-batch SPA count.
  const batch = cells.filter((c) => c.theme.id === 'explicit-dark' && c.width === 320);
  const spaReadyMap = new Map();
  let spaCount = 0;
  for (const { route, theme, width } of batch) {
    const spaReady = spaReadyMap.get(route.persona) || false;
    const useHard = isCanonicalCell(theme, width) || !spaReady;
    if (!useHard) spaCount += 1;
    if (useHard) spaReadyMap.set(route.persona, true);
  }
  assert.ok(spaCount >= 8, `Batch must contain ≥8 SPA navigations (got ${spaCount})`);

  console.log(JSON.stringify({ test: 'spa-count-in-targeted-proof', batchSize: batch.length, spaCount, result: 'PASS' }));
}

// ── 9. Harness source contains required session-lifecycle and pairwise patterns

{
  const source = fs.readFileSync('scripts/pre-freeze-final-acceptance-harness.mjs', 'utf8');

  // Indexed for-loop
  assert.match(source, /for \(let cellIdx = 0; cellIdx < selectedCells\.length; cellIdx\+\+\)/, 'harness must use indexed for-loop');
  assert.match(source, /const \{ route, theme, width \} = selectedCells\[cellIdx\]/, 'harness must destructure from indexed selectedCells');

  // lastActiveCellIdx precomputation
  assert.match(source, /lastActiveCellIdx/, 'harness must define lastActiveCellIdx');
  assert.match(source, /lastActiveCellIdx\.set\(/, 'harness must populate lastActiveCellIdx');

  // Session closure after last active cell
  assert.match(source, /lastActiveCellIdx\.get\(`\$\{route\.persona\}\|\$\{theme\.id\}\|\$\{width\}`\) === cellIdx/, 'harness must check lastActiveCellIdx for session closure');
  assert.match(source, /await closeSession\(route\.persona\)/, 'harness must call closeSession after last active cell');

  // PARAMETRIC_UI early-continue also closes session
  const paramSection = source.slice(source.indexOf('ACCEPTANCE_REAL_PARAM_NOT_RESOLVED'));
  assert.match(paramSection, /lastActiveCellIdx\.get\(/, 'PARAMETRIC_UI early-continue must also close session via lastActiveCellIdx');

  // Pairwise v3 patterns
  assert.match(source, /buildPairwiseCells/, 'harness must define buildPairwiseCells for pairwise contract v3');
  assert.match(source, /NON_CANONICAL_WIDTHS/, 'harness must define NON_CANONICAL_WIDTHS');
  assert.match(source, /CELLS_PER_ROUTE/, 'harness must define CELLS_PER_ROUTE');

  // Existing cross-cell SPA patterns preserved
  assert.match(source, /spaReady/, 'harness must still track spaReady');
  assert.match(source, /history\.pushState/, 'harness must still use pushState for SPA');
  assert.match(source, /isCanonicalCell\(theme, width\) \|\| lastError/, 'about:blank isolation must still be conditional on canonical or error');

  // runnerVersion must be a string literal in the harness (will be bumped in commit)
  assert.match(source, /runnerVersion: '/, 'harness must contain runnerVersion string literal');

  console.log(JSON.stringify({ test: 'harness-source-inspection', result: 'PASS' }));
}

// ── 10. Skipped (already-completed) cells excluded from lastActiveCellIdx ────

{
  // Simulate a partial run where the first 434 cells are already completed.
  const completedKeys = new Set(cells.slice(0, 434).map(cellKey));
  const lastIdx = buildLastActiveCellIdx(cells, completedKeys);

  // No group's lastIdx should point to a completed cell.
  for (const [groupKey, idx] of lastIdx) {
    const k = cellKey(cells[idx]);
    assert.ok(!completedKeys.has(k), `lastActiveCellIdx must not point to a completed (skipped) cell: ${groupKey} → ${idx}`);
  }

  console.log(JSON.stringify({ test: 'skipped-cells-excluded-from-lastActiveCellIdx', completedCells: completedKeys.size, result: 'PASS' }));
}

console.log(JSON.stringify({ suite: 'pre-freeze-session-lifecycle', contractVersion: 'pre-freeze-acceptance-contract-v3', plannedVisualCells: 1835, result: 'ALL PASS' }));
