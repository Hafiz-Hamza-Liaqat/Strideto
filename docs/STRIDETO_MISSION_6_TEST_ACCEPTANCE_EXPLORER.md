# Strideto Mission 6 — Test Acceptance Explorer

> **Status:** Implemented (source-complete, not deployed).
> **Scope:** Canonical acceptance record model, scope hierarchy, deterministic
> precedence resolution, status semantics, score requirements, effective dates,
> provenance integration (Mission 5), conflict detection, test→destination
> search, reverse destination→tests search, comparison view, profile/score
> utility boundary, Admin management, public UX extension to Test Hub.
> **Authority:** Subordinate to frozen product spec, execution roadmap,
> engineering guardrails, trust/verification policy, and Employer Release
> Baseline. Preserves Missions 0–5 unchanged.

---

## 0. Purpose & principle

Mission 6 builds the **Test Acceptance Explorer** — the system that answers
both directions:

1. **Forward:** "Where is IELTS / TOEFL / PTE / DET / SAT etc. accepted?"
2. **Reverse:** "What tests does University/Program X accept?"

And, where source-backed:

- minimum overall score
- minimum section scores
- conditions / conditional acceptance
- intake / effective period
- degree/program applicability
- scope (country / institution / program / program intake)
- official source and freshness

**No personalized test recommendation is built here.** That belongs to Mission 8.
**No live acceptance data is seeded.** Synthetic fixtures only.

---

## 1. Acceptance Record — `server/src/models/education/TestAcceptance.js`

One MongoDB document per acceptance claim at any point in time.
When a published claim changes, the old record is marked superseded (not deleted)
and a new record is created.

| Field | Type | Notes |
|---|---|---|
| `testId` | ObjectId → Test, required | The test being accepted |
| `institutionId` | ObjectId → CanonicalInstitution, optional | Null = country scope |
| `programId` | ObjectId → Program, optional | Null = institution scope |
| `countryCode` | String, ISO 3166-1 alpha-2 | Required for country scope |
| `acceptanceStatus` | `ACCEPTANCE_STATUSES` enum, required | See §2 |
| `acceptanceScope` | `ACCEPTANCE_SCOPES` enum, required | See §4 |
| `minimumOverallScore` | Number, optional | null = no numeric minimum |
| `sectionMinimums` | `[{sectionName, minimum, scale}]` | Per-section requirements |
| `scoreNotes` | String | Conditions on the score requirement |
| `degreeLevels` | `DEGREE_LEVELS[]` | Applicable degree levels |
| `studyModes` | `STUDY_MODES[]` | Applicable study modes |
| `intake` | String | e.g. "September 2025", "Fall 2026" |
| `effectiveFrom` | Date | Requirement effective start |
| `effectiveUntil` | Date | Requirement effective end |
| `conditions` | String | Conditions for conditional acceptance |
| `waiverNotes` | String | Waiver or exception notes |
| `sources` | evidenceSubSchema[] | Embedded Mission 1 evidence |
| `sourceIds` | ObjectId[] → CanonicalSource | Mission 5 deep provenance links |
| `verificationStatus` | `VERIFICATION_STATUSES` enum | Mission 5 lifecycle |
| `freshnessState` | `FRESHNESS_STATES` enum | Mission 5 derived freshness |
| `lastVerifiedAt` | Date | Last content verification date |
| `nextReviewAt` | Date | Scheduled freshness review |
| `status` | `PUB_STATUSES` | draft / published / archived |
| `supersededById` | ObjectId → TestAcceptance | Pointer to replacement (if superseded) |
| `adminNotes` | String | **Internal only — never project publicly** |
| timestamps | | `createdAt`, `updatedAt` |

---

## 2. Acceptance Status

Explicit semantics. Never use a boolean.

| Status | Meaning |
|---|---|
| `accepted` | Test is accepted as evidence of the stated requirement |
| `conditional` | Accepted subject to additional conditions (see `conditions` field) |
| `not_accepted` | Test is explicitly not accepted for this scope |
| `case_by_case` | Acceptance varies; contact the institution |
| `unknown` | No confirmed information available |

**Critical:** `unknown` must NEVER be presented as `not_accepted` in any UI.

---

## 3. Score Requirements

- `minimumOverallScore`: overall band/score minimum. `null` = no numeric minimum.
- `sectionMinimums`: array of `{sectionName, minimum, scale}`. Section names are
  test-specific (e.g. "Listening" for IELTS, "Reading" for TOEFL iBT, "Literacy"
  for DET). No enforced section naming enum — test-specific structure is preserved.
- `scoreNotes`: free-text notes (e.g. "Academic module only", "IBT not PBT").

Different requirements by program/intake are handled by creating separate
`TestAcceptance` records at the appropriate scope.

---

## 4. Scope Hierarchy & Precedence

`ACCEPTANCE_SCOPES` define the granularity of a claim:

| Scope | Description |
|---|---|
| `country` | General country-level guidance |
| `institution` | Institution-specific policy |
| `program` | Program-specific requirement |
| `program_intake` | Program + intake-specific requirement |

**Deterministic precedence (higher number wins):**

```
program_intake (4)  >  program (3)  >  institution (2)  >  country (1)
```

`resolvePrecedence(claims)` returns the highest-precedence claim from a list.

**Critical truthfulness rules:**
- Institution-level acceptance ≠ every program accepts it.
- Program-specific requirements override broader institution-level guidance.
- When a broader claim is surfaced as fallback, `fallbackScopeLabel(scope)` returns
  the required UX truthfulness label:
  - Institution fallback: "Institution-level guidance — verify program-specific requirements"
  - Country fallback: "Country-level guidance — verify institution and program-specific requirements"

---

## 5. Effective Dates / Intakes

- `effectiveFrom` / `effectiveUntil`: date window for the requirement.
- `intake`: string label for the intake period (e.g. "September 2025", "Fall 2026").
  Used for `program_intake` scope disambiguation.
- When a requirement changes, the old record is superseded (not overwritten).
  `supersededById` points to the replacement record.

---

## 6. Source / Provenance — Mandatory

Mission 5 integration:

- Published claims must have ≥1 source (`sources[]` not empty).
- `verificationStatus` follows the Mission 5 lifecycle.
- `freshnessState` is derived via Mission 5 `deriveFreshness()`.
- Broken source → `freshnessState: 'broken'` but claim data is NOT erased.
- `adminNotes` is never projected to public endpoints.
- Public UX exposes: source label, source URL (where official), last verified,
  freshness state, scope.
- Stale / review-due data shows a truthful warning.

---

## 7. Test → Destinations Search

**`GET /api/tests/:slug/acceptance`**

Returns published acceptance claims for a given test.

Filters: `country`, `institutionId`, `programId`, `acceptanceStatus`, `scope`,
`degreeLevel`. Bounded pagination: `page`, `limit`.

Response includes: `testId`, `testSlug`, `testName`, `data[]`, `total`, `page`,
`limit`, `pages`.

Each item in `data[]` is a `projectPublicAcceptance()` projection (adminNotes excluded),
with populated `institutionId` (name, slug) and `programId` (name, slug).

---

## 8. Reverse Search — Destination → Tests

**Institution → tests:**
`GET /api/education/institutions/:slug/acceptance`

Returns all published acceptance claims where `institutionId` matches.
Filters: `acceptanceStatus`, `degreeLevel`.

Add `?compare=1` to receive results grouped by test (comparison view):
```json
{
  "comparison": [
    { "test": { "name": "IELTS", ... }, "claims": [ ... ] },
    { "test": { "name": "TOEFL", ... }, "claims": [ ... ] }
  ]
}
```

**Program → tests:**
`GET /api/education/programs/:slug/acceptance`

Returns program-specific published claims.
If no program-specific claims exist, falls back to institution-level claims
with a truthful fallback label:
```json
{
  "data": [],
  "fallback": {
    "label": "Institution-level guidance — verify program-specific requirements",
    "scope": "institution",
    "data": [ ... ],
    "total": 3
  }
}
```

**Important:** Fallback is always clearly labeled. The fallback scope is never
silently promoted to a program-specific fact.

---

## 9. Comparison View

`GET /api/education/institutions/:slug/acceptance?compare=1`

Groups all accepted tests side by side for a destination:

```json
{
  "comparison": [
    {
      "test": { "name": "IELTS", "scoreScale": "0–9 band" },
      "claims": [{ "acceptanceStatus": "accepted", "minimumOverallScore": 6.5, ... }]
    },
    {
      "test": { "name": "TOEFL iBT", "scoreScale": "0–120" },
      "claims": [{ "acceptanceStatus": "accepted", "minimumOverallScore": 90, ... }]
    }
  ]
}
```

This is factual comparison only. No "best test for you" recommendation.
Personalized recommendation → Mission 8.

---

## 10. Profile / Score Utility Boundary

`structuralScoreCheck(userScore, requirement)` in `shared/education/acceptanceExplorer.js`:

- Accepts `{ overall: number, sections: Record<string, number> }` and
  `{ minimumOverallScore: number|null, sectionMinimums: [{sectionName, minimum}] }`.
- Returns `{ satisfies: boolean, reason: string }`.
- Deterministic. No AI. No recommendations.
- Mission 3 profile systems may call this to answer "does this score structurally
  satisfy this requirement?" as a read-only utility.
- Full eligibility/matching is Mission 8.

---

## 11. Admin Management

All under `/api/admin/education/acceptance` (requires Auth + Staff).

| Method | Path | Action |
|---|---|---|
| GET | `/api/admin/education/acceptance` | List all claims (all statuses). Filters: `status`, `testId`, `institutionId`, `programId`, `countryCode`, `acceptanceStatus`, `scope`, `verificationStatus` |
| GET | `/api/admin/education/acceptance/:id` | Get single claim |
| POST | `/api/admin/education/acceptance` | Create claim (draft by default) |
| PATCH | `/api/admin/education/acceptance/:id` | Update claim (includes draft → published transition) |
| POST | `/api/admin/education/acceptance/:id/supersede` | Create replacement claim; marks old as superseded |

**Publishing rules:**
- Status `'published'` requires ≥1 valid source.
- Conflict detection runs before publishing: `accepted` + `not_accepted` for the
  same scope slot is blocked (HTTP 409).
- Admin can force `case_by_case` or `unknown` alongside accepted — these are not
  contradictions.

**Supersession:**
- `POST /:id/supersede` creates a new `draft` claim and marks the original as
  `status: 'archived'` with `supersededById = newClaim._id`.
- Old record is never deleted — history is preserved for audit.

**Authorization:** `requireAuth + requireStaff` is enforced by the parent
`adminRouter` middleware (mounted in `server/src/routes/admin.js`). Normal users
cannot read, create, or mutate acceptance claims.

---

## 12. Conflict Detection

`detectConflict(existingPublished, proposed, excludeId?)`:

Two published claims conflict when:
1. Same `testId`
2. Same `acceptanceScope`
3. Same scope entity (`institutionId`, `programId`, `countryCode`, `intake`)
4. One is `accepted`, the other is `not_accepted`

`unknown`, `conditional`, and `case_by_case` are not contradictions and coexist.

`excludeId` allows updating a record without it conflicting with its own prior state.

---

## 13. Fallback / Inheritance

Resolution priority:
```
program_intake  → program  → institution  → country
```

`resolvePrecedence(claims)` returns the winning claim.

When showing a fallback, the public API includes a `fallback` envelope with
a `label` that prevents users from mistaking general guidance for a program fact.

The public UI must display the fallback label and scope. A country-level claim
must never be silently presented as a program-specific requirement.

---

## 14. Public UX

### Test Detail — "Where is this test accepted?"

`/tests/:slug` (TestDetail.jsx) fetches `GET /api/tests/:slug/acceptance?limit=10`
and renders an acceptance section below resources. Each `AcceptanceCard` displays:

- Acceptance status badge (color-coded)
- Scope badge (Country / Institution / Program / Program intake)
- Intake label (if applicable)
- Institution or program name
- Minimum overall score (if set)
- Section minimums (if set)
- Conditions (if conditional)
- Last verified date + freshness state (color-coded)
- Source link (if available) or "Unverified — no source on file" warning

### Institution page — "Accepted tests"

`GET /api/education/institutions/:slug/acceptance` for the institution detail view.
Groups by test for comparison using `?compare=1`.

### Program page — "Test requirements"

`GET /api/education/programs/:slug/acceptance` for the program detail view.
Falls back to institution-level claims with explicit labeling.

All surfaces are responsive/mobile-safe and use the existing i18n system.

---

## 15. No Live Acceptance Data Seeded

No real-world acceptance claims were added:

- No "University X accepts DET with score 120" fabricated
- No internet browsing or scraping
- No live DB mutations

Synthetic fixture data can be added via:
1. `server/src/seed/acceptanceFixtures.js` (dry-runnable)
2. Admin CRUD interface

---

## 16. What Mission 8 Personalization Will Add

Mission 6 builds the factual layer. Mission 8 will add:

- Full eligibility scoring: comparing user profile to acceptance requirements
- Gap analysis: "you need 0.5 more on IELTS Writing"
- Personalized recommendation: "IELTS is the best test for your target programs"
- Matching: surfacing programs/institutions that accept the user's existing scores

`structuralScoreCheck()` is the Mission 6 boundary that Mission 8 will build on.

---

## 17. File Inventory

### New

```
shared/education/acceptanceExplorer.js          — acceptance contract, validators, precedence, conflict, score check, public projection
server/src/models/education/TestAcceptance.js   — Mongoose acceptance record model
server/src/controllers/education/testAcceptanceController.js   — public endpoints
server/src/controllers/education/adminAcceptanceController.js  — admin CRUD
server/src/__tests__/testAcceptanceExplorer.test.js            — 40 pure-contract assertions
docs/STRIDETO_MISSION_6_TEST_ACCEPTANCE_EXPLORER.md
```

### Modified

```
shared/education/index.js                        — re-exports acceptanceExplorer
server/src/routes/tests.js                       — adds acceptance + program routes
server/src/routes/adminEducation.js              — adds acceptance admin routes
client/src/services/listingsService.js           — adds acceptance + program API methods
client/src/pages/Tests/TestDetail.jsx            — adds acceptance section + AcceptanceCard
```

### Unchanged

```
server/src/models/education/Test.js              — preserved
server/src/models/education/Program.js           — preserved
server/src/models/education/CanonicalInstitution.js — preserved
server/src/controllers/education/testController.js  — preserved
server/src/controllers/education/adminEducationController.js — preserved
All Mission 0–5 files                            — preserved
```

---

## 18. Tests

Test file: `server/src/__tests__/testAcceptanceExplorer.test.js`

Run: `node src/__tests__/testAcceptanceExplorer.test.js`

40 pure-contract assertions covering all 30 required behavioral proofs plus
additional edge cases:

1. acceptance record validation (statuses + scopes)
2. accepted vs conditional vs not_accepted vs unknown
3. institution-level scope
4. program-level scope
5. program overrides institution (precedence)
6. program+intake overrides program
7. broader fallback correctly labeled
8. unknown ≠ not accepted
9. overall score requirement
10. section score requirements
11. test-specific score structure preserved
12. effective date applicability
13. historical/superseded record preserved
14. source/provenance required for published claim (Mission 5 integration)
15. stale/review_due public projection
16. broken source does not delete claim
17. drafts hidden publicly
18. test → institution search (scope key)
19. test → program search (scope key)
20. reverse institution → tests
21. reverse program → tests
22. filters/pagination contract
23. contradictory active claims detected (4 assertions: conflict, non-conflict, different entities, excludeId)
24. admin authorization route contract
25. normal user cannot mutate acceptance
26. deterministic structural score check
27. no cross-entity reference corruption
28. Mission 4 Test Hub regression
29. Mission 5 provenance regression
30. Mission 6 module does not pollute taxonomy namespace
+ adminNotes exclusion, resolvePrecedence edge cases, SCOPE_PRECEDENCE ordering

Mission 4 regression: 41/41 green.
Mission 5 regression: 51/51 green.
Frontend build: passes (0 errors).

---

## 19. Live Acceptance Data Seeded

**None.** All acceptance data must flow through Admin CRUD with source-backed
verification before publishing.

## 20. Live Migrations / Backfills

**None.** `TestAcceptance` collection is created empty by MongoDB on first write.
All schema changes are additive.
