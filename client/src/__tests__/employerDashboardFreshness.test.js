import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * PF-EDM-B4 — Employer Dashboard metrics freshness (visibility/focus
 * refresh, race safety, no polling). Same convention as every other client
 * test in this repo: no jsdom/DOM runner exists, so this proves the
 * contract against the shipped source text.
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
function read(relPath) {
  return readFileSync(path.join(clientSrc, relPath), 'utf8');
}

const dashboard = read('pages/Employer/EmployerDashboard.jsx');
const routes = read('routes/index.jsx');

// --- 3. Route re-entry: EmployerDashboard is a distinct sibling route element, no caching added ---
{
  check(
    /\{ index: true, element: <EmployerDashboard \/> \}/.test(routes),
    'routes/index.jsx: EmployerDashboard remains the plain index route element (no route-level caching/key trick introduced — natural unmount/remount on sibling navigation still applies)'
  );
  check(
    /export default function EmployerDashboard\(\)/.test(dashboard),
    'EmployerDashboard.jsx: still a plain default-exported component (no memo/cache wrapper added that could defeat natural remount)'
  );
}

// --- 1/17/18. Initial mount fetches once; field mapping and PF-EDM-B1 draft value untouched ---
{
  check(
    /loadDashboard\(\{ background: false \}\);/.test(dashboard),
    '1. Initial mount calls loadDashboard once, non-background'
  );
  check(
    /value=\{data\?\.activeJobs \?\? 0\}/.test(dashboard)
      && /value=\{data\?\.totalInternalApplications \?\? data\?\.totalApplications \?\? 0\}/.test(dashboard)
      && /value=\{data\?\.draftJobs \?\? 0\}/.test(dashboard)
      && /value=\{data\?\.pendingApprovalJobs \?\? 0\}/.test(dashboard)
      && /value=\{data\?\.closedJobs \?\? 0\}/.test(dashboard)
      && /value=\{data\?\.newApplications \?\? 0\}/.test(dashboard)
      && /value=\{data\?\.totalJobs \?\? 0\}/.test(dashboard)
      && /value=\{data\?\.totalViews \?\? 0\}/.test(dashboard)
      && /value=\{data\?\.shortlistedCandidates \?\? 0\}/.test(dashboard),
    '17/18. All field mappings are byte-identical to before this phase, including the PF-EDM-B1-corrected draftJobs value — no metric semantics changed'
  );
}

// --- 2/11. Successful response (initial or background) always replaces data ---
{
  check(
    /\.then\(\(\{ data: d \}\) => \{\s*if \(!mountedRef\.current\) return;\s*setData\(d\);\s*setLoadError\(false\);\s*\}\)/.test(dashboard),
    '2/11. A successful response calls setData unconditionally (works identically for initial and background refresh)'
  );
}

// --- 4/5. Visibility restore and window focus both trigger a background refresh ---
{
  check(
    /const handleVisibility = \(\) => \{\s*if \(document\.visibilityState === 'visible'\) loadDashboard\(\{ background: true \}\);\s*\};/.test(dashboard),
    "4. visibilitychange only refreshes on the 'visible' transition, not on hide"
  );
  check(
    /const handleFocus = \(\) => loadDashboard\(\{ background: true \}\);/.test(dashboard),
    '5. window focus triggers a background refresh'
  );
  check(
    /document\.addEventListener\('visibilitychange', handleVisibility\);/.test(dashboard)
      && /window\.addEventListener\('focus', handleFocus\);/.test(dashboard),
    'Both listeners are actually registered'
  );
}

// --- 6/15/16. Single in-flight guard: prevents duplicate simultaneous requests, bounds the queue to 0-or-1, and makes stale-overwrite structurally impossible ---
{
  check(
    /if \(inFlightRef\.current\) return;\s*inFlightRef\.current = true;/.test(dashboard),
    '6/15. A single boolean in-flight guard blocks any overlapping call — visibility+focus firing together can start at most one request, and the guard can never queue more than the one in-flight request (no array/counter queue exists)'
  );
  check(
    !/setInterval|setTimeout/.test(dashboard),
    '16/19. No timer of any kind exists in this file — with at most one request in flight at a time, there is never a second, differently-ordered request for an earlier response to race against'
  );
}

// --- 7. Hidden document never triggers a request ---
{
  check(
    /const loadDashboard = \(\{ background = false \} = \{\}\) => \{\s*if \(document\.hidden\) return;/.test(dashboard),
    '7. loadDashboard refuses to run at all while the document is hidden, regardless of which trigger called it'
  );
}

// --- 8/9. Cleanup removes both listeners; no state update after unmount ---
{
  check(
    /return \(\) => \{\s*mountedRef\.current = false;\s*document\.removeEventListener\('visibilitychange', handleVisibility\);\s*window\.removeEventListener\('focus', handleFocus\);\s*\};/.test(dashboard),
    '8. Cleanup marks unmounted and removes both listeners'
  );
  check(
    /\.then\(\(\{ data: d \}\) => \{\s*if \(!mountedRef\.current\) return;/.test(dashboard)
      && /\.catch\(\(\) => \{\s*if \(!mountedRef\.current\) return;/.test(dashboard),
    '9. Both the success and failure paths bail out before touching state if the component has unmounted'
  );
}

// --- 10/12. Background refresh preserves existing metrics through the loading state and through failure ---
{
  check(
    /if \(!background\) setLoading\(true\);/.test(dashboard),
    "10. loading is only set for the initial (non-background) request — a background refresh never shows the skeleton, so currently-rendered metrics stay visible"
  );
  const catchBlock = dashboard.slice(dashboard.indexOf('.catch(() => {'), dashboard.indexOf('.finally('));
  check(
    /if \(!background\) \{\s*\/\/ Initial load has no prior data to protect/.test(catchBlock),
    '12. The zero-fallback object is only applied when !background — a background failure leaves prior valid metrics completely untouched'
  );
}

// --- 13/14. No raw server error exposed; initial failure still uses the pre-existing safe fallback shape ---
{
  check(
    !/err\.message|err\.response|error\.message/.test(dashboard),
    '13. No raw error object/message is read or rendered anywhere in this file'
  );
  check(
    /setLoadError\(true\);\s*setData\(\{\s*activeJobs: 0,\s*totalApplications: 0,\s*totalViews: 0,\s*shortlistedCandidates: 0,\s*jobs: \[\],\s*conversionRateLabel: 'n\/a',\s*\}\);/.test(dashboard),
    '14. Initial-failure fallback is byte-identical to the pre-existing shape (same fields, same values)'
  );
}

console.log(`employerDashboardFreshness.test.js: ${count} assertions passed`);
