# Free Beta Submission Adapter Blocker Contract Audit

## 1. Executive verdict

**READY FOR DORMANT SUBMISSION ADAPTER BLOCKER CONTRACT FOUNDATION**

The three accepted blockers are real and remain unresolved in code, but each
can now be expressed as a strict, fail-closed contract without changing current
runtime behavior:

1. Active major edits require a complete normalized publication candidate
   derived from the immutable last-approved submission, never from a Job that a
   legacy route has already mutated.
2. Application destinations require a strict mode/value/evidence contract.
   Current repository evidence proves only the internal platform route.
   External URL and email destinations can safely be classified as
   `ADMIN_REVIEW_REQUIRED`; they cannot be called employer-owned or verified.
3. Unknown commit handling requires stable record identities created before
   the retryable transaction callback plus an immutable reconciliation context
   returned by the callback before commit. A publishing-specific runner can
   then perform bounded, authoritative, read-only reconciliation.

The first implementation dependency can be a pure, dormant application
destination contract module with database-free tests. It requires no model,
service, controller, route, public-query, startup, worker, frontend,
configuration, or dependency change.

This verdict does not authorize a Mongoose adapter, schema change, accepted
service change, replica-set test, runtime composition, public-query cutover, or
external destination publication. Those remain gated by later phases.

## 2. Repository state

- HEAD:
  `42a985e5bdc3903767ab9a784906acdb3e41160b`
  (`docs: re-audit mongoose submission adapter readiness`).
- Branch: `main...origin/main [ahead 9]`.
- No merge, rebase, cherry-pick, revert, or conflict operation was active.
- No tracked file was modified before this report.
- No file was staged.
- The only pre-existing untracked file was
  `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`.
- The production acceptance report was not opened, modified, staged, or
  otherwise touched.

## 3. Accepted blocker findings

The accepted findings remain:

| Finding                                    | Status after this audit                                           |
| ------------------------------------------ | ----------------------------------------------------------------- |
| Active-major-edit candidate boundary       | Contract defined; code unresolved                                 |
| Application-destination ownership/evidence | Contract defined with fail-closed external trust; code unresolved |
| Unknown-commit reconciliation context      | Contract defined; code unresolved                                 |
| Production transaction topology            | Unproved                                                          |
| Mongoose adapter implementation authorized | No                                                                |

Nothing in this report reclassifies current runtime behavior as safe. The
report defines prerequisites for later dormant foundations.

## 4. Current submission-command input

`submitFreeBetaJob` currently accepts a strict object with exactly these
top-level fields:

```text
authenticatedEmployerId
jobId
submissionKind
expectedPublicationVersion
idempotencyKey
postingRules
correctionOfSubmissionId
```

`postingRules` accepts only:

```text
accepted
version
```

Current details:

- Authenticated actor: only `authenticatedEmployerId`; ownership is checked
  against the loaded Job.
- Job identifier: `jobId`.
- Idempotency key: trimmed printable ASCII, 16 through 128 characters.
- Requested type: one of `initial`, `correction`, `major_edit`, `renewal`, or
  `repost`.
- Major-edit indicator: only `submissionKind === "major_edit"`.
- Correction evidence: only `correctionOfSubmissionId`; the service loads
  predecessor and moderation evidence.
- Expected concurrency value: non-negative
  `expectedPublicationVersion`.
- Candidate patch: absent.
- Complete candidate: absent.
- Application destination: absent.
- Client request fingerprint: absent and correctly not trusted.
- Moderation cycle: absent; the service reuses accepted predecessor evidence
  for an exempt correction or generates a cycle inside the transaction
  callback.
- Generated record IDs: moderation cycle, acknowledgement, submission, and
  moderation event are generated inside the transaction callback.
- Outbox IDs: repository/Mongoose generated; the service supplies deterministic
  deduplication keys derived from submission ID and intent type.
- Clock: injected `clock.now()` is called inside the transaction callback.
- Transaction runner input: one callback, called as
  `transactionRunner.run(async ({session}) => result)`.

The request fingerprint is built inside the callback from:

```text
jobId
expectedPublicationVersion
submissionKind
correctionOfSubmissionId or null
policyVersion
rulesVersion
contentHash
```

Current capability:

| Requirement                                              | Current result |
| -------------------------------------------------------- | -------------- |
| Preserve a complete major-edit candidate                 | No             |
| Prove destination ownership                              | No             |
| Construct complete unknown-commit reconciliation context | No             |

## 5. Active-major-edit trace

### Current trace

1. Employer UI validates and sends an ordinary Job update payload.
2. `employerController.updateJob` loads the owned Job and mutates the stored
   document in place.
3. The route can change title, company/display identity, location fields,
   category, employment/job type, education, experience, destination URL/email,
   description, requirements, salary, skills, and deadline.
4. For a legacy active/approved Job, it sets legacy approval to pending but
   leaves legacy `status` active, then saves the content immediately.
5. There is no route constructing or calling the dormant
   `submitFreeBetaJob` command.
6. If the dormant service were called separately, its snapshot builder would
   receive the already persisted Job and `submissionKind`, not the original
   approved record and not a candidate patch.
7. The current immutable submission snapshot stores a subset of publication
   content and only destination mode/domain.
8. The accepted Job repository adapter does not exist. Its future CAS inputs
   contain snapshot evidence but no patch to apply.
9. The service appends a submitted event containing content hash and quota
   metadata, not the candidate body.
10. No canonical approval service reconstructing/copying candidate content
    exists.
11. Current public queries continue to select legacy-active Jobs, so canonical
    pending state alone would not hide the already mutated record.

### Consequences

- A complete candidate patch does not exist.
- A complete normalized candidate does not exist.
- The current immutable content snapshot omits benefits, organization display
  identity, gender, auto-close behavior, application instructions, logo,
  gallery, exact destination, destination trust evidence, and several
  server-derived relationships required for deterministic reconstruction.
- Current Job content can be mutated before submission acceptance or review.
- A failed H2B transaction would preserve the Job as it existed when that
  transaction began, but that can already be the unapproved mutated content. It
  does not recover the last approved public content.
- Future approval cannot deterministically reconstruct every approved Job field
  from the current snapshot.

Current boundary classification: **UNSAFE**.

## 6. Candidate representation options

| Option                                       | Deterministic review and approval                                    | Drift/conflict                                                           | Privacy/storage                    | Evolution and correction                            | Decision                                            |
| -------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| A. Sparse patch plus base version            | Requires reloading and correctly replaying the exact historical base | Vulnerable to missing fields, patch semantics drift, and base loss       | Smallest                           | Complex across schema versions and corrections      | Reject                                              |
| B. Complete normalized publication candidate | Reviewer and approval consume one immutable representation           | Base identity/version still CAS-protected; no mutable-content dependence | Moderate, bounded by strict fields | Clear schema version, hash, full correction history | Recommend                                           |
| C. Separate candidate model                  | Deterministic if linked correctly                                    | Adds cross-model lifecycle, deduplication, and orphan risks              | Similar or greater                 | More migrations/indexes/repositories                | Not justified while submission is already immutable |

**Recommended: Option B — complete normalized publication candidate stored as
strict immutable submission evidence.**

The candidate is not a copy of the entire Job document. It is a versioned,
strict publication representation with no arbitrary metadata, system state,
payment data, analytics, or private employer evidence.

## 7. Recommended candidate contract

### Source and base

For `major_edit`:

- Authoritative base record:
  `Job.lastApprovedSubmissionId` resolved to one approved immutable
  `JobPublicationSubmission`.
- Required base state: current owned Job is canonically active,
  native/backfilled, within visibility, and its current/last-approved link
  identifies the same approved submission.
- `basePublicationVersion`: the active Job publication version supplied as the
  command precondition and verified by CAS.
- `baseApprovedSubmissionId`: server-read link, never selected by the client.
- Mutable Job content is not the candidate base.

For a future correction of a rejected major edit, the prior immutable rejected
candidate is the patch base while `baseApprovedSubmissionId` remains the
original approved vacancy.

### Strict representation

The minimum complete candidate is:

```text
schemaVersion
candidateRevision
basePublicationVersion
baseApprovedSubmissionId
content
destinationEvidence
candidateHash
```

`content` has a fixed shape:

```text
title
companyName
organizationName
description
requirements
responsibilities
benefits
skillsRequired
salaryRange
salaryCurrency
location
province
city
category
employmentType
jobType
educationRequirement
experience
gender
workMode
deadline
totalSeats
autoCloseWhenFilled
applicationInstructions
logoUrl
gallery
```

`destinationEvidence` is the strict contract in sections 13 through 20.

### Employer patch allowlist

The first contract should match actual employer edit capability after mapping
aliases to canonical names:

```text
title
description
requirements
skillsRequired
salaryRange
location
province
city
category
employmentType
jobType
educationRequirement
experience
deadline
destination
```

Other candidate fields are copied from the approved base until a separate
product/API phase authorizes them as employer-editable.

### Forbidden input

The patch must reject:

```text
_id
employerId
postedBy
companyName
organizationName
slug
locale
translationGroupId
translationOf
translationStatus
status
approvalStatus
planId
planType
expiresAt
paidUntil
publicationState
publicationVersion
currentSubmissionId
lastApprovedSubmissionId
publishedAt
visibleUntil
applicationsCloseAt
closedAt
expiredAt
rejectionSummary
slugFrozenAt
policyVersion
publicationUpdatedAt
publicationMigrationStatus
views
applicationsCount
isFeatured
isSponsored
priority
urgent
boostLevel
source
scrapedAt
sourceUrl
sourceWebsite
externalId
destination ownership/trust fields
quota or payment fields
```

Company/employer identity changes are a different vacancy/security decision,
not a major-edit patch.

### Normalization and validation

- Require a strict plain object; reject symbols, accessors, dotted/operator
  keys, prototype keys, nested unknowns, and non-enumerable values.
- Normalize strings with Unicode NFC and trim surrounding whitespace.
- Strip HTML from plain-text fields through an accepted server sanitizer.
- Reject values exceeding explicit field bounds; do not silently truncate.
- Normalize string arrays item by item, preserve order, reject non-strings and
  over-limit arrays, and represent absence as an empty array.
- Represent absent optional scalars as `null`, not `undefined`.
- Validate exact Job enums.
- Derive one `workMode`; reject simultaneous remote and hybrid truth.
- Normalize valid dates to UTC instants and enforce the approved deadline
  policy at server time.
- Build destination evidence through the destination contract; raw destination
  trust fields are never copied.
- Serialize fixed keys in fixed order and compute lowercase SHA-256
  `candidateHash`.

### Fingerprint and relationships

The request fingerprint must include:

```text
jobId
submissionKind
expectedPublicationVersion
baseApprovedSubmissionId
candidateRevision
candidateHash
correctionOfSubmissionId or null
policyVersion
rulesVersion
idempotency scope
```

The submission stores the complete candidate, its hash, base identity/version,
candidate revision, destination evidence, moderation cycle, and predecessor.
The moderation event stores the same candidate hash and cycle.

### Approval, rejection, and concurrency

- Approval reads only the pending submission candidate, verifies its hash and
  destination decision, and copies allow-listed candidate fields into Job
  atomically with canonical approval.
- Approval must not reapply the original sparse patch.
- Approval remains an admin action, acquires active capacity, sets current and
  last-approved links to the approved submission, and sets the Free Beta
  visibility term from server policy.
- Rejection leaves the last-approved submission immutable and the listing
  hidden under the canonical gate.
- Correction creates another immutable full candidate; it never mutates the
  rejected submission.
- A pending Job cannot accept another submission or active edit. The canonical
  state guard and unique pending-submission index enforce this.
- Replays return the existing candidate/result and do not create another
  revision.

## 8. Editable-field classification

Publishing candidates require a narrower contract than translation or
duplication projections. Those projections are useful inventory but copy
ownership and destination fields that a client patch must not control.

| Job field/area                                                  | Classification                                  | Major-edit rule                                          |
| --------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| `title`                                                         | `EMPLOYER_EDITABLE_CONTENT`                     | Strict normalized patch; core-vacancy change             |
| `description`                                                   | `EMPLOYER_EDITABLE_CONTENT`                     | Plain-text normalized; core-vacancy change               |
| `requirements`                                                  | `EMPLOYER_EDITABLE_CONTENT`                     | Strict string array; core-vacancy change                 |
| `responsibilities`                                              | `COPY_FROM_APPROVED_BASE`                       | Not in current employer update allowlist                 |
| `benefits`                                                      | `COPY_FROM_APPROVED_BASE`                       | Not in current employer update allowlist                 |
| `educationRequirement`                                          | `EMPLOYER_EDITABLE_CONTENT`                     | Strict bounded text                                      |
| `experience`                                                    | `EMPLOYER_EDITABLE_CONTENT`                     | Strict bounded text                                      |
| `category`                                                      | `EMPLOYER_EDITABLE_CONTENT`                     | Core-vacancy change                                      |
| `type` / employment type                                        | `EMPLOYER_EDITABLE_CONTENT`                     | Exact enum                                               |
| `skillsRequired`                                                | `EMPLOYER_EDITABLE_CONTENT`                     | Strict string array                                      |
| `company`, `organization`                                       | `FORBIDDEN` plus `COPY_FROM_APPROVED_BASE`      | Employer/company identity cannot change in major edit    |
| `province`, `city`, `location`                                  | `EMPLOYER_EDITABLE_CONTENT`                     | Core-vacancy change                                      |
| `remote`, `hybrid`                                              | `SERVER_DERIVED`                                | Candidate uses one normalized `workMode`                 |
| `salaryRange`                                                   | `EMPLOYER_EDITABLE_CONTENT`                     | Bounded text                                             |
| `salaryCurrency`                                                | `COPY_FROM_APPROVED_BASE`                       | Separate product authorization required                  |
| `gender`                                                        | `COPY_FROM_APPROVED_BASE`                       | Separate product/legal review required                   |
| `deadline`                                                      | `EMPLOYER_EDITABLE_CONTENT`                     | Valid server-time date                                   |
| `totalSeats`                                                    | `COPY_FROM_APPROVED_BASE`                       | Current employer update does not allow it                |
| `autoCloseWhenFilled`                                           | `COPY_FROM_APPROVED_BASE`                       | Current employer update does not allow it                |
| `applyType`                                                     | `SERVER_DERIVED`                                | Derived from strict destination mode                     |
| `applicationLink`, `applyEmail`                                 | `EMPLOYER_EDITABLE_DESTINATION`                 | Raw value only; trust/evidence server controlled         |
| `applicationInstructions`                                       | `COPY_FROM_APPROVED_BASE`                       | Cannot become an unreviewed destination fallback         |
| `logoUrl`, `gallery`                                            | `COPY_FROM_APPROVED_BASE`                       | Separate employer-publication authorization required     |
| `employerId`                                                    | `FORBIDDEN`                                     | Authenticated ownership only                             |
| `postedBy`                                                      | `FORBIDDEN`                                     | Server/admin identity only                               |
| `slug`                                                          | `SERVER_DERIVED`                                | Remains frozen; no major-edit patch                      |
| `status`, `approvalStatus`                                      | `LEGACY_ONLY`                                   | Never canonical truth or client patch                    |
| `planId`, `planType`, `expiresAt`, `paidUntil`                  | `PAYMENT_CONTROLLED` plus `LEGACY_ONLY`         | Paid publishing disabled; never candidate input          |
| `views`, `applicationsCount`                                    | `ANALYTICS`                                     | Excluded from candidate/hash                             |
| `isFeatured`, `isSponsored`, `priority`, `urgent`, `boostLevel` | `ADMIN_CONTROLLED`                              | Excluded from employer candidate                         |
| Canonical publication fields                                    | `CANONICAL_STATE`                               | Transaction service only                                 |
| `locale`, translation group/of/status                           | `SERVER_DERIVED`                                | Copied/linked by translation workflow, never patch trust |
| `seoTitle`, `metaDescription`                                   | `ADMIN_CONTROLLED` or `COPY_FROM_APPROVED_BASE` | Not in employer patch                                    |
| `source`, scrape/source fields, `externalId`                    | `FORBIDDEN` plus `LEGACY_ONLY`                  | No employer major-edit authority                         |

