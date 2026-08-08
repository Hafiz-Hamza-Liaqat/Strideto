# Strideto Trust & Verification Policy (FROZEN)

> **Status:** Authoritative. Companion to
> [STRIDETO_MASTER_PRODUCT_SPEC.md](STRIDETO_MASTER_PRODUCT_SPEC.md),
> [STRIDETO_MASTER_EXECUTION_ROADMAP.md](STRIDETO_MASTER_EXECUTION_ROADMAP.md),
> [STRIDETO_ENGINEERING_GUARDRAILS.md](STRIDETO_ENGINEERING_GUARDRAILS.md).
> This policy governs the Trust Engine and every organization portal.

## 1. Scope

This policy applies to every organization type that can post content or offer
services on Strideto:

- Employer / company
- Agent
- Agency
- University
- College
- Institute
- any other approved organization type

## 2. Core rule

**Registration does not grant publishing or service privileges.** Only an
**APPROVED** organization receives privileged posting/service capabilities.

## 3. Verification workflow

```
REGISTER
  → email verification
  → restricted onboarding portal
  → organization details
  → supporting documents
  → website / domain
  → official email
  → phone
  → physical address
  → Google Maps URL / location
  → legal registration
  → license (if legally applicable)
  → accreditation (if applicable)
  → representative identity / authority
  → automated risk screening
  → verification report
  → moderator / admin / core-team review
  → approved | needs information | enhanced review | rejected
```

During onboarding an organization operates in a **restricted portal**: it can
supply information and evidence, but cannot publish jobs, offer paid services,
or otherwise act as a trusted party until approved.

## 4. Verification states

The verification state machine must support:

- `draft`
- `email_verified`
- `verification_pending`
- `under_review`
- `needs_information`
- `enhanced_review`
- `approved`
- `rejected`
- `suspended`
- `revoked`
- `expired`

**Re-verification and expiry must exist.** Approval is not permanent; an
organization can move to `expired`, `suspended`, or `revoked`, and can be
required to re-verify.

## 5. Decision SLA

- **Initial-decision target: 24–48 business hours after a *complete*
  submission.**
- This is a **target, not a guarantee of approval**.
- **No automatic approval** occurs after 48 hours (or ever) — the target governs
  responsiveness, not outcome.
- **Security and compliance concerns override the SLA**; a submission under
  enhanced review may take longer.

## 6. Granular verification badges

Verification is expressed through **granular** badges, not a single generic
"Verified" stamp:

- Identity Verified
- Business Verified
- Official Domain Verified
- Physical Location Verified
- Professional Credential Verified
- Institution Representative Verified
- Accreditation Verified

**A badge attests only to what it names.** Never imply that a generic "Verified"
badge means Strideto guarantees the organization's future conduct or claims.

## 7. Claim integrity

- **No guaranteed-outcome claims** — guaranteed visa, admission, scholarship,
  overseas job, or embassy approval — unless there is a legitimate legal or
  contractual basis for the specific claim.
- **Important opportunity claims require sources**, each with a last-verified
  date.
- Everywhere claims appear, **visibly separate**:
  - **OFFICIAL FACT** — sourced and verifiable;
  - **STRIDETO RECOMMENDATION** — platform-generated guidance;
  - **AGENT / ORGANIZATION STATEMENT** — a third party's assertion.

## 8. User sovereignty

Users own their journey and their documents. A user must always be able to:

- revoke an Agent's access to their documents;
- leave an Agent;
- continue self-managed;
- change Agent;
- report misconduct.

Private documents are private by default; every access grant is explicit,
granular, and revocable, and high-risk access changes are audited.

## 9. Evidence, freshness, and audit

- Verification evidence (registration documents, licenses, accreditation,
  representative authorization, Google Maps location, domain/email proof) is
  captured, immutable once submitted, and reviewable by moderators.
- Sources and freshness are tracked for verifiable claims.
- Verification decisions, state transitions, and access changes are **audited**.
- Consent is captured and recorded where personal data is processed.

## 10. Relationship to the roadmap

The full implementation of this policy is **Mission 2 — Trust & Organization
Verification Foundation**, with institution-specific application in **Mission 18
— Institution Portal** and abuse hardening in **Mission 23**. Until those
missions land, the current Employer verification fields (`verified`,
`verificationLevel`) are a partial, interim representation and must not be
presented as the full granular contract described here.
