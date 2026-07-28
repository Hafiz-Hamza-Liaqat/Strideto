# Free Beta Typed Publishing Outbox Foundation Report

## 1. Executive result

**READY FOR DORMANT TYPED PUBLISHING OUTBOX FOUNDATION ACCEPTANCE AUDIT**

The dormant typed publishing outbox foundation is implemented within the exact
six-file allowlist. It provides immutable database-free contracts, a strict
Mongoose model, a same-session create-only repository, focused database-free
tests, and this report.

Nothing imports the foundation from production startup, workers, schedulers,
controllers, routes, middleware, payments, webhooks, public queries, or
frontend code. No worker, delivery handler, recipient resolver, Mongoose
submission adapter, or runtime composition was implemented.

## 2. Exact files created

```text
server/src/models/PublishingOutboxIntent.js
server/src/services/publishing/outbox/PublishingOutboxContracts.js
server/src/services/publishing/outbox/MongoosePublishingOutboxRepository.js
server/src/__tests__/publishingOutboxModel.test.js
server/src/__tests__/publishingOutboxRepository.test.js
docs/FREE_BETA_TYPED_PUBLISHING_OUTBOX_FOUNDATION_REPORT.md
```

No existing file changed.

## 3. Authoritative audit followed

The implementation follows
`docs/FREE_BETA_TYPED_PUBLISHING_OUTBOX_AUDIT.md`. It retains:

- exactly two accepted intent types;
- identifier-only strict persistence;
- exact transaction-service input compatibility;
- version 1 and one durable intent per submission/type;
- five lifecycle states and three safe failure classifications;
- session-bound, ordered, create-only persistence;
- seven declared non-TTL indexes;
- disabled model auto-index/auto-create behavior;
- complete runtime dormancy.

No broader queue, notification, worker, or delivery design was introduced.

## 4. Exact transaction-service interface supported

The repository exposes:

```js
notificationOutbox.enqueueMany(intents, { session });
```

It accepts the existing flat inputs produced by
`TransactionalFreeBetaSubmissionService.js` without requiring another field,
callback, connection, or transaction. That existing service was not modified
or wired to the repository.

## 5. Exact intent types

```text
employer_submission_received
admin_job_review_requested
```

The exported intent array is frozen. Unsupported values fail with
`OUTBOX_TYPE_UNSUPPORTED` before persistence.

## 6. Pure contract design

`PublishingOutboxContracts.js` is database-free and imports no model. It uses
the installed Mongoose package only for strict ObjectId-compatible validation
and deterministic ObjectId normalization.

Immutable exports define:

- schema version `1`;
- aggregate type `job_publication_submission`;
- audiences `employer` and `publishing_review_staff`;
- states `pending`, `processing`, `processed`, `retryable_failed`, and
  `terminal_failed`;
- classifications `RETRYABLE`, `TERMINAL`, and `UNKNOWN`;
- key, lease-owner, failure-code, and attempt bounds;
- frozen type-to-audience and type-to-required-key mappings.

Input must be a direct plain object with data properties. Arrays, primitives,
accessors, unsafe prototypes, symbols, dotted keys, dollar-prefixed keys, and
the names `__proto__`, `constructor`, and `prototype` fail safely. No input
object or batch is mutated.

## 7. Strict persisted field contract

Mapped initial documents contain only:

```text
type
schemaVersion
deduplicationKey
aggregateType
aggregateId
submissionId
jobId
employerId (employer receipt only)
audience
status
availableAt
attempts
```

The model additionally declares only these lifecycle fields and timestamps:

```text
lastFailure
leaseOwner
leaseExpiresAt
processedAt
terminalFailedAt
createdAt
updatedAt
```

There is no `Mixed`, `payload`, arbitrary metadata, recipient address, applicant
identifier, credential, provider response, or raw-error field. `purgeAt` is not
declared because retention execution remains deferred.

## 8. Type-specific requirements

### Employer receipt

Required accepted keys:

```text
type
deduplicationKey
aggregateId
jobId
employerId
```

The mapper derives version 1, the submission aggregate, `submissionId`,
audience `employer`, initial state, and time. The model requires `employerId`
and rejects the staff audience.

### Admin review request

Required accepted keys:

```text
type
deduplicationKey
aggregateId
jobId
```

The mapper derives version 1, the submission aggregate, `submissionId`,
audience `publishing_review_staff`, initial state, and time. `employerId` must
be absent.

## 9. Deduplication validation

The required key is exactly:

```text
<normalized submissionId>:<intentType>
```

It is required, printable ASCII, unpadded, and at most 160 characters. Alternate
suffixes and mismatched identifiers fail. Duplicate keys in one batch fail
before any write with `OUTBOX_DEDUPLICATION_CONFLICT`.

The model declares one required, unique, explicitly non-sparse index on
`deduplicationKey`. There is no application-level find-before-create and no
hashing of the approved opaque identifier/type key.

## 10. Session validation

The repository rejects:

- missing options or session;
- null or non-object sessions;
- ended sessions;
- sessions without `inTransaction()`;
- sessions whose transaction check throws;
- sessions not currently in a transaction.

It uses the exact supplied session identity. It never creates a session, opens
a connection, begins a transaction, or nests a transaction.

## 11. Single ordered create-only write behavior

The repository:

1. validates and maps the complete non-empty batch;
2. rejects duplicate in-batch keys;
3. calls the injected model's `create` exactly once;
4. passes `{ session, ordered: true }`;
5. returns only frozen `{ insertedCount }` metadata.

There is no pre-read, find-before-create, save loop, update, upsert, delete,
partial best effort, queue publication, event emission, timer, post-commit
callback, or direct delivery.

## 12. Lifecycle validation

The model uses one database-free pre-validation hook:
`validatePublishingOutboxIntent`.

- `pending`: zero attempts; no lease, failure, processed time, or terminal time.
- `processing`: positive attempts and paired lease fields; no terminal
  timestamps.
- `retryable_failed`: positive attempts, safe failure, future availability,
  and no lease/terminal timestamps.
- `processed`: positive attempts, required processed time, and no lease or
  terminal-failure time.
- `terminal_failed`: positive attempts, safe failure, required terminal time,
  and no lease or processed time.

Lease fields must be paired and may exist only while processing. Aggregate and
submission IDs must match. Audience and employer-ID presence must match the
intent type. The model has no claim, process, delivery, or transition methods.

## 13. Strict failure subdocument

`lastFailure` is a strict `_id:false` subdocument containing only:

```text
classification
code
occurredAt
```

Classification is the exact three-value enum. Code is required, at most 80
characters, and restricted to safe uppercase operational characters.
`occurredAt` is a required valid Date. Unknown keys, raw error text, stacks,
provider responses, recipients, and metadata fail validation.

## 14. Privacy exclusions

Both contracts and schemas exclude:

- email addresses and other recipient snapshots;
- full Job/submission content snapshots;
- employer passwords, tokens, cookies, authorization data, or verification
  evidence;
- raw requests, IP addresses, and user agents;
- moderation-internal notes;
- applicant information;
- payment information;
- provider credentials/responses;
- Mongo errors, raw errors, and stack traces;
- unrestricted payloads or metadata.

Sensitive-term scans found only deliberate deny-list assertions in the two test
files. They found no assigned secret, credential, connection string, recipient
address, or applicant value.

## 15. Index declarations

Exactly seven indexes are declared:

1. unique, non-sparse `{ deduplicationKey: 1 }`;
2. `{ status: 1, availableAt: 1, createdAt: 1, _id: 1 }`, partial for
   `pending` and `retryable_failed`;
3. `{ status: 1, leaseExpiresAt: 1, _id: 1 }`, partial for `processing`;
4. `{ submissionId: 1, createdAt: 1 }`;
5. `{ aggregateType: 1, aggregateId: 1, createdAt: -1 }`;
6. `{ status: 1, processedAt: -1 }`, partial for `processed`;
7. `{ status: 1, terminalFailedAt: -1 }`, partial for `terminal_failed`.

The overlapping retry-only index was not added. No TTL index exists. No index
was created, synchronized, initialized, ensured, or applied.

## 16. `autoIndex`/`autoCreate` safety

The schema explicitly sets:

```text
autoIndex: false
autoCreate: false
```

It also uses `strict: 'throw'` and timestamps. Import verification left
`mongoose.connection.readyState` at `0`. Model creation registers only the
dormant schema/model in process memory; it performs no connection, query,
collection creation, or index operation.

## 17. Dormancy and runtime isolation

Runtime reference scans confirm:

- no `index.js` import;
- no worker or scheduler import;
- no controller, route, or middleware import;
- no transaction-service import or modification;
- no payment, webhook, public-query, or frontend reference;
- no existing barrel export;
- no environment flag or startup registration;
- no Redis, queue, email, SMTP, notification, or provider import;
- no module-scope query, timer, listener, connection, or session.

Production references are confined to the three new implementation modules.
The two new tests import those modules. Existing audit/report references are
documentation only.

## 18. Error mapping

- invalid contract: `OUTBOX_CONTRACT_INVALID`;
- unsupported type: `OUTBOX_TYPE_UNSUPPORTED`;
- unsupported version constant reserved:
  `OUTBOX_VERSION_UNSUPPORTED`;
- duplicate batch/database key:
  `OUTBOX_DEDUPLICATION_CONFLICT`.

Contract, duplicate, Mongoose validation, cast, and strict-mode failures use
bounded messages without identifiers, keys, index/collection names, raw values,
or serialized stack details. The repository does not log.

Confirmed duplicate-key errors are mapped safely. Other driver failures are
re-thrown unchanged so Mongoose transaction retry labels and
`hasErrorLabel(...)` semantics remain intact. The accepted transaction service
still maps unexpected failures to its established public `TRANSACTION_FAILED`.

## 19. Model tests and assertion count

```text
node src/__tests__/publishingOutboxModel.test.js
```

Result: 1 suite, 100 assertions, 0 failures.

Coverage includes import dormancy, strict schema, enum/bounds inventory,
type-specific identifiers/audiences, exact deduplication, privacy rejection,
all lifecycle states, failure/lease/time invariants, exact seven-index
inventory, disabled auto-index/auto-create, no TTL, and no delivery methods.

## 20. Repository tests and assertion count

```text
node src/__tests__/publishingOutboxRepository.test.js
```

Result: 1 suite, 132 assertions, 0 failures.

Coverage includes accepted service inputs, pure mapping, session validation,
same-session identity, one ordered create, no write on any malformed batch,
strict hostile-object rejection, input immutability, duplicate redaction,
Mongoose validation mapping, transient-label preservation, fake rollback,
future paid compatibility, import isolation, absence of delivery/queue methods,
and bounded return metadata.

## 21. Regression results

Accepted publishing regressions:

```text
transactionalFreeBetaSubmissionService.test.js
publishingSubmissionSupportModels.test.js
employerSubmissionEligibility.test.js
reviewerCorrectionEligibility.test.js
freeBetaPublishingPolicy.test.js
jobPublicationSubmissionModel.test.js
publishingQuotaFoundations.test.js
```

Result: 7 suites, 313 assertions, 0 failures.

Canonical schema/write-boundary regressions:

```text
jobCanonicalPublicationSchema.test.js
canonicalJobWriteBoundary.test.js
```

Result: 2 suites, 516 assertions, 0 failures.

Total verification: 11 suites, 1,061 assertions, 0 failures.

## 22. Lint/build/formatting results

- Server lint: passed with zero errors.
- Client lint: passed with zero errors and 52 pre-existing warnings.
- Client production build: passed in no-write mode; 1 existing dynamic/static
  import chunk warning.
- Prettier: passed for all six new files.
- `git diff --check`: passed.
- Direct trailing-whitespace scan: passed.
- Sensitive-value scan: passed; deny-list terms occur only in tests.
- Import-isolation scan: passed.
- Model index inventory: exactly seven authorized indexes, no TTL.
- Model middleware inventory: one database-free validation hook.

No unrelated warning was modified.

## 23. Remaining blockers before runtime wiring

The following remain deliberately unresolved:

1. disposable replica-set transaction and unique-index race proof;
2. controlled live index verification and rollout;
3. production transaction-capable topology proof;
4. unknown-commit resolution across submission and both intent keys;
5. external delivery duplicate/truthfulness contract;
6. authoritative publishing-review staff recipient policy;
7. suspended-employer receipt policy;
8. lease worker and type/version delivery handler;
9. retention, terminal review, privacy deletion, and manual replay approval;
10. complete Mongoose submission adapter and separately approved runtime
    composition.

No blocker requires broadening this dormant foundation.

## 24. Next safe phase

The next safe action is a read-only acceptance audit of this six-file dormant
foundation. It must verify the strict model/repository behavior, source
isolation, test evidence, and exact scope before any checkpoint commit.

Worker implementation, delivery/recipient implementation, Mongoose submission
adapter work, index rollout, and runtime composition are not authorized.

## 25. Preservation statement

- Six new files only: Yes.
- Existing application files changed: No.
- Existing models changed: No.
- H2A/H2B-A changed: No.
- Canonical Job schema/write boundaries changed: No.
- Accepted transaction service changed: No.
- `BackgroundJob` changed: No.
- Existing notification models changed: No.
- Worker implemented: No.
- Delivery handler implemented: No.
- Recipient resolver implemented: No.
- Controllers/routes/middleware changed: No.
- Workers/schedulers/startup changed: No.
- Runtime import or wiring added: No.
- Startup behavior added: No.
- Notification/SMTP/email behavior changed: No.
- Public queries changed: No.
- Payment/webhook behavior changed: No.
- Frontend/theme/responsiveness changed: No.
- Authentication/RBAC weakened: No.
- Security/privacy weakened: No.
- Configuration/dependencies changed: No.
- MongoDB connection performed: No.
- Production data read/written: No.
- Index created/synchronized/applied: No.
- Migration performed: No.
- Files staged: No.
- Commit performed: No.
- Push performed: No.
- Deployment performed: No.
- Mongoose submission adapter started: No.
- Runtime outbox wiring started: No.
- Production acceptance report changed: No.

STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED
