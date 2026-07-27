# Phase E.0 — Platform Content Coverage, Learning, Assessment & Dashboard Audit

**Date:** 2026-07-27  
**Mode:** Audit only (no implementation, seed, commit, push, deploy, or n8n)  
**Scope:** Map routes, taxonomy, content coverage, Recommended Learning, assessments, dashboard trackers, trust/editorial pages, and safe phased plan for closed beta.

---

## Executive summary

Strideto’s public shell (Vercel + Render + Atlas) is live and core auth/admin/listing APIs work, but **beta readiness is blocked primarily by content volume, assessment publication in production, and dashboard tracker inconsistencies**—not by missing route wiring.

| Area | Primary finding |
|------|-----------------|
| **Listings** | Public APIs filter `status: 'active'` (+ job `approvalStatus`); **expired deadlines are not auto-excluded** unless query params or UI filters apply. |
| **Seeds** | `npm run seed` is **destructive**; `npm run seed:launch` and `seed:assessments` are **idempotent** but **not run on server boot**. Launch jobs use `externalId: launch-v1-*` and **often omit `sourceUrl` / verification metadata**. |
| **Recommended Learning** | **No Mongo learning collection**—widget uses static `RESOURCE_CATALOG` in `shared/career/learningRecommendations.js`. Empty or “useless” UX usually means **widget not on layout**, **broken `/api/career/dashboard`**, or **assessment targets unpublished** (links lead nowhere). |
| **Assessments** | Catalog requires `status: 'published'`; **11 MVP assessments** exist in `server/src/seed/assessments.js` but only after **`npm run seed:assessments`** against production Atlas. |
| **Dashboard trackers** | **Dual profile-completion systems**, **non-personalized “recommendations”**, **legacy vs OpportunityApplication split**, and **readiness 0 without `missingProfile` UX** explain “trackers not working correctly.” |

**Production collection counts were not queried** (no Atlas access in this audit). Inferences below use code, seed contracts, and stated production behavior.

---

## Final verdict

**READY FOR CONTENT IMPLEMENTATION**

---

## Part 1 — Route and page inventory

**Source of truth:** `client/src/routes/index.jsx` (mounted via `App.jsx` → `useRoutes`).  
**API base:** `/api` unless noted (`/api/cms`, `/api/admin`, `/api/v1`).

Legend for tables:

- **Empty behavior:** typical UI when API returns `[]` or 404
- **Prod data:** inferred without live DB counts—treat as **verify in Atlas**
- **Beta min:** suggested minimum for closed beta (Part 4)

### 1. Public marketing

| URL | Page / component | Data source | API | Model(s) | Admin | Empty / error | Prod data | Beta min |
|-----|------------------|-------------|-----|----------|-------|---------------|-----------|----------|
| `/` | `Home` | CMS homepage + listings teasers | `GET /api/cms/homepage`, trending/listings | `CmsHomepage`, `Job`, etc. | Site CMS, listings admins | Skeleton then CMS; teasers empty if no active jobs | CMS boot-seeded; listings vary | Homepage CMS complete; 5+ active jobs on home blocks |
| `/search` | `SearchResults` | Search index | `GET /api/search` | `SearchDocument` | Rebuild via admin/search ops | Empty results state | Depends on indexer | Indexed docs for each major entity type |
| `/about` | `AboutPage` → `StaticCmsPage` slug `about` | CMS static or i18n fallback `About.jsx` | `GET /api/cms/static/:slug` | `CmsStaticPage` | Site CMS | Fallback i18n copy | Partial CMS likely | CMS or polished fallback |
| `/services` | `ServicesPage` | CMS / fallback | CMS static | `CmsStaticPage` | Site CMS | Fallback | Verify | 1 complete page |
| `/advertise` | `AdvertisePage` | CMS / fallback | CMS static | `CmsStaticPage` | Advertisements admin | Fallback | Verify | 1 page |
| `/contact` | `Contact` | Form + optional CMS | `POST /api/contact` | `ContactMessage` | Contact messages | Validation errors | N/A | Working form + 0 messages OK |
| `/blog` | `Blog` | DB | `GET /api/blogs` | `Blog` | `/admin/blogs` | Empty list | Verify | 3–5 `published` posts, 2+ categories |
| `/blog/:slug` | `BlogPost` | DB | `GET /api/blogs/:slug` | `Blog` | `/admin/blogs` | 404 | Verify | 1 post per major category |
| `/careers` | `CareersPage` | CMS / fallback | CMS static | `CmsStaticPage` | Site CMS | Fallback | Verify | Strideto hiring copy (not job listings) |

**SEO job landings** (`/jobs-in-:slug`, `/fpsc-jobs`, `/government-jobs`, etc.): `SEOJobsPage` → same `GET /api/jobs` with query presets; need matching **active** jobs in DB.

**Locale mirror** (`/:locale/...`): subset of routes only (`LocaleMainLayout`); most URLs are non-locale.

### 2. Opportunities

| URL | Component | API | Model | Admin | Filters / notes | Beta min |
|-----|-----------|-----|-------|-------|-----------------|----------|
| `/jobs` | `Jobs` | `GET /api/jobs` | `Job` | `/admin/jobs` | `status: active`, approved; optional `deadline` query | 5–10 active, 2+ per `jobType` / major `category` |
| `/jobs/:slug` | `JobDetail` | `GET /api/jobs/:idOrSlug` | `Job`, `Employer` | `/admin/jobs` | Related by category/province | 1 internal-apply + 1 external gov job |
| `/jobs/province/:slug`, `/jobs/category/:slug` | Landing pages | `GET /api/jobs` | `Job` | — | Province/category regex | 2 provinces, 3 categories |
| `/scholarships` | `Scholarships` | `GET /api/scholarships` | `Scholarship` | `/admin/scholarships` | `status: active` | 5+ active, 2+ `level`, 2+ `fundingType` |
| `/scholarships/:slug` | `ScholarshipDetail` | `GET /api/scholarships/:slug` | `Scholarship` | — | | 2 with future `deadline` |
| `/internships` | `Internships` | `GET /api/internships` | `Internship` | `/admin/internships` | `status: active` | 3–5 active |
| `/internships/:idOrSlug` | `InternshipDetail` | `GET /api/internships/:id` | `Internship` | — | | 2 types (paid/unpaid) |
| `/intl-scholarships` | `IntlScholarships` | `GET /api/intl-scholarships` | `IntlScholarship` | `/admin/international-scholarships` | Optional `deadline=upcoming` | 3+ active |
| `/webinars` | `Webinars` | `GET /api/webinars` | `Webinar` | `/admin/webinars` | | 2 upcoming |
| `/submit-opportunity` | `SubmitOpportunity` | Public intake (forms/workflow) | varies | Moderation | | 1 test submission in staging only |
| `/company/:slug` | `CompanyProfile` | `GET /api/public/companies` (public profiles) | `Company` | `/admin/companies` | | 2 companies with jobs |
| `/employer/:slug` | `EmployerPublicGate` | Employer public profile | `Employer` | `/admin/employers` | Reserved slug redirects | 1 verified employer |

**Trending:** `GET /api/trending/:type` — scores active jobs/scholarships/admissions by views, bookmarks, deadline proximity (`trendingController.js`); needs **non-empty active** collections.

### 3. Education

| URL | Component | API | Model | Admin | Beta min |
|-----|-----------|-----|-------|-------|----------|
| `/admissions` | `Admissions` | `GET /api/admissions` | `Admission` | `/admin/admissions` | 5+ active, 2+ institutions |
| `/admissions/:slug` | `AdmissionDetail` | `GET /api/admissions/:slug` | `Admission` | — | 2 with `applyLink` |
| `/schools-and-colleges` | `SchoolsAndColleges` | `GET /api/institutions` | `Institution` | `/admin/institutions` | 4+ (`school`, `college`, etc.) |
| `/schools-and-colleges/:slug` | `InstitutionDetail` | `GET /api/institutions/:slug` | `Institution` | — | 1 per `type` enum |
| `/foreign-studies` | `ForeignStudies` | `GET /api/foreign-studies` | `ForeignStudy` | `/admin/foreign-studies` | 4+ countries |
| `/foreign-studies/:slug` | `ForeignStudyDetail` | `GET /api/foreign-studies/:slug` | `ForeignStudy` | — | 2 `level` values |
| `/university/:slug` | `UniversityProfile` | Universities API | `University` | `/admin/universities` | 3+ active |

### 4. Career guidance

| URL | Component | API | Model | Admin | Beta min |
|-----|-----------|-----|-------|-------|----------|
| `/career-guidance` | `CareerGuidance` | `GET /api/career-articles` | `CareerArticle` | `/admin/career-guidance` | 4+ `published`, 2+ categories |
| `/career-guidance/:slug` | `CareerArticleDetail` | by slug | `CareerArticle` | — | |
| `/resume-builder` | `ResumeBuilder` | `GET /api/resume-templates`, user resume APIs | `ResumeTemplateCatalog`, `Resume` | Templates via seed/admin | 2+ templates |

### 5. Test preparation

| URL | Component | API | Model | Admin | Beta min |
|-----|-----------|-----|-------|-------|----------|
| `/exam-prep` | `ExamPrep` | `GET /api/exams` | `Exam` | `/admin/exam-preparation` | 2+ `active` exams |
| `/exam-prep/:slug` | `ExamDetail` | exam + quizzes | `Exam`, `Quiz`, `Mcq`, `PastPaper` | `/admin/exam-preparation` | 1 exam with quiz + MCQs |
| `/exam-prep/quiz/:quizId` | `QuizTake` | quiz APIs | `Quiz`, `Mcq`, `QuizAttempt` | — | 1 completable quiz |

**Note:** Exam prep is **separate** from career **Assessments** (`/assessments`).

### 6. Authentication

| URL | Component | API | Model | Admin |
|-----|-----------|-----|-------|-------|
| `/auth/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/accept-invitation` | Auth pages | `/api/auth/*` | `User`, `StaffInvitation` | Users, Invitations |
| `/employer/login`, `/register` | Employer auth | `/api/employer/*` | `Employer` | Employers |

### 7. Student dashboard (protected)

| URL | Component | API | Models / services | Beta min |
|-----|-----------|-----|-------------------|----------|
| `/dashboard` | `Dashboard` → `CareerDashboardPage` or `LegacyDashboard` | `GET /api/career/dashboard` or `GET /api/auth/dashboard` | Composition services | 1 test user with profile + 1 application + 1 assessment attempt |
| `/profile` | `Profile` | `/api/auth/profile` | `User` | Complete onboarding |
| `/talent-profile` | `TalentProfileEditor` | `/api/talent/*` | `TalentProfile` | Partial + complete examples |
| `/applications`, `/applications/new`, `/applications/:id` | Application tracker | `/api/applications/*` | `OpportunityApplication` | 2 stages |
| `/assessments`, `/assessments/:slug`, `.../take` | Assessments | `/api/assessments/*` | `Assessment`, `AssessmentAttempt` | 2 published assessments taken |
| `/saved-jobs` | `SavedJobs` | `/api/auth/bookmarks` | `User.savedJobs` etc. | 2 saved |
| `/notifications` | `NotificationsPage` | `/api/inbox/notifications` | `UserNotification` | 2 inbox items |
| `/resume-analyzer` | `ResumeAnalyzer` | upload + analyze | `ResumeScan` | 1 scan |
| `/badges` | `Badges` | `/api/badges/me` | `UserBadge` | 1 earned badge |

**Feature flags:** `VITE_CAREER_DASHBOARD_ENABLED`, `VITE_CAREER_DASHBOARD_V2_ENABLED`, `VITE_ASSESSMENTS_ENABLED`, etc. (`client/src/config/careerFeatureFlags.js`).

### 8. Employer dashboard

| URL | Layout / pages | API prefix |
|-----|----------------|------------|
| `/employer/*` | `EmployerLayout` + jobs, applications, intelligence, analytics, settings | `/api/employer/*` |

Beta: 1 employer with 2 active jobs and ≥1 application.

### 9. Admin dashboard

All under `/admin` + `ProtectedRoute requireStaff` → `Admin.jsx` outlet. Content admins map 1:1 to listing models (jobs, scholarships, admissions, blogs, internships, universities, foreign-studies, career-guidance, companies, employers, exam-preparation, institutions, webinars, intl scholarships). Platform: site-cms, page-builder, media, forms, users, payments, platform-ops, newsletter, support, monitoring.

**Duplicate route:** `/admin/activity` → same as `/admin/audit` (`AuditLogPage`).

### 10. Legal and help

| URL | CMS slug | Fallback component | Admin |
|-----|----------|-------------------|-------|
| `/help-center` | `help-center` | `HelpCenter.jsx` | Site CMS |
| `/faq` | `faq` | `FAQ.jsx` | Site CMS |
| `/privacy-policy` | `privacy-policy` | `PrivacyPolicy.jsx` | Site CMS |
| `/terms` | `terms` | `Terms.jsx` | Site CMS |
| `/cookies` | `cookies` | `Cookies.jsx` | Site CMS |
| `/license` | `license` | `License.jsx` | Site CMS |
| `/disclaimer` | `disclaimer` | `Disclaimer.jsx` | Site CMS |
| `/refund-policy` | `refund-policy` | `RefundPolicy.jsx` | Site CMS |
| `/support`, `/support/tickets` | `support` + tickets API | `Support.jsx` | Support admin |

### 11. Hidden, deprecated, or unreachable

| Item | Notes |
|------|--------|
| `*` → `NotFound` | Catch-all |
| Partial `/:locale/*` | Most app URLs not locale-prefixed |
| `/admin/activity` | Alias of audit log |
| `employer/:slug` reserved slugs | Redirect to dashboard paths |
| SEO-only job routes | Not in `ROUTES` constants but registered |
| `PRIVATE_ROUTE_PREFIXES` (SEO) | Omits some real auth routes from sitemap hints |
| **No routes** for Editorial Policy, Corrections, Source Verification, Job Scam Guide, Employer Guidelines, Community Guidelines, Accessibility, **How It Works** (dedicated) | See Part 8 |

---

## Part 2 — Content taxonomy audit

Values below are **from schemas and seed constants**—not invented.

### Jobs (`Job.js` + `launchContentGenerators.js`)

| Dimension | Contract |
|-----------|----------|
| **Employment type** | `type`: `full-time`, `part-time`, `contract`, `internship` |
| **Sector / classification** | `jobType`: `Government`, `Private`, `Internship` |
| **Category** | Free `String`; seed uses `JOB_CATEGORIES`: IT, Engineering, Banking, Healthcare, Education, Sales, Marketing, HR, Finance, Government, Freelance, Remote |
| **Work mode** | `remote`, `hybrid` booleans; seed uses `WORK_MODES`: On-site, Remote, Hybrid (mapped into title/flags) |
| **Experience** | Free `experience` string; seed `EXPERIENCE_LEVELS`: Fresh Graduate, 1-2 years, 3-5 years, 5+ years, Experienced, Freelance |
| **Featured / trending** | `isFeatured`, `isSponsored`, `priority`, `boostLevel`; trending API uses views + bookmarks + deadline score |
| **Latest** | Default sort `createdAt` desc on list API |
| **Deadline / expiry** | `deadline`, `expiresAt`; list filter `deadline >= query` only when client passes `deadline`—**no automatic hide of past deadlines** |
| **Employer** | `employerId`, `company` / `organization`; `applyType` `external` \| `internal` |
| **Provenance** | `source`, `sourceUrl`, `sourceWebsite`, `externalId`, `scrapedAt`, `approvalStatus` |

### Scholarships (`Scholarship.js`)

| Dimension | Contract |
|-----------|----------|
| **Level** | `level`: Undergraduate, Graduate, PhD, Other |
| **Funding** | `fundingType`: Fully Funded, Partial, Other |
| **Study level display** | `degreeLevel` string |
| **Countries** | `country` string |
| **Eligibility** | `eligibility[]` |
| **Deadline** | `deadline`; optional query filter |
| **Featured** | `isFeatured`, `isSponsored` |
| **Status** | `draft`, `active`, `closed` |

### Admissions (`Admission.js`)

| Dimension | Contract |
|-----------|----------|
| **Types** | No enum—`program`, `degree`, `department`, `session` strings |
| **Institution** | `institution`, `university` |
| **Location** | `province`, `city` |
| **Deadlines** | `deadline`, `lastDate` |
| **Upcoming** | Client/API may sort by deadline; no global “upcoming only” on main list unless added |
| **Source** | `source` manual \| scraper; `sourceUrl` |

### Internships (`Internship.js`)

| Dimension | Contract |
|-----------|----------|
| **Type** | `internshipType` free string |
| **Paid** | `isPaid` boolean |
| **Remote / location** | `location`, `province`, `city` (no hybrid enum) |
| **Fields** | `skillset[]` |
| **Deadline** | `deadline` |
| **Status** | `draft`, `active`, `closed` |

### Education

| Entity | Key taxonomy |
|--------|----------------|
| **Institutions** | `type`: `school`, `college`, `technical_institute`, `training_center` |
| **Universities** | `University` model (public/private, ranking, etc.) |
| **Foreign study** | `level`: Undergraduate, Graduate, PhD, Short Course, Other; `country` |
| **Courses/programs** | Admissions `program` / `degree`; institutions `programs[]` |

### Career and editorial

| Entity | Categories |
|--------|------------|
| **Blog** | Free `category`; seed `BLOG_CATEGORIES`: Jobs, Scholarships, Admissions, Career, Exam Prep, Study Abroad, Technology, Student Life |
| **Career articles** | Free `category`; seed `CAREER_CATEGORIES`: Career Path, Interview Tips, Resume, Skills, Networking, First Job, Freelancing, Government Jobs |
| **Help / FAQ** | CMS HTML or fallback components—no strict enum in code |
| **Exam prep** | `Exam` + `Mcq.subject` from seed `MCQ_SUBJECTS`: General Knowledge, English, Mathematics, Pakistan Studies, Islamiyat, Computer Science, Current Affairs |
| **Assessments** | `categorySlug` + `DEFAULT_ASSESSMENT_CATEGORIES` in `shared/career/assessmentConstants.js`; `family`: `general_employment`, `technical`, `professional` |

**There is no separate “learning module” category enum**—Recommended Learning uses catalog `type`: `assessment`, `resource`, `milestone`.

---

## Part 3 — Current production content audit

### Seed and boot behavior

| Mechanism | Idempotent? | Overwrites admin? | Runs on Render boot? |
|-----------|-------------|-------------------|----------------------|
| `seed/jobPlans.js`, `cmsSiteContent.js`, `ensureAdmin.js` | Yes (insert-if-missing / upsert) | No (CMS insert-if-missing) | **Yes** (unless `CMS_SEED_ON_START=0`) |
| `npm run seed:launch` | Yes (skip existing `externalId`; upsert companies/unis) | No (skip-by-externalId) | **No** |
| `npm run seed:assessments` | Yes (by assessment slug) | No | **No** |
| `npm run seed` (`seed/index.js`) | **No** (`deleteMany` on jobs, scholarships, admissions, universities, blogs) | **Wipes** those collections | **No** |
| `seedUsers.js` | Skip if any users | No | No |

### Sample / demo marking

| Marker | Meaning |
|--------|---------|
| `externalId: launch-v1-job-*` | Launch generator jobs (`seedLaunchContent.js`) |
| `hr+{slug}@edurozgaar-seed.pk` | Launch employers |
| No `isDemo` field | Demo vs real must use **draft status**, **admin-only**, or **metadata** (e.g. `sourceUrl`, internal tags) in E.1 |

### Verification and expiry

| Check | Code behavior |
|-------|----------------|
| **sourceUrl on launch jobs** | Launch job seed **does not set** `sourceUrl` / `sourceWebsite` consistently—**beta public jobs need manual or E.1 curated records** with official links |
| **Expired opportunities** | Jobs/scholarships lists do **not** auto-filter `deadline < now` |
| **Assessment expiry** | Governed by assessment `status` and attempt rules—not listing deadlines |

### Collection coverage table (inferred)

| Collection | Typical prod source | Likely empty if… | Rerun safe seed |
|------------|--------------------|------------------|-----------------|
| `users` | signup, `ensureAdmin` | never (admin exists) | `seedUsers` skip |
| `cmshomepages`, `cmsstaticpages`, `cmsnavigations` | boot CMS seed | partial | boot insert-if-missing |
| `jobs` | admin, launch seed, employers | no launch + no admin | **only** `seed:launch` or manual |
| `scholarships`, `admissions` | same | same | `seed:launch` |
| `blogs`, `careerarticles` | admin / launch | low volume | `seed:launch` |
| `internships`, `webinars`, `institutions` | admin | often low | manual / E.1 |
| `exams`, `quizzes`, `mcqs` | launch seed / admin | exam-prep empty | `seed:launch` |
| `assessments`, `questionbanks`, `assessmentquestions` | **`seed:assessments` only** | **assessments UI empty** | `seed:assessments` |
| `assessmentattempts`, `opportunityapplications` | user actions | trackers empty for new users | N/A |
| `talentprofiles` | user onboarding | readiness widgets 0 | N/A |
| `searchdocuments` | indexer rebuild | search thin | rebuild after content |

**Stated production:** platform works but **lacks representative listing volume**; **assessments unavailable** strongly correlates with **unseeded `assessments` collection**; **learning** appears empty when **dashboard V2 widget off** or **assessment links 404**.

---

## Part 4 — Minimum beta content matrix

### Global rules

- **Public opportunities (beta):** real, verified, official `sourceUrl` or `applicationLink`, **future deadline**, attributed provider—**not** synthetic launch titles without disclosure.
- **Demo/synthetic:** `draft` or admin-preview only, or tagged `launch-v1` / internal beta banner—not mixed into SEO landings without relabeling.
- **Default targets:** ≥2 records per supported category/type; 3–5 for high-traffic list pages; 2 per dashboard state; 2 learning items per logical category (assessment + resource); 2 assessments per `family`; **8–10 original MCQs** per sample assessment (seed has 8 each—acceptable MVP, expand in E.3); 1 passing + 1 failing attempt on staging test account.

### Matrix (abbreviated)

| Surface | Categories / types to cover | Min records |
|---------|----------------------------|-------------|
| Jobs list | Government, Private, Internship; 3+ `JOB_CATEGORIES`; Remote on-site | 10 active (5 public-trust + 5 demo draft) |
| Scholarships | Each `level` × 2; Fully Funded + Partial | 8 active |
| Admissions | 3 institutions, 2 provinces | 6 active |
| Internships | paid/unpaid; 2 provinces | 4 active |
| Intl scholarships | 2 countries | 4 active |
| Blog | 4 of `BLOG_CATEGORIES` | 8 published |
| Career guidance | 4 of `CAREER_CATEGORIES` | 8 published |
| Exam prep | 2 `EXAM_NAMES`; 2 `MCQ_SUBJECTS` | 2 exams, 40+ MCQs total |
| Assessments | 2 per `family`; 2+ `categorySlug` each | 6 published (seed provides 11) |
| Institutions | each `type` enum | 4 active |
| Foreign study | 3 `FOREIGN_COUNTRIES` | 6 active |
| Universities | public + private | 4 active |
| Webinars | upcoming | 2 |
| Employers | verified + jobs | 2 employers, 4 jobs |
| Dashboard test user | profile 50%+ and 100%; 1 app; 2 assessment attempts | 2 users (staging) |

---

## Part 5 — Recommended Learning audit

### Flow

```
CareerDashboardPage
  → useDashboardComposition → GET /api/career/dashboard
  → DashboardCompositionService.recommendedLearningProvider
  → buildDeterministicLearningRecommendations(ctx)
  → RESOURCE_CATALOG (shared/career/learningRecommendations.js)
  → RecommendedLearningWidget
```

### Inputs to scoring

- Talent profile: goals, education, skills
- `ctx.assessments.recentAttempts` (failed categories boost related items)
- Credentials (verified categories deprioritize repeats)
- Readiness/scoring (`readinessGaps()`—**weak coupling**: expects `providers`/`breakdown`; dashboard payload uses **`factors`**)

### Admin workflow

**None for catalog items**—no admin UI to add learning modules. Staff can only influence indirectly via assessments (publish) and profile/scoring data.

### Root cause analysis (why “no useful content”)

| Hypothesis | Verdict |
|------------|---------|
| Empty Mongo collection | **N/A**—not DB-backed |
| Unpublished content | **Indirect**—catalog links to `/assessments/*` fail if assessments not `published` |
| Missing recommendation mappings | Catalog is fixed; personalization is rule-based only |
| API filter | Widget omitted if `CAREER_DASHBOARD_V2_ENABLED=0` or widget in `hiddenWidgets` |
| Feature flag | `VITE_CAREER_DASHBOARD_ENABLED=0` → 503 / legacy dashboard |
| Role restriction | Auth required for dashboard; catalog fetch is server-side in compose |
| Incomplete user preferences | Affects ranking, not empty list (fallback returns 3 default items) |
| Broken frontend query | `data?.items` empty only if provider throws or returns null |
| Missing admin controls | **Yes**—no CMS for learning paths |

**Controlled reproduction (no DB):**  
`buildDeterministicLearningRecommendations({ profile: {}, assessments: { recentAttempts: [] } })` returns **8 items** (`node` one-liner in audit session). So an empty widget implicates **composition/layout/flags**, not catalog starvation.

**User-perceived “no active content”:** links open **empty assessment catalog** or **404** when production lacks published assessments.

---

## Part 6 — Assessment system audit

### Stack

| Layer | Path |
|-------|------|
| Models | `Assessment`, `AssessmentCategory`, `QuestionBank`, `Question`, `AssessmentAttempt` |
| Service | `AssessmentService.js` |
| Routes | `server/src/routes/assessments.js` → `/api/assessments/*` |
| UI | `AssessmentsCatalog`, `AssessmentDetail`, `AssessmentTake` |
| Seed | `server/src/seed/assessments.js` — **11 slugs**, 8 MCQs each, auto-**publish** |

### Published slugs (seed)

`iq-fundamentals`, `logical-reasoning-basics`, `numerical-reasoning-basics`, `verbal-reasoning-basics`, `english-proficiency-basics`, `communication-skills-basics`, `computer-fundamentals`, `ms-office-basics`, `programming-fundamentals`, `problem-solving-basics`, `career-aptitude-basics`

### Talent rules

- List/detail/start: **`status: 'published'`** only
- Questions: `Question` with `status: 'active'` in bank
- Flags: `ASSESSMENTS_ENABLED`, `ASSESSMENT_RESULTS_ENABLED`, `VITE_ASSESSMENTS_ENABLED`
- Auth: all talent assessment routes require user auth

### Admin creation

`POST /api/assessments`, `POST .../publish`, question banks—`requireAdmin` on same router (not under `/api/admin`).

### Why no active tests in production

| Requirement | If missing |
|-------------|------------|
| `npm run seed:assessments` against Atlas | **Empty catalog** |
| `ASSESSMENTS_ENABLED` / client flag | 503 / “feature disabled” |
| Published + active questions | Start fails: “Assessment has no questions” |
| User logged in | Catalog page loads but take requires auth |

### Minimum for two end-to-end sample assessments

1. Run idempotent `seed:assessments` **or** admin-create 2 banks with **≥8 original MCQs** each, link banks, **publish**.
2. Confirm `GET /api/assessments` returns ≥2 for `family=general_employment`.
3. Staging user: start → submit → scored attempt; one pass, one fail.
4. Optional: credential issuance if `VERIFIED_CREDENTIALS_ENABLED` + documents platform on.
5. Expand to **10+ questions** per assessment in E.3 for beta quality.

**Copyright:** seed questions are original workplace/aptitude style—not NTS/IELTS copies.

---

## Part 7 — Dashboard tracker audit

### Architecture

- **Career OS:** `GET /api/career/dashboard` + widgets (`shared/career/dashboardWidgetRegistry.js`)
- **Legacy:** `GET /api/auth/dashboard` (`LegacyDashboard.jsx`)
- **Cache:** 120s per user on composition

### Tracker table

| Tracker | Widget / UI | API / service | Model | Trigger | Prod issue |
|---------|-------------|---------------|-------|---------|------------|
| Profile completion | `profile-summary`, `profile-completion` | Compose + `evaluateProfileCompleteness` | `TalentProfile` | Profile save | **Dual metrics**: server 9-field vs client weighted card; **widget ignores server `data`** |
| Onboarding | `OnboardingProvider` | `PATCH /api/auth/profile` | `User` | Wizard complete | Not on career dashboard |
| Applications | `applications-summary` | `OpportunityApplicationService` | `OpportunityApplication` | Apply flow | Legacy dashboard uses old `Application` model |
| Saved jobs | `/saved-jobs` only | `/api/auth/bookmarks` | `User` | Save action | **No career widget** |
| Resume progress | `ResumeEncouragementBanner`, documents | `ResumeVersion`, documents | `ResumeVersion` | Upload resume | No % widget |
| Learning progress | `recommended-learning` | Static catalog | — | N/A | Misaligned with assessments availability |
| Assessment progress | `recent-assessments`, `skill-gap`, `verified-skills` | `AssessmentService` | `AssessmentAttempt` | Submit attempt | **Titles not shown** in recent widget |
| Readiness | `readiness-score`, `career-health` | `ScoringService` | `ScoreSnapshot` | Recompute TTL | **Shows 0** when `missingProfile` not surfaced |
| Badges | `/badges` page only | `/api/badges/*` | `UserBadge` | Events | Not composed; leaderboard uses legacy `Application` |
| Notifications | `notification-center` | `UserNotification` | vs broadcast `Notification` | Inbox events | Split models → empty widget |
| Recommendations | `recommended-jobs`, etc. | **Latest active listings**, not `GET /api/v1/recommendations/:userId` | Job, Scholarship, Admission | N/A | **Not personalized** |
| Deadlines | `upcoming-deadlines` | Application `reminderReferences` | `OpportunityApplication` | User sets reminder | Empty without reminders |
| Activity | `timeline` | `TimelineService` | `TimelineEvent` | Career event bus | Disabled if timeline flag off |

### Reproduction notes (code-level, no hardcoded fixes)

1. **Profile mismatch:** Compare `evaluateProfileCompleteness(profile).score` with `ProfileCompletionCard` weighted % for same user—expect divergence.
2. **Readiness 0:** User with no `TalentProfile` → `ScoringService` returns `missingProfile: true`; `ReadinessScoreWidget` still displays **0/100**.
3. **Learning widget absent:** Set `VITE_CAREER_DASHBOARD_V2_ENABLED=0` → default V1 layout lacks `recommended-learning`.
4. **Assessments empty:** Atlas without published assessments → `/assessments` shows `assessments:empty`.
5. **No automated Jest tests** for `DashboardCompositionService`—use `scripts/verify-career-dashboard.mjs` / `verify-career-dashboard-v2.mjs` against running API for integration checks in E.4.

---

## Part 8 — Editorial and trust-page audit

| Page | Route | Source | Admin editable | Gap |
|------|-------|--------|----------------|-----|
| About Us | `/about` | CMS + i18n `About.jsx` | Site CMS | May still say EduRozgaar-era copy in i18n—verify Strideto branding |
| How It Works | **No dedicated route** | — | — | **Missing**—use CMS page or homepage block |
| Contact | `/contact` | Form + CMS | CMS + messages | Confirm production contact email/phone in CMS |
| Help Center | `/help-center` | CMS + fallback | Site CMS | Category structure not enforced in code |
| FAQ | `/faq` | CMS + fallback | Site CMS | |
| Privacy Policy | `/privacy-policy` | CMS + fallback | Site CMS | Legal review |
| Terms of Use | `/terms` | CMS + fallback | Site CMS | |
| Cookie Policy | `/cookies` | CMS + fallback | Site CMS | |
| Editorial Policy | **No route** | — | — | **Missing** |
| Corrections Policy | **No route** | — | — | **Missing** |
| Source Verification Policy | **No route** | — | — | **Missing** (critical for opportunities trust) |
| Job Scam & Safety Guide | **No route** | — | — | **Missing** |
| Employer Guidelines | **No route** | — | — | **Missing** (employer register may need link) |
| Community Guidelines | **No route** | — | — | **Missing** |
| Accessibility Statement | **No route** | — | — | **Missing** |
| Disclaimer / License / Refund | `/disclaimer`, `/license`, `/refund-policy` | CMS + fallback | Site CMS | Version dates often absent in fallback |

**Static pattern:** `StaticCmsPage` (`client/src/components/pageBuilder/StaticCmsPageRuntime`) loads `CmsStaticPage` by slug; falls back to React components with i18n keys under `static` / `seo` namespaces.

---

## Part 9 — Safe implementation plan

### Phase E.1 — Production-safe sample content seeding

| Item | Detail |
|------|--------|
| **Allowed files** | New `server/src/scripts/seedBetaContent.js`, `server/src/data/betaContent/*`, docs, tests; extend `package.json` script `seed:beta` |
| **Collections** | Jobs, Scholarships, Admissions, Internships, Blog, CareerArticle, Institution, Webinar, Company—**insert-only** with `betaTag` / `externalId` prefix |
| **Tests** | Idempotency test (second run no duplicates); contract test for required fields (`sourceUrl`, `deadline`) |
| **Seed behavior** | Upsert by `externalId`; never `deleteMany`; skip if `BETA_SEED_DISABLE=1` |
| **Rollback** | `deleteMany({ externalId: /^beta-/ })` script **staging only**; prod manual review |
| **Stop condition** | Matrix Part 4 met for listings; no destructive seed run |

### Phase E.2 — Recommended Learning activation

| Item | Detail |
|------|--------|
| **Allowed files** | `learningRecommendations.js`, `DashboardCompositionService.js`, widget copy, optional CMS links table (still no paid AI) |
| **Collections** | None required OR optional `LearningResource` if introduced—prefer minimal: fix `readinessGaps` to read `factors` |
| **Tests** | Unit tests for recommendation scoring + widget render with mock compose payload |
| **Stop condition** | V2 widget shows ≥3 items for new user; assessment hrefs resolve |

### Phase E.3 — Assessment activation and original sample tests

| Item | Detail |
|------|--------|
| **Allowed files** | `seed/assessments.js`, admin docs, optional 2 new banks |
| **Collections** | `assessments`, `questionbanks`, `assessmentquestions`, `assessmentcategories` |
| **Tests** | API test: list published ≥2; e2e start+submit on staging |
| **Seed behavior** | Run `seed:assessments` on production once (idempotent); expand question count to 10+ |
| **Rollback** | Archive assessments to `archived` status—no question delete |
| **Stop condition** | Catalog non-empty; 2 complete user journeys on staging |

### Phase E.4 — Dashboard tracker repairs and event verification

| Item | Detail |
|------|--------|
| **Allowed files** | Widgets (`ProfileCompletionWidget`, `ReadinessScoreWidget`, `RecentAssessmentsWidget`), `DashboardCompositionService`, `ScoringService` payload, optional wire `v1/recommendations` |
| **Collections** | Read-only except normal user events |
| **Tests** | Composition snapshot tests; `verify-career-dashboard-v2.mjs` in CI |
| **Stop condition** | Single profile % source of truth; readiness empty state; recommendations call documented API or rename widget |

### Phase E.5 — Editorial, help and trust content completion

| Item | Detail |
|------|--------|
| **Allowed files** | CMS seed slugs, new static fallbacks, routes for missing policies, `staticCmsPages.jsx`, i18n `static.json` |
| **Collections** | `cmsstaticpages`, `cmsnavigations` |
| **Stop condition** | All Part 8 pages routable; footer links; version dates |

### Phase E.6 — Closed beta readiness and test accounts

| Item | Detail |
|------|--------|
| **Allowed files** | `seedUsers` variant, docs, env examples |
| **Collections** | `users`, `talentprofiles`, sample attempts/applications **staging only** |
| **Stop condition** | 5 beta testers + checklist sign-off |

### Phase E.7 — n8n ingestion automation (draft-only)

| Item | Detail |
|------|--------|
| **Allowed files** | n8n workflows, scraper config docs, `ScraperConfig`/`ScraperRun`—**draft ingest only** |
| **Collections** | Jobs/admissions with `status: draft`, `approvalStatus: pending` |
| **Stop condition** | No auto-publish to public; human review queue in admin |

---

## Risks and blockers

| Risk | Mitigation |
|------|------------|
| Running `npm run seed` in production | **Forbidden**—document in runbooks; only `seed:launch` / `seed:assessments` / future `seed:beta` |
| Synthetic launch jobs without `sourceUrl` | Replace with verified records before marketing beta |
| Past deadlines cluttering lists | E.1 filter or admin close job; optional API `deadline >= now` |
| Tracker fixes without content | E.4 after E.1/E.3 so widgets have data to show |
| Trust pages missing | Legal/compliance blocker for public beta—E.5 |
| Dual notification systems | Product decision: merge inbox + broadcast for dashboard |
| n8n before content baseline | Defer E.7 until E.1 manual corpus exists |

---

## Verification performed (audit phase)

| Check | Result |
|-------|--------|
| Route config read | `client/src/routes/index.jsx` |
| Models / seeds / APIs traced | Server `src/models`, `src/seed`, controllers |
| Learning engine smoke | `buildDeterministicLearningRecommendations` → 8 items locally |
| Dashboard / assessment code paths | Documented above |
| Production DB counts | **Not queried**—recommend Atlas script before E.1 |

---

## Out of scope (confirmed)

- Implementation, production seed execution, commits, pushes, deploys, n8n enablement, fictional public opportunities, copyrighted assessment items.
