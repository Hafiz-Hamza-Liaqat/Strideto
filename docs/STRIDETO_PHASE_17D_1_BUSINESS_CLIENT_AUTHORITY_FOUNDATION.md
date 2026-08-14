# STRIDETO PHASE 17D-1
BUSINESS CLIENT AUTHORITY & GBS FOUNDATION

This is **not** Phase 17D-2. This is **not** Phase 18.

Capability backfill executed: **NO**

Persistent Mongo data modified by migration: **NO**

Business Services UI implemented: **NO**

Public GBS routes: **NO**

Payments: **NOT_CONFIGURED**

Malware scanner: **NOT IMPLEMENTED**

Provider HSI sharing: **NOT ENABLED**

KMS/envelope encryption runtime: **NOT IMPLEMENTED**

WAF/CDN: **NOT IMPLEMENTED**

Turnstile: **NOT_CONFIGURED**

Worker: **STOPPED**

Push: **NO**

Deployment: **NO**

Phase 18: **NOT STARTED**

---

## 1. Baseline

- Expected pre-checkpoint HEAD: `f3c33e11e6e8db8cc2e613e17726b259076220c4`
- Confirmed: `f3c33e1` `docs(product): record phase 17d-0 dashboard identity separation` on `main`
- Known tracked WIP left untouched:
  - `client/src/components/admin/AdminDataTable.jsx`
  - `client/src/components/admin/AdminTableFilters.jsx`
  - `client/src/components/common/FormField.jsx`
- Protected/local-only files never staged:
  - `docker-compose.appenv-align.yml`
  - `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
  - `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- Older stash left untouched: `stash@{0}: On main: wip: AdminTableFilters values wiring (pre-phase-10)`
- Worker: **STOPPED** (`edurozgaar-staging-worker-1` Exited 0) before and after rebuild
- `git stash -u` was not used
- No push, no deploy

---

## 2. Architecture checkpoint commit

`96515a5f4671e1e12c3f183254c280ebdd175d55`

`docs(product): lock global business services architecture`

Staged files were **only**:

- `docs/STRIDETO_PHASE_17D_A_GLOBAL_BUSINESS_SERVICES_ARCHITECTURE_GAP_AUDIT.md`
- `docs/STRIDETO_PHASE_17D_B_PRODUCT_AUTHORITY_SECURITY_ARCHITECTURE_LOCK.md`

Architecture was not reopened. Implementation followed the frozen lock (including 17D-BR1). No contradiction requiring a stop was found.

---

## 3. Repository authority audit

### User / auth

- Model: `server/src/models/User.js`
- Student customer role: `'User'` (`ROLES.STUDENT` in `server/src/config/rbac.js`)
- Staff: `'Editor' | 'Moderator' | 'Admin' | 'SuperAdmin'` via `STAFF_ROLES` / `isStaffRole`
- No `isStaff`, `accountType`, `banned`, or `disabled` fields
- Authoritative security fields: `accountStatus: 'active' | 'suspended'`, `tokenVersion`
- Same JWT realm `user` for students and staff. `requireUserAuth` means “User-realm, not Employer” and **does not exclude staff**
- Student register: `POST /api/auth/register` → `User.create({ role: 'User' })`
- Staff create: invitation accept, `ensureAdminOnBoot` (new Admin only), SuperAdmin provision
- `/api/auth/me`: `requireAuth` + `requireUserAuth` (generic User)
- Session subject state already fails closed on `accountStatus === 'suspended'` (`SessionSubjectStateProvider`)
- Refresh cookies remain four path-scoped cookies (User / Employer / Agent / Institution)

### Organization / Agent

- `Organization.organizationType` is descriptive (`employer | agent | agency | …`)
- Organization `status` includes `suspended` / `archived`
- Employer cookie remains hiring-only
- Agent marketplace interest was a User-realm student product write (now student-gated)
- No `requireAgentCapability` middleware existed; 17D-1 does not invent Agent-cookie GBS buyer authority

### Security foundation reused

- `auditService` / `AuditLog` — extended with a catalog, not a parallel log
- Request IDs already exist (`requestId` middleware)
- Institution admission `expectedVersion` → 409 is the existing concurrency recipe; 17D-1 adds a reusable `recordVersion` helper rather than retrofitting unrelated models
- Commerce fingerprint/idempotency exists in payments; 17D-1 adds a generic command store without payment behavior
- Trust vocabulary reused: `claimed != evidence_submitted != evidence_backed != verified`

---

## 4. Existing User classification findings

Server-authoritative evidence only:

| Evidence | Classification | Student grant |
|---|---|---|
| `role === 'User'` and `capabilitySchemaVersion < 1` | Genuine legacy Student/customer | Effective `student` via compatibility resolver |
| `role` in staff set and uninitialized | Staff/admin-only | **NO** student |
| Unknown/empty role | Ambiguous | Fail closed |
| `capabilitySchemaVersion >= 1` | Initialized | Persisted grants only (zero grants stays zero) |
| `activeWorkspace` / localStorage / nav | Not evidence | Ignored |

`User` document existence is **not** student evidence. Staff share the User collection.

---

## 5. User Capability Registry

Canonical source-controlled registry: `shared/capability/userCapabilities.js`

Initial IDs:

- `student`
- `business_client`

Additive future IDs are permitted. Unknown IDs **DENY**. Unknown is never coerced to `student`.

Authority is not represented as `activeWorkspace`, localStorage, frontend role, or last-visited route.

---

## 6. User capability grant model

Persistence: `UserCapabilityGrant` (Mongo), unique `(userId, capability)`.

Lifecycle: `active | suspended | revoked` with provenance (`grantedAt/By/Reason`, suspend/revoke fields, `policyVersion`, retained `history`).

- Only `status=active` authorizes
- Suspended/revoked do not authorize
- Users cannot self-edit grants
- Request bodies cannot set grant metadata (`stripUntrustedGrantFields`)
- No public self-grant endpoint for `business_client`

`User.capabilitySchemaVersion`:

- `0` / missing = uninitialized (legacy resolver may apply)
- `>= 1` = initialized; grants are authoritative including an intentional empty set

---

## 7. Legacy compatibility resolver

Temporary bridge in `classifyLegacyUserAccount` + `resolveUserCapabilities`.

Uninitialized genuine `role === 'User'` → effective `student`.

Uninitialized staff → no student.

Initialized (including staff-only with zero grants) → **no** fall-through to legacy student.

This is **not** permanent authorization architecture. It exists so the current runtime is not broken before a controlled DB migration is approved.

---

## 8. Backfill utility

Created:

- `server/src/scripts/backfillUserCapabilities.js`
- `server/src/scripts/backfillOrganizationCapabilities.js`

Behavior:

- DRY-RUN by default
- `--apply` plus `STRIDETO_CAPABILITY_BACKFILL_CONFIRM=1` required to write
- CLI `main()` **refuses live execution in Phase 17D-1** even if flags are set
- Counts only; no secrets
- Same classification helper as runtime
- Never grants `business_client`
- Staff/admin-only: initialize schema, no student
- Agency/institution: org script does **not** grant `business_services_provider`
- Employer org type → `employer` capability only (when explicitly applied later)
- Batched conceptually (`BATCH_SIZE = 200`)
- Ambiguous accounts skipped

**Executed: NO**

**Persistent Mongo modified by migration: NO**

---

## 9. New User grant behavior

| Creation path | Grant |
|---|---|
| `POST /api/auth/register` | Explicit active `student` + `capabilitySchemaVersion=1` |
| Staff invitation accept | Schema initialized, **no** student |
| `ensureAdminOnBoot` **create** | Schema initialized, **no** student |
| `ensureAdminOnBoot` **update** of existing admin | Grants **not** mutated (no live backfill) |
| `seedUsers.js` | Students get student; admin gets staff init |
| Business Client registration | **NOT IMPLEMENTED** |

No public endpoint accepts `capability` / `grantedBy` / `policyVersion` from the body.

---

## 10. Organization capability grants

Registry: `employer`, `business_client`, `business_services_provider`.

`organizationType` remains descriptive and **does not authorize**.

An Organization may later hold `employer` + `business_client` without duplication.

Employer-cookie authority was not modified.

No silent `business_client` for employers. No silent `business_services_provider` for agencies.

---

## 11. Global security deny

Normalized decision: `usable` | `security_denied` (`shared/security/securityAccess.js`).

Reuses existing `accountStatus` / organization `status`. Does not invent a second suspension system.

Denied actions: READ, WRITE, DOWNLOAD, TRANSITION, GRANT, ADMINISTRATIVE_ACTION.

Global deny short-circuits **before** ordinary capability checks. Retention of data does not grant access.

Existing auth already rejects suspended User subjects (`SUBJECT_INACTIVE`). The authorizer is defense-in-depth for service-layer evaluation (including Organization `suspended`/`archived`).

---

## 12. Source-controlled Permission Policy

`shared/capability/permissionPolicy.js` — `policyVersion` `17d-1.0`.

Core actions (not Admin-editable content):

- Student application/product write → active User `student`
- GBS buyer action → active User `business_client`
- GBS organization buyer → User `business_client` + membership + Organization `business_client`
- GBS provider action → Agent realm + exact ProviderCapability subject
- Admin provider verification → staff RBAC
- Employer cookie → never GBS buyer authority

Operational config (rate limits, SLAs, feature flags) remains separate. `BUSINESS_SERVICES_ENABLED` defaults **OFF**.

---

## 13. Shared Authorizer

Evaluation order implemented by `authorizeAction`:

1. Authentication
2. Global/account security state
3. Required active capability grant
4. Membership / tenant
5. Object authorization
6. Workflow / policy
7. (Abuse/budget reserved for later product routes)
8. Optimistic concurrency (separate helper)
9. Perform + audit (grant services emit catalogued events)

Helpers: `resolveUserCapabilities`, `hasActiveUserCapability`, org equivalents, `resolveSecurityAccess`, `requireActiveUserCapability`, `authorizeGbsBuyerAction`, `authorizeGbsOrganizationBuyerAction`.

Request-scoped cache on `req` only. No cross-request authorization cache.

`activeWorkspace` / preference / `X-Active-Workspace` have **zero** authority.

---

## 14. Existing Student write route inventory

Classification key:

- **A** Student product (requires active `student`)
- **B** Generic User account/security
- **C** Staff/admin
- **D** Public / non-auth
- **E** Capability-neutral User-realm

| ROUTE | METHOD | PRODUCT DOMAIN | CURRENT AUTH | REQUIRED CAPABILITY | CLASS | CHANGED | TEST |
|---|---|---|---|---|---|---|---|
| `/api/jobs/:id/apply` | POST | Job apply | User-realm | `student` | A | YES | route contract |
| `/api/jobs/:id/save` | POST/DELETE | Saved jobs | User-realm | `student` | A | YES | route contract |
| `/api/scholarships/:id/save` | POST/DELETE | Saved scholarships | User-realm | `student` | A | YES | route contract |
| `/api/admissions/:id/save` | POST/DELETE | Saved admissions | User-realm | `student` | A | YES | route contract |
| `/api/internships/:idOrSlug/apply` | POST | Internship apply | User-realm | `student` | A | YES | route contract |
| `/api/internships/:id/save` | POST/DELETE | Saved internships | User-realm | `student` | A | YES | route contract |
| `/api/intl-scholarships/:id/save` | POST/DELETE | Saved intl scholarships | Auth only → User+student | `student` | A | YES (also added requireUserAuth) | route contract |
| `/api/applications*` | * | Opportunity tracker | User-realm | `student` | A | YES | route contract |
| `/api/journey/*` | * | Action engine / Journey | User-realm | `student` | A | YES | route contract |
| `/api/talent/me*` | * | Talent profile | User-realm | `student` | A | YES | route contract |
| `/api/resumes*` | * | Student resumes | User-realm | `student` | A | YES | route contract |
| `/api/documents*` | * | Student documents | User-realm | `student` | A | YES | route contract |
| `/api/credentials*` | * | Student credentials | User-realm | `student` | A | YES | route contract |
| `/api/scoring*` | * | Career scoring | User-realm | `student` | A | YES | route contract |
| `/api/assessments*` (talentAuth) | * | Assessments | User-realm | `student` | A | YES | route contract |
| `/api/timeline*` | GET | Timeline | User-realm | `student` | A | YES | route contract |
| `/api/career/dashboard*` | * | Career dashboard | User-realm | `student` | A | YES | route contract |
| `/api/budget/plans*` | * | Budget planner | User-realm | `student` | A | YES | route contract |
| `/api/personalization*` | GET | Personalization | User-realm | `student` | A | YES | route contract |
| `/api/copilot/*` | * | Student copilot | User-realm | `student` | A | YES | route contract |
| `/api/chatbot/*` | * | Chatbot | User-realm | `student` | A | YES | route contract |
| `/api/badges/me`, `/rank` | GET | Badges | User-realm | `student` | A | YES | route contract |
| `/api/skill-claims*` (applicant) | * | Skill claims | User-realm | `student` | A | YES | route contract |
| `/api/users/resume-analyze` | POST | Resume analyzer | Auth only → User+student | `student` | A | YES | route contract |
| `/api/users/cover-letter` | POST | Cover letter | Auth only → User+student | `student` | A | YES | route contract |
| `/api/users/applications` | GET | My applications | Auth only → User+student | `student` | A | YES | route contract |
| `/api/webinars/:id/register` | POST | Webinar register | Auth only → User+student | `student` | A | YES | route contract |
| `/api/quizzes/submit` | POST | Quiz submit | Auth only → User+student | `student` | A | YES | route contract |
| `/api/commerce/orders` (user) | POST | Student marketplace | User-realm | `student` | A | YES | route contract |
| `/api/cases*` (student) | * | Student cases | User-realm | `student` | A | YES | route contract |
| `/api/consultations*` (student) | * | Student consultations | User-realm | `student` | A | YES | route contract |
| `/api/reviews*`, reports, disputes (student) | * | Professional trust | User-realm | `student` | A | YES | route contract |
| `/api/marketplace-payments/service-orders` etc. (user) | POST | Marketplace payments | User-realm | `student` | A | YES | route contract |
| `/api/agents/marketplace/posts/:slug/interest` | POST/DELETE | Marketplace interest | User-realm | `student` | A | YES | route contract |
| `/api/student/institution-admissions*` | * | Institution apply | User-realm | `student` | A | YES | route contract |
| `/api/auth/saved`, `/bookmarks`, `/dashboard`, `/referrals`, `/recently-viewed` | GET/POST | Student dashboard/saves | User-realm | `student` | A | YES | route contract |
| `/api/v1/jobs|scholarships|admissions/:id/save` | POST/DELETE | v1 saves | User-realm | `student` | A | YES | route contract |
| `/api/v1/bookmarks` | GET | v1 saved | User-realm | `student` | A | YES | route contract |
| `/api/auth/me` | GET | Session identity | User-realm | none | B | NO | route contract |
| `/api/auth/profile` | GET/PATCH | Account profile | User-realm | none | B | NO | route contract |
| `/api/auth/change-password` | POST | Security | User-realm | none | B | NO | route contract |
| `/api/auth/logout`, `/logout-all` | POST | Session | User-realm | none | B | NO | route contract |
| `/api/auth/refresh-token` | POST | Session | cookie | none | B | NO | route contract |
| `/api/auth/fcm-token` | POST | Push token | User-realm | none | B | NO | route contract |
| `/api/vault*` | * | Vault | User-realm | none (future BC) | B | NO | route contract |
| `/api/privacy*` | * | Privacy export/delete | User-realm | none | B | NO | route contract |
| `/api/inbox/notifications*` | * | Inbox | Auth | none | E | NO | route contract |
| `/api/announcements*` | * | Announcements | Auth | none | E | NO | route contract |
| `/api/support/tickets*` | * | Support | Auth/optional | none | E | NO | route contract |
| `/api/admin/*` | * | Staff | staff RBAC | staff | C | NO | existing RBAC |
| `/api/auth/register` | POST | Registration | public | n/a | D | grant-on-create only | source + unit |
| Employer/Agent/Institution auth | * | B2B realms | own cookies | n/a | n/a | NO | 30K |

Inventory completed. Enforcement is not partial.

---

## 15. Student capability enforcement

`studentProductAuth = [requireAuth, requireUserAuth, requireStudentCapability]`.

Legacy uninitialized genuine students still pass via the compatibility resolver (no live backfill required).

Staff-only Users without an active `student` grant are denied on class A routes.

Business-client-only Users will be denied on class A routes (foundation + tests). Generic B/E routes remain available to any authenticated User-realm principal that is not security-denied.

---

## 16. Business Client capability foundation

No fake GBS product routes were added.

Future GBS buyer actions use `POLICY_ACTIONS.GBS_BUYER_ACTION` / `requireBusinessClientCapability`.

Tests prove:

- student-only → GBS denied
- business-client-only → GBS allowed at capability layer; Student write denied
- dual-capable → each action checks independently
- `activeWorkspace=business_client` without grant → denied
- preference value → zero server authority
- Employer cookie → cannot GBS buyer authorize
- organizationType=employer without org `business_client` grant → GBS org buyer denied

---

## 17. ProviderCapability subject model

`subjectType: agent | organization` + `subjectId`.

Independent Agents do not need a fake Agency.

Agent capability is not copied to Agency. Agency capability is not copied to personal Agent credentials. Membership does not mint a personal ProviderCapability.

Scope uses opaque registry IDs (no full jurisdiction catalog). Fields include service/category, country, jurisdiction, entity type, protected title, RA/RO flags, trust status, evidence refs, review metadata, `schemaVersion`, `recordVersion`.

No public/provider CRUD UI. No public self-verification route.

---

## 18. Provider Trust integration

Trust states: `claimed | evidence_submitted | evidence_backed | verified | suspended | revoked`.

`CLAIMED != EVIDENCE_SUBMITTED != EVIDENCE_BACKED != VERIFIED`.

`isVerified: true` is **not** authoritative.

Organization Verified does not automatically verify ProviderCapability.

Listing subset requires **active + verified**.

---

## 19. Listing subset authorization

`authorizeListingScope`: requested listing scope ⊆ active verified same-subject capability.

Proven:

- WY formation → WY formation allowed
- WY formation → DE formation denied
- WY formation → WY Registered Agent denied unless RA flag/capability exists
- Agent capability → Agency listing denied
- Agency capability → Agent listing denied
- suspended / revoked / unverified → denied

Frontend filtering is irrelevant.

---

## 20. Tenant/object authorization foundation

`authorizeTenantScope({ principalTenantId, resourceTenantId })`.

Unknown relationship → DENY. Wrong tenant A→B → DENY. Sequential public IDs are not treated as authority.

---

## 21. Optimistic concurrency

Reusable `assertExpectedVersion` / `applyOptimisticMutation`. Stale → **409** `optimistic_concurrency_conflict`. Version increments only on success. Applied helper exists for `ProviderCapability.recordVersion`. Unrelated legacy models were not broadly retrofitted.

Tests: correct version, stale version, two competing updates (one wins), no silent overwrite.

---

## 22. Idempotency

`createIdempotencyStore` with principal/tenant/command/key/fingerprint, bounded 7-day TTL.

Same key + same fingerprint → one effect (replay). Same key + different fingerprint → 409 conflict. Concurrent duplicates serialize to one logical effect.

No secrets/full bodies stored. No payment behavior. Browser memory is not the authority.

Mongo `IdempotencyRecord` model exists for later high-value commands (TTL index). Foundation tests use the in-process store (isolated; no live DB).

---

## 23. Quote revision foundation

Contract only: `shared/gbs/quoteContract.js`.

Fields: `quoteNumber`, `revision`, `status`, `currency`, `lineItems`, fee buckets, `issuedAt`, `expiresAt`, snapshots, `schemaVersion`, `recordVersion`.

Sent/accepted revisions are immutable except privileged audited correction. Material change allocates a new revision. Accept is a future idempotent command. No payment side effect. No Quote persistence/UI/routes.

---

## 24. Minimal GBS contracts/registries

- Vertical id `business_services`
- Case-family id `business_services`
- Provider subject types
- User/Org capability IDs
- Provider trust types
- Schema version `17d-1.0`
- Command/action IDs
- Permission policy actions
- Feature flag `BUSINESS_SERVICES_ENABLED` default OFF

No PK/US/UK jurisdiction catalogs. No public country content. No hardcoded UI pages. No `/business` or `/business-services` in `pageRegistry`.

---

## 25. Security/audit events

Catalog `shared/security/gbsAuditEvents.js` reused with `logAudit` / `AuditLog`:

`user_capability_granted|suspended|revoked`, `organization_capability_granted|suspended|revoked`, `capability_denied`, `security_denied`, `tenant_denied`, `provider_capability_claimed|reviewed|suspended|revoked`, `listing_scope_denied`, `optimistic_concurrency_conflict`, `idempotency_replay`, `idempotency_conflict`.

Redaction strips password/JWT/refresh/cookies/DEK/KEK/passport/national ID/document contents.

---

## 26. Abuse/resource impact

No new public GBS business flow, so no new public rate limits.

Backfill is batched and not executed. Capability lookups are indexed (compound unique + status). Request-scoped capability resolution only. Idempotency TTL 7 days. Existing Student-write rate limiters preserved. No N+1 invented beyond one User read + grant query per gated request (revocation-prompt; no cross-request cache).

---

## 27. Backward compatibility

Genuine uninitialized Student/customer Users keep effective `student` without backfill.

Staff-only uninitialized Users do **not** gain student.

Initialized zero-grant Users do **not** fall through.

New registrations get explicit grants.

Vault/privacy/me/logout/password remain usable without `student`.

17D-0 `strideto-active-workspace` remains UX-only.

---

## 28. B2B realm regression

Employer / Agent / Institution auth unchanged.

Cookie paths unchanged:

- `/api/auth/refresh-token`
- `/api/auth/employer/refresh-token`
- `/api/auth/agent/refresh-token`
- `/api/auth/institution/refresh-token`

No fifth cookie. No formation-provider realm. No universal token. Tests: `authCookiePolicy`, `authRealm`, agent/employer/institution secure-auth, 17D-0 workspace contract.

---

## 29. Runtime health

Rebuilt **only** `api-a` and `api-b` with:

```
docker compose --env-file .env.staging -f docker-compose.staging.yml -f docker-compose.sec3f-local.yml -f docker-compose.appenv-align.yml up -d --no-deps --force-recreate --build api-a api-b
```

No `docker compose down`, no `-v`, no prune.

| Service | Status |
|---|---|
| frontend | healthy |
| api-a | healthy |
| api-b | healthy |
| mongodb | healthy |
| redis | healthy |
| mailpit | healthy |
| caddy | running |
| worker | STOPPED (Exited 0) |

`GET /api/health` → **200**

`GET /api/health/ready` → **200**

No unexpected startup 5xx on focused health reads. Cloudinary-not-configured warning is pre-existing. Duplicate Mongoose index warnings on boot are pre-existing on other models; 17D-1 grant/provider indexes were de-duplicated.

Frontend image was not rebuilt (no GBS UI; client does not import the new shared modules). Local `npm run build` in `client/` succeeded.

---

## 30. Database mutation statement

Capability backfill executed: **NO**

Persistent Mongo data modified by migration: **NO**

Tests used in-memory fixtures only.

`ensureAdminOnBoot` skipped at runtime (`ADMIN_EMAIL/ADMIN_PASSWORD not set`). Existing persistent users were not rewritten.

---

## 31. UI/theme statement

No Business Services page, dashboard, navigation item, table, or form UI.

Appendix-B visual matrix: **NOT APPLICABLE** (no new GBS visual surface).

No frontend visual files were modified by this phase. Known WIP (`AdminDataTable.jsx`, `AdminTableFilters.jsx`, `FormField.jsx`) remains untouched.

---

## 32. Tests

Phase 17D-1 focused:

| File | Assertions |
|---|---|
| `phase17d1CapabilityFoundation.test.js` | 99 |
| `phase17d1ProviderAndPlatform.test.js` | 39 |
| `phase17d1StudentRouteAuthority.test.js` | 72 |
| **17D-1 total** | **210** |

Regression (passed):

- `authCookiePolicy.test.js` (115)
- `authRealm.test.js`
- `phase17cAuthority.test.js` (32)
- `phase17cvrResidualAuthority.test.js` (15)
- `phase17d0WorkspaceContext.test.js` (73)
- `userSecureAuthFlows.test.js` (58)
- `agentSecureAuthFlows.test.js`
- `employerAuthRealmIsolation.test.js`
- `institutionSecureAuthFlows.test.js`
- `auth.test.js`

Module graph: `scripts/verify-module-link-integrity.mjs` → **ok** (1790 modules).

Touched-file eslint: pass after test-file lint fixes.

Frontend production build: **ok**.

Matrix 30A–30K covered by the focused tests above.

---

## 33. Actual findings

1. `requireUserAuth` historically meant “not Employer”, so staff could hit Student product APIs. 17D-1 closes that for class A routes via `student` capability.
2. Several Student writes (`intl-scholarships` save, resume-analyze, cover-letter, webinar register, quiz submit) lacked `requireUserAuth`; they now use the full `studentProductAuth` chain.
3. Vault is correctly **not** Student-only (future Business Client).
4. No existing User capability/accountType field existed; `capabilitySchemaVersion` was required to distinguish uninitialized vs intentional zero grants.
5. Organization type cannot authorize; employer orgs do not auto-receive GBS buyer or provider capabilities.
6. Architecture lock and implementation did not contradict.

---

## 34. Remaining gaps

- Live User/Org capability backfill is created but **not approved/executed**.
- No GBS product records (Service Request, Quote persistence, Case, listings).
- ProviderCapability has no staff review API yet.
- `changeUserRole` User↔staff transitions are not auto-grant/revoke in this phase (documented; fail-closed for initialized staff).
- Cross-request revocation of in-flight access tokens still follows existing 15-minute access-token / `tokenVersion` auth (unchanged). Capability reads are per-request from Mongo.

---

## 35. Deferred items

Phase 17D-2 Jurisdiction Intelligence; public Business Services pages; `/business` dashboard; Agent Business Services UI; Service Request / Quote / Case product; Mailroom; Stripe/payments/payout/escrow; KMS/envelope encryption; malware scanner; WAF/CDN; Turnstile activation; government integrations; AI advice/authorization; Phase 18.

Provider HIGHLY_SENSITIVE_IDENTITY sharing remains disabled. `not_configured` scanner is **not** treated as safe.

---

## 36. Commits

1. `96515a5f4671e1e12c3f183254c280ebdd175d55` — `docs(product): lock global business services architecture`
2. `25f9ccf03cc03c777808c68e0a9f261774e894be` — `feat(auth): add auditable user and organization capability grants`
3. `fcae9223c4ae88b8ce362ec7120ebb0964d3a1ee` — `feat(security): enforce source-controlled capability authorization`
4. `526ba88b83c13ffca80d2b8580acf7b1ed2b35bf` — `feat(gbs): add provider capability authority foundation`
5. `40c2cb8ef816a376b3fd028369bc0fd4488a1477` — `feat(platform): add concurrency and idempotency foundations`
6. (this report) `docs(release): record phase 17d-1 authority foundation`

---

## 37. Current HEAD

Recorded after the report commit in §36/§37 of the working tree at commit time. Implementation HEAD before this report: `40c2cb8ef816a376b3fd028369bc0fd4488a1477`.

---

## 38. Working tree

Expected after this report commit:

Tracked WIP (uncommitted, untouched):

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`

Untracked protected/local:

- `docker-compose.appenv-align.yml`
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

---

## 39. Worker

**STOPPED** (`edurozgaar-staging-worker-1` Exited 0, 10 days). Not started.

---

## 40. Push/deployment

Push: **NO**

Deployment: **NO**

---

## 41. Phase 18

**NOT STARTED**

---

## Frozen §35 future-phase gate answers

**What new authority was introduced?**  
Server-authoritative User grants (`student`, `business_client`) and Organization grants (`employer`, `business_client`, `business_services_provider`). Student-product writes now require active `student`. GBS buyer authority is a grant, not a workspace preference.

**What new data was introduced?**  
`User.capabilitySchemaVersion`; `UserCapabilityGrant`; `OrganizationCapabilityGrant`; `ProviderCapability`; `IdempotencyRecord` model (unused in live traffic). No product GBS documents.

**What tenant boundary was introduced?**  
Reusable `authorizeTenantScope` deny-by-default. ProviderCapability exact `subjectType+subjectId`. Agent ≠ Agency.

**What abuse path was introduced?**  
None in public product flow. Grant mutation is server-only. Backfill cannot run in 17D-1 CLI.

**What rate/resource limit protects it?**  
Existing Student-write limiters retained. No new public GBS routes. Backfill batched. Idempotency TTL 7 days. Per-request capability resolution.

**What audit event records it?**  
Catalogued grant/deny/listing/concurrency/idempotency events via existing `AuditLog`.

**What recovery impact exists?**  
Legacy resolver keeps genuine Students working without backfill. Staff-only remain without student. Revocation is per-request. No persistent data migrated, so rollback of code restores prior “authenticated User = student-capable” behavior.

**What UI/theme surfaces were added?**  
None.

**What responsive evidence exists?**  
N/A — no new UI.

**What backward compatibility exists?**  
Uninitialized `role=User` → effective student. Generic account/vault/inbox unchanged. Four auth cookies unchanged. 17D-0 workspace UX unchanged.

**Was this security authorization policy or operational configuration?**  
**Security authorization policy** (source-controlled). Feature flag `BUSINESS_SERVICES_ENABLED` is operational and default OFF.

**What concurrency/idempotency protects the mutations?**  
`recordVersion` / 409 CONFLICT helper. Idempotent command store (replay vs fingerprint conflict). Quote sent/accepted revisions immutable.

**If listings changed:** N/A (no listing feature). Subset-of-capability helper is implemented and tested for the future listing phase.

**If Vault/HSI changed:** Vault routes were **not** made Student-only. HSI provider sharing **NOT ENABLED**. Scanner **NOT IMPLEMENTED**. `not_configured` is not treated as safe.

**If catalog/fees changed:** They did not. No jurisdiction/fee catalog in 17D-1.

---

NEXT: USER + CHATGPT REVIEW PHASE 17D-1 BEFORE PHASE 17D-2.
