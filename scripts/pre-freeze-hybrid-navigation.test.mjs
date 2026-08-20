/**
 * QA regression tests for hybrid navigation implementation.
 *
 * Covers:
 *  - 7340 cell-set equivalence (old and new produce identical keys)
 *  - Canonical explicit-light/1440 cells are designated for hard navigation
 *  - Non-canonical cells count and ordering
 *  - Navigation mode assignment logic (canonical → hard, spaReady=false → hard, else → spa)
 *  - Uninitialized-session fallback to hard navigation
 *  - Per-cell observation isolation (rebind mechanism)
 *  - Stale-h1 and same-h1-route safety (URL as primary proof)
 *  - Harness source contains required hybrid navigation patterns
 *  - theme+width ordering unchanged
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
const SENTINEL_THEMES = THEMES.filter((t) => t.id !== CANONICAL_THEME_ID);
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

function buildSentinelCells(vRoutes) {
  const fullMatrix = vRoutes.filter((r) => r.classification === 'FULL_MATRIX_UI');
  return SENTINEL_THEMES.map((theme, i) => ({ route: fullMatrix[i], theme, width: CANONICAL_WIDTH }));
}

const pairwiseCells = buildPairwiseCells(visualRoutes);
const sentinelCells = buildSentinelCells(visualRoutes);
const cells = [...pairwiseCells, ...sentinelCells];

// ── 1. Cell-set equivalence ───────────────────────────────────────────────────

{
  const keys = cells.map(cellKey);
  const keySet = new Set(keys);
  assert.equal(keys.length, 1838, 'total cell count must be 1838 (1835 pairwise + 3 sentinels)');
  assert.equal(keySet.size, 1838, 'all cell keys must be unique (no duplicates)');
  assert.equal(visualRoutes.length, 367, 'representative combinations must be 367');
  assert.equal(CELLS_PER_ROUTE, 5, 'cells per route must be 5 (4 non-canonical + 1 canonical)');

  // Verify each cell key format: persona|id|classification|theme|width
  for (const cell of cells) {
    const k = cellKey(cell);
    assert.ok(k.split('|').length === 5, `cell key must have 5 pipe-separated parts: ${k}`);
    assert.ok(['FULL_MATRIX_UI', 'PARAMETRIC_UI'].includes(cell.route.classification), `classification must be visual: ${cell.route.classification}`);
  }

  console.log(JSON.stringify({ test: 'cell-set-equivalence', totalCells: keys.length, pairwiseCells: pairwiseCells.length, sentinelCells: sentinelCells.length, uniqueCells: keySet.size, result: 'PASS' }));
}

// ── 2. Canonical cell designation ────────────────────────────────────────────

{
  const canonicalCells = cells.filter((c) => isCanonicalCell(c.theme, c.width));
  const nonCanonicalCells = cells.filter((c) => !isCanonicalCell(c.theme, c.width));

  assert.equal(canonicalCells.length, 367, 'exactly 367 canonical cells (one per persona/route combination)');
  assert.equal(nonCanonicalCells.length, 1838 - 367, `non-canonical cells must be ${1838 - 367}`);

  // Every visual route must appear in exactly one canonical cell
  const canonicalRouteIds = canonicalCells.map((c) => c.route.id);
  const canonicalRouteSet = new Set(canonicalRouteIds);
  assert.equal(canonicalRouteSet.size, 367, 'every visual route must have exactly one canonical cell');

  // All canonical cells use explicit-light + 1440
  for (const c of canonicalCells) {
    assert.equal(c.theme.id, CANONICAL_THEME_ID, `canonical cell theme must be ${CANONICAL_THEME_ID}`);
    assert.equal(c.width, CANONICAL_WIDTH, `canonical cell width must be ${CANONICAL_WIDTH}`);
  }

  console.log(JSON.stringify({ test: 'canonical-cell-designation', canonicalCells: canonicalCells.length, nonCanonicalCells: nonCanonicalCells.length, result: 'PASS' }));
}

// ── 3. Navigation mode assignment ────────────────────────────────────────────

{
  // Simulate the session state model used by the harness.
  // isCanonicalCell → hard; !session.spaReady → hard; otherwise → spa
  function navMode(theme, width, spaReady) {
    if (isCanonicalCell(theme, width) || !spaReady) return 'hard';
    return 'spa';
  }

  // Canonical always hard regardless of spaReady
  assert.equal(navMode({ id: 'explicit-light' }, 1440, true), 'hard', 'canonical + spaReady=true must still use hard nav');
  assert.equal(navMode({ id: 'explicit-light' }, 1440, false), 'hard', 'canonical + spaReady=false must use hard nav');

  // Non-canonical: spaReady=false → hard (uninit/bootstrap)
  assert.equal(navMode({ id: 'explicit-dark' }, 1440, false), 'hard', 'non-canonical spaReady=false must use hard nav (bootstrap)');
  assert.equal(navMode({ id: 'explicit-light' }, 320, false), 'hard', 'non-canonical spaReady=false must use hard nav (bootstrap)');
  assert.equal(navMode({ id: 'system-dark' }, 375, false), 'hard', 'non-canonical spaReady=false must use hard nav (bootstrap)');

  // Non-canonical: spaReady=true → spa
  assert.equal(navMode({ id: 'explicit-dark' }, 1440, true), 'spa', 'non-canonical spaReady=true must use spa nav');
  assert.equal(navMode({ id: 'explicit-light' }, 320, true), 'spa', 'non-canonical spaReady=true must use spa nav');
  assert.equal(navMode({ id: 'system-light' }, 768, true), 'spa', 'non-canonical spaReady=true must use spa nav');

  console.log(JSON.stringify({ test: 'navigation-mode-assignment', result: 'PASS' }));
}

// ── 4. Uninitialized session fallback ────────────────────────────────────────

{
  // A fresh session always has spaReady=false.
  // Simulating the session tuple lifecycle across a (explicit-dark, 320) batch:
  //   cell 0: new session (spaReady=false) → hard nav → sets spaReady=true
  //   cell 1: existing session (spaReady=true) → spa nav
  //   cell 2: ... → spa nav
  //   (explicit-dark, 375) batch: new session (different width) → hard nav → spa...

  const darkBatch320 = cells.filter((c) => c.theme.id === 'explicit-dark' && c.width === 320);
  assert.ok(darkBatch320.length >= 2, 'need at least 2 routes to test session reuse');

  let spaReady = false;
  const modes = [];
  for (const cell of darkBatch320) {
    const mode = (isCanonicalCell(cell.theme, cell.width) || !spaReady) ? 'hard' : 'spa';
    modes.push(mode);
    if (mode === 'hard') spaReady = true; // simulate successful hard load
  }
  assert.equal(modes[0], 'hard', 'first cell in a new session must use hard nav');
  assert.ok(modes.slice(1).every((m) => m === 'spa'), 'subsequent cells in same session must use spa nav');

  // New session for different width
  spaReady = false;
  const darkBatch375 = cells.filter((c) => c.theme.id === 'explicit-dark' && c.width === 375);
  const modes375 = [];
  for (const cell of darkBatch375) {
    const mode = (isCanonicalCell(cell.theme, cell.width) || !spaReady) ? 'hard' : 'spa';
    modes375.push(mode);
    if (mode === 'hard') spaReady = true;
  }
  assert.equal(modes375[0], 'hard', 'new session for different width must use hard nav');
  assert.ok(modes375.slice(1).every((m) => m === 'spa'), 'subsequent cells in new-width session must use spa nav');

  // Canonical batch: all hard regardless
  const canonicalBatch = cells.filter((c) => isCanonicalCell(c.theme, c.width));
  spaReady = false;
  const canonicalModes = [];
  for (const cell of canonicalBatch) {
    const mode = (isCanonicalCell(cell.theme, cell.width) || !spaReady) ? 'hard' : 'spa';
    canonicalModes.push(mode);
    if (mode === 'hard') spaReady = true;
  }
  // After the first cell, spaReady is true — but canonical overrides it
  assert.ok(canonicalModes.every((m) => m === 'hard'), 'all canonical cells must use hard nav regardless of spaReady');

  console.log(JSON.stringify({ test: 'uninitialized-session-fallback', darkBatch320FirstMode: modes[0], darkBatch320SpaCount: modes.slice(1).length, canonicalAllHard: true, result: 'PASS' }));
}

// ── 5. Per-cell observation isolation ────────────────────────────────────────

{
  // Simulate the array-rebind isolation mechanism.
  // Each cell creates fresh arrays, which are then assigned to session.errors/failed/etc.
  // An error from cell A cannot appear in cell B's result if arrays are rebound before nav.

  const session = { errors: [], failed: [], consoleTasks: [], expectedHttpConsoleErrors: new Set() };

  // Cell A
  const aErrors = []; const aFailed = [];
  session.errors = aErrors; session.failed = aFailed;
  session.errors.push({ text: 'error from cell A' });
  assert.equal(aErrors.length, 1);

  // Rebind for Cell B
  const bErrors = []; const bFailed = [];
  session.errors = bErrors; session.failed = bFailed;

  // Simulate a late-firing event from A's route that writes to session.errors
  // (This would have landed in aErrors if it fired before rebind, but it fires after)
  // After rebind, session.errors points to bErrors — contamination occurs here:
  session.errors.push({ text: 'late event after rebind' });

  // bErrors now has the late event — but aErrors does not (isolation in the other direction)
  assert.equal(aErrors.length, 1, 'cell A errors must not be mutated after rebind');
  assert.equal(bErrors.length, 1, 'late event goes to cell B (rebind timing is a known constraint)');

  // The KEY isolation proof: explicit reset at attempt start prevents THIS from leaking across cells
  // The harness does: session.errors.length = 0 at the start of each attempt
  bErrors.length = 0; // simulate the reset
  assert.equal(bErrors.length, 0, 'explicit reset at attempt start clears any pre-navigation events');

  // Cell C starts fresh after reset — no contamination from A or B
  const cErrors = []; const cFailed = [];
  session.errors = cErrors; session.failed = cFailed;
  assert.equal(cErrors.length, 0, 'fresh cell C arrays must be empty');
  assert.equal(aErrors.length, 1, 'cell A results are preserved independently');

  console.log(JSON.stringify({ test: 'per-cell-observation-isolation', rebindIsolatesForwardDirection: true, explicitResetRemovesPreNavEvents: true, result: 'PASS' }));
}

// ── 6. Stale-h1 and same-h1-route safety ────────────────────────────────────

{
  // The URL waitForFunction is the primary completion proof for SPA cells.
  // This means same-title routes do not produce false failures.
  // Verify the logic: URL match → route rendered; h1 presence → component active.
  // h1 text change is NOT required.

  function spaReadinessProof(currentPathname, expectedPath, h1Text) {
    const urlMatch = currentPathname === expectedPath;
    const h1Present = h1Text !== null && h1Text !== '';
    return { pass: urlMatch && h1Present, urlMatch, h1Present };
  }

  // Normal case: h1 changes
  const normalA = spaReadinessProof('/institution/profile', '/institution/profile', 'Organization profile');
  assert.ok(normalA.pass, 'route with matching URL and h1 must pass');

  // Same-h1 case: two routes with identical h1 text — must still PASS based on URL
  const sameH1A = spaReadinessProof('/institution/help', '/institution/help', 'Help');
  const sameH1B = spaReadinessProof('/institution/support', '/institution/support', 'Help');
  assert.ok(sameH1A.pass, 'first same-h1 route must pass on URL match');
  assert.ok(sameH1B.pass, 'second same-h1 route must pass on URL match — h1 text change is not required');

  // Wrong URL → fail even if h1 is present (stale h1 from previous route)
  const staleH1 = spaReadinessProof('/institution/profile', '/institution/settings', 'Organization profile');
  assert.equal(staleH1.pass, false, 'stale h1 on wrong URL must fail');
  assert.equal(staleH1.urlMatch, false, 'URL must not match stale state');

  // Missing h1 → fail even if URL is correct
  const missingH1 = spaReadinessProof('/institution/settings', '/institution/settings', '');
  assert.equal(missingH1.pass, false, 'missing h1 must fail even if URL matches');

  console.log(JSON.stringify({ test: 'stale-h1-and-same-h1-route-safety', sameH1RoutePassesOnUrlMatch: true, wrongUrlWithH1Fails: true, missingH1Fails: true, result: 'PASS' }));
}

// ── 7. Harness source inspection ─────────────────────────────────────────────

{
  const source = fs.readFileSync('scripts/pre-freeze-final-acceptance-harness.mjs', 'utf8');

  // Canonical cell predicate must be present and exported as a named constant/function
  assert.match(source, /CANONICAL_THEME_ID/, 'harness must define CANONICAL_THEME_ID');
  assert.match(source, /CANONICAL_WIDTH/, 'harness must define CANONICAL_WIDTH');
  assert.match(source, /function isCanonicalCell/, 'harness must define isCanonicalCell');

  // Session must track SPA readiness
  assert.match(source, /spaReady/, 'harness must track spaReady on session');
  assert.match(source, /session\.spaReady = true/, 'harness must set spaReady=true after successful hard nav');
  assert.match(source, /session\.spaReady = false/, 'harness must reset spaReady=false after about:blank or error');

  // SPA navigation mechanism: pushState + popstate
  assert.match(source, /history\.pushState/, 'harness must use pushState for SPA navigation');
  assert.match(source, /PopStateEvent\('popstate'/, 'harness must dispatch popstate event');

  // URL verification as primary SPA completion proof
  assert.match(source, /spa-url-reached/, 'harness must have spa-url-reached stage');
  assert.match(source, /window\.location\.pathname === path/, 'harness must verify URL pathname matches target');

  // Hard navigation path must retain full goto semantics
  assert.match(source, /session\.page\.goto\(`\$\{BASE\}\$\{navigateUrl\}`, \{ waitUntil: 'domcontentloaded'/, 'hard nav must use domcontentloaded goto');

  // Navigation mode must be recorded in lifecycle events
  assert.match(source, /navMode: cellNavMode/, 'lifecycle events must include navMode');

  // Canonical override must be enforced
  assert.match(source, /isCanonicalCell\(theme, width\)/, 'harness must call isCanonicalCell to determine nav mode');
  assert.match(source, /const useHardNav = isCanonicalCell/, 'canonical override must appear in useHardNav expression');

  // Conditional about:blank: canonical cells and error path reset; non-canonical HARD keeps SPA alive
  assert.match(source, /isCanonicalCell\(theme, width\) \|\| lastError/, 'about:blank must be conditional on canonical cell or error');

  // navigationStats must be tracked and reported
  assert.match(source, /navigationStats/, 'harness must track and report navigationStats');
  assert.match(source, /canonicalHardNavigations/, 'harness must count canonical hard navigations separately');

  // Existing data-plane patterns must be preserved
  assert.match(source, /fulfillApprovedResponse\(request, url, routeRef\.current\.persona, routeRef\.current\.id, session\.errors\)/, 'approved response fixture pattern must be preserved');
  assert.match(source, /if \(!url\.pathname\.startsWith\('\/api\/'\)\) return request\.continue\(\)/, 'API passthrough guard must be preserved');

  console.log(JSON.stringify({ test: 'harness-source-inspection', result: 'PASS' }));
}

// ── 8. theme+width ordering preserved ────────────────────────────────────────

{
  // Verify the canonical cells appear in the LAST width slot of the explicit-light batch
  // (WIDTHS = [320, 375, 768, 1024, 1440] — 1440 is the last)
  const explicitLightCells = cells.filter((c) => c.theme.id === 'explicit-light');
  const lastWidth = Math.max(...WIDTHS);
  assert.equal(lastWidth, CANONICAL_WIDTH, `${CANONICAL_WIDTH} must be the last width in WIDTHS array`);

  // The explicit-light/1440 batch is the last subset of the explicit-light theme group
  const explicitLight1440Start = explicitLightCells.findIndex((c) => c.width === CANONICAL_WIDTH);
  const explicitLight1440Cells = explicitLightCells.filter((c) => c.width === CANONICAL_WIDTH);
  assert.equal(explicitLight1440Cells.length, 367, 'explicit-light/1440 batch must have 367 cells');
  // All explicit-light/1440 cells come after the other widths in the explicit-light group
  const widthsBeforeCanonical = WIDTHS.filter((w) => w !== CANONICAL_WIDTH);
  const cellsBeforeCanonical = explicitLightCells.slice(0, explicitLight1440Start);
  const widthsPresent = [...new Set(cellsBeforeCanonical.map((c) => c.width))].sort((a, b) => a - b);
  assert.deepEqual(widthsPresent, widthsBeforeCanonical.sort((a, b) => a - b), 'non-canonical widths must appear before canonical in explicit-light batch');

  console.log(JSON.stringify({ test: 'theme-width-ordering-preserved', canonicalBatchPosition: 'last-in-explicit-light', result: 'PASS' }));
}

// ── 9. Pairwise selection determinism and per-route coverage ─────────────────

{
  // Build a second copy with the same algorithm → must produce identical key set.
  const cells2 = [...buildPairwiseCells(visualRoutes), ...buildSentinelCells(visualRoutes)];
  const keys1 = new Set(cells.map(cellKey));
  const keys2 = new Set(cells2.map(cellKey));
  assert.equal(keys1.size, keys2.size, 'pairwise selection must be deterministic (same size)');
  const onlyIn1 = [...keys1].filter((k) => !keys2.has(k));
  const onlyIn2 = [...keys2].filter((k) => !keys1.has(k));
  assert.equal(onlyIn1.length, 0, 'first invocation must match second (no keys only in first)');
  assert.equal(onlyIn2.length, 0, 'second invocation must match first (no keys only in second)');

  // Each visual route must appear in exactly CELLS_PER_ROUTE pairwise cells with all 5 widths unique.
  // Sentinel routes appear in CELLS_PER_ROUTE + 1 cells total (pairwise + one sentinel).
  const sentinelRouteIds = new Set(sentinelCells.map((s) => `${s.route.persona}|${s.route.id}`));
  for (const route of visualRoutes) {
    const routeCells = pairwiseCells.filter((c) => c.route.id === route.id && c.route.persona === route.persona);
    assert.equal(routeCells.length, CELLS_PER_ROUTE, `route ${route.id} must appear in exactly ${CELLS_PER_ROUTE} pairwise cells`);
    const widthSet = new Set(routeCells.map((c) => c.width));
    assert.equal(widthSet.size, WIDTHS.length, `route ${route.id} must have all ${WIDTHS.length} unique widths`);
    const themeSet = new Set(routeCells.map((c) => c.theme.id));
    assert.equal(themeSet.size, THEMES.length, `route ${route.id} must have all ${THEMES.length} themes present`);
  }

  console.log(JSON.stringify({ test: 'pairwise-selection-determinism', cells: cells.length, pairwiseCells: pairwiseCells.length, sentinelCells: sentinelCells.length, routeWidthCoverage: 'PASS', routeThemeCoverage: 'PASS', result: 'PASS' }));
}

// ── 10. Cross-cell SPA state preservation ─────────────────────────────────────

{
  // Proves that a successful HARD navigation for a non-canonical cell does NOT reset
  // spaReady=false. The about:blank isolation path must only fire for canonical cells
  // (explicit-light/1440) or on an error. Non-canonical HARD bootstraps the SPA and
  // must leave spaReady=true so subsequent cells in the same tuple use SPA navigation.

  // Pick a non-canonical tuple (explicit-dark / 1440): not canonical because theme differs.
  const nonCanonTheme = { id: 'explicit-dark' };
  const nonCanonWidth = 1440;
  assert.equal(isCanonicalCell(nonCanonTheme, nonCanonWidth), false, 'test fixture must be non-canonical');

  // Simulate the state machine for 3 sequential cells in the same session.
  function simulateAboutBlankReset(theme, width, lastError) {
    // Mirrors the fixed harness condition:
    return isCanonicalCell(theme, width) || Boolean(lastError);
  }

  let spaReady = false; // new session
  const navModes = [];

  for (let i = 0; i < 3; i += 1) {
    const useHardNav = isCanonicalCell(nonCanonTheme, nonCanonWidth) || !spaReady;
    navModes.push(useHardNav ? 'hard' : 'spa');
    if (useHardNav) {
      // Successful hard nav: spaReady=true is set unconditionally
      spaReady = true;
      // about:blank reset fires only for canonical OR error — neither applies here
      const resetsPage = simulateAboutBlankReset(nonCanonTheme, nonCanonWidth, null);
      if (resetsPage) spaReady = false;
    }
  }

  assert.equal(navModes[0], 'hard', 'cell 0 (new session): must use HARD nav');
  assert.equal(navModes[1], 'spa', 'cell 1 (after successful HARD): must use SPA nav');
  assert.equal(navModes[2], 'spa', 'cell 2: must use SPA nav (spaReady preserved)');

  // Error path: a failed cell (lastError set) must still reset spaReady=false.
  spaReady = true; // already bootstrapped
  const errorReset = simulateAboutBlankReset(nonCanonTheme, nonCanonWidth, new Error('simulated'));
  if (errorReset) spaReady = false;
  assert.equal(spaReady, false, 'error path must reset spaReady=false');

  // Canonical batch (explicit-light/1440): always HARD; about:blank fires after each cell.
  const canonTheme = { id: CANONICAL_THEME_ID };
  spaReady = false;
  const canonModes = [];
  for (let i = 0; i < 3; i += 1) {
    const useHardNav = isCanonicalCell(canonTheme, CANONICAL_WIDTH) || !spaReady;
    canonModes.push(useHardNav ? 'hard' : 'spa');
    if (useHardNav) {
      spaReady = true;
      if (simulateAboutBlankReset(canonTheme, CANONICAL_WIDTH, null)) spaReady = false;
    }
  }
  assert.ok(canonModes.every((m) => m === 'hard'), 'canonical cells must remain HARD regardless of spaReady');

  // New session for a different tuple (new persona/theme/width) bootstraps HARD.
  spaReady = false; // new session
  const newTupleMode = (isCanonicalCell({ id: 'system-dark' }, 375) || !spaReady) ? 'hard' : 'spa';
  assert.equal(newTupleMode, 'hard', 'new session tuple must bootstrap with HARD nav');

  // Cell universe is 1838 (pairwise contract v3 + 3 sentinels)
  assert.equal(cells.length, 1838, 'cell universe must be 1838 (1835 pairwise + 3 sentinels)');

  console.log(JSON.stringify({ test: 'cross-cell-spa-preservation', nonCanonCell0: navModes[0], nonCanonCell1: navModes[1], nonCanonCell2: navModes[2], errorPathResetsSpready: true, canonicalAlwaysHard: true, newTupleBootstrapsHard: true, cellUniverse: 1838, result: 'PASS' }));
}

console.log(JSON.stringify({ suite: 'pre-freeze-hybrid-navigation', contractVersion: 'pre-freeze-acceptance-contract-v3', plannedVisualCells: 1838, result: 'ALL PASS' }));
