# STRIDETO Pre-Launch P1B Business Workflow Closure

## Baseline and scope

- Starting HEAD: `9cf7e5d4dfcf9abfa03f166761f21fe11627415e`.
- Final HEAD: the documentation commit containing this report; the exact immutable hash is recorded in the final execution report.
- Scope was limited to authenticated Business private-beta intake, contextual Business messaging, and the truthful Business document boundary.
- Education P1A, Admin evidence review, jurisdiction readiness, public marketplace, payments, filing/government integration, HSI, Worker, 17D-9B, and Phase 18 were not expanded.

## Private-beta intake boundary

The public Business marketplace remains disabled. Existing public listing discovery and marketplace-origin request creation retain the `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED` fail-closed gate.

An additive authenticated path now accepts a Provider-issued listing slug. The slug grants no authority. Server-side request creation requires an active Business Client grant, an approved listing and Admin review, an active exact-subject Business domain enrollment, a live verified exact-subject capability, listing scope compatibility, and an allowed entity type. The existing `GbsServiceRequest` and durable idempotency command remain canonical. `intakeChannel` records `private_beta` versus `public_marketplace` provenance.

Providers can see the private entry path only for an approved listing. No provider directory or public discovery bypass was added.

## Contextual Business messages

Request, Quote, and GbsCase conversations use explicit, separate context types. They share a small Business-only low-level implementation and do not reuse Education Consultation or ProfessionalCase contexts.

Each thread stores the exact requester and Provider subject derived from its canonical parent. Buyer access filters by `requesterUserId`. Provider access requires authenticated Agent subject selection plus the existing Business domain duty, then filters by exact `providerSubjectType` and `providerSubjectId`. Provider sends require the context-specific requests, quotes, or cases manage permission. Reads require Business view authority.

Messages are plain text, HTML-stripped, limited to 4,000 characters, paginated at 20 by default and 50 maximum, and never render with raw HTML. Business Provider Messages now lists only Business Request, Quote, and Case threads. Contextual composers are present on both Provider and Business Client detail pages.

## Document decision and HSI

Existing operational Business document upload and access is HSI/scanner-gated. No approved ordinary non-HSI upload path exists while HSI is off. This phase therefore classifies secure Business document exchange as **intentionally excluded from private beta**.

The Provider and Business Client Case pages state: “Secure Business document exchange is not available in this private beta.” Upload policy or review affordances appear only if the existing security projection reports upload enabled. No scanner, quarantine, storage, classification, or authorization boundary was bypassed. Structured GbsCase requirements remain canonical.

## Data and indexes

- Additive `GbsContextThread` and `GbsContextMessage` collections only.
- Both schemas set `autoIndex: false`.
- Create-only critical indexes cover unique context identity, bounded customer/Provider inbox lookup, and chronological thread messages.
- Provisioning is idempotent; second-pass focused verification created no indexes.
- No migration, backfill, `syncIndexes`, `dropIndexes`, or staging data mutation was used.

## Verification evidence

- P1B focused server source contract: 32 assertions passed.
- P1B focused client contract: 17 assertions passed.
- P1B disposable Mongo suite: 4/4 tests passed, covering marketplace-off private intake, idempotency, customer/Provider isolation, sanitization, pagination, distinct Request/Quote/Case contexts, and index idempotency.
- Business 17D source contracts: 17D-3R, 6, 7, 8A, 8B1, 8B2A, 8B2B, and 9A passed.
- Business Mongo regressions: Provider domains, Service Request, Quote, GbsCase, requirement pack, and filing authorization passed.
- Education P1A source and disposable Mongo regressions passed.
- Auth/session and Provider product/workspace separation source contracts passed.
- Touched client ESLint passed with no errors.
- Touched server/shared JavaScript `node --check` passed.
- Vite production build passed; no dependency was added.
- Rebuilt API/frontend images passed.
- Focused responsive/accessibility smoke: 80/80 Explicit Light/Explicit Dark cells passed at 320, 375, 768, 1024, and 1440 pixels, with a route h1, labelled fields, no body overflow, and no browser/page errors.

## Runtime and safety evidence

Only `frontend`, `api-a`, and `api-b` were rebuilt/restarted. The Worker was excluded and remained stopped. Mongo, Redis, and the HTTPS edge remained healthy. The public Business marketplace stayed off. Wyoming stayed draft/draft. Filing authorization legal text stayed unapproved/empty. HSI stayed off. No push or deploy occurred.

## Deferred P1C and later work

- Admin Business evidence detail and trust gates.
- Jurisdiction source currentness and production readiness.
- Public Business marketplace activation.
- Government filing and government outcomes.
- Business payment processing.
