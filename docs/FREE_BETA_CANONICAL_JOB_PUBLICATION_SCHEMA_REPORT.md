# Free Beta Canonical Job Publication Schema Report

- **Phase:** E.1F-H2B-B1-B with C2-A boundary proof
- **Result:** READY FOR FINAL CANONICAL SCHEMA AND WRITE-BOUNDARY RE-AUDIT
- **Runtime status:** Dormant schema projection only

## 1. Executive result

The canonical publication projection approved by the H2B-B1-A audit was added
to the existing `Job` schema without activating it. The change is additive:
ordinary legacy Job construction does not populate any canonical field, existing
legacy records remain valid, and no legacy field, default, validator, index,
hook, virtual, getter, setter, query, route, worker, or frontend behavior
changed.

The first acceptance audit found that recognizing the canonical paths exposed
two pre-existing generic Job-copy boundaries: Job translation creation and
admin Job duplication. E.1F-H2B-B1-B-C1 corrected those boundaries with
explicit positive projections. The canonical schema and focused schema test
were retained unchanged during that correction. No canonical publication
writer was activated.

No database connection was opened. No production data was read or written. No
migration, backfill, classification, index operation, adapter, outbox, runtime
wiring, commit, push, or deployment occurred.

## 2. Exact files changed

- Modified: `server/src/models/Job.js`
- Created: `server/src/__tests__/jobCanonicalPublicationSchema.test.js`
- Created: `docs/FREE_BETA_CANONICAL_JOB_PUBLICATION_SCHEMA_REPORT.md`

The separate C1 correction changed only the approved translation controller and
service, admin Job duplicate function, sanitizer evidence configuration, pure
write-boundary module, focused boundary test, and correction documentation.

The pre-existing
`docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md` remained untouched and
untracked.

## 3. Canonical fields added

| Field                        | Schema contract                                                                                                          | Eager default |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `publicationState`           | Optional string enum: `draft`, `pending_review`, `active`, `rejected`, `closed`, `expired`                               | None          |
| `publicationVersion`         | Optional until a canonical state is supplied; non-negative integer                                                       | None          |
| `currentSubmissionId`        | Optional ObjectId reference to `JobPublicationSubmission`; conditionally required for pending, active, and rejected Jobs | None          |
| `lastApprovedSubmissionId`   | Optional ObjectId reference to `JobPublicationSubmission`; required for active Jobs                                      | None          |
| `publishedAt`                | Optional Date; required for active Jobs                                                                                  | None          |
| `visibleUntil`               | Optional Date; required for active Jobs and cannot precede `publishedAt`                                                 | None          |
| `applicationsCloseAt`        | Optional Date; required for active Jobs and cannot be later than `visibleUntil`                                          | None          |
| `closedAt`                   | Optional Date; required for closed Jobs                                                                                  | None          |
| `expiredAt`                  | Optional Date; required for expired Jobs                                                                                 | None          |
| `rejectionSummary`           | Optional strict employer-safe subdocument; required for rejected Jobs                                                    | None          |
| `slugFrozenAt`               | Optional Date; required for active Jobs                                                                                  | None          |
| `policyVersion`              | Optional trimmed string, maximum 100 characters; required for pending, active, and rejected Jobs                         | None          |
| `publicationUpdatedAt`       | Optional Date                                                                                                            | None          |
| `publicationMigrationStatus` | Optional enum: `canonical_native`, `legacy_backfilled`, `legacy_compatible`, `manual_review`                             | None          |

The existing `slug` remains the canonical slug value. `slugFrozenAt` records
future freeze evidence without copying, changing, regenerating, or indexing the
legacy slug.

No Job-level publication plan code, moderation-cycle ID, payment state,
arbitrary metadata, applicant data, or staff-internal moderation text was
added. Plan code and moderation cycle remain authoritative on immutable
submission and moderation-event records.

## 4. Types, enums, and conditional validators

Cross-field requirements execute only when `publicationState` is explicitly
supplied:

- every explicit canonical state requires an explicit integer
  `publicationVersion`;
- `pending_review` requires `currentSubmissionId` and `policyVersion`;
- `active` requires `currentSubmissionId`, `lastApprovedSubmissionId`,
  `publishedAt`, `visibleUntil`, `applicationsCloseAt`, `slugFrozenAt`, and
  `policyVersion`;
- `rejected` requires `currentSubmissionId`, `policyVersion`, and the strict
  employer-safe `rejectionSummary`;
- `closed` requires `closedAt`;
- `expired` requires `expiredAt`;
- `visibleUntil` cannot be earlier than `publishedAt`;
- `applicationsCloseAt` cannot be later than `visibleUntil`.

The validators are synchronous field validators. They do not mutate the
document, execute queries, use middleware, or connect to a database.

`rejectionSummary` uses `{ _id: false, strict: "throw" }` and allows only:

- `reasonCode`: required uppercase code, maximum 100 characters;
- `ownerMessage`: required employer-safe text, maximum 1,000 characters;
- `eventId`: required ObjectId reference to `JobModerationEvent`;
- `decidedAt`: required Date.

Unknown keys, internal staff text, request data, verification evidence,
applicant data, tokens, and arbitrary metadata fail safely during embedded
document casting.

## 5. Dormancy behavior

All 14 canonical fields have no eager default. An ordinary current Job creation
therefore omits every canonical path. Explicit `null` compatibility values also
validate when no canonical state has been selected.

There is no mapping from `status`, `approvalStatus`, `planType`, `expiresAt`,
`paidUntil`, Mongoose `__v`, or any legacy timestamp. No setter derives a
canonical value. After the C1 boundary correction, no startup initializer,
worker, active controller, service, route, or query supplies these fields. Job
translation and duplication explicitly exclude the canonical projection and
unknown future fields.

The future canonical writer must explicitly initialize
`publicationVersion`. Mongoose `__v` remains unrelated to and insufficient for
the publication compare-and-set contract.

## 6. Legacy compatibility

`Job.js` changed only additively. No legacy Job field was removed, renamed, or
reinterpreted.

The focused suite confirms that:

- a legacy Job containing only the existing required fields validates;
- ordinary Job construction does not materialize canonical paths;
- existing `status` states and its `active` default are unchanged;
- existing `approvalStatus` states and its `approved` default are unchanged;
- existing `planType` states and null default are unchanged;
- existing slug required behavior is unchanged;
- existing application mode, link, email, deadline, and expiry field types and
  defaults are unchanged.

Current public visibility, employer dashboards, admin moderation, applications,
payments, and frontend behavior continue to use their existing legacy paths.

## 7. Index and middleware preservation

No index, partial index, unique index, TTL index, or automatic index operation
was added.

The focused suite compares the complete 15-entry `Job` index declaration list
to its pre-phase baseline. None of those indexes contains a canonical field.

No hook or middleware was added. The existing registered pre-save count remains
seven, no pre-validate middleware is registered, and the existing post-save and
post-init counts remain unchanged. Existing translation and slug behavior was
not modified by the schema itself. The later C1 correction changed only the
translation and duplication input boundaries while preserving slug hooks and
legitimate translated content.

No new virtual, getter, or setter was added.

## 8. Runtime isolation

`Job.js` still imports only:

- `mongoose`;
- the existing slug utility;
- the existing translation-field mixin.

It imports no publishing service, controller, route, payment module, outbox,
transaction runner, worker, or `JobPublicationSubmission` model module.
Submission links are declared by reference name only and are not populated
automatically.

The first acceptance audit found that the generic translation and duplicate
constructors could copy newly recognized schema paths. The C1 correction now
uses explicit source and override projections in both paths. Canonical,
approval, payment, plan, analytics, monetization, scraper, translation-linkage,
version, timestamp, and future unknown fields are excluded by default.

Repository reference scans found no active controller, route, public query,
employer dashboard query, frontend module, payment module, webhook, worker, or
scheduler intentionally reading or writing the canonical Job projection.
Dormant H2A/H2B-A publishing foundations remain outside the production
composition root.

Adding the schema paths alone cannot change public visibility or trigger a
database operation.

## 9. Focused tests

Command:

```text
node src/__tests__/jobCanonicalPublicationSchema.test.js
```

Result:

- Suites: 1
- Assertions: 107
- Failures: 0

Coverage includes:

- legacy validation and absence of eager canonical fields;
- all six publication states and unknown-state rejection;
- integer publication-version boundaries and cast failures;
- valid and malformed submission references;
- pending, active, rejected, closed, and expired conditional requirements;
- visibility and application-close ordering;
- strict employer-safe rejection summaries;
- all four migration classifications;
- slug-freeze evidence;
- prohibited Job-level plan, moderation-cycle, and payment fields;
- exact legacy field behavior;
- exact index declaration preservation;
- exact middleware preservation;
- import isolation;
- separation of `publicationVersion` from Mongoose `__v`.

No test connected to MongoDB or depended on production data.

The C2-A write-boundary suite also completed successfully:

- Suites: 1
- Assertions: 409
- Failures: 0

It covers the complete canonical field set, positive translation and duplicate
projections, structured-value isolation, override-envelope validation, actual
installed sanitizer behavior, ownership and system-state exclusion, future-field
denial, route-permission preservation, and database-free model validation.

The C2 audit identified that the first projection helper cloned arrays but
returned `Date` and BSON `ObjectId` instances by reference. C2-A corrected the
shared cloning primitive used by both translation and duplication. Valid Dates
now preserve their timestamps in distinct instances. ObjectIds are normalized
to lowercase canonical 24-character strings, which the existing Job schema
casts back to the same identifier during ordinary model construction. Arrays
and plain objects are recursively cloned, including nested Date and ObjectId
values. Invalid Dates, circular values, custom class instances, accessors,
non-enumerable fields, prototype-pollution names, dotted keys, and
`$`-prefixed nested keys fail safely. The source object is neither mutated nor
frozen.

The focused suite now constructs `express-mongo-sanitize` 2.2.0 itself with the
same exported options factory used by server startup. It proves installed
middleware removal behavior for body, query, and parameter keys; a private
request-local Symbol records only bounded location evidence. Body evidence is
consumed only by Job translation validation. Query and parameter evidence does
not trigger a body rejection, and non-Job translation behavior is unchanged.
Sequential and concurrent requests using the same middleware instance retain
independent evidence.

## 10. Regression verification

Publishing regressions:

- Suites: 7
- Assertions: 313
- Failures: 0

This consists of the four accepted H2B-A suites with 195 assertions and the
three accepted H2A suites with 118 assertions.

Employer/auth regressions requested by this phase:

- Suites: 4
- Assertions: 58
- Failures: 0

All requested suites completed successfully.

Combined verified result:

- Suites: 13
- Assertions: 887
- Failures: 0

## 11. Lint, build, and formatting

- Server lint: passed with zero errors.
- Client lint: passed with zero errors and 52 pre-existing warnings.
- Client production build: passed; output was written only to a verified
  temporary directory and removed after the build.
- Prettier: the C2-A boundary module, boundary test, and both reports pass.
  Formatting differences in existing runtime files were inspected without
  reformatting unrelated lines.
- Git whitespace validation: passed.
- Direct untracked whitespace validation: passed.
- Sensitive-value scan: passed without printing values.

The client build retained its existing dynamic-import and chunk-size warnings.
No unrelated file was changed to address a warning.

## 12. Limitations and remaining blockers

This phase supplies schema capability only. It does not establish:

- a canonical Job repository or Mongoose submission adapter;
- transaction runner or transaction-bound publishing outbox;
- posting-rules registry;
- moderation approval/rejection service;
- active Free Beta capacity query or approval guard;
- public/apply/dashboard canonical query cutover;
- expiry worker;
- destination-ownership verifier;
- production transaction-topology evidence;
- legacy classification, migration, backfill, reconciliation, or index
  readiness.

The admin duplicate operation and Job translation creation no longer clone a
complete stored Job. Both use explicit positive projections and exclude
canonical fields and other protected system state. Future Job schema additions
do not become writable or copyable unless deliberately added to the centralized
boundary policy.

No existing or production Job has been classified. Paid publishing remains
disabled. The schema fields must remain dormant until separately audited
runtime, migration, and operational phases are approved.

## 13. Next safe phase

The next safe phase is a read-only acceptance re-audit of the combined
E.1F-H2B-B1-B schema and E.1F-H2B-B1-B-C1 write-boundary correction. It must
independently confirm schema compatibility, positive projections, runtime
isolation, tests, regression results, and exact scope before any later phase is
considered.

## 14. Preservation statement

- Existing runtime behavior changed: only the two approved Job write boundaries.
- Legacy Job fields removed, renamed, or reinterpreted: No.
- Existing Employer model changed: No.
- H2A/H2B-A changed: No.
- Controllers/routes/public queries changed: translation and duplicate
  controllers only; routes and public queries unchanged.
- Payment/webhook code changed: No.
- Frontend/theme/responsiveness changed: No.
- Authentication/RBAC weakened: No.
- Security/privacy weakened: No.
- Configuration/dependencies changed: No.
- Production data read/written: No.
- Database connection performed: No.
- Migration/backfill/index operation performed: No.
- Files staged: No.
- Commit performed: No.
- Push performed: No.
- Deployment performed: No.
- Adapter/outbox implementation started: No.
- Production acceptance report changed: No.

STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED
