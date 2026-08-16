# STRIDETO PHASE 17D-8B2A
HSI SECURITY RUNTIME HARDENING

**PHASE 17D-8B2A: FORMALLY CLOSED**

**ENGINEERING IMPLEMENTATION: PASS**

**SECURITY RUNTIME HARDENING: PASS**

**FINAL NORMAL-RUNTIME ACCEPTANCE: PASS**

**KNOWN B2A ENGINEERING BLOCKERS: NONE**

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

**RETENTION MECHANICS: PASS**

**PRODUCTION RETENTION DURATIONS: LEGAL / PRODUCT POLICY REQUIRED**

**ENGINEERING RESTORE MECHANICS: PASS**

**PRODUCTION RESTORE EVIDENCE: NOT ESTABLISHED**

**PRODUCTION CRYPTO / AAD SECURITY REVIEW: REQUIRED BEFORE HSI ON**

**MARKETPLACE: OFF**

**WYOMING PACK: NOT IMPLEMENTED**

**FILING CONSENT: NOT IMPLEMENTED**

**STATUTORY E-SIGNATURE: OUT OF SCOPE**

**GOVERNMENT SUBMISSION: NOT IMPLEMENTED**

**PAYMENT: NOT_CONFIGURED / UNCHANGED**

**CHAT / MAILROOM / MY BUSINESSES: NOT STARTED**

**17D-8B2B: NOT STARTED**

**17D-8B2C: NOT STARTED**

**17D-8C: NOT STARTED**

**PHASE 18: NOT STARTED**

B2A CLOSED does **not** mean PRODUCTION HSI READY.

---

## 1. Baseline

Starting HEAD: `4b6078b1f0bc849a9cef2d6a446d813f2b2201e2`

`docs(architecture): lock phase 17d-8b2 pre security decisions`

17D-7 / 17D-8A / 17D-8B1 / 17D-8B2-PRE: CLOSED. Predecessor architecture was not reopened.

Audited implementation + initial readiness docs HEAD: `cbb161d5c95f35ad4076c199444cc0c15cbca246`

`docs(release): record phase 17d-8b2a security runtime readiness`

That commit remains the application/test/security implementation baseline. This document’s docs-only sign-off commit is the final formal 17D-8B2A HEAD.

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

B2A success is **security infrastructure + synthetic integration proof + fail-closed runtime + HSI default OFF + current-HEAD normal-runtime proof**.

B2A success is **not**:

- real HSI accepted
- production HSI launch-ready
- legal retention approved
- government filing available
- Wyoming pack activated

Engineering-ready and production-launch-ready remain distinct.

---

## 3. Engineering implementation

| Boundary | Implementation |
|---|---|
| Feature flag | `GBS_HSI_DOCUMENTS_ENABLED` default `0`. Committed examples OFF. Flag ON never bypasses readiness. |
| Capability gate | `isHsiDocumentCapabilityReady()` — enabled, scanner configured/healthy, executor healthy, MinIO configured/healthy, Transit configured/healthy, encryption policy, retention policy present (no guessed durations), audit ready. Feature flag alone cannot bypass readiness. |
| Health | Dedicated `GET /api/health/hsi`. Disabled → 200 `{enabled:false, ready:false, state:"disabled"}`. Enabled not ready → 503. Ready → 200. No secrets. Core `/api/health/ready` is unchanged and does not fail because HSI is OFF. Fully ready was proven only in the isolated synthetic test environment. |
| ClamAV | Official `clamd` TCP INSTREAM in `server/src/services/hsi/clamavClamdAdapter.js`. No REST wrapper. No shell-exec of user input. Mapping: OK→clean, FOUND→rejected, ERROR/unavailable/malformed/size→failed, timeout→timeout. Never unknown→clean. |
| Scan honesty | `clean` means only: no known ClamAV signature match on that scan. It does not mean virus-free. |
| Scan jobs | Durable `GbsDocumentScanJob`. Unique `(vaultDocumentVersionId, checksumSha256)`. Statuses queued/leased/clean/rejected/failed/timeout/dead. No document bytes, DEK, KEK, or filenames. Async scan. Max 3 attempts. 30-second initial attempt timeout. Timeout/error/malformed never map `clean`. |
| Executor | Dedicated `server/src/gbsDocumentScanWorker.js`. Does not import email/notification/workflow delivery. Atomic Mongo lease, bounded backoff. Decrypts ciphertext in memory and streams to clamd. No temp plaintext file. Existing Worker is not used for scanning. |
| Existing Worker | Unchanged. `edurozgaar-staging-worker-1` remains Exited / STOPPED. |
| MinIO | Private opaque S3-compatible adapter using existing `@aws-sdk/client-s3`. Separate quarantine and clean buckets/classes. `Cache-Control: private, no-store`. Opaque `hsi/<32-hex>` keys. No presigned HSI GET. No public HSI URL. No CDN. Anonymous object access denied. Cloudinary is non-HSI only; Cloudinary HSI is NO. |
| Plaintext law | Validated bytes → random 256-bit DEK → AES-256-GCM + canonical AAD → Transit-wrap DEK → write **ciphertext** to quarantine → persist wrapped DEK metadata → enqueue scan. Ciphertext is written before durable HSI storage. Plaintext HSI is not persisted. |
| Promotion | Clean copies ciphertext to the clean bucket then deletes quarantine. No decrypt/re-encrypt to promote. Rejected objects are never promoted. |
| Transit | Backend HTTP client for wrap/unwrap/health. Environment-specific key names. Real Transit TEST integration PASS. Vault **dev mode is TEST ONLY** and is refused when `NODE_ENV=production`. Production use of Vault dev mode is REFUSED. No committed token. Production least-privilege auth/runbook remains required. Missing KMS fails closed. No plaintext fallback. |
| Envelope | Node `crypto` AES-256-GCM. Per-version random DEK. Unique nonce. Auth tag. Wrapped DEK via Vault Transit. Canonical AAD binds environment, Case, document, version, classification, schema, security policy. Ordered `key=value` lines — not JSON object order. |
| Decrypt failure | Wrong AAD / key / ciphertext / tag fails closed. Tampered ciphertext DENIED. No partial plaintext. No fallback. |
| Retention | Class mechanics implemented (`unused_upload`, `scanner_rejected_malware`, `superseded_version`, `accepted_case_evidence`, `cancelled_case`, `hsi_identity`, `filing_consent`, `audit_log`, `submitted_filing_evidence`, `evidence_hold`). Missing duration → capability not ready. No default forever / 30 days / 90 days. Production durations remain LEGAL / PRODUCT POLICY REQUIRED. |
| Malware destroy | Rejected ciphertext remains quarantine-only until synthetic TTL elapses; purge deletes ciphertext and keeps checksum/verdict/audit metadata. Synthetic purge PASS. Production malware quarantine window is still POLICY REQUIRED. |
| Restore | Engineering export/restore of ciphertext + Mongo version + wrapped DEK (`server/src/scripts/hsiRestoreFoundation.js`). Synthetic restore PASS. Correct-context decrypt PASS. Wrong AAD/context FAIL. **PRODUCTION RESTORE EVIDENCE: NOT ESTABLISHED.** Vault KEK export was not performed. Production Transit recovery remains RUNBOOK / EVIDENCE REQUIRED. DR is not production-ready. |
| Audit | High-assurance implemented B2A actions (decrypt/download, promotion, destroy) use `logRequiredHsiAudit` (fail-closed insert). Audit does not contain document body, plaintext, DEK, KEK, Vault token, MinIO secret, raw sensitive filename, or public object URL. |
| Authority | Provider HSI authority is exact Provider subject. Pending HSI bytes DENIED. Clean HSI synthetic test access is authenticated backend proxy only. Object URL never returned. Required sensitive duty: `business_services.case_documents.manage`. Agency Owner implicit authority DENIED. Agency Admin implicit authority DENIED. Capability/domain/listing loss fails closed. |
| Env validation | If HSI is enabled in production: require ClamAV/MinIO/Vault/retention JSON; reject placeholders, `minioadmin`, skip-encryption flags, and Vault dev mode. Recent signing-secret placeholder rejection is unchanged. |
| Compose | Additive `docker-compose.hsi-security-test.yml` only (`clamav/clamav`, MinIO, Vault **-dev TEST ONLY**). Loopback `127.0.0.1` binds. Not part of normal `docker compose up`. Caddy does not proxy MinIO/Vault/clamd. `docker-compose.appenv-align.yml` untouched. Isolated test services were stopped/removed after acceptance. |
| UI | No client changes. No “Upload passport/CNIC” prompts. 8B1 unavailable copy remains truthful while HSI is OFF. |

---

## 4. Production HSI launch blockers (preserved)

These remain blocking even though engineering tests PASS and B2A is formally closed:

1. Production retention durations: **LEGAL / PRODUCT POLICY REQUIRED**
2. Production malware quarantine window: **POLICY REQUIRED**
3. Crypto/AAD security review: **REQUIRED BEFORE HSI ON**
4. Production Vault authentication/runbook: **REQUIRED**
5. Production scanner operations/monitoring: **REQUIRED**
6. Production backup/DR restore evidence: **REQUIRED**
7. Production HSI activation: **OFF**

Engineering implementation PASS. Production external/security review: **NOT COMPLETED**.

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

The full HSI fail-closed gate is supported by these focused integration/security tests plus HSI health state. See §8 for the live staging interpretation of `404 not_found`.

---

## 6. Module / build

- `node --check` on touched JS: PASS
- ESLint on touched JS: PASS
- New npm dependencies: NONE
- Frontend build: **NOT REQUIRED** (no client files changed)

---

## 7. Final normal-runtime acceptance (current B2A HEAD)

Rebuild/recreate of **api-a** and **api-b** only, onto audited HEAD `cbb161d5c95f35ad4076c199444cc0c15cbca246`. Mongo, Redis, Mailpit, Caddy, frontend, and volumes were preserved. Existing Worker was not started. No `docker compose down` / `down -v`. Isolated HSI test compose was not started.

| Check | Result |
|---|---|
| api-a current B2A HEAD loaded | PASS |
| api-b current B2A HEAD loaded | PASS |
| Core startup without ClamAV | PASS |
| Core startup without MinIO | PASS |
| Core startup without Vault Transit | PASS |
| Core startup without dedicated scan executor | PASS |
| api-a `GET /api/health` | 200 |
| api-a `GET /api/health/ready` | 200 |
| api-b `GET /api/health` | 200 |
| api-b `GET /api/health/ready` | 200 |
| frontend | healthy |
| Mongo | healthy |
| Redis | healthy |
| Caddy HTTPS root | 200 |
| HSI | OFF |

Optional HSI infrastructure is not a core startup dependency while HSI is OFF.

---

## 8. HSI-OFF product truth (normal runtime)

Normal api-a/api-b environment:

- `GBS_HSI_DOCUMENTS_ENABLED`: UNSET / OFF
- `CLAMAV_CLAMD_HOST`: unset
- `HSI_MINIO_ENDPOINT`: unset
- `VAULT_ADDR`: unset
- Dedicated scan executor: not running

`GET /api/health/hsi` (api-a and api-b):

HTTP 200

```json
{"enabled":false,"ready":false,"state":"disabled","scannerConfigured":false,"scannerHealthy":false,"scanExecutorHealthy":false,"storageConfigured":false,"storageHealthy":false,"kmsConfigured":false,"kmsHealthy":false,"encryptionPolicyReady":false,"retentionPolicyReady":false,"auditReady":false}
```

No secrets in the response. No `ready=true`. Core readiness did not fail because HSI is OFF.

Authenticated disposable Case `DTPXRd-9BOY7PcNoAifZT_a_`:

- Document requirements route: **200**
- `security.mode`: `not_configured`
- `uploadEnabled`: `false`
- Synthetic unknown HSI requirement upload/init/complete/file/review: **404 `not_found`**

Important interpretation:

- No HSI requirement exists in staging.
- No database fixture was created merely to obtain an `hsi_documents_disabled` response.
- The request failed before durable HSI storage.
- No MinIO runtime/object existed.
- This live 404 alone does **not** prove every HSI feature gate.
- The full fail-closed gate is supported by focused integration/security tests plus HSI health state.

---

## 9. Test infra cleanup

Phase B2A isolated test services (ClamAV, MinIO, Vault dev/test, dedicated scan executor) were stopped/removed after acceptance (`down -v` of the additive HSI test compose).

Final normal runtime contains none of them. No broad Docker prune occurred.

---

## 10. Normal-runtime log review

- Unexpected HSI-off ClamAV connection attempts: NONE
- Unexpected MinIO connection attempts: NONE
- Unexpected Transit connection attempts: NONE
- Unexpected scan-executor errors: NONE
- Unexpected core/GBS 5xx: NONE

Pre-existing Mongoose duplicate-schema-index warnings were observed. Classification: **PRE-EXISTING / NON-B2A CLOSURE BLOCKER**. They were not fixed in this phase.

New B2A scan-job index provisioning: create-only. `MONGO_AUTO_INDEX`: OFF/UNSET. `syncIndexes`: NOT USED.

---

## 11. Marketplace / queue / worker

- Marketplace: OFF
- `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED`: `0`
- Worker: STOPPED
- `workerRunning`: `false`
- `queuePending`: 136
- email: 111
- notification: 25
- `effectiveState`: `queued_worker_stopped`
- `processing`: 0

Queue was not drained. Queued ≠ delivered.

---

## 12. Minimal UI regression (HSI OFF; no client files changed)

Customer Case document surface:

| Check | Result |
|---|---|
| 320 Light | PASS |
| 320 Dark | PASS |
| 1440 Light | PASS |
| 1440 Dark | PASS |
| System mobile | PASS |
| System desktop | PASS |

Provider Case document surface:

| Check | Result |
|---|---|
| 320 Light | PASS |
| 320 Dark | PASS |
| 1440 Light | PASS |
| 1440 Dark | PASS |
| System | PASS |

No HSI operational control appeared while the feature is OFF. No passport / CNIC / KYC prompts.

Customer copy remained: **Secure document upload is not available in this environment.**

Provider copy remained: **Document security scanning is not configured.**

No claim of production KMS, production encryption, security-cleared, virus-free, filing-ready, or government-ready.

Body overflow: PASS at tested 320 and 1440 widths (`scrollWidth <= clientWidth + 1`). No shell regression.

Browser-verifiable accessibility smoke: PASS. Required documents remains a semantic heading. Unavailable state is text, not color-only. Controls are real links/buttons. Raw HTML injection: none observed.

Native 200%: **NOT PROVEN / USER MANUAL**

Screen reader: **NOT PROVEN / USER MANUAL**

Customer shell: PASS. Provider shell: PASS. No blank shell during tested SPA transitions.

---

## 13. Out of scope remains

- Wyoming pack: **NOT IMPLEMENTED**
- Filing consent: **NOT IMPLEMENTED**
- Statutory e-sign: **OUT OF SCOPE**
- Government submission: **NOT IMPLEMENTED**
- Government credentials: **NOT IMPLEMENTED / FORBIDDEN IN CASE ARTIFACTS**
- Payment: **NOT_CONFIGURED**
- Chat: **NOT STARTED**
- Mailroom: **NOT STARTED**
- My Businesses: **NOT STARTED**
- 17D-8B2B: **NOT STARTED**
- 17D-8B2C: **NOT STARTED**
- 17D-8C: **NOT STARTED**
- Phase 18: **NOT STARTED**

---

## FINAL PHASE 17D-8B2A CLOSURE

Engineering implementation: PASS

Official ClamAV integration: PASS

Dedicated async scan runtime: PASS

Private MinIO storage: PASS

Quarantine: PASS

Vault Transit integration: PASS

Envelope encryption: PASS

Synthetic HSI E2E: PASS

Fail-closed dependency behavior: PASS

Retention mechanics: PASS

Engineering restore mechanics: PASS

Normal current-HEAD runtime: PASS

HSI-OFF core startup: PASS

Minimal customer/provider UI regression: PASS

Marketplace: OFF

Existing Worker: STOPPED

Known B2A engineering blockers: NONE

Production HSI launch: NOT READY

Phase 17D-8B2A: CLOSED

---

## Push / deploy

**NO PUSH. NO DEPLOY. PRODUCTION HSI NOT ENABLED.**
