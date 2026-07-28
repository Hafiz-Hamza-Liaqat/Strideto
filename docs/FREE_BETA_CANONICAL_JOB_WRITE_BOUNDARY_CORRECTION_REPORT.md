# Free Beta Canonical Job Write-Boundary Correction Report

- **Phase:** E.1F-H2B-B1-B-C2-A
- **Result:** READY FOR FINAL CANONICAL SCHEMA AND WRITE-BOUNDARY RE-AUDIT
- **Runtime status:** Narrow Job translation and duplicate boundary correction

## 1. Confirmed defects

The canonical schema acceptance audit confirmed two existing generic Job-copy
paths that became unsafe when canonical publication fields became recognized
Mongoose paths:

1. Job translation creation spread almost the complete source Job and raw
   request overrides into `new Model(...)`.
2. Admin Job duplication constructed a new Job from the complete source object.

Both paths could copy canonical publication state and other protected ownership,
approval, payment, analytics, monetization, source, or translation state.

## 2. Vulnerable paths corrected

Translation:

```text
POST /api/admin/translations/:entityType/:id
-> translationController.createTranslation
-> TranslationService.createTranslationFromSource
-> Job positive projection
```

Admin duplication:

```text
POST /api/admin/jobs/:id/duplicate
-> adminJobsController.duplicate
-> Job duplicate positive projection
```

## 3. Exact files changed

Modified:

- `server/src/index.js`
- `server/src/controllers/admin/translationController.js`
- `server/src/services/localization/TranslationService.js`
- `server/src/controllers/admin/adminJobsController.js`
- `docs/FREE_BETA_CANONICAL_JOB_PUBLICATION_SCHEMA_REPORT.md`

Created:

- `server/src/services/jobWriteBoundary.js`
- `server/src/__tests__/canonicalJobWriteBoundary.test.js`
- `docs/FREE_BETA_CANONICAL_JOB_WRITE_BOUNDARY_CORRECTION_REPORT.md`

`server/src/models/Job.js` was not modified during this correction. Its
pre-existing uncommitted schema work remains intact.

## 4. Positive projection design

`jobWriteBoundary.js` is a pure module with no Express, Mongoose model,
controller, payment, database, or side-effect dependency. It centralizes:

- Job translation override validation;
- translated Job source projection;
- admin Job duplicate projection;
- the complete canonical protected-field list;
- bounded, sorted, field-name-only failure details.

Unknown and future fields are denied by default. Mongoose strict mode and Mongo
sanitization are not used as authorization boundaries.

## 5. Translation override allowlist

Only these fields may be supplied as Job translation overrides:

- `title`
- `description`
- `requirements`
- `responsibilities`
- `benefits`
- `educationRequirement`
- `experience`
- `applicationInstructions`
- `seoTitle`
- `metaDescription`

Scalar fields require strings. The three array fields require arrays containing
only strings. Inputs are copied into a new safe object and are never mutated.

## 6. Translation source-copy allowlist

The translated Job may copy only:

- legitimate translatable content before safe overrides;
- company and organization display identity;
- location, province, city, category, employment type, Job type, skills,
  gender, salary, deadline, and work-mode fields;
- vacancy capacity and application-routing fields;
- logo and gallery;
- source `employerId` and `postedBy`.

Canonical, approval, plan/payment, paid expiry, analytics, monetization, source
and scraper identity, external identity, translation linkage, IDs, version,
timestamps, slug, moderation data, and applicant information are excluded.

The service supplies locale, translation group, source link, translation
status, `status=draft`, and `approvalStatus=pending`. Existing Mongoose
validation, translation-group behavior, save hooks, and slug generation remain
in use.

## 7. Duplicate projection

Admin duplication uses a separate explicit projection containing approved
editable vacancy content plus server-owned ownership and application-routing
fields. The controller retains the `(Copy)` title, draft status, pending
approval state, and new slug behavior.

It excludes every canonical field, rejection summary, approval source state,
plan/payment state, expiry/payment dates, analytics counters,
monetization/boost state, source/scraper/external identity, translation
linkage, IDs, version, timestamps, slug, and applicant information.

## 8. Canonical protected fields

The following fields are excluded from both projections and rejected in
translation overrides:

- `publicationState`
- `publicationVersion`
- `currentSubmissionId`
- `lastApprovedSubmissionId`
- `publishedAt`
- `visibleUntil`
- `applicationsCloseAt`
- `closedAt`
- `expiredAt`
- `rejectionSummary`
- `slugFrozenAt`
- `policyVersion`
- `publicationUpdatedAt`
- `publicationMigrationStatus`

## 9. Sanitization evidence

The installed `express-mongo-sanitize` 2.2.0 middleware supports `onSanitize`.
Its existing mutation behavior and position remain unchanged. Startup and the
focused tests now construct it with the same exported options factory and
callback. The callback stores a private, non-enumerable request-local Symbol
bitmask recording only whether body, query, parameter, or header sanitization
occurred. It stores no body, key name, key value, token, or supplied value and
causes no global rejection. Client-visible request properties cannot forge the
private evidence.

