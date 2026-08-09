# Strideto Mission 10 — Secure Document Vault

## Summary

Mission 10 builds a private, user-owned document vault for managing identity, education, and professional documents required for scholarship, admission, and future professional-services journeys.

---

## Storage Architecture

**Reuse decision**: The existing career `storageService.js` (Cloudinary + local disk fallback) provides the upload backend. A new `vaultStorageService.js` wraps it with a private-access layer:

- Upload returns `{ storageKey, storageProvider, checksum }` — never a public URL.
- All client access goes through an authenticated server route (`GET /api/vault/documents/:id/access`).
- Cloudinary assets uploaded with `access_mode: authenticated` and short-lived signed URLs for streaming.
- Local storage in `server/vault-storage/` (isolated from public `/uploads/` directory).
- `storageKey` is held server-side only; never serialised to API responses.

---

## VaultDocument Model

`server/src/models/vault/VaultDocument.js`

| Field | Type | Notes |
|-------|------|-------|
| ownerUserId | ObjectId | Derived from auth, never from body |
| documentType | String (enum) | 17 canonical types + other |
| displayName | String | Required, max 200 |
| description | String | Optional |
| status | String | active / archived / deleted_pending_retention |
| currentVersionId | ObjectId → VaultDocumentVersion | Null until first upload |
| issuedAt | Date | Optional |
| expiresAt | Date | Optional, indexed |
| countryCode | String | ISO 3-letter, uppercased |
| issuingOrganization | String | |
| metadata | Mixed | Bounded: max 20 keys, values max 500 chars |
| privacyClassification | String | confidential / restricted / internal |
| verificationStatus | String | unverified / pending / verified / rejected |
| verificationRef | String | Optional future linkage to Mission 2 Trust |
| archivedAt | Date | Set on archive |

Indexes: `ownerUserId + status`, `ownerUserId + documentType + status`, `ownerUserId + expiresAt`.

---

## Versioning

`server/src/models/vault/VaultDocumentVersion.js`

Each file upload creates a new version record. VaultDocument.currentVersionId always points to the latest active version. Previous versions are retained with `lifecycleStatus: superseded`.

Version fields: documentId, ownerUserId, versionNumber, **storageKey** (server-only), storageProvider, originalFilename, mimeType, fileSize, checksum (SHA-256), uploadedAt, uploadedBy, scanStatus, lifecycleStatus.

Replacing a file: prior version marked `superseded`, new version created, `currentVersionId` updated atomically.

---

## File Validation

`server/src/middleware/vaultUpload.js`

- **Allowed MIME types**: PDF, DOCX, JPEG, PNG, WEBP
- **Magic-byte MIME sniffing** (reuses existing `fileValidation.sniffMime`)
- **Declared vs detected MIME** must match
- **Max size**: 20 MB (configurable via `VAULT_MAX_FILE_SIZE` constant)
- **Filename sanitization**: path traversal (`..`, `\0`) rejected; dangerous extensions rejected
- **No SVG/HTML/JS uploads**: explicitly excluded
- **No arbitrary storageKey from client**: key derived server-side

---

## Security Scan Boundary

`server/src/services/vault/securityScanService.js`

Provider-neutral injectable interface:

| Status | Meaning |
|--------|---------|
| not_configured | Default when `VAULT_SCANNER_PROVIDER` env is unset |
| pending | Scanner provider registered, scan queued |
| clean | Scanner confirmed safe |
| rejected | Scanner flagged file — access blocked |
| failed | Scanner error — access permitted per policy |

`runSecurityScan()` always throws until a real provider is wired. No fake clean result exists.

**Production prerequisite**: Configure `VAULT_SCANNER_PROVIDER` and implement `runSecurityScan` with real AV/malware service before enabling external document sharing.

---

## Private Access

`server/src/services/vault/vaultStorageService.js`

- `vaultUploadFile` — returns `{ storageKey, storageProvider, checksum }` only
- `vaultRetrieveFile` — called server-side after ownership/grant check; returns buffer (local) or short-lived signed URL (Cloudinary)
- `vaultDeleteFile` — deferred purge path only

**Download route** (`GET /api/vault/documents/:id/access`):
- Verifies ownership server-side before any file access
- Sets `Cache-Control: no-store, no-cache, must-revalidate, private`
- Sets `X-Content-Type-Options: nosniff`
- Sanitizes filename in `Content-Disposition`
- `?download=true` for attachment, default inline
- `?versionId=...` for specific version (ownership of version verified against document)

---

## Sharing Grants

`server/src/models/vault/DocumentAccessGrant.js`

| Field | Notes |
|-------|-------|
| documentId | Single document per grant |
| ownerUserId | Enforced |
| granteeType | agent / case / system |
| granteeId | Opaque string |
| purpose | Optional context |
| caseRef / consultationRef | Future Mission 14 linkage fields |
| permissions | view / download |
| status | active / expired / revoked |
| expiresAt | Optional time-bound |
| revokedAt / revokedBy | Set on revocation |

Sharing one document creates one grant for that document only. No implicit vault-wide access.

---

## Revocation

`server/src/services/vault/vaultAccessPolicy.revokeGrant`

- Only the `ownerUserId` can revoke their own grants.
- `findOneAndUpdate` with `{ status: 'active' }` guard — idempotent.
- `canAccessDocument` checks `grant.revokedAt` and `grant.status` on every access call.
- Revocation takes effect immediately on the next access attempt.
- Unrelated grants are untouched.
- Audit event `vault.grant.revoked` written on every revocation.

---

## Access Audit

`logAudit` (reuses Mission 1 `auditService.js` → `AuditLog` collection).

