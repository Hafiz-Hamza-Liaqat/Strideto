# Free Beta Publishing Operation Context and Reconciliation Foundation Report

## 1. Executive verdict

**READY TO COMMIT DORMANT PUBLISHING OPERATION CONTEXT AND RECONCILIATION FOUNDATION**

The C3 pure-contract foundation is complete, dormant, database-free, and
runtime-isolated. Exactly five authorized files were created. No existing file
was modified.

## 2. Exact files created

1. `server/src/services/publishing/contracts/PublishingOperationContextContract.js`
2. `server/src/services/publishing/contracts/PublishingReconciliationContract.js`
3. `server/src/__tests__/publishingOperationContextContract.test.js`
4. `server/src/__tests__/publishingReconciliationContract.test.js`
5. `docs/FREE_BETA_PUBLISHING_OPERATION_CONTEXT_RECONCILIATION_FOUNDATION_REPORT.md`

The separately untracked
`docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md` was not touched.

## 3. Engineering-loop summary

The implementation followed the required graph:

```text
strict seed input
-> immutable operation seed
-> authoritative candidate validation
-> immutable commit context
-> context validation
-> three-way identity comparison
-> strict reconciliation observations
-> security/corruption/indeterminate/commit/non-commit classification
-> bounded privacy-safe result
```

Both focused suites passed in both execution orders with stable totals. The
regression graph exposed one C1 isolation-test compatibility issue in the new
operation test; the test was corrected to use strict literal destination
evidence without directly importing C1. Server lint then exposed two unused
bindings in authorized new files; both were removed. Prettier formatted only
the five authorized files.

## 4. Authoritative contracts followed

The implementation follows the committed
`FREE_BETA_PUBLISHING_OPERATION_CONTEXT_RECONCILIATION_AUTHORITATIVE_CONTRACT_AUDIT.md`,
including its corrected C3-A1 identity, tagged-union, precedence, result,
export, bound, and test requirements. It also preserves the accepted C1
Application Destination, C2 Publication Candidate, transactional submission,
typed outbox, and canonical Job boundaries.

## 5. Module dependency graph

```text
PublishingReconciliationContract
-> PublishingOperationContextContract
-> PublicationCandidateContract
-> ApplicationDestinationContract
```

There is no reverse dependency or cycle. The operation module imports only the
accepted C2 candidate contract. The reconciliation module imports only the
operation-context comparison boundary.

## 6. Exact exports

`PublishingOperationContextContract.js` exports exactly:

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

`PublishingReconciliationContract.js` exports exactly:

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

No convenience APIs, aliases, or private helpers are exported.

## 7. Schema and policy versions

- Operation-context schema version: `1`
- Reconciliation schema version: `1`
- Publishing policy version: `free-beta-2026-01`

## 8. Operation kinds

The only operation kinds are:

```text
major_edit_submission
correction_submission
```

Major edits bind to an active source and a revision-one `major_edit`
candidate. Corrections bind to a rejected source, a correction predecessor,
and a revision-two-or-later `correction` candidate.

## 9. Nineteen seed fields

The immutable seed contains, in canonical order:

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

`correctionOfSubmissionId` is the only nullable seed field.

## 10. Thirty-two context fields

The context preserves all 19 seed fields and adds, in canonical order:

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

It contains no transaction-attempt telemetry and makes no database-commit
claim.

## 11. Identifier rules

- `operationId`: lowercase RFC 4122 UUID v4, exactly 36 characters.
- Mongo record identities: lowercase 24-hex ObjectId strings.
- Hashes: lowercase 64-hex SHA-256 values.
- Idempotency key: trimmed printable ASCII, 16 through 128 characters.
- Rules version: trimmed string, 1 through 100 characters.
- `initiatedAt`: injected valid native `Date`, stored as canonical UTC ISO.

Identifiers and time are validated, not generated from client fallbacks.

## 12. Typed outbox keys

Exactly two immutable deterministic keys are derived:

```text
<submissionId>:employer_submission_received
<submissionId>:admin_job_review_requested
```

They are bounded to 160 characters and held under the exact
`employerSubmissionReceived` and `adminJobReviewRequested` fields. No outbox
ObjectId is invented.

## 13. Candidate relationships

The context reuses `validatePublicationCandidate`, binds the candidate to the
Job, policy, operation kind, expected publication version, revision rules,
approved base, candidate hash, and predecessor rules. It stores no raw
candidate content or raw destination target.

## 14. Publication-version relationships

Both operation kinds require the committed publication version to be the
expected source version plus one, the committed state to be
`pending_review`, and the expected current submission to equal the
pre-generated submission identity. Major edits bind their base publication
version to the source version.

## 15. Stable retry identity

Operation, record, timestamp, candidate, moderation-cycle fallback, and typed
outbox identities are supplied once and retained across logical callback
retries. No transaction attempt number, driver session, or mutable alias is
stored.

