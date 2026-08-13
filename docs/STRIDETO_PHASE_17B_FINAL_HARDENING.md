# STRIDETO PHASE 17B FINAL HARDENING

This is an implementation record. It is **not** Phase 18 certification, a push, or a deployment.

Starting HEAD: `a15f84f`  
Branch: `main`  
Mode: IMPLEMENTATION + TARGETED RUNTIME ACCEPTANCE

## Baseline / safety

- Known WIP isolated with path-scoped stash `phase17b-isolate-known-wip` (not `-u`):
  - `client/src/components/admin/AdminDataTable.jsx`
  - `client/src/components/admin/AdminTableFilters.jsx`
  - `client/src/components/common/FormField.jsx`
- Protected untracked files were not committed, deleted, or reset:
  - `docker-compose.appenv-align.yml`
  - `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
  - `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- Worker remained STOPPED. No live email, SMS, WhatsApp, Stripe, payouts, AI, or scraping.
- No Mongo/Redis/media deletion. No `down -v`.

## 17B-1 Runtime / Discovery

### /jobs root cause

`client/src/pages/Jobs/Jobs.jsx` rendered `<ScrollReveal>` for authenticated recommendations **without importing it**. When `isAuthenticated && recommendedJobs.length > 0`, React threw during render and `RouteErrorBoundary` showed “This page could not be displayed”. Home still worked because it imports `ScrollReveal` and uses a different card tree.

Secondary defects:

- `jobsController.buildJobQuery` called `isValidJobFamily` / `isValidSpecialization` without importing them (500 if those query params were present).
- Recommendations queried all `status: 'active'` jobs without launch projection, so Home/recs could show records `/jobs` would not.
- Saved listings populated full documents without launch projection.

### Fixes

- Import `ScrollReveal`; filter malformed rows; API failure shows retry; empty catalog is truthful.
- `useListings` accepts arrays only.
- Taxonomy validators imported; one malformed list item is excluded instead of failing the catalog.
- Recommendations use `withFixtureExclusion` and a candidate cap of 80.
- Saved listings use `projectSavedRecord` (unavailable stub, no fixture metadata).
- Program Explorer: pending vs applied filters, Apply / Reset, URL query, truthful empty state.
- Student Profile: Country / Region / City cascade; no Pakistan default.
- Central `html` / `html.dark` `color-scheme` plus WebKit calendar indicator invert for dark theme.
- Discovery empty states for Jobs, Programs, Scholarships, Admissions, Internships.

`FormField.jsx` was not edited (known WIP).

## 17B-2 Identity / Security

- Access token TTL remains 15 minutes. Refresh remains 7-day HttpOnly cookie.
- Shared `refreshPromise` already existed; bootstrap no longer clears a hydrated in-memory session on a quiet refresh miss.
- Visibility/focus trigger a silent refresh (`clearOnFailure: false`).
- Institution and Agent password change now require current password + policy validation; shared `ChangePasswordForm`.
- Other sessions remain revoked by existing `tokenVersion` / family revocation.
- Registration for Student / Employer / Agent / Institution requires `acceptedTerms === true`. Server writes `termsAcceptedAt`, `termsVersion`, `privacyAcknowledgedAt`, `privacyVersion`. Client cannot forge versions.
- Turnstile middleware is mandatory only when `TURNSTILE_ENABLED=1` and both keys exist. Default `not_configured`. Secret is backend-only.
- Step-up grant helper exists for password/email/phone/team/payout/staff purposes. Initial factor is current password.
- Phone verification remains not_configured (no SMS/WhatsApp). Email verification foundation unchanged.
- Login identifier unchanged (email). No dual email+phone login fields.

## 17B-3 Final UX

- Connected Accounts catalog: all providers `not_configured`; confer no Trust / verification / canonical authority. No active “Continue with…” for unconfigured providers.
- Public nav current state uses `aria-current="page"` plus an accent underline.
- Institution dashboard: verification Approved vs canonical claim Under review, with draft/publish wording. Claim page restates independence.
- Account settings: shared password form, sessions, connected-accounts honesty.
- Brand: orange reserved for current-nav accent; primary actions stay blue.

## Tests

- `client/src/__tests__/phase17bRuntimeIdentityUx.test.js`
- `server/src/__tests__/phase17bServerContracts.test.js`

## Unresolved / deferred

- Visual Chrome/Edge proof of calendar icons: not claimed 10/10 (TLS/local browser).
- Live Turnstile / email / SMS delivery: not_configured; not E2E accepted.
- Phase 6 billing-page “Not configured” string mismatch is pre-existing and was not rewritten here.
- Assessments remain launch-disabled.
- Worker STOPPED; queued email is not delivered.

## Next

USER MANUAL ACCEPTANCE. Phase 18 is not started.
