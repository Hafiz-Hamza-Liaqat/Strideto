# Strideto Master Execution Roadmap (FROZEN)

> **Status:** Authoritative. Companion to
> [STRIDETO_MASTER_PRODUCT_SPEC.md](STRIDETO_MASTER_PRODUCT_SPEC.md),
> [STRIDETO_ENGINEERING_GUARDRAILS.md](STRIDETO_ENGINEERING_GUARDRAILS.md),
> [STRIDETO_TRUST_VERIFICATION_POLICY.md](STRIDETO_TRUST_VERIFICATION_POLICY.md).

## Mission sequence

The following missions are the frozen delivery sequence. Missions are ordered by
dependency, not by calendar. Each mission maps to one or more of the nine
engines defined in the product spec.

| # | Mission | Primary engine(s) |
|---|---|---|
| 0 | Existing Strideto / Employer stabilization | Employer, Admin |
| 1 | International Platform Foundation | (cross-cutting) |
| 2 | Trust & Organization Verification Foundation | Trust |
| 3 | Universal Student Profile | Personalization |
| 4 | Education Intelligence | Education Intelligence |
| 5 | Source Verification + Freshness | Trust, Education Intelligence |
| 6 | Test Acceptance Explorer | Education Intelligence |
| 7 | Scholarship + Program Intelligence | Opportunity, Education Intelligence |
| 8 | Personalization / Eligibility / Matching | Personalization |
| 9 | Action Engine / Journey Planner | Action |
| 10 | Secure Document Vault | Action, Trust |
| 11 | Agent / Agency Portal | Professional Services |
| 12 | Agent Opportunity Marketplace | Professional Services, Opportunity |
| 13 | Consultations + Contextual Messaging | Professional Services |
| 14 | Case Management | Professional Services |
| 15 | Verified Reviews + Reports + Disputes | Professional Services, Trust |
| 16 | Commerce Foundation | Commerce |
| 17 | Marketplace Payments | Commerce |
| 18 | Institution Portal | Trust, Education Intelligence |
| 19 | Evidence-grounded AI Copilot | (cross-cutting) |
| 20 | Budget / Cost Planner | Personalization, Commerce |
| 21 | Admin Super-Control Center consolidation | Admin |
| 22 | International Hardening | (cross-cutting) |
| 23 | Platform Security / Abuse Audit | Trust, Admin |
| 24 | Responsive / Accessibility / UX Acceptance | (cross-cutting) |
| 25 | Controlled Verified Data Launch | (cross-cutting) |
| 26 | Final Multi-Role Acceptance | (cross-cutting) |
| 27 | Launch Certification | (cross-cutting) |

## Mission detail

**Mission 0 — Existing Strideto / Employer stabilization**
Stabilize the already-shipped platform, principally the Employer Portal, by
closing the known defects surfaced by the PF-EMP audit series without expanding
into future-mission scope. Completion is recorded in
`docs/STRIDETO_MISSION_0_COMPLETION_REPORT.md`.

**Mission 1 — International Platform Foundation**
Introduce the ISO country/currency, IANA timezone, and international
phone/address contracts as first-class primitives so every later mission builds
on them. Retrofit existing Pakistan-specific assumptions behind these contracts
incrementally and reversibly.

**Mission 2 — Trust & Organization Verification Foundation**
Implement the verification state machine, evidence capture, granular badges,
re-verification/expiry, and moderator review defined in
[STRIDETO_TRUST_VERIFICATION_POLICY.md](STRIDETO_TRUST_VERIFICATION_POLICY.md).

**Mission 3 — Universal Student Profile**
A single portable profile spanning education history, test results, documents,
preferences, and goals that feeds matching, eligibility, and recommendations.

**Mission 4 — Education Intelligence**
Tests, universities, programs, requirements, and country intelligence as
structured, sourced data.

**Mission 5 — Source Verification + Freshness**
Every important claim carries a source and a last-verified date; freshness is
tracked and surfaced.

**Mission 6 — Test Acceptance Explorer**
Which countries, institutions, and programs accept each test, with minimum
scores and official sources.

**Mission 7 — Scholarship + Program Intelligence**
Structured scholarship and program data with eligibility and deadlines.

**Mission 8 — Personalization / Eligibility / Matching**
Matching, eligibility scoring, gap analysis, recommendations, and Next Best
Action.

**Mission 9 — Action Engine / Journey Planner**
Saved items/searches, alerts, deadlines, calendar, checklists, and the journey
planner.

**Mission 10 — Secure Document Vault**
Encrypted, user-owned document storage with granular, revocable access grants.

**Mission 11 — Agent / Agency Portal**
Verified professional portal for agents and agencies.

**Mission 12 — Agent Opportunity Marketplace**
Agents surface and manage opportunities for users.

**Mission 13 — Consultations + Contextual Messaging**
Paid/free consultations with contextual, auditable messaging.

**Mission 14 — Case Management**
Case objects with timelines tying user, agent, and opportunity together.

**Mission 15 — Verified Reviews + Reports + Disputes**
Trustworthy reviews, misconduct reports, and dispute resolution.

**Mission 16 — Commerce Foundation**
Credits, transaction ledger, multi-currency primitives, and plan management.

**Mission 17 — Marketplace Payments**
PCI-compliant marketplace payments, payouts with KYC, refunds, and chargebacks
via an established provider.

**Mission 18 — Institution Portal**
First-class portal for universities/colleges/institutes.

**Mission 19 — Evidence-grounded AI Copilot**
An AI assistant grounded strictly in verified platform data and cited sources.

**Mission 20 — Budget / Cost Planner**
Cost-of-journey planning across tuition, tests, living, and services.

**Mission 21 — Admin Super-Control Center consolidation**
Consolidate admin capabilities into one operations center.

**Mission 22 — International Hardening**
Full multi-market hardening of locale, currency, timezone, and compliance.

**Mission 23 — Platform Security / Abuse Audit**
End-to-end security and abuse-resistance audit.

**Mission 24 — Responsive / Accessibility / UX Acceptance**
Platform-wide responsive, accessibility, and UX acceptance.

**Mission 25 — Controlled Verified Data Launch**
Seed only verified data through controlled, auditable channels.

**Mission 26 — Final Multi-Role Acceptance**
Acceptance across every role (user, employer, agent, institution, admin).

**Mission 27 — Launch Certification**
Final certification. **No production push or deployment occurs without explicit
operator approval.**

## Release rule

No production push or deployment happens without **explicit operator approval**,
at any mission. See
[STRIDETO_ENGINEERING_GUARDRAILS.md](STRIDETO_ENGINEERING_GUARDRAILS.md).