## 16. Identity comparison

The exact classifications are:

```text
SAME_LOGICAL_OPERATION
DIFFERENT_LOGICAL_OPERATION
IDENTITY_CONFLICT
```

Equal operation IDs require every stable context field to match. A shared
operation ID with any mismatch is a conflict. Different operation IDs conflict
only when an exclusive record, outbox, or complete owner-scoped idempotency
identity is reused. Shared Job/requester or another non-exclusive field alone
does not create a conflict.

## 17. Thirty-three identity mismatch codes

The ordered codes are:

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

Only codes are returned; compared values are never returned.

## 18. Observation tagged unions

Every reduced component observation uses exactly one state:

```text
FOUND
ABSENT
DUPLICATE
DUPLICATE_OVERFLOW
READ_FAILED
```

`FOUND` uses the exact component-specific boolean/classification inventory.
`ABSENT`, `READ_FAILED`, and `DUPLICATE_OVERFLOW` contain only `state`.
`DUPLICATE` contains only `state` and `count`. Mixed-state and unknown fields
are rejected.

## 19. Duplicate and overflow behavior

Duplicate counts are integers from 2 through 10. Count 1 and count 11 are
invalid. Eleven or more records are represented by `DUPLICATE_OVERFLOW`.
Duplicates for exclusive operation-addressed records classify as
`SECURITY_CONFLICT`; canonical Job, quota, or unexpected-record duplication
classifies as `CORRUPT`.

## 20. Outcome precedence

The fixed precedence is:

```text
SECURITY_CONFLICT
CORRUPT
INDETERMINATE
COMMITTED
NOT_COMMITTED
INDETERMINATE fallback
```

It is independent of input object-key and iteration order.

## 21. Committed proof

`COMMITTED` requires trusted complete read authority and every expected atomic
effect to be `FOUND` and matching: submission, canonical Job transition,
acknowledgement, moderation event, both typed outbox intents, and applicable
quota evidence. Unexpected outbox records must be absent. A subset cannot
prove commit.

## 22. Not-committed proof

`NOT_COMMITTED` requires trusted complete read authority, every
operation-addressable effect to be authoritatively absent, no read failure or
duplicate, and the canonical Job to be authoritatively unchanged at the exact
base state/version.

## 23. Indeterminate classification

`INDETERMINATE` is returned when no stronger security or corruption proof
exists and required evidence failed to read, trusted visibility is incomplete,
or the valid evidence set proves neither committed nor not committed.

## 24. Corrupt classification

`CORRUPT` covers impossible or partial atomic topology, canonical Job or quota
duplication, unexpected outbox effects, one required outbox effect without the
other, canonical transition without its supporting records, and
non-security relationship failures.

## 25. Security-conflict classification

`SECURITY_CONFLICT` is limited to authoritative identity substitution,
conflicting operation reuse, owner/Job relationship conflict, exclusive
record/outbox reuse, and the exact security categories. A read failure does
not invent security evidence.

## 26. Action mappings

```text
COMMITTED:
  RETURN_SUCCESS, DO_NOT_RETRY
NOT_COMMITTED:
  RETURN_RETRYABLE_FAILURE, DO_NOT_RETRY
INDETERMINATE:
  RECONCILE_AGAIN_LATER, DO_NOT_RETRY
CORRUPT:
  RETURN_FAILURE, DO_NOT_RETRY, ESCALATE_MANUAL_REVIEW
SECURITY_CONFLICT:
  RETURN_FAILURE, DO_NOT_RETRY, ESCALATE_MANUAL_REVIEW,
  ESCALATE_SECURITY_REVIEW
```

Results contain exactly 11 fields and at most four actions.

## 27. Automatic-retry prohibition

The classifier performs no retry and never authorizes automatic write retry
after an unknown commit. `retryAllowed` on authoritative `NOT_COMMITTED`
means only that a future outer service may separately authorize a later
same-key attempt.

## 28. Error contracts

Operation-context errors are exactly:

```text
OPERATION_CONTEXT_INPUT_INVALID
OPERATION_IDENTIFIER_SET_INVALID
OPERATION_CANDIDATE_MISMATCH
OPERATION_IDENTITY_CONFLICT
OPERATION_KIND_UNSUPPORTED
```

Reconciliation errors are exactly:

```text
RECONCILIATION_INPUT_INVALID
RECONCILIATION_COMPARISON_FAILED
```

Errors serialize only `status`, stable `code`, and safe `message`.

## 29. Privacy boundary

Errors and results expose no operation, Job, Employer, owner, submission,
moderation, acknowledgement, outbox, candidate, destination, observation,
driver, credential, token, payment, or applicant value. Identity comparison
returns only a classification and bounded mismatch codes.

## 30. Strict input validation

Public APIs reject missing or primitive inputs, arrays, dates in envelopes,
regular expressions, maps, sets, class instances, unusual prototypes,
accessors, inherited or hidden fields, symbols, circular input, unsafe/dotted/
`$` keys, unknown fields, database documents, request/session material, raw
records, arbitrary metadata, and unrelated private data.

