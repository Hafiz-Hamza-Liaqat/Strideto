# Free Beta Publishing Operation Context and Reconciliation Authoritative Contract Audit

## 1. Executive verdict

**READY FOR DORMANT PUBLISHING OPERATION CONTEXT AND RECONCILIATION PURE CONTRACT IMPLEMENTATION**

The operation-context and reconciliation decisions required for a database-free
C3 implementation are resolved. The implementation must use two immutable
layers: a pre-transaction operation seed and a callback-produced commit context.
It must classify strict reduced observations supplied by a later adapter and
must never read, write, retry, repair, publish, moderate, or dispatch anything.

This audit creates exactly this documentation file. It does not implement C3,
alter an existing file, or authorize adapter or runtime work.

## 2. Repository state

- Audited HEAD: `e39ced7751f2729bc0d7643ce55466569634ee84`
- Latest commit: `feat: add dormant publication candidate contract`
- Branch: `main...origin/main [ahead 13]`
- Existing untracked file:
  `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- Tracked modifications before this audit: none
- Staged files before this audit: none
- Existing production acceptance report: untouched and untracked

## 3. Source-of-authority hierarchy

The required precedence was applied:

1. `docs/FREE_BETA_SUBMISSION_ADAPTER_BLOCKER_CONTRACT_AUDIT.md`
2. `docs/FREE_BETA_PUBLICATION_CANDIDATE_AUTHORITATIVE_CONTRACT_AUDIT.md`
3. `docs/FREE_BETA_TRANSACTIONAL_SUBMISSION_CORE_REPORT.md`
4. `docs/FREE_BETA_TYPED_PUBLISHING_OUTBOX_AUDIT.md`
5. `docs/FREE_BETA_CANONICAL_JOB_PUBLICATION_SCHEMA_REPORT.md`
6. Current strict schemas and service boundaries
7. Tests
8. Older policy examples

The requested outbox document names differ in the repository. The exact
accepted documents used are:

- `docs/FREE_BETA_TYPED_PUBLISHING_OUTBOX_AUDIT.md`, representing the accepted
  publishing outbox architecture audit;
- `docs/FREE_BETA_TYPED_PUBLISHING_OUTBOX_FOUNDATION_REPORT.md`, representing
  the accepted publishing outbox foundation report.

The other authoritative files read were:

- `docs/FREE_BETA_MONGOOSE_SUBMISSION_ADAPTER_READINESS_REAUDIT.md`
- `docs/FREE_BETA_CANONICAL_JOB_WRITE_BOUNDARY_CORRECTION_REPORT.md`
- `docs/FREE_BETA_PUBLICATION_CANDIDATE_CONTRACT_FOUNDATION_REPORT.md`
- `docs/FREE_BETA_APPLICATION_DESTINATION_CONTRACT_FOUNDATION_REPORT.md`
- `docs/FREE_BETA_PUBLISHING_POLICY_CONTRACT.md`

Implementation files inspected were the current Job, submission, moderation,
quota-guard and outbox models; the Job write boundary; the dormant transaction,
eligibility and correction services; both accepted pure contracts; the typed
outbox contract/repository; and their focused tests.

### Conflict resolutions

- The authoritative C2 candidate contract replaces the older partial
  `contentSnapshot` concept for future integration. Current persistence remains
  unchanged and insufficient until C4.
- The accepted outbox foundation fixes cardinality at exactly two intents and
  fixes durable reconciliation identity at the two unique deduplication keys.
  Outbox ObjectIds are not pre-generated.
- The blocker audit requires acknowledgement identity even though the C3 prompt
  identity checklist does not list it. `acknowledgementId` is therefore
  required.
- `operationId` is a bounded correlation identity, not the durable idempotency
  identity. Owner, idempotency key, fingerprint, and pre-generated record
  identities are the durable proof.
- The current service generates identifiers and time inside the transaction
  callback. The future C3 pure module validates server-generated values, while
  the separately authorized C5 service correction must move generation before
  transaction execution.
- There is no quota ledger. Charged usage is derived from accepted submission
  records. The quota-guard revision serializes work but is not an
  operation-linked entitlement ledger.

No implementation-critical product or architecture decision remains for the
pure C3 modules.

## 4. Existing transaction-flow map

| Effect                          | Current model or boundary                                                         | Operation                     | Identity and uniqueness                                                           | Version/CAS                                                                          | Status                                                         |
| ------------------------------- | --------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Quota serialization             | `EmployerPublishingQuotaGuard` through `SerializedQuotaGuard.acquire`             | Upsert and increment          | Deterministic owner guard `_id`; unique owner type/ID                             | Guard revision increments                                                            | Implemented dormant boundary; injected into service            |
| Posting-rules evidence          | `EmployerPostingRulesAcknowledgement`                                             | Create                        | Pre-generated `_id`; unique `submissionId`                                        | Append-only repository behavior required                                             | Model exists; injected repository remains conceptual           |
| Submission entitlement/evidence | `JobPublicationSubmission`                                                        | Create                        | Pre-generated `_id`; unique owner type/owner ID/idempotency key                   | Immutable accepted record                                                            | Model exists; C2 candidate/destination fields remain absent    |
| Canonical Job                   | `Job` through future canonical repository                                         | Compare-and-set update        | Existing Job `_id`                                                                | Owner, state, base link and publication version predicate; version increments by one | Schema exists; adapter/CAS remains conceptual                  |
| Moderation evidence             | `JobModerationEvent`                                                              | Append                        | Pre-generated `_id`; relation to submission/Job/cycle                             | Append-only repository behavior required                                             | Model exists; future candidate evidence remains absent         |
| Typed outbox                    | `PublishingOutboxIntent` through `MongoosePublishingOutboxRepository.enqueueMany` | One ordered two-record create | Mongo-generated `_id`; unique deterministic deduplication key per submission/type | Create-only; same session required                                                   | Dormant model/repository implemented                           |
| Candidate evidence              | `PublicationCandidateContract`                                                    | Pure build/validate           | SHA-256 `candidateHash`, revision and base binding                                | Expected/base publication-version relationships                                      | Pure contract implemented; not persisted or service-integrated |
| Destination evidence            | `ApplicationDestinationContract` inside candidate                                 | Pure build/validate           | Destination digest and exact eleven-field evidence                                | Job relationship and trust evidence                                                  | Pure contract implemented; not persisted or service-integrated |

The intended atomic submission transaction includes the quota-guard write,
acknowledgement create, submission create, canonical Job CAS, moderation-event
append, and both outbox creates. Candidate and destination evidence are values
inside the future immutable submission/event records, not separate writes.

No current production runner composes these effects. The dormant transaction
service only specifies injected interfaces. C3 does not assert that unrelated
approval, expiry, delivery, or migration writes belong in this transaction.

## 5. Unknown-commit definition

`COMMIT_RESULT_UNKNOWN` means the transaction callback completed successfully,
the runner requested commit, and the driver did not provide authoritative
acknowledgement that the commit either succeeded or aborted. It is not an
ordinary transaction failure.

| Category                                 | Known and unknown                                                                            | Replay/response rule                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `DEFINITELY_NOT_STARTED`                 | No session transaction or write callback began                                               | A new same-key execution is safe; no reconciliation                               |
| `APPLICATION_ERROR_BEFORE_COMMIT`        | Application/domain code stopped before commit request; transaction is aborted or never began | Preserve the domain failure; same-key retry only when the domain contract permits |
| `RETRYABLE_DRIVER_ERROR`                 | Driver marks an in-flight attempt transient before commit outcome becomes unknown            | Bounded driver callback retry may occur with the same seed and IDs                |
| `DEFINITELY_ABORTED`                     | Driver/runner authoritatively confirms abort                                                 | No success response; later same-key request may retry                             |
| `COMMIT_ACKNOWLEDGED`                    | Driver confirms commit                                                                       | Return success; no reconciliation or retry                                        |
| `APPLICATION_ERROR_AFTER_COMMIT_REQUEST` | Application-side handling fails after commit was requested                                   | Treat as unknown unless commit status is independently authoritative              |
| `COMMIT_RESULT_UNKNOWN`                  | Callback succeeded; commit acknowledgement is lost or ambiguous                              | Never start a new logical write; reconcile with captured commit context           |
| `NON_RETRYABLE_DRIVER_ERROR`             | Driver failure is non-transient and commit was not requested or is authoritatively aborted   | Safe failure; no automatic retry unless separately classified                     |

Only `RETRYABLE_DRIVER_ERROR` before an unknown commit may cause an automatic
transaction callback retry. `COMMIT_RESULT_UNKNOWN` requires reconciliation.
It may yield success only after `COMMITTED`; it may yield a retryable failure
only after authoritative `NOT_COMMITTED`. `INDETERMINATE`, `CORRUPT`, and
`SECURITY_CONFLICT` require no write and bounded operator handling.

## 6. Logical operation versus transaction attempt

The operation context represents one server-side logical employer submission
attempt. It survives driver callback retries and the reconciliation rounds
caused by that invocation. It is not:

- one individual transaction callback attempt;
- a moderation cycle;
- the durable identity of every later HTTP replay.

The durable business-idempotency identity is:

```text
ownerType + ownerId + idempotencyKey + requestFingerprint
```

A later HTTP replay may have a new `operationId`, but it must resolve the same
accepted record through the durable identity. Within one runner invocation,
callback retries reuse the same operation seed, record IDs, candidate intent,
timestamp, and deduplication keys. `transactionAttempt` is runner-local
telemetry, starts at one, is bounded by runner policy, and is never stored in
the seed, commit context, fingerprint, or reconciliation evidence.

## 7. Operation identity

`operationId` has this exact contract:

- runtime value: primitive string;
- canonical format: lowercase RFC 4122 UUID version 4, 36 characters;
- generation authority: server adapter using a cryptographically secure UUID
  generator;
- generation time: once, before transaction/session creation;
- uniqueness domain: one server-side logical submission attempt;
- client accepted: never;
- persisted: no, in the pure C3 contract;
- record containment: no model is required to contain it;
- fingerprint-bound: no;
- public exposure: no;
- logging: only the full canonical UUID under the bounded internal
  correlation-ID policy; never combined with private record values.

It is distinct from every record ID, candidate hash/revision, Job/employer ID,
moderation-cycle ID, idempotency key, and HTTP request ID. It is carried in the
seed, commit context, reconciliation request, and internal result correlation.

## 8. Pre-generated record identities

| Field                  | Exact contract                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `submissionId`         | Canonical lowercase 24-hex Mongo ObjectId string generated once by the adapter before transaction execution; persisted as submission `_id`; reused on callback retry; required reconciliation identity |
| `acknowledgementId`    | Same ObjectId contract; persisted as acknowledgement `_id` and linked by submission; required reconciliation identity                                                                                  |
| `moderationEventId`    | Same ObjectId contract; persisted as submitted event `_id`; required reconciliation identity                                                                                                           |
| `newModerationCycleId` | Same ObjectId contract; stable fallback cycle generated before execution; used unless a valid exempt correction reuses predecessor cycle                                                               |
| `jobId`                | Existing canonical Job ObjectId; not generated by C3; ownership must be proved by repository reads                                                                                                     |
| `candidateHash`        | Lowercase 64-hex C2 SHA-256 value; constructed by the accepted candidate contract inside authoritative transaction reads; not an ObjectId                                                              |
| `operationId`          | Server UUID v4 described above                                                                                                                                                                         |
| Outbox identities      | No pre-generated outbox `_id`; exactly two typed deterministic deduplication keys identify the records                                                                                                 |
| Quota ledger ID        | None; no quota ledger exists                                                                                                                                                                           |

The strict `outboxDeduplicationKeys` object has exactly:

```text
employerSubmissionReceived
adminJobReviewRequested
```

Their respective values are exactly:

```text
<submissionId>:employer_submission_received
<submissionId>:admin_job_review_requested
```

The object is ordered by those field names, deeply frozen, and limited by the
accepted 160-character outbox key bound. Unexpected or additional outbox
records are reconciliation corruption, not additional operation cardinality.

## 9. Exact operation-context schema

### 9.1 Operation seed

The seed has exactly these 19 fields in canonical order:

```text
schemaVersion
policyVersion
operationId
operationKind
ownerType
ownerId
employerId
jobId
idempotencyKey
submissionId
acknowledgementId
moderationEventId
newModerationCycleId
expectedPublicationVersion
expectedPublicationState
correctionOfSubmissionId
rulesVersion
outboxDeduplicationKeys
initiatedAt
```

All are required. `correctionOfSubmissionId` is the only nullable seed field.
It must be null for `major_edit_submission` and a canonical ObjectId for
`correction_submission`.

`ownerType` is exactly `employer`. `ownerId` and `employerId` are equal
canonical IDs under Free Beta. They are both retained because owner-scoped
idempotency and authenticated Employer ownership are separate checks.

### 9.2 Callback-produced commit context

The commit context contains the seed fields unchanged, followed by exactly:

```text
requestFingerprint
candidateHash
candidateRevision
candidateKind
baseApprovedSubmissionId
baseApprovedCandidateHash
basePublicationVersion
actualModerationCycleId
expectedCommittedPublicationVersion
expectedCommittedPublicationState
expectedCurrentSubmissionId
rulesDigest
quotaCharged
```

The final context therefore has exactly 32 fields. It contains no raw
candidate, destination target, quota snapshot, Employer verification snapshot,
request, response, session, driver value, or arbitrary metadata.

## 10. Schema and policy versions

- `schemaVersion`: integer `1`
- `policyVersion`: exact string `free-beta-2026-01`

Both exist in seed and commit context and must match exactly. Candidate schema
version remains owned by the candidate value and is validated by
`validatePublicationCandidate`; it is not copied into a differently named C3
policy field. The candidate policy version must equal the context policy
version.

Both versions are intended to be persisted through the linked submission
evidence in later phases. C3 does not persist either. No context digest exists,
so neither participates in a C3 digest.

## 11. Operation kinds

The exact enum is:

```text
major_edit_submission
correction_submission
```

Rules:

- `major_edit_submission` requires candidate kind `major_edit`, candidate
  revision `1`, source state `active`, a non-null approved base, no correction
  predecessor, and committed state `pending_review`.
- `correction_submission` requires candidate kind `correction`, prior revision
  plus one as already enforced by C2, source state `rejected`, a non-null
  `correctionOfSubmissionId`, the same approved-base binding as its predecessor,
  and committed state `pending_review`.
- Both require committed publication version to equal expected publication
  version plus one and `expectedCurrentSubmissionId === submissionId`.
- Initial publication, renewal, repost, approval, rejection, revocation,
  payment, expiry, and publication operations are excluded.

Quota charging, exemption, employer eligibility, and destination staff review
remain outside C3. C3 records `quotaCharged` only as expected reconciliation
evidence.

## 12. Context generation

Future server adapters generate identifiers and time before calling the pure
contract. The pure module does not import Mongoose or call `Date.now()`.

Exact future functions:

```text
buildPublishingOperationSeed(input, { initiatedAt })
buildPublishingOperationContext({ operationSeed, candidate, commitEvidence })
```

`input` contains all seed fields except `schemaVersion`, `policyVersion`,
`outboxDeduplicationKeys`, and `initiatedAt`; those are derived. `initiatedAt`
must be an injected valid native server-owned `Date`. The builder stores its
canonical UTC ISO string.

`commitEvidence` has exactly:

```text
requestFingerprint
actualModerationCycleId
expectedCommittedPublicationVersion
expectedCommittedPublicationState
expectedCurrentSubmissionId
rulesDigest
quotaCharged
```

Candidate identity/base/revision fields are derived only from a successfully
validated C2 candidate. Inputs are never mutated. Outputs are defensive,
deeply frozen primitive/record values.

## 13. Context validation

Exact validators:

```text
validatePublishingOperationSeed(seed)
validatePublishingOperationContext(context, { candidate })
```

Validation requires exact own enumerable data properties, canonical primitive
values, identifier shapes, timestamp, operation-kind relationships,
candidate/context policy and identity relationships, base/version
relationships, exact outbox keys, and exact field inventory.

The full validator recomputes candidate validation/hash through the accepted C2
validator and compares every derived field. ObjectId shape validation does not
prove ownership. Employer/Job ownership, predecessor authority, rules authority
and canonical Job state remain repository responsibilities.

## 14. Context digest

No C3 operation-context digest is required or authorized.

The accepted candidate hash binds normalized candidate intent, the request
fingerprint binds stable submission intent, and exact deep comparison of two
small strict contexts detects callback drift. A new digest would duplicate
those identities without adding durable proof because the operation context is
not persisted. Consequently there is no digest field, descriptor, error code,
or known digest vector.

## 15. Idempotent replay rules

- Same logical business operation: owner type/ID, idempotency key and request
  fingerprint all match.
- New logical operation: a new key or a different owner. A new operation ID
  alone does not create a new business operation.
- Conflicting reuse: same owner/key with a different fingerprint, candidate
  hash, Job, Employer, expected version, base, predecessor, or server record
  identity. It fails closed.
- Unknown prior outcome: no execution retry begins until reconciliation
  classifies the prior transaction.

Within a callback retry, operation ID, all pre-generated IDs, outbox keys,
candidate hash, initiated time, expected/base versions, rules evidence and
commit context must be identical. Drift returns
`OPERATION_IDENTITY_CONFLICT`.

A normal later replay looks up owner/key first. A same-fingerprint record
returns the stored result without another acknowledgement, submission, event,
Job CAS, guard charge, or outbox intent. Different fingerprint returns the
existing `IDEMPOTENCY_KEY_REUSED`.

## 16. Reconciliation observation schema

The strict envelope has exactly:

```text
schemaVersion
observedAt
readAuthority
submission
canonicalJob
acknowledgement
moderationEvent
outbox
quota
```

`schemaVersion` is integer `1`; `observedAt` is a canonical UTC ISO string.

`readAuthority` has exactly:

```text
status
source
consistency
roundsCompleted
visibilityProven
failureClassification
```

Allowed status values are `COMPLETE`, `RETRYABLE_FAILURE`, and
`NON_RETRYABLE_FAILURE`. Source is `primary`; consistency is
`majority_snapshot`. Rounds are integers from 1 through 3.
`failureClassification` is null for complete reads and one of
`CONNECTION_UNAVAILABLE`, `SELECTION_UNAVAILABLE`, `READ_CONCERN_UNAVAILABLE`,
`SNAPSHOT_UNAVAILABLE`, or `UNKNOWN_READ_FAILURE` otherwise.

Each record observation has `recordStatus` equal to `ABSENT`, `FOUND`,
`DUPLICATE`, or `READ_FAILED`. `ABSENT` is therefore never confused with
failure.

When `submission.recordStatus === FOUND`, exact boolean fields are:

```text
submissionIdMatches
ownerMatches
idempotencyKeyMatches
requestFingerprintMatches
jobIdMatches
employerIdMatches
candidateHashMatches
candidateRevisionMatches
candidateKindMatches
baseBindingMatches
expectedPublicationVersionMatches
stateMatches
quotaEvidenceMatches
safeResultAvailable
```

When `canonicalJob.recordStatus === FOUND`, exact fields are:

```text
stateClassification
ownerMatches
publicationVersionMatches
currentSubmissionMatches
lastApprovedSubmissionMatches
policyVersionMatches
```

`stateClassification` is `BASE_UNCHANGED`, `COMMITTED_MATCH`, or `CONFLICT`.

Acknowledgement exact match fields are:

```text
acknowledgementIdMatches
submissionIdMatches
jobIdMatches
employerIdMatches
acceptedMatches
policyVersionMatches
rulesVersionMatches
rulesDigestMatches
```

Moderation-event exact match fields are:

```text
moderationEventIdMatches
submissionIdMatches
jobIdMatches
employerIdMatches
actionMatches
stateTransitionMatches
moderationCycleMatches
candidateHashMatches
```

Outbox has exactly:

```text
recordStatus
employerSubmissionReceived
adminJobReviewRequested
unexpectedRecordCount
```

Each typed child has `recordStatus`, `deduplicationKeyMatches`,
`submissionIdMatches`, `jobIdMatches`, `typeMatches`, `audienceMatches`, and
`employerPresenceMatches`. `unexpectedRecordCount` is an integer from 0 through
10; larger results are reduced to the bounded overflow classification.

Quota has exactly:

```text
chargedEvidenceStatus
guardEvidenceStatus
```

`chargedEvidenceStatus` is `MATCH`, `CONFLICT`, `ABSENT`, or `NOT_APPLICABLE`.
It is derived from the submission's immutable `quotaCharged`, accepted time and
quota snapshot. `guardEvidenceStatus` is always
`NOT_OPERATION_ADDRESSABLE` in this contract because the guard revision has no
operation link and must not be inferred from a concurrent revision delta.

No observation contains raw documents, identifiers, keys, hashes, content,
destination values, Mongo/driver errors, or query details.

## 17. Authoritative read set

A later adapter must perform one bounded read round using a fresh read context,
never the uncertain transaction session. Conceptually it requires primary,
majority-committed visibility and a consistent read snapshot. If the deployed
topology cannot prove those semantics, `visibilityProven` is false and absence
cannot produce `NOT_COMMITTED`.

| Read             | Lookup                                                                          | Expected count and projection                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submission       | owner type, owner ID and idempotency key; verify expected `_id` and fingerprint | 0 or 1; IDs/links, fingerprint, state, kind, policy, accepted time, candidate/base/cycle evidence, acknowledgement link, quota evidence and safe result snapshot |
| Canonical Job    | owned Job `_id`                                                                 | Exactly 1 for proof; employer, canonical state/version, current and last-approved links, policy and publication update time                                      |
| Acknowledgement  | pre-generated acknowledgement `_id`                                             | 0 or 1; submission/Job/employer links, accepted, policy, rules version/digest                                                                                    |
| Moderation event | pre-generated event `_id`                                                       | 0 or 1; submission/Job/employer links, submitted action/state transition, cycle and future candidate hash                                                        |
| Outbox           | both exact deduplication keys plus submission history                           | Exactly 0 or exactly 2; type, audience and identifier relationships; detect duplicates/extras                                                                    |

No separate quota-ledger read exists. The submission is charged-usage
authority; the guard is not operation-addressable.

Duplicates are reduced to `DUPLICATE`, not hidden. A read exception is reduced
to `READ_FAILED` plus bounded read-authority classification, never `ABSENT`.

At most three rounds may be attempted by a future runner, with a short bounded
schedule. C3 performs no rounds or reads.

## 18. Committed-match proof

`COMMITTED` requires all of the following:

- authoritative complete, visibility-proven read set;
- exact submission ID, owner/key/fingerprint, Job/Employer, candidate
  hash/kind/revision/base/version, state, quota evidence and safe result;
- exact canonical Job ownership, `pending_review`, expected incremented
  publication version, current-submission link, preserved last-approved link
  and policy;
- exact acknowledgement ID and all accepted rules relationships;
- exact submitted moderation event ID, action, state transition, cycle and
  candidate relationship;
- exactly the two required outbox intents, each with the correct deduplication
  key, submission/Job/type/audience/employer-presence relationships;
- no duplicates, conflicts, failed reads, or unexpected outbox records.

A single matching submission, Job, event, acknowledgement, or outbox record is
insufficient. Quota is mandatory when `quotaCharged` is true and
`NOT_APPLICABLE` only for a valid exempt correction.

## 19. Not-committed proof

`NOT_COMMITTED` requires:

- complete visibility-proven authoritative observations;
- submission, acknowledgement, moderation event and both outbox intents all
  absent;
- canonical Job present at the exact pre-operation owner/state/version/current
  and last-approved links;
- no duplicate, contradictory, unrelated or failed read;
- sufficient bounded rounds under a topology whose visibility semantics have
  been proved.

All-record absence from a stale, secondary, failed, inconsistent, or otherwise
unproved read is `INDETERMINATE`. An incorrect key, missing Job, or partial read
cannot prove non-commit.

## 20. Partial and contradictory state

- Submission without any required atomic companion: `CORRUPT`.
- Event, acknowledgement or outbox without submission: `CORRUPT`.
- Committed-looking Job without complete supporting evidence: `CORRUPT`.
- Same owner/key with another submission ID or fingerprint:
  `SECURITY_CONFLICT`.
- Candidate hash, Job, Employer, base or moderation-cycle identity mismatch:
  `SECURITY_CONFLICT`.
- Matching IDs but impossible state/version/link values: `CORRUPT`.
- Duplicate owner/key or expected-ID records: `SECURITY_CONFLICT` when durable
  identity conflicts; otherwise `CORRUPT`.
- Unexpected extra outbox record for the submission: `CORRUPT`.
- Any read failure or incomplete authority: `INDETERMINATE`.

These states are unsafe for automatic execution retry. No outcome authorizes
repair. Legacy-looking or unsupported topology is treated as corruption or
manual review, never silently accepted.

## 21. Reconciliation outcomes

The exact outcome enum follows the blocker audit:

```text
COMMITTED
NOT_COMMITTED
INDETERMINATE
CORRUPT
SECURITY_CONFLICT
```

| Outcome             | Confidence and terminality                                                       | Response/retry/review                                                           |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `COMMITTED`         | Authoritative full proof; terminal                                               | `RETURN_SUCCESS`, `DO_NOT_RETRY`; no repair                                     |
| `NOT_COMMITTED`     | Authoritative full absence plus exact base Job; terminal for this reconciliation | `RETURN_RETRYABLE_FAILURE`; no automatic execution; later same-key request only |
| `INDETERMINATE`     | Insufficient authoritative evidence; non-terminal                                | `RECONCILE_AGAIN_LATER`, `DO_NOT_RETRY`; manual review after bounded exhaustion |
| `CORRUPT`           | Atomic topology contradiction; terminal                                          | `RETURN_FAILURE`, `DO_NOT_RETRY`, `ESCALATE_MANUAL_REVIEW`, audit alert         |
| `SECURITY_CONFLICT` | Durable identity/evidence conflict; terminal                                     | `RETURN_FAILURE`, `DO_NOT_RETRY`, `ESCALATE_SECURITY_REVIEW`, security alert    |

## 22. Action recommendations

The exact action enum is:

```text
RETURN_SUCCESS
RETURN_FAILURE
RETURN_RETRYABLE_FAILURE
DO_NOT_RETRY
RECONCILE_AGAIN_LATER
ESCALATE_MANUAL_REVIEW
ESCALATE_SECURITY_REVIEW
```

The pure classifier returns recommendations only. It cannot execute a retry,
read, write, delete, repair, publish, approve, reject, refund, restore quota,
dispatch an outbox event, or mutate a Job.

## 23. Output privacy

The exact reconciliation result fields are:

```text
schemaVersion
outcome
actions
terminal
manualReviewRequired
securityReviewRequired
retryAllowed
mismatchCodes
missingCodes
```

`retryAllowed` means a later same-key caller may retry only for
`NOT_COMMITTED`; it never authorizes the classifier to retry.

Mismatch codes are deduplicated in this exact policy order and bounded to 16:

```text
SUBMISSION_ID_CONFLICT
IDEMPOTENCY_FINGERPRINT_CONFLICT
SUBMISSION_RELATION_CONFLICT
CANDIDATE_CONFLICT
BASE_BINDING_CONFLICT
QUOTA_EVIDENCE_CONFLICT
JOB_OWNERSHIP_CONFLICT
JOB_STATE_CONFLICT
JOB_VERSION_CONFLICT
JOB_SUBMISSION_LINK_CONFLICT
ACKNOWLEDGEMENT_CONFLICT
MODERATION_EVENT_CONFLICT
MODERATION_CYCLE_CONFLICT
OUTBOX_CONFLICT
DUPLICATE_RECORDS
UNEXPECTED_OUTBOX_RECORDS
```

Missing codes are deduplicated in this exact order and bounded to five:

```text
SUBMISSION_MISSING
JOB_MISSING
ACKNOWLEDGEMENT_MISSING
MODERATION_EVENT_MISSING
OUTBOX_INTENT_MISSING
```

No output contains candidate content, destination data, title, URL/email,
requester email, IDs, idempotency keys, hashes, documents, query errors,
stacks, connection data, or secrets.

## 24. Identifier rules

- All Mongo-backed IDs in pure values are primitive 24-hex strings.
- Builders accept uppercase or lowercase hex and normalize to lowercase.
- Validators for reconstructed canonical values require lowercase.
- BSON objects and Mongoose documents are rejected by the pure layer.
- UUID is allowed only for `operationId`, strictly lowercase UUID v4.
- Candidate/request/rules/destination hashes are lowercase 64-hex strings and
  are not interchangeable with IDs.
- Idempotency key remains trimmed printable ASCII, 16 through 128 characters,
  and is never normalized beyond trim.
- Rules version is trimmed primitive text, 1 through 100 characters.
- Outbox deduplication keys are derived, printable ASCII and at most 160.
- No opaque prefixed ID or arbitrary UUID is accepted where an ObjectId is
  required.

Shape validation never proves authority or ownership.

## 25. Timestamp rules

The only C3 timestamp is `initiatedAt`.

- Builder input: injected valid native server-owned `Date`.
- Stored pure representation: exact 24-character UTC ISO string with
  millisecond precision.
- Stable across all transaction callback retries and reconciliation rounds.
- Intended future use: submission acceptance/creation, event creation and
  initial outbox availability time where their accepted contracts permit.
- Persisted directly as operation context: no.
- Digest inclusion: none because no context digest exists.
- Reconciliation: used only to verify stable record time relationships through
  reduced adapter evidence; never returned publicly.

`observedAt` belongs to the reconciliation observation envelope and is a
canonical UTC ISO string generated by the later read adapter. It does not alter
operation identity. Local time, numeric timestamps, implicit `Date.now()`, and
un-injected clocks are forbidden.

## 26. Operation-context error contract

| Code                               | Status | Canonical message                                                 | Trigger                                                                     |
| ---------------------------------- | ------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `OPERATION_CONTEXT_INPUT_INVALID`  | 400    | `The publishing operation context is invalid.`                    | Malformed/unknown/hostile envelope, value, version, or timestamp            |
| `OPERATION_IDENTIFIER_SET_INVALID` | 400    | `The publishing operation identifiers are invalid.`               | Invalid, duplicate, inconsistent or incorrectly derived identity set        |
| `OPERATION_CANDIDATE_MISMATCH`     | 409    | `The publishing candidate does not match the operation context.`  | Candidate policy/kind/hash/revision/base/version mismatch                   |
| `OPERATION_IDENTITY_CONFLICT`      | 409    | `The publishing operation identity conflicts with prior context.` | Callback retry or same operation identity produces different stable context |
| `OPERATION_KIND_UNSUPPORTED`       | 400    | `The publishing operation kind is unsupported.`                   | Kind outside the exact two-value enum                                       |

There is no digest-conflict code because no C3 digest exists.

## 27. Reconciliation error contract

| Code                               | Status | Canonical message                                                  | Trigger                                                            |
| ---------------------------------- | ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `RECONCILIATION_INPUT_INVALID`     | 400    | `The publishing reconciliation input is invalid.`                  | Invalid context/observation envelope or unsupported schema version |
| `RECONCILIATION_COMPARISON_FAILED` | 500    | `The publishing reconciliation comparison could not be completed.` | Unexpected internal pure comparison failure only                   |

Insufficient trusted reads are ordinary `INDETERMINATE`. Valid partial or
contradictory topology is an ordinary `CORRUPT` or `SECURITY_CONFLICT` outcome,
not an exception.

All contract errors serialize exactly a new frozen:

```text
{ status, code, message }
```

Caller messages/details are ignored. Serialization contains no identifiers,
hashes, keys, observations, documents, raw errors, stacks, or driver data.

## 28. Strict envelope rules

Every public function accepts only direct ordinary null- or
`Object.prototype`-prototype records with own enumerable data properties.
Unknown fields fail closed.

Missing values, primitives, arrays, Date envelopes, RegExp, Map, Set, class
instances, proxies, unusual prototypes, accessors, inherited or hidden
properties, symbols, circular structures, prototype-pollution keys, dotted
keys and `$`-prefixed keys are rejected.

Request/response/session objects, database documents, transaction sessions,
driver errors, headers, cookies, tokens, credentials, raw candidate content,
raw destination data, payments, applicants and arbitrary metadata are
forbidden.

## 29. Immutability and compatibility

Seeds, contexts, outbox key objects, observations, observation children,
results, action/category arrays, errors and every exported policy collection
must be defensively copied and deeply frozen.

No input object is mutated or frozen. No output aliases a mutable input. All
successful pure values are JSON serializable and `structuredClone` compatible.
They contain no Date, Proxy, Map, Set, class, BSON, database-document or driver
instance.

## 30. Module separation and dependencies

C3 requires two modules:

```text
PublishingOperationContextContract.js
PublishingReconciliationContract.js
```

Allowed direction:

```text
PublishingReconciliationContract
  -> PublishingOperationContextContract
