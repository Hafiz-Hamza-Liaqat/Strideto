# Free Beta Publication Candidate Authoritative Contract Audit

## 1. Executive verdict

**READY FOR DORMANT COMPLETE PUBLICATION CANDIDATE CONTRACT IMPLEMENTATION**

The repository contains enough accepted policy, schema, write-boundary,
destination, and validation evidence to define a strict database-free
publication-candidate contract.

This audit resolves the previously reported C2 ambiguities. It authorizes only
a dormant pure module, its focused test, and its foundation report. It does not
authorize persistence, model changes, transaction-service changes, routes,
controllers, public-query changes, adapter work, or runtime wiring.

## 2. Repository state

Audit baseline:

```text
HEAD: e1d3bae27248c32e9ec763c6c93548f619c74163
Branch: main
Ahead of origin/main: 11 commits
Existing untracked file:
  docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md
Tracked modifications: none
Staged files: none
Active Git operation: none
```

The production acceptance report was not read, modified, or staged.

## 3. Source-of-authority hierarchy

Conflicts are resolved in this order:

1. `FREE_BETA_PUBLISHING_POLICY_CONTRACT.md` and the accepted submission-adapter
   blocker contract define product policy, lifecycle, ownership, and privacy.
2. The accepted Application Destination Contract defines destination syntax,
   normalization, evidence, trust, hashing, and safe errors.
3. Committed canonical Job and `JobPublicationSubmission` schemas define
   existing server types, enums, and immutable snapshot bounds.
4. Canonical Job write boundaries define system-owned fields and structured
   projection isolation.
5. Server employer controllers and pure server sanitizers define current write
   normalization.
6. Employer client validation supplies a stricter existing employer-facing
   limit when the server contracts allow a larger value.
7. When no product maximum exists, the candidate uses an already-established
   repository structural limit. It does not invent a commercial or moderation
   policy.

Rules applied:

- The strictest existing employer-facing bound wins for employer-editable
  fields.
- Committed immutable submission-snapshot bounds win for copied publication
  fields.
- `Number.MAX_SAFE_INTEGER` is the non-product structural ceiling for integer
  counters that have a schema minimum but no product maximum.
- Client coercion, silent slicing, truthiness, and locale-time behavior are not
  copied into the security contract.
- Candidate validation rejects over-limit input instead of truncating it.

## 4. Resolution of previous C2 blockers

| Previous blocker            | Authoritative resolution                                           |
| --------------------------- | ------------------------------------------------------------------ |
| Candidate schema version    | `schemaVersion: 1`                                                 |
| Policy storage              | Store `policyVersion: "free-beta-2026-01"`                         |
| Initial revision            | Major edit starts at revision `1`                                  |
| Correction revision         | Exactly prior revision plus one                                    |
| Approved-base envelope      | Exact five-field server-owned envelope in section 7                |
| Title 200 versus 300        | Choose 200, the stricter current employer UI limit                 |
| Location 200 versus 300     | Choose 200, the stricter current employer UI limit                 |
| Salary 120 versus 200       | Choose 120, the stricter current employer UI limit                 |
| Missing copied-field bounds | Use committed snapshot bounds or existing server structural limits |
| Sanitizer import conflict   | C2 may import the existing pure `stripAllHtml` function            |
| Array count and duplicates  | Exact rules in section 11                                          |
| Null/removal behavior       | Exact matrix in section 12                                         |
| Deadline timezone/boundary  | Canonical UTC instant and injected clock rules in section 13       |
| Destination placement       | Store the exact frozen eleven-field C1 evidence                    |
| Fingerprint bytes           | Binary typed framing in sections 15 and 16                         |
| Comparison result           | Exact bounded result in section 19                                 |
| Candidate errors            | Exact codes and messages in section 21                             |

## 5. Candidate identity

### 5.1 Constants

```text
PUBLICATION_CANDIDATE_SCHEMA_VERSION = 1
PUBLICATION_CANDIDATE_POLICY_VERSION = "free-beta-2026-01"
```

Both values are server constants, stored in every candidate, validated exactly,
and included in the candidate hash.

### 5.2 Candidate kind and revision

Supported candidate kinds:

```text
major_edit
correction
```

Rules:

- A new active-major-edit candidate has `candidateRevision = 1`.
- A correction has
  `candidateRevision = priorCandidate.candidateRevision + 1`.
- Revisions are safe integers from `1` through `Number.MAX_SAFE_INTEGER`.
- A correction at the maximum revision is rejected.
- A replay with the same authoritative inputs returns byte-equivalent candidate
  data and the same hash. It does not increment the revision.
- Kind and revision are stored and hash-bound.

### 5.3 Unsupported construction modes

C2 does not build:

- initial publication candidates;
- renewal candidates;
- repost candidates;
- migration candidates.

Those modes lack an accepted complete-base construction contract. Their
exclusion does not prevent the pure validator from being extended in a later
separately authorized phase.

