# Strideto Mission 4 — Education & Test Intelligence Foundation

> **Status:** Implemented (source-complete, not deployed).
> **Scope:** Canonical test catalog, test providers, preparation guidance,
> external resources, test alerts, country education intelligence, canonical
> institution foundation, program shell, education taxonomy, user-facing Test Hub,
> admin management surfaces.
> **Authority:** Subordinate to the frozen product spec, execution roadmap,
> engineering guardrails, trust/verification policy, and Employer Release
> Baseline. Preserves Missions 1–3 unchanged.

---

## 0. Purpose & principle

Mission 4 builds the **Education Intelligence Engine** foundation answering:

- What test do I need?
- What is this test?
- When can I take it?
- How should I prepare?
- Where should I practice?
- Where can I find the official information?

Architecture is **global by design**: ISO 3166-1 country codes, no hardcoded
markets, no Pakistan-only defaults. All new entities use the `draft →
published → archived` lifecycle. Draft/archived records are never exposed
publicly.

---

## 1. Shared taxonomy — `shared/education/taxonomy.js`

Canonical, frozen vocabulary used by both server models and client-side
validation. Pure JS, no Node or DOM dependencies.

| Vocabulary | Key values |
|---|---|
| `TEST_CATEGORIES` | `english_proficiency`, `admissions`, `national_qualification`, `professional`, `other` |
| `DELIVERY_MODES` | `computer_based`, `paper_based`, `in_person`, `online`, `at_home` |
| `DEGREE_LEVELS` | `high_school`, `diploma`, `certificate`, `bachelor`, `master`, `phd`, `postdoc`, `professional` |
| `STUDY_MODES` | `full_time`, `part_time`, `online`, `blended`, `distance` |
| `ACADEMIC_FIELDS` | `arts`, `business`, `computing`, `education`, `engineering`, `health`, `humanities`, `law`, `natural_science`, `social_science`, `other` |
| `INSTITUTION_TYPES` | `university`, `college`, `institute`, `school`, `training_center`, `other` |
| `RESOURCE_TYPES` | `official_guide`, `practice_test`, `mock_exam`, `course`, `book`, `app`, `video`, `other` |
| `TRUST_LEVELS` | `official`, `trusted`, `community` |
| `ALERT_TYPES` | `registration_open`, `registration_deadline`, `test_date`, `fee_change`, `format_change`, `result`, `general` |
| `PUB_STATUSES` | `draft`, `published`, `archived` |
| `ALERT_IMPORTANCE` | `low`, `medium`, `high` |

Validator functions: `isValidTestCategory`, `isValidDeliveryMode`,
`isValidDegreeLevel`, `isValidStudyMode`, `isValidAcademicField`,
`isValidInstitutionType`, `isValidResourceType`, `isValidTrustLevel`,
`isValidAlertType`, `isValidPubStatus`, `isValidAlertImportance`,
`isValidHttpUrl`, `educationSlug`.

---

## 2. Test Provider model — `server/src/models/education/TestProvider.js`

Represents the organization that administers a test (e.g. ETS for GRE/TOEFL,
British Council/IDP for IELTS).

| Field | Type | Notes |
|---|---|---|
| `name` | String, required | Display name |
| `slug` | String, unique | URL-safe, auto-generated from name |
| `organizationType` | String | Free-form (e.g. "non-profit", "government") |
| `officialWebsite` | String | http(s) URL |
| `countryCode` | String | ISO 3166-1 alpha-2 |
| `region` | String | Geographic description |
| `registrationUrl` | String | Official test registration link |
| `helpUrl` | String | Official help/contact URL |
| `sources` | Array | Evidence subdocuments (Mission 1 contract) |
| `status` | `active` \| `archived` | Default: active |
| timestamps | | `createdAt`, `updatedAt` |

---

## 3. Test model — `server/src/models/education/Test.js`

Canonical, extensible test catalog. **Separate from the legacy `Exam` model**
(which handles the existing PPSC/NTS quiz flow and is preserved unchanged).

| Field | Type | Notes |
|---|---|---|
| `stableId` | String, unique, sparse | Application-level id (e.g. "ielts", "toefl-ibt") |
| `slug` | String, required, unique | URL-safe, auto-generated |
| `name` | String, required | Full display name |
| `shortName` | String | Abbreviation |
| `category` | `TEST_CATEGORIES` enum, required | Category for filtering |
| `providerId` | ObjectId → `TestProvider` | Linked provider |
| `description` / `overview` | String | Editorial content |
| `purposes` | String[] | Why users take this test |
| `countryCodes` | String[] | ISO 3166-1 markets |
| `deliveryModes` | `DELIVERY_MODES[]` | How test is taken |
| `sections` | Array | `{name, description, durationMinutes, weight}` |
| `totalDurationMinutes` | Number | Total test time |
| `scoreScale` | String | e.g. "0–9 band score in 0.5 increments" |
| `validityMonths` | Number \| null | null = no expiry |
| `registrationUrl` | String | Official registration link |
| `officialWebsite` | String | Test homepage |
| `status` | `PUB_STATUSES` | Default: draft |
| `displayOrder` | Number | Sort hint |
| `sources` | Array | Evidence subdocuments |
| timestamps | | `createdAt`, `updatedAt` |

Indexes: `{category, status}`, `{providerId, status}`, full-text on
`name/shortName/description`.

**Examples supported (no data populated):** IELTS, TOEFL, PTE, Duolingo
English Test, SAT, ACT, AP, GRE, GMAT, HAT, NAT, GAT, USAT — any future test
added without schema changes.

---

## 4. TestPrepGuide model — `server/src/models/education/TestPrepGuide.js`

Strideto **original** preparation guidance. Content is authored by Strideto.

**Copyright policy (enforced at model and admin level):**
- ALLOWED: original Strideto guidance, factual summaries with sources.
- NOT ALLOWED: copied proprietary exam questions, pirated books/PDFs, reproduced
  official question banks beyond permitted use.
- `copyrightPolicyAcknowledged: Boolean` must be set `true` for published guides.

| Field | Type | Notes |
|---|---|---|
| `testId` | ObjectId → `Test`, required | Parent test |
| `title` | String, required | Guide title |
| `overview` | String | Introduction |
| `prepSequence` | Array | `{order, title, description}` steps |
| `recommendedDurationMinWeeks` / `MaxWeeks` | Number | Preparation duration range |
| `sectionPrep` | Array | `{sectionName, tips[]}` |
| `testDayGuidance` | String | Day-of-test advice |
| `registrationGuidance` | String | How to sign up |
| `copyrightPolicyAcknowledged` | Boolean | Content policy gate |
| `status` | `PUB_STATUSES` | Default: draft |
| `version` | Number | Content versioning |
| `sources` | Array | Evidence subdocuments |

---

## 5. ExternalTestResource model — `server/src/models/education/ExternalTestResource.js`

Links to trusted/official external practice and preparation resources. Strideto
links to resources rather than cloning them.

| Field | Type | Notes |
|---|---|---|
| `testId` | ObjectId → `Test`, required | Parent test |
| `provider` | String, required | Resource publisher name |
| `title` | String, required | Resource title |
| `url` | String, required | Must be http(s) — validated |
| `resourceType` | `RESOURCE_TYPES` enum, required | |
| `trustLevel` | `TRUST_LEVELS` enum, required | `official` / `trusted` / `community` |
| `isFree` / `isPaid` | Boolean | Pricing metadata |
| `platformType` | String | e.g. "web", "app", "course_platform" |
| `description` | String | Editorial description |
| `sources` | Array | Evidence subdocuments |
| `status` | `PUB_STATUSES` | Default: draft |

**UX distinction:** official and trusted resources are visually differentiated
in the Test Hub UI.

---

## 6. TestAlert model — `server/src/models/education/TestAlert.js`

Factual test-related announcements sourced from official channels.

| Field | Type | Notes |
|---|---|---|
| `testId` | ObjectId → `Test`, required | Parent test |
| `title` | String, required | Announcement headline |
| `alertType` | `ALERT_TYPES` enum, required | |
| `effectiveDate` / `startDate` / `endDate` | Date | Date scope |
| `countryCodes` | String[] | ISO markets; empty = global |
| `officialSourceUrl` | String | Primary official source link |
| `sources` | Array | Evidence subdocuments |
| `publicationStatus` | `PUB_STATUSES` | Default: draft |
| `importance` | `ALERT_IMPORTANCE` | `low` / `medium` / `high` |

Public endpoints only return alerts where `endDate` is null or in the future.

Mission 9 will add personalized following/notifications on top.

---

## 7. CountryEducation model — `server/src/models/education/CountryEducation.js`

Informational country education intelligence shell. No legal advice, no visa
eligibility decisions.

| Field | Type | Notes |
|---|---|---|
| `countryCode` | String, unique | ISO 3166-1 alpha-2 (validated) |
| `slug` | String, unique | URL-safe |
| `educationOverview` | String | Original country education summary |
| `commonIntakes` | String[] | e.g. `["September", "February"]` |
| `educationAuthorityName` / `Url` | String | Official education body |
| `generalApplicationResourceUrl` | String | Application information link |
| `immigrationAuthorityName` / `Url` | String | Immigration/visa authority |
| `informationalNotes` | String | Additional informational content |
| `sources` | Array | Evidence subdocuments |
| `status` | `PUB_STATUSES` | Default: draft |

**High-stakes visa/legal facts** must remain source-backed and informational.

---

## 8. CanonicalInstitution model — `server/src/models/education/CanonicalInstitution.js`

International institution foundation. Existing `University` and `Institution`
models are **preserved unchanged** (additive).

Reuses Organization patterns from Mission 1/2: ISO country codes, status,
slug conventions.

| Field | Type | Notes |
|---|---|---|
| `officialName` | String, required | Official legal name |
| `slug` | String, unique | URL-safe, auto-generated |
| `countryCode` | String | ISO 3166-1 alpha-2 |
| `city` / `region` | String | Location |
| `officialWebsite` | String | |
| `officialDomain` | String | Lowercase |
| `institutionType` | `INSTITUTION_TYPES` enum, required | |
| `isPublic` | Boolean \| null | null = not yet determined |
| `organizationId` | ObjectId → `Organization`, sparse unique | Link to Mission 1/2 record |
| `sources` | Array | Evidence subdocuments |
| `status` | `PUB_STATUSES` | Default: draft |

Mission 18 will build Institution Portal/claiming on top.

---

## 9. Program model — `server/src/models/education/Program.js`

Foundational program shell. Missions 6–8 build test acceptance, scholarship
linkage, and matching on top.

| Field | Type | Notes |
|---|---|---|
| `institutionId` | ObjectId → `CanonicalInstitution`, required | Ownership |
| `name` | String, required | |
| `slug` | String, unique | |
| `degreeLevel` | `DEGREE_LEVELS` enum | |
| `field` | `ACADEMIC_FIELDS` enum | |
| `campus` | String | Optional campus/location |
| `studyMode` | `STUDY_MODES` enum | |
| `durationMonths` | Number | |
| `officialProgramUrl` | String | |
| `status` | `PUB_STATUSES` | Default: draft |
| `sources` | Array | Evidence subdocuments |

---

## 10. Public APIs

All public endpoints return **only published records**. Draft/archived records
are never returned.

### Test catalog
| Method | Path | Description |
|---|---|---|
| GET | `/api/tests` | Browse tests. Filters: `category`, `search`, `providerId`, `country`, `deliveryMode`, `page`, `limit` |
| GET | `/api/tests/:slug` | Test detail + embedded prepGuide, resources, alerts |
| GET | `/api/tests/:slug/prep-guide` | Preparation guide only |
| GET | `/api/tests/:slug/resources` | External resources. Filters: `resourceType`, `trustLevel` |
| GET | `/api/tests/:slug/alerts` | Active (non-expired) alerts |

### Providers, countries, institutions
| Method | Path | Description |
|---|---|---|
| GET | `/api/education/providers` | Active test providers |
| GET | `/api/education/countries` | Published country education records |
| GET | `/api/education/countries/:code` | Country detail by ISO code or slug |
| GET | `/api/education/institutions` | Published institutions. Filters: `country`, `institutionType`, `page`, `limit` |
| GET | `/api/education/institutions/:slug` | Institution detail |

---

## 11. Admin management

All admin endpoints are under `/api/admin/education/...` and require
`requireAuth + requireStaff` (enforced by the parent `adminRouter` middleware).
Normal users cannot read or mutate draft/admin-only catalog records.

### Surfaces

| Resource | GET (list) | POST (create) | PATCH (update) |
|---|---|---|---|
| Providers | ✅ | ✅ | ✅ |
| Tests | ✅ | ✅ | ✅ |
| Prep Guides | ✅ | ✅ | ✅ |
| Resources | ✅ | ✅ | ✅ |
| Alerts | ✅ | ✅ | ✅ |
| Country Education | ✅ | ✅ | ✅ |
| Institutions | ✅ | ✅ | ✅ |
| Programs | ✅ | ✅ | ✅ |

Admin list endpoints support `status` filters to see draft/published/archived
records. Publish transitions are explicit (`status: "published"` in PATCH body).

---

## 12. User-facing Test Hub

Integrated into the existing Strideto navigation (not a disconnected second site).

### Routes
| Path | Component | Description |
|---|---|---|
| `/tests` | `TestHub.jsx` | Browse/search tests with category filter and pagination |
| `/tests/:slug` | `TestDetail.jsx` | Full test detail with sections, alerts, prep guide, resources |

### UX distinction
The Test Detail page visually distinguishes:
- **Official/Verified Fact** — green badge (`OFFICIAL FACT` / `Source-backed`)
- **Strideto Guidance** — purple badge on prep guide content
- **External Resource** — `Official`, `Trusted`, `Community` trust badges

### Responsive
- Mobile-first grid layout
- No horizontal body scroll
- Wide tables scroll inside their own container

---

## 13. Source/evidence integration

Uses Mission 1 source/evidence primitives (`shared/international/evidence.js`).

Every factual field that carries a source reference uses the `evidenceSubSchema`
subdocument:

```js
{
  sourceType: 'official' | 'document' | 'third_party' | 'user_submitted' | 'other',
  sourceUrl: 'https://...',
  publisher: 'string',
  retrievedAt: Date,
  verifiedAt: Date,
  evidenceRef: 'opaque ref',
}
```

The `parseSources` helper in `adminEducationController.js` delegates to
`validateSource` and silently drops invalid evidence entries (never stores
malformed sources).

Mission 5 will add: freshness states, verification workflow, re-check
scheduling, broken-source handling.

---

## 14. Copyright boundary

Documented and enforced at the model, controller, and admin layer.

| | Allowed | Not allowed |
|---|---|---|
| Content | Original Strideto preparation guidance | Copied proprietary exam questions |
| Links | Official test-provider links, trusted third-party links | Links to pirated content |
| Resources | Official guides, trusted practice tests | Copied paid courses, pirated PDFs |
| Evidence | Source-backed factual summaries | Fabricated data presented as fact |

`copyrightPolicyAcknowledged: Boolean` field on `TestPrepGuide` must be
explicitly set to `true` (the controller enforces `=== true`; a string "true"
is rejected).

The `TRUST_LEVELS` taxonomy only permits `official`, `trusted`, `community`.
Values like "pirated", "scraped", "copied" are not valid and fail validation.

---

## 15. Data seed strategy

**No live seeds or backfills were executed in Mission 4.**

The schema architecture is global and extensible. Future seed/fixture records
can be added by:
1. Creating a `server/src/scripts/seedEducationCatalog.js` script (dry-runnable).
2. Providing verified static fixtures in `server/src/seed/educationFixtures.js`.

No internet was browsed or scraped during implementation.
No real-world acceptance counts or score requirements were fabricated.

---

## 16. What future missions will add

| Mission | Addition |
|---|---|
| Mission 5 | Source freshness states, verification workflow, broken-source handling, re-check scheduling |
| Mission 6 | University/test acceptance explorer — which tests does this institution accept? |
| Mission 7 | Full scholarship intelligence linked to institutions and programs |
| Mission 8 | Matching and eligibility — does the student's profile meet requirements? |
| Mission 9 | Journey Planner — personalized test following, deadline alerts, Next Best Action |
| Mission 18 | Institution Portal/claiming — verified institution self-service |
| Mission 21 | Full Admin Center |

---

## 17. Tests

Test file: `server/src/__tests__/educationIntelligence.test.js`

Run: `node src/__tests__/educationIntelligence.test.js`

41 pure-contract assertions covering all 19 required behavioral proofs:

1. Test slug/type/category validation
2. Test provider relationship contract
3. Extensible test catalog (frozen enums, no schema changes needed for new tests)
4. Preparation guidance CRUD contract
5. External-resource URL validation
6. Official/trusted classification
7. Alert date/status validation
8. Country-code validation (ISO 3166-1 only)
9. Institution uniqueness/slug
10. Program → institution ownership/reference
11. Taxonomy validation (all validators return boolean)
12. Admin authorization (role-based guard contract)
13. Normal user cannot mutate catalog (requireStaff enforced)
14. Draft/unpublished records not exposed publicly
15. Search/filter/pagination helpers
16. Safe source/evidence validation (Mission 1 primitives)
17. Copyrighted-content boundary
18. Mission 3 profile regression (54 assertions green)
19. Employer Release Baseline unaffected

---

## 18. File inventory

### New
```
shared/education/taxonomy.js              — canonical vocabulary + validators
shared/education/index.js                 — re-export
server/src/models/education/TestProvider.js
server/src/models/education/Test.js
server/src/models/education/TestPrepGuide.js
server/src/models/education/ExternalTestResource.js
server/src/models/education/TestAlert.js
server/src/models/education/CountryEducation.js
server/src/models/education/CanonicalInstitution.js
server/src/models/education/Program.js
server/src/controllers/education/testController.js
server/src/controllers/education/adminEducationController.js
server/src/routes/tests.js
server/src/routes/adminEducation.js
client/src/pages/Tests/TestHub.jsx
client/src/pages/Tests/TestDetail.jsx
server/src/__tests__/educationIntelligence.test.js
docs/STRIDETO_MISSION_4_EDUCATION_INTELLIGENCE.md
```

### Modified
```
server/src/routes/index.js        — exports testsRouter
server/src/routes/admin.js        — mounts adminEducationRouter
server/src/index.js               — mounts testsRouter at /api
client/src/constants/index.js     — adds TEST_HUB, TEST_DETAIL routes
client/src/services/listingsService.js — adds testsApi
client/src/routes/index.jsx       — registers TestHub + TestDetail routes
```

### Unchanged
```
server/src/models/Exam.js         — legacy exam quiz flow, preserved
server/src/models/University.js   — legacy, preserved
server/src/models/Institution.js  — legacy, preserved
```
