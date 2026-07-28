# Free Beta Quota Foundations Report

**Phase:** E.1F-H2A-C
**Policy code:** `free_beta`
**Policy version:** `free-beta-2026-01`
**Runtime status:** Dormant additive foundations; no production wiring

## Scope

This correction retains the architecture-consistent paths explicitly approved
for H2A-C. It does not connect the foundations to controllers, routes,
middleware, startup, workers, webhooks, public job reads, employer activation,
or frontend clients.

The complete authorized foundation inventory is:

- `server/src/config/freeBetaPublishingPolicy.js`
- `server/src/models/EmployerPublishingQuotaGuard.js`
- `server/src/models/JobPublicationSubmission.js`
- `server/src/services/publishing/PublishingQuotaUsageService.js`
- `server/src/services/publishing/QuotaOwnerResolver.js`
- `server/src/services/publishing/SerializedQuotaGuard.js`
- `server/src/__tests__/freeBetaPublishingPolicy.test.js`
- `server/src/__tests__/jobPublicationSubmissionModel.test.js`
- `server/src/__tests__/publishingQuotaFoundations.test.js`
- `docs/FREE_BETA_QUOTA_FOUNDATIONS_REPORT.md`

H2A-C changed the policy, submission model, usage service, three focused tests,
and this report. The quota guard model, owner resolver, and serialized guard
were re-audited but did not require correction.

## Architecture path decisions

- The policy remains in `server/src/config` because the repository already
  locates central domain/security constants there.
- Publishing services remain under `server/src/services/publishing` because
  the repository uses domain service directories such as `career`, `search`,
  `analytics`, and `workflow`.
- Focused tests retain their descriptive camelCase names, matching the existing
  test convention.
- Transaction serialization remains a separate service so its database
  transaction responsibility is not mixed into usage calculation.
- No shared index or export file was added or changed.

These locations were explicitly authorized by H2A-C; no rename or move was
performed.

## Corrected contracts

### Free-only capacity

The policy now has one explicit numeric source of truth:
`maximumActiveFreeJobs: 5`. It also states that paid publishing is disabled and
paid jobs do not consume Free Beta active capacity.

Rolling usage queries require `planCode: free_beta` and `quotaCharged: true`.
Active usage joins each active job's `lastApprovedSubmissionId` to its approved
submission and counts it only when that submission has `planCode: free_beta`.
Future paid approvals are therefore outside this limit.

Submission eligibility remains separate from approval capacity. Pending-review
jobs do not reserve a slot, and an active major-edit transition projects one
released Free Beta slot.

### Submission ledger privacy and state

`contentSnapshot`, `verificationSnapshot`, `quotaSnapshot`, and
`moderationSummary` now use explicit embedded schemas rather than `Mixed`.
Their allowed top-level and nested shapes reject unknown request-shaped or
sensitive fields. Request fingerprints and content hashes require a
64-character hexadecimal server digest.

`quotaCharged` remains required, immutable, and has no default. The accepting
service must explicitly choose charged or exempt treatment; omission cannot
silently create an exemption.

Approved and rejected submissions require `reviewedAt`, require their matching
decision timestamp, reject timestamps on nonmatching states, require decision
and review times to match, and reject review times earlier than acceptance.

### Serialization and owner identity

Guard identities remain namespaced as `<ownerType>:<ownerId>`, so employer and
future organization IDs cannot collide. The guard stores only a revision and
timestamps, not authoritative quota counters. Acquisition still requires an
active Mongo transaction.

The beta owner resolver derives an employer owner. Future runtime integration
must pass the authenticated employer identity through this resolver and must
not accept an owner supplied by a frontend request.

## Runtime and production behavior

Only the new foundation modules and focused tests import these contracts.
Mongoose does not discover the new models automatically; model registration
occurs only if a module is imported. No existing startup file imports them.

No existing `Job`, `Employer`, controller, route, payment service, worker,
webhook, public query, activation flow, or frontend file changed. Existing
production behavior is therefore unchanged.

No migration, index deployment, seed, remediation, production-data operation,
dependency change, environment change, commit, push, or deployment was
performed.

## Verification

Focused suites:

- `node src/__tests__/freeBetaPublishingPolicy.test.js` — 42 assertions
- `node src/__tests__/jobPublicationSubmissionModel.test.js` — 31 assertions
- `node src/__tests__/publishingQuotaFoundations.test.js` — 45 assertions

Focused total: 3 suites, 118 assertions, 0 failures.

Existing employer/auth regressions:

- `node src/__tests__/employerDashboardMetrics.test.js` — 7 assertions
- `node src/__tests__/employerPostJobValidation.test.js` — 29 assertions
- `node src/__tests__/employerAuthRealmIsolation.test.js` — 5 assertions
- `node src/__tests__/authRealm.test.js` — 17 assertions
- `node src/__tests__/duplicateEmailUserIdIndexes.test.js` — 9 assertions

Regression total: 5 suites, 67 assertions, 0 failures.

`npm run lint` also completed with zero errors.

## Limitations and deferred work

- The existing `Job` model does not yet have canonical `publicationState` and
  `lastApprovedSubmissionId` paths. The default active Free Beta counter fails
  closed until a separately authorized canonical-state slice adds them.
- No submit, approval, close, expiry, moderation, or public-query runtime is
  wired.
- Snapshot schemas constrain field names and types. The future transaction
  service must still construct them from explicit sanitized projections; it
  must never spread request or database documents into a snapshot.
- Same-job immediate-predecessor checks, reviewer-requested field-diff rules,
  the seven-day correction deadline, and eligibility recomputation remain
  future transactional service responsibilities.
- Index definitions are additive and dormant. No database index creation or
  production cutover was run.
- Tests are focused unit/model contract tests with injected database
  boundaries; live Mongo transaction/concurrency verification remains deferred.

## Next safe slice

H2B may begin only after H2A-C is reviewed and explicitly accepted. Its scope
must be separately authorized. This report does not authorize runtime wiring,
canonical job migration, route changes, or production cutover.
