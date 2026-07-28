# Free Beta Transactional Submission Core Report

**Phase:** E.1F-H2B-A
**Policy:** `free_beta` / `free-beta-2026-01`
**Runtime status:** Dormant; no route, controller, startup, worker, or production repository wiring

## Exact files changed

- `server/src/models/EmployerPostingRulesAcknowledgement.js`
- `server/src/models/JobModerationEvent.js`
- `server/src/services/publishing/EmployerSubmissionEligibility.js`
- `server/src/services/publishing/ReviewerCorrectionEligibility.js`
- `server/src/services/publishing/TransactionalFreeBetaSubmissionService.js`
- `server/src/__tests__/publishingSubmissionSupportModels.test.js`
- `server/src/__tests__/employerSubmissionEligibility.test.js`
- `server/src/__tests__/reviewerCorrectionEligibility.test.js`
- `server/src/__tests__/transactionalFreeBetaSubmissionService.test.js`
- `docs/FREE_BETA_TRANSACTIONAL_SUBMISSION_CORE_REPORT.md`

No H2A file or existing runtime file changed.

H2B-A-C2 modified only:

- `server/src/services/publishing/ReviewerCorrectionEligibility.js`;
- `server/src/services/publishing/TransactionalFreeBetaSubmissionService.js`;
- `server/src/__tests__/reviewerCorrectionEligibility.test.js`;
- `server/src/__tests__/transactionalFreeBetaSubmissionService.test.js`;
- `docs/FREE_BETA_TRANSACTIONAL_SUBMISSION_CORE_REPORT.md`.

## Service boundary and injected dependencies

`createTransactionalFreeBetaSubmissionService` is a provider-neutral factory. It
does not import Express, controllers, the current `Job` model, payment code,
SMTP, or notification controllers.

It requires injected:

- transaction runner;
- employer repository;
- canonical job repository;
- submission repository;
- acknowledgement repository;
- moderation-event repository;
- H2A-compatible quota usage service;
- H2A serialized quota guard;
- transaction-bound notification outbox;
- posting-rules registry;
- strict content-snapshot builder;
- request-fingerprint builder;
- identifier factory;
- clock.

The factory fails with `CANONICAL_JOB_REPOSITORY_REQUIRED` when the compatible
job repository contract is absent. No production adapter or silent fallback to
the current `Job` model exists.

## Transaction order

Inside the injected transaction boundary, the service:

1. validates the command, posting-rules acknowledgement, and idempotency key;
2. loads the authenticated employer and evaluates current eligibility;
3. loads the owned canonical job and verifies exact ownership;
4. derives the quota owner through `QuotaOwnerResolver`;
5. acquires the serialized quota guard;
6. builds the strict content snapshot and request fingerprint;
7. resolves same-owner idempotent replay or key conflict;
8. validates canonical source state and publication version;
9. validates the current posting-rules version/digest;
10. computes correction exemption treatment and classifies any denial as
    structurally fatal or chargeable;
11. reads Free Beta quota usage and enforces charged rolling limits, including
    for chargeable correction fallbacks;
12. computes active-major-edit slot release without applying an approval gate;
13. preallocates acknowledgement, submission, and event identifiers;
14. creates the acknowledgement and immutable pending submission;
15. invokes canonical job compare-and-set to `pending_review`;
16. appends the `submitted` moderation event;
17. persists two deduplicated notification intents through the outbox;
18. returns only after the transaction runner commits.

Injected transaction failures roll back all staged records, job compare-and-set,
guard writes, and outbox intents in the test harness.

## Employer eligibility predicate

The pure predicate inspects only current `Employer` fields:

- `accountStatus`;
- `verified`;
- `verificationLevel`;
- `companyName`;
- `email`;
- `companyDescription`;
- `industry`;
- `location`, `city`, and `province`;
- optional `website`.

Eligible means:

- `accountStatus === "active"`;
- `verified === true`;
- `verificationLevel` is `verified` or `trusted`;
- company name, syntactically valid email, company description, and industry
  are non-empty;
- at least one location/city/province value is non-empty;
- website is absent or a valid HTTP(S) URL.

Missing or unknown account status fails closed as `ACCOUNT_DISABLED`. Suspended
accounts return `ACCOUNT_SUSPENDED`. Missing legacy verification level is
treated as basic and returns `EMPLOYER_NOT_VERIFIED`.

Website/domain is advisory and not mandatory. The current Employer schema has
no separate `emailVerified` field. Default beta evaluation therefore does not
invent or require it; the reserved capability can produce
`EMPLOYER_EMAIL_NOT_VERIFIED` only when explicitly enabled by a later supported
schema/flow. An employer may be active but unverified because those current
fields are independent, and submission remains blocked.

The verification snapshot contains safe normalized company/domain and boolean
profile results, never the full email, password, staff notes, phone, or
verification evidence.

## Idempotency

Keys are trimmed printable ASCII, 16–128 characters. The service never logs or
returns a full key.

- Same quota owner, key, and fingerprint returns the stored accepted semantic
  result with `idempotentReplay: true`.
- Same owner/key with another fingerprint returns
  `409 IDEMPOTENCY_KEY_REUSED`.
- Replay creates no second acknowledgement, submission, event, or outbox
  intent.
- Rejections before acceptance create no idempotency record.
- Unknown commit outcomes are not automatically retried; the future adapter
  must query the same unique owner/key before another attempt.

## Charged quota and active capacity

The service selects `free_beta` and `free-beta-2026-01` from H2A constants.
Client plan, policy, owner, state, visibility, moderation, and payment fields
are rejected.

Charged submissions enforce:

- `429 ROLLING_24H_LIMIT` with exact `nextEligibleAt`;
- `429 ROLLING_30D_LIMIT` with exact `nextSlotAt`;
- display timezone `Asia/Karachi`;
- no other employer information.

An exempt reviewer correction bypasses only those charged rolling gates.
Missing or mismatched cycle evidence denies the exemption but remains an
ordinary charged correction. It proceeds when charged quota is available and
returns the applicable rolling-limit error without committed writes when quota
is exhausted.

Five active Free Beta jobs never block submission acceptance. Approval capacity
is not enforced here. An accepted active major edit passes
`releaseActiveFreeSlot: true` to the injected compare-and-set and projects
active usage from 5 to 4 only when the transaction commits.

## Reviewer-correction exemption

The pure evaluator requires:

- a rejected immediate predecessor and matching rejection/changes-requested
  event;
- same job;
- explicit moderation-cycle IDs on both the preceding submission and
  moderation event, with an exact match;
- submission at or before the seven-day boundary;
- no earlier exempt correction in the cycle;
- a non-empty allow-listed `requestedFieldPaths`;
- strict normalized content snapshots;
- changes limited to requested fields;
- no deterministic core-vacancy field change.

It returns stable blocker codes and a deterministic changed-field list.
Absent, null, empty, whitespace, malformed, or otherwise non-normalizable cycle
evidence emits `MODERATION_CYCLE_MISSING`. Two valid unequal cycle identities
emit `MODERATION_CYCLE_MISMATCH`. Both deny only the exemption and continue as
charged corrections.

The exact service classification is:

- fatal: `NO_PREVIOUS_REJECTION`, `NOT_IMMEDIATE_PREDECESSOR`,
  `DIFFERENT_JOB`, and `INVALID_CONTENT_SNAPSHOT`;
- chargeable: `MODERATION_CYCLE_MISSING`, `MODERATION_CYCLE_MISMATCH`,
  `CORRECTION_WINDOW_EXPIRED`, `EXEMPT_CORRECTION_ALREADY_USED`,
  `NO_REQUESTED_CORRECTION_FIELDS`, `UNREQUESTED_FIELD_CHANGED`,
  `CORE_VACANCY_CHANGED`, and `NO_REQUESTED_FIELD_CHANGED`.

Fatal evidence cannot safely establish the same owned correction relationship
and returns `CORRECTION_NOT_EXEMPT` before writes. Chargeable blockers keep
`submissionKind: correction`, set `quotaCharged: true`, clear the exemption
reason, and follow normal rolling quota enforcement.

The correction history is:

1. the original implementation allowed missing event-cycle evidence to receive
   a quota exemption;
2. H2B-A-C closed that bypass but treated missing and unequal cycles alike and
   rejected both before quota evaluation;
3. H2B-A-C2 distinguishes missing from unequal evidence and applies the
   approved charged-correction fallback.

A valid same-cycle correction remains exempt when every other exemption rule
passes.

Core comparison is deliberately conservative and field-based; there is no AI,
semantic similarity, or raw request comparison.

## Support models

### EmployerPostingRulesAcknowledgement

The strict append-only schema records employer, job, submission, policy/rules
version and digest, exact `accepted: true`, controlled acceptance/creation
times, and optional 64-character privacy hashes. It has no raw IP, raw user
agent, request object, credentials, tokens, cookies, or `Mixed` metadata.

Indexes:

- unique submission ID;
- employer acceptance history;
- rules-version audit history.

### JobModerationEvent

The strict append-only schema allow-lists actor types, actions, states,
requested correction fields, safe reason fields, content hash, and structured
quota/submission metadata. Employer/staff actors require an actor ID.
Rejection/changes-requested events require a reason code and safe employer
text. Both decision actions require `metadata.moderationCycleId`, and
`changes_requested` also requires requested fields.

Indexes cover job, submission, employer, and action histories/queues.
The employer-safe projection omits internal moderation text and metadata.

## Canonical job repository interface

The injected repository must provide:

```text
getOwnedJobForSubmission({ employerId, jobId, session })

compareAndSetPendingReview({
  employerId,
  jobId,
  expectedPublicationVersion,
  expectedSourceState,
  submissionId,
  submissionKind,
  contentSnapshot,
  releaseActiveFreeSlot,
  session
})
```

The compare-and-set must atomically fail for ownership change, stale version,
source-state change, or another pending submission. H2B-A does not implement
this interface against the current `Job` schema.

## Outbox boundary

No email or notification is sent directly. The transaction-bound outbox
receives:

- `employer_submission_received`;
- `admin_job_review_requested`.

Each uses `<submissionId>:<intentType>` as a stable deduplication key.

## Stable errors

Implemented applicable codes include:

- `INVALID_SUBMISSION_COMMAND`;
- `INVALID_IDEMPOTENCY_KEY`;
- `EMPLOYER_NOT_FOUND`;
- `EMPLOYER_NOT_VERIFIED`;
- `EMPLOYER_PROFILE_INCOMPLETE`;
- `ACCOUNT_SUSPENDED`;
- `ACCOUNT_DISABLED`;
- `JOB_NOT_FOUND`;
- `JOB_NOT_OWNED`;
- `JOB_STATE_NOT_SUBMITTABLE`;
- `JOB_VERSION_CONFLICT`;
- `SUBMISSION_ALREADY_PENDING`;
- `IDEMPOTENCY_KEY_REUSED`;
- `POSTING_RULES_VERSION_CHANGED`;
- `POSTING_RULES_NOT_ACCEPTED`;
- `ROLLING_24H_LIMIT`;
- `ROLLING_30D_LIMIT`;
- `CORRECTION_NOT_EXEMPT`;
- `TRANSACTION_FAILED`;
- `CANONICAL_JOB_REPOSITORY_REQUIRED`.

Errors expose only status, stable code, safe message, and allow-listed safe
details. Mongo errors, stacks, staff notes, snapshots, credentials, and other
employer IDs are not exposed.

## Privacy and security controls

- Employer identity is accepted only as authenticated context input.
- Job ownership is verified independently by the repository result and loaded
  job owner.
- Quota owner, plan, policy, state, quota treatment, and moderation cycle are
  server-derived.
- Commands and posting-rules objects reject unknown fields.
- Snapshots and event metadata are strict and allow-listed.
- Raw requests, raw IP/user-agent values, payment data, applicant data, and
  authentication data are not accepted or persisted.
- No key, snapshot, verification evidence, or internal moderation reason is
  logged.
- Unknown state and missing canonical repositories fail closed.
- Every accepted result is `pending_review`; no operation makes a job public.

## Tests

New focused suites:

- `publishingSubmissionSupportModels.test.js` — 30 assertion call sites;
- `employerSubmissionEligibility.test.js` — 26;
- `reviewerCorrectionEligibility.test.js` — 34;
- `transactionalFreeBetaSubmissionService.test.js` — 105.

New total: 4 suites, 195 assertion call sites, 0 failures.

H2A regression suites:

- `freeBetaPublishingPolicy.test.js` — 42;
- `jobPublicationSubmissionModel.test.js` — 31;
- `publishingQuotaFoundations.test.js` — 45.

H2A total: 3 suites, 118 assertion call sites, 0 failures.

Existing employer/auth suites:

- `employerDashboardMetrics.test.js` — 7;
- `employerPostJobValidation.test.js` — 29;
- `employerAuthRealmIsolation.test.js` — 5;
- `authRealm.test.js` — 17;
- `duplicateEmailUserIdIndexes.test.js` — 9.

Existing total: 5 suites, 67 assertion call sites, 0 failures.

Overall: 12 suites, 380 assertion call sites, 0 failures.

Server lint passes with zero errors. Client lint passes with zero errors and the
same 52 pre-existing warnings. The client production build passes; existing
chunk-size/dynamic-import warnings remain.

## Runtime reference result

No existing controller, route, middleware, startup file, worker, webhook,
public query, employer activation flow, frontend client, or payment module
imports or executes H2B-A.

The only outside textual reference is the already-dormant H2A Mongoose
`ref: "EmployerPostingRulesAcknowledgement"` on
`JobPublicationSubmission.rulesAcknowledgementId`. A Mongoose ref string does
not import or register the new model.

## Limitations and next safe phase

- The current `Job` schema still lacks canonical publication state/version
  fields and remains unchanged.
- No Mongo repository adapter, live transaction, index deployment, route,
  controller, worker, or outbox model was added.
- Model index declarations remain dormant until an authorized runtime imports
  and initializes the models.
- Transaction behavior is verified with injected in-memory fakes, not a live
  Mongo transaction.
- Correction scope comparison is deterministic and conservative; semantic
  equivalence is intentionally not inferred.
- Current employer email verification is unsupported as a separate capability.
- Paid publishing, approval, expiry, public-read cutover, and migration remain
  outside this phase.

The next safe phase is a separately authorized dormant Mongoose submission
adapter implementation. It must not wire routes or modify the current Job model
without explicit scope.

## Preservation statement

- No route or controller is wired.
- No existing `Job` or `Employer` model was modified.
- No current publication behavior changed.
- No public query changed.
- No payment or webhook code changed.
- No frontend, theme, or responsive behavior changed.
- No migration exists.
- No database operation occurred.
- No production data changed.
- No commit, push, or deployment occurred.
- The service remains dormant without an injected canonical job repository.
- No Mongoose production adapter was started.
- H2B-B was not started.
