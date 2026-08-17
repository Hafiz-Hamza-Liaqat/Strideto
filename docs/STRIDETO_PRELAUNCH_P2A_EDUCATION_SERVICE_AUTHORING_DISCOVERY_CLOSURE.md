# STRIDETO P2A Education Service Authoring and Discovery Closure

## Baseline and scope

- Starting HEAD: `2aef89c8308accb60c7f115c3fda38d405a88bbf`.
- Scope is limited to Education service taxonomy, authoring/editing lifecycle, human money input, and public Education discovery truthfulness.
- P1A, P1B, P1C, Business workflows, Admin, pagination/pre-scale work, dashboard queues, filing, HSI, Worker, 17D-9B, and Phase 18 are not expanded.

## Canonical taxonomy

The shared Education taxonomy remains exactly:

1. `study_abroad_guidance`
2. `university_application_support`
3. `scholarship_guidance`
4. `test_guidance`
5. `document_review`
6. `career_guidance`
7. `work_mobility_guidance`
8. `visa_process_guidance_informational`
9. `other`

`shared/agent/serviceTaxonomy.js` derives ordered authoring/filter options from the canonical constant and owns one human label per identifier. Create, edit, and public directory filtering consume that projection. No tenth category or parallel Education catalog was introduced.

Visa-process guidance remains explicitly informational. Work-mobility guidance explicitly disclaims employment, work-authorization, and government-approval guarantees. Existing forbidden-guarantee validation remains server-authoritative.

## Create and edit lifecycle

`AgentService` remains canonical. The existing PATCH endpoint is reused; no V2 model or endpoint exists. Provider UI now supports:

- creating all nine categories;
- editing all server-supported service fields;
- human-readable pricing input;
- safe Cancel without autosave;
- activating under the existing Education verification gate;
- archiving without deletion.

The canonical status lifecycle remains `draft`, `active`, and `archived`. Archived services remain owner-visible and historically referenced but are excluded from public intake because public projection and consultation creation require `active`.

Both create and edit resolve the authenticated account to its exact Independent or Agency subject and require `education_mobility` service-management authority. Business-only authority is denied. Client-submitted ownership is never accepted.

## Historical and Marketplace safety

Consultations retain their existing `agentServiceId`; ProfessionalCases retain their Consultation relationship. Editing or archiving the future-facing service does not replace these records, cancel a Case, or alter IDs. The current architecture does not store a separate service-title snapshot, so views that intentionally resolve the live service may show its current title; no existing snapshot was overwritten.

`AgentMarketplacePost` remains separate. Service edits do not rewrite, submit, publish, or archive Marketplace posts. Moderation and the one-time free Education promotion are unchanged.

## Pricing representation

Providers enter a normal decimal currency amount such as `150.00 USD`. Shared ISO-4217 helpers validate currency-specific decimal precision and convert to the existing safe integer Money contract. Existing stored Money round-trips back to an exact edit string, including zero- and three-decimal currencies.

Public service cards distinguish Free, Fixed price, Starting from, Contact for details, Quote required, and payment-not-configured states. Fixed and starting prices show a formatted amount plus the explicit currency code. This remains Provider-stated information and does not claim checkout, payment completion, institutional authority, or a guaranteed outcome.

## Public projection and discovery

The approved public profile projection now includes the existing safe `eligibilityNotes` and `durationEstimate` fields for active services. React renders these as text, never arbitrary HTML. Public cards show canonical category, delivery mode, price truth, Provider-estimated duration, and eligibility/limitation notes.

`/agents` now uses the discovery heading “Find Education & Mobility Providers.” Its service-need filter consumes the canonical nine-category projection, composes with Provider type, country, and destination filters, and preserves applied state in the URL. Unknown category query values are ignored by UI initialization and fail to an empty result server-side. Empty results provide a truthful clear-filter action.

## Verification

- P2A client behavioral/source contract: passed.
- P2A server source/security contract: passed.
- P2A disposable Mongo suite: 6/6 passed, covering all categories, unknown-category denial, Independent/Agency and Education/Business isolation, exact money, archive, historical/Marketplace isolation, safe public projection, and filter combinations.
- P1A source and disposable Mongo regressions: passed.
- P1B source and disposable Mongo regressions: passed.
- P1C focused trust regression: passed.
- ProfessionalCase, Education verification mark, Education free promotion, Provider separation, and auth/session regressions: passed.
- Touched JavaScript syntax checks and client ESLint: passed.
- Vite production build: passed without a new dependency.
- Focused responsive/runtime evidence is recorded in the final execution report.

## Deferred

- P2B: Business verification summary and route semantics.
- P2C: pagination, bounded list UX, Education clients query redesign, and team bounds.
- Later public UX: dashboard attention queues and advanced analytics.
- Final four-theme/manual, native 200%, real screen-reader, and load/stability certification remain separate acceptance phases.
