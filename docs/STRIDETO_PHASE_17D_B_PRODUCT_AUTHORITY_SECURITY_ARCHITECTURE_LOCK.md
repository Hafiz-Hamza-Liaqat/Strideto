# STRIDETO PHASE 17D-B
# PRODUCT, AUTHORITY, SECURITY & FUTURE-PROOF ARCHITECTURE LOCK

**Mode:** ARCHITECTURE / DECISION / SECURITY DOCUMENTATION ONLY  
**Amendment:** **17D-BR1** (USER + ChatGPT review) — documentation-only hardening of this file  
**Implementation:** NONE  
**Database migrations:** NONE  
**Routes / models / UI / tests:** NONE  
**Docker rebuild / worker start / Phase 17D-1 / Phase 18 / push / deploy / commit:** NONE  

This document freezes the accepted architecture from Phase 17D-A **before** any Global Business Services (GBS) implementation. It is the decision lock for product, authority, modular registries, and layered security.

**Authority of 17D-A:** `docs/STRIDETO_PHASE_17D_A_GLOBAL_BUSINESS_SERVICES_ARCHITECTURE_GAP_AUDIT.md` is accepted as written. This file does **not** modify that audit and does **not** silently reinterpret it. Where USER issued explicit corrections, those corrections are named in §1.1 (17D-B) and §1.2 (17D-BR1) and then locked. Everything else from 17D-A remains in force.

**17D-BR1:** USER + ChatGPT accepted 17D-B and required the amendments in §1.2. Those amendments are integrated into the sections below. Contradictory 17D-B language (blanket `student` backfill, capability-as-permanent-boolean, retention-implies-read, `not_configured` treated as shareable-safe, listing scope as UI-only) is **replaced**, not left standing.

**Standards used as design/verification references (not certifications):**

- NIST Cybersecurity Framework (CSF) 2.0
- NIST Zero Trust principles (SP 800-207 family)
- OWASP Application Security Verification Standard (ASVS) 5.0
- OWASP API Security Top 10
- OWASP Automated Threat Handbook

This document does **not** claim NIST, Zero Trust, ASVS, or OWASP certification. It is an architecture target.

Paid AI remains **OFF** (`docs/AI_BUDGET_POLICY.md`). AI must never grant, deny, or mutate authorization.

---

## 0. Baseline / Safety State

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `f3c33e11e6e8db8cc2e613e17726b259076220c4` |
| Phase 17D-0 | USER MANUALLY ACCEPTED (not reopened) |
| Phase 17D-A | ACCEPTED as written; this file does not edit it |
| Worker | STOPPED (not started by this phase) |
| Known tracked WIP (untouched) | `AdminDataTable.jsx`, `AdminTableFilters.jsx`, `FormField.jsx` |
| Older stash (untouched) | `wip: AdminTableFilters values wiring (pre-phase-10)` |
| Protected local-only (untouched) | `docker-compose.appenv-align.yml`, `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`, `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md` |
| This phase / amendment repository change | **This file only** (`docs/STRIDETO_PHASE_17D_B_PRODUCT_AUTHORITY_SECURITY_ARCHITECTURE_LOCK.md`). 17D-A is not edited. Untracked, unstaged, **not committed**. |

Turnstile remains **`not_configured`**. This documentation phase does **not** activate Cloudflare Turnstile, bot challenges, or any dormant CAPTCHA path.

---

## 1. Executive Decision Lock

Strideto will host Global Business Services as a **marketplace and case-operations platform**, not as a formation company, law firm, tax advisor, registered agent firm, ACSP, CSP, or government registrar (17D-A §1, accepted).

**Locked stack:**

| Layer | Lock |
| --- | --- |
| Public vertical name | **Business Services** |
| Provider principal | Existing **Agent / Agency** realm. No fifth cookie. No `llc-agent` / `registered-agent` / `formation-provider` authentication. |
| Buyer authentication | Existing **User** realm. No fifth cookie. No Employer-cookie GBS buyer APIs. |
| Buyer authorization | Server-authoritative **User capabilities** + optional **Organization membership** + **Organization capabilities**. Never `strideto-active-workspace`. |
| Provider authorization | Existing Agent realm + verified **provider capability records**. Organization Verified does not grant protected titles. |
| Organization | Descriptive `organizationType` **plus** server-authoritative Organization capabilities. Type alone is not authorization. |
| Product MVP | Public discovery, verified provider capability, jurisdiction-bound listing, split fees, Service Request, Quote, Case, Messages, Vault, Document Checklist, My Businesses, Formation Tracker, thin Cost Estimator, neutral Comparison Tool, Admin moderation, case tasks/deadlines. **No fake payment.** |
| Launch jurisdictions | Pakistan, United States, United Kingdom. A jurisdiction is **not public** until its source catalog is reviewed. |
| Initial US publication candidates | Delaware, Wyoming, Florida, Texas — **candidates**, not automatically public. |
| Mailroom | POST-MVP |
| Automated legal compliance calendar | POST-MVP |
| Payments / payouts / escrow | DEFER |
| Government filing integrations | DEFER |
| AI personalized jurisdiction/tax advice | OUT OF LAUNCH SCOPE |
| Architecture style | Registries + adapters. Additive countries/services/capabilities. Versioned workflows/policies/sources. Historical records remain interpretable. |
| Security style | Defense in depth. Fail closed. Auditable capability **grants** (not irreversible booleans). Global security deny override. Capability + tenant + object authorization. Listing scope ⊆ verified capability. Adaptive but **governed** abuse control. No self-modifying production security. No AI authorization. Core authorization policy is source-controlled, not casual Admin config. |

Strideto must never claim it formed a company, guaranteed a bank / Stripe / Amazon / visa outcome, or that Organization Verified equals Registered Agent / Registered Office Provider / ACSP / CSP / Attorney / Tax Professional / Accountant verified.

### 1.1 Explicit corrections relative to 17D-A

These are **named USER locks**, not silent reinterpretations.

| # | 17D-A statement | 17D-B lock |
| --- | --- | --- |
| C1 | Buyer = User session + Business Client workspace/capability; Active Workspace is not security authority (17D-A §3.1, §4, §6). 17D-0 `canActAsStudent` is a client workspace gate. | **ACCEPT User-realm authentication.** Add a mandatory **server-authoritative User Capability** plane. `strideto-active-workspace` is **UX preference only** and **never** grants `student`, `business_client`, staff, or organization authority. Every protected API checks the required capability. Client-hidden buttons and workspace labels are not authorization. |
| C2 | Additive Organization type for buyer orgs (`business_client` / `corporate_customer` left as USER decision, 17D-A §4, §59 Q1). Type was the implied discriminator. | `organizationType` is **descriptive classification**. Authorization is **Organization capabilities**. An organization may hold `employer` **and** `business_client` without a duplicate fake company. Employer-cookie hiring remains Employer-domain authority. GBS buyer actions remain User + membership. |
| C3 | Generic public noun recommended as **Business Formation Provider** (17D-A §8, Decision 3). | Generic broad role: **Business Services Provider**. Formation capability / public specialization: **Business Formation Provider**. Protected titles remain separately evidence-gated. |
| C4 | Launch US states: reviewed subset, e.g. DE+WY plus 2–3 after source review (17D-A §14, Decision 5). | Initial US **publication candidates** locked: **Delaware, Wyoming, Florida, Texas**. Still not public until source catalog review. Florida and Texas were **not fully fee-audited** in 17D-A and remain unpublished until reviewed. |
| C5 | Jurisdiction / Authority / Source modeled as a hierarchy (17D-A §10–11). Page-local conditionals were not forbidden in code-shape terms. | Future GBS code is organized around **registries and adapters**. New countries, services, capabilities, case stages, and policies must be **additive**. Do not design future code that requires editing many existing pages when a country, service, stage, or capability is added. |
| C6 | Fraud/abuse threat model (17D-A §38) and data classes (17D-A §39) without a layered defense grid. | **Strideto Defense Grid** (11 layers), Zero Trust decision shape, adaptive abuse-control loop, resource budgets, Vault zone, envelope-encryption target, deception-as-detection (post-MVP), audit integrity, backup/recovery, and incident lifecycle are now mandatory architecture. |

17D-A recommendations that remain **accepted without change** include: no fifth auth realm; provider stays Agent/Agency; hybrid person + optional org buyer (Option D); Employer cookie never authorizes GBS; Vault reuse; Commerce `not_configured`; new `business_services` case family; split fees; provenance; PK+US+UK launch wave; mailroom/payments/filing/AI deferred or out of scope; Appendix B UI/theme/responsive contract.

### 1.2 Phase 17D-BR1 amendments (named USER + ChatGPT locks)

These amend 17D-B. They do not reopen 17D-A product scope.

| # | Prior 17D-B language | 17D-BR1 lock |
| --- | --- | --- |
| C7 | Existing User accounts receive `student` (do not receive `business_client`). | **Do not** auto-grant `student` to every User-realm account. Classify from **server-authoritative legacy roles/account state**. Genuine Student/User customers → `student`. Staff/admin-only → **no** automatic `student`. Dual-use → explicit grants from legacy evidence. Never infer from workspace, localStorage, last page, nav, or UI label. |
| C8 | Capability grant/revoke described as bits; revoke still allowed historical reads per retention. | Capabilities are **auditable grants** with `active \| suspended \| revoked` and grant/suspend/revoke metadata. Not irreversible booleans. |
| C9 | Suspended account fails before capability checks; revoke still “readable per retention.” | Distinguish **product capability deactivation** from **global/security suspension**. Security/fraud/compromise/legal-hold/global platform suspension can deny READ, WRITE, DOWNLOAD, TRANSITION, GRANT, and ADMINISTRATIVE ACTION. Retention ≠ continued principal access. |
| C10 | ProviderCapability implied org-attached. | Exact `subjectType` (`agent` \| `organization`) + `subjectId`. Agent capability ≠ Agency capability ≠ every member’s personal credential. |
| C11 | Listing bound to capability × jurisdiction × entityType. | **HARD invariant:** listing scope ⊆ **active verified** ProviderCapability scope. Server-enforced. UI dropdowns are not security. |
| C12 | Policy Registry included authorization with operational policies. | **SECURITY AUTHORIZATION POLICY** is source-controlled, versioned, reviewed, tested, change-controlled. Admin UI must **not** casually invent cross-resource privileges. Operational config (rates, SLAs, flags, freshness intervals) is separate. |
| C13 | Version fields on documents; no `recordVersion` concurrency. | High-value mutable records require optimistic concurrency (`recordVersion` or equivalent). Stale write → **409 CONFLICT**. No silent overwrite. |
| C14 | Quote accept and some transitions called idempotent in passing. | Important create/transition commands are **replay-safe** (idempotency-key / command-id). No duplicate cases, requests, transitions, timeline events, notifications, or financial effects. |
| C15 | Quote as a record; fee snapshots at quote time. | Quotes are **revisioned commercial records**. Material change of a sent Quote supersedes revision N and issues N+1. Do not silently mutate a sent Quote. Accepted Quotes are immutable except explicit privileged correction with reason, actor, timestamp, audit. |
| C16 | Vault reuse; passports highly sensitive. | **Just-in-time** collection. No passports/national IDs/sensitive proof-of-address at discovery, browse, compare, save, ordinary Service Request, or ordinary Quote review. Upload only after Case + documented requirement + purpose + authorized recipient + retention class. |
| C17 | Scan honesty; existing access policy may allow `not_configured` download; Q12 deferred whether GBS refuses until `clean`. | If GBS **shares** HIGHLY_SENSITIVE_IDENTITY with a provider, a **real malware scan path is a launch gate**. Flow: UPLOAD → QUARANTINE → SCAN → CLEAN → eligible for provider grant/download. `NOT_CONFIGURED` ≠ `CLEAN`. Provider sharing/download of HIGHLY_SENSITIVE_IDENTITY is **DISABLED / FEATURE-NOT-READY** until a real scanner exists. Owner-own access while quarantined remains a later policy detail. |
| C18 | Envelope encryption with unique DEK, AES-GCM, unique nonce. | Authenticated encryption **with AAD** binding tenantId, objectId, objectVersion, classification, environment, schemaVersion. AAD is not key material. Standard APIs only. |
| C19 | Phase 12 dependency audit noted as INFO; CI mentioned. | Explicit **software supply-chain** architecture (lockfiles, vuln/secret/SBOM/image scan, pinning, least-privilege CI, artifact provenance). No tools installed in this phase. |
| C20 | Caddy + api-a/api-b; local Docker host ports. | **Production** target: Internet → edge/LB/Caddy → API → **private** service network. Mongo, Redis, worker, scanner, backup are not Internet-exposed. Dev host-port exposure does not define production. |
| C21 | No fetch of arbitrary user URLs on accepted paths. | Controlled **server egress**: deny-by-default / allowlisted destinations; no `fetch(req.body.url)`. Adapter-scoped, audited. |
| C22 | Public if `reviewStatus = reviewed` + lastReviewedAt. | Freshness: `lastReviewedAt`, `reviewDueAt`, freshness class, `reviewStatus`, `superseded`, `sourceVersion`. Public current projection requires reviewed AND not superseded AND `now <= reviewDueAt`; else **STALE** (warn / hide / unpublish — never silent current). |
| C23 | `effectiveFrom`/`effectiveTo` mentioned on fees in 17D-A; 17D-B versioning did not fully lock historical rewrite. | Official-source-derived records support `effectiveFrom` / `effectiveTo`. Historical records keep the versions they were created under. Silent rewrite of source/workflow/policy/fee/quote truth is forbidden. |

---

## 2. Business Client Capability Correction

### 2.1 What is accepted from 17D-A

- Business Client reuses the existing **User authentication realm**.
- No fifth refresh cookie.
- No fifth auth realm.
- No Employer cookie as GBS buyer authority.
- No universal token.
- Active Workspace later gains a `business_client` **preference value** so a founder is not labelled Student on `/` (17D-A §2, GBS-01). That remains a **future UX extension**, not 17D-0 reopen.

### 2.2 What 17D-A did not fully lock (the correction)

17D-A correctly said preference is not authority. It did **not** freeze a server-side User Capability object distinct from:

- the User refresh cookie (authentication)
- `strideto-active-workspace` (UX)
- 17D-0 `canActAsStudent` (client workspace gate)

If later implementers treat Active Workspace as the thing that “turns on” Student Apply or GBS writes, Strideto would be authorizing from `localStorage`. That is forbidden.

### 2.3 Locked planes

```
AUTHENTICATION          User realm cookie + in-memory access token
                        cookie: __Secure-strideto_user_rt
                        path:   /api/auth/refresh-token
                        /me:    GET /api/auth/me

USER CAPABILITIES       server-authoritative AUDITABLE GRANTS (fail-closed)
                        student
                        business_client
                        future additive capabilities
                        status: active | suspended | revoked
                        never inferred from workspace / localStorage

UI WORKSPACE            preference only
                        student
                        business_client
                        (employer | agent | institution remain other-realm UX)

TENANT / MEMBERSHIP     optional Organization membership
                        does not replace User capability
```

`strideto-active-workspace` **NEVER** grants:

- `student` authority
- `business_client` authority
- staff authority
- organization authority

### 2.4 Invariants

1. A **business-client-only** User MUST NOT be able to use Student-authority writes (apply, student tracker mutations, student-only Vault owner actions that are student-product scoped, student notification writes, and any later Student-only mutation). Authentication as User is necessary and **not sufficient**.
2. A **student-only** User MUST NOT be able to use Business Client-authority writes (Service Request, Quote accept, ClientBusiness mutations, GBS case client transitions, GBS Vault grants to GBS cases, and any later GBS buyer mutation).
3. A User who **legitimately holds both** capabilities may explicitly switch the UI workspace. Every protected API still checks the **required capability**, not the preference.
4. Staff remains User-realm staff RBAC. Staff is not a public workspace. No public Admin switcher. No impersonation (17D-A §6). A **staff/admin-only** User-realm account does **not** automatically hold `student` (see §2.6 / §3.6).
5. Frontend-hidden buttons, route components, and `canActAsStudent`-style UI gates are **never** authorization.
6. Do not solve this with: a fifth auth cookie, a fifth auth realm, localStorage authorization, a client-only route guard, one universal token, or treating `activeWorkspace` as authority.
7. Required capabilities must be **active grants**. Suspended or revoked grants do not authorize. A global/security suspension can deny even historical reads (§2.7).

### 2.5 Relationship to 17D-0 `canActAsStudent`

17D-0 client code uses `canActAsStudent` so Employer/Agent/Institution public chrome does not fire Student Apply. That is a **UI workspace gate** on a **different authentication realm**.

GBS is **the same User authentication realm** as Student. Therefore the 17D-0 pattern is **not** a sufficient GBS authorization model:

