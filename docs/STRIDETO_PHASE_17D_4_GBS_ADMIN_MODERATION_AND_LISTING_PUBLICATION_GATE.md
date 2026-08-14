# STRIDETO PHASE 17D-4
GBS ADMIN MODERATION & LISTING PUBLICATION GATE READINESS

**PUBLIC MARKETPLACE REMAINS OFF.**

**STRIDETO PHASE 17D-4 IMPLEMENTATION: COMPLETE**

**FUNCTIONAL ACCEPTANCE (service/source/Mongo): PASS**

**BROWSER / ADMIN UI MANUAL ACCEPTANCE: NOT PROVEN / USER MANUAL**

**NATIVE 200% ZOOM: NOT PROVEN / USER MANUAL**

**SCREEN READER: NOT PROVEN / USER MANUAL**

**PHASE 17D-5: NOT STARTED**

**PHASE 18: NOT STARTED**

---

## 1. Baseline HEAD

Starting HEAD: `9ce0c825d7d6c2bd1a6bacd47a174e9169b9644a`

`docs(release): finalize phase 17d-3r acceptance and closure`

Branch: `main`

Protected WIP left untouched:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`

Protected untracked files left untracked:

- `docker-compose.appenv-align.yml`
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

Existing stash left untouched: `stash@{0}: On main: wip: AdminTableFilters values wiring (pre-phase-10)`

Worker remained STOPPED. No push. No deploy.

---

## 2. Phase objective

Create a staff-controlled moderation path for:

- `ProviderCapability` claims
- `GbsServiceListing` submissions

using existing Admin/staff authentication.

This phase prepares listings for **future** publication. It does **not** expose them publicly.

---

## 3. Approved scope

USER + ChatGPT written decision is the canonical 17D-4 contract:

Admin/staff GBS moderation + listing publication-gate readiness. Public marketplace remains OFF.

---

## 4. Explicit exclusions

Not implemented:

- public `/business-services`
- public GBS marketplace cards/search
- Business Client `/business`
- Service Requests
- Quotes product
- Formation Cases
- GBS case messaging
- My Businesses / Mailroom
- payments / billing / payouts / escrow for GBS
- government filing, scanner, KMS, envelope encryption
- HSI Provider sharing
- AI legal/business advice
- domain deletion cascade
- fifth auth realm / buyer cookie
- live catalog import
- production capability verification
- production marketplace activation
- Phase 17D-5 / Phase 18
- Worker execution, push, deploy

No `BUSINESS_SERVICES_ADMIN_MODERATION` flag. Admin auth/policy gates moderation.

---

## 5. Architecture laws preserved

A–O from 17D-3R remain in force, including:

- Provider Domain ≠ professional verification
- Independent ≠ Agency
- frontend context is not authority
- no capability transfer either direction
- listing scope ⊆ same-subject verified `ProviderCapability`
- no fifth cookie
- provider workspace flag ≠ public marketplace flag
- Provider cannot self-verify
- Identity Verified ≠ RA / ACSP / formation verified

---

## 6. Changed models

`GbsServiceListing` (`server/src/models/gbs/GbsServiceListing.js`):

- `adminReviewStatus`: `pending | approved | needs_information | rejected | suspended` (default `pending`)
- `reviewedBy`, `reviewedAt`, `reviewReason`
- index `{ adminReviewStatus, moderationStatus, updatedAt }`

`ProviderCapability`: additive queue indexes only (`trustStatus + updatedAt`, `subjectType + trustStatus + updatedAt`). No live backfill.

---

## 7. Changed services

- `listingPublicationGate.js` — public eligibility uses `isBusinessServicesPublicMarketplaceEnabled`, not `BUSINESS_SERVICES_ENABLED`
- `serviceListingService.js` — create/submit/material re-review reset `adminReviewStatus` to `pending`; publication stays `private`
- `optimisticConcurrency.js` — always strips `publicationStatus`; non-staff cannot set non-pending `adminReviewStatus`
- `providerCapabilityReviewService.js` — already-applied review is a no-op after CAS version check
- **New** `serviceListingReviewService.js` — staff listing approve / needs-information / reject / suspend
- **New** `gbsAdminModerationValidation.js` — allowlisted query/body parsing
- **New** `providerSubjectLabels.js` — Independent = AgentProfile name; Agency = Organization display/legal name; never `memberships[0]`

---

## 8. Admin routes

Mounted at `/api/admin/gbs` under `requireAuth + requireStaff + adminReadLimiter + adminWriteLimiter`.

| Method | Path | Permission |
|---|---|---|
| GET | `/api/admin/gbs/capabilities/queue` | `verification:read` |
| GET | `/api/admin/gbs/capabilities/:id` | `verification:read` |
| POST | `/api/admin/gbs/capabilities/:id/mark-evidence-backed` | `verification:review` |
| POST | `/api/admin/gbs/capabilities/:id/needs-information` | `verification:review` |
| POST | `/api/admin/gbs/capabilities/:id/verify` | `verification:approve` |
| POST | `/api/admin/gbs/capabilities/:id/reject` | `verification:approve` |
| POST | `/api/admin/gbs/capabilities/:id/suspend` | `verification:approve` |
| POST | `/api/admin/gbs/capabilities/:id/revoke` | `verification:revoke` |
| GET | `/api/admin/gbs/listings/queue` | `verification:read` |
| GET | `/api/admin/gbs/listings/:id` | `verification:read` |
| POST | `/api/admin/gbs/listings/:id/needs-information` | `verification:review` |
| POST | `/api/admin/gbs/listings/:id/approve` | `verification:approve` |
| POST | `/api/admin/gbs/listings/:id/reject` | `verification:approve` |
| POST | `/api/admin/gbs/listings/:id/suspend` | `verification:approve` |

No generic `PATCH /admin/gbs/:model/:id`.

---

## 9. Admin policy actions

Reused staff RBAC permissions (`verification:read/review/approve/revoke`).

Source-controlled policy catalog additions:

- `admin.gbs.listing.review` (`POLICY_ACTIONS.ADMIN_GBS_LISTING_REVIEW`) — staff realm, `requireStaffRbac`
- existing `admin.provider.verification` remains capability review policy

Editor cannot approve. Moderator can read/review, not approve. Admin can approve, not revoke. SuperAdmin can revoke.

---

## 10. Capability moderation

Staff-only. Provider cannot set `trustStatus`, `reviewedBy`, `review`, or `status` via claim APIs.

Transitions reuse 17D-2 primitives: mark evidence-backed, verify, needs_information, reject, suspend, revoke.

Verify still requires known GBS `capabilityId`, same-subject row, and accepted evidence where `evidenceRequired`. Organization Verified does not mint formation/RA/ACSP.

---

## 11. Listing moderation

Provider continues to create / edit / submit / archive. Staff gains review only.

Approve re-validates:

- exact subject
- known GBS `capabilityId` (education taxonomy denied)
- same-subject ACTIVE + VERIFIED capability
- listing scope ⊆ capability scope
- 17D-3 pricing/risk record validity

Approve sets `moderationStatus=approved` and `adminReviewStatus=approved`. `publicationStatus` remains `private`. Admin approval does not waive professional authority.

---

## 12. Exact-subject authority

Queue, detail, and writes carry `subjectType` + `subjectId`. Wrong-subject review is 404. Review cannot reassign subjects. Labels resolve Independent vs Agency without `memberships[0]`.

---

## 13. Agency / Independent separation

Mongo disposable fixture: Independent `business_formation` verified through staff review did not change the Agency claim on the same agent’s membership. Wrong-subject verify was 404.

---

## 14. Publication gate

`evaluateListingPublicationGate`:

1. Marketplace flag OFF → `business_services_public_marketplace_disabled` (DENY)
2. archived / suspended / rejected listing → DENY
3. subject / capability / scope / protected-title / facts checks
4. `adminReviewStatus === approved` required
5. ELIGIBLE ≠ publicly discoverable. 17D-4 creates no public routes.

Legacy `BUSINESS_SERVICES_ENABLED=1` cannot expose public listings.

---

## 15. Provider / public flag separation

| Flag | Meaning |
|---|---|
| `BUSINESS_SERVICES_PROVIDER_ENABLED` (compat: `BUSINESS_SERVICES_ENABLED=1`) | Provider onboarding/workspace |
| `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED` | Future public marketplace / publication eligibility |

They are never equivalent.

---

## 16. Marketplace OFF proof

`.env.example` documents `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0`. Source test forbids `=1` in that file. Default helper returns false. Gate DENY while unset.

---

## 17. Public routes absent

No public `/business-services`. Agent nested `/agent/business-services/*` remains private provider workspace. No Business Client `/business`.

---

## 18. Provider self-approval denial

Claim service strips trust/review fields. Listing CAS strips `publicationStatus` and non-pending `adminReviewStatus` for non-staff. Provider listing/capability review services reject `isStaff: false` verify/approve.

---

## 19. Cross-realm denial

Admin GBS routes live only on `adminRouter` (`requireAuth` + `requireStaff`). Agent/User/Employer/Institution routers do not mount them. Unauthenticated and non-staff never reach the handlers. Unauthorized staff: Editor lacks `verification:approve`; Moderator lacks approve; Admin lacks revoke.

---

## 20. Validation

Allowlisted query filters and review bodies. Unknown fields → `unknown_fields`. `expectedVersion` required. Reason required for needs-information / reject / suspend / revoke. Bounded pagination (max 50). No regex/aggregation injection.

---

## 21. Concurrency

`recordVersion` + `expectedVersion` CAS. Stale write → HTTP 409 `optimistic_concurrency_conflict`. Proven in 17D-2R1 memory tests and 17D-4 Mongo listing approve after a parallel needs-information write.

---

## 22. Idempotency

Retry of an already-applied review at the current version is a no-op: no version bump, no extra listing/capability side effects. Stale retry still 409.

---

## 23. Audit events

Capability (existing): `provider_capability_reviewed`, `provider_capability_verified`, `provider_capability_needs_information`, `provider_capability_rejected`, `provider_capability_suspended`, `provider_capability_revoked`, `provider_capability_evidence_backed`.

Listing (added): `gbs_listing_reviewed`, `gbs_listing_approved`, `gbs_listing_needs_information`, `gbs_listing_rejected`, `gbs_listing_suspended`.

Redaction: existing `redactAuditMetadata` / `AUDIT_SECRET_KEYS`. Evidence bodies, tokens, passport/national-ID contents are not logged. Admin detail shows `publicSafeEvidenceProjection` only.

---

## 24. Rate limits

All `/api/admin/gbs/*` inherit:

- GET → `adminReadLimiter` (`admin-read`)
- POST → `adminWriteLimiter` (`admin-write`)

No CAPTCHA / Turnstile. No new distributed limiter platform.

---

## 25. Accessibility

Semantic `h1`/`h2`, labelled `AdminSelect`/`AdminTextarea`, labelled pagination, keyboard `Link` rows, visible `focus:ring-2`, status text + badge (not color-only), `AdminConfirmDialog` focus trap + Escape, `role="alert"` errors, loading `aria-busy`, empty copy. Human labels via i18n, not raw enums alone.

---

## 26. Responsive evidence

CSS: `min-w-0`, `break-words`, inner `overflow-x-auto` on queues, wrapping action buttons, dialogs `max-h-[90vh]`. Light/dark classes from existing Admin shell.

Automated viewport × theme matrix: **NOT PROVEN / USER MANUAL**. Native 200% zoom: **NOT PROVEN / USER MANUAL**.

---

## 27. Scenario 1 — capability review

PASS on disposable Mongo `strideto_17d4_integrity_run1`: Independent claim stayed CLAIMED; provider verify denied; staff verify after accepted evidence metadata; Agency claim unchanged; audit `provider_capability_verified`.

Browser Admin UI walkthrough: **NOT PROVEN / USER MANUAL** (new UI not deployed to the running frontend container; no live Trust mutation).

---

## 28. Scenario 2 — listing approval while marketplace OFF

PASS on disposable Mongo: listing created private; submitted; staff needs-information then approve; `adminReviewStatus=approved`; `publicationStatus=private`; gate reason `business_services_public_marketplace_disabled`; provider cannot set `publicationStatus=public`.

Browser/public discovery: **NOT PROVEN / USER MANUAL** for the Admin screens. Source contract proves no public `/business-services` route exists.

---

## 29. Scenario 3 — Agency isolation

PASS on disposable Mongo: Independent verify did not change Agency `ProviderCapability`. Wrong-subject verify 404.

Browser UI: **NOT PROVEN / USER MANUAL**.

---

## 30. Scenario 4 — auth realm

PASS as source/RBAC contract: Admin GBS is staff-only; Editor cannot approve; Moderator cannot approve; Agent routes have no verify/approve; no fifth cookie.

Live HTTP cookie matrix against the running docker API: **NOT PROVEN** (new routes are not in the already-running api-a/api-b image).

---

## 31. Source tests

`node src/__tests__/phase17d4SourceContract.test.js` — 64 assertions passed.

---

## 32. Mongo tests

`STRIDETO_17D4_TEST_MONGO_URI=mongodb://127.0.0.1:27018/strideto_17d4_integrity_run1`

`node src/__tests__/phase17d4Moderation.mongo.test.js` — 3/3 passed. Database dropped after the run. No production Trust mutation.

---

## 33. UI tests

`node src/__tests__/phase17d4AdminUi.test.js` — 35 assertions passed.

`adminConfirmDialogContract.test.js` — 15 assertions passed; 24 call sites; missingOpen=0.

---

## 34. Predecessor regressions

| Suite | Result |
|---|---|
| 17D-0 `phase17d0WorkspaceContext.test.js` | 73 passed |
| 17D-1 capability / student / provider | 106 / 76 / 41 passed |
| 17D-1R1 source / role | 38 / 39 passed |
| 17D-1R1 mongo CAS | 6/6 passed |
| 17D-1R2 | 52 passed |
| 17D-2 catalog / trust | 345 / 27 passed |
| 17D-2 mongo | 4/4 passed |
| 17D-2R1 catalog / authority | 43 / 27 passed |
| 17D-3 source / pricing / UI | 57 / 25 / 31 passed |
| 17D-3 mongo | 4/4 passed |
| 17D-3R source / UI | 64 / 45 passed |
| 17D-3R mongo | 9/9 passed |
| Phase 5 | 111 passed |
| Mission 11 | 30/30 passed |

---

## 35. Module integrity

`node scripts/verify-module-link-integrity.mjs` — ok. 1887 modules, 6067 relative imports, 9126 named bindings.

---

## 36. Lint / server checks

Touched-file eslint: clean after unused-import fixes. `node --check` on new server modules: ok. Locale JSON parsed.

---

## 37. Production build

`npm run build --prefix client` — ✓ built in 51.27s.

---

## 38. Runtime

Existing local stack (not redeployed with 17D-4):

- frontend container healthy
- api-a `/api/health` 200, `/api/health/ready` 200
- api-b `/api/health` 200, `/api/health/ready` 200
- mongo healthy, redis healthy, mailpit running, caddy running
- `workerRunning: false`

17D-4 Admin routes are source-complete; they are **not** in the already-running api containers because this phase did not deploy.

---

## 39. DB safety

No live backfill. No `updateMany`/`deleteMany` on shared data. New fields have backward-safe defaults. 17D-4 Mongo tests used a disposable `strideto_17d4_*` database and dropped it.

---

## 40. WIP protection

Protected Admin/FormField WIP files were not modified, formatted, or staged. Stash `{0}` was not applied/popped/dropped.

---

## 41. Commit list

1. `6b49041` `feat(admin): add gbs moderation authority and review APIs`
2. `760e822` `feat(admin): add gbs capability and listing moderation UI`
3. `c430969` `test(gbs): verify admin moderation and publication gate`
4. `docs(release): record phase 17d-4 moderation readiness` (this file)

---

## 42. Final HEAD

This documentation commit is the phase closing commit on `main`.

---

## 43–51. Product freeze

- Public marketplace flag: **OFF**
- Business Client `/business`: **NOT IMPLEMENTED**
- Service Requests: **NOT IMPLEMENTED**
- Quotes: **NOT IMPLEMENTED**
- Formation Cases: **NOT IMPLEMENTED**
- Mailroom: **NOT IMPLEMENTED**
- GBS payments/billing/payouts: **NOT INTRODUCED** (existing marketplace payments unchanged; GBS does not enable them)
- Scanner: **NOT IMPLEMENTED**
- KMS: **NOT IMPLEMENTED**
- Worker: **STOPPED**
- Push: **NO**
- Deploy: **NO**
- Phase 17D-5 / Phase 18: **NOT STARTED**
