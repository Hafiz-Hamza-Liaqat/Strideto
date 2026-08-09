# Strideto Mission 3 — Universal Student Profile

> **Status:** Implemented (source-complete, not deployed).  
> **Scope:** Universal Student Profile — education history, test scores, goals,
> preferences, budget, experience, skills, certifications, profile completeness,
> privacy foundation.  
> **Authority:** Subordinate to the frozen product spec, execution roadmap,
> engineering guardrails. Preserves Employer Release Baseline and Missions 1–2
> unchanged.

---

## 0. Purpose & principle

Mission 3 builds the single portable student profile that will feed matching,
eligibility, scholarship discovery, recommendations, the Journey Planner, and
the AI Copilot in later missions. It is **additive only**: no existing API,
model field, or behavior is changed or migrated.

**Core rule:** There is one canonical student profile record per user. It is the
`TalentProfile` document, extended with student-specific fields. No competing
profile system was introduced.

---

## 1. Architecture decision — extend TalentProfile

`TalentProfile` is already the canonical user identity record with existing
service/controller/router/frontend infrastructure. Mission 3 extends it with:

| New array field | Purpose |
|---|---|
| `examScores[]` | Test / exam records (IELTS, GRE, SAT, etc.) |
| `studyGoals[]` | Goal declarations (study, scholarship, job, etc.) |

| New subdocument | Purpose |
|---|---|
| `studentPreferences` | Study/destination/funding preferences |
| `budgetProfile` | Affordability input (tuition / living / general) |

**Existing arrays extended** (additive, non-breaking):

| Field | New fields added |
|---|---|
| `education[]` | `qualificationLevel`, `country`, `startDate`, `endDate`, `completionStatus`, `graduationYear`, `gradingSystem`, `gradeValue`, `gradeScale`, `honors`, `notes` |
| `experience[]` | `employmentType`, `country` |

**Stable `_id` for child records**: `educationEntrySchema`, `experienceEntrySchema`,
`skillEntrySchema`, and `certificationReferenceSchema` changed from
`{ _id: false }` to `{}` (Mongoose default: `_id: true`). Existing documents
without `_id` on subdocs continue to work; new records get an ObjectId.

**PKR default fixed**: `CareerPreference.salaryExpectation.currency` default
changed from `'PKR'` to `''` (no assumption). See guardrails §3.

---

## 2. Canonical profile contract

### 2.1 Core (PersonalInfo — existing + extended)

```
firstName, lastName, dateOfBirth (optional), gender (optional)
nationality (ISO 3166-1 alpha-2, optional)
country (ISO 3166-1 alpha-2, residence)
region, city
phone (E.164, validated at service layer)
timeZone (IANA identifier, validated at service layer)
```

### 2.2 Education history

```
institution, degree, fieldOfStudy, description    ← existing, preserved
gpa, startYear, endYear                           ← existing, preserved
qualificationLevel  enum: QUALIFICATION_LEVELS    ← new
country             ISO 3166-1 alpha-2            ← new
startDate, endDate  Date                          ← new (separate from year strings)
completionStatus    enum: EDUCATION_COMPLETION_STATUSES ← new
graduationYear      Number (1900–2100)            ← new
gradingSystem       enum: GRADING_SYSTEMS         ← new
gradeValue          String (e.g. "87", "3.8", "A*") ← new
gradeScale          String (e.g. "100", "4.0")   ← new
honors              String                        ← new
notes               String                        ← new
```

**International grading principle**: every record preserves its native grading
context. No conversion to a universal GPA is performed. `gradeValue` is a plain
string, not a number, so "A*", "Distinction", "85%", and "3.75" are all valid.

### 2.3 Test / exam profile

```
testType        enum: EXAM_TYPES  (IELTS, TOEFL, PTE, DET, SAT, ACT, GRE,
                                   GMAT, AP, HAT, NAT_GAT, USAT, other)
provider        String (optional)
overallScore    String (flexible: "7.5", "318", "B2")
sectionScores   Mixed (structured optional: { listening: 8.0, ... })
testDate        Date
expiryDate      Date
status          enum: planned | booked | completed
referenceNumber String
verifiedAt      Date (reserved for Trust Engine — not surfaced in MVP)
```

### 2.4 Goals

```
goalType              enum: study | scholarship | job | internship |
                             fellowship | work_mobility | other
degreeLevel           enum: QUALIFICATION_LEVELS
fieldOfStudy          String
destinationCountries  [ISO 3166-1 alpha-2]  (validated)
targetIntake          String (e.g. "fall_2026", "Sep 2026")
targetYear            Number (2000–2100)
studyMode             enum: full_time | part_time | online | blended
scholarshipPreference enum: required | preferred | open | not_needed
notes                 String
status                active | completed | archived
```

### 2.5 Student preferences

```
destinationCountries  [ISO 3166-1 alpha-2]
preferredCities       [String]
fieldsOfStudy         [String]
degreeLevels          [QUALIFICATION_LEVELS values]
targetIntake          String
targetYear            Number
studyMode             enum: STUDY_MODES
scholarshipRequired   Boolean
fundingPreference     enum: FUNDING_PREFERENCES
preferredCurrency     ISO 4217
```

### 2.6 Budget profile

```
tuition  { amountMinor: Integer (minor units), currency: ISO 4217 }
living   { amountMinor: Integer (minor units), currency: ISO 4217 }
general  { amountMinor: Integer (minor units), currency: ISO 4217 }
period   enum: monthly | yearly | total_program
fundingSource  enum: self_funded | scholarship | loan | employer | family | other
notes    String
```

Money is stored as integer minor units (Mission 1 `Money` contract).
`amountMinor: 150000 + currency: "USD"` = USD 1,500.00.

### 2.7 Experience (extended)

Existing fields preserved. Added:

```
employmentType  enum: full_time | part_time | internship | contract |
                       freelance | volunteer | self_employed | other
country         ISO 3166-1 alpha-2
```

### 2.8 Skills

Existing schema unchanged. `upsertSkill()` in `studentProfileValidation.js`
provides normalized-name dedup for programmatic upserts. Existing CRUD unchanged.

### 2.9 Certifications

`certificationReferenceSchema` now has stable `_id` (Mongoose default). New
per-record CRUD endpoints added (see §4).

---

## 3. Profile completeness

**Location:** `shared/career/studentProfileValidation.js` —
`computeStudentProfileCompleteness()`

Returns an explainable object:

```json
{
  "overall": 45,
  "sections": {
    "identity":            { "done": true,  "weight": 15, "label": "Basic identity" },
    "education":           { "done": true,  "weight": 20, "label": "Education history" },
    "examScores":          { "done": false, "weight": 15, "label": "Test scores" },
    "studyGoals":          { "done": false, "weight": 15, "label": "Goals & preferences" },
    "studentPreferences":  { "done": false, "weight": 10, "label": "Study preferences" },
    "budget":              { "done": false, "weight":  5, "label": "Budget overview" },
    "experience":          { "done": false, "weight": 15, "label": "Work experience" },
    "skills":              { "done": false, "weight": 10, "label": "Skills" },
    "certifications":      { "done": false, "weight":  5, "label": "Certifications" }
  },
  "completed": ["identity", "education"],
  "missing": ["examScores", "studyGoals", ...],
  "recommended": "examScores",
  "goalAware": true
}
```

**Goal-aware behaviour**: when the user has an active `study` or `scholarship`
goal, `examScores.weight` is raised to 15. Without a study goal it stays at 5
(a job seeker is not required to provide test scores).

---

## 4. API / service boundary

### Existing bulk update (unchanged)

```
GET    /talent/me          — get full profile (including new fields)
PATCH  /talent/me          — bulk update (now accepts examScores, studyGoals,
                             studentPreferences, budgetProfile, extended
                             education/experience)
```

### New Mission 3 endpoints

```
GET    /talent/me/completeness
GET    /talent/me/exam-scores
POST   /talent/me/exam-scores
PATCH  /talent/me/exam-scores/:id
DELETE /talent/me/exam-scores/:id

GET    /talent/me/study-goals
POST   /talent/me/study-goals
PATCH  /talent/me/study-goals/:id
DELETE /talent/me/study-goals/:id

POST   /talent/me/education
PATCH  /talent/me/education/:id
DELETE /talent/me/education/:id

POST   /talent/me/experience
PATCH  /talent/me/experience/:id
DELETE /talent/me/experience/:id

GET    /talent/me/certifications
POST   /talent/me/certifications
PATCH  /talent/me/certifications/:id
DELETE /talent/me/certifications/:id

GET    /talent/me/student-preferences
PUT    /talent/me/student-preferences

GET    /talent/me/budget
PUT    /talent/me/budget
```

**Authorization**: every handler calls `TalentProfileService.getByUserId(userId)`
first — the `userId` comes from `req.user.userId` (JWT, server-verified). If no
profile exists for that user, 404 is returned. Cross-user access is structurally
impossible without possessing another user's JWT.

**Array bounds** (enforced before write):

| Array | Max records |
|---|---|
| education | 30 (per-record CRUD), 100 (bulk PATCH) |
| experience | 30 |
| examScores | 30 |
| studyGoals | 20 |
| certificationReferences | 30 |
| skills | 200 |

**Idempotency**: parse functions are pure and deterministic. Repeated identical
inputs produce identical outputs. The bulk `PATCH /talent/me` path replaces
arrays atomically — no double-write on retry.

---

## 5. Privacy / visibility

- All profile data is **private by default**. `visibility: 'private'` is the
  schema default.
- `visibility` can only become `'public'` through explicit user action.
- `parseTalentProfileInput` never coerces visibility to `public`.
- Agents and employers cannot access a student profile by knowing the `userId`
  alone — they must go through authorized sharing flows (Mission 11+, Document
  Vault Mission 10).
- `sectionVisibility` and fine-grained per-section sharing are reserved for
  Mission 10/11.

---

## 6. Compatibility with TalentProfile / User

| Concern | Treatment |
|---|---|
| Existing `education[]` fields | Preserved unchanged. New fields are additive with empty defaults. |
| Existing `experience[]` fields | Preserved unchanged. `employmentType` and `country` default to `''`. |
| `certificationReferences` | Now has stable `_id` (Mongoose default). Existing documents in DB without `_id` continue to work; reads fall back gracefully. |
| `CareerPreference.salaryExpectation.currency` | Default changed from `'PKR'` to `''`. Existing stored values are unaffected. |
| Dual-write to legacy `Resume` | Unchanged. New student fields are not written to the legacy Resume model (they have no equivalent there). |
| `TALENT_PROFILE_DUAL_WRITE` feature flag | Unchanged. Mission 3 routes bypass dual-write via `skipDualWrite: false` on the child-record CRUD (standard behavior). |
| `profileCompletionWeights.js` (old career completeness) | Unchanged. Mission 3 adds a separate `computeStudentProfileCompleteness()` in `studentProfileValidation.js`. Both can coexist. |

---

## 7. New source files

| File | Purpose |
|---|---|
| `shared/career/studentProfile.js` | Constants: EXAM_TYPES, GRADING_SYSTEMS, QUALIFICATION_LEVELS, etc. |
| `shared/career/studentProfileValidation.js` | Parse + validate + completeness (isomorphic, no DB) |
| `server/src/models/career/ExamScore.js` | Exam score schema |
| `server/src/models/career/StudyGoal.js` | Study goal schema |
| `server/src/models/career/StudentPreferences.js` | Student preferences schema |
| `server/src/models/career/BudgetProfile.js` | Budget profile schema |
| `server/src/controllers/career/studentProfileController.js` | Child-record CRUD + completeness controllers |
| `server/src/__tests__/universalStudentProfile.test.js` | 54-assertion contract test suite |

---

## 8. Modified source files

| File | Change |
|---|---|
| `server/src/models/career/TalentProfile.js` | Add new sub-schemas; extend education/experience; enable `_id` on child records |
| `server/src/models/career/CareerPreference.js` | Fix PKR default → '' |
| `server/src/models/career/CertificationReference.js` | Enable stable `_id` |
| `shared/career/constants.js` | Add `STUDENT_PROFILE_EVENTS` |
| `shared/career/validation.js` | Extend parse/validate to handle new student fields; re-export student validators |
| `server/src/routes/talent.js` | Add 20 new student profile endpoints |
| `client/src/services/talentApi.js` | Add API call wrappers for all new endpoints |
| `client/src/pages/TalentProfile/talentProfileMapper.js` | Add `tests`, `goals` tabs; new empty factories; extend form state |
| `client/src/pages/TalentProfile/TalentProfileForm.jsx` | Add Tests tab and Goals & Preferences tab (with budget); extend Education/Experience tabs |
| `client/src/i18n/locales/en/talent.json` | Add i18n keys for all new sections |

---

## 9. Migrations / backfills not executed

No data migrations were run. The schema changes are additive:

- New fields in existing subdocument schemas have defaults (`''`, `null`, `[]`).
  Existing documents read without error — Mongoose fills in defaults on read.
- `_id: false` → `{}` change does not modify stored documents. Existing
  subdocuments without `_id` simply lack one; new subdocuments get ObjectId.
- `CareerPreference.currency` default change only affects new documents.

If a backfill is ever needed (e.g. to set `completionStatus: 'completed'` on
historical education records), it should be written as an explicit, dry-runnable
admin script per the guardrails §3.

---

## 10. Deferred to later missions

| Feature | Mission |
|---|---|
| Test content / education intelligence | Mission 4 |
| Source verification on education/test records | Mission 5 |
| Test acceptance explorer | Mission 6 |
| Scholarship / program matching | Mission 7 |
| Eligibility / gap analysis | Mission 8 |
| Journey Planner | Mission 9 |
| Document Vault integration | Mission 10 |
| Agent profile access + sharing | Mission 11 |
| Section-level fine-grained privacy (sharing grants) | Mission 10/11 |
| AI Copilot profile enrichment | Mission 19 |
| Budget / cost planner full build | Mission 20 |
| Student profile admin center | Mission 21 |
| Auto-expiry of test scores via worker | (scheduler, post Mission 3) |
| `sectionVisibility` map on TalentProfile | Mission 10/11 |
