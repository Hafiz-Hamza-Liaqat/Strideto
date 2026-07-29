# Free Beta Publication Candidate Contract Foundation Report

## 1. Executive result

**READY FOR DORMANT COMPLETE PUBLICATION CANDIDATE CONTRACT ACCEPTANCE AUDIT**

E.1F-H2B-B3-C2-B1 completed the dormant, database-free publication candidate
contract and corrected the obsolete C1 focused-test isolation expectation. The
candidate module remains reachable only from its focused test. It has no
runtime, model, controller, route, startup, worker, transaction-service, outbox,
frontend, database, or network integration.

## 2. Original C2-B stop condition

The prior C2-B run stopped with `NOT READY`. The candidate module and focused
test existed and passed 318 assertions, but the required foundation report was
absent and the committed C1 test rejected every source reference outside its
own module/test. That obsolete expectation rejected the exact C2 dependency
required by the accepted C2-A architecture.

## 3. Exact C1 isolation-test conflict

The C1 scan recursively covered JavaScript and JSX files under `server/src` and
`client/src`. Its final assertion excluded the C1 module and its own test, then
required the remaining matched-path array to be empty.

The only matched paths were:

```text
server/src/services/publishing/contracts/PublicationCandidateContract.js
server/src/__tests__/publicationCandidateContract.test.js
```

No runtime path was matched.

## 4. Why the candidate import is authorized and dormant

The C2-A authoritative contract requires
`PublicationCandidateContract.js` to reuse the accepted
`ApplicationDestinationContract.js` validator. The import performs pure
validation and normalized evidence copying. Merely placing this unexported,
unregistered module on disk does not activate it.

## 5. Exact narrow C1 test correction

Only the C1 focused test changed. Its source scan remains intact, but matched
paths are normalized relative to the repository root, sorted, deduplicated,
and checked against a frozen exact-path allowlist. Direct regression assertions
prove accepted paths, rejected runtime categories, separator normalization,
similarly named path rejection, unknown-contract rejection, and allowlist
immutability.

## 6. Exact paths newly permitted

```text
server/src/services/publishing/contracts/PublicationCandidateContract.js
server/src/__tests__/publicationCandidateContract.test.js
```

No wildcard permission was added.

## 7. Runtime paths still forbidden

Exact negative assertions continue to reject controller, route, model, startup,
worker, transaction-service, frontend, similarly named, and unknown contract
paths. Repository scans found no middleware, scheduler, outbox runtime,
payment, webhook, barrel, or automatic-registration consumer.

## 8. Files created and modified

Created:

```text
server/src/services/publishing/contracts/PublicationCandidateContract.js
server/src/__tests__/publicationCandidateContract.test.js
docs/FREE_BETA_PUBLICATION_CANDIDATE_CONTRACT_FOUNDATION_REPORT.md
```

Modified:

```text
server/src/__tests__/applicationDestinationContract.test.js
```

The C1 implementation did not change.

## 9. Authoritative C2-A contract followed

The implementation follows
`FREE_BETA_PUBLICATION_CANDIDATE_AUTHORITATIVE_CONTRACT_AUDIT.md`, while reusing
the accepted destination contract and existing pure `stripAllHtml` sanitizer.
No policy was reinterpreted.

## 10. Candidate exports

The exact exports are:

```text
PUBLICATION_CANDIDATE_SCHEMA_VERSION
PUBLICATION_CANDIDATE_POLICY_VERSION
PUBLICATION_CANDIDATE_KINDS
PUBLICATION_CANDIDATE_FIELDS
PUBLICATION_CANDIDATE_CONTENT_FIELDS
PUBLICATION_CANDIDATE_EDITABLE_FIELDS
PUBLICATION_CANDIDATE_FIELD_CLASSIFICATIONS
PUBLICATION_CANDIDATE_BOUNDS
PUBLICATION_CANDIDATE_COMPARISON_CLASSIFICATIONS
PUBLICATION_CANDIDATE_ERROR_CODES
PublicationCandidateContractError
buildMajorEditPublicationCandidate
buildPublicationCandidateCorrection
validatePublicationCandidate
comparePublicationCandidates
```

## 11. Schema and policy versions

```text
schemaVersion: 1
policyVersion: free-beta-2026-01
```

Both are server constants, stored, validated exactly, and hash-bound.

## 12. Construction modes

The module constructs only:

```text
major_edit
correction
```

Initial publication, renewal, repost, and migration construction remain
unsupported.

## 13. Revision rules

A major edit starts at revision `1` with `previousCandidateHash = null`. A
correction uses exactly `priorCandidate.candidateRevision + 1` and binds the
prior hash. Safe-integer limits are enforced, and a valid maximum-revision
candidate is behaviorally proved to reject overflow.

## 14. Approved-base envelope

The exact five fields are:

```text
approvedSubmissionId
approvedPublicationVersion
approvedCandidateHash
content
destinationEvidence
```

The envelope is strict and server-owned. Major-edit construction requires the
approved publication version to equal the expected publication version.

## 15. Twelve top-level fields

```text
schemaVersion
policyVersion
candidateKind
candidateRevision
baseApprovedSubmissionId
baseApprovedCandidateHash
basePublicationVersion
expectedPublicationVersion
previousCandidateHash
content
destinationEvidence
candidateHash
```

Additional or missing fields fail closed.

## 16. Twenty-six content fields

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

The focused suite independently asserts both exact inventories.

## 17. Bounds and normalization

The contract applies the authoritative strictest employer/snapshot bounds:
title 200, description 20,000, salary 120, location 200, skills 40 by 80,
requirements/responsibilities/benefits 200 by 2,000, and the remaining audited
field-specific limits. It rejects rather than truncates. Strings are primitive,
HTML-stripped, NFC-normalized, line-ending-normalized, trimmed, bounded, and
control-checked. Enums are exact.

## 18. Sanitizer integration

The candidate imports the existing pure:

```text
server/src/utils/htmlSanitize.js
stripAllHtml
```

It does not duplicate sanitization logic or import a controller.

## 19. Arrays and null/removal behavior

Array order and duplicates are preserved. Arrays are never sorted or
deduplicated; empty arrays clear editable arrays, while null is rejected.
Absent patch fields preserve the base. Approved nullable editable text fields
and deadline accept null or empty/whitespace strings as explicit clear
operations. Required text/enums and destination evidence reject clearing.
Copied-base-only fields cannot be patched.

## 20. Deadline policy

Candidate deadlines are exact 24-character canonical UTC strings or null.
Builders require an injected valid native `Date`; equality with the injected
clock is accepted, earlier deadlines are rejected, and preserved deadlines are
revalidated. Date-only, offset, object, numeric, and non-canonical forms fail.

## 21. C1 destination integration

The candidate stores a defensive frozen copy of the exact eleven-field C1
evidence. Internal evidence is validated with server-owned `{ jobId }` context.
External evidence remains `ADMIN_REVIEW_REQUIRED`. Candidate identity includes
only destination mode and target digest; target/domain/trust/timestamp/actor
values remain separately validated evidence.

## 22. Fingerprint descriptor and known vector

The candidate hash is lowercase SHA-256 over the accepted typed binary framing
with prefix:

```text
strideto.publication_candidate NUL v1 NUL
```

The focused test independently reconstructs the descriptor bytes, verifies
length `1271`, and confirms:

```text
a77f2fc1f88154efb909988d1651b312a259b315c571bec725d46a461b8979e6
```

The matching synthetic destination digest is:

```text
c2b68765289729eb2eac3cf25926e9845bd16204eac01471273a20fca000a0b8
```

## 23. Major-edit construction

Major-edit construction validates the complete approved base, applies only the
strict sparse editable patch, preserves all base-only fields, sets revision
one, binds the approved base/version, validates destination/deadline evidence,
and returns a complete deeply frozen candidate. It makes no quota or approval
decision.

## 24. Correction construction

Correction construction requires and validates the exact prior candidate and
fingerprint. It preserves approved-base identity/version, increments the
revision, binds the predecessor hash, applies the strict patch to defensive
copies, rejects no-op corrections, and leaves the prior candidate unchanged.
It makes no quota or approval decision.

## 25. Validation

Validation requires strict ordinary records and server-owned Job context,
revalidates exact fields, versions, kinds, revisions, identifiers, canonical
content, C1 evidence, and candidate hash, then returns a defensively isolated
frozen candidate. Accessors, symbols, hidden fields, unusual prototypes,
operator/dotted keys, and unknown fields fail closed.

## 26. Comparison classifications

The exact priority is:

```text
BASE_CONFLICT
DESTINATION_CHANGED
CONTENT_CHANGED
UNCHANGED
```

The frozen result contains booleans and a bounded frozen list of changed field
names only. It does not return values or make quota, correction, moderation,
approval, activation, or visibility decisions.

## 27. Error contract

The exact candidate codes are:

```text
PUBLICATION_CANDIDATE_INPUT_INVALID
MAJOR_EDIT_BASE_CONFLICT
MAJOR_EDIT_CANDIDATE_INVALID
PUBLICATION_CANDIDATE_DESTINATION_INVALID
PUBLICATION_CANDIDATE_FINGERPRINT_CONFLICT
PUBLICATION_CANDIDATE_COMPARISON_INVALID
```

Errors use canonical status/message definitions, ignore caller-supplied
messages/details, are frozen, and serialize only a new frozen
`{ status, code, message }`. Accepted C1 destination errors propagate
unchanged.

## 28. Privacy exclusions

The candidate accepts no request, session, headers, cookies, authorization,
token, password, applicant, payment, moderation note, private verification,
arbitrary metadata, canonical state, analytics, source/scraper, ownership, or
trust override. Static and behavioral checks found no content, destination,
identifier, fingerprint, or error-value leakage.

## 29. Immutability and alias isolation

Exported policy collections and nested policy entries are frozen. Candidate,
content, destination evidence, arrays, comparison result, and changed-field
array are frozen. Inputs and outputs do not share mutable arrays/objects;
mutating a source patch/base after construction cannot alter the candidate.

## 30. JSON and structured-clone results

The complete candidate passes JSON round-trip and `structuredClone` equality.
Its timestamp is a primitive canonical string, and it contains no Proxy,
accessor, Date, Map, Set, class instance, function, symbol, or circular value.

## 31. C1 isolation regression results

```text
Suites: 1
Assertions: 1,224
Failures: 0
```

All prior C1 security behavior remains passing. Only the exact dormant C2
module/test paths were newly permitted.

## 32. Candidate test results

```text
Suites: 1
Assertions: 321
Failures: 0
Known fingerprint vector: passed
```

The focused suites also passed in both execution orders with stable totals.

## 33. Publishing regression results

```text
Suites: 7
Assertions: 313
Failures: 0
```

The transaction core, support models, eligibility evaluators, H2A policy,
submission model, and quota foundations remain passing.

## 34. Outbox regression results

```text
Suites: 2
Assertions: 232
Failures: 0
```

## 35. Canonical regression results

```text
Suites: 2
Assertions: 516
Failures: 0
```

Complete verified result:

```text
Suites: 13
Assertions: 2,606
Failures: 0
```

## 36. Lint, build, and formatting results

- Server lint: passed with zero errors.
- Client lint: passed with zero errors and 52 pre-existing warnings.
- Client no-write production build: passed in a validated temporary output
  directory, which was removed.
- Prettier: passed for the modified C1 test, C2 module, C2 test, and this
  report.
- `git diff --check`: passed; Git reported only its existing LF/CRLF working
  copy notice.
- Direct trailing-whitespace, conflict-marker, sensitive-value, import,
  side-effect, network/database, environment-read, privacy-leakage, inventory,
  deterministic fingerprint, JSON, and structured-clone checks passed.

## 37. Known limitations

- The candidate is not embedded in `JobPublicationSubmission`.
- Moderation-event evidence is unchanged.
- The transaction service does not receive candidate data.
- Canonical Job compare-and-set integration is absent.
- The public pending-review gate is absent.
- Staff destination decisions are absent.
- Unknown-commit reconciliation is absent.
- The Mongoose adapter is absent.
- Production transaction topology remains unproved.

## 38. Remaining work before schema integration

Later separately authorized phases must define candidate/destination immutable
submission evidence, moderation decision evidence, transaction command and
stable identity integration, canonical Job CAS, approved projection, public
gating, operation context/reconciliation, adapter composition, and production
topology/index proof. None began here.

## 39. Next safe phase

The next safe phase is a read-only H2B-B3-C2 acceptance audit. This report does
not authorize schema integration, C3, a Mongoose adapter, runtime composition,
controller/route wiring, public-query changes, or production operations.

## 40. Preservation statement

- Two new C2 code/test files: Yes.
- One new C2 report: Yes.
- One existing C1 test modified: Yes.
- C1 implementation changed: No.
- C1 runtime behavior changed: No.
- C1 available to controllers/routes/models/startup/workers/frontend: No.
- Existing model changed: No.
- Transaction service changed: No.
- Persistence added: No.
- Public query changed: No.
- Operation-context/reconciliation work started: No.
- Adapter/runtime wiring started: No.
- Database or network operation performed: No.
- Production data read or written: No.
- Migration or index operation performed: No.
- File staged: No.
- Commit, push, or deployment performed: No.
- Production acceptance report touched: No.

**STRIDETO PROJECT PRESERVATION CONTRACT SATISFIED**
