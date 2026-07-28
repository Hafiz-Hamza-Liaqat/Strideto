# Free Beta Mongoose Submission Adapter Audit

## 1. Executive verdict

**NOT READY**

The accepted H2A ledger/guard foundations and H2B-A provider-neutral transaction
core remain dormant and internally consistent, but a complete safe Mongoose
adapter cannot be authorized yet:

1. `Job` does not contain the canonical publication projection or optimistic
   `publicationVersion` required by `getOwnedJobForSubmission` and
   `compareAndSetPendingReview`.
2. Existing public and employer job paths still use the legacy `status` and
   `approvalStatus` fields. Those fields are not safe aliases for the approved
   publication-state contract.
3. active Free Beta usage cannot be derived because `Job` has neither
   `publicationState` nor `lastApprovedSubmissionId`.
4. the durable `BackgroundJob` queue is not a compatible transaction-bound,
   typed publishing notification outbox.
5. repository documentation prescribes MongoDB Atlas M10+, but the configured
   connection is an opaque `MONGO_URI`, permits a standalone localhost fallback,
   and performs no transaction-capability/topology check. Actual production
   transaction support is therefore not established by code or checked
   repository evidence.
6. the required canonical Job indexes are absent, and declared dormant-model
   indexes have not been verified or applied to a live database.

These are prerequisite schema, outbox, deployment-verification, and controlled
cutover concerns. Implementing only repository wrappers would create the
appearance of readiness without satisfying the accepted fail-closed contract.

## 2. Repository state

- HEAD: `8b57b5e568b0806416baad527764d553f592277c`
  (`feat: add dormant transactional free beta submission core`).
- Branch: `main`.
- Upstream state: `main...origin/main [ahead 3]`.
- The preceding accepted commits are `eb1f961` and `f86f1be`.
- No merge, rebase, cherry-pick, revert, or conflict operation was active.
- No tracked file was modified and no file was staged at audit start.
- The only pre-existing untracked file was
  `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`; it was not read, modified,
  staged, or committed by this audit.
- This audit creates only
  `docs/FREE_BETA_MONGOOSE_SUBMISSION_ADAPTER_AUDIT.md`.

## 3. Existing Mongoose architecture

- `server/src/config/db.js` owns the single default Mongoose connection and calls
  `mongoose.connect(MONGO_URI, poolOptions)`.
- The connection does not select a separate database name, configure a replica
  set, assert transaction capability, or create a publishing-specific
  connection.
- The fallback URI targets a local standalone-style MongoDB address. It is
  acceptable for existing non-transactional development behavior but is not
  evidence of transaction support.
- `docs/DEPLOYMENT_GUIDE.md` prescribes MongoDB Atlas M10+ for production, and
  `render.yaml` injects `MONGO_URI` into the API and worker. The actual URI and
  topology are intentionally unavailable. Other repository deployment reports
  describe the live Mongo connection/cluster as unverified.
- No database connection was opened during this audit.

### Current transaction, repository, error, and test conventions

- The only production Mongoose session/transaction helper found is the dormant
  H2A `SerializedQuotaGuard.run`, which uses `connection.startSession()`,
  `session.withTransaction()`, and `session.endSession()`.
- `SerializedQuotaGuard.acquire` correctly requires an active transaction and
  performs the owner-scoped guard write with the supplied session.
- Existing career repositories are thin objects around Mongoose queries. They
  commonly return lean reads but do not accept or propagate sessions and do not
  translate database errors into publishing-domain errors.
- Existing runtime services mostly call models directly. Known HTTP/domain
  errors are generally created above the repository layer; unexpected errors
  are handled by existing safe middleware. The H2B-A service specifically
  preserves `PublishingSubmissionDomainError` and maps all other failures to
  `TRANSACTION_FAILED`.
- H2A/H2B-A focused tests use pure calculations, model validation, stubbed
  models, session fakes, and an injected transactional in-memory harness. They
  do not prove a live MongoDB transaction.
- A separate employer portal integration test can use an explicitly supplied
  test database and drops that test database. It was not run here and must not
  be reused without an isolated, disposable target.

## 4. Dependency compatibility matrix

The service factory actually requires the thirteen dependencies listed in the
phase request plus `idFactory`, which is also mandatory in the accepted source.

| Dependency                  | Required contract                                                                                                                         | Session and side effects                                                                               | Existing status                                                                                              | Adapter decision                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `transactionRunner`         | `run(work)` invokes `work({ session })` and returns only after commit                                                                     | Opens/commits/aborts a Mongo session; no external effects                                              | `SerializedQuotaGuard.run` exists, but its owner-first signature and built-in guard acquisition do not match | New runner required                                                 |
| `employerRepository`        | `getById({ employerId, session })` → employer projection or `null`                                                                        | Every query uses the supplied session; database read only                                              | No matching repository                                                                                       | New adapter required                                                |
| `jobRepository`             | `getOwnedJobForSubmission(...)` → owned job or privacy-safe `{found, owned, job}`; `compareAndSetPendingReview(...)` → `{matched, code?}` | Same session; read plus one atomic CAS write                                                           | No matching repository; schema is incompatible                                                               | **Blocked; do not create yet**                                      |
| `submissionRepository`      | `findByOwnerAndIdempotencyKey(...)`, `getCorrectionContext(...)`, `create(record,{session})`                                              | Same session for all reads/writes                                                                      | Compatible model exists; no repository                                                                       | New adapter required after prerequisites                            |
| `acknowledgementRepository` | `create(record,{session})` → created acknowledgement                                                                                      | Transactional create only                                                                              | Compatible append-only model exists                                                                          | New adapter required                                                |
| `moderationEventRepository` | `getLatestForSubmission(...)`; `append(record,{session})`                                                                                 | Transactional read/append only                                                                         | Compatible append-only model exists                                                                          | New adapter required                                                |
| `quotaUsageService`         | `getUsage(owner,{now,session})` → daily, rolling-30-day, and active-free usage                                                            | All reads must use the same session                                                                    | H2A service does not propagate `session`; active counting intentionally fails before canonical Job cutover   | New session-aware adapter required; active query blocked            |
| `serializedQuotaGuard`      | `acquire(owner,{session})` → acquired guard/owner                                                                                         | Required transaction-bound write; no external effect                                                   | Exact compatible H2A implementation exists                                                                   | Reuse `SerializedQuotaGuard.acquire`; no separate repository needed |
| `notificationOutbox`        | `enqueueMany(intents,{session})` → persisted deduplicated intents                                                                         | Database writes only; must never send inside transaction                                               | Existing queue is incompatible                                                                               | Separate outbox foundation required                                 |
| `postingRulesRegistry`      | `getCurrent({session})` → `{version,digest}` with a 64-hex digest                                                                         | Must be authoritative and side-effect-free; no database is required for a static registry              | No current registry/rules record                                                                             | New dormant registry required                                       |
| `contentSnapshotBuilder`    | `build({job,submissionKind,session})` → strict allow-listed snapshot plus `contentHash`                                                   | Pure over trusted persisted data unless an explicitly documented validation read uses the same session | No implementation                                                                                            | New builder required; destination-ownership gap must be resolved    |
| `requestFingerprintBuilder` | `build(stableIntent)` → lowercase 64-hex digest                                                                                           | Pure; no external effect                                                                               | No implementation                                                                                            | New builder required                                                |
| `idFactory`                 | `next(kind)` → ObjectId-compatible identifier                                                                                             | Pure/local only; no database call                                                                      | No injected production implementation                                                                        | New adapter utility required                                        |
| `clock`                     | `now()` → valid server-controlled `Date`                                                                                                  | Local only; no client timestamp                                                                        | No injected production implementation                                                                        | New system-clock utility required                                   |

Expected dependency errors include safe domain outcomes for missing/ineligible
employers, missing/unowned/stale jobs, stale rules, idempotency conflicts,
correction structural failures, quota limits, and CAS conflicts. Model validation,
connection, timeout, and unclassified Mongo failures must remain suppressed
behind `TRANSACTION_FAILED`. No dependency may send email, call a webhook, invoke
payments, log an idempotency key, or expose another employer's identifier.

## 5. Model compatibility matrix

| Model                                 | Collection / ID                                          | Ownership and state                                                 | Version/timestamps/indexes                                                                                                | Strictness and repository protections                                                                                                     |
| ------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Employer`                            | `employers`; ObjectId                                    | Account identity is `_id`; eligibility fields exist                 | Mongoose `__v`; timestamps; unique email/slug and company-name index                                                      | Default strict mode; password is excluded by default. Repository must project only eligibility fields                                     |
| `Job`                                 | `jobs`; ObjectId                                         | `employerId`; legacy `status`, `approvalStatus`, `planType`         | Only Mongoose `__v`; timestamps; legacy status/owner/search indexes                                                       | Default strict mode. Owner is not immutable and no canonical publication CAS fields exist                                                 |
| `JobPublicationSubmission`            | `jobPublicationSubmissions`; ObjectId                    | `employerId`, quota owner, job, submission state                    | `jobRevision`; timestamps; owner/idempotency, owner/time, job/time, state/time, cycle, rules, and pending partial indexes | `strict: "throw"`; most acceptance fields immutable. Repository must allow create and controlled future moderation projection only        |
| `EmployerPostingRulesAcknowledgement` | `employerPostingRulesAcknowledgements`; ObjectId         | employer/job/submission references; `accepted=true`                 | explicit `createdAt`; unique submission and history indexes                                                               | `strict: "throw"`, immutable fields, update/delete query hooks. Repository must be create-only                                            |
| `JobModerationEvent`                  | `jobModerationEvents`; ObjectId                          | employer/job/submission and actor; allow-listed action/state fields | explicit `createdAt`; job, submission, employer, action history indexes                                                   | `strict: "throw"`, immutable fields, append-only hooks. Repository must append only and use the safe employer projection where applicable |
| `EmployerPublishingQuotaGuard`        | `employerPublishingQuotaGuards`; namespaced string `_id` | immutable owner type/ObjectId; integer revision                     | timestamps; unique owner pair                                                                                             | Default strict mode; H2A validation binds `_id` to owner. Existing acquire operation is transaction-compatible                            |

For session-bound creates, adapters must use Mongoose's array form
`Model.create([record], { session })` and return the first document. Query,
aggregate, and CAS operations must explicitly attach the same session. Merely
accepting a `session` argument without attaching it is a contract violation.

## 6. Exact Job schema gap analysis

| Required capability                                       | Classification                              | Evidence                                                                                                                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ObjectId job identifier                                   | `AVAILABLE`                                 | Existing `_id`                                                                                                                                                                                                                         |
| Employer owner field                                      | `AVAILABLE` with protection gap             | `employerId` exists, but is not immutable after first accepted submission                                                                                                                                                              |
| Canonical `publicationState`                              | `MISSING` / `REQUIRES_SCHEMA_PHASE`         | Legacy `status` has only `draft`, `active`, `closed` and is a migration input, not an alias                                                                                                                                            |
| `pending_review` state                                    | `LEGACY_CONFLICT` / `REQUIRES_SCHEMA_PHASE` | `approvalStatus: pending` does not encode public visibility or the approved six-state machine                                                                                                                                          |
| `publicationVersion`                                      | `MISSING` / `REQUIRES_SCHEMA_PHASE`         | Mongoose `__v` is not the accepted optimistic publication version and is not reliably advanced by query updates                                                                                                                        |
| Active Free Beta ownership                                | `MISSING` / `REQUIRES_SCHEMA_PHASE`         | `planType: free` is not `free_beta`; canonical ownership requires the approved submission referenced by `lastApprovedSubmissionId`                                                                                                     |
| `lastApprovedSubmissionId`                                | `MISSING` / `REQUIRES_SCHEMA_PHASE`         | No field                                                                                                                                                                                                                               |
| `currentSubmissionId`                                     | `MISSING` / `REQUIRES_SCHEMA_PHASE`         | No field                                                                                                                                                                                                                               |
| Moderation-cycle projection                               | `MISSING`                                   | Cycle exists on submission/event records, not Job; it can be queried there but cannot be invented as a Job field                                                                                                                       |
| Active-slot release                                       | `REQUIRES_SCHEMA_PHASE`                     | It must be derived atomically from canonical `active → pending_review`, which is unavailable                                                                                                                                           |
| `publishedAt`                                             | `MISSING` / `REQUIRES_SCHEMA_PHASE`         | No field                                                                                                                                                                                                                               |
| `visibleUntil`                                            | `LEGACY_CONFLICT` / `REQUIRES_SCHEMA_PHASE` | `expiresAt` is not the approved visibility term                                                                                                                                                                                        |
| `applicationsCloseAt`                                     | `LEGACY_CONFLICT` / `REQUIRES_SCHEMA_PHASE` | `deadline` alone does not encode `min(deadline, visibleUntil)`                                                                                                                                                                         |
| `closedAt`, `expiredAt`                                   | `MISSING` / `REQUIRES_SCHEMA_PHASE`         | No fields                                                                                                                                                                                                                              |
| `rejectionSummary`                                        | `MISSING` / `REQUIRES_SCHEMA_PHASE`         | `approvalStatus: rejected` has no safe decision projection                                                                                                                                                                             |
| Frozen slug / `slugFrozenAt`                              | `LEGACY_CONFLICT` / `REQUIRES_SCHEMA_PHASE` | `slug` exists, but no freeze timestamp or immutable-after-approval enforcement exists                                                                                                                                                  |
| Current `policyVersion`                                   | `MISSING` / `REQUIRES_SCHEMA_PHASE`         | No field                                                                                                                                                                                                                               |
| CAS query/index                                           | `MISSING` / `REQUIRES_SCHEMA_PHASE`         | No owner/state/publication-version/current-submission predicate or supporting canonical indexes                                                                                                                                        |
| Preserve approved public content during major-edit review | `MISSING`                                   | Job stores one mutable content version. The approved contract permits the first implementation to remove an active job from public reads during review, but legacy public queries prevent even that canonical transition until cutover |

`getOwnedJobForSubmission` can safely enforce `_id + employerId` only for a
legacy job. It cannot return the canonical state/version required by H2B-A.
`compareAndSetPendingReview` cannot be implemented by mapping to `status` or
`approvalStatus`: current public queries widely depend on `status: "active"` and
often `approvalStatus: "approved"`. Such a mapping would either leak an
unreviewed revision or change existing runtime behavior. A separate additive
schema, data-classification/migration, index, and public-query cutover plan is
required before authorizing the Job adapter.

## 7. Required transaction-runner design

The future runner should:

1. obtain a session from the existing default Mongoose connection;
2. call `session.withTransaction(async () => work({ session }), options)`;
3. return callback output only after a successful commit;
4. abort through `withTransaction` on every thrown error;
5. always `endSession()` in `finally`;
6. preserve `PublishingSubmissionDomainError` unchanged and never expose raw
   driver/Mongoose errors;
7. use primary reads and transaction-level write durability appropriate to the
   verified production topology (normally `readPreference: "primary"`,
   `readConcern: { level: "snapshot" }`, and majority write concern), confirmed
   by integration testing rather than assumed;
8. rely only on bounded driver retries for labeled transient transaction
   failures. The callback may be retried only because all writes, including
   outbox intents, remain inside the transaction and builders have no external
   effects;
9. resolve a terminal unknown commit outcome through the owner/idempotency-key
   record before initiating a new logical write. The runner alone lacks those
   inputs, so the final composition needs an explicit resolution strategy and
   test; masking the outcome as success is forbidden.

The existing `SerializedQuotaGuard.run` is not this adapter: it requires the
owner before entering the callback and acquires the guard before the H2B-A
service has loaded the employer and resolved the owner. Its `acquire` method,
however, is directly reusable inside the future runner.

## 8. Repository adapter design

### Employer repository

Use a session-bound, lean `_id` lookup with this exact projection:

`_id companyName email website companyDescription industry location city
province verified accountStatus verificationLevel`.

Do not select password, phone, social links, verification evidence, staff notes,
tokens, or unrelated account data. Invalid/nonexistent IDs return `null`, which
the service maps to `EMPLOYER_NOT_FOUND`. The repository must not invent
`emailVerified`; the current schema has no such field.

### Submission repository

- Owner/idempotency lookup: exact
  `{quotaOwnerType, quotaOwnerId, idempotencyKey}` with the session.
- Correction context: load the requested predecessor constrained by `jobId`;
  independently prove it is the immediately preceding job submission using
  `{jobId, acceptedAt, _id}` ordering; then load same-cycle submissions using
  the cycle index. Do not return a predecessor from another job or employer.
- Create: array-form transactional create of the server-built immutable record.
- A duplicate owner/key race cannot be treated as a generic validation failure.
  After transaction abort/retry, query the unique owner/key and compare the
  stored fingerprint: same fingerprint is a replay; different fingerprint is
  `IDEMPOTENCY_KEY_REUSED`. The owner guard should serialize ordinary races, but
  the unique index remains the final invariant.

### Acknowledgement repository

Perform one array-form create with the supplied session. Do not expose update or
delete methods. `acceptedAt`/`createdAt` come from the service clock, never the
client. Omit optional network hashes unless a later server-controlled boundary
provides already hashed, policy-approved values.

### Moderation-event repository

`getLatestForSubmission` uses `submissionId`, `createdAt: -1`, and the same
session. `append` performs one array-form create with no update/delete surface.
Internal reason text must never be returned through an employer repository
projection; use `toEmployerSafeModerationEvent` for future owner reads.

### Quota guard

Reuse `SerializedQuotaGuard.acquire`. It already validates an active transaction,
normalizes the trusted owner, and performs a session-bound revision increment
with upsert. A duplicate Mongoose guard repository would weaken the single
serialization boundary.

### Quota usage

One session-bound submission query may load charged accepted timestamps for:

```text
quotaOwnerType = resolved owner type
quotaOwnerId   = resolved owner ID
planCode       = free_beta
quotaCharged   = true
acceptedAt     > now - 30 days
acceptedAt     <= now
```

The 24-hour subset uses `acceptedAt > now - 24 hours`; the exact boundary is
excluded and `now` is included. Counts are permanent once accepted, regardless
of later moderation state. The existing pure H2A calculator can consume these
timestamps, but `getPublishingQuotaUsage` itself is not session-aware.

Active usage must count only canonical Jobs with
`publicationState: "active"` whose `lastApprovedSubmissionId` resolves to an
approved `free_beta` submission. The aggregation must use the same session.
This query is blocked by the current Job schema.

Prior exempt correction detection uses
`moderationCycleId + submissionKind: "correction" + quotaCharged: false`.
Immediate-predecessor verification also requires the job submission history,
not merely a client-provided predecessor ID.

## 9. Notification outbox compatibility

Classification: **EXISTING_BUT_INCOMPATIBLE**.

`BackgroundJob` is durable, has a unique sparse `dedupKey`, and has a worker.
It is not the accepted publishing outbox because:

- `enqueueJob` neither accepts nor attaches a transaction session;
- its check-then-create dedup path is outside the submission transaction;
- `payload` is unrestricted `Mixed`;
- its type enum does not model the two publishing intents;
- the worker cannot safely expand `admin_job_review_requested` to staff from the
  accepted intent shape;
- its notification execution writes/sends after queue selection but has no
  publishing-specific typed privacy contract;
- existing queue processing is not an append-only transactional intent model.

A no-op can remain inside future unit tests, but a no-op production dependency
cannot satisfy a "complete Mongoose adapter" and would silently discard required
notifications. Direct notification/email calls are forbidden. A separate
dormant typed outbox foundation, with unique deduplication and a later
independently authorized worker, is required before H2B-B can be accepted.

## 10. Posting-rules registry requirements

- `policyVersion` comes only from `FREE_BETA_POLICY_VERSION`.
- The client may submit only explicit `accepted: true` and a claimed version.
- `rulesVersion` and the SHA-256 `rulesDigest` must come from one authoritative
  server registry containing the exact approved rules content/version. No such
  registry currently exists.
- `acceptedAt` is supplied by the server clock inside the transaction.
- Raw IP addresses, user agents, request objects, headers, cookies, credentials,
  and authorization values must never enter a repository record.
- The current command contract has no network-evidence input. Optional
  `sourceIpHash` and `userAgentHash` should therefore be omitted in H2B-B.
- If a later policy explicitly requires hashes, Node's built-in `crypto`
  SHA-256 is sufficient; no dependency is needed. A server-held salt/HMAC policy
  and retention review would still be required because hashes are pseudonymous.

The safe dormant implementation needs a registry module with a fixed current
version and digest plus tests proving stale/unknown versions cannot select an
arbitrary digest.

## 11. Snapshot and fingerprint requirements

The canonical snapshot allowlist is:

```text
title, companyName, description, requirements, responsibilities,
skillsRequired, salaryRange, salaryCurrency, location, province, city,
category, employmentType, jobType, educationRequirement, experience,
applicationMode, applicationDomain, workMode, deadline, totalSeats
```

Required deterministic construction:

- read only trusted persisted Job fields using the owned job loaded in the
  transaction;
- map legacy storage names explicitly (`company` → `companyName`, `type` →
  `employmentType`, `applyType` → `applicationMode`) and fail on ambiguous
  combinations such as simultaneous remote and hybrid flags;
- trim strings consistently; normalize omitted scalars to `null` and omitted
  arrays to `[]`;
- trim array string elements, preserve their order, and do not silently accept
  objects or unapproved keys;
- encode dates as valid UTC ISO instants for hashing and retain valid Dates for
  persistence;
- derive only the normalized hostname/email domain for the application
  destination; never retain credentials, paths, query strings, raw URLs, or
  applicant data in `applicationDomain`;
- serialize a fixed-key-order canonical object and compute lowercase SHA-256
  with Node's built-in `crypto`;
- compute the request fingerprint from exactly job ID, expected publication
  version, submission kind, correction predecessor or null, policy version,
  rules version, and content hash.

The evaluator already compares arrays in order, maps `undefined` to `null`,
normalizes Dates to ISO, trims strings, and sorts nested object keys. Builders
must produce values compatible with those semantics.

No existing boundary proves that an external URL/email domain is controlled by
the employer. Parsing a domain is not ownership validation. Because the builder
currently receives the Job but not the already loaded Employer, destination
ownership must be designed explicitly (for example, a session-bound trusted
verification read) before runtime wiring. It must not be inferred from a
client-supplied URL. Snapshots must exclude employer email, phone, password,
verification evidence, staff notes, applicant data, tokens, and full application
destinations.

## 12. Error mapping

| Outcome                                   | Safe handling                                                                                                                                                   | Retry                                                | Logging restriction                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Owner/key duplicate                       | Resolve by owner/key after abort; same fingerprint replay, different fingerprint `IDEMPOTENCY_KEY_REUSED`                                                       | Only through serialized/idempotent transaction retry | Never log full key or document                                   |
| Other duplicate key                       | `TRANSACTION_FAILED`; treat as invariant/index failure                                                                                                          | No blind retry                                       | Log only safe operation/error class/index category               |
| Mongoose validation error                 | `TRANSACTION_FAILED` for server-built persistence data                                                                                                          | No                                                   | Suppress paths/values from client and redact logs                |
| Cast error for employer/job ID            | Return privacy-safe not-found or existing safe command error                                                                                                    | No                                                   | Do not reveal cast input                                         |
| CAS version/state mismatch                | Repository returns `{matched:false, code}`; service emits `JOB_VERSION_CONFLICT`, `JOB_STATE_NOT_SUBMITTABLE`, `SUBMISSION_ALREADY_PENDING`, or `JOB_NOT_OWNED` | Client obtains fresh state                           | No other owner ID or snapshot                                    |
| Document not found                        | Employer `null` → `EMPLOYER_NOT_FOUND`; job `{found:false}` → `JOB_NOT_FOUND`                                                                                   | No automatic retry                                   | No collection/database detail                                    |
| Ownership mismatch                        | `{found:true,owned:false}` or privacy-equivalent safe result → `JOB_NOT_OWNED`                                                                                  | No                                                   | Never return actual owner                                        |
| Transaction aborted by known domain error | Preserve the existing domain error                                                                                                                              | Driver must not retry non-transient business errors  | Stable code/message/details only                                 |
| Labeled transient transaction error       | Let `withTransaction` perform bounded driver retry                                                                                                              | Yes, while labeled/bounded                           | Labels and operation only; no payload                            |
| Unknown commit result                     | Retry commit as supported; then resolve owner/key before a new logical transaction                                                                              | Idempotency-aware only                               | Never claim success without resolution                           |
| Connection failure / timeout              | `TRANSACTION_FAILED`                                                                                                                                            | No uncontrolled application loop                     | No host, URI, database, credentials, or stack in client response |
| Unexpected adapter error                  | `TRANSACTION_FAILED`                                                                                                                                            | No blind retry                                       | Error class/code only in protected logs                          |

Client-safe errors contain only status, stable code, safe message, and bounded
safe details. Database/collection names, URIs, stack traces, other employer IDs,
snapshots, idempotency keys, tokens, cookies, and secrets remain suppressed.

## 13. Index analysis

| Query/invariant                    | Current coverage                                                                                | Classification                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------- |
| Owner + idempotency key            | Unique submission index exactly matches                                                         | `NOT_REQUIRED`                   |
| Rolling charged usage              | Owner + plan + accepted-time index supplies the range, but omits `quotaCharged`                 | `RECOMMENDED_BEFORE_SCALE`       |
| One exempt correction per cycle    | Unique partial cycle index plus cycle history index                                             | `NOT_REQUIRED`                   |
| Pending moderation queue           | Submission state + accepted-time index                                                          | `NOT_REQUIRED`                   |
| One pending submission per job     | Unique partial job index                                                                        | `NOT_REQUIRED`                   |
| Job/submission history             | Job/time and employer/time indexes                                                              | `NOT_REQUIRED`                   |
| Acknowledgement one-to-one/history | Unique submission and employer/rules history indexes                                            | `NOT_REQUIRED`                   |
| Moderation histories               | Job, submission, employer, and action time indexes                                              | `NOT_REQUIRED`                   |
| Serialized guard owner             | Namespaced `_id` plus unique owner pair                                                         | `NOT_REQUIRED`                   |
| Canonical Job CAS                  | Required fields and index do not exist                                                          | `BLOCKING_BEFORE_RUNTIME_WIRING` |
| Active Free Beta usage             | Canonical state/last-approved fields and `{employerId,publicationState,...}` index do not exist | `BLOCKING_BEFORE_RUNTIME_WIRING` |
| Visibility/expiry processing       | Canonical state/date fields and due indexes do not exist                                        | `BLOCKING_BEFORE_RUNTIME_WIRING` |

These are schema declarations only. Because the dormant models are not imported
by startup and this audit did not connect to MongoDB, live index existence is
unknown. A controlled pre-runtime index verification/application plan is
required; model declaration or automatic index creation must not be mistaken
for a completed production migration.

## 14. Dormancy and runtime isolation design

Future adapter files can remain dormant only when:

- nothing imports them from controllers, routes, `index.js`, `worker.js`,
  schedulers, middleware, webhooks, payments, public queries, or frontend code;
- there is no barrel file or automatic module discovery that imports them;
- all models, connection objects, and options are injected or imported without
  starting a session/query at module top level;
- factories perform no query until an explicitly composed service method is
  called;
- no environment feature flag or startup registration is added;
- tests use stubbed models/session spies or a separately authorized disposable
  replica-set database, never production data.

File existence and ordinary Mongoose model definition do not themselves execute
a query. Runtime activation would require an explicit composition import and
method call. That composition is outside H2B-B.

## 15. Proposed exact H2B-B allowlist

The following is a **deferred proposal, not current authorization**. It becomes
eligible only after separate canonical Job/outbox foundations and transaction
topology verification are accepted.

### CREATE

```text
server/src/services/publishing/mongoose/MongoosePublishingTransactionRunner.js
server/src/services/publishing/mongoose/MongooseEmployerSubmissionRepository.js
server/src/services/publishing/mongoose/MongoosePublicationSubmissionRepository.js
server/src/services/publishing/mongoose/MongoosePostingRulesAcknowledgementRepository.js
server/src/services/publishing/mongoose/MongooseModerationEventRepository.js
server/src/services/publishing/mongoose/MongoosePublishingQuotaUsageRepository.js
server/src/services/publishing/mongoose/MongooseJobSubmissionRepository.js
server/src/services/publishing/mongoose/MongooseNotificationOutboxRepository.js
server/src/services/publishing/mongoose/MongoosePublishingIdFactory.js
server/src/services/publishing/FreeBetaPostingRulesRegistry.js
server/src/services/publishing/CanonicalJobContentSnapshotBuilder.js
server/src/services/publishing/SubmissionRequestFingerprintBuilder.js
server/src/services/publishing/SystemPublishingClock.js
server/src/__tests__/mongoosePublishingTransactionRunner.test.js
server/src/__tests__/mongoosePublishingSubmissionRepositories.test.js
server/src/__tests__/publishingSnapshotAndFingerprintBuilders.test.js
docs/FREE_BETA_MONGOOSE_SUBMISSION_ADAPTER_REPORT.md
```

`MongooseJobSubmissionRepository.js` is specifically **not authorized** against
the current Job schema. `MongooseNotificationOutboxRepository.js` is
specifically **not authorized** until a compatible typed outbox model exists.

### MODIFY

```text
None.
```

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
server/src/services/publishing/TransactionalFreeBetaSubmissionService.js
server/src/services/publishing/EmployerSubmissionEligibility.js
server/src/services/publishing/ReviewerCorrectionEligibility.js
server/src/services/publishing/PublishingQuotaUsageService.js
server/src/services/publishing/QuotaOwnerResolver.js
server/src/services/publishing/SerializedQuotaGuard.js
```

### FORBIDDEN

```text
server/src/models/Job.js
server/src/models/Employer.js
server/src/config/**
server/src/controllers/**
server/src/routes/**
server/src/middleware/**
server/src/index.js
server/src/worker.js
server/src/scheduler/**
server/src/services/payment*
server/src/services/jobQueueService.js
server/src/models/BackgroundJob.js
client/**
package.json
server/package.json
render.yaml
.env*
docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md
```

No Job/outbox prerequisite should be smuggled into an adapter phase. Each needs
its own exact allowlist and preservation review.

## 16. Proposed test plan

No dependency should be added.

### Pure fakes and builders

- fixed-key serialization, trimming, array order, null/undefined, Dates, invalid
  work-mode combinations, application-domain minimization, and SHA-256 vectors;
- stable fingerprint for identical intent and change for each approved input;
- no raw URL, email, request object, private profile field, or unknown key in a
  snapshot;
- registry accepts only the current server version/digest.

### Stubbed Mongoose models and session spies

- every find, sort/lean chain, aggregate, create, and CAS receives the exact same
  session;
- employer projection contains only approved eligibility fields;
- owner isolation and privacy-safe missing/unowned results;
- array-form transactional creates;
- append-only adapters expose no mutation/delete method;
- immediate predecessor and moderation-cycle reads are constrained correctly;
- rolling windows use `> start` and `<= now`;
- only `quotaCharged=true` and `planCode=free_beta` count;
- future paid submissions/jobs are excluded;
- duplicate owner/key resolution produces replay or
  `IDEMPOTENCY_KEY_REUSED`, never a duplicate record;
- CAS mismatch maps to the accepted stable code;
- no adapter makes a job active/public or sends a notification.

### Transaction-runner tests

- one session is opened and always ended;
- success commits and returns once;
- domain failure aborts and remains unchanged;
- unknown dependency failure aborts and maps safely at the service boundary;
- labeled transient callback retry creates no duplicate persisted intent;
- unknown commit resolution uses the owner/key lookup;
- outbox persistence rolls back with all other writes.

### Integration evidence (separately authorized)

Use an isolated disposable transaction-capable replica set, never the existing
employer integration target or production. Prove real commit, rollback, guard
serialization, duplicate-key races, same-session visibility, active Free Beta
aggregation, and index behavior. A standalone MongoDB test is insufficient.

Static isolation tests must search imports and prove no controller, route,
startup, worker, public-query, payment, webhook, or frontend module imports the
adapter composition. Existing H2A, H2B-A, employer/auth, server lint, client lint,
and no-write client build suites remain regression gates.

## 17. Risk assessment

| Risk                               | Rating     | Finding                                                                                                            |
| ---------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| Job schema compatibility           | `BLOCKING` | Canonical state, links, version, dates, and CAS support are absent                                                 |
| Active-major-edit preservation     | `HIGH`     | One mutable Job content record and legacy public filters cannot preserve or safely withdraw a reviewed version     |
| Transaction availability           | `BLOCKING` | Atlas is prescribed, but actual transaction-capable production topology is not verified or fail-closed             |
| Transaction retries                | `HIGH`     | Callback retries require all effects in-transaction; unknown commit resolution must be explicit                    |
| Idempotency duplicate handling     | `MEDIUM`   | Unique index/guard support the design, but aborted duplicate and unknown-commit paths need real transaction tests  |
| Durable outbox availability        | `BLOCKING` | Existing durable queue is not session-compatible or typed for publishing intents                                   |
| Append-only guarantees             | `LOW`      | Acknowledgement/event schemas have strong hooks; repositories must expose create/read only                         |
| Employer eligibility compatibility | `MEDIUM`   | Actual fields match, but legacy employers missing required profile/verification data deterministically fail closed |
| Index coverage                     | `HIGH`     | Ledger indexes are good but unverified live; canonical Job indexes are missing                                     |
| Runtime accidental import          | `LOW`      | New leaf modules can remain isolated; static import tests are required                                             |
| Production data migration need     | `BLOCKING` | Existing Jobs require safe canonical state classification before cutover                                           |
| Legacy job-state ambiguity         | `BLOCKING` | `status`, `approvalStatus`, `planType`, `expiresAt`, and `deadline` cannot be reinterpreted automatically          |
| Application destination ownership  | `HIGH`     | Domain parsing is possible; ownership evidence is not currently available to the builder contract                  |

