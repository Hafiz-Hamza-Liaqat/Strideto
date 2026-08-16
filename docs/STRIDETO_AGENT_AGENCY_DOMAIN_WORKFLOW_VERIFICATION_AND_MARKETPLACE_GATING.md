# STRIDETO — Agent / Agency Domain Workflow, Verification & Marketplace Gating

**Status:** Implemented (manual-QA implementation pack)  
**Starting HEAD:** `11ffd3356ad4c066fe9564a1de8d5d711bcc24b8`  
**Scope:** Provider IA, domain-scoped verification, Education Marketplace free promotion, scoped trust mark  
**Out of scope:** 17D-9B, Phase 18, Wyoming activation, Business public marketplace, paid plans, referrals, Worker start

---

## Final Provider architecture

```
ONE PROVIDER ACCOUNT (Agent login)
        ↓
WHO AM I ACTING AS?  → Independent Provider  |  Agency / Organization
        ↓
WHICH PROFESSIONAL WORKSPACE?
        → Education & Mobility
        → Business Formation & Corporate Services
```

Authority remains: authenticated Agent + authorized Provider subject + professional domain + team duties + capability/jurisdiction where required.

Never collapse account ≡ subject ≡ domain.

---

## Shared vs Education vs Business pages

| Surface | Scope |
|--------|--------|
| `/agent` Provider Dashboard | Shared gateway |
| Profile, Trust Center, Team, Messages, Notifications, Account Settings, Help | Shared / subject-aware |
| Education Overview, Leads, Clients, Consultations, Cases, My Education Services, Marketplace, Availability, Professional Verification, Reviews | Education |
| Business Overview, Requests, Quotes, Cases, Capabilities, Jurisdictions, My Services, Business Verification | Business |

---

## Verification matrix

| Layer | Grants |
|------|--------|
| Email / account security | Account access |
| Organization / identity verification | Subject identity where policy allows |
| Education professional approval (`OrganizationVerification` approved for Education semantics) | Education directory eligibility, Marketplace authoring eligibility, scoped Education trust mark |
| Business capability / jurisdiction verification | Exact capability+jurisdiction actions only |
| Protected titles | Evidence-gated; never implied by Education or org approval |

**Cross-domain inheritance:** NONE  
**Cross-subject inheritance:** NONE  

Education approval ≠ Business approval.  
Organization verified ≠ Education professional approved.  
Business Formation approved ≠ Registered Agent approved.

---

## Pre-approval capabilities

### Education (before professional approval)

Allowed: Provider Dashboard, Profile, Trust, Team, Messages, Settings, Help, Education Overview/setup, Professional Verification, Education service **drafts**, Availability.

Denied: public Education directory eligibility, Marketplace create/submit/publish, scoped Education “Verified by Strideto”, public service activation when rules require approval.

### Business (before granular approvals)

Allowed: Business Overview/setup, Business Verification summary, claim capabilities, jurisdiction setup, Business listing **drafts**.

Denied: public Business listing/marketplace (flag OFF), self-verified capabilities, protected-title claims without evidence.

---

## Scoped “Verified by Strideto”

Public Education profile shows a compact badge with accessible scope text:

> Verified by Strideto: Education & Mobility professional verification approved.

Does **not** imply government, university, visa, lawyer/accountant, ACSP/CSP, or Registered Agent status.

---

## Education Marketplace — one-time free promotion

- Scope: exact Provider subject + `education_mobility`
- Agency team members share **one** Agency entitlement (not per member)
- Independent subject has its own entitlement
- Draft create does **not** consume; Admin publication consumes via Mongo CAS (`findOneAndUpdate` status `available` → `consumed`)
- Moderation rejection / needs-changes does not consume
- `publishedAt` / `endsAt` server-authoritative; free duration = **7 × 24 hours** from publication
- Public queries enforce `endsAt > now` (no Worker dependency)
- Free content blocks off-platform URLs/CTAs (https, www, wa.me, t.me, mailto, tel, social)
- Paid publishing plans: **NOT_CONFIGURED** (no Unlimited plan)
- Model: `AgentEducationMarketplaceFreeEntitlement`
- Critical indexes: create-only via `EDU_MARKETPLACE_FREE_ENTITLEMENT_CRITICAL_INDEXES` (`autoIndex` remains off unless `MONGO_AUTO_INDEX=1`)

---

## Business public marketplace

`BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED` remains **OFF**. No Business free promotion in this pack.

---

## Navigation / UX corrections

- One global active leaf (`resolveActiveNavPath`)
- Business Overview uses `end: true`
- Dedicated `/agent/business-services/verification` (no Capabilities alias)
- Dedicated `/agent/reviews`
- Removed duplicate “Agent Portal” subtitle and redundant Business top-tab SUBNAV
- Education availability checklist reads `cards.hasAvailability` from current membership schedule

---

## Deferred product decisions (do not implement)

- Paid Agent/Agency plan names, prices, quotas
- Monthly publish / simultaneous active post limits
- Subscription expiry / re-activation
- Referral qualification, caps, credits
- Business promotional-post product
- Marketplace analytics expansion (views/clicks) beyond durable data

**Law:** No paid plan may offer unlimited posts. Agency quotas belong to Provider subject, not employees.

---

## Tests

- `client/src/__tests__/agentDashboardUxSimplification.test.js`
- `server/src/__tests__/educationMarketplaceFreePromotion.test.js` (source + disposable Mongo race/index)

---

## Manual QA handoff

See implementation prompt sections 150–157:

- Education pre-approval / approved flows
- Both-domain Provider
- Agency team entitlement sharing
- Consultation → Case consent
- Business draft/setup without Education bleed
- Native 200% zoom: **USER MANUAL**
- Screen reader: **USER MANUAL**

---

## Safety

- Wyoming pack: draft/draft  
- Filing legal text: UNAPPROVED / EMPTY  
- GBS rollout flags: OFF  
- HSI: OFF  
- Worker: STOPPED (not required for free-post expiry)  
- No push / no public deploy in this pack
