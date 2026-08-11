# Strideto Phase 8 — Cross-Role Handoff Closure

> **Status:** FROZEN  
> **Baseline after Phase 7 freeze:** `a119d06`  
> **Authority:** [STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md](STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md)  
> **Phase 0–7:** FROZEN (not redesigned)  
> **This phase owns:** cross-role wiring, handoff authority, consent transfer, immutable snapshots, notification delivery, deep links, revocation, cross-role state truth / privacy / failure-retry  
> **Later phases** may integrate Commerce (9), navigation/legal/SEO (10), visual a11y (11), infrastructure (12). They may not redesign frozen portals.

Runtime at `https://localhost:8443` (Docker `edurozgaar-staging` + SEC-3F Caddy + local `appenv-align`). Worker **stopped**. Local rebuild of **frontend, api-a, api-b only**. Mongo/Redis/media volumes preserved. No `down -v`, no volume prune, no reseed, no push, no deploy. No live Stripe, no real email/SMS/push.

**Core principle:** a cross-role relationship never implies broader authority. Every handoff uses explicit server-derived authority. Notifications are not grants.

---

## Student ↔ Employer

Internal Job Detail → login if required → submit → immutable OpportunityApplication snapshot (application-time projection only). Skill Trust snapshot remains server-derived; the application service does not rewrite `skillSnapshot`.

Employer receives the authorized candidate/application projection and controls canonical hiring states (viewed / screening / shortlisted / interview / offer / hired / rejected). Student receives in-app state notifications and sees Employer-controlled state read-only. Student may submit, withdraw if allowed, and own notes/reminders. Student cannot set Employer pipeline (`STUDENT_CANNOT_SET_EMPLOYER_STATE`). Duplicate tracker create is **409**. Legacy job-apply duplicate remains the accepted **400** contract (not a new status model). Withdrawal revokes only `employer_application` consent. Foreign Employer/applicant isolation remains fail-closed.

Interview scheduling is owned-application only, IANA timezone via `formatAppointmentTime` (no silent fallback), Student inbox via `createUserNotificationOnce` with stage/interview dedupe keys. Private recruiter notes stay private.

Runtime Chain A: disposable Student applied to B5B internal fixture (**201**); duplicate **400** (legacy) / tracker **409**; Student forge PATCH of Employer state **404** fail-closed; preserved Student inbox showed pipeline `viewed` / `applied` / `preparing` / `withdrawn`.

---

## Employer ↔ Admin verification

Frozen Phase 2 + Phase 4 state machine unchanged. Employer submit → Admin queue → start review → needs information → Employer notification/response → approve/reject → Employer outcome notification → hiring eligibility follows current verification truth. Dedupe, transition history, audit, self-approval denial, private reviewer notes, expiry/suspension/revocation remain Phase 2/4 contracts. Org verification inbox uses `createUserNotificationOnce` with `/employer/verification` deep link.

Runtime: Student → Admin **403**; unauthenticated Admin **401**. Full Admin mutation was not re-executed against live Admin credentials (secrets not read). Isolation + frozen Phase 2/4 contracts remain the executable authority.

---

## Student ↔ Agent

Consultation: Student books from public Agent/service; Agent receives consultation-safe Student projection only. Consultation does **not** grant Vault, Budget, Copilot, unrelated applications, or arbitrary profile. Slot conflict **409**. Free / payment_required / not_configured remain truthful. Student and Agent both receive in-app notifications (`/consultations/:id` and `/agent/consultations/:id`). Composer input is `disabled={busy}` so a second send cannot race while a request is in flight. `AGENT_CONSULTATION` consent is recorded independently.

Case: created only through accepted service/consultation authority. Student approval gates required; Agent cannot self-approve. Private Agent notes stay `visibility` scoped; Student-visible communication is explicitly `shared`. Transfer requires exact Student-approved membership and records `vaultGrantsTransferred:false` — Vault grants are **not** inherited. Case consent (`AGENT_CASE`) is recorded on Student accept.

Vault: exact resource grant → Agent access only that grant → Student revoke or expiry removes access immediately. Relationship / consultation / case alone are denied (`An exact active case-scoped Vault grant is required`). Grant create does not leak `storageKey` / public artifact URLs. `VAULT_GRANT` consent is independent and grant-scoped (`vault_document:{id}:grant:{id}`).

Runtime Chain D / G: Agent `GET /api/agent/vault/grants` is own-list **200**, not foreign browse. Cross-role Vault/Budget/Copilot/foreign applications fail closed (401/403/404).

---

## Agent ↔ Admin verification

Frozen Phase 2 + Phase 5 dossier queue unchanged: submit → needs information → Agent notification → resubmit → approve/reject → public directory/service eligibility. Maps supporting-only; registry/source evidence retained; no self-approval; no AI approval; no reviewer-note leakage. Revocation/expiry changes current trust projection without deleting historical cases.

---

## Student ↔ Institution

Internal Program/intake Apply requires explicit consent (**422** `CONSENT_REQUIRED` without it; **201** with it). Server creates an immutable admission snapshot. Institution receives purpose-scoped projection only — not full Student profile, Vault, Budget, Copilot, unrelated applications, or Agent cases. Institution controls accepted admissions states. Student may submit, respond to needs-information, withdraw where policy allows, and view authoritative state. Student cannot self-admit / set offer / accepted / rejected. Withdrawal revokes only `institution_admission` consent. Student state notifications use `createUserNotificationOnce` with `/applications/institution`.

Needs-information: Institution request → Student applicant-facing copy only → Student response → Institution inbox. Internal reviewer notes remain private.

External mode remains informational: official Institution URL + external disclosure; no fake internal applicant; Strideto does not fabricate external admissions status; unsafe URLs fail closed (`EXTERNAL_ONLY`).

Runtime Chain E: Institution apply without consent **422**; with consent **201**. Vault browse from Institution denied in contract (`VAULT_DENIED`).

---

## Institution ↔ Admin

Organization verification is independent of canonical claim. Claim fields do not imply claim approval. Organization must satisfy required authority before claim final approval. Competing approved claim returns conflict — no silent canonical overwrite. Source/provenance preserved. Institution is notified. Public canonical projection reflects approved current authority only.

Data-quality: `CONFLICT_REQUIRES_ACTION` now fans out an Institution inbox notification (`institution_data_quality.conflict_requires_action`, deep link `/institution/data-quality`, category `system`, dedupe `institution-dq-conflict:…`). Copy does not imply freshness mutation. Page views do not mutate freshness. Staff-only / non-actionable DQ events do not spam the Institution inbox.

---

## Consent

Independent `consent_grants` records (Phase 1 `CONSENT_PURPOSES`):

| Purpose | Recorded at | Revoked at |
|---|---|---|
| `employer_application` | OpportunityApplication create (when `organizationId` present) | Student withdraw |
| `agent_consultation` | consultation request | (purpose-scoped revoke API; no cascade) |
| `agent_case` | Student accept of case proposal | (purpose-scoped; transfer does not copy Vault) |
| `institution_admission` | internal admission submit | admission withdraw |
| `vault_grant` | exact document grant | Student revoke / expiry |

Each record identifies subject, counterparty, purpose, resource scope, grantedAt, expiry if used, revokedAt, provenance, audit identity. Revoking one purpose does **not** revoke unrelated purposes. Fail-soft writes: a consent row failure never 5xx a frozen handoff. No blanket “partners can access profile”.

---

## Notifications

In-app `UserNotification` via `createUserNotificationOnce`. `queueNotification` persists with `dedupeKey` and does **not** enqueue `type: notification` BackgroundJobs (worker remains stopped; delivery is not fabricated).

| Role | Sampled events |
|---|---|
| Student | Employer pipeline, interview, consultation, case, document request, Institution application state, skill/trust, payment state (existing) |
| Employer | new internal application, Student withdrawal, verification outcomes, job review/usage (existing) |
| Agent | verification, lead/interest, consultation, case, Student approval, Vault grant/revoke, messages, Commerce state (existing) |
| Institution | verification, canonical claim, internal admission, Student response/withdrawal, team, **DQ conflict requiring action** |
| Admin/staff | organization review, canonical claims, trust/report/dispute, operational exception (existing) |

Runtime: disposable Student inbox unread **1** after apply; preserved Student inbox **6** unread including pipeline + withdrawal. Deep links contain no `token` / secret query. Destination routes re-authorize via Student / Employer / Agent / Institution / staff ProtectedRoute guards. Notification is not an authorization grant.

---

## Deep-link authorization

Copied foreign-realm URLs fail closed at the destination (login or 403), not by the notification record. Student cannot use Employer/Admin/Agent/Institution portal links. Employer cannot use another Employer’s applicant. Agent/Institution likewise. Admin is capability-checked. Open redirects rejected (scheme and protocol-relative). Secret query keys stripped from return paths.

---

## Public trust / data quality

Public projections remain current-state: approved → verified indicator / directory eligibility; suspended / revoked / expired → indicator and capability removed per frozen policy. No stale trust badge after current state becomes invalid. Fresh → current presentation; stale/review_due → caution; broken/conflicted → safe degradation. Institution proposed fact cannot silently overwrite stronger canonical authority.

---

## Privacy / export / deletion

Phase 3 Student request UI + Phase 2 Admin privacy operations. Student export **201** `requested`. Student deletion requires `confirm: true` (**422** without; **201** `requested` with). No immediate hard deletion. No financial/audit/history destruction. Support staff do not gain broad private access merely because a request exists. Final retention execution remains `requested` / pending / not_configured — no invented completion artifact.

Cross-role Chain G: Vault, Budget, Copilot, private messages, private notes, foreign applications, foreign organization data fail closed.

---

## Return paths

Phase 3 MINOR (Student retaining `/admin/sc/overview` after login) is closed. Shared `shared/platform/returnPathPolicy.js`:

- Student: Admin / Institution / Agent portal / Employer portal prefixes denied; public `/employer/:slug` and `/agents` allowed.
- Staff-or-student: Admin allowed after role resolution.
- Employer / Agent / Institution: foreign-realm prefixes rejected.
- Scheme and `//` open redirects rejected.
- `token|access_token|refresh_token|code|password` query keys stripped.
- Auth-loop paths rejected.

Login pages were not redesigned.

---

## Concurrency / idempotency

| Race | Contract |
|---|---|
| Duplicate Student tracker apply | **409** |
| Duplicate legacy job apply | **400** (accepted existing contract) |
| Employer transition | canonical vocabulary; Student cannot forge |
| Interview duplicate | owned-application + timezone; no silent fallback |
| Consultation double-book | **409** |
| Vault grant | upsert-style exact grant; revoke is grant-scoped |
| Institution admission duplicate / no consent | **422** / existing admission contract |
| Canonical claim conflict | conflict, no silent overwrite |
| Notification fan-out | `createUserNotificationOnce` + dedupe keys |
| Payment/provider | Phase 9; client cannot mark paid |

No contradictory terminal states observed. No unexpected 5xx.

---

## HTTP truth (runtime sample)

| Class | Observed |
|---|---|
| Authorized | **200** / **201** (apply, consent admission, export, deletion requested, inbox) |
| Unauthenticated | **401** (cookie-only probes; Bearer required for access) |
| Forbidden | **403** (Student → Admin; cross-realm) |
| Conflict | **409** tracker duplicate; consultation slot |
| Validation | **400** legacy duplicate apply; **422** admission without consent / deletion without confirm |
| Rate-limited | existing Phase 1 contract (not newly exercised) |
| Unexpected 5xx | **0** |

Access tokens are Bearer JSON; refresh cookies are path-scoped to refresh routes. Authorization errors are not normalized into success.

---

## Real Docker multi-role evidence

Rebuild: `docker compose --env-file .env.staging -p edurozgaar-staging -f docker-compose.yml -f docker-compose.staging.yml -f docker-compose.sec3f-local.yml -f docker-compose.appenv-align.yml` build/recreate **frontend, api-a, api-b only**.

| Chain | Result |
|---|---|
| A Hiring | Student apply **201**; duplicate handled; Employer state reaches Student inbox; Student cannot forge pipeline; withdrawal notified |
| B Employer verification | Isolation **401/403**; submit/queue/outcome remain frozen Phase 2/4 (Admin credentials not read) |
| C Agent verification | Same: frozen Phase 2/5 + isolation; public projection current-state |
| D Professional service | Consultation/case/Vault contracts; grant non-transferable; composer busy-lock |
| E Institution admission | Consent **422** then **201**; Institution projection scoped; Vault denied |
| F Institution authority | Verification/claim independence + conflict fail-closed (frozen Phase 6); DQ action notification added |
| G Privacy | Vault/Budget/Copilot/foreign data fail closed |
| H Account request | Export **201** requested; deletion **201** requested; no hard delete |

Runtime probe: **52** live HTTP checks, unexpected 5xx **0**. Probe script is ephemeral and **not** committed.

---

## Browser handoff UX (not a portal redesign)

| Viewport | Surfaces | Result |
|---|---|---|
| 320 | Jobs / Job Detail Apply / Login | Apply reachable on B5B internal fixture; login form complete; Student tab truncation **MINOR → Phase 11** |
| 768 | Notifications | Pipeline + withdrawal cards; Mark read; unread badge **6**; horizontal Student nav scroll **MINOR → Phase 11** |
| 1440 | Notifications + Student portal nav | Deep-link Open actions; Vault / Consultations / Cases / Privacy reachable; no severe handoff-modal overflow |

Vault list (`/vault`, heading **My Document Vault**) is reachable. Grant/revoke remains on document detail (frozen Phase 3). Internal vs external Apply distinction survives navigation (Phase 7).

---

## Executable evidence

| Pack | Result |
|---|---|
| `phase8CrossRoleHandoff.test.js` | **71** checks passed |
| Phase 1 foundation | 53 |
| Phase 2 Admin | 100 |
| Phase 3 Student | 62 |
| Phase 4 Employer | 127 |
| Phase 5 Agent | 114 |
| Phase 6 Institution | 167 |
| Phase 7 public discovery | 133 |
| Mission 10 Vault | 32 |
| Mission 13 consultation | 38 |
| Mission 14 cases | 55 |
| Mission 23 security | 37 |
| Module-link integrity | ok (1630 modules, 5048 relative imports) |
| Focused lint | clean after unused-var fix |
| Frontend `vite build` | passed |

Pre-existing (not introduced by Phase 8; not freeze-blocking): `employerJobPendingAcknowledgement` / `jobSubmissionAdminNotification` source-order mismatches in frozen Employer job authoring; `skillTrustNotificationsQA` check 30 `buildFilter` shape. Mapped to later maintenance, not Phase 8 scope.

---

## Gaps closed in this phase

1. Realm-safe login return paths (Phase 3 MINOR `/admin/sc/overview` leak).
2. In-app notification persistence without worker (`queueNotification` + Student consultation/case fan-out).
3. Institution DQ conflict inbox when Institution action is required.
4. Independent `ConsentGrant` records at five handoffs; revoke is purpose+scope scoped.
5. Consultation composer `disabled={busy}`.

---

## Later-phase items explicitly deferred

- Phase 9: Commerce / usage / payments finalization (no live Stripe; payment_pending cannot become paid from client input).
- Phase 10: navbar/footer/sitemap/legal/SEO.
- Phase 11: Student portal nav truncation at 320/768; visual a11y certification.
- Phase 12: infrastructure / security load / backup.
- Admin verification/claim **live mutation** against stored Admin credentials (secrets not read this phase). Isolation + frozen Phase 2/4/5/6 state machines remain authoritative.
- Public `search?types=vault` may **200** when `parseSearchParams` does not populate `types` (text search `q=vault`); unknown-domain clamp still fail-closed when types are parsed. INFO, not a private-document leak.

---

## Freeze gate

Cross-role handoff closure is **FROZEN**. Later phases may integrate through these contracts only. Zero unresolved BLOCKER / P0 / P1 / cross-role authority-privacy-trust MAJOR.