PublishingOperationContextContract
  -> PublicationCandidateContract
PublicationCandidateContract
  -> ApplicationDestinationContract
```

No reverse import is allowed. Reconciliation may use the operation-context
validator and exported policy constants. Neither module may import models,
Mongoose, database configuration, transaction services, repositories,
controllers, routes, workers, schedulers, queues, Redis, frontend or
environment configuration.

## 31. Exact future APIs

Operation module exports:

```text
buildPublishingOperationSeed(input, { initiatedAt })
buildPublishingOperationContext({ operationSeed, candidate, commitEvidence })
validatePublishingOperationSeed(seed)
validatePublishingOperationContext(context, { candidate })
comparePublishingOperationIdentity(leftContext, rightContext)
```

Builders and validators return canonical deeply frozen values.
`comparePublishingOperationIdentity` returns exactly:

```text
{ classification, mismatchCodes }
```

Classification is exactly `SAME_LOGICAL_OPERATION`,
`DIFFERENT_LOGICAL_OPERATION`, or `IDENTITY_CONFLICT`. The complete ordered
mismatch-code inventory and exclusive-identity rules are defined by the C3-A1
consistency correction in section 41. That correction supersedes the original
incomplete two-way comparison statement.

Reconciliation module exports:

```text
evaluatePublishingReconciliation({ operationContext, observations })
```

It validates both values and returns only the result defined in section 23.
All lower-level canonicalization, byte/value comparison and classification
helpers remain private.

## 32. Exact exports

The operation module must export deeply immutable:

```text
PUBLISHING_OPERATION_CONTEXT_SCHEMA_VERSION
PUBLISHING_OPERATION_POLICY_VERSION
PUBLISHING_OPERATION_KINDS
PUBLISHING_OPERATION_SEED_FIELDS
PUBLISHING_OPERATION_CONTEXT_FIELDS
PUBLISHING_OPERATION_IDENTIFIER_POLICIES
PUBLISHING_OPERATION_BOUNDS
PUBLISHING_OPERATION_ERROR_CODES
PUBLISHING_OPERATION_ERROR_MESSAGES
PublishingOperationContextContractError
```

plus the five APIs in section 31.

The reconciliation module must export deeply immutable:

```text
PUBLISHING_RECONCILIATION_SCHEMA_VERSION
PUBLISHING_RECONCILIATION_OUTCOMES
PUBLISHING_RECONCILIATION_ACTIONS
PUBLISHING_RECONCILIATION_MISMATCH_CODES
PUBLISHING_RECONCILIATION_MISSING_CODES
PUBLISHING_RECONCILIATION_BOUNDS
PUBLISHING_RECONCILIATION_ERROR_CODES
PUBLISHING_RECONCILIATION_ERROR_MESSAGES
PublishingReconciliationContractError
evaluatePublishingReconciliation
```

No mutable Set, Map or internal helper is exported.

## 33. Known vectors

No operation-context or reconciliation digest is defined, so no C3 digest
vector exists. Future tests must instead reuse the accepted C2 candidate known
vector:

```text
a77f2fc1f88154efb909988d1651b312a259b315c571bec725d46a461b8979e6
```

to prove candidate/context binding, and must independently assert the two exact
outbox deduplication keys derived from a synthetic submission ID.

## 34. Required tests

### Operation context

- Exact export, seed-field and context-field inventories.
- Exact two operation kinds and kind/candidate/source-state relationships.
- UUID/ObjectId/hash/key/version/timestamp policies and normalization.
- Pre-generated acknowledgement, submission, moderation and cycle identities.
- Exact two derived outbox keys and no outbox ID invention.
- Major-edit and correction base/revision/publication-version relationships.
- Candidate known-vector binding and mismatch.
- Stable IDs/time/context across callback attempt numbers.
- Conflicting identity reuse and exact mismatch codes.
- Strict hostile envelopes and forbidden private/runtime objects.
- Deep export/output immutability and input/output alias isolation.
- JSON and `structuredClone` compatibility.
- Exact safe errors and serialization.
- Static purity/import isolation and no database/network/timer behavior.

### Reconciliation

- Exact exports, observation inventory, outcomes, actions and output inventory.
- Complete committed-match matrices.
- Complete authoritative not-committed matrices.
- Failure versus absence, stale/unproved visibility and bounded read failure.
- Every single missing companion and pairwise/combined partial topology.
- Identity, fingerprint, candidate, base, owner, Job, cycle and version
  conflicts.
- Duplicate records and unexpected outbox intents.
- Quota charged/exempt evidence and non-addressable guard behavior.
- `INDETERMINATE`, `CORRUPT` and `SECURITY_CONFLICT` action boundaries.
- No automatic retry/repair/write action.
- Bounded deterministic category ordering.
- Output privacy, deep immutability, JSON/clone compatibility and safe errors.
- Static purity/import isolation and no database/network behavior.

Happy paths alone are insufficient. Pairwise and combined contradiction
matrices are mandatory.

## 35. Future implementation allowlist

### CREATE

```text
server/src/services/publishing/contracts/PublishingOperationContextContract.js
server/src/services/publishing/contracts/PublishingReconciliationContract.js
server/src/__tests__/publishingOperationContextContract.test.js
server/src/__tests__/publishingReconciliationContract.test.js
docs/FREE_BETA_PUBLISHING_OPERATION_CONTEXT_RECONCILIATION_FOUNDATION_REPORT.md
```

### MODIFY

```text
None.
```

### INSPECT_ONLY

```text
server/src/config/freeBetaPublishingPolicy.js
server/src/services/publishing/contracts/ApplicationDestinationContract.js
server/src/services/publishing/contracts/PublicationCandidateContract.js
server/src/services/publishing/outbox/PublishingOutboxContracts.js
server/src/models/Job.js
server/src/models/JobPublicationSubmission.js
server/src/models/JobModerationEvent.js
server/src/models/EmployerPostingRulesAcknowledgement.js
server/src/models/PublishingOutboxIntent.js
server/src/services/publishing/TransactionalFreeBetaSubmissionService.js
server/src/services/publishing/ReviewerCorrectionEligibility.js
server/src/services/publishing/SerializedQuotaGuard.js
server/src/__tests__/applicationDestinationContract.test.js
server/src/__tests__/publicationCandidateContract.test.js
```

### FORBIDDEN

```text
server/src/models/**
server/src/controllers/**
server/src/routes/**
server/src/middleware/**
server/src/index.js
server/src/worker.js
server/src/scheduler/**
server/src/services/publishing/TransactionalFreeBetaSubmissionService.js
server/src/services/publishing/outbox/**
server/src/services/jobWriteBoundary.js
client/**
package.json
server/package.json
server/package-lock.json
render.yaml
```

The inspect-only entries take precedence over matching forbidden globs only for
read access; they remain forbidden to modify.

## 36. Isolation-test implications

No existing isolation test requires modification for pure C3:

- the operation module may import only `PublicationCandidateContract.js`;
- it does not directly reference C1 destination symbols;
- reconciliation imports only the operation module;
- the existing C1 exact reference allowlist therefore remains unchanged;
- the existing C2 source-isolation assertions remain valid.

The two new C3 tests must independently enforce exact reference/import
allowlists. If implementation unexpectedly requires an existing isolation-test
change, C3 must stop rather than broaden scope.

## 37. Readiness matrix

| Gate                              | Verdict                                   |
| --------------------------------- | ----------------------------------------- |
| `OPERATION_CONTEXT_PURPOSE`       | Resolved                                  |
| `OPERATION_IDENTITY`              | Resolved                                  |
| `PREGENERATED_RECORD_IDS`         | Resolved                                  |
| `CONTEXT_SCHEMA_VERSION`          | Resolved: integer 1                       |
| `OPERATION_KINDS`                 | Resolved: two                             |
| `CONTEXT_FIELD_INVENTORY`         | Resolved: 19-field seed, 32-field context |
| `CONTEXT_VALIDATION`              | Resolved                                  |
| `IDEMPOTENT_REPLAY`               | Resolved                                  |
| `CONTEXT_DIGEST`                  | Resolved: deliberately absent             |
| `UNKNOWN_COMMIT_DEFINITION`       | Resolved                                  |
| `RECONCILIATION_OBSERVATIONS`     | Resolved                                  |
| `AUTHORITATIVE_READ_SET`          | Resolved conceptually; no reads executed  |
| `COMMITTED_MATCH_PROOF`           | Resolved                                  |
| `NOT_COMMITTED_PROOF`             | Resolved                                  |
| `PARTIAL_STATE_HANDLING`          | Resolved fail closed                      |
| `CONFLICTING_OPERATION_HANDLING`  | Resolved fail closed                      |
| `RECONCILIATION_OUTCOMES`         | Resolved: five                            |
| `ACTION_BOUNDARY`                 | Resolved; recommendations only            |
| `ERROR_CONTRACTS`                 | Resolved                                  |
| `PRIVACY`                         | Resolved                                  |
| `PURE C3 IMPLEMENTATION`          | Ready                                     |
| `MODEL INTEGRATION`               | Not ready/not authorized                  |
| `TRANSACTION SERVICE INTEGRATION` | Not ready/not authorized                  |
| `DATABASE RECONCILIATION ADAPTER` | Not ready/not authorized                  |
| `MONGOOSE SUBMISSION ADAPTER`     | Not ready                                 |
| `RUNTIME WIRING`                  | Not ready                                 |
| `PRODUCTION TOPOLOGY PROOF`       | Not ready                                 |

## 38. Remaining adapter/runtime blockers

- C3 pure modules and tests are not implemented yet.
- Candidate/destination evidence is not in submission/moderation schemas.
- The transaction service does not accept C2 candidates or pre-generated seed
  identities and cannot return commit context.
- No publishing-specific runner or reconciliation repository exists.
- Canonical Job CAS has no Mongoose adapter.
- Production replica-set, primary/snapshot/majority behavior is unproved.
- Live unique-index inventory and rollout are unperformed.
- Existing Jobs are not canonically classified or migrated.
- Approval, active capacity, public visibility, expiry and outbox delivery
  remain separately unimplemented.

## 39. Next safe phase

The next safe phase is a narrowly authorized dormant pure implementation:

```text
E.1F-H2B-B3-C3-B — Dormant Publishing Operation Context and Reconciliation Pure Contract Foundation
```

It may create only the five files in section 35. It must remain database-free
and runtime-isolated.

## 40. Preservation statement

- Exactly one documentation file created: Yes.
- Existing tracked application files changed: No.
- Existing tests changed: No.
- Existing models or schemas changed: No.
- H2A/H2B-A changed: No.
- Canonical Job schema changed: No.
- Transaction service changed: No.
- Application Destination Contract changed: No.
- Publication Candidate Contract changed: No.
- Outbox foundation changed: No.
- Controllers/routes changed: No.
- Workers/schedulers/startup changed: No.
- Public queries/renderers changed: No.
- Frontend changed: No.
- Configuration/dependencies changed: No.
- Database reconciliation reads executed: No.
- Database/network operation performed: No.
- Production data accessed: No.
- Migration/index operation performed: No.
- Files staged: No.
- Commit performed: No.
- Push performed: No.
- Deployment performed: No.
- Mongoose adapter started: No.
- Runtime wiring started: No.
- Production acceptance report touched: No.

STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED

## 41. C3-A1 Authoritative Contract Consistency Correction

### 41.1 Status, scope, and supersession

C3-B correctly stopped before implementation because the original C3-A
contract would have required invention in six areas:

1. operation identity had only two classifications while three behaviors were
   required;
2. operation-identity mismatch codes were not enumerated;
3. simultaneous security, corruption, duplicate, and read-failure evidence had
   no fixed precedence;
4. non-`FOUND` observation shapes were not exact;
5. counts above ten had no bounded representation;
6. exported policy inventories and numeric bounds were incomplete.

This section corrects only those defects. It is authoritative and supersedes
earlier sections 16, 20 through 23, 31 through 34, and 37 only where their
identity classification, observation shape, result shape, precedence, export
inventory, bound, or mandatory-test wording differs from this section. Every
other C3-A decision remains unchanged, including the 19-field seed, 32-field
context, operation kinds, identity generation boundary, lack of context digest,
five reconciliation outcomes, error codes, privacy rules, file scope, and
dormancy.

### 41.2 Exact three-way operation-identity comparison

The comparison output has exactly these fields in this order:

```text
classification
mismatchCodes
```

The classification enum has exactly:

```text
SAME_LOGICAL_OPERATION
DIFFERENT_LOGICAL_OPERATION
IDENTITY_CONFLICT
```

`SAME_LOGICAL_OPERATION` is returned only when `operationId` and every stable
field in the complete 32-field context are identical. `mismatchCodes` is then
an empty frozen array.

`IDENTITY_CONFLICT` is returned when either:

1. `operationId` is identical and any mismatch code exists; or
2. `operationId` differs and at least one exclusive identity is reused.

The exact exclusive identities are:

```text
submissionId
acknowledgementId
moderationEventId
newModerationCycleId
expectedCurrentSubmissionId
outboxDeduplicationKeys.employerSubmissionReceived
outboxDeduplicationKeys.adminJobReviewRequested
ownerType + ownerId + idempotencyKey
```

The idempotency identity is exclusive only as the complete three-field
composite. An idempotency-key string used by a different owner is not by itself
exclusive.

`DIFFERENT_LOGICAL_OPERATION` is returned only when operation IDs differ and no
exclusive identity is reused. Shared Job, Employer, quota owner, candidate
hash, approved base, correction predecessor, moderation cycle, rules version,
or policy version does not alone prove conflict because a later independent
operation may legitimately share those values.

The comparison evaluates every stable context field and returns all applicable
mismatch codes in canonical policy order. It returns no values.

### 41.3 Exact operation-identity mismatch codes

The complete immutable ordered enum has exactly 33 codes:

```text
SCHEMA_VERSION_MISMATCH
POLICY_VERSION_MISMATCH
OPERATION_ID_MISMATCH
OPERATION_KIND_MISMATCH
OWNER_TYPE_MISMATCH
OWNER_ID_MISMATCH
EMPLOYER_ID_MISMATCH
JOB_ID_MISMATCH
IDEMPOTENCY_KEY_MISMATCH
SUBMISSION_ID_MISMATCH
ACKNOWLEDGEMENT_ID_MISMATCH
MODERATION_EVENT_ID_MISMATCH
NEW_MODERATION_CYCLE_ID_MISMATCH
EXPECTED_PUBLICATION_VERSION_MISMATCH
EXPECTED_PUBLICATION_STATE_MISMATCH
CORRECTION_OF_SUBMISSION_ID_MISMATCH
RULES_VERSION_MISMATCH
EMPLOYER_SUBMISSION_RECEIVED_OUTBOX_KEY_MISMATCH
ADMIN_JOB_REVIEW_REQUESTED_OUTBOX_KEY_MISMATCH
INITIATED_AT_MISMATCH
REQUEST_FINGERPRINT_MISMATCH
CANDIDATE_HASH_MISMATCH
CANDIDATE_REVISION_MISMATCH
CANDIDATE_KIND_MISMATCH
BASE_APPROVED_SUBMISSION_ID_MISMATCH
BASE_APPROVED_CANDIDATE_HASH_MISMATCH
BASE_PUBLICATION_VERSION_MISMATCH
ACTUAL_MODERATION_CYCLE_ID_MISMATCH
EXPECTED_COMMITTED_PUBLICATION_VERSION_MISMATCH
EXPECTED_COMMITTED_PUBLICATION_STATE_MISMATCH
EXPECTED_CURRENT_SUBMISSION_ID_MISMATCH
RULES_DIGEST_MISMATCH
QUOTA_CHARGED_MISMATCH
```

The order maps one-for-one to the 32 context fields, except that the
`outboxDeduplicationKeys` field deliberately produces one code for each of its
two fixed typed keys. No generic or caller-provided code is allowed.

All 33 fields are stable for same-operation comparison. Only the exclusive
identities listed in section 41.2 can turn differing operation IDs into
`IDENTITY_CONFLICT`. Non-exclusive mismatches distinguish independent
operations but do not by themselves establish identity substitution.

`mismatchCodes` is newly allocated, deduplicated by construction, deeply
frozen, and bounded to 33. It contains no raw field values.

### 41.4 Exact tagged-union convention

Every reduced record observation uses the discriminator field `state` and
exactly one of:

```text
FOUND
ABSENT
DUPLICATE
DUPLICATE_OVERFLOW
READ_FAILED
```

The common non-`FOUND` variants are exact:

```text
{ state: "ABSENT" }
{ state: "READ_FAILED" }
{ state: "DUPLICATE", count: <integer 2 through 10> }
{ state: "DUPLICATE_OVERFLOW" }
```

`DUPLICATE_OVERFLOW` means 11 or more observations. It never stores a count.
`ABSENT` and `READ_FAILED` contain no other field. `DUPLICATE` contains only
`state` and `count`.

Variant fields never mix:

- `ABSENT` cannot contain match flags;
- `READ_FAILED` cannot contain an error, code, message, stack, cause, or retry
  flag;
- `DUPLICATE` cannot contain records or match flags;
- `DUPLICATE_OVERFLOW` cannot contain a count;
- `FOUND` cannot contain a duplicate count;
- unknown states and unknown fields fail closed.

All variants reject accessors, symbols, inherited or hidden fields, unusual
prototypes, raw records, database documents, sessions, and driver objects.

### 41.5 Exact `FOUND` variants

The submission `FOUND` shape has exactly these 15 fields:

```text
state
submissionIdMatches
ownerMatches
idempotencyKeyMatches
requestFingerprintMatches
jobIdMatches
employerIdMatches
candidateHashMatches
candidateRevisionMatches
candidateKindMatches
baseBindingMatches
expectedPublicationVersionMatches
stateMatches
quotaEvidenceMatches
safeResultAvailable
```

Every field after `state` is a required primitive boolean.

The canonical Job `FOUND` shape has exactly:

```text
state
stateClassification
ownerMatches
publicationVersionMatches
currentSubmissionMatches
lastApprovedSubmissionMatches
policyVersionMatches
```

`stateClassification` is exactly `BASE_UNCHANGED`, `COMMITTED_MATCH`, or
`CONFLICT`; the remaining fields are required booleans.

The acknowledgement `FOUND` shape has exactly:

```text
state
acknowledgementIdMatches
submissionIdMatches
jobIdMatches
employerIdMatches
acceptedMatches
policyVersionMatches
rulesVersionMatches
rulesDigestMatches
```

The moderation-event `FOUND` shape has exactly:

```text
state
moderationEventIdMatches
submissionIdMatches
jobIdMatches
employerIdMatches
actionMatches
stateTransitionMatches
moderationCycleMatches
candidateHashMatches
```

Each typed outbox-intent `FOUND` shape has exactly:

```text
state
deduplicationKeyMatches
submissionIdMatches
jobIdMatches
typeMatches
audienceMatches
employerPresenceMatches
```

The unexpected-outbox-record observation uses the common variants, except its
`FOUND` shape is exactly:

```text
{ state: "FOUND" }
```

That shape means exactly one unexpected record. `DUPLICATE` represents 2
through 10 unexpected records and `DUPLICATE_OVERFLOW` represents 11 or more.

The quota-evidence `FOUND` shape has exactly:

```text
state
chargedEvidenceStatus
guardEvidenceStatus
```

`chargedEvidenceStatus` is exactly `MATCH`, `CONFLICT`, or `NOT_APPLICABLE`.
Absence uses the common `ABSENT` variant rather than an `ABSENT` status inside a
`FOUND` value. `guardEvidenceStatus` is exactly
`NOT_OPERATION_ADDRESSABLE`.

### 41.6 Exact top-level reconciliation envelope

The envelope has exactly nine required fields in this order:

```text
schemaVersion
observedAt
readAuthority
submission
canonicalJob
acknowledgement
moderationEvent
outbox
quota
```

- `schemaVersion`: integer `1`.
- `observedAt`: canonical 24-character primitive UTC ISO string.
- `readAuthority`: the exact six-field record below.
- `submission`, `canonicalJob`, `acknowledgement`, `moderationEvent`, and
  `quota`: one exact tagged-union variant.
- `outbox`: the exact three-field record below.

`readAuthority` has exactly:

```text
status
source
consistency
roundsCompleted
visibilityProven
failureClassification
```

Its enums and relationships are:

- `status`: `COMPLETE`, `RETRYABLE_FAILURE`, or `NON_RETRYABLE_FAILURE`;
- `source`: exactly `primary`;
- `consistency`: exactly `majority_snapshot`;
- `roundsCompleted`: integer 1 through 3;
- `visibilityProven`: primitive boolean;
- `failureClassification`: null only when status is `COMPLETE`; otherwise one
  of `CONNECTION_UNAVAILABLE`, `SELECTION_UNAVAILABLE`,
  `READ_CONCERN_UNAVAILABLE`, `SNAPSHOT_UNAVAILABLE`, or
  `UNKNOWN_READ_FAILURE`.

`COMPLETE` requires `visibilityProven === true`. A failure status requires
`visibilityProven === false`.

`COMPLETE` also requires that no component is `READ_FAILED`. A failure status
requires at least one required component to be `READ_FAILED`. Successful
`FOUND`, `ABSENT`, `DUPLICATE`, and `DUPLICATE_OVERFLOW` reductions remain
authoritative for their individual primary/majority reads even when another
component failed. `visibilityProven` describes completeness of the whole
cross-record proof, not whether an independently successful positive or
negative component observation must be discarded. This permits already-proved
security or corruption evidence to take precedence over an unrelated failed
component while still forbidding `COMMITTED` or `NOT_COMMITTED` from an
incomplete set.

`outbox` has exactly:

```text
employerSubmissionReceived
adminJobReviewRequested
unexpectedRecords
```

Each field is a required exact tagged-union observation. The first two use the
typed outbox `FOUND` shape. `unexpectedRecords` uses its specialized `FOUND`
shape.

Every record component permits all five observation states so malformed or
impossible adapter reductions can be classified deterministically. No field is
optional and no arbitrary nested object is accepted.

### 41.7 Exact duplicate and overflow outcomes

`DUPLICATE` and `DUPLICATE_OVERFLOW` have identical outcome treatment for the
same component:

| Component                           | Outcome             | Reason                                                                                                     |
| ----------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `submission`                        | `SECURITY_CONFLICT` | Unique owner/idempotency and pre-generated submission identity conflict                                    |
| `acknowledgement`                   | `SECURITY_CONFLICT` | Pre-generated ID and one-per-submission identity conflict                                                  |
| `moderationEvent`                   | `SECURITY_CONFLICT` | Pre-generated event identity conflict                                                                      |
| `outbox.employerSubmissionReceived` | `SECURITY_CONFLICT` | Unique exclusive deduplication-key conflict                                                                |
| `outbox.adminJobReviewRequested`    | `SECURITY_CONFLICT` | Unique exclusive deduplication-key conflict                                                                |
| `canonicalJob`                      | `CORRUPT`           | A unique Job lookup returned impossible duplicate topology without a proved substituted operation identity |
| `quota`                             | `CORRUPT`           | Reduced quota evidence is duplicated but is not a separate exclusive record identity                       |
| `outbox.unexpectedRecords`          | `CORRUPT`           | Extra transaction-linked outbox topology                                                                   |

Any `FOUND`, `DUPLICATE`, or `DUPLICATE_OVERFLOW` value for
`outbox.unexpectedRecords` is corruption. Duplicate or overflow evidence can
never produce `COMMITTED` or `NOT_COMMITTED`.

### 41.8 Exact reconciliation outcome precedence

The classifier evaluates in this fixed order:

```text
1. SECURITY_CONFLICT
2. CORRUPT
3. INDETERMINATE
4. COMMITTED
5. NOT_COMMITTED
6. INDETERMINATE fallback
```

1. `SECURITY_CONFLICT` wins when already-present authoritative evidence proves
   identity substitution, conflicting operation reuse, owner/Job mismatch,
   exclusive-ID reuse, or a component duplicate classified as security. It
   takes precedence over corruption, duplicate evidence, and unrelated
   `READ_FAILED` values. Missing evidence caused by a read failure cannot be
   invented into a security conflict.
2. `CORRUPT` wins when authoritative evidence already proves impossible or
   partial atomic topology. It takes precedence over unrelated read failures.
   Examples include a found submission with an authoritatively absent required
   companion, one required outbox intent found while the other is absent, an
   advanced Job with absent atomic records, component duplicates classified as
   corruption, or any unexpected outbox record.
3. `INDETERMINATE` is returned when no higher-priority outcome is proved and at
   least one required observation is `READ_FAILED`, read authority is not
   complete and visibility-proven, or the trusted set is incomplete.
4. `COMMITTED` is returned only when the original complete-match proof is
   satisfied by `FOUND` variants, all match flags are true, quota evidence is
   valid for the context, outbox unexpected records are `ABSENT`, and authority
   is complete and visibility-proven.
5. `NOT_COMMITTED` is returned only when submission, acknowledgement,
   moderation event, quota and both required outbox intents are `ABSENT`,
   unexpected outbox records are `ABSENT`, canonical Job is `FOUND` with
   `BASE_UNCHANGED` and every relationship flag true, authority is complete and
   visibility-proven, and no duplicate/overflow/read failure exists.
6. Every other valid combination returns `INDETERMINATE`.

Precedence is independent of object key or iteration order.

### 41.9 Exact outcome/result/action policy

The reconciliation result now has exactly 11 fields in this order:

```text
schemaVersion
outcome
actions
terminal
success
retryAllowed
reconcileLater
manualReviewRequired
securityReviewRequired
mismatchCodes
missingCodes
```

`success` is `true`, `false`, or null. The exact immutable policy is:

| Outcome             | Actions in order                                                                       | Terminal | Success | Retry allowed | Reconcile later | Manual review | Security review |
| ------------------- | -------------------------------------------------------------------------------------- | -------- | ------- | ------------- | --------------- | ------------- | --------------- |
| `COMMITTED`         | `RETURN_SUCCESS`, `DO_NOT_RETRY`                                                       | true     | true    | false         | false           | false         | false           |
| `NOT_COMMITTED`     | `RETURN_RETRYABLE_FAILURE`, `DO_NOT_RETRY`                                             | true     | false   | true          | false           | false         | false           |
| `INDETERMINATE`     | `RECONCILE_AGAIN_LATER`, `DO_NOT_RETRY`                                                | false    | null    | false         | true            | false         | false           |
| `CORRUPT`           | `RETURN_FAILURE`, `DO_NOT_RETRY`, `ESCALATE_MANUAL_REVIEW`                             | true     | false   | false         | false           | true          | false           |
| `SECURITY_CONFLICT` | `RETURN_FAILURE`, `DO_NOT_RETRY`, `ESCALATE_MANUAL_REVIEW`, `ESCALATE_SECURITY_REVIEW` | true     | false   | false         | false           | true          | true            |

`retryAllowed` for `NOT_COMMITTED` means only that an outer service may later
authorize a new same-key write attempt. The classifier never retries or
authorizes an automatic write retry after unknown commit.

### 41.10 Exact public export inventories

`PublishingOperationContextContract.js` must export exactly these constants,
class, and functions in this order:

```text
PUBLISHING_OPERATION_CONTEXT_SCHEMA_VERSION
PUBLISHING_OPERATION_POLICY_VERSION
PUBLISHING_OPERATION_KINDS
PUBLISHING_OPERATION_IDENTITY_CLASSIFICATIONS
PUBLISHING_OPERATION_IDENTITY_MISMATCH_CODES
PUBLISHING_OPERATION_SEED_FIELDS
PUBLISHING_OPERATION_CONTEXT_FIELDS
PUBLISHING_OPERATION_IDENTIFIER_POLICIES
PUBLISHING_OPERATION_OUTBOX_KEY_POLICY
PUBLISHING_OPERATION_BOUNDS
PUBLISHING_OPERATION_ERROR_CODES
PUBLISHING_OPERATION_ERROR_MESSAGES
PublishingOperationContextContractError
buildPublishingOperationSeed
buildPublishingOperationContext
validatePublishingOperationSeed
validatePublishingOperationContext
comparePublishingOperationIdentity
```

Runtime types:

- schema version is a number;
- policy version is a string;
- enums and field inventories are frozen ordered arrays;
- identifier, outbox, bounds, and message policies are deeply frozen ordinary
  objects;
- error codes are a frozen ordered array;
- the error class and five functions are functions.

`PublishingReconciliationContract.js` must export exactly:

```text
PUBLISHING_RECONCILIATION_SCHEMA_VERSION
PUBLISHING_RECONCILIATION_OBSERVATION_FIELDS
PUBLISHING_RECONCILIATION_READ_AUTHORITY_FIELDS
PUBLISHING_RECONCILIATION_SUBMISSION_FOUND_FIELDS
PUBLISHING_RECONCILIATION_JOB_FOUND_FIELDS
PUBLISHING_RECONCILIATION_ACKNOWLEDGEMENT_FOUND_FIELDS
PUBLISHING_RECONCILIATION_MODERATION_FOUND_FIELDS
PUBLISHING_RECONCILIATION_OUTBOX_FOUND_FIELDS
PUBLISHING_RECONCILIATION_QUOTA_FOUND_FIELDS
PUBLISHING_RECONCILIATION_RESULT_FIELDS
PUBLISHING_RECONCILIATION_OBSERVATION_STATES
PUBLISHING_RECONCILIATION_READ_AUTHORITY_STATUSES
PUBLISHING_RECONCILIATION_READ_FAILURE_CLASSIFICATIONS
PUBLISHING_RECONCILIATION_JOB_STATE_CLASSIFICATIONS
PUBLISHING_RECONCILIATION_QUOTA_CHARGED_STATUSES
PUBLISHING_RECONCILIATION_OUTCOMES
PUBLISHING_RECONCILIATION_ACTIONS
PUBLISHING_RECONCILIATION_MISMATCH_CODES
PUBLISHING_RECONCILIATION_MISSING_CODES
PUBLISHING_RECONCILIATION_DUPLICATE_OUTCOMES
PUBLISHING_RECONCILIATION_OUTCOME_ACTION_POLICY
PUBLISHING_RECONCILIATION_BOUNDS
PUBLISHING_RECONCILIATION_ERROR_CODES
PUBLISHING_RECONCILIATION_ERROR_MESSAGES
PublishingReconciliationContractError
evaluatePublishingReconciliation
```

All inventory/enums are frozen ordered arrays. Duplicate and outcome policies,
bounds, and messages are deeply frozen ordinary objects. Error codes are a
frozen ordered array. The error class and evaluator are functions.

No other export is allowed.

### 41.11 Complete literal policy values

Operation constants:

```text
PUBLISHING_OPERATION_CONTEXT_SCHEMA_VERSION = 1
PUBLISHING_OPERATION_POLICY_VERSION = "free-beta-2026-01"
PUBLISHING_OPERATION_KINDS =
  ["major_edit_submission", "correction_submission"]
PUBLISHING_OPERATION_IDENTITY_CLASSIFICATIONS =
  ["SAME_LOGICAL_OPERATION", "DIFFERENT_LOGICAL_OPERATION", "IDENTITY_CONFLICT"]
```

`PUBLISHING_OPERATION_SEED_FIELDS`,
`PUBLISHING_OPERATION_CONTEXT_FIELDS`,
`PUBLISHING_OPERATION_IDENTITY_MISMATCH_CODES`, operation error codes, and
messages are exactly the ordered inventories already defined by C3-A and this
correction.

`PUBLISHING_OPERATION_IDENTIFIER_POLICIES` has exactly:

```text
operationId:
  type = "uuid_v4"
  length = 36
  canonicalCase = "lowercase"
objectId:
  type = "mongo_object_id"
  length = 24
  canonicalCase = "lowercase"
hash:
  type = "sha256_hex"
  length = 64
  canonicalCase = "lowercase"
idempotencyKey:
  type = "printable_ascii"
  minimumLength = 16
  maximumLength = 128
rulesVersion:
  type = "trimmed_string"
  minimumLength = 1
  maximumLength = 100
```

`PUBLISHING_OPERATION_OUTBOX_KEY_POLICY` has exactly:

```text
separator = ":"
maximumLength = 160
employerSubmissionReceivedType = "employer_submission_received"
adminJobReviewRequestedType = "admin_job_review_requested"
```

Each key is exactly `<submissionId>:<type>`; there is no additional prefix,
version, salt, secret, case transformation, or framing.

Reconciliation constants:

```text
PUBLISHING_RECONCILIATION_SCHEMA_VERSION = 1
PUBLISHING_RECONCILIATION_OBSERVATION_STATES =
  ["FOUND", "ABSENT", "DUPLICATE", "DUPLICATE_OVERFLOW", "READ_FAILED"]
PUBLISHING_RECONCILIATION_READ_AUTHORITY_STATUSES =
  ["COMPLETE", "RETRYABLE_FAILURE", "NON_RETRYABLE_FAILURE"]
PUBLISHING_RECONCILIATION_READ_FAILURE_CLASSIFICATIONS =
  ["CONNECTION_UNAVAILABLE", "SELECTION_UNAVAILABLE",
   "READ_CONCERN_UNAVAILABLE", "SNAPSHOT_UNAVAILABLE",
   "UNKNOWN_READ_FAILURE"]
PUBLISHING_RECONCILIATION_JOB_STATE_CLASSIFICATIONS =
  ["BASE_UNCHANGED", "COMMITTED_MATCH", "CONFLICT"]
PUBLISHING_RECONCILIATION_QUOTA_CHARGED_STATUSES =
  ["MATCH", "CONFLICT", "NOT_APPLICABLE"]
```

The reconciliation outcomes, actions, mismatch codes, missing codes, error
codes, and messages are exactly the ordered inventories already defined in
sections 21 through 27. `PUBLISHING_RECONCILIATION_DUPLICATE_OUTCOMES` is the
exact component-to-outcome mapping in section 41.7.
`PUBLISHING_RECONCILIATION_OUTCOME_ACTION_POLICY` is the exact matrix in
section 41.9.

### 41.12 Exact numeric bounds

`PUBLISHING_OPERATION_BOUNDS` has exactly:

```text
operationIdLength = 36
objectIdLength = 24
hashLength = 64
idempotencyKeyMinimumLength = 16
idempotencyKeyMaximumLength = 128
rulesVersionMinimumLength = 1
rulesVersionMaximumLength = 100
outboxKeyMaximumLength = 160
operationSeedFieldCount = 19
operationContextFieldCount = 32
identityMismatchCodeMaximum = 33
```

`PUBLISHING_RECONCILIATION_BOUNDS` has exactly:

```text
observationFieldCount = 9
readAuthorityFieldCount = 6
submissionFoundFieldCount = 15
jobFoundFieldCount = 7
acknowledgementFoundFieldCount = 9
moderationFoundFieldCount = 9
outboxGroupFieldCount = 3
outboxFoundFieldCount = 7
quotaFoundFieldCount = 3
resultFieldCount = 11
duplicateCountMinimum = 2
duplicateCountMaximum = 10
duplicateOverflowThreshold = 11
mismatchCodeMaximum = 16
missingCodeMaximum = 5
contradictionCodeMaximum = 0
actionMaximum = 4
maximumReconciliationCategoryCount = 21
reconciliationRoundMinimum = 1
reconciliationRoundMaximum = 3
```

There is no contradiction-code array in the result; contradictions are
represented by the fixed mismatch and missing codes. Its explicit maximum is
therefore zero. The maximum reconciliation category count is the sum of the 16
mismatch and five missing categories.

### 41.13 Private helper boundary

The operation module keeps exactly these implementation responsibilities
private; names may be used internally but are not exports:

```text
deepFreeze
assertStrictRecord
assertExactFields
assertNoUnsafeStructure
normalizeObjectId
validateUuidV4
validateCanonicalIso
deriveOutboxDeduplicationKeys
validateCandidateBinding
validateSeedRelationships
validateContextRelationships
cloneFrozen
collectIdentityMismatchCodes
hasExclusiveIdentityReuse
createOperationError
```

The reconciliation module keeps exactly these responsibilities private:

```text
deepFreeze
assertStrictRecord
assertExactFields
validateTaggedObservation
validateReadAuthority
validateObservationEnvelope
collectMismatchCodes
collectMissingCodes
hasSecurityConflict
hasCorruptTopology
hasIndeterminateEvidence
isCommittedProof
isNotCommittedProof
buildReconciliationResult
createReconciliationError
```

These are responsibility names, not required source-level function names. No
low-level helper may be exported.

### 41.14 Revised mandatory tests

The future operation-context suite must add:

- same operation ID with all fields identical;
- same operation ID with each of the 33 mismatch codes independently;
- different operation IDs with all exclusive identities distinct;
- different operation IDs sharing submission ID;
- different operation IDs sharing acknowledgement ID;
- different operation IDs sharing moderation-event ID;
- different operation IDs sharing new moderation-cycle ID;
- different operation IDs sharing expected-current-submission ID;
- different operation IDs sharing each typed outbox key;
- different operation IDs sharing the complete owner-scoped idempotency
  identity;
- different operation IDs sharing only Job/requester/non-exclusive values;
- exact classification, mismatch ordering, 33-code bound, frozen array, and no
  raw values.

For every record component, the future reconciliation suite must test:

- valid `FOUND`, `ABSENT`, `READ_FAILED`, and `DUPLICATE_OVERFLOW`;
- valid `DUPLICATE` at counts 2 and 10;
- rejection at counts 1 and 11;
- rejection of mixed-state and unknown fields;
- rejection of raw errors, records, accessors, symbols, hidden and inherited
  fields.

The precedence matrix must include:

- security conflict plus read failure, corruption, and duplicate overflow;
- corruption plus read failure;
- duplicate classified as corruption plus read failure;
- complete-looking evidence plus one malformed or failed required component;
- all-absent evidence plus read failure;
- all-absent evidence plus changed Job;
- every valid no-proof fallback.

Overflow must be tested independently for submission, Job, acknowledgement,
moderation event, quota, both required outbox intents, and unexpected outbox
records. Tests must assert exact result fields, action order, flags, category
order/bounds, privacy, immutability, JSON compatibility, and structured-clone
compatibility.

### 41.15 Corrected readiness and preservation

With this correction, pure C3 implementation no longer needs to invent an
identity classification, mismatch literal, tagged variant, overflow
representation, duplicate outcome, precedence rule, result flag/action, export,
or numeric bound.

- Pure C3 implementation: ready after checkpointing this correction.
- Model integration: not authorized.
- Transaction-service integration: not authorized.
- Database reconciliation adapter: not authorized.
- Mongoose submission adapter: not ready/not authorized.
- Runtime wiring: not ready/not authorized.

This correction modifies only this authoritative document. It creates no
implementation or test file, performs no database or reconciliation read,
changes no C1/C2/outbox/runtime behavior, and does not stage, commit, push, or
deploy anything.
