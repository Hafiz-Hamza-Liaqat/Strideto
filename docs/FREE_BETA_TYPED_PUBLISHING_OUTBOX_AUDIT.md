# Free Beta Typed Publishing Outbox Architecture Audit

## 1. Executive verdict

**READY FOR DORMANT TYPED PUBLISHING OUTBOX FOUNDATION**

The accepted transactional submission service has a precise, implementable
outbox boundary. A new strict publishing-intent model plus a dormant
session-bound repository can satisfy it without modifying the transaction
service, the existing queue, delivery models, workers, controllers, routes, or
startup composition.

The existing `BackgroundJob` infrastructure is
`EXISTING_BUT_INCOMPATIBLE`. It is a durable queue, but it is not a
transaction-compatible typed outbox. `Notification` and `UserNotification` are
delivery targets, not durable work intents.

This audit authorizes no implementation. A future foundation must remain
dormant. Worker composition, recipient-policy decisions, index rollout,
transaction-topology proof, and delivery-side duplicate mitigation remain
separate pre-runtime gates.

## 2. Repository state

Preflight was performed from the repository root without connecting to MongoDB.

- HEAD: `f460f1edec49805b7104d52a36893aaec17f6e04`
- Latest commit: `feat: add dormant canonical job publication schema and write boundaries`
- Branch: `main`
- Upstream state: `main...origin/main [ahead 6]`
- Tracked working-tree changes: none
- Staged files: none
- Pre-existing untracked file:
  `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- Merge, rebase, cherry-pick, revert, and conflict state: none detected

The production acceptance report was not read, modified, staged, or otherwise
touched by this audit.

## 3. Accepted transaction-service requirements

The accepted dependency is defined by
`server/src/services/publishing/TransactionalFreeBetaSubmissionService.js`.

| Contract item        | Exact requirement                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Factory dependency   | `notificationOutbox`                                                                                                                                         |
| Method               | `enqueueMany(intents, { session })`                                                                                                                          |
| Return value         | Ignored; no return shape is required                                                                                                                         |
| Call count           | Once for a newly accepted submission                                                                                                                         |
| Transaction position | After acknowledgement creation, submission creation, Job compare-and-set, and submitted moderation-event append; before the transaction callback returns     |
| Session              | The transaction-provided Mongoose session is supplied in the second argument                                                                                 |
| Direct delivery      | Forbidden; the method persists only durable intents                                                                                                          |
| Failure              | Any thrown persistence error aborts the submission transaction and is mapped by the service to safe `TRANSACTION_FAILED` unless already a known domain error |
| Rollback             | Both intents must roll back with every other transaction write                                                                                               |
| Replay               | Same owner/key/fingerprint replay returns before any writes and before `enqueueMany`; no duplicate intent is created                                         |

The exact accepted input is:

```js
[
  {
    type: 'employer_submission_received',
    deduplicationKey: `${submissionId}:employer_submission_received`,
    aggregateId: submissionId,
    employerId: authenticatedEmployerId,
    jobId,
  },
  {
    type: 'admin_job_review_requested',
    deduplicationKey: `${submissionId}:admin_job_review_requested`,
    aggregateId: submissionId,
    jobId,
  },
];
```

Supported types are therefore exactly:

- `employer_submission_received`;
- `admin_job_review_requested`.

The accepted key is exactly `<submissionId>:<intentType>`. The repository must
accept that key unchanged. It may derive fixed server-owned storage fields such
as schema version, aggregate type, submission ID, and audience, but must not
invent a different service method or require new transaction-service input.

## 4. Existing notification/background-job inventory

### Durable queue and processing

- `server/src/models/BackgroundJob.js` defines the current durable queue model.
- `server/src/services/jobQueueService.js` enqueues, processes, retries, reports,
  and manually requeues jobs.
- `server/src/services/queueLock.js` provides a Redis or process-memory queue
  loop lock.
- `server/src/worker.js` connects to MongoDB and polls the queue.
- `server/src/scheduler/cron.js` also invokes the queue processor unless
  `DISABLE_QUEUE_CRON=1`.
- `server/src/scheduler/reminderJobs.js` creates reminder work.
- `server/src/services/workflow/workflowSchedulerService.js` processes scheduled
  publishing workflow work.
- `server/src/controllers/admin/queueController.js`,
  `server/src/controllers/admin/monitoringController.js`,
  `server/src/controllers/admin/executiveDashboardController.js`,
  `server/src/controllers/platformOpsController.js`,
  `server/src/config/metrics.js`, `server/src/routes/admin.js`, and
  `server/src/routes/health.js` expose or consume queue status/operations.
- `render.yaml` defines a standalone `node src/worker.js` worker and disables
  queue/reminder cron on the web service.

### Queue producers

- `server/src/services/automationService.js` maps email and in-app work to
  `enqueueJob`; sensitive token-bearing email paths are deliberately sent
  directly instead of persisted.
- `server/src/services/workflow/EditorialNotificationService.js`,
  `server/src/services/workflow/WorkflowService.js`,
  `server/src/services/career/careerApplicationBridge.js`,
  `server/src/scheduler/reminderJobs.js`, and admin/auth/contact/form/newsletter
  controllers and services enqueue current background jobs.

### Delivery and final notification records

- `server/src/models/Notification.js` stores admin/broadcast notification
  content and state.
- `server/src/models/UserNotification.js` stores final per-user, employer, or
  staff inbox records.
- `server/src/services/notificationService.js` directly creates final
  notification records and expands staff recipients.
- `server/src/services/emailService.js` performs direct Nodemailer delivery and
  records failed email details through `server/src/models/FailedEmail.js`.
- `server/src/controllers/notificationsController.js`,
  `server/src/controllers/admin/adminNotificationsController.js`,
  `server/src/controllers/userNotificationsController.js`,
  `server/src/controllers/notificationsListController.js`,
  `server/src/routes/notifications.js`, and
  `server/src/routes/userInbox.js` create/read/update existing notification
  records.
- `server/src/services/career/careerNotificationBridge.js` and
  `server/src/services/formNotificationService.js` are additional notification
  producers.

No focused queue/outbox test suite was found under `server/src/__tests__`.
Current H2B-A tests use an injected in-memory `notificationOutbox` fake and
prove transaction ordering, rollback, and replay semantics at the service
boundary.

`server/src/index.js` imports `server/src/scheduler/cron.js`, which can activate
the existing queue processor. The new publishing outbox does not exist and is
not imported by startup, a route, controller, worker, scheduler, webhook,
payment module, public query, or frontend module.

## 5. Existing BackgroundJob compatibility

Mongoose model `BackgroundJob` uses the default collection name
`backgroundjobs`.

| Property          | Existing behavior                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Type              | String enum for current generic jobs; no publishing intent types                            |
| Payload           | Required unrestricted `mongoose.Schema.Types.Mixed`                                         |
| Status            | `pending`, `processing`, `completed`, `failed`, `dead`                                      |
| Retry             | `attempts`, `maxAttempts` default 3, linear one-minute delay                                |
| Scheduling        | `scheduledAt`, default now                                                                  |
| Completion        | Optional `processedAt`                                                                      |
| Failure           | Unbounded/raw `lastError` string                                                            |
| Lease             | None: no lease owner, expiry, heartbeat, or stale-claim recovery                            |
| Deduplication     | Optional sparse unique `dedupKey`; producer also uses a racy find-before-create             |
| Indexes           | unique sparse dedup key; `{status, scheduledAt}`; `{type, status, createdAt:-1}`            |
| Ownership/history | No submission, aggregate, job, employer, or audience fields                                 |
| Privacy           | No strict payload boundary; email bodies/addresses may be stored                            |
| Session support   | `enqueueJob` accepts no session and performs an independent create                          |
| Batch support     | No session-bound create-only batch interface                                                |
| Worker claim      | Finds pending jobs, then changes each document to processing and saves; claim is not atomic |
| Locking           | Redis/process lock protects a loop, not durable ownership of each job                       |
| Crash recovery    | A processing job can remain stuck indefinitely                                              |
| Delivery          | Processor imports and invokes SMTP and notification services                                |
| Errors            | Persists `err.message`; logs may contain provider details                                   |
| Dead letter       | Marks `dead`; email failures can enqueue a separate `retry_email` job                       |
| Retention         | No cleanup or TTL policy                                                                    |
| Startup           | Active in the standalone worker and potentially in API cron                                 |

Requirement evaluation:

| Requirement                              | Result                                       |
| ---------------------------------------- | -------------------------------------------- |
| Same transaction/session propagation     | Fail                                         |
| Typed intent and strict payload          | Fail                                         |
| Stable database-enforced deduplication   | Partial                                      |
| Create-only persistence                  | Fail                                         |
| Transaction retry safety                 | Fail                                         |
| Unknown-commit resolution                | Fail                                         |
| No direct send in submission transaction | Not provable through its current enqueue API |
| Privacy-safe storage                     | Fail                                         |
| Worker lease/concurrency                 | Fail                                         |
| Terminal failure handling                | Partial                                      |

**Classification: `EXISTING_BUT_INCOMPATIBLE`.**

Adapting it would require schema, service, worker, and operational changes. That
is broader and riskier than a new isolated publishing outbox, and is forbidden
in the dormant foundation.

## 6. Existing notification compatibility

| Candidate          | Meaning                                                                                        | Classification                      |
| ------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------- |
| `Notification`     | Admin-created/broadcast content with draft/scheduled/sent and delivered fields                 | `SUITABLE_ONLY_AS_DELIVERY_TARGET`  |
| `UserNotification` | Final visible inbox record with read state                                                     | `SUITABLE_ONLY_AS_DELIVERY_TARGET`  |
| `FailedEmail`      | Delivery-failure record containing recipient, subject, template, raw error, and Mixed metadata | `INCOMPATIBLE`                      |
| `BackgroundJob`    | Generic active work queue                                                                      | `INCOMPATIBLE` as publishing outbox |

Creating `Notification` or `UserNotification` inside the submission transaction
would prematurely create a user-visible delivery artifact and would not model
claim, retry, lease, or terminal failure. Their unrestricted or broad metadata
also does not provide the required publishing privacy boundary. They may be
used later by a post-commit delivery handler, without redesigning them here.

## 7. Typed intent contracts

The storage contract must have no generic `Mixed` payload. The repository maps
the accepted flat service inputs into strict server-owned fields.

### Common persisted fields

| Field                    | Contract                                                                  |
| ------------------------ | ------------------------------------------------------------------------- |
| `type`                   | Required enum of the two accepted types                                   |
| `schemaVersion`          | Required integer enum `[1]`, derived by repository                        |
| `deduplicationKey`       | Required printable ASCII string, 1–160 characters                         |
| `aggregateType`          | Required enum `job_publication_submission`, repository-derived            |
| `aggregateId`            | Required ObjectId; accepted submission ID                                 |
| `submissionId`           | Required ObjectId equal to `aggregateId`, repository-derived              |
| `jobId`                  | Required ObjectId                                                         |
| `employerId`             | Required for employer receipt; absent for admin intent                    |
| `audience`               | Required enum `employer` or `publishing_review_staff`, repository-derived |
| `status`                 | Required lifecycle enum, initial `pending`                                |
| `availableAt`            | Required date, initial transaction time                                   |
| `attempts`               | Non-negative integer, initial 0                                           |
| `lastFailure`            | Optional strict safe failure subdocument                                  |
| `leaseOwner`             | Optional bounded opaque worker ID                                         |
| `leaseExpiresAt`         | Optional date                                                             |
| `processedAt`            | Optional date                                                             |
| `terminalFailedAt`       | Optional date                                                             |
| `createdAt`, `updatedAt` | Server timestamps                                                         |

### `employer_submission_received`

- schema version: `1`;
- deduplication key: `<submissionId>:employer_submission_received`;
- aggregate: `job_publication_submission` / submission ID;
- audience: `employer`;
- strict logical payload: `submissionId`, `jobId`, and `employerId`;
- recipient email, company name, job title, and locale are not snapshotted;
- future handler resolves current safe delivery data from authoritative records.

### `admin_job_review_requested`

- schema version: `1`;
- deduplication key: `<submissionId>:admin_job_review_requested`;
- aggregate: `job_publication_submission` / submission ID;
- audience: `publishing_review_staff`;
- strict logical payload: `submissionId` and `jobId`;
- employer verification evidence, content snapshot, moderation notes, and
  recipient identities are not stored.

Both types require a creation and availability timestamp, start `pending` with
zero attempts, and retain no delivery claim fields until claimed.

## 8. Strict payload definitions

The strict payload is represented by allow-listed typed fields, not a generic
payload object.

| Property        | Type     | Required              | Bound/enum                       | Source                                      | Privacy                     | Client input                |
| --------------- | -------- | --------------------- | -------------------------------- | ------------------------------------------- | --------------------------- | --------------------------- |
| `submissionId`  | ObjectId | Both                  | Valid ObjectId; equals aggregate | `aggregateId` supplied by accepted service  | Internal opaque identifier  | Forbidden                   |
| `jobId`         | ObjectId | Both                  | Valid ObjectId                   | Accepted service after owned-job resolution | Internal opaque identifier  | Forbidden                   |
| `employerId`    | ObjectId | Employer receipt only | Valid ObjectId                   | Authenticated employer resolved by service  | Personal/account identifier | Forbidden                   |
| `type`          | String   | Both                  | Exact two-value enum, max 40     | Accepted service                            | Operational                 | Forbidden to public clients |
| `schemaVersion` | Integer  | Both                  | Exactly 1                        | Repository mapping                          | Operational                 | Forbidden                   |
| `audience`      | String   | Both                  | Exact type-derived enum          | Repository mapping                          | Operational                 | Forbidden                   |

No display text is required for durable correctness. A future handler can load a
bounded job title/company name after claiming if its delivery template needs
them. The model must reject arbitrary keys under strict schema validation.

Prohibited data includes full Job snapshots, application URLs, email addresses,
passwords, tokens, cookies, raw requests, IP addresses, user agents,
verification documents/evidence, internal moderation text, payment data,
applicant data, provider credentials, raw database/provider errors, and stack
traces.

## 9. Deduplication and idempotency

- Unique scope: one record for each accepted submission and intent type.
- Accepted key: `<submissionId>:<intentType>`.
- Maximum: 160 ASCII characters; current ObjectId-based keys are substantially
  shorter.
- PII: the key contains an opaque submission identifier and enum, not direct
  PII.
- Hashing: unnecessary for this contract. If a future key contains sensitive
  or unbounded material, Node built-in `crypto` is sufficient, but such input
  is not authorized here.
- Required index: unique `{ deduplicationKey: 1 }`, with the field required and
  no sparse/partial loophole.
- Repository behavior: one ordered create-only batch using the supplied
  session; no find-then-create, upsert, update, or silent duplicate success.
- Duplicate key: fail safely with `OUTBOX_DEDUPLICATION_CONFLICT` and abort the
  transaction. A committed logical replay is resolved by the accepted
  submission owner/idempotency lookup before outbox invocation.
- Transaction callback retry: aborted writes disappear; the same stable keys
  are recreated in the retried transaction.
- Unknown commit: resolve the accepted submission by owner/idempotency key and
  verify both intent keys before starting a new logical transaction. Never
  create a second logical intent.

This provides exactly-once durable intent creation, not exactly-once delivery.
SMTP and the existing in-app creation APIs lack a shared atomic commit with the
outbox. A crash or unknown provider result after delivery but before marking
processed can duplicate delivery. Runtime activation therefore requires
provider idempotency, a delivery-attempt ledger/reconciliation contract, or an
explicit at-least-once product decision.

## 10. Transaction/session contract

The future repository must implement exactly:

```js
notificationOutbox.enqueueMany(intents, { session });
```

Requirements:

1. reject a missing or invalid session;
2. validate the entire non-empty batch and each exact type shape before writing;
3. derive schema version, aggregate type, submission ID, audience, initial
   state, and timestamps from server-owned contracts;
4. execute one ordered `Model.create(documents, { session })` or equivalent
   transaction-bound insert;
5. perform no pre-read, update, upsert, independent connection, nested
   transaction, queue publish, post-commit callback, or delivery call;
6. allow validation, duplicate, transient, and write errors to abort the
   enclosing transaction;
7. return only persistence metadata if desired; the accepted caller ignores it.

The same session is shared with acknowledgement, submission, Job
compare-and-set, moderation event, and quota/guard work. Required intent
persistence is not best-effort.

## 11. Processing state machine

The dormant model may define the complete safe lifecycle even though no worker
is included:

```text
pending -> processing -> processed
                     \-> retryable_failed -> processing
                     \-> terminal_failed
processing (expired lease) -> processing (new owner)
```

| Transition                                       | Actor and invariant                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| create `pending`                                 | Transaction repository; zero attempts, available now, no lease/failure timestamps                    |
| `pending`/due `retryable_failed` to `processing` | Future worker atomic claim; increment attempts and set owner/expiry                                  |
| stale `processing` to `processing`               | Future worker atomic reclaim after lease expiry; new owner/expiry and increment attempt              |
| `processing` to `processed`                      | Current lease owner only after confirmed delivery; set `processedAt`, clear lease/failure scheduling |
| `processing` to `retryable_failed`               | Current lease owner; safe code/class/time and next availability; clear lease                         |
| `processing` to `terminal_failed`                | Current lease owner; terminal code/time, clear lease                                                 |

The model must validate state-dependent timestamps and lease fields. No
`processed` state may be inferred from intent creation. The full state model is
appropriate in the dormant foundation because it prevents permissive future
storage, while processing methods remain outside the first repository.

## 12. Lease/concurrency design

A future worker must claim one intent with `findOneAndUpdate`, not a
find-then-save loop. The eligible predicate is:

- `status` is `pending` or `retryable_failed` and `availableAt <= now`; or
- `status` is `processing` and `leaseExpiresAt <= now`.

The atomic update sets `status=processing`, a random opaque `leaseOwner`
(maximum 128 characters), and `leaseExpiresAt=now+5 minutes`, and increments
`attempts`. Sort by `availableAt`, then `createdAt`, then `_id`. A first worker
batch should be bounded to 50.

Completion/failure updates must match `_id`, `status=processing`, and the exact
lease owner. A worker that lost its lease cannot record an outcome. Lease
renewal may be added later if handlers can exceed five minutes. Redis and
process-local locks are optional scheduling optimizations, never the durable
claim guarantee.

Stale lease recovery is safe for database ownership but does not by itself
prevent duplicate external delivery after a crash. That remains a runtime
delivery-design gate.

## 13. Retry/failure policy

Recommended maximum attempts: 8. Retry delay is bounded exponential backoff
from 60 seconds, capped at 6 hours, with randomized jitter. Only safe structured
failure data is stored:

```text
classification: RETRYABLE | TERMINAL | UNKNOWN
code: bounded enum/string, maximum 80
occurredAt: Date
```

| Outcome                                     | Classification                  | Automated handling                                            |
| ------------------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| Provider 429                                | `RETRYABLE`                     | Honor safe retry-after within bounds, otherwise backoff       |
| Provider 5xx                                | `RETRYABLE`                     | Backoff                                                       |
| Network failure before provider acceptance  | `RETRYABLE`                     | Backoff                                                       |
| SMTP timeout/unknown send result            | `UNKNOWN`                       | Do not blindly resend without idempotency/reconciliation      |
| Invalid recipient                           | `TERMINAL`                      | Terminal failure                                              |
| Missing employer                            | `TERMINAL`                      | Terminal failure, no alternate address                        |
| Missing admin recipient configuration       | `RETRYABLE` operational failure | Bounded retry, then terminal/manual review                    |
| Malformed strict payload                    | `TERMINAL`                      | Terminal integration failure                                  |
| Unsupported schema version/type             | `TERMINAL`                      | Terminal integration failure                                  |
| Provider authentication/configuration error | `TERMINAL` operational failure  | Operator correction and controlled replay                     |
| Process crash                               | Lease recovery                  | Reclaim after expiry; reconcile possible external side effect |

Manual replay must require an authorized staff operation, audit actor/reason,
terminal record inspection, unchanged deduplication identity, and a new
delivery-attempt record or controlled state transition. It must not clone the
durable intent or expose stored identifiers broadly.

## 14. Delivery-target separation

The layers are:

```text
submission transaction
  -> durable PublishingOutboxIntent only
  -> future leasing worker
  -> type/version handler
  -> authoritative recipient resolution
  -> existing SMTP or UserNotification delivery target
  -> safe outcome update
```

The outbox model/contracts/repository must not import Nodemailer, email service,
notification service, push providers, frontend code, controllers, workers, or
schedulers.

A future handler must claim an intent, validate type/version, resolve current
recipient data, render bounded server-owned content, invoke one approved
delivery channel, and record confirmed success or classified failure using its
lease. No delivery may occur in `enqueueMany`.

## 15. Recipient resolution

### Employer

`Employer.email` is required and lowercased in
`server/src/models/Employer.js`. `verified` and `verificationLevel` represent
employer verification; the schema has no separate employer email-verification
field and no employer notification-preference field.

The email and company name should be resolved at processing time from
`employerId`, not duplicated in the outbox. Missing employers fail terminally.
The fail-closed runtime default should suppress external delivery when the
current employer is suspended. Whether a previously accepted transactional
receipt must still reach a subsequently suspended employer is a product/security
decision that must be approved before worker wiring.

Employer recipient classification: `PARTIAL`.

### Admin review staff

Current `notifyStaff` expands every `Editor`, `Moderator`, `Admin`, and
`SuperAdmin` from `STAFF_ROLES`; it does not filter `accountStatus`,
`emailVerified`, or notification preferences. `User.notifications.email`
exists, but `notifyStaff` creates in-app records and does not use it. No
authoritative publishing-review recipient group or email configuration exists.
The broadcast `Notification` system is not an appropriate recipient registry.

Admin review recipient classification: `MISSING` for precise runtime delivery.
The dormant intent can safely preserve the audience
`publishing_review_staff`; final recipient policy is blocking before a worker,
not before model/repository foundation.

Overall recipient resolution: `PARTIAL`.

## 16. Privacy and retention

- Persist only the strict identifiers and operational lifecycle fields in this
  report.
- Outbox access is internal service/staff operational access, not employer,
  applicant, public, or general frontend access.
- Employer-visible status must come from approved submission/job views, not
  direct outbox documents.
- Logs contain intent type, schema version, safe failure code, and truncated or
  hashed operational correlation only. They exclude recipient values, full
  keys, payloads, provider bodies, raw errors, stacks, tokens, and connection
  details.
- Processed intents should be retained for 30 days initially, then deleted or
  archived under an approved operations policy.
- Terminal/unknown intents should be retained for 180 days for controlled
  review, then deleted/anonymized according to policy.
- Retention must use an explicit `purgeAt` computed only after terminal outcome;
  creation-time TTL is unsafe.
- A privacy deletion request should remove or irreversibly anonymize
  `employerId` after legal/audit retention permits while retaining only
  non-personal aggregate/delivery metrics. No applicant data exists to migrate.

No TTL or archival behavior is implemented or authorized by this audit.

## 17. Index plan

| Index                                            | Unique/partial                               | Query                                       | Risk and gate                                                                           |
| ------------------------------------------------ | -------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `{deduplicationKey:1}`                           | Unique, not partial                          | One intent per submission/type              | `BLOCKING_BEFORE_RUNTIME_WIRING`; preflight duplicates and controlled creation required |
| `{status:1, availableAt:1, createdAt:1, _id:1}`  | Partial for `pending`,`retryable_failed`     | Due ordered claims                          | `BLOCKING_BEFORE_WORKER`; operational write load                                        |
| `{status:1, leaseExpiresAt:1, _id:1}`            | Partial for `processing`                     | Stale lease recovery                        | `BLOCKING_BEFORE_WORKER`                                                                |
| `{status:1, availableAt:1}`                      | Partial for `retryable_failed`               | Retry visibility                            | Recommended; overlaps claim index and may be omitted after explain evidence             |
| `{submissionId:1, createdAt:1}`                  | Non-unique                                   | Submission intent history                   | Recommended before support tooling                                                      |
| `{aggregateType:1, aggregateId:1, createdAt:-1}` | Non-unique                                   | Aggregate history/unknown-commit resolution | `BLOCKING_BEFORE_RUNTIME_WIRING`                                                        |
| `{status:1, processedAt:-1}`                     | Partial for `processed`                      | Retention/operations                        | Recommended                                                                             |
| `{status:1, terminalFailedAt:-1}`                | Partial for `terminal_failed`                | Failure review                              | `BLOCKING_BEFORE_WORKER`                                                                |
| `{purgeAt:1}` TTL 0                              | Partial semantics supplied by field presence | Processed/terminal retention                | Unsafe now; defer until retention approval and live-data review                         |

All index declarations are operationally significant. `server/src/config/db.js`
does not explicitly disable Mongoose auto-indexing. The dormant model must not
be imported by startup; before runtime composition, live index inventory,
duplicate preflight, deployment ordering, and production `autoIndex` behavior
must be explicitly controlled. This audit neither declared nor applied an
index.

## 18. Error mapping

| Outcome                        | Safe domain code                                                                 | Fail submission transaction                     | Retry                                      | Logging                           |
| ------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------ | --------------------------------- |
| Duplicate key                  | `OUTBOX_DEDUPLICATION_CONFLICT`                                                  | Yes                                             | Only idempotency/unknown-commit resolution | Index category only; no key/value |
| Validation/invalid payload     | `OUTBOX_CONTRACT_INVALID`                                                        | Yes                                             | No until code corrected                    | Field category, never value       |
| Cast error                     | `OUTBOX_CONTRACT_INVALID`                                                        | Yes                                             | No                                         | Suppress cast input               |
| Unsupported type               | `OUTBOX_TYPE_UNSUPPORTED`                                                        | Yes                                             | No                                         | Safe enum category                |
| Unsupported version            | `OUTBOX_VERSION_UNSUPPORTED`                                                     | Yes                                             | No                                         | Safe numeric version              |
| Transaction aborted            | Preserve known domain error or outer `TRANSACTION_FAILED`                        | Yes                                             | Transaction runner policy                  | No raw driver error               |
| Unknown commit                 | `OUTBOX_COMMIT_OUTCOME_UNKNOWN` internally; resolve accepted submission and keys | Do not start a new logical write until resolved | Commit/idempotency-aware only              | Operation/correlation only        |
| Connection timeout             | `OUTBOX_PERSISTENCE_UNAVAILABLE` internally, outer safe failure                  | Yes                                             | Bounded transaction policy                 | No host/URI                       |
| Write conflict/transient label | `OUTBOX_PERSISTENCE_RETRYABLE` internally                                        | Yes for attempt                                 | Bounded driver transaction retry           | Safe label/category only          |

The accepted service currently maps unexpected repository errors to
`TRANSACTION_FAILED`. Repository-specific codes are protected operational
classifications and must not expand the existing public error contract without
separate authorization. Raw Mongo errors, collection/database names, stacks,
keys, document values, URIs, and credentials are always suppressed.

## 19. Dormancy design

A model definition is safe under current conventions only while no production
entrypoint imports it. Mongoose schema/model construction alone issues no
query, but a later application import may register index creation when a
connection opens.

The foundation remains dormant when:

- there is no import from `index.js`, `worker.js`, schedulers, controllers,
  routes, middleware, webhooks, payments, public queries, or frontend code;
- no existing barrel/automatic discovery path exports it to startup;
- there is no environment flag or startup registration;
- no SMTP, notification, Redis, or queue client is imported;
- no model query, session, timer, listener, or connection runs at module scope;
- repository work occurs only when an explicitly constructed repository method
  is called;
- tests use schema validation and injected model/session spies without a
  database.

File existence cannot activate the accepted transaction service. Runtime
composition still requires explicit construction and injection of every
adapter, including the canonical Job repository and transaction runner.

## 20. Exact proposed implementation allowlist

This is the exact recommended scope for a separately authorized dormant
foundation.

### CREATE

```text
server/src/models/PublishingOutboxIntent.js
server/src/services/publishing/outbox/PublishingOutboxContracts.js
server/src/services/publishing/outbox/MongoosePublishingOutboxRepository.js
server/src/__tests__/publishingOutboxModel.test.js
server/src/__tests__/publishingOutboxRepository.test.js
docs/FREE_BETA_TYPED_PUBLISHING_OUTBOX_FOUNDATION_REPORT.md
```

The first implementation should include the model, pure contracts, and dormant
session-bound `enqueueMany` repository. Excluding the repository would leave
the key same-session property unproved. It must include no claim/delivery
worker.

### MODIFY

```text
None.
```

No transaction-service change is justified: its actual batch interface is
compatible.

### INSPECT_ONLY

```text
server/src/services/publishing/TransactionalFreeBetaSubmissionService.js
server/src/models/JobPublicationSubmission.js
server/src/models/EmployerPostingRulesAcknowledgement.js
server/src/models/JobModerationEvent.js
server/src/services/publishing/SerializedQuotaGuard.js
server/src/config/freeBetaPublishingPolicy.js
server/src/models/Employer.js
server/src/models/User.js
server/src/models/BackgroundJob.js
server/src/models/Notification.js
server/src/models/UserNotification.js
server/src/models/FailedEmail.js
server/src/services/jobQueueService.js
server/src/services/queueLock.js
server/src/services/notificationService.js
server/src/services/emailService.js
server/src/services/automationService.js
server/src/worker.js
server/src/scheduler/cron.js
server/src/config/db.js
docs/FREE_BETA_TRANSACTIONAL_SUBMISSION_CORE_REPORT.md
docs/FREE_BETA_MONGOOSE_SUBMISSION_ADAPTER_AUDIT.md
```

### FORBIDDEN

```text
server/src/services/publishing/TransactionalFreeBetaSubmissionService.js
server/src/models/BackgroundJob.js
server/src/models/Notification.js
server/src/models/UserNotification.js
server/src/models/FailedEmail.js
server/src/models/Job.js
server/src/models/Employer.js
server/src/models/User.js
server/src/services/jobQueueService.js
server/src/services/queueLock.js
server/src/services/notificationService.js
server/src/services/emailService.js
server/src/services/automationService.js
server/src/controllers/**
server/src/routes/**
server/src/middleware/**
server/src/scheduler/**
server/src/worker.js
server/src/index.js
server/src/config/**
server/src/services/payment*
server/src/services/*webhook*
client/**
package.json
server/package.json
render.yaml
.env*
docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md
```

## 21. Test plan

Database-free tests must prove:

- exact two-value type enum and version 1;
- strict top-level and state-dependent schemas reject unknown fields, arbitrary
  metadata, invalid payload combinations, private fields, and applicant data;
- type mapping derives exact aggregate, submission, employer, job, and audience
  fields;
- exact accepted deduplication keys are stable and bounded;
- missing/invalid session and empty/malformed batches fail before writes;
- one ordered create-only call receives the exact supplied session;
- the repository exposes no find-before-create, update, upsert, delivery, claim,
  or queue behavior;
- duplicate and dependency failures propagate safely for transaction rollback;
- fake transaction abort removes staged intent effects;
- model state invariants cover pending, leased processing, retryable failure,
  processed, terminal failure, lease expiry, safe errors, and timestamps;
- modules import no email, SMTP, notification, queue, controller, route, worker,
  scheduler, startup, payment, webhook, public-query, or frontend code;
- production startup imports none of the new modules;
- future paid publishing is not excluded by a `free_beta` assumption in the
  generic outbox record;
- exact accepted transaction-service inputs map without modifying that service.

Schema and repository unit tests need no MongoDB. A separately authorized
disposable replica set is required later to prove real unique-index races,
same-session commit/rollback, callback retry, and unknown-commit recovery. A
standalone MongoDB instance is insufficient; no database test is required or
authorized for the dormant foundation.

## 22. Risks and blockers

| Risk                            | Rating                    | Finding                                                                           |
| ------------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| Reusing `BackgroundJob`         | `BLOCKING`                | Requires incompatible schema, session, worker, privacy, and lease changes         |
| Transaction compatibility       | `MEDIUM`                  | New repository contract is clear; real replica-set proof remains                  |
| Deduplication uniqueness        | `MEDIUM`                  | Exact key/index defined; live index rollout unverified                            |
| Unknown commit resolution       | `HIGH`                    | Submission replay exists; production runner and dual-intent verification remain   |
| Payload privacy                 | `LOW`                     | Identifier-only strict contract is sufficient                                     |
| Worker concurrency              | `HIGH`                    | Lease design defined; no worker exists                                            |
| Retry duplication               | `HIGH`                    | External SMTP/in-app exactly-once is not guaranteed                               |
| Delivery truthfulness           | `HIGH`                    | Existing dev placeholder and provider outcomes require explicit handler semantics |
| Recipient resolution            | `HIGH`                    | Employer is partial; precise publishing-review staff audience is missing          |
| Index creation                  | `HIGH`                    | Auto-index behavior/live data require controlled rollout                          |
| TTL/retention                   | `MEDIUM`                  | Policy proposed; TTL is unsafe until approved                                     |
| Accidental runtime import       | `LOW`                     | Isolated leaf modules and static tests can preserve dormancy                      |
| Production transaction topology | `BLOCKING` before runtime | No connection was made and transaction capability remains unproved                |
| Schema-version evolution        | `MEDIUM`                  | Version 1 fixed; future handler/version and dedup evolution need explicit review  |

These are not blockers to the dormant model/contracts/repository foundation:

- no dependency is required;
- the strict payload is fully defined from existing server-owned identifiers;
- the accepted service interface needs no modification;
- missing recipient policy affects only later delivery composition;
- no database operation is needed for database-free foundation tests.

They are blockers before worker or runtime wiring:

1. verify a transaction-capable deployment topology and same-session behavior;
2. apply/verify indexes through a controlled production-safe process;
3. approve publishing-review staff recipient selection and suspended-employer
   receipt behavior;
4. approve delivery-channel semantics for provider unknown outcomes and
   duplicate mitigation;
5. approve retention, terminal review, and manual replay operations;
6. implement and separately audit a lease-based worker/handler;
7. compose the outbox repository only with the complete accepted Mongoose
   submission adapter.

## 23. Next safe phase

The next safe phase is:

```text
E.1F-H2B-B2-B — Dormant Typed Publishing Outbox Foundation
```

It may create only the six files in the proposed `CREATE` list and should
implement the strict model, pure contracts, session-bound create-only
`enqueueMany` repository, database-free tests, and report. It must not add a
worker, runtime import, recipient resolver, delivery handler, migration, index
operation, environment flag, or transaction-service modification.

The Mongoose submission adapter and all runtime wiring remain deferred.

## 24. Preservation statement

- Application code changed: No.
- Existing models changed: No.
- H2A/H2B-A changed: No.
- Canonical Job schema changed: No.
- Transaction service changed: No.
- Controllers/routes changed: No.
- Workers/startup changed: No.
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
- Outbox implementation started: No.
- Mongoose adapter implementation started: No.
- Production acceptance report changed: No.

STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED
