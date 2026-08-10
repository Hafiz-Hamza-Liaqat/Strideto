# Strideto Mission 18 — Verified Institution Portal

## Overview

Mission 18 adds the Verified Institution Portal: a secure first-party portal for universities, colleges, institutes, and other approved education organizations to manage official institution information and authoritative education data.

All Mission 18 additions are **additive** — no existing models, routes, or data were replaced or migrated.

---

## Institution Realm

### Authentication

- New JWT provider: `strideto-institution-access` / `strideto-institution-refresh` audiences
- `InstitutionAccount` model (`server/src/models/institution/InstitutionAccount.js`) — mirrors `AgentAccount` credential shape
- `institutionSecureAuthFlows` — mirrors `agentSecureAuthFlows` for the `'institution'` realm
- `requireInstitutionAuth` middleware — rejects User, Employer, and Agent tokens; only Institution tokens accepted
- `req.institution` principal attached by `attachSecurePrincipal` in `auth.js`
- Refresh cookie: `__Secure-strideto_institution_rt` (production) / `strideto_dev_institution_rt` (development)
- Path: `/api/auth/institution/refresh-token`

### Realm isolation

- Institution tokens use a distinct JWT audience — they cannot be verified by user/employer/agent providers
- `SessionSubjectStateProvider` extended with `institutionModel` injection
- `AccountSecurityMutationService` extended with `institutionModel` for token-version increment on logoutAll
- `REFRESH_SESSION_SUBJECT_TYPES` extended with `'institution'`

### Auth routes

```
POST /api/auth/institution/register
POST /api/auth/institution/login
POST /api/auth/institution/refresh-token
POST /api/auth/institution/logout
POST /api/auth/institution/logout-all
GET  /api/auth/institution/me
```

---

## Organization Reuse

- Reuses Mission 1 `Organization` model — institution registration creates an `Organization` record with the appropriate `organizationType`
- `ORGANIZATION_TYPES` extended with `SCHOOL` and `TRAINING_CENTER` (additive — no renames)
- Institution-eligible types: `university`, `college`, `institute`, `school`, `training_center`
- `isInstitutionOrgType()` in `shared/institution/institutionPortal.js` validates type membership

---

## Onboarding

Onboarding stages (tracked by `getOnboardingStatus`):

1. Account / representative (`institutionRegister`)
2. Organization identity (profile `officialDisplayName` / `legalName`)
3. Official website
4. Location / address
5. Verification evidence (Mission 2 `OrganizationVerification`)
6. Canonical institution claim / linkage (`InstitutionClaim`)
7. Verification submitted
8. Approved

Pre-approval institution may: log in, complete organization profile, prepare claim, provide evidence, view needs_information, prepare drafts.

Pre-approval institution may NOT: publish "Verified Institution", overwrite canonical data, publish programs or TestAcceptance, claim canonical authority.

---

## Verification

Mission 2 `OrganizationVerification` remains authoritative. No `institutionVerified: boolean` was created.

- `OrganizationVerification` record created on registration (status: `draft`)
- `assertApprovedVerification()` in `institutionPortalService.js` gates privileged publishing
- Suspended/revoked/expired organizations lose privileged publishing authority immediately
- `isBlocked()` and `canExercisePrivilegedCapability()` from `shared/international/verification.js`

---

## Representative Authority

- `InstitutionClaim.representativeAccountId` links the claiming `InstitutionAccount`
- `InstitutionClaim.authorityEvidenceRefs` points to `VerificationEvidence` records supporting authority
- Domain ownership alone does not imply authorized control of all institution data
- `BADGE_TYPES.INSTITUTION_REPRESENTATIVE_VERIFIED` requires `representative_authority` accepted evidence
- `BADGE_TYPES.ACCREDITATION_VERIFIED` requires `accreditation` accepted evidence

---

## Canonical Institution Claim

**Model:** `server/src/models/institution/InstitutionClaim.js`

**CRITICAL**: Institution cannot self-approve. Admin/trust review controls final linkage.

### Fields

- `organizationId` — the claiming Organization
- `canonicalInstitutionId` — existing `CanonicalInstitution` (null if proposing new)
- `proposedCanonical` — proposal for a new canonical record (when no existing match)
- `state` — `draft | submitted | under_review | needs_information | approved | rejected | revoked`
- `representativeAccountId`
- `authorityEvidenceRefs`
- `normalizedName`, `countryCode`, `officialDomain` — duplicate-detection signals
- `history[]` — immutable state transition log

### State transitions

```
draft → submitted (by institution)
submitted → under_review | needs_information (by Admin)
under_review → approved | rejected | needs_information (by Admin)
needs_information → submitted | under_review (by institution responding)
approved → revoked (by Admin)
```

### Duplicate detection

Before accepting a claim for a proposed new canonical institution, the service checks for an existing published `CanonicalInstitution` with matching normalized name and country. If found, it rejects the proposal with the existing ID so the institution can claim the correct record.

### Admin claim review

```
GET  /api/admin/institution/claims
PATCH /api/admin/institution/claims/:claimId
  { action: 'begin_review' | 'approve' | 'reject' | 'request_information' | 'revoke' }
```

Approval atomically creates the new `CanonicalInstitution` if none existed and links `organizationId` to it.

---

## Institution Team / Membership

**Model:** `server/src/models/institution/InstitutionMembership.js`

### Roles

| Role | Can submit | Can manage team |
|------|-----------|-----------------|
| owner | ✓ | ✓ |
| admin | ✓ | ✓ |
| editor | ✓ | ✗ |
| viewer | ✗ | ✗ |

- Active membership required for all portal operations
- Scoped to `organizationId` — no cross-institution access
- All permission checks are server-side; never trust client-supplied role

---

## Official Institution Profile

**Model:** `server/src/models/institution/InstitutionProfile.js`

- One record per Organization (1:1 link via `organizationId`)
- Fields: `officialDisplayName`, `legalName`, `aliases`, `institutionType`, `countryCode`, `addresses[]`, `officialWebsite`, `officialAdmissionsWebsite`, `officialContactEmail`, `officialPhone`, `institutionDescription`, `academicLevels[]`, `studyModes[]`, `accreditationRefs[]`, `institutionIdentifiers[]`
- `directApplicationCapability: 'not_configured'` — no direct application submission in M18
- `commerceCapability: 'not_configured'` — no Institution billing in M18
- `sourceType: 'institution_official'` — provenance attribution
- `completenessScore` — computed on every profile save

### Profile completeness

`computeInstitutionCompleteness()` in `shared/institution/institutionPortal.js`:
- Returns `{ score: 0–100, completed: [], missing: [] }`
- Completeness ≠ verification
- Completeness ≠ canonical ownership
- 100% score does not imply Verified Institution

---

## Program Management

Reuses `Program` model from Mission 4/7. No competing model created.

### Ownership enforcement

- Institution may only create/edit Programs where `Program.institutionId` matches their approved `InstitutionClaim.canonicalInstitutionId`
- `assertProgramOwnership()` validates server-side; client-supplied `institutionId` is never trusted
- Cross-institution mutation is blocked with `403 FORBIDDEN`

### Program lifecycle (extended)

`PUB_STATUSES` in `shared/education/taxonomy.js` extended (additive):
- `submitted` — institution submitted for Admin review
- `under_review` — Admin reviewing
- `needs_changes` — Admin returned for revision
- `discontinued` — institution-managed discontinuation

### Approved verification required to create/publish programs

`assertApprovedVerification()` gates program creation.

### Intakes

Reuses existing inline `intakes[]` embedded in `Program`. No competing `ProgramIntake` model created — Mission 4/7 architecture already covers this.

### Tuition / fees

- Mission 1 Money contract: `amountMinor` (integer minor units) + `currency`
- Validation rejects non-integer `amountMinor` and missing `currency`
- No FX conversion, no guessed tuition, no fabricated taxes

---

## Program Requirements

Reuses `ProgramRequirement` from Mission 7. `createRequirement` in `institutionPortalController.js` scopes requirements to institution-owned programs with ownership validation.

---

## Test Acceptance

Reuses `TestAcceptance` from Mission 6.

### Scope protection

- Institution may manage `institution`, `program`, `program_intake` scopes only
- Institution **cannot** modify `country`-scoped acceptance rules
- `createOrUpdateTestAcceptance()` in service layer enforces this with `FORBIDDEN`
- Scope precedence hierarchy unchanged: `program_intake > program > institution > country`

### Change tracking

- Supersedes existing draft claim on scope match
- Creates `InstitutionChangeEvent` for the supersession

---

## Scholarships

Reuses `CanonicalScholarship` from Mission 7.

- `assertScholarshipOwnership()` validates institution is legitimately the provider/owner
- External scholarships cannot be overwritten
- `institutionId` or `organizationId` on the scholarship must match the institution's verified claim

---

## Official Source / Provenance

