# STRIDETO PHASE 17D-8B2-PRE
HSI SECURITY PROVIDER, RETENTION/DR, OFFICIAL FILING SOURCE, AND CONSENT
OWNER ARCHITECTURE DECISION LOCK

**PHASE:** 17D-8B2-PRE

**TYPE:** OWNER ARCHITECTURE DECISION LOCK

**STATUS:** COMPLETE

**IMPLEMENTATION:** NOT STARTED

**HSI:** BLOCKED / OFF

**GOVERNMENT SUBMISSION:** NOT IMPLEMENTED

**LEGAL COUNSEL STATUS:** NOT PROVIDED BY THIS DOCUMENT

This document is **product / owner architecture authority**.

It is **not** legal counsel, production security approval, HSI launch approval, B2A/B2B/B2C implementation, or government filing authorization.

No scanner, MinIO, Vault Transit, crypto, Wyoming pack, consent, or government-submission implementation is authorized by this lock.

---

## 1. Baseline record

Decision-lock baseline HEAD: `3b90dfc9d070b5be93ec4963c911d744a3d1d230`

`fix(auth): reject published signing secret placeholders`

| Item | Status |
| --- | --- |
| Auth placeholder maintenance | COMPLETE |
| 17D-8B1 | CLOSED |
| 17D-8B2A | NOT STARTED |
| 17D-8B2B | NOT STARTED |
| 17D-8B2C | NOT STARTED |
| 17D-8C | NOT STARTED |
| Phase 18 | NOT STARTED |

Architectural **selections** in this document are not runtime **PASS**.

---

## 2. Locked scanner decision

**Scanner:** Official ClamAV `clamd`

**Deployment:** dedicated private scanner container

**Approved image family:** official `clamav/clamav`

Production scanner semantics:

| Engine result | Persisted verdict |
| --- | --- |
| `OK` | `clean` |
| `FOUND` | `rejected` |
| protocol / malformed / unavailable | `failed` |
| timeout | `timeout` |

`clean` means **no known ClamAV signature match detected**.

Do not describe `clean` as virus-free, security-guaranteed, or sandbox-approved.

ClamAV is **SELECTED**. A ClamAV container is **NOT IMPLEMENTED** and is **not running** because of this document.

---

## 3. Scan execution

Production scanning: **ASYNC**

Required future flow:

```
upload
  → quarantine
  → durable scan job
  → dedicated scan executor
  → clamd
  → persisted verdict
  → clean promotion / access eligibility
```

The existing email/notification Worker **MUST NOT** run scan jobs.

Current Worker: **STOPPED**

The dedicated scan executor **does not exist yet**. This lock does not create it.

---

## 4. Scan job contract

Approved future payload fields (design only; not implemented):

- `commandType`: `gbs.case_document.scan`
- `vaultDocumentVersionId`
- `opaqueStorageRef`
- `storageClass`
- `checksumSha256`
- `mimeType`
- `sizeBytes`
- `classification`
- `attempt`
- `schemaVersion`

Forbidden in the job payload:

- document bytes
- original filename where avoidable
- passport / CNIC values
- customer HSI
- DEK
- KEK

Idempotency fingerprint: `vaultDocumentVersionId + checksumSha256`

---

## 5. Scan retry policy

Initial engineering policy (not legal duration; operations may tune after load test):

| Parameter | Value |
| --- | --- |
| Max attempts | 3 |
| Backoff | bounded exponential |
| Initial per-attempt timeout | 30 seconds |
| Terminal failure status | `failed` / `timeout` |

Never map scanner outage, error, or timeout to `clean`.

Exact production timeout/backoff: **OPERATIONS / LOAD-TEST ADJUSTABLE**

---

## 6. Quarantine

Selected quarantine/storage direction: **MinIO on a private Docker network**

One **logical** Vault storage subsystem. Isolation of **quarantine** vs **clean/encrypted** through separate bucket/prefix/IAM policy.

- Provider: **NO** quarantine byte access
- Scanner executor: quarantine read only as required
- No CDN
- No public ACL
- No public object URLs

MinIO is **not running** as part of this decision lock.

---

## 7. MinIO role

MinIO is selected as the preferred future **private opaque HSI object adapter** under the existing Vault abstraction.

It is **not** a second user-facing file system.

No MinIO implementation exists yet. No MinIO container is running because of this lock.

---

## 8. Cloudinary

Cloudinary: allowed for **current / non-HSI** Vault behavior.

Cloudinary: **NOT** selected for HSI ciphertext.

Cloudinary: **NOT** selected for quarantine.

No migration of existing non-HSI content is authorized.

---

## 9. KMS

Selected KMS: **HashiCorp Vault Transit**

Purpose: wrap/unwrap per-document-version DEKs.

KEK must never be stored in:

- Mongo
- Git
- frontend
- Vite environment
- client DTO
- audit logs
- application logs

Environment-specific Transit key separation is required.

No Transit implementation exists yet.

---

## 10. Envelope encryption

Architecture lock (not implemented):

- per-version random DEK
- AES-256-GCM
- unique nonce
- canonical AAD
- Transit-wrapped DEK
- ciphertext stored in private opaque storage

AAD must bind:

- environment
- `caseId`
- `documentId`
- `versionId`
- classification
- `schemaVersion`
- `securityPolicyVersion`

No plaintext fallback.

---

## 11. Crypto review boundary

AES-256-GCM architecture is **LOCKED TO THE CURRENT SECURITY DIRECTION**.

Before the first production HSI object, **SECURITY REVIEW REQUIRED** for:

- AAD canonical serialization
- nonce lifecycle
- key rotation
- rewrap behavior
- error handling
- streaming / decryption implementation

Production HSI crypto is **not** approved yet.

---

## 12. HSI access law

For HSI, customer **and** Provider **byte access is DENIED** while scan status is:

- `not_configured`
- `pending`
- `failed`
- `timeout`
- `rejected`

Metadata may remain available according to authorization.

Only `clean` may proceed to later access/review gates.

---

## 13. HSI download law

Future approved pattern (not implemented):

1. authorize
2. check live HSI capability
3. fetch ciphertext
4. unwrap DEK through Transit
5. decrypt in memory / stream
6. return attachment

Required headers:

- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`
- `Content-Disposition: attachment`

No decrypted temp file. No plaintext cache. No public URL. Audit required before success.

---

## 14. Provider document authority

Preserve `business_services.case_documents.manage`.

Explicit duty required.

- Agency Owner: **NO** implicit sensitive-document access
- Agency Admin: **NO** implicit sensitive-document access
- `cases.manage`: not enough
- `quotes.manage`: not enough
- `requests.manage`: not enough

Do not add a second HSI-specific permission yet.

---

## 15. HSI capability gate

Future server authority: `isHsiDocumentCapabilityReady()`

Must require:

- feature enabled
- ClamAV healthy
- dedicated scan executor healthy
- private opaque store configured
- Vault Transit healthy
- encryption policy active
- retention class configured
- mandatory audit persistence available
- production-allowed environment
- Case-derived document authorization
- `case_documents.manage` for Provider

Enabled + any missing dependency: **FAIL CLOSED**.

Disabled: HSI unavailable.

A feature flag never bypasses dependencies.

---

## 16. Retention classes

Locked class structure (classes only; no durations):

- `unused_upload`
- `scanner_rejected_malware`
- `superseded_version`
- `accepted_case_evidence`
- `cancelled_case`
- `hsi_identity`
- `filing_consent`
- `audit_log`
- future `submitted_filing_evidence`
- future `evidence_hold`

---

## 17. Retention durations

**HSI RETENTION DURATIONS: LEGAL / PRODUCT POLICY DECISION REQUIRED**

This owner lock does **not** authorize:

- 30 days
- 90 days
- forever
- or any other duration copied from generic backup/media documentation

No duration is authorized by this document.

---

## 18. Malware retention

Rejected malicious payload: **bounded quarantine only**, then **secure destroy**.

Safe metadata may remain:

- checksum
- verdict
- scanner engine / database version
- timestamps
- audit record

Exact quarantine window: **LEGAL / SECURITY POLICY DECISION REQUIRED**

Never retain a malicious payload indefinitely by default.

---

## 19. Backup / DR

Required future HSI architecture (not proven; not implemented):

- ciphertext backup
- Mongo metadata / version backup
- Transit recovery procedure
- environment-separated keys
- restore test
- metadata–object consistency verification
- wrong-AAD failure test
- wrong-key failure test

No plaintext backup.

A backup that has never been restore-tested does not satisfy HSI launch readiness.

---

## 20. HSI launch gate

B2A **infrastructure implementation** may complete while HSI remains **OFF**.

Production HSI enablement requires at minimum:

- security review PASS
- retention policy approved
- backup/DR policy approved
- restore-test evidence PASS
- scanner operational evidence
- Transit operational evidence
- audit fail-closed proof

**Implementation-ready ≠ launch-ready.**

---

## 21. First filing pack

Owner choice for the first future filing pack: **`et:US-WY:LLC`**

| Field | Status |
| --- | --- |
| Selection | SELECTED FOR FUTURE B2B |
| Implementation | NOT IMPLEMENTED |
| Activation | NOT ACTIVATED |

Reason (owner, not legal advice):

- official $100 Articles filing fee confirmed in reviewed Wyoming source
- registered-agent rules explicit
- written RA consent documented
- official formation sources comparatively clear
- no identity-scan requirement found in reviewed formation sources
- formation-only scope is comparatively low-HSI

---

## 22. Wyoming research facts

Already-approved research conclusions only (no new legal interpretation):

- LLC name requirements exist
- registered agent required
- physical Wyoming registered-agent address required
- written RA consent accompanies Articles
- organizer signs/delivers Articles
- Articles of Organization are the formation filing artifact
- official filing fee: **$100** according to the reviewed Wyoming source
- online filing exists

---

## 23. Wyoming unresolved items

RA consent representation in STRIDETO: **UNRESOLVED**

Potential models (not chosen):

- document
- Provider-supplied artifact
- Provider attestation
- authority-form artifact

Decision deferred to B2B / legal / product review.

Organizer identity / role inside a STRIDETO Case: **UNRESOLVED**

Do not invent.

---

## 24. B2B pack law

A future Wyoming pack must be:

- source-controlled
- versioned
- reviewed
- facts / documents / consents separated
- source provenance attached
- snapshotted onto the Case
- explicitly upgraded
- not silently rewritten

No HSI requirement may be added unless B2A security is operational.

---

## 25. Filing consent

`CaseFilingAuthorization` architecture: **READY FOR FUTURE B2C**

Implementation: **NOT STARTED**

Production legal text: **LEGAL REVIEW REQUIRED**

Quote acceptance is **NOT** filing authorization.

Authorization binds:

- exact Case
- exact Provider
- jurisdiction / entity
- pack version
- legal-text version / hash

This document does not contain production consent wording.

---

## 26. Consent revocation

Before external submission: customer may revoke. Readiness becomes false.

After a future recorded submission: historical authorization remains. Revocation cannot undo an external filing.

No external filing exists today.

---

## 27. Pack change vs consent

A material filing-scope or pack change **invalidates** existing authorization for future submission.

New consent is required. No silent carry-forward.

---

## 28. Statutory e-sign

**OUT OF SCOPE**

Wyoming organizer / RA signatures are authority-side requirements.

STRIDETO currently has no statutory e-sign product.

Do not imply:

- checkbox = state signature
- typed name = statutory signature
- quote acceptance = statutory signature

---

## 29. Government credentials

Government credentials are **FORBIDDEN** in:

- Case notes
- Vault documents
- filing authorization
- ordinary application logs

OTP / MFA must never be persisted as Case data.

---

## 30. Future 8C model

Preferred first future submission model: **Provider-attested manual external filing**

Not:

- portal automation
- credential capture
- government browser automation

Still requires:

- Filing Readiness V2 PASS
- active consent
- exact Provider authority
- explicit attestation
- timestamp
- audit
- submission provenance

17D-8C remains **NOT STARTED**.

---

## 31. Core health vs HSI health

HSI disabled: the core application can remain healthy.

HSI enabled + dependencies unhealthy: HSI readiness fails closed.

Do not take the whole STRIDETO platform down solely because optional HSI is disabled.

Future deployment may use a dedicated HSI readiness gate.

---

## 32. B2A implementation readiness

| Selection | Status |
| --- | --- |
| Scanner provider | SELECTED |
| Scanner architecture | SELECTED |
| Scan execution | SELECTED |
| Quarantine | SELECTED |
| Opaque storage | SELECTED |
| KMS | SELECTED |
| Envelope architecture | LOCKED conceptually |
| HSI pending access | LOCKED DENY |
| Cloudinary HSI | NO |
| Existing Worker scans | NO |

**17D-8B2A IMPLEMENTATION READINESS:** READY TO IMPLEMENT SECURITY INFRASTRUCTURE

**PRODUCTION HSI LAUNCH READINESS:** NOT READY

---

## 33. B2A remaining launch gates

Must be resolved / proven before HSI ON:

- retention durations
- malware destroy window
- backup/DR evidence
- restore test
- crypto / AAD security review
- operational scanner health
- operational Transit health
- production monitoring / runbooks

---

## 34. B2B status

17D-8B2B: **NOT STARTED**

First entity: US-WY LLC selected

Pack implementation: **NOT STARTED**

Pack activation: **NO**

Reviewed-by process: still required

RA consent modeling: still unresolved

---

## 35. B2C status

17D-8B2C: **NOT STARTED**

Architecture: READY

Production legal text: **MISSING / LEGAL REVIEW REQUIRED**

No consent rows, models, routes, or UI exist yet.

---

## 36. Security truth at commit time

At the moment this decision lock is committed:

| Runtime | Status |
| --- | --- |
| Scanner runtime | NOT_CONFIGURED |
| ClamAV container | NOT IMPLEMENTED |
| Scan executor | NOT IMPLEMENTED |
| MinIO | NOT IMPLEMENTED |
| Vault Transit | NOT IMPLEMENTED |
| Envelope crypto | NOT IMPLEMENTED |
| HSI | BLOCKED / OFF |
| Wyoming pack | NOT IMPLEMENTED |
| Filing consent | NOT IMPLEMENTED |
| Government submission | NOT IMPLEMENTED |
| Marketplace | OFF |
| Worker | STOPPED |

Architectural selections are **not** implementation PASS.

---

## 37. PRE closure status

| Item | Status |
| --- | --- |
| 17D-8B2-PRE | COMPLETE |
| Owner architecture decisions | LOCKED |
| Legal decisions | PARTIALLY OUTSTANDING |
| B2A | READY FOR FUTURE INFRASTRUCTURE IMPLEMENTATION CONTRACT |
| B2A production HSI | NOT READY |
| B2B | NOT READY TO IMPLEMENT YET |
| B2C | NOT READY TO IMPLEMENT YET |
| 8C | NOT READY |

Do not start 17D-8B2A, 17D-8B2B, 17D-8B2C, 17D-8C, or Phase 18 from this document.
