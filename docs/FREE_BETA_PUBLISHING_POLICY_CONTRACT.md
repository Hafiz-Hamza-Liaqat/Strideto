# Free Beta Publishing Policy Contract

**Phase:** E.1F-H1
**Decision date:** 2026-07-28
**Status:** Approved domain contract for implementation planning
**Policy version:** `free-beta-2026-01`
**Consistency amendment:** Phase E.1F-H1A incorporated 2026-07-28
**Scope:** First six months of Strideto Free Beta

This document is normative for the next implementation slice. It designs the domain and API contracts but does not implement runtime behavior.

## 1. Approved policy

- Employers may create and edit unlimited private drafts without payment or quota use.
- A verified, active employer may have at most one **quota-charged** accepted free publication submission in any rolling 24-hour period.
- A valid charged submission consumes quota only when it is atomically accepted into `pending_review`.
- A free employer may have at most 5 simultaneously `active` jobs.
- A free employer may have at most 10 quota-charged accepted free publication submissions in any rolling 30-day period.
- Rejection, closure, or expiry does not reverse a consumed daily or rolling-30-day submission.
- One reviewer-requested correction may be quota-exempt in a moderation cycle when it meets the exact requirements in section 4.5. All other corrections are charged.
- Every free job and every first employer job requires manual approval.
- Paid publication is disabled throughout beta. If paid plans are displayed, they are non-actionable and labelled `Coming later`.
- An approved free listing is public for 30 days. An earlier application deadline ends applications but does not have to remove the archive/detail page.
- Closing an active job releases an active slot. It does not restore submission quota.
- Expired jobs leave public lists, retain their URL as an archive, reject applications, and retain applications/analytics.
- Renewal or reposting is a new submission and consumes quota when accepted.
- The beta quota owner is `employerId`. Company name, domain, verification, email, and account status are retained for manual anti-abuse review. This does not eliminate multi-account company bypass.
- The quota service must isolate owner resolution so `employerId` can later be replaced by `organizationId`.

## 2. Normative terminology and time

- **Accepted submission:** a valid request whose transaction commits a `JobPublicationSubmission` in `pending_review` and changes the job to `pending_review`.
- **Rolling 24 hours:** the half-open interval `(now - 24 hours, now]`, evaluated from database UTC timestamps.
- **Rolling 30 days:** the half-open interval `(now - 30 days, now]`, evaluated from database UTC timestamps.
- **Active slot:** one job whose canonical publication state is `active`.
- **Projected active usage:** `currentActiveUsage - slotsReleasedByTransition + slotsAcquiredByTransition`.
- **Public job:** exactly a job with state `active`, `publishedAt <= now`, `visibleUntil > now`, and no administrative visibility block.
- **Application-open job:** a public job for which `applicationsCloseAt > now`.
- **Major edit:** a change to title, company identity, description, requirements, application URL/email/mode, salary, location/work mode, category/type, or deadline.
- **Quota owner:** an opaque `{ ownerType, ownerId }` returned by `QuotaOwnerResolver`. For beta it is `{ ownerType: "employer", ownerId: employerId }`.
- **Idempotency key:** an opaque client-generated request identifier stable across retries of one logical submission.

All persisted instants are UTC BSON dates. User-facing dates are rendered with an explicit timezone; employer quota screens default to `Asia/Karachi`. The timezone does not alter rolling-window calculations.

## 3. Canonical job publication state

### 3.1 Job fields

The `Job` publication projection must contain:

| Field | Type | Required | Contract |
|---|---|---:|---|
| `publicationState` | enum | yes | `draft`, `pending_review`, `active`, `rejected`, `closed`, `expired` |
| `employerId` | ObjectId | for employer jobs | Owner account; immutable after first submission |
| `currentSubmissionId` | ObjectId/null | conditional | Latest accepted submission under review or last terminal submission |
| `lastApprovedSubmissionId` | ObjectId/null | conditional | Submission that authorized the current/last public version |
| `publishedAt` | Date/null | conditional | Set on first approval of the current publication term |
| `visibleUntil` | Date/null | conditional | `publishedAt + 30 days` for Free Beta |
| `applicationsCloseAt` | Date/null | conditional | `min(valid deadline, visibleUntil)`; otherwise `visibleUntil` |
| `closedAt` | Date/null | conditional | Set when closed |
| `expiredAt` | Date/null | conditional | Set by expiry worker |
| `rejectionSummary` | object/null | conditional | Latest reason code, safe employer-facing text, event ID, decision time |
| `slug` | string | yes | Server-generated current canonical slug |
| `slugFrozenAt` | Date/null | conditional | Set during first approval; employer edits never change frozen slug |
| `policyVersion` | string/null | conditional | Policy under which current submission was accepted |
| `publicationVersion` | integer | yes | Optimistic concurrency/version number, default `0` |

Existing `status`, `approvalStatus`, `planType`, `expiresAt`, and `paidUntil` remain migration inputs only. After cutover they must not independently determine public visibility.

### 3.2 State invariants

1. `draft` is never public and has no active slot.
2. `pending_review` is never public in the initial beta implementation.
3. `active` is the only public-list state and consumes exactly one active slot.
4. `active` requires `lastApprovedSubmissionId`, `publishedAt`, `visibleUntil`, `applicationsCloseAt`, and frozen slug.
5. `rejected`, `closed`, and `expired` are not public-list states and consume no active slot.
6. `expired` requires `expiredAt`; `closed` requires `closedAt`.
7. `visibleUntil = publishedAt + 30 days` for a Free Beta approval. Resubmitting corrections before first approval does not start visibility.
8. A major edit accepted from `active` moves the job to `pending_review` and temporarily removes it from public reads. The future revision model may keep the last approved revision live, but the first implementation must fail safely.
9. Minor edits may not alter fields classified as major and must not change publication state.
10. Employer ownership cannot be reassigned after the first accepted submission.
11. Public list/detail/apply queries must derive behavior from this canonical state and dates, not legacy approval fields.
12. Payment states never map directly to a beta publication state.

### 3.3 Indexes

- `{ employerId: 1, publicationState: 1, updatedAt: -1 }`
- `{ publicationState: 1, visibleUntil: 1 }`
- `{ publicationState: 1, applicationsCloseAt: 1 }`
- `{ currentSubmissionId: 1 }`, sparse
- `{ lastApprovedSubmissionId: 1 }`, sparse
- existing text/search indexes may remain, but public queries must include canonical public predicates.

## 4. `JobPublicationSubmission`

### 4.1 Purpose and ownership

`JobPublicationSubmission` is the immutable quota and review ledger. The employer owns the underlying job; the submission is readable by that employer and authorized moderators. Employers cannot update or delete submission records. Only domain services may append state transitions through moderation events and update the submission's controlled state projection.

### 4.2 Proposed schema

| Field | Type | Required | Contract |
|---|---|---:|---|
| `_id` | ObjectId | yes | Generated before transaction references are written |
| `jobId` | ObjectId | yes | Job being submitted |
| `employerId` | ObjectId | yes | Authenticated employer at acceptance |
| `quotaOwnerType` | enum | yes | Beta: `employer`; future: `organization` |
| `quotaOwnerId` | ObjectId | yes | Beta: employer ID |
| `submissionKind` | enum | yes | `initial`, `correction`, `major_edit`, `renewal`, `repost` |
| `planCode` | enum | yes | Beta: `free_beta` only |
| `policyVersion` | string | yes | `free-beta-2026-01` |
| `state` | enum | yes | `pending_review`, `approved`, `rejected`, `withdrawn`, `expired`, `superseded` |
| `acceptedAt` | Date | yes | Database time at quota consumption |
| `reviewedAt` | Date/null | no | Terminal moderation decision time |
| `approvedAt` | Date/null | no | Approval time |
| `rejectedAt` | Date/null | no | Reject/request-changes time |
| `idempotencyKey` | string | yes | 16–128 characters; opaque |
| `requestFingerprint` | string | yes | Server hash of canonical submit intent |
| `correctionOfSubmissionId` | ObjectId/null | conditional | Required for `correction`; must identify the immediately preceding rejected submission |
| `moderationCycleId` | ObjectId | yes | New for a charged submission cycle; inherited only by its one eligible exempt correction |
| `quotaCharged` | boolean | yes | Whether this accepted submission counts in rolling 24-hour and 30-day usage |
| `quotaExemptionReason` | enum/null | conditional | `reviewer_requested_correction` for the beta exception; `legacy_migration_non_chargeable` only for audited migration records; otherwise null |
| `jobRevision` | integer | yes | Job content version reviewed |
| `contentSnapshot` | object | yes | Sanitized immutable major-field snapshot/digest |
| `rulesAcknowledgementId` | ObjectId | yes | Versioned acknowledgement created in same transaction |
| `verificationSnapshot` | object | yes | Employer verified/account status/email/company/domain at acceptance |
| `quotaSnapshot` | object | yes | Counts before/after, next eligibility, limits |
| `moderationSummary` | object/null | no | Latest action/event/reason, safe for owner projection |
| `createdAt`, `updatedAt` | Date | yes | Mongoose timestamps |

`contentSnapshot` must include the normalized major fields and a `contentHash`; it must not contain secrets. `verificationSnapshot` is evidence, not live authorization—the submit transaction must also query the current Employer record.

`verificationSnapshot` contains only the submission-relevant projection: `verified`, `verificationLevel`, `accountStatus`, normalized company name, email-domain/presence/validity results (not the full private email), presence/validity results for required profile fields, optional normalized website domain, predicate capability version, and eligibility result codes. It must not copy passwords, verification evidence, staff notes, phone, IP/user-agent values or hashes, or internal risk scores. Hashes remain pseudonymous and are not treated as anonymous.

### 4.3 Indexes

- unique `{ quotaOwnerType: 1, quotaOwnerId: 1, idempotencyKey: 1 }`
- `{ quotaOwnerType: 1, quotaOwnerId: 1, acceptedAt: -1 }`
- `{ quotaOwnerType: 1, quotaOwnerId: 1, planCode: 1, acceptedAt: -1 }`
- `{ jobId: 1, acceptedAt: -1 }`
- `{ state: 1, acceptedAt: 1 }` for moderation queues
- `{ employerId: 1, acceptedAt: -1 }`
- unique `{ rulesAcknowledgementId: 1 }`
- `{ correctionOfSubmissionId: 1 }`, sparse
- `{ moderationCycleId: 1, acceptedAt: 1 }`
- unique partial `{ moderationCycleId: 1 }` where `submissionKind="correction"` and `quotaCharged=false`

### 4.4 Invariants

- Every committed row with `quotaCharged=true` consumes one daily and one rolling-30-day unit, regardless of later state. Rows with `quotaCharged=false` remain immutable/auditable but are excluded from both counts.
- `acceptedAt` is immutable and must use database/server time, never a client timestamp.
- A job may have only one `pending_review` submission at a time. Enforce with a unique partial index on `{ jobId: 1 }` where `state="pending_review"`.
- `approvedAt` and `rejectedAt` are mutually exclusive.
- An approval/rejection operation uses compare-and-set from `pending_review`; repeat decisions return the existing result without a second event/notification.
- Major edits, renewals, reposts, and corrections that do not satisfy section 4.5 are charged new submissions.
- `correctionOfSubmissionId` must belong to the same job and identify its immediately preceding rejected submission.
- A quota-exempt correction must retain the predecessor's `moderationCycleId`; a charged correction starts a new moderation cycle.
- The content reviewed by moderators is the immutable `contentSnapshot` matching `jobRevision`.

### 4.5 Reviewer-requested correction exemption

A `correction` is quota-exempt only when every condition is true:

1. `correctionOfSubmissionId` is the same job's immediately preceding submission.
2. That predecessor is `rejected`, with a latest moderation action of `rejected` or `changes_requested`.
3. Database time is no later than `reviewedAt + 7 days`.
4. The candidate revision changes only fields identified by the reviewer plus non-substantive formatting/typo fixes.
5. It does not change core vacancy identity: company identity, materially different title/role, unrelated description/scope, application destination ownership/domain, category, major location/work-mode, or renewal/repost intent.
6. No quota-exempt correction already exists for that `moderationCycleId`.
7. Employer eligibility, posting rules, backend validation, safety checks, ownership, state, and idempotency all pass.

The server, not the client, calculates exemption eligibility from the predecessor, moderation event, structured requested field paths, content diff, and time. Client `quotaExempt` claims are ignored.

When all conditions pass, set `quotaCharged=false`, `quotaExemptionReason=reviewer_requested_correction`, and inherit the predecessor's `moderationCycleId`. Otherwise the correction is a normal charged submission with a new `moderationCycleId`, subject to daily/monthly limits. A repeated correction loop can therefore receive at most one exempt acceptance per cycle; subsequent attempts are charged or blocked by charged quota.

## 5. Quota usage service

### 5.1 Boundary

Define a provider-neutral interface:

```text
QuotaOwnerResolver.resolve(employer) -> { ownerType, ownerId }

PublishingQuotaService.getUsage({ ownerType, ownerId, now })
PublishingQuotaService.acceptSubmission({
  employerId, jobId, submissionKind, idempotencyKey,
  requestFingerprint, rulesVersion, expectedJobVersion,
  correctionOfSubmissionId
})
PublishingQuotaService.assertApprovalCapacity({ ownerType, ownerId, submissionId })
```

No controller may query counts and then write independently. `acceptSubmission` owns validation, quota evaluation, acknowledgement creation, submission creation, job state change, audit event, and commit.

### 5.2 Serialization guard

Use an `EmployerPublishingQuotaGuard` collection:

| Field | Type | Contract |
|---|---|---|
| `_id` | string | Deterministic `"<ownerType>:<ownerId>"`, for example `employer:507f...` |
| `ownerType` | enum | `employer`; future `organization` |
| `ownerId` | ObjectId | ID within the named owner namespace |
| `revision` | integer | Incremented in every submission/active-slot transaction |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: the primary key uniquely enforces the namespaced identity; also index `{ ownerType: 1, ownerId: 1 }` as unique for direct lookup and consistency verification.

Every quota-sensitive transaction first performs an actual write (`$inc: { revision: 1 }`, upsert where supported safely) to this guard. Concurrent transactions for the same owner then conflict and retry from a fresh snapshot. A read-only count inside a Mongo transaction is not sufficient to prevent phantom submissions.

`guardId(ownerType, ownerId)` allow-lists the owner type, requires a canonical valid ObjectId string, lowercases that 24-character hex representation, and returns `${ownerType}:${canonicalOwnerId}`. Clients cannot supply this key.

When quota ownership later moves to an organization, create/use `organization:<organizationId>` guards and backfill/reassign submission owner fields through an approved migration. Employer and organization IDs cannot collide because the type is part of `_id`. Do not rename an employer guard in place or merge usage without an explicit organization migration/reconciliation policy.

### 5.3 Usage calculation

At database time `now`:

- `daily.used = count(submissions where quotaCharged=true and acceptedAt > now-24h)`
- `daily.limit = 1`
- `daily.nextEligibleAt = null` when unused; otherwise earliest qualifying `acceptedAt + 24h`
- `rolling30.used = count(submissions where quotaCharged=true and acceptedAt > now-30d)`
- `rolling30.limit = 10`
- `rolling30.nextSlotAt = null` when under limit; otherwise earliest qualifying `acceptedAt + 30d`
- `active.used = count(jobs where publicationState=active)`
- `active.limit = 5`
- `active.remaining = max(0, limit-used)`
- `active.hasCapacity = active.used < active.limit`

All comparisons use `$gt` for the lower boundary so an event becomes ineligible exactly at `acceptedAt + window`.

For every transition:

```text
projectedActiveUsage =
  currentActiveUsage
  - slotsReleasedByTransition
  + slotsAcquiredByTransition
```

The transaction must assert non-negative slot deltas and an expected source state. Initial, correction, renewal, and repost submission release/acquire `0/0`; active major-edit acceptance uses `1/0`; approval uses `0/1`; close from active and expiry use `1/0`. Pending-review jobs do not reserve slots.

### 5.4 Submit transaction

In one database transaction:

1. Resolve and write-lock the quota guard.
2. Check for existing `{owner,idempotencyKey}`.
   - Same fingerprint: return it; do not repeat validation, events, or notifications.
   - Different fingerprint: fail `409 IDEMPOTENCY_KEY_REUSED`.
3. Load Employer and owned Job.
4. Run the deterministic `isEmployerEligibleToSubmit` predicate in section 5.6 and reject with all stable blocker codes.
5. Require allowed source state and `expectedJobVersion`.
6. Run backend field validation, URL/category policy checks available in that implementation slice, and posting-rules version validation.
7. If this is a correction, calculate the section 4.5 exemption inside the transaction. Set `quotaCharged`, exemption reason, correction predecessor, and moderation cycle server-side.
8. Count quota-charged rolling 24-hour and rolling 30-day usage. Count current active usage for the projected-usage audit snapshot.
9. For a charged submission, reject when daily used ≥1 or monthly used ≥10. An exempt correction bypasses those two count gates only.
10. Calculate projected active usage. Do **not** reject a submission solely because current/projected active usage is 5 or more; active capacity is enforced at approval. A major edit from an active job must be accepted at 5/5 when all submission gates pass because it atomically releases its own slot (`5 - 1 + 0 = 4`).
11. Create posting-rules acknowledgement.
12. Create submission as `pending_review`.
13. Change job to `pending_review`, link submission, increment `publicationVersion`, and clear stale rejection projection. An active major edit releases exactly one active slot by this same state change.
14. Append `submitted` moderation/audit event, including `quotaCharged`, exemption, cycle, and projected usage.
15. Commit.
16. Enqueue the employer/admin notifications through an outbox tied to the transaction.

Validation/quota failure aborts without creating an acknowledgement, submission, state change, or quota use. Transaction/server failure also consumes nothing.

### 5.5 Approval transaction and active slots

Approval must write-lock the same quota guard, reload the pending submission/job, and count active jobs. If active count is already 5, leave the job `pending_review`, append no approval event, and return `409 ACTIVE_LIMIT_REACHED_AT_APPROVAL`. Staff may ask the employer to close a job and retry approval.

On capacity:

- calculate `projectedActiveUsage = currentActiveUsage - 0 + 1` and require it to be `<=5`;
- compare-and-set submission from pending to approved;
- change job to active;
- set `publishedAt=now`, `visibleUntil=now+30d`, and `applicationsCloseAt=min(valid deadline, visibleUntil)`;
- freeze the slug;
- set last approved submission;
- append approval event and outbox messages;
- commit.

This second check is required because multiple pending jobs can exist and an active slot is not reserved during review.

Close and expiry use the same guard and compare-and-set their active source state. Each calculates `currentActiveUsage - 1 + 0`; closing/expiring a non-active job releases zero. Slot effects are projections derived from committed canonical state, not a separate decrementable counter, so transaction rollback restores both state and computed usage.

### 5.6 Deterministic beta verification predicate

The current `Employer` model has: required `companyName` and `email`; optional `website`, `companyDescription`, `industry`, `location`, `city`, and `province`; `verified` boolean; `verificationLevel` in `basic|verified|trusted`; and `accountStatus` in `active|suspended`. It has no employer `emailVerified` or `disabled` field.

```text
isEmployerEligibleToSubmit(employer, capabilities = {
  employerEmailVerificationSupported: false
}) -> {
  eligible: boolean,
  blockers: Array<{
    code,
    fields?: string[],
    nextAction
  }>
}
```

Evaluate in this stable order and return all applicable blockers:

1. Missing employer record, an unknown/corrupt `accountStatus`, or any future non-active/non-suspended disabled status → `ACCOUNT_DISABLED`.
2. `accountStatus === "suspended"` → `ACCOUNT_SUSPENDED`.
3. `verified !== true` **or** `verificationLevel` is not `verified` or `trusted` → `EMPLOYER_NOT_VERIFIED`.
4. When `employerEmailVerificationSupported=true`, `emailVerified !== true` → `EMPLOYER_EMAIL_NOT_VERIFIED`.
5. Missing/invalid required profile fields → `EMPLOYER_PROFILE_INCOMPLETE`, with safe field names.

Required profile values for beta:

- `companyName`: non-empty after trim;
- `email`: non-empty, normalized, syntactically valid;
- `companyDescription`: non-empty after trim;
- `industry`: non-empty after trim;
- location: at least one of `location`, `city`, or `province` is non-empty;
- `website`: optional; when present it must be a valid `http` or `https` URL and its normalized registrable domain is retained for review.

Phone, logo, company size, and public-profile visibility are not submission prerequisites. A website/domain is not mandatory during beta; lack of a website raises no eligibility blocker but may influence manual verification.

Because the current Employer schema has no `emailVerified`, the beta implementation must call the predicate with `employerEmailVerificationSupported=false`; it must not infer verification from the email string. `EMPLOYER_EMAIL_NOT_VERIFIED` is a reserved stable code. Enabling it requires a separately approved schema migration adding `Employer.emailVerified`, a verification flow, legacy backfill/reverification policy, and tests.

Legacy handling is fail-closed: missing `verificationLevel` is treated as `basic`, and `verified=true` alone is insufficient until an approved migration normalizes the level. Missing new required profile content yields `EMPLOYER_PROFILE_INCOMPLETE`; it is not silently invented. Staff verification remains non-self-service.

`eligible` is true if and only if `blockers.length===0`. The result-code order and field rules are policy-versioned; controllers may translate safe messages but must not reinterpret eligibility.

### 5.7 Active-slot transactional invariants

1. Every transition that can release or acquire a slot writes the namespaced owner guard before reading active usage.
2. Slot deltas are derived from the compare-and-set source/target states, never accepted from request data.
3. Submission acceptance never fails solely for lack of approval capacity.
4. Approval is the only beta transition that acquires a slot and must require `A+1<=5`.
5. Pending-review jobs reserve zero slots.
6. An active major edit must compare-and-set `active→pending_review` in the same transaction that records `released=1`, yielding `A-1`; at 5/5 it yields 4/5.
7. Close/expiry release one only when their compare-and-set source is active; idempotent repeats release zero and do not append duplicate events.
8. After commit, a fresh canonical count must equal the projected usage for the transition. A mismatch is an integrity alert and blocks further approvals for that owner until reconciled.
9. Guard write conflicts use bounded transaction retries. No notification or other external side effect occurs before commit.
10. Transaction abort leaves job state, submission state, active usage, moderation history, and outbox unchanged.

## 6. Idempotency contract

- `POST /employer/jobs/:id/submit` requires an `Idempotency-Key` header.
- Accepted format: 16–128 printable ASCII characters after trim. Keys are opaque and must not contain PII.
- Scope: quota owner plus endpoint operation. The storage unique key is `{ownerType, ownerId, idempotencyKey}`.
- The server calculates `requestFingerprint` from job ID, expected job version, submission kind, `correctionOfSubmissionId`, policy version, rules version, and canonical major-field content hash. Server-derived quota treatment is stored in the result but is not a client-controlled fingerprint input.
- Same key + same fingerprint returns the original status and response with `Idempotent-Replay: true`.
- Same key + different fingerprint returns `409 IDEMPOTENCY_KEY_REUSED`.
- A request rejected before acceptance for validation, verification, quota, or authorization does not reserve the key. A client may retry after correction with the same key, but clients should normally create a new key for a changed logical request.
- A transaction with unknown commit outcome must be resolved by querying the unique key before retrying.
- Retention: submission/idempotency records are permanent audit records; do not TTL-delete them.
- Moderator approve/reject/request-changes endpoints are idempotent by compare-and-set on submission state. An optional admin idempotency key may be added, but state CAS is mandatory.

## 7. Moderation event and history

### 7.1 `JobModerationEvent` schema

| Field | Type | Required | Contract |
|---|---|---:|---|
| `_id` | ObjectId | yes | Event ID |
| `jobId` | ObjectId | yes | Target job |
| `submissionId` | ObjectId | yes | Reviewed submission |
| `employerId` | ObjectId | yes | Owner |
| `actorType` | enum | yes | `employer`, `staff`, `system` |
| `actorId` | ObjectId/null | conditional | Required for employer/staff |
| `action` | enum | yes | `submitted`, `approved`, `rejected`, `changes_requested`, `closed`, `reopened`, `expired`, `withdrawn`, `superseded` |
| `fromState` | publication enum/null | no | Before state |
| `toState` | publication enum | yes | After state |
| `reasonCode` | string/null | conditional | Required for reject/request changes/admin close |
| `reasonTextInternal` | string/null | no | Staff-only, sanitized |
| `reasonTextEmployer` | string/null | conditional | Required for reject/request changes; safe to display/email |
| `requestedFieldPaths` | string[] | conditional | Required for `changes_requested` and for any rejection intended to permit an exempt correction; allow-listed paths the employer is asked to correct |
| `contentHash` | string | yes | Snapshot acted upon |
| `metadata` | object | no | Structured, allow-listed metadata |
| `createdAt` | Date | yes | Immutable event time |

Events are append-only. No update/delete endpoint is permitted. Corrections append an event.

Indexes:

- `{ jobId: 1, createdAt: 1 }`
- `{ submissionId: 1, createdAt: 1 }`
- `{ employerId: 1, createdAt: -1 }`
- `{ action: 1, createdAt: -1 }`

### 7.2 Decisions

- **Approve:** pending submission → approved; job pending_review → active.
- **Reject:** pending submission → rejected; job pending_review → rejected; employer reason required.
- **Request changes:** represented as submission `rejected` and job `rejected`, with moderation action `changes_requested` and a required reason. The six-state job lifecycle remains canonical.
- **Correct and resubmit:** employer edits rejected content, then creates a new immutable `correction` submission. The first qualifying reviewer-requested correction in that moderation cycle is exempt under section 4.5; otherwise it is charged. The old rejection remains immutable.
- **Major active edit:** employer submits a `major_edit`; job becomes pending review and is temporarily non-public. It consumes new quota.

Admin roles need `moderate:jobs`; employer endpoints require the employer realm and exact job ownership. Staff cannot approve their own employer submission if staff/employer identities become linkable; record and enforce separation of duties when that mapping exists.

The correction exemption evaluator permits only changes within `requestedFieldPaths` plus normalized formatting/typo-only differences. A deterministic core-vacancy comparison must force `quotaCharged=true` for the identity fields in section 4.5. Ambiguous diffs fail closed as charged; they do not silently receive an exemption.

## 8. Expiry processing

### 8.1 Worker boundary

Define:

```text
expireFreeListings({ now, batchSize, cursor }) -> {
  scanned, expired, skipped, failed, nextCursor
}
```

The worker selects `publicationState=active AND visibleUntil<=now`, ordered by `{visibleUntil,_id}`, in bounded batches. For each job it runs an idempotent transaction:

1. write-lock owner quota guard;
2. compare-and-set job from active to expired with the same `visibleUntil`;
3. set `expiredAt=now`;
4. update the approved submission projection to `expired`;
5. append one `expired` event;
6. enqueue one employer notification through the outbox;
7. commit.

Use a unique event key or unique partial index equivalent to `{jobId, action:"expired", contentHash/term}` to prevent duplicate expiration events for one publication term.

### 8.2 Read/apply boundaries

- Public lists/search/sitemaps exclude non-active and `visibleUntil<=now` jobs even if the worker is late.
- Detail by reserved slug may return an archive projection for expired/closed jobs.
- Apply endpoint independently requires active state and `applicationsCloseAt>now`; it must not rely on UI disabling.
- Employer analytics/applications remain owner-readable for expired/closed jobs.
- Renewal/repost never changes `expired` directly to active. It creates a new accepted submission.

### 8.3 Failure and rollback

A failed item stays active in storage but is already excluded from public reads by the date predicate; retry is safe. Alerts trigger on worker failure/lag. Rollback never republishes expired jobs automatically.

## 9. Posting-rules acknowledgement

### 9.1 Schema

`EmployerPostingRulesAcknowledgement`:

| Field | Type | Required | Contract |
|---|---|---:|---|
| `_id` | ObjectId | yes | ID |
| `employerId` | ObjectId | yes | Acceptor |
| `jobId` | ObjectId | yes | Job |
| `submissionId` | ObjectId | yes | One-to-one accepted submission |
| `policyVersion` | string | yes | `free-beta-2026-01` |
| `rulesVersion` | string | yes | Published rules version |
| `rulesDigest` | string | yes | Server-known digest of exact rules content |
| `accepted` | boolean | yes | Must be true |
| `acceptedAt` | Date | yes | Transaction/database time |
| `createdAt` | Date | yes | Immutable |

Indexes:

- unique `{ submissionId: 1 }`
- `{ employerId: 1, acceptedAt: -1 }`
- `{ rulesVersion: 1, acceptedAt: -1 }`

The client sends `postingRules: { accepted: true, version }`; the server resolves the digest from its approved rule registry. Unknown/stale version returns `409 POSTING_RULES_VERSION_CHANGED` with the current version. Acknowledgement is created only inside the accepted-submission transaction. It cannot be edited or deleted through product APIs.

The beta acknowledgement does not add IP-address or user-agent persistence. Authenticated employer identity, exact rules digest/version, submission link, and database acceptance time are the minimized evidence set.

## 10. Plans & Usage response

### 10.1 Endpoint

`GET /employer/plans/usage`

Authorization: authenticated active employer; only the caller's resolved quota owner. Suspended employers may receive read-only usage plus suspension state but cannot submit.

### 10.2 Response

