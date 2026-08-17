# STRIDETO P2C-1 Education bounded-list and Client-query closure

## Scope and baseline

- Starting HEAD: `74acca8a69f3a3c95637320b9030ab64598eee2a`.
- Scope: Provider Education Services, Leads, Consultations, Professional Cases, Clients, and Student Professional Cases.
- Business lists, Agency Team, public directory scaling, per-Case child histories, dashboards, and Notifications accessibility remain deferred to P2C-2/P2C-3/P2D.

## Pagination contracts

All scoped APIs use the existing page/limit convention, clamp page to at least 1, clamp limit to 1–50, and return `page`, `limit`, `total`, and `totalPages`.

| List | Route | Default / max | Stable order | UI page size |
| --- | --- | --- | --- | --- |
| Education Services | `GET /api/agent/services` | 50 / 50 | `createdAt DESC, _id DESC` | 20 |
| Education Leads | `GET /api/agent/leads` | 50 / 50 | `createdAt DESC, _id DESC` | 20 |
| Provider Consultations | `GET /api/agent/consultations` | 20 / 50 | `createdAt DESC, _id DESC` | 20 |
| Provider Cases | `GET /api/agent/cases` | 20 / 50 | `updatedAt DESC, _id DESC` | 20 |
| Student Cases | `GET /api/cases` | 20 / 50 | `updatedAt DESC, _id DESC` | 20 |
| Education Clients | `GET /api/agent/clients` | 20 / 50 | latest relationship activity DESC, Student `_id` DESC | 20 |

Filters remain server-side and persist while the user changes pages. Applying or clearing a filter resets the current page. If mutation removes the last item from the last page, the UI returns to the new final valid page. The shared compact Previous / Page X of Y / Next control remains keyboard-operable and mobile-safe; the client requests only the selected page.

## Canonical Client definition

The optimization preserves the existing relationship boundary:

- Organization owners/admins see unique Students related through an organization Lead, Consultation, or ProfessionalCase.
- Other Education Provider members see only Students related through a Consultation assigned to their exact membership or a ProfessionalCase authorizing that membership. An organization-wide Lead alone does not broaden their authority.
- Business records do not participate. A Client relationship continues to grant zero Vault access; exact active document grants are counted separately for only the returned page.

## Before and after query behavior

Previously, one Client-page request loaded every matching Lead, Consultation, and ProfessionalCase into Node, created a Set of Student IDs, issued a User query for the entire population, repeatedly filtered all source arrays per Student, filtered the assembled array in JavaScript, and only then sliced the requested page.

Now Mongo performs provider-scoped `$match` operations across the three existing collections, `$unionWith` combines relationship identities, `$group` deduplicates by Student and computes counts/latest activity, `$lookup` projects the bounded safe Student name, server-side filters apply before a `$facet` returns one page plus the unique-Client count. Node receives only the requested Client rows. One bounded grant-count query enriches that page.

The request uses four database operations: Provider profile lookup, active membership lookup, one Client aggregate (including bounded User lookup), and one exact-grant aggregate for page IDs. It does not issue per-Client queries.

## Query-plan evidence

A disposable 65-Student overlapping fixture gave each Student a Lead, Consultation, and ProfessionalCase. Page 1 returned 20 unique Clients, total 65, in a 7,242-byte JSON response.

`explain("executionStats")` reported indexed scans using existing `organizationId_1_userId_1` and `organizationId_1` indexes. Each scoped relationship branch returned/examined 65 fixture records with 65 keys and 65 documents examined. The exact aggregate contained `IXSCAN` and no `COLLSCAN`. No production index or schema change was required.

## Verification

- Focused source contract: 3/3 tests passed.
- Focused disposable Mongo contract: 3/3 tests passed, including multi-page bounds, unique totals, stable non-overlapping pages, filters, Provider/Student scope, response size, and the captured execution plan.
- P1A ProfessionalCase/Consultation, P2A service/discovery and historical truth, P1B Business communication, P1C trust authority, P2B route/trust projection, Marketplace, product separation, and auth/session focused regressions passed.
- Production Vite build passed. Touched client ESLint and touched JavaScript syntax checks passed with zero findings.

## Safety

- No database migration, backfill, new model, new dependency, `syncIndexes`, or `dropIndexes`.
- Model auto-index policy remains off.
- Business marketplace, Wyoming, filing authorization, HSI, Worker, and queue policy are unchanged.
- Protected Admin WIP and the protected stash are untouched.

## Deferred

- P2C-2: Business and Agency Team bounded-list closure.
- P2C-3: public directory deep scaling and per-Case child histories.
- P2D: actionability and accessibility closure, including the two known Notifications filter labels.

