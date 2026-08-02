# STRIDETO SEC-3F-A — Infrastructure Authority Resolution

**Status**: documentation only. No external infrastructure was changed, created, or contacted to produce this document. Nothing described as "selected authority" below is claimed to be live unless a section explicitly marks it "Current verified state: CONFIRMED" with cited evidence.

**Authority for this document**: the SEC-3F real-infrastructure acceptance contract audit does not exist as a committed repository file — no `docs/STRIDETO_SEC_3F_REAL_INFRASTRUCTURE_ACCEPTANCE_CONTRACT_AUDIT.md` was found in this repository at the time of writing. This document instead uses the complete accepted SEC-3F contract-audit output produced earlier in this engagement (verdict: `SEC-3F CONTRACT REQUIRES BOUNDED INFRASTRUCTURE AUTHORITY CORRECTION`) as its authority, alongside `docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md` and `docs/STRIDETO_SEC_3E_ATOMIC_AUTHENTICATION_CUTOVER_IMPLEMENTATION_REPORT.md`, both read in full for this document.

Checkpointed commit under discussion: `effd3bb85b9abc58bba16ccc732170f3817f448a`.

---

## 1. Canonical production topology (selected authority, not yet live)

```text
Canonical frontend:  https://www.strideto.com
Canonical API:       https://api.strideto.com
API base URL:        https://api.strideto.com/api
```

`https://strideto.com` (apex, no `www`) is frozen as a **redirect-only** hostname to `https://www.strideto.com`. It must not independently serve the authenticated SPA. `www.strideto.com` is the single browser application origin.

`https://strideto.onrender.com` remains an acceptable **provider-level backend target behind Render** (i.e. Render may keep issuing that hostname internally), but it is **not** an accepted browser-facing API hostname once secure authentication is activated. All browser traffic must reach the API through `https://api.strideto.com`.

The custom API domain must, once bound:

- terminate HTTPS successfully on `api.strideto.com`;
- never redirect browser API requests to `strideto.onrender.com`;
- preserve the `/api` route prefix;
- preserve forwarded HTTPS information (`X-Forwarded-Proto`) to the API process;
- remain compatible with the existing `trust proxy: 1` single-hop configuration (`server/src/config/proxy.js`) — no additional untrusted hop may be introduced by whatever binds the custom domain.

**Current verified state**: `https://www.strideto.com` is live (Vercel-served SPA, confirmed by `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`, dated 2026-07-27). `https://api.strideto.com` is **not** currently the live API host — the same report's own "Production targets" and health-check evidence both target `https://strideto.onrender.com/api` directly. `docs/DNS_CHECKLIST.md` and `docs/RENDER_CONFIGURATION.md` both describe `api.strideto.com` as an intended custom-domain binding, not a completed one. No DNS record for `api.strideto.com` is confirmed live anywhere in the repository's evidence.

**External action required**: bind and verify the `api.strideto.com` custom domain on the Render web service, with DNS pointed and TLS issued, before any further SEC-3F progress that depends on same-site cookie behavior.

---

## 2. Same-site authority

```text
Frontend registrable domain: strideto.com
API registrable domain:      strideto.com   (after Gate A below is met)
Relationship:                 same-site, cross-origin
```

This is required by the already-checkpointed, unmodified cookie contract (`AuthCookiePolicy`, `SameSite=Lax`, `Domain` unset, host-only API refresh cookie). This document does **not** change the cookie architecture. The following are explicitly **not authorized** as workarounds:

- `SameSite=None` as a shortcut to tolerate a cross-site API host;
- a broad parent-domain (`Domain=.strideto.com`) cookie;
- a JavaScript-readable refresh token of any kind;
- accepting `strideto.onrender.com` as a permanent browser-facing API host;
- any cross-site refresh workaround (e.g. token-in-body fallback).

The single selected correction is binding a same-registrable-domain custom API hostname (`api.strideto.com`), per §1.

---

## 3. Exact origin authority

```text
Canonical browser Origin: https://www.strideto.com
```

Recommended production values, matching the exact semantics already implemented in `server/src/config/cors.js` and `secureAuthConfig.js`'s `collectTrustedOrigins`:

```text
SITE_URL=https://www.strideto.com
FRONTEND_URL=https://www.strideto.com
APP_URL=https://www.strideto.com
```

`CORS_ORIGINS` may remain empty when the three canonical variables above already supply the exact allowed origin. It may alternatively hold an explicit, comma-separated allowlist — it must never introduce wildcard behavior; `cors.js`'s own origin callback never accepts `*` together with `credentials: true`, and this document does not propose changing that.

`https://strideto.com` (apex) is frozen as **excluded** from the authenticated origin allowlist, since it always redirects before the SPA loads (§1). If a future operator decision serves the SPA from both `strideto.com` and `www.strideto.com`, both exact origins must be consciously added to `SITE_URL`/`FRONTEND_URL`/`APP_URL`/`CORS_ORIGINS` and to trusted-origin testing — this broader option is **not** the preferred authority and is not assumed here.

**Current mismatch**: `.env.production.example` currently templates all three variables as `https://strideto.com` (apex, no `www`) — not `https://www.strideto.com`. Given the live evidence that the deployed SPA is actually served at `www.strideto.com`, the template's apex value would cause the exact-match `TrustedRequestOriginPolicy` to reject the real production frontend's Origin header once secure auth is enabled, unless the deployed Render environment variables differ from the template (unverified — see §20, "do not assume templates reflect deployed values").

**Required correction**: whoever configures the live Render environment must set the three variables to `https://www.strideto.com` exactly, not the template's apex value, and this must be confirmed against the actually-deployed Render dashboard values (not assumed from the repository template) before SEC-3F execution.

---

## 4. Preview policy

```text
CORS_ALLOW_VERCEL_PREVIEWS=0
```

frozen as the required value for production and for SEC-3F staging. Preview deployments:

- do not receive production secure-auth credentials;
- do not receive staging secure-auth credentials;
- are not accepted SEC-3F environments;
- cannot complete protected secure-auth operations;
- must not be added to the trusted-origin set.

**Current verified state**: `CORS_ALLOW_VERCEL_PREVIEWS` is not set in `.env.production.example`, so `cors.js`'s own default (`!== '0'` → allowed) currently permits `*.vercel.app` preview origins at the CORS layer. Separately, and already effective today with no further change: `secureAuthConfig.js`'s `collectTrustedOrigins` has no preview-wildcard rule at all, so `secureTrustedOrigin` already 403s every preview-origin request on every protected auth route, regardless of the CORS setting. Setting `CORS_ALLOW_VERCEL_PREVIEWS=0` explicitly is defense-in-depth, not a functional requirement of the auth boundary itself — it is frozen as required anyway, to avoid a confusing "CORS preflight succeeds, then the actual request 403s" experience and to remove reliance on an implicit default.

---

## 5. Production Redis authority

```text
A shared external Redis-compatible service must be provisioned before
commit effd3bb, or any later commit, is deployed to production.
```

Vendor is operationally selectable (Render Redis, Upstash, or any equivalent), subject to:

- accessible from the Render API service;
- encrypted transport where the provider supports/requires it;
- a stable `REDIS_URL`;
- shared across every API instance (never process-local);
- suitable for exact-TTL access-token denylist entries (`accessDenylist.js` keys by `jti`, TTL derived from the token's own `exp` claim — no fixed TTL to provision for);
- suitable for cross-instance logout visibility;
- isolated from staging (a distinct instance/database/namespace, never the same service as staging Redis);
- monitored for connectivity failure.

**Exact role of `REDIS_URL` vs. `REQUIRE_REDIS`** (read directly from code, not assumed):

- `server/src/config/validateEnv.js` hard-fails production boot (`process.exit(1)`) when `REDIS_URL` is absent — **unconditionally**, whenever `NODE_ENV === 'production'`, independent of any other flag. This is the SEC-3E secure-auth boot gate.
- `REQUIRE_REDIS` appears **exactly once** in the entire server source tree, in `server/src/routes/health.js` (`const requireRedis = process.env.REQUIRE_REDIS === '1';`), where it affects only the `/api/health/ready` readiness-probe response. It is **not** referenced anywhere in `validateEnv.js` or anywhere in the SEC-3E secure-auth composition. It does not gate server boot.

Required production variables before deployment (values redacted, presence/shape only):

```text
REDIS_URL=<present, secret, redacted>
REQUIRE_REDIS=<operationally recommended =1, for accurate health-probe reporting; not enforced by the boot gate itself>
```

**Current verified state**: `docs/PRODUCTION_INFRASTRUCTURE_REPORT.md` (2026-07-25) lists Redis status as `MISSING`. `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md` (2026-07-27, six days ago) shows the live `/api/health` response with `"redis": "disabled"`. No evidence anywhere in the repository indicates Redis has been provisioned on the live Render service since.

**Deployment gate**: because `validateEnv.js`'s `REDIS_URL` check is unconditional in production as of this checkpoint, deploying commit `effd3bb` (or later) to the current production Render service **without first provisioning Redis and setting `REDIS_URL`** will cause the API process to `process.exit(1)` on every boot attempt — a full production outage of the entire API (not merely degraded authentication), because no other route can serve either once the process cannot start.

---

## 6. Production secret prerequisites

Before any deployment of this checkpoint to production, all of the following must be true on the live Render web (and worker, where applicable) service:

```text
STRIDETO_SECURE_AUTH_ENABLED=1
JWT_SECRET=<present, valid>
REFRESH_SECRET=<present, valid>
JWT_SECRET != REFRESH_SECRET
REDIS_URL=<present, valid>
MONGO_URI=<present, valid>
NODE_ENV=production
```

No secret value is included in this document, and none was retrieved or printed while producing it. The frozen pre-deployment check an operator runs must report only:

```text
present / absent
valid-length / invalid-length   (>= 32 chars, matching validateEnv.js's own threshold)
equal / distinct                (JWT_SECRET vs REFRESH_SECRET)
valid URL shape / invalid shape (MONGO_URI, REDIS_URL)
```

The check must never print the secret itself or a full connection string — at most a redacted prefix/suffix or a locally-computed fingerprint, per the SEC-3F contract's own secret-safety rules.

---

## 7. Staging topology

Selected authority: the repository's documented Docker/Caddy topology (`docs/STAGING_DEPLOYMENT.md`, `docker-compose.staging.yml`, `deploy/Caddyfile`), **subject to actual provisioning** — not yet confirmed live.

```text
Canonical staging browser origin: https://staging.strideto.com
Preferred staging API topology:   https://staging.strideto.com/api
                                   (routed through Caddy to the staging API container)
```

This produces same-origin browser/API staging traffic, which is compatible with — and a stronger guarantee than — the accepted `SameSite=Lax` cookie design.

**Client compatibility (verified this phase, no code change required)**: `client/src/constants/index.js` defines `API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'` (build-time inlined, per `docs/VERCEL_CONFIGURATION.md`'s own "Rebuild after any `VITE_*` change" note). Setting `VITE_API_URL=https://staging.strideto.com/api` (or a relative `/api`, if the staging frontend and API are ever served from literally the same host/port through Caddy) requires no source change — the client already supports this topology as-is.

**Current verified state**: `docs/STAGING_DEPLOYMENT.md` itself describes pointing `staging.strideto.com` DNS and uncommenting the staging block in `deploy/Caddyfile` as outstanding setup steps ("1. Point `staging.strideto.com` DNS... 2. Uncomment staging block..."), not completed actions. No repository evidence confirms this stack is currently running or reachable. `docs/DNS_CHECKLIST.md` lists `staging.strideto.com` only as "Optional."

**External action required**: stand up (or confirm already running) the Docker Compose staging stack, point `staging.strideto.com` DNS to the VPS, uncomment and reload the Caddy staging block, and verify reachability — before SEC-3F Stage 1 execution.

---

## 8. Staging isolation

Frozen as complete separation from production, with no exception:

```text
MongoDB:          separate staging database/cluster or isolated database name
Redis:             separate staging service/instance/namespace
Accounts:          staging-only User, Employer, and staff accounts
Logs:              staging-only
Secrets:           staging-only (distinct JWT_SECRET/REFRESH_SECRET from production)
RefreshSession records: staging-only
Denylist keys:     staging-only
```

Staging must never use production users, production employers, production staff accounts, the production MongoDB database, the production Redis instance, production secrets, or production session records. `docker-compose.staging.yml` already declares dedicated `mongodb` and `redis` services distinct from any production connection string, which is consistent with this requirement — but their actual live, reachable, provisioned status is unverified (§7).

---

## 9. Two-instance staging authority

**Current verified state**: `docker-compose.staging.yml` declares exactly one `backend` service (plus `mongodb`, `redis`, `worker`, `frontend`) — no `replicas:` directive and no second backend service exist in the committed file. This is insufficient for SEC-3F multi-instance acceptance as specified.

Frozen requirement:

```text
Two concurrently running API instances: api-a, api-b
```

Both instances must share: staging MongoDB, staging Redis, `JWT_SECRET`, `REFRESH_SECRET`, the exact frozen audience constants, the issuer, the secure-auth flag, and the trusted-origin set. Each instance must expose a safe identifier in staging logs (e.g. a `HOSTNAME`/container-ID field already available to Docker, or an explicit log field added later) so evidence can attribute a given request/response to a specific instance.

`deploy/Caddyfile` must be capable of routing to both instances — either through controlled direct access to `api-a` and `api-b` individually (preferred, since it removes ambiguity about which instance served a given evidence entry), or through load-balancer routing with reliable instance-identification evidence if direct access is not practical.

**Not accepted as multi-instance evidence** (per the SEC-3F contract, restated here for this document's own gate in §13 below): one API container restarted twice; the Render worker process; two requests to one process; two browser tabs against one process.

**Files that would need a later implementation or operator change** (identified, not modified, by this document):

```text
docker-compose.staging.yml   — needs a second backend service definition (e.g. `backend-b`)
                                sharing the same mongodb/redis service and environment,
                                or a `deploy.replicas` equivalent if the compose tooling
                                in use supports it for this project's setup
deploy/Caddyfile             — needs the staging block extended with a load-balancing or
                                dual-upstream directive routing to both backend containers
```

No change was made to either file in this documentation-only phase.

---

## 10. MongoDB index authority

`server/src/models/RefreshSession.js` sets `autoCreate: false` on its schema options — Mongoose does **not** automatically create indexes for this model at connection time. Index creation is an explicit operator/deployment action, not an automatic consequence of the committed schema.

```text
Index authority:    committed schema definition (server/src/models/RefreshSession.js)
Index provisioning: explicit operator/deployment action (not automatic)
Index verification: read-only SEC-3F evidence (e.g. `db.refreshsessions.getIndexes()`)
```

Required indexes, read directly from the committed model (plus the implicit default):

```text
_id                                          (implicit default index)
refresh_session_ttl                          { expiresAt: 1 }, expireAfterSeconds: 0
refresh_session_active_by_subject            { subjectType: 1, subjectId: 1, revokedAt: 1 }
refresh_session_current_token_hash_unique    { currentTokenHash: 1 }, unique
refresh_session_previous_token_hash          { previousTokenHash: 1 }, sparse
```

**Current verified state**: no evidence in the repository confirms these indexes exist in any live database (production or staging). Given `autoCreate: false`, they will **not** silently appear.

**Deployment gate**: index provisioning must be an explicit, bounded, evidenced step — performed and verified with the read-only commands named in the SEC-3F contract (`getIndexes`, bounded `countDocuments`) — before any SEC-3F browser scenario begins, in whichever database (staging first) is targeted for that scenario. No index creation was performed by this documentation-only phase.

---

## 11. Outage-control readiness

Staging must permit controlled simulation of: MongoDB unavailable; Redis unavailable; one API instance stopped; both API instances restarted; Redis restarted/reconnected; MongoDB reconnected. The operator must be able to perform all of these without any effect on production.

```text
Production is never used for SEC-3F outage testing.
```

**Current verified state**: the Docker Compose staging model, if actually running, would structurally support this (independent containers that can be stopped/started via `deploy/staging-down.sh`/`deploy/staging-up.sh`), but this capability is unverified until §7's staging-liveness action is completed. If the staging environment cannot be confirmed to provide safe, isolated outage control once live, SEC-3F remains blocked on this gate regardless of every other gate's status.

---

## 12. Deployment order (frozen, not executed)

No code deployment occurred in this phase. The following order is frozen for a later operator to execute:

**Step 1 — Infrastructure preparation**: provision production Redis; provision isolated staging MongoDB; provision isolated staging Redis; provision/confirm the staging frontend+API stack; add a second staging API instance; prepare an index-provisioning method; prepare maintenance/rollback controls.

**Step 2 — Domain preparation**: bind `api.strideto.com` to the Render API service; configure DNS; enable TLS; verify no redirect to the provider hostname; verify `www.strideto.com` remains canonical; verify the apex redirects to `www`.

**Step 3 — Environment preparation**: update production Render variables to the exact canonical origins (§3); update staging variables identically for the staging host; set `CORS_ALLOW_VERCEL_PREVIEWS=0`; verify all secrets present/valid-shape without printing values (§6).

**Step 4 — Staging deployment only**: deploy the accepted SEC-3E checkpoint to staging; do not deploy to production; verify boot; verify health; verify MongoDB indexes (§10); verify Redis connectivity.

**Step 5 — Repeat the SEC-3F contract re-audit**: confirm every previously unresolved authority item is now verified live; freeze exact execution commands and targets; do not start browser scenarios until that re-audit accepts.

**Step 6 — SEC-3F controlled execution**: only after Step 5 returns ready.

**Step 7 — Production decision**: explicitly out of scope for this document and for initial staging execution. Production deployment of this checkpoint requires its own separate authorization after SEC-3F passes.

---

## 13. Rollback and boot-failure handling

Because `validateEnv.js` now requires `STRIDETO_SECURE_AUTH_ENABLED=1` and `REDIS_URL` unconditionally whenever `NODE_ENV=production`, this checkpoint has no "soft" in-place rollback once deployed — reducing the flag to `'0'` in production is itself a fatal configuration per the same file. Consequently:

```text
Deploying SEC-3E before its required variables are configured is prohibited.
```

If staging fails to boot, the following are **not** authorized responses:

- selecting legacy mode;
- removing the Redis requirement;
- restoring JSON refresh tokens in any response body;
- restoring `localStorage`/`sessionStorage` access or refresh tokens;
- changing cookies to JavaScript-readable storage.

Authorized responses to a staging boot failure: correct missing staging variables; correct staging Redis connectivity; correct staging MongoDB connectivity; leave staging unavailable until corrected; roll forward with a bounded secure fix; or — for production specifically — simply not deploy this checkpoint yet, which requires no rollback action at all.

**The existing production deployment remains untouched until SEC-3F passes.** No production deployment of this checkpoint has occurred, is scheduled by this document, or is implied by it. The project is therefore not performing an insecure production rollback at any point in this process — it is withholding the new secure release until acceptance, which is a strictly stronger and safer posture than a rollback would be.

---

## 14. External operator action table

| ID | Action | Environment | Owner authority needed | Evidence required | Security stop condition | Status |
|----|--------|-------------|------------------------|--------------------|--------------------------|--------|
| INFRA-A1 | Confirm canonical `www` frontend | Production | Vercel/domain admin | DNS + HTTPS check against `www.strideto.com`; apex redirect confirmed | Apex serves the SPA directly without redirecting | PARTIALLY CONFIRMED — frontend host liveness is evidenced; apex-to-www redirect behavior has not yet been independently verified. |
| INFRA-A2 | Bind `api.strideto.com` | Production | Render + DNS admin | DNS record + Render custom-domain dashboard screenshot; TLS cert issued | Requests silently resolve to `strideto.onrender.com` instead | UNRESOLVED |
| INFRA-A3 | Configure API TLS | Production | Render/DNS admin | Valid cert for `api.strideto.com`, hostname match | Cert mismatch or HTTP fallback | UNRESOLVED |
| INFRA-A4 | Verify no `onrender.com` redirect | Production | Render admin | Direct request to `api.strideto.com` shows no redirect to the provider domain | Any redirect/rewrite to `*.onrender.com` in a browser-visible response | UNRESOLVED |
| INFRA-A5 | Correct exact frontend origins | Production | Render env admin | `SITE_URL`/`FRONTEND_URL`/`APP_URL` on the live Render dashboard equal `https://www.strideto.com` | Deployed values still equal the template's apex value | UNRESOLVED |
| INFRA-A6 | Disable Vercel preview CORS | Production + staging | Render env admin | `CORS_ALLOW_VERCEL_PREVIEWS=0` set on both | Value left unset/`1` | UNRESOLVED |
| INFRA-A7 | Provision production Redis | Production | Infra/DB admin | `REDIS_URL` present on Render; health check no longer reports `redis: disabled` | Deploy proceeds without Redis provisioned | UNRESOLVED |
| INFRA-A8 | Set production secure-auth variables | Production | Render env admin | Presence/shape check per §6, no values printed | Deploy occurs with any of §6's variables absent/invalid | UNRESOLVED |
| INFRA-A9 | Confirm `staging.strideto.com` DNS | Staging | DNS admin | DNS resolves; Caddy staging block active | Staging traffic silently falls back to an unintended host | UNRESOLVED |
| INFRA-A10 | Provision isolated staging MongoDB | Staging | Infra/DB admin | Distinct DB name/cluster from production, confirmed via read-only inspection | Staging points at the production database | UNRESOLVED |
| INFRA-A11 | Provision isolated staging Redis | Staging | Infra admin | Distinct instance/namespace from production | Staging points at the production Redis instance | UNRESOLVED |
| INFRA-A12 | Run two staging API instances | Staging | Infra/deploy admin | Two distinct, identifiable running processes sharing staging Mongo/Redis/secrets | Only one process, or two processes with unshared state | BLOCKED — `docker-compose.staging.yml` currently declares one `backend` service only |
| INFRA-A13 | Provision `RefreshSession` indexes | Staging (then production, separately) | DB admin | `getIndexes()` output matching §10's five required indexes | Any required index missing before browser execution begins | UNRESOLVED |
| INFRA-A14 | Prepare outage controls | Staging | Infra admin | Documented, tested stop/start procedure for Mongo/Redis/API containers, isolated from production | Any outage test touches production | UNRESOLVED |
| INFRA-A15 | Prepare staging test accounts | Staging | QA/infra admin | Staging-only User/Employer/staff accounts, no real personal data, cleanup plan | Reuse of any production account | NOT EXECUTED |
| INFRA-A16 | Prepare maintenance/rollback control | Production + staging | Infra admin | Documented maintenance-mode toggle; confirmed it does not require legacy-mode fallback | Rollback plan relies on a prohibited legacy path (§13) | NOT EXECUTED |

No action is marked `CONFIRMED` without complete cited evidence. INFRA-A1 remains `PARTIALLY CONFIRMED` because frontend liveness is evidenced but apex-to-www redirect behavior remains unverified.

---

## 15. Resolution gates

```text
Gate A — Production domain authority
  Pass only when: www.strideto.com is canonical; api.strideto.com is bound;
  both are HTTPS; both share strideto.com; API requests stay on api.strideto.com.
  Status: NOT MET (INFRA-A2/A3/A4 unresolved)

Gate B — Exact origin authority
  Pass only when deployed production configuration includes the real
  canonical browser origin https://www.strideto.com.
  Status: NOT MET (INFRA-A5 unresolved; template still uses the apex value)

Gate C — Production boot prerequisites
  Pass only when all required production variables (§6) are configured
  before deployment.
  Status: NOT MET (INFRA-A7/A8 unresolved — Redis absent, confirmed)

Gate D — Staging availability
  Pass only when staging.strideto.com is reachable and isolated.
  Status: NOT MET (INFRA-A9/A10/A11 unresolved)

Gate E — Two-instance capability
  Pass only when two real API processes can run concurrently against
  shared staging MongoDB/Redis.
  Status: NOT MET (INFRA-A12 BLOCKED — requires a compose/Caddy change)

Gate F — Index readiness
  Pass only when all committed RefreshSession indexes exist in staging.
  Status: NOT MET (INFRA-A13 unresolved)

Gate G — Outage-control readiness
  Pass only when MongoDB/Redis/API outages can be simulated safely in
  staging.
  Status: NOT MET (INFRA-A14 unresolved, depends on Gate D)
```

SEC-3F execution remains blocked until all seven gates pass. None currently pass.

---

## 16. Explicit non-claims

This document does **not** claim, and no reader should infer, that:

- `api.strideto.com` is currently bound — it is not, per §1's cited evidence;
- Redis is currently provisioned for production — it is not, per §5's cited evidence;
- staging is currently live — its liveness is unconfirmed, per §7;
- two API instances currently exist anywhere — they do not, per §9;
- indexes currently exist in any staging database — unconfirmed, per §10;
- SEC-3F is ready to execute — it is not; every gate in §15 is unmet;
- production is ready to deploy this checkpoint — it is not, and deploying it in the current state would crash-loop the live API (§5).

---

## 17. Next safe step

Run one strict read-only acceptance audit of this document. If accepted, checkpoint it (documentation-only commit) before any external operator action begins. The external actions in §14 must then be completed and evidenced — each moving from `UNRESOLVED`/`BLOCKED`/`NOT EXECUTED` to `CONFIRMED` with cited evidence — before the SEC-3F contract can be re-audited and potentially return an execution-ready verdict.
