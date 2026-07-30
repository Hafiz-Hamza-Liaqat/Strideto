# Free Beta Additive Immutable Submission and Moderation Evidence Schema Report

## 1. Executive verdict

**READY TO COMMIT ADDITIVE IMMUTABLE SUBMISSION AND MODERATION EVIDENCE SCHEMA**

The C4 blocker-removal foundation is complete. Two existing Mongoose models
were extended additively with strict, typed, optional-but-complete immutable
evidence. Two existing model suites were extended, one dedicated disconnected
schema suite was created, and this report was created. Legacy documents remain
valid when the C4 envelopes are absent. No runtime integration was added.

## 2. Exact files created and modified

Modified:

1. `server/src/models/JobPublicationSubmission.js`
2. `server/src/models/JobModerationEvent.js`
3. `server/src/__tests__/jobPublicationSubmissionModel.test.js`
4. `server/src/__tests__/publishingSubmissionSupportModels.test.js`

Created:

1. `server/src/__tests__/publishingImmutableEvidenceSchema.test.js`
2. `docs/FREE_BETA_ADDITIVE_IMMUTABLE_SUBMISSION_MODERATION_EVIDENCE_SCHEMA_REPORT.md`

The separately untracked
`docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md` was not read or modified.

## 3. Autonomous engineering-loop summary

The implementation followed this graph:

```text
accepted C1 destination evidence
-> accepted C2 complete candidate evidence
-> accepted C3 stable operation evidence
-> additive submission persistence
-> reduced submitted-event evidence
-> disconnected model tests
-> full regression and static verification
-> independent schema-to-contract audit
```

The focused loop corrected Mongoose-specific behavior for partial subdocuments,
strict-mode cast errors, disconnected persisted-document simulation, and
nested immutable assignment. Static lint found and removed one control-regex
implementation issue. The self-audit found that default Mongoose scalar
casting was too permissive; explicit pre-cast primitive-type setters were
added. External URL/email evidence was also strengthened with canonical target
and domain relationship validation.

## 4. Source-of-authority hierarchy

The implementation applied:

1. Accepted C3-A/C3-A1 operation-context and reconciliation contract.
2. Accepted C2 publication-candidate contract.
3. Accepted C1 application-destination contract.
4. Accepted submission-adapter blocker audit.
5. Accepted transactional submission core and typed outbox architecture.
6. Accepted canonical Job schema and write boundary.
7. Existing model contracts and tests.

The outbox documents requested under older names are committed as:

- `docs/FREE_BETA_TYPED_PUBLISHING_OUTBOX_AUDIT.md`
- `docs/FREE_BETA_TYPED_PUBLISHING_OUTBOX_FOUNDATION_REPORT.md`

No C1, C2, C3, outbox, canonical Job, or transaction-service source was
modified.

## 5. Persistence evidence graph

```text
JobPublicationSubmission
├── existing durable owner/Job/idempotency/quota/rules/cycle fields
├── publicationCandidate
│   ├── exact 12-field C2 candidate
│   ├── exact 26-field canonical content
│   └── exact 11-field C1 destination evidence
└── operationEvidence
    ├── stable C3 operation identity and source-state/version
    ├── expected commit identity/version/state
    ├── moderation-event and new-cycle identities
    ├── two deterministic typed outbox keys
    └── rules and initiation evidence

JobModerationEvent
└── submittedEvidence
    ├── operation/submission identity
    ├── candidate kind/revision/hash
    ├── destination mode/digest
    ├── expected publication version and moderation cycle
    └── actor/event/timestamp relationship
```

The future adapter must create these values atomically. C4 performs no write.

## 6. Full persistence classification matrix

### C1 destination fields

| Field                     | Classification          |
| ------------------------- | ----------------------- |
| `schemaVersion`           | `PERSIST_ON_SUBMISSION` |
| `mode`                    | `PERSIST_ON_BOTH`       |
| `normalizedTarget`        | `PERSIST_ON_SUBMISSION` |
| `targetDigest`            | `PERSIST_ON_BOTH`       |
| `normalizedDomain`        | `PERSIST_ON_SUBMISSION` |
| `trustClassification`     | `PERSIST_ON_SUBMISSION` |
| `evidenceSource`          | `PERSIST_ON_SUBMISSION` |
| `evaluatedAt`             | `PERSIST_ON_SUBMISSION` |
| `validationPolicyVersion` | `PERSIST_ON_SUBMISSION` |
| `classifiedByActorType`   | `PERSIST_ON_SUBMISSION` |
| `classifiedByActorId`     | `PERSIST_ON_SUBMISSION` |

