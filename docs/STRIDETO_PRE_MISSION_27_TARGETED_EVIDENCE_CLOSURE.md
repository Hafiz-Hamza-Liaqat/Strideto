# Strideto — Final Targeted Pre-Mission-27 Evidence Closure

Date: 2026-08-10

Accepted base: `61a2c43` on `main`

Scope: local/offline, targeted release-certification evidence only

## Verdict

**READY FOR MISSION 27.** This is source/local-offline readiness, not production
release authorization. No external network, production/staging datastore,
provider, payment, delivery worker, push, or deployment was used.

The ten remaining partial categories are non-critical breadth/manual or
controlled-environment requirements. There are no unresolved BLOCKER, P0, P1,
or critical authorization/privacy/financial defects.

## Authoritative route and browser matrix

`node scripts/verify-pre-mission-27-route-inventory.mjs` parsed the actual React
route declarations and generated the route, realm, guard, component/page,
navigation reference, primary API dependency, and evidence matrix.

| Realm | Reachable route records | Browser-smoked |
| --- | ---: | ---: |
| Public | 94 | 94 |
| Student | 36 | 36 |
| Employer | 13 | 13 |
| Agent | 19 | 19 |
| Institution | 8 | 8 |
| Admin | 54 | 54 |
| **Total** | **224** | **224** |

Source results: zero missing pages, zero duplicate/conflicting patterns, zero
stale navigation routes after correction. Routes without a static global-nav
reference are marked `route-declaration/contextual`; they are not silently
claimed as global-nav entries.

`node scripts/verify-pre-mission-27-route-browser.mjs` executed 892
route/viewport combinations and 4,481 assertions with zero failures. Every
route ran at 320×800, 768×1024, and 1440×900. Dense/high-risk routes additionally
ran at 375×812 and 1024×768. Assertions covered settled primary content, runtime
exceptions, page-level overflow, clipped primary controls, and 20/20 pairwise
wrong-realm denials. External browser requests: zero.

Rendered occurrence inventory across the matrix: 6,861 card/layout tokens, 949
forms, 24 filter controls, 16 sort controls, 22 pagination controls, 703 counter
tokens, 160 search controls, 339 notification tokens, and 14 progress/tracking
tokens. These are viewport occurrences, not inflated claims of unique controls.

All five role dashboards loaded at their required baseline and high-risk
viewports. Accepted Mission 24 (246/246) and Mission 26 (286/286) executable
browser packs provide the primary navigation/action, deterministic counter,
loading, empty, forbidden, safe-error, privacy, focus, dialog, and table checks.
The new route matrix adds complete route breadth and 20/20 realm denial.

## Controls, search, and state handling

- Cards/layout, counters, notifications, and progress/tracking: covered by the
  complete structural route matrix plus the accepted interactive Mission 24/26
  browser packs.
- Forms, filters, sorting, pagination, and search: material implementations are
  inventoried across all routes and representative interactions/contracts are
  executable; exhaustive permutation of every control remains partial rather
  than being fabricated.
- `node scripts/verify-search.mjs`: 49/49 checks, including validation, query
  parsing/paging, ranking, cache, keyboard combobox behavior, and client/server
  wiring.
- Admin Super-Control: 60/60, including bounded pagination, allowlisted sort,
  constrained query/regex input, and exclusion of Vault/messages/private data.
- Education Intelligence: 41/41, including search/filter/page/limit/country and
  delivery-mode parsing.
- International Hardening: 60/60 for countries, currencies, timezones, Unicode,
  international names, date-only values, DST, Money precision, and no implicit
  FX/default jurisdiction.
- Accepted Mission 26 verifies loading/slow API, empty and safe error states;
  unexpected browser runtime exceptions remained zero in the new full matrix.

## Disposable Employer datastore journey

