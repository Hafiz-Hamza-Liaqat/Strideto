# STRIDETO PHASE 17D-5
PUBLIC BUSINESS SERVICES MARKETPLACE & DISCOVERY READINESS

**PUBLIC MARKETPLACE DEFAULT REMAINS OFF.**

**STRIDETO PHASE 17D-5 IMPLEMENTATION: COMPLETE**

**PUBLIC MARKETPLACE IMPLEMENTATION: PASS**

**PUBLIC MARKETPLACE DEFAULT: OFF**

**LOCAL/TEST MARKETPLACE ACCEPTANCE: PASS**

**ELIGIBILITY: PASS**

**EXACT-SUBJECT AUTHORITY: PASS**

**PROVIDER DOMAIN REQUIREMENT: PASS**

**PROVIDER CAPABILITY REQUIREMENT: PASS**

**ADMIN APPROVAL REQUIREMENT: PASS**

**REVOCATION: PASS**

**INDEPENDENT VS AGENCY: PASS**

**PRIVACY: PASS**

**CTA: VIEW DETAILS ONLY**

**DIRECT CONTACT: NOT EXPOSED**

**BUSINESS CLIENT: NOT IMPLEMENTED**

**SERVICE REQUESTS: NOT IMPLEMENTED**

**QUOTES: NOT IMPLEMENTED**

**FORMATION CASES: NOT IMPLEMENTED**

**PAYMENTS: NOT_CONFIGURED**

**REVIEWS/RATINGS: NO GBS RATINGS**

**NATIVE 200% ZOOM: NOT PROVEN / USER MANUAL**

**SCREEN READER: NOT PROVEN / USER MANUAL**

**PHASE 17D-6: NOT STARTED**

**PHASE 18: NOT STARTED**

---

## 1. Baseline HEAD

Starting HEAD: `86528fed51920b0c1a475be9122d1866fab7691f`

`docs(release): finalize phase 17d-4 acceptance and closure`

Branch: `main`

Protected WIP left untouched throughout Phase 17D-5:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`

Protected untracked files left untracked:

- `docker-compose.appenv-align.yml`
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

Existing stash left untouched: `stash@{0}: On main: wip: AdminTableFilters values wiring (pre-phase-10)`

Worker remained STOPPED (`edurozgaar-staging-worker-1` Exited). No push. No deploy.

---

## 2. Audited implementation HEAD

**AUDITED IMPLEMENTATION HEAD:** `85a0d28ab95cc8fc4269f576cc49803290e88d70`

`test(gbs): verify public discovery isolation and seo`

This hash is the last application/test commit of 17D-5. The docs sign-off commit that follows this report is recorded separately after commit and is not predicted here.

---

## 3. Complete 17D-5 commit history

1. `9d41565` `feat(gbs): add public marketplace eligibility and read APIs`
2. `cab54e4` `feat(gbs): add public business services marketplace UI`
3. `85a0d28` `test(gbs): verify public discovery isolation and seo`
4. docs sign-off commit created after this report

---

## 4. Phase objective

17D-5 is **discovery only**. Anonymous visitors may browse, search, filter, sort, paginate, and open Admin-approved Business Services listings that pass live eligibility. They may inspect exact Provider/Agency identity, capability-specific verification, jurisdiction/scope, professional fees, and current catalogued official/government fees.

They may not Request Service, Contact Provider, Get Quote, message, hire, start formation, create a Business Client workspace, or pay.

---

## 5. Scope

In scope:

- Public routes `/business-services` and `/business-services/:listingSlug` under existing `MainLayout`
- Anonymous read APIs
- Public listing slug
- Live marketplace eligibility including exact-subject active `business_services` domain enrollment
- Dedicated public-safe DTO
- Search / allowlisted filters / newest|title sort / bounded pagination
- SEO + conditional sitemap
- Flag-off NotFound + noindex
- Focused 17D-5 tests and predecessor regressions

Out of scope (not started):

- Business Client
- Service Requests
- Quotes
- Formation Cases
- Messaging
- Payments / checkout
- Third-party fee schema
- Phase 17D-6
- Phase 18
- Production/staging marketplace enablement
- Rewriting 17D-4 Admin moderation architecture

---

## 6. Public routes

| Route | Behavior |
|---|---|
| `/business-services` | Marketplace hub |
| `/business-services/:listingSlug` | Listing detail |

Not implemented: `/business-services/providers`, `/business`, `/business/requests`, `/business/quotes`, `/business/cases`. Education `/agents/:slug` is not reused as GBS identity.

When the marketplace flag is OFF, both routes render existing public `NotFound` + `noindex`. SPA HTML transport may still be HTTP 200.

---

## 7. Public APIs

| Method | Path | Flag OFF | Flag ON |
|---|---|---|---|
| GET | `/api/business-services/enabled` | 200 `{ enabled: false }` | 200 `{ enabled: true }` |
| GET | `/api/business-services/listings` | 404 `{ error: "not_found" }` | 200 list DTO |
| GET | `/api/business-services/listings/:listingSlug` | 404 | 200 `{ item }` or generic 404 |

No public writes. Unknown, private, unapproved, revoked, domain-inactive, and flag-off detail responses are indistinguishable: `{ error: "not_found" }`.

`GET /api/agent/business-services/enabled` now reports `publicMarketplaceEnabled` from `isBusinessServicesPublicMarketplaceEnabled` rather than a hardcoded `false`.

---

## 8. Marketplace flag

Sole public enablement authority:

`BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED === '1'`

These do **not** enable public discovery:

- `BUSINESS_SERVICES_ENABLED`
- `BUSINESS_SERVICES_PROVIDER_ENABLED`

Committed defaults remain OFF:

- `.env.example` documents `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0`
- `.env.production.example` sets `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0`
- `.env.template` remains `=0`
- Local `docker-compose.appenv-align.yml` was **not modified** and already has `"0"`

### Local/test flag-on override

Do not edit `docker-compose.appenv-align.yml`. Recreate only `api-a` / `api-b` with a temporary overlay:

```yaml
services:
  api-a:
    environment:
      BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: "1"
  api-b:
    environment:
      BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: "1"
```

Used with the existing local stack files (`docker-compose.yml`, `docker-compose.staging.yml`, `docker-compose.appenv-align.yml`, `docker-compose.sec3f-local.yml`) and `--no-deps`. Overlay deleted after acceptance. Final runtime returned to OFF.

---

## 9. Listing slug

Additive `GbsServiceListing.publicSlug`:

- unique sparse index
- URL-safe (`slugify` + opaque hex suffix on collision)
- not a raw Mongo id
- assigned on Admin approve (`assignListingPublicSlugIfAbsent`)
- immutable after first assignment (`delete $set.publicSlug` in listing CAS)
- title edits do not change the public URL
- no mass backfill of existing listings

Slug identifies a listing. Slug does **not** grant visibility. Detail always re-runs live eligibility.

---

## 10. Eligibility law

At query time **all** of the following are required:

1. Marketplace flag ON
2. `moderationStatus = approved` and `adminReviewStatus = approved`
3. Listing is not draft / under_review / needs_information / rejected / suspended / archived
4. Exact-subject `ProviderCapability` for the same `capabilityId`
5. Capability `ACTIVE` + `VERIFIED`
6. Scope subset remains valid (`evaluateListingPublicationGate` / `authorizeGbsProviderAction`)
7. Catalog IDs remain known/current per the 17D-4 gate
8. Protected-title evidence policy still passes where applicable
9. Exact-subject `ProviderDomainEnrollment` for `domainId = business_services` and `status = active` (setup is not enough)
10. `evaluateListingPublicationGate` returns allowed

`publicationStatus` is never the source of truth. An Admin-approved listing may remain stored `publicationStatus = private` and still be discoverable when the flag is ON and the live gate passes. Stored `publicationStatus = public` without the live chain is not sufficient.

---

## 11. Exact-subject identity

- `subjectType = agent` → `AgentProfile.professionalName`, label Independent
- `subjectType = organization` → `Organization.displayName`, label Agency

Resolved from the listing subject only. No `memberships[0]`, no logged-in provider substitution, no Agency/Independent blending. Agency domain/capability cannot authorize an Independent listing and the reverse is also denied.

---

## 12. Public projection

Dedicated `marketplaceListingProjection`. Existing `publicListingProjection()` is not reused.

Excluded: `subjectId`, `reviewedBy`, `reviewedAt`, `reviewReason`, raw `adminReviewStatus` / `moderationStatus` / `publicationStatus`, `riskFlags`, `recordVersion`, `contentRevision`, `schemaVersion`, `creationCommandId`, evidence/vault refs, email, phone, WhatsApp, membership, permissions, audit metadata.

---

## 13. Search / filters / sort / pagination

- Search: escaped regex, max 80 chars, title + provider/agency display name + capability publicName + jurisdiction label
- Filters allowlist: `capabilityId`, `jurisdictionId`, `countryCode`, `subjectType` (`agent`|`organization`), `pricingMode`
- Sort allowlist: `newest` (default), `title`. No Recommended / Best / Featured / price sort
- Pagination: `page` default 1, `limit` default 20, max 50, candidate window 200
- Invalid sort/filter → 400 `invalid_query`
- Every candidate still passes live eligibility

---

## 14. Cards, detail, pricing, CTA

Cards: title, Provider/Agency name, Independent/Agency, capability-specific verification badge, jurisdiction, professional fee summary, short description, **View Details**.

Detail: public-safe description, jurisdiction, entity types, scope/included/excluded, professional fees, catalog government fees separately, delivery, languages, provider turnaround estimate, recurring/consultation factual indicators, pricing/legal disclaimer.

Professional service fee and official/government fee are never merged into one number. Unavailable official amounts use “Official fee not listed here”. `quote_required` renders “Quote required”, never `0`. No third-party fees. Turnaround is labelled Provider estimate.

No Request Service / Get Quote / Contact / Hire / Pay / Start Formation / Sign in to continue, including disabled fake buttons.

---

## 15. SEO / sitemap / robots

When ON: hub and detail use `SeoHead` title, description, canonical, Open Graph/Twitter via existing `SeoHead`. JSON-LD CollectionPage on the hub; Service/Offer on priced detail only. No AggregateRating, Review, fake availability, or invented price for `quote_required`.

When OFF: routes are NotFound + noindex. Hub is not in `INDEXABLE_STATIC_PATHS` or `pageRegistry`. XML sitemap includes `/business-services` and eligible `/business-services/:slug` only when the flag is ON and live eligibility passes. Robots is not an authorization boundary and does not advertise GBS while committed OFF.

---

## 16. Rate limits and validation

`/api` remains behind `apiLimiter`. List/search additionally uses `searchLimiter` (60/min production). Detail uses `Cache-Control: no-store`. Query allowlists reject arbitrary `$` operators, sort properties, and projection selection. No CAPTCHA/Turnstile. No public writes.

---

## 17. Tests

| Suite | Result |
|---|---|
| `node src/__tests__/phase17d5SourceContract.test.js` | **94** passed |
| `node src/__tests__/phase17d5Seo.test.js` | **27** passed |
| `node src/__tests__/phase17d5Marketplace.mongo.test.js` | **5/5** passed (`STRIDETO_17D5_TEST_MONGO_URI` disposable `strideto_17d5_*`) |
| `node src/__tests__/phase17d5MarketplaceUi.test.js` | **53** passed |

Mongo database dropped after the 17D-5 integrity run. Disposable local acceptance fixtures in `edurozgaar` were cleaned after runtime acceptance. No production Trust mutation. No mass listing backfill.

---

## 18. Predecessor regressions

| Suite | Result |
|---|---|
| 17D-0 `phase17d0WorkspaceContext.test.js` | 73 passed |
| 17D-1 capability / student / provider | 106 / 76 / 41 passed |
| 17D-1R1 source / role | 38 / 39 passed |
| 17D-1R1 mongo CAS | 6/6 passed |
| 17D-1R2 | 52 passed |
| 17D-2 catalog / trust | 345 / 44 passed |
| 17D-2 mongo | 4/4 passed |
| 17D-2R1 catalog / authority | 43 / 27 passed |
| 17D-3 source / pricing / UI | 57 / 25 / 31 passed |
| 17D-3 mongo | 4/4 passed |
| 17D-3R source / UI | **65** / 45 passed |
| 17D-3R mongo | 9/9 passed |
| 17D-4 source / UI | 78 / 48 passed |
| 17D-4 mongo | 5/5 passed |
| Phase 5 Agent portal | 111 passed |
| Mission 11 Agent/Agency portal | 30/30 passed |
| `phase10Seo.test.js` | 53 passed |
| `phase10PublicShell.test.js` | 74 passed |
| `finalPreLaunchDiscovery.test.js` | 11 passed |

Public `/agents` remains the Education directory. GBS listings do not leak into that marketplace. 17D-3/17D-4 source contracts that forbid the literal `path: '/business-services'` still pass because public routes use `ROUTES.BUSINESS_SERVICES`.

---

## 19. Module integrity / lint / build

`node scripts/verify-module-link-integrity.mjs` — **PASS**. 1903 modules, 6143 relative imports, 9254 named bindings.

Touched-file eslint: **0 errors** (client `routes/index.jsx` retains the pre-existing react-refresh warning). `node --check` on touched server modules: **PASS**.

`npm run build --prefix client` — **PASS**. `client/dist` was not committed.

---

## 20. Runtime

Rebuilt only `api-a`, `api-b`, and `frontend`. Mongo, Redis, Mailpit, and Worker were not recreated. No `docker compose down`, volume prune, or system prune.

- frontend healthy
- api-a healthy (`GET /api/health` 200)
- api-b healthy
- mongo healthy
- redis healthy
- mailpit healthy
- caddy running
- `workerRunning: false`
- Worker **STOPPED**

Local flag ON (temporary overlay, not committed):

- `GET /api/business-services/enabled` → `{ enabled: true }`
- listings included the disposable Wyoming LLC fixture
- detail returned professional `$200.00` separately from official `$100.00`
- unknown slug → `{ error: "not_found" }`
- XML sitemap via API included `/business-services` and the eligible slug
- browser hub and detail rendered Independent, capability-specific badge, View Details only

Local flag returned OFF:

- enabled `{ enabled: false }`
- list/detail 404
- frontend `/business-services` → Page not found + `noindex, nofollow`
- API sitemap had no `business-services` URLs

Caddy `GET /sitemap.xml` can 502 on a slow full sitemap; eligibility was proven against `http://127.0.0.1:5001/sitemap.xml`.

