# Free Beta Canonical Job Publication State and Migration Audit

## 1. Executive verdict

**READY FOR ADDITIVE CANONICAL JOB PUBLICATION SCHEMA IMPLEMENTATION**

The current `Job` model can be extended additively without changing legacy
behavior, provided the next slice is limited to nullable/dormant schema paths,
conditional validation for populated canonical projections, focused model
tests, and documentation.

The next slice must not:

- backfill or classify any Job;
- add or apply indexes;
- change defaults for existing `status`, `approvalStatus`, `planType`,
  `expiresAt`, or `paidUntil`;
- add a hook that infers canonical state from legacy values;
- change controllers, routes, public queries, payments, dashboards, workers, or
  frontend code;
- activate a canonical writer or Mongoose adapter;
- require a database connection.

This verdict does not approve migration or runtime cutover. Legacy state remains
ambiguous, transaction topology remains unverified, the publishing outbox
remains incompatible, and application-destination ownership is not established.
Those findings do not block a dormant additive schema-only phase.

The approved first beta behavior does not keep an active listing public during
major-edit review. A safe future major-edit transaction must construct the
candidate patch without pre-saving it, create the immutable submission, update
the Job content, and compare-and-set `active -> pending_review` atomically.
Failure preserves the old active Job fields and slot; success hides the candidate
until moderation and releases one active slot. The existing H2B-A command alone
does not carry a content patch, so a later adapter must reject active major edits
until that atomic candidate boundary is implemented.

## 2. Repository state

- HEAD:
  `654cd88cf45f5a7372d8d6bd6e06e218641ecfc0`
  (`docs: audit dormant mongoose submission adapter readiness`).
- Branch: `main`.
- Upstream state: `main...origin/main [ahead 4]`.
- No merge, rebase, cherry-pick, revert, or conflict operation was active.
- No tracked file was modified and no file was staged at audit start.
- The only pre-existing untracked file was
  `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`.
- That production acceptance report was not read, modified, staged, or
  committed.
- This audit creates only
  `docs/FREE_BETA_CANONICAL_JOB_PUBLICATION_STATE_MIGRATION_AUDIT.md`.

## 3. Normative contract summary

The accepted policy defines six canonical Job states:

- `draft`: private, unlimited, no quota, no active slot;
- `pending_review`: accepted submission awaiting moderation, non-public, no
  active slot;
- `active`: the only public-list state and exactly one active slot;
- `rejected`: non-public; correction candidate may be edited;
- `closed`: non-public, preserves URL/history/applications, releases an active
  slot when closed from active;
- `expired`: non-public in lists, archive detail may remain, rejects
  applications, releases an active slot.

Submission kinds are `initial`, `correction`, `major_edit`, `renewal`, and
`repost`. A charged submission consumes one rolling-24-hour and one
rolling-30-day unit only when its transaction accepts it into
`pending_review`. One qualifying same-cycle reviewer correction may be exempt.
Renewal, repost, major edit, and every non-exempt correction are charged.

Approval alone acquires an active slot and must enforce projected usage at no
more than five active Free Beta jobs. Pending jobs reserve no slots. Free Beta
approval establishes a 30-day term. Paid publishing is disabled, and future
paid jobs must not be inferred from, or counted by, legacy payment/plan fields.

The normative Job projection requires:

- `publicationState`;
- immutable-after-first-submission `employerId`;
- `currentSubmissionId`;
- `lastApprovedSubmissionId`;
- `publishedAt`;
- `visibleUntil`;
- `applicationsCloseAt`;
- `closedAt`;
- `expiredAt`;
- strict employer-safe `rejectionSummary`;
- `slug` and `slugFrozenAt`;
- `policyVersion`;
- integer `publicationVersion`.

It also requires:

- owner/state/version compare-and-set transitions;
- canonical active Free Beta counting through the last approved submission;
- public list/detail/apply behavior derived from canonical state and dates;
- an idempotent expiry worker;
- immutable submission snapshots and moderation events;
- failure rollback across Job, submission, acknowledgement, guard, event, and
  outbox;
- an explicit migration quarantine/manual-review path;
- no payment state mapping directly to beta publication state.

## 4. Current Job schema inventory

### Storage and ownership

- Model: `Job`.
- Collection: Mongoose default `jobs`.
- `_id`: Mongoose ObjectId.
- Employer owner: optional `employerId` ObjectId ref to `Employer`.
- Other creator: optional `postedBy` ObjectId ref to `User`.
- `employerId` is not immutable and admin update currently permits changing it.

### Legacy publication, plan, and dates

- `status`: `draft | active | closed`, default `active`.
- `approvalStatus`: `pending | approved | rejected`, default `approved`.
- `planId`: optional `JobPlan` ref.
- `planType`: `free | starter | standard | premium`, default `null`.
- `expiresAt`: optional Date.
- `paidUntil`: optional Date.
- `deadline`: optional Date.
- There is no canonical state, publication version, submission link, approval
  term, closure/expiry decision time, rejection projection, or frozen-slug
  timestamp.

Legacy pairs are independent. The schema permits, for example:

- `status=active` plus `approvalStatus=pending`;
- `status=draft` plus `approvalStatus=approved`;
- `status=closed` plus any approval status;
- a paid plan without completed payment evidence;
- completed payment without canonical approval.

### Content, slug, destination, and translation

- Required: `title`, `slug`, and `company`.
- Display/role fields include `organization`, location/province/city, category,
  employment `type`, `jobType`, description, requirements, responsibilities,
  skills, salary, education, experience, deadline, and seats.
- Application destination fields:
  `applyType: internal | external` (default `external`),
  `applicationLink`, `applyEmail`, `applicationInstructions`, `sourceUrl`, and
  `sourceWebsite`.
- Slug is generated on save only when missing.
- Translation mixin fields are `locale`, `translationGroupId`,
  `translationOf`, and `translationStatus`.
- The translation hook creates a group ID and locale when missing.
- Current public Job queries filter locale but do not consistently require
  `translationStatus=published`.

### Strictness, validators, timestamps, hooks, and virtuals

- Schema uses Mongoose default strict mode (`true`), not `strict: "throw"`.
- Mongoose timestamps provide `createdAt` and `updatedAt`.
- Mongoose `__v` exists but is not a publication version.
- Enum validators exist for legacy state/plan/type fields.
- `totalSeats` has minimum 1 when non-null.
- `externalId` is sparse unique at schema level.
- Pre-save hooks generate a missing slug and ensure translation grouping.
- No Job virtual was found.
- No cross-field publication invariant or compare-and-set hook exists.