Only the Job translation controller consumes that evidence. It uses the safe
`overrides` marker because the sanitizer callback does not expose the removed
field name. Query or parameter sanitization alone does not cause this Job body
error. Unrelated endpoints and non-Job translation resolution retain their
existing behavior.

The C2 acceptance audit found that the earlier focused suite checked source text
and manually supplied evidence without executing the installed middleware.
C2-A now invokes the real package with a real `next` callback. Safe and unsafe
body cases, dotted and `$`-prefixed removal, query and parameter behavior,
sequential ordering, concurrent requests, same-instance reuse, unrelated
endpoints, and the stable Job-only error are all behaviorally proven.

## 9.1 Structured projection isolation

The C2 audit also confirmed shared `Date` and `ObjectId` references in both Job
translation and duplication projections. The shared projection clone now:

- creates a distinct Date with the identical timestamp;
- normalizes an ObjectId-compatible value to its lowercase canonical hex
  string, which normal Job construction casts to the same identifier;
- recursively creates new arrays and plain objects;
- recursively isolates nested Date and ObjectId values;
- rejects invalid Dates, unsupported custom classes, circular structures,
  accessors, non-enumerable properties, dangerous prototype names, dotted keys,
  and `$`-prefixed nested keys.

Neither projection mutates or freezes its source. Mutation tests prove both
source-to-projection and projection-to-source isolation. The positive field
allowlists, protected field set, duplicate field list, canonical exclusions,
and server-generated draft behavior are unchanged.

## 10. Stable error contract

Forbidden, unknown, malformed, dotted, operator-like, prototype-related, nested,
or sanitized-unsafe Job overrides return HTTP 400:

```json
{
  "error": "One or more translation override fields are not allowed.",
  "code": "TRANSLATION_OVERRIDE_FIELDS_FORBIDDEN",
  "details": {
    "fields": ["bounded", "sorted", "field names only"]
  }
}
```

Details contain at most 20 unique names, contain no supplied values, and expose
no source Job data or Mongoose error.

## 11. Compatibility and authorization

- Non-Job translation construction retains its previous source/override path.
- The translation route remains protected by staff authentication and
  `CONTENT_SITE`.
- The duplicate route remains protected by `CONTENT_JOBS`.
- No route, authentication realm, role, permission, rate limit, or ownership
  rule changed.
- No canonical publication writer was activated.
- Job translations remain legacy drafts.
- No public query, payment, webhook, applicant, or frontend behavior changed.

## 12. Tests and regressions

- Boundary suites: 1
- Boundary assertions: 409
- Schema suites: 1
- Schema assertions: 107
- Publishing suites: 7
- Publishing assertions: 313
- Employer/admin/auth/translation suites: 4
- Employer/admin/auth/translation assertions: 58
- Total suites: 13
- Total assertions: 887
- Failures: 0

All tests ran without a MongoDB connection or production data.

## 13. Verification

- Server lint: passed with zero errors.
- Client lint: passed with zero errors and 52 pre-existing warnings.
- Client production build: passed in a verified temporary output directory,
  which was removed after the build.
- Prettier: the boundary module, boundary test, schema report, and correction
  report pass. Formatting differences in existing runtime files were inspected
  without reformatting unrelated lines.
- Generic writer scan: both complete Job source constructors were removed; no
  other blocking runtime writer was found.
- Runtime references: no canonical publication writer or public-query reader
  was introduced.
- Route/auth/RBAC: unchanged.
- Job schema content and diff hashes: unchanged from the correction preflight.
- Sensitive-value scan: passed without printing values.
- Git whitespace checks: passed.

## 14. Security and privacy findings

The correction rejects non-plain envelopes, unknown fields, canonical and
system fields, dotted keys, `$`-prefixed keys, operator-like names,
`constructor`, `prototype`, `__proto__`, accessors, symbols, and unsupported
nested values. Error output contains field names only. No applicant,
moderation-internal, request, authentication, payment, or source-record data is
copied through the corrected projections.

## 15. Limitations

This correction does not define translated canonical-publication ownership,
implement the canonical repository or submission adapter, create an outbox,
change moderation, migrate legacy Jobs, cut over public queries, or perform
production transaction-topology work. Those remain separately gated phases.

## 16. Next acceptance audit

The next safe phase is a read-only acceptance re-audit of the combined canonical
Job schema and write-boundary correction.

## 17. Preservation statement

- `Job.js` modified during this correction: No.
- Existing uncommitted schema work retained: Yes.
- Canonical publication writer activated: No.
- Public visibility changed: No.
- Route permission changed: No.
- Authentication/RBAC weakened: No.
- Frontend changed: No.
- Dependency changed: No.
- Production data read/written: No.
- Database connection performed: No.
- Migration/backfill/index operation performed: No.
- File staged: No.
- Commit performed: No.
- Push performed: No.
- Deployment performed: No.
- Production acceptance report changed: No.

STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED
