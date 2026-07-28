# Free Beta Mongoose Submission Adapter Readiness Re-Audit

## 1. Executive verdict

**NOT READY**

The additive canonical Job publication schema and the typed, transaction-bound
publishing outbox resolve two major blockers from the earlier adapter audit.
The repository also now has a canonical, immutable source from which active
Free Beta usage can be joined.

A contract-complete dormant Mongoose adapter still cannot be implemented
safely. Three interface and evidence gaps remain:

1. The accepted submission command contains no candidate patch. For an active
   major edit, the service asks the snapshot builder to read the already
   persisted Job. It therefore cannot satisfy the accepted rule that the
   candidate is validated in memory and that transaction failure preserves the
   prior active content.
2. The submission snapshot records only `applicationMode` and
   `applicationDomain`. The current Job and employer write paths accept a full
   application URL and/or email without server-side ownership proof, and public
   rendering can fall back to `sourceUrl`. The immutable record neither proves
   destination control nor captures enough exact, safe destination evidence to
   detect a post-submission redirect.
3. `transactionRunner.run(work)` receives neither the owner/idempotency
   identity nor a resolution callback. The callback's stable result omits the
   idempotency key, request fingerprint, acknowledgement ID, moderation-event
   ID, and expected outbox keys. After driver commit retries are exhausted, the
   runner cannot perform the required authoritative
   `UnknownTransactionCommitResult` reconciliation without changing the
   accepted service/composition contract.

Production transaction topology is also unproved, but that is an operational
blocker before replica-set proof and runtime wiring rather than a blocker to
database-free module construction. Canonical initialization, index rollout,
public-query cutover, and worker/delivery remain separately gated.

No adapter, database operation, migration, index operation, runtime import, or
delivery wiring was created by this audit.

## 2. Repository state

- HEAD:
  `e6179e362f318d7fb8afb11a2c01184a11e6f6da`
  (`feat: add dormant typed publishing outbox foundation`).
- Branch: `main...origin/main [ahead 8]`.
- No merge, rebase, cherry-pick, revert, or conflict state was present.
- No tracked file was modified before this report.
- No file was staged.
- The only pre-existing untracked file was
  `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`.
- That production acceptance report was not opened, modified, staged, or
  otherwise touched.

## 3. Previous blocker resolution matrix

| Previous blocker                  | Current classification   | Evidence and consequence                                                                                                                                                                               |
| --------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canonical Job projection          | `RESOLVED_FOUNDATION`    | `Job.js` has nullable canonical state, version, submission links, publication dates, policy version, update time, rejection summary, slug freeze, and migration classification.                        |
| Canonical Job compare-and-set     | `PARTIAL`                | An exact Mongoose predicate/update can be expressed for already initialized Jobs. No repository exists, and active-major-edit candidate preservation cannot be expressed through the accepted command. |
| Transaction-bound typed outbox    | `RESOLVED_FOUNDATION`    | `MongoosePublishingOutboxRepository.enqueueMany(intents,{session})` exactly matches the accepted service and requires an active transaction.                                                           |
| Production transaction topology   | `UNRESOLVED_OPERATIONAL` | One default Mongoose connection is used, but the secret URI and deployed topology are not statically provable and no capability probe exists.                                                          |
| Canonical active Free Beta usage  | `RESOLVED_QUERY_SOURCE`  | Canonical `publicationState`, `visibleUntil`, and `lastApprovedSubmissionId` can be joined to immutable approved `free_beta` submission evidence. A same-session adapter query is still required.      |
| Application-destination ownership | `BLOCKING`               | Current server writes do not prove URL/mailbox ownership; exact immutable destination evidence is absent.                                                                                              |
| Idempotency/replay                | `PARTIAL`                | Owner/key uniqueness, request fingerprint, submission links, acknowledgement uniqueness, event history, and outbox deduplication exist. Adapter methods and corruption checks remain unimplemented.    |
| Unknown commit resolution         | `BLOCKING_INTERFACE_GAP` | The runner is not given the resolution identity/evidence required after an unknown commit outcome.                                                                                                     |
| Legacy state classification       | `RUNTIME_GATED`          | Nullable fields preserve legacy behavior. Unclassified/null/manual-review records must fail closed until a separately approved classification or native creation path exists.                          |

## 4. Exact transactional-service dependency map

The following are the only injected properties and methods used by
`createTransactionalFreeBetaSubmissionService`. Quota-owner resolution and the
two eligibility evaluators are imported pure functions, not injected
dependencies.

| Order | Dependency and method                               | Exact arguments                                                                                                                               | Return consumed                                                    | Session / operation / failure contract                                                                                                                                                                             |
| ----- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | `transactionRunner.run`                             | One callback: `async ({session}) => result`                                                                                                   | Committed callback result                                          | Must open one transaction, supply one active session, commit before returning, abort on callback failure, preserve retry labels internally, and always end the session.                                            |
| 2     | `clock.now`                                         | No arguments                                                                                                                                  | Valid `Date` as `acceptedAt`                                       | Pure/server-owned; called inside the retryable callback. Invalid output becomes safe `TRANSACTION_FAILED`.                                                                                                         |
| 3     | `employerRepository.getById`                        | `{employerId: authenticatedEmployerId, session}`                                                                                              | Employer or null                                                   | Same-session read. The service applies the accepted pure eligibility predicate and never accepts client verification data.                                                                                         |
| 4     | `jobRepository.getOwnedJobForSubmission`            | `{employerId, jobId, session}`                                                                                                                | Job, or privacy-safe `{found,owned,job}`                           | Same-session read. Service rechecks `job.employerId`. Missing/ownership/state/version failures abort before writes.                                                                                                |
| 5     | imported quota owner resolver                       | Employer object                                                                                                                               | Frozen `{ownerType,ownerId,guardId}`                               | Pure; beta owner is the Employer account. No session or client override.                                                                                                                                           |
| 6     | `serializedQuotaGuard.acquire`                      | `(quotaOwner,{session})`                                                                                                                      | Acquired guard result is ignored                                   | First database write; must use the transaction session and serialize every quota-sensitive operation for the owner.                                                                                                |
| 7     | `contentSnapshotBuilder.build`                      | `{job,submissionKind,session}`                                                                                                                | Strict snapshot with lowercase 64-hex `contentHash`                | May be pure or perform trusted same-session validation reads. It must not mutate Job or perform external I/O. Current arguments are insufficient for a safe candidate major edit and proven destination ownership. |
| 8     | `requestFingerprintBuilder.build`                   | `{jobId,expectedPublicationVersion,submissionKind,correctionOfSubmissionId,policyVersion,rulesVersion,contentHash}`                           | Lowercase 64-hex digest                                            | Pure and deterministic. No session argument is supplied.                                                                                                                                                           |
| 9     | `submissionRepository.findByOwnerAndIdempotencyKey` | `{quotaOwnerType,quotaOwnerId,idempotencyKey,session}`                                                                                        | Existing submission or null                                        | Same-session authoritative replay read. Same fingerprint returns the stored stable result; different fingerprint aborts with `IDEMPOTENCY_KEY_REUSED`. No writes may occur on replay.                              |
| 10    | `postingRulesRegistry.getCurrent`                   | `{session}`                                                                                                                                   | `{version,digest}`                                                 | Must return a versioned SHA-256 record. It can be a frozen registry; if persisted, its read must use the session. A stale client version aborts.                                                                   |
| 11    | `submissionRepository.getCorrectionContext`         | `{correctionOfSubmissionId,jobId,session}`                                                                                                    | `{previousSubmission,existingCycleSubmissions}` or null components | Same-session correction evidence read. It must return only server-owned records and fail closed for inaccessible, cross-job, non-current, or corrupt predecessors.                                                 |
| 12    | `moderationEventRepository.getLatestForSubmission`  | `{submissionId: correctionOfSubmissionId,session}`                                                                                            | Latest event or null                                               | Same-session deterministic history read used by correction classification.                                                                                                                                         |
| 13    | `quotaUsageService.getUsage`                        | `(quotaOwner,{now:acceptedAt,session})`                                                                                                       | Daily, rolling-30-day, and active-Free usage                       | Same-session snapshot reads after guard acquisition. Charged failures abort before durable business writes.                                                                                                        |
| 14    | `idFactory.next`                                    | Names `moderationCycle`, `acknowledgement`, `submission`, and `moderationEvent`                                                               | Valid IDs                                                          | Server-owned, retry-safe generation inside the callback. IDs from an aborted callback attempt must never be reused as evidence of commit.                                                                          |
| 15    | `acknowledgementRepository.create`                  | Exact acknowledgement document, then `{session}`                                                                                              | Return ignored                                                     | Same-session append-only write. Any failure aborts every transaction write. Replay does not call it.                                                                                                               |
| 16    | `submissionRepository.create`                       | Exact pending submission document, then `{session}`                                                                                           | Created submission                                                 | Same-session immutable-evidence write. Its returned record feeds the response. Duplicate/validation failures abort.                                                                                                |
| 17    | `jobRepository.compareAndSetPendingReview`          | `{employerId,jobId,expectedPublicationVersion,expectedSourceState,submissionId,submissionKind,contentSnapshot,releaseActiveFreeSlot,session}` | `{matched:true}` or `{matched:false,code?}`                        | Same-session atomic Job write. A mismatch maps to an accepted safe Job error and aborts all preceding writes.                                                                                                      |
| 18    | `moderationEventRepository.append`                  | Exact submitted-event document, then `{session}`                                                                                              | Return ignored                                                     | Same-session append-only write. Failure aborts acknowledgement, submission, Job CAS, guard update, and later outbox writes.                                                                                        |
| 19    | `notificationOutbox.enqueueMany`                    | Two exact intents, then `{session}`                                                                                                           | Insert count ignored                                               | Same-session ordered batch write; no delivery. Any contract/persistence failure aborts the entire submission.                                                                                                      |

The factory also checks every method at construction. It does not call a
payment dependency, a mail/notification sender, a public-query adapter, or the
current production Job model directly.

## 5. Exact transaction sequence

There are no service-level reads before `transactionRunner.run`. The command is
validated inside the transaction callback.

1. Start one transaction and expose its session.
2. Validate the command and obtain server time.
3. Read Employer; evaluate employer eligibility.
4. Read the owned canonical Job; recheck ownership.
5. Resolve quota owner.
6. Increment/upsert the quota guard in the transaction.
7. Build and validate the content snapshot.
8. Build and validate the request fingerprint.
9. Look up owner-scoped idempotent replay.
10. Return the committed stored result immediately for same-fingerprint replay,
    or abort for a fingerprint conflict.
11. Validate canonical Job source state and version.
12. Read current posting-rules version/digest.
13. For corrections, read predecessor/cycle history and latest moderation
    event, then classify exempt, charged fallback, or structurally invalid.
14. Read rolling and active Free Beta usage in the same transaction snapshot.
15. Reject charged quota exhaustion before business-record creation.
16. Generate the moderation-cycle and record IDs.
17. Create the posting-rules acknowledgement.
18. Create the pending publication submission.
19. Atomically compare-and-set Job to `pending_review`.
20. Append the `submitted` moderation event.
21. Insert both typed outbox intents in one repository call.
22. Return a stable result from the callback.
23. Commit the transaction; only then may `run` return to the service caller.

Every write, including the quota-guard update, must roll back together. No
direct email, notification, queue publication, webhook, or payment action
occurs inside or after the accepted service callback.

Driver/Mongoose transaction retries may rerun the complete callback for a
transient transaction error. All collaborators must therefore remain
same-session, idempotent under aborted attempts, and free of external side
effects. A terminal unknown commit outcome has no accepted reconciliation step
today; that is a confirmed gap rather than an inferred step.

## 6. Existing transaction-runner compatibility

Repository search found one production transaction helper:
`runWithSerializedPublishingQuota` in `SerializedQuotaGuard.js`.

Classification: **INCOMPATIBLE** as the accepted service's
`transactionRunner`.

- It has signature `runWithSerializedPublishingQuota(owner,work,options)`,
  while the service calls `transactionRunner.run(work)`.
- It acquires the quota guard before invoking `work`, while the service already
  calls `serializedQuotaGuard.acquire` after employer/Job resolution. Adapting
  it directly would either require an owner before the callback or acquire the
  guard twice.
- It creates a session from the supplied/default connection, calls
  `session.withTransaction`, forwards optional `transactionOptions`, and ends
  the session in `finally`.
- It does not set explicit read concern, write concern, or read preference.
- It adds no application-defined retry maximum. Retry behavior is whatever
  Mongoose/driver `withTransaction` provides.
- It has no terminal unknown-commit reconciliation, error-label policy,
  nested-transaction rejection, privacy-safe diagnostic mapper, or topology
  capability check.
- It performs no logging and therefore does not expose keys or records.
- Its connection/model injection is useful as a design reference, and H2A has
  fake-session tests, but it is not the required runner.

A new dormant publishing-specific transaction runner would be required. It
must:

- reject a nested/currently active caller session rather than silently create a
  second logical transaction;
- use the same default Mongoose connection as every injected model;
- use primary reads, transaction-level snapshot semantics, and majority write
  durability subject to separately approved production settings;
- preserve `hasErrorLabel` and raw labels internally until retry decisions are
  complete;
- impose a documented bounded retry/time policy;
- end the session exactly once on every path;
- never log a URI, raw driver error, command, document, idempotency key, or
  snapshot;
- return only after a known commit or authoritative reconciliation.

The last requirement cannot be completed through the current runner interface.

## 7. Production transaction-topology classification

Classification:
**STATICALLY_COMPATIBLE_BUT_UNPROVED**

- Installed versions are Mongoose `8.23.0` and MongoDB driver `6.20.0`; the
  declared Mongoose range is `^8.1.1`.
- `connectDB` calls `mongoose.connect` once. Production models use
  `mongoose.model` on that default connection; no production
  `mongoose.createConnection` was found.
- The API and worker both import the same `connectDB` helper.
- `MONGO_URI` is an external secret in `render.yaml`. No URI value was read or
  exposed. Static configuration does not prove a replica set, sharded
  transaction-capable deployment, transaction lifetime, write concern, or
  failover behavior.
- No startup capability check proves that transactions are supported.

This does not prevent pure modules and stubbed-model tests. It blocks real
transaction claims, disposable integration acceptance, and production wiring.

## 8. Canonical Job repository and compare-and-set contract

### Owned lookup

`getOwnedJobForSubmission({employerId,jobId,session})` must:

- cast both IDs without exposing cast details;
- query by `_id` and exact `employerId` using the supplied session;
- select only canonical lifecycle fields, ownership, approved/current links,
  publication dates, migration status, and the allow-listed content required by
  the snapshot builder;
- reject a null, `manual_review`, or unknown migration classification;
- distinguish missing and not-owned only through safe internal checks, never by
  returning another employer's data;
- reject canonical records missing the state/version/link/date invariants
  required for their source state.

### Safe submit CAS

For an already initialized and eligible record, the base atomic predicate is:

```text
{
  _id: jobId,
  employerId,
  publicationMigrationStatus: {
    $in: ["canonical_native", "legacy_backfilled"]
  },
  publicationState: expectedSourceState,
  publicationVersion: expectedPublicationVersion
}
```

It must additionally enforce source-state invariants:

- `draft`/initial: no incompatible pending current submission;
- `rejected`/correction: a valid current rejected-submission relationship,
  established by same-session correction-context reads and protected by the
  publication-version invariant;
- `active`/major edit: valid `currentSubmissionId`,
  `lastApprovedSubmissionId`, publication dates, and active visibility;
- `closed` or `expired` renewal/repost: valid canonical classification and no
  pending submission.

Every canonical writer must increment `publicationVersion`; otherwise the
state/version predicate cannot protect current-submission changes. The accepted
submit method does not receive an expected `currentSubmissionId`, so exact
predecessor proof must be established before CAS and any current-link mutation
must be versioned. A future decision CAS, unlike this submit CAS, must directly
match `currentSubmissionId`.

The successful update would:

```text
$set:
  publicationState = "pending_review"
  currentSubmissionId = submissionId
  policyVersion = "free-beta-2026-01"
  publicationUpdatedAt = server time
$inc:
  publicationVersion = 1
```

It preserves `lastApprovedSubmissionId` for major edit, renewal, and repost
history. It does not set `publishedAt`, `visibleUntil`, `slugFrozenAt`, or
approval fields and never makes a Job active.

Because current public queries still use legacy `status`, a future wired
transition must also have an explicitly approved compatibility withdrawal that
hides the Job at the same commit, or the public-query cutover must precede it.
Merely setting `publicationState: pending_review` does not hide a currently
legacy-active Job. This audit does not authorize such a legacy write or query
cutover.

`findOneAndUpdate` with this exact predicate, `$set`/`$inc`,
`runValidators:true`, `new:true`, and the supplied session is sufficient for
the single-document CAS. Failure diagnosis should use the already loaded safe
projection and return only:

- success;
- `JOB_NOT_FOUND`;
- `JOB_NOT_OWNED`;
- `JOB_VERSION_CONFLICT`;
- `JOB_STATE_NOT_SUBMITTABLE`;
- `SUBMISSION_ALREADY_PENDING`;
- internal `JOB_CANONICAL_STATE_NOT_INITIALIZED`.

### Active-major-edit blocker

The accepted migration audit requires an active major edit to:

1. apply an allow-listed patch to an in-memory candidate;
2. validate/hash that candidate before persistence;
3. atomically replace allowed Job content and transition active to pending;
4. leave the prior active Job content untouched on any failure.

The accepted command has no patch. The current employer update route mutates
the stored active Job before any H2B transaction. Reading that Job in
`contentSnapshotBuilder.build` cannot reconstruct or preserve the former
approved content. The supplied `contentSnapshot` argument to CAS is evidence,
not an authorized candidate patch.

Therefore a correct adapter must reject `major_edit` until a separately
accepted candidate-edit boundary exists. An adapter that rejects one of the
accepted service's advertised submission kinds is not contract-complete.

## 9. Canonical initialization and legacy compatibility

Legacy `status`, `approvalStatus`, `planType`, `expiresAt`, and `deadline` are
not canonical publication truth. The adapter must never derive canonical state,
plan, version, or dates from them.

Fail-closed behavior:

- absent `publicationState`, `publicationVersion`, or
  `publicationMigrationStatus` means
  `JOB_CANONICAL_STATE_NOT_INITIALIZED`;
- `manual_review` is ineligible;
- `legacy_backfilled` is eligible only after a separately approved
  classification/backfill has established all required invariants;
- `legacy_compatible` remains a temporary explicit dual-read classification
  and is not eligible for canonical submission writes until a separately
  approved conversion establishes `legacy_backfilled` invariants;
- native future draft creation must explicitly write
  `publicationState:draft`, `publicationVersion:0`, and
  `publicationMigrationStatus:canonical_native`;
- no adapter lookup may perform an implicit initialization write.

This is a runtime-composition/migration blocker, not a blocker to a
fail-closed repository class. It means current legacy Jobs do not become
submittable merely because an adapter file exists.

## 10. JobPublicationSubmission repository contract

Required methods are exactly:

```text
findByOwnerAndIdempotencyKey({
  quotaOwnerType,
  quotaOwnerId,
  idempotencyKey,
  session
})

getCorrectionContext({
  correctionOfSubmissionId,
  jobId,
  session
})

create(document, { session })
```

`create` must use strict validation, the supplied `_id`, and the same session.
The model stores immutable Job/employer/quota-owner identity, submission kind,
`free_beta`, policy version, accepted time, idempotency key, request
fingerprint, predecessor/cycle linkage, charged/exempt classification, Job
revision, strict content/verification/quota snapshots, and acknowledgement
link. It starts in `pending_review`.

It does not have unrestricted `Mixed` metadata and has no paths for request
objects, tokens, cookies, authorization headers, applicant data, passwords, or
payment data.

Existing indexes:

- unique
  `{quotaOwnerType,quotaOwnerId,idempotencyKey}`;
- `{quotaOwnerType,quotaOwnerId,acceptedAt:-1}`;
- `{quotaOwnerType,quotaOwnerId,planCode,acceptedAt:-1}`;
- `{jobId,acceptedAt:-1}`;
- `{state,acceptedAt}`;
- `{employerId,acceptedAt:-1}`;
- unique `{rulesAcknowledgementId}`;
- sparse `{correctionOfSubmissionId}`;
- `{moderationCycleId,acceptedAt}`;
- unique partial `{moderationCycleId}` for quota-exempt corrections;
- unique partial `{jobId}` for `state:pending_review`.

Replay lookup must select enough fields to validate a complete accepted record,
including fingerprint, response fields, Job link, acknowledgement link, and
quota snapshot. A found but structurally incomplete record is not replay
success; it is internal `IDEMPOTENCY_RECORD_INCOMPLETE`.

The current content snapshot's destination evidence is insufficient: it stores
only `applicationMode` and `applicationDomain`, not the exact sanitized target,
target digest/ownership basis, or server-controlled internal route identity.
That is a schema/contract blocker.

## 11. Posting-rules acknowledgement repository contract

The exact method remains `create(document,{session})`.

- It must perform one strict, append-only create using the supplied session.
- Employer, Job, submission, policy version, rules version/digest,
  `accepted:true`, accepted time, and created time are server supplied.
- Optional IP and user-agent evidence can only be 64-hex hashes. The service
  supplies neither, so the adapter must not invent or capture raw request data.
- Unique `{submissionId}` enforces one acknowledgement per submission.
- Employer/time and rules-version/time indexes support history.
- Save/update/delete middleware makes the model append-only at repository
  boundaries.

The service returns on idempotent replay before acknowledgement creation, so a
committed acknowledgement is reused only through the existing submission link.
The create method must not perform a check-then-reuse race. A duplicate is a
transaction conflict or unknown-commit signal and must abort/reconcile.

Live existence and health of the unique index remain operationally gated.

## 12. Moderation-event repository contract

Required methods:

```text
getLatestForSubmission({ submissionId, session })
append(document, { session })
```

The submitted event written by the service contains:

- supplied `_id`, Job ID, submission ID, and employer ID;
- `actorType:employer` and authenticated Employer actor ID;
- `action:submitted`;
- canonical source and `pending_review` target state;
- no internal/employer reason text;
- content hash;
- strict metadata for charged/exempt state, cycle, submission kind, active
  usage projection, slots released, and policy version;
- server transaction time.

The model is strict and append-only. Rejection/changes-requested events require
safe reason data and cycle evidence, but submitted events correctly do not.
No staff-internal note is needed by the submitted event.

Current history indexes are:

- `{jobId,createdAt}`;
- `{submissionId,createdAt}`;
- `{employerId,createdAt:-1}`;
- `{action,createdAt:-1}`.

The latest-event read must sort deterministically by
`{createdAt:-1,_id:-1}`. The existing submission/time index supports the main
prefix but does not include the tie-breaker. There is no unique submitted-event
index. Transaction atomicity, unique pending submission, replay-before-write,
and preallocated `_id` prevent ordinary duplicates; a dedicated partial unique
index is a pre-runtime hardening decision, not required to create a dormant
repository.

## 13. Quota guard

The exact injected interface is the already accepted
`SerializedQuotaGuard.acquire(owner,{session})`.

- Beta owner key is the namespaced string
  `employer:<canonical-object-id>`.
- The operation requires `session.inTransaction() === true`.
- It performs one `findOneAndUpdate` matching `_id`, owner type, and owner ID,
  with `$inc:{revision:1}`, `upsert:true`, validators/defaults, and the session.
- The guard is a durable serialization record, not a process mutex and not a
  lease. It has no expiry.
- The write is rolled back with the transaction.
- Concurrent transactions contend on the same durable document; write
  conflict/duplicate-insert behavior must be left to the transaction runner's
  bounded labeled retry policy.
- Process death releases no application lock because no application lock
  exists; the database transaction abort/timeout governs uncommitted state.
- Namespaced `_id` uniqueness and the declared unique
  `{ownerType,ownerId}` index close find-then-create identity races.

Classification: **IMPLEMENTATION READY FOR SAME-SESSION REUSE**, subject to
disposable replica-set contention proof and controlled live index verification.
A separate guard repository is not needed.

## 14. Quota-owner resolution

The authoritative beta quota owner is the Employer account:

```text
ownerType = "employer"
ownerId = Employer._id
```

The resolver accepts only a canonical ObjectId, creates the namespaced guard
ID, and is pure. The client cannot supply owner type, owner ID, organization,
workspace, plan, or policy version. Job ownership is separately verified
against the same authenticated Employer ID before resolution.