| Event action | When |
|---|---|
| vault.document.created | Document record created |
| vault.document.version_uploaded | New file version uploaded |
| vault.document.metadata_changed | Metadata patch applied |
| vault.document.viewed | GET single document |
| vault.document.accessed | File accessed / downloaded |
| vault.document.shared | Access grant created |
| vault.grant.revoked | Grant revoked |
| vault.document.archived | Document archived |
| vault.document.deleted | Document soft-deleted |

**Never audited**: file contents, raw passport/ID numbers, storage keys, checksums, permanent credentials.

---

## Expiry States

`server/src/services/vault/vaultExpiryService.js`

| State | Condition |
|-------|-----------|
| unknown | `expiresAt` is null or invalid |
| expired | `expiresAt` ≤ now |
| expiring_soon | `expiresAt` within 30 days |
| valid | `expiresAt` more than 30 days away |

Computed on read, never stored. Warning threshold configurable via `VAULT_EXPIRY_WARNING_DAYS`.

---

## Mission 9 Integration

`server/src/services/vault/documentAvailabilityService.js`

Clean read-only boundary. Journey Planner can call:

```js
checkDocumentAvailability(userId, 'passport')
// → { available: bool, expiryState, documentId, displayName }

checkMultipleDocumentAvailability(userId, ['passport', 'transcript'])
// → { passport: {...}, transcript: {...} }
```

- Returns `available: false` for unknown document types.
- An expired document returns `available: false`.
- Does NOT mutate requirement records.
- Does NOT duplicate file data into checklist records.

---

## Privacy / Public Leakage

- Vault endpoints are all authenticated (`requireAuth + requireUserAuth`).
- Storage keys never appear in any API response.
- Public profile APIs (`/api/public-profiles/*`) are untouched — Vault models have no reference there.
- `clientProjection` in VaultDocumentService omits `storageKey` from version responses.

---

## Retention / Deletion

- `deleteDocument` sets `status: deleted_pending_retention` — soft-delete only.
- Hard purge of storage files is deferred (requires storage-provider and retention-policy decision).
- Audit history is never deleted.
- `archiveDocument` sets `status: archived` with `archivedAt` timestamp.

---

## Agent / Case Integration Boundary (Future)

`server/src/services/vault/vaultAccessPolicy.canAccessDocument`

Signature:
```js
canAccessDocument({ actor, document, requiredPermission, grantId })
// → { allowed: bool, reason: string, grantId?: string }
```

- Actor type: `'user' | 'agent' | 'system'`
- No Agent role has implicit access. Future Mission 11/14 must obtain explicit DocumentAccessGrant.
- Permissions limited to `view` and `download` — no edit/delete ownership ever granted to agents.

---

## Admin Boundary

No admin document browser built. Admin cannot casually access private student vault documents. Privileged compliance access deferred.

---

## Tests

`server/src/__tests__/vaultDocumentVault.test.js` — **32 tests, 32 passed, 0 failed**

Key coverage: constants contract, expiry logic, scanner boundary (never fakes clean), MIME allowlist (no SVG/HTML/JS), access policy ownership/deletion/grant checks, download scan status gate.

## Build

Frontend production build: **passed** (no new errors).

---

## Production Prerequisites / Deferred

| Item | Status |
|------|--------|
| Real malware/AV scanner provider | Deferred — set `VAULT_SCANNER_PROVIDER` and implement `runSecurityScan` |
| Production storage provider rollout | Deferred — existing Cloudinary/local config reused |
| Agent document access | Deferred → Mission 11 |
| Case-specific sharing | Deferred → Mission 14 |
| Hard-purge retention policy | Deferred — storage-provider and legal/compliance decision required |
| Admin privileged compliance access | Deferred — requires explicit privileged-purpose audit |

---

## Files Created

**Shared**: `shared/vault/constants.js`

**Server models**: `server/src/models/vault/VaultDocument.js`, `VaultDocumentVersion.js`, `DocumentAccessGrant.js`

**Server services**: `server/src/services/vault/vaultStorageService.js`, `securityScanService.js`, `vaultExpiryService.js`, `vaultAccessPolicy.js`, `VaultDocumentService.js`, `documentAvailabilityService.js`

**Server middleware**: `server/src/middleware/vaultUpload.js`

**Server controllers/routes**: `server/src/controllers/vault/vaultController.js`, `server/src/routes/vault.js`

**Frontend**: `client/src/services/vaultApi.js`, `client/src/pages/Vault/VaultPage.jsx`, `VaultDocumentDetail.jsx`

**Tests**: `server/src/__tests__/vaultDocumentVault.test.js`

**Updated**: `server/src/routes/index.js`, `server/src/index.js`, `client/src/constants/index.js`, `client/src/routes/index.jsx`

---

## API Routes

```
GET    /api/vault/documents                  list (paginated, filtered)
POST   /api/vault/documents                  create + optional file upload
GET    /api/vault/documents/:id              get detail
PATCH  /api/vault/documents/:id              update metadata
POST   /api/vault/documents/:id/archive      archive
DELETE /api/vault/documents/:id              soft-delete
GET    /api/vault/documents/:id/versions     list versions (no storageKey)
POST   /api/vault/documents/:id/versions     upload new version
GET    /api/vault/documents/:id/access       private download/stream
GET    /api/vault/documents/:id/grants       list access grants
POST   /api/vault/documents/:id/grants       create grant
DELETE /api/vault/documents/:id/grants/:gid  revoke grant
```

All endpoints: authenticated users only (`requireAuth + requireUserAuth`).

---

## Real documents uploaded: No
## Live storage operations: No
## Live migrations/backfills: No