Before execution, the target resolved to `127.0.0.1:27018`, the database name
was test-specific, and the datastore directory was under the repository's
`.tmp` directory. `resolveMongoTarget` refuses non-local targets. The real
worker, staging/production databases, and network were not reachable. The test
drops the database before the journey and again in `finally`.

Executed:

`EMPLOYER_INTEGRATION_TEST=1 MONGO_URI=mongodb://127.0.0.1:27018/strideto_targeted_employer_20260810 node src/__tests__/employerPortalIntegration.test.js`

Result: pass. It exercised Employer persistence/profile organization context,
internal and external job creation, edit/state changes, Student application,
duplicate unique-index rejection, ownership distinction from another Employer,
pipeline synchronization, and before/after dashboard count reconciliation.

Adjacent executable contracts close the HTTP/policy portions: Employer secure
auth 39 assertions, pipeline transition notification 41, job rejection
notification 28, publication model 40, plus post-job validation, application
flow, application authorization, realm isolation, and application-count
enrichment suites (all passed). No live notification channel was delivered.

## Real API lifecycle and HTTP matrix

`node scripts/verify-pre-mission-27-runtime.mjs` imported and started the real API
entry point against the disposable local MongoDB with `MONGO_AUTO_INDEX=0`, all
cron toggles disabled, delivery disabled, and no worker. Startup succeeded,
module linking completed, no sentinel secret appeared in startup output, and no
automatic index/migration was observed.

The actual loopback HTTP matrix contains 47 assertions across health,
monitoring, auth, profile, Employer, jobs, applications, education, Journey,
Vault, Agent, consultations, cases, trust, Commerce, Institution, Copilot,
Budget, Admin, Skill Trust, notifications, and verification:

- expected 2xx: 21
- expected 4xx: 24 (including 400, 401, 403, 404, 409, 422, and 429)
- expected 5xx: 2 (one truthful readiness 503 and one deliberate synthetic 500)
- unexpected 5xx: 0
- client error redaction: synthetic 500 returned a bounded generic production
  response with no stack/secret; the local server logger retained its expected
  diagnostic stack.

The canonical search limiter was exercised over real local HTTP: requests below
threshold returned normally and the first 429 occurred at request 121 of 122.
The process remained stable.

Healthy liveness/readiness and local metrics returned 200. With required Redis
unavailable, liveness stayed 200 while readiness truthfully returned 503. An
unavailable required MongoDB caused startup to exit 1 without printing secret
sentinels. Two supported graceful shutdowns completed with exit code 0; the
listening server closed and zero API/worker processes remained.

## Authorization, IDOR, and mass assignment

`node scripts/verify-pre-mission-27-api-security-inventory.mjs` inventoried 936
declared server route endpoints across 69 route files: 445 reads and 491
mutations (GET 445, POST 315, PUT 36, PATCH 74, DELETE 66). It found 554 direct
route guards, 19 router-inherited guards, and 363 public or controller-authorized
contracts. The latter classification is deliberately not presented as
authenticated. Priority-resource coverage was present for profiles, jobs,
applications, Vault, Skill Trust, marketplace, consultations, cases,
reviews/reports, Commerce, Institution Programs, Admin actions, and
notifications. Direct request-body persistence candidates: zero.

Representative execution spans Student, Employer, Agent, Institution,
Moderator, Admin, and SuperAdmin through the accepted Mission 26 39-command
pack, the new 20/20 browser realm matrix, real HTTP 401/403 checks, the disposable
Employer journey, Agent Portal 30/30, Institution Portal 50/50, Admin
Super-Control 60/60, Professional Trust 42/42, Consultations 38/38, Cases 55/55,
Commerce 41/41, Marketplace Payments 54/54, Skill Trust 39/39, and Skill Trust
HTTP/inbox 10/10. These prove server-derived actors, scoped owner/organization
queries, wrong-realm denial, restricted Admin privacy, and rejection of
caller-supplied role/owner/verification/payment authority on representative
high-risk paths.

## Load and runtime resources

The existing `scripts/load-test.mjs` was inspected and executed only against the
running loopback API: 60 operations, concurrency 10, 223 ms, 60 successes, zero
errors, 100.0%, reported p95 48 ms.

The richer bounded domain workload executed 240 operations at concurrency 12 in
715.97 ms: 240 successes, zero failures, p50 28.12 ms, p95 87.65 ms, and p99
109.58 ms. Each of public discovery, jobs, Programs, dashboard aggregation,
search, notifications, Admin list/search, and Commerce history received 30
operations. Total bounded operations across both runs: 300. No SLA is inferred.

Resource snapshot around the 240-operation run:

- RSS: 191,942,656 → 255,709,184 bytes (delta 63,766,528)
- heapUsed: 98,083,504 → 110,805,512 bytes (delta 12,722,008)
- heapTotal: 210,116,608 → 217,718,784 bytes
- event-loop delay: mean 32.22 ms, p95 100.99 ms, p99 203.03 ms, max 205.91 ms

This short run found no crash, sustained stall, timer/process accumulation,
termination failure, or obvious monotonic runaway. It is not a formal leak or
capacity proof.

## Duplicate-write and reconciliation evidence

- Applications: disposable Mongo unique-index duplicate rejection; application
  snapshot immutability and trust distinction 39/39.
- Vault grants: accepted scoped grant/revocation tests plus Agent 30/30,
  Consultations 38/38, and Cases 55/55.
- Reviews/reports: Professional Trust 42/42, including duplicate-interaction
  review and cross-tenant denial.
- Skill Trust: CAS and simultaneous-decision evidence in the accepted 39/39
  suite; application snapshot remains immutable after later skill changes.
- Notifications: reliability 15/15 and operations 13/13; concurrent
  reconciliation creates at most one canonical `UserNotification` and never
  replays transition/history/verification.
- Commerce/provider events: Commerce 41/41 and Marketplace Payments 54/54,
  including domain/provider idempotency, conflicting fingerprints, webhook
  replay, ledger/refund/payout safeguards, and zero network operations.
- Consultation booking: 38/38, including double-booking prevention and bounded
  state transitions.

`PENDING_RECONCILIATION` is operationally consumed by the existing manual,
bounded, confirmed one-history-ID CLI. It is not an automated job and performs
no collection scan. Mission 27 must decide whether to schedule a bounded,
observable controlled-worker consumer. Notification preferences/quiet hours
remain schema/vocabulary only and are not enforced by canonical in-app
persistence; no contrary runtime claim is made.

## Query and scalability audit

Targeted source review covered production list/search/dashboard/reconciliation
paths. Concrete defects corrected:

1. Employer job applications are capped at 500, retain a separate total and
   truncation metadata, batch pipeline-stage reads, and batch Talent Profile and
   primary Resume reads instead of per-application N+1 calls.
2. Trending job, scholarship, and admission candidate materialization is capped
   at 5,000 and sorted before scoring; bookmark-user materialization is capped
   at 10,000.
3. Notification reconciliation remains one immutable history ID with no hidden
   collection scan or recursive retry.

`targetedQueryScalability.test.js`: 7/7. A broad textual scan still produces 396
single-line `.find()` candidates and 442 loop/Promise/retry candidates; many are
bounded on later lines or are non-query code. They were not all manually proven,
so universal N+1/unbounded-query closure is not claimed and category 62 remains
partial. No uncontrolled recursive retry was found in the release-priority
paths reviewed.

## Index, secrets, CI, and DevOps

Mongo startup now sets `autoIndex` only when `MONGO_AUTO_INDEX=1`; default source
behavior cannot build indexes automatically. `mongoStartupIndexPolicy.test.js`:
2/2. The accepted notification index tooling remains verify-only by default and
requires explicit confirmation to create only the exact unique partial index.
No live index was inspected or mutated.