The current Employer model has no canonical organization/workspace membership
owner that supersedes the Employer account. Future employer-admin
relationships must not silently change beta ownership. No session read is
needed beyond the already loaded Employer.

## 15. Quota-usage queries

The accepted H2A calculator is reusable. Its current Mongoose read helper does
not attach the passed service session, so a new session-aware adapter is
required rather than direct injection of the existing exported object.

### Rolling 24-hour and 30-day usage

One bounded query can fetch accepted times for the 30-day window:

```text
{
  quotaOwnerType: "employer",
  quotaOwnerId,
  planCode: "free_beta",
  quotaCharged: true,
  acceptedAt: { $gt: now - 30 days, $lte: now }
}
```

It sorts `acceptedAt:1`, selects only `acceptedAt`, uses the supplied session,
and feeds the accepted pure calculator. Submission state is intentionally not a
filter: a transaction-accepted charged submission remains charged if later
rejected, withdrawn, expired, or superseded. Exempt corrections are excluded
by `quotaCharged:false`.

The exact 24-hour subset is derived from those times with the accepted
exclusive lower boundary. The current transaction's not-yet-created submission
is not in the read; the service adds one to its post-acceptance snapshot when
charged.

### Simultaneously active Free Beta Jobs

The safe aggregation source is:

1. Match exact `employerId`, canonical
   `publicationMigrationStatus` eligible for runtime, `publicationState:active`,
   and valid visibility (`publishedAt <= now`, `visibleUntil > now`).
2. `$lookup` the Job's `lastApprovedSubmissionId` by immutable submission
   `_id`.
3. Require exactly one joined submission with `planCode:free_beta` and
   `state:approved`.
4. Count the rows.

This excludes paid Jobs without reading legacy `planType`. Closed, expired,
pending, rejected, unclassified, and visibility-ended Jobs do not count. The
current canonical projection is sufficient; a Job-level plan code would
duplicate weaker mutable evidence.

The active-major-edit Job is still active when usage is read. The service
explicitly subtracts one only in its projected after-state when the same
transaction will commit the active-to-pending CAS. On quota/CAS/other failure,
the transaction aborts and the slot remains. Pending submissions acquire no
slot.

All three usage reads must use the guard's transaction session and snapshot.
No independent session, `Promise.all` operation outside that session, or
post-read non-transactional write is permitted.

## 16. Reviewer-correction persistence

`getCorrectionContext` must, in one session:

- load the exact predecessor by `_id` and `jobId`;
- ensure it is accessible through the current owned Job/canonical predecessor
  relationship, rather than merely an arbitrary old submission for that Job;
- select state, Job ID, moderation cycle, review/accepted times, immutable
  content snapshot, and predecessor identity;
- query the cycle for any prior correction with
  `quotaCharged:false`;
- treat malformed or missing persisted evidence as non-exempt.

`getLatestForSubmission` must select the deterministic latest event with its
action, submission ID, requested fields, creation time, and strict cycle
metadata.

The accepted evaluator then guarantees:

- missing submission/event cycle is
  `MODERATION_CYCLE_MISSING`, `quotaCharged:true`;
- unequal valid cycles are
  `MODERATION_CYCLE_MISMATCH`, `quotaCharged:true`;
- valid same-cycle evidence is exempt only if every other correction condition
  passes;
- structurally invalid/missing/cross-job/non-immediate evidence is fatal
  `CORRECTION_NOT_EXEMPT`;
- no client exemption flag or cycle selection is trusted.

The unique partial cycle index enforces at most one exempt correction per
cycle. Charged fallback still passes through rolling quota checks.

## 17. Application-destination ownership

Classification: **BLOCKING**

### Current sources

Job destination-related fields are:

- `applyType`: mutable Job enum, default `external`;
- `applicationLink`: mutable full external URL string;
- `applyEmail`: mutable application email string;
- `applicationInstructions`: mutable free text;
- `sourceUrl` and `sourceWebsite`: source/provenance strings that current public
  client behavior may use as a URL fallback;
- the internal Strideto Application route when `applyType` resolves to
  `internal`.

The employer create/update paths accept `applyLink`/`applicationLink` and
`applyEmail`, derive `applyType`, and do not prove destination ownership. The
employer update path can mutate these values on an existing Job. The admin
write path accepts application links and forces external mode when a link is
present. Client validation checks syntax only and is not authoritative.

The write-boundary projection correctly prevents translation and duplication
operations from copying canonical publication fields, but it intentionally
copies `applyType`, `applicationLink`, `applyEmail`, and
`applicationInstructions` as content fields. That is projection isolation, not
ownership proof.

### Immutable evidence gap

`JobPublicationSubmission.contentSnapshot` stores:

```text
applicationMode
applicationDomain
```

It does not store a safe exact destination, a normalized destination digest,
the URL origin/path policy, email mailbox evidence, an internal route
identifier, ownership method/status, verified employer-domain evidence, or the
`sourceUrl` fallback. A domain alone cannot distinguish:

- employer-controlled paths from an attacker-controlled tenant/path on a
  shared ATS;
- an owned mailbox from another address at the same domain;
- a reviewed URL from a later path/query redirect;
- an external URL from a public-client `sourceUrl` fallback;
- conflicting simultaneous URL and email destinations.

`applicationMode` and `applicationDomain` are core-vacancy correction fields,
so a domain change is charged, but a same-domain destination change can escape
that comparison. Active major edits can also change current destination fields
through the legacy update route before transactional acceptance.

### Required resolution

Before adapter implementation, a separate accepted contract must define:

- fail-closed internal versus external consistency;
- allowed HTTP(S) URL syntax, credential/query/fragment handling, and
  local/private/reserved-host rejection;
- exact safe immutable evidence for URL, email, internal route, and any
  approved ATS tenant;
- employer website/email ownership evidence and whether partial evidence
  requires manual review or rejection;
- treatment of `sourceUrl` for employer-owned Free Beta Jobs;
- moderator comparison of the current Job destination to immutable submission
  evidence;
- correction/major-edit comparison for same-domain path, mailbox, mode, and
  ownership changes;
- a safe error contract that does not expose verification evidence.

Rejecting every external destination in an adapter would avoid redirect risk
but would not implement the accepted/current employer feature set and has not
been approved as product policy. Inferring ownership from a client URL or
Employer.website string is prohibited.

## 18. Typed outbox compatibility