The event stores only the destination classification subset justified for the
submitted event: mode and digest. It does not copy the normalized target.

### C2 candidate fields

All 12 C2 candidate fields and all 26 canonical content fields are
`PERSIST_ON_SUBMISSION`. These candidate fields are also
`PERSIST_ON_MODERATION_EVENT`: `candidateKind`, `candidateRevision`, and
`candidateHash`. `expectedPublicationVersion` is `PERSIST_ON_BOTH`.
Destination mode/digest are covered above. The full content and full
destination evidence are not duplicated on the event.

### C3 operation fields

| Fields                                              | Classification/storage                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `schemaVersion`, `operationId`, `operationKind`     | `PERSIST_ON_BOTH`                                                                |
| `ownerType`, `ownerId`, `employerId`, `jobId`       | Existing submission ownership fields; Job/employer relation also exists on event |
| `idempotencyKey`, `requestFingerprint`              | Existing submission-only fields                                                  |
| `submissionId`                                      | Submission `_id`; existing event relation plus submitted evidence                |
| `acknowledgementId`                                 | Existing immutable `rulesAcknowledgementId` relation                             |
| `moderationEventId`                                 | Submission operation evidence; event `_id` supplies the linked record identity   |
| `newModerationCycleId`                              | Submission operation evidence                                                    |
| `actualModerationCycleId`                           | Existing submission `moderationCycleId`; event metadata and submitted evidence   |
| `expectedPublicationVersion`                        | `PERSIST_ON_BOTH`                                                                |
| `expectedPublicationState`                          | Submission operation evidence                                                    |
| `correctionOfSubmissionId`                          | Existing submission-only field                                                   |
| `rulesVersion`, `rulesDigest`                       | Submission operation evidence; acknowledgement is authoritative companion        |
| two outbox keys                                     | Submission operation evidence                                                    |
| `initiatedAt`                                       | Submission operation evidence; submitted event stores its exact event timestamp  |
| candidate/base fields                               | Exact C2 candidate envelope                                                      |
| expected committed version/state/current submission | Submission operation evidence                                                    |
| `quotaCharged`                                      | Existing immutable submission field                                              |

`REFERENCE_ONLY` evidence includes the actual acknowledgement, moderation
event, outbox records, canonical Job links, and approved-base record reached
through their durable identities. C4 does not duplicate those documents.

`CONTEXT_ONLY` evidence includes reconciliation observations, comparison
classifications, mismatch/missing codes, and runner decisions. None is stored.

`VOLATILE_NOT_PERSISTED` includes transaction attempt count, session/driver
values, read rounds, read authority, observed time, commit acknowledgement, and
logging telemetry.

`FORBIDDEN` includes raw requests, responses, headers, cookies, tokens,
credentials, database records, sessions, driver errors, arbitrary metadata,
payments, applicants, analytics, translations, scraper/source data,
`sourceUrl`, staff notes, reconciliation outcomes, and public approval state.

## 7. Submission evidence ownership

`publicationCandidate` owns the immutable C2 candidate and its nested C1
destination evidence. `operationEvidence` owns the nonduplicative C3 operation
subset that was not already represented by existing immutable submission
paths. Existing top-level fields remain authoritative for owner, Job,
idempotency, quota, acknowledgement, correction, and actual-cycle evidence.

Both new envelopes must be absent together for legacy records or present
together for C4 records.

## 8. Moderation-event evidence ownership

`submittedEvidence` belongs only to the submitted moderation event. It is
optional for legacy compatibility but complete and relationship-checked when
present. Rejection/changes-requested metadata and staff reason fields remain
separate and unchanged.

## 9. Candidate evidence

`publicationCandidate` has exactly:

```text
schemaVersion
policyVersion
candidateKind
candidateRevision
baseApprovedSubmissionId
baseApprovedCandidateHash
basePublicationVersion
expectedPublicationVersion
previousCandidateHash
content
destinationEvidence
candidateHash
```

It accepts only schema version `1`, policy `free-beta-2026-01`, and candidate
kinds `major_edit` or `correction`. Major edit is revision one with a null
predecessor hash and equal base/expected publication versions. Correction is
revision two or later with a canonical predecessor hash.

## 10. Destination evidence

The nested evidence has exactly the accepted 11 fields. Modes are
`internal_platform`, `external_url`, and `external_email`. The exact C1 trust,
source, and actor enum inventories are represented. Submission evidence is
restricted to the accepted system-classified initial state:

- internal mode: null target/domain, `INTERNAL_PLATFORM`, server-derived source;
- external modes: canonical target/domain, `ADMIN_REVIEW_REQUIRED`,
  employer-declared source;
- actor type `system`, actor ID null.

External URL/email targets are intentionally retained only in the restricted
immutable submission candidate because later approval/rendering must
reconstruct the exact destination. The event stores only mode and digest.
Internal Job ID is not added to destination evidence.

## 11. Operation evidence

`operationEvidence` has exactly:

```text
schemaVersion
operationId
operationKind
moderationEventId
newModerationCycleId
expectedPublicationVersion
expectedPublicationState
outboxDeduplicationKeys
initiatedAt
expectedCommittedPublicationVersion
expectedCommittedPublicationState
expectedCurrentSubmissionId
rulesVersion
rulesDigest
```

It cross-checks policy/plan/owner relationships, operation/submission kind,
candidate kind/version, expected source state, committed version/state/current
submission, deterministic outbox keys, initiation/acceptance timestamp, Job
revision, and applicable moderation-cycle relationships.

## 12. Base and version evidence

The candidate stores approved submission/hash, base publication version,
expected publication version, revision, predecessor hash, and candidate hash.
The operation evidence stores the source version/state and expected committed
version/state/current submission. Committed version must equal source version
plus one and the expected current submission must equal the document `_id`.

## 13. Outbox-key evidence

Exactly two strings are stored:

```text
<submissionId>:employer_submission_received
<submissionId>:admin_job_review_requested
```

Both are immutable and bounded to 160 characters. The submission hook verifies
their exact derivation. No outbox ObjectId or payload is stored.

## 14. Acknowledgement evidence

The existing required immutable `rulesAcknowledgementId` remains the durable
acknowledgement link. `operationEvidence.rulesVersion` and `rulesDigest`
capture the stable C3 expectation. Cross-document acknowledgement existence
and equality remain a future same-session/reconciliation responsibility.

## 15. Moderation-cycle evidence

The existing immutable submission `moderationCycleId` is the actual cycle.
`operationEvidence.newModerationCycleId` records the pre-generated fallback/new
cycle. Major edits and charged corrections require equality. A valid exempt
correction may reuse its predecessor cycle while retaining a distinct
pre-generated fallback. Submitted-event evidence must match event metadata.

## 16. Exact schema paths

New top-level paths:

```text
JobPublicationSubmission.publicationCandidate
JobPublicationSubmission.operationEvidence
JobModerationEvent.submittedEvidence
```

Nested inventories are exact: 12 candidate fields, 26 content fields, 11
destination fields, 14 operation fields, two outbox-key fields, and 14
submitted-event fields.

## 17. Exact nested subdocuments

Every C4 nested schema uses:

```text
_id: false
strict: "throw"
```

No nested document gets an implicit ObjectId. No unknown path is retained.

## 18. Exact types

Evidence uses only bounded String, Number, Boolean, and arrays of String, plus
strict single nested subdocuments. Mongo identities in C4 envelopes are
canonical lowercase 24-hex strings. Operation identity is a lowercase UUID v4.
Hashes are lowercase 64-hex strings. Contract timestamps are canonical UTC ISO
strings. Existing model relationship paths retain their ObjectId types.

Explicit setters reject implicit scalar type casting before Mongoose can turn
string numbers/booleans into apparently valid evidence.

## 19. Exact enums

Enums align with the accepted contracts:

- candidate kinds: `major_edit`, `correction`;
- operation kinds: `major_edit_submission`, `correction_submission`;
- destination modes: `internal_platform`, `external_url`, `external_email`;
- trust classifications: all four C1 literals;
- destination evidence sources: both C1 literals;
- destination actor types: `system`, `staff`, `security_operator`;
- employment types: `full-time`, `part-time`, `contract`, `internship`;
- Job types: `Government`, `Private`, `Internship`;
- work modes: `on_site`, `remote`, `hybrid`;
- event actors/actions reuse the accepted moderation enums.

## 20. Exact bounds

Candidate text and arrays use the C2 bounds, including title 1–200,
description 20–20,000, requirements/responsibilities/benefits at most 200,
skills at most 40, gallery at most 200, and the exact per-item limits.
Destination target/domain bounds are 2,048/253, email target is at most 254,
rules version is 1–100, hashes are exactly 64 hex, ObjectId strings are exactly
24 hex, UUID is exactly 36 characters, and outbox keys are at most 160.

## 21. Required and optional behavior

The three C4 top-level envelopes have `default: undefined`; no evidence is
fabricated. Submission candidate and operation envelopes are all-or-none.
Within a present envelope every exact field is required by completeness hooks,
including fields whose valid value may be null. The event envelope is optional
for legacy records and complete when present.

## 22. Partial-envelope rejection

Focused tests reject:

- candidate without operation evidence and the reverse;
- missing candidate root, content, destination, operation, outbox, or event
  fields;
- invalid candidate/version/predecessor relationships;
- invalid event/submission/cycle relationships;
- invalid typed values that Mongoose might otherwise cast.

## 23. Legacy compatibility

Representative legacy submission and moderation documents without C4 evidence
validate successfully. Absence stays `undefined`, not null or defaulted. It is
not interpreted as C3 commit proof. Existing required fields, hooks, indexes,
state invariants, and append-only behavior are preserved.

## 24. Immutability behavior

Every new envelope, nested subdocument, scalar, and array path is marked
`immutable: true`. Disconnected persisted-document tests cover:

- top-level envelope replacement;
- nested hash, operation ID, version, destination, cycle, and outbox-key
  changes;
- nested object replacement;
- array replacement/in-place mutation.

Depending on Mongoose path behavior, immutable assignment is either rejected
as a strict immutable error or ignored. In-place mutations detected as
modified are rejected by the parent validation hook. Moderation events retain
their existing append-only save/query protections.

## 25. Mongoose immutability limitations

Schema immutability alone cannot prove cross-document existence, transaction
atomicity, or an unchanged database value during arbitrary update operations.
Future repository methods must use strict allowlists, validators, create-only
submission/event behavior, and the accepted write boundary. Query-update
protection must not be assumed without those repository guarantees.

The model does not recompute the C2 candidate hash or C1 target digest. Those
cryptographic values must be built and validated by the accepted pure
contracts before persistence and checked again by the future adapter.

## 26. Strict-mode behavior

New raw envelopes reject unusual prototypes, arrays where objects are
required, symbols, accessors, hidden fields, dotted/operator/prototype keys,
unknown fields, wrong primitive types, Map, Set, RegExp, raw records, request/
session material, payments, applicants, analytics, translations, scraper
fields, and arbitrary metadata.

## 27. No-Mixed guarantee

No `Schema.Types.Mixed`, Mongoose Mixed path, Map path, or arbitrary key/value
record was introduced. Runtime schema traversal verifies that every new nested
path is typed and neither Mixed nor Map.

The pre-existing legacy `verificationSnapshot.requiredProfileChecks` Map is
unchanged and outside the C4 envelopes.

## 28. Error privacy

New custom validation messages are stable category/path messages. Custom
ObjectId, UUID, hash, timestamp, type, text, destination, relationship, and
immutability errors do not echo the submitted value. Focused tests verify that
private operation and destination values are absent from validation messages.
No global error handling was changed.

## 29. Index preservation

No index declaration was added, removed, or modified:

- `JobPublicationSubmission`: 11 existing indexes.
- `JobModerationEvent`: four existing indexes.

No C4 evidence path appears in an index. No index command was executed.

## 30. Dedicated C4 test results

- Suites: 1
- Assertions: 352
- Failures: 0

The suite runs disconnected and covers exact inventories, types, enums,
bounds, nullability/completeness, relationship validation, hostile inputs,
error privacy, legacy compatibility, immutability, index preservation,
serialization, and zero database connection.

## 31. Existing model test results

- Submission model: 1 suite, 40 assertions.
- Support models: 1 suite, 36 assertions.
- Failures: 0.

Both existing tests were modified only to extend C4 schema/legacy/index/
projection coverage and to report exact assertion counts.

## 32. C1, C2, and C3 regressions

- Application Destination: 1 suite, 1,224 assertions.
- Publication Candidate: 1 suite, 321 assertions.
- Publishing Operation Context: 1 suite, 197 assertions.
- Publishing Reconciliation: 1 suite, 282 assertions.
- Failures: 0.