The dedicated tracked-file secret scan examined 2,046 files. It emitted only
file/category/classification, never candidate values: eight database-URL-shaped
matches and one bearer-token-shaped local test sentinel, all approved
example/test placeholders; confirmed committed
credentials: zero; client server-secret exposure: zero. Protected untracked
historical documents and environment files were excluded.

CI-equivalent local results:

- server lint: pass, zero errors/warnings
- client lint: pass, zero errors, 58 existing warnings within its configured
  ceiling
- server auth validator/policy test: pass
- `npm run verify:production`: 8/8 suites
- module links: clean — 1,524 modules, 4,647 relative imports, 6,926 named
  bindings; archived stale references remain non-runtime INFO
- production Vite build: pass, 1,164 modules transformed
- SEO prerender: six shells
- `docker compose config --quiet`: pass with local CI placeholders

`npm ci` was not rerun because installed lockfile dependencies were already
present and external network was forbidden. Docker image build and the CI
container smoke path were not run because they may fetch layers/start services;
the workflow's destructive `docker compose down -v` was explicitly not run.
Exact container, backup/restore, rollback, alerts, and deployment behavior remain
Mission 27 controlled-environment prerequisites.

## Accessibility evidence and residuals

Accepted Mission 24 (246/246) executes keyboard interaction, focus movement and
restoration, form error association, dialog naming/focus, loading/status
semantics, five responsive sizes, reduced-width tables, and modal controls. The
new matrix verifies every route at reduced/mobile and desktop widths with zero
critical overflow/clipping failures. Two concrete missing field associations and
the RTL off-screen skip-link overflow were corrected.

The new automated structural probe recorded 150 repeated missing-accessible-name
occurrences across 38 unique routes/viewports. This is one aggregate MINOR
accessibility residual, not a WCAG failure count and not a security finding.
`axe` is not installed and was not downloaded. 200% zoom, contrast,
assistive-technology behavior, full RTL semantics, and manual verification of
those 38 routes remain partial/manual Mission 27 certification work. No WCAG
certification is claimed.

## Original 71-category evidence matrix

| # | Category | Status | Executable evidence |
| ---: | --- | --- | --- |
| 1 | Complete public route/page inventory | COVERED | 94 mapped; 94 browser-smoked |
| 2 | Complete Student route/page inventory | COVERED | 36 mapped; 36 browser-smoked |
| 3 | Complete Employer route/page inventory | COVERED | 13 mapped; 13 browser-smoked |
| 4 | Complete Agent route/page inventory | COVERED | 19 mapped; 19 browser-smoked |
| 5 | Complete Institution route/page inventory | COVERED | 8 mapped; 8 browser-smoked |
| 6 | Complete Admin route/page inventory | COVERED | 54 mapped; 54 browser-smoked |
| 7 | Dashboard functionality for all roles | COVERED | all five role dashboards in 892-combination matrix; accepted Mission 24 246/246 and Mission 26 286/286 |
| 8 | Cards/layout components | COVERED | 6,861 rendered occurrences; zero route matrix overflow/clipping failures |
| 9 | Forms | PARTIALLY COVERED | 949 rendered occurrences plus representative Mission 24 form interactions; not every form permutation submitted |
| 10 | Filters | PARTIALLY COVERED | 24 rendered occurrences; search/education/Admin contract tests; not every UI combination clicked |
| 11 | Sorting | PARTIALLY COVERED | 16 rendered occurrences; Admin allowlist tests; not every UI sort clicked |
| 12 | Pagination | PARTIALLY COVERED | 22 rendered occurrences; bounded Commerce/consultation/education/Admin contracts; not every page boundary on every list |
| 13 | Counters | COVERED | 703 rendered occurrences; Employer disposable DB before/after reconciliation; notification scoped counters 10/10 |
| 14 | Search/global-contextual search | PARTIALLY COVERED | Search 49/49; Admin privacy/search 60/60; actual 30-operation load; exhaustive query permutations not run on every surface |
| 15 | Notifications across accepted domains | COVERED | accepted notification/domain packs; reliability 15/15, operations 13/13, HTTP/inbox 10/10, Employer transition 41 |
| 16 | Progress/tracking | COVERED | 14 rendered occurrences; accepted Journey/pipeline/case/browser evidence |
| 17 | Job creation/edit/publish | COVERED | disposable journey plus publication 40 and post validation |
| 18 | Student job application validation | COVERED | disposable application/duplicate and accepted application suites |
| 19 | Application snapshots | COVERED | Skill Trust checks 21, 27, and 39 in 39/39 suite |
| 20 | Employer application pipeline | COVERED | disposable sync/ownership/counts plus pipeline notification 41 |
| 21 | Student verification | COVERED | accepted verification suites and real authenticated HTTP |
| 22 | Employer verification | COVERED | secure auth 39, organization verification contracts, realm tests |
| 23 | Agent verification | COVERED | Agent Portal 30/30 and real Agent HTTP |
| 24 | Institution verification | COVERED | Institution Portal 50/50 |
| 25 | Admin permissions | COVERED | Admin Super-Control 60/60; Moderator/Admin/SuperAdmin separation |
| 26 | Login/session/refresh/logout | COVERED | CI auth test, secure role suites, real registration/login/startup |
| 27 | Invalid/expired/tampered token | COVERED | real tampered-token 401 and accepted auth/session packs |
| 28 | Wrong realm | COVERED | browser 20/20 plus actual HTTP 401/403 |
| 29 | Suspension/revocation | COVERED | Agent/Institution/Skill Trust accepted state tests |
| 30 | Tenant isolation | COVERED | 936-endpoint inventory plus representative role/domain packs |
| 31 | IDOR | COVERED | Employer DB ownership; Agent, Institution, Trust, Cases, Commerce representative denial suites |
| 32 | Mass assignment | COVERED | zero direct request-body persistence candidates; server-derived actor/authority suites |
| 33 | Vault security | COVERED | Mission 24/26 plus Agent 30, Consultations 38, Cases 55 scoped grant checks |
| 34 | Commerce/payment source/synthetic security | COVERED | Commerce 41/41; Marketplace Payments 54/54; no provider/network |
| 35 | AI security/privacy | COVERED | accepted Mission 19/Mission 26; Admin 60 excludes conversations; provider not configured |
| 36 | Private messages/cases | COVERED | Consultations 38/38 and Cases 55/55 |
| 37 | Admin privacy boundaries | COVERED | Admin Super-Control 60/60 and browser/API realm checks |
| 38 | HTTP status semantics | COVERED | 47 real loopback HTTP assertions |
| 39 | Unexpected 5xx count | COVERED | zero |
| 40 | Loading/slow API | COVERED | accepted Mission 26 slow fixture and matrix settled-content assertions |
| 41 | 400 | COVERED | real bad registration |
| 42 | 401 | COVERED | real unauthenticated/tampered/wrong-token cases across domains |
| 43 | 403 | COVERED | real Student-to-Admin denial and role suites |
| 44 | 404 | COVERED | real missing job and route 404 smoke |
| 45 | 409 | COVERED | real duplicate registration and duplicate application contracts |
| 46 | 422 | COVERED | real organization verification policy validation |
| 47 | 429 | COVERED | canonical limiter; first 429 at request 121/122 |
| 48 | 500 | COVERED | safe synthetic production error response; no client stack/secret |
| 49 | Provider not configured | COVERED | accepted Copilot/payment UI/contracts; no provider call |
| 50 | Responsive 320/375/768/1024/1440 | COVERED | 892 combinations; all routes baseline, high-risk extra sizes |
| 51 | Page-level overflow | COVERED | zero matrix failures |
| 52 | Card overflow/wrapping | COVERED | zero critical overlap/clipped-control failures |
| 53 | Buttons/text/alignment | COVERED | matrix plus accepted Mission 24 interactive/responsive checks |
| 54 | Tables/forms/modals | PARTIALLY COVERED | representative table/dialog/form tests and all-route structure; not every modal interaction |
| 55 | Accessibility | PARTIALLY COVERED | Mission 24 keyboard/focus/dialog/status plus all-route probe; 38-route naming/manual residual |
| 56 | Countries/currencies/timezones/Unicode | COVERED | International Hardening 60/60 and Verified Data 86/86 |
| 57 | Local synthetic load | COVERED | 300 bounded loopback operations; zero failures |
| 58 | Concurrency | COVERED | accepted CAS/idempotency suites plus concurrency 12 read run |
| 59 | p50/p95/p99 | COVERED | 28.12/87.65/109.58 ms on 240 representative operations |
| 60 | Memory/event-loop behavior | COVERED | before/after RSS/heap and event-loop percentiles recorded; no formal leak claim |
| 61 | Duplicate-write protection | COVERED | application, review, Vault, Skill, notification, Commerce/provider, booking evidence |
| 62 | Unbounded query/N+1/retry inspection | PARTIALLY COVERED | high-risk paths inspected; 7/7 fixes; broad textual candidates not all manually classified |
| 63 | DevOps source QA | COVERED | production aggregate 8/8 and source policy checks |
| 64 | CI validation | PARTIALLY COVERED | local lint/auth/production/build/prerender/compose config; npm ci and container job not run offline |
| 65 | Startup | COVERED | real API success and required-dependency safe failure |
| 66 | Health/readiness | COVERED | healthy 200; required Redis not-ready 503 while live 200; metrics 200 |
| 67 | Graceful shutdown | COVERED | two clean exit-0 shutdowns; zero lingering API/worker processes |
| 68 | Env schema without secret values | COVERED | production verifier plus sentinel/no-value evidence |
| 69 | Secret/leak scan | COVERED | 2,046 tracked files; nine placeholders; zero credentials/client exposure |
| 70 | Rollback | PARTIALLY COVERED | source/readiness verification exists; controlled backup/restore/rollback drill not run |
| 71 | Monitoring/logging source readiness | COVERED | metrics actual HTTP, production verifier 8/8, safe client error response |

Totals: **61 COVERED, 10 PARTIALLY COVERED, 0 NOT COVERED.**

## Findings

| Severity | Count | Status |
| --- | ---: | --- |
| BLOCKER | 0 | none |
| P0 | 0 | none |
| P1 | 0 | none |
| MAJOR | 4 | fixed: localized-route reachability; Promise-returning React effects; high-risk unbounded/N+1 query families; uncontrolled default Mongo auto-index behavior |
| MINOR | 4 | fixed: stale Admin links, RTL skip-link overflow, two field-label gaps; open: one aggregate 38-route accessible-name residual |
| INFO | 5 | manual notification reconciliation, unenforced preference vocabulary, controlled Docker/runtime prerequisites, local fixture memory-limit observation, existing lint/build advisories |

The initial Mongo fixture process exhausted local memory after sustained browser
and runtime work. This was a local fixture capacity event, not an API finding;
the disposable datastore was restarted with a 256 MB cache and diagnostics
disabled, after which the Employer and final runtime evidence passed. No product
SLA or production capacity inference is made.

## Mission 27 prerequisites

1. Verify/provision the notification unique partial index in the controlled
   datastore with the existing explicit tooling and approved window.
2. Decide whether the manual one-history-ID notification reconciliation command
   is sufficient; otherwise configure a bounded observable worker consumer.
3. Define and enforce the cross-role notification preference/transactional
   policy before claiming preferences or quiet hours.
4. Execute controlled container/image, production dependency, backup/restore,
   rollback, observability/alerting, and deployment checks.
5. Complete manual accessibility/assistive-technology/contrast/200% zoom/full
   RTL review, prioritizing the 38 routes identified by the offline probe.
