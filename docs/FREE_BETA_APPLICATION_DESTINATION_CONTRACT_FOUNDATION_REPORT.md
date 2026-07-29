# Free Beta Application Destination Contract Foundation Report

## 1. Executive result

**READY FOR FINAL APPLICATION DESTINATION CONTRACT ACCEPTANCE RE-AUDIT**

E.1F-H2B-B3-C1 created a pure, database-free application-destination
contract. It accepts only three canonical destination modes, derives internal
platform identity from server-owned Job context, treats every external target
as admin-review-required, creates strict immutable evidence, and classifies
every mode or target change as a major scope change.

The module is dormant. No existing runtime imports it, and no persistence,
approval workflow, public rendering, redirect, adapter, or network behavior
was introduced.

### Acceptance rejections and corrections

The H2B-B3-C1-A final acceptance audit returned:

```text
H2B-B3-C1 REQUIRES CORRECTION
```

It confirmed two defects:

1. internal evidence validation accepted any syntactically valid replacement
   digest because it lacked authoritative Job context;
2. the exported error constructor serialized arbitrary caller-supplied codes.

H2B-B3-C1-B corrected only those defects:

- internal validation now requires a separate strict server-owned `{ jobId }`
  context and recomputes the digest through the same canonical helper as the
  builder;
- internal comparisons require the corresponding previous/next validation
  context and cannot bypass digest validation;
- the error constructor accepts only the immutable approved-code set and
  canonicalizes every unsupported input to `DESTINATION_MODE_INVALID`;
- focused behavioral regressions cover forged digests, missing/wrong context,
  comparison bypass attempts, arbitrary codes/messages/details, and
  serialization independence.

No Job identity or validation context was added to persisted evidence.

The H2B-B3-C1-C final re-audit then returned:

```text
H2B-B3-C1 REQUIRES FURTHER CORRECTION
```

The digest, comparator, external-destination, and error-security corrections
passed. The remaining defect was the timestamp representation: a proxied Date
lost native Date branding and threw `DataCloneError` under `structuredClone`.

H2B-B3-C1-D removed that representation. The server clock still enters the
builder as a strict valid Date, but pure evidence now stores only its canonical
UTC ISO string in exact `YYYY-MM-DDTHH:mm:ss.sssZ` form. The primitive value is
immutable, JSON-safe, structured-clone-safe, deterministic, alias-free, and
database-free. Installed Mongoose 8.23.0 can cast it to a native Date through a
temporary schema path without a model or connection.

The authoritative destination error codes remain:

```text
DESTINATION_MODE_INVALID
DESTINATION_OWNERSHIP_UNVERIFIED
DESTINATION_EVIDENCE_CONFLICT
DESTINATION_CHANGED_BEYOND_CORRECTION_SCOPE
```

They were not replaced by the conflicting alternate inventory from the prior
re-audit checklist.

## 2. Exact files created

Exactly three files were created:

```text
server/src/services/publishing/contracts/ApplicationDestinationContract.js
server/src/__tests__/applicationDestinationContract.test.js
docs/FREE_BETA_APPLICATION_DESTINATION_CONTRACT_FOUNDATION_REPORT.md
```

No existing file changed.

## 3. Authoritative audit followed

The implementation follows:

```text
docs/FREE_BETA_SUBMISSION_ADAPTER_BLOCKER_CONTRACT_AUDIT.md
```

It preserves the accepted Free Beta publishing policy, H2A quota foundations,
H2B-A transaction core, canonical Job schema and write boundaries, and typed
publishing outbox foundation.

## 4. Exact destination modes

The immutable mode mapping is:

```text
internal_platform
external_url
external_email
```

`manual_instructions` is not a destination mode. `sourceUrl` and other
fallback fields are never accepted or read.

## 5. Strict client input contract

The exact client declaration shapes are:

```text
internal_platform: { mode }
external_url:      { mode, target }
external_email:    { mode, target }
```

The envelope must be a direct plain object with only enumerable data
properties. Arrays, primitives, Dates, class instances, unusual prototypes,
accessors, inherited input, circular additions, hidden properties, symbols,
prototype-pollution keys, dotted keys, `$` keys, and every unknown field fail
closed.

The contract therefore rejects client-provided trust, ownership, approval,
verification, evidence, actor, applicant, payment, moderation, request,
header, cookie, token, credential, raw-verification, routing, redirect, slug,
and provenance fields.

## 6. Internal-platform derivation

Internal destination identity is derived from a strict server context:

```text
jobId
evaluatedAt
validationPolicyVersion
```

`jobId` must be an already-authorized canonical ObjectId string supplied by a
future server caller. It is used only as the internal digest identity. The
client cannot supply a target, route, Job override, slug, path, URL, email, or
redirect.

The evidence stores:

```text
normalizedTarget = null
normalizedDomain = null
trustClassification = INTERNAL_PLATFORM
evidenceSource = server_derived_internal_route
classifiedByActorType = system
classifiedByActorId = null
```

No route is constructed or contacted.

Generic validation of internal evidence requires a separate exact context:

```text
{ jobId }
```

The context is strict, is never persisted or returned, and may not contain
trust, actor, approval, or evidence-source fields. Correct context recomputes
the internal digest. Missing, null, malformed, or wrong Job context and every
replacement digest fail with a generic evidence-conflict error.

## 7. External URL normalization

The URL contract:

- accepts HTTPS only;
- accepts an explicit default HTTPS port and normalizes it away;
- rejects non-default ports;
- requires a multi-label canonical hostname;
- normalizes hostname casing and internationalized hosts through the Node URL
  parser;
- retains the normalized path after standard dot-segment resolution;
- normalizes an origin-only URL to its canonical trailing slash;
- rejects credentials, fragments, queries, leading/trailing or embedded
  whitespace, raw and percent-encoded control characters;
- rejects trailing-dot, malformed, single-label, local, private/reserved,
  special-use, IP-literal, and recognized opaque-shortener hosts;
- limits the normalized URL to 2,048 characters;
- limits the normalized host to 253 characters and each label to 63
  characters.

The module performs no DNS, HTTP, redirect, reputation, or ownership check.
The normalized target and domain are private evidence, not proof of control.

## 8. External email normalization

The email contract:

- trims outer whitespace and applies Unicode NFC;
- preserves local-part case and semantics;
- lowercases and converts an internationalized domain to canonical ASCII;
- requires exactly one unquoted address and one domain separator;
- rejects display-name/angle-bracket forms, multiple addresses, whitespace,
  control characters, missing components, invalid dot placement, IP/local or
  reserved domains;
- limits the full normalized address to 254 characters, the local part to 64,
  the domain to 253, and each domain label to 63 characters.

Consumer mailboxes and corporate-looking domains are both accepted only as
syntactic declarations. Neither becomes ownership proof.

The module performs no email delivery, MX lookup, domain verification, or
Employer lookup.

## 9. Trust classifications

The immutable policy mapping contains the audit-approved classifications:

```text
INTERNAL_PLATFORM
ADMIN_REVIEW_REQUIRED
ADMIN_APPROVED_FOR_PUBLICATION
UNVERIFIED_REJECTED
```

This phase builds only initial submission evidence:

- `internal_platform` derives `INTERNAL_PLATFORM`;
- `external_url` derives `ADMIN_REVIEW_REQUIRED`;
- `external_email` derives `ADMIN_REVIEW_REQUIRED`.

Approval and rejection values are reserved for a future exact-digest
moderation decision. They cannot be synthesized through this API.

## 10. Evidence sources

The exact initial evidence-source values are:

```text
server_derived_internal_route
employer_declared_external_target
```

The second value records declaration plus server normalization. It does not
claim that the employer owns or controls the target.

## 11. Authoritative actors

The immutable actor mapping records:

```text
system
staff
security_operator
```

Only `system` is valid for evidence built in this phase. Initial evidence
always has `classifiedByActorId = null`. No staff decision API or persistence
was implemented.

## 12. Immutable evidence structure

Every evidence object has exactly these fields:

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

The schema version is `1`. The validation policy version is the server-owned
accepted value `free-beta-2026-01`. The builder and validator enforce
mode/trust/source/actor agreement and reject unknown evidence fields.
External evidence recomputes its digest from the persisted normalized target.
Internal evidence recomputes its digest from separately supplied authoritative
Job context. Validation does not persist or retain that context.

`evaluatedAt` is a primitive canonical UTC ISO string. It must contain exactly
24 characters in `YYYY-MM-DDTHH:mm:ss.sssZ` form and round-trip exactly through
`Date` parsing and `toISOString()`. Date objects, numbers, boxed strings,
offset alternatives, missing or excessive fractional precision, lowercase
`z`, date-only values, whitespace, control characters, locale strings, and
other non-canonical equivalents fail closed.

The builder continues to require a valid server-owned Date. It converts that
Date once to the canonical string, does not mutate it, and retains no alias.
A native Date object, Proxy, accessor, or mutable timestamp object is not
stored in pure evidence. Future schema integration may cast the string to a
Date, but this phase performs no model integration, persistence, or database
connection.

## 13. Digest construction

The digest is lowercase SHA-256 over this UTF-8 descriptor:

```text
application_destination
NUL
schema:<schema version>
NUL
mode:<canonical mode>
NUL
target:<canonical target identity>
```

For an internal destination, canonical target identity is the domain-separated
server-owned Job identity. For an external destination, it is the exact
normalized URL or email.

NUL separation prevents ambiguous concatenation. The digest is deterministic,
mode-separated, target-separated, replay-stable, unsalted, and never embeds
the target in its output. It supports exact comparison; it does not prove
ownership.

Both builder and validator call the same internal-target and digest helpers.
Validation rejects a digest generated for another Job as well as an arbitrary
lowercase 64-hex replacement.

## 14. Destination-change classification

The comparator returns:

```text
same mode and target digest -> NO_SCOPE_CHANGE
different mode or digest    -> MAJOR_SCOPE_CHANGE
```

A major change requires renewed validation and prevents transfer of prior
approval. Host, path, mailbox, domain, internal/external, URL/email, and target
changes are detected. Equivalent normalized declarations do not create false
changes.

The result contains only:

```text
classification
requiresRenewedValidation
priorApprovalTransferAllowed
```

It does not calculate quota, charge an employer, or grant a correction
exemption.

When either comparison side is `internal_platform`, the comparator requires
the corresponding strict `previousValidationContext` or
`nextValidationContext`. It validates each side before comparison. Missing,
wrong, or forged internal evidence fails, and no Job identity, target, domain,
or digest appears in comparison output. External-only comparison keeps its
original context-free behavior.

## 15. Safe error contract

The immutable error-code mapping contains:

```text
DESTINATION_MODE_INVALID
DESTINATION_OWNERSHIP_UNVERIFIED
DESTINATION_EVIDENCE_CONFLICT
DESTINATION_CHANGED_BEYOND_CORRECTION_SCOPE
```

Thrown contract errors serialize only:

```text
status
code
message
```

Messages are generic and bounded. They do not contain a destination, domain,
Job identifier, digest input, supplied object, token, cookie, header,
credential, stack, or validation-library detail. Nothing is logged.

The constructor derives its code and message only from an immutable approved
code set and canonical message mapping. Unsupported strings, objects, symbols,
URLs, addresses, Job identifiers, caller messages, and caller details are
ignored and canonicalized to `DESTINATION_MODE_INVALID`. Each `toJSON()` call
returns a new frozen object with exactly `status`, `code`, and `message`.

## 16. Privacy exclusions

The module accepts no raw request, headers, cookies, authorization data,
tokens, secrets, verification documents or responses, arbitrary notes,
applicant data, payment data, moderation notes, unrestricted metadata, DNS or
HTTP responses, or staff-internal text.

Full normalized external targets exist only in the newly built evidence object
for future restricted immutable submission storage. No runtime projection,
log, error, event, or public response was added.

## 17. Export immutability

All exported mappings and bounds are frozen plain objects. No mutable Set,
Map, array, or mode-policy object is exported. Attempts to replace policy
values cannot affect validation or later evidence.

## 18. Input/output alias isolation

The builder:

- creates a new evidence object;
- does not mutate destination input or server context;
- requires a valid injected Date and stores only its canonical UTC ISO string;
- does not share a mutable object with input or context;
- freezes the evidence object;
- computes normalized strings and a new digest;
- uses a primitive timestamp with no Proxy, accessor, mutable alias, or
  cross-record mutable state;
- remains JSON round-trip and structured-clone compatible.

Source input/context mutation after construction does not change evidence.
Database-free Mongoose Date casting produces a native Date with the same
timestamp. No model, collection, index, connection, or persistence operation
is created by that compatibility proof.

## 19. Dormancy and import isolation

The module imports only:

```text
node:crypto
node:url
```

It imports no Mongoose model, database configuration, controller, route,
middleware, worker, scheduler, queue, Redis, email, notification, payment,
webhook, frontend, runtime composition, or environment module.

It reads no environment variable, opens no connection, starts no timer or
listener, logs nothing, and makes no network request. Repository-wide source
scans confirm that no startup, controller, route, worker, scheduler,
transaction service, outbox runtime, frontend module, or barrel imports it.

## 20. New test suite and assertion count

```text
applicationDestinationContract.test.js
```

Result: 1 suite, 1,208 assertions, 0 failures.

The suite behaviorally covers module purity, strict input security, internal
derivation, URL and email normalization/rejection, trust enforcement, exact
evidence, digest isolation, source alias isolation, safe errors, change
classification, immutable exports, runtime-reference isolation,
context-bound internal digest verification, comparator context enforcement,
approved-code-only error serialization, canonical timestamp strictness, source
and cross-record isolation, JSON round trips, structured cloning, and
database-free Mongoose Date casting.

## 21. Publishing regression results

Suites:

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

## 22. Outbox regression results

Suites:

```text
publishingOutboxModel.test.js
publishingOutboxRepository.test.js
```

Result: 2 suites, 232 assertions, 0 failures.

## 23. Canonical regression results

Suites:

```text
jobCanonicalPublicationSchema.test.js
canonicalJobWriteBoundary.test.js
```

Result: 2 suites, 516 assertions, 0 failures.

Total: 12 suites, 2,269 assertions, 0 failures.

No test connected to MongoDB or read production data.

## 24. Lint, build, and formatting results

- Server lint: passed with zero errors.
- Client lint: passed with zero errors and 52 pre-existing warnings.
- Client production build: passed in a verified temporary output directory,
  which was removed after completion. Existing dynamic/static import and chunk
  size warnings remain non-blocking.
- Prettier: passed for all three new files.
- `git diff --check`: passed.
- Direct whitespace and conflict-marker scans: passed.
- Sensitive-value scan: passed without displaying values.
- Import-isolation, module-side-effect, dependency, network-call,
  destination-value leakage, and runtime-reference scans: passed.

No unrelated warning was changed.

## 25. Known limitations

- External URL ownership remains unproven.
- External email ownership remains unproven.
- External targets remain `ADMIN_REVIEW_REQUIRED`.
- The recognized opaque-shortener rejection list is deterministic and
  database-free; it is not a network reputation service or comprehensive
  redirect registry.
- No staff approval/rejection persistence exists.
- No revocation workflow exists.
- No public rendering gate exists.
- No immutable submission schema integration exists.
- No timestamp model integration exists; future schema code may cast the
  canonical ISO string to a Date after a separately authorized schema phase.
- No candidate integration exists.
- No transactional-service integration exists.
- No adapter integration exists.

## 26. Remaining destination decisions before runtime use

Runtime use still requires separately approved decisions and implementations
for:

1. exact staff authorization and append-only decision evidence;
2. URL query and redirect-provider policy;
3. external target retention, projections, and access control;
4. revocation and employer-suspension behavior;
5. immutable submission and moderation-event schema integration;
6. candidate construction and correction comparison;
7. canonical public visibility/application gates;
8. transactional service and Mongoose adapter composition.

## 27. Next safe phase

The next safe action is a read-only final H2B-B3-C1 acceptance re-audit.

Candidate construction, unknown-commit reconciliation, schema integration,
transaction-service modification, adapter implementation, replica-set proof,
and runtime wiring remain unauthorized.

## 28. Preservation statement

- Exactly three new files: Yes.
- Existing application files changed: No.
- Existing models changed: No.
- H2A/H2B-A changed: No.
- Canonical Job schema changed: No.
- Transaction service changed: No.
- Outbox foundation changed: No.
- Candidate contract implemented: No.
- Reconciliation contract implemented: No.
- Destination approval workflow implemented: No.
- External ownership claimed: No.
- Public renderer/redirect changed: No.
- Controllers/routes changed: No.
- Workers/schedulers/startup changed: No.
- Public queries changed: No.
- Notification/SMTP behavior changed: No.
- Payment/webhook changed: No.
- Frontend/theme/responsiveness changed: No.
- Authentication/RBAC weakened: No.
- Security/privacy weakened: No.
- Configuration/dependencies changed: No.
- Network request performed: No.
- Production data read/written: No.
- Database connection performed: No.
- Migration/index operation performed: No.
- Files staged: No.
- Commit performed: No.
- Push performed: No.
- Deployment performed: No.
- Mongoose submission adapter started: No.
- Runtime wiring started: No.
- Production acceptance report touched: No.

**STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED**