---

## 21. Visual / accessibility matrix

| Viewport | Dark (html.dark / system as observed) | Light (class override) |
|---|---|---|
| 320 | PASS, no body overflow (detail) | PASS (detail light at 1440; hub a11y tree at desktop) |
| 375 | PASS, no body overflow | supporting |
| 768 | PASS, no body overflow | supporting |
| 1024 | PASS, no body overflow | supporting |
| 1440 | PASS, no body overflow | PASS, light background `rgb(248,250,252)` |

Hub a11y tree: `h1` Business Services, labelled search/filters/sort, card `h2` is a link, View Details link, Independent is text not color-only. Loading uses `aria-busy`. Errors use `role="alert"`. No-results state proven. Unknown slug and flag-off use NotFound + noindex. MainLayout nav remained present across Home → marketplace → unknown slug (no full blank-page shell).

**NATIVE 200%:** NOT PROVEN / USER MANUAL (tooling did not apply native browser zoom).

**SCREEN READER:** NOT PROVEN / USER MANUAL. Accessibility tree is supporting evidence only.

---

## 22. DB safety

Isolated `strideto_17d5_*` integrity database for tests (dropped after). Local acceptance used disposable `17d5-accept-*` rows in the local `edurozgaar` database and deleted them afterwards. No live backfill, no destructive migration, no real production Admin approval, no real Provider Trust mutation. Slug field is additive and backward-compatible.

---

## 23. WIP / stash / worker / push / deploy

WIP untouched. Stash untouched. Worker STOPPED. Push **NO**. Deploy **NO**.

17D-6 NOT STARTED. Phase 18 NOT STARTED.
