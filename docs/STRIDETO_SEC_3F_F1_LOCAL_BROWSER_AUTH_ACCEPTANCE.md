# STRIDETO SEC-3F-F1 Local Browser Authentication Acceptance

## Acceptance verdict

All 24 required local browser authentication scenarios passed. No scenario failed or was blocked.

This evidence applies only to the local SEC-3F production-like Docker environment. It does not activate or verify production authentication.

## Repository checkpoint

- Acceptance base: `7945fad7861cf6da21d5150af7714bf543ee11ba`
- Base parent: `edbf499a2148bf4307eac1bdaa7fdd85300f4c26`
- Branch before this report: `main...origin/main [ahead 36]`
- Tracked tree before execution: clean
- Staged files before execution: none
- Preserved untracked reports remained untouched
- `.env.staging` remained ignored and was not read or modified

## Local environment

- Browser origin: `https://localhost:8443`
- Browser: external headless Chromium through Playwright
- Caddy health endpoint: HTTP 200
- API A health endpoint: HTTP 200
- API B health endpoint: HTTP 200
- Mailpit UI: HTTP 200
- Frontend: healthy
- API A: healthy
- API B: healthy
- MongoDB: healthy
- Redis: healthy
- Caddy: running
- Mailpit: healthy

## Safe result matrix

| Scenario | Route or boundary | Safe evidence | Result |
| --- | --- | --- | --- |
| USER-REGISTER | `POST /api/auth/register` | HTTP 201; verification required; no access or refresh token returned | PASS |
| USER-EMAIL-CAPTURE | Local Mailpit API | Exact-recipient message and verification link found | PASS |
| USER-EMAIL-VERIFY | `/api/auth/verify-email` | Normal frontend verification completed with HTTP 200 | PASS |
| USER-LOGIN | `POST /api/auth/login` | HTTP 200; access token retained only in harness memory | PASS |
| USER-NO-REFRESH-JSON | `POST /api/auth/login` | No refresh token in JSON or response headers | PASS |
| USER-COOKIE | User refresh cookie | Exact secure cookie contract confirmed | PASS |
| USER-NO-BROWSER-TOKEN-STORAGE | Browser storage | localStorage, sessionStorage and IndexedDB token-free | PASS |
| USER-RELOAD-BOOTSTRAP | `POST /api/auth/refresh-token`, `GET /api/auth/me` | HTTP 200/200; cookie-only refresh; no refresh token in request body/header or response | PASS |
| USER-LOGOUT-CURRENT | `POST /api/auth/logout` | HTTP 200; cookie cleared; refresh and reload refresh returned HTTP 401 | PASS |
| USER-OLD-ACCESS-DENIED | `GET /api/auth/me` | Pre-logout access token rejected with HTTP 401 | PASS |
| EMPLOYER-REGISTER | `POST /api/auth/employer/register` | HTTP 201; secure session issued; no refresh token returned | PASS |
| EMPLOYER-EMAIL-VERIFY-OR-NOT-REQUIRED | Current Employer contract | Email verification is not required by the current Employer registration contract | PASS |
| EMPLOYER-LOGIN | `POST /api/auth/employer/login` | HTTP 200; access token retained only in harness memory | PASS |
| EMPLOYER-NO-REFRESH-JSON | `POST /api/auth/employer/login` | No refresh token in JSON or response headers | PASS |
| EMPLOYER-COOKIE | Employer refresh cookie | Exact secure cookie contract confirmed | PASS |
| EMPLOYER-NO-BROWSER-TOKEN-STORAGE | Browser storage | localStorage, sessionStorage and IndexedDB token-free | PASS |
| EMPLOYER-RELOAD-BOOTSTRAP | `POST /api/auth/employer/refresh-token`, `GET /api/employer/me` | HTTP 200/200; cookie-only refresh; no refresh token in request body/header or response | PASS |
| EMPLOYER-LOGOUT-CURRENT | `POST /api/auth/employer/logout` | HTTP 200; cookie cleared; refresh and reload refresh returned HTTP 401 | PASS |
| EMPLOYER-OLD-ACCESS-DENIED | `GET /api/employer/me` | Pre-logout access token rejected with HTTP 401 | PASS |
| REALM-USER-TO-EMPLOYER-REFRESH | `POST /api/auth/employer/refresh-token` | User-only context returned HTTP 401 and received no Employer authority | PASS |
| REALM-EMPLOYER-TO-USER-REFRESH | `POST /api/auth/refresh-token` | Employer-only context returned HTTP 401 and received no User authority | PASS |
| REALM-COOKIE-ISOLATION | Isolated browser contexts | User context contained no Employer cookie; Employer context contained no User cookie | PASS |
| REALM-LOGOUT-ISOLATION | User logout with both realm cookies present | User cookie cleared; Employer cookie remained; current Employer returned HTTP 200 | PASS |
| TRUSTED-ORIGIN-NEGATIVE | Null-origin `POST /api/auth/refresh-token` | HTTP 403; no realm cookie or session created | PASS |

