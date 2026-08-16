# STRIDETO Manual-QA Auth / Profile / Registration Blocker Fix

Fix-only interruption to Phase 17D-9B. Phase 18 was not started. Wyoming pack, legal text, and committed rollout flags were not changed.

## Root causes

### A. Provider registration desktop width

`AuthCard` used a global `max-w-md` (448px). Provider registration renders two domain cards inside that card, so desktop width still looked like a narrow mobile column.

Fix: opt-in `AuthCard size="wide"` (`max-w-3xl` / `lg:max-w-4xl`) on provider registration only. Domain cards stay single-column until `lg`.

### B. Session lost on refresh (all realms)

Access tokens are in-memory only (correct). Refresh cookies are HttpOnly path-scoped cookies (correct). Persistence failed because:

1. Bootstrap and axios 401 interceptors each issued a **separate** refresh POST.
2. React StrictMode double-invokes bootstrap.
3. Refresh cookies are **single-use / rotating**. The second POST is a replay (`CONFLICT_BENIGN` / 409).
4. Frontend treated that failure as logout and cleared in-memory auth.

Fix: one in-flight refresh promise per realm, shared by bootstrap, interceptor, and visibility refresh. Bootstrap no longer clears a session if an in-memory access token already exists. Login/logout bump an epoch so stale bootstrap cannot overwrite a newer auth action.

Admin/Staff uses the User cookie (`strideto_*_rt` / `__Secure-strideto_*_rt`), not a fifth cookie.

### C. Cross-tab Usama → Arsal

User and invited member authenticate to the **same User realm and cookie name**. Ordinary tabs share that origin cookie. Two simultaneous same-realm accounts in one browser profile are not supported.

Fix: after a successful bootstrap, store only `{ realm, subjectId }` in **tab-scoped sessionStorage**. If a later `/me` resolves a different subject, the tab fails closed with a session-change screen. It does not render the new account’s data automatically.

### D. Customer header stayed logged out

Public header used `ActiveWorkspace` only. After User login, preference write raced React state: workspace validation saw `isAuthenticated=false`, cleared `strideto-active-workspace`, and kept Login/Register.

Fix: public chrome consumes canonical User auth via `resolvePublicHeaderSession`. Student session is shown from `useAuth()` when no B2B workspace is active. Hydration shows a skeleton instead of Login/Register.

### E. `/agent/profile` save 500

`PATCH /api/agent/profile` assigned client values onto Mongoose fields. `yearsOfExperience: NaN` (and similar Cast/Validation errors) had **no `err.status`**, so `errorHandler` returned 500.

Fix: coerce years/email/location; map `ValidationError` / `CastError` / `StrictModeError` to **400 Validation failed**; organization-owned fields require `PROFILE_WRITE` when membership exists.

### F. Verification draft loss

The verification form kept values in React state only. SPA navigation unmounted the page.

Fix: non-secret text/select/URL fields autosave to sessionStorage, keyed by realm + account id + provider subject type/id + form version. PII and license/tax numbers stay in memory with an unsaved-changes dialog. Successful submit and Discard clear the matching draft. Failed submit keeps it.

### G. https://localhost:8443 “Not secure”

Caddy uses `tls internal`. Leaf SAN includes `localhost`. Issuer is `Caddy Local Authority`. Windows Current User and Local Machine root stores **do not** trust `CN=Caddy Local Authority - 2026 ECC Root`.

Classification: **LOCAL CA TRUST REQUIRED — NOT APP DEFECT**. HTTPS is present. Do not switch to HTTP.

## Cookie / session findings

| Realm | Dev cookie | Path | HttpOnly | SameSite | Secure (prod) |
|---|---|---|---|---|---|
| User / Admin | `strideto_dev_rt` | `/api/auth/refresh-token` | yes | lax | yes in production (`__Secure-…`) |
| Employer | `strideto_dev_employer_rt` | `/api/auth/employer/refresh-token` | yes | lax | yes |
| Agent | `strideto_dev_agent_rt` | `/api/auth/agent/refresh-token` | yes | lax | yes |
| Institution | `strideto_dev_institution_rt` | `/api/auth/institution/refresh-token` | yes | lax | yes |

No Domain attribute. Access tokens remain in memory. Refresh tokens never enter JavaScript. `withCredentials: true` was already set on realm clients.

## Cross-tab semantics

Same-realm login in Tab B replaces the shared cookie. Tab A must not silently render Tab B’s account. Tab A shows the session-change screen on the next authoritative refresh/`me` (focus, visibility, or reload). A **new** tab opened after Tab B’s login may bootstrap as Tab B’s account.

Deliberate login in the same tab replaces the tab marker. Logout clears it.

## Parallel same-realm QA method

To test two accounts in the same auth realm at once, use separate browser profiles or InPrivate/Incognito (separate cookie jars). Examples:

- Edge normal: Usama
- Edge InPrivate: Arsal
- Chrome: customer

Ordinary same-profile tabs share one cookie session. That is expected.

## Verification draft classification

**sessionStorage (safe non-secret):** countryCode, organizationCategory, profession, credentialType, licenseIssuer, licenseJurisdiction, registrationCountry, registrationAuthority, officialWebsite, supporting/source URLs.

**Memory + unsaved warning (PII / business confidential):** legalName, displayName, officialEmail, phone, street address, registrationNumber, taxIdentifier, licenseNumber, representative name/title/email.

**Never stored:** passwords, tokens, JWT, OTP, keys, HSI, files, government credentials, passport/CNIC images.

## TLS trust — USER-run only

Do not run these as part of app deploy. Do not commit private CA keys.

1. Copy the Caddy local root (container path `/data/caddy/pki/authorities/local/root.crt`) to a temp file on Windows, e.g. `caddy-local-root.crt`.
2. Import into **Current User** Trusted Root Certification Authorities, for example:

```powershell
certutil -user -addstore Root caddy-local-root.crt
```

3. Restart the browser. Confirm `https://localhost:8443` shows as trusted.

Caddy’s `caddy trust` installs trust **inside the environment where Caddy runs**, not automatically into the Windows host store.

Leaf observed 2026-08-16: issuer `CN=Caddy Local Authority - ECC Intermediate`; SAN `localhost`; short-lived internal leaf (hours). Root: `CN=Caddy Local Authority - 2026 ECC Root`, valid through 2036.

## Files changed (this hotfix)

- `client/src/auth/refreshFlight.js` (new)
- `client/src/auth/tabIdentity.js` (new)
- `client/src/auth/publicHeaderSession.js` (new)
- `client/src/auth/verificationDraft.js` (new)
- `client/src/components/auth/SessionChangeScreen.jsx` (new)
- Realm axios clients and auth contexts
- Public header/drawer
- Agent profile service + UI
- Agent verification UI
- Provider registration `AuthCard` width
- Contract tests
- This document

Protected WIP was not staged: `AdminDataTable.jsx`, `AdminTableFilters.jsx`, `FormField.jsx`, `docker-compose.appenv-align.yml`, production acceptance report, security audit doc.

## Tests

- `client/src/__tests__/manualQaAuthSessionHotfix.test.js` (new)
- `secureAuthClientContract`, `phase17bRuntimeIdentityUx`, `phase17d0WorkspaceContext`, `phase17crAuthUi`, `phase11UiA11yInternational`
- `phase17d3rProviderUi`, `phase17d3ProviderWorkspaceUi`, `phase5AgentPortal`
- `authCookiePolicy`, `secureAuthConfig`, `agentAgencyPortal`
- `userSecureAuthFlows`, `agentSecureAuthFlows`, `employerSecureAuthFlows`, `institutionSecureAuthFlows`
- Frontend production Vite build

Browser visual matrix (320–1440, System/Light/Dark) and live multi-realm refresh clicks remain **manual** after the frontend image rebuild.

## Remaining manual checks

After `api-a` / `api-b` / `frontend` recreate:

1. Provider registration readability at 320 / 375 / 768 / 1024 / 1440 in System, Light, Dark.
2. Login → refresh ×3 → logout → refresh for User, Agent, Employer, Institution, Admin.
3. Deep-link refresh (`/agent/profile`, employer/institution/admin child routes).
4. Customer header updates immediately after login and after logout.
5. Agency and Independent profile save + refresh persistence.
6. Verification: fill safe fields, navigate away/back, refresh, submit clears draft; fill sensitive fields, leave, Stay/Discard.
7. Same-realm two-account: old tab must show the session-change screen, not a silent identity swap.
8. Confirm sessionStorage has no tokens; cookies remain HttpOnly.
