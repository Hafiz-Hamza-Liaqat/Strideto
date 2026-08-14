# STRIDETO PHASE 17D-0 DASHBOARD IDENTITY SEPARATION COMPLETE

This is **not** Phase 18. Global Business Services was **not** implemented. Nothing was pushed or deployed.

---

## Baseline

- Starting HEAD: `7fc9a4ba25a31b75083fef2a2a4b56161ec5b558`
- Branch: `main`
- WIP isolation: path-scoped stash `phase17d0-isolate-known-wip` (never `git stash -u`)
  - `client/src/components/admin/AdminDataTable.jsx`
  - `client/src/components/admin/AdminTableFilters.jsx`
  - `client/src/components/common/FormField.jsx` (not edited)
- Older stash left untouched: `wip: AdminTableFilters values wiring (pre-phase-10)`
- Worker: **STOPPED** (`edurozgaar-staging-worker-1` Exited 0) before and after rebuild

Protected/local-only files were never staged:

- `docker-compose.appenv-align.yml`
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

---

## Root Cause

Prior public identity limitation:

- A. Each realm already stores hydrated identity in its own React context plus an in-memory access token. Refresh cookies remain HttpOnly and path-scoped.
- B. Public `UserAccountMenu` checked **Student** (`useAuth` + `useUserNavbarSession`) as the primary account chrome. Employer was a secondary add-on. Agent and Institution were invisible on `/`.
- C. Employer/Agent/Institution PortalBrand already linked to `/` without logout, so the portal session survived SPA navigation — only the **public UI** forgot which workspace was active.
- D. Navigation to `/` did not clear cookies. After a full refresh on `/`, B2B contexts skipped bootstrap (`employerRouteActive` / agent / institution route flags are false on public paths), so in-memory tokens were gone even though refresh cookies remained.
- E. Account/avatar chrome assumed a Student `User` (name/email, My Workspace → `/dashboard`).
- F. Calling all four `/me` endpoints on every pathname would reintroduce the Phase 17C shell flicker. 17D-0 validates **only the preferred realm**.
- G. Cookie paths are unchanged: `/api/auth/refresh-token`, `/api/auth/employer/refresh-token`, `/api/auth/agent/refresh-token`, `/api/auth/institution/refresh-token`.
- H. Multiple realm sessions may validly coexist because cookies are distinct.
- I. Public chrome silently preferred Student whenever a Student session existed on a public path.
- J. Pathname-driven `setLoading(true)` was the historical flicker. Active workspace hydration is **not** keyed on pathname and does **not** wrap `MainLayout`.

---

## Architecture

Shared public platform + separate role workspaces.

- Preference: `strideto-active-workspace` = `student | employer | agent | institution` in `localStorage`.
- Preference is **not** security authority. Authenticated UI requires that realm's in-memory access token plus authoritative `/me` (or equivalent).
- `ActiveWorkspaceProvider` reads the preference once per preference change (not per pathname), reuses live hydrated state when present, otherwise calls only that realm's `ensureSession()` (refresh + `/me`).
- Invalid/expired preference is cleared; public chrome becomes guest. Other realm cookies are not auto-selected.
- Multi-realm discovery runs only when the user opens **Switch workspace**. Expected 401s are silent. Results are cached for the UI session and cleared on logout.
- Admin/staff is not part of public workspace switching. No impersonation. No `/universal-dashboard`. No universal token.
- Future Business Services remain an Agent capability, not a new auth realm.

Backend: no universal `/me`. Institution `/me` now includes public-safe `organizationName` (from `Organization.displayName` / `legalName`) so the public shell can label the institution without showing Mongo IDs. Cookie paths and principals are unchanged.

---

## Student

- Public account shows Student name + role badge after Student login / Student workspace logo → `/`.
- Open workspace → `/dashboard`.
- Refresh on `/` restores Student after AuthContext's existing public bootstrap validates the session.
- Logout from the public menu logs out **only** Student, returns guest, does not auto-switch to a B2B session.

## Employer

- Login/register with a session writes `employer` preference.
- PortalBrand → `/` writes `employer` preference; session is not cleared.
- Public account shows organization name + Employer role (Verified Employer only when `employer.verified === true` or `verificationStatus === 'approved'`).
- Open Employer Workspace → `/employer`.
- Refresh on `/` calls Employer `ensureSession()` (refresh cookie + `/me`) without mounting the Employer dashboard.
- Logout of Employer on the public site returns guest.

## Agent

Same contract. Role badge is Agent or Agency from `agentType`. Verified Agent only when `profileStatus === 'approved'` (not completeness). Open workspace → `/agent`.

## Institution

Same contract. Public display uses `organizationName` from `/me`, never `organizationId`. Open workspace → `/institution`. Verified Institution is **not** shown unless a server-derived flag already exists on the public identity payload (it does not today; completeness is not used).

---

## Multi-Realm

- Simultaneous Student + Employer (and other pairs) remain possible under existing cookie isolation.
- Public chrome shows **only** the preferred validated realm.
- Switch workspace lists only confirmed sessions.
- Choosing another workspace updates the preference and navigates to **that** workspace. Tokens are not exchanged.
- Expired selected realm → that realm's sign-in route. No silent session creation.
- After logout of the active realm, public context stays **guest**. The other session remains until explicitly selected.

Wrong-realm denial (UI + existing API boundary):

- Employer/Agent/Institution on `/jobs` cannot Apply / Save as Student / track as Student. Copy: “A Student account is required for this action.” + Sign in as Student.
- Public identity context does not attach another realm's bearer token to Student write APIs.

---

## Navbar

- Guest: existing login/register/employer login.
- Authenticated: compact desktop trigger `[avatar] display name / role`; mobile remains icon-based with an accessible name including name + role.
- Dropdown: Signed in as, role badge, Open workspace, account/settings, notifications, help, Appearance (System/Light/Dark), Language, Logout (sticky footer).
- Light/Dark: public trigger is light-on-navy; dropdown uses theme surfaces (`bg-white` / `dark:bg-gray-800`).
- Accessibility: `aria-label`, `aria-expanded`, `aria-haspopup="dialog"`, Escape/outside click via `useOverlayA11y`, wrapping names, viewport-contained panel.

## PortalBrand

- Employer / Agent / Institution logo → `/` with the matching preference.
- No logout, no new window, no secret query parameters, SPA `Link`.

## Flicker

- `MainLayout` is not gated on workspace hydration. Navbar/Footer stay mounted.
- Hydration effect does not subscribe to `pathname`.
- Account area may show a small skeleton while the preferred realm validates.
- Public `/` → `/jobs` → `/scholarships` → `/` does not remount the public shell for identity reasons.
- Portal → public does not flash Student dashboard.

Browser visual flicker matrix: **NOT PROVEN** in the automation browser (TLS). See Browser Engineering Evidence.

---

## Security

- Realm refresh cookies unchanged (names and paths).
- No refresh token in JS, localStorage, or sessionStorage.
- Preference stores only a realm slug.
- Public identity omits raw user/org/session IDs, JWTs, Vault, payments, verification evidence.
- Institution `/me` still returns membership `organizationId` for the existing portal (pre-existing); the public account menu does not render it.
- RBAC / realm API clients unchanged. One realm's cookie cannot authorize another realm's APIs.

---

## Regression

| Area | Result |
| --- | --- |
| Phase 17C-VR verify-email | 36 passed |
| Phase 17C-VR phone | 51 passed |
| Phase 17C-V nav/theme | 20 passed |
| Phase 17C-V international inputs | 60 passed |
| Phase 17C-R auth UI | 57 passed |
| Phase 17C identity client | 18 passed |
| Secure auth client | 63 passed |
| Phase 11 navbar/account | 85 passed |
| Navbar hierarchy | passed |
| User / employer / agent / institution secure auth flows | 58 / 39 / 3 / 2 passed |
| Phase 17C / 17C-R identity + 17C-VR residual authority | 58 / 39 / 15 passed |

Verify-email first-navigation lifecycle was not modified. Phone inputs were not modified.

---

## Runtime

| Container | State |
| --- | --- |
| edurozgaar-staging-frontend-1 | healthy |
| edurozgaar-staging-api-a | healthy |
| edurozgaar-staging-api-b | healthy |
| edurozgaar-staging-mongodb-1 | healthy |
| edurozgaar-staging-redis-1 | healthy |
| edurozgaar-staging-mailpit-1 | healthy |
| edurozgaar-sec3f-local-caddy | running |
| edurozgaar-staging-worker-1 | **STOPPED** (Exited 0) |

- `GET /api/health` → **200**
- `GET /api/health/ready` → **200**
- Unexpected 5xx in this check: **none**
- Queue may remain pending (`queued_worker_stopped`); worker was not started
- Volumes preserved (no `down`, no `-v`, no prune)

Rebuild (frontend + api-a + api-b only):

```
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  -f docker-compose.appenv-align.yml -f docker-compose.sec3f-local.yml \
  --env-file .env.staging build frontend api-a api-b

docker compose … up -d --no-deps --force-recreate frontend api-a api-b
```

---

## Responsive

Automation browser against `https://localhost:8443` returned `chrome-error://chromewebdata/` (local TLS certificate not trusted by the automation browser). Application TLS was **not** weakened.

| Viewport | Result |
| --- | --- |
| 320 | NOT PROVEN |
| 375 | NOT PROVEN |
| 768 | NOT PROVEN |
| 1024 | NOT PROVEN |
| 1440 | NOT PROVEN |
| 200% | NOT PROVEN |
| Light | NOT PROVEN |
| Dark | NOT PROVEN |

Source contracts cover viewport-contained menu, wrapping names, light-on-navy trigger, and theme-correct dropdown surfaces. **USER MANUAL ACCEPTANCE** remains required for visual/responsive proof.

---

## Tests

| Suite | Result |
| --- | --- |
| phase17d0WorkspaceContext.test.js | 73 passed |
| phase17cvrVerifyEmail.test.js | 36 passed |
| phase17cvrPhoneContract.test.js | 51 passed |
| phase17crAuthUi.test.js | 57 passed |
| phase17cvInternationalInputs.test.js | 60 passed |
| phase17cvThemeNavPortals.test.js | 20 passed |
| phase17cIdentityClient.test.js | 18 passed |
| secureAuthClientContract.test.js | 63 passed |
| phase11UiA11yInternational.test.js | 85 passed |
| applicationTrackerCompletion.test.js | 27 passed |
| navbarHierarchy.test.js | passed |
| phase17cvrResidualAuthority.test.js | 15 passed |
| phase17crIdentity.test.js | 39 passed |
| phase17cIdentity.test.js | 58 passed |
| userSecureAuthFlows.test.js | 58 passed |
| employerSecureAuthFlows.test.js | 39 passed |
| agentSecureAuthFlows.test.js | 3 passed |
| institutionSecureAuthFlows.test.js | 2 passed |
| module graph (`scripts/verify-module-link-integrity.mjs`) | ok (1757 modules) |
| touched-file lint | 0 errors (pre-existing react-refresh warnings only) |
| frontend production build | success |

---

## Browser Engineering Evidence

Cursor browser against `https://localhost:8443` returned `chrome-error://chromewebdata/`. Same residual as Phase 17C-VR. TLS was not weakened.

Flicker / role-badge visual proof: **NOT PROVEN** in automation. Source contracts + hydration-not-on-pathname are the engineering evidence for no shell remount.

---

## Actual Findings

**BLOCKER:** none

**P0:** none

**P1:** none

**P2:** none

**MAJOR:** none

**MINOR:** none

**INFO:**

- Institution `/me` now includes `organizationName` for public-shell labeling. Membership `organizationId` remains in the portal `/me` payload (pre-existing) and is not shown in the public account menu.
- Student AuthContext still bootstraps on public paths (pre-existing Phase 17C behavior). 17D-0 does not add Employer/Agent/Institution `/me` on ordinary public navigation unless that realm is the stored preference.
- Automation browser cannot complete the visual/responsive matrix because of untrusted local TLS.

---

## Unresolved

- USER MANUAL ACCEPTANCE of dashboard identity separation (all four realms, multi-realm switch, refresh on `/`, logo → `/`, logout → guest).
- Outstanding 17C-VR residual manual acceptance (verify-email no-refresh; phone digits-only).
- Visual/responsive matrix at 320–1440 / 200% / Light / Dark in a browser that trusts the local TLS certificate.

---

## Commits

- `fb86755` feat(platform): add role-aware public workspace context
- `63e3692` fix(portals): preserve workspace identity across public navigation
- docs commit on `main` immediately following those two (see `git log -3`)

## Known WIP

- `AdminDataTable.jsx`
- `AdminTableFilters.jsx`
- `FormField.jsx`

## Protected/local-only

- `docker-compose.appenv-align.yml`
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

## Worker

STOPPED

## Push

NO

## Deployment

NO

## Phase 18

NOT STARTED

## Global Business Services

NOT IMPLEMENTED

---

## NEXT

USER MANUAL ACCEPTANCE OF DASHBOARD SEPARATION +
OUTSTANDING 17C-VR RESIDUAL ACCEPTANCE.

After USER explicitly accepts 17D-0, the next possible step is:

**STRIDETO PHASE 17D-A — GLOBAL BUSINESS SERVICES ARCHITECTURE & GAP AUDIT**

REPORT ONLY. NO IMPLEMENTATION.

STOP.
