# STRIDETO PHASE 17D-1R1
AUTHORITY FOUNDATION INTEGRITY CLOSURE

This is **not** Phase 17D-2. This is **not** Phase 18.

Capability backfill executed: **NO**

Persistent Strideto Mongo migrated: **NO**

GBS UI: **NONE**

Public GBS routes: **NONE**

Worker: **STOPPED**

Push: **NO**

Deployment: **NO**

Phase 17D-2: **NOT STARTED**

Phase 18: **NOT STARTED**

---

## 1. Baseline

- Expected HEAD at start: `4db3477a947c3d34d365012e71d441647e573fdc`
- Confirmed: `4db3477` `docs(release): record phase 17d-1 authority foundation` on `main`
- Architecture documents were not reopened:
  - `docs/STRIDETO_PHASE_17D_A_GLOBAL_BUSINESS_SERVICES_ARCHITECTURE_GAP_AUDIT.md`
  - `docs/STRIDETO_PHASE_17D_B_PRODUCT_AUTHORITY_SECURITY_ARCHITECTURE_LOCK.md`
  - `docs/STRIDETO_PHASE_17D_1_BUSINESS_CLIENT_AUTHORITY_FOUNDATION.md`
- Known tracked WIP left untouched:
  - `client/src/components/admin/AdminDataTable.jsx`
  - `client/src/components/admin/AdminTableFilters.jsx`
  - `client/src/components/common/FormField.jsx`
- Protected/local-only files never staged:
  - `docker-compose.appenv-align.yml`
  - `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
  - `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- Older stash left untouched: `stash@{0}: On main: wip: AdminTableFilters values wiring (pre-phase-10)`
- `git stash -u` was not used
- No `docker compose down`, no `-v`, no prune
- No push, no deploy

---

## 2. Role-transition audit

`ROLE != CAPABILITY` remains frozen. Paths that change `User.role` after account creation:

| Path | Mechanism | 17D-1 behavior | 17D-1R1 |
| --- | --- | --- | --- |
| Admin `PATCH /users/:id/role` | `userSecureAuthFlows.changeUserRole` | Role + `tokenVersion` + family revocation only | Same security mutation, then server-authoritative capability transition |
| Admin bulk role | same `changeUserRole` | Same | Same + audited preserve metadata |
| SuperAdmin assignment | same, SuperAdmin-gated | Same | Same |
| Staff invitation accept | `User.create` + `initializeStaffUser` | Initialized, zero student | Unchanged |
| `ensureAdminOnBoot` create | `initializeStaffUser` | Initialized staff | Unchanged |
| `ensureAdminOnBoot` update | `user.role = 'Admin'` direct save | No capability init | `applyRoleTransitionCapabilities` with PRESERVE (no student/business_client created). Staging boot skipped (`ADMIN_EMAIL` unset) |
| `provisionLocalSuperAdmin` | `changeUserRole` | Role only | Inherits flow hook |

No workspace / localStorage / navigation input is consulted.

Existing `changeRole` primitive is unchanged: atomic `{ _id, role: expectedPriorRole }` + `$inc: { tokenVersion: 1 }`, then `reason: 'role_changed'` family revocation.

---

## 3. Selected role/capability transition semantics

Admin UX cannot expose a capability-mode choice. Mode is **not** read from the request body.

Server-authoritative default:

`PRESERVE_EXISTING_CAPABILITIES`

Rules:

1. Do **not** grant `student` merely because role became `User` or `Admin`.
2. Do **not** grant `business_client` from any role change.
3. If an active student grant already exists, PRESERVE keeps it and audits that it was preserved (legitimate dual-use: staff RBAC + student capability).
4. `MAKE_STAFF_ONLY` exists as an explicit server mode that **suspends** student with audit (`role_transition_make_staff_only`). It is not the Admin API default and cannot be selected from UI.
5. Uninitialized (`capabilitySchemaVersion = 0`) accounts are schema-initialized on the administrative role mutation **without** materializing a new student grant.

Promotion example (initialized User with student → Admin): student grant remains; audit records preservation.

Uninitialized User → Admin: schema becomes 1, no student grant is created. Effective legacy student is not copied. Dual-use after that requires an explicit later grant.

---

## 4. Legacy resolver interaction

`capabilitySchemaVersion >= 1` remains authoritative, including an intentional empty grant set.

Critical demotion:

initialized staff, zero student grants, role Admin → User  
→ still **no** Student product authority  
→ legacy compatibility resolver does **not** reactivate

Uninitialized Admin → User: schema is marked initialized first, so `role === 'User'` cannot recreate legacy student.

Source: `shared/capability/legacyUserClassification.js` (unchanged formula) + `applyRoleTransitionCapabilities` in `server/src/services/capability/userCapabilityService.js`.

---

## 5. Registration grant atomicity / failure semantics

Genuine Student registration write order (no Mongo transactions; standalone Mongo 7 is the current topology):

1. `User.create` with schema default `capabilitySchemaVersion = 0`
2. Active `student` grant (`(userId, capability)` unique)
3. Verify active student grant exists
4. Mark `capabilitySchemaVersion = 1`
5. Only then continue to referral/email and HTTP 201

Corrupt state prevented: initialized (`version = 1`) without an active student grant. Schema is never marked if the grant write or post-condition fails.

If grant succeeds and schema mark fails:

- User exists, grant exists, version remains 0 (legacy student still matches the grant)
- HTTP 201 is **not** sent on that attempt
- Retry of `initializeCustomerUser` is idempotent (active duplicate grant no-ops, then marks schema)

Existing-email anti-enumeration path (always generic 201):

- Compensation runs **only** for `role === 'User'` **and** schema uninitialized
- Initialized zero-grant accounts (demoted staff) are **not** auto-granted student
- Compensation failure is swallowed so existence is not leaked; first-create failure still fails closed (no 201)

Staff create (`initializeStaffUser`) still marks schema with zero student grants. `business_client` is never auto-granted.

---

## 6. Registration failure-injection tests

`server/src/__tests__/phase17d1r1RoleAndRegistration.test.js` (39 assertions), including:

- Grant-write failure → thrown, schema stays uninitialized, no student grant, cannot report success
- Schema-mark failure → thrown, grant present, schema uninitialized (not initialized-without-student)
- Retry after mark failure → schema initialized, still exactly one student grant
- Happy path → exactly one active student grant
- Duplicate initialize → no duplicate grant
- Staff create → initialized, zero student grants
- `business_client` never granted
- Missing grant after write → `registration_authority_incomplete` and schema is not marked

---

## 7. Concurrency implementation

`mutateProviderCapabilityRecord` no longer does read → assert → `save()`.

Production path is a single `findOneAndUpdate`:

```
filter: { _id, subjectType, subjectId, recordVersion: expectedVersion }
update: { $set: <mutation>, $inc: { recordVersion: 1 } }
```

Subject predicates are in the same filter as the version check (no TOCTOU privilege race).

On miss, a second query is **authorized-scope only** (`_id + subjectType + subjectId`):

- match → 409 `optimistic_concurrency_conflict`
- no match → 404 `provider_capability_not_found` (covers not found and wrong tenant; no unscoped `findById`)

In-memory `assertExpectedVersion` / `applyOptimisticMutation` remain for unit helpers; they are not the ProviderCapability persistence path.

---

## 8. Mongo atomicity proof

Isolated database: `mongodb://127.0.0.1:27018/strideto_17d1r1_integrity_run2`  
Name required to match `strideto_17d1r1_integrity_*`. Dropped after the run. **Not** `edurozgaar`.

`phase17d1r1ConcurrencyIdempotency.mongo.test.js`:

- Two concurrent updates, same starting `recordVersion`, different `trustStatus` → exactly one success, one 409, `recordVersion` increments once
- Wrong-tenant subject predicates → 404, durable record unchanged
- Authorized subject + stale version → 409, not 404

---

## 9. Idempotency adapters

Explicit kinds:

- `InMemoryIdempotencyStore` (`createInMemoryIdempotencyStore` / 17D-1 alias `createIdempotencyStore`) — **TEST / isolated-dev only**
- `MongoIdempotencyStore` (`createMongoIdempotencyStore` / `getMongoIdempotencyStore`) — shared persistent store

`executeIdempotentCommand` **requires an injected store**. There is no silent in-process default.

`assertHighValueIdempotencyStore` / `executeHighValueIdempotentCommand` fail closed (`503` `idempotency_store_not_shared`) if a high-value command is wired to in-memory.

No Redis idempotency. Mongo is the selected source of truth. No live GBS high-value command exists yet; the wiring guard is what prevents accidental future use across api-a / api-b.

---

## 10. Mongo idempotency uniqueness

`IdempotencyRecord` unique index:

`{ principalId, tenantId, commandType, idempotencyKey }`

Fingerprint is a separate field.

Reservation is `create()` of `IN_PROGRESS`. Duplicate key `11000` is the compare-and-swap. Duplicate `expiresAt` field index + TTL index conflict was removed so only the TTL index (`expireAfterSeconds: 0`) remains.

Statuses: `in_progress`, `completed`, `failed`. Abandoned reservations are never rewritten as `completed` without a successful `perform()`.

---

## 11. Multi-instance duplicate proof

Two `createMongoIdempotencyStore()` instances sharing the isolated Mongo DB:

- Same key + same fingerprint, overlapping `perform` → one execution callback, one durable side-effect fixture, second caller replays
- Same key + same fingerprint later → replay, no second effect
- Same key + different fingerprint → 409 `idempotency_conflict`

---

## 12. Crash / IN_PROGRESS behavior

- Fresh `IN_PROGRESS` seen by a second caller: bounded poll (`IDEMPOTENCY_IN_FLIGHT_MAX_WAIT_MS` default 2s), then 409 `idempotency_in_flight`. The side effect is not executed again. Connections are not held indefinitely.
- Crash window: reservation written, process dies before `perform` completes → document stays `IN_PROGRESS`, **not** `COMPLETED`.
- After `IDEMPOTENCY_IN_PROGRESS_STALE_MS` (default 5 minutes; tests used 80ms), a same-fingerprint caller may atomically take over the stale reservation and execute once.
- `perform` throw marks `FAILED` (retryable with same fingerprint); never `COMPLETED`.
- Record TTL remains 7 days (bounded; Mongo TTL index).

This is not a distributed transaction engine. Financial/payment commands remain deferred.

---

## 13. Student regression

Reran:

- `phase17d1StudentRouteAuthority.test.js` — 74 assertions (Student writes still `studentProductAuth`; vault/me/password/logout/privacy remain capability-neutral)
- `phase17d1CapabilityFoundation.test.js` — 101 assertions
- `phase17d1r1RoleAndRegistration.test.js` — 39 assertions
- `applicationAuthority.test.js`
- `phase3StudentApplicantPortal.test.js` — 65 checks
- `userSecureAuthFlows.test.js` — 61 assertions (role change still revokes families with `role_changed` and now applies PRESERVE transition)

Staff without an explicit student grant still has no Student product authority. Dual-use only when a preserved/explicit student grant exists.

---

## 14. B2B regression

- `authCookiePolicy.test.js` — 115 assertions (four refresh cookies; no fifth GBS cookie)
- `authRealm.test.js`
- `employerAuthRealmIsolation.test.js`
- `employerSecureAuthFlows.test.js` — 39 assertions
- `agentSecureAuthFlows.test.js`
- `institutionSecureAuthFlows.test.js`
- `client/src/__tests__/phase17d0WorkspaceContext.test.js` — 73 assertions

`activeWorkspace` remains UX-only. No server authority. No fifth auth realm.

---

## 15. Database mutation statement

- Live User/Org capability backfill: **not executed** (CLI still refuses live apply)
- Persistent `edurozgaar` User/Organization documents: **not migrated**
- `ensureAdminOnBoot` at rebuild: **skipped** (`ADMIN_EMAIL/ADMIN_PASSWORD not set`)
- Isolated test databases `strideto_17d1r1_integrity_run1` / `run2` were created on staging Mongo **as separate DB names**, dropped after tests
- No writes to persistent application collections for this closure

---

## 16. Runtime health

Rebuild (api-a / api-b only; no Mongo/Redis/Caddy/Mailpit recreate):

```
docker compose --env-file .env.staging -f docker-compose.staging.yml -f docker-compose.sec3f-local.yml -f docker-compose.appenv-align.yml up -d --no-deps --force-recreate --build api-a api-b
```

| Endpoint | Result |
| --- | --- |
| api-a `GET /api/health` | 200 |
| api-a `GET /api/health/ready` | 200 |
| api-b `GET /api/health` | 200 |
| api-b `GET /api/health/ready` | 200 |

api-a log: `admin_ensure_skipped` reason `ADMIN_EMAIL/ADMIN_PASSWORD not set`.

Worker: **STOPPED** (not present in `docker ps`; not recreated).

---

## 17. Tests

| File | Result |
| --- | --- |
| `phase17d1r1RoleAndRegistration.test.js` | 39 passed |
| `phase17d1r1SourceContract.test.js` | 38 passed |
| `phase17d1r1ConcurrencyIdempotency.mongo.test.js` | 6 passed (isolated Mongo) |
| `phase17d1CapabilityFoundation.test.js` | 101 passed |
| `phase17d1ProviderAndPlatform.test.js` | 41 passed |
| `phase17d1StudentRouteAuthority.test.js` | 74 passed |
| `userSecureAuthFlows.test.js` | 61 passed |
| `authCookiePolicy.test.js` | 115 passed |
| `authRealm.test.js` / employer isolation / Employer/Agent/Institution flows | passed |
| `applicationAuthority.test.js` / `phase3StudentApplicantPortal.test.js` | passed |
| `phase17d0WorkspaceContext.test.js` | 73 passed |

Success conditions 1–37: closed as follows.

ROLE TRANSITIONS 1–6: proven.  
REGISTRATION 7–11: proven.  
CONCURRENCY 12–15: proven against isolated Mongo.  
IDEMPOTENCY 16–24: proven (in-memory rejected for high-value; Mongo unique reservation; multi-instance; replay; 409; IN_PROGRESS; crash window; bounded TTL).  
REGRESSION 25–33: proven.  
34–37: no push, no deploy, 17D-2 not started, 18 not started.

---

## 18. Commits

1. `3827e76` — `fix(auth): harden role transition capability integrity`
2. `2401f99` — `fix(platform): make concurrency and idempotency multi-replica safe`
3. (this report) `docs(release): record phase 17d-1r1 integrity closure`

WIP and protected files were not included.

---

## 19. Current HEAD

Recorded after this docs commit (see `git log -1` on `main`). Parent platform commit: `2401f99`.

---

## 20. Working tree

Tracked WIP remains dirty and unstaged:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`

Protected untracked files remain untracked.

---

## 21. Worker

**STOPPED**

---

## 22. Push / deploy

Push: **NO**  
Deployment: **NO**

---

## 23. Phase 17D-2 status

**NOT STARTED.** No jurisdiction catalog, official-source, provider-review UI, listing CRUD, or Business Services pages.

---

## 24. Phase 18 status

**NOT STARTED.**

---

Capability backfill executed: **NO**

Persistent Strideto Mongo migrated: **NO**

GBS UI: **NONE**

Public GBS routes: **NONE**

Worker: **STOPPED**

Push: **NO**

Deployment: **NO**

Phase 17D-2: **NOT STARTED**

Phase 18: **NOT STARTED**
