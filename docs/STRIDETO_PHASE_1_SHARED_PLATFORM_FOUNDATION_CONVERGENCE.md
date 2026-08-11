# Strideto Phase 1 — Shared Platform Foundation Convergence

> **Status:** FROZEN (Modification Phase 1)  
> **Baseline after Phase 0 lock:** `3504e6d`  
> **Authority:** [STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md](STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md)

## Summary

Phase 1 converged shared foundations that every later role portal depends on, without
redesigning role-specific UIs. Existing SEC-3 secure auth architecture, Mission 1
international contracts, UserNotification system, Commerce Money semantics, and
design-system scaffolding were reused. Gaps closed at the shared layer: client
session/UI desync for Agent and Institution, Admin permission over-bypass, notification
preference enforcement, explicit search privacy denylist, canonical semantic theme
tokens (light/dark), and Phase 1 shared platform contract modules.

---

## Reused (accepted architecture)

| Area | Reused components |
|---|---|
| Auth/session | `JwtSessionProvider`, `AuthCookiePolicy`, `RefreshSessionRotationService`, `secureAccessAuthorization`, per-realm `*SecureAuthFlows`, HttpOnly refresh cookies, in-memory access JWTs |
| RBAC/tenant | `middleware/auth.js`, `middleware/rbac.js`, server-derived `req.user` / `req.employer` / `req.agent` / `req.institution` |
| Notifications | `UserNotification` model, `notificationService.js`, Skill Trust notification bridge contracts |
| Audit | `shared/international/audit.js`, `auditService.js`, `AuditLog` model |
| Money | `shared/international/money.js`, Mission 16 commerce foundation |
| Search | `shared/search/entityTypes.js`, `SearchIndexService`, positive allowlist |
| Theme | `client/src/design-system/colors.js`, `ThemeContext`, Tailwind CSS-var mapping |
| Consent (partial) | Form consent fields, CookieConsent UI, Vault grant rules (Mission 10) |

---

## Gaps fixed (Phase 1)

### Auth / session convergence

- **Agent** and **Institution** bootstrap now mirror Employer: cookie refresh first, then `/me` — never trust cached localStorage profile alone.
- **`isAuthenticated`** contract added to Agent and Institution contexts (`!!profile && !!inMemoryAccessToken`).
- **Protected routes** gate on `isAuthenticated`, not cached profile alone.
- **Session-expired handler** (`client/src/auth/sessionExpired.js`) clears UI cache when refresh fails terminally across user/agent/institution HTTP clients.
- **Admin permissions** (`usePermissions`): SuperAdmin universal client bypass requires server-confirmed permissions fetch; unauthenticated staff cannot receive permissive nav.
- **Agent/Institution refresh 500 (runtime):** controllers called nonexistent `cookiePolicy.readRefreshCookie`. Aligned to the accepted `extractRefreshToken({ cookieHeader, realm })` contract used by User/Employer.

### Notification preferences

- `shared/platform/notificationPreferencePolicy.js` — runtime delivery evaluation.
- `notificationService.createUserNotification` respects user `notificationPreferences` for non-mandatory categories.
- `User.notificationPreferences` field added (Mixed, optional).

### Search privacy

- `shared/platform/searchPrivacyPolicy.js` — explicit denylist (vault, messages, budget, copilot, case notes, payment secrets, etc.).
- `SearchIndexService.upsertSearchDocument` fail-closed on denied domains.

### Shared contracts (new)

- `shared/platform/apiStateContract.js` — HTTP semantic states
- `shared/platform/consentContract.js` — purpose/counterparty-scoped consent
- `shared/platform/dataLifecycle.js` — archive/retention foundation
- `shared/platform/accountSecurityContract.js` — export/deletion request semantics
- `shared/platform/usageContract.js` — quota representation
- `shared/platform/organizationVerificationNotifications.js` — org verification event taxonomy

### Design / accessibility foundation

- `client/src/design-system/semanticTokens.js` — canonical light/dark semantic tokens
- `BrandProvider` applies semantic tokens on theme change
- `index.css` dark body uses semantic CSS variables

### Realm vocabulary

- `shared/international/realms.js` — Institution moved to `ACTIVE_REALMS` (live auth path)

---

## Auth / session model by realm