| Check | 17D-0 (cross-realm UI) | GBS (same-realm) |
| --- | --- | --- |
| Cookie | Distinct Employer/Agent/Institution vs User | Same User cookie for Student and Business Client |
| Client gate | Hide Student writes when workspace ≠ student | May hide the wrong chrome; must not authorize |
| Server | Employer APIs require Employer principal | Student APIs require User + `student`. GBS buyer APIs require User + `business_client` (+ membership/tenant where applicable) |

Future Student write APIs must check an **active** User capability grant `student`. Future GBS buyer write APIs must check an **active** User capability grant `business_client`. Workspace preference may additionally be used for chrome only.

### 2.6 Capability grants (auditable objects, not irreversible booleans)

User and Organization capabilities are **auditable grants**, additive and versioned. Exact persistence is an implementation-phase decision. Conceptually each grant supports:

| Field | Purpose |
| --- | --- |
| `capability` | Registry id (`student`, `business_client`, `employer`, `business_services_provider`, future) |
| `status` | `active` \| `suspended` \| `revoked` |
| `scope` | Where applicable (tenant, jurisdiction, product). Empty/global only when the registry allows it. |
| `grantedAt` / `grantedBy` / `grantReason` | Who granted, when, why |
| `policyVersion` | Authorization policy under which it was granted |
| `suspendedAt` / `suspendedBy` / `suspensionReason` | Product or security pause without destroying history |
| `revokedAt` / `revokedBy` / `revocationReason` | Terminal deactivation of that grant |

The architecture must remain able to answer: who granted this capability; under what policy; when; for what scope; is it active; was it suspended; was it revoked; why.

**Authorization uses `status = active` only.** Suspended and revoked grants do not authorize. Grant history is retained for audit; history is not a live permission.

#### 2.6.1 Distinguish product deactivation from global/security deny

| Class | Examples | Effect on the principal |
| --- | --- | --- |
| **Normal capability deactivation / product access change** | Customer closes Business Client; Admin revokes a mistaken `business_client` grant; provider capability suspended pending evidence | That capability’s **new writes** fail closed. **Historical retention** may still allow **read of records the principal already owned**, subject to tenant ACL and policy — **unless** a global/security suspension also applies. |
| **High-severity / global security override** | Security suspension; fraud suspension; account compromise; legal/security hold; global platform suspension | Must be capable of denying **READ, WRITE, DOWNLOAD, TRANSITION, GRANT, and ADMINISTRATIVE ACTION** regardless of ordinary historical-retention/read policy. |

**Retention determines whether Strideto keeps the data. Retention does NOT automatically mean a suspended principal may still read it.**

Staff RBAC is orthogonal: a global security suspension of a staff User also denies Admin actions. Capability bits / grants cannot bypass the global deny.

#### 2.6.2 Future migration of existing User-realm accounts (no migration in this phase)

The User realm contains genuine customers **and** staff/admin-only accounts. **Existing User-realm accounts MUST NOT all automatically receive `student`.**

Future backfill must classify using **server-authoritative legacy roles / account state** (server User role, staff flags, Admin records — not UI):

| Authoritative legacy evidence | Grant |
| --- | --- |
| Genuine existing Student / User **customer** | Active `student` grant. Do **not** silently grant `business_client`. |
| Staff-only / admin-only User-realm account | **NO** automatic `student` capability. Staff RBAC remains staff RBAC. |
| Account legitimately used for both customer and staff | Explicit grants from that evidence (e.g. `student` **and** staff RBAC). Do not invent `business_client`. |
| No authoritative evidence of customer use | Fail closed: no `student` grant. |

**NEVER** infer migration capability from: `strideto-active-workspace`; localStorage; last-opened page; frontend navigation; UI role label.

| Later event | Effect |
| --- | --- |
| Explicit Business Client activation (future product flow) | Additive **active** grant of `business_client`. Does not remove `student` unless USER later decides a split-account product (not locked; default is additive). |
| Dual-capable User | Holds both **active** grants. UI switch is explicit (17D-A Decision 17: no silent switch). APIs still capability-check. |
| Product revoke of `business_client` | Status `revoked`. GBS buyer writes fail closed. Historical reads only if no global/security deny and policy allows. |
| Product revoke of `student` | Status `revoked`. Student writes fail closed. Same read rule. |
| Global/security suspension | Deny READ/WRITE/DOWNLOAD/TRANSITION/GRANT/ADMIN for that principal regardless of remaining active grants. |
| Staff role | Orthogonal to `student` / `business_client`. Not a public capability. Not auto-`student`. |

Users cannot self-grant `business_client` in a way that bypasses the future activation policy. Exact activation UX is a **deferred product decision**; the security invariant does not wait on that UX.

### 2.7 Fail-closed decision order

Canonical evaluation for protected APIs (User-realm GBS, Student, and equivalently other realms with their principals):

```
1. Authentication (valid realm session / access token)
      else 401
2. Account / global security state
      (usable vs security/fraud/compromise/legal-hold/global suspension)
      else 403 security_denied   — deny READ/WRITE/DOWNLOAD/TRANSITION/GRANT/ADMIN
3. Required capability grant status == active
      (User and/or Organization and/or ProviderCapability as applicable)
      else 403 capability_denied
4. Membership / tenant
      else 403 tenant_denied
5. Object authorization (ACL, grant, case participation, listing-subset)
      else 403
6. Workflow / policy version allows the action
      else 409 / 403 policy_denied
7. Abuse / resource-budget decision
      else 429 / 403 / challenge
8. Optimistic concurrency (expectedVersion == currentVersion) when mutating
      else 409 CONFLICT
9. Perform action (idempotent command where required) + audit
```

Missing capability, missing membership, missing object grant, stale `recordVersion`, or global security deny is **deny**, never “allow because the UI showed the button” and never “allow because retention still stores the row.”

---

## 3. Organization Capability Architecture

### 3.1 Problem being corrected

17D-A correctly forbade overloading `employer` as the GBS buyer and recommended an additive buyer organization type. Using `organizationType` **alone** as authorization would:

- force a hiring company that also buys formation services to clone itself into a second fake company, **or**
- grant GBS buyer APIs to every `employer` org, **or**
- grant provider GBS APIs to every `agency` because the type string says “agency.”

All three are rejected.

### 3.2 Locked model

```
Organization
  descriptive classification   organizationType
  server-authoritative caps    organization capability GRANTS (auditable; not booleans)
  lifecycle                    draft | active | suspended | archived
  global security state        independent of type and of ordinary capability grants
  verification                 OrganizationVerification (CLAIMED ≠ EVIDENCE ≠ VERIFIED)
  memberships                  User (buyer path) / existing Agent-Institution membership patterns
```

**Descriptive `organizationType` (existing, keep; additive later):**

`employer | agent | agency | university | college | institute | school | training_center`

A future additive type such as `business_client` (17D-A open question) **may** be introduced as classification for orgs that are not hiring employers. That string still **does not authorize**. Exact type string remains a deferred naming decision; authorization does not depend on it.

**Organization capabilities (authorization plane, additive grants — same grant object shape as §2.6):**

| Capability | Meaning | Does **not** mean |
| --- | --- | --- |
| `employer` | This organization may participate in hiring-domain Organization features that are Organization-native. Employer-cookie job admin remains Employer-domain. | GBS buyer authority. Student Apply. Protected titles. |
| `business_client` | This organization may be the **tenant** of GBS buyer records (ClientBusiness, ServiceRequest, Case) when a capable User is a member. | Employer hiring APIs. Provider listing APIs. |
| `business_services_provider` | This organization may offer GBS **after** provider capability verification. Typically Agent/Agency. | Registered Agent, ACSP, CSP, lawyer, or any protected title. |
| future additive | New org capabilities are registry entries. | Silent reuse of an old type. |

An organization may legitimately hold:

```
employer + business_client
```

on **one** Organization record. That is the approved way for an existing hiring company to buy GBS without creating a duplicate fake company.

### 3.3 Cookie vs capability (do not collapse)

| Action | Authenticating principal | Additional authorization |
| --- | --- | --- |
| Post a job / manage hiring pipeline | **Employer cookie** (`employer` realm) | Existing Employer membership / Employer capabilities |
| Buy GBS / create Service Request / accept Quote / client-side case actions | **User cookie** + User capability `business_client` | If org-scoped: membership on that Organization **and** Organization capability `business_client` |
| Provide GBS / create listing / send Quote / provider case transitions | **Agent cookie** | Membership + **active verified** ProviderCapability for the **exact subject** (`agent` or `organization`) + listing scope ⊆ that capability. Organization capability `business_services_provider` is necessary and **not** sufficient for protected titles. |
| Staff moderation | User-realm **staff** | Staff RBAC |

Employer-cookie hiring authority remains **Employer-domain authority**. GBS buyer actions are exercised only through the approved **User + membership** architecture from 17D-A Option D, now with Organization capabilities as the org-side gate.

### 3.4 What Organization Verified still is not

Organization Verified (`approved` + existing business/domain/location badges) is **not**:

- User capability `business_client`
- Organization capability `business_client` or `business_services_provider` as a public title
- Registered Agent / Registered Office Provider / ACSP / CSP / Attorney / Tax Professional / Accountant
- permission to file with a government
- permission to see another tenant’s Vault

Capability verification layers from 17D-A §9 remain in force and hang off capability records, not a boolean.

### 3.5 Membership rules (locked)

- Individual founder: User + `business_client` User capability. Organization is **optional**. ClientBusiness may be owned by the person (17D-A §4).
- Company client: User members of an Organization that holds `business_client`. Do not copy Institution `memberships[0]` (first membership only) or Employer one-active-membership as the GBS multi-business trap (17D-A §3.7).
- Provider staff: Agent membership + provider capability, not “any agency user.”
- A User without `business_client` cannot gain it merely by being invited to an employer org. Invitation to a GBS buyer tenant must be an explicit GBS membership grant.
- A User with `business_client` still cannot act on Organization A’s records by presenting Organization B’s membership.

### 3.6 Migration / backward compatibility

**No migration runs in this phase.** The following is the required future migration contract.

Capability backfill creates **auditable grants** (§2.6), not silent booleans. Classification uses **server-authoritative** legacy fields only.

| Existing record | Backward-compatible mapping | Must not happen |
| --- | --- | --- |
| `organizationType = employer` | Active Organization grant `employer`. Do **not** grant `business_client`. | Auto-enable GBS buyer APIs for all employers. Infer from workspace. |
| `organizationType = agent` or `agency` | Remain Agent/Agency providers of existing education/mobility services. Do **not** auto-grant `business_services_provider`. | Treat every Agency as a formation provider or Registered Agent. Copy an Agent’s personal capability onto the Agency. |
| Institution types | Unchanged. No GBS capabilities. | Overload university orgs as formation buyers/providers. |
| Existing User-realm **customer** (authoritative Student/User customer role/state) | Active User grant `student`. Do **not** grant `business_client`. | Silent GBS authority. |
| Existing User-realm **staff/admin-only** | **No** automatic `student` grant. Staff RBAC unchanged. | Blanket `student` for every User-realm row. Infer from last Admin page or UI label. |
| Dual customer+staff User (authoritative evidence) | Explicit grants matching that evidence (`student` and/or staff RBAC). No invented `business_client`. | Collapse to one boolean. |
| Existing Employer accounts / cookies | Unchanged. Hiring APIs stay on Employer realm. | Authorize GBS from Employer cookie because “they have a company.” |
| Existing Agent cookies | Unchanged. GBS provider modules later attach as **subject-scoped** ProviderCapability grants. | New provider cookie. Auto-promote Agent capability to Agency. |
| Historical cases, applications, Vault grants | Remain interpretable under their original tenant, realm, `schemaVersion` / `workflowVersion` / `sourceVersion`. | Rewrite old Student cases as GBS cases. Silent fee/workflow reinterpretation. |
| `strideto-active-workspace` values `student \| employer \| agent \| institution` | Remain valid UX. `business_client` is an **additive** future preference enum value. Unknown values already fail closed to guest (17D-0). | Treat preference as capability. Use it as migration evidence. |

If a future implementation adds `organizationType = business_client` (or similar), it must:

1. be additive in `ORGANIZATION_TYPES` (never rename existing strings);
2. backfill an **active Organization capability grant** `business_client` for those rows (grant metadata recorded);
3. still check the **active grant** on every API, so a type-only row without the grant cannot act.

Unknown future organization types or capabilities must fail closed, not coerce to `employer` or `agency`.

Organization global security suspension uses §2.6.1 / §2.7: it can deny members’ GBS actions on that tenant even if individual User grants remain `active`.

---

## 4. Provider Terminology

### 4.1 Locked nouns

| Noun | Scope | When it may appear publicly |
| --- | --- | --- |
| **Business Services Provider** | Generic broad marketplace role | After identity/org verification **and** at least one approved Business Services capability. This is the default public role noun. |
| **Business Formation Provider** | Formation capability / public specialization | After formation capability is capability-verified. A subset of Business Services Provider, not a replacement generic. |
| Corporate Services Provider | Broader catalog (address, secretarial, filings) | Capability set verified; Wave 2+ unless a launch listing actually includes those capabilities. |
| Formation Consultant | Advice / document prep without statutory agent status | Capability `consultation` / `document_prep` only. Must not display protected titles. |

Internal principal remains **Agent** (individual) or **Agency** (organization). Terminology above is **public/Trust language**, not a new auth realm (17D-A §5, accepted).

### 4.2 Protected titles (evidence-gated; never inferred)

Protected titles remain separately evidence-gated:

- Registered Agent
- Registered Office Provider
- ACSP
- CSP
- Attorney
- Tax Professional
- Accountant
- other jurisdiction-regulated titles (Company Secretary, trademark/IP professional, etc.)

**Organization Verified MUST NOT grant any protected title.**

Generic Agent verification MUST NOT grant ACSP, CSP, Registered Agent, or lawyer status (17D-A §12.2, §12.5, §9).

Public UI must show **badge names**, not color-only (17D-A §9).

### 4.3 Three-way split (locked)

```
generic marketplace role
    ≠
jurisdiction / service capability
    ≠
regulated / protected title
```

A study-abroad Agent may later add formation capability only after capability verification. They do not automatically become a Registered Agent (17D-A §5).

Independent consultants may be `agent` with a subset of capabilities and **must not** display protected titles (17D-A §5). Whether they may offer RA-adjacent listings at all remains 17D-A open question 2 (deferred; default fail-closed: no RA listing without jurisdiction capability verification **on that Agent subject**).

### 4.4 ProviderCapability subject model

ProviderCapability (and jurisdiction / protected-title verification) must name an **exact subject**. Conceptually:

```
subjectType:  agent | organization
subjectId:    opaque id of that Agent principal or Organization
```

This prevents independent professionals from being forced to create fake Agency organizations.

| Example | subjectType | Notes |
| --- | --- | --- |
| Independent formation consultant | `agent` | Capability and any later RA/title evidence belong to **that Agent**. |
| ABC Formation Services Ltd | `organization` | Capability belongs to the Agency organization, not automatically to each employee as a personal credential. |

**Invariants:**

- An **Agent** capability MUST NOT automatically become an **Agency** capability.
- An **Agency** capability MUST NOT automatically become every member’s personal professional credential.
- Jurisdiction and protected-title verification belong to the **exact verified subject**.
- Provider staff act through membership + the **organization** (or assigned) capability; they do not inherit a colleague’s personal `agent` subject capabilities.
- Listings and Quotes are issued **by the same subject** that holds the verified capability (see §5.9).

---

## 5. GBS Product Lock

### 5.1 Public vertical

**Business Services.** Formation is a category inside the vertical, not the only product (17D-A Decision 1, accepted).

### 5.2 Launch jurisdictions

| Wave | Lock |
| --- | --- |
| Launch | **Pakistan**, **United States**, **United Kingdom** |
| Wave 2 | Singapore, UAE (only if Emirate/Free Zone model is ready), Canada federal + 1–2 provinces — unchanged from 17D-A, not launch |
| Wave 3 | Remaining Canadian provinces/territories, Australia, additional US states, other GCC — not launch |

Do **not** promise global coverage.

**A jurisdiction is NOT public until its source catalog is reviewed and currently fresh** (§7.6): `reviewStatus = reviewed`, not `superseded`, `now <= reviewDueAt`, with `sourceUrl`, `retrievedAt`, `lastReviewedAt`, `sourceVersion`. Inventory architecture may exist in draft; publication is gated. Stale facts must not be presented as current.

### 5.3 Initial US publication candidates

Delaware, Wyoming, Florida, Texas.

These are **candidates**. 17D-A already fee-sourced Wyoming’s official SOS PDF as an architecture example and noted Florida and Texas as **not fully fee-audited**. None of the four is public until Admin-reviewed official sources exist.

All 51 US states + DC remain in the **inventory schema** (17D-A §13.1). Non-candidate states stay `draft` / unpublished.

### 5.4 MVP (in)

