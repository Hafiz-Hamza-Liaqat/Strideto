# STRIDETO PHASE 17D-8B2C-PRE
CASE FILING AUTHORIZATION
OWNER ARCHITECTURE DECISION LOCK

**PHASE:** 17D-8B2C-PRE

**TYPE:** OWNER ARCHITECTURE DECISION LOCK

**STATUS:** COMPLETE

**17D-8B2C / 17D-9A ENGINEERING:** AUTHORIZED (this lock)

**PRODUCTION LEGAL WORDING:** LEGAL REVIEW REQUIRED / UNAVAILABLE

**PRODUCTION WYOMING PACK:** DRAFT / NOT ACTIVE

**PRODUCTION FILING AUTHORIZATION:** DISABLED

**GOVERNMENT FILING:** NOT LIVE

**HSI:** OFF / NOT REQUIRED FOR THIS PHASE

**LEGAL COUNSEL STATUS:** NOT PROVIDED BY THIS DOCUMENT

This document is **product / owner architecture authority**.

It is **not** legal counsel, production legal-text approval, Wyoming pack activation, statutory e-signature, registered-agent legal authority, Provider organizer authority, government filing authorization, or Phase 18.

No production legal wording, pack activation, government credential, WyoBiz automation, or live Wyoming filing is authorized by this lock.

---

## 1. Baseline record

Decision-lock baseline HEAD: `a7c9fda386a8a45c51fe7d29f83c960fa990d5d1`

`docs(release): finalize phase 17d-8b2b acceptance and closure`

| Item | Status |
| --- | --- |
| 17D-3R | CLOSED |
| 17D-4 | CLOSED |
| 17D-5 | CLOSED |
| 17D-6 | CLOSED |
| 17D-7 | CLOSED |
| 17D-8A | CLOSED |
| 17D-8B1 | CLOSED |
| 17D-8B2-PRE | CLOSED |
| 17D-8B2A | CLOSED |
| 17D-8B2B-PRE | CLOSED |
| 17D-8B2B | CLOSED |
| 17D-8B2C | ENGINEERING AUTHORIZED / PRODUCTION DISABLED |
| 17D-8C | ENGINEERING FOUNDATION AUTHORIZED / LIVE FILING NOT ACTIVE |
| Phase 18 | NOT STARTED |
| Wyoming pack `gbs.requirement_pack.US-WY.LLC` | activationStatus=draft / reviewStatus=draft |
| HSI production | OFF / NOT READY |
| Marketplace | OFF |
| Existing Worker | STOPPED |

Architectural **selections** in this document are not production **PASS** and are not pack activation.

---

## 2. Dedicated CaseFilingAuthorization: SELECTED

**Dedicated `CaseFilingAuthorization` collection: SELECTED.**

**ConsentGrant reuse: NO.**

Reasons ConsentGrant is not reused:

- purposes are employer_application, agent_consultation, agent_case, institution_admission, vault_grant — no filing purpose
- ConsentGrant is fail-soft (`finishQuietly`)
- ConsentGrant lacks pack / legal-text / Provider-subject binding required for high-assurance filing evidence

CaseFilingAuthorization is high-assurance evidence. Ordinary fail-soft `logAudit` is not sufficient. Grant, revoke, invalidation, claim, and external-filing attestation use fail-closed `AuditLog.create` with rollback of the high-assurance mutation when audit persistence fails.

Do not extend ConsentGrant in this phase or later merely for convenience.

---

## 3. Concept separation (hard laws)

Do not merge these concepts in model, service, DTO, UI, copy, audit, or status:

| Concept | Is not |
| --- | --- |
| Quote acceptance | CaseFilingAuthorization |
| RA written consent (`ra_written_consent`) | CaseFilingAuthorization |
| CaseFilingAuthorization | Wyoming statutory signature |
| CaseFilingAuthorization | registered-agent signature |
| CaseFilingAuthorization | Provider legal organizer authority |
| CaseFilingAuthorization | government filing |
| CaseFilingAuthorization | government acceptance |
| External submission attestation | government acceptance |

`ready_for_submission` remains the 17D-8A internal preparation milestone. It is **not** government-ready.

Derived filing truth is separate, for example:

- `requirementsReady` (B2B pack facts/checks/RA)
- `filingAuthorizationAvailable`
- `filingAuthorizationActive`
- `authorizedForExternalFiling`
- `externalSubmissionEligible`
- `externalSubmissionState`

---

## 4. Exact Customer grantor

Grantor: authenticated User whose id equals `GbsCase.requesterUserId`.

New grant requires:

- authenticated
- `requireNonStaffUser`
- exact Case owner
- **active `business_client`**
- attached Case `requirementPackSnapshot`
- production pack active+reviewed according to the authoritative registry (Wyoming remains draft)
- approved applicable legal text
- exact Provider subject currently attached and currently authorized

Provider cannot grant. Staff/Admin cannot grant. Agency Owner/Admin cannot grant customer authorization.

No proxy architecture exists. `actingFor` is intake metadata only and is **not** legal proxy.

---

## 5. Accepted security decision — business_client loss

**LOCKED for 17D-9A:**

After `business_client` loss:

- **New authorization grant: DENIED.**
- Authenticated Case owner **MAY revoke** an already-active authorization.

Requirements for that revocation exception:

- must still be authenticated
- must still be exact `GbsCase.requesterUserId`
- may revoke **ONLY** existing authorization on own Case
- cannot create/grant new authorization
- cannot mutate Case facts through this exception

Purpose: avoid stranded live authorization. This is a narrow security revocation exception. It grants no other Case mutation authority.

---

## 6. Exact Provider subject

Authorization binds to:

- `GbsCase.providerSubjectType`
- `GbsCase.providerSubjectId`

Independent Provider: `agent` / AgentAccount.

Agency Provider: `organization` / Organization.

An individual team member performing an operation is **actor metadata**. Authorization belongs to the exact Provider subject attached to the Case.

If Case Provider subject ever changes:

- old authorization: **INVALID FOR FUTURE USE**
- preferred status: `invalidated`
- reason: `provider_changed`
- no transfer
- new Provider requires a new customer authorization

Current product has **no Provider reassign command**. Do not implement reassign merely for testing. Tests may mutate at service/model level only.

Provider authority loss (capability, domain, listing eligibility, exact subject authority, `business_services.cases.manage` as relevant) is **not** overridden by a historical grant. Future filing eligibility: **FALSE**. Historical grant preserved.

---

## 7. Pack and source binding

Authorization requires an attached Case `requirementPackSnapshot`.

Bind exact:

- `packId`
- `packVersion`
- `sourceSetId`
- `sourceSnapshotHash`
- capability / jurisdiction / entity type

No live registry authority after grant.

Any `packVersion` change: old authorization not valid for future filing. No fuzzy materiality classifier. New grant required. Historical row retained.

`sourceSnapshotHash` mismatch: future filing eligibility false. No silent catalog drift.

**Production Wyoming pack remains draft/draft.** Do not activate, mark reviewed, add env override, add Admin activation route, add DB override, or add query override.

Therefore a normal production Case cannot grant Wyoming authorization.

Expected normal production availability:

```
available=false
reason=requirement_pack_not_active
```

If an active synthetic snapshot exists but production legal text remains draft:

```
available=false
reason=legal_text_not_approved
```

No authorization row is created merely by page load.

---

## 8. Legal-text registry

Implement a backend/shared source-controlled legal-text registry. The frontend is **not** authoritative.

Entries support at minimum:

- `legalTextId`
- `legalTextVersion`
- `legalTextHash`
- `status`
- applicable scope / capability / jurisdiction / entity as needed
- `applicableFrom`
- review metadata
- `schemaVersion`

Statuses: `draft` | `under_review` | `approved` | `superseded` | `withdrawn` (or exact repo-native equivalents).

Usable for **new** authorization only if `approved` and applicable.

Hash: deterministic SHA-256 over the exact legal-text artifact using the existing catalog canonicalization family. Do not hash customer facts, Case data, or remote mutable HTML.

Authorization stores `legalTextId`, `legalTextVersion`, `legalTextHash`.

Client POST grant echoes version/hash for stale-view protection. Server resolves the authoritative current eligible text. Mismatch: **409** `filing_authorization_text_changed`. Customer must reload/redisplay. Never silently authorize v2 from a v1 screen.

**Production legal wording: LEGAL REVIEW REQUIRED / UNAVAILABLE.**

Do not write or invent production legal authorization wording. Do not fake a lawyer, approval, or legal ticket.

Production registry may contain a metadata-only draft placeholder or an intentionally unusable draft test-neutral artifact if required structurally. Status: draft / unapproved. Normal production availability: false.

Tests may inject synthetic **approved** legal text through **internal dependency injection only**.

No HTTP parameter, env var, DB row, or Admin route can approve legal text. No production build may silently substitute test text.

---

## 9. Existing-grant effect after legal-text superession/withdrawal

**EFFECT ON EXISTING ACTIVE GRANTS AFTER LEGAL-TEXT SUPERSESSION/WITHDRAWAL: LEGAL / PRODUCT POLICY REQUIRED.**

Do not invent production law. Architecture must support future policy. Synthetic tests may choose explicit controlled behavior. Production availability remains OFF.

---

## 10. Purpose, states, uniqueness

v1 purpose: `gbs.case_filing_authorization.initial_formation`

Meaning: authorize the exact Provider subject for the exact Case to use the Case information for the described initial external formation filing under the exact jurisdiction / entity / pack snapshot.

Not: general POA, unlimited filings, annual reports, amendments, resubmissions, or government credential delegation.

Bounded states (not government status):

- `active`
- `revoked`
- `invalidated`
- `claimed_for_submission`
- `used`
- `superseded`

Do not use ambiguous `success` / `approved` / `complete`.

`claimed_for_submission` / `used` are internal filing-use states, **not** government status.

Hard invariant: at most **one currently effective** filing authorization for exact Case + Provider subject + pack snapshot + purpose.

Identical replay converges. Different legal text requires a new grant.

Partial unique index may enforce safety. Still use idempotency + CAS.

Public reference: opaque `publicAuthorizationRef`. Do not expose Mongo ObjectId as the public authority token. No sequential references.

Once granted, immutable fields include customer, Provider subject, Case, capability, jurisdiction, entity type, pack identity, source snapshot, legal-text identity, purpose, and scope. Later change means revoke / invalidate / supersede / new grant.

Optional `expiresAt` is supported. Production: **UNSET / POLICY REQUIRED**. Do not default 30 days, 90 days, or forever.

Retention classification mechanic: `filing_consent`. Production retention duration: **POLICY REQUIRED**. No hard-delete on revoke. No guessed TTL.

---

## 11. Feature flags

If flags are used:

- `GBS_FILING_AUTHORIZATION_ENABLED`
- `GBS_EXTERNAL_FILING_ATTESTATION_ENABLED`

Default: **OFF**.

A flag may **disable** only.

A flag can **never**:

- make the draft Wyoming pack active
- approve legal text
- create Provider authority
- bypass Case ownership or `business_client` for new grants

---

## 12. 8C foundation — Provider-attested manual external filing

v1 engineering model: Provider manually uses the external Wyoming SOS process **outside STRIDETO**. STRIDETO may later record that the Provider attests the external filing was performed.

No portal automation, WyoBiz login, password, OTP, MFA, browser automation, government API, or government session cookie.

Dedicated high-assurance submission provenance (for example `GbsExternalFilingSubmission`).

Allowed engineering states may include `prepared`, `authorization_claimed`, `submitted_externally`.

**Do not** create `government_processing`, `government_approved`, `registered`, `company_formed`, `government_rejected`, or `certificate_issued`.

`submitted_externally` means only: the exact authorized Provider attested that it performed the external filing action. It does **not** mean Wyoming accepted it, processed it, or that a company exists.

Claim is a one-time Mongo atomic CAS transition. Claim is **not** submission. Concurrent customer revoke vs Provider claim: exactly one winner.

v1 supports **one** initial formation filing action per exact Case authorization. Resubmission / retry after government rejection: **LEGAL / PRODUCT POLICY REQUIRED**. No generic resubmit UI.

Provider attestation copy must remain neutral: external filing was performed. It must **not** assert “I legally signed as organizer” unless product/legal approval later authorizes that representation.

Do **not** automatically mark the Case `completed` merely because Provider attests submission. Government outcome is not known.

---

## 13. Unresolved gates (remain open)

| Gate | Status |
| --- | --- |
| Production filing-authorization wording | LEGAL REVIEW REQUIRED |
| Expiry default | POLICY REQUIRED |
| Existing-grant legal-text superession/withdrawal | POLICY REQUIRED |
| Resubmission / retry | POLICY REQUIRED |
| Provider organizer / W.S. 17-29-203(b) signing authority | LEGAL / PRODUCT DECISION REQUIRED |
| Whether CaseFilingAuthorization is legally sufficient | LEGAL REVIEW REQUIRED |
| Filing-consent retention duration | POLICY REQUIRED |
| Wyoming pack activation | NOT AUTHORIZED |
| Government outcome model | NOT IN THIS PHASE |
| Statutory signature / e-sign | NOT IN THIS PHASE |

---

## 14. Engineering vs production

| Track | Decision |
| --- | --- |
| Dedicated CaseFilingAuthorization | SELECTED |
| ConsentGrant reuse | NO |
| Engineering implementation | AUTHORIZED |
| Production legal wording | LEGAL REVIEW REQUIRED / UNAVAILABLE |
| Production Wyoming pack | DRAFT / NOT ACTIVE |
| Production filing authorization | DISABLED |
| Government filing | NOT LIVE |
| HSI | OFF / NOT REQUIRED |
| Phase 18 | NOT STARTED |

17D-8B2C / merged 17D-9A may implement and prove the disabled production path plus synthetic DI acceptance.

This lock does **not** authorize pack activation, legal-text approval, production grant availability, live Wyoming filing, HSI enablement, Worker start, push, or deploy.