The accepted repository is directly injectable:

```text
notificationOutbox =
  createMongoosePublishingOutboxRepository({ model, clock })

notificationOutbox.enqueueMany(intents, { session })
```

Compatibility findings:

- exact method and two-argument shape match;
- the supplied session must be active and not ended;
- the entire batch is mapped/validated before persistence;
- one ordered `Model.create(documents,{session,ordered:true})` model API call is
  made;
- the repository creates no session and no nested transaction;
- duplicate keys map to safe `OUTBOX_DEDUPLICATION_CONFLICT`;
- Mongoose validation/cast/strict errors map to a safe contract error;
- other errors are rethrown unchanged so transaction labels survive;
- no direct delivery, recipient address, SMTP operation, existing
  `BackgroundJob`, `Notification`, or `UserNotification` is involved.

No wrapper and no transaction-service modification are required for ordinary
enqueue compatibility. Runtime import, live index rollout, worker/recipient
resolution, and delivery are not required or permitted now.

## 19. Idempotency and replay

Scope is:

```text
quotaOwnerType + quotaOwnerId + idempotencyKey
```

The fingerprint covers stable submission intent: Job ID, expected publication
version, submission kind, correction predecessor/null, policy version, rules
version, and content hash.

Required replay lookup:

```text
findOne({
  quotaOwnerType,
  quotaOwnerId,
  idempotencyKey
}).session(session).lean()
```

Outcomes:

- no row: continue the logical transaction;
- complete row and identical fingerprint: return its stable accepted result
  without acknowledgement, submission, event, Job CAS, quota charge, or outbox
  writes;
- complete row and different fingerprint:
  `IDEMPOTENCY_KEY_REUSED`;
- corrupt/incomplete row: internal
  `IDEMPOTENCY_RECORD_INCOMPLETE`, never replay success.

Unique owner/key prevents duplicate submissions. Unique pending Job,
acknowledgement link, exempt cycle, and outbox deduplication indexes reinforce
the composition. Event duplication relies primarily on transaction atomicity
and replay-before-write rather than a unique submitted-event index.

Pre-acceptance rejections create no submission row and therefore do not reserve
the idempotency key. Quota is derived from committed immutable submissions, so
an aborted or replayed request does not double-charge.

## 20. Unknown transaction commit outcome

Classification: **BLOCKING** and
**REQUIRED_IN_DORMANT_ADAPTER COMPOSITION**.

After the driver's own bounded commit retries are exhausted with
`UnknownTransactionCommitResult`, the safe sequence is:

1. Do not begin a new logical submission transaction.
2. Open a fresh read-only resolution session/context.
3. Look up the submission by internally resolved owner and idempotency key.
4. Verify the stored request fingerprint against the intended fingerprint.
5. Verify the Job canonical state/link/version expected from the committed
   transaction.
6. Verify the exact submitted moderation event.
7. Verify both exact outbox deduplication keys.
8. Verify the acknowledgement linked to the submission.
9. Return the stable committed result only if all evidence is complete and
   mutually consistent.
10. Treat no submission/no related records as aborted only when the topology
    read is authoritative after the commit uncertainty; otherwise return an
    internal indeterminate outcome for operator reconciliation.

The current `run(work)` call does not supply owner, key, intended fingerprint,
expected version/link, or expected related-record identities. Its callback
result supplies only selected submission response fields. Reconstructing intent
from a possibly committed row is not an independent fingerprint check.
Implicit cross-dependency state, global mutable context, or log scraping would
be unsafe.

The accepted service/composition contract therefore needs a separately
approved resolution context/callback. Raw Mongo errors, labels, topology, and
record contents must remain internal; callers receive only an existing safe
domain error/result.

## 21. Error mapping

These are adapter-internal outcomes. No new public API contract is authorized.
The accepted service preserves its own
`PublishingSubmissionDomainError` instances and maps every unexpected
dependency failure to `TRANSACTION_FAILED`.

| Condition                                 | Safe internal/domain outcome                                                            | Abort / retry                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Job not found                             | `JOB_NOT_FOUND`                                                                         | Abort; no retry without client change.                 |
| Ownership mismatch                        | `JOB_NOT_OWNED`                                                                         | Abort; do not expose owner data.                       |
| Publication version conflict              | `JOB_VERSION_CONFLICT`                                                                  | Abort; client must reload.                             |
| Invalid canonical state                   | `JOB_STATE_NOT_SUBMITTABLE` or `SUBMISSION_ALREADY_PENDING`                             | Abort.                                                 |
| Legacy Job not initialized                | `JOB_CANONICAL_STATE_NOT_INITIALIZED` internally; public mapping requires authorization | Abort; never infer legacy truth.                       |
| Duplicate owner/key, same complete intent | Idempotent replay after authoritative lookup                                            | No new transaction/writes.                             |
| Idempotency fingerprint conflict          | `IDEMPOTENCY_KEY_REUSED`                                                                | Abort.                                                 |
| Incomplete idempotency row                | `IDEMPOTENCY_RECORD_INCOMPLETE` internally                                              | Abort and reconcile.                                   |
| Quota exceeded                            | Existing `ROLLING_24H_LIMIT` / `ROLLING_30D_LIMIT`                                      | Abort; retry only after safe reported time.            |
| Guard write conflict                      | `QUOTA_GUARD_CONTENTION` internally                                                     | Retry only while driver label/policy permits.          |
| Acknowledgement duplicate                 | `POSTING_RULES_ACKNOWLEDGEMENT_CONFLICT` internally                                     | Abort; unknown-commit/idempotency reconciliation only. |
| Submission validation/cast/strict failure | `SUBMISSION_PERSISTENCE_INVALID` internally                                             | Abort; no blind retry.                                 |
| Moderation-event duplicate/conflict       | `MODERATION_EVENT_CONFLICT` internally                                                  | Abort; reconcile logical request.                      |
| Outbox duplicate                          | Existing `OUTBOX_DEDUPLICATION_CONFLICT`                                                | Abort; reconcile logical request.                      |
| Other validation/cast error               | `PERSISTENCE_CONTRACT_INVALID` internally                                               | Abort.                                                 |
| Transient labeled transaction error       | Preserve raw label internally                                                           | Bounded driver/application retry; no public raw error. |
| Unknown commit result                     | `TRANSACTION_COMMIT_INDETERMINATE` internally until full reconciliation                 | Never start a new logical transaction blindly.         |
| Selection/connection timeout              | `PERSISTENCE_UNAVAILABLE` internally                                                    | Abort; bounded infrastructure retry only.              |

