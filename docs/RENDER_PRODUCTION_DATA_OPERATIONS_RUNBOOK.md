# Render production data operations runbook

**Phase E.1D+** — Target-safe remediation and beta seeding on the **same** MongoDB target Render uses.

Never copy `MONGO_URI` to a laptop. Never paste environment variables into tickets or chat.

---

## Prerequisites

1. E.1D target-safe tooling is **committed and pushed** to GitHub.
2. Render **strideto-api** (or active backend web service) has deployed that **exact commit** (`/api/health/ready` shows expected `appEnv`).
3. You have Render Dashboard access (Shell + deploy history).

---

## Safe sequence (remediation)

### 1. Deploy audited scripts

- Merge/push target-safe remediation changes to the branch Render tracks (usually `main`).
- Wait until the Render deploy finishes and health checks pass.

### 2. Open Render Shell

- Dashboard → backend web service → **Shell** (not local terminal with `.env`).

### 3. Fingerprint the live target

```bash
cd server
node src/scripts/mongoTargetFingerprint.js
```

Record **only**:

- `hostname`
- `effectiveDatabaseName`
- `fingerprintSha256`

Do **not** share shell output that includes env vars.

### 4. Audit target (read-only, writes manifests)

```bash
node src/scripts/remediateProductionOpportunityTrust.js --audit-target
```

This creates (on the Render filesystem):

`server/.remediation-targets/<fingerprintSha256>/`

- `safe-now.json`
- `deferred.json`
- `manual-review.json`
- `target-summary.json`

Review `targetSummary` counts in the command JSON output. Download or securely archive these files if needed — **Render Shell storage may be ephemeral**.

### 5. Dry-run safe apply (still zero writes)

```bash
node src/scripts/remediateProductionOpportunityTrust.js \
  --dry-run-target-safe \
  --expected-fingerprint <fingerprintSha256>
```

Fails closed if:

- target is localhost / LAN
- fingerprint mismatch
- manifest stale
- any safe target changed since audit

### 6. Stop for human approval

Do **not** apply in the same session unless explicitly approved in a separate phase.

### 7. Production apply (separate approved phase only)

```bash
node src/scripts/remediateProductionOpportunityTrust.js \
  --apply-target-safe \
  --expected-fingerprint <fingerprintSha256> \
  --confirm-production-target
```

Requires fresh dry-run stamp, non-local target, rollback file under `server/.remediation-rollbacks/` written **before** updates.

---

## Beta seed (future)

Dry-run (prints fingerprint, no insert):

```bash
npm run seed:beta -- --dry-run
```

Production insert (separate approval):

```bash
npm run seed:beta -- \
  --expected-fingerprint <fingerprintSha256> \
  --confirm-production-target
```

Requires matching `target-summary.json` from `--audit-target` on the **same** fingerprint.

---

## Disabled / unsafe patterns

| Pattern | Why |
|---------|-----|
| Running `--apply-safe` / old committed manifests | Removed in E.1D |
| Local laptop `MONGO_URI` for production apply | Remediation previously hit `127.0.0.1` only |
| Applying without `--expected-fingerprint` | Fail closed |
| Skipping `--audit-target` on Render | ObjectIds are target-specific |

---

## Rollback artifacts

- Path: `server/.remediation-rollbacks/`
- Gitignored — do not commit
- Copy to secure ops storage before Shell session ends if rollback may be needed later

---

## Verification after apply (approved phase)

1. Re-run `mongoTargetFingerprint.js` — job counts should reflect status shifts only.
2. `GET /api/jobs` — `pagination.total` and titles spot-check.
3. Second `--apply-target-safe` should report all `unchanged` (idempotent) or be skipped.

---

## Zero-write confirmation for audit/dry-run

`--audit-target` and `--dry-run-target-safe` perform **no** `updateOne`, `updateMany`, `deleteMany`, or seed inserts.