## 31. Immutability and aliases

All exported inventories and policies are frozen. Built and validated values
are newly allocated and deeply frozen. Nested objects and arrays are copied;
no mutable input alias is retained and no input is mutated.

## 32. JSON and structuredClone

Focused probes confirm JSON serialization and round-trip preservation and
successful `structuredClone()` for contract values and results. Stored values
contain no `Date`, `Proxy`, `Map`, `Set`, class instance, or database-document
alias.

## 33. Purity and dormancy

The modules perform pure validation, construction, comparison, and
classification only. They contain no Mongoose/model import, database call,
network request, environment read, filesystem access, logging, timer,
listener, message dispatch, or module-scope operational side effect. No
controller, route, middleware, worker, scheduler, startup module, public query,
frontend module, payment module, or webhook imports them.

## 34. Focused tests

- Operation-context suite: 197 assertions passed.
- Reconciliation suite: 282 assertions passed.
- Focused total: 479 assertions, 0 failures.

Coverage includes exact inventories, all 33 identity mismatches, every
exclusive reuse, strict envelopes, immutability, serialization, every tagged
variant and duplicate bound for every component, precedence combinations,
complete commit/non-commit proofs, partial topology, action mappings, privacy,
purity, and dormancy.

## 35. Existing regressions

- Application Destination: 1 suite, 1,224 assertions.
- Publication Candidate: 1 suite, 321 assertions.
- Publishing foundations and service: 7 suites, 313 assertions.
- Typed publishing outbox: 2 suites, 232 assertions.
- Canonical Job schema/write boundary: 2 suites, 516 assertions.
- Existing regression total: 13 suites, 2,606 assertions.

All passed without changing an existing file.

## 36. Cross-order runs

The operation and reconciliation suites passed in both execution orders.
Each retained stable totals of 197 and 282 assertions respectively. No cache,
global-state, mutation, or dependency-order issue remained.

## 37. Lint, build, and formatting

- Server lint: passed with zero errors.
- Client lint: passed with zero errors and 52 pre-existing warnings.
- Client no-write production build: passed using a verified temporary output
  directory that was removed after the build.
- Prettier: passed for all five C3 files after formatting only authorized new
  files.

The build reported existing Vite advisory warnings about mixed static/dynamic
import and large chunks; no client file was changed.

## 38. Static scans

Import isolation, database/network, environment/filesystem, logging,
timer/listener, module-scope side-effect, conflict-marker, trailing-whitespace,
sensitive-value, raw identifier/key/hash leakage, and raw observation leakage
scans passed. Exact export, field, enum, bound, outbox-key determinism, JSON,
and structured-clone probes passed.

## 39. Self-audit findings and repairs

The final independent contract-to-code audit found no remaining contract
mismatch, missing export, field, enum, bound, precedence rule, privacy rule, or
mandatory behavioral matrix. The engineering loop made these authorized
repairs:

- removed a direct C1 import from the new operation test to preserve accepted
  C1 isolation behavior;
- removed two unused bindings reported by server lint;
- applied repository formatting to the five authorized files.

No existing test or implementation file was changed. No final requirement
remains unsupported by code and focused tests.

## 40. Known limitations

This foundation does not persist operation context, collect database
observations, reconcile an actual transaction, run canonical Job CAS, write
outbox records, retry a transaction, or expose a runtime API. It does not
claim database commit, delivery, moderation, publication, or production
readiness.

## 41. Remaining blockers

Later separately authorized work must provide the persistence evidence and
repository interfaces required by the accepted candidate, submission,
moderation, acknowledgement, canonical Job, quota, and outbox contracts. It
must also implement trusted database observation reads and controlled
unknown-commit orchestration. Those items are outside C3.

## 42. Next safe phase

Review this report, then create one scoped five-file local checkpoint commit.
Do not begin C4, a Mongoose adapter, reconciliation reads, or runtime wiring as
part of that checkpoint.

## 43. Preservation statement

- Exactly five files created: Yes.
- Existing file modified: No.
- Model or schema modified: No.
- Transaction service changed: No.
- C1 or C2 changed: No.
- Outbox implementation changed: No.
- Database reconciliation read performed: No.
- Canonical Job CAS implemented: No.
- Automatic transaction retry implemented: No.
- Controller, route, worker, scheduler, middleware, or startup integration: No.
- Adapter or runtime wiring: No.
- Frontend, theme, or responsiveness changed: No.
- Authentication, RBAC, security, or privacy weakened: No.
- Configuration or dependency changed: No.
- Database or network operation performed: No.
- Production data read or written: No.
- Migration, seed, remediation, or index operation performed: No.
- File staged: No.
- Commit, push, or deployment performed: No.
- Production acceptance report touched: No.

**STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED**
