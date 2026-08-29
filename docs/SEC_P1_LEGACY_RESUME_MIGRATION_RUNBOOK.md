# SEC-P1 Legacy Application Resume Migration Runbook

Operational guide for migrating pre-MKT-P3 public application resumes to private storage.
**Do not run production migration without explicit operator approval.**

## PRECHECK

1. Confirm production backup / Mongo snapshot readiness.
2. Verify `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` on production.
3. Confirm MKT-P3 employer resume endpoint is healthy (`GET /api/employer/applications/:id/resume`).
4. Ensure no concurrent application resume storage code deploy is in flight.

## DRY RUN (inventory — no mutation opt-in required)

Performs zero upload, zero DB mutation, zero delete. **Do not set `ALLOW_LEGACY_RESUME_MIGRATION` for dry-run.**

```powershell
node server/src/scripts/migrateLegacyApplicationResumes.js
```

Optional machine-readable report (must be under system temp, outside repo):

```powershell
node server/src/scripts/migrateLegacyApplicationResumes.js `
  --report-file="$env:TEMP\sec-p1-inventory.json"
```

## REVIEW COUNTS

| Class | Action |
|-------|--------|
| Already private | Skip — idempotent |
| Legacy local | Migrate via private upload |
| Legacy Cloudinary | Re-upload as `type: authenticated` |
| Unknown / legacy remote | **Manual review — never auto-migrate** |
| Missing | Skip |

## EXECUTE (production — operator approved only)

**Documentation only — do not run without approval.**

```powershell
$env:ALLOW_LEGACY_RESUME_MIGRATION = "1"
try {
    node server/src/scripts/migrateLegacyApplicationResumes.js `
      --execute `
      --allow-production `
      --limit=50 `
      --report-file="$env:TEMP\sec-p1-batch1.json"
}
finally {
    Remove-Item Env:ALLOW_LEGACY_RESUME_MIGRATION -ErrorAction SilentlyContinue
}
```

`--limit=50` bounds the number of **application records scanned** in cursor order (not “50 writes” guaranteed). Invalid values (`0`, negative, non-integer) are rejected.

## VERIFY

1. Sample migrated applications: DB `resumeURL` uses private descriptor prefix (production: `strideto-cloudinary:application/…`).
2. Employer list/detail JSON shows `hasResume: true`, no raw `resumeURL`.
3. Authorized employer resume download succeeds.
4. Re-run dry-run: eligible count should drop.

## CLEANUP (separate phase — after verify)

Cleanup requires `--from-report`. The report is **checkpoint input only** — each entry is revalidated against live DB state (private descriptor fingerprint match) before any delete.

**Documentation only — do not run without approval.**

```powershell
$env:ALLOW_LEGACY_RESUME_MIGRATION = "1"
try {
    node server/src/scripts/migrateLegacyApplicationResumes.js `
      --cleanup `
      --apply `
      --allow-production `
      --from-report="$env:TEMP\sec-p1-batch1.json"
}
finally {
    Remove-Item Env:ALLOW_LEGACY_RESUME_MIGRATION -ErrorAction SilentlyContinue
}
```

Cleanup dry-run (no delete):

```powershell
node server/src/scripts/migrateLegacyApplicationResumes.js `
  --cleanup `
  --from-report="$env:TEMP\sec-p1-batch1.json"
```

- **Batch boundary:** cleanup processes journal entries from the report sequentially (not full collection scan).
- **Local legacy files:** deleted only when DB revalidation passes and path is confined to legacy uploads root.
- **Legacy public Cloudinary:** `CLEANUP_MANUAL_REQUIRED` — operator revokes exact asset manually.

## POSTCHECK

1. Re-run inventory dry-run.
2. Target: zero `Legacy local` / `Legacy Cloudinary` except documented exceptions.
3. Archive migration report outside repo (not committed).

## ROLLBACK / STOP CONDITIONS

### Before cleanup

Restore original `resumeURL` via compare-and-set if private migration is faulty. Private asset may remain orphaned.

### After cleanup

Public legacy source is gone. Rollback requires private descriptor to remain valid.

### Global stop

- `cloudinary_not_configured` in production
- `production_guard_missing` / missing `--allow-production`
- `report_database_mismatch` / `report_version_unsupported`
- Unexpected spike in `failed_verify` or `db_conflict`

## MODE REFERENCE

| Mode | Flags | Mutates? |
|------|-------|----------|
| Inventory dry-run | *(default)* | No |
| Migrate execute | `--execute` | Yes (DB + private storage) |
| Cleanup dry-run | `--cleanup --from-report=…` | No |
| Cleanup apply | `--cleanup --apply --from-report=…` | Yes (local legacy file only) |

`--execute` and `--cleanup` cannot be combined.
