# STRIDETO PHASE 17D-A
# GLOBAL BUSINESS SERVICES ARCHITECTURE & GAP AUDIT

**Mode:** AUDIT / RESEARCH / ARCHITECTURE REPORT ONLY  
**Implementation:** NONE  
**Database migrations:** NONE  
**Routes / models / UI / tests:** NONE  
**Docker rebuild / worker start / Phase 18 / push / deploy:** NONE  

Research date for official-source citations in this report: **14 August 2026**.  
Fee figures and processing times below are **architecture examples tied to named official pages**. They are **not** launch-ready catalog data. Every public legal fact later shipped must carry `sourceUrl`, `retrievedAt`, `lastReviewedAt`, and `reviewStatus`.

---

## 1. Executive Summary

Strideto can host a Global Business Services (GBS) vertical as a **marketplace and case-operations platform**, not as a formation company, law firm, tax advisor, or government registrar.

The repository already contains most of the **platform machinery** this vertical needs:

- Four isolated auth realms with path-scoped HttpOnly refresh cookies.
- Phase 17D-0 Active Workspace (preference is not security authority).
- Organization + OrganizationVerification (CLAIMED ≠ EVIDENCE ≠ VERIFIED).
- Agent/Agency portal: profile, services, marketplace, leads, clients, consultations, cases, messages, Trust, team, commerce placeholders.
- Student Vault with grants, Journey deadlines, reviews/disputes, Admin verification queues.
- Commerce that is honestly **`not_configured`** until Stripe and a commission policy exist.

What does **not** exist is the GBS product itself: jurisdiction intelligence, capability-specific Trust, formation listings with separated fees, Service Request → Quote → Case, Business Client workspace, mailroom, and official-source catalogs.

**Recommended architecture (not implemented):**

| Side | Recommendation |
| --- | --- |
| **Provider** | Remain **Agent / Agency**. Add verified **Business Services capabilities**. Do **not** create `llc-agent` / formation-provider cookies. |
| **Buyer** | **Hybrid:** existing **User** session + **Business Client workspace/capability** + optional **Organization** of a new buyer type for company clients. Do **not** reuse Employer. Do **not** add a fifth refresh cookie. |
| **MVP** | Public discovery + verified providers + listings + requests + quotes (no fake payment) + case tracking + messages + Vault grants + Admin moderation. |
| **Launch wave** | Pakistan (home demand) + United States (foreign-founder demand, state catalog) + United Kingdom (clear official sources). UAE / Singapore / Canada / Australia as Wave 2–3. |
| **Mailroom / Commerce / government filing APIs** | Defer. High operational and legal risk. |

Strideto must never claim it formed a company, guaranteed a bank/Stripe/Amazon/visa outcome, or that Organization Verified equals Registered Agent / ACSP / CSP / lawyer verified.

---

## 2. Baseline / Safety State

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `f3c33e11e6e8db8cc2e613e17726b259076220c4` |
| Phase 17D-0 | USER MANUALLY ACCEPTED (this audit does not reopen it) |
| Worker | STOPPED (not started by this phase) |
| Known tracked WIP (untouched) | `AdminDataTable.jsx`, `AdminTableFilters.jsx`, `FormField.jsx` |
| Older stash (untouched) | `wip: AdminTableFilters values wiring (pre-phase-10)` |
| Protected local-only (untouched) | `docker-compose.appenv-align.yml`, `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`, `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md` |
| This phase repository change | **This file only** (untracked, unstaged, uncommitted) |

17D-0 confirmed: Employer public identity, logo → `/`, Open Workspace → `/employer`, Student Apply denied for Employer, refresh preserves Employer, logout → Guest.

**17D-0 dependency to document (not reopen):** if Business Client is a User-session capability, Active Workspace must later gain a `business_client` preference value so a founder is not labelled Student on `/`. That is a **future extension**, not a 17D-0 defect.

---

## 3. Existing Strideto Architecture Relevant to Business Services

### 3.1 Auth / cookies

Canonical policy: `server/src/services/auth/AuthCookiePolicy.js`.

| Realm | Cookie (prod) | Path | `/me` |
| --- | --- | --- | --- |
| `user` (Student + staff) | `__Secure-strideto_user_rt` | `/api/auth/refresh-token` | `GET /api/auth/me` |
| `employer` | `__Secure-strideto_employer_rt` | `/api/auth/employer/refresh-token` | `GET /api/employer/me` |
| `agent` | `__Secure-strideto_agent_rt` | `/api/auth/agent/refresh-token` | `GET /api/auth/agent/me` |
| `institution` | `__Secure-strideto_institution_rt` | `/api/auth/institution/refresh-token` | `GET /api/auth/institution/me` |

Access tokens are in-memory only. Preference `strideto-active-workspace` is `student \| employer \| agent \| institution` and is **not** authority (`client/src/auth/activeWorkspace.js`).

**Naming conflict (mapped, not a new realm):** cookies/JWT use `user`; Active Workspace uses `student`.

### 3.2 Organization

`server/src/models/Organization.js` + `shared/international/organization.js`.

Types today: `employer | agent | agency | university | college | institute | school | training_center`.  
**Missing:** buyer/client organization type. **Do not** overload `employer`.

### 3.3 Agent professional stack (strongest reuse)

Nav: `client/src/config/agentNavConfig.js` — Dashboard, Profile, Verification, Services, Marketplace, Availability, Leads, Clients, Consultations, Cases, Messages, Trust, Team (agency), Notifications, Usage & Billing, Commerce, Settings, Help.

Service categories today are **education/mobility**, not formation (`shared/agent/constants.js`). Guarantee phrases are already forbidden for visa/admission/job — GBS must extend this list (guaranteed banking, Stripe, Amazon, residency, “we are the registrar”).

Cases today: `shared/services/cases.js` — types include a generic `business` study/work workflow. **Do not reuse that state machine as US LLC filing.** Extend with a **new case family** (`business_services`) rather than overloading `study`/`work`.

### 3.4 Trust

Canonical org machine: `shared/international/verification.js`.  
Skill claims: `shared/career/skillVerification.js` (CLAIMED ≠ EVIDENCE ≠ VERIFIED).  
Professional reviews: `ProfessionalReview` / `ProfessionalReport` / `ProfessionalDispute`.  
Public listing truth: `PublicTrustBadge` (authority kind) ≠ `VerificationBadge` (org KYC).

### 3.5 Vault

User-owned (`ownerUserId`). Grants to `agent | case | system`. Signed URLs. Soft-delete. Audit. **Reuse. Never public media for passports.**

### 3.6 Commerce

`marketplaceStripeConfiguration()` → `not_configured` unless secrets + mode. Commission policy unconfigured by default. Agent Commerce UI already tells the truth. **Keep fail-closed.**

### 3.7 Conflicts that GBS must not make worse

| Conflict | Implication |
| --- | --- |
| Employer model vs Organization vs Company CMS | Buyer org must be Organization-native, not a fourth Employer clone |
| `Employer.verified` boolean vs OrganizationVerification | GBS public badges must use granular evidence badges, not a boolean |
| `AgentProfile.profileStatus` vs OrganizationVerification | Capability verification must hang off OrganizationVerification + capability records, not profile completeness |
| Institution `memberships[0]` | Buyer multi-business must not copy this “first membership only” trap |
| Employer one-active-membership | A hiring Employer that also buys GBS needs a **capability on the same org or a linked buyer org**, not a second Employer account hack |

---

## 4. Service Buyer / Business Client Architecture

### Actors

| Actor | Example | Must not be modelled as |
| --- | --- | --- |
| Individual founder | Person in Pakistan wants a Wyoming LLC | Employer |
| Existing company | Pakistani Pvt Ltd wants a US subsidiary | Student applicant |
| Multi-business entrepreneur | Several ClientBusiness records | One flattened profile |
| Existing Strideto User | Same person also applies to jobs | Silent Student authority for GBS writes, or silent GBS authority for Apply |
| Existing Employer org | Hiring company also buys registered-agent service | “They have a company, so use Employer cookie for GBS APIs” |

### Options compared

| | A: New auth realm | B: Capability on User | C: Org capability only | D: Hybrid person + org |
| --- | --- | --- | --- | --- |
| Security / cookies | New cookie path; high cost; 17D-0 switcher rewrite | Reuses User cookie | Needs an org principal; Institution-like | User cookie; org as tenant, not cookie |
| Session model | 5th refresh cookie | Same as Student | Like Institution | Same as Student + membership |
| 17D-0 switching | New realm value + `/me` | New **workspace preference** on same session | New realm or nested org switcher | Preference `business_client` on User session |
| Multiple businesses | Awkward | ClientBusiness rows | Native | ClientBusiness owned by person **or** org |
| Team invitations | New invite stack | Weak for companies | Strong | Person path has no team; org path reuses membership |
| IDOR | New surface | Must fail-closed on User id | Must fail-closed on org id | Both boundaries required |
| UX | Another login | Founder labelled Student unless preference extended | Company-only; founders forced to create a company first | Founder stays a person; company is optional |
| Migration | Heavy | Light | Medium | Medium |
| Cross-workspace | Hard | Natural (same person) | Weak for individuals | Natural |

**Recommendation: OPTION D (hybrid).**

- Individual founder: **User** authentication. Active Workspace later shows **Business Client**, not Student. `canActAsStudent` remains false while GBS workspace is active (already the 17D-0 pattern).
- Organization client: **Organization** type additive (recommended name: `business_client` or `corporate_customer` — USER decision). Membership from User accounts, parallel to Agent/Institution membership. Not Employer.
- Existing Employer that also buys: **do not** authorize GBS APIs with the Employer cookie. Link or invite the same humans as User members of a buyer org, or add a buyer **capability** on Organization that is exercised only through User-session GBS APIs with org scope. Prefer **explicit User + membership** so Employer hiring APIs stay hiring-only.

**Rejected:** Option A (fifth cookie) unless a future legal/security review proves User-session GBS cannot isolate tenant data. The repo does not prove that today.  
**Rejected:** Option C alone — it forces every Pakistani first-time founder to invent a company before shopping.  
**Rejected:** Treating Employer as the buyer because “they own a business.”

---

## 5. Provider / Agent Architecture

**Recommendation:** Provider = **Agent (individual) or Agency (organization)** + **Business Services capability modules**.

Do **not** create:

- `llc-agent` realm
- `registered-agent` cookie
- `formation-provider` authentication

Rationale: the repo already isolates Agent cookies, Organization, team, verification, services, marketplace, cases, Vault grants, Trust, and Admin marketplace moderation. Service differences are **capabilities and listings**, not principals.

Existing Agent categories (`study_abroad_guidance`, etc.) stay. GBS categories are **additive**. A study-abroad Agent may later add formation capability only after capability verification — they do not automatically become a Registered Agent.

**Agency vs Agent:** keep `agentType`. Team UI already agency-only. Formation companies should typically be **agency**. Independent consultants may be **agent** with a subset of capabilities (consultation, document prep) and **must not** display protected titles.

---

## 6. Identity & Workspace Recommendation

```
PUBLIC PLATFORM /
  guest | student | employer | agent | institution | business_client (future preference)

PRIVATE WORKSPACES
  /dashboard                  User / Student
  /business                   Business Client (User session, not a new cookie)
  /employer/*                 Hiring
  /agent/*                    Provider (existing) + future /agent/business-services/*
  /institution/*
  /admin/*
```

Rules:

1. No universal token.
2. Preference never authenticates.
3. Employer cookie never authorizes GBS buyer or provider APIs.
4. Agent cookie never authorizes Student Apply or Employer job admin.
5. Business Client APIs authorize **User** + optional `organizationId` membership, fail closed.
6. Staff remains User-realm staff RBAC; no public Admin switcher; no impersonation.

---

## 7. Service Taxonomy

Legend: **MVP** | **PHASE 2** | **HIGH-RISK / LEGAL REVIEW** | **DEFER** | **OUT OF SCOPE**

### 7.1 Business formation

| Item | Class |
| --- | --- |
| LLC / limited company / Pvt Ltd / SMC | **MVP** (per launch jurisdictions) |
| Corporation / public company | **PHASE 2** |
| LLP / partnership / sole proprietorship | **PHASE 2** (jurisdiction-specific) |
| Branch / foreign company / foreign qualification / subsidiary | **PHASE 2** |
| Representative office | **HIGH-RISK** |
| Nonprofit / charity | **HIGH-RISK** |
| Conversion / dissolution | **DEFER** |

### 7.2 Registered presence

| Item | Class |
| --- | --- |
| Registered agent (US, where required) | **MVP** as a **capability + listing flag**, not a title dump |
| Registered office (UK/SG/AU/etc.) | **MVP** for launch countries that require it |
| Virtual office / business address | **PHASE 2** |
| Company secretary | **PHASE 2** / **HIGH-RISK** (SG/UK regulated) |
| Resident / nominee director | **HIGH-RISK** — do not sell as a default SKU |
| Local service agent | **HIGH-RISK** |

### 7.3 Tax / identifiers

| Item | Class |
| --- | --- |
| EIN **assistance** (help applying at IRS; Strideto is not the IRS) | **MVP** as optional add-on, no guarantee |
| VAT/GST/sales tax registration | **PHASE 2** / **HIGH-RISK** |
| Payroll / employer tax | **HIGH-RISK** |
| Personalized tax advice | **OUT OF SCOPE** as Strideto product |

### 7.4 Compliance

Annual report / confirmation statement / BOI / good standing: **PHASE 2** calendar + provider tasks. Automated legal-obligation engine: **DEFER** until source catalog is reviewed.

### 7.5 Accounting / legal / IP

Bookkeeping, tax prep, corporate legal, trademark: **HIGH-RISK** (protected titles). Marketplace may list **credential-gated** professionals in Wave 3. Not MVP.

### 7.6 Ecommerce / market entry

Marketplace-readiness **guidance**, merchant-account **readiness** (no guaranteed Stripe/PayPal/Amazon): **PHASE 2** copy-only. Guaranteed approvals: **OUT OF SCOPE**.

### 7.7 Mail / address operations

See §30. **POST-MVP**. Architecture now; operations later.

---

## 8. Provider Type / Capability Taxonomy

### Generic marketplace role (public)

**Recommended default public noun:** **Business Formation Provider** (USER decision).

Never default-label a consultant **Registered Agent**, **ACSP**, **CSP**, **Attorney**, or **Company Secretary**.

| Label | When it may appear publicly | Evidence |
| --- | --- | --- |
| Business Formation Provider | After org/identity verification + formation capability approved | Org verification + capability record |
| Corporate Services Provider | Broader catalog (address, secretarial, filings) | Capability set |
| Formation Consultant | Advice/document prep, not claiming statutory agent status | Capability `consultation` / `document_prep` |
| Registered Agent | Only if jurisdiction capability `registered_agent` is **capability-verified** | State/commercial RA registration evidence |
| Registered Office Provider | Capability-verified address service | Address evidence + local rules |
| Company Secretary Provider | Credential + jurisdiction (e.g. SG CSP/secretary) | Regulatory registration |
| Legal Professional / Tax Professional / Accountant | Protected titles | Licence number + regulator + Admin approval |
| Trademark/IP Professional | Credential-gated | Same |

**Generic role ≠ jurisdiction capability ≠ regulated title.**

---

## 9. Trust & Verification Architecture

Reuse `OrganizationVerification` + granular badges. Add **capability records**; do not mint a parallel “GBS verified” boolean.

### Layers (not interchangeable)

1. **Identity verified** (person)
2. **Organization verified** (`approved` + `business_verified` / domain / location badges)
3. **Representative authority verified** (agency representative — already an Agent onboarding step)
4. **Service capability verified** (formation, bookkeeping, …)
5. **Jurisdiction capability verified** (e.g. Wyoming RA, England & Wales registered office)
6. **Professional credential verified** (licence)
7. **Registered agent capability verified**
8. **Registered office capability verified**
9. **Regulatory status verified** (UK ACSP, SG CSP, AU registered agent where applicable)

**Organization Verified does not mean US Registered Agent Verified, UK ACSP Verified, lawyer verified, or tax professional verified.**

Preserve:

`CLAIMED` ≠ `EVIDENCE SUBMITTED` ≠ `EVIDENCE BACKED` ≠ `VERIFIED`

Provider-reported case status `REGISTERED` ≠ Strideto official-source verified.

Public UI must show badge **names**, not color-only.

---

## 10. Jurisdiction Intelligence Architecture

Do **not** hardcode a global “State” field.

```
Country
  → JurisdictionLevel (country | state | province | territory | emirate | free_zone | region | other)
  → Jurisdiction (code, name, parent)
  → Authority (registrar, tax, licensing)
  → EntityType (LLC, LTD, Pvt Ltd, … scoped to jurisdiction)
  → Rule (eligibility, local presence, RA/RO, documents, steps)
  → GovernmentFee (amount, currency, source, effective dates)
  → ComplianceObligation
  → Source (see §11)
```

A listing binds: `providerCapability × country × jurisdiction × entityType`.  
A US LLC in Wyoming is **not** a “USA LLC” SKU.

---

## 11. Official Source / Provenance Architecture

Legal facts come from **authoritative official sources** only.

| `sourceType` | Allowed for legal facts? |
| --- | --- |
| national_registrar | Yes |
| state_secretary / provincial_registrar | Yes |
| tax_authority | Yes |
| licensing_authority | Yes |
| government_business_portal | Yes |
| official_legislation | Yes |
| recognized_official_registry | Yes |
| competitor_marketing | **No** — UX research only |
| provider_self_declared | Listing/pricing only, labelled provider-defined |
| news / blog | **No** |

Required metadata: `jurisdiction`, `authorityName`, `sourceUrl`, `sourceType`, `factCategory`, `retrievedAt`, `lastReviewedAt`, `effectiveFrom`, `effectiveTo`, `reviewStatus`, `reviewedBy`, `superseded`, `notes`.

**Revisions:** manual review + Admin approval + revision history + stale warning + public “Last reviewed” date. Reuse `shared/trust/sourceVerification.js` and `CanonicalSource` as the starting point; GBS needs a **jurisdiction-scoped catalog**, not blog scraping.

---

## 12. Country Deep Audit

Third-party incorporation blogs were **not** used as legal authority. Competitor sites may appear only as product-pattern research (§53).

### 12.1 United States

**Architecture:** Federal layer (IRS EIN, federal tax, BOI where applicable) **+** state formation **+** possible foreign qualification in other states **+** local licences.

Official federal EIN: IRS “Apply for an Employer Identification Number (EIN) Online” — Strideto/providers may **assist**; they are not the IRS; the application is free at IRS. Foreign founders without SSN/ITIN typically cannot use the online assistant (fax/mail/phone SS-4) — **do not** advertise “instant EIN for everyone.”

Registered agent with in-state physical address is a **common state statutory concept**, not a Strideto product name.

**Reject:** “best state”, “tax-free”, “guaranteed banking.”

See §13 for state inventory architecture and representative deep-audit.

### 12.2 United Kingdom

Official: [Set up a private limited company / Register your company](https://www.gov.uk/limited-company-formation/register-your-company) (Companies House / GOV.UK).

Architecture must include: company name, SIC, UK registered office (and email) rules, directors, shareholders, **PSC**, identity verification (GOV.UK One Login or **ACSP**), certificate of incorporation, later confirmation statements, Corporation Tax via HMRC (separate from Companies House).

**ACSP:** [Being an Authorised Corporate Service Provider](https://www.gov.uk/guidance/being-an-authorised-corporate-service-provider). AML-supervised UK agents. **Ordinary Strideto Agent verification must never grant ACSP.** Public “ACSP” only after capability verification against Companies House authorised-agent status.

Online vs postal fees differ on GOV.UK — catalog from the official page with last-reviewed date; do not freeze a blog’s £ figure.

### 12.3 Canada

Official: [Choosing between federal and provincial/territorial incorporation](https://www.canada.ca/en/services/business/start/register-with-gov/register-corp/register-corp-fed-or-prov.html). Corporations Canada administers CBCA (FAQ: [Corporations Canada](https://ised-isde.canada.ca/site/corporations-canada/en/frequently-asked-questions)).

**Must model:** federal incorporation **vs** provincial/territorial. Extra-provincial **registration** is not a second incorporation. Director residency and name protection **differ by statute** — do not copy CBCA rules onto every province.

All provinces/territories need their own `Jurisdiction` rows. Do not assume identical fees or director rules.

### 12.4 Australia

Official: [Register a company](https://business.gov.au/registrations/register-a-company); [Business Registration Service](https://register.business.gov.au/). ASIC issues ACN. **Company ≠ business name ≠ ABN.**

Private service providers may lodge; Strideto verification ≠ ASIC registered agent. Unlimited companies may require ASIC/direct channels — do not pretend one BRS wizard covers every form.

Ongoing annual review is an ASIC obligation — compliance calendar **PHASE 2**, sourced from ASIC, not provider marketing.

### 12.5 Singapore

Official CSP: [Checking if you must register as a CSP](https://www.acra.gov.sg/register/corporate-service-provider/checking-if-you-must-register/) (ACRA). CSP Act 2024. Services include business registration, address, role (director/secretary), filing.

**Generic Agent verification is not CSP authority.** Foreign founders often cannot self-file — listings may flag “local filing agent required” only when sourced from ACRA, not from sales copy.

Registered office and company secretary are **statutory company duties**, not optional Strideto upsells without labelling.

### 12.6 UAE

Official mainland steps: UAE Government portal “Steps to start a business on the mainland” (`u.ae` business section). Fetch of one nested URL returned 404 in this session — **treat exact page path as to-be-reconfirmed**; the official UAE platform remains the source class.

**Must support:** Mainland vs Free Zone; Emirate; Free Zone authority; activity; licence type; legal form. **Forbidden SKU:** `UAE → LLC`.

Federal Commercial Companies Law vs emirate DED/DET vs free-zone authority (DMCC, ADGM, DIFC, etc.) are **different `Authority` records**.

### 12.7 Pakistan

Official: [SECP Registration of Company](https://www.secp.gov.pk/company-formation/registration-of-company/); eZfile/LEAP: `https://leap.secp.gov.pk/`. Companies Act 2017 / Companies Regulations 2024.

Structures: public (3+), private (2+), **single member company**, plus LLP and others listed by SECP.

Name reservation + incorporation may be combined or separate. Digital PIN signing is an SECP process — Strideto must not store PINs.

Post-incorporation tax (FBR NTN) is a **separate authority**. Do not bundle “SECP + NTN + bank account guaranteed.”

**Home-market fit:** high. Launch-relevant for buyers **and** for Pakistani providers serving outbound US/UK formation.

---

## 13. US State-Level Architecture

### 13.1 Inventory schema (all states + DC)

For each of AL, AK, AZ, AR, CA, CO, CT, DE, DC, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY:

| Field | Rule |
| --- | --- |
| `jurisdictionCode` | ISO + USPS (e.g. `US-WY`) |
| `authorityName` | Official registrar name |
| `formationPortalUrl` | Official SOS / Division of Corporations |
| `entityStructures` | From official entity list, not a national default |
| `registeredAgentConcept` | Almost always required; still **per-state sourced** |
| `formationFilingSource` | Official form/portal |
| `periodicReportSource` | Annual/biennial if any |
| `foreignQualificationSource` | Certificate of authority / registration |
| `feeSourceUrl` | Official fee schedule PDF/page |
| `statusSearchUrl` | Official entity search |
| `lastReviewedAt` | Required before public display |
| `reviewStatus` | `draft \| reviewed \| stale \| superseded` |

**Do not** populate fee amounts from Northwest / LegalZoom / “best LLC state” articles.

### 13.2 Representative deep-audit (schema validation only — not “best states”)

| Jurisdiction | Official registrar / portal | Notes (architecture) |
| --- | --- | --- |
| **Delaware** | [Division of Corporations — How to form](https://corp.delaware.gov/howtoform/); forms e.g. Certificate of Formation template on `corpfiles.delaware.gov` | Registered office + registered agent in DE required on formation certificate. EIN is **federal/IRS**, not Delaware. Do not claim “no annual report” as a Strideto slogan; obligations must be sourced from DE Division of Corporations / Division of Revenue. |
| **Wyoming** | [SOS Business](https://sos.wyo.gov/business/default.aspx); [WyoBiz](https://wyobiz.wyo.gov/); [Fee schedule PDF](https://sos.wyo.gov/Business/docs/BusinessFees.pdf) (revised June 2026 / effective 1 Jul 2026 on the official PDF) | RA must have **physical Wyoming address**; PO Box alone insufficient; drop box not acceptable (Articles of Organization instructions). Annual report concept exists on SOS site. Commercial RA list is a SOS concern. |
| **Florida** | Sunbiz / FL Division of Corporations (`sunbiz.org`) | **NOT FULLY FEE-AUDITED in this session.** Catalog from official Sunbiz fee/forms pages before launch. |
| **Texas** | Texas Secretary of State (`sos.texas.gov`) | **NOT FULLY FEE-AUDITED here.** SOSDirect is the official filing/search class. |
| **California** | California SOS BizFile (`bizfileonline.sos.ca.gov`) | **NOT FULLY FEE-AUDITED here.** Franchise Tax Board is a **separate tax authority**. |
| **New York** | NY Department of State Division of Corporations (`dos.ny.gov`) | **NOT FULLY FEE-AUDITED here.** Publication requirements (if still applicable to LLCs) are a **NY-specific rule row**, not a US-wide field. |

Processing times on WyoBiz (“filings processed through [date]”) are operational notices, not SLAs Strideto should guarantee.

---

## 14. Country Expansion Prioritization

Framework: founder demand, provider supply, official-source clarity, sub-jurisdiction complexity, regulated-provider burden, source maintainability, support/language, document sensitivity, mail feasibility, monetization.

| Wave | Jurisdictions | Why |
| --- | --- | --- |
| **LAUNCH WAVE** | Pakistan (buyer home + SECP clarity); United States (state catalog + RA concept + foreign-founder demand); United Kingdom (Companies House + ACSP model) | Highest Strideto audience overlap; official portals are documentable; provider market exists |
| **WAVE 2** | Singapore (CSP Act — high Trust value); UAE (high demand, **high complexity** — only if Emirate/Free Zone model is ready); Canada federal + 1–2 provinces | Strong official sources; more regulatory provider gates |
| **WAVE 3** | Remaining Canadian provinces/territories; Australia; additional US states beyond an initial subset; other GCC | Source catalog cost dominates |

**Launch US states (recommendation, USER decision):** start with a **reviewed subset** (e.g. DE, WY, plus 2–3 high-demand states after source review), not all 51 rows public on day one. Inventory architecture exists for all 51; **publication** is gated on `reviewStatus`.

Do **not** promise “global coverage.”

---

## 15. Public Marketplace Pages

Proposed IA (names follow existing `/agents` style; exact paths are a USER/IA decision):

| Path (illustrative) | Purpose | Indexable? |
| --- | --- | --- |
| `/business-services` | Hub, how it works, Trust disclaimer | Yes |
| `/business-services/providers` | Directory | Yes |
| `/business-services/provider/:slug` | Provider profile (approved only) | Yes |
| `/business-services/service/:slug` | Listing | Yes |
| `/business-services/countries` | Country index | Yes |
| `/business-services/countries/:country` | Country landing + official sources | Yes |
| `/business-services/countries/:country/:jurisdiction` | e.g. Wyoming | Yes |
| `/business-services/compare` | Neutral comparison | Yes, noindex if query-spam |
| `/business-services/how-it-works` | Platform role | Yes |
| `/business-services/trust` | Badge meanings | Yes |
| `/business-services/help` | Help | Yes |
| `/business/*` (workspace) | Private | **noindex** |
| Case/document/mail URLs | Private | **noindex**, robots disallow |

Reuse public Navbar/Footer (dark shell). Do not put Agent sidebar on public pages.

Canonical URLs required to avoid `/usa/wyoming-llc` vs `/united-states/wy/llc` duplicates.

---

## 16. Public Search / Filters

| Filter | Class |
| --- | --- |
| Service category, destination country, jurisdiction, entity type | **AUTHORITATIVE** catalog |
| Founder residency supported, languages, delivery mode | **PROVIDER-DEFINED** (moderated) |
| Verified organization / capability / RA / RO / credential | **AUTHORITATIVE** Trust |
| Pricing model, price range, turnaround | **PROVIDER-DEFINED** (must not mix government fees) |
| Rating, review count | **USER-REVIEW-DERIVED** (eligible cases only) |
| Availability | **COMPUTED** from existing availability or listing flag |

No empty categories. Server-side pagination/filter (Agent directory already uses page/limit 20). No fake “1000+ verified RA” counts.

---

## 17. Business Client Workspace

Illustrative base: `/business` (User session).

| Page | Purpose | Data owner | Permissions | Primary actions | Empty | Mobile | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Overview | Counters + next actions | Server aggregates | Owner/member | Continue case, upload doc | Honest zeros | Cards | Agent/Student dashboards |
| My Businesses | ClientBusiness list | Client | Owner/member | Add business (progressive) | CTA discover | List | Institution programs list pattern |
| Discover | Browse listings | Public catalog | Any authenticated client | Request | Filters | Same as public | Agent directory |
| Saved providers | Private saves | User | Owner | Open / unsave | Empty | List | Marketplace save (already private) |
| Compare | Neutral table | Catalog + saved | Owner | Open listing | Need ≥2 | Horizontal scroll + cards | Employer compare **pattern only**, not candidate PII |
| Requests | ServiceRequest | Client | Owner/member | View status | Empty | Cards | Agent leads inverse |
| Quotes | Quote | Provider-authored | View/accept | Accept (no fake pay) | Empty | Cards | Commerce quote honesty |
| Cases | GBS cases | Case | Participants | Open | Empty | Cards | `ProfessionalCase` **extended**, not study workflow |
| Documents | Vault + grants | User Vault | Least privilege | Upload / share to case | Vault empty | Existing Vault | **Vault as-is** |
| Messages | Threads | Case/consultation | Participants | Reply | Empty | Existing | Consultations/cases messages |
| Tasks | Client tasks | Case tasks | Assignee | Complete | Empty | List | Journey tasks |
| Compliance calendar | Obligations | Sourced rules + provider | View | Open obligation | Empty | Month view | Journey calendar |
| Mailroom | Mail items | Provider location | Client of mailbox | Confirm / scan / forward | Empty | Cards | **New subsystem** |
| Reviews | Eligible reviews | Trust | Reviewer | Write | Empty | Form | ProfessionalReview |
| Support | Tickets | SupportTicket | Owner | Open ticket | Empty | Existing | `/support` |
| Notifications | Inbox | UserNotification | Owner | Open | Empty | Bell | `recipientType` extension |
| Team | Org members | Membership | Org admin | Invite | Empty | Table→cards | Agent/Institution team |
| Account / Settings | Security | User | Owner | Password, sessions | — | Existing | Profile account-settings |

**Do not** show Student portal nav (`StudentPortalNav`) on `/business`.

---

## 18. Provider Workspace

Extend **Agent** (`/agent/*`). Do not fork a new portal chrome.

| Module | Verdict |
| --- | --- |
| Dashboard | **Extend** counters for GBS |
| Business Services hub | **New submodule** `/agent/business-services` |
| Service listings | **Extend** `AgentService` + marketplace posts with GBS category + jurisdiction |
| Jurisdictions / capabilities | **New** capability records |
| New requests / quotes | **Extend** leads **or** new ServiceRequest (prefer new — leads are student-conversion shaped) |
| Active cases | **Extend** cases with new type/family |
| Waiting for client / filings | **New** case queues (filters on existing Cases page possible) |
| Clients | **Extend** AgentClient — today unique `(organizationId, userId)` Student-shaped; GBS client may be User **or** buyer org |
| Document requests | **Reuse** CaseDocumentRequest + Vault grants |
| Messages / tasks / calendar | **Reuse** |
| Compliance | **New** provider task list |
| Registered addresses / mailroom | **New** (post-MVP) |
| Reviews / Trust / notifications / team / settings / help | **Reuse** |
| Usage / billing / commerce | **Reuse placeholders**; stay `not_configured` |
| Verification | **Extend** with capability evidence |

---

## 19. Admin / Core Team Workspace

Reuse Admin sidebar + queues; add GBS sections rather than a second admin app.

| Need | Reuse |
| --- | --- |
| Provider KYC | `/admin/verification-queue` |
| Listing moderation | `/admin/agent-marketplace` + `/admin/moderation` |
| Reviews / disputes / reports | `/admin/sc/trust` |
| Support | `/admin/support` |
| Audit | `/admin/audit` |
| Commerce (later) | `/admin/sc/commerce` |
| **New:** capability / jurisdiction-capability / credential review | New queue, same `AdminDataTable` (do not edit current WIP; future phases use the shared component) |
| **New:** jurisdiction catalog, official sources, fee catalog, source freshness | New Super Control pages |
| **New:** case escalations, mailroom escalations | New, audit-logged |

No impersonation. No “view as provider.”

---

## 20. Listing Architecture

Conceptual fields (not a schema file):

`provider`, `providerCapability`, `serviceCategory`, `country`, `jurisdiction`, `entityType`, `supportedFounderResidencies`, `supportedLanguages`, `businessActivitiesSupported` (provider-defined, not legal advice), `serviceTitle`, `summary`, `scope`, `includedServices`, `excludedServices`, `requiredDocuments` (tagged official vs provider), `providerFee`, `governmentFee`, `thirdPartyFee`, `recurringFee`, `optionalServices`, `pricingModel`, `currency`, `estimatedProviderTurnaround`, `authorityProcessingDisclaimer`, flags for RA/RO/mail/compliance/consultation, `supportChannels`, refund/cancellation **policy text**, `status`, `moderationStatus`, `publishedAt`, `lastUpdatedAt`.

**Never merge** provider fee + government fee + third-party + Strideto fee into one “price.”

Pricing modes already include `quote_required` and `payment_not_configured` — prefer those for MVP.

Moderation: first listings **Admin review** (USER decision; recommended yes).

---

## 21. Request / Quote Workflow

**Preferred term:** **Service Request** (not Job Application). “Formation Request” is a subtype.

```
DISCOVER → REQUEST SERVICE → PROVIDER REVIEW
  → MORE INFORMATION NEEDED
  → QUOTE PREPARED → QUOTE SENT
  → CUSTOMER ACCEPTED → CASE CREATED
```

If Commerce remains disabled: **accept quote creates a case**. UI: “You accepted this quote. Payment is not processed on Strideto.” No fake paid, escrow, or payout.

Future: insert PAYMENT / ESCROW / PAYOUT only after commerce certification.

---

## 22. Case State Machine

**New family** `business_services`. Do not reuse `shared/services/cases.js` study stages as filing truth.

| State | Client | Provider | Evidence | Notes |
| --- | --- | --- | --- | --- |
| REQUESTED | create | view | — | From request |
| UNDER_PROVIDER_REVIEW | view | set | — | |
| INFORMATION_REQUIRED | upload/reply | set | — | |
| DOCUMENTS_REQUIRED | upload | set | Vault grant | |
| DOCUMENTS_UNDER_REVIEW | view | accept/reject doc | | |
| READY_TO_PREPARE | view | set | checklist complete | |
| PREPARATION_IN_PROGRESS | view | set | | |
| READY_TO_FILE | view | set | | |
| FILED_WITH_AUTHORITY | view | set | authority ref **provider-reported** | |
| AUTHORITY_PROCESSING | view | set | | |
| AUTHORITY_INFORMATION_REQUESTED | reply | set | | |
| REGISTERED_PROVIDER_REPORTED | view | set | **not** Strideto verified | |
| REGISTERED_EVIDENCE_RECEIVED | view | upload cert | document | |
| REGISTERED_OFFICIAL_SOURCE_VERIFIED | view | cannot self-mint | Admin/source | optional, later |
| POST_REGISTRATION_SETUP | view | set | | |
| COMPLETED | view | set | | |
| ON_HOLD | view | set | reason | |
| REJECTED / CANCELLED / DISPUTED | limited | set + Admin | | |

Every transition: actor, timestamp, audit log, notification. No destructive timeline edits.

---

## 23. Timeline / Audit Events

| Event | Client | Provider | Admin | Security log |
| --- | --- | --- | --- | --- |
| created / submitted / quote / accepted | Yes | Yes | Yes | Yes |
| document requested / uploaded / accepted / rejected | Yes | Yes | Yes | Yes |
| filed / authority reference | Yes (provider-reported label) | Yes | Yes | Yes |
| approved/registered | Yes with provenance | Yes | Yes | Yes |
| staff notes | No | Internal | Yes | Yes |
| Vault download | No | No | On demand | **Yes** |
| identity document view | No | If granted | If policy | **Yes** |

---

## 24. Documents / Vault

Reuse Vault. Classification: passports, national ID, proof of address, ownership/shareholder/director data, certificates, tax docs, authority mail = **HIGHLY SENSITIVE**.

Rules: owner User; case-bound grants; expiry; revoke; no public URLs; no ordinary media library; malware scan (`not_configured` must be honest); retention/soft-delete; team access only via membership + grant; Admin access only support/safety with audit.

**Never** copy director identity onto public listings.

Provider-requested docs must be labelled **provider requirement**, not “government required,” unless the checklist row is sourced official.

---

## 25. Business Profile / My Businesses

`ClientBusiness`: display name, target jurisdiction, entity type, registration status, formation date, official number, RA/RO, provider, compliance snapshot, documents, mail, service history.

Three provenance columns: **provider-entered** | **document-backed** | **official-source-verified**.

A business is **not** an Employer and **not** automatically a public Company CMS page.

---

## 26. Compliance Calendar

Items: annual report/return, confirmation statement, RA/RO renewal, secretary, licences, register updates, document expiry, provider-service renewal. Tax reminders only where obligation is catalogued official — **no personalized tax advice**.

Event: `business`, `jurisdiction`, `obligation`, `authority/source`, `dueDate` (UTC), `responsibleActor`, `status`, reminders, evidence, `lastReviewed`, confidence.

Reuse Journey `UserDeadline` **pattern**, not the student opportunity deadline taxonomy.

---

## 27. Cost Estimator

Lines, each with amount, currency, source, required/optional, one-time/recurring, last updated, controller:

OFFICIAL GOVERNMENT FEE | PROVIDER PROFESSIONAL FEE | REGISTERED AGENT FEE | REGISTERED OFFICE FEE | MAIL | TAX/ID SERVICE | OPTIONAL | STRIDETO FEE (future) | OTHER THIRD-PARTY

Then **initial estimated total** and **estimated recurring** separately.

No silent FX as truth. Label conversions as indicative.

Wyoming example of **official** government fee sourcing: SOS Business Division fee schedule PDF (effective 1 July 2026 on the official document). Display only after Admin review of that PDF’s current version.

---

## 28. Jurisdiction Comparison Tool

Compare: authority, entity structure, RA/RO requirements, local-presence rules, official filing fee (sourced), periodic filings, provider availability, official URLs, last reviewed.

**Forbidden outputs:** “best country/state”, “lowest tax for you”, personalized legal/tax recommendation.

Informational comparison, not advice. Disclaimer required.

---

## 29. Document Checklist Tool

Statuses: NOT REQUIRED | REQUIRED | NOT PROVIDED | UPLOADED | UNDER REVIEW | ACCEPTED | REPLACEMENT REQUESTED | EXPIRED.

Row `requirementSource`: `official_jurisdiction` | `provider` | `case_specific`.

UI must show the source on every row.

---

## 30. Mailroom / Parcel System

Treat as **physical operations + privacy**, not chat.

Lifecycle: RECEIVED → UNASSIGNED → MATCHED → CLIENT NOTIFIED → AWAITING CONFIRMATION → CONFIRMED → SCAN | FORWARD | PICKUP | ARCHIVE; forward: PREPARING → DISPATCHED → TRACKING → DELIVERED.

Client: confirm mine / not mine / request scan / forward / archive.  
Provider: record, match, envelope metadata per policy, notify, scan permitted items, tracking, complete.

Isolation: mailbox per business; provider staff scoped; no cross-client enumeration; prohibited content policy; misdelivery/dispute; audit.

**Recommendation: POST-MVP.** Launch without mailroom. Architecture is G3/G4. Shipping a fake “mail tab” that is only messages would be misleading.

---

## 31. Consultation / Scheduling

**Reuse** Agent availability + consultations (`PAYMENT_NOT_CONFIGURED`).

Supports pre-purchase, formation, document-review, compliance calls. Do **not** build a second calendar. Extend consultation **topic** / case-link, not a new product.

---

## 32. Messaging

Reuse consultation/case threads. Participants: client User, provider org members with capability, not the whole agency by default.

Admin: support / dispute / safety only, audited. Prevent cross-client access (existing case thread model is the template).

---

## 33. Notifications

Reuse `UserNotification` + `recipientType`. Add `business_client` recipient (or User + workspace filter).

Events: request, quote, accept, info/doc requested, doc accepted/rejected, case status, filing submitted, authority update, completed, deadline, mail (later), message, listing/verification/review.

Channels: in-app + email (queued). Worker remains a **runtime** concern — this audit does not start it. Do not claim live email until worker/SMTP policy matches 17C.

---

## 34. Reviews / Reputation

Prefer **verified-service review** after eligible case (completed or defined milestone). Dimensions: communication, timeliness, clarity, document handling, overall.

Provider response, report abuse, moderation — reuse ProfessionalReview.

**Reviews never mint regulatory verification.**

---

## 35. Analytics / Counters

All counters from **server aggregates**. No hardcoded dashboard numbers.

**Provider:** new requests, quotes awaiting, active cases, waiting for customer, ready to file, authority processing, action needed, deadlines 7/30, docs requested, unread messages, mail awaiting (later), listings active/under review, active clients, compliance due.

**Client:** businesses, requests, cases, waiting for me, submitted to authority, docs requested, deadlines, mail (later), saved, open quotes, unread messages.

**Admin:** providers/capabilities/listings awaiting review, reports, high-risk claims, stale sources, disputes, mail escalations (later), suspended providers.

Each retained counter needs a query: count of records in state X for `organizationId` / `userId` / admin filter. Same freshness rules as Employer Applications (visibility/focus, no polling storms).

---

## 36. Commerce Boundary

Launch: quotes + off-platform or unpaid acceptance. Surfaces stay `not_configured`.

Future: quote → invoice → payment → platform fee → refund → payout → dispute. Reuse `shared/commerce/contracts.js`. No Stripe/payout/escrow in GBS implementation until commerce is certified.

Provider KYC for payouts **≠** Strideto org verification (Agent Commerce already states this).

---

## 37. Legal / Marketplace Boundary

Communicate: marketplace role; independent providers; no government affiliation; no automatic legal/tax advice; no guaranteed registration/bank/processor/marketplace/visa; times vary; rules change; fees separated; last-reviewed dates; customer accuracy duty.

Later (not this phase): Terms, Privacy, Marketplace Guidelines, provider agreement, prohibited-claims list (extend `GUARANTEE_FORBIDDEN_PHRASES`).

Do not edit those documents now.

---

## 38. Fraud / Abuse Threat Model

| Threat | Control |
| --- | --- |
| Fake providers / credentials / RA / ACSP / CSP | Layered capability verification; Admin queues; no self-serve protected titles |
| Fake government affiliation / fake filing | Provenance labels; no official seal; evidence required for “registered” |
| Stolen documents / malware | Vault; scan; grants; audit |
| Cross-client access / IDOR | Realm + org + case ACLs; no sequential public IDs |
| Fake addresses / misdirected mail | Mailroom post-MVP; confirmation; disputes |
| Phishing / advance-fee | Policy; report; no Strideto payment until commerce |
| Guaranteed banking/Stripe/Amazon/visa | Forbidden phrases + moderation |
| Fake reviews / bait pricing | Case-tied reviews; fee line items; listing review |
| Provider disappearance | Escrow later; now: support + dispute + suspend |
| Charge disputes | N/A until payments |

---

## 39. Privacy / Data Classification

| Class | Examples | Treatment |
| --- | --- | --- |
| PUBLIC | Approved listing, country page, last-reviewed | Indexable |
| ACCOUNT | Email, login | User realm |
| BUSINESS-CONFIDENTIAL | Cap table, internal notes | Case/org ACL |
| PERSONAL DATA | Name, phone | Minimize; PhoneInput E.164 |
| HIGHLY SENSITIVE IDENTITY | Passport, national ID | Vault only |
| FINANCIAL | Quotes, later payments | Commerce models |
| LEGAL/CORPORATE | Certificates, filings | Vault + provenance |
| MAILROOM PRIVATE | Envelope contents | Strictest ACL |
| ADMIN SECURITY | Audit, sessions | Staff RBAC |

---

## 40. RBAC / Permission Matrix

Fail closed. Conceptual:

| Action | Guest | Client owner | Client member | Provider owner | Provider member | Admin reviewer | Admin support | Super Admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| View public listing | Y | Y | Y | Y | Y | Y | Y | Y |
| Request service | N | Y | if granted | N | N | N | N | N |
| View request/quote | N | own | if granted | assigned org | if cap | Y | Y | Y |
| Create quote | N | N | N | Y | if cap | N | N | N |
| Accept quote | N | Y | if granted | N | N | N | N | N |
| Open/transition case | N | limited | limited | per matrix | per matrix | override audited | N | Y |
| Docs upload | N | own Vault | if granted | N | N | N | N | N |
| Docs view/download | N | own/grant | grant | grant | grant | policy+audit | policy+audit | Y |
| View client identity | N | self | limited | if case | if case | Y | limited | Y |
| Mark provider-reported complete | N | N | N | Y | if cap | N | N | N |
| Official-source verified | N | N | N | N | N | Y | N | Y |
| Mail manage | N | own mailbox | if granted | location staff | if cap | escalate | escalate | Y |
| Review | N | eligible | N | respond | N | moderate | N | Y |
| Suspend provider | N | N | N | N | N | Y | N | Y |

---

## 41. Tenant Isolation / IDOR

- Client A cannot list Client B businesses (`userId` / `buyerOrganizationId` scoped).
- Provider A cannot list Provider B clients (`organizationId` scoped).
- Provider staff: membership + capability, not “any agency user.”
- No enumerable `/api/business/1` without authz.
- Public slugs only for **approved** listings/profiles.
- Mail and Vault never in public search.
- Hidden UI is not authorization (existing Agent/Employer pattern).

---

## 42. Data Model Recommendation

Conceptual only. **No Mongo models in this phase.**

| Entity | Purpose | Owner | Tenant | Sensitive | SoT | Reuse |
| --- | --- | --- | --- | --- | --- | --- |
| BusinessServiceCategory | Taxonomy | Platform | Global | Public | Admin catalog | New; Agent categories stay |
| BusinessServiceCapability | Verified offering type | Platform + provider | Provider org | Public flags | Admin+evidence | New |
| Jurisdiction / Authority / Source / EntityType / Rule / GovernmentFee / Obligation | Intelligence | Platform | Global | Public | Official sources | New; CanonicalSource extend |
| ProviderCapability / ProviderJurisdictionCapability | What this org may sell | Provider org | Org | Mixed | Verification | New |
| ServiceListing | Sellable SKU | Provider | Org | Public after approval | Listing+moderation | Extend AgentService / MarketplacePost |
| BusinessClientWorkspace | Preference/capability | User | User | Account | Active Workspace later | Extend preference |
| ClientBusiness | Tracked entity | User or buyer org | Client | Confidential | Client+provider+source | New |
| ServiceRequest / Quote | Pre-case | Client / provider | Dual | Confidential | Those records | New (don’t overload Application) |
| GbsCase + participants + timeline + requirements | Operations | Dual | Case | High | Case services | Extend ProfessionalCase **family** |
| CaseDocumentLink | Vault pointer | User | Grant | High | Vault | Reuse grants |
| BusinessRegistrationRecord | Numbers/dates | Mixed provenance | Client | Medium | Provenance fields | New |
| ComplianceTask | Calendar | Mixed | Client/provider | Medium | Obligation+case | New / Journey pattern |
| MailLocation / Mailbox / MailItem / ForwardingRequest | Mailroom | Provider location | Mailbox | High | New | **New G3/G4** |
| Review / Dispute | Trust | Parties | Org | Medium | Existing trust | Reuse |

---

## 43. Search / Performance

Server pagination; indexes on `(status, category, country, jurisdiction)`; stable sort; filter counts; cache **public catalogs** (countries, reviewed jurisdictions); source freshness jobs later (worker still not started by this audit).

Do not client-filter thousands of listings in the browser.

---

## 44. SEO

Index hubs, countries, reviewed jurisdictions, approved providers/listings. Canonical tags. Last reviewed. Structured data only for **public** listings, never cases.

`robots.txt` already disallows `/agent/`, `/employer/`, `/vault`, etc. Add `/business/` workspace when built. Private cases must never be sitemap’d.

---

## 45. Internationalization

Reuse CountrySelect (full source, searchable, viewport-safe). PhoneInput digits-only, E.164, no silent country default. Dates/times: UTC store, local display, one icon Light/Dark (`NativeTemporalInput`).

Do not enable Arabic as complete if it remains coming-soon. Long jurisdiction names wrap. Currency per fee line. RTL: existing i18n readiness, don’t claim full AR GBS copy.

---

## 46. Theme / Design-System Contract

**Mandatory for every future GBS visual phase.**

Canonical tokens: `client/src/design-system/semanticTokens.js` (`semantic-page-bg`, `nav-bg`, `elevated`, `card`, `border`, `text-primary/secondary/muted`, `input-*`, `focus`, `disabled`, `primary`, `success`, `warning`, `danger`, `info`). Surfaces: `client/src/design-system/surfaceClasses.js` (`ui.page`, `ui.card`, `ui.input`, `ui.empty`, …).

| Surface | Light | Dark | Exception |
| --- | --- | --- | --- |
| Public Navbar | Navy `#0f172a` | Same | Product decision — not theme-white |
| Public Footer | `#0F172A` | Same | |
| Main content | semantic page/card/text | semantic dark | |
| Account dropdown | white card / dark gray-800 | | 17D-0 |
| Portal sidebar | existing `portalNavLinkClass` | | hover ≠ selected |

**Do not** hardcode random white/black/slate/gray when a semantic token exists. Brand blue/orange may be intentional.

System / Light / Dark all required. Public navbar stays dark in all three.

---

## 47. Alignment Contract

| Layout | Rule |
| --- | --- |
| 1-col | Default <768 |
| 2-col | 768–1023; labels stack if longer than control |
| 3-col | ≥1024 only; drop columns before squeezing |
| Labels | Above control on mobile; aligned row on desktop **or** stacked — never mixed heights in one row |
| Helper / error | Reserved min-height so rows don’t jump |
| Optional | Visible “(optional)”, not color-only |
| Buttons | min-h 44px; primary+secondary wrap |
| Cards | `ui.card` padding |
| Filters/toolbars | Wrap; no horizontal body overflow |
| Long labels | Wrap; do not shrink inputs below usable width |

---

## 48. Responsive Contract

**Every future GBS visual phase must test:** 320, 375, 768, 1024, 1440, and **200% zoom**, in System / Light / Dark.

Requirements: no body overflow; dropdowns/dialogs in viewport; tables have a strategy; names/fees wrap; timelines readable; filters usable; calendar usable; drawer usable; sticky bars don’t cover actions; 44px targets.

### Tables

| Screen | Strategy |
| --- | --- |
| Provider cases, Admin queues | ≥1024 table; 768 priority columns; 320 **cards** |
| Quotes, clients, filings | Same |
| Mail, compliance | Cards-first on small |
| Never | 12-column table overflowing the viewport |

Reuse `AdminDataTable` overflow-x **inside** the table, not the page (do not modify current WIP in this phase).

---

## 49. Accessibility Contract

Keyboard, `:focus-visible`, names, `aria-expanded` / `aria-current` / `aria-haspopup`, dialog focus + Escape, combobox Country/SearchableSelect, form errors `role="alert"`, status not color-only, table headers, 17D-0 account menu patterns.

---

## 50. Loading / Shell Stability Contract

Do **not** gate `MainLayout` on GBS hydration. Public Navbar/Footer stay mounted. Role Agent shell stays mounted inside `/agent`. Bounded local skeletons. No indefinite `Loading...`. Every async flow: loading, success, empty, safe error. No pathname-triggered `setLoading(true)` on the root shell (17C/17D-0 lesson).

---

## 51. Existing Reuse Matrix

| Capability | Current module | Verdict | Risk | Rationale |
| --- | --- | --- | --- | --- |
| Identity cookies | AuthCookiePolicy + 4 contexts | **REUSE AS-IS** | Low | Do not add 5th cookie |
| Workspace switching | activeWorkspace.js | **EXTEND** | Med | Add `business_client` preference later |
| Organization | Organization.js | **EXTEND** | Med | New buyer type; don’t use employer |
| Provider onboarding | AgentOnboarding | **EXTEND** | Med | Extra capability steps |
| Provider verification | OrganizationVerification | **EXTEND** | High if collapsed | Add capability layer |
| Service listing | AgentService / MarketplacePost | **EXTEND** | Med | New categories + jurisdiction |
| Marketplace search | AgentDirectory / Marketplace | **EXTEND** | Med | New public IA |
| Saved items | Marketplace save / journey saved | **REUSE AS-IS** | Low | Private save |
| Compare | Employer candidate compare | **DO NOT REUSE data** | High PII | Reuse UX pattern only |
| Consultation / availability | consultations + AgentAvailability | **REUSE AS-IS** | Low | |
| Service request | AgentLead / Application | **NEW** | Med | Leads/Applications are the wrong noun and ACL |
| Quote | pricing modes + commerce snapshot | **EXTEND** | Med | No payment |
| Case / timeline | ProfessionalCase + cases.js | **EXTEND** | High if study workflow reused | New family |
| Documents / Vault | vault/* | **REUSE AS-IS** | High if bypassed | |
| Messages | case/consultation threads | **REUSE AS-IS** | Med ACL | |
| Notifications | UserNotification | **EXTEND** | Low | recipient/workspace |
| Reviews | ProfessionalReview | **REUSE AS-IS** | Low | Case-eligibility |
| Calendar / tasks | Journey deadlines/tasks | **EXTEND** | Med | New obligation types |
| Team | Agent/Institution membership | **REUSE AS-IS** | Med | Buyer org team |
| Admin verification | verification-queue | **REUSE AS-IS** | Low | |
| Moderation | agent-marketplace + Trust Center | **EXTEND** | Low | |
| Audit log | auditService | **REUSE AS-IS** | Low | |
| Commerce | Stripe not_configured | **REUSE AS-IS** | High if faked | |
| Analytics | dashboard counters pattern | **EXTEND** | Low | Server counts |
| Theme / navbar / Phone/Country/Date | 17C-V / 17C-VR / 17D-0 | **REUSE AS-IS** | High if forked | |
| FormField | exists | **REUSE** without editing WIP | — | |

---

## 52. Gap Matrix

| ID | Class | Description | Actors | Dependency | Security | Privacy | UX | Scope | MVP? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GBS-01 | G1 | Active Workspace `business_client` label | Buyer | 17D-0 | Low | Low | High | Preference + copy | Yes (when GBS ships) |
| GBS-02 | G2 | Buyer org type + membership | Org buyers | Organization | Med | Med | Med | Additive type | If org clients in MVP |
| GBS-03 | G2 | ServiceRequest + Quote | Both | New | Med | Med | High | New | **Yes** |
| GBS-04 | G2 | GBS case family + provenance | Both | Cases | High | High | High | Extend cases | **Yes** |
| GBS-05 | G2 | Listing jurisdiction fields + fee split | Provider/public | AgentService | Med | Low | High | Extend | **Yes** |
| GBS-06 | G3 | Jurisdiction/source/fee catalog | Platform | CanonicalSource | Med | Low | High | New | **Yes** (thin catalog) |
| GBS-07 | G3 | Capability verification layers | Provider/Admin | OrgVerification | **High** | Med | High | New | **Yes** (RA/ACSP gated) |
| GBS-08 | G1 | Forbidden-claim lexicon for GBS | Public | agent constants | Med | Low | Med | Extend | **Yes** |
| GBS-09 | G2 | ClientBusiness tracker | Buyer | New | Med | Med | High | New | **Yes** (simple) |
| GBS-10 | G2 | Checklist with source tags | Both | Vault | Med | High | High | New | **Yes** |
| GBS-11 | G2 | Public `/business-services` IA | Guest | Discovery | Low | Low | High | New pages | **Yes** |
| GBS-12 | G2 | Admin capability/source queues | Admin | Admin tables | Med | Low | Med | New pages | **Yes** |
| GBS-13 | G1 | Notification types | Both | Inbox | Low | Low | Med | Extend | **Yes** |
| GBS-14 | G2 | Cost estimator | Public/client | Fee catalog | Low | Low | Med | New | Thin MVP |
| GBS-15 | G2 | Comparison tool | Public | Catalog | Low | Low | Med | New | Thin MVP |
| GBS-16 | G2 | Compliance calendar | Client | Obligations | Med | Low | Med | New | **Defer** |
| GBS-17 | G3 | Mailroom | Both | New | **High** | **High** | High | New | **Defer** |
| GBS-18 | G4 | Payments/payouts/escrow | Both | Stripe | **High** | High | High | Commerce cert | **Defer** |
| GBS-19 | G4 | Government API filing | Provider | External | **High** | High | High | Integrations | **Defer** |
| GBS-20 | G4 | Tax calculation / legal advice | Client | — | High | High | High | Policy | **Never as conceived** |
| GBS-21 | G4 | Nominee director marketplace | — | — | **High** | High | High | Legal | **Defer / likely never** |
| GBS-22 | G3 | Official-source verified registration | Admin | Catalog | Med | Low | Med | New | **Defer** |
| GBS-23 | G1 | Employer-as-buyer confusion | Employer | 17D-0 | Med | Low | High | Product copy + ACL | **Yes** (policy) |
| GBS-24 | G2 | AgentClient uniqueness vs buyer org | Provider | AgentLead | Med | Med | Med | Data model | Yes |
| GBS-25 | G4 | AI “best jurisdiction for you” | Public | AI policy | High | Med | High | AI budget **OFF** | **Never at launch** |

---

## 53. Competitive Pattern Audit

Used for **UX/ops patterns only**, not legal facts.

Observed patterns (formation platforms, RA services, virtual-office, compliance tools): jurisdiction pickers, bundled RA, upsell EIN/banking, “guaranteed” language, opaque fee blending, mail scanning, dashboards with fake progress.

**Strideto must invert the worst patterns:** separate fees, provenance, no guarantees, no pretending to be the SOS.

**OFFICIAL REGULATORY FACT** (Companies House, SECP, ACRA, SOS, IRS, Corporations Canada, ASIC/BRS, u.ae) **≠** **COMPETITOR MARKETING CLAIM** (“best state”, “LLC in 24h guaranteed”, “bank account included”).

---

## 54. MVP Recommendation

**Smallest valuable product:**

1. Public Business Services hub with honest platform role.
2. Providers = verified **Agent/Agency** with **formation capability** (not RA/ACSP unless evidenced).
3. Listings bound to country + jurisdiction + entity type; **split fees**; quote_required / payment_not_configured.
4. Service Request → Quote → Case (no Strideto payment).
5. Messages + Vault grants + document checklist with source tags.
6. Simple My Businesses + provider-reported timeline with provenance.
7. Admin: listing + capability + source review.
8. Notifications in-app (email if existing queue/worker policy allows — do not start worker for this audit).

**Wait:** mailroom, Commerce/payments/payouts/escrow, advanced compliance automation, tax calculations, automatic government filing, government integrations, AI recommendations, nominee directors, “official-source verified” as a default badge.

**Differentiators worth keeping:** verified capabilities, jurisdiction-aware discovery, source-backed requirements, fee separation, case+Vault+messages, Trust, reviews tied to cases.  
**Not worth launch complexity:** mailroom, global coverage, tax engine.

---

## 55. Deferred / High-Risk Capabilities

Unsafe / misleading / too complex / duplicative / incompatible:

- Fifth auth realm / llc-agent cookie
- Employer cookie as GBS buyer
- Universal `UAE → LLC` or `USA → LLC` SKU
- Calling all providers Registered Agents
- Guaranteed bank/Stripe/PayPal/Amazon/visa/residency
- Strideto-as-filer / Strideto-as-law-firm
- Fake payments while `not_configured`
- Mailroom as a message thread
- AI personalized tax/jurisdiction advice (also violates AI budget: paid AI default OFF)
- Reusing study-abroad case stages as formation legal states
- Public SEO of cases/documents
- Completeness score as verification

---

## 56. Implementation Dependency Graph

**NO PHASE NUMBERS.**

```
identity/workspace model (User + optional buyer org; Agent provider)
        ↓
taxonomy + jurisdiction + official-source catalog
        ↓
Trust / capability verification
        ↓
provider listings (Agent extend)
        ↓
public discovery
        ↓
Service Request + Quote (no payment)
        ↓
GBS case workflow + Vault + messages
        ↓
Business Client workspace (My Businesses)
        ↓
Admin capability/source/listing controls
        ↓
advanced ops (compliance calendar → mailroom → commerce → official-source verify)
```

---

## 57. Risk Register

**P0**

- Selling regulated titles (RA, ACSP, CSP, lawyer) from ordinary Agent verification.
- Passport/ID in public media or enumerable URLs.
- Employer/Student/Agent cookie confusion granting wrong APIs.
- Fake payment/registration success.

**P1**

- Jurisdiction facts from blogs; stale fees; “best state.”
- Case `REGISTERED` without provenance.
- IDOR across clients/providers.
- Shell/theme/responsive regressions on dense GBS tables.

**P2**

- Dual verification flags (profileStatus vs OrganizationVerification) leaking into GBS badges.
- AgentLead uniqueness blocking org buyers.
- Source catalog maintenance burden.
- Support load from mail/misdelivery if mailroom ships early.

**P3**

- SEO duplicate country pages.
- i18n long names.
- Counter polling.
- Over-building Wave 3 countries at launch.

---

## 58. Decisions Required From USER

**Count: 18.** Do not implement until USER approves.

| # | Decision | A | B | C | Recommendation | Tradeoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Public vertical name | Business Services | Business Formation | Global Business Services | **Business Services** (formation is a category) | Broader vs clearer SEO |
| 2 | Buyer identity | New realm | User capability only | Org only | **D hybrid** (§4) | UX vs team features |
| 3 | Provider title | Business Formation Provider | Corporate Services Provider | Agent (unchanged) | **Business Formation Provider** as generic; Agent internally | Marketing vs honesty |
| 4 | Launch countries | PK+US+UK | US only | PK+US | **PK+US+UK** | Scope vs demand |
| 5 | Initial US states public | All 51 | DE+WY+2 | DE+WY only | **Reviewed subset**, catalog all | Coverage vs source QA |
| 6 | MVP categories | Formation+RA/RO flags | Formation only | Formation+tax+mail | **Formation + RA/RO as listing flags** (capability-gated) | Completeness vs risk |
| 7 | Quotes / money | Off-platform | Free accept | Strideto pay | **Accept quote, no Strideto payment** | Trust vs revenue |
| 8 | Mandatory listing prices | Required | Quote-only OK | Hybrid | **Quote-required allowed** | Conversion vs honesty |
| 9 | Mailroom MVP? | Yes | No | Beta | **No** | Differentiator vs ops |
| 10 | Compliance calendar MVP? | Yes | No | Provider tasks only | **No** (provider tasks inside case) | Value vs bad legal claims |
| 11 | Reviews require completed case? | Yes | After quote | Anyone | **Yes** (or defined eligible milestone) | Volume vs integrity |
| 12 | First listings Admin review? | Always | After Trust | Spot check | **Always at launch** | Speed vs fraud |
| 13 | Verification depth at launch | Org only | Org+capability | Full RA/ACSP | **Org + capability; RA/ACSP only with evidence** | Supply vs safety |
| 14 | Provider subscription | Free | Paid listing | Later | **Free/not_configured** until commerce | Growth vs quality |
| 15 | Future take-rate | % | Lead fee | Subscription | **Decide later**; do not invent % | — |
| 16 | Public last-reviewed dates | Yes | Admin only | No | **Yes** on legal facts | Trust vs stale embarrassment |
| 17 | Existing User sees Student or Business Client on `/` | Student until they open /business | Auto business_client after first request | Prompt | **Explicit preference** (17D-0 rule: no silent switch) | Surprise vs convenience |
| 18 | Employer org buying GBS | Via Employer portal module | Via User+membership | New login | **User+membership** | Extra login vs ACL purity |

---

## 59. Open Questions

1. Which exact Organization `organizationType` string for buyer orgs (`business_client` vs `corporate_customer`)?
2. Should independent formation consultants without an agency be allowed RA-adjacent listings at all?
3. BOI / beneficial-ownership US federal overlay: in-scope as a **disclaimer + provider optional service**, or omit until FinCEN rules are catalogued by counsel?
4. Pakistan providers serving US formation: cross-border AML/advertising constraints — **legal review**.
5. Whether `/business` collides with future public content; `/account/business` vs `/workspace/business`.
6. Worker/email for GBS notifications vs in-app-only at launch.
7. How many languages for jurisdiction legal copy (English-only MVP?).
8. Data residency for passports (Vault today vs future region pinning).

---

## 60. Final Recommendation

Build GBS as a **capability vertical on Agent (provider) and User (buyer)**, with Organization used for **legal identity and teams**, not as a fifth cookie and not as a misuse of Employer.

Ship a **source-backed marketplace + request/quote/case + Vault + Admin**, with brutal honesty about fees, provenance, and what Strideto is not.

Do not ship mailroom, payments, government filing APIs, tax engines, or protected titles without evidence.

**Implementation: NONE in this phase.**

After USER + ChatGPT review this audit, convert **accepted** decisions into implementation phases. Until then: **STOP.**

---

## Appendix A — Official source checklist (external research)

Use these as the starting catalog. Re-fetch and Admin-review before any public fee or rule.

| Jurisdiction | Official entry points |
| --- | --- |
| US federal EIN | IRS EIN online application (irs.gov businesses / EIN) |
| Delaware | https://corp.delaware.gov/howtoform/ |
| Wyoming | https://sos.wyo.gov/business/default.aspx ; https://wyobiz.wyo.gov/ ; fee PDF https://sos.wyo.gov/Business/docs/BusinessFees.pdf |
| UK | https://www.gov.uk/limited-company-formation/register-your-company ; ACSP https://www.gov.uk/guidance/being-an-authorised-corporate-service-provider |
| Canada | https://www.canada.ca/en/services/business/start/register-with-gov/register-corp/register-corp-fed-or-prov.html ; Corporations Canada FAQ |
| Australia | https://business.gov.au/registrations/register-a-company ; https://register.business.gov.au/ |
| Singapore | https://www.acra.gov.sg/register/corporate-service-provider/checking-if-you-must-register/ |
| Pakistan | https://www.secp.gov.pk/company-formation/registration-of-company/ ; https://leap.secp.gov.pk/ |
| UAE | https://u.ae/ information-and-services / business / mainland (confirm live path; one nested URL 404’d on 14 Aug 2026) |
| FL, TX, CA, NY | Official SOS/Sunbiz/BizFile/DOS homepages — **fee rows NOT VERIFIED in this audit** |

---

## Appendix B — Future GBS UI verification matrix (contract)

Every later visual GBS phase must pass:

**Appearances:** System, Light, Dark  
**Viewports:** 320, 375, 768, 1024, 1440, 200% zoom  

Checklist: alignment; long labels/org/jurisdiction names; dropdown containment; table strategy; modal containment; mobile nav; keyboard; focus-visible; one date/time icon; PhoneInput; CountrySelect; public Navbar dark; role sidebar current-state; loading/empty/error; **no shell blink**.

---

**END OF AUDIT**

Implementation: **NONE**  
Source changes besides this file: **NONE**  
Commit: **NONE**  
Push: **NO**  
Deployment: **NO**  
Phase 18: **NOT STARTED**  
Worker: **STOPPED** (not started)