## Verification-email evidence

- A new unique local User was registered through the normal browser-origin endpoint.
- Mailpit captured exactly the message addressed to that generated identity.
- A verification link targeting the configured local Strideto origin was detected.
- The link was opened in the same isolated browser context.
- The normal application verification route returned HTTP 200.
- The email body, verification URL and verification token were never printed or persisted by the harness.
- Test identities are redacted from this report.

## Cookie evidence

### User realm

- Name: `__Secure-strideto_user_rt`
- HttpOnly: true
- Secure: true
- SameSite: Lax
- Host-only: true
- Path: `/api/auth/refresh-token`
- Employer cookie absent from the User-only context

### Employer realm

- Name: `__Secure-strideto_employer_rt`
- HttpOnly: true
- Secure: true
- SameSite: Lax
- Host-only: true
- Path: `/api/auth/employer/refresh-token`
- User cookie absent from the Employer-only context

Cookie values were completely redacted and never printed.

## Browser storage evidence

- User localStorage contained no access token, refresh token or known legacy authentication-token key.
- User sessionStorage contained no access or refresh token.
- User IndexedDB database and store names contained no authentication-token persistence boundary.
- Employer localStorage contained no access token, refresh token or known legacy authentication-token key.
- Employer sessionStorage contained no access or refresh token.
- Employer IndexedDB database and store names contained no authentication-token persistence boundary.
- Non-authoritative profile caches were not treated as authentication authority.

## Reload and bootstrap evidence

- The real User frontend bootstrap performed cookie-based refresh after reload.
- The User refresh request contained no refresh token in its body and no `x-refresh-token` header.
- The User refresh response contained no refresh token.
- The current-User request returned HTTP 200.
- The real Employer frontend bootstrap performed cookie-based refresh after reload.
- The Employer refresh request contained no refresh token in its body and no `x-refresh-token` header.
- The Employer refresh response contained no refresh token.
- The current-Employer request returned HTTP 200.
- Browser storage remained token-free after both bootstrap flows.

## Logout and isolation evidence

- User logout-current cleared only the User refresh cookie.
- Employer logout-current cleared only the Employer refresh cookie.
- Refresh failed with HTTP 401 after each logout.
- Reload did not restore either logged-out session.
- Each access token presented to its logout-current route was rejected afterward with HTTP 401.
- Cross-realm refresh attempts returned HTTP 401 and created no authority in the other realm.
- With both cookies present, User logout preserved the Employer cookie and current-Employer access remained HTTP 200.
- Logout-all was not invoked.

## Trusted-origin evidence

- A null-origin browser page submitted a request to the protected User refresh route.
- The route returned HTTP 403.
- No User or Employer refresh cookie was created.
- No session or account mutation was observed.
- No trusted `Origin` header was spoofed.

## Preservation and limitations

- Application source and configuration were not modified.
- `.env.staging` was not modified.
- MongoDB documents were not modified manually.
- Email verification was not bypassed.
- No HAR file or persistent browser profile was created.
- The temporary external Playwright harness was deleted after execution.
- The local Docker stack, Mailpit and Docker volumes remain running for the next phase.
- Production Redis verification remains deferred to an authorized production operator.
- Production authentication was not activated or changed.
- SEC-3F-F2 concurrency, replay, cross-instance logout and restart acceptance remains pending.
- SEC-3F-F3 outage and account-state testing remains pending.
- SEC-3G remains blocked until the remaining SEC-3F acceptance phases complete.
- No push or deployment occurred.