- `INSTITUTION_SOURCE_TYPE = 'institution_official'` — canonical attribution for institution-submitted data
- Embedded in `sources[]` on programs, requirements, test acceptance records
- Institution account login alone does not prove every submitted fact
- Public UI can express: "Official information supplied/confirmed by institution"

---

## Freshness

- `reconfirmFreshness()` creates an `InstitutionChangeEvent` record (category: `provenance_reconfirmation`)
- Updates `Program.lastVerifiedAt` and `Program.freshnessState = 'fresh'`
- Reconfirmation is fully auditable — no silent freshness reset
- `logAudit` called for every reconfirmation

---

## Version / Change History

**Model:** `server/src/models/institution/InstitutionChangeEvent.js`

Append-only immutable log. Never deleted or updated.

High-impact changes tracked: tuition, intakes, admissionRequirementsUrl, program status, test requirements, scholarship criteria, freshness reconfirmation.

`recordChangeEvent()` creates a record with: `organizationId`, `canonicalInstitutionId`, `programId`, `changeCategory`, `field`, `previousValue`, `newValue`, `changedByAccountId`, `changedByRole`, `sourceType`, `sourceUrl`, `reconfirmationNote`.

---

## Conflict Detection

**Model:** `server/src/models/institution/InstitutionDataConflict.js`

When institution submission conflicts with existing high-authority data:
- `detectAndStoreConflict()` stores the conflict rather than silently overwriting
- States: `open | under_review | resolved_institution | resolved_existing | dismissed`
- No AI conflict resolution in Mission 18

### Admin conflict resolution

```
GET  /api/admin/institution/conflicts
PATCH /api/admin/institution/conflicts/:conflictId/resolve
  { resolvedAs: 'resolved_institution' | 'resolved_existing' | 'dismissed', resolution: '...' }
```

---

## Public Surfaces

### Institution profile

`GET /api/institutions/:slug/profile`
- Shows: `officialName`, `slug`, `countryCode`, `city`, `region`, `officialWebsite`, `officialDomain`, `institutionType`, `isPublic`, `status`, `hasOrganizationManagement`
- Shows: `verifiedManagement: { officialDataSupplied, sourceType, note }` when verified + approved claim exists
- Shows: published programs (top 20)
- Never exposes: internal representative details, verification documents, risk scores, Admin notes, team members, private contact/security data

### Institution directory

`GET /api/institutions/directory?name=&countryCode=&institutionType=&page=&limit=`
- Bounded pagination (max 50 per page)
- No fake rankings

### Programs through canonical Program Explorer

Institution-managed published programs appear through the existing canonical Program surfaces with source/official-data attribution. No separate Institution-only program catalog.

---

## Student / Vault / Privacy Boundary

- Institution auth gives **zero** Vault access
- Institution cannot browse Students, USPs, Agent cases, or Vault documents
- Institution cannot invoke Employer hiring authority
- No direct application submission — `directApplicationCapability: 'not_configured'`
- No `DocumentAccessGrant` usage in M18

---

## Agent / Employer Isolation

- Institution realm cannot mutate Agent services/marketplace
- Institution realm cannot access Agent cases
- Agent/Employer cannot mutate Institution-owned canonical records through their own realms
- `requireInstitutionAuth` blocks all non-institution principals

---

## Admin Integration

Reuses Mission 2 verification Admin flow (`/api/admin/verification/*`).

Institution-specific Admin surfaces (minimal, non-duplicating):

- `GET /api/admin/institution/claims` — claim review queue
- `PATCH /api/admin/institution/claims/:claimId` — transition claim state
- `GET /api/admin/institution/conflicts` — conflict review queue
- `PATCH /api/admin/institution/conflicts/:conflictId/resolve` — conflict resolution

All guarded by `requireAuth + requireAdmin`.

---

## Audit

`logAudit()` called for:

- `institution_registered`
- `institution_claim_started`
- `institution_claim_submitted`
- `institution_claim_approve` / `institution_claim_reject` / etc.
- `institution_profile_updated`
- `institution_program_created`
- `institution_program_updated`
- `institution_program_submitted`
- `institution_test_acceptance_created`
- `institution_requirement_created`
- `institution_freshness_reconfirmed`
- `institution_conflict_resolved`
- `institution_team_role_updated`
- `institution_team_member_revoked`

Never audited: secrets/tokens, private verification evidence contents, private identity documents, raw Student data, private payment credentials.

---

## Notification Foundation

**Model:** `server/src/models/institution/InstitutionNotificationEvent.js`

`prepareNotification()` creates internal event records. `delivered` always `false` in Mission 18.

No worker started. No email/SMS/push/WhatsApp delivery.

Event types:
- `verification_update`
- `claim_review_result`
- `content_needs_changes`
- `stale_review_due`
- `conflict_requires_action`

---

## International Support

- ISO 3166-1 alpha-2 country codes on all address/institution fields
- No Pakistan-only assumptions
- Mission 1 `Money` contract for tuition (ISO currencies, minor units)
- International addresses on `InstitutionProfile.addresses[]`

---

## Dashboard

`GET /api/institution/:organizationId/dashboard`

Truthful metrics only:
- `verificationStatus`
- `claimState`
- `profileCompleteness`
- `publishedPrograms`
- `draftPrograms`
- `openConflicts`

No fabricated applications, Student leads, enrollments, or revenue.

---

## Portal Routes

```
/api/institution/:organizationId/dashboard
/api/institution/:organizationId/onboarding
/api/institution/:organizationId/profile
/api/institution/:organizationId/claim
/api/institution/:organizationId/claim/:claimId/submit
/api/institution/:organizationId/programs
/api/institution/:organizationId/programs/:programId
/api/institution/:organizationId/programs/:programId/submit
/api/institution/:organizationId/programs/:programId/requirements
/api/institution/:organizationId/test-acceptance
/api/institution/:organizationId/freshness/reconfirm
/api/institution/:organizationId/data-conflicts
/api/institution/:organizationId/change-history
/api/institution/:organizationId/team
/api/institution/:organizationId/team/:memberId/role
/api/institution/:organizationId/team/:memberId (DELETE)
```

---

## Tests

`server/src/__tests__/institutionPortal.test.js` — 50/50 behavioral and security tests. No DB/network. Pure JS.

The Institution Portal UX closure re-executed this isolated regression after frontend/auth changes: **50/50 passed**.

Tests cover:
- Institution realm JWT isolation
- Middleware isolation (User/Employer/Agent rejected)
- Organization type validation
- Pre-approval restrictions
- Mission 2 verification integration
- Canonical claim workflow and self-approval protection
- Team role authorization
- Profile completeness independence from verification/ownership
- Publishing policy (high-impact fields)
- Program lifecycle statuses
- TestAcceptance scope protection (country-level blocked)
- Trust badges from accepted evidence only
- Provenance and freshness audit
- Conflict detection
- Change history immutability
- Student/Vault/privacy boundary
- Commerce/payment boundary
- Admin review authorization
- Audit trail
- Notification foundation (no delivery)

---

## Frontend Portal UX Closure

Institution-owned browser routes now cover:

```
/institution/login
/institution
/institution/onboarding
/institution/profile
/institution/programs
/institution/programs/new
/institution/programs/:programId/edit
/institution/data-quality
/institution/team
```

- `InstitutionAuthProvider` and the dedicated axios client keep Institution access tokens, refresh, logout, and realm routing isolated from User, Employer, and Agent auth.
- Protected routing requires a resolved Institution account and active organization membership before rendering the portal.
- Dashboard, verification/onboarding, official profile, canonical Programs, Program requirements, TestAcceptance, freshness/conflicts/history, and team/settings surfaces use the existing Mission 18 APIs.
- Completeness, verification, canonical authority, review, and freshness remain separate textual states; the frontend does not infer approval.
- Unsupported scholarships, invitations, commerce, Student/Vault access, Agent/Employer authority, and provider actions are stated as unavailable rather than represented by fake controls.
- International content acceptance includes long Unicode Institution/Program names and explicit ISO currency alongside locale-aware minor-unit formatting.
- Auth revalidation occurs when entering/leaving the Institution realm rather than on every portal subroute, preventing navigation flicker and duplicate session requests.

Focused real-browser acceptance: `node scripts/verify-institution-portal-ux.mjs` — **89/89 passed** in local Chromium using intercepted deterministic fixtures and blocked external DNS.

Evidence:

- `docs/screenshots/responsive/mission-18-institution-mobile-320.png`
- `docs/screenshots/responsive/mission-18-institution-desktop-1440.png`

## Build

Final frontend production build passes with the Institution Portal included.

---

## No Live Data / Migrations

- No live Institution accounts created
- No live canonical data seeded or backfilled
- No external notifications sent
- No worker started
- No live DB migrations
- No Stripe calls

---

## Mission 19 Boundary

Evidence-Grounded AI Copilot (Mission 19) is the next mission.

Institution data is a natural grounding source for the AI copilot — official programs, requirements, test acceptance, scholarships — but the AI inference layer belongs to Mission 19, not this portal. No AI conflict resolution or recommendation generation is implemented in Mission 18.
