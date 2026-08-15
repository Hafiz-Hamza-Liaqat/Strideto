# STRIDETO PHASE 17D-8B1
SECURE GBS CASE DOCUMENT INFRASTRUCTURE

**PHASE 17D-8B1: FORMALLY CLOSED**

**SECURE GBS CASE DOCUMENT INFRASTRUCTURE: PASS**

**FINAL AUTHENTICATED VISUAL ACCEPTANCE: PASS**

**FAIL-CLOSED SECURITY ACCEPTANCE: PASS**

**KNOWN 17D-8B1 IMPLEMENTATION BLOCKERS: NONE**

**PHASE BOUNDARY: SECURE INFRASTRUCTURE / FAIL-CLOSED**

**VAULT REUSE: PASS**

**SECOND BLOB STORE: NO**

**GBS REQUIREMENT MODEL: PASS**

**GBS GRANT MODEL: PASS**

**CASE-DERIVED AUTHORITY: PASS**

**case_documents.manage: PASS**

**OWNER/ADMIN IMPLICIT DOCUMENT AUTHORITY: DENIED**

**SCANNER: NOT_CONFIGURED**

**PROVIDER BYTE ACCESS LIVE: DISABLED / FAIL-CLOSED**

**PROVIDER REVIEW LIVE: DISABLED / FAIL-CLOSED**

**HSI: BLOCKED / NOT IMPLEMENTED**

**KMS: NOT IMPLEMENTED**

**JURISDICTION FILING PACKS: SOURCE MISSING / NOT IMPLEMENTED**

**FILING CONSENT: NOT IMPLEMENTED**

**STATUTORY E-SIGNATURE: NOT IMPLEMENTED**

**GOVERNMENT SUBMISSION: NOT IMPLEMENTED**

**AUTHORITY REFERENCE: NOT IMPLEMENTED**

**GOVERNMENT OUTCOME: NOT IMPLEMENTED**

**MARKETPLACE: OFF**

**WORKER: STOPPED**

**RETENTION: UNRESOLVED**

**17D-8B2: NOT STARTED**

**17D-8C: NOT STARTED**

**PHASE 18: NOT STARTED**

---

## 1. Baseline HEAD

Starting HEAD: `e5c8acd1abfa55969ece57cde1cc4956705f98b3`

`docs(release): record phase 17d-8a case readiness`

17D-8A: CLOSED / PASS.

Audited implementation + initial docs HEAD: `3855fb52c06f6a46f43c7e3cc8fc4b05e679bdd3`

`docs(release): record phase 17d-8b1 document infrastructure readiness`

That commit remains the application/test/security implementation baseline. This document’s docs-only sign-off commit is the final formal 17D-8B1 HEAD.

Protected WIP left untouched:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`
- `docker-compose.appenv-align.yml`
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

Stash `stash@{0}: On main: wip: AdminTableFilters values wiring (pre-phase-10)` untouched.

No push. No deploy. Worker remained stopped.

---

## 2. Phase boundary

8B1 does not make STRIDETO filing-capable.

Guaranteed product truth remains:

`GbsCase` → Preparation → Customer actions → Ready for Submission → **STOP**

8B1 adds fail-closed document infrastructure under that boundary. No submitted-to-authority, authority processing, registered, approved, or rejected-by-authority states.

Success means the infrastructure fails closed correctly, not that documents appear operational despite missing security dependencies.

---

## 3. Vault reuse

Bytes remain in `VaultDocument` / `VaultDocumentVersion` via `vaultUploadFile` / `vaultRetrieveFile`.

No second blob store. `GbsCase` does not store document bytes. `GbsCase` owns pack snapshot fields only (`documentPackId`, `documentPackVersion`, `documentConsentRequired`). Requirements and grants are separate collections.

GBS Cloudinary keys use `gbs-cases/<opaque hex>/...`. Local fallback keys are server-generated opaque filenames. GBS storage keys are **OPAQUE**. No `userId`, email, or name in the GBS object key. Client cannot supply bucket/path.

This is **not** HSI-ready storage. KMS/envelope encryption is **NOT IMPLEMENTED**.

---

## 4. Requirement ≠ document

`GbsCaseDocumentRequirement` exists independently of an upload. There is no generic “upload anything” product.

Production/default pack: `gbs.case_documents.empty` — **no legal filing requirements**. `company_formation` and `generic_professional_service` received **no** invented passport/CNIC/proof-of-address/UBO packs.

Tests may snapshot synthetic `gbs.case_documents.test_low_risk_v1` (TEST ONLY). That factory is forbidden when `NODE_ENV === 'production'`.

Requirements are versioned snapshots. New Cases persist the empty pack. Existing 17D-8A Cases were **not** mass-rewritten (`updateMany` was not used).

---

## 5. Sensitivity and file policy

B1 infrastructure supports only LOW / `business_confidential` (MODERATE).

Server rejects HSI requirement/upload/reference with `hsi_documents_not_configured`. Categories including passport, CNIC/national ID, KYC proof of address, signature, tax-id, and UBO identity are denied. Client bodies cannot override sensitivity.

Default allowlist: PDF, JPEG, PNG. Magic-byte sniff required. MIME mismatch rejected. SVG, HTML, JS, ZIP/archive, and executables rejected. DOCX is **not** default allowed. Ceiling **20 MB** (Vault ceiling not raised). Per-Case quota: **8** active files and **40 MB**.

---

## 6. Authority and grants

GBS document HTTP is Case-scoped under Business Client and Provider products. It is **not** attached to `/api/vault/*`.

Customer: ordinary non-staff User who owns the Case. Other User: generic 404. After `business_client` loss, history remains readable; new upload/replace is DENIED.

Provider byte access / review / waive requires explicit `business_services.case_documents.manage`. `cases.manage` and `quotes.manage` are not enough. Education domain cannot authorize.

Owner/Admin **do not** inherit document duty from role. `EXPLICIT_ASSIGNMENT_PERMISSIONS` excludes `case_documents.manage` from Owner/Admin catalog inheritance and from `defaultPermissionsForInvite`. Agency Team invite has an optional unchecked “Grant Case document review duty” control. Explicit duty does not mint `ProviderCapability`.

Independent Provider: exact Agent subject + active Business enrollment + current professional authority (Independent-equivalent; no membership row).

`GbsCaseDocumentGrant` binds Case + requirement + named Vault version + exact grantee subject. No “all Agency members” grant. Ownership stays with the customer Vault owner. Provider is never co-owner.

Capability, domain, or listing-moderation loss: Case metadata may remain readable; Provider byte access and review are DENIED; filing readiness is false. Customer still owns historical objects.

---

## 7. Scanner and review

Production scanner remains **NOT_CONFIGURED**. `runSecurityScan` is unused. No ClamAV/VirusTotal/Cloudinary-moderation vendor. No fake production CLEAN. Filename/MIME sniff is not malware CLEAN.

**Option A (chosen):** if scanner is not configured, upload is denied with `case_document_security_not_configured` **before storage**. Unusable quarantine files are not accumulated.

Test-only injection: `setGbsCaseDocumentTestScanner` is refused when `NODE_ENV === 'production'`. No environment variable can mint production CLEAN.

Provider access/review requires exact `scanStatus === 'clean'`. Pending, failed, rejected/quarantined, and `not_configured` DENY. The owner-style `scanStatus !== 'rejected'` rule is not used for Provider share.

Review means **accepted for this Case requirement only**. Vault `verificationStatus` is not mutated to verified. No identity/government/KYC claim.

Replacement creates a new Vault version; the previous version is superseded. Review binds the named version (CAS + `activeVaultVersionId` + `scanStatus: 'clean'`). After Provider acceptance, customer replace is locked (`accepted_document_locked`). If replacement wins first, stale review cannot satisfy the new version.

Cancelled/unable-to-proceed Cases reject new upload/replace/review/waiver. Filing readiness is false.

Authenticated proxy streams bytes after Case + grant + scan checks. `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Content-Disposition: attachment`. No 8B1 preview product. No long-lived public URL.

---

## 8. Filing readiness

Authoritative helper: `evaluateCaseFilingReadiness` / `evaluateCaseFilingReadinessForRecord`.

A required requirement is satisfied only when the current version is `clean`, Provider review is accepted if `reviewRequired`, and the requirement is not rejected/replacement-needed. Waiver requires snapshotted `waivable=true`, allowlisted reason, document duty, CAS, and audit. Waiver cannot bypass scanner policy, HSI prohibition, or a future consent gate.

Empty pack + `documentConsentRequired=false` preserves 17D-8A `ready_for_submission`.

Nonempty unsatisfied pack blocks `ready_for_submission` (`document_requirements_unsatisfied`).

`consentRequired=true` without implemented `CaseFilingAuthorization` fails closed (`filing_consent_pending`). Consent is **not** hardcoded true. Marketplace flag is **not** part of document readiness.

---

## 9. HTTP, origin, limits, audit

Customer: `GET/POST /api/business/cases/:caseRef/document-requirements...`

Provider: `GET/POST /api/agent/business-services/cases/:caseRef/document-requirements...`

Mutations: `secureTrustedOrigin`. Limiters: `gbsCaseDocumentWriteLimiter`, `gbsCaseDocumentUploadLimiter`, `gbsCaseDocumentAccessLimiter`. Idempotency commands: `gbs.case_document.initialize_upload|complete_upload|review|reject|supersede|waive`.

Audit events implemented for the actions that exist. Redaction drops `storageKey`, `signedUrl`, `originalFilename`, `filename`, `displayName`. No HSI body. No object key in logs. No document notifications (production upload is not operational; Worker STOPPED).

Critical indexes are create-only. `autoIndex` remains OFF. No `syncIndexes`. No `MONGO_AUTO_INDEX=1`.

No Admin document console.

---

## 10. Tests

Focused:

- `phase17d8b1SourceContract.test.js` — 74 assertions passed
- `phase17d8b1BuyerUi.test.js` — 7 assertions passed
- `phase17d8b1ProviderUi.test.js` — 6 assertions passed
- `phase17d8b1CaseDocument.mongo.test.js` — PASS (`strideto_17d8b1_integrity_run1`)
- `phase17d8b1LiveIndexIdempotency.mongo.test.js` — PASS (`autoIndex=false`, create-only)

Regressions:

- 17D-8A source/UI/mongo/live-index — PASS
- 17D-7 source + quote mongo — PASS
- 17D-3R source + domains mongo — PASS
- Mission 10 `vaultDocumentVault.test.js` — 32 passed

Education `professionalCaseManagement.test.js` (`requireUserAuth` vs `studentProductAuth`) was not fixed (pre-existing, out of scope).

---

## 11. Live fail-closed acceptance

Rebuilt only `api-a`, `api-b`, `frontend` with `--no-deps`. Did not recreate mongodb, redis, or mailpit. Worker not started.

Disposable Case `DTPXRd-9BOY7PcNoAifZT_a_` (historical 17D-8A Case, empty pack):

- Customer list: 200, `security.mode=not_configured`, upload disabled, items `[]`
- Other customer: 404
- Customer `upload/init` and `upload/complete`: **403** `case_document_security_not_configured` (Option A, before storage)
- Independent Provider list: 200, scanner not configured, no download/review affordance
- Independent Provider file: **403** `case_document_security_not_configured`
- Agency Owner without stored document duty: **403** `provider_domain_access_denied`
- VIEW member: **403** `provider_domain_access_denied`
- `requests.manage` member: **403** `provider_domain_access_denied`

No unexpected 5xx on these routes. Controlled statuses: 200, 403, 404.

Final accepted runtime:

- frontend: healthy
- api-a: health/ready 200
- api-b: ready 200
- mongodb: healthy
- redis: healthy
- caddy: HTTPS root 200
- Marketplace: OFF — `GET /api/business-services/enabled` → `{"enabled":false}`; `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0`
- `MONGO_AUTO_INDEX`: unset
- Scanner: NOT_CONFIGURED (`VAULT_SCANNER_PROVIDER` unset)
- `NODE_ENV=production` on api-a/api-b
- `workerRunning=false`
- Worker: STOPPED
- Queue: `queuePending=136`, `effectiveState=queued_worker_stopped`

Queue was not drained. Queued work does not mean delivery occurred.

---

## 12. Final authenticated visual acceptance

**PASS.** Appearance **System** was explicitly selected in the account menu. Saved preference: `localStorage edurozgaar-theme=system`. It was not switched to Light or Dark to fake System proof.

System → OS Light: **PASS** (preference remained `system`, media query light, `html` class `light`; proven at 320 and 1440).

System → OS Dark: **PASS** (preference remained `system`, media query dark, `html` class `dark`; proven at 320 and 1440).

| Matrix | 320 | 375 | 768 | 1024 | 1440 |
| --- | --- | --- | --- | --- | --- |
| System | PASS | PASS | PASS | PASS | PASS |
| Light | PASS | PASS | PASS | PASS | PASS |
| Dark | PASS | PASS | PASS | PASS | PASS |
| Provider Dark | PASS | PASS | PASS | PASS | PASS |

Provider Light was represented at 320 / 768 / 1440 (contract minimum). Every required matrix point: `document.documentElement.scrollWidth <= clientWidth + 1`. Body overflow: **PASS**.

Customer document infrastructure UI: **PASS** — H3 Required documents, empty-pack state, file policy (PDF, JPEG, PNG, 20 MB), scanner/security-unavailable copy (“Secure document upload is not available in this environment.”), no enabled Upload in this live configuration, no HSI/passport/CNIC/KYC prompts, no filing-ready or security-cleared claim, no generic upload-anything product.

Provider document infrastructure UI: **PASS** — requirement metadata, scanner-unavailable copy (“Document security scanning is not configured.”), no Download while scanner NOT_CONFIGURED, no Accept for Case, no Mark verified, no Verify identity, no bypass controls, no government-verification semantics.

Provider sensitive-duty live visual: **NOT PROVEN FOR ALL AGENCY ROLE COMBINATIONS**. Independent Provider UI: **PASS**. Agency VIEW / `cases.manage` / Owner-without-explicit-document-duty were not re-screenshotted. Supporting security authority: **PASS** via service/Mongo tests. This is not a closure blocker.

Prohibited claims were not found on these surfaces: Identity verified, Government verified, KYC passed, Submitted to authority, Virus-free, KMS, Upload documents, Company registered.

Customer no-shell-blink: **PASS** — Business Overview → Cases → Case detail → Cases → Overview. Business shell remained mounted.

Provider no-shell-blink: **PASS** — Business Overview → Cases → Case → Quotes → Overview. Agent Portal / current subject shell remained mounted.

Browser-verifiable accessibility: **PASS** — semantic headings including Required documents, status visible as text, unavailable reason visible, real buttons/links, plain-text content, Skip-to-content real `#main-content` link, no raw HTML injection. Keyboard/focus: **PASS** for the browser-verifiable evidence collected (Skip to content received focus; document UI uses real `<a>` / `<button>`). Not every subsequent focus state was visually captured.

Native 200%: **NOT PROVEN / USER MANUAL**

Screen reader: **NOT PROVEN / USER MANUAL**

---

## 13. Final visual-window security error states

`VAULT_SCANNER_PROVIDER` unset. Test scanner was **not** injected into live runtime. No fake CLEAN state.

- Unknown Case: **404** `not_found`
- Other customer: **404** `not_found`
- Customer `upload/init`: **403** `case_document_security_not_configured`
- Provider file access: **403** `case_document_security_not_configured`
- Provider wrong subject: **404** `provider_subject_context_denied`
- Provider review without `expectedVersion`: **400** `expected_version_required`

No stack traces. No PII leakage. Unexpected GBS document 5xx: **NONE**.

---

## 14. Static quality

- Touched ESLint: PASS (AgentTeam pre-existing `react-hooks/exhaustive-deps` warning only)
- `node --check` on new/edited modules: PASS
- `scripts/verify-module-link-integrity.mjs`: PASS (1975 modules, 6632 relative imports)
- Frontend production build: PASS
- No package install. No dependency upgrades.

`server/vault-storage/` is gitignored so local Vault fallback blobs from tests are not committed.

---

## 15. Intentionally not implemented

HSI, KMS, production scanner vendor, jurisdiction legal packs, filing consent legal text, e-signature, government API/submission/outcome, payment, messaging, Mailroom, My Businesses, Admin document console, Phase 17D-8B2, Phase 17D-8C, Phase 18.

GBS Case evidence retention policy: **UNRESOLVED**. No TTL purge jobs. No indefinite-retention legal claim. No production HSI readiness claim.

---

## 16. Known non-blockers

These are intentionally outside 17D-8B1’s completion boundary:

- Native 200%: USER MANUAL
- Real screen reader: USER MANUAL
- Agency sensitive-duty visual: not fully re-proven live; service/Mongo access-control tests PASS
- Retention policy: UNRESOLVED
- Scanner production provider: NOT_CONFIGURED
- KMS: NOT IMPLEMENTED

---

# FINAL PHASE 17D-8B1 CLOSURE

Secure infrastructure: **PASS**

Fail-closed scanner policy: **PASS**

GBS document authorization: **PASS**

Explicit document duty: **PASS**

Owner/Admin sensitive-access isolation: **PASS**

Case-derived authority: **PASS**

Customer ownership: **PASS**

Independent/Agency/Education isolation: **PASS**

Requirement/version model: **PASS**

Document replacement: **PASS**

Filing-readiness gate: **PASS**

Runtime: **PASS**

Authenticated visual acceptance: **PASS**

System / Light / Dark: **PASS**

Responsive 320–1440: **PASS**

Browser accessibility: **PASS**

Marketplace: **OFF**

Worker: **STOPPED**

Known implementation blockers: **NONE**

Phase 17D-8B1: **CLOSED**

---

# DEFERRED / BLOCKED FUTURE ITEMS

17D-8B2: **NOT STARTED**

Real malware scanner: **NOT IMPLEMENTED**

HSI: **BLOCKED**

KMS/envelope encryption: **NOT IMPLEMENTED**

Jurisdiction filing packs: **SOURCE MISSING**

Filing consent: **NOT IMPLEMENTED**

Statutory e-sign: **NOT IMPLEMENTED**

Government submission: **NOT IMPLEMENTED**

Government outcomes: **NOT IMPLEMENTED**

17D-8C: **NOT STARTED**

Payment: **NOT_CONFIGURED**

Phase 18: **NOT STARTED**
