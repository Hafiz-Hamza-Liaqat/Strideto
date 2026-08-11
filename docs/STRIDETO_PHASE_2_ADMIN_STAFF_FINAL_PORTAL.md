# Strideto Phase 2 — Admin / Staff Final Portal

> **Status:** FROZEN (Modification Phase 2)  
> **Baseline after Phase 1 freeze:** `f126e8e`  
> **Authority:** [STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md](STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md)  
> **Phase 0:** FROZEN · **Phase 1:** FROZEN  
> **This freeze owns:** Admin / Moderator / SuperAdmin / scoped staff portal  
> **Later phases** may integrate through these contracts. They may not redesign this portal.

Runtime accepted at `https://localhost:8443` (Docker `edurozgaar-staging`, worker **stopped**).

---

## Final route / menu inventory

Human-readable sidebar. Dead Super-Control i18n keys (`scOverview`, `NAVGROUPSUPERCONT`, …) are removed. Pages are permission-filtered; frontend is advisory only.

### Admin / Operations

| Label | Route | Permission gate |
|---|---|---|
| Overview | `/admin/sc/overview` | `admin.system.read` **or** `admin.organizations.read` **or** `analytics:read` |
| Organizations | `/admin/sc/organizations` | `admin.organizations.read` |
| Organization dossier (list drill-in) | `/admin/sc/organizations/:id` | `admin.organizations.read` |
| Verification Queue | `/admin/verification-queue` | `verification:read` |
| Canonical Claims | `/admin/sc/claims` | `verification:read` |
| Trust Center | `/admin/sc/trust` | `admin.trust.triage` |
| Data Quality | `/admin/sc/data-quality` | `admin.data_quality.manage` |
| Commerce | `/admin/sc/commerce` | `admin.commerce.admin.read` |
| AI Operations | `/admin/sc/ai-ops` | `admin.ai.ops.read` |
| System Readiness | `/admin/sc/system` | `admin.system.read` |

### Moderation / Support

| Label | Route | Permission gate |
|---|---|---|
| Reports & Disputes | `/admin/sc/trust` | `admin.trust.triage` (same accepted Trust Center; not a second workflow) |
| Support / User Requests | `/admin/support` | `users:read` |
| Privacy / Legal Requests | `/admin/privacy-requests` | `users:read` |
| Moderation / Editorial Review / Agent Marketplace | existing routes | existing workflow/moderation perms |

### System

| Label | Route | Permission gate |
|---|---|---|
| Activity / Audit Log | `/admin/audit` | `audit:read` |
| Notifications (staff inbox) | `/admin/inbox` | authenticated staff |
| Profile / Security | `/profile` | authenticated |
| Broadcast notifications | `/admin/notifications` | `system:notifications` (composer, not inbox) |

Existing CMS / content / revenue / tools groups remain because those routes are real. They are not Super-Control redesign.

---

## Staff roles / capabilities

Server decides. `hasPermission` / `requireStaff` / `requirePermission`. Client-supplied role/status/`verifiedBy` is ignored.

| Capability | Moderator | Admin | SuperAdmin | Editor / other scoped staff |
|---|---|---|---|---|
| View verification queue | yes | yes | yes | no |
| Request more information / start review | yes (`verification:review`) | yes | yes | no |
| Approve organization verification | no | yes | yes | no |
| Reject | via review/approve paths per controller | yes | yes | no |
| Suspend | `moderate:suspend` (moderation) + verification suspend on Admin+ | yes | yes | no |
| Revoke organization verification | no | no | yes (`verification:revoke`) | no |
| Review canonical claims (read) | yes | yes | yes | no |
| Approve canonical claims | no | yes (`verification:approve`) | yes | no |
| Review skill verification | inspect/review, **not** issue verified | yes | yes | no |
| Revoke skill verification | no | no | yes | no |
| Resolve reports / trust disputes | triage | resolve | resolve | no |
| Financial actions (refund/payout/mark paid) | no | read + reconciliation manage; **cannot** mark paid/refunded/payout paid; **cannot** edit ledger | same plus SuperAdmin-only settings/secrets — still **no** live Stripe, **no** ledger edit | no |
| View system readiness | yes | yes | yes | no |
| Support tickets / privacy page | no (`users:read` is Admin+) | yes | yes | no |
| Vault / Copilot private / Budget / Agent private notes | denied | denied | **not universal**; `admin.privileged_support` is SuperAdmin-only and still fail-closed | denied |
| Reporter identity | withheld on Trust projections | withheld | withheld unless privileged-support policy path | n/a |
| Payment secrets / `system:secrets` | no | no | permission exists; System Readiness and AI Ops **do not expose** env/keys | no |

There is **no dedicated Support role**. Scoped staff already implemented: Editor (content), Moderator (triage), Admin, SuperAdmin.

Applicant / Employer / Agent / Institution **cannot** self-approve. AI **cannot** approve.

---

## Verification queue

Unified reviewer queue for Employer, Agent/Agency, and Institution.

**States:** draft, email_verified, verification_pending, under_review, needs_information, enhanced_review, approved, rejected, suspended, revoked, expired.

Default list = actionable (`verification_pending`, `under_review`, `needs_information`, `enhanced_review`). Explicit **All statuses** / per-state / type / country / dates / risk / canonical-claim-state / name-or-registration search. Does **not** search evidence bodies. Pagination via `useAdminList`.

Canonical-claim state is displayed beside org verification and is **not** merged into org status.

---

## Dossier

`GET /admin/verification/:organizationId` returns identity, registration/regulatory, representative, location, evidence metadata, credential policy, jurisdiction review mode.

- Google Maps / Business URL is **supporting evidence only** (UI disclaimer).
- No automated registry scrape. Copy: **Manual verification required**.
- Evidence: type, source URL, ref, submitted date, reviewer status, expiry. No public leak of private documents.
- Actions: start review, request information (reason required), enhanced review, approve, reject, suspend, revoke — all server-authorized, current-state validated, audited, concurrency-safe (`findOneAndUpdate` with expected status).

---

## Canonical claims

Separate from organization legitimacy.

Admin review shows requesting Institution, current org verification state, official name/country/domain, candidate, conflict/competing claim, provenance, history.

**Cannot approve** canonical publishing unless organization verification is approved. Competing approved claim → 409. No silent overwrite of canonical data.

---

## Notifications

`orgVerificationNotificationBridge` + `createUserNotificationOnce`.

Staff (`verification:read` only, never `notifyStaff()`):

- Employer / Agent / Institution verification submitted
- Resubmission after needs-information
- Enhanced review / expiry-due
- Canonical claim submitted / conflict

Organization/employer (when `legacyEmployerId` exists): needs information, approved, rejected, suspended, revoked, expired.

- Dedupe key includes organization/claim + type + transition + recipient.
- Deep links: `/admin/verification-queue?org=` and `/admin/sc/claims?claim=`.
- No internal reason / evidence body in title or body.
- **No email/SMS/push.** Worker remains stopped.

### Staff inbox (`/admin/inbox`)

Unread count from stored notifications, list, read, mark all read, category filter, pagination, empty/loading/error. Count is not invented.

---

## Trust

Accepted Skill Verification panel is unchanged.

Tabs: Reports, Disputes, Reviews, Skill Claims.

Professional-service disputes stay separate from financial/provider disputes. Trust dispute **never** triggers refund.

---

## Data Quality

Freshness queue (stale / review_due / broken / fresh), metrics, Institution conflicts.

Opening the page does **not** mutate freshness. No fake production-ready. No live external source checker.

---

## Commerce

Operational oversight, not a wallet. Reconciliation, connect accounts, refunds, ledger history.

Amounts server-authoritative. No PAN/CVV, no provider secrets, no live Stripe. Admin cannot mark payment paid, refund completed, or payout paid. Ledger immutable.

---

## AI Ops

In-process provider status only. Secret-like keys filtered. Student Copilot conversations and Vault contents are not shown. AI cannot mutate trust or payment authority.

---

## System Readiness

Runtime components use statuses such as `ready_for_internal_testing`, `not_configured`, `attention_required`, `unavailable`.

Not production certification. No env/secret dump. Worker expected **stopped** in this runtime.

---

## Support / privacy

Support tickets: existing `/admin/support` (Admin+).

Privacy page: scoped explanation + fail-closed boundaries. Account export/deletion **Student operational queue is Phase 3** — this page does not invent a fake list. No immediate destructive deletion.

---

## Audit

`/admin/audit`: actor, action, target, timestamp, status. No password/token/cookie/payment secret/raw private document.

---

## Runtime / browser evidence

| Check | Result |
|---|---|
| Admin login (disposable SuperAdmin) | pass |
| Reload on Canonical Claims | session held, no “Authentication required” |
| Overview cards | pending 2, under review 1, claims 1, unread 4, zeros truthful |
| Organizations | Employer/Agent/Institution inventory |
| Queue | Employer + Agent + Institution pending/under review visible |
| Dossier | identity, SECP registration, representative, Maps supporting-only, evidence, start-review → `under_review` + history |
| Canonical claims | Phase2 Disposable University submitted; org verification independent |
| Trust Center | Reports / Disputes / Reviews / Skill Claims |
| Data Quality | metrics + freshness + conflicts; no freshness mutation |
| Commerce | no secrets; empty recon truthful |
| AI Ops | `not_configured`; no secrets |
| System Readiness | API/DB ready_for_internal_testing; Redis attention_required (not probed); not certification |
| Inbox | 3 submit alerts + 1 claim; unread 4; no private reasons |
| Audit | verification transitions present; no secrets |
| Support / Privacy | tickets empty truthful; privacy fail-closed copy |
| Logout | `/auth/login`; subsequent `/admin/sc/overview` redirects to login |
| Labels | Overview, Verification Queue, Reports & Disputes, Block templates, Global blocks |
| Responsive | 320 / 375 / 768 / 1024 / 1440: no page-level overflow; mobile admin menu; table-scroll on dense tables |
| 200% zoom | table-scroll handles grid; public header crowding is Phase 1 chrome |
| Unexpected 5xx | 0 in Phase 2 HTTP/browser pass |
| Worker | stopped |

---

## Tests

| Suite | Result |
|---|---|
| Phase 2 focused `phase2AdminStaffPortal.test.js` | 100 passed |
| Phase 1 shared foundation | 53 |
| Mission 2 organization verification | 17 |
| Mission 18 institution portal | 50/50 |
| Mission 21 Admin Super-Control | 60/60 |
| Skill trust notifications | 34 |
| User secure auth flows | 56 |
| Mission 5 freshness | 51 |
| Skill claims | 39 |
| Mission 17 commerce | 54 |
| Mission 15 trust | 42 |
| Mission 23 security | 37 (+ orchestrated accepted suites) |
| Module-link integrity | clean (1550 modules) |
| Lint (touched Admin files) | 0 errors |
| Frontend `vite build` | succeeded |

---

## Unresolved items mapped to frozen future phases

| Item | Phase |
|---|---|
| Student-facing export/deletion request queue UX | Phase 3 — Student / Applicant |
| Employer portal verification applicant UX polish | Phase 4 — Employer |
| Agent portal verification applicant UX polish | Phase 5 — Agent |
| Institution portal claim-submit UX polish | Phase 6 — Institution |
| Public marketplace / CMS beyond Admin ops | later frozen phases |
| Live email/SMS/push delivery | out of scope while worker stopped / AI budget |
| Live Stripe / registry scrape | never in Phase 2; Commerce/Mission 17 remain fail-closed |

---

## Freeze gate

Admin / Staff is **FROZEN**. Later phases must not redesign this portal.