- Public discovery (`/business-services` IA from 17D-A §15 is illustrative; exact paths remain an IA decision, but private `/business/*` is noindex)
- Verified provider capability on an exact Agent or Organization subject (RA/ACSP only with evidence)
- Jurisdiction-bound listing whose **advertised scope ⊆ active verified ProviderCapability scope** (server-enforced; §5.9)
- Split fees (never merge provider + government + third-party + Strideto into one “price”)
- Service Request (minimal data; **not** a passport harvest — §5.11)
- Quote as a **revisioned** commercial record (`quote_required` / `payment_not_configured` preferred; §5.10)
- Case (new family `business_services`; do not reuse study/work stages)
- Messages (existing case/consultation threads)
- Vault (reuse; never public media for passports; **just-in-time** after a documented case requirement)
- Document Checklist (source-tagged rows; sensitive types only when required)
- My Businesses (`ClientBusiness`)
- Formation Tracker (provider-reported timeline with provenance)
- Thin Cost Estimator
- Neutral Comparison Tool (no “best state/country”, no personalized tax/legal advice)
- Admin moderation (first listings Admin-reviewed at launch — 17D-A Decision 12)
- Case tasks / deadlines (inside the case; not an automated legal-obligation engine)

**NO fake payment.** Accept quote creates a case. UI tells the truth: payment is not processed on Strideto while Commerce is `not_configured` (17D-A §21, §36). Accept is idempotent (§7.5). The accepted Quote revision is immutable commercial history (§5.10).

### 5.5 Explicitly not MVP / not launch

| Item | Class |
| --- | --- |
| Mailroom / parcel / scan / forward | **POST-MVP** |
| Automated legal compliance calendar | **POST-MVP** (provider tasks inside a case may exist in MVP; sourced obligation engine does not) |
| Payments / payouts / escrow | **DEFER** until commerce certification |
| Government filing integrations | **DEFER** |
| AI personalized jurisdiction / tax advice | **OUT OF LAUNCH SCOPE** (also AI budget OFF) |
| Official-source verified registration as a default badge | **DEFER** (17D-A GBS-22) |
| Nominee director marketplace | **DEFER / likely never** |
| Corporation / public company, LLP, branch, nonprofit as default SKUs | PHASE 2 / HIGH-RISK per 17D-A §7 |
| Tax calculation engine | **Never as conceived** (GBS-20) |

### 5.6 Service taxonomy freeze (from 17D-A §7, not reopened)

MVP formation structures per launch jurisdiction only (LLC / limited company / Pvt Ltd / SMC as applicable). Registered agent / registered office appear as **capability + listing flags**, not title dumps. EIN **assistance** is an optional add-on with no guarantee; Strideto is not the IRS.

### 5.7 Platform role (legal boundary)

Marketplace of independent providers. No government affiliation. No automatic legal/tax advice. No guaranteed registration, bank, processor, marketplace, or visa. Times vary. Rules change. Fees separated. Last-reviewed dates on legal facts. Customer accuracy duty (17D-A §37). Terms/Privacy/Guidelines edits are **not this phase**.

### 5.8 Feature flags

Incomplete major GBS modules stay behind feature flags, default **OFF**. No incomplete public route publication. A flagged-off module must fail closed on the API, not only hide a nav link.

If HIGHLY_SENSITIVE_IDENTITY sharing with providers is not scan-ready, that **sharing path** stays feature-flagged **OFF** / FEATURE-NOT-READY (§16). The rest of GBS may still launch without pretending files are `CLEAN`.

### 5.9 Listing scope ⊆ verified capability (hard authorization invariant)

A ServiceListing may advertise **only** scope contained within an **ACTIVE, VERIFIED** ProviderCapability of the **same subject**.

```
requested listing scope  ⊆  active verified ProviderCapability scope
```

Scope dimensions may include:

- service category
- country
- jurisdiction
- entity type
- regulated / protected title
- Registered Agent capability
- Registered Office capability
- other regulated capability

**Example:** Verified `US → Wyoming → Formation` MUST NOT publish `Delaware → Registered Agent` via request-body manipulation.

The **server** validates the subset relationship on create, update, and publish. Frontend dropdown restrictions are **not** security.

Listing subject must equal ProviderCapability `subjectType` + `subjectId`. An Agency listing cannot ride an independent Agent’s personal capability, and vice versa.

### 5.10 Quote revision / immutability

Quotes are revisioned commercial records. Conceptually retain:

`quoteNumber`, `revision`, `status`, `currency`, `lineItems`, `providerFee`, `governmentFee`, `thirdPartyFee`, `optionalFee`, `issuedAt`, `expiresAt`, `sourceSnapshots`, `termsSnapshot`, `recordVersion`.

| Event | Rule |
| --- | --- |
| Draft edit | May mutate the draft revision. |
| Sent / issued | That revision is frozen. |
| Material change after send | Revision N → `superseded`. Revision N+1 newly issued. **Do not silently mutate** the sent Quote. |
| Client accept | Accepts a **specific revision**. Idempotent. Creates the Case from that snapshot. |
| Accepted Quote | Effectively **immutable** as commercial history, except an explicit privileged correction workflow with `reason`, actor, timestamp, and audit. |
| Case explanation | The Case continues to cite the accepted Quote revision + fee/source snapshots. Later catalog or quote edits do not rewrite that history. |

Split fee lines remain mandatory on every revision. No fake payment side effect.

### 5.11 Just-in-time sensitive data collection

Strideto must **minimize possession** of sensitive identity documents.

**Do NOT** collect passports, national IDs, or sensitive proof-of-address during:

- public discovery
- provider browsing
- comparison
- save provider
- ordinary basic Service Request
- ordinary Quote review

Preferred flow:

```
DISCOVERY          → minimal data
SERVICE REQUEST    → business / service requirements
QUOTE              → commercial scope
CASE CREATED       → specific documented requirement exists
VAULT              → client uploads only what is necessary for that requirement
```

Sensitive collection must have: **purpose**, **case**, **requirement**, **authorized recipient**, **retention class**.

Do not collect sensitive documents “just in case.” Checklist rows that are `provider` or `case_specific` still must not demand HIGHLY_SENSITIVE_IDENTITY before the Case exists unless a later explicit policy says otherwise (default: **after Case + requirement**).

---

## 6. Future-Proof Registry Architecture

Do not encode countries, services, capabilities, stages, or titles as page-local `if (country === 'US')` trees that must be edited in many files when a country is added.

Target shape:

```
Registry (data + policy)
    → Adapter (jurisdiction / service / storage / notification / scan)
        → Application service (authorize → mutate → audit)
            → HTTP / UI (render from registry, do not own the rules)
```

Existing Strideto registries that prove the pattern (keep using the idea, do not overload their payloads for GBS): `shared/pageRegistry.js`, block/placement registries, scoring provider registry, dashboard widget registries.

### 6.1 Required conceptual registries

| Registry | Owns | Additive rule | Must not |
| --- | --- | --- | --- |
| **Capability Registry** | User capabilities (`student`, `business_client`, future) as **grant types** | New capability = new entry + grant policy + API checks | Infer from workspace; irreversible booleans; blanket User-realm `student` |
| **Organization Capability Registry** | `employer`, `business_client`, `business_services_provider`, future as **grant types** | New org capability = new entry | Infer from `organizationType` alone |
| **Service Taxonomy Registry** | Categories, SKUs, included/excluded service flags | New service = catalog row | Hardcode formation-only nav that cannot list a new category |
| **Jurisdiction Registry** | Country → level → jurisdiction codes/names/parents | New country/state = row + `reviewStatus` + freshness | Publish without review; `USA → LLC` SKU; silent stale-as-current |
| **Authority Registry** | Registrar, tax, licensing authorities per jurisdiction | New authority = row | Collapse IRS into Delaware; collapse FBR into SECP |
| **Official Source Registry** | `sourceUrl`, type, retrieved/reviewed/`reviewDueAt`, freshness class, reviewStatus, superseded, `sourceVersion`, `effectiveFrom`/`effectiveTo` | New source = row + Admin review | Blog/competitor as legal fact |
| **Entity Type Registry** | LLC, LTD, Pvt Ltd, SMC, … **scoped to jurisdiction** | New type = jurisdiction-scoped row | Global entity enum reused blindly |
| **Fee Registry** | Government / provider / third-party / future Strideto fee lines with currency, `effectiveFrom`/`effectiveTo`, source | New fee = versioned row | Merge lines into one public price; rewrite historical quotes |
| **Workflow Registry** | Case families, stages, allowed transitions per `workflowVersion` | New family/stage = versioned definition | Reuse study-abroad stages; silently reinterpret old cases |
| **Policy Registry** | Split: **security authorization policy** (source-controlled) vs **operational configuration** (governed knobs) | New policy version = new id | Unversioned in-code edits; Admin UI inventing cross-tenant privileges |
| **Permission Registry** | `principal × realm × active-capability-grant × action × resource class` | New action = registry row consumed by authorizer | Copy-paste ACL ifs; casual Admin privilege editor |
| **Trust Capability Registry** | Identity, org, representative, service, jurisdiction, credential, RA, RO, regulatory badges | New trust layer = entry | One “Verified” boolean; Agent cap copied to Agency |
| **Notification Event Registry** | Event names, recipient types, templates, feature-flag; idempotent emission | New event = entry | Ad-hoc string events; duplicate notifications on replay |
| **Feature Registry** | Module flags, default OFF for incomplete GBS, environment truth | New module = flag | Public route without flag + API fail-closed; sharing HSI without scanner |

### 6.2 Adapter types (conceptual)

| Adapter | Responsibility |
| --- | --- |
| Jurisdiction publication adapter | Reads Jurisdiction + Source + Fee registries; refuses **current** public projection unless reviewed, not superseded, and `now <= reviewDueAt` |
| Listing projection adapter | Binds listing to capability × jurisdiction × entityType; **rejects** unless listing scope ⊆ active verified ProviderCapability of the same subject; splits fee lines |
| Workflow adapter | Loads `workflowVersion` for a case; allows only that version’s transitions; optimistic concurrency on the case |
| Vault storage adapter | Private object storage; never public media |
| Scan adapter | Real malware provider **or** honest `not_configured`. `not_configured` **never** unlocks provider HSI download |
| Notification adapter | In-app always; email only if existing delivery policy allows — worker not started by this phase; idempotent per command-id |
| Abuse-decision adapter | Consumes signals + **versioned operational** policy; returns allow / challenge / throttle / temp-block / deny. Cannot rewrite security authorization policy |
| Encryption adapter | Envelope encryption + AAD when configured; fail closed for HIGHLY_SENSITIVE_IDENTITY if required and not configured |
| Egress adapter | Allowlisted destinations only (§17.3); no user-supplied URL fetch |

Adapters are **replaceable implementations** of a stable interface. They are not a license to add live vendors in this phase.

### 6.3 UI binding rule

Pages consume registry projections (lists of jurisdictions, fee lines, stages, badge names). Adding Wyoming as a reviewed jurisdiction must not require editing Country landing, Compare, Estimator, Listing form, and Admin fee page as four independent hardcoded lists.

### 6.4 Security authorization policy vs operational configuration

**Do not** design an Admin UI that can casually invent arbitrary cross-resource privileges.

| Plane | Examples | How it changes |
| --- | --- | --- |
| **SECURITY AUTHORIZATION POLICY** | `student` may create Student applications; `business_client` may create Service Requests; provider may create Quotes only for assigned/authorized clients; listing scope ⊆ verified capability; Admin reviewer may verify ProviderCapability; Employer cookie cannot GBS-write; preference is not ACL; global security deny override | **Source-controlled**, version-controlled (`policyVersion`), reviewed, tested, subject to engineering/security change control. Ships in the repository. |
| **OPERATIONAL CONFIGURATION** | Rate limits, review SLA, source freshness interval, feature flags, challenge thresholds, daily listing limits | May later be Admin-governed **within** bounds defined by security policy. Still versioned and audited. Cannot grant a new resource class, tenant, or protected title. |

Adding a country, service, capability, workflow version, source, fee, policy, or security signal remains **additive** whenever reasonably possible. One addition must not require editing dozens of unrelated pages or rewriting historical records.

---

## 7. Versioning / Backward Compatibility

### 7.1 Required version fields

| Field | Applies to | Rule |
| --- | --- | --- |
| `schemaVersion` | Persisted GBS documents (ClientBusiness, ServiceRequest, Quote, Case, Listing, Source, Fee, Capability grant, Grant) | Integer or dated id. Readers must understand old versions. Writers stamp the current write version. |
| `workflowVersion` | Case family state machine | A case keeps the version it was created with unless an explicit, audited migration is applied. |
| `policyVersion` | Authorization (source-controlled) and operational policy used for a decision | Decision logs store the policy version used. |
| `sourceVersion` | Official source / fee / rule rows | Public **current** pages require freshness (§7.6); superseded sources are not silently swapped under old cases. |
| `recordVersion` | High-value mutable records (§7.4) | Optimistic concurrency token. Not a substitute for `schemaVersion`. |

### 7.2 Historical interpretability

- Do **not** silently reinterpret old cases with a new workflow.
- A `REGISTERED_PROVIDER_REPORTED` case from workflow v1 remains that state even if v2 renames or splits the state.
- Fee quotes store a **snapshot** of fee lines + `sourceVersion` at **that Quote revision**. Later catalog edits do not rewrite accepted quotes.
- Capability grant revoke/suspend affects **future** authorization; grant history remains; global security deny can still block reads (§2.6.1).
- Unknown `schemaVersion` → fail closed (do not coerce).
- No update to source, workflow, policy, fee, or quote may silently rewrite historical truth (§7.7).

### 7.3 Backward-compatibility implementation contract

- Database migrations are additive where possible (new fields optional / defaulted; new collections; no rename-in-place of `ORGANIZATION_TYPES` strings).
- User capability backfill follows §2.6.2 / §3.6 — **not** blanket `student`.
- Old workflow versions remain supported until an explicit deprecation phase.
- Feature flags for incomplete modules.
- No incomplete public route publication.
- Security tests accompany authority changes (including listing-subset and staff-without-`student`).
- Theme tests accompany visual changes.
- Responsive acceptance accompanies visual changes.
- Source-provenance **and freshness** tests accompany jurisdiction changes.

### 7.4 Optimistic concurrency / recordVersion

High-value mutable records require optimistic-concurrency semantics. Conceptual field: `recordVersion` (or equivalent trusted persistence version).

Updates require `expectedVersion == currentVersion`. If stale: **409 CONFLICT**. Do not silently overwrite newer truth. Audit successful mutations.

Apply at least to:

- ServiceRequest
- Quote
- GBS Case
- Case state transitions
- ProviderCapability review
- ServiceListing moderation
- Jurisdiction source review
- GovernmentFee review
- Vault grant changes
- ClientBusiness provenance-sensitive updates
- future high-value workflow records

### 7.5 Idempotent command semantics

Important create/transition commands must be replay-safe. Support an idempotency-key / command-id / equivalent. Exact transport is deferred.

Examples: Create Service Request; Accept Quote; Create Case; Case transition; document completion/finalization; capability verification decision; listing publish/moderation; future payment commands; future forwarding commands.

Repeated delivery of the **same logical command** MUST NOT accidentally create duplicate cases, requests, transitions, timeline events, notifications, or financial effects.

### 7.6 Source freshness policy

`lastReviewedAt` alone is not sufficient long-term. Official-source facts must conceptually support:

`lastReviewedAt`, `reviewDueAt`, `freshnessPolicy` or `freshnessClass`, `reviewStatus`, `superseded`, `sourceVersion`.

Different fact categories may have different review intervals. Examples:

| Fact category | Freshness stance |
| --- | --- |
| Government fee | Shorter interval |
| Authority information | Medium interval |
| Entity-definition rule | Longer / effective-date-driven |

**Current** public projection requires:

```
reviewStatus == reviewed
AND not superseded
AND now <= reviewDueAt
```

Otherwise the fact is **STALE**. Policy may warn, hide the stale fact, or unpublish the jurisdiction/listing dependency — but must **never silently present stale legal/fee data as current**.

### 7.7 Effective-date / historical truth

Official-source-derived records must support `effectiveFrom` / `effectiveTo` where applicable, at least for:

- GovernmentFee
- JurisdictionRule
- provider/regulatory requirement
- entity rule
- compliance obligation
- source-backed requirements

Historical records retain the source/policy/workflow/fee/`quote` **versions under which they were created**.

Silent rewrite is forbidden. Historical rewriting requires: explicit versioned migration, reason, actor, scope, audit, and backward-compatibility review.

---

## 8. Strideto Defense Grid

Defense in depth. Compromise of one layer must not equal compromise of Vault, Admin, or tenant data. This is an architecture target, not a certification claim.

For every layer: purpose, assets, threats, existing Strideto controls, missing controls, implementation dependency, fail-closed behavior, observability, future extensibility.

### Layer 1 — Edge / DDoS / Bot

| | |
| --- | --- |
| **Purpose** | Absorb volumetric abuse, filter obvious automated traffic, protect origin capacity. |
| **Assets** | Origin API/UI availability; registration; login; search; public GBS catalog. |
| **Threats** | DDoS; botnet scraping; credential stuffing at volume; inventory enumeration; fake-account bursts. |
| **Existing** | Caddy TLS reverse proxy in recommended/local deploy; Helmet/security headers on API (Phase 12); SPA has no full CSP yet (truthful gap). No claimed production CDN/WAF/bot-management certification in this lock. |
| **Missing** | Production CDN/WAF/bot-management as a named, tested control; edge signal export into the abuse loop; GBS-specific bot rules. **Turnstile widget is not live**; enabling it is a future governed change, not this phase. |
| **Dependency** | Deployment architecture (CDN/WAF vendor not chosen here unless already required). |
| **Fail-closed** | If edge is absent, origin rate limits still apply; origin must not assume edge cleaned the request. Do not CAPTCHA every normal request by default. |
| **Observability** | Edge block/challenge counts; origin 429; no PII in edge logs. |
| **Extensibility** | New GBS paths added to WAF/bot rules via Feature/Permission registries, not one-off exceptions. |

### Layer 2 — Request validation

| | |
| --- | --- |
| **Purpose** | Bound and type-check every request before business logic. |
| **Assets** | Process memory; Mongo; parsers; file pipeline. |
| **Threats** | Oversized JSON; Mongo operators; mass assignment; XSS; path traversal; malformed Origin; array bombs. |
| **Existing** | `express-mongo-sanitize`; JSON/urlencoded **1mb**; origin allowlist + `secureTrustedOrigin` on credentialed writes; Helmet; DOMPurify on `dangerouslySetInnerHTML`; URL scheme allowlists; Vault filename + magic-byte MIME; public list `MAX_LIMIT` (jobs 50; commerce pages capped). |
| **Missing** | GBS-specific schema validators (ServiceRequest, Quote revision, Case transition, **listing-subset vs verified capability**); per-endpoint array/object caps for GBS; SPA CSP nonce/hash pipeline (known Phase 12 gap); deny-by-default egress allowlists (§17.3). |
| **Dependency** | Shared validators generated from registries where possible. |
| **Fail-closed** | Invalid body → 400. Oversized → 413. Untrusted Origin on credentialed write → 403. Unknown fields on high-authority objects ignored / rejected, never assigned. Listing scope not ⊆ verified capability → 403. `fetch(userUrl)` forbidden. |
| **Observability** | 400/413/403 counts by route; no raw body of Vault uploads in logs. |
| **Extensibility** | New resources register a schema; they do not copy ad-hoc `req.body` spreads. |

### Layer 3 — Authentication

| | |
| --- | --- |
| **Purpose** | Establish realm-isolated principal. |
| **Assets** | Sessions; refresh cookies; access tokens; account recovery. |
| **Threats** | Cookie theft; refresh replay; CSRF; realm confusion; token in storage; credential stuffing. |
| **Existing** | Four isolated HttpOnly refresh cookies; 15-minute in-memory access JWT; 7-day refresh; `JWT_SECRET` ≠ `REFRESH_SECRET`; Redis denylist required in production; no `localStorage` tokens; refresh rotation; logout/logout-all; hashed email verify + password reset; generic recovery copy; auth rate limits (Phase 12 / 17C-R). |
| **Missing** | User Capability plane (this lock). Risk-based challenge on login **when Turnstile is actually configured** (not now). Verify-email limiter exists in source (`verifyEmailLimiter`); confirm every verify route is wired before GBS launch. |
| **Dependency** | Existing AuthCookiePolicy. GBS must not add a fifth cookie. |
| **Fail-closed** | Missing/invalid token → 401. Wrong realm → 401/403. Ambiguous NODE_ENV/APP_ENV already throws at cookie policy resolve. Equal JWT/REFRESH secrets fatal in production validation. |
| **Observability** | Login success/failure; refresh failure; verify failure; password-reset abuse. Never log passwords, raw JWT, refresh, or verify tokens. |
| **Extensibility** | New realm is a last-resort legal/security decision (17D-A rejected Option A unless proven necessary). New **capabilities** are the additive path. |

### Layer 4 — Capability authorization

| | |
| --- | --- |
| **Purpose** | Bind actions to **active** server-authoritative User / Organization / provider **grants**. |
| **Assets** | Student writes; GBS buyer writes; GBS provider writes; protected titles. |
| **Threats** | Workspace preference used as ACL; type-string authorization; self-serve RA/ACSP; dual-capable user confusion; blanket `student` on staff; listing over-scope; Admin UI inventing privileges. |
| **Existing** | Realm isolation; Employer team capabilities (`shared/employer/team.js`) as a **pattern** (server-derived; client hide ≠ auth); Agent membership; staff RBAC; OrganizationVerification state machine. **No** User `business_client` capability exists today. |
| **Missing** | Capability grant objects; classification-safe User backfill; Organization grants; ProviderCapability `subjectType`; listing-subset authorizer; tests: student-only cannot GBS-write; business-client-only cannot student-write; staff-only has no automatic `student`; Wyoming formation cannot publish Delaware RA. |
| **Dependency** | Additive grant records; authorizer used by every GBS and (progressively) Student mutation. Security authorization policy remains source-controlled (§6.4). |
| **Fail-closed** | Missing or non-active grant → 403 `capability_denied`. Unknown capability id → deny. Global security state deny → 403 `security_denied` **before** grant checks. |
| **Observability** | Capability grant/suspend/revoke; capability denial; security deny override. |
| **Extensibility** | New capability = registry + grants + tests. No page-local special cases. |

### Layer 5 — Tenant / object authorization

| | |
| --- | --- |
| **Purpose** | Principal with the right capability still cannot read another tenant’s objects. |
| **Assets** | ClientBusiness; ServiceRequest; Quote; Case; Vault; Mailbox (future); listings in draft. |
| **Threats** | IDOR; enumerable `/api/business/1`; agency-wide data bleed; grant over-scope; Agent cap used as Agency listing. |
| **Existing** | Vault owner + grants (`agent \| case \| system`); case thread participants; Agent “client relationship grants zero Vault access”; unauthenticated Vault/Admin → 401 without existence leak (Phase 12); Employer application authz suites. |
| **Missing** | GBS resource ACL matrix implemented; opaque IDs for highly sensitive objects; case-grant expiry defaults for GBS; cross-tenant list tests; listing-subset tests; ProviderCapability subject isolation tests. |
| **Dependency** | Permission Registry + object membership tables. |
| **Fail-closed** | Wrong tenant → 404 or 403 **without** confirming sibling existence on public enumerations. Hidden UI is not ACL. Global security deny blocks object read even if ACL would have allowed. |
| **Observability** | Tenant denial; Vault access/download; grant/revoke. |
| **Extensibility** | New resources declare tenant key (`userId`, `buyerOrganizationId`, `providerOrganizationId`, `caseId`) and subject. |

### Layer 6 — Business-flow abuse control

| | |
| --- | --- |
| **Purpose** | Authenticated, authorized actors still cannot spam listings, requests, messages, quotes, downloads, or fake reviews. |
| **Assets** | Marketplace integrity; provider time; Vault bandwidth; Admin queues. |
| **Threats** | Listing spam; Service Request spam; quote spam; message spam; document-download bursts; fake reviews; enumeration of providers/clients. |
| **Existing** | IP/auth/upload/search/admin limiters (Redis-backed); form spam service; marketplace moderation; ProfessionalReview abuse report; guarantee-forbidden phrases (education/mobility — GBS lexicon not yet extended). |
| **Missing** | Per-flow GBS budgets (see §11); account/org/session velocity; listing/request/quote/message-specific counters; GBS forbidden-claim lexicon (17D-A GBS-08); case-tied review eligibility. |
| **Dependency** | Abuse-decision adapter + versioned Policy Registry. |
| **Fail-closed** | Over budget → 429 or deny. Unconfigured Commerce cannot be “paid.” Unverified protected title cannot be published. Listing over-scope cannot be published. Replay of the same command-id does not duplicate side effects. |
| **Observability** | Flow-specific 429; spam queues; moderation decisions. |
| **Extensibility** | New flow registers its budget and signals. **No single global threshold.** |

### Layer 7 — Application / service isolation

| | |
| --- | --- |
| **Purpose** | Limit blast radius across API replicas, worker, frontend, Admin, future GBS modules, and **private data services**. |
| **Assets** | Runtime processes; queues; Admin; Mongo; Redis; scanner; backups. |
| **Threats** | Worker processing untrusted files; SSRF; one module taking down auth; path-unscoped refactors; Internet-exposed databases; malicious dependency/build pipeline. |
| **Existing** | api-a/api-b; worker **stopped** and not started by this phase; `WORKER_ONLY` concern documented; no backend fetch of arbitrary user URLs in accepted apply/program/agent website path; path-scoped phases. Local Docker **host ports** exist for development and **do not define production**. |
| **Missing** | Dedicated file-scan isolation (quarantine worker); GBS module flags; production private network as a **tested** topology; deny-by-default egress allowlists; supply-chain controls (§17.1); explicit “uploaded documents never execute server-side” hardening tests for new parsers. |
| **Dependency** | Future scan provider in an isolated worker, not the request thread. Production topology (§17.2). |
| **Fail-closed** | Optional providers `not_configured` do not take core API unready (except Redis/Mongo when required). Worker absent → email queued/honest, not faked sent. Scanner absent → provider HSI sharing disabled, not `CLEAN`. |
| **Observability** | Health/ready; workerRunning; queue depth. |
| **Extensibility** | New GBS workers are additive consumers of versioned jobs on the private network. |

### Layer 8 — Data-access policy

| | |
| --- | --- |
| **Purpose** | Classify data and restrict collection, projection, search, and Admin access. |
| **Assets** | All data classes in §12. |
| **Threats** | Over-logging; public projection of director ID; Admin casual Vault browse; search indexing private docs; collecting passports at discovery; stale fees shown as current. |
| **Existing** | Public vs private route split; robots.txt private paths; Vault not public search; Admin audit; production 5xx sanitized; logger redaction of password/authorization/cookie/token/stripe/JWT-shaped strings. |
| **Missing** | Full data-class enforcement on GBS projections; Admin Vault access policy + audit for GBS; noindex `/business/` when built; MAILROOM_PRIVATE class operationalization (post-MVP); just-in-time collection gates; freshness projection. |
| **Dependency** | Data classification + Permission Registry. |
| **Fail-closed** | Default deny public projection. Admin access to HIGHLY_SENSITIVE_IDENTITY requires policy + audit, not a list endpoint. Global security deny blocks principal read. Stale catalog facts are not “current.” |
| **Observability** | Admin document access events. |
| **Extensibility** | New fields declare a data class; unknown class → treat as HIGHLY_SENSITIVE_IDENTITY or BUSINESS_CONFIDENTIAL, never PUBLIC. |

### Layer 9 — Encrypted storage / Vault

| | |
| --- | --- |
| **Purpose** | Protect document bytes and identifiers at rest and in transit. |
| **Assets** | Passports, national ID, proof of address, ownership evidence, certificates, tax/legal corporate evidence, private authority correspondence. |
| **Threats** | Public URL leak; sequential IDs; stolen disk; key in DB row; download without grant. |
| **Existing** | Private vault storage; signed/short-lived access; owner + grant ACL; soft-delete; SHA-256 checksum; 20 MB; allowed MIME + magic sniff; scanStatus including honest `not_configured`; TLS in recommended deploy. **Not** per-object envelope encryption today. Current Vault access policy may still permit owner download when `not_configured` — that **must not** be treated as permission to **share** HIGHLY_SENSITIVE_IDENTITY with providers. |
| **Missing** | Unique cryptographically random object identifiers for highly sensitive objects; per-object DEK + KMS wrap + **AAD**; quarantine; **real** malware provider as GBS HSI-sharing launch gate; download audit completeness for all grant paths. |
| **Dependency** | Vault Security Zone (§14) + Encryption architecture (§15). Do not invent custom crypto. |
| **Fail-closed** | No public URL. `rejected` cannot download. `not_configured` / `pending` / `failed` **cannot** be granted or downloaded by a **provider** for HIGHLY_SENSITIVE_IDENTITY. If encryption is required and KMS is missing → refuse HIGHLY_SENSITIVE_IDENTITY upload rather than store plaintext labeled “encrypted.” |
| **Observability** | Vault create/view/download/grant/revoke; scan status transitions. Never log document bytes. |
| **Extensibility** | New document types join Vault types + classification; they do not go to MediaAsset. Just-in-time collection remains the product rule. |

### Layer 10 — Security logging / detection

| | |
| --- | --- |
| **Purpose** | Record security-relevant events; detect abuse; support review. |
| **Assets** | Incident evidence; Trust decisions; Admin actions. |
| **Threats** | Log injection; missing denials; secret leakage into logs; undetected canary hits. |
| **Existing** | `auditService` / `AuditLog`; requestId; structured request logs; vault document audit actions; Admin audit; auth outcome logs without secrets (17C-R). Not a separate append-only security stream with hash checkpoints. |
| **Missing** | Mandatory GBS event set (§19); capability/tenant denial events; deception/canary telemetry; signed checkpoints; separate security-log destination. |
| **Dependency** | Event registry + redaction policy. |
| **Fail-closed** | If audit write fails, **do not** pretend the security event was recorded; high-assurance actions (capability grant, protected-title approval, Vault download, policy change) should fail or retry per future policy — exact fail-vs-best-effort split is a deferred implementation decision, defaulting to **fail the action** for Vault download and Admin capability/title decisions. |
| **Observability** | This layer *is* observability. High-cardinality PII labels forbidden. |
| **Extensibility** | New events via Notification/Security event registries. |

### Layer 11 — Backup / recovery

| | |
| --- | --- |
| **Purpose** | Restore operations after loss, ransomware, or bad deploy. |
| **Assets** | Mongo; Vault objects; config/secrets; versions. |
| **Threats** | Ransomware; destroyed volumes; untested backups; keys lost; `docker compose down -v` as “recovery.” |
| **Existing** | `scripts/backup/*`; `docs/BACKUP_GUIDE.md`; `docs/DISASTER_RECOVERY.md`; Phase 12 disposable mongodump/restore evidence (**not** protected volumes); Redis explicitly not SoR. |
| **Missing** | Off-account copy as proven production control; Vault object backup aligned to retention; key-recovery procedure; scheduled restore tests with evidence; ransomware runbook specificity; GBS retention classes. |
| **Dependency** | Operations, not GBS product code. A backup never restored in a controlled test is **not** launch evidence. |
| **Fail-closed** | Do not `down -v` as normal recovery. Do not restore Redis as if it were Mongo. |
| **Observability** | Backup job success/failure; restore-test date. |
| **Extensibility** | New data stores join the backup inventory before holding HIGHLY_SENSITIVE_IDENTITY. |

---

## 9. Zero-Trust Model

Architecture target aligned to NIST Zero Trust ideas: never trust network location, device, or UI state; authenticate and authorize every request; least privilege; assume breach.

### 9.1 Trust is not implied by

- Being on the User cookie
- `strideto-active-workspace`
- `organizationType`
- Organization Verified
- Agent `profileStatus`
- Hidden frontend routes
- Prior request success
- “They already opened the case page”
- An **active** capability grant while a **global/security suspension** is in force
- `not_configured` scan status
- Retention of a record
- A frontend listing dropdown

### 9.2 Canonical authorization decision shape

Every protected GBS (and, progressively, platform) decision records and evaluates:

| Field | Meaning |
| --- | --- |
| `principal` | Opaque subject id (User / Employer / Agent / Institution / staff) |
| `realm` | `user \| employer \| agent \| institution` |
| `globalSecurityState` | Usable vs security/fraud/compromise/legal-hold/global suspension |
| `capability` | Required **active** User and/or Organization and/or provider **grant** (with subject) |
| `organization membership` | Membership id + role, or none |
| `tenant` | `userId` and/or `organizationId` and/or `caseId` scope |
| `resource` | Resource class + opaque resource reference |
| `action` | `read \| write \| download \| transition \| grant \| revoke \| moderate \| admin` |
| `policyVersion` | Security authorization policy id used |
| `recordVersion` | When mutating |
| `result` | `allow \| deny \| challenge \| throttle \| temp_block` |

Frontend never supplies `capability` as a trusted input. Server loads **active grants** from the account/org/provider-subject records. Global security deny short-circuits to deny for READ/WRITE/DOWNLOAD/TRANSITION/GRANT/ADMIN.

### 9.3 Continuous evaluation

Authentication is per-request (access token). Global security state, authorization, and abuse decision are per-request. Session existence does not skip steps 2–8 in §2.7.

### 9.4 Least privilege

- Provider staff see only assigned cases / granted Vault objects.
- HIGHLY_SENSITIVE_IDENTITY provider access additionally requires `scanStatus = clean`.
- Buyer org members see only granted tenant objects.
- Admin support ≠ Admin capability reviewer ≠ Super Admin.
- No “view as provider.” No impersonation.
- Global/security suspension denies even these least-privilege reads.

---

## 10. Adaptive Abuse-Control Loop

Deterministic, governed, auditable. **Not** self-modifying autonomous production security. **Not** AI allow/deny.

```
REQUEST
  → EDGE SIGNALS
  → AUTH SIGNALS
  → AUTHORIZATION SIGNALS
  → BUSINESS-FLOW SIGNALS
  → RESOURCE BUDGET
  → ALLOW / CHALLENGE / THROTTLE / TEMP-BLOCK / DENY
  → LOG
  → DETECT
  → SECURITY REVIEW
  → POLICY UPDATE   (versioned, human-governed)
```

### 10.1 Signals to evaluate

| Signal | Intent |
| --- | --- |
| IP velocity | Volumetric / distributed abuse |
| Account velocity | Compromised or automated account |
| Organization velocity | Agency/buyer org spam |
| Session velocity | Stolen session spraying |
| Endpoint velocity | Focused scraping or brute force |
| Failed login | Stuffing / guessing |
| Failed authorization | Privilege probing |
| Enumeration attempts | Sequential ids, user/org existence |
| Registration bursts | Fake accounts |
| Password reset bursts | Recovery abuse |
| Listing spam | Marketplace pollution |
| Message spam | Harassment / phishing |
| Service-request spam | Provider load / fraud |
| Document-download bursts | Vault exfiltration |
| Upload volume | Malware / storage DoS |
| Request/payload size | Parser / memory abuse |
| Expensive operation counts | Search, export, compare, estimate |
| Replay patterns | Refresh, verify, quote accept, idempotency keys / command-id |
| Token failures | Stolen/malformed JWT/refresh |

### 10.2 Decisions

| Decision | Use |
| --- | --- |
| ALLOW | In budget, authenticated, authorized |
| CHALLENGE | Elevated risk; human challenge **when a challenge provider is actually configured**. Do not CAPTCHA every normal request. Do not silently activate Turnstile in this phase. |
| THROTTLE | Slow the flow (429 + Retry-After) |
| TEMP-BLOCK | Time-bounded block of IP/account/org/session for that flow |
| DENY | Hard fail (403/401/404 per anti-enumeration policy) |

Challenges are **risk-based**. Login, register, password reset, listing create, Service Request create, and Vault download are candidates. Public catalog GET is not a default challenge surface.

### 10.3 Governance of policy updates

- Detection may **recommend** a **operational** policy change (rate, challenge threshold, temp-block TTL).
- Only a human security owner (or a future change-control process) publishes a new operational `policyVersion`.
- **Security authorization policy** changes go through engineering/security change control in source (§6.4), not the abuse loop.
- Policy updates are audit-logged (`security-policy change`).
- No model auto-writes production allow/deny **authorization** rules.
- No AI authorization.

### 10.4 Anti-DoS of the defender

Do **not** implement infinite server loops, unbounded tarpits, or “trap the attacker” connection holds. Those consume Strideto resources and become a denial-of-service weakness. Bounded delay (small, capped) may exist at the edge; origin must remain cheap to reject.

---

## 11. Resource Budgets

Every expensive flow should eventually have a **bounded, flow-specific** budget. Do **not** use one global threshold for everything.

Numbers below labelled **EXISTING** are current source behavior. Numbers labelled **TARGET** are architecture starting points for later implementation phases; they are not live and may be tuned with evidence. They are not launch-certified SLAs.

### 11.1 Platform-wide (existing, keep)

| Control | EXISTING |
| --- | --- |
| JSON / urlencoded body | 1 MB |
| Public jobs list page size | max 50 |
| Auth failed login (prod) | 5 / minute / IP |
| Refresh failed (prod) | 30 / minute |
| Forgot password (prod) | 5 / hour |
| Verify-email limiter (prod) | 20 / 15 min (wire-confirm at implementation) |
| Resend verification (prod) | 5 / hour |
| Upload (prod) | 20 / minute |
| Contact | 5 / hour |
| Support | 10 / hour |
| Feedback | 8 / hour |
| Forms | 10 / hour |
| Search | 60 / minute |
| Admin GET | 300 / minute |
| Admin POST/PUT/PATCH | 60 / minute |
| Admin DELETE | 30 / minute |
| Vault file size | 20 MB, 1 file per request |
| Commerce list cap | min(requested, 100) in existing controller |

### 11.2 GBS TARGET budgets (not implemented)

| Flow | Suggested dimensions | TARGET starting bound (tune later) |
| --- | --- | --- |
| Request body length | Per GBS route class | Inherit 1 MB; listing/quote JSON smaller (e.g. 128–256 KB) |
| Query limits | Search/filter | Same spirit as public lists; no unbounded `find` |
| Pagination maximum | Directories, requests, cases, Admin queues | 20 default / 50 max (match Agent directory pattern) |
| Array/object counts | Directors, shareholders, checklist rows, fee lines | Hard caps per schema (e.g. 50–100 items) |
| Upload size | Vault GBS docs | Existing 20 MB unless a future type justifies less |
| Upload count | Per user / org / hour | Stricter than generic upload: e.g. 30 / hour / user |
| Concurrent requests | Per session | In-flight guard client-side already used elsewhere; server still budgets |
| Password attempts | User realm | Keep existing auth limiter |
| Verification resend | User realm | Keep existing resend limiter |
| Search volume | Public GBS catalog | Dedicated limiter; cheaper than write flows |
| Export volume | Client/provider CSV (if ever added) | Near-zero at MVP (no bulk export of identity docs) |
| Document downloads | Vault | Per-user and per-grant hourly caps; audit every download |
| Message creation | Case/consultation | Per-thread and per-user hourly caps |
| Provider listings | Create/update | Low daily cap + Admin review at launch |
| Service requests | Per user / org / day | Low; burst → throttle |
| Quote submissions | Per provider / day | Bounded; no quote-spam of a client |
| Case transitions | Per case / actor | Idempotent; no transition storms; audit every success |

Exact integers are **implementation-phase decisions** recorded as **operational** Policy Registry values. They cannot grant new authority. This lock only forbids unbounded GBS writes and a single global bucket.

### 11.3 Budget identity keys

Evaluate, in combination, not just IP:

`ip × account × organization × session × endpoint × flow`

A well-behaved user behind a shared NAT must not be globally locked because another tenant on the same IP spammed Service Requests — hence account/org keys. IP remains required for pre-auth flows.

---

## 12. Bot / Automation Defense

Plan (architecture), not activation:

| Control | Stance |
| --- | --- |
| CDN / edge DDoS | Target for production; vendor not chosen in this phase unless current deploy already requires one |
| WAF | Target; rules versioned |
| Bot management | Target; risk-based |
| Rate limiting | **Keep and extend** existing Redis limiters with flow-specific GBS buckets |
| Progressive throttling | TARGET: raise delay/429 before temp-block |
| Risk-based challenge | TARGET: only when challenge provider configured and risk high |
| Credential-stuffing controls | Keep auth limiter + generic errors + hashed tokens; add edge/bot later |
| Fake-account controls | Keep realm-scoped verification; add registration-burst signal; no silent Turnstile enablement |
| Scraping controls | Pagination, rate limits, robots, no private data in sitemaps |
| Enumeration controls | Opaque ids for sensitive objects; uniform errors; no existence leaks |
| Resource-consumption controls | Body/query/upload/search budgets |
| Sensitive-business-flow controls | Listing create, Service Request, Quote, Vault download, capability verification |

Human challenge should be risk-based where possible. **Do not CAPTCHA every normal request by default.**

Current Turnstile/readiness boundaries must **not** be silently activated by this documentation. Default remains `not_configured`. Enabling requires keys, live widget, hostname/action verify, B2B middleware, and a dedicated phase — already stated in 17C.

---

## 13. Data Classification

Locked classes (names aligned to 17D-A §39; treatment expanded).

Unknown / unlabelled fields default to **BUSINESS_CONFIDENTIAL** if business-shaped, **PERSONAL_DATA** if person-shaped, and **HIGHLY_SENSITIVE_IDENTITY** if identity-document-shaped. Never default to PUBLIC.

### PUBLIC

| | |
| --- | --- |
| **Examples** | Approved listing, country/jurisdiction page, last-reviewed date, public provider profile (approved), badge **names** |
| **Allowed storage** | CMS/catalog collections; CDN/cache of public projections |
| **Encryption** | TLS in transit; disk encryption of DB as platform default. No per-object DEK required. |
| **Public exposure** | Indexable when `reviewStatus`/moderation allow **and** the fact is not STALE (§7.6) |
| **Logging** | URLs/ids OK; no hidden draft fields |
| **Retention** | Catalog/ops retention; superseded sources kept for provenance |
| **Download/access** | Anonymous read of published projection only |
| **Backup** | Standard DB backup |

### ACCOUNT

| | |
| --- | --- |
| **Examples** | Email, login identifiers, session metadata, workspace preference (non-authoritative) |
| **Allowed storage** | User/Employer/Agent/Institution account stores; Redis denylist (token hashes, not raw tokens) |
| **Encryption** | TLS; password hashes (existing); no raw tokens at rest |
| **Public exposure** | None |
| **Logging** | Opaque account id; hashed/redacted email where required by existing non-enumeration policy |
| **Retention** | Account lifecycle + legal |
| **Download/access** | Owner + staff per RBAC **unless** global/security deny applies |
| **Backup** | DB backup; session Redis **not** SoR |

### BUSINESS_CONFIDENTIAL

| | |
| --- | --- |
| **Examples** | Cap table notes, internal provider notes, unpublished listings, quotes, ClientBusiness internals |
| **Allowed storage** | Tenant-scoped collections |
| **Encryption** | TLS; platform disk; object DEK **target** when stored as files |
| **Public exposure** | None |
| **Logging** | Opaque ids; no note bodies |
| **Retention** | Case/business retention class |
| **Download/access** | Members with permission **unless** global/security deny |
| **Backup** | DB + object backups per retention |

### PERSONAL_DATA

| | |
| --- | --- |
| **Examples** | Name, phone (E.164), founder residency, correspondence address (non-ID) |
| **Allowed storage** | Account/case fields minimized |
| **Encryption** | TLS; minimize copies |
| **Public exposure** | None on listings (never copy director identity onto public listings — 17D-A §24) |
| **Logging** | Minimize; no phone dumps |
| **Retention** | Privacy policy class (not rewritten here) |
| **Download/access** | Owner / case participants as permitted |
| **Backup** | DB backup |

### HIGHLY_SENSITIVE_IDENTITY

| | |
| --- | --- |
| **Examples** | Passport, national ID, proof of address used as KYC, sensitive ownership evidence scans |
| **Allowed storage** | **Vault only**, and only after a documented Case requirement (§5.11). Never MediaAsset / public Cloudinary folder / ordinary CMS media. Never harvested at discovery/quote. |
| **Encryption** | TLS; **target** unique object DEK + envelope encryption + AAD (§15). Opaque identifiers. |
| **Public exposure** | Never. No index. No public URL. |
| **Logging** | Opaque vault id + action; **never** image/content |
| **Retention** | Strict; soft-delete then purge per policy. Retention ≠ principal access. |
| **Download/access** | Owner per later quarantine policy; **provider grant/download only if scanStatus = `clean`**. Admin policy+audit. Global security deny blocks all. |
| **Backup** | Encrypted object backup; key-recovery procedure required |

### FINANCIAL

| | |
| --- | --- |
| **Examples** | Quotes, fee snapshots, later invoices/payments |
| **Allowed storage** | Commerce / quote collections. Live card data never stored (Stripe `not_configured` until certified). |
| **Encryption** | TLS; provider PCI boundary when commerce exists |
| **Public exposure** | None |
| **Logging** | Amounts may log as already-public quote fields; no PAN/secrets |
| **Retention** | Financial/legal |
| **Download/access** | Parties to the **accepted or in-flight Quote revision** / case **unless** global/security deny |
| **Backup** | DB backup |

### LEGAL_CORPORATE

| | |
| --- | --- |
| **Examples** | Certificates of formation, filings, tax/legal corporate evidence, authority correspondence files |
| **Allowed storage** | Vault + provenance fields on ClientBusiness (numbers/dates, not scans, may live on the tracker with provenance columns) |
| **Encryption** | Vault rules for files; tracker fields as BUSINESS_CONFIDENTIAL |
| **Public exposure** | Never unless the client later publishes a Company CMS page (not automatic — 17D-A §25) |
| **Logging** | Opaque ids; provenance labels OK |
| **Retention** | Corporate evidence retention |
| **Download/access** | Vault grants |
| **Backup** | Vault + DB |

### MAILROOM_PRIVATE

| | |
| --- | --- |
| **Examples** | Envelope contents, scans, forwarding addresses (post-MVP) |
| **Allowed storage** | Future mail subsystem; Vault-class or stricter |
| **Encryption** | Highest Vault class |
| **Public exposure** | Never |
| **Logging** | Metadata only |
| **Retention** | Mail policy (future) |
| **Download/access** | Mailbox client + location-scoped provider staff |
| **Backup** | Object backup; isolation required |

### ADMIN_SECURITY

| | |
| --- | --- |
| **Examples** | Audit logs, sessions, security policy versions, canary hits, staff actions |
| **Allowed storage** | Audit store; future dedicated security-log destination |
| **Encryption** | TLS; restricted access; target signed checkpoints |
| **Public exposure** | Never |
| **Logging** | Recursive logging of logs is minimized |
| **Retention** | Longer than ordinary app logs; restricted deletion |
| **Download/access** | Super Admin / security owner |
| **Backup** | Separate from routine app backups if possible |

---

## 14. Vault Security Zone

Vault remains the canonical location for:

- passport
- national ID
- proof of address
- sensitive ownership evidence
- formation certificate
- tax/legal corporate evidence
- private authority correspondence

**Never ordinary public media.**

### 14.1 Future requirements (lock)

| Requirement | Rule |
| --- | --- |
| Private storage | Existing Vault storage adapters only; strip public URLs (already the Vault storage service intent) |
| Opaque identifiers | Cryptographically random ids for highly sensitive objects; do not expose sequential enumerators |
| Short-lived access descriptors / signed access | Keep signed URL / descriptor pattern; short TTL |
| Owner / tenant authorization | `ownerUserId` remains; org-owned GBS docs still resolve to a User owner + case/org grants — do not invent world-readable org drives |
| Case grants | Reuse `DocumentAccessGrant`; GBS cases are a grant target. HIGHLY_SENSITIVE_IDENTITY grants to providers require `scanStatus = clean`. |
| Grant expiry | Required; default finite TTL for GBS identity docs |
| Grant revocation | Immediate fail-closed |
| Download audit | Mandatory event |
| No indexing | Vault objects excluded from public search/sitemaps/CMS |
| No public URL | Invariant |
| Safe filename handling | Keep `rejectDangerousFilename`; store safe display names |
| Retention / deletion | Soft-delete then purge; retention class per data class; retention ≠ read |
| Least privilege | Agent authentication alone still grants **zero** Vault access |
| Just-in-time | No HSI upload without case + requirement + purpose + recipient + retention class |

### 14.2 GBS grant rules

- Grants are exact (document version or document id + permission `view`/`download`).
- Provider staff: membership + capability + grant, not agency-wide.
- HIGHLY_SENSITIVE_IDENTITY: provider grant/download **only** when `scanStatus = clean`. `not_configured`, `pending`, `failed`, and `rejected` are not shareable to providers.
- Admin: support/safety policy + audit only.
- Team access only via membership **and** grant (17D-A §24).
- Global/security deny blocks grant use even if the grant row is still `active`.

---

## 15. Encryption / Key Architecture

Translate “millions of special numbers” into standard cryptography. **Do not invent custom cryptography. Do not implement crypto in this phase.**

### 15.1 Object identifiers

For HIGHLY_SENSITIVE_IDENTITY and other critical objects, target:

- unique **cryptographically random** object identifiers (CSPRNG / UUID v4 or stronger), not guessable sequences
- identifiers are **not** encryption keys
- identifiers may appear in audit logs; keys must not

Existing Mongo ObjectIds may remain for low-sensitivity catalogs. GBS Vault and grants should not rely on enumerable integer paths.

### 15.2 Envelope encryption (target)

Where future deployment/storage architecture supports application-level encryption:

```
Object bytes
  → unique per-object Data Encryption Key (DEK)
  → authenticated encryption (e.g. AES-256-GCM)
  → unique nonce/IV per encryption operation (never reuse nonce with same key)
  → Authenticated Additional Data (AAD) bound to context (not secret):
       tenantId, objectId, objectVersion, classification, environment, schemaVersion
  → DEK wrapped (encrypted) with a managed master / KMS key (KEK)
  → wrapped DEK + ciphertext + key version + algorithm id + AAD identifiers stored
```

AAD is **metadata integrity binding**. It helps detect ciphertext/metadata swapping between objects or tenants. It is **not** key material. Use standard cryptographic APIs only.

Master / KMS keys **must be separate** from ordinary application/database records. No master encryption keys in Mongo rows. No secrets in Git. No secrets in browser bundles.

If application-level encryption is **not** configured, do not label objects `encrypted`. Existing Vault private storage + TLS remains the honest current control (KEEP / EXTEND).

### 15.3 Key lifecycle

| Topic | Target |
| --- | --- |
| Key version | Stored beside ciphertext; decrypt uses the version’s KEK |
| Rotation | Re-wrap DEKs with new KEK; optional re-encrypt objects on schedule |
| Revocation | Compromised KEK version retired; decrypt of new wraps fails; incident process |
| Backup | Encrypted key material in secret manager / KMS, not in DB dumps as plaintext |
| Recovery | Documented key-recovery procedure; dual control for production KEK restore |
| Least-privilege access | API role can encrypt/decrypt via KMS API; cannot export KEK; Admin UI cannot display keys |
| Environment separation | Distinct KEK per dev / staging / production; no production KEK in local Docker |

### 15.4 What not to do

- Homegrown ciphers, “secret XOR,” or rolling unique integers as if they were keys
- One global AES key in `.env` reused as DEK for every passport
- Client-side encryption of Vault as the only control (client is not the trust boundary)
- Logging nonces+keys together with ciphertext in application logs
- Treating AAD fields as secret key material
- Encrypting without AAD where the algorithm supports it, then claiming object/tenant binding

---

## 16. Secure File Pipeline

Future pipeline (architecture):

```
UPLOAD
  → size limits
  → declared type validation
  → content-signature / magic validation
  → quarantine
  → malware scan
  → CLEAN only then eligible for provider grant
  → safe metadata
  → encrypted / private storage
  → Vault record
  → controlled case grant
```

| Stage | Existing | Target |
| --- | --- | --- |
| Size limits | 20 MB Vault | Keep; GBS may tighten per type |
| Declared type | MIME allowlist | Keep |
| Magic validation | `sniffMime` mismatch rejects | Keep |
| Quarantine | Missing | Isolated store until scan decision |
| Malware scan | `not_configured` unless `VAULT_SCANNER_PROVIDER`; `runSecurityScan` throws; **current** access policy may allow owner access when `not_configured` / `pending` / `failed` and blocks `rejected` | Honest `not_configured`. **`NOT_CONFIGURED` is never `CLEAN` / `SCANNED_SAFE`.** GBS **provider** sharing/download of HIGHLY_SENSITIVE_IDENTITY requires a **real** scanner and `scanStatus = clean`. If scanner unavailable, that sharing path is **DISABLED / FEATURE-NOT-READY**. Owner-own access while quarantined may be defined later. |
| Safe metadata | filename, mime, size, checksum | Strip active content; no server-side execute |
| Encrypted/private storage | Private + signed access | Envelope encryption + AAD when KMS exists |
| Vault record + grant | Exists | GBS case grants with expiry; provider HSI grant only after `clean` |

**GBS launch gate:** If GBS allows HIGHLY_SENSITIVE_IDENTITY documents (passport, national ID, proof of address, sensitive KYC scans) to be **shared or downloaded by a provider**, a real malware scanning path **must exist**:

`UPLOAD → QUARANTINE → SCAN → CLEAN → eligible for provider grant/download`

If the scanner is unavailable: `scanStatus = NOT_CONFIGURED`. Do not pretend the file is safe. The platform may preserve an honest disabled sharing state rather than launching an unsafe sharing path.

Uploaded documents must **never execute server-side** (no `eval` of uploads, no office-macro execution, no HTML/SVG-as-image in Vault allowlist — SVG/HTML/executables already rejected in Phase 12 upload policy).

---

## 17. Secrets Architecture

| Rule | Lock |
| --- | --- |
| No secrets in Git | Keep `.gitignore` / env examples as placeholders |
| No secrets in browser bundles | Client may receive Turnstile **site** key only if enabled; never `TURNSTILE_SECRET_KEY`, JWT, Mongo, KEK, Stripe secret |
| No master encryption keys in database rows | Envelope wrap via KMS/secret manager |
| Central secret management in deployment | Host/VPS/env or future secret manager. **Do not choose a vendor in this phase** unless current deployment architecture already requires one |
| Service-scoped credentials | API vs worker vs scan vs backup roles |
| Environment separation | Staging ≠ production |
| Rotation | JWT/REFRESH already distinct; KEK/Stripe/SMTP rotation runbook |
| Audit / revocation | Secret access and rotation are security events |

`validateProductionEnv` already fatals on missing/short/equal JWT/REFRESH and missing Mongo/SITE/Redis in production (Phase 12). Keep.

### 17.1 Software supply-chain security

A malicious dependency or build pipeline can bypass runtime security layers. Supply-chain security is **mandatory architecture**. Do not install tools in this documentation phase.

Future security requirements must consider:

- dependency lockfiles
- dependency vulnerability scanning
- secret scanning
- SBOM generation
- container image scanning
- base-image pinning / version policy
- digest pinning where appropriate
- dependency provenance
- reviewed dependency upgrades
- protected branches
- least-privilege CI/CD credentials
- environment-separated deployment credentials
- no production secrets in build logs
- build artifact integrity
- deployment artifact provenance
- future signed artifacts/images where justified

Phase 12 recorded `npm audit` advisories as INFO without lockfile churn; that honesty remains. GBS launch certification must not treat an unaudited supply chain as “runtime layers are enough.”

### 17.2 Production network segmentation

Development host-port exposure does **not** define production architecture. Exact hosting/vendor topology remains deferred. Locked **production target**:

```
INTERNET
  → EDGE / LOAD BALANCER / CADDY
  → API
  → PRIVATE SERVICE NETWORK
```

Private/internal services may include: MongoDB, Redis, Worker, scanner, backup service, internal storage integrations.

| Service | Production lock |
| --- | --- |
| MongoDB | Private; not directly Internet-exposed |
| Redis | Private; not directly Internet-exposed |
| Worker control | Private |
| Scanner interface | Authenticated and private |
| Internal management endpoints | Restricted (not public Internet) |
| API | Reached via edge; not a substitute for data-plane privacy |

### 17.3 Controlled server egress / SSRF boundary

Server outbound access must be controlled. Future adapters that access official government sources, scanner services, storage services, email, or future government APIs must own an **approved destination policy**.

**Do not design** `fetch(req.body.url)` or equivalent arbitrary user-controlled server fetching.

Where feasible:

- deny-by-default / allowlisted destinations
- scheme validation
- host validation
- redirect limits
- DNS / private-network protections
- timeouts
- response-size limits

External integrations remain **adapter-scoped and audited**. Phase 12’s “stored, not fetched” user URL rule remains; GBS must not reopen SSRF by “helpfully” fetching a founder-supplied registrar URL.

---

## 18. Tenant / Object Authorization

### 18.1 Protected GBS resources

Every later endpoint for these resources must fail closed:

- Business Client workspace
- ClientBusiness
- ServiceRequest
- Quote
- Case
- CaseTimeline
- CaseRequirement
- Vault Grant
- Document
- ProviderCapability
- Listing
- Jurisdiction source
- Admin review
- future Mailbox / MailItem

Frontend-hidden buttons are **NEVER** authorization. Global/security deny overrides the table below (all N for that principal). Required capabilities are **active grants**. Listing publish additionally requires listing scope ⊆ verified capability of the **same subject**. Provider Vault download of HIGHLY_SENSITIVE_IDENTITY additionally requires `scanStatus = clean`.

### 18.2 Permission matrix (architecture)

Legend: Y = allow if capability + tenant + object ACL pass **and** no global/security deny; N = deny; L = limited (own / granted / assigned); A = Admin policy + audit; — = N/A; C = `scanStatus = clean` required for HSI provider share

| Resource / action | Guest | User `student` only | User `business_client` owner | User `business_client` member | Agent provider owner | Agent provider member (cap) | Admin reviewer | Admin support | Super Admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| View public listing | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Create Service Request | N | N | Y | L | N | N | N | N | N |
| Read own ServiceRequest / Quote | N | N | Y | L | assigned org | L | Y | Y | Y |
| Create Quote | N | N | N | N | Y (assigned/authorized client) | L | N | N | N |
| Accept Quote (specific revision, idempotent) | N | N | Y | L | N | N | N | N | N |
| Mutate sent Quote in place | N | N | N | N | N (issue new revision) | N | N | N | N |
| Privileged Quote correction | N | N | N | N | N | N | A | N | Y |
| Read Case | N | N | L | L | L | L | Y | L | Y |
| Transition Case (client-legal) | N | N | L | L | per workflow | per workflow | A | N | Y |
| Mark provider-reported registered | N | N | N | N | Y | L | N | N | N |
| Official-source verified | N | N | N | N | N | N | Y | N | Y |
| Upload Vault doc | N | own student vault | own vault (JIT for HSI) | L | N | N | N | N | N |
| Download Vault (non-HSI) | N | own/grant | own/grant | grant | grant | grant | A | A | Y |
| Download Vault HSI as provider | N | N | N | N | C | C | A | A | Y |
| Grant / revoke | N | owner | owner | L | N | N | A | N | Y |
| ClientBusiness read/write | N | N | Y | L | N (except assigned case context) | L | Y | L | Y |
| ProviderCapability self-assert protected title | N | N | N | N | N | N | — | — | — |
| ProviderCapability verify RA/ACSP/etc. | N | N | N | N | evidence submit only (own subject) | evidence submit (org subject if member) | Y | N | Y |
| Listing publish | N | N | N | N | after Admin at launch **and** subset check | L | Y | N | Y |
| Jurisdiction source / fee modify | N | N | N | N | N | N | Y | N | Y |
| Invent cross-resource Admin privilege | N | N | N | N | N | N | N | N | N |
| Admin review (source-controlled authority) | N | N | N | N | N | N | Y | N | Y |
| Mailbox (future) | N | N | own mailbox | L | location staff | L | escalate | escalate | Y |
| Student Apply / student tracker write | N | Y | N (unless also active `student`) | N | N | N | N | N | N |

Staff/admin-only Users without an active `student` grant are **not** the `student` column. A dual-capable User is evaluated **per action**: Student Apply requires active `student`; GBS accept-quote requires active `business_client`. Workspace preference does not appear in this table.

---

## 19. Deception / Canary Architecture

USER proposed looping/trapping attackers.

**Rejected as primary protection:** infinite server loops, unlimited tarpit responses, retaliation, sinkholing attacker machines, or anything that consumes unbounded Strideto resources.

**OPTIONAL POST-MVP detection controls:**

| Control | Rule |
| --- | --- |
| Synthetic canary record | Fake ClientBusiness / listing / Admin id that no legitimate UI ever links |
| Decoy Vault identifier | Not a real document; access = high-severity telemetry |
| Decoy API credential / token | Synthetic only; never a production KEK/JWT |
| Decoy Admin-only resource identifier | Unreachable from staff UI |
| Honeytoken | Embedded in decoy metadata |

Requirements:

- Synthetic data only; isolated from production customer data
- No privileged write path
- Access should never occur through legitimate UI
- Access creates **high-severity** security telemetry
- Bounded response (cheap 401/404)
- Rate limiting
- No endless connection
- No retaliation against the attacker

**Deception is DETECTION, not primary protection.** Layers 1–9 remain the protection. Canary hits never auto-grant or auto-wipe production data.

---

## 20. Security Logging

### 20.1 Mandatory events

- login success / failure
- refresh failure
- verification failure
- password reset abuse
- authorization denial
- capability denial
- global / security deny override
- tenant denial
- Admin action
- capability grant / suspend / revoke
- capability verification decision
- protected-title approval / rejection
- Vault access
- Vault download
- document grant / revoke
- case transition
- listing moderation (including subset-denied publish)
- quote issue / supersede / accept / privileged correction
- source / fee modification
- provider suspension
- security-policy change
- 409 optimistic-concurrency conflict on high-value records
- deception / canary hit

### 20.2 Log fields (safe)

- actor class (user / employer / agent / institution / staff / system / anonymous)
- realm
- capability (required + **grant status** active/suspended/revoked/absent, not a dump of all bits)
- tenant (opaque org/user/case id)
- action
- resource class
- opaque resource reference
- result
- timestamp
- request / correlation ID
- command-id / idempotency key when present (not a secret)
- safe security metadata (policyVersion, workflowVersion, recordVersion, reason code)

### 20.3 NEVER log

- passwords
- raw JWT
- refresh token
- verification token
- API secret
- encryption key / DEK / KEK / nonce+key material
- passport image / content
- sensitive full document body
- raw cookies
- full national ID strings when an opaque id suffices

---

## 21. Audit Integrity

Future target (not a claim of perfect immutability):

| Control | Intent |
| --- | --- |
| Append-only security audit stream | Ordinary UPDATE/DELETE of security events forbidden in app roles |
| Periodic signed / hash-linked checkpoints | Tamper **evidence** (hash chain / signed batch) |
| Separate security-log retention destination | Outlive primary DB compromise as far as operations allow |
| Restricted deletion | Legal/ops exception only; dual control; itself audited |
| Retention policy | Longer than application logs; class ADMIN_SECURITY |

This provides tamper **evidence**, not a false claim of perfect immutability. Application `AuditLog` today is a Mongo collection (`auditService`); treat as **KEEP / EXTEND**, not as already-immutable WORM storage.

If audit insert fails on high-assurance actions (Vault download, protected-title decision, capability grant, policy change), default **fail the action** (§8 Layer 10).

---

## 22. Backup / Ransomware / Recovery

Security architecture includes recovery. Targets:

| Control | Target |
| --- | --- |
| Database backups | Existing mongodump scripts; daily RPO recommended in `DISASTER_RECOVERY.md` (24h DB) is **recommended**, not invented production SLA |
| Object / Vault backups | According to retention; include Vault private store, not only Mongo metadata |
| Backup account / identity separation | Backup credentials ≠ app credentials |
| Encryption | Backups encrypted at rest; keys not stored beside the backup plaintext |
| Versioning | Retain multiple restore points |
| Point-in-time | Where the hosted Mongo/object store supports it |
| Off-system / off-account copy | At least one copy the ransomware that hits production compute cannot encrypt |
| Retention | Documented; GBS identity class may differ from public CMS |
| Restore tests | Controlled, scheduled; **a backup that has never been restored in a controlled test is not sufficient launch evidence** |
| Recovery runbook | `docs/DISASTER_RECOVERY.md` — keep “never `down -v` as normal recovery” |
| Key-recovery procedure | KEK/KMS restore with dual control |
| Ransomware response | Isolate, preserve evidence, restore from offline copy, rotate keys/sessions, provider suspend if needed |

Redis: denylist + rate-limit + cache only. Loss ⇒ re-login possible + limiter reset. Do not treat Redis restore as data recovery (existing Phase 12 / DR doc).

---

## 23. Incident Response Lifecycle

Aligned to NIST CSF 2.0 functions. No implementation in this phase.

```
GOVERN → IDENTIFY → PROTECT → DETECT → RESPOND → RECOVER
```

### 23.1 Severity

| Level | Examples | Response intent |
| --- | --- | --- |
| **S0 Critical** | Vault mass download; KEK leak; auth bypass; ransomware | Immediate containment; key/session rotation; leadership + security owner |
| **S1 High** | Protected-title fraud at scale; canary hit with write attempt; Admin account takeover | Contain, revoke, notify as required |
| **S2 Medium** | Repeated capability probes; listing spam; single-account stuffing | Throttle/temp-block; review |
| **S3 Low** | Isolated 401 noise; scraper on public catalog | Monitor; budget tune |

### 23.2 Roles (logical)

| Role | Authority |
| --- | --- |
| Security owner | Policy versions; incident declaration; canary review |
| Containment authority | Session revocation; provider suspension; feature-flag kill; KEK rotation **with** dual control |
| Staff Admin | Existing RBAC; not a public workspace |
| Communications | Customer notification decision path (legal/privacy), not engineering chat improvisation |

Exact named humans/rotations stay in operational docs, not this architecture lock.

### 23.3 Paths (architecture)

| Path | Lock |
| --- | --- |
| Credential / key rotation | JWT/REFRESH, SMTP, Stripe (when exists), KEK, backup keys |
| Session revocation | Existing logout-all / denylist / tokenVersion patterns |
| Provider suspension | Organization/Agent lifecycle `suspended` + listing unpublish + audit |
| Incident evidence retention | Preserve logs/backups; do not “clean up” Vault access logs |
| Customer notification | Decision path: legal + security owner; not automatic public blog from an agent |
| Post-incident review | Required after S0/S1; may produce a new `policyVersion` |

---

## 24. Secure Development Contract

To preserve maintainability:

- Future phases remain **path-scoped**
- No broad unrelated edits
- New capabilities **additive**
- Database migrations **backward-compatible** where possible
- Feature flags for incomplete major modules
- No incomplete public route publication
- Old workflow versions remain supported
- Security tests accompany authority changes
- Theme tests accompany visual changes
- Responsive acceptance accompanies visual changes
- Source-provenance tests accompany jurisdiction changes
- Supply-chain review accompanies dependency/image changes (§17.1)
- Optimistic concurrency + idempotency tests accompany high-value GBS mutations
- Do not edit current AdminDataTable / AdminTableFilters / FormField WIP in GBS phases unless that phase’s scope is those files
- Do not start the worker, push, or deploy as a side effect of a GBS phase unless that phase explicitly owns runtime

Paid AI stays OFF and must never block auth, applications, TalentProfile, readiness, assessments, employer pipeline, or GBS authorization.

New country, service, provider capability, client capability, workflow version, source, fee, policy, or security signal should be **ADDITIVE** whenever reasonably possible. Do not build architecture where one addition requires editing dozens of unrelated existing pages or rewriting existing historical records.

---

## 25. UI / Theme / Responsive Contract

**17D-A Appendix B is mandatory law** for every GBS visual phase. **17D-BR1 does not weaken it.**

### 25.1 Appearances and viewports

Every GBS visual phase must test:

**System, Light, Dark**

at:

**320, 375, 768, 1024, 1440, and 200% zoom**

### 25.2 Must verify

- semantic tokens (`semanticTokens.js` / `surfaceClasses.js`)
- dark public Navbar / Footer in all three appearances
- alignment (17D-A §47)
- long labels
- long provider names
- long jurisdiction names
- dropdown containment
- responsive tables/cards (table ≥1024; priority columns at 768; **cards** at 320; never a 12-column overflow)
- modal containment
- mobile navigation
- keyboard / focus (`:focus-visible`, dialog focus, Escape)
- PhoneInput (digits, E.164, no silent country default)
- CountrySelect (searchable, viewport-safe)
- Date/Time (UTC store, local display, one icon Light/Dark)
- loading / success / empty / safe errors
- **NO SHELL BLINK** (do not gate `MainLayout` on GBS hydration; no pathname-triggered root `setLoading(true)`)

Do not hardcode random white/black/slate/gray when a semantic token exists. Do not put Agent sidebar on public pages. Do not show `StudentPortalNav` on `/business`.

### 25.3 Evidence rule

Source/unit tests alone **cannot** prove visual acceptance.

If automation browser cannot access local TLS:

```
Browser visual evidence = NOT PROVEN
USER MANUAL ACCEPTANCE = REQUIRED
```

Never claim visual PASS from source inspection alone.

---

## 26. Security Standards Mapping

Design/verification **references**. **Not** formal compliance or certification.

| Framework | How Strideto uses it |
| --- | --- |
| NIST CSF 2.0 | Incident lifecycle GOVERN/IDENTIFY/PROTECT/DETECT/RESPOND/RECOVER; Defense Grid maps to Protect/Detect/Recover |
| NIST Zero Trust | Per-request authn/authz; capability + tenant; no preference-as-authority; assume breach |
| OWASP ASVS 5.0 | **Level-2-style verification target platform-wide** |
| OWASP API Security Top 10 | Object authz (IDOR), auth, excessive data, unbounded resources, security misconfig, SSRF already in Phase 12 scope |
| OWASP Automated Threats | Credential stuffing, fake accounts, scraping, carding (deferred with payments), spam, enumeration |

### 26.1 Recommended verification target

- **ASVS Level-2-style** controls platform-wide as the working bar for later mapping
- **Enhanced high-assurance controls** for: Vault; Admin; identity verification; protected provider credentials; HIGHLY_SENSITIVE_IDENTITY; future Commerce

Final exact control applicability must be **mapped before launch certification**. This document does not produce that map as a completed certification checklist.

---

## 27. Threat → Control → Layer → Owner → Status

Status: **EXISTING** = in repo now; **EXTEND** = exists but GBS must add; **MISSING** = not built; **DEFER** = post-MVP / later cert.

| Threat | Control | Layer | Owner (logical) | Status |
| --- | --- | --- | --- | --- |
| DDoS / botnet | Edge/WAF + origin rate limits | 1, 6 | Ops + platform | EXISTING origin limits; MISSING proven CDN/WAF |
| Credential stuffing | Auth limiter, generic errors, hashed tokens, optional future challenge | 1, 3, 6 | Auth | EXISTING; challenge NOT_CONFIGURED |
| Session theft / CSRF | HttpOnly path-scoped cookies, origin check, in-memory access | 3 | Auth | EXISTING |
| Fifth-cookie / realm sprawl | User realm + capabilities | 3, 4 | Auth architecture | LOCKED; capability plane MISSING |
| localStorage authorization | Forbid preference as ACL; server **active grant** check | 4 | GBS authorizer | MISSING (must not copy UI gate) |
| Blanket `student` on all User-realm rows | Classify from authoritative legacy role/state; staff-only gets no auto-`student` | 4 | Identity migration | LOCKED; not implemented |
| Student/GBS write confusion | Active User grants `student` / `business_client` | 4 | GBS + Student APIs | MISSING |
| Retention treated as read permission | Global/security deny override | 3, 4, 5 | Authz | LOCKED |
| Employer cookie as GBS buyer | Deny; User + membership | 3, 4, 5 | GBS | LOCKED policy; APIs not built |
| organizationType as authz | Organization **grants** | 4 | Organizations | MISSING |
| Duplicate fake companies | `employer` + `business_client` on one org | 4, 5 | Organizations | LOCKED; not implemented |
| Fake Agency for independents | ProviderCapability `subjectType=agent` | 4 | Provider | LOCKED; not implemented |
| Agent cap copied to Agency / all members | Exact subject; no automatic copy | 4, 5 | Provider | LOCKED |
| Listing over-scope (e.g. WY formation → DE RA) | Server subset: listing ⊆ active verified capability | 2, 4 | Listings | MISSING |
| Admin UI invents cross-resource privileges | Source-controlled security authorization policy | 4, 6 | Security owner | LOCKED |
| Silent overwrite of newer Case/Quote | `recordVersion` / 409 CONFLICT | 5 | GBS writes | MISSING |
| Duplicate Case from replayed accept | Idempotency-key / command-id | 6 | GBS commands | MISSING |
| Silent mutation of sent Quote | Revision N superseded; N+1 issued | 5 | Quotes | MISSING |
| Passport harvest at discovery | Just-in-time collection after Case requirement | 8, 9 | Vault / GBS | LOCKED |
| Fake RA / ACSP / CSP / lawyer | Trust Capability Registry; Admin evidence; no self-serve titles | 4, 6 | Trust + Admin | EXTEND OrganizationVerification |
| Org Verified = protected title | Explicit non-inference | 4 | Trust | LOCKED policy |
| IDOR / cross-tenant | Tenant + object ACL; opaque ids | 5 | All GBS APIs | EXISTING patterns; GBS MISSING |
| Enumerable Vault/case URLs | Opaque ids; 401 without leak | 5, 9 | Vault | EXTEND |
| Passport in public media | Vault zone only | 8, 9 | Vault | EXISTING; GBS types EXTEND |
| Provider download of unscanned HSI | Quarantine + real scan; `NOT_CONFIGURED` ≠ `CLEAN`; sharing DISABLED until scanner | 7, 9 | Vault | EXISTING owner-path partial; GBS provider share LOCKED gate |
| Ciphertext swapped across tenants | Envelope encryption + AAD | 9 | Crypto | MISSING |
| Malicious npm/image/CI | Supply-chain controls | 7, 17.1 | Platform | PARTIAL (lockfiles); MISSING SBOM/image/provenance |
| Internet-exposed Mongo/Redis | Production private service network | 7, 17.2 | Ops | LOCKED target; topology deferred |
| `fetch(req.body.url)` SSRF | Deny-by-default egress allowlists | 2, 7, 17.3 | Platform | EXISTING accepted path; GBS adapters must keep |
| Fake payment success | Commerce not_configured; quote accept ≠ paid | 6 | Commerce | EXISTING |
| Guaranteed banking/Stripe/visa | Forbidden phrases + moderation | 6 | Marketplace | EXTEND lexicon |
| Jurisdiction facts from blogs | Official Source Registry + reviewStatus | 8 | Catalog Admin | MISSING catalog |
| Stale fees shown as current | `reviewDueAt` / freshness class; STALE ≠ current | 8 | Catalog | MISSING |
| Silent historical rewrite | effectiveFrom/To + versioned migration only | 7 | Catalog / Cases | LOCKED |
| Silent workflow reinterpretation | workflowVersion on each case | 4, 5 | Cases | MISSING |
| Listing / request / message spam | Flow-specific budgets | 6 | Abuse | EXTEND limiters |
| Review fraud | Case-eligible reviews only | 6 | Trust | EXTEND |
| Log leakage of secrets/PII | Redaction + never-log list | 10 | Platform | EXISTING redaction; GBS events MISSING |
| Log tampering | Append-only stream + checkpoints | 10, 11 | Security owner | MISSING |
| Ransomware | Offline copy, restore tests, key recovery | 11 | Ops | PARTIAL scripts; restore-test evidence not launch-complete |
| Infinite tarpit DoS of self | Forbid unbounded deception | 6, 10 | Security | LOCKED reject |
| AI auto-authz | Forbid; AI budget OFF | 4 | Policy | LOCKED |
| Mass assignment | Server-derived high-authority fields | 2, 4 | Platform | EXISTING pattern; GBS must keep |
| Admin impersonation | Forbidden | 4 | Staff | EXISTING policy |
| Shell/theme regressions | Appendix B + manual visual | UI contract | Frontend | EXISTING 17C/17D-0; GBS not built |
| Turnstile silently on | Remain not_configured until dedicated phase | 1, 3 | Auth | EXISTING default |

---

## 28. Data Protection Matrix

| Class | Storage | Encryption | Access | Logging | Retention |
| --- | --- | --- | --- | --- | --- |
| PUBLIC | Catalog / CMS / cache | TLS + disk | Anonymous published projection if **not STALE** | Ids/URLs OK | Catalog + provenance |
| ACCOUNT | Account DBs; Redis hashes | TLS; hashed passwords; no raw tokens | Owner / staff unless global deny | Opaque id | Account + legal |
| BUSINESS_CONFIDENTIAL | Tenant collections | TLS; file DEK target | Members unless global deny | Opaque ids | Case/business class |
| PERSONAL_DATA | Minimized fields | TLS | Owner / permitted parties unless global deny | Minimize | Privacy class |
| HIGHLY_SENSITIVE_IDENTITY | Vault only; JIT after requirement | TLS + envelope **target** + AAD; opaque ids | Owner (quarantine policy later); provider **only if `clean`**; Admin policy | Opaque id + action only | Strict; purge after soft-delete; retention ≠ read |
| FINANCIAL | Quote/commerce revisions | TLS; PCI at provider later | Parties to that revision unless global deny | No PAN | Financial/legal |
| LEGAL_CORPORATE | Vault files + provenance fields | Vault rules / confidential fields | Grants (HSI-class files follow HSI scan rule) | Opaque + provenance | Corporate evidence |
| MAILROOM_PRIVATE | Future mail + Vault-class | Highest | Mailbox scoped unless global deny | Metadata | Future mail policy |
| ADMIN_SECURITY | Audit / security log | TLS; restricted | Security owner / Super Admin | Minimized meta | Long; restricted deletion |

---

## 29. Permission Matrix

See §18.2 for the resource × actor table.

**Read / write / download / transition shorthand for implementers:**

| Resource | Read | Write | Download | Transition |
| --- | --- | --- | --- | --- |
| Business Client workspace | User + **active** `business_client`; no global deny | same | — | — |
| ClientBusiness | owner/member + tenant | owner/member if granted; `recordVersion` | — | provenance-gated; 409 if stale |
| ServiceRequest | client tenant or assigned provider | client create (idempotent); provider cannot forge client | — | provider review states |
| Quote | parties to that revision | provider create; **no in-place mutate of sent**; new revision | — | client accept specific revision (idempotent, no payment) |
| Case | participants unless global deny | limited fields; `recordVersion` | — | workflowVersion allow-list; idempotent |
| CaseTimeline | participants; staff notes Admin/internal | append-only; replay-safe | — | no destructive edits |
| CaseRequirement | participants | provider/client per source tag; HSI only JIT | — | checklist states |
| Vault Grant | owner | owner (create/revoke); Admin policy; `recordVersion` | — | expiry/revoke; HSI provider grant only if `clean` |
| Document | owner/grant | owner upload (JIT for HSI) | owner per quarantine policy; provider HSI only `clean` | archive/soft-delete |
| ProviderCapability | public flags if verified; else owner/Admin | evidence submit **for exact subject**; Admin decide | evidence Vault if any | verification machine; `recordVersion` |
| Listing | public if approved **and not STALE deps**; else owner/Admin | provider; **scope ⊆ verified capability**; Admin moderate | — | moderationStatus |
| Jurisdiction source | public if reviewed **and fresh** | Admin only | — | reviewStatus / freshness |
| GovernmentFee | public if reviewed **and fresh** / in effective dates | Admin only | — | review + `recordVersion` |
| Admin review | staff RBAC unless global deny | staff RBAC; **cannot invent privileges** | policy | queue states |
| Mailbox/MailItem | POST-MVP | POST-MVP | POST-MVP | POST-MVP |

---

## 30. Abuse-Control Matrix

| Business flow | Rate / risk controls (TARGET unless EXISTING) |
| --- | --- |
| Login / register / refresh | EXISTING auth/refresh/register limiters; generic errors; future risk challenge |
| Password reset / verify / resend | EXISTING forgot/resend/verify limiters |
| Public GBS search | Dedicated search limiter; pagination max; no empty-category fake counts |
| Listing create/update | Low daily cap; Admin review at launch; forbidden-claim scan; **server subset vs verified capability** |
| Service Request create | Per user/org/day cap; velocity signal; idempotent; **no HSI collection** |
| Quote create | Per provider/day cap; assigned/authorized clients only; new revision not in-place mutate |
| Quote accept | Idempotent; replay-safe; specific revision; no payment side effect |
| Message create | Per thread/user cap |
| Vault upload | EXISTING upload limiter + 20 MB + MIME; GBS hourly cap TARGET; JIT for HSI |
| Vault download | Per user/grant cap; always audit; burst = S1 signal; provider HSI only `clean` |
| Case transition | Per-case rate; audit; workflowVersion; `recordVersion`; idempotent |
| Capability grant/verify | Audited; source-controlled authority; `recordVersion` on review |
| Export (future) | Deny by default at MVP |
| Registration burst | Signal + existing verification; no silent Turnstile |
| Enumeration | Opaque ids; uniform errors |
| Canary access | High-severity log; cheap 404; no tarpit |

---

## 31. Recovery Matrix

| Asset | Backup | Isolation | Restore test | Ransomware note |
| --- | --- | --- | --- | --- |
| MongoDB | mongodump scripts | App vs backup identity | Required before launch evidence | Restore from offline copy |
| Vault objects | Object store versioning + backup | Not public bucket | Required if GBS identity stored | Metadata restore without bytes is insufficient |
| Refresh sessions | Mongo | — | Re-login acceptable if lost | Rotate secrets after incident |
| Redis | Not SoR | — | Rebuild | Reset limiters OK |
| KEK / secrets | Secret manager / offline | Dual control | Key-recovery drill | Rotate all after suspected leak |
| Audit stream | Separate destination target | Restricted delete | Verify hash checkpoint | Preserve first, restore second |
| Application images | Image/commit rollback | — | Redeploy previous | Do not `down -v` |

---

## 32. Existing Security Reuse Matrix

| Existing control | Verdict | Notes |
| --- | --- | --- |
| Four-realm AuthCookiePolicy | **KEEP** | Do not add fifth cookie |
| In-memory access JWT + Redis denylist | **KEEP** | |
| `strideto-active-workspace` | **KEEP as UX; never EXTEND into authz** | Additive enum value `business_client` later |
| 17D-0 `canActAsStudent` UI gate | **KEEP for cross-realm chrome; REPLACE as GBS authz model** | Server capabilities instead |
| Employer team capabilities pattern | **EXTEND idea** to User/Org capability registries | Do not reuse Employer cookie |
| Organization + OrganizationVerification | **EXTEND** | Capabilities + Trust layers |
| Agent portal / cases / messages / Trust | **EXTEND** | New case family; new ServiceRequest |
| Vault + grants + magic MIME + scan not_configured | **KEEP / EXTEND** | Envelope + AAD; quarantine; **provider HSI share disabled until real scanner** |
| `auditService` | **EXTEND** | Mandatory event set + grant lifecycle + integrity target |
| Redis rate limiters | **EXTEND** | Flow-specific GBS buckets (operational config, not authz) |
| mongo-sanitize, 1 MB body, origin check, Helmet | **KEEP** | GBS schemas additive; listing-subset validation |
| Commerce `not_configured` | **KEEP** | No fake payment |
| Turnstile `not_configured` | **KEEP** | Do not activate in this phase |
| Guarantee-forbidden phrases | **EXTEND** | GBS lexicon |
| DR / backup scripts | **EXTEND** | Vault objects + restore tests + keys |
| Feature-flag / not_configured honesty | **KEEP** | GBS modules default OFF; HSI share OFF if no scanner |
| Semantic tokens / Navbar / Phone / Country / Date | **KEEP** | Appendix B **unchanged / not weakened** |
| Page/block registries | **KEEP pattern** | New GBS registries; do not overload pageRegistry with legal rules |
| AI copilot not_configured / budget OFF | **KEEP** | No AI authz |
| npm lockfiles / CI | **EXTEND** | Supply-chain architecture §17.1; no install in this phase |

---

## 33. Missing Security Controls

These are **architecture gaps**, not a license to implement in this phase.

1. Server-authoritative User **grant** plane (`student`, `business_client`) with auditable grant objects
2. Safe User-realm backfill that does **not** auto-`student` staff-only accounts
3. Organization Capability **grants** independent of `organizationType`
4. Global/security deny override distinct from product capability deactivation
5. ProviderCapability `subjectType` + `subjectId` (agent vs organization)
6. Permission Registry + shared authorizer (listing-subset, active grants) emitting the canonical decision shape
7. GBS resource ACLs and tests (IDOR, dual-capable users, employer-cookie denial, staff-without-student, WY≠DE listing)
8. Opaque cryptographically random ids for highly sensitive objects
9. Envelope encryption / KMS **with AAD** (when deployment supports it)
10. Upload quarantine + **real** isolated scan worker as GBS HSI-sharing launch gate
11. Just-in-time HSI collection gates (no discovery/quote harvest)
12. Quote revisioning + accepted-quote immutability
13. `recordVersion` optimistic concurrency + idempotent commands
14. Flow-specific GBS resource budgets (operational config)
15. Abuse-loop signal aggregation with versioned **operational** policies (cannot rewrite authz)
16. GBS security event catalog wired to audit (including grant lifecycle)
17. Append-only security stream + hash-linked checkpoints + separate retention
18. Vault object backup + restore-test evidence + key-recovery drill
19. Production edge/WAF/bot-management as a tested control
20. Production private network + controlled egress allowlists
21. Software supply-chain controls (SBOM, image scan, provenance) — no install now
22. Risk-based challenge **only after** Turnstile (or successor) is truly configured
23. Optional post-MVP canaries
24. GBS forbidden-claim lexicon and listing moderation rules
25. Official Source / Fee / Jurisdiction publication **and freshness** gates (`reviewDueAt`, effective dates)
26. workflowVersion / policyVersion / sourceVersion / recordVersion on GBS records
27. SPA CSP nonce/hash pipeline (pre-existing Phase 12 gap)
28. Customer incident-notification runbook with named owners

---

## 34. Implementation Preconditions

No GBS implementation phase may start until USER + review accept this lock (17D-A + 17D-B as amended by 17D-BR1). When implementation is later authorized, preconditions are:

1. Path-scoped phase plan that answers §35 gates
2. Feature flags default OFF; no public incomplete routes
3. Additive migrations only; capability backfill per §2.6.2 / §3.6 (**no blanket `student`**)
4. Authorizer + tests before UI (active grants, listing subset, global deny)
5. Vault remains the only identity-document store; JIT collection
6. Commerce remains `not_configured` unless a commerce-certification phase says otherwise
7. Worker not started unless that phase owns email/scan runtime
8. Turnstile not enabled by accident
9. No Docker rebuild / push / deploy unless that phase explicitly owns runtime
10. Known WIP files not used as drive-by refactor targets
11. If the phase enables **provider** sharing of HIGHLY_SENSITIVE_IDENTITY: a **real** malware scan path is a **launch gate**; otherwise that path stays FEATURE-NOT-READY
12. Core authorization policy remains source-controlled; no casual Admin privilege editor

---

## 35. Future Phase Security Gates

Every later implementation phase must **explicitly answer**:

1. What new **authority** was introduced?
2. What new **data** was introduced?
3. What **tenant boundary** was introduced?
4. What **abuse path** was introduced?
5. What **rate/resource limit** protects it?
6. What **audit event** records it?
7. What **recovery impact** exists?
8. What **UI/theme surfaces** were added?
9. What **responsive evidence** exists?
10. What **backward compatibility** exists?
11. Was this a **security authorization policy** change or **operational configuration**?
12. What **concurrency / idempotency** protects new mutations?
13. If listings changed: what **subset-of-verified-capability** check exists?
14. If Vault/HSI changed: is provider sharing scan-gated (`clean` only)?
15. If catalog/fees changed: what **freshness / effective-date** behavior applies?

A phase is **incomplete** if these questions are unanswered.

Visual phases additionally require Appendix B evidence. If the browser cannot access local TLS: **NOT PROVEN** + USER MANUAL ACCEPTANCE. Appendix B / §25 is **not weakened**.

Authority-changing phases additionally require security tests (student-only cannot GBS-write; business-client-only cannot student-write; Employer cookie cannot GBS-write; preference cannot grant capability; staff-only User has no automatic `student`; listing cannot exceed verified subject scope).

Jurisdiction-changing phases additionally require source-provenance **and freshness** tests (`sourceUrl`, `reviewStatus`, `reviewDueAt`, no blog-as-fact, no stale-as-current).

---

## 36. Decisions Frozen

| ID | Decision |
| --- | --- |
| D1 | Public vertical = Business Services |
| D2 | Buyer authentication = User realm; no fifth cookie |
| D3 | Buyer authorization = **active** User capability **grants** + optional org membership + Organization **grants** |
| D4 | `strideto-active-workspace` is UX only |
| D5 | Dual-capable Users may switch UI; APIs always capability-check |
| D6 | Provider = Agent/Agency + capabilities; no formation-provider realm |
| D7 | Generic public role = Business Services Provider |
| D8 | Formation public specialization = Business Formation Provider |
| D9 | Protected titles evidence-gated; Org Verified grants none |
| D10 | organizationType is descriptive; Organization capability **grants** authorize |
| D11 | Org may hold `employer` + `business_client` without duplicate companies |
| D12 | Employer cookie remains hiring-only |
| D13 | Launch countries = Pakistan, United States, United Kingdom |
| D14 | Initial US publication candidates = Delaware, Wyoming, Florida, Texas (still review-gated) |
| D15 | Jurisdiction not public until source catalog reviewed **and currently fresh** |
| D16 | MVP list in §5.4; no fake payment |
| D17 | Mailroom POST-MVP |
| D18 | Automated legal compliance calendar POST-MVP |
| D19 | Payments/payouts/escrow DEFER |
| D20 | Government filing integrations DEFER |
| D21 | AI personalized jurisdiction/tax advice OUT OF LAUNCH SCOPE |
| D22 | Registries/adapters; additive expansion; versioned workflows |
| D23 | Defense Grid 11 layers; fail closed |
| D24 | Abuse loop governed; no autonomous production security; no AI authz |
| D25 | Flow-specific resource budgets; no single global threshold |
| D26 | Data classes in §13 |
| D27 | Vault zone for identity/legal documents; JIT collection |
| D28 | Envelope encryption + AAD target; no custom crypto; no crypto implementation now |
| D29 | `not_configured` ≠ `CLEAN` / `SCANNED_SAFE` |
| D30 | Deception optional post-MVP; no tarpits |
| D31 | Appendix B UI/theme/responsive law (**unchanged, not weakened**) |
| D32 | ASVS L2-style target; no certification claim |
| D33 | Future phases must answer §35 gates |
| D34 | First listings Admin-reviewed at launch (17D-A Decision 12, accepted) |
| D35 | Reviews require eligible case/milestone (17D-A Decision 11, accepted) |
| D36 | Explicit workspace preference; no silent Student→Business Client switch (17D-A Decision 17, accepted) |
| D37 | Quote-required allowed; accept quote without Strideto payment (17D-A Decisions 7–8, accepted) |
| D38 | Existing User-realm accounts are **not** all granted `student`; staff-only get no automatic `student` |
| D39 | Capabilities are auditable grants (`active \| suspended \| revoked`) with grant metadata |
| D40 | Global/security deny can block READ/WRITE/DOWNLOAD/TRANSITION/GRANT/ADMIN; retention ≠ access |
| D41 | ProviderCapability has exact `subjectType` (`agent` \| `organization`) + `subjectId` |
| D42 | Listing scope ⊆ active verified ProviderCapability of the same subject (server) |
| D43 | Security authorization policy is source-controlled; not a casual Admin privilege editor |
| D44 | High-value records use `recordVersion`; stale write → 409 CONFLICT |
| D45 | Important commands are idempotent (command-id / idempotency-key) |
| D46 | Quotes are revisioned; sent quotes are not silently mutated; accepted quotes are immutable except privileged correction |
| D47 | Provider HSI share/download is a malware-scan **launch gate**; sharing DISABLED if scanner `NOT_CONFIGURED` |
| D48 | Production data services are private; egress is allowlisted; supply-chain security is mandatory architecture |

---

## 37. Deferred Decisions

Still open from 17D-A §59 or newly deferred; **not** silently filled.

| ID | Question | Constraint while deferred |
| --- | --- | --- |
| Q1 | Exact Organization `organizationType` string for pure buyer orgs (`business_client` vs `corporate_customer` vs none) | Capabilities authorize either way |
| Q2 | Independent consultants without an agency offering RA-adjacent listings | Fail closed: no RA listing without jurisdiction capability verification **on that Agent subject** |
| Q3 | US BOI / beneficial-ownership overlay (disclaimer vs omit until counsel catalogs FinCEN) | No personalized BOI/tax advice product |
| Q4 | Pakistan providers serving US formation — AML/advertising legal review | No “we are the SOS” claims meanwhile |
| Q5 | Exact private workspace path (`/business` vs `/account/business` vs `/workspace/business`) | Private routes noindex; not a fifth realm |
| Q6 | Worker/email for GBS vs in-app-only at launch | Do not start worker in a docs phase; do not claim live email |
| Q7 | Languages for jurisdiction legal copy (English-only MVP?) | Do not claim complete AR GBS copy |
| Q8 | Data residency / region pinning for passports | Vault private storage remains; no fake residency claim |
| Q9 | Exact GBS rate integers | Flow-specific **operational** budgets; numbers tuned in implementation/policy versions; cannot grant authority |
| Q10 | Dual-capable default (additive both vs forced split accounts) | Default additive; APIs still check required **active** grant |
| Q11 | Business Client activation UX (first request vs settings vs onboarding) | No self-grant that bypasses policy; no silent grant to all Users; no grant inferred from workspace |
| Q12 | Exact policy for **owner’s own** Vault access while HSI is quarantined / `not_configured` / `pending` / `failed` | **Locked for providers:** no provider share/download of HSI unless `clean`. Owner-own access is the remaining deferred slice. `NOT_CONFIGURED` ≠ `CLEAN`. |
| Q13 | Secret-manager / KMS / CDN / WAF vendor | Do not choose unless deploy already requires; no secrets in Git |
| Q14 | Fail-vs-best-effort on non-high-assurance audit insert | High-assurance actions default fail-closed if audit cannot record |
| Q15 | Take-rate / listing subscription | Free/`not_configured` until commerce (17D-A Decisions 14–15) |
| Q16 | Exact ASVS control mapping for launch certification | Map before certification; L2-style is the working bar only |
| Q17 | Exact persistence schema for capability grant objects | Conceptual fields in §2.6 are locked; storage shape is implementation |
| Q18 | Exact idempotency-key transport (header vs body) | Replay-safety is locked; transport deferred |
| Q19 | Exact production VPC/vendor topology | Private data plane is locked; vendor deferred |
| Q20 | STALE public behavior: warn vs hide vs unpublish | Never silent current; exact UX deferred per freshness class |

---

## 38. Final Architecture Invariants

1. Strideto is a marketplace and case-operations platform, not a registrar, law firm, tax advisor, or formation company.
2. Four auth realms remain. GBS does not add a fifth cookie or universal token.
3. Authentication ≠ capability grant ≠ workspace preference ≠ organizationType ≠ Organization Verified ≠ protected title ≠ scanStatus.
4. `strideto-active-workspace` never grants authority and is never migration evidence.
5. Student-only Users cannot perform Business Client writes. Business-client-only Users cannot perform Student writes. Dual-capable Users still face per-API **active-grant** checks. Staff-only User-realm accounts do not automatically receive `student`.
6. Employer-cookie hiring stays hiring. GBS buyer actions are User + membership + **active grants**.
7. An organization may be employer and business_client without a cloned fake company.
8. Generic public role is Business Services Provider. Formation specialization is Business Formation Provider. Protected titles are evidence-gated.
9. Organization Verified grants no protected title.
10. ProviderCapability is subject-exact (`agent` or `organization`). Agent caps do not become Agency caps; Agency caps do not become every member’s personal credential.
11. Listing scope ⊆ active verified ProviderCapability of the same subject. Server-enforced.
12. Legal facts require official sources, review, **freshness**, and effective dates. A jurisdiction is not public as current until reviewed and not STALE. DE/WY/FL/TX are candidates, not auto-published. Silent historical rewrite is forbidden.
13. Fees stay split. Quotes are revisioned. Accept is idempotent and unpaid while Commerce is `not_configured`. Accepted quotes are immutable except privileged correction.
14. New case family `business_services`. Do not reuse study/work stages. Do not silently reinterpret old cases. High-value mutations use `recordVersion` (409 on stale) and idempotent commands.
15. Vault is the only store for passports and other highly sensitive documents. No public URLs. No ordinary media library. Collect JIT after Case + requirement — not at discovery or ordinary quote review.
16. If a scanner is missing, status is `not_configured`, never `CLEAN` / `SCANNED_SAFE`. Provider sharing/download of HIGHLY_SENSITIVE_IDENTITY is then DISABLED / FEATURE-NOT-READY.
17. Envelope encryption uses standard APIs, unique DEKs, unique nonces, and AAD context binding. Do not invent cryptography. Do not put master keys in the database or the browser.
18. Fail closed on missing auth, global/security deny, non-active grant, membership, tenant, object grant, listing subset, policy, budget, or stale version.
19. Retention determines whether Strideto keeps data. It does not grant a suspended principal the right to read it. Global/security deny can block READ/WRITE/DOWNLOAD/TRANSITION/GRANT/ADMIN.
20. Hidden UI is not authorization. Core authorization policy is source-controlled, not casual Admin config.
21. Abuse control is deterministic and governed. No self-modifying production security. No AI authorization. No infinite tarpits.
22. Resource budgets are flow-specific operational knobs.
23. Security logs never contain secrets, tokens, keys, or document contents.
24. Backups without restore tests are not launch evidence. Production Mongo/Redis/worker/scanner are private. Server egress is allowlisted. Supply-chain security is mandatory architecture.
25. Appendix B visual law stands and is not weakened. Source inspection is not visual PASS.
26. No NIST/OWASP certification is claimed by this document.
27. Mailroom, automated compliance calendar, payments, government filing APIs, and AI advice stay out of GBS launch scope as locked above.
28. New countries/services/capabilities/workflows/sources/fees/policies/signals are additive whenever reasonably possible.
29. Later phases answer the §35 gates or they are incomplete.

---

## 39. Hard Stop

**17D-BR1** amended **this file only**.

- **NO** GBS implementation
- **NO** Phase 17D-1
- **NO** Phase 18
- **NO** database change
- **NO** source code / routes / UI / tests / package installs
- **NO** runtime change
- **NO** worker start
- **NO** push
- **NO** deploy
- **NO** staging
- **NO** commit yet
- **NO** edit of `docs/STRIDETO_PHASE_17D_A_GLOBAL_BUSINESS_SERVICES_ARCHITECTURE_GAP_AUDIT.md`

Return this updated lock for **USER + ChatGPT final review** before any implementation phase.

---

**END OF ARCHITECTURE LOCK (17D-B as amended by 17D-BR1)**

Implementation: **NONE**  
Source code: **NONE**  
Database: **NONE**  
Routes / UI: **NONE**  
Runtime: **NONE**  
Commit: **NONE**  
Push: **NO**  
Deployment: **NO**  
Phase 17D-1 / Phase 18: **NOT STARTED**  
Worker: **STOPPED** (not started)
