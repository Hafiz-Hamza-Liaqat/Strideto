# Strideto Mission 9 — Action Engine / Journey Planner / Next Best Action

> **Status:** Implemented (source-complete, not deployed).  
> **Scope:** Deterministic action/task engine, checklists, saved items, deadlines, education application tracker,
> journey planner, and Next Best Action. Self-managed mode only.  
> **Authority:** Subordinate to frozen product spec, execution roadmap, engineering guardrails.
> Preserves Missions 0–8 unchanged.

---

## 0. Purpose & principles

Mission 9 answers:

- What should I do next?
- What deadline is approaching?
- What requirements am I still missing?
- Which opportunities am I actively pursuing?
- What tasks must I complete?
- Where am I in my application journey?

**No AI/LLM decisions.** No fabricated scores. No admission guarantees. No scholarship probability claims.  
All evaluation is deterministic and explainable. All priority weights are explicit and testable.

---

## 1. Shared engine

**Location:** `shared/action/actionEngine.js` (pure, isomorphic — no DB dependencies)

### 1.1 Exports

| Export | Purpose |
|---|---|
| `ACTION_TYPES` | task/action type vocabulary |
| `ACTION_STATUSES` | todo, in_progress, completed, dismissed |
| `PRIORITY_LEVELS` | critical, high, medium, low |
| `URGENCY_LEVELS` | overdue, urgent, soon, upcoming, none, unknown |
| `DEFAULT_URGENCY_THRESHOLDS_DAYS` | configurable (urgent=7, soon=30, upcoming=90) |
| `DEADLINE_SOURCE_TYPES` | scholarship_cycle, program_intake, test, user_created, … |
| `EDUCATION_APPLICATION_STATUSES` | full lifecycle (interested → completed/rejected/withdrawn) |
| `EDUCATION_APPLICATION_TARGET_TYPES` | program, canonical_scholarship, other |
| `EDUCATION_APPLICATION_MODES` | self_managed (M9); agent_managed_future, direct_integration_future reserved |
| `JOURNEY_STAGE_IDS` / `JOURNEY_STAGE_ORDER` | 6-stage ordered journey |
| `ALERT_TYPES` | saved_scholarship_deadline, saved_program_deadline, test_deadline, … |
| `NBA_PRIORITY` | explicit numeric hierarchy (lower = higher priority) |
| `SAVED_OPPORTUNITY_TYPES` | program, canonical_scholarship |
| `CHECKLIST_TARGET_TYPES` | program, canonical_scholarship, application, general |
| `CHECKLIST_ITEM_STATUSES` | pending, completed, skipped |
| `DOCUMENT_REQUIREMENT_TYPES` | transcript, passport, cv, recommendation_letter, … (identifiers only) |
| `classifyDeadlineUrgency(deadlineAt, isDateOnly, thresholds, now)` | deterministic urgency |
| `identifyProfileGaps(profile)` | returns gap identifiers from profile snapshot |
| `buildJourneyPlan(inputs)` | derives 6-stage journey plan deterministically |
| `computeNextBestAction(inputs)` | deterministic priority engine → single highest-priority action |

---

## 2. Action / Task model

**Location:** `server/src/models/action/UserAction.js`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | Owner — from server auth |
| `title` | String | Required, max 300 |
| `description` | String | Optional |
| `actionType` | Enum | ACTION_TYPES values |
| `status` | Enum | todo / in_progress / completed / dismissed |
| `priority` | Enum | PRIORITY_LEVELS values |
| `dueAt` | Date | Optional; null = no due date |
| `timezone` | String | IANA identifier when dueAt has timezone context |
| `relatedEntityType` | String | e.g. 'program', 'scholarship' |
| `relatedEntityId` | ObjectId | Reference to related entity |
| `source` | Enum | 'system' / 'user' |
| `completedAt` | Date | Set when status → completed |
| `dismissedAt` | Date | Set when status → dismissed |

---

## 3. Checklists

**Location:** `server/src/models/action/UserChecklist.js`

Each checklist (`UserChecklist`) has embedded items with stable `_id` ObjectIds.

| Item field | Notes |
|---|---|
| `label` | Required, max 500 |
| `status` | pending / completed / skipped |
| `dueAt` | Optional |
| `requirementRef` | Points to official requirement (e.g. ProgramRequirement) — read-only reference |
| `documentRequirementType` | Document placeholder identifier (Mission 10 stores actual files) |
| `source` | 'system' / 'user' |
| `order` | Display ordering |

**Rule:** User completing a checklist item does NOT modify the underlying official requirement.
System-generated items' `requirementRef` is read-only; only `status` and `dueAt` are writable by user.

---

## 4. Saved opportunities

**Location:** `server/src/models/action/SavedOpportunity.js`

Standalone model for Programs and CanonicalScholarships. Separate from the existing
`User.savedJobs/savedScholarships` arrays (which serve legacy opportunity types and are preserved unchanged).

- Deduplication: compound unique index `(userId, entityType, entityId)` — save is idempotent
- Supports `entityType`: `program` | `canonical_scholarship`
- Optional `notes` field
- Ownership: server derives userId from JWT — no caller-supplied userId

---

## 5. Deadlines / Calendar

**Location:** `server/src/models/action/UserDeadline.js`

**UTC + timezone identity policy:**

| Situation | Handling |
|---|---|
| Exact time known | `deadlineAt` = UTC Date, `isDateOnly: false` |
| Source provides date only | `deadlineAt` = date as UTC start of that day, `isDateOnly: true` |
| Deadline unknown | `deadlineAt: null` — stays null, never invented |
| Source specifies timezone | Stored in `timezone` (IANA) — never silently assumed |

Urgency is classified by `classifyDeadlineUrgency()` — see §1.1.

**Calendar API:** `GET /api/journey/deadlines?from=&to=&status=&page=&limit=`  
Supports date range filter, urgency filter, and pagination.

---

## 6. Education Application Tracker

**Location:** `server/src/models/action/EducationApplication.js`

Explicitly named to avoid collision with the employer `Application` model (`server/src/models/Application.js`),
which tracks job applications and must not be modified.

### 6.1 Lifecycle

```
interested → preparing → ready_to_apply → submitted → under_review
             → interview_or_assessment → offer_or_admitted → completed
             → rejected / withdrawn
```

### 6.2 History

Status transitions are **appended** to `history` — never overwritten. Provides full audit trail.

### 6.3 Truthfulness

`submittedAt` is set only when the user explicitly records submission.  
Strideto does not claim to have submitted an application on behalf of the user.  
The UI note: *"Submission is handled directly with the institution."*

### 6.4 Mode

Mission 9 enforces `mode: 'self_managed'` only. `agent_managed_future` and `direct_integration_future`
are reserved identifiers, not wired up.

---

## 7. Journey Planner

**Location:** `shared/action/actionEngine.js → buildJourneyPlan()`  
**Service:** `server/src/services/actionEngineService.js → getJourneyPlan()`

The journey plan is **derived on demand**, not stored as a blob.

### 7.1 Six stages

| Stage | ID | Status drivers |
|---|---|---|
| 1 | `complete_profile` | profileGaps length |
| 2 | `explore_opportunities` | savedOpportunities length |
| 3 | `meet_requirements` | Mission 8 criticalGaps / majorGaps |
| 4 | `prepare_materials` | pending DOCUMENT-type actions |
| 5 | `apply` | educationApplications in active statuses |
| 6 | `track_outcome` | applications in review/offer statuses |

### 7.2 Goal-awareness

`goalTypes` from the user's study goals shapes descriptions (e.g. scholarship-specific language when
`goalType === 'scholarship'`). No irrelevant steps are added for non-applicable goal types.

### 7.3 Mission 8 integration

`buildJourneyPlan` consumes `eligibilityGaps.criticalGaps` and `eligibilityGaps.majorGaps` from
Mission 8's `getProfileGapAnalysis()` — it does NOT duplicate eligibility evaluation logic.

---

## 8. Next Best Action

**Location:** `shared/action/actionEngine.js → computeNextBestAction()`  
**Service:** `server/src/services/actionEngineService.js → getNextBestAction()`

### 8.1 Priority hierarchy (explicit, testable)

| Priority score | Category | Example |
|---|---|---|
| 1 (SAFETY_CRITICAL) | Overdue hard deadline | Application deadline passed |
| 2 (IMMINENT_HARD_DEADLINE) | ≤7 days urgent deadline | Scholarship closes in 3 days |
| 3 (BLOCKING_ELIGIBILITY_GAP) | Critical Mission 8 gap | GPA below threshold |
| 4 (ACTIVE_APPLICATION_REQUIREMENT) | Pending doc/app action | Upload CV for live application |
| 5 (IMPORTANT_PROFILE_GAP) | Profile incomplete | Education history missing |
| 6 (APPROACHING_DEADLINE) | ≤30 days deadline | Deadline in 20 days |
| 7 (SAVED_OPPORTUNITY_ACTION) | Saved with no application | Start tracking interest |
| 8 (EXPLORATION) | General exploration | (future expansion) |

### 8.2 Output shape

```js
{
  priorityScore,      // NBA_PRIORITY value
  priority,           // PRIORITY_LEVELS value
  action,             // Short action label
  reason,             // Plain English explanation
  entityType,         // Related entity type
  entityId,           // Related entity id
  dueDate,            // null when not applicable
  sourceType,         // Deadline source type when applicable
  freshnessWarning,   // From source record when applicable
  ctaRoute,           // Client route hint
}
```

### 8.3 Language policy

No guarantee, probability, or admission assurance language appears in any output field.

---

## 9. Urgency classification

`classifyDeadlineUrgency(deadlineAt, isDateOnly, thresholds, now)`

Thresholds are configurable via `DEFAULT_URGENCY_THRESHOLDS_DAYS` (urgent=7, soon=30, upcoming=90).

Date-only deadlines: classification is done by calendar day difference without inventing a time.
Unknown deadlines (`deadlineAt: null`) → `URGENCY_LEVELS.UNKNOWN`.

---

## 10. Alert foundation

**Location:** `server/src/models/action/AlertPreference.js`

Stores per-alert-type opt-in/opt-out preferences for authenticated users.

Alert types: `saved_scholarship_deadline`, `saved_program_deadline`, `test_deadline`,
`application_milestone`, `task_reminder`.

**Delivery is disabled.** No email, SMS, push, or WhatsApp is sent. No worker is started.
This model establishes the subscription layer for future Mission delivery execution.

---

## 11. Document Vault boundary

Mission 9 represents document requirements as **identifiers/placeholders** only:

- `DOCUMENT_REQUIREMENT_TYPES` constants (transcript, passport, cv, …)
- `documentRequirementType` field on checklist items
- No file storage, no upload API, no binary content

**Mission 10 (Secure Document Vault)** owns all file storage, upload, and secure sharing.

---

## 12. Privacy / Ownership

- All models (`UserAction`, `UserChecklist`, `SavedOpportunity`, `UserDeadline`, `EducationApplication`, `AlertPreference`) are user-owned.
- Server derives userId from JWT (`req.user.userId`) — callers cannot supply an arbitrary userId.
- Cross-user access blocked at service level (all queries include `userId` filter).
- Employer realm is not impacted; employer `Application` model is unchanged.
- No sensitive task/journey data logged.

---

## 13. API surface

All endpoints: `GET|POST|PATCH|DELETE /api/journey/...` — require user auth.

| Group | Endpoints |
|---|---|
| Dashboard | `GET /journey/dashboard` |
| Journey | `GET /journey/plan`, `GET /journey/next-action` |
| Tasks | CRUD `/journey/actions`, `/journey/actions/:id/status` |
| Checklists | CRUD `/journey/checklists`, items via `/journey/checklists/:id/items/:itemId` |
| Saved | CRUD `/journey/saved`, `/journey/saved/:type/:id/status` |
| Deadlines | CRUD `/journey/deadlines` |
| Applications | CRUD `/journey/edu-applications`, `/journey/edu-applications/:id/status` |
| Alerts | `GET|PUT /journey/alert-preferences` |

---

## 14. Client UX

| Route | Component | Purpose |
|---|---|---|
| `/journey` | `JourneyDashboard` | Aggregated action dashboard |
| `/journey/tasks` | `TasksPage` | Task CRUD with status/type filter |
| `/journey/deadlines` | `CalendarPage` | Deadline list with urgency indicators |
| `/journey/applications` | `ApplicationsPage` | Education application tracker |
| `/journey/saved` | `SavedOpportunitiesPage` | Saved programs/scholarships |

All pages: loading / error / empty states, mobile responsive, theme-aware.

---

## 15. Tests

**Location:** `server/src/__tests__/actionEngineJourneyPlanner.test.js`

50 tests, pure contract (no DB, no network). Covers:

- Constants completeness
- Urgency classification (all levels, configurable thresholds, date-only)
- Profile gap identification
- Journey plan stage order, status derivation, goal-awareness, progress
- Mission 8 gap integration (non-duplication)
- Next Best Action priority hierarchy (all 8 levels)
- Completed/dismissed exclusion
- Freshness warning propagation
- No-guarantee language enforcement
- Application lifecycle constants
- Document requirement placeholders
- Alert type completeness
- Saved opportunity types

Run: `node src/__tests__/actionEngineJourneyPlanner.test.js`  
Result: **50/50 passed**

---

## 16. Regressions

- Mission 8 `personalizationService.getProfileGapAnalysis` consumed (not modified)
- Mission 7 Program/ScholarshipCycle schemas unchanged
- Mission 3 TalentProfile unchanged
- Employer `Application` model unchanged
- No full suite run (no evidence of cross-mission impact)

---

## 17. No live operations

- No live migrations — Mongoose creates indexes on first connection
- No worker started
- No email, SMS, push, or WhatsApp sent
- No live data mutated
- No deployment

---

## 18. Deferred to later missions

| Capability | Mission |
|---|---|
| Secure Document Vault (file storage, upload) | Mission 10 |
| Agent Portal / Case Management | Mission 11 |
| Agent Marketplace | Mission 12 |
| Consultations / Messaging | Mission 13 |
| AI Copilot | Mission 19 |
| Alert delivery execution (email/push) | Post-Mission 9 worker extension |
