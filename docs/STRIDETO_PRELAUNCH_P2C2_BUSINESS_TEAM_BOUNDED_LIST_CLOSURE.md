# STRIDETO P2C-2 Business and Team bounded-list closure

## Scope and preserved boundaries

This phase bounds Business contextual thread discovery, Business Provider listing management, and shared Provider Team membership retrieval. Request, Quote, and Case conversations remain separate contextual types. Business public marketplace discovery remains disabled, HSI remains disabled, and no database model, migration, backfill, destructive index operation, or new dependency was introduced.

## Previous behavior

- Business Messages always requested `page=1&limit=50`, making later conversations unreachable.
- My Services consumed the first bounded listing response but did not expose its page metadata or navigation.
- Team retrieval loaded every membership for the organization, loaded every corresponding account, then filtered domain and search criteria in Node.

## Current contracts

### Business threads

Thread discovery uses page/limit pagination with a default of 20 and maximum of 50. It sorts by latest activity descending with `_id` as the deterministic tie-breaker. Request, Quote, and Case filtering is applied in Mongo and resets the UI to page one. The list query returns thread snapshots only and does not query message history per row. Context message history remains a separate, independently bounded 20/default and 50/maximum contract.

### Business listings

Provider listing management uses page/limit pagination with a default of 20 and maximum of 50. Results use `updatedAt` descending and `_id` descending, expose `totalPages`, and accept the existing canonical moderation-status filter. Listing authority, moderation, publication, private intake, and marketplace gates are unchanged.

### Provider Team

The shared Team endpoint now returns `{ members, page, limit, total, totalPages }`, defaults to 20, and clamps at 50. Exact organization membership, product-domain access, role, and email search are applied in Mongo before the bounded window is returned. One `$lookup` batch-projects only member email, avoiding per-member account/profile queries. Business and Education Team views pass their exact `focusDomainId`; removing one domain assignment retains the other domain under the existing mutation contract.

## Query evidence

The disposable fixture contained 75 contextual threads (25 Request, 25 Quote, 25 Case), 65 Provider listings, and 66 Agency memberships spanning Education-only, Business-only, and dual-domain members, plus cross-subject records.

| Query | Existing index | Docs/keys examined | Returned | Page response | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| Provider threads | `gbs_message_thread_provider_inbox` | 75 / 75 | 20 | 3,267 bytes | No COLLSCAN; bounded provider-scope tie-break sort |
| Provider listings | `subjectType_1_subjectId_1_moderationStatus_1_updatedAt_-1` | 65 / 65 | 20 | 18,221 bytes | No COLLSCAN; bounded provider-scope tie-break sort |
| Team membership | `organizationId_1_agentAccountId_1` | 66 / 66 | 66 into the aggregate facet, 20 returned to Node | 10,180 bytes | No COLLSCAN; lookup is batched |

Thread and listing services each perform one bounded find and one exact-scope count. Team uses one aggregate plus the existing authorization/profile checks; it does not load the full population into Node. Existing indexes were sufficient, so no index was added. `autoIndex` remains off in the established runtime, and neither `syncIndexes` nor `dropIndexes` is used.

## Verification

- Focused source contract: three passing assertions groups.
- Focused disposable Mongo pack: five passing tests covering multiple pages, all three message contexts, message-history bounds, listing filters, Team domain separation, response bounds, and query plans.
- P2C-1, P2B, P1B, Provider product separation, authentication, and relevant 17D source/Mongo regressions passed.
- Production client build and touched-file static checks passed.
- Focused runtime matrix covers Messages, My Services, Business Team, and Education Team at 320, 375, 768, 1024, and 1440 pixels in explicit Light and Dark themes.

## Deferred

P2C-3 owns public-directory and per-Case child-history pre-scale closure. P2D owns dashboard actionability and the known Notifications filter-label accessibility item. Final four-theme/manual acceptance and load, concurrency, stability, and soak certification remain later gates.