## 9. Active-major-edit canonical CAS

### Predicate

The exact active-major-edit submit predicate must include:

```text
_id = Job ID
employerId = authenticated Employer
publicationMigrationStatus in [canonical_native, legacy_backfilled]
publicationState = active
publicationVersion = expectedPublicationVersion
currentSubmissionId = baseApprovedSubmissionId
lastApprovedSubmissionId = baseApprovedSubmissionId
visibleUntil > acceptedAt
```

It must also prove that the base submission is approved, belongs to the same
Job/employer, contains the expected candidate schema/hash, and is attributed to
the accepted policy/plan. Those cross-record reads use the transaction session.

### Update

```text
$set:
  publicationState = pending_review
  currentSubmissionId = newSubmissionId
  policyVersion = free-beta-2026-01
  publicationUpdatedAt = acceptedAt
$inc:
  publicationVersion = 1
```

Rules:

- `lastApprovedSubmissionId` remains unchanged.
- `publishedAt`, `visibleUntil`, `applicationsCloseAt`, `slugFrozenAt`, and
  other approved visibility evidence remain stored for audit/recovery.
- Approved Job content remains physically unchanged during submission.
- The candidate is stored only in the immutable pending submission.
- The candidate does not overwrite Job content before approval.
- The public canonical gate treats pending as hidden.

Success returns the new pending state/version/current link. Conflicts return
only safe missing, ownership, version, state, base-link, or pending-submission
codes. CAS failure aborts submission, event, acknowledgement, guard, and outbox
writes.

## 10. Public visibility consequence

Current public Job consumers use legacy `status`, sometimes combined with
legacy approval, and do not consistently enforce canonical state or term dates.
Affected areas include:

- public Job list/detail/related queries;
- dynamic content blocks;
- dashboards, trending, recommendations, and resume matching;
- SEO sitemap and Job landing queries;
- employer/company public profiles;
- saved/recent/cover-letter access;
- newsletters and generated content;
- featured/sponsored queries;
- search indexing and career dashboard composition;
- internal application acceptance.

Therefore setting only `publicationState:pending_review` does not hide a
legacy-active Job.

Required future classification:
**PUBLIC_QUERY_CANONICAL_GATE**.

Smallest safe gate for canonical-native/backfilled Jobs:

```text
publicationState = active
lastApprovedSubmissionId exists
publishedAt <= now
visibleUntil > now
policy/approved-submission evidence is valid
```

The approved content rendered must be the materialized result of the
last-approved immutable candidate. Legacy compatible rows require an explicit
separate migration branch; missing canonical state must never be broadly
treated as public.

Safety:

- Successful major-edit submit becomes pending and hidden.
- Failed transaction leaves active state/content/link and remains visible.
- No legacy field needs to be destructively overwritten at submit time.
- Rollback can disable canonical writes and use a verified legacy branch during
  a controlled cutover.

Timing:

- Before pure dormant blocker foundation: not required.
- Before dormant adapter file implementation: not required if the adapter is
  unreachable.
- Before major-edit runtime wiring: required.
- Before public route activation for canonical Jobs: required.

This audit does not authorize that query change.

## 11. Major-edit correction semantics

For a reviewer-requested correction of a rejected major-edit candidate:

- Authoritative prior candidate: immutable
  `correctionOfSubmissionId`, not current Job content.
- Original base: same `baseApprovedSubmissionId`.
- Source concurrency: current rejected Job publication version.
- Candidate revision: prior revision plus one.
- Moderation cycle: same valid cycle only for an eligible exempt correction;
  missing/mismatch becomes a new charged correction under current service
  behavior.
- Allowed fields: exact staff-requested candidate field paths.
- Company/employer/base identity: immutable and forbidden.
- Candidate construction: apply requested patch to the complete prior candidate
  and persist a new complete candidate/hash.
- Destination: any mode/target/digest change requires fresh destination
  validation and staff review. It is a core-vacancy change and therefore
  charged, not quota-exempt.
- Same-vacancy checks: Job, employer, base-approved submission, and core
  vacancy identity must remain consistent.
- History: prior submission/event/evidence never mutate.
- Current link: successful correction CAS sets Job current submission to the
  new pending submission.
- Replay: same owner/key/fingerprint returns that exact candidate revision with
  no new writes.

An employer cannot use correction to replace the vacancy, transfer ownership,
change company identity, or redirect applicants under an old trust decision.

## 12. Destination-field inventory

| Field/consumer                | Current type/source                    | Current validation/normalization                                                              | Current use and risk                                                                                   |
| ----------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Job.applyType`               | Enum `internal`/`external`; mutable    | Employer route derives from link/email; schema default is external                            | Controls public/internal flow but is not ownership evidence                                            |
| `Job.applicationLink`         | Mutable string                         | Client checks HTTP(S); employer server update can assign raw value; admin sanitizes text only | Public client opens it; no server ownership proof                                                      |
| `Job.applyEmail`              | Mutable string                         | Client syntax check; employer server update can assign raw value                              | Public client builds mail action; no mailbox proof                                                     |
| `Job.applicationInstructions` | Mutable string                         | Admin text sanitizer; not in employer form                                                    | Not immutable submission evidence; could convey unreviewed routing text                                |
| `Job.sourceUrl`               | Mutable/source string                  | Import/scraper provenance paths                                                               | Public client currently uses it as destination fallback; prohibited for canonical employer publication |
| `Job.sourceWebsite`           | Source string                          | No destination trust role                                                                     | Provenance/indexing only                                                                               |
| `Employer.website`            | Mutable string                         | HTTP(S) syntax only                                                                           | Domain can be parsed but ownership is not verified                                                     |
| `Employer.email`              | Required account string                | Syntax/schema normalization; explicit email verification capability is absent                 | Domain/address is not destination ownership proof                                                      |
| Internal apply API            | Server route keyed by Job ID           | User authentication plus legacy active/vacancy checks                                         | Server-derived route; strongest current ownership                                                      |
| Public Job detail             | Client reads Job fields directly       | Browser navigation only                                                                       | Can expose mutable/unapproved target and `sourceUrl` fallback                                          |
| Translation projection        | Copies destination values from source  | Positive allowlist protects canonical fields                                                  | Copying is not ownership validation                                                                    |
| Duplicate projection          | Copies destination values              | Positive allowlist                                                                            | New Job ID but copied external target; trust must be revalidated                                       |
| Submission snapshot           | `applicationMode`, `applicationDomain` | Strict enum/domain syntax                                                                     | Omits exact target/digest/trust/actor/policy evidence                                                  |

No `applicationUrl`, `applicationURL`, `applyUrl`, `applyURL`, or
`applicationEmail` Job path is authoritative in the current schema. Aliases in
request bodies must map into the canonical contract before validation and must
not persist as additional fields.

## 13. Destination-mode contract

The pure canonical modes are:

```text
internal_platform
external_url
external_email
```

`manual_instructions` is not an approved destination mode. Instructions may be
bounded reviewed content, but cannot replace the primary destination or carry
an unvalidated URL/email fallback.

### `internal_platform`

- Required: current owned Job identity.
- Forbidden: external URL, external email, `sourceUrl`, client route, ownership
  claims.
- Route identity: server-derived from Job ID.
- Evidence: `INTERNAL_PLATFORM`, system classified.
- Public rendering: server/client internal application action only.
- Change: switching to/from external is a major scope change.

### `external_url`

- Required: exactly one normalized external URL.
- Forbidden: email, internal route override, manual fallback, `sourceUrl`.
- Scheme: HTTPS only for the canonical beta contract.
- Reject: credentials, fragments, non-default ports, IP literals,
  localhost/local/private/reserved/single-label hosts, malformed hosts, and
  opaque/shortened destinations.
- Query: fail closed in the first contract; query-bearing destinations require
  a later explicit policy because tokens/redirect parameters cannot be safely
  inferred.
- Path: normalized and retained because it identifies the application target.
- Bounds: normalized target at most 2,048 characters; host at most 253.
- Evidence at submission: `ADMIN_REVIEW_REQUIRED`.
- Public rendering: only after an exact-digest staff approval event.
- Redirects: no ownership claim and no network-following behavior in the pure
  contract.

### `external_email`

- Required: exactly one normalized email target.
- Forbidden: URL, internal route override, manual fallback.
- Normalize: Unicode NFC, trim, preserve local-part semantics, lowercase the
  domain, maximum 254 characters.
- Reject malformed/control-character values.
- Evidence at submission: `ADMIN_REVIEW_REQUIRED`.
- Public rendering: only after exact-digest staff approval.
- No account/corporate-domain ownership is inferred.

Supplying both URL and email is ambiguous and fails closed. Current drafts may
retain legacy data, but canonical submission requires exactly one mode.

## 14. Internal destination ownership

Ownership confidence: **PROVEN** for route derivation and Job/employer
association, subject to future canonical visibility/application gating.

- The authoritative API route uses the Job ID.
- The route is server-defined; a client cannot choose another routing template.
- The employer cannot override its target identity.
- Submission already stores Job ID, so the candidate evidence stores mode and
  a digest derived from the internal mode plus that server-owned identity, not
  a raw route.
- Slug is public-detail presentation, not application authority.
- Translation retains the same canonical owned Job relationship and cannot
  create a cross-employer route.
- Duplication creates a new Job identity and therefore a new internal
  destination; it must not reuse the source Job target digest.
- Applicant authentication is required by the current internal apply route.
- Future runtime must replace the legacy active check with the canonical
  publication/application gate.

## 15. External URL ownership

Current repository support:

| Evidence option                             | Support                                                    | Trust conclusion                                                      |
| ------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Employer website host                       | Syntax and mutable profile value only                      | Not verified ownership                                                |
| Subdomain of Employer website               | Parsable relationship only                                 | Not verified                                                          |
| Corporate email domain                      | Account email exists; email verification capability absent | Not verified                                                          |
| Admin-reviewed exact destination            | No current structured destination decision                 | Representable in future append-only event                             |
| Per-destination challenge                   | No model/service                                           | Unsupported                                                           |
| Recruitment-provider allowlist/tenant proof | No registry/model                                          | Unsupported                                                           |
| Manual moderation                           | General moderation required by policy                      | Safe only as explicit exact-digest authorization, not ownership proof |

Safest current classifications:

```text
INTERNAL_PLATFORM
ADMIN_REVIEW_REQUIRED
ADMIN_APPROVED_FOR_PUBLICATION
UNVERIFIED_REJECTED
```

`ADMIN_APPROVED_FOR_PUBLICATION` means an authorized reviewer approved the
exact normalized target/digest for this submission. It does not claim that
Strideto cryptographically proved domain ownership.

`VERIFIED_EMPLOYER_DOMAIN` and `APPROVED_RECRUITMENT_PROVIDER` must not exist
until separate durable evidence/registry contracts are implemented.

Security rules:

- Consumer mailbox domains, matching strings, or Employer verification level
  do not prove host control.
- Shorteners/opaque redirects fail closed.
- Internationalized hosts normalize through the platform URL parser to ASCII
  form and remain staff-review-required due to homograph risk.
- HTTP, credentials, arbitrary ports, local/private/reserved hosts, fragments,
  and first-contract queries fail closed.
- No DNS/HTTP fetch, redirect follow, or external verification occurs in the
  pure contract.
- Suspended/ineligible employers cannot submit. Future suspension of an active
  destination requires a separate canonical hide/revocation transition.

## 16. External email ownership

Current evidence does not prove control of any application mailbox:

- Matching the Employer account email is not enough because explicit email
  verification is unsupported.
- Matching a corporate domain is not mailbox proof.
- Role inboxes, consumer mailboxes, and different-domain addresses are
  declarations only.

Contract:

- Normalize and validate the exact address without logging or returning it in
  safe errors.
- Submission classification is `ADMIN_REVIEW_REQUIRED`.
- Authorized staff can approve the exact digest for publication; this is an
  authorization decision, not mailbox ownership proof.
- Free-consumer, different-domain, or suspicious addresses can be rejected by
  staff without revealing private evidence.
- Full normalized address is required in restricted immutable candidate
  evidence because approval and public rendering must reconstruct the exact
  destination. A domain/hash alone is insufficient.
- Also store a SHA-256 target digest and normalized domain for comparison.
- Repository projections must exclude the full value from general employer,
  list, metrics, event, and logging paths.
- A future verified-domain/mailbox system can add a new evidence policy version
  without reinterpreting old evidence.

## 17. Immutable destination evidence

Recommended strict subdocument:

```text
schemaVersion
mode
normalizedTarget
targetDigest
normalizedDomain
trustClassification
evidenceSource
evaluatedAt
validationPolicyVersion
classifiedByActorType
classifiedByActorId
```

Rules:

- `normalizedTarget` is null for internal mode, otherwise the exact bounded
  normalized URL or email.
- `targetDigest` is lowercase SHA-256 over a domain-separated canonical mode
  and target identity.
- `normalizedDomain` is null for internal mode and exact normalized host/domain
  for external mode.
- At submission, classification is system-derived `INTERNAL_PLATFORM` or
  `ADMIN_REVIEW_REQUIRED`.
- Employer declaration is an evidence source, never a trust classification.
- `classifiedByActorType` is `system` at submission; a later append-only
  decision uses authorized `staff`.
- Actor ID is absent for system and required for staff; employer identity
  remains the parent submission owner and is not duplicated as a trust actor.
- `evaluatedAt` comes from the server clock.
- `validationPolicyVersion` is a centralized constant, not client input.

External approval is a separate strict append-only moderation-event
subdocument:

```text
targetDigest
decision
validationPolicyVersion
decidedAt
actorType = staff
actorId
safeReasonCode
```

`decision` is `ADMIN_APPROVED_FOR_PUBLICATION` or `UNVERIFIED_REJECTED`.
Approval is valid only when the event digest exactly matches the candidate.
The immutable submission declaration/evidence never mutates.

Why full value plus digest:

- Full value is necessary for deterministic review, approval reconstruction,
  and public rendering.
- Digest enables bounded comparison and event linking without repeating the
  value in events/logs.
- Host/domain alone cannot reconstruct the route.
- Hash alone cannot render it.
- Encryption is not currently available as an accepted repository facility;
  inventing it or a new dependency is out of scope.
- A dedicated model adds unnecessary lifecycle and orphan risk; the immutable
  submission is the appropriate aggregate.

Prohibited evidence fields:

```text
raw request/body
headers/cookies/authorization
tokens/secrets
verification documents
arbitrary notes
applicant data
unrestricted metadata
raw DNS/HTTP responses
staff-internal free text
redirect response bodies
```

## 18. Destination actor and trust model

| Actor                     | May provide                                                                            | May establish                                                  |
| ------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Employer                  | Raw destination declaration in strict candidate patch                                  | No trust/ownership classification                              |
| System                    | Normalize, validate, hash, derive internal route, classify external as review-required | `INTERNAL_PLATFORM`, `ADMIN_REVIEW_REQUIRED`, invalid/rejected |
| Authorized staff reviewer | Exact-digest moderation decision                                                       | `ADMIN_APPROVED_FOR_PUBLICATION` or rejection                  |
| Security operator         | Future authorized staff/system revocation event                                        | Hide/suspend through canonical transition; no history mutation |

Clients cannot set or override:

```text
ownershipVerified
verifiedDomain
approvedDestination
evidenceType
trustClassification
evidenceSource
validationPolicyVersion
classifiedByActor
targetDigest
```

Revocation, employer suspension, or evidence loss appends a new event and
transitions/hides the canonical Job. It does not rewrite historical evidence.
Destination changes require new validation and staff decision. Translation
cannot change the destination. Duplication creates a new destination evidence
record/digest and cannot inherit staff approval automatically.

## 19. Destination quota and scope semantics

| Change                                  | Classification                                                                         | Quota/correction behavior                      |
| --------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Internal to external                    | `MAJOR_SCOPE_CHANGE`                                                                   | Charged; new cycle; fresh review               |
| External to internal                    | `MAJOR_SCOPE_CHANGE`                                                                   | Charged; new cycle                             |
| External URL host change                | `MAJOR_SCOPE_CHANGE`                                                                   | Charged; fresh validation/staff decision       |
| External URL path-only change           | `MAJOR_SCOPE_CHANGE`                                                                   | Charged; path may identify a different vacancy |
| Email address change within same domain | `MAJOR_SCOPE_CHANGE`                                                                   | Charged; mailbox control differs               |
| Email domain change                     | `MAJOR_SCOPE_CHANGE`                                                                   | Charged; fresh review                          |
| Instructions-only wording change        | `REVIEWER_CORRECTION` only when explicitly requested and no target/mode/digest changes | Otherwise charged                              |
| Redirect/provider change                | `MAJOR_SCOPE_CHANGE`                                                                   | Charged; opaque providers can be rejected      |
| Employer/company identity change        | `NEW_VACANCY` or `FORBIDDEN`                                                           | Never exempt                                   |

Every target/mode/digest change updates the candidate hash and request
fingerprint. No destination change can use the same prior approval evidence.
The correction evaluator must treat destination digest/mode as core vacancy
identity.

## 20. Destination snapshot and projection

| Stage                                 | Authority                                                                |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Draft Job                             | Mutable unapproved working content; never ownership truth                |
| Pending immutable submission          | Complete candidate plus strict destination declaration/evidence          |
| Moderation event                      | Exact-digest staff decision, no repeated full target                     |
| Approved submission                   | Immutable approved candidate/evidence and linked decision                |
| Canonical Job materialized projection | Exact approved candidate fields copied atomically on approval            |
| Public application renderer           | Canonically active approved Job projection only; no `sourceUrl` fallback |

Failed transactions preserve the prior approved Job destination and
last-approved submission. Pending/rejected candidates do not alter the public
projection.

Unsafe destination revocation must append a decision/security event and
canonically hide or close the Job before public rendering/application continues.

Required resolution types:

```text
NEW PURE CONTRACT
NEW IMMUTABLE SUBDOCUMENT
EXISTING MODEL ADDITION
RUNTIME QUERY CHANGE
PRODUCT/POLICY APPROVAL BEFORE RUNTIME
```

A new dedicated destination model is not required for the first beta contract.

## 21. Current unknown-commit boundary

Current behavior:

- Command and idempotency key validation occur inside the transaction callback.
- Content hash and request fingerprint are built inside the callback.
- Moderation-cycle, acknowledgement, submission, and moderation-event IDs are
  generated inside the callback.
- The two outbox keys are derived after submission ID generation.
- The callback returns a public-safe stable result containing selected
  submission fields and quota usage.
- It does not return owner/key, fingerprint, acknowledgement/event identities,
  expected Job commit evidence, candidate hash, or outbox keys.
- `transactionRunner.run` receives only the callback.
- Unknown dependency/runner errors are mapped to safe `TRANSACTION_FAILED`.
- No runner/repository can inspect all expected committed records through a
  supplied context.
- The service cannot distinguish committed from aborted after a terminal
  unknown commit result.

Current reconciliation context classification: **MISSING**.

## 22. Stable operation context

The minimum safe design has two immutable layers.

### Pre-transaction operation seed

Created once after pure command validation and before starting the retryable
transaction callback:

| Field                        | Source/time                                    | Stability/storage/privacy                                                             |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `operationId`                | Server random UUID before transaction          | Stable across retries; memory/structured safe correlation only; not client controlled |
| `ownerType`                  | Central Free Beta constant                     | Stable; `employer`; normal replay/reconciliation                                      |
| `ownerId` / `employerId`     | Authenticated Employer ID                      | Stable; sensitive identifier; never safe-message output                               |
| `jobId`                      | Validated command                              | Stable; ownership rechecked                                                           |
| `idempotencyKey`             | Validated command                              | Stable; secret-like operational value; never logged                                   |
| `submissionId`               | Server ObjectId before transaction             | Stable; stored in submission; reconciliation                                          |
| `acknowledgementId`          | Server ObjectId before transaction             | Stable; stored/linked; reconciliation                                                 |
| `moderationEventId`          | Server ObjectId before transaction             | Stable; stored; reconciliation                                                        |
| `newModerationCycleId`       | Server ObjectId before transaction             | Stable fallback/new cycle; exempt correction may use persisted predecessor cycle      |
| `expectedPublicationVersion` | Validated command                              | Stable CAS/reconciliation                                                             |
| `expectedPublicationState`   | Derived from submission kind                   | Stable and server controlled                                                          |
| `submissionKind`             | Validated enum                                 | Stable                                                                                |
| `correctionOfSubmissionId`   | Validated command/null                         | Stable; server evidence rechecked                                                     |
| `policyVersion`              | Server constant                                | Stable                                                                                |
| `rulesVersion`               | Validated requested version                    | Stable; current registry rechecked                                                    |
| `outboxDeduplicationKeys`    | Derived from submission ID and exact two types | Stable; maximum already bounded by outbox contract                                    |

`operationId` need not be persisted to every model. Owner/key plus stable record
IDs are the durable identity. It may be logged only under a bounded
correlation-ID policy.

### Callback-produced commit context

The transaction callback must produce this immutable context before it returns
and before commit is attempted:

```text
operation seed
requestFingerprint
candidateHash
baseApprovedSubmissionId
actualModerationCycleId
expectedCommittedPublicationVersion
expectedCommittedPublicationState
expectedCurrentSubmissionId
rulesDigest
acknowledgementId
moderationEventId
outboxDeduplicationKeys
```

Why two layers:

- Candidate hash, actual correction cycle, current rules digest, and resolved
  base are server-owned transaction reads/results.
- Pretending they exist before those reads would trust client data.
- Unknown commit can occur only after a successful callback return, so the
  runner can retain the callback-produced context before commit.
- If a transient error reruns the callback, the produced context must
  deep-equal the first successful context. Any difference aborts with
  `OPERATION_CONTEXT_CONFLICT`.

No context contains raw request data, destination output in logs, credentials,
or private verification evidence.

## 23. Stable ID generation

Generate once before `withTransaction` callback execution:

```text
submission ObjectId
acknowledgement ObjectId
moderation-event ObjectId
new/fallback moderation-cycle ObjectId
operation UUID
```

Rules:

- IDs remain stable across a driver callback retry.
- The actual moderation cycle can be the validated predecessor cycle for an
  exempt correction; otherwise use the stable new/fallback ID.
- Outbox intent ObjectIds need not be pre-generated. The unique deterministic
  deduplication keys and submission linkage are sufficient reconciliation
  identities. Pre-generating them would require an unnecessary accepted outbox
  interface change.
- Repository-generated timestamps are not commit identities; server accepted
  time and evidence time are supplied consistently.
- Duplicate stable IDs abort and reconcile; they never trigger silent
  regeneration inside the same logical operation.
- IDs are never accepted from ordinary client input.
- The idempotency key remains the client-held replay handle, while all durable
  record IDs are server-owned.

The current service generates four IDs inside the callback and therefore
requires a dormant service-interface correction before using this contract.

## 24. Transaction-runner interface

The smallest safe interface is publishing-specific:

```text
runPublishingTransaction({
  operationSeed,
  execute,
  reconcileUnknownCommit
})
```

Contract:

- `operationSeed` is strict, immutable, validated before session creation.
- `execute({session,operationSeed})` performs all accepted reads/writes using
  one active session and returns:

```text
{
  value,
  commitContext
}
```

- The runner captures and validates `commitContext` before attempting commit.
- A callback retry receives the same seed and must produce the same commit
  context.
- Transient transaction labels remain attached and are handled by bounded
  Mongoose/driver retry policy.
- Unknown commit labels are not mapped/destroyed until reconciliation.
- `reconcileUnknownCommit({commitContext,cause})` performs no writes and uses a
  fresh read context, not the uncertain transaction session.
- Explicit transaction options require primary reads, snapshot transaction
  semantics, and majority durability, subject to replica-set proof.
- Reconciliation reads require primary/majority authoritative behavior under a
  separately proved topology.
- Nested transaction/session input is rejected.
- Session cleanup runs exactly once.
- Known domain errors preserve their stable safe contract.
- Unexpected errors become existing safe transaction failure.
- No email, queue delivery, webhook, payment, or other external effect executes
  in the callback or runner.

A fully generic runner is insufficient because only publishing composition
knows the owner/idempotency/candidate/Job/event/acknowledgement/outbox evidence.
The low-level session/retry mechanics may be generic, but the reconciliation
callback is publishing-specific.

## 25. Unknown-commit reconciliation algorithm

1. Detect `UnknownTransactionCommitResult` through the original
   `hasErrorLabel`/label set.
2. Preserve the original error internally and stop any new logical write.
3. Require a complete immutable commit context.
4. End/abandon the uncertain transaction session according to driver contract.
5. Perform at most three reconciliation read rounds with a bounded schedule
   such as immediate, approximately 100 ms, and approximately 300 ms, capped by
   a short total deadline.
6. Each round uses primary/majority authoritative reads through the same
   production connection but no transaction write/session reuse.
7. Resolve submission by owner type, owner ID, and idempotency key.
8. Verify request fingerprint and exact expected submission ID.
9. Verify Job owner, pending state, expected incremented version, current
   submission link, and preserved base last-approved link.
10. Verify exact moderation-event ID, submission/Job relation, action, cycle,
    and candidate hash.
11. Verify exact acknowledgement ID, submission/Job/employer relation, accepted
    state, rules version/digest, and policy version.
12. Verify both exact outbox deduplication keys, submission/Job relationship,
    and intent types.
13. Verify no conflicting/duplicate logical record.
14. Classify `COMMITTED`, `NOT_COMMITTED`, `INDETERMINATE`, `CORRUPT`, or
    `SECURITY_CONFLICT`.
15. On `COMMITTED`, return the same stable submission result with
    `idempotentReplay:true`/reconciled internal metadata not exposed publicly.
16. On a proved `NOT_COMMITTED`, return a safe retryable failure; a later client
    attempt must use the same idempotency key.
17. On other outcomes, perform no write and return a safe indeterminate or
    operator-escalation failure.

Absence from one immediate read never proves abortion. `NOT_COMMITTED` is
allowed only after the topology/driver contract proves authoritative visibility
and all records are absent while the Job remains at the exact pre-operation
state. Until replica-set proof establishes that condition, all-record absence
is `INDETERMINATE`.

## 26. Reconciliation truth table

| Evidence                                                          | Classification                                    | Safe code/action                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| Submission and every linked Job/event/ack/outbox fact match       | `COMMITTED`                                       | Return stable result; no write                                         |
| Submission matches but fingerprint differs                        | `SECURITY_CONFLICT`                               | `UNKNOWN_COMMIT_SECURITY_CONFLICT`; no write; security/operator review |
| Submission ID differs for same owner/key                          | `SECURITY_CONFLICT`                               | Same; no write                                                         |
| Submission matches; Job link/state/version missing                | `CORRUPT`                                         | `UNKNOWN_COMMIT_EVIDENCE_CORRUPT`; no retry/write                      |
| Submission matches; one outbox intent missing                     | `CORRUPT`                                         | Same; transaction atomicity invariant violated                         |
| Submission matches; event missing or wrong cycle/hash             | `CORRUPT` or `SECURITY_CONFLICT` when conflicting | No write; operator review                                              |
| Submission matches; acknowledgement absent                        | `CORRUPT`                                         | Current service always creates one; no reuse exception                 |
| Job updated but submission absent                                 | `CORRUPT`                                         | No write                                                               |
| Related records exist without submission                          | `CORRUPT`                                         | No write                                                               |
| All records absent; authoritative rounds prove base Job unchanged | `NOT_COMMITTED` only after topology proof         | Safe retry with same key                                               |
| All records absent but proof is unavailable                       | `INDETERMINATE`                                   | No new logical write                                                   |
| Connection/selection unavailable                                  | `INDETERMINATE`                                   | Bounded read retry, then operator-safe failure                         |
| Duplicate logical records                                         | `CORRUPT` or `SECURITY_CONFLICT`                  | No write; verify unique indexes/operator review                        |
| Conflicting moderation cycle                                      | `SECURITY_CONFLICT`                               | No write                                                               |

No outcome exposes raw records, IDs, destination values, idempotency keys, or
driver errors to the public caller.

## 27. Reconciliation repository interfaces

All methods are read-only and use fresh authoritative read options, not the
uncertain transaction session.

### `findSubmissionReplayEvidence`

Input:

```text
ownerType
ownerId
idempotencyKey
expectedSubmissionId
expectedFingerprint
```

Output:

```text
MISSING
MATCH
FINGERPRINT_CONFLICT
SUBMISSION_ID_CONFLICT
CORRUPT
```

Projection: IDs/links, fingerprint, state, kind, plan/policy, accepted time,
candidate/base/cycle hashes, acknowledgement link, and safe response quota
snapshot. Unique owner/key index supports it.

### `readCanonicalJobCommitEvidence`

Input: owned Job identity and expected base/committed versions/links.

Output: missing, base unchanged, exact committed pending state, conflict, or
corrupt. Projection is ownership plus canonical state/version/current and
last-approved links/policy/update time. Unique Job `_id` supports it.

### `findModerationEventEvidence`

Input: expected event, submission, Job, cycle, and candidate hash.

Output: missing, exact match, conflict, or corrupt. Query by `_id`, with
relationship verification.

### `readAcknowledgementEvidence`

Input: expected acknowledgement, submission, employer, Job, policy, rules
version/digest.

Output: missing, exact accepted match, conflict, or corrupt. Query by `_id`;
unique submission index protects one-to-one relation.

### `findOutboxIntentEvidence`

Input: the two exact deduplication keys, expected submission, Job, intent types,
and expected employer presence/absence by audience.

Output: zero/one/two exact matches, conflict, duplicate, or corrupt. Unique
deduplication index and submission-history index support it.

Repository outputs are bounded discriminated evidence, never raw Mongoose
documents or private values. Missing is distinct from corrupt/conflict.

## 28. Replay, callback retry, and unknown commit

### Normal replay

- A new request uses owner plus idempotency key.
- The service rebuilds the deterministic candidate/fingerprint from the same
  intent.
- Same fingerprint returns the complete existing safe result before writes.
- Different fingerprint returns existing `IDEMPOTENCY_KEY_REUSED`.
- No acknowledgement, submission, Job CAS, event, quota charge, or outbox write
  repeats.

### Transaction callback retry

- The driver retries only an aborted/transient attempt.
- The same operation seed, stable IDs, candidate patch, and server policy are
  reused.
- The callback must reproduce the same commit context.
- Any drift becomes a base/version or operation-context conflict.
- Aborted writes do not count quota or reserve an idempotency row.

### Unknown commit

- The callback completed and the commit result is uncertain.
- No new logical transaction starts.
- The captured commit context drives bounded read-only reconciliation.
- `COMMITTED` returns the stored result.
- `NOT_COMMITTED`, when provable, permits only a later same-key retry.
- Incomplete/conflicting/unavailable evidence performs no write.

These distinctions prevent duplicate quota, submission, moderation event,
acknowledgement, and outbox effects.

## 29. Safe error mapping

No public route expansion is authorized. Codes below are internal/domain
contracts for later composition.

| Code                                          | Use and safe message                                      | Abort/retry/operator handling                             |
| --------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `MAJOR_EDIT_CANDIDATE_INVALID`                | Public-safe 422 candidate-invalid message                 | Abort; correct input                                      |
| `MAJOR_EDIT_BASE_CONFLICT`                    | Public-safe 409 Job-changed message                       | Abort; reload                                             |
| `DESTINATION_MODE_INVALID`                    | Public-safe 422 destination-invalid message               | Abort                                                     |
| `DESTINATION_OWNERSHIP_UNVERIFIED`            | Public-safe destination-needs-review/not-accepted message | Abort approval or remain pending                          |
| `DESTINATION_EVIDENCE_CONFLICT`               | Internal safe generic evidence-conflict message           | Abort; operator review                                    |
| `DESTINATION_CHANGED_BEYOND_CORRECTION_SCOPE` | Public-safe 409 correction-scope message                  | Abort exemption; charged/new submission as policy permits |
| `OPERATION_CONTEXT_INVALID`                   | Internal safe transaction-failed message                  | Abort; no blind retry                                     |
| `OPERATION_CONTEXT_CONFLICT`                  | Internal safe transaction-failed message                  | Abort callback retry; operator telemetry                  |
| `IDEMPOTENCY_KEY_REUSED`                      | Existing public 409 safe message                          | Abort                                                     |
| `UNKNOWN_COMMIT_COMMITTED`                    | Internal outcome, not public error                        | Return stable success                                     |
| `UNKNOWN_COMMIT_NOT_COMMITTED`                | Internal retryable outcome                                | Same-key retry only after proof                           |
| `UNKNOWN_COMMIT_INDETERMINATE`                | Public-safe unavailable/indeterminate message             | No write; operator/retry reconciliation                   |
| `UNKNOWN_COMMIT_EVIDENCE_CORRUPT`             | Internal safe integrity message                           | No write; urgent operator review                          |
| `UNKNOWN_COMMIT_SECURITY_CONFLICT`            | Internal safe security-conflict message                   | No write; security review                                 |

Logs may contain only bounded code, attempt/round number, operation correlation
ID, and error-label category. They must not contain raw Mongo errors, stack
traces in public output, connection details, record bodies, external targets,
email addresses, employer verification data, idempotency keys, tokens, or other
private evidence.

## 30. Required model and service impact

| Blocker                                     | Required impact                                        | Exact later files/areas                                                         |
| ------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Destination normalization/trust             | `NEW PURE MODULE`                                      | New destination contract module and tests                                       |
| Complete candidate                          | `NEW PURE MODULE`                                      | New publication-candidate contract module and tests                             |
| Candidate/base persistence                  | `NEW IMMUTABLE SUBDOCUMENT`, `EXISTING MODEL ADDITION` | `server/src/models/JobPublicationSubmission.js` and model tests                 |
| Destination declaration evidence            | `NEW IMMUTABLE SUBDOCUMENT`, `EXISTING MODEL ADDITION` | `JobPublicationSubmission.js`                                                   |
| Destination staff decision                  | `NEW SUBDOCUMENT`, `EXISTING MODEL ADDITION`           | `server/src/models/JobModerationEvent.js` and tests                             |
| Candidate/destination correction comparison | `EXISTING SERVICE MODIFICATION`                        | `ReviewerCorrectionEligibility.js` and tests                                    |
| Command/candidate input and stable IDs      | `EXISTING SERVICE MODIFICATION`                        | `TransactionalFreeBetaSubmissionService.js` and tests                           |
| Publishing operation context                | `NEW PURE MODULE`                                      | New operation-context contract and tests                                        |
| Unknown-commit reconciliation               | `NEW REPOSITORY`, new resolver/runner                  | New dormant publishing reconciliation/transaction modules and tests             |
| Job active submit CAS                       | `NEW REPOSITORY`                                       | Future Mongoose Job repository; no current Job schema addition required         |
| Approved Job projection                     | `RUNTIME COMPOSITION`                                  | Future approval service/repository                                              |
| Canonical public visibility                 | `PUBLIC QUERY MODIFICATION`                            | Future shared canonical Job visibility gate and consumers                       |
| Employer command construction               | `CONTROLLER MODIFICATION`                              | Future employer submit/edit route after dormant acceptance                      |
| External destination approval policy        | `PRODUCT/POLICY DECISION` before runtime               | Exact staff authorization, URL-query/redirect, retention, and revocation policy |

`JobPublicationSubmission` does not currently contain sufficient complete
candidate or destination evidence. `TransactionalFreeBetaSubmissionService`
must eventually accept a strict candidate patch/builder and the new
transaction-runner contract. Current Job canonical links are sufficient to
reference pending and last-approved submissions; no separate candidate model
or Job candidate-reference field is required.

A future approved-content integrity strategy must also prevent legacy writers
from mutating a canonically active Job outside approved candidate application.
That can be enforced through writer cutover and/or approved-candidate hash
verification; it is a runtime phase, not this pure foundation.

## 31. Sequencing

1. **B3-C1 — Dormant Application Destination Pure Contract Foundation**
   - Pure strict modes, normalization, hashing, evidence classification, change
     classifier, tests, and report.
   - No persistence or runtime import.
2. **B3-C2 — Dormant Complete Publication Candidate Pure Contract Foundation**
   - Applies strict patches to immutable approved candidates and produces
     complete normalized candidate/hash/base/revision evidence.
3. **B3-C3 — Dormant Publishing Operation Context and Reconciliation Pure
   Contracts**
   - Stable seed/commit-context validators, truth classifier, repository
     interfaces, and pure tests.
4. **B3-C4 — Additive Immutable Submission and Moderation Evidence Schema**
   - Add strict candidate/destination subdocuments and staff decision evidence;
     no adapter/runtime.
5. **B3-C5 — Dormant Transaction Service Boundary Correction**
   - Candidate builder input, stable pre-generated IDs, callback commit context,
     correction comparison, and focused service tests.
6. **B3-C6 — Combined Blocker Foundation Acceptance Audit**
   - Read-only acceptance of all three corrected blockers.
7. **B3-D — Mongoose Adapter Readiness Re-Audit**
   - Determine whether adapter implementation can finally proceed.
8. Later, separately authorized: dormant Mongoose adapter implementation,
   disposable replica-set proof, index rollout, native/legacy initialization,
   approval/moderation services, public-query/writer cutover, controller/route
   activation, and outbox delivery.

All implementation phases before the adapter remain dormant and
database-free except the separately authorized schema declarations. No live
index or production data operation belongs in them.

## 32. Exact next-phase allowlist

Next phase:
**B3-C1 — Dormant Application Destination Pure Contract Foundation**.

### CREATE

```text
server/src/services/publishing/contracts/ApplicationDestinationContract.js
server/src/__tests__/applicationDestinationContract.test.js
docs/FREE_BETA_APPLICATION_DESTINATION_CONTRACT_FOUNDATION_REPORT.md
```

### MODIFY

```text
None.
```

### INSPECT_ONLY

```text
server/src/config/freeBetaPublishingPolicy.js
server/src/models/Employer.js
server/src/models/Job.js
server/src/models/JobPublicationSubmission.js
server/src/models/JobModerationEvent.js
server/src/services/publishing/EmployerSubmissionEligibility.js
server/src/services/publishing/ReviewerCorrectionEligibility.js
server/src/services/publishing/TransactionalFreeBetaSubmissionService.js
server/src/services/jobWriteBoundary.js
server/src/controllers/employerController.js
server/src/controllers/admin/adminJobsController.js
server/src/controllers/applicationsController.js
server/src/services/career/JobVacancyService.js
client/src/pages/Employer/employerPostJobValidation.js
client/src/pages/Jobs/JobDetail.jsx
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
server/src/services/payment*
server/src/services/jobQueueService.js
server/src/services/publishing/TransactionalFreeBetaSubmissionService.js
server/src/services/publishing/outbox/**
client/**
package.json
server/package.json
server/package-lock.json
render.yaml
.env*
docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md
```

The overlap between `INSPECT_ONLY` and `FORBIDDEN` is intentional: existing
models/controllers/client/service files may be read for contract compatibility
but may not be modified.

No adapter, repository, database, model, or runtime composition file is
authorized in B3-C1.

## 33. Test strategy

### Major edit

- strict patch/candidate plain-object validation;
- exact editable and forbidden fields;
- immutable approved base identity/version;
- complete deterministic normalization;
- arrays/null/dates/enums/work-mode behavior;
- patch isolation from source objects/prototypes/getters;
- candidate and request fingerprints;
- replay stability;
- correction candidate revision/base preservation;
- core/major-scope classification;
- failed transaction leaves approved Job/candidate unchanged;
- approval reconstructs complete Job content from candidate;
- submission never activates/publicizes.

### Destination

- exact three modes and rejection of manual/ambiguous mode;
- internal Job identity and server route derivation;
- URL HTTPS normalization and bounds;
- rejection of credentials, ports, fragments, queries, local/private/reserved
  hosts, IP literals, shorteners, malformed/opaque values;
- internationalized-host normalization and review-required status;
- email normalization/bounds without displaying test values in failure output;
- exact trust classification and actor restrictions;
- target digest determinism/domain separation;
- immutable evidence strictness;
- all destination change classifications;
- no `sourceUrl` fallback;
- no client-controlled trust/evidence fields;
- translation cannot change destination;
- duplication produces a new internal digest and revalidates external targets;
- errors/log representations exclude full targets and private evidence.

### Unknown commit

- operation seed strictness and immutability;
- stable IDs across callback retries;
- stable callback commit context;
- same/different fingerprint replay;
- all-complete committed evidence;
- missing/incomplete/corrupt/security-conflicting evidence;
- authoritative no-record versus unavailable/indeterminate reads;
- label preservation;
- bounded reconciliation rounds/deadline;
- no duplicate quota/submission/event/ack/outbox effects;
- safe domain errors and log fields.

## 34. Replica-set proof requirements

The following cannot be proved by pure fakes and require a separately
authorized disposable transaction-capable replica set:

- real callback retry after a transient transaction failure;
- induced/controlled uncertain commit behavior;
- primary/majority read-after-commit visibility;
- proof conditions for `NOT_COMMITTED`;
- concurrent same-owner/idempotency requests;
- unique-index conflicts;
- Job CAS races;
- quota-guard/write contention;
- atomic rollback across Job, guard, submission, acknowledgement, event, and
  two outbox records.

No replica set or database was started or contacted during this audit.

## 35. Readiness matrix

| Gate                                      | Decision                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Major-edit candidate contract             | `READY_FOR_PURE_FOUNDATION`                                              |
| Application-destination contract          | `READY_FOR_PURE_FOUNDATION`                                              |
| Unknown-commit context contract           | `READY_FOR_PURE_FOUNDATION` after stable candidate/destination contracts |
| Dormant blocker-foundation implementation | `READY`, beginning only with B3-C1                                       |
| Mongoose adapter implementation           | `NOT_READY`                                                              |
| Disposable replica-set proof              | `NOT_READY`                                                              |
| Runtime wiring                            | `NOT_READY`                                                              |
| Public route activation                   | `NOT_READY`                                                              |

## 36. Remaining runtime blockers

- Complete candidate/destination schema and accepted service corrections are
  not implemented.
- External destination policy has no staff-decision persistence or approved
  runtime workflow.
- Unknown-commit runner/resolver/repositories do not exist.
- Production transaction topology remains unproved.
- Live unique/index inventory and rollout remain unperformed.
- Existing Jobs are not canonically initialized/classified for submission.
- Legacy active-edit writers can mutate approved content in place.
- Canonical approval, active-capacity, rejection, expiry, and revocation
  services are absent.
- Public visibility/application/search consumers use legacy state.
- No controller or route constructs the strict candidate command.
- Outbox recipient/delivery worker behavior remains separately unapproved.

## 37. Preservation statement

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
- Replica-set testing started: No.
- Production acceptance report touched: No.

**STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED**
