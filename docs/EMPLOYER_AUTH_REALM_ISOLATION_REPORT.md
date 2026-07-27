# Phase E.1F-B — Employer Auth Realm Isolation Report

**Date:** 2026-07-27  
**Scope:** User vs employer authentication boundaries and employer-route 401 cleanup only.

---

## Confirmed route truth

| Item | Value |
|------|--------|
| Employer dashboard (UI) | `/employer` — `index: true` → `EmployerDashboard` |
| `/employer/dashboard` | **Does not exist** in the router |
| Employer login / register | `/employer/login`, `/employer/register` (MainLayout + public Navbar) |
| Public employer profile | `/employer/:slug` (MainLayout, not portal shell) |

No new routes were added to match documentation.

---

## Exact 401 initiators (repository)

| Endpoint | Initiator | Runs on employer routes? | Fix |
|----------|-----------|--------------------------|-----|
| `GET /auth/me` | `AuthContext` mount `useEffect` → `authApi.me()` | **Was yes** on all routes when user token present | **Gated** — skip on employer portal + employer login/register |
| `POST /auth/refresh-token` | `axiosBase.js` response interceptor on user 401 | When any user axios call 401s | **Reduced** — no `/auth/me` on employer paths; optional `/feedback` retry without refresh |
| `GET /talent/me/summary` | `UserAccountMenu` `useEffect` | **Was yes** on employer login when `isAuthenticated` from stale storage | **Gated** via `useUserNavbarSession` |
| `GET /inbox/notifications/unread-count` | `NotificationBell` → `inboxApi.unreadCount()` | **Was yes** on employer auth pages | **Gated** — bell hidden + no polling |
| `GET /api/notifications/unread-count` | **Not in this repo** | Production path may differ | Canonical client path: **`/inbox/notifications/unread-count`** |
| `GET /api/config/feature-flags` | **Not in this client repo** | N/A | Flags are **Vite env** via `client/src/config/careerFeatureFlags.js`; no runtime fetch. Production 401 likely legacy bundle or another service — not changed here |

### Other user calls (not gated; not mounted on employer portal shell)

- `OnboardingProvider` → `authApi.updateProfile` — **skipped** on employer portal/auth paths
- `FeedbackWidget` → `POST /feedback` with `optionalAuth` on server — **anonymous retry** on 401 without refresh loop

---

## Token separation

| Realm | Access token key | Refresh key | HTTP client |
|-------|------------------|-------------|-------------|
| Normal user | `edurozgaar-token` | `edurozgaar-refresh-token` | `axiosInstance` (`axiosBase.js`) |
| Employer | `edurozgaar-employer-token` | `edurozgaar-employer-refresh-token` | `employerAxios` (`employerService.js`) |

- User refresh/clear **does not** remove employer keys (unchanged).
- Employer refresh/clear **does not** remove user keys (unchanged).
- `AuthContext.clearAuth()` only clears user storage.

---

## Requests gated

1. **`/auth/me`** — not called while `pathname` is employer portal or employer login/register.
2. **Talent summary** — not called when `shouldEnableUserNavbarSession` is false.
3. **Inbox unread + list** — `NotificationBell` not rendered and `load()` no-ops on employer routes.
4. **Onboarding auto-start** — no tour/profile persistence on employer portal/auth paths.
5. **`POST /feedback`** — on 401, strips `Authorization` and retries once (no refresh-token loop).

### Permitted exceptions (documented)

- Navigating from employer auth pages to the **main site** re-enables user bootstrap when `pathname` leaves employer auth/portal paths (effect re-runs `/auth/me` if user token exists).
- **Mixed sessions:** user and employer tokens may coexist in `localStorage`; employer portal does not validate user session until user visits non-employer routes.

---

## Feature flags decision

**No server `/config/feature-flags` call in current client.** Career and employer intelligence toggles read `import.meta.env.VITE_*` in `careerFeatureFlags.js`. No backend contract change required for E.1F-B.

---

## Notification decision

**No employer notification API exists** in the repository. **User `NotificationBell` is disabled** on employer portal and employer login/register paths. Future employer inbox would be a separate slice.

---

## Feedback widget (employer routes)

- Mounted from `EmployerLayout`; does not fetch on mount.
- Submit uses `POST /feedback` (server `optionalAuth`).
- Stale user token no longer triggers refresh loop (optional-auth retry).

---

## Tests

| Test file | Coverage |
|-----------|----------|
| `server/src/__tests__/authRealm.test.js` | Portal vs public slug vs auth paths; skip bootstrap; navbar session |
| `server/src/__tests__/employerAuthRealmIsolation.test.js` | User clear vs employer tokens; employer logout vs user tokens |

Run:

```bash
node server/src/__tests__/authRealm.test.js
node server/src/__tests__/employerAuthRealmIsolation.test.js
```

---

## Browser verification (local smoke checklist)

After `npm run dev` in `client/`, with **employer-only** session (no valid user token):

| URL | Expected console |
|-----|------------------|
| `/employer/login` | No `/auth/me`, no `/talent/me/summary`, no `/inbox/notifications/unread-count` |
| `/employer/register` | Same |
| `/employer`, `/employer/jobs`, `/employer/jobs/new`, `/employer/applications` | Same; employer `GET /employer/me` only |

With **stale user token** + **valid employer session**:

- No user refresh loop on employer routes.
- Employer session remains after simulated user refresh failure (token isolation test).

*(Automated browser pass not run in CI for this slice; manual DevTools Network filter recommended.)*

---

## Files changed

| File | Change |
|------|--------|
| `client/src/auth/authRealm.js` | **New** — path classification and gating helpers |
| `client/src/hooks/useUserNavbarSession.js` | **New** — route-aware navbar user session |
| `client/src/context/AuthContext.jsx` | Skip `/auth/me` on employer paths; re-bootstrap on leave |
| `client/src/services/axiosBase.js` | Optional-auth `/feedback` without refresh |
| `client/src/components/notifications/NotificationBell.jsx` | Gate polling/render |
| `client/src/components/layout/UserAccountMenu.jsx` | Gate talent summary + logged-in menu |
| `client/src/onboarding/OnboardingProvider.jsx` | Skip auto onboarding on employer paths |
| `client/src/context/NotificationContext.jsx` | Skip FCM register on employer paths |
| `server/src/__tests__/authRealm.test.js` | **New** |
| `server/src/__tests__/employerAuthRealmIsolation.test.js` | **New** |
| `docs/EMPLOYER_PORTAL_NAVBAR_AND_SOCIAL_AUDIT.md` | Route truth table |
| `docs/EMPLOYER_AUTH_REALM_ISOLATION_REPORT.md` | This report |

---

## Remaining employer gaps (out of scope E.1F-B)

- Navbar overflow (E.1F-A)
- Post New Job contrast (E.1F-C)
- Application model / external apply (E.1F-D)
- Dashboard/settings/analytics completeness (E.1F-E)
- Social links (E.1F-F)
- `/employer/dashboard` URL alias (not added — use `/employer`)
- Employer-specific notifications product/API

---

## Final verdict

```
READY FOR EMPLOYER FORM IMPLEMENTATION
```

Auth realm isolation for employer routes is implemented and tested at the path/token layer; form work (E.1F-C) is unblocked.

*No commit, push, deploy, or production data changes.*