## 18. Blockers and next safe phase

Blocking gaps:

1. approve a separate additive canonical Job publication-schema and
   legacy-classification/cutover plan, including indexes and fail-closed public
   behavior;
2. approve a separate dormant typed notification-outbox foundation and later
   worker contract;
3. establish and test a transaction-capable production/staging MongoDB topology
   without revealing credentials, and make unsupported topology fail closed
   before runtime wiring;
4. define the authoritative versioned Employer Posting Rules record;
5. define application-destination ownership validation;
6. define controlled index verification/application and a disposable
   replica-set integration-test target;
7. specify terminal unknown-commit idempotency resolution in the final
   composition.

The next safe phase is a read-only prerequisite design audit for the canonical
Job publication projection, data classification/cutover, and typed outbox. It is
not H2B-B adapter implementation. H2B-A remains dormant and no adapter, route,
controller, moderation flow, approval flow, payment flow, worker, migration, or
public-query change should begin.

## 19. Preservation statement

- Application code changed: No.
- H2A/H2B-A changed: No.
- Existing Job/Employer changed: No.
- Controllers/routes changed: No.
- Public queries changed: No.
- Payment/webhook changed: No.
- Frontend/theme/responsiveness changed: No.
- Authentication/RBAC weakened: No.
- Security/privacy weakened: No.
- Configuration/dependencies changed: No.
- Production data changed: No.
- Database connection/write performed: No.
- Migration/index application performed: No.
- Files staged: No.
- Commit performed: No.
- Push performed: No.
- Deployment performed: No.
- H2B-B implementation started: No.
- Production acceptance report changed: No.

STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED
