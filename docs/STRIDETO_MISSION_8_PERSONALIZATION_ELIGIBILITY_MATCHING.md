# Strideto Mission 8 — Personalization / Eligibility / Matching

> **Status:** Implemented (source-complete, not deployed).  
> **Scope:** Deterministic eligibility engine, explainable match scoring, gap analysis,
> recommendation APIs, profile-aware test guidance, authenticated UX.  
> **Authority:** Subordinate to frozen product spec, execution roadmap, engineering
> guardrails. Preserves Missions 0–7 unchanged.

---

## 0. Purpose & principles

Mission 8 answers:

- What opportunities broadly match me?
- Why does this match?
- What requirements do I satisfy?
- What am I missing?
- Is information insufficient?
- Which programs/scholarships deserve closer review?

**No AI/LLM decisions.** No fabricated scores. No admission guarantees.
No scholarship probability claims. All evaluation is deterministic and explainable.

---

## 1. Eligibility result contract

**Location:** `shared/education/eligibilityEngine.js`

### 1.1 Eligibility states

| State | Meaning |
|---|---|
| `eligible` | All evaluated required criteria pass |
| `potentially_eligible` | Some required criteria have missing profile data |
| `not_eligible` | At least one required criterion fails |
| `insufficient_information` | Required criteria are unknown — cannot evaluate |
| `requires_manual_review` | At least one required criterion needs manual review |

**Rule:** Unknown information does NOT automatically mean `not_eligible`.

### 1.2 Criterion states

| State | Meaning |
|---|---|
| `pass` | Criterion met |
| `fail` | Criterion not met |
| `unknown` | Criterion present but cannot evaluate |
| `manual_review` | Requires human verification |
| `missing_profile_data` | Profile lacks needed information |

### 1.3 Result shape

Every `buildEligibilityResult()` call returns:

```js
{
  overallState,            // ELIGIBILITY_STATES value
  evaluatedCriteria,       // all criterion results
  passedCriteria,          // state === 'pass'
  failedCriteria,          // state === 'fail'
  unknownCriteria,         // state in [unknown, missing_profile_data]
  manualCriteria,          // state === 'manual_review'
  opportunityId,
  opportunityType,
  opportunityTitle,
  evaluatedAt,             // ISO timestamp
  profileDataUsed,         // snapshot of fields used
  freshnessWarnings,       // from provenance/freshness data
}
```

---

## 2. Criteria evaluators

**Location:** `shared/education/eligibilityEngine.js` (pure, isomorphic)

| Evaluator | Input | Notes |
|---|---|---|
| `evaluateNationalityResidence` | profile nationality/country, criteria value (ISO codes or `*`) | `*` = global pass |
| `evaluateDegreeLevel` | profile goal qualification levels, required degree levels | Uses `QUAL_TO_DEGREE_MAP` for cross-vocabulary mapping |
| `evaluateAcademicThreshold` | profile education records, required grading system + minimum | Grading policy §3 |
| `evaluateTestRequirement` | profile exam scores, resolved test type, requirement, acceptance claim | Reuses Mission 6 logic |
| `evaluateExperience` | profile experience, criteria value | Quantifiable → calculate; non-quantifiable → `manual_review` |
| `evaluateField` | profile fields of study, required fields | Case-insensitive |
| `evaluateStudyMode` | profile preferred study mode, required study modes | |
| `evaluateDestination` | profile destination countries, opportunity countries | |
| `evaluateFundingPreference` | profile scholarship required flag, opportunity funding type | |
| `evaluateFinancialNeed` | profile budget, criteria value | Always `missing_profile_data` or `manual_review` — never fabricated |
| `evaluateScholarshipCriteria` | all scholarship criteria, full profile, test contexts | Dispatches to individual evaluators by criteriaType |

---

## 3. Academic / grading truthfulness policy

**Rule: compare directly only when grading systems are structurally compatible.**

Compatible pairs (direct numeric comparison allowed):
- `percentage ↔ percentage`
- `gpa_4 ↔ gpa_4`
- `gpa_5 ↔ gpa_5`
- `gpa_10 ↔ gpa_10`
- `cgpa ↔ cgpa` or `cgpa ↔ gpa_4`

All other cross-system combinations → `CRITERION_STATES.UNKNOWN` with reason `grading_systems_incompatible_no_direct_comparison`.

**No guessed equivalencies.** `percentage 85 → gpa_4 3.5` is never inferred.
Original grade values preserved in criterion `profileValue`.

---

## 4. Test evaluation

Reuses Mission 6 `structuralScoreCheck` logic inline:

1. Check acceptance status (`not_accepted` → `fail`, `conditional`/`case_by_case` → `manual_review`)
2. Find matching `completed` exam scores in profile
3. Filter out expired scores (check against `expiryDate` vs `referenceDate`)
4. Select best valid score
5. Check overall minimum (if specified)
6. Check section minimums (if specified)
7. Return pass/fail/missing with reasons

**Freshness warnings** are added when expired scores were found but ignored.

**Scope precedence** (from Mission 6): `program_intake (4) > program (3) > institution (2) > country (1)`.
Institution-level fallback is never treated as program-specific proof.

---

## 5. Program eligibility

**Service:** `server/src/services/personalizationService.js` → `evaluateProgramEligibility(userId, programId)`

1. Load `TalentProfile` for the authenticated user
2. Load `ProgramRequirement[]` (status = published) for the program
3. Resolve test types via `Test` model
4. Resolve `TestAcceptance` claims scoped to the program
5. Evaluate each requirement by type (academic, language\_test, standardized\_test, experience, portfolio, document, other)
6. Add degree-level and field criteria from the `Program` document itself
7. Return eligibility result + match score + gap analysis

Optional (`semantics = 'optional'`) requirements are downgraded: `fail → manual_review`.

---

## 6. Scholarship eligibility

**Service:** `evaluateScholarshipEligibility(userId, scholarshipId)`

Evaluates `CanonicalScholarship.criteria[]` independently of admission/enrollment
unless the criterion is `admission_enrollment` (always → `manual_review`).

Supported criteria types:
- `nationality_residence` — deterministic
- `degree_level` — deterministic (via QUAL\_TO\_DEGREE\_MAP)
- `field` — deterministic
- `academic_qualification` / `gpa_grade` — deterministic when grading compatible
- `language_test` — deterministic (test type parsed from criteria value)
- `experience_research` — deterministic when quantifiable; `manual_review` otherwise
- `financial_need` — `missing_profile_data` or `manual_review` (never fabricated)
- `admission_enrollment` — always `manual_review`
- `age` — deterministic when profile DOB and criteria parseable
- `other` — always `manual_review`

---

## 7. Match scoring

**Contract:** `computeMatchScore({ profile, opportunity, opportunityType, weights })`

Returns 0–100 normalized score + per-component breakdown.

| Component | Default weight | Signal |
|---|---|---|
| destination | 0.25 | Profile/goal destinations include opportunity country |
| field | 0.25 | Profile/goal fields include opportunity field |
| degree | 0.20 | Goal qualification level maps to opportunity degree level |
| study_mode | 0.10 | Preference study mode is available |
| test_readiness | 0.10 | Has completed test (1.0), planned (0.5), none (0.0) |
| budget | 0.05 | Budget covers tuition (same currency only) |
| funding | 0.05 | Funding preference met |

Weights are explicit and caller-overridable. No opaque scoring.

**This is preference alignment — not admission probability.**

---

## 8. Gap analysis

**Contract:** `analyzeGaps({ criterionResults, matchResult, profile })`

Produces prioritized gap list:

| Source | Severity |
|---|---|
| `FAIL` criterion | CRITICAL |
| `MISSING_PROFILE_DATA` criterion | MAJOR |
| `MANUAL_REVIEW` criterion | MINOR |
| Zero-score match component (destination/field/degree) | MAJOR |
| Zero-score match component (mode/budget/funding) | MINOR |

Gaps are deduplicated and sorted by severity. Mission 9 converts these into Journey Planner actions.

---

## 9. Recommendations

**Service:** `recommendPrograms(userId, filters)` / `recommendScholarships(userId, filters)`

Flow:
1. Load profile + active goals
2. Build filter from profile preferences (or explicit overrides)
3. Fetch paginated published opportunities
4. For each: compute light eligibility criteria + match score
5. Sort by match score descending
6. Return `buildRecommendation()` contract for each

