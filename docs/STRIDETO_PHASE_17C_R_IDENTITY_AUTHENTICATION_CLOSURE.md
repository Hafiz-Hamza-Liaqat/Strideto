# STRIDETO PHASE 17C-R — IDENTITY & AUTHENTICATION CLOSURE

**Mode:** IMPLEMENTATION + FOCUSED ACCEPTANCE  
**Date:** 2026-08-13  
**Starting HEAD:** `ebf80648ae75441dbc1bb97eb0c0e67c8c8c15a9`  
**Branch:** `main`  
**Phase 18:** NOT STARTED  
**Push:** NO  
**Deployment:** NO  
**Certification:** NOT RUN  
**Worker:** STOPPED  

This is not a 10/10 claim and not user manual acceptance.

---

## 0. Baseline

- Expected HEAD matched `ebf8064`.
- Known tracked WIP isolated with path-scoped stash `stash@{0}` (`phase17cr-isolate-known-wip`):
  - `client/src/components/admin/AdminDataTable.jsx`
  - `client/src/components/admin/AdminTableFilters.jsx`
  - `client/src/components/common/FormField.jsx`
- Older stash left untouched: `stash@{1}` `wip: AdminTableFilters values wiring (pre-phase-10)`.
- Protected/local-only untracked files were never stashed or committed:
  - `docker-compose.appenv-align.yml`
  - `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
  - `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- `git stash -u` was not used.

---

## Root causes

1. **Inconsistent verification delivery.** Sensitive templates (`emailVerification`, `passwordReset`, `staffInvitation`) already send in-process via SMTP/Mailpit. B2B register/forgot still gated on `authDeliveryMode()`, which required a worker heartbeat plus `EMAIL_DELIVERY_ENABLED=1`. The first Employer mail succeeded during a leftover heartbeat window; later registrations created accounts, showed “Check your email”, and skipped SMTP. Student already used `isSmtpConfigured()` only.
2. **Auth shell inconsistency.** Employer/Agent/Institution pages used detached `min-h-screen` cards (hardcoded light colors / extra Logo / nested `<main>`). Hiding public chrome on auth remounted Navbar/Footer when opening Terms/Privacy.
3. **Duplicate password eye.** Native Edge/WebKit reveal plus `PasswordInput` produced two controls; Employer login used a dark-on-light field.
4. **Raw email in verify URLs.** Pending flow put `email=` in the query string.
5. **Unverified same-realm re-register** did not safely reissue a cooldown-bounded challenge.

---

## What changed

### Delivery truth

- `sensitiveTransactionalDeliveryMode()` = SMTP configured → `accepted`, else `unavailable`.
- Worker heartbeat is no longer required for verification or password-reset mail.
- Public copy never says a message was sent when the delivery boundary is down.
- Environment-truthful `emailMode` is identical for new and existing addresses (non-enumeration).
- Internal outcomes are logged as `realm` / `accountId` / `outcome` / `delivery` only. No passwords, raw tokens, or cookies.

### Four-realm verification

- Hashed, random, 30-minute, single-use, realm-scoped link.
- Fresh unique email creates one account (`emailVerified=false`) and one active hashed challenge.
- Existing unverified same-realm: no duplicate account; reissue after 60s cooldown (one active token).
- Existing verified same-realm: no duplicate; generic 201.
- Consume clears the challenge. Replay and wrong-realm use fail closed.
- Resend uses the same cooldown path for Student and B2B.
- Pending URL is `/auth/verify-email?pending=1&realm=…` with no email. Tokens are captured in memory and stripped from the address bar.

### Recovery

- Student mutation-truth (`PASSWORD_RESET`) remains.
- All four public realms use the SMTP transactional gate and generic recovery copy.
- Reset tokens are hashed, expiring, single-use, and stripped from the URL after capture.
- Admin public self-service recovery was not added.

### Auth UX

- Public Navbar/Footer stay mounted on auth; Student portal nav and Admin chrome stay hidden.
- Shared `AuthCard` on login/register/forgot/reset/verify for all four realms.
- Terms/Privacy are same-tab SPA links. Non-sensitive register drafts persist in `sessionStorage` (never password/token/Turnstile).
- One accessible password reveal; native reveal suppressed.
- Turnstile OFF/NOT_CONFIGURED renders nothing (no “not configured in this environment”).
- Employer optional phone uses `PhoneInput` → E.164. Agent/Institution phone stays on profile (no duplicate register field). Phone OTP remains NOT_CONFIGURED.

### Session / first-use

- Access 15 minutes + 7-day HttpOnly refresh unchanged.
- B2B quiet refresh on focus/visibility does not clear a hydrated session.
- Concurrent 401s still share one `refreshPromise`.
- Agent/Institution now expose `logoutAll` through existing APIs.
- Existing portal welcome / welcome-back once-state is unchanged. No fake welcome email is claimed. Student verify may still *queue* a non-sensitive welcome job; it does not send while the worker is stopped.

---

## Runtime (local Docker)

Rebuilt **only** `frontend`, `api-a`, `api-b`. Volumes preserved. Worker not started.

| Service | Status |
|---|---|
| frontend | healthy |
| api-a | healthy |
| api-b | healthy |
| mongodb | healthy (Up 26h, not recreated) |
| redis | healthy (Up 26h, not recreated) |
| mailpit | healthy (Up 26h, not recreated) |
| Caddy | running |
| worker | STOPPED (`Exited (0) 9 days ago`) |

`GET /api/health` → 200, `smtp: configured`, `workerRunning: false`, `effectiveState: queued_worker_stopped`.  
`GET /api/health/ready` → 200. No unexpected 5xx on these probes.

Local overlay still forces `appEnv: production` on ready. Residual, not introduced here.

---

## Four-realm Mailpit acceptance

Disposable addresses `qa17cr-<realm>-<stamp>@strideto.test`. Worker stayed stopped. Accounts deleted after the run.

| Realm | Register | Challenge + Mailpit | Branding | First verify | Replay | Wrong realm | Verdict |
|---|---|---|---|---|---|---|---|
| Student | 201 `accepted` | 1 message | Strideto | 200 | 400 | 400 | **PASS** |
| Employer | 201 `accepted` | 1 message | Strideto | 200 | 400 | 400 | **PASS** |
| Agent | 201 `accepted` | 1 message | Strideto | 200 | 400 | 400 | **PASS** |
| Institution | 201 `accepted` | 1 message | Strideto | 200 | 400 | 400 | **PASS** |

Student forgot-password on a separate disposable address: 200 `accepted`, Mailpit then had verification + reset (2 messages). Account deleted.

B2B register requires a trusted Origin (`https://localhost:8443` locally). A first probe with `http://localhost:5173` correctly returned `403 origin_validation_failed` and created no B2B accounts.

---

## Tests

| File | Assertions |
|---|---|
| `phase17crIdentity.test.js` | 39 |
| `phase17crAuthUi.test.js` | 57 |
| `phase17cIdentity.test.js` | 58 |
| `phase17cIdentityClient.test.js` | 18 |
| `phase17cPlatformClient.test.js` | 24 |
| `phase17cPlatform.test.js` | 21 |
| `phase17cAuthority.test.js` | 32 |
| `phase17cEmployerAdmin.test.js` | 19 |
| `phase17cWorkflows.test.js` | 15 |
| `userSecureAuthFlows.test.js` | 58 |
| `phase17bServerContracts.test.js` | 14 |
| `employerSecureAuthFlows.test.js` | 39 |
| `agentSecureAuthFlows.test.js` | 3 |
| `institutionSecureAuthFlows.test.js` | 2 |
| `secureAuthClientContract.test.js` | 63 |
| `phase17bRuntimeIdentityUx.test.js` | 33 |

**Focused 17C-R new:** 96. **Related 17C + secure-auth rerun:** 399. All passed.

- Module graph (`madge --circular` on touched auth modules): 3 **pre-existing** cycles (`AuthContext`/`usePermissions`; `jobQueueService`/`WorkflowService`). None added by 17C-R.
- Lint (touched scope): server 0 issues; client 0 errors / 8 pre-existing warnings.
- Frontend production build: **PASS** (32.16s).

---

## Findings

### BLOCKER

None observed on the scoped auth/delivery paths after the SMTP-gate fix.

### P0

None remaining on four-realm verification delivery with worker stopped.

### P1

None newly opened by this phase.

### P2 / MAJOR

None newly opened.

### MINOR

- Local `APP_ENV` overlay still reports `appEnv: production` on `/api/health/ready`.
- Welcome email remains worker-queued (not launch-critical; not claimed in UI).
- Agent/Institution phone is profile/onboarding-only; adding it at register would invent a second field.

### INFO

- Phone OTP, SMS, WhatsApp, live OAuth, Stripe, AI, payouts, scraping: OFF / NOT_CONFIGURED.
- Turnstile: NOT_CONFIGURED locally; server fail-closed contract remains when enabled.
- Pre-existing madge cycles and large vendor chunks unchanged.
- Session continuity was proven by contract + quiet-refresh wiring, not a literal 3-hour wait.
- This is Cursor engineering evidence only.

---

## Ratings (honest, not 10/10)

**Security:** Authentication 8.5 · Recovery 8.5 · Session 8 · Registration privacy 8.5 · Token safety 8.5 · RBAC/realm isolation 8 · **overall 8.5**

**Functionality:** Student 8.5 · Employer 8.5 · Agent 8.5 · Institution 8.5 · Auth UX 8 · email delivery 8.5 · **overall 8.5**

---

## Unresolved (explicit)

- USER MANUAL ACCEPTANCE of authentication and the remaining platform.
- Welcome/queued mail still depends on the worker (57 queued email jobs already present before this phase).
- Phone OTP / Turnstile production enablement remain out of scope.
- `xlsx` 0.18.5 / `jspdf` 2.5.1 deferred (unchanged).
- Phase 18 / certification / push / deploy not started.

---

## Commits

1. `088a464` fix(identity): restore reliable four-realm verification and recovery delivery
2. `6c874ea` fix(auth-ui): unify public authentication shell and controls
3. `fbe12c5` fix(session): keep quiet refresh from clearing valid B2B sessions
4. *(this document)* docs(release): record phase 17c-r identity closure

**MANDATORY NEXT:** USER MANUAL ACCEPTANCE OF AUTHENTICATION AND THE REMAINING PLATFORM.
