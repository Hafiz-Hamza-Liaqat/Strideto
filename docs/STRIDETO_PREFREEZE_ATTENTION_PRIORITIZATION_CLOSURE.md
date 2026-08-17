# STRIDETO Pre-Freeze Attention Prioritization Closure

## Scope

This surgical phase corrects Education Provider dashboard attention selection
and verifies Business Provider attention ordering. No dashboard redesign,
workflow model, marketplace activation, HSI, filing, migration, or dependency
was introduced.

## Education defect and correction

The previous controller selected the newest 50 authorized active
`ProfessionalCase` records, materialized their IDs in Node, and only then
queried tasks, applications, and document requests. This was
truncate-before-prioritize behavior: an older Case with an earlier actionable
deadline could be invisible.

`getProviderAttention` now runs three bounded database-side aggregation
queries. Each query:

1. filters the canonical actionable child states;
2. joins the parent `ProfessionalCase` in Mongo;
3. enforces organization, authorized membership, and active lifecycle;
4. orders by the direct priority field with deterministic tie-breakers; and
5. returns at most five rows.

Tasks use due date, applications use deadline, and document requests use due
date. Null priority dates sort after dated work. No parent Case IDs or child
pages are materialized in Node.

## Business adversarial verification

Business Provider attention already filters canonical actionable states before
its bounded windows:

- Requests: submitted/provider-reviewing/ready-for-quote, oldest first.
- Quotes: sent, earliest sent first.
- Cases: open/in-progress/ready-for-submission, latest activity first.
- Context threads: bounded latest activity summaries.

The disposable adversarial fixture exceeded each request/quote window. Older
actionable request and quote records were surfaced, completed/non-actionable
states were excluded, and another Provider's records were not returned. No
Business production change was required.

## Evidence

The disposable Education fixture contained 75 authorized active Cases. An
urgent task, application, and document request were placed outside the former
newest-50 window. All three appeared after the correction. Completed work and
another Provider's urgent task did not appear; each result section remained
bounded to five.

Execution statistics from the disposable run:

| Query | Index | Docs | Keys | COLLSCAN | Blocking sort |
| --- | --- | ---: | ---: | --- | --- |
| Tasks | `responsibleActor_1_status_1_dueAt_1` | 62 | 62 | No | No |
| Applications | `status_1_deadlineAt_1` | 61 | 62 | No | No |
| Documents | `status_1_dueAt_1` | 61 | 62 | No | No |

## Tests and regressions

Focused source and Mongo tests are in
`server/src/__tests__/preFreezeAttentionPrioritizationClosure.test.js` and
`server/src/__tests__/preFreezeAttentionPrioritizationClosure.mongo.test.js`.
The existing P2D source contract was updated to assert the new aggregate
contract rather than the retired newest-50 implementation.

P1A, P2A, P2C-1, P2C-2, P2C-3, P2D, Provider workspace, and product-separation
focused regressions passed. The production Vite build passed. No client source
was changed by this phase.

## Safety

No database schema or migration was added; no index provisioning change was
needed. `autoIndex` remains off; no `syncIndexes` or `dropIndexes` was run.
Worker remains stopped, queue undrained, Business public marketplace off,
Wyoming draft/draft, filing text unapproved/empty, and HSI off.

## Deferred

The final all-route matrix, human keyboard walkthrough, native 200% review,
real screen-reader review, human theme review, and load/concurrency/stability
certification remain separate phases.
