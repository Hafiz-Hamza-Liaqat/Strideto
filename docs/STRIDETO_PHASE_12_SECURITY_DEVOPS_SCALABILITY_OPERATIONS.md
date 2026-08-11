# Strideto Phase 12 — Security / DevOps / Scalability / Operations

> **Status:** FROZEN  
> **Date:** 2026-08-12  
> **Baseline HEAD before this freeze:** `dbf5b58` (Phase 11)  
> **Runtime:** `https://localhost:8443` (SEC-3F local Caddy + staging compose)  
> **Authority:** Phases 0–11 remain FROZEN. This phase does not redesign product workflows, activate live Stripe/email, deploy, or issue a GO verdict.

## Scope

Phase 12 owns final platform hardening: auth/session attack acceptance, cookies, CORS/CSRF/origin, security headers, XSS/injection, IDOR, SSRF/URL/open-redirect/path safety, uploads, request bounds, rate limiting, logging privacy, secrets, health/readiness, Redis, worker/email/storage readiness without enabling real delivery, Mongo indexes, bounded load, observability, backup/restore, rollback, Docker recovery, CI equivalence, and production error mode.

It does **not** own new features, role-portal redesign, live providers, production deployment, or Mission 27 certification.

## Safety

No push. No deployment. Worker remained STOPPED (`sec3f-worker-disabled` profile). Protected volumes were not deleted or restored into:

- `edurozgaar-staging_mongodb_data`
- `edurozgaar-staging_redis_data`
- `edurozgaar-staging_media_uploads`

Protected/local-only untracked files were not touched. Pre-existing AdminTableFilters WIP was path-stash isolated and restored unstaged after freeze.

---

## 1. Auth / session attack matrix

Canonical architecture preserved: 15-minute in-memory access JWTs, 7-day HttpOnly refresh cookies (`RefreshSession` + rotation), `JWT_SECRET` ≠ `REFRESH_SECRET`, Redis required in production for the access-token denylist. Tokens are **not** stored in `localStorage`/`sessionStorage`.

| Case | Result |
|---|---|
| Invalid JWT | Runtime `GET /api/auth/me` → **401** `Invalid or expired token` |
| Missing refresh cookie | Runtime `POST /api/auth/refresh-token` → **401** `Refresh token invalid, expired, or revoked` |
| Malformed Authorization | Fail closed (401) |
| Wrong / missing Origin on credentialed write | `origin_validation_failed` **403** |
| Realm isolation | Mission 23 + employer/agent/institution auth suites |
| Refresh rotation / replay / concurrent refresh | Existing `authCookiePolicy` + refresh-session CAS tests |
| Logout / logout-all | Existing secure-auth flows; cookie clear on invalid refresh |
| Suspended / tokenVersion / wrong realm | Existing Phase 1 / Mission 23 suites |

No refresh loop. No unexpected 5xx in the runtime matrix. No secret leakage in bodies.

## 2. Cookie / session security

Production cookie flags (names + flags only; values never printed):

- HttpOnly: **true**
- Secure: **true** (production)
- SameSite: **Lax**
- Path: realm-scoped `/api/auth/<realm>/refresh-token`
- Distinct names: `__Secure-strideto_{user,employer,agent,institution}_rt`

Refresh cookies are not browser-JS readable. No access-token `localStorage` keys. No user id required in the account menu (Phase 11). No cross-realm name collision.

## 3. CORS / origin / CSRF

Production CORS: allowlist of `SITE_URL` / `FRONTEND_URL` / `APP_URL` / `CORS_ORIGINS`. Credentials enabled. **No wildcard.** Vercel preview wildcard requires explicit `CORS_ALLOW_VERCEL_PREVIEWS=1`.

Runtime (local HTTPS `https://localhost:8443`):

- Trusted Origin reflected in `Access-Control-Allow-Origin`
- Untrusted Origin preflight: **no** ACAO header
- Malformed Origin on login POST: **403** `origin_validation_failed`
- Missing Origin: allowed for non-browser (health/live)

State-changing auth routes use `secureTrustedOrigin`. Development `NODE_ENV≠production` still allows extra local origins; the local Docker APIs run `NODE_ENV=production`.

## 4. Security headers (runtime-proven)

**API** (`/api/*` via Caddy → api-a/api-b):

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=()`
- `Content-Security-Policy`: API policy `default-src 'none'; frame-ancestors 'none'; base-uri 'none'` (Helmet also emits its standard complementary directives)
- `X-Request-Id` on API responses

**Frontend** (nginx): `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`. **No CSP header on HTML** — truthful readiness: SPA CSP is not fully deployable without a nonce/hash pipeline for the Vite bundle. Not forced this phase (would risk breaking the shell).

## 5. XSS / content injection

`dangerouslySetInnerHTML` call sites now go through `sanitizeHtmlForRender` (DOMPurify allowlist). Phase 12 closed the form richtext gap in `FormFieldInput.jsx`. Copilot is not raw HTML. Job detail does not use innerHTML. Stored/reflected XSS payloads are sanitized or rendered as text.

## 6–8. NoSQL / mass assignment / IDOR

- `express-mongo-sanitize` is wired before routes. JSON body limit 1mb.
- High-authority fields (role, organizationId, verification, payout, Admin permission) remain server-derived; Mission 23 / admin SuperAdmin gates / employer application authz suites revalidated.
- Runtime: unauthenticated Vault document and Admin users → **401** (no existence leak). Cross-principal IDOR covered by vault, employer application, case, commerce, and Phase 8 suites.

## 9–12. SSRF / URLs / open redirect / uploads / path

User-controlled URLs are stored after scheme allowlists (`javascript:`, `data:`, `file:` rejected). No backend fetcher of arbitrary user URLs in the accepted apply/program/agent website path — **stored, not fetched**. Login return remains same-origin/realm policy (`loginReturn.js`, Phase 8/10). Uploads reject traversal, SVG/HTML/executables, MIME mismatch; Vault remains private (no public object URL).

## 13–14. Request bounds / rate limiting

- JSON and urlencoded bodies: **1mb**. Oversized login body → runtime **413**, sanitized `Request failed`, no 5xx.
- Public jobs list `MAX_LIMIT = 50`. Consultation/program lists similarly capped.
- Auth limiter **not weakened** (production 5 failed logins / minute).
- **Fix:** in-memory limiters were per-replica (api-a + api-b could double the bucket). Limiters now use a Redis store with a process-local fallback. Runtime after fix: `401×5` then **429** with `Retry-After: 60`.

## 15–17. Errors / logging / secrets

Production 5xx: `{ error: "Internal Server Error", requestId }` — no stack, no DB text, no secrets. Isolated synthetic 500 proven. Request logs: `requestId`, method, path, status, latency. Logger redacts password/authorization/cookie/token/stripe/JWT-shaped strings. Tracked-source secret scan: **clean** (placeholders only). Frontend source has no `JWT_SECRET` / `MONGO_URI` / `STRIPE_SECRET_KEY` usage.

## 18. Dependency / build security

`npm audit --omit=dev` reports existing advisories (server: 10 total, 0 critical; client: 8 total including 1 critical class). **Not upgraded** — lockfile churn is out of policy without a justified fix. Recorded as INFO / evidence limitation, not as invented “clean”.

## 19–24. Health / Redis / shutdown / worker / email / storage

| Probe | Runtime |
|---|---|
| `/api/health/live` | process alive |
| `/api/health/ready` | **ready**; mongo `up`; redis `up`; `requireRedis: true`; `shuttingDown: false` |
| `/api/health` | mongo/redis up; smtp **configured** (local Mailpit); email mode reported `live` for that transport |

Distinction: live = process; ready = Mongo up **and** Redis up when required **and** not shutting down. Optional Stripe/Cloudinary `not_configured` does not make core API unready.

Redis is **required** for production auth (denylist) and now rate-limit counters. Degraded Redis → ready 503 when `REQUIRE_REDIS=1`. Isolated graceful shutdown probe exits 0 (SIGTERM handler: stop listen, quit Redis, disconnect Mongo, bounded timeout).

Worker: compose profile `sec3f-worker-disabled`. **Runtime activation NOT PERFORMED by policy.** Source: loop gated, `running = false` on stop, no processing without process start. Email: Mailpit may catch SMTP if a worker ran; worker did not run; no real internet delivery. Storage: Vault private; local/Cloudinary `not_configured` remains truthful.

## 25–26. Mongo indexes / pagination

`autoIndex` is off unless `MONGO_AUTO_INDEX=1`. RefreshSession defines TTL + subject + token-hash indexes; `provisionRefreshSessionIndexes.test.js` **49** assertions passed. Public list endpoints are page-bounded. No unbounded public `find()`. Disposable backup restored a synthetic index (`p12_n`) as restore evidence — **not** applied to protected staging Mongo.

## 27–28. Bounded load / concurrency

Local HTTPS, concurrency 15, **450** operations on `/api/health/live`, `/api/health/ready`, `/api/jobs`, `/api/institutions`:

- successes 450 / failures 0
- p50 52ms / p95 170ms / p99 248ms / max 393ms
- timeouts 0 / unexpected 5xx 0

Refresh/application/notification races remain covered by existing accepted suites (not re-run in full).

## 29–31. Frontend build / runtime performance / timeouts

Production Vite build succeeded.

| Warning | Classification |
|---|---|
| browserslist / caniuse-lite stale | **ACCEPTED DEFERRED INFO** — no lockfile churn |
| react-dom dynamic+static import overlap (`ProfilingWizard`) | **ACCEPTED DEFERRED INFO** — onboarding already loaded with main |
| chunks >500 kB: `index-*.js` ~590 kB, `vendor-pdf-*.js` ~583 kB | **ACCEPTED DEFERRED INFO** — PDF vendor already split; main-shell split is high-risk |

No route-regression code-splitting this phase. Provider clients fail closed when not configured. Mongo has server selection / socket timeouts. JSON 1mb cap. No indefinite wait on optional providers.

## 32–33. Observability / alerts

Structured JSON logs + request id + status + latency. In-process `/api/metrics` (optional Prometheus text). No high-cardinality PII labels. **External monitoring provider: not_configured** (Sentry only if `SENTRY_DSN` is set; it is not required). Operational signals: ready 503 (DB/Redis), 5xx count, queue `dead24h`, payment reconciliation `attention_required` (Phase 9), worker not running, backup script failure. Runbook only — no claimed hosted alerting.

## 34–36. Backup / Redis semantics / rollback

Mongo backup/restore scripts exist (`scripts/backup/*`, `docs/BACKUP_GUIDE.md`). Retention numbers in that guide are **recommended**, not invented as production policy.

**Disposable exercise (not protected volumes):** synthetic 2 documents + index → `mongodump` → drop → `mongorestore` → count=2, index `p12_n` restored, field checksums matched → container removed.

Redis is **not** a system-of-record backup target (denylist + rate-limit + cache). Loss ⇒ re-login possible + limiter reset; Mongo/Vault/commerce untouched.

Rollback: prior image/commit for api/frontend; additive DB compatibility on this frozen track; **do not** `docker compose down -v` as normal recovery. `docs/DISASTER_RECOVERY.md` updated to remove that as a normal step. Worker/provider replay: not activated.

## 37–38. Docker / recovery

Proven local stack (worker absent): frontend, api-a, api-b, Mongo, Redis, Mailpit healthy; Caddy on `127.0.0.1:8443`. App rebuild used `--no-deps` for api/frontend only. Safe recovery: Docker daemon → start existing compose project → `docker info`. Never factory reset, prune, or `down -v` as normal recovery.

## 39–41. CI / env / production errors

CI (`.github/workflows/ci.yml`): `npm ci`, server+client lint, `auth.test.js`, `verify:production`, client build, prerender, then a **CI-owned** compose smoke that uses `docker compose down -v` on that ephemeral project — **not** executed against local protected volumes.

Local equivalence run: server lint, client lint (0 errors / 60 pre-existing warnings), auth + Mission 23, `verify:production` 8/8, client production build, backup script verify.

`validateProductionEnv` fatals on missing/short JWT/REFRESH secrets, equal secrets, missing `MONGO_URI`/`SITE_URL`/`REDIS_URL` in production. Optional providers warn / `not_configured`. Frontend does not require server secrets. Client `RouteErrorBoundary` does not render stacks in production.

## 42–45. Tests / runtime acceptance

Executable Phase 12 suite: `server/src/__tests__/phase12SecurityOps.test.js` — **72** assertions (CORS, cookies, helmet, safe 500, redaction, path/upload, shutdown probe, source contracts, secret scan, frontend secret env). Isolated shutdown probe: exit 0.

Regressions: Mission 23 (37 orchestrated), auth cookie 115, worker email 17, proxy rate-limit, Phase 8 (71), Phase 9 (71), Phase 10 SEO (53), employer application authz, refresh-session indexes 49, module-link clean, verify-security / verify-production.

Runtime acceptance on current Docker: all required services healthy; worker stopped; headers/origin/IDOR sample/429/413/load/shutdown/backup proven; unexpected 5xx **0** in the acceptance matrix.

## 46. Findings

| ID | Sev | State |
|---|---|---|
| Replica-local auth limiter (2 APIs ≈ 2× bucket) | P1 | **Fixed** (Redis store) |
| Form richtext unsanitized HTML | P1 | **Fixed** (`sanitizeHtmlForRender`) |
| No request correlation / 500 could log raw message in prod | MAJOR | **Fixed** |
| Frontend HTML CSP absent | P2 | Deferred — SPA nonce/hash blocker |
| npm audit production advisories | INFO | Deferred — no lockfile rewrite |
| browserslist stale; react-dom overlap; >500kB chunks | INFO | Deferred |
| Health `email.mode=live` while worker stopped | INFO | Mailpit transport configured; delivery not performed |
| `DISASTER_RECOVERY.md` `down -v` as rebuild | MINOR | **Fixed** (runbook) |

Unresolved BLOCKER / P0 / P1 / security-privacy-data-loss MAJOR: **none**.

## Intentionally not activated

Live Stripe, live email to the public internet, real worker, SMS/push, scraping, production deployment, Mission 27, Phase 13 multi-role GO.

---

**Phase 12 status: FROZEN**
