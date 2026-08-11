# Strideto Phase 3 — Student / Applicant Final Portal

> **Status:** FROZEN (Modification Phase 3)  
> **Baseline after Phase 2 freeze:** `fe08036`  
> **Authority:** [STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md](STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md)  
> **Phase 0:** FROZEN · **Phase 1:** FROZEN · **Phase 2:** FROZEN  
> **This freeze owns:** Student / Applicant portal  
> **Later phases** may connect Employer, Agent, Institution, Commerce, Public, and cross-role workflows through these contracts. They may not redesign this portal.

Runtime accepted at `https://localhost:8443` (Docker `edurozgaar-staging` + SEC-3F Caddy, worker **stopped**).

Phases 0–2 were not redesigned. Public navbar labels, Job Detail, Employer/Agent/Institution portals, sitemap, License, live Stripe, and live email are out of scope.

---

## Final Student routes / navigation

Secondary **Student portal** bar (`STUDENT_PORTAL_NAV`). It does not change the global public navbar (Phase 10). Hidden on `/admin`, `/employer`, `/agent`, `/institution`, `/auth`.

| Label | Route | Notes |
|---|---|---|
| Dashboard | `/dashboard` | Career Command Center |
| Talent Profile | `/talent-profile` | Universal Student Profile |
| My Applications | `/applications` | Internal / external / institution filters |
| Journey | `/journey` | Mission 9 Action Engine |
| Saved | `/journey/saved` | Saved opportunities |
| Deadlines | `/journey/deadlines` | Calendar / reminders |
| Vault | `/vault` | Mission 10 owner surface |
| Consultations | `/consultations` | Student side only |
| Cases | `/cases` | Student side only |
| Messages | `/messages` | Contextual hub (consultation / case) |
| Notifications | `/notifications` | Phase 1 inbox |
| Budget | `/budget` | Mission 20 |
| Copilot | `/copilot` | Mission 19 |
| Privacy | `/account/privacy` | Consent, prefs, export/deletion |
| Account | `/profile#account-settings` | Password, logout, logout-all |
| Help | `/help/student` | Everyday guidance, not legal docs |

No dead nav items. Discovery pages (`/jobs`, Job Detail) remain public Phase 7/10 surfaces.

---

## Dashboard

Server-derived widgets only. Runtime showed:

- profile completeness (13% → checklist, not decorative)
- readiness score with deterministic explanation (“No AI is used in the numeric score”)
- application tracker (active / interviews / offers use **Employer-authoritative** counts on internal applications; personal tracker stages are not counted as Employer-confirmed)
- upcoming deadlines empty-state
- saved / recommended jobs from listings
- Vault / credentials empty-states
- notifications unread count
- Copilot / Budget / Privacy deep links

Loading / empty / error paths exist on widgets. Counters reconciled with `/applications/metrics`.

---

## Universal Student Profile

Accepted Mission 3 model. Sections:

Personal, Contact, Career, Education, Tests & Exams, Goals & Preferences, Experience, Skills, Languages, Certifications, Portfolio, Resume versions, Documents.

Runtime: no tab render crash. City `P3City-0811` saved, survived reload and logout/login. Unicode supported by accepted profile parser. Unknown legacy grading values remain user-correctable (`other` + deterministic aliases only). Validation names the field/record.

---

## Education / grading

Canonical systems only (`percentage`, `gpa_4`, `gpa_5`, `gpa_10`, `cgpa`, `grade_letters`, `igcse`, `ib`, `a_levels`, `o_levels`, `waec`, `cbse`, `icse`, `other`).

No guessed conversion (`78%` is not inferred; `4.2` is not GPA-5). Deterministic legacy aliases only (`percent` → `percentage`). No automatic GPA equivalence. Confirmed by `universalStudentProfile.test.js` (54).

---

## Skill Trust

Permanent invariant: **CLAIMED ≠ EVIDENCE_BACKED ≠ VERIFIED**.

Student may claim, self-report level, attach HTTPS-only evidence, submit for review, see history/expiry/revocation.

Student may **not** set status, score, verifiedBy, verifiedAt, or badge. Runtime: `POST /skill-claims` with trust fields → **403 `TRUST_FIELD_FORBIDDEN`**. GitHub/Figma/portfolio evidence max = EVIDENCE_BACKED. No external fetch. `applicantSkillClaimVerification.test.js` 39/39.

---

## Discovery / matching

Student-facing personalized views use accepted eligibility states. UNKNOWN never becomes eligible. No guaranteed admission/visa/scholarship/job wording. `personalizationEligibilityMatching.test.js` 61/61. Public Job cards / Job Detail not redesigned.

---

## Saved opportunities

`POST /journey/saved` 201; duplicate save returned the same id (idempotent). List 200. Saving ≠ applying. Owner isolation via Student auth. Deleted/unavailable sources remain list items without inventing the opportunity.

---

## Application authority (critical)

Shared contract: `shared/career/applicationAuthority.js`.

| Channel | Who writes workflow state | Student UI |
|---|---|---|
| **A. Internal employer** (`job`/`internship` + platform opportunity id) | Employer/server | Read-only Employer states |
| **B. External personal tracker** (`source=external` / manual / no opportunity id) | Student | **My tracking status** — “Application happens outside Strideto” |
| **C. Institution** (admission/scholarship/fellowship/graduate_program) | Student-writable set until Phase 6/8 own institution workflow | Student-side contract only |

Student-writable internal stages: `interested`, `preparing`, `applied`, `withdrawn`. Employer-authoritative: `viewed`, `screening`, `assessment`, `interview`, `offer`, `negotiation`, `accepted`, `joined`, `rejected`.

Runtime:

- Internal create 201 `stageAuthority=employer`
- `interested → preparing → applied` 200
- `applied → viewed` **403** (`STUDENT_CANNOT_SET_EMPLOYER_STATE`)
- `applied → interview` blocked (machine + authority)
- PATCH `pipelineStage` **403** (“Pipeline stage cannot be set via update”)
- Withdrawal `→ withdrawn` 200
- External `interested → preparing → applied → viewed` 200 as personal tracker
- Actor type forced to `talent` on Student transitions
- Snapshot remains server-derived

Kanban moves only when `stageAuthority === 'personal'`. Filters distinguish Internal employer / External tracker / Institution. Views: List, Kanban, Table, Calendar.

Institution portal features were **not** built here (Phase 6/8). Student explicitly consents per application; Institution receives only the submitted projection.

---

## Journey / deadlines

Mission 9 preserved. `/journey/dashboard` returns `nextBestAction`, pending actions, upcoming/overdue deadlines, active applications, saved opportunities. NBA is human-readable. Overdue items are not hidden. No AI-autonomous mutation.

Client now uses SEC-3 axios (`actionEngineService`) — in-memory access token + HttpOnly refresh. It no longer reads `localStorage.token` (which broke Journey after reload).

Date-only remains date-only. No Pakistan/Karachi fallback unless data says so (Phase 1/22).

---

## Vault

Mission 10 preserved. Owner lists `/vault/documents`. Foreign id → 404 `Document not found` (no leakage of storage keys). Grants are exact; SuperAdmin/Employer/Agent/Institution do not gain access by relationship alone. UI: documents, status, versions, grants, revoke. No public URL.

---

## Consultations / cases / messages

Student-side only. Empty states truthful. Messaging is contextual (`/messages` hub → consultation/case threads). No global DM. Private Agent notes remain hidden. Student approval remains authoritative (Mission 14). Phase 5 owns Agent portal redesign.

Reviews/reports remain verified-interaction-based (Mission 15). Professional dispute ≠ financial dispute. No automatic refund.

---

## Budget

Mission 20 preserved. `unknown ≠ zero`. Multi-currency grouped unless explicit FX snapshot. Verdict blocked when important costs unknown. Student-only. Client now uses `budgetApi` → SEC-3 axios (previously cookie-only fetch 401’d after reload).

---

## Copilot

Mission 19 preserved. Runtime `POST /copilot/ask`: `answerType=not_configured`, `groundingStatus=well_grounded`, evidence + `citedEvidenceIds`, no fabricated citations, provider `not_configured`. No Vault/eligibility/application/payment/verification mutation. Client uses axios session. No cross-user context.

---

## Notifications / preferences

Phase 1 inbox: `/inbox/notifications`, unread count, mark all, deep links. Application/export events appeared as unread on the Student bar. External personal-tracker changes are not labelled as Employer events.

Preferences: optional categories (jobs/scholarships/tests/promotions) may be off; transactional `applications` cannot be suppressed (`validateNotificationPreferences`). Email/SMS/push/WhatsApp shown as **not configured**. Mandatory/security/trust notices cannot be turned off.

---

## Privacy / consent / export / deletion

Independent scopes: `employer_application`, `agent_consultation`, `agent_case`, `institution_admission`, `vault_grant`. No blanket “share profile with partners”.

`GET /privacy/overview` returns scopes, consents/grants, requests, notification preferences, `channelsConfigured`.

Export: `POST /privacy/requests/export` 201; `artifactAvailable=false` (never a fake archive). Deletion: disposable Student 201 `status=requested`; not immediate delete; cancellable while requested; Admin queue is Phase 2 `/admin/privacy-requests`. Every request audited.

---

## Account / security

Phase 1 User realm. Password change, logout current, logout all (`POST /auth/logout-all`). Copy: refresh cookies stay HttpOnly; session identifiers are not displayed. Raw tokens never shown.

---

## Payments

Phase 9 owns Commerce finalization. Student help states free / payment_required / not_configured. No PAN/CVV. No homemade escrow. No new pricing. Copilot/consultations report `not_configured` truthfully where applicable.

---

## Help

`/help/student` explains profile use, skill trust, internal vs external applications, Vault grants, Agent services, notification prefs, privacy, export/deletion, payments. Phase 10 owns global Help/Legal.

---

## Search isolation

Student search/filter/sort on applications/journey/vault stay owner-scoped. Foreign application/vault ids 404. Budget, Copilot conversation, Vault content, private notes, and other Students are not searchable.

---

## Responsive / accessibility

Phase 1 semantic tokens (light/dark). High-risk pages checked at 320 (no page-level overflow), 375, 768 (table/kanban may horizontal-scroll — expected table handling), 1024, 1440 (no overflow), representative 200% zoom (table scroll). Skip link, labelled fields, `role=status/alert`, min 44px actions on new privacy/help surfaces. **Not** a WCAG certification claim.

---

## Executable evidence

| Suite | Result |
|---|---|
| Phase 3 focused `phase3StudentApplicantPortal.test.js` | **62 passed** |
| candidateInterviewOwnership | 33 |
| Applicant Skill Claim + Evidence | 39/39 |
| Universal Student Profile / grading | 54 |
| Mission 10 Vault | 32 |
| Mission 20 Budget | 56 |
| Mission 19 Copilot | 53 |
| Mission 13 consultations + messaging | 38/38 |
| Phase 2 Admin (privacy queue regression) | 100 |
| Mission 8 matching | 61 |
| Skill trust notifications | 34 |
| Mission 6 Test Acceptance | 40 |
| Module-link integrity | clean (1563 modules, 4773 imports) |
| Lint client + server | 0 errors (pre-existing warnings only) |
| Frontend `vite build` | succeeded (8.53s) |

HTTP contract: 2xx create/read, 400 invalid machine transition, 401 unauthenticated, 403 Employer-state / trust-field forbidden, 404 foreign resource, 409 duplicate where designed, 422 privacy validation, 429 mapped in shared `apiStateContract`, synthetic 500 mapped. **Unexpected 5xx = 0** in the Phase 3 Docker pass.

---

## Real-runtime evidence

| Check | Result |
|---|---|
| Student login | pass (preserved Phase 1 Student) |
| Dashboard | Student nav + truthful widgets |
| Talent Profile sections | all tabs, no crash |
| Safe field save | city persisted |
| Reload | city `P3City-0811`, session restored via refresh cookie |
| Logout / login | city still persisted |
| Skills | claim 201; self-verify 403 |
| Save opportunity | 201, duplicate idempotent |
| Internal application | 201 employer channel; viewed 403; withdraw 200 |
| External tracker | personal channel; viewed allowed as My tracking status |
| Journey NBA | 200, saved=1 |
| Vault | owner 200; foreign 404 |
| Consultations / cases / messages | operational empty states |
| Notifications | inbox + unread |
| Privacy / export | 201, no fake artifact |
| Deletion | disposable Student 201 `requested` |
| Budget / Copilot | 200; Copilot `not_configured` + evidence |
| Cross-user | foreign application 404; disposable profile does not show preserved city |
| Wrong realm | Student hitting `/admin/sc/overview` → Insufficient permissions (fail-closed) |
| Unexpected 5xx | 0 |
| Worker | stopped (Exited 7 days) |

Preserved Student account was not deleted or reseeded. Mutation-heavy deletion used a disposable verified Student.

---

## Deferred counterparty work

| Item | Phase |
|---|---|
| Employer portal / team / pipeline UX for authoritative states | Phase 4 — Employer |
| Agent portal redesign | Phase 5 — Agent |
| Institution portal + institution-authoritative workflow | Phase 6 — Institution |
| Public Job cards / Job Detail | Phase 7 |
| Cross-role handoff beyond Student contracts | Phase 8 |
| Stripe / live Commerce finalization | Phase 9 |
| Global navbar labels, sitemap, Help/Legal | Phase 10 |
| Live email / SMS / push | out of scope while worker stopped |
| Paid AI provider | AI budget policy; Copilot stays evidence-grounded `not_configured` |

---

## Unresolved (non-blocking)

| Severity | Item |
|---|---|
| MINOR | If a Student hits a leftover Admin URL before login, ProtectedRoute `from` may return them to `/admin/sc/overview`; the page fail-closes with Insufficient permissions and does not leak Admin data |
| MINOR | Applications table/kanban may horizontal-scroll at 768px and 200% zoom (table handling) |
| MINOR | Some validation errors serialize as generic `Request failed` while HTTP status remains 400/403 |
| INFO | Device/session **list** is intentionally not shown (no raw session ids); logout current + logout all are present |
| INFO | Local Docker `APP_ENV` must agree with `NODE_ENV=production` and HTTPS origin `https://localhost:8443` for AuthCookiePolicy (SEC-3F overlay). Do not commit local-only align files |

Zero unresolved BLOCKER / P0 / P1. Zero unresolved Student auth/privacy/trust MAJOR.

---

**STUDENT / APPLICANT is FROZEN.**
