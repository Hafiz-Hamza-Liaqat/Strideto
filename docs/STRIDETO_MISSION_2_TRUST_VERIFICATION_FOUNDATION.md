# Strideto Mission 2 — Trust & Organization Verification Foundation

> **Status:** Implemented (source-complete, not deployed).
> **Scope:** Additive trust and verification lifecycle, evidence model, badge
> semantics, credential policy, risk foundation, Admin queue, organization
> status surface, reusable capability gate.
> **Authority:** Subordinate to the frozen product spec, execution roadmap,
> engineering guardrails, and trust/verification policy. Preserves Employer
> Release Baseline and Mission 1 unchanged.

---

## 0. Purpose & principle

Mission 2 builds the reusable **Trust Engine foundation** that all future
organization portals (Agent, Agency, Institution, University, College, Institute)
depend on before exercising privileged capabilities. It is entirely additive:
nothing in the existing Employer portal or Mission 1 contracts is changed or
migrated.

**Core rule (from policy):** Registration alone does not grant privileged
capabilities. Only an **APPROVED** organization may publish, accept paid clients,
or exercise any verification-gated operation.

---

## 1. Verification Lifecycle

### State machine — `shared/international/verification.js`

Canonical status values and explicit allowed transitions:

```
draft
  └─► email_verified
        └─► verification_pending ◄──────────────────────────────────────┐
              ├─► under_review ◄──────────────────────────────────────┐  │
              │     ├─► approved ──► suspended ──► revoked           │  │
              │     │         └──────────────────────────────────────►│  │
              │     ├─► rejected ─────────────────────────────────────────┘
              │     ├─► needs_information ──► verification_pending ───┘
              │     └─► enhanced_review ──► approved|rejected|needs_information|under_review
              └─► needs_information (from verification_pending)
```

**Every transition not in the explicit allow-list is rejected server-side.**
No transition skips the review step. No automatic approval ever.

Transitions are validated by `isValidTransition(from, to)` which consults
`ALLOWED_TRANSITIONS` — a frozen map of `from → Set<to>`.

### Immutable transition history — `VerificationTransition`

Every status change creates one record. Records are **write-once**
(Mongoose pre-hooks throw on any `updateOne/findOneAndUpdate`).
Fields: `organizationId`, `fromStatus`, `toStatus`, `actorId`, `actorRole`,
`actorRealm`, `reason`, `metadata` (safe), `correlationId`, `occurredAt`.

### Re-verification / expiry

The `OrganizationVerification` model carries: `verifiedAt`, `verifiedBy`,
`nextReviewAt`, `credentialExpiresAt`, `verificationVersion`, `riskLevel`.
`approved → expired` is an allowed transition. Expired orgs re-enter via
`verification_pending`.

(Schedulers/workers to auto-expire are deferred — the transition boundary exists.)

---

## 2. Organization Verification Profile

### Model — `OrganizationVerification`

One record per Organization (unique `organizationId`). Contains:

| Field group | Fields |
|---|---|
| Identity | `legalName`, `displayName` |
| International | `countryCode` (ISO 3166 alpha-2), `registeredAddress` (international sub-schema) |
| Contact | `officialEmail`, `officialWebsite`, `officialDomain`, `phone` (E.164) |
| Registration | `registrationNumber`, `registrationAuthority`, `registrationCountry` |
| License/credential | `licenseNumber`, `licenseIssuer`, `licenseJurisdiction`, `licenseIssuedAt`, `licenseExpiresAt` |
| Accreditation | `accreditationBody`, `accreditationNumber`, `accreditationExpiresAt` |
| Representative | `authorizedRepresentative`, `representativeRole`, `representativeAuthorizationRef` |

Organization type + country are denormalized onto the verification record for
efficient queue filtering without joins.

---

## 3. Evidence Model

### `VerificationEvidence`

| Field | Purpose |
|---|---|
| `organizationId` | Ownership (tenant isolation) — BOTH org+id required on all queries |
| `evidenceType` | One of `EVIDENCE_TYPES` |
| `status` | `pending` → `accepted` or `rejected`; `expired` |
| `sourceUrl` | HTTPS URL to public source |
| `evidenceRef` | Opaque reference to stored document (never raw content) |
| `safeMetadata` | Non-sensitive structured data (forbidden-key validated) |
| `submittedAt`, `reviewedAt`, `reviewedBy` | Audit timestamps |
| `expiresAt` | For licenses / accreditations |
| `rejectionReason` | Populated only on rejection |
| `correlationId` | Request trace correlation |

**Evidence types:** `identity`, `business_registration`, `official_domain`,
`physical_location`, `google_maps`, `professional_license`, `accreditation`,
`representative_authority`, `organization_document`, `other`.

**Google Maps is supporting evidence only.** It may help the `physical_location`
badge but cannot on its own be the sole proof of an organization's legitimacy.

---

## 4. License / Credential Policy

### `credentialPolicyService.js` + `rolloutConfig`

Uses Mission 1's `resolveFeature` resolver with a jurisdiction-aware table:

| Context | Policy |
|---|---|
| `agent` in `PK` | `required` |
| `agency` in `PK` | `required` |
| `employer` (any country) | `not_applicable` |
| `university`, `college`, `institute` | `optional` |
| fallback (all others) | `optional` |

`setPolicyTable(table)` accepts an external config table (with validation);
`resetPolicyTable()` restores the default. Concrete jurisdiction legal rule
tables are deferred to later missions/compliance configuration.

**"No license" ≠ automatically invalid.** If a credential is required for a
configured org+country, Admin review must verify valid evidence before approving.
The system does not auto-block approval — the reviewer is authoritative.

---

## 5. Granular Trust Badges

Badges are computed from **accepted (non-expired) evidence** via `deriveBadges`:

| Badge | Required evidence type |
|---|---|
| `identity_verified` | `identity` |
| `business_verified` | `business_registration` |
| `official_domain_verified` | `official_domain` |
| `physical_location_verified` | `physical_location` |
| `professional_credential_verified` | `professional_license` |
| `institution_representative_verified` | `representative_authority` |
| `accreditation_verified` | `accreditation` |

**A badge attests ONLY to what it names.** No "Strideto guarantees this
organization's conduct" implication is ever correct.

Expired or rejected evidence immediately removes the badge on the next
`recomputeBadges()` call (triggered by evidence review and approval transitions).
Suspension and revocation clear `earnedBadges` immediately.

---

## 6. Verification Submission

`verificationService.submitVerification(organizationId, profile, actor)`:

1. Validates completeness via `validateSubmissionCompleteness` (required fields:
   `legalName`, `displayName`, `countryCode`, `officialEmail`,
   `registeredAddress`, `officialWebsite`, `authorizedRepresentative`).
2. Rejects with `422 INCOMPLETE_SUBMISSION` if any required field is missing.
3. Valid: transitions to `verification_pending`, records `submittedAt`,
   computes `slaDeadlineAt` (submission + 48 raw hours).
4. Writes immutable transition record + audit log.

Re-submission after `needs_information` re-enters `verification_pending`
via the same endpoint.

---

## 7. Review Workflow

`verificationService` actions:

| Action | From states | Actor |
|---|---|---|
| `beginReview` | `verification_pending` | Moderator+ |
| `requestInformation` | `under_review`, `enhanced_review`, `needs_information` | Moderator+ |
| `escalate` | `under_review`, `needs_information` | Moderator+ |
| `approve` | `under_review`, `needs_information`, `enhanced_review` | Admin+ |
| `reject` | `under_review`, `needs_information`, `enhanced_review` | Admin+ |
| `suspend` | `approved` | Admin+ |
| `unsuspend` | `suspended` | Admin+ |
| `revoke` | `approved`, `suspended` | SuperAdmin only |
| `expire` | `approved` | system/policy |

Every action:
- Validates the transition with `isValidTransition`.
- Requires `reason` where specified; throws `422 REASON_REQUIRED` if absent.
- Writes a `VerificationTransition` record (immutable).
- Calls `logAudit` via the existing `auditService`.
- No client-authoritative approval — all decisions are server-side.

---

## 8. Review Authority

The mapping to existing `rbac.js` roles:

| Role | New permissions | Actions |
|---|---|---|
| Moderator | `verification:read`, `verification:review` | inspect queue, begin review, request info, escalate, accept/reject evidence |
| Admin | all above + `verification:approve` | approve, reject, suspend, unsuspend |
| SuperAdmin | all above + `verification:revoke` | revoke (permanent), risk override |

`VERIFICATION_REVOKE` is in the super-only exclusion list in both server and
client RBAC. It is double-checked in the controller (`hasPermission` call) as
defense-in-depth beyond the route-level `requirePermission` guard.

---

## 9. Restricted Capability Gate

`canExercisePrivilegedCapability(status)` returns `true` only for `approved`.

`verificationService.canPerformPrivilegedAction(organizationId)` is the async
version for service-layer callers.

Future missions (Agent Portal, Institution Portal, marketplace posts) MUST call
this gate before granting any privileged operation. The gate is defined in one
place (`shared/international/verification.js`) and is not duplicated.

**Employer backward compatibility:** Existing employers continue to work via the
existing `Employer` model and authorization. The capability gate is NOT
retroactively applied to employers in this mission. A controlled migration is
deferred and explicitly documented in §15 below.

---

## 10. SLA Target Semantics

`SLA_TARGET_BUSINESS_HOURS = 48`

`computeSlaDeadline(submittedAt)` adds 48 raw hours. A full business-calendar
engine (timezone-aware, holiday-aware) is deferred. The deadline is tracked for
SLA measurement; it does NOT trigger automatic approval.

`isSlaBreached(slaDeadlineAt)` returns `true` when `now > deadline`. Shown in
the Admin queue UI as "BREACHED" for operator attention.

---

## 11. Risk Foundation

### Risk levels: `low`, `medium`, `high`, `critical`

### Risk signals:
`domain_mismatch`, `location_mismatch`, `identity_mismatch`, `expired_credential`,
`duplicate_organization`, `suspicious_claim`

`recordRiskSignal(organizationId, signal, detail, actor)`:
- Appends signal to `riskSignals` array.
- Escalates `riskLevel` based on signal count and type.
- Auto-escalates `under_review → enhanced_review` when `requiresEnhancedReview(riskLevel)`.
- Writes audit log.

`requiresEnhancedReview(riskLevel)` returns `true` for `high` and `critical`.

No external fraud-provider integrations in this mission.

---

## 12. Admin Verification Queue

### API: `GET /api/admin/verification/queue`

Filters: `status`, `organizationType`, `countryCode`, `riskLevel`, `page`, `limit`.

Default queue shows: `verification_pending`, `under_review`, `needs_information`,
`enhanced_review` (all active review states).

Sort order: `riskLevel DESC`, `slaDeadlineAt ASC`, `submittedAt ASC`
(highest risk + oldest SLA-at-risk first).

Response includes populated `organizationId` (displayName, type, country, slug)
and `currentReviewerId`.

### UI: `AdminVerificationQueue.jsx`

- Status, type, risk, country filters.
- SLA breach indicator (red "BREACHED" badge).
- Per-row "Review" button opens a slide-over detail panel.
- Detail panel: profile summary, evidence list with accept/reject, action buttons
  (role-gated), reason input, transition history (last 10 entries).
- Nav: added under "users/moderation" group as `verificationQueue` requiring
  `VERIFICATION_READ`.

---

## 13. Organization Status View

### API: `GET /api/organizations/:organizationId/verification`

Safe projection for the organization side (no reviewer internals exposed):

```json
{
  "status": "needs_information",
  "submittedAt": "...",
  "informationRequestReason": "Please provide registration certificate",
  "rejectionReason": "",
  "earnedBadges": [],
  "verifiedAt": null,
  "nextReviewAt": null,
  "evidence": [
    { "_id": "...", "evidenceType": "business_registration", "status": "pending", "submittedAt": "..." }
  ]
}
```

### Additional endpoints:
- `POST /api/organizations/:organizationId/verification/submit` — submit profile
- `POST /api/organizations/:organizationId/verification/evidence` — add evidence
- `POST /api/organizations/:organizationId/verification/respond` — respond to info request
- `GET /api/organizations/:organizationId/verification/credential-policy` — policy hint

**Ownership enforcement:** `assertOwnership` in the controller verifies that an
employer token's `employerId` links to the requested `organizationId` via
`legacyEmployerId`. Admin tokens bypass. Future org realm tokens will be added
when that auth realm lands.

---

## 14. Security & Privacy

- Evidence `safeMetadata` validated against `FORBIDDEN_METADATA_KEY_PATTERNS`
  before persistence (password, token, card, secret, document_content, etc.).
- Evidence `evidenceRef` is an opaque storage pointer — raw document content
  is never stored in this model.
- Organization-side API returns a safe projection (no `currentReviewerId`,
  `riskSignals`, reviewer notes exposed to org).
- Cross-organization isolation: all evidence queries use `{ organizationId, _id }`.
- Audit metadata is validated for forbidden keys before `logAudit` writes.
- Suspension/revocation immediately clears `earnedBadges` — no stale badge display.

---

## 15. Employer Compatibility

**Employer Release Baseline is fully preserved.**

| Constraint | Disposition |
|---|---|
| Existing employers continue to work | ✓ No changes to `Employer` model |
| Employer B1–B5B behavior | ✓ Untouched |
| No automatic live migration | ✓ No employer migrated into `Organization` |
| No slug backfill | ✓ Not executed |
| No destructive migration | ✓ Not executed |
| No existing posting lockout | ✓ Capability gate NOT applied to employers yet |
| Existing `verified`/`verificationLevel` fields | ✓ Preserved as interim representation |

**Future migration strategy (deferred):**
1. For each legacy employer (when Employer is ready to be migrated):
   a. Create or link an `Organization` record (`legacyEmployerId`).
   b. Create an `OrganizationVerification` with `status = approved` if previously verified.
   c. Move to `status = draft` if not verified.
2. Migration is explicit, dry-runnable, idempotent, and never auto-runs.
3. Employers keep all existing functionality until the capability gate is
   explicitly enabled for the `employer` organization type in a future mission.

---

## 16. Future Mission Integration

| Future mission | Integration point |
|---|---|
| Mission 3 — Student Profile | No dependency on Trust |
| Mission 11 — Agent Portal | Reuse `organizationVerificationRouter`, `verificationService`, capability gate |
| Mission 18 — Institution Portal | Same as Agent Portal; accreditation evidence type already supported |
| Mission 21 — Admin Super-Control | Extends `AdminVerificationQueue` with full analytics, bulk actions |
| Mission 23 — Abuse Hardening | Adds external fraud signal integrations to `recordRiskSignal` |
| Mission 5 — Source Verification | Adds freshness automation to evidence records |

---

## 17. Files Created / Modified

### New files
| Path | Purpose |
|---|---|
| `shared/international/verification.js` | Shared contract: state machine, evidence types, badges, risk, credential policy, SLA, capability gate |
| `server/src/models/OrganizationVerification.js` | Per-org verification lifecycle + profile |
| `server/src/models/VerificationEvidence.js` | Individual evidence records |
| `server/src/models/VerificationTransition.js` | Immutable state-transition history |
| `server/src/services/verificationService.js` | Core verification lifecycle service |
| `server/src/services/credentialPolicyService.js` | Jurisdiction-aware credential policy |
| `server/src/controllers/admin/adminVerificationController.js` | Admin queue + review actions |
| `server/src/controllers/organization/organizationVerificationController.js` | Org-side status + submission |
| `server/src/routes/adminVerification.js` | Admin sub-router (wired into `/api/admin/verification`) |
| `server/src/routes/organizationVerification.js` | Org routes (wired into `/api/organizations`) |
| `client/src/pages/Admin/AdminVerificationQueue.jsx` | Admin verification queue + review UI |
| `server/src/__tests__/organizationVerificationFoundation.test.js` | 17 contract tests (all green) |

### Modified files
| Path | Change |
|---|---|
| `shared/international/index.js` | Added `export * from './verification.js'` |
| `server/src/config/rbac.js` | Added `VERIFICATION_READ/REVIEW/APPROVE/REVOKE` permissions; wired into Moderator/Admin/SuperAdmin roles |
| `client/src/config/rbac.js` | Client mirror of above |
| `client/src/config/adminNavConfig.js` | Added `verificationQueue` nav item |
| `server/src/routes/admin.js` | Mounted `adminVerificationRouter` at `/verification` |
| `server/src/routes/index.js` | Exported `organizationVerificationRouter` |
| `server/src/index.js` | Mounted `organizationVerificationRouter` at `/api/organizations` |
| `client/src/routes/index.jsx` | Added `AdminVerificationQueue` lazy route at `verification-queue` |

---

## 18. Migrations / Backfills NOT Executed

- No employer migrated into Organization.
- No verification record auto-created for existing employers.
- No slug backfill.
- No badge back-derivation for legacy data.
- All indexes are additive and created on new collections only.

Live migrations/backfills: **No**

---

## 19. Tests

| # | Behavior | Result |
|---|---|---|
| 1 | Verification state transitions — valid paths | ✓ |
| 2 | Invalid transition rejection | ✓ |
| 3 | Complete vs incomplete submission | ✓ |
| 4 | Evidence ownership (isolation contract) | ✓ |
| 5 | Admin authorization — status constants | ✓ |
| 6 | Cross-organization isolation (evidence status set) | ✓ |
| 7 | Badge derivation from accepted evidence | ✓ |
| 8 | Expired/revoked evidence removes badge | ✓ |
| 9 | Required/optional/not_applicable credential policy | ✓ |
| 10 | Risk escalation + requiresEnhancedReview | ✓ |
| 11 | SLA metadata: computeSlaDeadline + isSlaBreached | ✓ |
| 12 | Restricted-capability guard | ✓ |
| 13 | Approval unlocks capability gate (isApproved/isActive) | ✓ |
| 14 | Suspension/revocation blocks capability gate | ✓ |
| 15 | Safe audit metadata (forbidden key detection) | ✓ |
| 16 | Employer compatibility | ✓ |
| Bonus | Rollout table validation for credential policy | ✓ |

**17/17 tests green.**

Mission 1 regression (13 checks): **green.**
Employer auth realm isolation: **green.**
Free-beta publishing policy: **green.**
Frontend production build: **green (9.80s).**
