// The canonical browser data plane is real same-origin API by default.
// Only response fixtures listed here may be fulfilled by Playwright.
export const APPROVED_RESPONSE_FIXTURES = Object.freeze([
  Object.freeze({
    method: 'GET',
    pathname: '/api/agent/provider-domains/home',
    reason: 'Provider shell bootstrap; service/Mongo contract is covered separately.',
    personas: Object.freeze(['education-independent', 'education-agency', 'business-independent', 'business-agency']),
  }),
]);

export function approvedResponseFixture(method, pathname) {
  return APPROVED_RESPONSE_FIXTURES.find((entry) => entry.method === method && entry.pathname === pathname) || null;
}

export function interceptionAudit() {
  return APPROVED_RESPONSE_FIXTURES.map((entry) => ({ ...entry, personas: [...entry.personas] }));
}

const EXPECTED_HTTP_FAILURES = Object.freeze([
  Object.freeze({
    persona: 'anonymous',
    method: 'POST',
    status: 401,
    pathname: '/api/auth/refresh-token',
    reason: 'Anonymous session bootstrap has no user refresh cookie.',
  }),
  Object.freeze({
    persona: 'employer',
    method: 'POST',
    status: 401,
    pathname: '/api/auth/refresh-token',
    reason: 'Employer session has no user realm refresh cookie; user-realm background token check correctly 401s.',
  }),
  Object.freeze({
    persona: 'admin',
    method: 'GET',
    status: 403,
    pathname: '/api/auth/saved',
    reason: 'Admin realm does not have student-saved capability; background saved-items query correctly returns 403.',
  }),
  // Realm-isolated refresh probes: the SPA auth layer checks realm tokens on
  // every page load. Anonymous visitors to institution/employer/agent realm pages
  // (login, register, reset, invitation, public namespace pages) trigger these
  // refresh attempts which correctly 401 — no realm cookie exists for anonymous.
  Object.freeze({ persona: 'anonymous', method: 'GET', status: 401, pathname: '/api/auth/institution/refresh-token', reason: 'Anonymous session has no institution realm cookie.' }),
  Object.freeze({ persona: 'anonymous', method: 'GET', status: 401, pathname: '/api/auth/employer/refresh-token', reason: 'Anonymous session has no employer realm cookie.' }),
  Object.freeze({ persona: 'anonymous', method: 'GET', status: 401, pathname: '/api/auth/agent/refresh-token', reason: 'Anonymous session has no agent realm cookie.' }),
  Object.freeze({
    persona: 'institution',
    method: 'GET',
    status: 401,
    pathname: '/api/announcements/feed',
    reason: 'Institution auth is intentionally isolated from the user-realm announcement feed.',
  }),
  // Cross-domain 403: education providers do not have access to business-services domain.
  Object.freeze({ persona: 'education-independent', method: 'GET', status: 403, pathname: '/api/agent/business-services/enabled', reason: 'Education provider is not enrolled in business-services domain.' }),
  Object.freeze({ persona: 'education-agency', method: 'GET', status: 403, pathname: '/api/agent/business-services/enabled', reason: 'Education agency is not enrolled in business-services domain.' }),
  // Cross-domain 403: business providers do not have access to education domain.
  Object.freeze({ persona: 'business-independent', method: 'GET', status: 403, pathname: '/api/agent/education/enabled', reason: 'Business provider is not enrolled in education domain.' }),
  Object.freeze({ persona: 'business-agency', method: 'GET', status: 403, pathname: '/api/agent/education/enabled', reason: 'Business agency is not enrolled in education domain.' }),
  // Agent public profile route: renders fallback when agent profile is missing/unapproved/fixture-excluded.
  Object.freeze({
    persona: 'anonymous',
    method: 'GET',
    status: 404,
    pathnamePrefix: '/api/agents/',
    reason: 'Agent public profile route has graceful fallback for unseeded/unapproved/fixture-excluded provider profiles.',
  }),
  // Static CMS pages: these routes have Fallback components that render h1 when CMS record is absent.
  // The CMS API returns 404 when no content is seeded; Chromium logs this as a console error.
  // Classification: HARNESS_EXPECTATION — graceful product behavior, not a product defect.
  // /license renders <NotFound /> (not StaticCmsPage), so /api/cms/site/pages/license is never
  // called. Only the 12 routes that render StaticCmsPage are listed here.
  ...['about', 'faq', 'privacy-policy', 'terms', 'cookies', 'disclaimer', 'refund-policy',
    'careers', 'advertise', 'help-center', 'support', 'services'].map((slug) =>
    Object.freeze({ persona: 'anonymous', method: 'GET', status: 404, pathname: `/api/cms/site/pages/${slug}`, reason: `Static CMS page /${slug} has a Fallback component; CMS absence is expected product behavior.` })
  ),
  // page-layouts variant: the same StaticCmsPage routes also call /api/cms/site/page-layouts/:slug
  // for layout configuration. The endpoint returns 404 when no layout record is seeded.
  // Classification: HARNESS_EXPECTATION — same graceful fallback, different API endpoint path.
  ...['about', 'services', 'privacy-policy', 'terms'].map((slug) =>
    Object.freeze({ persona: 'anonymous', method: 'GET', status: 404, pathname: `/api/cms/site/page-layouts/${slug}`, reason: `Static CMS page /${slug} page-layouts call; layout absence is expected product behavior.` })
  ),
  // Journey saved-item status: anonymous visitors viewing public content pages (marketplace posts,
  // agent profiles, etc.) trigger /api/journey/saved/{contentType}/{id}/status to check bookmark
  // state. No auth cookie → 401. The page renders correctly; this is expected product behavior.
  // pathnamePrefix used because the content-type and ID segments are dynamic.
  Object.freeze({ persona: 'anonymous', method: 'GET', status: 401, pathnamePrefix: '/api/journey/saved/', reason: 'Anonymous users have no saved-item state; journey save-status calls always 401 for unauthenticated visitors.' }),
]);

function matchPathname(entry, pathname) {
  if (entry.pathname) return entry.pathname === pathname;
  if (entry.pathnamePrefix) return pathname.startsWith(entry.pathnamePrefix);
  return false;
}

export function classifyExpectedHttpFailure({ persona, method, status, url }) {
  let pathname;
  try { pathname = new URL(url).pathname; }
  catch { return null; }
  return EXPECTED_HTTP_FAILURES.find((entry) => (
    entry.persona === persona
    && entry.method === method
    && entry.status === status
    && matchPathname(entry, pathname)
  )) || null;
}

// Used by the console event handler, where method/status are not available.
// Matches on persona + pathname only — intentionally loose because the browser
// "Failed to load resource" console error carries no HTTP metadata.
export function classifyExpectedConsoleError({ persona, url }) {
  let pathname;
  try { pathname = new URL(url).pathname; }
  catch { return null; }
  return EXPECTED_HTTP_FAILURES.find((entry) => (
    entry.persona === persona
    && matchPathname(entry, pathname)
  )) || null;
}