## 6. Exact top-level candidate schema

Canonical field order:

| Order | Field                        | Type          | Required | Nullable | Bound/source                      | Hash                        |
| ----: | ---------------------------- | ------------- | -------- | -------- | --------------------------------- | --------------------------- |
|     1 | `schemaVersion`              | safe integer  | yes      | no       | exact `1`, server                 | included                    |
|     2 | `policyVersion`              | string        | yes      | no       | exact `free-beta-2026-01`, server | included                    |
|     3 | `candidateKind`              | string enum   | yes      | no       | `major_edit`, `correction`        | included                    |
|     4 | `candidateRevision`          | safe integer  | yes      | no       | `1..MAX_SAFE_INTEGER`             | included                    |
|     5 | `baseApprovedSubmissionId`   | string        | yes      | no       | lowercase 24-hex ObjectId         | included                    |
|     6 | `baseApprovedCandidateHash`  | string        | yes      | no       | lowercase 64-hex SHA-256          | included                    |
|     7 | `basePublicationVersion`     | safe integer  | yes      | no       | `0..MAX_SAFE_INTEGER`             | included                    |
|     8 | `expectedPublicationVersion` | safe integer  | yes      | no       | `0..MAX_SAFE_INTEGER`             | included                    |
|     9 | `previousCandidateHash`      | string        | yes      | yes      | null or lowercase 64-hex          | included                    |
|    10 | `content`                    | strict record | yes      | no       | exact section 8 fields            | included                    |
|    11 | `destinationEvidence`        | strict record | yes      | no       | exact C1 eleven fields            | mode and target digest only |
|    12 | `candidateHash`              | string        | yes      | no       | recomputed lowercase 64-hex       | excluded                    |

Additional top-level keys fail. No `undefined` value is accepted or emitted.

Privacy:

- All top-level identity and hash fields are restricted integrity metadata.
- Content is restricted moderation/publication data.
- Destination target/domain remain restricted destination data.
- No authentication, applicant, payment, private verification, staff-note, or
  request metadata is present.

## 7. Approved-base envelope

### 7.1 Major-edit envelope

The exact input is:

```text
approvedSubmissionId
approvedPublicationVersion
approvedCandidateHash
content
destinationEvidence
```

Types:

- `approvedSubmissionId`: lowercase 24-hex string.
- `approvedPublicationVersion`: safe integer `0..MAX_SAFE_INTEGER`.
- `approvedCandidateHash`: lowercase 64-hex string read from immutable approved
  submission evidence.
- `content`: exact normalized content record from section 8.
- `destinationEvidence`: exact C1 evidence, validated against server-owned
  `{jobId}` when internal.

All five values are server-owned. They must be resolved from the Job's
`lastApprovedSubmissionId` and the corresponding approved immutable
submission. A client cannot supply or override them.

The envelope is validation-only and is not stored as a nested object. It maps
to:

```text
baseApprovedSubmissionId = approvedSubmissionId
baseApprovedCandidateHash = approvedCandidateHash
basePublicationVersion = approvedPublicationVersion
```

The complete content and destination are defensively copied before patching.

### 7.2 Deliberately absent base fields

The envelope does not accept:

- a raw Job;
- an unrestricted submission;
- canonical publication state;
- employer or poster identity;
- plan/payment data;
- moderation data;
- analytics;
- timestamps;
- arbitrary metadata.

There is no separate `approvedCandidateFingerprint` field. The authoritative
fingerprint is named `approvedCandidateHash` to match the accepted
`candidateHash` terminology.

### 7.3 Version relationship

For a major edit:

```text
approvedPublicationVersion == expectedPublicationVersion
```

A mismatch is `MAJOR_EDIT_BASE_CONFLICT`.

For a correction, the original base identity/version is copied from the prior
candidate. `expectedPublicationVersion` is a new server-owned CAS precondition
and may be greater than the original base version.

## 8. Exact content schema

Canonical content-field order:

| Order | Field                     | Type         | Required | Nullable | Bound/enum                    | Source              | Privacy                    |
| ----: | ------------------------- | ------------ | -------- | -------- | ----------------------------- | ------------------- | -------------------------- |
|     1 | `title`                   | string       | yes      | no       | 1..200                        | editable            | public content             |
|     2 | `companyName`             | string       | yes      | no       | 1..300                        | base only           | public identity            |
|     3 | `organizationName`        | string       | yes      | yes      | 1..300 or null                | base only           | public identity            |
|     4 | `description`             | string       | yes      | no       | 20..20000                     | editable            | public content             |
|     5 | `requirements`            | string array | yes      | no       | 0..200, item 1..2000          | editable            | public content             |
|     6 | `responsibilities`        | string array | yes      | no       | 0..200, item 1..2000          | base only           | public content             |
|     7 | `benefits`                | string array | yes      | no       | 0..200, item 1..2000          | base only           | public content             |
|     8 | `skillsRequired`          | string array | yes      | no       | 0..40, item 1..80             | editable            | public content             |
|     9 | `salaryRange`             | string       | yes      | yes      | 1..120 or null                | editable            | public content             |
|    10 | `salaryCurrency`          | string       | yes      | no       | 1..10                         | base only           | public content             |
|    11 | `location`                | string       | yes      | yes      | 1..200 or null                | editable            | public content             |
|    12 | `province`                | string       | yes      | yes      | 1..120 or null                | editable            | public content             |
|    13 | `city`                    | string       | yes      | yes      | 1..120 or null                | editable            | public content             |
|    14 | `category`                | string       | yes      | yes      | 1..120 or null                | editable            | public content             |
|    15 | `employmentType`          | string enum  | yes      | no       | current Job `type` enum       | editable            | public content             |
|    16 | `jobType`                 | string enum  | yes      | no       | current Job enum              | editable            | public content             |
|    17 | `educationRequirement`    | string       | yes      | yes      | 1..1000 or null               | editable            | public content             |
|    18 | `experience`              | string       | yes      | yes      | 1..500 or null                | editable            | public content             |
|    19 | `gender`                  | string       | yes      | yes      | 1..120 or null                | base only           | sensitive public criterion |
|    20 | `workMode`                | string enum  | yes      | no       | `on_site`, `remote`, `hybrid` | server derived/base | public content             |
|    21 | `deadline`                | ISO string   | yes      | yes      | exact canonical UTC or null   | editable            | public timestamp           |
|    22 | `totalSeats`              | safe integer | yes      | yes      | `1..MAX_SAFE_INTEGER` or null | base only           | public content             |
|    23 | `autoCloseWhenFilled`     | boolean      | yes      | no       | exact boolean                 | base only           | public policy              |
|    24 | `applicationInstructions` | string       | yes      | yes      | 1..10000 or null              | base only           | restricted/public content  |
|    25 | `logoUrl`                 | string       | yes      | yes      | 1..2048 or null               | base only           | public media reference     |
|    26 | `gallery`                 | string array | yes      | no       | 0..200, item 1..2048          | base only           | public media references    |

Enums:

```text
employmentType:
  full-time
  part-time
  contract
  internship

jobType:
  Government
  Private
  Internship

workMode:
  on_site
  remote
  hybrid
```

Every content field is hash-bound.

## 9. Job-field classification

| Fields                                                                                                                                                                                   | Classification                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `title`, `description`, `requirements`, `skillsRequired`, `salaryRange`, `location`, `province`, `city`, `category`, `type`, `jobType`, `educationRequirement`, `experience`, `deadline` | `EMPLOYER_EDITABLE_CONTENT`                              |
| `applicationLink`, `applyEmail`                                                                                                                                                          | `EMPLOYER_EDITABLE_DESTINATION` through C1 evidence only |
| `company`, `organization`, `responsibilities`, `benefits`, `salaryCurrency`, `gender`, `totalSeats`, `autoCloseWhenFilled`, `applicationInstructions`, `logoUrl`, `gallery`              | `COPY_FROM_APPROVED_BASE_ONLY`                           |
| normalized `workMode`, candidate versions/kind/revision/base links/hash                                                                                                                  | `SERVER_DERIVED_CANDIDATE_METADATA`                      |
| `isFeatured`, `isSponsored`, `priority`, `urgent`, `boostLevel`, `seoTitle`, `metaDescription`                                                                                           | `ADMIN_CONTROLLED`                                       |
| canonical publication fields including `publicationState`, `publicationVersion`, submission links and publication dates                                                                  | `CANONICAL_PUBLICATION_STATE`                            |
| `planId`, `planType`, `expiresAt`, `paidUntil`                                                                                                                                           | `PAYMENT_CONTROLLED`                                     |
| `views`, `applicationsCount`                                                                                                                                                             | `ANALYTICS_ONLY`                                         |
| `status`, `approvalStatus`                                                                                                                                                               | `LEGACY_ONLY`                                            |
| `_id`, `employerId`, `postedBy`, source/scraper fields, `externalId`, destination trust/ownership overrides                                                                              | `FORBIDDEN`                                              |
| `slug`, translation fields, timestamps, rejection projection, `applyType`, raw remote/hybrid flags                                                                                       | `OUTSIDE_CANDIDATE`                                      |

`slug`, SEO fields, and translations are not candidate fields. Their omission
is intentional and does not authorize later regeneration or copying.

## 10. Bounds conflict table

`—` means no explicit bound at that layer.

| Field                       |    Client | Employer controller | Server validator/helper |    Job schema | Submission snapshot |     Candidate | Reason                                       |
| --------------------------- | --------: | ------------------: | ----------------------: | ------------: | ------------------: | ------------: | -------------------------------------------- |
| title                       |       200 |                trim |         sanitizer 10000 |             — |                 300 |           200 | strictest employer limit                     |
| companyName                 |       200 |         server/base |         sanitizer 10000 |      required |                 300 |           300 | base-only, preserve approved snapshot        |
| organizationName            |         — |         server/base |         sanitizer 10000 |             — |       analogous 300 |           300 | base identity companion                      |
| description                 |     20000 |          strip HTML |         pure strip HTML |             — |               20000 |         20000 | exact agreement                              |
| requirements item/count     |         — |               array |    10000/200 structural |             — |              2000/— |      2000/200 | snapshot item + server structural count      |
| responsibilities item/count |         — |          admin only |    10000/200 structural |             — |              2000/— |      2000/200 | snapshot item + structural count             |
| benefits item/count         |         — |          admin only |    10000/200 structural |             — |      analogous list |      2000/200 | same publication-list contract               |
| skills item/count           |     80/40 |               array |    10000/200 structural |             — |               200/— |         80/40 | strictest employer limit                     |
| salaryRange                 |       120 |                trim |         sanitizer 10000 |             — |                 200 |           120 | strictest employer limit                     |
| salaryCurrency              |         — |          admin/base |         sanitizer 10000 | default `PKR` |                  10 |            10 | snapshot bound                               |
| location                    |       200 |                trim |         sanitizer 10000 |             — |                 300 |           200 | strictest employer limit                     |
| province                    |         — |                trim |         sanitizer 10000 |             — |                 120 |           120 | snapshot bound                               |
| city                        |         — |                trim |         sanitizer 10000 |             — |                 120 |           120 | snapshot bound                               |
| category                    |         — |                trim |         sanitizer 10000 |             — |                 120 |           120 | snapshot bound                               |
| employmentType              |      enum |          assignment |              exact enum |    exact enum |                  80 |          enum | Job enum                                     |
| jobType                     |      enum |          assignment |              exact enum |    exact enum |                  80 |          enum | Job enum                                     |
| educationRequirement        |         — |          assignment |         sanitizer 10000 |             — |                1000 |          1000 | snapshot bound                               |
| experience                  |         — |          assignment |         sanitizer 10000 |             — |                 500 |           500 | snapshot bound                               |
| gender                      |         — |           base only |         sanitizer 10000 |             — |                   — |           120 | existing short classification-field boundary |
| workMode                    |  booleans |           base only |        exact derivation |      booleans |          exact enum |    exact enum | accepted normalized enum                     |
| deadline                    | date form |       Date coercion |       UI current/future |          Date |                Date | canonical ISO | no local timezone                            |
| totalSeats                  |         — |           base only |                       — |         min 1 |               min 1 |   1..MAX_SAFE | safe integer                                 |
| autoCloseWhenFilled         |         — |           base only |           exact boolean |       boolean |                   — |       boolean | schema type                                  |
| applicationInstructions     |         — |           base only |         sanitizer 10000 |             — |                   — |         10000 | existing server sanitizer maximum            |
| logoUrl                     |         — |           base only |         sanitizer 10000 |             — |                   — |          2048 | accepted bounded URL-sized reference         |
| gallery item/count          |         — |          admin only |    10000/200 structural |             — |                   — |      2048/200 | bounded media references                     |
| seoTitle                    |         — |          admin only |         sanitizer 10000 |             — |                   — |      excluded | admin-controlled                             |
| metaDescription             |         — |          admin only |         sanitizer 10000 |             — |                   — |      excluded | admin-controlled                             |

## 11. Normalization and arrays

### 11.1 Text

All accepted strings:

1. must be primitive strings;
2. are Unicode NFC normalized;
3. pass through `stripAllHtml`;
4. normalize `CRLF` and bare `CR` to `LF`;
5. trim surrounding Unicode whitespace;
6. reject NUL, C0 controls other than permitted tab/newline, and DEL;
7. are measured after sanitization and normalization;
8. reject over-limit values without truncation.

Single-line fields reject tabs and newlines. Multiline is allowed only for:

- `description`;
- `applicationInstructions`.

Multiline fields permit LF and tab after line-ending normalization. All other
controls fail. Case is preserved except identifiers/digests, which require
lowercase. Enums require exact case.

An input is rejected if HTML stripping changes a non-empty value into an empty
required value. Sanitized output, not raw input, is hash-bound.

### 11.2 Arrays

| Array            | Max count | Item max | Duplicates | Order     | Empty       | Null   |
| ---------------- | --------: | -------: | ---------- | --------- | ----------- | ------ |
| requirements     |       200 |     2000 | preserved  | preserved | valid/clear | reject |
| responsibilities |       200 |     2000 | preserved  | preserved | valid       | reject |
| benefits         |       200 |     2000 | preserved  | preserved | valid       | reject |
| skillsRequired   |        40 |       80 | preserved  | preserved | valid/clear | reject |
| gallery          |       200 |     2048 | preserved  | preserved | valid       | reject |

Each item uses the single-line text rule. Empty or whitespace-only normalized
items are rejected; they are not silently removed. Arrays are never sorted or
deduplicated. Array count and exact element order are hash-bound.

