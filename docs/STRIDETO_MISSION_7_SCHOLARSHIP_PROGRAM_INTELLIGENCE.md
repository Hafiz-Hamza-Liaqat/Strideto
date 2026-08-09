# Strideto Mission 7 — Scholarship + Program Intelligence

## Architecture

Mission 7 adds structured, source-backed scholarship and program intelligence
on top of the existing Mission 4–6 education stack. It does not replace or
duplicate the legacy `Scholarship` / `IntlScholarship` CMS models.

All new models follow the Mission 1 Money contract, Mission 5 provenance/freshness
contracts, and Mission 6 publication lifecycle (`draft` / `published` / `archived`).

---

## A. Scholarship Intelligence

### Models

#### `CanonicalScholarship`
- `slug` (unique), `title`, `provider` (name + providerType)
- `scholarshipType` — government / institutional / private / international\_org / bilateral / fellowship / other
- `destinationCountries` — ISO 3166-1 alpha-2 array; `['*']` = global
- `degreeLevels`, `fields`, `studyModes` (taxonomy values)
- **Funding** — `{ type, amountMinor, currency, components[], notes }`
  - `type` — full / partial / fixed\_amount / component\_based / unknown
  - `amountMinor` + `currency` — Mission 1 Money contract (integer minor units)
  - `components` — per-component breakdown (tuition / stipend / accommodation / travel / insurance / books\_materials / research\_allowance / other)
- **Criteria** — array of `{ criteriaType, value, gradingContext, notes }`
  - Mission 7 stores factual criteria. Mission 8 evaluates user against them.
- `applicationMethod`, `applicationUrl`, `summary`
- `status`, Mission 5 provenance/freshness fields
- `adminNotes` — server-only, never projected publicly

#### `ScholarshipCycle`
- `scholarshipId`, `cycleLabel`, `academicYear`, `intake`
- `applicationOpenAt`, `deadlineAt` — null means unknown; dates not invented
- `timezone` — IANA string when source-backed
- `effectiveFrom`, `effectiveTo`
- `cycleStatus` (open / upcoming / closed / unknown) — derivable from dates
- `isHistorical` — historical cycles preserved, never deleted
- Mission 5 provenance/freshness

#### `ScholarshipApplicability`
- Separate relation model (avoids large embedded arrays)
- `scholarshipId`, `scope` (country / institution / program / degree\_level / field)
- `countryCode`, `institutionId`, `programId`, `degreeLevel`, `field`

### Shared Contract: `shared/education/scholarshipIntelligence.js`
- Enum constants: SCHOLARSHIP\_TYPES, PROVIDER\_TYPES, FUNDING\_TYPES, FUNDING\_COMPONENTS, APPLICATION\_METHODS, CRITERIA\_TYPES, CYCLE\_STATUSES, PROGRAM\_REQUIREMENT\_TYPES, REQUIREMENT\_SEMANTICS, APPLICABILITY\_SCOPES
- Validators: `isValid*` for each enum
- `deriveCycleStatus(cycle, ref)` — deterministic, no fabrication
- `containsForbiddenGuarantee(text)` — truthfulness boundary
- `containsNoTestRequired(text)` — unsafe claim detection
- `fundingTypeLabel(type)` — display helper
- `projectPublicScholarship(doc)` — strips adminNotes
- `projectPublicProgramRequirement(doc)` — strips adminNotes
- `scholarshipComparisonFacts(s)` — bounded factual comparison (no eligibility fields)
- `programComparisonFacts(p, reqs)` — bounded factual comparison

---

## B. Program Intelligence (Extensions)

### Extended `Program` model (Mission 4 base, Mission 7 additions)
Added to existing Program schema without breaking Mission 4/6 contracts:
- `country` — ISO 3166-1 alpha-2 (queryable)
- `intakes[]` — `{ cycleLabel, applicationOpenAt, deadlineAt, notes }`
- `tuition` — `{ amountMinor, currency, per, notes }` (Mission 1 Money)
- `admissionRequirementsUrl`
- `sourceIds`, `verificationStatus`, `freshnessState`, `lastVerifiedAt`, `nextReviewAt`

### New Model: `ProgramRequirement`
- `programId`, `requirementType` (academic / language\_test / standardized\_test / prerequisite\_subject / experience / portfolio / document / other)
- `semantics` — required / optional / conditional
- `conditionNote` — used when semantics = conditional
- `testId` (ref Test) — for language/standardized test types; full acceptance terms remain in Mission 6 TestAcceptance (not duplicated)
- `minimumScore`, `sectionMinimums[]`
- `subjectName`, `documentName`, `description`
- `intake`, `effectiveFrom`, `effectiveTo`
- Mission 5 provenance/freshness
- `adminNotes` — never projected publicly

---

## C. Mission 5 + Mission 6 Reuse

- **Mission 5**: All new models reuse `VERIFICATION_STATUSES`, `FRESHNESS_STATES`, `CanonicalSource` refs, and the `evidenceSubSchema` (Mission 1) pattern.
- **Mission 6**: `TestAcceptance` records are resolved on program detail — not copied into `ProgramRequirement`. The program detail endpoint returns `acceptedTests` from `TestAcceptance`. Scope vocabulary (`ACCEPTANCE_SCOPES`) is consistent with `APPLICABILITY_SCOPES`.

---

## D. Public API Surfaces

### Scholarship Explorer
- `GET /api/education/scholarships` — filter: country, degree, field, scholarshipType, fundingType, applicationMethod, providerType. Paginated (max 50/page).
- `GET /api/education/scholarships/:slug` — detail with cycles, applicability, freshness warning.
- `GET /api/education/scholarships/compare?slugs=a,b,c` — factual comparison of ≤3 scholarships. No eligibility/ranking.

### Program Explorer
- `GET /api/education/programs` — filter: country, institutionId, degree, field, studyMode. Paginated.
- `GET /api/education/programs/:slug` — detail with requirements, accepted tests (Mission 6), related scholarships, freshness warning.
- `GET /api/education/programs/compare?slugs=a,b,c` — factual comparison of ≤3 programs.

---

## E. Admin Surfaces

All admin routes are under the existing `/api/admin/education/` prefix and require `isStaffRole`.

- Scholarships: list / get / create / update (draft→publish→archive)
- Cycles: list / create / update per scholarship
- Applicability: list / create / update per scholarship
- Program requirements: list / create / update per program
- Program intelligence update: `PATCH /admin/education/programs/:id/intelligence` (Mission 7 fields)

### Authorization
- `requireAdmin(req, res)` guard checks `isStaffRole(req.user.role)` before every operation.
- Normal users cannot mutate scholarship/program intelligence records.

### Source requirement
- Published scholarships, cycles, and requirements require ≥1 valid source (`strict=true`).
- Draft records accept empty sources.

### Audit
- `scholarship.publish`, `scholarship.archive`, `cycle.publish`, `programRequirement.publish`, `program.publish` actions logged via `AuditLog`.

---

## F. Truthfulness Policy

- `containsForbiddenGuarantee()` rejects summaries/titles containing guarantee language.
- `containsNoTestRequired()` flags "No IELTS required" style claims that need source backing.
- Stale/broken-source records return `freshnessWarning` in public API responses.
- Public UI displays truthfulness disclaimer on all scholarship and program pages.
- Comparison endpoints never return eligibility, match score, or ranking fields.

---

## G. Client Pages

- `/scholarship-intelligence` — `ScholarshipIntelligence.jsx` (browse/filter/paginate)
- `/scholarship-intelligence/:slug` — `ScholarshipIntelligenceDetail.jsx`
- `/program-explorer` — `ProgramExplorerList.jsx`
- `/program-explorer/:slug` — `ProgramExplorerDetail.jsx` (with requirements, accepted tests, related scholarships, source/freshness)

Routes registered in `client/src/routes/index.jsx` via `ROUTES.CANONICAL_SCHOLARSHIPS` and `ROUTES.PROGRAM_EXPLORER`.

API service: `canonicalScholarshipsApi` and `programIntelligenceApi` in `listingsService.js`.

---

## H. Tests

**Mission 7 tests**: `server/src/__tests__/scholarshipProgramIntelligence.test.js` — 60 assertions, 0 failures.

Coverage: scholarship/funding validation · Money/currency contract · cycle status derivation · unknown deadline semantics · criteria types · program requirement types + semantics · applicability scopes · truthfulness boundary · adminNotes exclusion · comparison facts structure · source requirement signal · draft/publish status · freshness/broken-source semantics · Mission 6 TestAcceptance reuse · no personalized eligibility output · filter dimension coverage · guarantee-language boundary.

**Mission 6 regression**: 40/40 passing.

**Frontend build**: clean (`✓ built in 9.65s`).

---

## I. Data Policy

- No web browsing, scraping, or live data seeding.
- No fabricated real-world scholarship/university facts.
- No live DB migrations or backfills.
- Architecture is global/international; no hardcoded country/currency.
- Synthetic fixtures only for tests.

---

## J. Mission 8 Boundary

The following is explicitly deferred to Mission 8:

- Personal eligibility evaluation (user profile vs. criteria)
- Match scoring / recommendation ranking
- Gap analysis
- Next Best Action
- Personalized deadline alerts (Mission 9)

Mission 7 stores factual criteria. Mission 8 evaluates a user against them.

---

## Preserved

- All Missions 1–6 baselines
- Legacy `Scholarship` / `IntlScholarship` CMS models (untouched)
- Worker process
- Historical untracked audit documents