```json
{
  "policy": {
    "code": "free_beta",
    "version": "free-beta-2026-01",
    "displayName": "Free Beta",
    "price": 0,
    "currency": "PKR",
    "visibilityDays": 30,
    "paidPublishingAvailable": false
  },
  "owner": {
    "type": "employer",
    "id": "opaque-id"
  },
  "eligibility": {
    "verified": true,
    "accountStatus": "active",
    "canSubmitNow": true,
    "submissionBlockers": []
  },
  "daily": {
    "window": "rolling_24_hours",
    "used": 0,
    "limit": 1,
    "remaining": 1,
    "nextEligibleAt": null
  },
  "rolling30Days": {
    "used": 3,
    "limit": 10,
    "remaining": 7,
    "nextSlotAt": null
  },
  "activeJobs": {
    "used": 2,
    "limit": 5,
    "remaining": 3,
    "hasCapacity": true
  },
  "approvalCapacity": {
    "hasCapacity": true,
    "used": 2,
    "limit": 5,
    "warningCode": null,
    "message": null
  },
  "corrections": [
    {
      "jobId": "opaque-id",
      "correctionOfSubmissionId": "opaque-id",
      "moderationCycleId": "opaque-id",
      "evaluatedJobRevision": 4,
      "quotaTreatment": "exempt",
      "exemptionEligible": true,
      "exemptionExpiresAt": "2026-08-02T12:00:00.000Z",
      "ineligibleReasons": []
    }
  ],
  },
  "upcomingExpirations": [
    {
      "jobId": "opaque-id",
      "title": "Example",
      "visibleUntil": "2026-08-20T12:00:00.000Z",
      "applicationsCloseAt": "2026-08-15T18:59:59.999Z"
    }
  ],
  "counts": {
    "pendingReview": 1,
    "rejected": 0,
    "closed": 1,
    "expired": 2
  },
  "paidPlans": {
    "state": "coming_later",
    "checkoutEnabled": false
  },
  "postingRules": {
    "currentVersion": "employer-rules-2026-01",
    "url": "/employer/posting-rules"
  },
  "generatedAt": "2026-07-28T12:00:00.000Z",
  "displayTimezone": "Asia/Karachi"
}
```

`canSubmitNow` is derived only from eligibility, job-submission state when a job is in context, posting-rules/validation readiness where known, and charged daily/monthly availability. `submissionBlockers` uses stable codes including `EMPLOYER_NOT_VERIFIED`, `EMPLOYER_EMAIL_NOT_VERIFIED` when supported, `EMPLOYER_PROFILE_INCOMPLETE`, `ACCOUNT_SUSPENDED`, `ACCOUNT_DISABLED`, `ROLLING_24H_LIMIT`, and `ROLLING_30D_LIMIT`. Each includes `message`, `availableAt` where applicable, and `nextAction`.

At the account-level usage endpoint, `canSubmitNow` means “a normal quota-charged submission can be accepted now.” A job-specific correction with `exemptionEligible=true` may still be accepted when the only account-level blockers are rolling quota codes; eligibility, safety, ownership, and state blockers still apply. The correction item must state this exception explicitly so the UI does not misrepresent availability.

`activeJobs.hasCapacity` and `approvalCapacity.hasCapacity` report whether an approval could acquire a slot at the snapshot time. At 5/5, `canSubmitNow` may still be true, `submissionBlockers` must not contain an active-capacity blocker, and `approvalCapacity` returns `hasCapacity=false`, `warningCode=ACTIVE_LIMIT_REACHED_AT_APPROVAL`, and guidance to close/wait before approval. Pending-review jobs never reduce remaining slots or reserve capacity.

For each currently correctable rejected job, `corrections` evaluates the current persisted candidate revision and discloses `quotaTreatment=exempt|charged`, whether the next attempt is presently eligible, the evaluation revision, expiry, and stable ineligibility reasons. The result becomes stale if the job, moderation cycle, or clock changes; the submit transaction recomputes it and returns the authoritative `quotaCharged`, `quotaExemptionReason`, and `moderationCycleId`. Core-identity changes, failure to address requested fields, and expired/reused exemptions produce `quotaTreatment=charged`.

Counts and eligibility come from the quota service in a consistent database snapshot. The response must not expose other employer IDs, internal risk flags, or staff-only moderation notes.

## 11. Slug reservation and history

### 11.1 Generation

The server normalizes title plus location to a base slug. When the base is reserved, the suffix is deterministic: a stable short encoding/hash derived from the preallocated job ObjectId. It must not use `Date.now()` or random retry output. Unique-index conflict triggers bounded deterministic retry.

Draft creation returns the actual read-only preview URL. Employer payloads containing `slug` are ignored or rejected; employers have no slug-update endpoint.

### 11.2 `JobSlugReservation` schema

| Field | Type | Required | Contract |
|---|---|---:|---|
| `_id` | ObjectId | yes | ID |
| `jobId` | ObjectId | yes | Owner job |
| `locale` | string | yes | Canonical locale |
| `slug` | string | yes | Display/path value |
| `normalizedSlug` | string | yes | Unique lookup value |
| `state` | enum | yes | `current`, `redirect`, `reserved` |
| `redirectToReservationId` | ObjectId/null | conditional | Required for redirect |
| `reservedAt` | Date | yes | Never released for ordinary delete/archive |
| `frozenAt` | Date/null | no | First publication |
| `replacedAt` | Date/null | no | Exceptional authorized change |
| `changedByStaffId` | ObjectId/null | conditional | Required for exceptional change |
| `changeReason` | string/null | conditional | Required for exceptional change |
| `createdAt`, `updatedAt` | Date | yes | timestamps |

Indexes:

- unique `{ locale: 1, normalizedSlug: 1 }`
- one current per job/locale via unique partial `{ jobId: 1, locale: 1 }` where `state="current"`
- `{ jobId: 1, createdAt: 1 }`
- `{ redirectToReservationId: 1 }`, sparse

Old slugs remain reserved. An exceptional staff-authorized change atomically creates/reserves the new current slug, marks the old reservation redirect, records actor/reason, and prevents redirect chains by pointing old reservations directly to current. Employer title/location edits never invoke this workflow.

## 12. Transition table

`A` below means active usage at the transaction's fresh serialized snapshot.

| Current state | Action | Next state | Actor | `quotaCharged` | Daily effect | Rolling-30-day effect | Slot release/acquire | Projected active usage | Approval-time capacity | Moderation cycle | Moderation / notification | Failure behavior |
|---|---|---|---|---:|---|---|---|---|---|---|---|---|
| none | Create draft | draft | Employer | N/A | 0 | 0 | 0 / 0 | `A` | N/A | None | No moderation; draft confirmation | Validation/auth failure creates nothing |
| draft | Edit draft | draft | Employer | N/A | 0 | 0 | 0 / 0 | `A` | N/A | None | No moderation | Version/validation failure preserves draft |
| draft | Initial submit | pending_review | Eligible employer | true | +1 on commit | +1 on commit | 0 / 0 | `A` | Not enforced; accepted at 5/5 | New cycle | Submitted event; employer/admin notifications | Quota/validation/transaction failure preserves draft; replay returns original |
| rejected | Reviewer-requested correction meeting section 4.5 | pending_review | Eligible employer | false | 0 | 0 | 0 / 0 | `A` | Not enforced; accepted at 5/5 | Inherit predecessor cycle | New snapshot/acknowledgement/submitted event; exemption disclosed | Any failed condition makes it charged; if charged quota unavailable, preserve rejected state |
| rejected | Charged correction (ineligible/repeated/late/core change) | pending_review | Eligible employer | true | +1 on commit | +1 on commit | 0 / 0 | `A` | Not enforced; accepted at 5/5 | New cycle | New correction submission; charged treatment disclosed | Daily/monthly block preserves rejected state |
| active | Major edit and submit | pending_review | Eligible employer | true | +1 on commit | +1 on commit | 1 / 0 | `A - 1` | Not enforced; at 5/5 it commits to 4/5 | New cycle | Major-edit submitted event; listing-hidden warning | Failure preserves prior active public content and slot |
| pending_review | Approve | active | Moderator/Admin | unchanged | 0 | 0 | 0 / 1 | `A + 1` | Require `A + 1 <= 5` | Existing cycle | Approved event; employer live notification | At 5/5 return `ACTIVE_LIMIT_REACHED_AT_APPROVAL`; remain pending |
| pending_review | Reject | rejected | Moderator/Admin | unchanged | 0; no refund | 0; no refund | 0 / 0 | `A` | N/A | Existing cycle | Reason/event; employer notification | CAS failure changes nothing |
| pending_review | Request changes | rejected | Moderator/Admin | unchanged | 0; no refund | 0; no refund | 0 / 0 | `A` | N/A | Existing cycle becomes eligible for at most one exemption | Structured requested fields/reason; correction guidance | CAS failure changes nothing |
| rejected | Edit correction candidate only | rejected | Employer | N/A | 0 | 0 | 0 / 0 | `A` | N/A | Existing until accepted | Old decision retained | Invalid edit preserves rejected content |
| active | Minor edit | active | Employer | N/A | 0 | 0 | 0 / 0 | `A` | Already occupies one slot | Existing approved cycle | Audit only; optional confirmation | Major-field detection blocks unsafe in-place update |
| active | Close | closed | Employer/authorized admin | N/A | 0; no refund | 0; no refund | 1 / 0 | `A - 1` | Releases capacity after commit | Existing cycle | Close event/confirmation | CAS/transaction failure leaves active |
| non-active closable state | Close | closed | Employer/authorized admin | N/A | 0; no refund | 0; no refund | 0 / 0 | `A` | No effect | Existing cycle | Withdraw/close event | CAS failure no change |
| closed | Reopen for editing | draft | Employer | N/A | 0 | 0 | 0 / 0 | `A` | N/A | No new cycle until submit | Reopened event/draft guidance | Does not restore approval/visibility |
| active | Expire at `visibleUntil` | expired | System | N/A | 0; no refund | 0; no refund | 1 / 0 | `A - 1` | Releases capacity after commit | Existing cycle | Idempotent expired event/notification | Public date predicate fails closed; retry safely |
| expired/closed | Renewal | pending_review | Eligible employer | true | +1 on commit | +1 on commit | 0 / 0 | `A` | Not enforced; accepted at 5/5 | New cycle | Renewal submission and review notification | Quota/validation failure preserves terminal state |
| expired/closed/draft duplicate | Repost | pending_review | Eligible employer | true | +1 on commit | +1 on commit | 0 / 0 | `A` | Not enforced; accepted at 5/5 | New cycle | Repost submission and duplicate-review signals | Quota/duplicate/validation failure preserves source |