## 12. Patch and null/removal matrix

The patch is a strict sparse record. Allowed fields:

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
destinationEvidence
```

| Field group                | Absent   | null   | empty string | whitespace string | empty array | zero   | false  |
| -------------------------- | -------- | ------ | ------------ | ----------------- | ----------- | ------ | ------ |
| required title/description | preserve | reject | reject       | reject            | reject      | reject | reject |
| required enums             | preserve | reject | reject       | reject            | reject      | reject | reject |
| nullable text fields       | preserve | clear  | clear        | clear             | reject      | reject | reject |
| requirements/skills arrays | preserve | reject | reject       | reject            | clear       | reject | reject |
| deadline                   | preserve | clear  | clear        | clear             | reject      | reject | reject |
| destinationEvidence        | preserve | reject | reject       | reject            | reject      | reject | reject |

Nullable editable text fields are:

```text
salaryRange
location
province
city
category
educationRequirement
experience
```

No truthiness-based merge is allowed. A present value is interpreted according
to this matrix. Unknown fields fail.

Copied-base-only fields cannot be cleared through a patch.

## 13. Deadline contract

- Patch input: primitive string, null, or an empty/whitespace string used only
  as the explicit clear operation.
- Non-empty input: exact
  `YYYY-MM-DDTHH:mm:ss.sssZ`, uppercase `Z`, exactly 24 characters.
- Date-only input and numeric offsets are rejected.
- Candidate representation: the same canonical primitive ISO UTC string or
  null.
- Server context supplies a valid native `Date` named `evaluatedAt`.
- Validation calls intrinsic Date operations and does not trust overridden
  instance methods.
- A newly supplied non-null deadline must be greater than or equal to
  `evaluatedAt`.
- Equality is valid.
- No extra maximum horizon exists in approved policy.
- A preserved base deadline is revalidated. An already expired deadline cannot
  be used to create a major edit or correction; renewal/repost is outside C2.
- `autoCloseWhenFilled` does not change deadline validation.
- Deadline is fully hash-bound.
- No local machine timezone or locale formatting is used.

## 14. Destination placement

Candidate field:

```text
destinationEvidence
```

Rules:

- Store exactly the eleven C1 evidence fields.
- Do not store raw `applicationLink`, `applyEmail`, `applyType`, `sourceUrl`,
  approval flags, ownership flags, or extra destination metadata.
- Validate evidence with `validateApplicationDestinationEvidence`.
- Internal evidence requires exact server-owned `{jobId}` context.
- External evidence remains `ADMIN_REVIEW_REQUIRED`.
- Deep-copy the validated plain record into a new frozen record.
- Candidate construction never mutates or aliases source evidence.

Candidate hashing includes only:

```text
destinationEvidence.mode
destinationEvidence.targetDigest
```

The target digest already binds C1 schema, mode, and exact normalized target.
The candidate hash excludes:

- normalized target and domain;
- trust classification;
- evidence source;
- `evaluatedAt`;
- policy-validation timestamp;
- classifier actor fields.

Future staff trust decisions do not mutate the submitted C1 evidence and do not
change the candidate hash. A destination mode or target-digest change changes
the candidate hash, is `DESTINATION_CHANGED`, requires renewed validation, and
cannot transfer prior approval.

## 15. Candidate fingerprint byte descriptor

### 15.1 Algorithm

```text
Algorithm: SHA-256
Input bytes: UTF-8 plus binary framing defined below
Output: lowercase 64 hexadecimal characters
Descriptor version: 1
Prefix bytes: ASCII "strideto.publication_candidate", NUL, ASCII "v1", NUL
```

The descriptor is not encryption and does not prove ownership.

### 15.2 Primitive encodings

All lengths and counts are unsigned 32-bit big-endian integers.

```text
NULL:
  0x4e

STRING(value):
  0x53 || U32BE(UTF8(value).length) || UTF8(value)

INTEGER(value):
  0x49 || U32BE(ASCII(decimal(value)).length) || ASCII(decimal(value))

BOOLEAN(false):
  0x42 || 0x00

BOOLEAN(true):
  0x42 || 0x01

ARRAY(values):
  0x41 || U32BE(values.length) || ENCODE(value[0]) || ... || ENCODE(value[n-1])

FIELD(name, value):
  0x46 || U32BE(UTF8(name).length) || UTF8(name) || ENCODE(value)

RECORD(orderedFields):
  0x52 || U32BE(fieldCount) || FIELD(name1, value1) || ... || FIELD(nameN, valueN)
```

Only null, normalized strings, safe integers, booleans, arrays, and exact
ordered records are supported.

### 15.3 Canonical descriptor record

After the prefix, encode one record in this order:

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
destinationIdentity
```

`content` uses the exact 26-field order in section 8.

`destinationIdentity` is:

```text
mode
targetDigest
```

`candidateHash` is never recursively included.

### 15.4 Pseudocode

```text
function candidateHash(candidate):
  descriptor = orderedRecord(
    schemaVersion = candidate.schemaVersion,
    policyVersion = candidate.policyVersion,
    candidateKind = candidate.candidateKind,
    candidateRevision = candidate.candidateRevision,
    baseApprovedSubmissionId = candidate.baseApprovedSubmissionId,
    baseApprovedCandidateHash = candidate.baseApprovedCandidateHash,
    basePublicationVersion = candidate.basePublicationVersion,
    expectedPublicationVersion = candidate.expectedPublicationVersion,
    previousCandidateHash = candidate.previousCandidateHash,
    content = orderedContentRecord(candidate.content),
    destinationIdentity = orderedRecord(
      mode = candidate.destinationEvidence.mode,
      targetDigest = candidate.destinationEvidence.targetDigest
    )
  )

  bytes =
    ASCII("strideto.publication_candidate") ||
    0x00 ||
    ASCII("v1") ||
    0x00 ||
    ENCODE(descriptor)

  return lowercaseHex(SHA256(bytes))
```

Ordinary object `JSON.stringify` is not part of the algorithm.

## 16. Known fingerprint vector

Safe synthetic vector:

```text
schemaVersion: 1
policyVersion: free-beta-2026-01
candidateKind: major_edit
candidateRevision: 1
baseApprovedSubmissionId: 111111111111111111111111
baseApprovedCandidateHash:
  aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
basePublicationVersion: 7
expectedPublicationVersion: 7
previousCandidateHash: null

content:
  title: Engineer
  companyName: Example Employer
  organizationName: null
  description: Build reliable systems.
  requirements: [Relevant degree]
  responsibilities: []
  benefits: []
  skillsRequired: [Node.js]
  salaryRange: null
  salaryCurrency: PKR
  location: Lahore
  province: Punjab
  city: Lahore
  category: Technology
  employmentType: full-time
  jobType: Private
  educationRequirement: Bachelor
  experience: 2 years
  gender: null
  workMode: on_site
  deadline: 2027-01-01T00:00:00.000Z
  totalSeats: null
  autoCloseWhenFilled: true
  applicationInstructions: null
  logoUrl: null
  gallery: []

destinationIdentity:
  mode: internal_platform
  targetDigest:
    c2b68765289729eb2eac3cf25926e9845bd16204eac01471273a20fca000a0b8
```

Expected descriptor byte length:

```text
1271
```

Expected candidate hash:

```text
a77f2fc1f88154efb909988d1651b312a259b315c571bec725d46a461b8979e6
```

The test implementation must reconstruct the bytes independently and assert
this vector. It must not copy a hash produced by the implementation under test.

## 17. Fingerprint coverage

| Candidate field                             | Coverage                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| schemaVersion                               | INCLUDED                                                                |
| policyVersion                               | INCLUDED                                                                |
| candidateKind                               | INCLUDED                                                                |
| candidateRevision                           | INCLUDED                                                                |
| baseApprovedSubmissionId                    | INCLUDED                                                                |
| baseApprovedCandidateHash                   | INCLUDED                                                                |
| basePublicationVersion                      | INCLUDED                                                                |
| expectedPublicationVersion                  | INCLUDED                                                                |
| previousCandidateHash                       | INCLUDED                                                                |
| every content field                         | INCLUDED                                                                |
| destinationEvidence.mode                    | INCLUDED                                                                |
| destinationEvidence.targetDigest            | INCLUDED                                                                |
| destinationEvidence.normalizedTarget        | EXCLUDED: already bound by target digest; avoid duplicate private bytes |
| destinationEvidence.normalizedDomain        | EXCLUDED: already bound by target digest                                |
| destinationEvidence.schemaVersion           | EXCLUDED: target digest binds C1 schema                                 |
| destinationEvidence.trustClassification     | EXCLUDED: staff trust must not rewrite candidate identity               |
| destinationEvidence.evidenceSource          | EXCLUDED: provenance, not target identity                               |
| destinationEvidence.evaluatedAt             | EXCLUDED: volatile                                                      |
| destinationEvidence.validationPolicyVersion | EXCLUDED: C1 validation evidence, separately validated                  |
| destinationEvidence.classifiedByActorType   | EXCLUDED: provenance                                                    |
| destinationEvidence.classifiedByActorId     | EXCLUDED: provenance                                                    |
| candidateHash                               | EXCLUDED: no recursion                                                  |

## 18. Sanitizer decision

Decision:

```text
IMPORT_EXISTING_PURE_SANITIZER
```

Exact file and export:

```text
server/src/utils/htmlSanitize.js
stripAllHtml
```

Findings:

- It imports the already-installed `sanitize-html` dependency.
- It has no database, network, filesystem, environment, logging, timer, or
  registration side effect.
- `stripAllHtml` allows no HTML tags and no attributes.
- It returns a trimmed primitive string.
- Its behavior is deterministic for fixed input and installed dependency
  version.

Future C2 may import `stripAllHtml` in addition to `node:crypto` and the
Application Destination Contract. It must not duplicate sanitization logic or
import the broader controller layer.

The candidate then applies NFC and line-ending normalization after
`stripAllHtml`, ensuring fingerprint stability.

## 19. Comparison contract

Classifications:

```text
UNCHANGED
CONTENT_CHANGED
DESTINATION_CHANGED
BASE_CONFLICT
```

Priority:

1. `BASE_CONFLICT`
2. `DESTINATION_CHANGED`
3. `CONTENT_CHANGED`
4. `UNCHANGED`

Definitions:

- Base conflict: base approved submission/hash/version differs, or expected
  publication version differs.
- Destination changed: mode or target digest differs.
- Content changed: at least one of the 26 normalized content fields differs.
- Unchanged: base/version, destination identity, and content are equal.

Exact frozen result:

```text
classification
candidateEqual
contentChanged
destinationChanged
baseConflict
requiresRenewedDestinationValidation
priorDestinationApprovalTransferAllowed
changedContentFields
```

`changedContentFields` is a frozen array in canonical content-field order,
bounded to 26 safe field names. It contains no values.

`candidateEqual` ignores revision, previous hash, and candidate hash; it answers
whether the submission represents the same base/version/content/destination.

The comparison returns no title, description, target, domain, content,
identifier, or fingerprint.

It does not decide:

- reviewer correction eligibility;
- moderation-cycle validity;
- quota charge/exemption;
- approval/rejection;
- publication/public visibility.

## 20. Correction revision contract

- Source is the exact prior submitted candidate, not current Job content.
- Validate the prior candidate and its hash first.
- Preserve:
  - base approved submission identity;
  - base approved candidate hash;
  - base publication version.
- Set `candidateKind = correction`.
- Set `candidateRevision = prior revision + 1`.
- Set `previousCandidateHash = prior candidateHash`.
- Set `expectedPublicationVersion` from new server-owned CAS context.
- Apply the strict patch to a defensive content copy.
- If destination evidence is absent, copy prior destination evidence.
- If destination mode/digest changes, classify it as
  `DESTINATION_CHANGED`; renewed validation is required and approval cannot
  transfer.
- A no-op correction is rejected as `MAJOR_EDIT_CANDIDATE_INVALID` even though
  a revision change alone would produce another hash.
- The new candidate hash binds revision and predecessor hash.
- The prior candidate and approved base remain unchanged.

Moderation-cycle ID and requested-field paths are not candidate fields. Later
transaction/eligibility logic supplies and validates them. The pure comparison
result supplies only changed field names and destination-change evidence.

## 21. Error contract

| Code                                         | Status | Canonical message                                   | Trigger                                                             |
| -------------------------------------------- | -----: | --------------------------------------------------- | ------------------------------------------------------------------- |
| `PUBLICATION_CANDIDATE_INPUT_INVALID`        |    400 | `The publication candidate input is invalid.`       | malformed strict envelope, patch, or context                        |
| `MAJOR_EDIT_BASE_CONFLICT`                   |    409 | `The approved publication base has changed.`        | approved base/version relationship conflict                         |
| `MAJOR_EDIT_CANDIDATE_INVALID`               |    422 | `The publication candidate content is invalid.`     | invalid normalized content, deadline, revision, or no-op correction |
| `PUBLICATION_CANDIDATE_DESTINATION_INVALID`  |    422 | `The publication candidate destination is invalid.` | missing/misplaced destination evidence before C1 validation         |
| `PUBLICATION_CANDIDATE_FINGERPRINT_CONFLICT` |    409 | `The publication candidate integrity check failed.` | stored/provided hash differs from recomputation                     |
| `PUBLICATION_CANDIDATE_COMPARISON_INVALID`   |    422 | `The publication candidates cannot be compared.`    | invalid comparison envelope/candidate                               |

Accepted C1 errors are propagated unchanged after the C2 destination envelope
has passed:

```text
DESTINATION_MODE_INVALID
DESTINATION_OWNERSHIP_UNVERIFIED
DESTINATION_EVIDENCE_CONFLICT
DESTINATION_CHANGED_BEYOND_CORRECTION_SCOPE
```

Errors:

- accept no caller message/details;
- canonicalize unsupported constructor codes to
  `PUBLICATION_CANDIDATE_INPUT_INVALID`;
- are frozen;
- serialize to a new frozen `{status, code, message}` record;
- never serialize stack, cause, candidate content, destination, IDs, hashes,
  patch values, parser errors, or sanitizer internals.

## 22. Future public API

Exact exports:

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

buildMajorEditPublicationCandidate(
  { approvedBase, patch },
  { jobId, expectedPublicationVersion, evaluatedAt }
)

buildPublicationCandidateCorrection(
  { priorCandidate, patch },
  { jobId, expectedPublicationVersion, evaluatedAt }
)

validatePublicationCandidate(
  candidate,
  { jobId }
)

comparePublicationCandidates(
  previousCandidate,
  nextCandidate,
  {
    previousValidationContext: { jobId },
    nextValidationContext: { jobId }
  }
)
```

All entrypoints require exact ordinary plain records. No Mongoose document,
class instance, accessor, symbol, hidden property, unusual prototype, request
object, or extra key is accepted.

Validation returns a defensively isolated frozen candidate. Builders return a
new deeply frozen candidate. Comparison returns the exact bounded result in
section 19.

## 23. Future implementation allowlist

### CREATE

```text
server/src/services/publishing/contracts/PublicationCandidateContract.js
server/src/__tests__/publicationCandidateContract.test.js
docs/FREE_BETA_PUBLICATION_CANDIDATE_CONTRACT_FOUNDATION_REPORT.md
```

### MODIFY

```text
None
```

### INSPECT_ONLY

```text
server/src/services/publishing/contracts/ApplicationDestinationContract.js
server/src/utils/htmlSanitize.js
server/src/config/freeBetaPublishingPolicy.js
server/src/models/Job.js
server/src/models/JobPublicationSubmission.js
server/src/models/JobModerationEvent.js
server/src/services/jobWriteBoundary.js
server/src/services/publishing/TransactionalFreeBetaSubmissionService.js
server/src/services/publishing/ReviewerCorrectionEligibility.js
server/src/services/publishing/EmployerSubmissionEligibility.js
server/src/controllers/employerController.js
server/src/controllers/admin/adminJobsController.js
client/src/pages/Employer/employerPostJobValidation.js
```

### FORBIDDEN

```text
All existing files
All models and schemas
Transaction service
Controllers and routes
Workers, schedulers, startup and middleware
Public queries and renderers
Payment and webhook code
Frontend code
Configuration, dependencies and deployment
Migrations, indexes, seeds, backfills and remediation
Mongoose adapter and runtime composition
```

## 24. Required implementation tests

The future focused suite must cover every test category from the C2 phase
request and additionally:

- exact 12-field top-level inventory;
- exact 26-field content inventory;
- major revision starts at one;
- correction revision and predecessor hash;
- revision overflow;
- approved-base/current-version equality for major edits;
- strictest resolved bounds;
- HTML stripping through the imported pure sanitizer;
- NFC and line-ending normalization;
- duplicate array preservation and order sensitivity;
- explicit null/removal matrix;
- canonical UTC deadline and injected-clock boundary;
- exact binary framing and independent known vector;
- destination timestamp/trust exclusion from candidate hash;
- destination mode/digest inclusion;
- no-op correction rejection;
- comparison priority and privacy;
- nested C1 error propagation;
- no runtime import or database/network side effect.

The test must independently reproduce the section 16 vector bytes rather than
calling the candidate's internal encoder to calculate the expected value.

## 25. Readiness matrix

| Requirement                  | Result         |
| ---------------------------- | -------------- |
| Schema version               | READY          |
| Policy version               | READY          |
| Revision rules               | READY          |
| Supported construction modes | READY          |
| Approved-base envelope       | READY          |
| Candidate field inventory    | READY          |
| Bounds                       | READY          |
| Sanitizer boundary           | READY          |
| Arrays                       | READY          |
| Null/removal matrix          | READY          |
| Deadline                     | READY          |
| Destination placement        | READY          |
| Fingerprint bytes            | READY          |
| Known vector                 | READY          |
| Comparison                   | READY          |
| Correction semantics         | READY          |
| Errors                       | READY          |
| Future API                   | READY          |
| Pure C2 implementation       | READY          |
| Model integration            | NOT AUTHORIZED |
| Transaction integration      | NOT AUTHORIZED |
| Adapter/runtime              | NOT AUTHORIZED |

## 26. Remaining runtime blockers

Pure-contract readiness does not resolve:

- candidate persistence in `JobPublicationSubmission`;
- moderation-event candidate evidence;
- transaction-service candidate input and stable IDs;
- canonical Job compare-and-set integration;
- active-major-edit controller boundary;
- public pending-review visibility;
- staff destination approval/rejection/revocation;
- operation context and unknown-commit reconciliation;
- Mongoose adapter;
- replica-set proof;
- production topology and index rollout.

The current approved-submission schema does not yet store the strict approved
base envelope required here. That is a later schema phase and prevents runtime
use, but does not prevent the database-free C2 contract implementation.

## 27. Preservation statement

This audit created one documentation file only.

- Existing tracked files changed: No
- Existing models changed: No
- Transaction service changed: No
- Application Destination Contract changed: No
- C2 implementation started: No
- Database or network operation performed: No
- Production data read or written: No
- Migration or index operation performed: No
- File staged: No
- Commit, push, or deployment performed: No
- Mongoose adapter started: No
- Runtime wiring started: No

The Strideto architecture, authentication realms, RBAC, ownership, security,
privacy, current public behavior, frontend, configuration, deployment, Git
history, and production data remain unchanged.
