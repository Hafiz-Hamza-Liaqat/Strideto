import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * PF-TRACK-B3 — Hiring Intelligence freshness (visibility/focus refresh,
 * race safety, no polling), delivered via the shared
 * useEmployerDashboardComposition hook. Same convention as
 * employerDashboardFreshness.test.js: no jsdom/DOM runner exists in this
 * repo, so this proves the contract against the shipped source text.
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

const hook = read('employerIntelligence/useEmployerDashboardComposition.js');
const page = read('pages/Employer/EmployerIntelligence.jsx');
const routes = read('routes/index.jsx');
const layout = read('pages/Employer/EmployerLayout.jsx');

// --- 16/29. Route re-entry: EmployerIntelligence is a distinct sibling route element; route protection unchanged ---
{
  check(
    /\{ path: 'intelligence', element: <EmployerIntelligence \/> \}/.test(routes),
    "16. routes/index.jsx: EmployerIntelligence remains a plain sibling route element under 'intelligence' (no route-level caching/key trick — natural unmount/remount on navigation still applies)"
  );
  check(
    /<ProtectedEmployerRoute>\s*<EmployerLayout \/>\s*<\/ProtectedEmployerRoute>/.test(routes),
    '29. Employer routes (including intelligence) remain nested under the unchanged ProtectedEmployerRoute guard'
  );
  check(
    /<Outlet \s*\/>/.test(layout) && !/memo\(|keepalive|Suspense/i.test(layout),
    'EmployerLayout.jsx: still renders a plain <Outlet /> with no memoization/keep-alive wrapper that could defeat natural remount'
  );
}

// --- 15. Initial mount fetches once, non-background ---
{
  check(
    /loadComposition\(\{ background: false \}\);/.test(hook),
    '15. Initial mount calls loadComposition once, non-background'
  );
}

// --- 17/18. Window focus and visibility restoration both trigger a background refresh ---
{
  check(
    /const handleVisibility = \(\) => \{\s*if \(document\.visibilityState === 'visible'\) loadComposition\(\{ background: true \}\);\s*\};/.test(hook),
    "17. visibilitychange only refreshes on the 'visible' transition, not on hide"
  );
  check(
    /const handleFocus = \(\) => loadComposition\(\{ background: true \}\);/.test(hook),
    '18. window focus triggers a background refresh'
  );
  check(
    /document\.addEventListener\('visibilitychange', handleVisibility\);/.test(hook)
      && /window\.addEventListener\('focus', handleFocus\);/.test(hook),
    'Both listeners are actually registered'
  );
}

// --- 19. Single in-flight guard: focus + visibility together cannot overlap ---
{
  check(
    /if \(inFlightRef\.current\) return;\s*inFlightRef\.current = true;/.test(hook),
    '19. A single in-flight guard blocks any overlapping request — visibility+focus firing together can start at most one request'
  );
  check(
    !/setInterval|setTimeout/.test(hook),
    '27. No timer of any kind exists in this hook — freshness is event-driven only, never polled'
  );
}

// --- 7. Hidden document never triggers a request ---
{
  check(
    /const loadComposition = \(\{ background = false \} = \{\}\) => \{\s*if \(document\.hidden\) return;/.test(hook),
    'loadComposition refuses to run at all while the document is hidden, regardless of which trigger called it'
  );
}

// --- 20/22. Existing composition remains during refresh; a new response replaces it once accepted ---
{
  check(
    /if \(!background\) setLoading\(true\);/.test(hook),
    '20. loading is only set for the initial (non-background) request — a background refresh never re-shows the loading state, so currently-rendered widgets stay visible'
  );
  check(
    /\.then\(\(\{ data \}\) => \{\s*if \(!mountedRef\.current\) return;\s*setComposition\(data\);\s*setError\(null\);\s*\}\)/.test(hook),
    '22. A successful response (initial or background) replaces the composition unconditionally once accepted'
  );
}

// --- 21. Background failure preserves the last successful response ---
{
  const catchBlock = hook.slice(hook.indexOf('.catch((err) => {'), hook.indexOf('.finally('));
  check(
    /if \(!background\) \{\s*setError\(err\.response\?\.data\?\.error \|\| t\('employer:intelligenceLoadFailed'\)\);\s*setComposition\(\{ layout: DEFAULT_EMPLOYER_DASHBOARD_LAYOUT, widgets: \{\}, flags: \{\} \}\);\s*\}/.test(catchBlock),
    '21. The default-layout fallback is only applied when !background — a background failure leaves the previously-rendered composition completely untouched'
  );
}

// --- 23/24. Listeners removed on unmount; no state update after unmount ---
{
  check(
    /return \(\) => \{\s*mountedRef\.current = false;\s*document\.removeEventListener\('visibilitychange', handleVisibility\);\s*window\.removeEventListener\('focus', handleFocus\);\s*\};/.test(hook),
    '23. Cleanup marks unmounted and removes both listeners'
  );
  check(
    /\.then\(\(\{ data \}\) => \{\s*if \(!mountedRef\.current\) return;/.test(hook)
      && /\.catch\(\(err\) => \{\s*if \(!mountedRef\.current\) return;/.test(hook),
    '24. Both the success and failure paths bail out before touching state if the component has unmounted'
  );
}

// --- 25/26. Route re-entry after an Employer stage change (from Applications) requests fresh metrics, including open positions ---
{
  check(
    /export default function EmployerIntelligence\(\)/.test(page)
      && /useEmployerDashboardComposition\(\)/.test(page),
    '25. EmployerIntelligence still fetches its data exclusively through useEmployerDashboardComposition, so any natural route remount (e.g. navigating back from Applications after a stage change) triggers a fresh, non-background load'
  );
  check(
    /const widgets = composition\?\.widgets \|\| \{\};/.test(page) && /widgets=\{widgets\}/.test(page),
    '26. Open-position and every other widget render directly from the latest composition response with no separate client-side cache, so a refreshed composition flows straight through to Open Positions'
  );
}

// --- 28. Existing status/filter mappings unchanged (no server/shared files touched by this phase) ---
{
  check(
    !/PIPELINE_STAGES|LEGACY_STATUS_TO_PIPELINE|resolveJobApplyType/.test(hook),
    '28. This hook contains no pipeline/status-mapping logic of its own — it only fetches and stores whatever the (unmodified) server composition already computes'
  );
}

// --- 30. No authentication behavior changes ---
{
  check(
    !/localStorage|sessionStorage|Authorization|token/i.test(hook),
    '30. The freshness hook touches no auth/token/session storage — it only calls the existing employerApi.intelligenceDashboard() wrapper, unchanged'
  );
}

console.log(`employerIntelligenceFreshness.test.js: ${count} assertions passed`);