Never return or log stack traces, raw Mongo/Mongoose errors, query filters,
documents, another employer ID, full idempotency key, snapshot content,
verification evidence, staff notes, tokens, credentials, or connection strings.

## 22. Index and query plan

Index declaration does not prove live existence or health. No index was created
or synchronized during this audit.

| Query/invariant                                | Existing declaration                                                               | Assessment                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Job submit CAS by `_id`, owner, state, version | Default unique `_id`; existing `{employerId,status}` is legacy                     | `_id` makes the point CAS correct. A secondary CAS index is not required.                                             |
| Canonical active owner scan                    | No `{employerId,publicationState,visibleUntil,lastApprovedSubmissionId}` index     | Missing; required for controlled performance before runtime at production scale, not for dormant stub tests.          |
| Submission owner/key replay                    | Unique `{quotaOwnerType,quotaOwnerId,idempotencyKey}`                              | Correctness-ready; live uniqueness must be verified before runtime.                                                   |
| Charged rolling window                         | `{quotaOwnerType,quotaOwnerId,planCode,acceptedAt:-1}` lacks `quotaCharged`        | Correct query source exists; a compound index including `quotaCharged` should be explain-tested before runtime.       |
| Active plan join                               | Submission `_id` plus Job `lastApprovedSubmissionId`; no Job active compound index | Join correctness is expressible. Owner/state/visibility Job index is missing.                                         |
| Acknowledgement one per submission             | Unique `{submissionId}`                                                            | Correctness-ready; live rollout gated.                                                                                |
| Moderation history/latest                      | `{submissionId,createdAt}`                                                         | Supports prefix/time scan; `_id` tie-breaker and optional unique submitted-event hardening are pre-runtime decisions. |
| One pending submission per Job                 | Unique partial `{jobId}` for pending state                                         | Correctness-ready; live duplicates must be audited before index application.                                          |
| One exempt correction per cycle                | Unique partial `{moderationCycleId}` for correction and `quotaCharged:false`       | Correctness-ready; live rollout gated.                                                                                |
| Quota guard                                    | Unique `_id` plus unique `{ownerType,ownerId}`                                     | Correctness-ready; contention needs replica-set proof.                                                                |
| Outbox deduplication                           | Unique `{deduplicationKey}`                                                        | Exact unknown-commit key verification; model has `autoIndex:false` and `autoCreate:false`.                            |
| Outbox submission/aggregate history            | `{submissionId,createdAt}` and `{aggregateType,aggregateId,createdAt:-1}`          | Supports reconciliation.                                                                                              |

Most older H2A/H2B models use default Mongoose automatic index conventions.
Importing them into a module that later becomes reachable from startup can
therefore have operational significance. A dormant adapter must have no
startup path; controlled index preflight/application must precede any runtime
import. The outbox model is explicitly safer at import with
`autoIndex:false, autoCreate:false`.

## 23. Security and privacy

Future adapters must persist only the strict accepted documents. They must not
persist or expose:

- Employer passwords or verification documents;
- auth/access/refresh tokens, cookies, authorization headers, or request
  objects;
- raw IP addresses or user agents;
- applicant data or resumes;
- payment credentials or webhook data;
- staff-internal moderation text in employer-safe outputs;
- raw external recipient addresses in outbox intents;
- raw Mongo errors, stack traces, server selections, hosts, or URIs.

Safe operational logging is limited to bounded event category, stable safe
code, model/repository operation name, retry label category, attempt count, and
hashed/truncated correlation identifiers. Owner/Job/submission IDs should be
logged only under the repository's existing approved identifier policy;
idempotency keys and destination values must never be logged. Hashing a low
entropy value is not sufficient anonymization.

The destination blocker must not be “resolved” by copying raw URLs containing
credentials, query secrets, fragments, or unreviewed mailbox data into a new
unrestricted field.

## 24. Dormancy design

A future foundation remains dormant only when all of the following hold:

- no import from `index.js`, routes, controllers, middleware, workers,
  schedulers, webhooks, public-query modules, payment modules, or current queue
  processors;
- no modification/import in the accepted transaction service merely to make
  file existence active;
- no environment flag or startup branch;
- no model query, session, timer, listener, connection, index synchronization,
  or collection creation at module scope;
- repositories create no independent session and receive all model/connection
  dependencies through explicit factories where practical;
- model registration alone performs no query; tests import modules while
  disconnected and use strict fakes;
- no public Job projection, frontend, notification, SMTP, or delivery behavior
  changes.

Dormant repository imports are safe only while the repository itself is
unreachable from production startup. Before runtime wiring, default-index
models require an explicit operational review; the outbox model already
disables automatic collection/index creation.

## 25. Exact proposed implementation scope

No Mongoose adapter implementation allowlist is safe yet. The three blocking
contracts require a separately authorized audit/correction phase before exact
adapter files can be approved.

### CREATE

```text
None authorized for adapter implementation.
```

The next safe phase is a read-only contract audit whose sole proposed output
is:

```text
docs/FREE_BETA_SUBMISSION_ADAPTER_BLOCKER_CONTRACT_AUDIT.md
```

It must specify the active-major-edit candidate boundary, immutable
application-destination evidence/ownership policy, and explicit unknown-commit
resolution context before proposing code changes.

### MODIFY

```text
None authorized.
```

The blocker audit must determine whether later corrections require changes to
the accepted transaction service, submission snapshot schema, moderation
requestable fields, correction comparison, or Job write/cutover boundary. This
re-audit does not pre-authorize those changes.

### INSPECT_ONLY

```text
server/src/config/db.js
server/src/config/freeBetaPublishingPolicy.js
server/src/models/Employer.js
server/src/models/Job.js
server/src/models/JobPublicationSubmission.js
server/src/models/EmployerPostingRulesAcknowledgement.js
server/src/models/JobModerationEvent.js
server/src/models/EmployerPublishingQuotaGuard.js
server/src/models/PublishingOutboxIntent.js
server/src/services/jobWriteBoundary.js
server/src/services/publishing/TransactionalFreeBetaSubmissionService.js
server/src/services/publishing/EmployerSubmissionEligibility.js
server/src/services/publishing/ReviewerCorrectionEligibility.js
server/src/services/publishing/PublishingQuotaUsageService.js
server/src/services/publishing/QuotaOwnerResolver.js
server/src/services/publishing/SerializedQuotaGuard.js
server/src/services/publishing/outbox/PublishingOutboxContracts.js
server/src/services/publishing/outbox/MongoosePublishingOutboxRepository.js
server/src/controllers/employerController.js
server/src/controllers/admin/adminJobsController.js
client/src/pages/Jobs/JobDetail.jsx
```

### FORBIDDEN

```text
server/src/controllers/**
server/src/routes/**
server/src/middleware/**
server/src/index.js
server/src/worker.js
server/src/scheduler/**
server/src/services/payment*
server/src/services/jobQueueService.js
server/src/models/BackgroundJob.js
server/src/models/Notification.js
server/src/models/UserNotification.js
client/**
package.json
server/package.json
server/package-lock.json
render.yaml
.env*
docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md
```

After those blockers are corrected and accepted, the dormant adapter should
contain small modules for:

- a publishing transaction runner plus explicit unknown-commit resolver;
- Employer read repository;
- canonical Job lookup/CAS repository;
- publication-submission replay/correction/create repository;
- posting-rules acknowledgement repository;
- moderation-event repository;
- session-aware quota usage repository;
- strict content/destination snapshot and fingerprint builders;
- posting-rules registry, ID factory, and system clock;
- an adapter composition factory that directly injects the accepted outbox and
  quota guard;
- focused database-free tests and one implementation report.

That conditional component list is architectural guidance, not authorization
to create files.

## 26. Test plan

Database-free tests for an eventually authorized correction/adapter must prove:

- every exact accepted dependency name, method, argument, and return shape;
- the same session object reaches every read/write collaborator;
- no repository creates an independent session or nested transaction;
- Job lookup fails closed for absent/manual/invalid canonical initialization;
- exact owner/state/version/migration CAS predicate and exact pending update;
- CAS mismatch, ownership mismatch, invalid state, and version conflict mapping;
- active major-edit candidate is in memory, never pre-saved, and failed
  acceptance preserves the old active content;
- successful major-edit transition is hidden at the same commit;
- acknowledgement strict create, append-only behavior, and replay reuse;
- submission strict create, owner/key replay, same/different fingerprint, and
  corrupt record handling;
- deterministic latest moderation event and append behavior;
- quota guard requires the transaction and does not create another one;
- rolling query includes only committed charged `free_beta` evidence;
- active aggregation uses canonical state/visibility plus immutable approved
  Free Beta plan evidence and excludes paid/legacy/unclassified rows;
- missing/mismatched correction cycle is charged fallback, valid same-cycle
  correction is exempt, and structural invalidity is fatal;
- internal, email, URL, ATS, conflicting, malformed, private/local, same-domain
  path-change, and `sourceUrl` fallback destination cases follow the approved
  ownership/evidence policy;
- accepted outbox repository is directly injected and gets the same session;
- callback retry produces no external side effect;
- transaction labels survive until retry/reconciliation decisions finish;
- unknown commit verifies owner/key, fingerprint, Job, event,
  acknowledgement, and both outbox keys;
- raw private/security values never enter documents, errors, or logs;
- repository modules remain absent from startup/runtime import graphs.

A separately authorized disposable MongoDB replica set is required to prove:

- real commit/rollback across all collections;
- snapshot visibility and same-session reads;
- unique-index races;
- guard/write-conflict serialization;
- concurrent rolling quota submissions;
- Job CAS contention;
- transient callback retries;
- terminal/induced unknown-commit reconciliation;
- outbox and acknowledgement duplicate behavior.

No disposable or production database was contacted in this audit.

## 27. Remaining runtime blockers

Even after the three adapter-contract blockers are corrected, runtime remains
blocked by:

1. transaction-capable disposable and deployed topology proof;
2. controlled live index inventory, duplicate preflight, and rollout;
3. explicit native Job initialization and legacy classification/backfill;
4. candidate-edit write boundary and disabling legacy active in-place edits;
5. canonical public-query, detail, search, sitemap, dashboard, and visibility
   cutover;
6. canonical approval/capacity/moderation and expiry services;
7. destination review/ownership operations;
8. production idempotency/unknown-outcome observability and reconciliation;
9. outbox recipient resolution, worker lease/retry, delivery provider unknown
   outcome, and retention contracts;
10. route/controller authorization, rate limits, response/error contract, and
    frontend workflow acceptance.

## 28. Readiness and next safe phase

| Gate                         | Decision                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Dormant adapter foundation   | `NOT READY`                                                                       |
| Disposable replica-set proof | `NOT READY`; adapter/correction and isolated harness authorization required first |
| Production runtime wiring    | `NOT READY`                                                                       |
| Public route activation      | `NOT READY`                                                                       |
| Worker/delivery activation   | `NOT READY`                                                                       |

Next safe phase:

```text
E.1F-H2B-B3-B — Submission Adapter Blocker Contract Audit
```

It should be read-only and limited to the active-major-edit candidate command,
application-destination ownership/evidence, and terminal unknown-commit
resolution interface. It must not implement the adapter, wire runtime, or
connect to a database.

## 29. Preservation statement

- Application code changed: No.
- Existing models changed: No.
- H2A/H2B-A changed: No.
- Canonical Job schema changed: No.
- Transaction service changed: No.
- Outbox foundation changed: No.
- `BackgroundJob` changed: No.
- Notification models changed: No.
- Controllers/routes changed: No.
- Workers/schedulers/startup changed: No.
- Notification/SMTP behavior changed: No.
- Public queries changed: No.
- Payment/webhook changed: No.
- Frontend/theme/responsiveness changed: No.
- Authentication/RBAC weakened: No.
- Security/privacy weakened: No.
- Configuration/dependencies changed: No.
- Production data read/written: No.
- Database connection performed: No.
- Migration/index operation performed: No.
- Files staged: No.
- Commit performed: No.
- Push performed: No.
- Deployment performed: No.
- Adapter implementation started: No.
- Runtime outbox wiring started: No.
- Production acceptance report touched: No.

**STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED**
