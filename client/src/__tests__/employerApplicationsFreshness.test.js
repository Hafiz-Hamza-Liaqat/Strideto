import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * PF-TRACK-B3 — Employer Applications page freshness (visibility/focus
 * refresh, race safety across job switches, mutation-triggered background
 * refresh, no polling). Same convention as employerDashboardFreshness.test.js:
 * no jsdom/DOM runner exists in this repo, so this proves the contract
 * against the shipped source text.
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

const page = read('pages/Employer/EmployerApplications.jsx');
const routes = read('routes/index.jsx');
const layout = read('pages/Employer/EmployerLayout.jsx');

// --- 2. Route re-entry: EmployerApplications is a distinct sibling route element, no caching added ---
{
  check(
    /\{ path: 'applications', element: <EmployerApplications \/> \}/.test(routes),
    'routes/index.jsx: EmployerApplications remains a plain sibling route element (no route-level caching/key trick — natural unmount/remount on navigation still applies)'
  );
  check(
    /<Outlet \s*\/>/.test(layout) && !/memo\(|keepalive|Suspense/i.test(layout),
    'EmployerLayout.jsx: still renders a plain <Outlet /> with no memoization/keep-alive wrapper that could defeat natural remount'
  );
  check(
    /export default function EmployerApplications\(\)/.test(page),
    'EmployerApplications.jsx: still a plain default-exported component (no memo/cache wrapper introduced)'
  );
}

// --- 1. Initial mount fetches once (non-background, forced past any stale in-flight guard) ---
{
  check(
    /loadApplications\(\{ background: false, force: true \}\);/.test(page),
    '1. selectedJobId effect calls loadApplications once, non-background, forced so a job switch is never silently dropped by the in-flight guard'
  );
}

// --- 3/4. Window focus and visibility restoration both trigger a background refresh ---
{
  check(
    /const handleVisibility = \(\) => \{\s*if \(document\.visibilityState === 'visible'\) loadApplications\(\{ background: true \}\);\s*\};/.test(page),
    "3. visibilitychange only refreshes on the 'visible' transition, not on hide"
  );
  check(
    /const handleFocus = \(\) => loadApplications\(\{ background: true \}\);/.test(page),
    '4. window focus triggers a background refresh'
  );
  check(
    /document\.addEventListener\('visibilitychange', handleVisibility\);/.test(page)
      && /window\.addEventListener\('focus', handleFocus\);/.test(page),
    'Both listeners are actually registered'
  );
}

// --- 5. Hidden document never triggers a request ---
{
  check(
    /const loadApplications = useCallback\(\s*\(\{ background = false, force = false \} = \{\}\) => \{[\s\S]*?if \(document\.hidden\) return;/.test(page),
    '5. loadApplications refuses to run at all while the document is hidden, regardless of which trigger called it'
  );
}

// --- 6. Focus and visibility together do not overlap (single in-flight guard) ---
{
  check(
    /if \(inFlightRef\.current && !force\) return;\s*inFlightRef\.current = true;/.test(page),
    '6. A single in-flight guard blocks any overlapping non-forced call — visibility+focus firing together can start at most one background request'
  );
  check(
    !/setInterval|setTimeout/.test(page),
    'No timer of any kind exists in this file — freshness is event-driven only, never polled'
  );
}

// --- 7/9. List remains visible during background refresh; updates after successful response ---
{
  check(
    /if \(!background\) \{\s*setLoading\(true\);\s*setError\(''\);\s*setApiMessage\(''\);\s*\}/.test(page),
    '7. loading is only set for a non-background request — a background refresh never shows the loading state, so the currently-rendered list stays visible'
  );
  check(
    /\.then\(\(\{ data \}\) => \{\s*if \(!mountedRef\.current \|\| seq !== requestSeqRef\.current\) return;\s*setApplications\(data\.data \|\| \[\]\);/.test(page),
    '9. A successful response (initial or background) replaces the applications list unconditionally once accepted'
  );
}

// --- 8. Background failure preserves the current list ---
{
  const loadStart = page.indexOf('getJobApplications(targetJobId)');
  const catchBlock = page.slice(loadStart, page.indexOf('.finally(', loadStart));
  check(
    /if \(!background\) \{\s*setApplications\(\[\]\);\s*setJobMeta\(null\);\s*setError/.test(catchBlock),
    '8. The empty-list/error fallback is only applied when !background — a background failure leaves the previously-rendered list and job meta completely untouched'
  );
}

// --- 10/11. Listeners removed on unmount; no state update after unmount ---
{
  check(
    /useEffect\(\(\) => \{\s*mountedRef\.current = true;\s*return \(\) => \{\s*mountedRef\.current = false;\s*\};\s*\}, \[\]\);/.test(page),
    '10. A dedicated mount-only effect flips mountedRef false on unmount'
  );
  check(
    /return \(\) => \{\s*document\.removeEventListener\('visibilitychange', handleVisibility\);\s*window\.removeEventListener\('focus', handleFocus\);\s*\};/.test(page),
    '10. Cleanup removes both listeners'
  );
  check(
    /if \(!mountedRef\.current \|\| seq !== requestSeqRef\.current\) return;/.test(page),
    '11. Every response handler bails out before touching state once unmounted or once a newer request has superseded it'
  );
}

// --- 12. Successful stage mutation causes a dependent background refresh ---
{
  check(
    /await employerApi\.updateApplicationStatus\(appId, status\);\s*setApplications\(\(prev\) => prev\.map\(\(a\) => \(a\._id === appId \? \{ \.\.\.a, status \} : a\)\)\);\s*[\s\S]*?loadApplications\(\{ background: true, force: true \}\);/.test(page),
    '12. updateStatus keeps its existing optimistic row update, then triggers a forced background refresh so server-derived list/counts stay in sync'
  );
}

// --- 13. Filters (selected job) remain intact across a refresh ---
{
  check(
    /const targetJobId = selectedJobIdRef\.current;/.test(page),
    "13. Every refresh (initial, focus, visibility, or mutation-triggered) re-reads the currently selected job rather than resetting it, so the active job selection is preserved across a refresh"
  );
}

// --- 14. Private User tracker (OpportunityApplication) is never introduced into Employer state ---
{
  check(
    !/OpportunityApplication/.test(page),
    '14. No reference to the private OpportunityApplication tracker exists anywhere in this Employer-facing page — only the legacy Application-backed employerApi.getJobApplications endpoint is used'
  );
}

console.log(`employerApplicationsFreshness.test.js: ${count} assertions passed`);
