# STRIDETO-SEC-1 / SEC-1A — Admin Job Duplication Regression Correction Report

## 0. SEC-1A acceptance addendum (read first)

This report was produced under STRIDETO-SEC-1 and then independently re-audited under
STRIDETO-SEC-1A, which required verifying every disputed field disposition against
executable code rather than inference, and specifically warned against classifying
`priority`/`urgent` as paid/promotion fields without proof. That re-audit found:

- **§2.3/§3.2 as originally written overreached for three fields.** `priority`,
  `urgent`, and `boostLevel` were grouped into the same "paid placement / promotion"
  justification as `isFeatured`/`isSponsored`/`paidUntil`/`planId`/`planType`/`expiresAt`.
  A repository-wide trace (see §11) found **zero writers and zero readers** for
  `priority` and `boostLevel` anywhere in the live codebase, and **exactly one writer
  and zero readers** for `urgent` (an admin edit-form checkbox with nothing downstream
  ever consuming it). None of the three has a proven payment, promotion, or moderation
  relationship. **This has been corrected** in `jobWriteBoundary.js`'s
  `JOB_DUPLICATE_RESET_FIELDS` doc comment and in §3.2/§9 below: the RESET disposition
  for these three fields is unchanged (it is still the safe, no-regression choice — it
  makes a duplicate identical to a freshly-created Job for these fields, exactly as
  before), but the stated reason is now "no proven live behavior to preserve or
  protect," not "prevents free promotion."
- **Every other RESET field's payment/moderation/scraper relationship is now backed by
  a concrete, cited live reader or writer** (§11), not the more general "future
  reconciliation logic" framing the original report used.
- **`employerId`/`postedBy` PRESERVE was flagged as a potential unresolved product
  decision by SEC-1A and is now conclusively resolved, not assumed**: the
  `POST /admin/jobs/:id/duplicate` route accepts no request body and the admin UI's
  "Duplicate" button calls it with no payload — there is no cross-employer
  target-owner mechanism anywhere in the code or UI. Same-employer, in-place
  duplication is the only behavior the system supports today (§11).
- **`deadline` PRESERVE was re-verified** against live filter/sort/trending/scoring
  consumers and confirmed correct — it is core editable template content (§11).
- **No field disposition changed as a result of SEC-1A.** No commercial or source
  field was newly restored. The correction is entirely to the _stated reasoning_ and
  to test coverage (§11, §12), consistent with the original finding: the defect was
  undocumented and accidentally-coupled field policy plus missing endpoint-level
  tests, not lost entitlements.
- **A real, mocked behavioral test of the exported `duplicate()` handler was added**
  (§12) — not source-string inspection — using the same-object monkey-patching
  technique (Job and AuditLog are process-wide Mongoose model singletons; patching
  their static/prototype methods from the test file is visible to the controller
  without modifying any file outside this correction's authorized set). No
  `mongoose.connect()` occurs anywhere in the test process.

## 1. Scope

Corrects the live admin job-duplication regression identified as finding **F1** in
`docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`, introduced by commit
`f460f1e` ("feat: add dormant canonical job publication schema and write boundaries").
No CAPTCHA, authentication, dependency, Redis, storage, SMTP, B3-E, adapter,
transaction, or other infrastructure work was touched. Only the two authorized
files were modified; two new files were created.

## 2. Reconstructing the authoritative behavior

### 2.1 Behavior immediately before `f460f1e` (baseline `4e48852`)

```js
delete source._id;
delete source.createdAt;
delete source.updatedAt;
source.title = `${source.title} (Copy)`;
source.status = 'draft';
source.approvalStatus = 'pending';
source.views = 0;
source.applicationsCount = 0;
delete source.slug;
const doc = new Job(source);
```

A **blacklist**: every field on the source document was copied except `_id`,
`createdAt`, `updatedAt`, and `slug`, with `title`/`status`/`approvalStatus`/`views`/
`applicationsCount` explicitly overridden. This behavior predates every field this
report discusses being scrutinized for duplication semantics at all — at that point
in the codebase's history nothing distinguished "content" from "paid placement" from
"scrape provenance" from "moderation evidence"; it was one undifferentiated document.

### 2.2 Behavior after `f460f1e` (the regression)

`buildJobDuplicateProjection(source)` switched to a **whitelist** of 34 fields
(`JOB_TRANSLATION_OVERRIDE_FIELDS` + `JOB_TRANSLATION_SOURCE_FIELDS`, reused
coincidentally from an unrelated feature — the job-translation write path). Fields
outside that whitelist were silently absent from every duplicate, with no error, no
audit trail entry, and no dedicated test of the `duplicate()` endpoint itself.

### 2.3 Why "restore the old behavior" is not the correct fix

The instruction for this correction explicitly warns against blindly copying every
field or assuming every paid or source-attribution field must be preserved. Simply
reverting to the pre-`f460f1e` blacklist would reintroduce problems the schema itself
did not have in 2.1 but does have today:

- **Paid placement / promotion** (`isFeatured`, `isSponsored`, `priority`, `urgent`,
  `boostLevel`, `paidUntil`, `planId`, `planType`, `expiresAt`) — an admin duplicate is
  a brand-new draft that has not been purchased, approved, or granted that placement.
  Blindly copying these would let an admin (or, if this code path is ever reused by a
  future employer-facing "duplicate my job" feature) mint a free copy of a paid or
  promoted listing. `paidUntil` in particular is set exclusively by
  `services/paymentService.js` after a real Stripe checkout and is read by
  `scheduler/reminderJobs.js` to send "your paid job is expiring" reminders keyed on
  `employerId` + `paidUntil` — copying it onto an unpaid duplicate would misfire that
  reminder for a job nobody paid for.
- **`externalId`** carries a `unique + sparse` index on `Job` (scraper dedup key,
  `server/src/models/Job.js:99`). Copying it onto a second document is not just a
  business-rule question, it is a correctness bug: the second `.save()` would throw
  `E11000 duplicate key error` the moment a scraped/imported job with an `externalId`
  is duplicated. This alone rules out "just restore everything the old code copied."
- **Scrape/import provenance** (`source`, `scrapedAt`, `sourceUrl`, `sourceWebsite`) —
  once an admin forks a record into a new editable draft, it is an admin-originated
  document, not a live tracked external record. Carrying the old values forward would
  misrepresent it to any future scraper-reconciliation or staleness-cleanup logic that
  keys off `source`/`scrapedAt`.
- **Translation linkage** (`locale`, `translationGroupId`, `translationOf`,
  `translationStatus`) — `translationGroupId` is auto-assigned from the new document's
  own `_id` on save (`ensureTranslationGroupHook`, `models/mixins/translationFields.js`).
  Copying the source's group id would incorrectly join the duplicate to the source's
  translation group, i.e. the CMS would treat it as a translated variant of the
  original rather than an independent new listing.
- **Canonical publication/moderation evidence** (the 14
  `CANONICAL_JOB_PUBLICATION_FIELDS`, plus `rejectionSummary`, `currentSubmissionId`,
  `lastApprovedSubmissionId`) — these are immutable identities and evidence tied to a
  specific submission/moderation lifecycle (`JobPublicationSubmission`,
  `JobModerationEvent`) that does not exist for a fresh admin-created duplicate.
  Duplicating a rejected job's `rejectionSummary` (which references a specific
  `JobModerationEvent._id` via `eventId`) onto an unrelated new document would reuse
  moderation evidence that was never actually decided about the new document.

None of this is a hypothetical "future feature" concern — `PublicationCandidateContract.js`
(part of the dormant Free Beta publishing foundation already in this branch) explicitly
lists `boostLevel` and `paidUntil` among the fields it treats as protected/tracked
state, corroborating that these are recognized elsewhere in the codebase as
sensitive, not incidental, fields.

### 2.4 What the correct contract turns out to be

After classifying every one of the 75 top-level `Job` schema fields (verified against
the live schema at runtime — see §4), the correct **PRESERVE** set is exactly the
content and ownership/attribution fields: everything a duplicate-as-template
operation is actually for. This happens to match the field set the current code
already computes (`JOB_TRANSLATION_OVERRIDE_FIELDS` ∪ `JOB_TRANSLATION_SOURCE_FIELDS`).
**The regression was never "the wrong fields are excluded."** The exclusions
themselves are, on independent reconstruction, largely the correct business and
technical decision. The actual defects were:

1. **No documentation or audit trail** — the exclusion was a side effect of an
   unrelated refactor (translation write-boundary hardening), never stated as a
   deliberate decision about duplication semantics, and F1 was reported as "silent"
   because there was no comment, constant name, or log entry explaining it.
2. **Accidental coupling** — `JOB_DUPLICATE_SOURCE_FIELDS` was _derived from_ the
   translation field lists rather than defined for its own purpose. A future change to
   translation semantics (e.g. adding a new overridable translation field) would have
   silently changed duplication behavior too, and vice versa — two unrelated
   operations sharing one array by coincidence.
3. **No integration-level test of the `duplicate()` endpoint** — the projection
   function itself was (and remains) extensively tested in
   `canonicalJobWriteBoundary.test.js`, but nothing exercised the controller's use of
   it end to end, and nothing enumerated the full field inventory to guarantee no
   schema field was left unclassified.
4. **No defense-in-depth guard** — nothing prevented a future maintainer from adding a
   dangerous field (e.g. `externalId`, or a canonical publication field) back into the
   preserve list without noticing the consequence.

This report's correction fixes all four, explicitly and with tests, without changing
the resulting set of fields a duplicate ends up with — because that set was already
correct, just undocumented, fragile, and unverified at the integration level.

## 3. Field contract

### 3.1 PRESERVE (34) — copied verbatim from the source

Content and ownership/attribution fields: `title`, `company`, `organization`,
`location`, `province`, `city`, `category`, `type`, `jobType`,
`educationRequirement`, `experience`, `applyType`, `applicationLink`, `description`,
`requirements`, `applicationInstructions`, `responsibilities`, `benefits`, `gender`,
`salaryRange`, `salaryCurrency`, `skillsRequired`, `applyEmail`, `deadline`,
`logoUrl`, `remote`, `hybrid`, `totalSeats`, `autoCloseWhenFilled`, `gallery`,
`seoTitle`, `metaDescription`, `postedBy`, `employerId`.

| Field                     | Previous | Current (pre-fix) | Corrected | Reason                                                               |
| ------------------------- | -------- | ----------------- | --------- | -------------------------------------------------------------------- |
| `postedBy`                | copied   | preserved         | preserved | Creator attribution; no security/business risk identified.           |
| `employerId`              | copied   | preserved         | preserved | Duplicate remains scoped to the same employer's dashboard/ownership. |
| all other PRESERVE fields | copied   | preserved         | preserved | Editable template content — exactly what "duplicate" is for.         |

### 3.2 RESET (22) — excluded from the projection; new document receives its schema default, or (for `status`/`approvalStatus`/`slug`) an explicit new value assigned by the controller

`views`, `applicationsCount`, `isFeatured`, `isSponsored`, `priority`, `urgent`,
`boostLevel`, `paidUntil`, `planId`, `planType`, `expiresAt`, `source`, `scrapedAt`,
`sourceUrl`, `sourceWebsite`, `locale`, `translationGroupId`, `translationOf`,
`translationStatus`, `status`, `approvalStatus`, `slug`.

| Field                                                                | Previous                  | Current (pre-fix)                      | Corrected                                                                                                                                | Security impact                                                                        | Business impact                                                                                   |
| -------------------------------------------------------------------- | ------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `views`, `applicationsCount`                                         | copied then zeroed        | excluded (= 0 default)                 | excluded (= 0 default)                                                                                                                   | None                                                                                   | Prevents fabricated engagement stats on a never-shown draft.                                      |
| `isFeatured`, `isSponsored`                                          | copied                    | excluded                               | excluded — **proven** payment/promotion relationship (§11)                                                                               | Prevents free duplication of promoted/curated placement                                | An admin must re-apply promotion deliberately.                                                    |
| `priority`, `urgent`, `boostLevel`                                   | copied                    | excluded                               | excluded — **corrected reason (SEC-1A)**: no proven writer/reader anywhere in the live codebase (§11), not a proven payment relationship | Neutral / not applicable — nothing live reads or writes these today                    | RESET is the no-regression default; revisit if a future feature gives these fields real behavior. |
| `paidUntil`, `planId`, `planType`, `expiresAt`                       | copied                    | excluded                               | excluded — **proven** payment relationship (§11)                                                                                         | Prevents a duplicate from appearing to carry a paid plan/entitlement it was never sold | Avoids incorrect "job expiring" reminders on an unpaid duplicate.                                 |
| `source`, `scrapedAt`, `sourceUrl`, `sourceWebsite`                  | copied                    | excluded                               | excluded — **proven** live readers (§11), not a hypothetical                                                                             | Prevents mislabeling an admin-authored draft as a live external record                 | Keeps the growth-dashboard scraper KPI and public SEO landing pages accurate.                     |
| `locale`, `translationGroupId`, `translationOf`, `translationStatus` | copied                    | excluded                               | excluded                                                                                                                                 | Prevents incorrect translation-group linkage                                           | Duplicate is a new standalone document, not a translation of the source.                          |
| `status`, `approvalStatus`, `slug`                                   | reset to fixed new values | excluded then recomputed by controller | excluded then recomputed by controller (unchanged)                                                                                       | Ensures every duplicate starts as an unpublished, unapproved draft with its own slug   | Matches existing moderation workflow expectations.                                                |

### 3.3 FORBID (19) — must never appear in the projection; enforced by an explicit runtime assertion in addition to allowlist omission

`_id`, `__v`, `createdAt`, `updatedAt`, `externalId`, and the 14
`CANONICAL_JOB_PUBLICATION_FIELDS` (`publicationState`, `publicationVersion`,
`currentSubmissionId`, `lastApprovedSubmissionId`, `publishedAt`, `visibleUntil`,
`applicationsCloseAt`, `closedAt`, `expiredAt`, `rejectionSummary`, `slugFrozenAt`,
`policyVersion`, `publicationUpdatedAt`, `publicationMigrationStatus`).

| Field                           | Previous                                                                                                    | Current (pre-fix) | Corrected                  | Reason                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`, `createdAt`, `updatedAt` | explicitly deleted                                                                                          | excluded          | excluded, now also guarded | New document identity; owned by Mongoose/the new document's own lifecycle.                                                                |
| `__v`                           | copied (was never deleted pre-`f460f1e`; harmless because Mongoose ignores/reinitializes it on `new Job()`) | excluded          | excluded, now also guarded | Mongoose version key of a different document.                                                                                             |
| `externalId`                    | copied (latent bug — see §2.3)                                                                              | excluded          | excluded, now also guarded | `unique + sparse` index; copying risks `E11000` and corrupts scraper dedup.                                                               |
| 14 canonical publication fields | did not exist yet                                                                                           | excluded          | excluded, now also guarded | Immutable publishing-operation identities/evidence tied to a specific, non-existent submission/moderation lifecycle for the new document. |

### 3.4 RECOMPUTE (controller-level, applied to the projection's output, not part of the projection allowlist itself)

`title` → `` `${source.title} (Copy)` `` (derived from the preserved raw title).
`status` → `'draft'`. `approvalStatus` → `'pending'`. `slug` → generated by
`applyResolvedSlug()` from the recomputed title/province/location. Unchanged from
prior behavior; now documented explicitly in a code comment above `duplicate()`.

## 4. Implementation

### 4.1 `server/src/services/jobWriteBoundary.js`

- Replaced the coincidental `JOB_DUPLICATE_SOURCE_FIELDS = [...JOB_TRANSLATION_OVERRIDE_FIELDS, ...JOB_TRANSLATION_SOURCE_FIELDS]`
  with three independently-defined, exported, documented constants:
  `JOB_DUPLICATE_PRESERVE_FIELDS`, `JOB_DUPLICATE_RESET_FIELDS`,
  `JOB_DUPLICATE_FORBIDDEN_FIELDS` — decoupling duplication semantics from the
  unrelated translation write-boundary.
- `buildJobDuplicateProjection()` now builds its projection from
  `JOB_DUPLICATE_PRESERVE_FIELDS` and runs the result through a new
  `assertNoForbiddenDuplicateFields()` guard before returning, which throws if any of
  the 19 `JOB_DUPLICATE_FORBIDDEN_FIELDS` are ever present — defense-in-depth against
  a future maintainer accidentally adding a dangerous field to the preserve list.
- `JOB_TRANSLATION_OVERRIDE_FIELDS`, `JOB_TRANSLATION_SOURCE_FIELDS`,
  `CANONICAL_JOB_PUBLICATION_FIELDS`, `validateJobTranslationOverrides`,
  `buildJobTranslationProjection`, `createMongoSanitizeOptions`,
  `getMongoSanitizeEvidence`, `hasSanitizedBodyEvidence`,
  `recordMongoSanitizeEvidence` are byte-for-byte unchanged in behavior — verified by
  rerunning `canonicalJobWriteBoundary.test.js` (409/409 assertions, unchanged count).

### 4.2 `server/src/controllers/admin/adminJobsController.js`

- Added a doc comment above `duplicate()` pointing at the field contract and this
  report.
- Extended the `job.duplicate` audit-log `metadata` with `preservedFieldCount` and
  `resetFieldCount` (drawn from the new exported constants), giving admins visibility
  into the fact that fields were deliberately reset — directly addressing the "no
  warning" complaint in the original F1 finding, without logging full field values
  (no sensitive data added to the audit trail).
- No change to the actual duplication algorithm's field outcome (see §3): the
  controller still calls `buildJobDuplicateProjection(source)` and then explicitly
  recomputes `title`/`status`/`approvalStatus`/`slug`, exactly as before.

## 5. Regression

- **Fields previously lost** (per F1): `planId`, `planType`, `expiresAt`,
  `isFeatured`, `isSponsored`, `priority`, `urgent`, `boostLevel`, `paidUntil`,
  `source`, `scrapedAt`, `sourceUrl`, `sourceWebsite`.
- **Fields restored**: none. On reconstruction (§2.3), restoring any of them would
  reintroduce a free-promotion/free-plan-duplication business-rule bypass, or (for
  `source`/`scrapedAt`/`sourceUrl`/`sourceWebsite`) misrepresent an admin-authored
  draft as a live external record. This matches the explicit instruction not to infer
  that every paid or source field should be preserved.
- **Fields intentionally still excluded**: all 13 fields listed above, plus
  `externalId` (technical necessity — unique index) and the 14 canonical publication
  fields (evidentiary necessity), now with an explicit, documented, tested rationale
  instead of a silent side effect.
- **Previous behavior**: whitelist-copy of 34 fields, undocumented, untested at the
  controller level, structurally coupled to the unrelated translation write-boundary.
- **Corrected behavior**: identical resulting field set, now independently defined,
  explicitly documented per field with business/security rationale, guarded at
  runtime against accidental reintroduction of forbidden fields, and covered by a
  dedicated 185-assertion regression suite plus an exact 75-field schema inventory
  canary that fails loudly if a future `Job` schema field is ever left unclassified.
- **Source mutation**: verified `buildJobDuplicateProjection()` never mutates its
  input (existing behavior, reconfirmed by both test suites).
- **Unknown-field handling**: fields not present in any of the three classified sets
  are silently excluded (allowlist semantics — `copyFields()` only ever reads keys it
  is explicitly told to read); a prototype-pollution attempt nested inside a preserved
  array/object field (e.g. `gallery: [{"__proto__":"unsafe"}]`) still fails loudly via
  the existing `assertSafeStructuredKey` guard, unchanged from before this correction.

## 6. Tests

`server/src/__tests__/adminJobDuplicateBoundaryRegression.test.js` (224 assertions
total as of SEC-1A, no live database connection) covers: the exact 75-field
preserve/reset/forbid inventory as a schema canary; an ordinary manually-created job; a
featured job; a sponsored job; an urgent/priority/boosted job; a plan-linked job; a job
with expiry/paid-until fields; a scraped/imported job with source attribution; a job
with analytics counters; a job with an application-count field (confirming no
application-relationship data can leak through, since none exists on `Job` itself); a
job with full moderation/publication state; a job with Free Beta rejection evidence;
unknown/unexpected source fields; nested prototype-pollution rejection; source-object
non-mutation; company/organization alias independence and array-cloning isolation; a
defense-in-depth check that no forbidden field is ever present in the preserve
allowlist; controller source-wiring verification; a full end-to-end
`.validate()`-only schema-validation pass of a realistic "everything set" duplicate;
and, added under SEC-1A (§12), a **real behavioral invocation of the exported
`duplicate()` handler itself** with `Job`/`AuditLog` mocked at the model boundary —
covering the success path (lookup, projection, save, recomputation, audit metadata,
response) and the bounded 404 failure path, not merely source-string inspection.

## 7. Verification

| Gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adminJobDuplicateBoundaryRegression.test.js`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 224/224 assertions passed (185 SEC-1 + 39 SEC-1A behavioral)                                                                                                                                                                                                                                                                                                                                                                             |
| `canonicalJobWriteBoundary.test.js`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 409/409 assertions passed (unchanged from before this correction)                                                                                                                                                                                                                                                                                                                                                                        |
| All other safe C1–C6 publishing suites (`jobCanonicalPublicationSchema`, `jobPublicationSubmissionModel`, `publishingImmutableEvidenceSchema`, `publishingOperationContextContract`, `publishingOutboxModel`, `publishingOutboxRepository`, `publishingQuotaFoundations`, `publishingReconciliationContract`, `publishingSubmissionSupportModels`, `publicationCandidateContract`, `applicationDestinationContract`, `transactionalFreeBetaSubmissionService`, `transactionalFreeBetaSubmissionBoundaryCorrection`, `employerSubmissionEligibility`, `reviewerCorrectionEligibility`, `freeBetaPublishingPolicy`) | All passed, unchanged                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Remaining 22 of 38 pre-existing server test scripts (auth, employer, navbar, etc.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | All passed, unchanged                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `employerPortalIntegration.test.js`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Correctly skipped — requires a live MongoDB connection                                                                                                                                                                                                                                                                                                                                                                                   |
| Server lint (`eslint src --ext js`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 0 errors, 0 warnings                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Client lint (`eslint . --ext js,jsx --max-warnings 100`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 0 errors, 52 warnings — identical count to the pre-existing baseline; no client file was touched                                                                                                                                                                                                                                                                                                                                         |
| Client production build (`vite build`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Succeeded, 0 errors                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Prettier verification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `server/src/services/jobWriteBoundary.js`, `server/src/__tests__/adminJobDuplicateBoundaryRegression.test.js`, and this report pass full-file Prettier checks. `server/src/controllers/admin/adminJobsController.js` has pre-existing full-file formatting differences outside SEC-1 scope; only the SEC-1 changed lines were verified as Prettier-compliant. The file was intentionally not fully reformatted to avoid unrelated churn. |
| `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Clean (only informational LF→CRLF line-ending notices, exit code 0)                                                                                                                                                                                                                                                                                                                                                                      |

## 8. Self-audit

- No intended field remains silently dropped — every one of the 13 fields F1 flagged
  as "lost" has an explicit, documented reset rationale in §3.2, and the field
  inventory is exhaustively verified against the live schema (§6, canary test).
- No unsafe field is newly copied — `JOB_DUPLICATE_PRESERVE_FIELDS` is unchanged in
  resulting value from the prior (pre-correction) computed set; the new
  `assertNoForbiddenDuplicateFields()` guard additionally proves none of the 19
  forbidden fields can appear.
- Old (pre-`f460f1e`) behavior was directly compared (§2.1) via `git show f460f1e^:...`.
- Controller and helper behavior agree — `duplicate()` calls
  `buildJobDuplicateProjection(source)` and then explicitly recomputes exactly the
  four RECOMPUTE fields; verified by both the existing and new test suites' source-
  inspection assertions.
- No C1–C5 contract changed — `CANONICAL_JOB_PUBLICATION_FIELDS`,
  `JOB_TRANSLATION_OVERRIDE_FIELDS`, `JOB_TRANSLATION_SOURCE_FIELDS`,
  `validateJobTranslationOverrides`, `buildJobTranslationProjection`, and every
  publishing contract file under `server/src/services/publishing/` are untouched.
- No schema changed — `server/src/models/Job.js` was not modified.
- No database connection occurred — both test suites run with
  `mongoose.connection.readyState === 0` asserted at the top.
- No active publishing runtime behavior was added — the dormant Free Beta publishing
  subsystem remains exactly as dormant as before; this correction only touches the
  live admin CMS duplicate endpoint and its write-boundary helper.
- No unrelated security work started — CAPTCHA, token storage, CSV/XLSX injection,
  dependency upgrades, Redis, and all other STRIDETO-AUDIT-01 findings are untouched.

## 9. Field-level "possible losses" disposition (explicit, per the task's list)

| Field           | Disposition                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `planId`        | RESET — not restored; avoids free plan-entitlement duplication                                                                                                  |
| `planType`      | RESET — not restored; follows `planId`                                                                                                                          |
| `expiresAt`     | RESET — not restored; tied to a specific paid listing window                                                                                                    |
| `isFeatured`    | RESET — not restored; avoids free featured-placement duplication (proven, §11)                                                                                  |
| `isSponsored`   | RESET — not restored; avoids free sponsorship duplication (proven, §11)                                                                                         |
| `priority`      | RESET — not restored; **corrected (SEC-1A)**: no proven writer or reader exists anywhere in the live codebase — not a promotion field, just the neutral default |
| `urgent`        | RESET — not restored; **corrected (SEC-1A)**: one write-only admin form field with zero downstream readers — not a proven promotion field                       |
| `boostLevel`    | RESET — not restored; **corrected (SEC-1A)**: no proven writer or reader exists anywhere in the live codebase                                                   |
| `paidUntil`     | RESET — not restored; a specific payment-window timestamp (proven, §11)                                                                                         |
| `source`        | RESET — not restored; duplicate is admin-originated, not a live scrape                                                                                          |
| `scrapedAt`     | RESET — not restored; would misrepresent duplicate as re-scraped                                                                                                |
| `sourceUrl`     | RESET — not restored; follows `source`                                                                                                                          |
| `sourceWebsite` | RESET — not restored; follows `source`                                                                                                                          |

## 11. SEC-1A field-by-field evidence trace

Every field the SEC-1A audit flagged for re-verification, with writers/readers found
by repository-wide search:

| Field                         | Writers                                                                                                                                  | Readers                                                                                                                                                                                                | Payment?                                                          | Moderation?                                                       | Scraper? | Ownership?          | Disposition                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------- | -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `priority`                    | **None found** in live server code                                                                                                       | **None found**                                                                                                                                                                                         | No                                                                | No (only referenced in dormant `PublicationCandidateContract.js`) | No       | No                  | RESET — neutral default, no proven behavior either way                                                                                   |
| `urgent`                      | One: `adminJobsController.js`'s `applyJobBody` (admin edit-form checkbox, `client/src/pages/Admin/AdminContentJobs.jsx:391`)             | **None found** — no public badge, no sort/filter, no monetization query                                                                                                                                | No                                                                | No                                                                | No       | No                  | RESET — write-only field today                                                                                                           |
| `boostLevel`                  | **None found** anywhere in live code                                                                                                     | **None found**                                                                                                                                                                                         | No (only referenced in dormant `PublicationCandidateContract.js`) | No                                                                | No       | No                  | RESET — neutral default                                                                                                                  |
| `deadline`                    | Multiple admin/employer controllers                                                                                                      | `jobsController.js:28-46` (filter/sort), `trendingController.js:47` (recency score), `recommendationsController.js:22` (match score), plus the equivalent Scholarship/Admission/ForeignStudy consumers | No                                                                | No                                                                | No       | No                  | **PRESERVE (confirmed)** — core editable template content actively consumed by public listing/ranking                                    |
| `postedBy`                    | `create()`/`update()` via `req.user`                                                                                                     | Attribution/audit display only                                                                                                                                                                         | No                                                                | No                                                                | No       | Creator attribution | PRESERVE (unchanged)                                                                                                                     |
| `employerId`                  | `create()`/`update()`/employer self-service                                                                                              | Ownership-scoping throughout every employer controller                                                                                                                                                 | Indirect (plan/checkout is employer-scoped)                       | No                                                                | No       | **Direct**          | **PRESERVE (confirmed, not assumed)** — see route/UI evidence below                                                                      |
| `source`                      | `employerController.js:105` (`'employer'`), `scraperService.js:103` (`'scraper'`), `importHandlers.js` (`'manual'`)                      | `growthDashboardController.js:50` — `Job.countDocuments({ source: 'scraper' })`, a live admin growth-dashboard KPI                                                                                     | No                                                                | No                                                                | **Yes**  | No                  | RESET — a stale/copied value would corrupt a live KPI                                                                                    |
| `scrapedAt`                   | `scraperService.js` only                                                                                                                 | `blogAutoGenerateService.js:22` — `Job.find(...).sort({ scrapedAt: -1, ... })`, selects source jobs for auto-generated blog content                                                                    | No                                                                | No                                                                | Yes      | No                  | RESET — a copied value would misrepresent content freshness                                                                              |
| `sourceUrl` / `sourceWebsite` | `services/scrapers/base.js`'s `normalizeJob()`                                                                                           | `seoController.js:181-182` — public SEO landing pages (`/ppsc-jobs`, `/latest-government-jobs`, etc.) filter `Job.find({ sourceWebsite: RegExp(...) })`                                                | No                                                                | No                                                                | Yes      | No                  | RESET — a copied value would make an admin-authored duplicate incorrectly appear on a public SEO landing page for a source it isn't from |
| `planId` / `planType`         | `employerController.js:190-217`, `paymentService.js`'s activation-verification flow (both only after a real Stripe checkout is verified) | `paymentsController.js`, checkout flow                                                                                                                                                                 | **Yes, proven**                                                   | No                                                                | No       | No                  | RESET (unchanged)                                                                                                                        |
| `expiresAt` / `paidUntil`     | `employerController.js:210-220`, `paymentService.js` (paid activation only, set together)                                                | `reminderJobs.js:78-87` (`expiresAt: job.paidUntil` reminder query), `automationService.js`'s `onSubscriptionExpiring`                                                                                 | **Yes, proven**                                                   | No                                                                | No       | No                  | RESET (unchanged)                                                                                                                        |
| `isFeatured` / `isSponsored`  | Admin/employer forms, `monetizationController.js:173,188` (staff monetization toggle)                                                    | `monetizationController.js:27` (public sponsored-listing query) and the equivalent featured-listing query                                                                                              | **Yes, proven**                                                   | No                                                                | No       | No                  | RESET (unchanged)                                                                                                                        |

**`employerId`/`postedBy` cross-employer question, resolved (not assumed):**
`server/src/routes/admin.js:164` — `adminRouter.post('/jobs/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_JOBS), adminJobs.duplicate)` — the route takes no body schema. `client/src/pages/Admin/AdminContentJobs.jsx:150-152` — the only caller does
`axiosInstance.post(\`/admin/jobs/${id}/duplicate\`)` with **no payload**, from a
same-row "Duplicate" button (`AdminContentJobs.jsx:211`). There is no target-employer
picker anywhere in the client or server contract for this endpoint. Product intent is
therefore conclusively same-employer, in-place duplication only — preserving
`employerId`/`postedBy` verbatim is correct, not an assumption requiring a NOT READY
verdict.

## 12. Behavioral controller test (SEC-1A)

A real, mocked invocation of the exported `duplicate()` handler was added to
`adminJobDuplicateBoundaryRegression.test.js` (§18 in the file, "Behavioral controller
test"). Technique: `Job` and `AuditLog` are Mongoose model singletons — the same
object is returned by `mongoose.model(...)` to every importer in a process — so
monkey-patching `Job.findById`, `Job.findOne`, `Job.prototype.save`, and
`AuditLog.create` from the test file is visible to the controller's and
`auditService.js`'s own calls without modifying either file. `mongoose.connect()` is
never called anywhere in the test process, so no network connection to MongoDB is
ever attempted regardless of what code path runs.

**A real interference was discovered and handled, not hidden.** `duplicate()` calls
`onContentSaved('jobs', doc)` after saving, unawaited. That function fires a
background editorial-workflow sync
(`services/workflow/workflowIntegration.js`'s `syncWorkflowAfterSave` →
`ensureEditorialWorkflow` → `inferWorkflowStatusFromEntity`) that independently calls
`Job.findById(doc._id)` — a **second, legitimate call using the new duplicate's own
id**, not the source id — plus a separate search-index scheduling path this
correction did not trace further (both are pre-existing, generic content-lifecycle
plumbing shared by every admin content type's save path, not specific to job
duplication, and out of scope for this narrow field-contract correction). The first
version of this test asserted on a single captured `findById` argument and failed
non-deterministically because of this second call. The test was corrected to capture
**all** calls to each mocked method as arrays and assert by _content_ (does the
expected source-id lookup appear; does a save with the recomputed title `"... (Copy)"`
appear; does an audit-log entry with `action: 'job.duplicate'` appear) rather than by
call count or position, so the test is correct regardless of how many additional
background calls that unrelated plumbing makes. `process.exit(0)` is called at the
end of the file so the process does not wait on any resulting pending
Mongoose-query-buffer timers (which, since no connection is ever established, could
only ever time out internally — they can never reach a real database).

What the behavioral test verifies that source-inspection alone could not: the source
Job is looked up by the correct id; the source object is never mutated; slug
resolution queries `Job.findOne`; the actual saved document instance has the
recomputed `title`/`status`/`approvalStatus`/`slug` and every reset field at its
schema default and every preserved field intact; the audit-log call's `metadata`
contains **exactly** `{sourceId, preservedFieldCount, resetFieldCount}` — verified via
`Object.keys(...).sort()` equality — with no field values (confirmed no leaked
`'PPSC'`/`'premium'` substrings from the fixture); the response is `res.status(201)`
called once with the saved document; and the bounded failure path (missing source Job)
yields `res.status(404)` with no save and no audit-log call.

## 13. Next safe step

Per the instruction accompanying this task: review and checkpoint STRIDETO-SEC-1,
then begin immediate input/abuse security hardening (the next item on the P0 list in
`docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md` — CAPTCHA verification,
refresh-token storage, and CSV/XLSX export escaping remain unstarted and out of scope
for this correction).
