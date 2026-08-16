# STRIDETO PHASE 17D-8B2A
HSI SECURITY RUNTIME HARDENING

**PHASE 17D-8B2A ENGINEERING IMPLEMENTATION: PASS**

**PRODUCTION HSI ACTIVATION: NOT READY**

**HSI FEATURE DEFAULT: OFF**

**SCAN MODE: ASYNC**

**SCAN EXECUTOR: DEDICATED**

**EXISTING EMAIL/NOTIFICATION WORKER USED FOR SCANNING: NO**

**EXISTING WORKER: STOPPED**

**OFFICIAL CLAMAV CLAMD: PASS**

**REAL CLAMD INTEGRATION: PASS**

**MINIO PRIVATE ADAPTER: PASS**

**VAULT TRANSIT ADAPTER: PASS (TEST-ONLY DEV MODE LABELED; NOT PRODUCTION AUTH)**

**AES-256-GCM PER-VERSION ENVELOPE: PASS**

**CANONICAL AAD: PASS**

**PLAINTEXT HSI PERSISTED: NO**

**WYOMING PACK: NOT STARTED**

**FILING CONSENT: NOT STARTED**

**E-SIGNATURE: NOT STARTED**

**GOVERNMENT SUBMISSION: NOT STARTED**

**PAYMENT: NOT_CONFIGURED / UNCHANGED**

**CHAT / MAILROOM / MY BUSINESSES: NOT STARTED**

**17D-8B2B: NOT STARTED**

**17D-8B2C: NOT STARTED**

**17D-8C: NOT STARTED**

**PHASE 18: NOT STARTED**

---

## 1. Baseline

Starting HEAD: `4b6078b1f0bc849a9cef2d6a446d813f2b2201e2`

`docs(architecture): lock phase 17d-8b2 pre security decisions`

17D-7 / 17D-8A / 17D-8B1 / 17D-8B2-PRE: CLOSED. Predecessor architecture was not reopened.

Protected WIP left untouched:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`
- `docker-compose.appenv-align.yml`
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

Stash `{0}` untouched. No push. No deploy.

---

## 2. What B2A means

B2A success is **security infrastructure + synthetic integration proof + fail-closed runtime + HSI default OFF**.

B2A success is **not**:

- real HSI accepted
- production HSI launch-ready
- legal retention approved
- government filing available
- Wyoming pack activated

---

## 3. Engineering implementation

| Boundary | Implementation |
|---|---|
| Feature flag | `GBS_HSI_DOCUMENTS_ENABLED` default `0`. Committed examples OFF. Flag ON never bypasses readiness. |
| Capability gate | `isHsiDocumentCapabilityReady()` — enabled, scanner configured/healthy, executor healthy, MinIO configured/healthy, Transit configured/healthy, encryption policy, retention policy present (no guessed durations), audit ready. |
| Health | `GET /api/health/hsi`. Disabled → 200 `{enabled:false, ready:false, state:"disabled"}`. Enabled not ready → 503. Ready → 200. No secrets. Core `/api/health/ready` is unchanged and does not fail because HSI is OFF. |
| ClamAV | Official `clamd` TCP INSTREAM in `server/src/services/hsi/clamavClamdAdapter.js`. No REST wrapper. No shell-exec of user input. Mapping: OK→clean, FOUND→rejected, ERROR/unavailable/malformed/size→failed, timeout→timeout. Never unknown→clean. |
| Scan honesty | `clean` means only: no known ClamAV signature match on that scan. |
| Scan jobs | Durable `GbsDocumentScanJob`. Unique `(vaultDocumentVersionId, checksumSha256)`. Statuses queued/leased/clean/rejected/failed/timeout/dead. No document bytes, DEK, KEK, or filenames. |
| Executor | `server/src/gbsDocumentScanWorker.js`. Does not import email/notification/workflow delivery. Atomic Mongo lease, max 3 attempts, 30s attempt timeout, bounded backoff. Decrypts ciphertext in memory and streams to clamd. No temp plaintext file. |
| Existing Worker | Unchanged. `edurozgaar-staging-worker-1` remains Exited / STOPPED. |
| MinIO | Private S3-compatible adapter using existing `@aws-sdk/client-s3`. Separate quarantine and clean buckets. `Cache-Control: private, no-store`. Opaque `hsi/<32-hex>` keys. No presigned HSI GET. No CDN. |
| Plaintext law | Validated bytes → random 256-bit DEK → AES-256-GCM + canonical AAD → Transit-wrap DEK → write **ciphertext** to quarantine → persist wrapped DEK metadata → enqueue scan. |
| Promotion | Clean copies ciphertext to the clean bucket then deletes quarantine. No decrypt/re-encrypt to promote. Rejected objects are never promoted. |
| Transit | Backend HTTP client for wrap/unwrap/health. Environment-specific key names. Vault **dev mode is TEST ONLY** and is refused when `NODE_ENV=production`. No committed token. Production least-privilege auth/runbook remains required. |
| Envelope | Node `crypto` AES-256-GCM. Per-version random DEK. Unique nonce. Auth tag. Canonical AAD binds environment, caseId, documentId, vaultDocumentVersionId, classification, schemaVersion, securityPolicyVersion. Ordered `key=value` lines — not JSON object order. |
| Decrypt failure | Wrong AAD / key / ciphertext / tag fails closed. No partial plaintext. No fallback. |
| Retention | Class mechanics implemented (`unused_upload`, `scanner_rejected_malware`, `superseded_version`, `accepted_case_evidence`, `cancelled_case`, `hsi_identity`, `filing_consent`, `audit_log`, `submitted_filing_evidence`, `evidence_hold`). Missing duration → capability not ready. No default 30/90/infinity. |
| Malware destroy | Rejected ciphertext remains quarantine-only until synthetic TTL elapses; purge deletes ciphertext and keeps checksum/verdict/audit metadata. Production malware window is still POLICY REQUIRED. |
| Restore | Engineering export/restore of ciphertext + Mongo version + wrapped DEK (`server/src/scripts/hsiRestoreFoundation.js`). Synthetic restore PASS. **PRODUCTION RESTORE EVIDENCE: NOT YET ESTABLISHED.** KEK is never exported. Vault key recovery in dev mode is **NOT PROVEN / PRODUCTION RUNBOOK REQUIRED**. |
| Audit | High-assurance HSI decrypt/download, promotion, and destroy use `logRequiredHsiAudit` (fail-closed insert). Bytes/DEK/KEK/tokens/filenames/object secrets are redacted. |
| Env validation | If HSI is enabled in production: require ClamAV/MinIO/Vault/retention JSON; reject placeholders, `minioadmin`, skip-encryption flags, and Vault dev mode. Recent signing-secret placeholder rejection is unchanged. |
| Compose | Additive `docker-compose.hsi-security-test.yml` only (`clamav/clamav`, MinIO, Vault **-dev TEST ONLY**). Loopback `127.0.0.1` binds. Not part of normal `docker compose up`. Caddy does not proxy MinIO/Vault/clamd. `docker-compose.appenv-align.yml` untouched. |
| UI | No client changes. No “Upload passport/CNIC” prompts. 8B1 unavailable copy remains truthful while HSI is OFF. |

---

## 4. Production HSI launch blockers (preserved)

These remain blocking even though engineering tests PASS:

- Retention durations: **LEGAL / PRODUCT POLICY REQUIRED**
- Malware quarantine duration: **POLICY REQUIRED**
- Crypto/AAD external/security review: **REQUIRED BEFORE HSI ON**
- Production Vault authentication/runbook: **REQUIRED**
- Production scanner runbook/monitoring: **REQUIRED**
- Production backup/DR restore evidence: **REQUIRED**
- Production HSI activation: **OFF**

---

## 5. Tests

| Suite | Result |
|---|---|
| `phase17d8b2aSourceContract.test.js` | PASS (65) |
| `phase17d8b2aEnvelopeCrypto.test.js` | PASS |
| `phase17d8b2aHsiCapability.test.js` | PASS |
| `phase17d8b2aClamavAdapter.test.js` | PASS |
| `phase17d8b2aScanJob.mongo.test.js` | PASS (4) |
| `phase17d8b2aLiveIntegration.mongo.test.js` | PASS (6) — real official clamd, real MinIO, real Vault Transit **TEST ONLY**, synthetic E2E, restore, malware destroy |
| `validateProductionEnv.test.js` | PASS (62) including HSI-off and HSI-on fail-closed |
| `jwtSessionProvider.test.js` | PASS (68) |
| `secureAuthConfig.test.js` | PASS (32) |
| `phase17d8b1SourceContract.test.js` | PASS (74) |
| `phase17d8b1CaseDocument.mongo.test.js` | PASS |
| `phase17d8b1LiveIndexIdempotency.mongo.test.js` | PASS |
| `phase17d8aSourceContract.test.js` | PASS (83) |
| `phase17d7SourceContract.test.js` | PASS (89) |

Live ClamAV: synthetic PDF → `clean` (no known signature match). Official EICAR string → `rejected`. Daemon unavailable → `failed`. Hang-socket → `timeout`. Timeout/ERROR/malformed never map `clean`.

Live MinIO: private buckets, anonymous GET denied, stored bytes ≠ plaintext, clean promotion deletes quarantine, rejected never promoted.

Live Transit (Vault `-dev`, TEST ONLY): wrap/unwrap, wrong environment context denied.

Synthetic GBS E2E: capability-ready upload encrypts before storage, pending customer/provider bytes denied, executor clean, authorized customer and exact-subject provider proxy decrypt through the API, wrong customer 404, no MinIO URL in response headers.

No real passports, CNIC, or other identity documents were used.

---

## 6. Module / runtime

- `node --check` on touched JS: PASS
- ESLint on touched JS: PASS
- Frontend build: **NOT REQUIRED** (no client files changed)
- Normal staging stack (pre-existing images, not this HEAD): frontend/api-a/api-b/mongo/redis/caddy healthy
- Marketplace: OFF (`BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED` not enabled for this work)
- HSI on that running stack: OFF / not in those images (no deploy)
- Dedicated HSI test compose: started for acceptance, then `down -v`
- Existing worker: `edurozgaar-staging-worker-1 Exited (0) 12 days ago`
- `autoIndex` remains opt-in. No `syncIndexes`. No `dropIndexes`. No `MONGO_AUTO_INDEX=1`.
- No new npm dependencies.

---

## 7. Visual / a11y

No client/UI files were changed. 8B1 visual/a11y acceptance is inherited. No HSI upload controls were added.

---

## 8. Push / deploy

**NO PUSH. NO DEPLOY. PRODUCTION HSI NOT ENABLED.**
