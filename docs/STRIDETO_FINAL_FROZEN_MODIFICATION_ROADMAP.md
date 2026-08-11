# Strideto Final Frozen Modification Roadmap

> **Status:** FROZEN — Phase 0 lock authority.  
> **Baseline HEAD at lock:** `9c28ee4` (`fix(portals): close agent and institution onboarding runtime gaps`)  
> **Branch:** `main`  
> **Companion authority:** [STRIDETO_MASTER_PRODUCT_SPEC.md](STRIDETO_MASTER_PRODUCT_SPEC.md),  
> [STRIDETO_MASTER_EXECUTION_ROADMAP.md](STRIDETO_MASTER_EXECUTION_ROADMAP.md),  
> [STRIDETO_ENGINEERING_GUARDRAILS.md](STRIDETO_ENGINEERING_GUARDRAILS.md),  
> [STRIDETO_TRUST_VERIFICATION_POLICY.md](STRIDETO_TRUST_VERIFICATION_POLICY.md)

This document freezes **product modification phases 0–14**. It does not replace the
Mission 0–27 execution roadmap; it governs **final portal and platform convergence**
after mission delivery. Implement each phase once. Do not reopen frozen decisions
without the reopening rule below.

---

## Final role workflow map

| Role / realm | Primary portal | Auth realm | Organization model | Verification | Key workflows (frozen scope) |
|---|---|---|---|---|---|
| **Student / Applicant** | Student dashboard, applications, vault, profile | `user` | N/A (individual) | Email verification | Apply (internal/external), track status, privacy/consent, notifications, export/delete |
| **Employer** | Employer portal | `employer` | Employer organization + team (Owner/Admin/Recruiter/Viewer) | Organization verification | Jobs (internal Strideto + external URL), pipeline states, team invites, scholarships N/A |
| **Agent / Agency** | Agent portal | `agent` | Agent organization + team | Organization verification | Consultations, cases, marketplace, services, payouts (KYC-gated) |
| **Institution** | Institution portal | `institution` | Institution organization + team | Organization verification + canonical claim | Internal admissions (optional), own scholarships, programs, team |
| **Moderator** | Staff (subset) | `user` (staff role) | N/A | Review queue | Verification review — scoped capabilities only |
| **Admin** | Staff control center | `user` (staff role) | N/A | Review/ops | Scoped admin capabilities — never universal private-data authority |
| **SuperAdmin** | Staff super-control | `user` (staff role) | N/A | Policy override | Platform configuration — **not** universal private Student/Vault access |
| **Support / Legal** | Staff (explicit) | `user` (staff role) | N/A | Case tools | Audited, capability-scoped support — never broad Admin private-data access |
| **Public** | Marketing/discovery | none | N/A | N/A | Jobs, scholarships, admissions, institutions, tests — no vault/private indexing |

**Cross-cutting handoffs (frozen):** Employer application ↔ Student tracker; Agent consultation/case ↔ Student consent; Institution admission ↔ Student consent; Vault grant ↔ independent consent scope.

---

## Modification phases (0–14)

| Phase | Name | Scope |
|---|---|---|
| **0** | Final Business & Product Decision Lock | Freeze decisions; this document |
| **1** | Shared Platform Foundation Convergence | Auth/session, RBAC/tenant, theme tokens, API states, notifications, audit, search privacy, Money/usage, consent/privacy, account security, lifecycle, responsive/a11y primitives |
| **2** | Admin / Staff Final Portal | Staff UI, capability matrix, audited operations |
| **3** | Student / Applicant Final Portal | Profile, privacy, applications, vault UX |
| **4** | Employer Final Portal | Team, jobs, pipeline, verification UX |
| **5** | Agent / Agency Final Portal | Portal finalization consuming Phase 1 foundation |
| **6** | Institution Final Portal | Portal finalization consuming Phase 1 foundation |
| **7** | Public Discovery & Content Finalization | Job detail, discovery, content — **not** job card redesign |
| **8** | Cross-Role Handoff Closure | Application, consultation, admission, vault handoffs |
| **9** | Commerce / Usage / Payments Finalization | Pricing, quotas, payouts after KYC |
| **10** | Navigation / Help / Legal / SEO Finalization | Navbar labels, sitemap, legal pages |
| **11** | UI / Accessibility / International Acceptance | Role portal visual acceptance |
| **12** | Security / DevOps / Scalability / Operations | Hardening, ops |
| **13** | Final Real-Runtime Multi-Role Acceptance | End-to-end acceptance |
| **14** | Mission 27 Launch Certification | Launch gate |

**Do not implement phases 2–14 during Phase 1.**

---

## Approved ten decisions (frozen)

1. **Institution applications** — Support internal Strideto admission applications (institution-enabled) **or** official external application URL. Internal applications expose only Student information explicitly submitted/consented. Institution membership never grants broad Student/Vault access.

2. **Institution scholarships** — Verified + canonically claimed institutions manage their own scholarships. Other scholarships require authoritative source provenance. Agent statements are never authoritative scholarship facts.

3. **Institution pricing (launch)** — Registration, verification submission, institution profile, and canonical program management are **free**. No paid promotion/lead/advanced products until explicitly approved.

4. **Employer organization team** — Owner, Admin, Recruiter, Viewer with authority-scoped invitations.

5. **Agent monetization** — Students may pay for approved Agent consultations/services. Agent payout requires KYC/provider readiness. Strideto commission percentage remains configurable until explicitly set.

6. **Notifications at launch** — In-app mandatory. Critical transactional email only after controlled worker/provider acceptance. SMS/push **not** launch requirements.

7. **Public License / source-code presentation** — Remove public License page/navigation/source-code promotion unless legally required. Do not rewrite historical copyright to Hamza for branding. Preserve repository/third-party license notices. Copyright ownership established separately.

8. **Sitemap** — Human: `/sitemap`. Crawler: `/sitemap.xml`. No hard-coded `localhost:8080`. Do not publish internal product roadmap.

9. **Final navbar labels** — Keep existing route architecture unless technically necessary. Visible labels: Home, Jobs, Scholarships & Funding, Admissions & Intakes, Internships, Study & Institutions, Tests & Prep, Services.

10. **AI/n8n opportunity aggregation** — Permanently **OFF** for launch. No AI/n8n scraping of LinkedIn, Indeed, Rozee.pk, etc. Launchable opportunities: Employer-posted Strideto listings; clearly labelled external-application listings; controlled source-backed opportunities; approved official/partner feeds later. AI may assist with existing authoritative records only.

---

## Additional frozen workflows

- **Employer team management** — first-class.
- **Institution-owned scholarship management** — first-class.
- **Institution internal admissions workflow** — first-class where enabled.
- **Student privacy/account controls** — privacy preferences, consent, notification preferences, account/session security, export/delete request workflow — first-class.
- **Staff Support/Legal** — explicit, audited capabilities; never via broad Admin private-data access.
- **Organization verification notifications** — required across Employer, Agent, Institution.
- **Global search** — appropriate public/authorized domains only. **Must never index:** Vault, private messages, case private notes, Budget, Copilot conversations, internal reviewer reasons, payment secrets, private Student data.
- **Application-state authority:**
  - *Internal Strideto employer job:* Student controls withdraw + own notes; Employer controls authoritative pipeline states; Student must not fabricate Employer states.
  - *External application:* Student may maintain separately-labelled “My tracking status” — never represented as Employer-confirmed.
- **Data retention/archive** — semantics for revoked/expired verification, deleted-account requests, closed jobs, withdrawn applications, historical documents, audit records, financial records.
- **Consent boundaries** — independent for Employer application, Agent consultation/case, Institution admission, Vault grant.

---

## Frozen job / application authority

- Existing `/jobs` listing-card design is **accepted**. Do **not** redesign job listing cards.
- Job Detail finalized in Public Phase 7.
- Canonical field: `openingsCount`.
- Direct Employer-posted jobs: integer ≥ 1, server validated; applicant cannot control.
- Legacy job without value: display **“Openings: Not specified”** — never fabricate zero.
- Application count does **not** reduce openings.
- Future remaining-openings logic may derive only from authoritative hires.
- Employer external application URL allowed with clear outside-Strideto disclosure.

---

## Definition of Done (per phase)

A modification phase is **FROZEN** when:

1. All phase-scoped executable tests pass with real executed count recorded.
2. Shared foundations required by the phase are converged — not duplicated.
3. Real-runtime acceptance (where required) passes on local Docker (`https://localhost:8443`); worker remains stopped unless phase explicitly requires controlled worker acceptance.
4. No unresolved **BLOCKER**, **P0**, **P1**, or auth/privacy/security **MAJOR** findings remain in phase scope.
5. Phase report document exists listing reused vs fixed vs deferred (mapped to later phases).
6. Commits follow phase commit policy; no push/deployment without explicit operator approval.

---

## Reopening rule

A frozen decision or phase may be reopened **only** when:

1. A **BLOCKER** or **P0/P1** defect proves the frozen decision unsafe or unimplementable; **or**
2. Explicit **operator written approval** documents the change, version bump on this roadmap, and affected downstream phases.

Cosmetic preference, non-security refactors, and role-portal redesign urges **do not** reopen Phase 0–1 foundations. Defer to the assigned later phase.

---

## Phase 0 lock record

| Field | Value |
|---|---|
| Locked at HEAD | `9c28ee4` |
| Branch | `main` |
| Lock commit message | `docs(product): freeze final modification roadmap` |
| Protected historical docs (untouched) | `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`, `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md` |

**Next authorized phase after Phase 0:** Phase 1 — Shared Platform Foundation Convergence.