**`buildRecommendation()` shape:**

```js
{
  opportunity,       // public-projected document
  eligibility: { state, passedCount, failedCount, unknownCount, manualCount, freshnessWarnings },
  match: { score, components, note },
  gaps,              // top 5 gaps
  evaluatedAt,
  whyRecommended,    // up to 3 reasons
}
```

Records with stale/broken provenance include `freshnessWarnings` — clearly surfaced in UX.

---

## 10. Privacy & security

- Eligibility operates on the authenticated user's own profile only
- Server derives `userId` from JWT — callers cannot specify another user's ID
- No cross-user data access at any layer
- No private profile contents in public responses (public projection applied)
- No private information logged at controller level
- No Employer/Agent access to personalization endpoints
- `requireAuth + requireUserAuth` guards on all routes

---

## 11. User API surfaces

**Base:** `/api/personalization/`

| Method | Path | Description |
|---|---|---|
| GET | `/recommendations/programs` | Ranked program recommendations for own profile |
| GET | `/recommendations/scholarships` | Ranked scholarship recommendations for own profile |
| GET | `/programs/:programId/eligibility` | Per-criterion eligibility breakdown |
| GET | `/scholarships/:scholarshipId/eligibility` | Per-criterion eligibility breakdown |
| GET | `/gaps` | Profile gap analysis |
| GET | `/programs/:programId/test-guidance` | Profile-aware test score comparison |

All endpoints: `requireAuth + requireUserAuth`. Pagination: max 50/page.

---

## 12. Client UX

| Page | Route | Description |
|---|---|---|
| Personalization Hub | `/personalization` | Tabs: Programs, Scholarships, Profile Gaps |
| Eligibility Detail | `/personalization/programs/:programId/eligibility` | Per-criterion checklist + match breakdown + gaps |
| Eligibility Detail | `/personalization/scholarships/:scholarshipId/eligibility` | Per-criterion checklist + match breakdown + gaps |

Visual distinction:
- **FACT** — criterion with source-backed requirement
- **STRIDETO MATCH** — match score badge (0–100%) with explicit disclaimer
- **UNKNOWN / NEEDS REVIEW** — gray/yellow badges

"Improve profile" link always present. Journey Planner deferred to Mission 9.

---

## 13. Mission 9 boundary

Mission 8 returns:
- Eligibility state + criterion results
- Match score + components
- Gap items (label, severity, reason, action hint)
- Test guidance

Mission 9 will:
- Convert gap items into scheduled Journey Planner actions
- Add deadline alerts and calendar entries
- Build "Next Best Action" engine
- Provide push notification triggers

---

## 14. Tests

**Location:** `server/src/__tests__/personalizationEligibilityMatching.test.js`

61 pure-contract tests. No DB, no network.

Run: `node src/__tests__/personalizationEligibilityMatching.test.js`

Coverage:
- All eligibility states defined and non-boolean
- unknown/missing ≠ fail
- Nationality/residence (match, open, mismatch, missing)
- Degree level (match, mismatch, ambiguous)
- Academic threshold (compatible pass/fail, incompatible → unknown, no completed edu)
- Test: overall minimum (pass/fail), section minimum (fail), no test, planned, expired, not\_accepted, no minimum
- Program/intake scope precedence
- Scholarship criteria (nationality, degree, field, admission\_enrollment, unsupported, financial\_need)
- Overall state aggregation (all pass, one fail, only missing, manual review, only unknown)
- Match scoring (0–100, explicit weights, destination mismatch, global)
- Eligibility separate from match
- Gap analysis (critical/major/minor)
- buildEligibilityResult shape + timestamps
- No guarantee/probability language
- Freshness warnings
- Test guidance (meets/below/no test)
- Field, study mode, destination, funding preference evaluators
- Experience (quantifiable, non-quantifiable)
- Age criteria (pass, fail)
- Full scholarship scenario

**Regressions:**
- Mission 7: 60/60 pass
- Mission 6: 40/40 pass
- Mission 3: not affected (profile model unchanged)

**Build:** Frontend production build passes (6.82s).

---

## 15. No live migrations

No database migrations. No seed/backfill scripts.
All new evaluation is on-demand. No persisted eligibility records.