No accepted contract was weakened or changed.

## 33. Publishing, outbox, and canonical regressions

- Publishing service/policy/quota regressions: 5 suites, 253 accepted
  assertions.
- Typed publishing outbox: 2 suites, 232 assertions.
- Canonical Job schema/write boundary: 2 suites, 516 assertions.
- Failures: 0.

Combined C4 and regression result:

- Suites: 16
- Assertions: 3,453
- Failures: 0

## 34. Lint, build, and formatting

- Server lint: passed with zero errors.
- Client lint: passed with zero errors and 52 pre-existing warnings.
- Client no-write production build: passed using a verified temporary output
  directory removed after completion.
- Prettier: passed for all six authorized C4 files.
- `git diff --check`: passed.

The build retained existing Vite advisory warnings about mixed static/dynamic
imports and large chunks. No client file was changed.

## 35. Static scans

Passed:

- trailing whitespace and conflict markers;
- newly added Mixed/Map/arbitrary metadata;
- model-to-pure-contract imports;
- database connection/index commands;
- network and environment reads;
- filesystem writes;
- logging, timers, listeners, and dispatch;
- sensitive-value patterns;
- candidate/destination/identifier leakage in errors;
- exact schema, enum, bound, immutable-path, and index inventories;
- legacy and disconnected compilation probes;
- JSON serialization.

## 36. Self-audit findings

The independent review found:

1. Mongoose could implicitly cast scalar string values without explicit
   pre-cast rejection.
2. External destination evidence needed stronger canonical target/domain
   relationship validation at the persistence boundary.
3. Disconnected immutability tests initially marked only the parent document
   persisted, not its subdocuments.

All three were corrected within the authorized files. No remaining C1/C2/C3
field, persistence category, enum, bound, legacy rule, or privacy requirement
is missing.

## 37. Repairs performed

- Added strict primitive-type setters to every new scalar evidence path.
- Added canonical external HTTPS/email target and domain checks.
- Corrected persisted subdocument simulation in immutability tests.
- Distinguished strict immutable validation errors, ignored assignments, and
  detected in-place mutations.
- Added wrong-type, canonical destination, privacy, and hostile-shape tests.
- Replaced one lint-incompatible control-character regex with code-point
  checks.
- Applied Prettier only to authorized files.

## 38. Known limitations

- The transaction service does not populate the new evidence.
- The model evidence is dormant.
- Canonical Job Mongoose CAS remains absent.
- Reconciliation repository and unknown-commit runner remain absent.
- Production index/topology semantics remain unproved.
- Public pending-review gating remains absent.
- Staff destination review remains absent.
- The Mongoose submission adapter remains absent.
- Runtime wiring remains absent.
- Cross-document evidence and cryptographic digest recomputation remain future
  adapter responsibilities.

## 39. Remaining blockers

A separately authorized next phase must map accepted C1/C2/C3 values into the
new model envelopes, enforce create-only repository behavior, execute all
writes in one transaction, implement canonical Job CAS, and later provide
trusted reconciliation reads/runner behavior. Replica-set/topology and
production index verification remain separate production-readiness work.

## 40. Next safe phase

Review this report, then create one scoped six-file C4 checkpoint commit. C5,
adapter, database, reconciliation, and runtime work must not begin as part of
that checkpoint.

## 41. Preservation statement

- Exactly two models modified: Yes, additive evidence schema only.
- Exactly two existing model tests modified: Yes, only required C4 coverage
  and assertion reporting.
- Exactly one dedicated C4 test created: Yes.
- Exactly one report created: Yes.
- `Job.js` changed: No.
- Transaction service changed: No.
- C1/C2/C3 contracts changed: No.
- Outbox model/repository changed: No.
- Controller, route, middleware, worker, scheduler, startup, or frontend
  changed: No.
- Public query/serializer behavior changed: No.
- Configuration, dependency, package, or deployment file changed: No.
- Database connection performed: No.
- Reconciliation read performed: No.
- Index applied or changed: No.
- Migration, seed, remediation, or backfill performed: No.
- Production data read or written: No.
- Network operation performed: No.
- File staged: No.
- Commit, push, or deployment performed: No.
- Mongoose adapter or runtime wiring started: No.
- Production acceptance report touched: No.

**STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED**