### Declared indexes

- `{sourceWebsite: 1, status: 1}`;
- `{status: 1, createdAt: -1}`;
- `{status: 1, deadline: 1}`;
- `{province: 1, status: 1}`;
- `{category: 1, status: 1}`;
- text on title/company/location/province;
- `{employerId: 1, status: 1}`;
- `{status: 1, approvalStatus: 1}`;
- `{expiresAt: 1}`;
- unique `{slug: 1, locale: 1}`;
- `{translationGroupId: 1, locale: 1}`;
- field-level locale/translation indexes;
- sparse unique `externalId`.

Declared indexes were not inspected in a database. Their live existence,
uniqueness, and health are unknown.

## 5. State-consumer inventory

| File or area                                                                                                                                   | Legacy fields and behavior                                                                                         | User-facing effect                                    | Canonical conflict / migration impact                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `controllers/jobsController.js`                                                                                                                | Public list/detail require `status=active` and approved/missing `approvalStatus`; related jobs only require active | Main public jobs, detail, views, related jobs         | Several public predicates disagree; no term-date or canonical check            |
| `dynamicContent/DynamicContentService.js`                                                                                                      | Active plus approved/missing for job blocks                                                                        | Homepage/page-builder job cards                       | Must use the same canonical predicate and approved content                     |
| `dashboardController.js`, `trendingController.js`, `recommendationsController.js`, `resumeAnalyzerController.js`, career dashboard composition | Usually `status=active` only                                                                                       | Dashboards, recommendations, trending, resume matches | Can expose pending/rejected legacy combinations                                |
| `seoController.js`                                                                                                                             | Active-only sitemap and landing-page queries                                                                       | Indexing/discovery                                    | Could index pending, expired-by-date, or unapproved Jobs                       |
| `publicProfileController.js`                                                                                                                   | Active/closed legacy buckets, sometimes company-name ownership fallback                                            | Employer/company profiles                             | Canonical owner and visibility must replace company-name inference             |
| `savedController.js`, `recentlyViewedController.js`                                                                                            | Entity existence requires `status=active`                                                                          | Save/recent access                                    | Must distinguish active list visibility from archive detail                    |
| `newsletterController.js`, `blogAutoGenerateService.js`                                                                                        | Active-only source Jobs                                                                                            | Public email/blog content                             | Pending or stale Jobs can be selected                                          |
| `monetizationController.js`                                                                                                                    | Active plus `isFeatured`/`isSponsored`; admin toggles flags                                                        | Featured/sponsored lists                              | Paid/featured state must not confer publication entitlement                    |
| `employerController.js` create                                                                                                                 | Creates `status=draft`, `approvalStatus=pending`, first job `planType=free`                                        | Employer private draft and free-first-job message     | `free` is not `free_beta`; totalJobsPosted is not quota evidence               |
| `employerController.js` update                                                                                                                 | Mutates content in place; active+approved becomes approval pending                                                 | Active edits are saved before moderation              | Major-edit failure cannot preserve old public content under this path          |
| `employerController.js` activate/reopen/close                                                                                                  | Activation may verify payment, sets active/pending and plan/expiry; reopen sets draft; close sets closed           | Employer lifecycle controls                           | Direct legacy activation bypasses canonical submit/moderation/quota            |
| `employerDashboardMetrics.js`                                                                                                                  | Active is active+approved; pending is any approval pending; draft and closed use status                            | Employer counts and cards                             | Buckets can overlap; no rejected/expired canonical metrics                     |
| `EmployerJobs.jsx`                                                                                                                             | Filters/buttons/badges use draft/active/closed plus separate approval badge                                        | Employer job management                               | “Active + pending approval” is a contradictory composite state                 |
| `EmployerPostJob.jsx`                                                                                                                          | Plan selection, `planType=free`, activate/checkout actions, legacy edit metadata                                   | Draft/plan/activation UX                              | Must remain unchanged until a separately authorized frontend cutover           |
| `applicationsController.js` and `JobVacancyService.js`                                                                                         | Apply loads by ID and permits when `status=active`; closing date is deadline or expiresAt                          | Internal application acceptance                       | Apply does not require approval or canonical term date                         |
| `JobDetail.jsx`                                                                                                                                | Renders Job fields and external link/email directly                                                                | Public content and apply destinations                 | Approved snapshot/domain verification is absent                                |
| `admin/moderationController.js`                                                                                                                | Queue by approval pending; approve sets active/approved; reject sets approval rejected                             | Bulk moderation                                       | No submission CAS, capacity, reason model, term dates, event, or outbox        |
| `admin/adminJobsController.js`                                                                                                                 | Admin can directly edit owner/content/state/approval/slug; publish/approve/reject/bulk/delete                      | Full admin job management                             | Direct writers conflict with canonical service ownership and append-only audit |
| `AdminContentJobs.jsx`                                                                                                                         | UI directly sends status/approval changes and exposes approve/reject                                               | Admin content controls                                | Requires later canonical moderation UI/API, not a schema-only change           |
| `workflow/workflowEntitySync.js`                                                                                                               | Workflow publication maps to approval approved; archive maps closed                                                | Editorial workflow                                    | Parallel publication authority conflicts with canonical moderation             |
| `paymentService.js` and payments controller                                                                                                    | Checkout/payment records; webhook can set active, plan, expiry, paidUntil, pending approval                        | Paid activation                                       | Paid publishing is disabled; payment cannot authorize beta publication         |
| `reminderJobs.js`                                                                                                                              | Expiry reminder uses `paidUntil`; no canonical expiry worker                                                       | Employer subscription reminder                        | Not the Free Beta 30-day expiry transaction                                    |
| `scraperService.js`, import handlers, seeds                                                                                                    | Create active/approved legacy Jobs, often with no employer                                                         | System/import public supply                           | Requires a separately classified system-managed publication lane               |
| production coverage/fingerprint/remediation scripts                                                                                            | Count/classify legacy status and approval                                                                          | Operations/audits                                     | Must remain legacy-compatible until migration tooling is separately approved   |
| employer integration and dashboard tests                                                                                                       | Construct active/approved Jobs and exercise close/reopen                                                           | Regression evidence                                   | Must keep passing during additive schema deployment                            |
| H2A/H2B-A tests                                                                                                                                | Require canonical state paths and fail closed without them                                                         | Dormant contract evidence                             | New schema must not activate the service or fake migrated data                 |

No current module implements a Free Beta canonical expiry worker. Some public
consumers use the stricter active+approved predicate, while many use active only.
This inconsistency is a high-risk cutover concern and is why schema addition
cannot include runtime activation.

## 6. Canonical additive Job projection

All fields below are server-controlled. Client input is forbidden. During
migration, canonical paths are nullable so old records are not reinterpreted.
After cutover, canonical services must populate and enforce them.

| Field                        | Type / transitional default    | Authority and invariant                                                                                | Index need                                                              | Privacy / compatibility                                                          |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| `publicationState`           | enum of six states; `null`     | Canonical create/submit/moderate/close/expire services only; required for native/backfilled projection | Public, employer, moderation, expiry indexes later                      | Public-safe status; null means not classified, never “draft by assumption”       |
| `publicationVersion`         | non-negative integer; `0`      | Increment once for every committed canonical lifecycle/content transition                              | No dedicated CAS index required beyond `_id`; included in atomic filter | Internal concurrency metadata; `__v` is not substituted                          |
| `currentSubmissionId`        | ObjectId ref, nullable         | Submit/decision services; latest accepted/current terminal submission                                  | Sparse lookup later                                                     | Internal/owner/moderator; replaces proposed duplicate `pendingSubmissionId`      |
| `lastApprovedSubmissionId`   | ObjectId ref, nullable         | Approval only; retained through close/expire/rejection until a later approval replaces it              | Sparse lookup and active-count support later                            | Internal link; authorizes current/last public version                            |
| `publishedAt`                | Date, nullable                 | Approval sets start of the current term                                                                | Public/start queries if scheduled starts are supported                  | Public timestamp                                                                 |
| `visibleUntil`               | Date, nullable                 | Free Beta approval sets `publishedAt + 30 days`                                                        | Blocking public/expiry index later                                      | Public timestamp                                                                 |
| `applicationsCloseAt`        | Date, nullable                 | Approval computes minimum valid deadline and visibleUntil                                              | Blocking apply/expiry-adjacent index later                              | Public timestamp                                                                 |
| `closedAt`                   | Date, nullable                 | Close transition only                                                                                  | Optional operational index                                              | Owner/admin/public archive-safe                                                  |
| `expiredAt`                  | Date, nullable                 | Expiry transition only                                                                                 | Optional operational index                                              | Owner/admin/public archive-safe                                                  |
| `rejectionSummary`           | strict embedded object or null | Decision service only: reason code, employer-safe text, event ID, decision time                        | No initial index                                                        | Owner/moderator; excludes internal text                                          |
| `slugFrozenAt`               | Date, nullable                 | First approval freezes current slug                                                                    | No new lookup index                                                     | Public timestamp; existing slug remains                                          |
| `policyVersion`              | bounded string, nullable       | Submit/approval service from centralized policy                                                        | Recommended audit index only if evidence requires                       | Public-safe code, not client selected                                            |
| `publicationUpdatedAt`       | Date, nullable                 | Every canonical lifecycle transition                                                                   | Employer/moderation history index later                                 | Public-safe timestamp; needed because `updatedAt` also changes for views/content |
| `publicationMigrationStatus` | `canonical_native              | legacy_backfilled                                                                                      | legacy_compatible                                                       | manual_review`, nullable                                                         | Migration/canonical writer only | Temporary classification query support if retained | Internal operational flag; null means unclassified |

### Existing field protection

`employerId` remains the existing field. The schema-only slice must not mark it
globally immutable because current admin/system paths rely on legacy behavior.
Future canonical repositories must reject reassignment after the first accepted
submission. A later cutover can add stronger conditional enforcement once
legacy writers are disabled.

### Evaluated but not recommended on Job

- `pendingSubmissionId`: duplicate of normative `currentSubmissionId`.
- `moderationCycleId`: authoritative on the current submission/event; duplicating
  it on Job creates drift.
- `publicationPlanCode`: authoritative on
  `lastApprovedSubmissionId.planCode`; active Free Beta usage must join that
  submission so future paid jobs are excluded.
- `approvedAt`: submission has `approvedAt`; Job uses normative `publishedAt`.
- `visibleFrom`: duplicates `publishedAt` for immediate beta approval.
- active-slot counter: usage is derived from canonical active Jobs, never a
  mutable counter.
- pending/approved content blobs: not required for the first hidden-during-review
  implementation if candidate mutation and state transition are atomic.

### Schema-only implementation constraints

- Use optional/null defaults for migration-sensitive fields.
- Do not add a pre-save hook that maps legacy fields.
- Cross-field validation must run only when a canonical state is explicitly
  populated.
- Do not make legacy records fail ordinary saves because their canonical paths
  are absent.
- Do not declare indexes in the same slice. `Job` is imported by runtime, and
  current connection configuration does not establish that automatic index
  creation is disabled; a declaration could become a production operation on
  deployment.

## 7. Canonical state-transition matrix

Every transition below uses the same owner guard where quota/slots are involved,
an expected source state, and `publicationVersion` CAS. A successful canonical
transition increments the version once and sets `publicationUpdatedAt`.

| Transition                       | Actor / submission                              | Quota and slot effect                                        | Public/content effect                        | Links/cycle                                                                      | Rollback and idempotency                                                        |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| none -> draft                    | Employer create                                 | No quota; 0/0 slots                                          | Private                                      | No submission/cycle                                                              | Validation failure creates nothing; draft key may be separately idempotent      |
| draft -> draft                   | Employer edit                                   | No quota; 0/0                                                | Private content update                       | Links unchanged                                                                  | Stale version preserves draft                                                   |
| draft -> pending_review          | Eligible employer, `initial`                    | Charged; 0/0                                                 | Hidden                                       | Current = new pending submission; new cycle                                      | Failure preserves draft; owner/key replay returns original                      |
| pending_review -> active         | Moderator approval                              | No new quota; 0/+1, require <=5                              | Public after commit; set term/frozen slug    | Current and last-approved = approved submission; same cycle                      | Capacity/CAS failure stays pending; repeat decision emits nothing               |
| pending_review -> rejected       | Moderator reject/changes requested              | No refund; 0/0                                               | Hidden                                       | Current retained; same cycle; safe rejection summary                             | CAS failure changes nothing; repeat decision idempotent                         |
| pending_review -> draft          | Employer withdrawal only if separately approved | No refund; 0/0                                               | Private                                      | Pending submission becomes withdrawn; clear current only under explicit contract | Not currently defined by H2B-A; do not infer from request changes               |
| rejected -> pending_review       | Eligible employer, `correction`                 | Exempt once if exact contract passes; otherwise charged; 0/0 | Hidden                                       | New current; same cycle only when exempt, otherwise new cycle                    | Failure preserves rejected state and prior decision                             |
| active -> active                 | Employer minor edit                             | No quota; 0/0                                                | Remains public                               | Last approved/cycle unchanged; audit minor fields                                | Major-field detection fails closed; CAS protects stale edit                     |
| active -> pending_review         | Eligible employer, `major_edit`                 | Charged; 1/0, accepted at 5/5                                | Candidate becomes hidden at the same commit  | Current = new submission; last-approved retained; new cycle                      | Candidate patch must not be pre-saved; failure preserves old active fields/slot |
| active -> closed                 | Owner/authorized admin                          | No refund; 1/0                                               | Hidden/archive detail                        | Links retained; existing cycle                                                   | CAS repeat releases zero and creates no duplicate event                         |
| active -> expired                | System worker                                   | No refund; 1/0                                               | Date predicate already hides; archive detail | Links retained; existing term/cycle                                              | CAS on same visibleUntil; repeat idempotent                                     |
| closed -> draft                  | Employer reopen for editing                     | No quota; 0/0                                                | Private, never automatically live            | No new cycle until submit                                                        | Failure remains closed                                                          |
| closed/expired -> pending_review | Eligible employer, `renewal` or `repost`        | Charged; 0/0                                                 | Hidden                                       | New current and new cycle; last-approved retained for history                    | Failure preserves terminal state                                                |

### Active major-edit solution

The accepted initial beta deliberately does not preserve public visibility while
review is pending. It preserves the pre-request public listing only on failed
acceptance:

1. Load the active Job by owner/state/version.
2. Apply the allow-listed patch to an in-memory candidate, never to the stored
   Job before transaction acceptance.
3. Validate and hash the candidate.
4. Enforce charged quota and acquire the owner guard.
5. Create the pending submission snapshot.
6. In the same transaction, replace allowed Job content with the candidate and
   CAS `active -> pending_review`, incrementing the publication version.
7. Commit event and outbox intent.

Before commit, legacy/current public fields remain unchanged. After commit the
canonical state hides the candidate. The previous approved snapshot remains
available through `lastApprovedSubmissionId` for audit, recovery, or a future
revision architecture. The current H2B-A `submitFreeBetaJob` command does not
accept a patch, so it cannot by itself safely implement step 2; a later
major-edit service boundary is required before its adapter enables that kind.

## 8. Canonical public visibility design

### Future predicates

Public list/search/sitemap eligibility:

```text
publicationMigrationStatus in [canonical_native, legacy_backfilled]
publicationState = active
lastApprovedSubmissionId != null
publishedAt <= now
visibleUntil > now
slugFrozenAt != null
```

Internal application eligibility additionally requires:

```text
applicationsCloseAt > now
applyType = internal
vacancy is not filled/closed
```

External apply links are displayed only from the approved, verified content
projection. Closed/expired detail may return an archive-safe projection, but
must not appear in lists or accept applications.

Employer verification is rechecked at submission/approval. Ongoing employer
suspension should cause an explicit audited close/suspension transition; public
queries should not silently infer state from an Employer join unless a later
policy explicitly requires that behavior.

### Content source recommendation

Use a hybrid materialized model for the first beta:

- Job canonical fields control visibility and are indexable.
- Existing Job content fields are the materialized active/candidate content for
  current frontend compatibility.
- `JobPublicationSubmission.contentSnapshot` is the immutable reviewed evidence
  and rollback integrity source.
- Approval verifies that the Job candidate hash equals the pending submission
  snapshot before activating it.
- An active major edit cannot mutate stored Job content before its atomic submit
  transaction.

Direct snapshot reads for every list would protect immutability but make
province/category/search indexes and current frontend queries expensive.
A separate public projection collection would best support future “old version
stays live during review,” but it adds transactional projection/outbox/migration
complexity that is not required by the approved initial beta.

### Dual-read and rollback

There must be no broad `$or` that treats every missing canonical field as public.
A reversible dual-read period can include a legacy branch only for records
explicitly marked `publicationMigrationStatus=legacy_compatible` after read-only
classification. `manual_review` and null/unclassified rows are excluded from the
canonical branch.

Before canonical writes activate, rollback can restore the prior legacy query.
After activation, rollback must disable new canonical writes and use a verified
compatibility projection; it must not broadly fall back to legacy fields because
that could expose pending/rejected/expired canonical jobs.

## 9. Employer dashboard compatibility

| Metric/UI state | Current calculation                      | Canonical calculation                                                                   |
| --------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Total jobs      | all owner Jobs                           | unchanged owner total, with optional native/legacy split during migration               |
| Draft           | `status=draft`                           | `publicationState=draft`                                                                |
| Active          | active + approved                        | `publicationState=active`; term expiry reported separately                              |
| Pending         | any approval pending                     | `publicationState=pending_review`                                                       |
| Rejected        | no Job metric                            | `publicationState=rejected`                                                             |
| Closed          | `status=closed`                          | `publicationState=closed`                                                               |
| Expired         | no Job metric                            | `publicationState=expired`                                                              |
| Usage totals    | total jobs/application metrics           | submissions ledger for daily/monthly; active Free Beta join through approved submission |
| Plan            | first-job/free and JobPlan legacy fields | approved submission `planCode`; paid publishing remains disabled                        |
| Applications    | Application counts by Job/apply mode     | remains Job-linked; visibility state does not erase analytics                           |

The current employer UI can display `status=active` alongside
`approvalStatus=pending`, producing an “active but pending approval” composite.
Canonical status must become one mutually exclusive badge. Frontend changes are
deferred until after schema, migration, and API compatibility are accepted.

## 10. Admin moderation compatibility

| Capability                   | Classification         | Finding                                                                             |
| ---------------------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| Pending-review queue         | `LEGACY_CONFLICT`      | Queue is approvalStatus pending, not pending immutable submissions                  |
| Approval action              | `PARTIAL`              | RBAC exists, but direct Job update lacks CAS/transaction/capacity/term/event/outbox |
| Rejection action             | `PARTIAL`              | Can set rejected and log generic audit reason; no canonical submission decision     |
| Changes requested            | `MISSING`              | No structured action/requested fields                                               |
| Employer-safe reason         | `MISSING`              | No required structured projection                                                   |
| Internal staff reason        | `PARTIAL`              | Generic audit reason exists but is not structurally separated                       |
| Moderation cycle             | `MISSING`              | No cycle link in legacy moderation                                                  |
| Immutable submission review  | `MISSING`              | Admin reviews mutable Job content                                                   |
| Approval capacity check      | `MISSING`              | No owner guard or active Free Beta count                                            |
| 30-day visibility assignment | `MISSING`              | Approval does not set canonical dates                                               |
| Moderation audit event       | `LEGACY_CONFLICT`      | Generic AuditLog is not append-only JobModerationEvent                              |
| Separation of duties         | `REQUIRES_LATER_PHASE` | RBAC exists; employer/staff identity linkage rule is not implemented                |
| Notification                 | `PARTIAL`              | Existing automation queues approval notices outside canonical transaction           |

Current admin content and workflow routes are separate publication authorities.
They must not write canonical fields until a later moderation cutover disables
or delegates those legacy actions.

## 11. Legacy-state classification

No production row counts are claimed. The table is a rule design only.

| Detectable legacy condition                                                         | Classification                                         | Candidate handling                                                                                        |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Employer-owned `status=draft`, approval pending/approved, no active/public evidence | `SAFE_WITH_DEFAULTS`                                   | Canonical draft; do not infer a submission                                                                |
| `status=draft` plus approval rejected or paid/public evidence                       | `REQUIRES_MANUAL_REVIEW`                               | Could be reopened/rejected/stale composite                                                                |
| Employer-owned active + approved + reliable approval/term evidence not expired      | `SAFE_AUTOMATIC_MAPPING`                               | Active with audited dates and approved migration submission                                               |
| Active + approved but no reliable publication timestamp/term                        | `REQUIRES_MANUAL_REVIEW`                               | Do not invent `publishedAt` from createdAt                                                                |
| Active + approval pending                                                           | `SAFE_WITH_DEFAULTS` only after content/owner evidence | Pending review with non-quota migration submission/event                                                  |
| Active + approval rejected                                                          | `SAFE_WITH_DEFAULTS`                                   | Rejected/non-public; reason unavailable unless evidence exists                                            |
| Closed, with coherent ownership and no contradictory active payment/public evidence | `SAFE_AUTOMATIC_MAPPING`                               | Closed; preserve analytics/applications                                                                   |
| Active + approved + reliably past `expiresAt`                                       | `SAFE_AUTOMATIC_MAPPING`                               | Expired using reliable date/evidence                                                                      |
| `paidUntil` or completed payment without coherent approval/plan/term                | `REQUIRES_MANUAL_REVIEW`                               | Payment is evidence, never publication authority                                                          |
| `planType=free`                                                                     | `UNKNOWN` for Free Beta plan                           | Never convert directly to `free_beta`                                                                     |
| starter/standard/premium or any payment record                                      | `REQUIRES_MANUAL_REVIEW`                               | Separate future paid lane; exclude from Free Beta count unless approved migration evidence says otherwise |
| Missing `approvalStatus` on active                                                  | `REQUIRES_MANUAL_REVIEW`                               | Legacy public query treats it approved, but moderation evidence is absent                                 |
| Missing employerId                                                                  | `REQUIRES_MANUAL_REVIEW`                               | Likely system/scraped/admin content; no beta quota owner                                                  |
| Invalid/missing owner reference                                                     | `INVALID_CONTRADICTION`                                | Quarantine; do not publish as employer-owned                                                              |
| Duplicate slug+locale                                                               | `INVALID_CONTRADICTION`                                | Resolve before unique index/cutover                                                                       |
| Missing/invalid slug on public candidate                                            | `INVALID_CONTRADICTION`                                | Cannot satisfy canonical URL                                                                              |
| Unsupported status/approval/plan value                                              | `UNKNOWN`                                              | Quarantine and inspect evidence                                                                           |
| `status=closed` but public-search/index evidence says current active                | `INVALID_CONTRADICTION`                                | Reconcile search/cache and source data                                                                    |
| Both remote and hybrid true                                                         | `REQUIRES_MANUAL_REVIEW`                               | Canonical work mode is ambiguous                                                                          |
| External mode without destination, or internal mode with external destination       | `REQUIRES_MANUAL_REVIEW`                               | Resolve application mode and destination                                                                  |
| Arbitrary/invalid application URL scheme                                            | `INVALID_CONTRADICTION`                                | Do not expose or approve                                                                                  |
| Translation record not marked published but legacy status active                    | `REQUIRES_MANUAL_REVIEW`                               | Public translation semantics conflict                                                                     |
| Hard-deleted Job                                                                    | `UNKNOWN`                                              | No Job archive/deletion flag exists; use audit/backups only                                               |

### Future read-only classification queries

Run only in a separately authorized production-read phase, returning counts and
opaque category summaries rather than document content:

1. group by `{status, approvalStatus, planType, source, employerPresent}`;
2. count active/approved rows by expiry presence and
   `expiresAt <= classificationTime`;
3. count missing/invalid owner references through a privacy-safe lookup;
4. group completed/pending/failed/refunded Payments by Job and compare plan IDs;
5. group `{slug, locale}` with count greater than one;
6. count missing slug, invalid state enum, invalid dates, and
   `deadline > visible/paid term` contradictions;
7. group active candidates per employer to find counts over five;
8. count active Jobs by application mode and destination presence/type;
9. count remote+hybrid contradictions;
10. group translation status against legacy public state;
11. compare public search/index IDs to source Job eligibility without returning
    titles, URLs, employer emails, or applicant data;
12. identify reliable approval timestamps only from auditable records, never
    from arbitrary `createdAt`.

These queries were not run.

## 12. Staged migration design

| Phase                                  | Purpose / likely files                                      | Database operation                                   | Rollback and gate                                                           | Risk / deployment                             |
| -------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------- |
| 1. Additive schema support             | `Job.js`, focused model test, report only                   | None                                                 | Revert code; old rows untouched; tests prove legacy validation              | Low; deployable, no window                    |
| 2. Index readiness audit               | Connection/index config and proposed definitions, read-only | None                                                 | No index declaration until topology/data evidence                           | Low; no deploy                                |
| 3. Dormant writers/adapters            | New leaf services only                                      | None unless tests use isolated DB                    | Remove imports/files; prove no startup/runtime reference                    | Medium; deployable dormant                    |
| 4. Read-only production classification | Dedicated target-guarded audit script/report                | Read-only counts                                     | Stop on target mismatch; no writes                                          | Medium; operator window recommended           |
| 5. Manual review                       | Opaque manifests and staff decisions                        | No automated mutation                                | Preserve signed decisions and unresolved quarantine                         | High; operational window                      |
| 6. Controlled index application        | Explicit reviewed operations after conflict resolution      | Index creation only                                  | Abort/roll back new nonessential indexes; never drop legacy indexes blindly | High; maintenance window may be needed        |
| 7. Controlled backfill                 | Resumable batches with target fingerprint/checkpoints       | Canonical fields plus append-only migration evidence | Restore from before-images/manifest; no legacy field changes                | High; approved window                         |
| 8. Dual-read compatibility             | Public/employer query compatibility layer                   | No required data write                               | Feature-controlled return to verified compatibility mode                    | High; deployment                              |
| 9. Canonical write activation          | New submit/moderation/close/expire services                 | Transactional writes                                 | Disable new writes; retain committed records                                | Blocking/high; transaction-capable deployment |
| 10. Public-query cutover               | All public/search/sitemap/apply consumers                   | No migration write                                   | Fail closed; do not broad-fallback after canonical writes                   | Blocking/high; monitored deployment           |
| 11. Legacy writer disablement          | Activate/checkout/webhook/admin/workflow delegation         | No direct migration                                  | Emergency re-enable only by explicit decision                               | High; same boundary as canonical writes       |
| 12. Legacy deprecation/cleanup         | Later removal after reconciliation                          | Possible later cleanup                               | Preserve fields until stability, rollback, and audit windows close          | High; separate phase/window                   |

Index declaration is not harmless in the current runtime because `Job` is
imported at startup and the connection does not explicitly disable automatic
index creation. It must not be combined with the additive field phase.

## 13. Deterministic backfill rules

| Canonical field            | Source/evidence                                  | Deterministic rule                                                         | Conflict/manual-review behavior                                    | Rollback source                |
| -------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| publicationState           | legacy state plus reliable audit/public evidence | Use section 11 categories only                                             | Null/manual review when ambiguous                                  | Signed classification manifest |
| publicationVersion         | none                                             | `0` for one-time backfilled baseline; native writers start 0 and increment | Never derive from `__v`                                            | Before-image                   |
| currentSubmissionId        | migration submission                             | Link only to transactionally created migration/current record              | Leave null and quarantine if record cannot be created safely       | Migration submission/event     |
| lastApprovedSubmissionId   | reliable active/previous approval evidence       | Link approved migration submission only                                    | Never fabricate approval                                           | Manifest/evidence              |
| publishedAt                | reliable approval/payment/audit timestamp        | Exact evidence timestamp only                                              | Missing/contradictory timestamp = manual review                    | Evidence reference             |
| visibleUntil               | reliable publishedAt plus approved term          | For accepted Free Beta migration term, publishedAt + 30 days               | Unknown/paid term = manual review                                  | Computable from evidence       |
| applicationsCloseAt        | valid deadline and visibleUntil                  | minimum valid deadline/visibleUntil                                        | Invalid date = manual review or visibleUntil only by explicit rule | Legacy deadline                |
| closedAt                   | reliable close event/timestamp                   | Exact evidence only                                                        | Missing time does not get createdAt fallback                       | Audit/manifest                 |
| expiredAt                  | reliable term expiry/worker evidence             | Exact expiry/classification time under approved rule                       | `paidUntil` alone is not beta expiry                               | Date evidence                  |
| rejectionSummary           | employer-safe audit evidence                     | Copy only allowed reason/event/time                                        | Otherwise null with “reason unavailable” outside field             | Audit event                    |
| slugFrozenAt               | reliable first approval time                     | Same as first proven approval when slug is unique                          | Duplicate/missing slug = manual review                             | Existing slug/evidence         |
| policyVersion              | migration policy decision                        | `free-beta-2026-01` only for records deliberately adopted into this policy | Legacy paid/system records do not receive it automatically         | Manifest                       |
| publicationUpdatedAt       | migration transaction time                       | Server/database time of backfill                                           | Never pretend it is historical approval time                       | Migration audit                |
| publicationMigrationStatus | migration decision                               | native/backfilled/legacy-compatible/manual-review                          | Unresolved stays manual/null and non-canonical                     | Manifest                       |

Additional handling:

- currently public Jobs remain public during pre-cutover phases because legacy
  fields and queries are untouched;
- pending/rejected candidates require non-quota migration submissions only when
  enough evidence exists;
- uncertain migration submissions use
  `legacy_migration_non_chargeable`, never rolling quota;
- paid/system/scraped Jobs remain separate from Free Beta owner capacity;
- unknown plan values, missing ownership, duplicate slugs, invalid dates, and
  destination contradictions are never automatically coerced;
- no backfill changes `status`, `approvalStatus`, `planType`, `expiresAt`,
  `paidUntil`, content, applications, analytics, or payment records;
- each batch records target fingerprint, policy/tool version, before/after
  hashes, category, checkpoint, actor, and incident/change reference.

## 14. Index plan

| Proposed index                                                        | Options / query                                                          | Risk and classification                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `{publicationState:1, visibleUntil:1, _id:1}`                         | Public expiry and worker order                                           | Blocking before public/worker wiring; invalid dates do not block but partial migration can produce wrong results |
| `{publicationState:1, applicationsCloseAt:1, _id:1}`                  | Apply eligibility and due scans                                          | Blocking before canonical apply wiring                                                                           |
| `{employerId:1, publicationState:1, publicationUpdatedAt:-1, _id:-1}` | Employer history/dashboard                                               | Blocking before dashboard/active count scale                                                                     |
| `{publicationState:1, publicationUpdatedAt:1, _id:1}`                 | Pending moderation queue                                                 | Blocking before moderation wiring                                                                                |
| `{currentSubmissionId:1}`                                             | Sparse, preferably unique after duplicate audit                          | Blocking before runtime links; duplicate links could block creation                                              |
| `{lastApprovedSubmissionId:1}`                                        | Sparse, preferably unique after audit                                    | Blocking before approved lookup; bad historical links could block                                                |
| `{employerId:1, publicationState:1, lastApprovedSubmissionId:1}`      | Active Free Beta owner count + submission join                           | Blocking before approval/runtime                                                                                 |
| existing `{slug:1,locale:1}`                                          | Unique canonical detail                                                  | Already declared; live duplicates must be measured before relying on it                                          |
| existing submission partial `{jobId:1}` pending_review                | Unique pending submission per Job                                        | Correct ledger invariant; live existence unverified                                                              |
| no publicationVersion-only index                                      | CAS begins with unique `_id` and includes owner/state/version atomically | `NOT_REQUIRED`; correctness comes from filter, not a secondary index                                             |
| temporary legacy classification index                                 | Only if read-only explain plans/counts prove necessary                   | Recommended only for scale; avoid permanent migration-only index                                                 |

No index is authorized or applied by this audit. Duplicate links/slugs, invalid
ObjectIds, and unexpected state values must be resolved before unique index
creation. Index creation needs explicit target verification, operational
monitoring, and rollback instructions.

## 15. Publication version and compare-and-set contract

- Native initial value: `0`.
- Backfilled baseline: `0`, recorded as a migration baseline rather than
  reconstructed history.
- Increment exactly once for every committed canonical content/lifecycle
  mutation:
  draft edit, submission acceptance, moderation decision, minor edit, close,
  expire, reopen, and approved renewal term.
- Do not increment for view/application counters, analytics, or idempotent
  replay.
- Submit CAS filter:
  `{_id, employerId, publicationState: expectedSourceState,
publicationVersion: expectedPublicationVersion}` plus no incompatible pending
  submission.
- Decision CAS additionally requires matching `currentSubmissionId` and pending
  submission state.
- Expiry CAS requires active state, expected version, and the same
  `visibleUntil` selected by the worker.
- Stale mutations return `JOB_VERSION_CONFLICT`; state-specific mismatches use
  the accepted stable errors.
- `__v` is insufficient: query updates do not consistently increment it, it
  covers unrelated document saves, current code does not pass it as an API
  precondition, and it has no publication semantics.
- All quota/slot/link/event/outbox transitions require one database transaction.
- Same idempotency key and fingerprint returns the committed result without a
  second increment; changed fingerprint conflicts.

Ordinary draft editing may continue to use the same publication version because
the reviewed snapshot is tied to that version. Active major edits cannot call
the ordinary in-place update path before transaction acceptance.

## 16. Submission/public projection strategy

| Option                               | Benefits                                                                     | Risks                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A. Job content only                  | Fast/current queries and indexes                                             | Unsafe if active content is edited before submit; weaker immutable evidence         |
| B. Direct immutable submission reads | Strong integrity and rollback                                                | Lookup/aggregation cost; difficult category/search indexing; frontend shape mapping |
| C. Dedicated public projection       | Best old-version-live behavior and independent indexes                       | New model, transaction, migration, reconciliation, and worker complexity            |
| D. Hybrid (recommended)              | Job lifecycle/index/content compatibility plus immutable submission evidence | Requires hash agreement and strict atomic active-major-edit boundary                |

Recommendation D for the initial beta:

- Job holds materialized content and canonical lifecycle.
- Pending/approved submission snapshots are immutable review evidence.
- Public reads use Job content only when the canonical visibility predicate
  passes and its approved content hash matches `lastApprovedSubmissionId`.
- Approval verifies candidate/snapshot equality.
- A failed major-edit request never writes Job content.
- A committed major edit hides the Job during review, as already approved.

If product later requires the old approved version to remain live during review,
use option C or a versioned Job content model in a separately approved phase.
Do not quietly extend the initial beta semantics.

## 17. Application-destination ownership analysis

| Destination                                             | Current evidence                                                             | Classification                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Internal Strideto apply, no external destination        | applyType and internal Application path                                      | `VERIFIABLE_NOW` when fields are consistent                               |
| Employer contact email                                  | Syntax can be checked; domain can be compared to employer email              | `PARTIALLY_VERIFIABLE`; mailbox/control is not proven                     |
| Link on employer website domain                         | URL and Employer.website can be parsed/compared                              | `PARTIALLY_VERIFIABLE`; website ownership itself is not strongly verified |
| External ATS on employer domain                         | Host relationship can be compared                                            | `PARTIALLY_VERIFIABLE`; tenant/route control is not proven                |
| Third-party ATS/vendor domain                           | No tenant ownership field or allow-list                                      | `UNVERIFIED`                                                              |
| Arbitrary external/source URL                           | Current server stores it without robust ownership validation                 | `UNVERIFIED`                                                              |
| Non-http(s), credentialed, malformed, local/private URL | Client may reject some values; server paths can still persist arbitrary text | `UNSUPPORTED`                                                             |
| Both email and URL with unrelated domains               | Two competing destinations                                                   | `REQUIRES_MANUAL_REVIEW`                                                  |
| Scraped/system source link                              | Source provenance may exist                                                  | `UNVERIFIED` for employer ownership; separate trust lane                  |

Future server contract:

1. determine internal versus external from server-validated fields;
2. accept only normalized HTTP(S) URLs without embedded credentials;
3. reject local/private/reserved hosts and malformed/opaque destinations under
   an explicitly tested URL policy;
4. extract normalized host/registrable domain and normalized email domain;
5. compare against verified employer website/email evidence;
6. maintain a reviewed ATS allow-list with tenant/account evidence if supported;
7. store full destination only where needed for apply, but store only normalized
   domain in immutable moderation snapshots;
8. treat destination domain/ownership changes as core-vacancy changes;
9. send unresolved ownership to manual moderation, never auto-approve it.

DNS verification, external APIs, and ATS integrations are future options, not
present capabilities. No such capability is claimed here.

## 18. Rollback plan

### Additive schema

- Revert the schema commit before any canonical writes.
- Nullable paths mean old records and legacy readers remain valid.
- Do not remove paths after canonical data exists without a separate
  compatibility plan.

### Index creation

- Apply only through an explicit operation after conflict audit.
- Abort on duplicate/invalid evidence.
- Drop only the newly added index when a reviewed rollback requires it; never
  remove legacy indexes opportunistically.

### Backfill

- Use resumable batches, immutable manifest, before-image/hash, and checkpoint.
- Stop on target mismatch or category-count drift.
- Restore canonical fields from before-images without touching legacy fields.
- Never delete migration submissions/events that were already committed.

### Dual read

- Before canonical writes, switch back to the verified legacy predicate if
  needed.
- After canonical writes, disable new writes and use an explicit compatibility
  projection; never expose missing-canonical rows by a broad fallback.

### Canonical write activation

- Disable submit/moderation/close/expire entry points on uncertainty.
- Preserve all committed submissions, events, acknowledgements, guard revisions,
  and outbox intents.
- Reconcile owner counts and links before re-enabling.

### Public-query and expiry cutover

- The date predicate remains fail closed even if the worker is rolled back.
- A late/disabled worker must not make expired Jobs public.
- Rollback must preserve currently valid visible Jobs through a verified
  compatibility list, while pending/rejected/expired Jobs remain excluded.

Legacy `status`, `approvalStatus`, `planId`, `planType`, `expiresAt`,
`paidUntil`, slug, content, owner, applications, and analytics must remain
untouched until canonical stability and rollback windows are proven.

## 19. Future test strategy

### Schema/model

- nullable legacy compatibility;
- enum/type/integer validation;
- conditional state/date/link invariants;
- strict rejection summary and no internal reason;
- no default canonical state inferred for legacy Jobs;
- no added index in schema-only slice;
- existing slug/translation hooks unchanged.

### Lifecycle and transaction

- every transition/source-state/submission-kind pair;
- stale version and owner mismatch;
- pending link uniqueness;
- approval at 4/5 succeeds and 5/5 remains pending;
- initial/correction submission at 5/5 succeeds;
- active major edit at 5/5 commits to projected 4/5;
- major-edit validation/quota/transaction failure preserves old public content
  and slot;
- rejection/changes request/correction cycle behavior;
- renewal/repost creates a new charged cycle;
- close/expire idempotency and slot release;
- unknown commit/idempotency resolution.

### Public/apply/dashboard

- exact `publishedAt` and `visibleUntil` boundaries;
- late expiry worker still excluded by query;
- applicationsCloseAt boundary enforced server-side;
- archive detail versus list/apply behavior;
- dual-read explicit legacy-compatible branch only;
- manual-review/unclassified rows excluded from canonical branch;
- dashboard buckets mutually exclusive;
- search/sitemap/recommendation/newsletter/dynamic blocks share one predicate.

### Migration and indexes

- every classification category and contradiction;
- no guessed timestamp/plan/owner;
- resumable/idempotent batch and rollback manifest;
- duplicate slug/link detection;
- active Free Beta count uses approved `free_beta` submission only;
- future paid/system Jobs excluded;
- index definitions match explain-tested queries and do not auto-apply in the
  schema-only phase.

### Privacy/security

- no applicant data in publication/migration records;
- no payment state trusted as publication authority;
- no raw request, token, credentialed URL, or private moderation reason in a
  public projection;
- destination classification and domain-change moderation;
- no runtime import or behavior change before explicit wiring.

No tests were created or run by this audit.

## 20. Risks and blockers

| Risk                                | Rating                   | Finding                                                                                      |
| ----------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| Additive nullable schema paths      | `LOW`                    | Safe when no new indexes, mapping hooks, or legacy-required validators are added             |
| Legacy-state ambiguity              | `BLOCKING` for migration | Repository code proves combinations exist semantically; row counts/evidence are unknown      |
| Public-query cutover                | `BLOCKING`               | Many inconsistent consumers must converge on one fail-closed predicate                       |
| Active-major-edit preservation      | `HIGH`                   | Safe design exists, but requires atomic candidate patch+submit boundary not present in H2B-A |
| Duplicate slugs/locales             | `HIGH`                   | Unique index declared, live conflicts unknown                                                |
| Invalid/missing timestamps          | `HIGH`                   | Approval/term dates cannot be invented                                                       |
| Unknown plan values/paid separation | `BLOCKING`               | Legacy plan/payment values are not Free Beta authority                                       |
| Publication versioning              | `MEDIUM`                 | Additive field is simple; every later writer must use CAS consistently                       |
| Migration rollback                  | `HIGH`                   | Requires before-images, manifests, no legacy mutation, and compatibility reads               |
| Active Free Beta count              | `HIGH`                   | Requires canonical state, approved-submission link, same-session query                       |
| Application-destination ownership   | `HIGH`                   | Only partial domain evidence exists                                                          |
| Admin moderation                    | `BLOCKING` for runtime   | Legacy direct update lacks canonical transaction contract                                    |
| Expiry processing                   | `BLOCKING` for runtime   | No canonical worker or date-aware universal public predicate                                 |
| Transaction topology                | `BLOCKING` for runtime   | Production transaction capability remains unverified                                         |
| Index auto-application              | `HIGH`                   | Job is a runtime model; schema index declaration may not be dormant                          |
| Translation visibility              | `HIGH`                   | Current public Job queries do not consistently enforce translation publication status        |

None of the blocking runtime/migration risks requires changing the verdict for a
strictly dormant additive schema-only slice.

## 21. Proposed ordered next phases and exact immediate scope

### H2B-B1-B — Additive canonical Job publication schema only

Exact proposed allowlist:

```text
MODIFY
server/src/models/Job.js

CREATE
server/src/__tests__/canonicalJobPublicationSchema.test.js
docs/FREE_BETA_CANONICAL_JOB_PUBLICATION_SCHEMA_REPORT.md

INSPECT_ONLY
server/src/config/freeBetaPublishingPolicy.js
server/src/models/JobPublicationSubmission.js
server/src/models/JobModerationEvent.js
docs/FREE_BETA_PUBLISHING_POLICY_CONTRACT.md
docs/FREE_BETA_CANONICAL_JOB_PUBLICATION_STATE_MIGRATION_AUDIT.md

FORBIDDEN
all controllers, routes, public queries, frontend, payment, worker, connection,
package, environment, deployment, migration, seed, remediation, index-operation,
H2A, and H2B-A files
```

The implementation must add fields/subschemas only. It must not add indexes,
perform mapping, change legacy defaults, add runtime imports, or connect to a
database.

### Later phases

1. H2B-B1-C — Schema acceptance audit and local checkpoint.
2. H2B-B1-D — Atomic active-major-edit candidate/service contract audit.
3. H2B-B2-A — Typed publishing outbox audit.
4. H2B-B2-B — Dormant typed outbox foundations.
5. H2B-B3-A — Transaction topology verification on an authorized non-production
   or read-only production-safe boundary.
6. H2B-B4-A — Dormant repository adapter implementation, with major-edit kind
   disabled unless B1-D is accepted.
7. H2B-B5-A — Target-guarded read-only legacy production classification.
8. H2B-B5-B — Manual-review and controlled index readiness audit.
9. H2B-B6-A — Controlled migration/backfill plan requiring explicit operator
   approval; no automatic execution.
10. H2B-B7 — Runtime composition, moderation, public-query/apply/dashboard
    cutover, and legacy writer disablement only after every prerequisite passes.

Paid publishing remains disabled throughout these phases. No phase name itself
constitutes approval.

## 22. Preservation statement

- Application code changed: No.
- Existing Job/Employer changed: No.
- H2A/H2B-A changed: No.
- Controllers/routes/public queries changed: No.
- Frontend/theme/responsiveness changed: No.
- Authentication/RBAC weakened: No.
- Security/privacy weakened: No.
- Payment/webhook behavior changed: No.
- Configuration/dependencies changed: No.
- Production data read/written: No.
- Database connection performed: No.
- Migration/index application performed: No.
- Files staged: No.
- Commit performed: No.
- Push performed: No.
- Deployment performed: No.
- Mongoose adapter implementation started: No.
- Production acceptance report changed: No.

STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED
