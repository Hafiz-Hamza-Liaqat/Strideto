# Free Beta Transaction-Service Boundary Correction Report

## 1. Executive verdict

**READY TO COMMIT DORMANT TRANSACTION-SERVICE BOUNDARY CORRECTION**

The C5 boundary correction is complete, dormant, provider-neutral, and
database-free. A new unambiguous service factory consumes the accepted C2
candidate, C3 stable operation seed/context, and C4 persistence evidence,
constructs one immutable intended atomic operation, calls one injected
executor exactly once, and classifies acknowledged, definitely aborted,
pre-commit application-failure, and unknown-commit outcomes.

The existing dormant H2B-A factory remains compatible and unchanged in
behavior. No active caller exists.

## 2. Exact files modified and created

Modified:

1. `server/src/services/publishing/TransactionalFreeBetaSubmissionService.js`
2. `server/src/__tests__/transactionalFreeBetaSubmissionService.test.js`

Created:

1. `server/src/__tests__/transactionalFreeBetaSubmissionBoundaryCorrection.test.js`
2. `docs/FREE_BETA_TRANSACTION_SERVICE_BOUNDARY_CORRECTION_REPORT.md`

The separate
`docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md` remained untouched and
untracked.

## 3. Autonomous engineering-loop summary

The completed loop was:

```text
repository preflight
-> authoritative C1-C4 and executor-contract mapping
-> existing caller/dependency inventory
-> separate compatible dormant C5 API
-> strict candidate/seed/decision validation
-> deterministic C4 and atomic-effect construction
-> one injected executor call
-> strict outcome classification
-> focused repair cycles
-> full regression graph
-> lint/build/format/static checks
-> independent contract-to-code self-audit
```

Repairs were limited to authorized C5 files:

- corrected one test that attempted to mutate an already-frozen C2 candidate;
- removed one unused test helper found by server lint;
- applied Prettier to authorized C5 code/test files;
- made strict input inventories independent of object insertion order;
- fail-closed malformed timestamp validation without leaking native errors;
- added strict array, proxy, accessor, hidden, inherited, and symbol handling;
- captured the exact executor function before invocation;
- made malformed/throwing executor results classify as unknown commit;
- required quota timestamp and usage projection consistency;
- added exact module, service, result, operation, effect, and payload
  inventories.

No repeated failure required a second attempt at the same repair.

## 4. Source-of-authority hierarchy

The implementation applied:

1. `docs/FREE_BETA_PUBLISHING_OPERATION_CONTEXT_RECONCILIATION_AUTHORITATIVE_CONTRACT_AUDIT.md`
2. `docs/FREE_BETA_PUBLISHING_OPERATION_CONTEXT_RECONCILIATION_FOUNDATION_REPORT.md`
3. `docs/FREE_BETA_ADDITIVE_IMMUTABLE_SUBMISSION_MODERATION_EVIDENCE_SCHEMA_REPORT.md`
4. `docs/FREE_BETA_PUBLICATION_CANDIDATE_AUTHORITATIVE_CONTRACT_AUDIT.md`
5. `docs/FREE_BETA_PUBLICATION_CANDIDATE_CONTRACT_FOUNDATION_REPORT.md`
6. `docs/FREE_BETA_APPLICATION_DESTINATION_CONTRACT_FOUNDATION_REPORT.md`
7. `docs/FREE_BETA_SUBMISSION_ADAPTER_BLOCKER_CONTRACT_AUDIT.md`
8. `docs/FREE_BETA_TRANSACTIONAL_SUBMISSION_CORE_REPORT.md`
9. `docs/FREE_BETA_TYPED_PUBLISHING_OUTBOX_AUDIT.md`
10. `docs/FREE_BETA_TYPED_PUBLISHING_OUTBOX_FOUNDATION_REPORT.md`
11. `docs/FREE_BETA_CANONICAL_JOB_PUBLICATION_SCHEMA_REPORT.md`
12. `docs/FREE_BETA_CANONICAL_JOB_WRITE_BOUNDARY_CORRECTION_REPORT.md`
13. `docs/FREE_BETA_PUBLISHING_POLICY_CONTRACT.md`

The requested outbox filenames differ from the repository. The two actual
accepted paths are the typed publishing outbox files listed above.

## 5. Previous transaction-service boundary

The existing `createTransactionalFreeBetaSubmissionService` accepts the
original seven-field H2B-A command, performs injected repository work inside
`transactionRunner.run`, and generates timestamps and stable record identities
inside that callback. Its generic runner cannot distinguish an acknowledged
commit from an unknown commit result and it does not consume the C2-C4
contracts.

That boundary is dormant and has no controller, route, startup, worker, or
frontend caller. It was retained for backward compatibility with the accepted
H2B-A focused suite.

## 6. Corrected transaction graph

```text
strict seven-field C5 input
-> validate 19-field C3 operation seed
-> validate complete 12-field C2 candidate
-> validate employer eligibility snapshot
-> validate supplied correction/quota decision
-> validate Free Beta before/after quota snapshot
-> build and validate 32-field C3 operation context
-> construct exact C4 evidence and six intended effect groups
-> deep-freeze the operation
-> invoke one injected executor
-> classify strict executor outcome
-> verify returned context for acknowledged commit
-> return bounded public-safe result
```

## 7. Public API compatibility

The existing export and returned service API remain:

```text
createTransactionalFreeBetaSubmissionService(...)
  -> { submitFreeBetaJob }
```

The corrected separate dormant API is:

```text
createDormantTransactionalFreeBetaSubmissionBoundary({
  transactionExecutor: { execute }
})
  -> { executeSubmissionOperation }
```

The new input is not an overload of the legacy raw command. Existing callers
cannot accidentally pass legacy controller/request data as a complete
candidate. Repository search found no runtime caller of either dormant C5
method.

## 8. Candidate validation boundary

The corrected method calls `validatePublicationCandidate(candidate, {jobId})`
before executor invocation. It therefore independently verifies schema and
policy versions, kind, revision, hash, predecessor/base relationship, expected
publication version, complete 26-field content, complete 11-field destination
evidence, and strict internal Job context.

Malformed, forged, wrong-Job, wrong-version, or invalid-destination candidates
never reach the executor. Candidate content is never placed in an error or
public result.

## 9. Operation-seed validation boundary

The method calls `validatePublishingOperationSeed` and accepts only the exact
committed 19-field seed. The seed owns the stable UUID, four pre-generated
record/cycle identities, owner-scoped idempotency identity, source
state/version, correction predecessor, rules version, initiated time, and two
derived outbox keys.

The corrected boundary generates no identity or timestamp.

## 10. Stable identity ownership

All identities exist before executor invocation:

- operation UUID;
- submission ID;
- acknowledgement ID;
- moderation-event ID;
- fallback/new moderation-cycle ID;
- actual moderation-cycle relationship;
- owner-scoped idempotency identity;
- both deterministic typed outbox keys;
- candidate hash/base/revision/version;
- initiated timestamp.

The deep-frozen operation is the only executor input. Internal executor retry
must reuse that same operation description. The boundary has no ID factory,
clock, transaction-attempt value, session identity, or random generator.

## 11. Eligibility and quota preservation

The input includes an exact eligible employer decision plus the accepted
verification snapshot. It requires active, verified/trusted evidence, complete
profile checks, the accepted predicate capability version, and no eligibility
blocker.

The correction decision is supplied, not granted by C5. It distinguishes:

- major edit: charged, no exemption;
- charged correction: an accepted chargeable blocker, no exemption;
- reviewer-requested exempt correction: no blocker and exact exemption reason.

Charged inputs fail before executor invocation when rolling 24-hour or
rolling-30-day use is exhausted. Exempt corrections do not use those charged
gates. A major edit projects one released active Free Beta slot. A correction
does not reserve or release an active slot. Five active Free Beta jobs do not
block correction submission. Limits remain 1, 10, and 5. Paid publishing is
never represented.

No quota write or restoration occurs in C5.

## 12. Immutable submission payload

The submission intent contains the existing top-level immutable relationships
and exact:

```text
publicationCandidate
operationEvidence
```

`publicationCandidate` has 12 top-level fields, exact 26-field content, exact
11-field destination evidence, and the accepted C2 hash/base/version
relationships.

`operationEvidence` has exact 14 fields plus the exact two-key nested outbox
record. The legacy strict content snapshot is deterministically projected from
the accepted candidate for current model compatibility. No input alias is
retained.

## 13. Immutable moderation-event payload

The submitted moderation-event intent contains exact 14-field
`submittedEvidence`. It binds operation, submission, candidate hash/kind/
revision, destination mode/digest, source publication version, actual
moderation cycle, employer actor, submitted event type, and initiated event
timestamp.

It stores no candidate body or raw destination target.

## 14. Acknowledgement intent

The acknowledgement intent uses the pre-generated acknowledgement ID and exact
employer, Job, submission, policy, rules version/digest, accepted state, and
stable initiated timestamp. It contains no raw IP, user agent, request,
credential, or arbitrary metadata.

## 15. Canonical Job CAS intent

The boundary describes, but does not execute, a canonical Job compare-and-set
intent with owner, Job, source state/version, expected committed
state/version/current submission, submission/base relationships, submission
kind, and active-slot release.

It performs no Mongoose query or Job mutation.

## 16. Two typed outbox intents

Exactly two intents are present:

```text
employer_submission_received
admin_job_review_requested
```

Their deduplication keys come only from the validated C3 context:

```text
<submissionId>:employer_submission_received
<submissionId>:admin_job_review_requested
```

No third intent or outbox record ID is generated.

## 17. Injected executor boundary

The sole dependency of the new factory is the strict:

```text
transactionExecutor.execute(operation)
```

It receives one deeply frozen ordinary record with:

```text
schemaVersion
operationContext
intendedEffects
```

`intendedEffects` contains exactly quota guard, acknowledgement, submission,
canonical Job compare-and-set, moderation event, and outbox intents.

The module imports no Mongoose, model, repository, or database configuration.

## 18. Commit outcome classifications

The only executor outcomes are:

```text
COMMIT_ACKNOWLEDGED
DEFINITELY_ABORTED
APPLICATION_ERROR_BEFORE_COMMIT
COMMIT_RESULT_UNKNOWN
```

Callback/executor completion without one exact outcome is not success.
Malformed results and thrown executor errors fail safely as unknown commit.

## 19. Acknowledged commit

Success requires:

- exact `COMMIT_ACKNOWLEDGED`;
- exact executor result envelope;
- returned operation context passes
  `validatePublishingOperationContext`;
- candidate/context validation passes again;
- `comparePublishingOperationIdentity` returns
  `SAME_LOGICAL_OPERATION`.

Any substituted operation, record, outbox, candidate, cycle, or version value
returns an integrity-reconciliation-required result, never success.

## 20. Definitely aborted

`DEFINITELY_ABORTED` returns bounded failure, no reconciliation requirement,
and no automatic retry. It only states that a future outer boundary may
separately authorize a same-key retry.

C5 does not perform that retry.

## 21. Pre-commit application failure

`APPLICATION_ERROR_BEFORE_COMMIT` returns bounded failure, no reconciliation
context, and no automatic retry. Validation failures occur before executor
invocation and use safe C5 contract errors.

## 22. Unknown commit

`COMMIT_RESULT_UNKNOWN`, a thrown executor error, an unsupported result, or a
malformed result returns:

- indeterminate status;
- null commit acknowledgement;
- reconciliation required;
- automatic retry false;
- same-key write retry not authorized.

It does not claim success or definite failure.

## 23. Reconciliation-required result

The exact validated 32-field context is held in a module-private `WeakMap`.
Trusted future internal composition can retrieve it with:

```text
getTransactionalSubmissionReconciliationContext(result)
```

The context is absent from enumerable result fields, JSON output, and
`structuredClone(result)`. C5 performs no reconciliation read and stores no
context durably.

## 24. Automatic-retry prohibition

The corrected boundary has one executor call site and invokes it once per
logical service call. No outcome invokes the executor a second time. Unknown
commit never creates a new seed or operation.

## 25. Quota-restoration prohibition

No C5 code increments, decrements, reserves, refunds, or restores quota.
Unknown commit returns for reconciliation without changing the supplied
evidence.

## 26. Final operation-context validation

`buildPublishingOperationContext` constructs the expected final context from
the validated seed, candidate, request fingerprint, rules digest, actual
cycle, committed state/version/current submission, and supplied quota
decision. `validatePublishingOperationContext` validates it before executor
invocation and validates acknowledged returned evidence again.

The context describes intended/returned evidence. It does not itself claim a
database commit.

## 27. Error and result privacy

C5 contract errors serialize only:

```text
status
code
message
```

Public results serialize only eight bounded status/decision fields. Tests prove
that candidate content, destination data, operation/record IDs, idempotency
key, outbox keys, hashes, driver text, session data, stack, and cause do not
appear.

## 28. Input/output immutability

Strict records reject unknown, hidden, inherited, symbolic, accessor, dotted,
operator, and prototype keys; primitives, arrays as envelopes, Date, RegExp,
Map, Set, class instances, unusual prototypes, proxies, circular envelopes,
request/session/token material, and arbitrary metadata fail closed.

Validated input is copied. Every operation, nested effect, array, context, and
result is deeply frozen. Executor mutation attempts cannot change service-held
evidence.

## 29. JSON and structuredClone

The operation uses ordinary primitive/record/array values and is JSON and
structured-clone compatible. Public results round-trip through JSON and
`structuredClone`. The private reconciliation context is deliberately omitted
from both public representations.

## 30. Purity and dormancy

The corrected boundary has:

- no Mongoose/MongoDB/model/repository import;
- no session or transaction implementation;
- no database configuration;
- no environment read;
- no filesystem or network operation;
- no log, timer, or listener;
- no controller, route, startup, worker, scheduler, webhook, payment, public
  query, or frontend integration;
- no module-scope operational side effect.

## 31. Dedicated C5 test results

- Suites: 1
- Assertions: 301
- Failures: 0

The suite covers exact inventories, major-edit and correction candidates,
charged/exempt decisions, C4 payloads, stable identity, every outcome,
identity substitution, unknown commit, quota boundaries, hostile envelopes,
privacy, aliases, JSON/clone behavior, and static dormancy.

## 32. Existing transaction-service test results

- Suites: 1
- Assertion call sites: 108
- Failures: 0

The previous accepted suite had 105 assertion call sites. C5 adds three
compatibility assertions for the outcome inventory, new factory failure
boundary, and unchanged legacy service method inventory.

## 33. C1/C2/C3/C4 regressions

- Application Destination: 1 suite, 1,224 assertions.
- Publication Candidate: 1 suite, 321 assertions.
- Publishing Operation Context: 1 suite, 197 assertions.
- Publishing Reconciliation: 1 suite, 282 assertions.
- C4 immutable evidence: 1 suite, 352 assertions.
- Submission model: 1 suite, 40 assertions.
- Support models: 1 suite, 36 assertions.

All passed.

## 34. Publishing/outbox/canonical regressions

- Remaining publishing policy/eligibility/quota: 4 suites, 148 assertions.
- Typed publishing outbox: 2 suites, 232 assertions.
- Canonical Job schema/write boundary: 2 suites, 516 assertions.

All passed. Overall C5 graph: 17 suites, 3,757 assertions/call sites, zero
failures.

## 35. Lint, build, and formatting

- Server lint: passed with zero errors.
- Client lint: passed with zero errors and 52 pre-existing warnings.
- Client no-write production build: passed after sandbox permission allowed
  the local esbuild subprocess; the verified temporary output was removed.
- Prettier: passed for all four authorized C5 files.
- `git diff --check`: passed.

The build emitted only existing Vite advisory warnings about mixed dynamic/
static import and large chunks.

## 36. Static scans

The following passed:

- model/database/repository import isolation;
- network and environment-read scans;
- filesystem-write scan;
- logging/timer/listener scan;
- conflict-marker and trailing-whitespace scans;
- candidate/destination leakage probes;
- identifier/key/hash leakage probes;
- driver/session leakage probes;
- exact export/input/result/outcome/payload inventories;
- exactly-one executor call-site probe;
- stable identity probe;
- JSON and structured-clone probes;
- runtime reference isolation.

## 37. Self-audit findings

The final audit found and repaired:

- input field validation initially depended on insertion order;
- malformed ISO input could have exposed a native date exception;
- blocker/result arrays needed stronger descriptor/proxy checks;
- the executor method needed capture before invocation;
- malformed/throwing executor results needed explicit unknown-commit fallback;
- quota projection timestamps needed equality checks;
- exact module and effect inventories needed direct tests.

No mismatch remains in the corrected dormant boundary.

## 38. Repairs performed

Focused repair cycles: one.

Static/lint/format repair cycles: one.

Self-audit hardening cycles: two.

Existing-service compatibility repair cycles: zero.

Regression repair cycles: zero.

Repeated failures requiring changed root-cause analysis: zero.

## 39. Known limitations

- no concrete persistence adapter;
- no trusted reconciliation repository;
- no reconciliation runner;
- no canonical Job Mongoose compare-and-set;
- no production topology proof;
- no index proof or application;
- no public pending-review gating;
- no staff destination review;
- no outbox delivery;
- no runtime wiring.

The legacy dormant H2B-A method remains available for compatibility and must
not be runtime-wired as the corrected C5 API.

## 40. Remaining blockers

A later separately authorized phase must provide:

- a strict persistence adapter for all six intended effects;
- a transaction-capable topology proof;
- same-session model/repository validation;
- canonical Job Mongoose CAS;
- trusted primary/majority reconciliation repositories;
- a bounded reconciliation runner;
- live index inventory/rollout proof;
- runtime writer and public-query cutover;
- destination staff review and outbox delivery.

## 41. Next safe phase

Review this report, then create one scoped four-file C5 checkpoint commit.
After that, the next engineering gate is the separately scoped combined
blocker-foundation acceptance audit. Do not begin C6, an adapter, database
reconciliation, or runtime wiring during the checkpoint.

## 42. Preservation statement

- Exactly one service modified: Yes.
- Exactly one existing service test modified: Yes.
- Exactly one dedicated C5 test created: Yes.
- Exactly one report created: Yes.
- Existing model or schema changed: No.
- Job model changed: No.
- C1/C2/C3 contract changed: No.
- C4 evidence schema changed: No.
- Outbox implementation changed: No.
- Controller, route, middleware, startup, worker, scheduler changed: No.
- Public query or renderer changed: No.
- Frontend changed: No.
- Configuration or dependency changed: No.
- Concrete Mongoose adapter implemented: No.
- Database connection performed: No.
- Reconciliation read performed: No.
- Canonical Job Mongoose CAS implemented: No.
- Runtime wiring added: No.
- Migration, backfill, or index operation performed: No.
- Production data read or written: No.
- Network operation performed: No.
- File staged: No.
- Commit, push, or deployment performed: No.
- Production acceptance report touched: No.

**STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED**