| Realm | Cookie path | Access token | Refresh | Staff sub-roles |
|---|---|---|---|---|
| Student/User | `/api/auth/refresh-token` | In-memory | HttpOnly cookie rotation | Admin/Moderator/Editor/SuperAdmin on `User.role` |
| Employer | `/api/auth/employer/refresh-token` | In-memory | HttpOnly | — |
| Agent | `/api/auth/agent/refresh-token` | In-memory | HttpOnly | — |
| Institution | `/api/auth/institution/refresh-token` | In-memory | HttpOnly | — |

Wrong realm → access authorization fails closed. Refresh tokens never in browser-readable storage.

---

## Executable evidence

| Suite | Result |
|---|---|
| `phase1SharedPlatformFoundation.test.js` | 53 checks passed |
| `agentSecureAuthFlows.test.js` | 3 checks passed |
| `institutionSecureAuthFlows.test.js` | 2 checks passed |
| `secureAuthClientContract.test.js` | 63 assertions passed |
| Auth regressions (user/employer/realm/rotation/access) | passed |
| Skill Trust notification reliability + QA | 49 checks passed |
| Mission 23 security matrix | passed |
| `internationalFoundation.test.js` | 13 checks passed |
| Module link integrity | clean |
| Lint (client warnings only; server clean) | clean |
| Frontend production build | passed |

---

## Real-runtime evidence

Origin: `https://localhost:8443` (Caddy + api-a/api-b + frontend rebuilt after the cookie-extract fix; Mongo/Redis volumes preserved; worker not started).

HTTP (disposable local identities; no secrets printed): 35/35 passed, unexpected 5xx = 0.

| Realm | Login | Refresh/reload cookie | Protected API/page | Logout |
|---|---|---|---|---|
| Student | 200 | 200 cookie refresh; dashboard survived bootstrap | `/api/auth/me` 200; `/dashboard` rendered | 200; subsequent refresh 401 |
| Employer | 200 | 200 | `/api/employer/me` 200; `/employer` dashboard | 200 |
| Agent | 200 | 200 (after extractRefreshToken fix) | `/api/agent/verification` 200; `/agent` + `/agent/verification` no “Invalid or expired token” | 200 |
| Institution | 200 | 200 (after extractRefreshToken fix) | `/api/auth/institution/me` 200; `/institution` dashboard | 200 |
| Staff/Admin | 200 | 200 | `GET /api/admin/permissions` 200 role=Admin server-confirmed; `/admin` “Admin panel” | 200 |

Realm isolation: Student→Agent 401 and `/agent/login`; Student→Institution 401; User→Admin HTTP 403 and UI “Insufficient permissions”; Agent→Institution 401 and `/institution/login`; Institution cookie does not keep Agent session after Agent logout.

Cookie flags (names/flags only): `__Secure-strideto_{user,employer,agent,institution}_rt` HttpOnly=true Secure=true SameSite=Lax; distinct Paths. No refresh token in JSON or localStorage/sessionStorage.

Browser viewports 320 / 768 / 1440: login and shared/auth surfaces rendered, no route error boundary, no severe overflow. Semantic tokens present (`--semantic-page-bg` / `--semantic-text-primary`).

---

## Deferred to later phases (explicit)

| Work | Phase |
|---|---|
| Admin/staff portal UI finalization | 2 |
| Student privacy/export/delete UI | 3 |
| Employer team UX | 4 |
| Agent portal visual convergence | 5 |
| Institution portal visual convergence | 6 |
| Job detail / public discovery | 7 |
| Cross-role handoff UX | 8 |
| Commerce/pricing finalization | 9 |
| Navbar label finalization, License removal, sitemap | 10 |
| Role portal responsive/a11y acceptance | 11 |
| DevOps/scalability | 12 |
| Multi-role acceptance | 13 |
| Launch certification | 14 |

---

## Findings

| Severity | Count | Notes |
|---|---|---|
| BLOCKER | 0 | — |
| P0 | 0 | — |
| P1 | 0 | — |
| MAJOR (fixed) | 3 | Agent/Institution route guard trusted localStorage; Admin SuperAdmin client bypass without server confirmation; Agent/Institution refresh called nonexistent `readRefreshCookie` (HTTP 500) |
| MINOR | 0 | — |
| INFO | 1 | Institution portal visual contrast remains for Phase 5/6 |

**Phase 1 status: FROZEN**