A major-edit request first validates and checks charged quota against a candidate revision. If it cannot be accepted, the persisted active job and public content remain unchanged. Only a committed major-edit submission hides it and releases its slot. New, correction, renewal, and repost submissions never reserve approval capacity.

## 13. API proposal

All mutating responses use stable error codes, a request ID, and never infer authorization from client-supplied employer/company IDs.

### `POST /employer/jobs`

- Purpose: create private draft only.
- Auth: employer realm; active account. Verification not required.
- Body: job fields except publication state, approval, plan, expiry, owner, or slug.
- Server: sanitize/validate draft minimum, generate/reserve slug, set draft.
- Response: `201 { job, urlPreview, publicationState:"draft" }`.
- Quota: none.
- Idempotency: recommended draft idempotency key, but separate from publication quota.

### `PATCH /employer/jobs/:id`

- Purpose: edit owned job with optimistic concurrency.
- Auth: employer owner; active account. Verification not required for private draft correction.
- Body: allow-listed fields plus `expectedPublicationVersion`.
- Draft/rejected/closed editing does not submit.
- Active minor edit remains active.
- Active major fields require `submitMajorEdit=true`, posting-rules acknowledgement, and `Idempotency-Key`; otherwise return `409 MAJOR_EDIT_REQUIRES_REVIEW` with changed field names.
- When `submitMajorEdit=true`, route delegates to the same charged quota transaction as submit. It uses projected usage `A-1`, is not blocked by 5/5 active capacity, and failure preserves the active version.

### `POST /employer/jobs/:id/submit`

- Purpose: accept initial, correction, renewal, or repost submission; calculate correction quota treatment server-side.
- Auth: employer owner, active account, verified.
- Header: required `Idempotency-Key`.
- Body:

```json
{
  "expectedPublicationVersion": 3,
  "submissionKind": "initial",
  "correctionOfSubmissionId": null,
  "postingRules": {
    "accepted": true,
    "version": "employer-rules-2026-01"
  }
}
```

- Success: `202` for first acceptance; replay returns `200` or the stored semantic response with `Idempotent-Replay:true`.
- Response includes submission, pending state, usage snapshot, expected review guidance, `quotaCharged`, `quotaExemptionReason`, and `moderationCycleId`. Correction responses also state why an attempted exemption was granted or treated as charged.
- Errors: `403 EMPLOYER_NOT_VERIFIED`, `403 EMPLOYER_EMAIL_NOT_VERIFIED` when supported, `403 EMPLOYER_PROFILE_INCOMPLETE`, `403 ACCOUNT_SUSPENDED`, `403 ACCOUNT_DISABLED`, `409 JOB_STATE_NOT_SUBMITTABLE`, `409 JOB_VERSION_CONFLICT`, `409 IDEMPOTENCY_KEY_REUSED`, `409 POSTING_RULES_VERSION_CHANGED`, `429 ROLLING_24H_LIMIT`, `429 ROLLING_30D_LIMIT`, `422 JOB_VALIDATION_FAILED`.
- `Retry-After` accompanies the rolling-24-hour block when representable in seconds.
- `ACTIVE_LIMIT_REACHED_AT_APPROVAL` is not a submit error. A new or corrected job may enter `pending_review` at 5/5. The usage snapshot carries a separate approval-capacity warning.

### `GET /employer/plans/usage`

- Purpose/response: section 10.
- Auth: employer owner.
- Cache: private, short-lived at most; must revalidate after any transition. Never shared-cache.

### Admin moderation

- `POST /admin/jobs/:jobId/submissions/:submissionId/approve`
- `POST /admin/jobs/:jobId/submissions/:submissionId/reject`
- `POST /admin/jobs/:jobId/submissions/:submissionId/request-changes`

Auth: staff with `moderate:jobs`. Body includes expected pending state/revision; reject/request changes require `reasonCode` and `reasonTextEmployer`, with optional internal text. All actions are compare-and-set and audit logged.

Approval returns `409 ACTIVE_LIMIT_REACHED_AT_APPROVAL` without changing the pending submission when capacity is full.

### Expiry worker

Internal service/worker boundary only; no public endpoint. If an operator trigger is later added, it must require system permission, accept a dry-run mode, and call the same idempotent worker service.

### Legacy `/activate`

At cutover:

1. remove it from employer UI;
2. gate it off for employer-originated Free Beta jobs;
3. return `410 LEGACY_ACTIVATION_DISABLED` with the submit endpoint guidance;
4. ensure webhook/payment code cannot use it to publish beta jobs;
5. retain only a narrowly scoped migration/admin adapter if required, never reachable with employer credentials;
6. add a direct-API regression test proving it cannot bypass verification, quota, moderation, or paid-disable policy.

## 14. UI states and approved copy

| State | Required copy | Primary action |
|---|---|---|
| Free available | **Free submission available.** Submit this job for review. If approved, it will be visible for 30 days. | Submit for Review |
| Rolling 24h exhausted | **Your free submission has been used for the last 24 hours.** Your next submission is available at `{timestamp} PKT`. You can keep editing drafts. | Back to drafts |
| Exact eligibility | **Next free submission available:** `{absolute date/time} PKT` (`{relative time}`). | None |
| Approval capacity full | **You have 5 of 5 active jobs.** You can still submit this job for review, but it cannot be approved until you close an active listing or one expires. Closing releases a slot but does not restore submission quota. | Submit for Review / View active jobs |
| Rolling monthly limit | **30-day submission limit reached (10 of 10).** Your next slot becomes available at `{timestamp} PKT`. | View usage |
| Not verified | **Verify your employer account before submitting.** You may continue saving and editing drafts. | Complete verification |
| Pending review | **Awaiting review.** This job is not public yet. Submitted `{timestamp}`. | View submission |
| Rejected, exempt correction available | **Changes are required before this job can be published.** Reason: `{safe reason}`. One correction requested by the reviewer can be resubmitted without using quota until `{timestamp}`, provided the vacancy identity does not change. | Edit requested fields |
| Rejected, charged correction | **Changes are required before this job can be published.** Reason: `{safe reason}`. This resubmission will use your free submission quota because the correction exemption is unavailable, expired, already used, or the vacancy identity changed. | Edit job / View usage |
| Paid plans | **Paid plans are coming later.** Paid publishing is disabled during Free Beta. | None; disabled |
| Expiring soon | **This listing expires on `{timestamp}`.** Applications close on `{application timestamp}`. | View job |
| Expired | **This listing has expired and no longer accepts applications.** Applications and analytics remain available. Renewal requires a new submission. | Renew/repost if eligible |
| Major edit | **These changes require review:** `{fields}`. If submitted, the listing will be hidden while reviewed, its current active slot will be released, and the submission will use quota. | Submit changes for review |

Every blocked state must include the reason, exact next time when time-based, what the employer can do, and a support link. Timestamps must include timezone and accessible absolute text; color alone must not convey state.

The main workflow label is **Free Beta → Submit for Review**. Do not use “Activate,” “Pay & Publish,” or copy suggesting pending jobs are active/public.

## 15. Anti-abuse contract for employer-owned beta quotas

Using `employerId` is an approved beta tradeoff, not full company enforcement. At submit, persist normalized:

- company name;
- website host/registrable domain where safely derived;
- employer email domain;
- verification state/level;
- account status.

Admin moderation must surface potential same-company/domain duplicates. Authorized staff may suspend an Employer, and suspension immediately blocks submission. All verification, moderation, suspension, and override actions require audit events. Do not automatically merge accounts or expose internal linkage/risk signals to employers.

Correction abuse controls include the unique one-exemption-per-cycle index, immediate-predecessor check, seven-day database-time window, structured requested field paths, deterministic core-vacancy diff, same-job/owner checks, idempotency, and moderator visibility of prior cycles. Repeated rejection/correction loops are charged after the single exemption; suspicious identity-preserving rewrites may be rejected or escalated but never granted additional hidden exemptions.

The future migration to organizations changes only `QuotaOwnerResolver` and owner backfill/merge policy; downstream quota methods accept opaque owner type/ID already.

## 16. Authorization matrix

| Capability | Unverified employer | Verified active employer | Suspended employer | Moderator/Admin | System worker |
|---|---:|---:|---:|---:|---:|
| Create/edit private draft | Yes | Yes | No writes; read/export policy separately | Authorized support only | No |
| Submit | No | Own jobs only | No | No employer bypass; separate audited admin action if designed | No |
| Read own usage/history | Yes | Yes | Yes, read-only | With permission | No |
| Approve/reject/request changes | No | No | No | `moderate:jobs` | No |
| Close own job | Yes, if owned | Yes | No employer write | Authorized moderation close | No |
| Expire due listing | No | No | No | Operator trigger only if added | Yes |
| Change verification | No | No | No | `moderate:employers` | Approved verification automation only |
| Exceptional slug change | No | No | No | Narrow explicit permission + reason | No |

Employers cannot self-verify, change quota owner, set publication state, set moderation values, set dates, choose free/paid entitlement, or alter submission history.

## 17. Contract completeness matrix

This matrix makes the implementation obligations for every required contract explicit. “N/A” means the contract is a service/read model rather than a separately persisted state machine.

| Contract | Required fields / timestamps | Indexes | Ownership / authorization | State enum / invariants | Atomic operation | Migration impact | Rollback |
|---|---|---|---|---|---|---|---|
| `JobPublicationSubmission` | Section 4.2; `acceptedAt` immutable; review timestamps conditional | Section 4.3 | Employer owner reads; moderator reads/decides; no employer mutation/deletion | Section 4.4 submission enum; one pending per job; only `quotaCharged=true` rows count; one exempt correction per cycle | Created with job state, acknowledgement, event, guard, and outbox in submit transaction | Backfill only defensible history; migration records can be non-quota | Abort whole transaction; never delete/re-time a committed submission |
| Quota usage service/guard | Sections 5.1–5.6; guard timestamps/revision | Namespaced primary guard plus unique owner pair and submission/job indexes | Resolves caller's owner; controller cannot supply another owner | Limits 1 charged/24h, 10 charged/30d; 5 active enforced at approval; projected usage formula; database UTC | Guard write serializes submit/approve/close/expire transactions | Beta resolver returns employer; future resolver creates distinct organization guard and reconciles history | On uncertainty disable submits; recompute usage from immutable ledger |
| Idempotency | Section 6; key/fingerprint on submission | Unique owner + key | Bound to authenticated resolved owner | Same key+fingerprint replays; mismatch conflicts | Lookup/create occurs inside serialized submit transaction | No legacy keys; begins at new endpoint cutover | Resolve unknown commit by key; committed keys are never removed |
| Job publication state | Section 3.1 dates/version fields | Section 3.3 | Employer owns content; only services/staff/system transition controlled fields | Six canonical states and invariants in section 3.2 | State changes commit with submission/moderation/expiry transaction | Mapping and quarantine rules in section 18 | Public reads stay fail-closed; do not restore legacy visibility logic |
| Moderation history | Section 7.1; immutable `createdAt` | Section 7.1 | Employer sees safe projection; `moderate:jobs` sees/creates decisions | Action enum; append-only; reason required for rejection/changes | Decision CAS, job/submission update, event, guard, and outbox commit together | Create migration events only from reliable evidence | Append compensating correction; never rewrite/delete history |
| Expiry processing | Section 8.1 worker inputs/results and expiry dates | Job due index plus unique expiry-event protection | Internal worker; optional operator trigger needs system permission | Active→expired only for matching due term | Per-job transaction in section 8.1 | Classify reliably overdue active records; quarantine ambiguity | Date predicate remains fail-closed; retry; never auto-republish |
| Posting-rules acknowledgement | Section 9.1; immutable acceptance/digest/timestamps | Unique submission; employer/version history | Employer accepts for own submission; server resolves rule digest | `accepted=true`; exact current versions required | Created only in accepted-submission transaction | Existing users acknowledge on first new submission | Transaction abort removes uncommitted row; committed evidence retained |
| Plans & Usage response | Section 10.2 response plus `generatedAt` | No new index beyond ledger/job usage indexes | Caller gets own owner projection; internal risk fields excluded | Submission eligibility is separate from approval capacity; charged counts and correction advice must agree with ledger | Consistent snapshot read; no mutation | Available only after ledger/state backfill is verified | Hide/maintenance response if truth cannot be computed; never estimate client-side |
| Slug reservation/history | Section 11.2 reservation/change timestamps | Section 11.2 unique locale/slug and current-per-job | Server creates; exceptional staff permission changes; employer read-only | `current`, `redirect`, `reserved`; old values never released | Draft reservation and exceptional redirect changes are transactional | Inventory duplicates and reserve existing published slugs before cutover | Keep old reservations; point directly to current; do not break indexed URLs |

## 18. Migration impact

### 18.1 Required inventory

Before mutation, produce a read-only classification of employer jobs by current `status`, `approvalStatus`, plan/payment, employer verification/status, dates, and public visibility. Detect duplicate slugs, ambiguous employers, active counts over 5, and pending/rejected combinations.

### 18.2 Proposed mapping

| Legacy combination | Canonical candidate | Handling |
|---|---|---|
| `status=draft` | draft | Preserve private content; remove stale publication projection |
| `status=active`, approved, not past known expiry | active | Backfill publication dates only from reliable approval/payment/audit evidence |
| `status=active`, pending | pending_review | Create migration submission/event marked non-quota where historical acceptance cannot be proven |
| any rejected approval | rejected | Preserve reason as unavailable unless audit evidence exists |
| `status=closed` | closed | Preserve analytics/applications |
| active approved past reliable expiry | expired | Backfill expired date/event |
| conflicting/ambiguous | quarantined from public, manual review | Never guess public entitlement |

Because the canonical state enum has no `quarantined`, migration quarantine is an operational flag/read block plus a manual classification queue; the job must not be public.

### 18.3 Quota baseline

- Existing reliably active free jobs count toward the 5 active slots at cutover.
- Create migration submissions for history/audit, with `quotaCharged=false` and `quotaExemptionReason=legacy_migration_non_chargeable` if they were not accepted under the new policy.
- Do not consume rolling 24-hour/30-day quota from draft creation dates or uncertain legacy activation dates.
- If a reliable approval/publication timestamp falls within a window, product/operations must approve whether to charge it before migration; default safe customer behavior is not to charge uncertain history.
- New submit endpoint usage after cutover is charged except for the single, explicitly qualified reviewer-requested correction in section 4.5.

### 18.4 Employer eligibility migration

- The required profile fields already exist on `Employer`; no schema field is invented for them. Before enforcement, inventory completeness and provide employers a normal profile-completion path.
- Normalize legacy verification only from reliable staff/audit evidence: `verified=true` plus `verificationLevel=verified|trusted`. Ambiguous/missing levels remain ineligible until staff review.
- The current schema supports only `active|suspended`. Unknown historical values are quarantined as `ACCOUNT_DISABLED`; do not coerce them to active.
- Employer email-verification enforcement remains disabled because the field/flow does not exist. Enabling it requires the separate migration and legacy decision in section 5.6.
- Website remains optional. Validate and normalize a domain only when supplied; do not synthesize one from email.

### 18.5 Index and cutover order

1. Inventory and resolve unique-index conflicts.
2. Deploy additive collections/indexes and read-compatible fields.
3. Backfill in resumable, idempotent batches with checkpoints.
4. Verify counts and public projections.
5. Atomically switch public reads and employer submit flow behind a controlled feature flag.
6. Disable legacy activate and paid controls in the same release boundary.
7. Monitor rejection, quota, expiry, and visibility metrics.

No migration or seed is authorized by this documentation phase.

## 19. Rollback behavior

### Request-level rollback

- Any failed submit/approve/expire transaction aborts all job, ledger, acknowledgement, audit, outbox, and guard changes.
- External notifications are sent only from a committed outbox.
- Unknown commit outcomes are resolved by idempotency lookup.

### Deployment rollback

- Do not delete new submissions/events/acknowledgements or reverse approved dates.
- Disable new submissions with a clear maintenance state if correctness is uncertain.
- Keep public reads fail-closed: never fall back to legacy rules that expose pending/rejected/expired jobs.
- Retain a compatibility projection for employer reads while the prior application version is restored.
- Re-enable legacy `/activate` only through a separately approved emergency decision; ordinary rollback must keep it blocked.
- Reconcile guard revisions, submission/job state, outbox, and public search after rollback.

### Data correction

Corrections are append-only administrative events with reason, actor, before/after projection, and incident reference. Do not rewrite quota acceptance time or delete consumed submissions. A compensating quota credit is not part of beta policy; exceptional customer remediation requires a later explicit, audited contract.

## 20. Required implementation tests

The quota-enforcement slice is not complete without:

### H1A mandatory consistency tests

1. An active major-edit submission is accepted while the owner is 5/5; the committed transition releases that job's slot and projected usage is 4/5.
2. A new initial submission is accepted into `pending_review` at 5/5 when eligibility and charged submission quotas pass.
3. Approval at 5/5 returns `ACTIVE_LIMIT_REACHED_AT_APPROVAL`, leaves the job/submission pending, and emits no approval event/notification.
4. After one active job closes transactionally, retrying approval succeeds and projected usage returns to 5/5.
5. One qualifying reviewer-requested correction in the same moderation cycle is accepted with `quotaCharged=false`.
6. A repeated correction loop cannot receive a second exemption in the same cycle; it becomes charged or is blocked by charged quota.
7. A company/role/scope/application-domain/category/major-location identity change cannot use the correction exemption.
8. A correction accepted after the seven-day deadline is charged.
9. Daily and rolling-30-day counts ignore `quotaCharged=false` rows while retaining them in history.
10. `isEmployerEligibleToSubmit` returns deterministic blocker arrays/codes for suspended, disabled/corrupt, unverified, supported-unverified-email, incomplete-profile, multi-blocker, and eligible cases.
11. `employer:<id>` and `organization:<same-id>` resolve to distinct guards and cannot collide during future owner migration.

### Baseline and regression tests

- simultaneous submit requests from two tabs with different keys;
- same-key same-payload replay and same-key changed-payload conflict;
- employer ownership and realm isolation;
- deterministic verification-predicate tests for every blocker code, multiple blockers, current unsupported email-verification capability, invalid optional website, required profile values, and legacy missing verification level;
- rolling-window exact-boundary tests using an injected clock;
- a new initial submission accepted into pending review at 5/5 active;
- an active major edit accepted at 5/5 because the same transaction releases its own slot and projects 4/5;
- approval blocked at 5/5 with the submission remaining pending and no approval event/notification;
- approval succeeding after one active job closes, including serialized close/approve race coverage;
- monthly 10/10 charged boundary and charged-count queries ignoring `quotaCharged=false`;
- one qualifying correction in the same moderation cycle accepted with `quotaCharged=false`;
- a repeated correction loop in that cycle becoming charged or being blocked by charged quota;
- a core-vacancy identity change being ineligible for correction exemption;
- a correction after the seven-day window being charged;
- immediate-predecessor, same-job, requested-field-path, and one-exemption unique-index tests;
- future `organization:<id>` guard identity not colliding with `employer:<same-id>`, plus owner migration/reconciliation tests;
- active-slot projected-usage tests for initial `A`, major edit `A-1`, approval `A+1`, close `A-1`, and expiry `A-1`;
- validation, transaction, database, and outbox failure rollback;
- rejection/close/expiry not restoring submission quota;
- major-edit failure preserving active public content;
- charged correction/renewal/repost consuming a new unit;
- worker duplicate/retry and late-worker public exclusion;
- archived detail and apply denial after deadline/expiry;
- legacy `/activate`, checkout, and webhook inability to bypass beta policy;
- slug collision concurrency, freeze, old-slug redirect, and employer slug rejection;
- moderation RBAC/reasons/history and notification idempotency;
- usage response ownership and agreement with ledger counts.

## 21. Deferred architecture

- Canonical organization/company membership and organization-owned quotas.
- Approved-revision publishing where the prior version stays live during major-edit review.
- Trusted-employer paid auto-publication and automated risk scoring.
- Paid checkout, receipts/invoices, refunds, disputes, and renewals.
- Provisional publication is not planned for beta.

These deferrals do not block employer-owned Free Beta quota enforcement because their boundaries and fail-safe behavior are defined above.

## 22. Implementation entry criteria

The Free Quota Enforcement implementation slice may begin when it treats this document as normative and:

- uses the serialized transactional ledger rather than controller count checks;
- preserves unlimited draft behavior;
- disables all legacy publication bypasses at cutover;
- uses canonical states and date predicates for public/apply reads;
- includes migration inventory/dry-run and rollback;
- keeps Stripe and paid publication disabled;
- ships the concurrency, failure, authorization, and boundary tests in section 20.

## Final verdict

**READY FOR FREE QUOTA ENFORCEMENT IMPLEMENTATION**
