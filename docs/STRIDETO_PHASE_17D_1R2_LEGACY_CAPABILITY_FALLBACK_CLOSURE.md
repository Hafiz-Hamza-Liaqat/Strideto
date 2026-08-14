# STRIDETO PHASE 17D-1R2
LEGACY CAPABILITY FALLBACK ISOLATION

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

- Expected HEAD at start: `009c62436bbb4b486fcae40dd98124fa172f43f3`
- Confirmed: `009c624` `docs(release): record phase 17d-1r1 integrity closure` on `main`
- Architecture documents were not reopened.
- Known tracked WIP left untouched:
  - `client/src/components/admin/AdminDataTable.jsx`
  - `client/src/components/admin/AdminTableFilters.jsx`
  - `client/src/components/common/FormField.jsx`
- Protected/local files never staged:
  - `docker-compose.appenv-align.yml`
  - `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
  - `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- Older stash left untouched: `stash@{0}: On main: wip: AdminTableFilters values wiring (pre-phase-10)`
- No push, no deploy, no worker start, no live backfill

---

## 2. Exact partial-registration risk analysis

**Pre-fix path (17D-1 / 17D-1R1):**

1. `POST /api/auth/register` → `User.create({ role: 'User' })`
2. `capabilitySchemaVersion` defaults to `0`; no initialization-state field
3. `initializeCustomerUser` writes the student grant, verifies it, then marks schema `1`
4. Only then: referral, verification email, HTTP 201

If step 3 failed after step 1:

- The handler did **not** return a successful initialized 201 (17D-1R1 already proved this)
- The User row **survived**
- `classifyLegacyUserAccount` treated `role === 'User'` + schema `< 1` as a genuine historical Student
- `resolveUserCapabilities` therefore injected effective `student`

That surviving account could later obtain Student authority through:

- `resolveUserCapabilities()` directly
- login (session is User-realm; Student product middleware then resolved capabilities from Mongo)
- refresh (same: JWT has no capability fields; `loadUserRecordForAuth` reads schema version from Mongo)
- email verification / resend (neither grants capability, but neither blocked later Student product once a session existed)

Frontend navigation was irrelevant. The legacy bridge was the authority leak.

**Fix required. Implemented.**

---

## 3. Legacy vs capability-era classification

| Record | Eligibility |
| --- | --- |
| Historical User, field unset / `legacy`, schema `< 1`, role `User` | legacy-eligible → effective student until controlled backfill |
| Historical staff, field unset, schema `< 1` | no student |
| Ambiguous role | deny |
| New registration `pending` or `failed` | **no** legacy fallback; persisted grants only |
| `ready` or schema `>= 1` | persisted grants only (including intentional zero grants) |

Missing field on existing Mongo documents is treated as historical. A mongoose default was **not** added, because it would reclassify historical rows on load.

---

## 4. Selected mechanism

**Option A (explicit state), minimal.**

`User.capabilityInitializationState`: `legacy | pending | ready | failed`

- No schema default
- New `User.create` on Student register / staff invite / ensureAdmin create / seed writes `pending` before grant/init
- Successful init writes `ready` together with `capabilitySchemaVersion = 1`
- Grant-write failure writes `failed`
- Grant-success / schema-mark failure leaves the account not-`ready` (still `pending`); explicit grant may remain; retry completes `ready`

No creation-date heuristic. No transactions. No broad schema churn.

---

## 5. User model impact

`server/src/models/User.js` gained `capabilityInitializationState` (optional enum, indexed, **no default**).

Existing `edurozgaar` User documents were **not** rewritten. Unset continues to mean historical legacy-eligible.

`capabilityInitializationState` is in the untrusted grant-mass-assignment denylist. Request bodies cannot set it. JWT does not carry it. Student product auth loads it from Mongo via `loadUserRecordForAuth`.

---

## 6. Resolver behavior

`classifyLegacyUserAccount` no longer means simply `role === 'User' && schema < 1`.

Effective legacy student requires:

- historical legacy eligibility (unset/`legacy`)
- `role === 'User'`
- schema not initialized
- not fail-closed

Capability-era `pending`/`failed` → `capability_era_incomplete`, `usePersistedGrants: true`, `effectiveStudent: false`.

Initialized / `ready` → persisted grants only.

Unknown initialization-state value → ambiguous deny.

---

## 7. Registration failure behavior

`User.create` now sets `capabilityInitializationState: 'pending'`.

Grant-write failure:

- registration does not report success
- state becomes `failed`
- no student grant
- resolver: no legacy student

Grant success / schema mark failure:

- no 201
- grant may remain
- state is not `ready` / not `legacy`
- retry of `initializeCustomerUser` is idempotent (unique `(userId, capability)`), then `ready`

Successful path: one active student grant, schema `1`, state `ready`.

Staff create: `pending` then `ready`, zero student grants.

`business_client` is never auto-granted.

---

## 8. Anti-enumeration recovery

Existing-email responses remain generic 201.

Compensation calls `initializeCustomerUser` **only** when `shouldRetryCapabilityEraRegistration(existing)` is true:

- `role === 'User'` **and**
- state is `pending` or `failed`

It does **not** run for:

- historical uninitialized `role === 'User'` (no longer treated as a new failed registration)
- staff
- initialized zero-grant accounts

Compensation failure is still swallowed so existence is not leaked.

---

## 9. Backfill compatibility

`classifyUserForBackfill` still uses `classifyLegacyUserAccount`.

- Historical genuine Student → still a grant candidate
- Historical staff → initialize, no student
- Pending/failed capability-era registration → `skippedCapabilityEraIncomplete` (not treated as historical Student)
- Initialized zero-grant → skip
- Ambiguous → skip

CLI still throws `Live User capability backfill is not permitted in Phase 17D-1`. **Not executed.**

---

## 10. Role-transition compatibility

17D-1R1 semantics preserved:

- `ROLE != CAPABILITY`
- default `PRESERVE_EXISTING_CAPABILITIES`
- staff→User initialized zero grants → no legacy fallback
- User→staff → no new student / `business_client`

Role mutation on a `pending` registration marks schema `ready` with preserved grants (none unless they already existed). It does **not** write `legacy`.

---

## 11. Security tests

`phase17d1r2LegacyFallbackIsolation.test.js` — 52 assertions covering matrix items 1–16.

Also reran:

- `phase17d1CapabilityFoundation.test.js` — 106 (pending classification + backfill skip)
- `phase17d1r1RoleAndRegistration.test.js` — 39
- `phase17d1r1SourceContract.test.js` — 38
- `phase17d1StudentRouteAuthority.test.js` — 76
- `phase17d1ProviderAndPlatform.test.js` — 41
- `phase17d1r1ConcurrencyIdempotency.mongo.test.js` — 6 (isolated DB `strideto_17d1r1_integrity_r2`, dropped after)
- Student apply / auth cookie / realm / Employer / Agent / Institution / 17D-0 workspace

---

## 12. Idempotency crash-window future invariant

Documented on `shared/platform/idempotency.js`:

Mongo idempotency reservation prevents duplicate command execution across api-a/api-b, **but** a future domain command whose side effect is durably committed before the idempotency record is marked `COMPLETED` must itself be replay-safe, using at least one of:

- domain object stores a unique commandId / idempotency reference
- unique domain constraint makes repeated mutation a no-op or conflict
- business mutation + idempotency completion occur in the same supported transaction where appropriate
- external provider operation uses its own idempotency mechanism

`IdempotencyRecord` alone does not provide exactly-once semantics across arbitrary crash boundaries. Payments remain deferred. No distributed transaction engine was added.

---

## 13. Database mutation statement

- Live capability backfill: **NO**
- Persistent `edurozgaar` User/Organization documents: **not migrated**
- Schema field added in source only; existing rows keep an unset field (= historical)
- `ensureAdminOnBoot` skipped (`ADMIN_EMAIL/ADMIN_PASSWORD not set`)
- Isolated test DB only; dropped after tests

---

## 14. Runtime health

api-a / api-b rebuilt only. Worker **STOPPED**.

| Endpoint | Result |
| --- | --- |
| api-a `GET /api/health` | 200 |
| api-a `GET /api/health/ready` | 200 |
| api-b `GET /api/health` | 200 |
| api-b `GET /api/health/ready` | 200 |

---

## 15. Commits

1. `8c6e442` — `fix(auth): isolate legacy student fallback from new registrations`
2. (this report) `docs(release): record phase 17d-1r2 legacy fallback closure`

---

## 16. Current HEAD

Recorded after the docs commit (`git log -1` on `main`).

---

## 17. Working tree

Tracked WIP remains dirty and unstaged (AdminDataTable / AdminTableFilters / FormField). Protected files remain untracked.

---

## 18. Worker

**STOPPED**

---

## 19. Push / deploy

Push: **NO**  
Deployment: **NO**

---

## 20. Phase 17D-2

**NOT STARTED**

---

## 21. Phase 18

**NOT STARTED**

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
