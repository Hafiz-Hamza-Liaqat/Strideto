# Strideto Master Product Specification (FROZEN)

> **Status:** Authoritative. This document is one of four canonical Strideto
> documents. It supersedes ad-hoc product statements scattered across prior
> phase reports. Companion documents:
> [STRIDETO_MASTER_EXECUTION_ROADMAP.md](STRIDETO_MASTER_EXECUTION_ROADMAP.md),
> [STRIDETO_ENGINEERING_GUARDRAILS.md](STRIDETO_ENGINEERING_GUARDRAILS.md),
> [STRIDETO_TRUST_VERIFICATION_POLICY.md](STRIDETO_TRUST_VERIFICATION_POLICY.md).

## 1. Product definition

Strideto is an **international opportunity and decision platform** that helps
people:

- discover education and career opportunities;
- understand verified requirements;
- determine eligibility;
- choose required tests;
- know where those tests are accepted;
- prepare using original guidance plus official/trusted external resources;
- discover scholarships, programs, and jobs;
- plan their journey;
- connect with verified professional consultants;
- apply and track progress;
- securely manage their documents;
- pay for approved services;
- reach an outcome.

Organizations use Strideto to reach and serve users through **verified,
auditable portals**. The Institution/Organization Portal is a first-class
organization capability that spans the engines below — not a separate product.

## 2. Global architecture principle

**International by architecture. Market-by-market in operational rollout.**

New systems must never be architected as:

- Pakistan-only;
- PKR-only;
- `+92`-only;
- `Asia/Karachi`-only;
- a single grading system;
- a single address format.

New code must use:

- ISO 3166 country codes;
- ISO 4217 currency codes;
- IANA timezone identifiers;
- international phone and address contracts;
- country-configurable verification and compliance rules.

Operational rollout can still target one market at a time — the constraint is
on the **data contracts and schemas**, not on where the company chooses to
launch first.

### Language system

The **current language/i18n system is kept as-is**. Do not build a new
translation system as part of near-term work. All new user-facing strings must
remain i18n-compatible (routed through the existing `react-i18next` locale
files and `t()` contract), so a future language expansion can absorb them
without rework.

## 3. The nine frozen engines

Strideto's capability surface is organized into nine engines. These names and
scopes are frozen; features map into one of them.

### 3.1 Opportunity Engine
Jobs · Scholarships · Internships · Fellowships · Programs.

### 3.2 Education Intelligence Engine
Tests · Universities · Programs · Test acceptance · Requirements · Country
intelligence.

### 3.3 Personalization Engine
Universal Student Profile · Matching · Eligibility · Gap analysis ·
Recommendations · Journey Planner · Next Best Action.

### 3.4 Action Engine
Saved items · Saved searches · Alerts · Deadlines · Calendar · Checklists ·
Applications · Secure Document Vault.

### 3.5 Professional Services Engine
Verified Agents · Agencies · Services · Consultations · Messaging · Cases ·
Case timelines · Reviews · Reports · Disputes.

### 3.6 Employer Engine
Jobs · Candidates · Intelligence · Hiring pipeline · Interviews · Analytics.

### 3.7 Trust Engine
Identity verification · Organization verification · Professional verification ·
Domain verification · Physical-location verification · Google Maps evidence ·
Registration evidence · Licenses (where applicable) · Institution accreditation ·
Representative authorization · Sources · Freshness · Moderation · Fraud
prevention · Reports · Consent · Audit trails.

### 3.8 Commerce Engine
Credits · Card payments · Paid consultations · Agent plans · Employer plans ·
Promotions · Marketplace payouts · Refunds · Disputes · Transactions ·
Multi-currency.

### 3.9 Admin Engine
Users · Employers · Agents/Agencies · Institutions · Verification · Content ·
Sources · Payments · Data quality · Moderation · Fraud/risk · Audit ·
Operations.

## 4. Trust principles (product-level)

> Verification and compliance rules are specified in detail in
> [STRIDETO_TRUST_VERIFICATION_POLICY.md](STRIDETO_TRUST_VERIFICATION_POLICY.md).
> The product-level principles below are non-negotiable.

- **Trust before growth.** No growth feature ships at the expense of a trust
  guarantee.
- **No guaranteed-outcome claims** (guaranteed visa, admission, scholarship,
  overseas job, or embassy approval) without a legitimate legal/contractual
  basis.
- **Important opportunity claims require sources**, with a last-verified date.
- **Visibly separate** the three claim classes everywhere they appear:
  - **OFFICIAL FACT** (sourced, verifiable);
  - **STRIDETO RECOMMENDATION** (platform-generated guidance);
  - **AGENT / ORGANIZATION STATEMENT** (third-party assertion).
- **Users own their journey and documents.** A user must always be able to:
  revoke an Agent's document access; leave an Agent; continue self-managed;
  change Agent; report misconduct.

## 5. Education strategy (frozen)

Strideto does **not** build a giant proprietary practice-question platform and
does **not** copy proprietary books, question banks, or copyrighted material.

Strideto provides:

- test information;
- test alerts;
- deadlines;
- original preparation guidance;
- official preparation resources;
- trusted external practice links;
- test comparison;
- countries accepting each test;
- institutions accepting each test;
- program-specific acceptance;
- minimum scores;
- official sources;
- last-verified dates.

Representative test coverage (extensible): IELTS, TOEFL, PTE, Duolingo English
Test, SAT, ACT, AP, GRE/GMAT (where applicable), HAT, NAT/GAT, USAT, and future
exams.

## 6. Commerce principles (frozen)

- Support **international money contracts** from the start (ISO 4217, multi-currency
  ledger, transparent fees).
- **Never store** raw card numbers, CVV, or plain payment credentials.
- Use an established **PCI-compliant marketplace payment provider** (integration
  deferred; vendor deliberately unfrozen).
- The architecture must accommodate: Visa/Mastercard/debit/credit cards;
  tokenization; 3-D Secure where appropriate; signed webhooks; webhook replay
  protection; idempotency; refunds; chargebacks; payout KYC; a transaction
  ledger; reconciliation; multi-currency; transparent fees.
- **Do not build a homemade or unlicensed escrow.**
- Exact payment/KYC/AI vendors and pricing are **deliberately unfrozen**.

## 7. Organization portals

Registration alone **never** grants publishing or service privileges. Any
organization type (employer/company, agent, agency, university, college,
institute, or other approved type) passes through the verification workflow in
[STRIDETO_TRUST_VERIFICATION_POLICY.md](STRIDETO_TRUST_VERIFICATION_POLICY.md)
before receiving privileged capabilities. Only **approved** organizations
receive privileged posting/service capabilities.

## 8. Current implementation reality (informative)

This section is a non-authoritative snapshot to orient future work; the frozen
requirements above govern in any conflict.

- The **Employer Engine** is the most mature surface today: registration/login,
  job posting with an internal/external application method selector, admin
  approval workflow, a canonical hiring pipeline (13 stages) with an
  Employer→User synchronization contract, hiring intelligence (ranking,
  candidates, pipeline, compare), interview scheduling/completion, analytics,
  notifications, and a public employer profile.
- Authentication runs on the SEC-3 secure session architecture (in-memory
  access token, HttpOnly refresh cookie, session-family revocation).
- A public profile surface exists for employers, companies, and universities.
- Payments have a Stripe-based checkout scaffold (`createCheckoutSession`,
  signed webhook handler) gated behind configuration; it is not yet a full
  marketplace payment system.
- The remaining engines exist in varying states of partial implementation and
  are sequenced by the execution roadmap.
