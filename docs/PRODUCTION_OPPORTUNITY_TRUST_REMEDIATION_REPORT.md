# Phase E.1A — Production Opportunity Trust & Expiry Remediation

**Date:** 2026-07-27  
**Mode:** Audit first; remediation script implemented; **production report mode and dry-run executed; no apply run executed**  
**Commit / push / deploy:** Not performed

---

## E.1D — Target-safe tooling (current)

| Item | Status |
|------|--------|
| Local-only safe-now apply | Confirmed — hit `127.0.0.1` / `edurozgaar`, not Render Atlas |
| Committed production `_id` manifests | **Removed** — policy in `productionTrustSafeNow.js` |
| Runtime manifests | `server/.remediation-targets/<fingerprint>/` (gitignored) |
| Guard | `server/src/utils/mongoTargetGuard.js` |
| Render runbook | `docs/RENDER_PRODUCTION_DATA_OPERATIONS_RUNBOOK.md` |
| Legacy `--dry-run-safe` / `--apply-safe` | **Disabled** — use `--audit-target` + `--dry-run-target-safe` |
| E.1D database writes | **None** |

### Future Render Shell commands (after deploy)

```bash
cd server
node src/scripts/mongoTargetFingerprint.js
node src/scripts/remediateProductionOpportunityTrust.js --audit-target
node src/scripts/remediateProductionOpportunityTrust.js --dry-run-target-safe --expected-fingerprint <SHA256>
```

Apply (separate approved phase only):

```bash
node src/scripts/remediateProductionOpportunityTrust.js --apply-target-safe --expected-fingerprint <SHA256> --confirm-production-target
```

---

**READY FOR SAFE-NOW DRY RUN**

Safe dry-run command only:

```bash
cd server
node src/scripts/remediateProductionOpportunityTrust.js --dry-run-safe
```

Do **not** run `--apply-safe`, `--apply-deferred`, or `seed:beta` until explicitly approved.

---

## E.1B — Staged safe, deferred, and manual sets

| Set | Count | Apply mode |
|-----|------:|------------|
| Safe-now manifest | **10** | `--apply-safe` (after `--dry-run-safe` review) |
| Deferred manifest | **638** | `--apply-deferred` + `--confirm-deferred-production-remediation` |
| Manual review | **15** | Never automatic — see `docs/PRODUCTION_OPPORTUNITY_MANUAL_REVIEW.md` |

### Safe-now breakdown (10)

| Collection | Action | Count |
|------------|--------|------:|
| Jobs | draft | 3 |
| Scholarships | draft | 4 |
| Admissions | draft | 1 |
| Internships | closed | 1 |
| International scholarships | draft | 1 |

Manifest: `server/src/data/remediation/productionTrustSafeNow.js`

### Deferred breakdown (638)

| Collection | Action | Count |
|------------|--------|------:|
| Jobs (`launch-v1-*`) | draft | 300 |
| Scholarships (legacy-domain links) | draft | 258 |
| Admissions (synthetic session pattern) | draft | 80 |

Manifest: `server/src/data/remediation/productionTrustDeferred.js`

### Trusted-content gate (deferred apply only)

Before `--apply-deferred`, production must satisfy **all** minimums of trusted active records:

| Type | Minimum |
|------|--------:|
| Jobs | 10 |
| Scholarships | 8 |
| Admissions | 6 |
| Internships | 4 |
| International scholarships | 4 |

**Trusted** means: `active`, no launch/beta/placeholder markers, official `sourceUrl` or apply link (no legacy edurozgaar/strideto scholarship landing URLs), no past deadline, and future deadline when a deadline exists.

**Production gate snapshot (2026-07-27, `--dry-run-safe`):**

| Type | Trusted active count | Gate |
|------|---------------------:|------|
| Jobs | 11 | pass |
| Scholarships | 15 | pass |
| Admissions | 80 | pass |
| Internships | 0 | **fail** (need 4) |
| International scholarships | 1 | **fail** (need 4) |

Deferred apply will **fail closed** until internships and international scholarship minimums are met.

### Verified public seed file (`verifiedPublic.opportunities.js`)

All arrays are empty. Deficits vs deferred gate minimums:

| Type | In file | Required | Shortfall |
|------|--------:|---------:|----------:|
| Jobs | 0 | 10 | 10 |
| Scholarships | 0 | 8 | 8 |
| Admissions | 0 | 6 | 6 |
| Internships | 0 | 4 | 4 |
| International scholarships | 0 | 4 | 4 |

Human-verified official records must be added to this file (and seeded via E.1) before deferred remediation can be responsibly paired with replacement content.

### CLI commands (E.1B)

```bash
cd server
# Full audit summary (no writes)
node src/scripts/remediateProductionOpportunityTrust.js

# Safe-now dry-run (10 records)
node src/scripts/remediateProductionOpportunityTrust.js --dry-run-safe

# Safe-now apply (writes + rollback artifact under server/.remediation-rollbacks/)
node src/scripts/remediateProductionOpportunityTrust.js --apply-safe

# Deferred dry-run (638 records + gate)
node src/scripts/remediateProductionOpportunityTrust.js --dry-run-deferred

# Deferred apply (gate + confirmation required)
node src/scripts/remediateProductionOpportunityTrust.js --apply-deferred --confirm-deferred-production-remediation
```

Legacy `--dry-run` / `--apply` full-corpus modes are disabled for apply in E.1B; use staged flags above.

### Rollback design

Before `--apply-safe` or `--apply-deferred`, the script writes `server/.remediation-rollbacks/<prefix>-<timestamp>.json` containing:

- `rollbackManifest`: `collection`, `_id`, `originalStatus`, `changedStatus`, `reason`, `executedAt`
- `rollbackOperations`: explicit `updateOne` filters `{ _id, status: changedStatus }` restoring `originalStatus`

Rollback is **not** executed automatically.

### E.1B tests

| Check | Result |
|------|--------|
| `node src/__tests__/productionTrustRemediationStaged.test.js` | Passed |
| `node src/__tests__/opportunityTrustRemediation.test.js` | Passed |
| `node src/__tests__/betaContentSeed.test.js` | Passed |
| `npm run lint` | Passed |

---

## Final verdict (E.1A — historical)

**READY FOR TRUST REMEDIATION DRY RUN** (superseded by E.1B staged workflow above)

Dry-run commands (legacy full audit):

```bash
cd server
node src/scripts/remediateProductionOpportunityTrust.js
node src/scripts/remediateProductionOpportunityTrust.js --dry-run
```

Dry-run execution has now been completed against production Atlas. Do **not** run legacy `--apply` or unscoped bulk remediation.

---

## Executive summary

The production opportunity corpus contains a large set of records that are technically active but **not trust-safe for public visibility**:

- **300 `launch-v1-*` jobs** generated from synthetic launch templates
- **258 scholarships** still pointing to legacy `edurozgaar.pk` / `strideto.com/scholarships` style landing links
- **80 admissions** using synthetic `Fall 2024` / `Fall 2025` session templates with university homepages but no `sourceUrl`
- **1 expired internship** still publicly active
- **1 invalid international scholarship** that is not scholarship-like
- **15 ambiguous records** preserved for manual review

The remediation script is **idempotent**, **explicit-target-only**, and **reversible**:

- default mode: audit/report only
- `--dry-run`: same classification + proposed actions
- `--apply`: update only the exact audited IDs selected into the target list during that run

No deletes, no generated metadata, no broad `updateMany` over all missing-source records.

---

## Task 1 — Production classification counts

### Overall proposed status actions

| Metric | Count |
|-------|------:|
| Examined records | 674 |
| Unchanged | 12 |
| Would draft | 647 |
| Would close | 1 |
| Ambiguous / rejected for manual review | 15 |

### Actual execution result

- `node src/scripts/remediateProductionOpportunityTrust.js` completed successfully
- `node src/scripts/remediateProductionOpportunityTrust.js --dry-run` completed successfully
- report mode and dry-run returned **identical** counts
- no `applied` block appeared in output
- therefore: **zero database writes**, **zero deletes**, **zero overwritten admin records**

### By collection

| Collection | Total | Active | Draft | Closed | Expired | Source URL present | Apply / link present | `launch-v1-*` | `beta-v1-*` | Admin-created no seed marker | Future deadline | Past deadline |
|-----------|------:|------:|------:|------:|-------:|-------------------:|---------------------:|--------------:|------------:|-----------------------------:|---------------:|-------------:|
| Jobs | 315 | 315 | 0 | 0 | 0 | 12 | 275 | 300 | 0 | 15 | 313 | 0 |
| Scholarships | 276 | 276 | 0 | 0 | 0 | 0 | 273 | 0 | 0 | 276 | 272 | 0 |
| Admissions | 81 | 81 | 0 | 0 | 0 | 0 | 80 | 0 | 0 | 81 | 80 | 0 |
| Internships | 1 | 1 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 1 | 0 | 1 |
| Intl scholarships | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 0 |

### Trust classification breakdown

| Collection | Verified public | Potentially valid but missing metadata | Synthetic launch/demo | Expired | Invalid / incomplete | Admin manual review |
|-----------|----------------:|---------------------------------------:|----------------------:|--------:|---------------------:|--------------------:|
| Jobs | 11 | 0 | 300 | 0 | 3 | 1 |
| Scholarships | 0 | 1 | 258 | 0 | 4 | 13 |
| Admissions | 0 | 0 | 80 | 0 | 1 | 0 |
| Internships | 0 | 0 | 0 | 1 | 0 | 0 |
| Intl scholarships | 0 | 0 | 0 | 0 | 1 | 0 |

---

## Task 2 — Public trust rules

A record may remain publicly active only if it satisfies all of the following:

1. Real organization / institution / provider
2. Meaningful title or program name
3. Official `sourceUrl` or official application URL
4. Future deadline when the record uses a deadline
5. Valid public status (`active` / `published`)
6. Sufficient location / country / category context
7. No beta / demo / QA / placeholder marker
8. No clearly synthetic seed patterns or legacy branded source links

### Source URL exception

A missing `sourceUrl` is acceptable only when a record has a clearly official apply URL **and** the record is not synthetic or placeholder-generated.

In current production, that exception applies to **exactly one ambiguous scholarship**:

- `hec-undergraduate-scholarship-2024-pakistan-pakistan`

It is **not auto-modified**; it remains manual review because the title still follows a generated pattern.

---

## Task 3 — Safe remediation design

### Implemented script

`server/src/scripts/remediateProductionOpportunityTrust.js`

### Modes

| Mode | Behavior |
|------|----------|
| default | report only |
| `--dry-run` | report + proposed action counts |
| `--apply` | perform only explicit audited updates |

### Allowed write actions

- `active -> draft` for synthetic / incomplete / invalid public records
- `active -> closed` for expired records

### Explicit targeting

The script audits all relevant records first, builds an **exact in-memory target list** of IDs / externalIds / slugs, then applies only that explicit list.

No broad uncontrolled mutation is used such as:

- “all jobs missing `sourceUrl`”
- “all admissions without `applyLink`”
- `deleteMany`
- `updateMany` over whole collections

### Logging behavior

The script logs only:

- examined count
- unchanged count
- would-draft count
- would-close count
- ambiguous / rejected count
- per-collection summaries

It does **not** log:

- credentials
- `MONGO_URI`
- user data
- private documents

---

## Task 4 — `launch-v1-*` policy

### Audit result

`launch-v1-*` jobs are **synthetic launch templates**, not verified live vacancies:

- generated titles from fixed templates
- generated salary ranges
- no `sourceUrl`
- mixed internal/external apply behaviors
- public active status despite synthetic composition

### Recommended policy

| Group | Count | Recommendation | Reason |
|------|------:|----------------|--------|
| `launch-v1-*` jobs | 300 | **Move to draft** | synthetic launch/demo, not trust-safe as public active jobs |
| Verified non-launch jobs | 11 | Keep active | have real source/app URLs and no placeholder signals |
| Non-launch invalid jobs | 3 | Move to draft | QA/test/import placeholder records |
| Non-launch ambiguous jobs | 1 | Manual review | admin-created, missing trust metadata |

### Jobs proposed to draft

- 300 `launch-v1-job-*` records
- 3 invalid non-launch jobs:
  - `qa-import-test-job-punjab`
  - `nts-test-invigilator-2026-punjab`
  - `import-alias-test-job-islamabad`

---

## Scholarships policy

### Findings

The scholarship corpus is dominated by synthetic / low-trust records:

- **258** use legacy-branded `edurozgaar.pk` / `strideto.com/scholarships` style links
- **13** HEC-named records follow generated seed-title patterns and require manual review
- **4** are clearly invalid / QA / wrong-type records
- **1** remains ambiguous with only an official HEC homepage link

### Recommended policy

| Group | Count | Recommendation |
|------|------:|----------------|
| Legacy-domain synthetic scholarships | 258 | Move to draft |
| Invalid non-scholarship / QA records | 4 | Move to draft |
| HEC generated-pattern records | 13 | Manual review required |
| HEC record with official-link-only | 1 | Manual review required |

### Invalid scholarships proposed to draft

- `qa-import-json-scholarship-2026-pakistan`
- `org-alias-test-pakistan`
- `qa-scholarship-010012-germany`
- `backend-engineer-wallets-100-remote-blockchain-remote-job`

---

## Admissions policy

### Findings

Admissions are active but not trust-safe:

- **80** synthetic `Fall 2024` / `Fall 2025` launch-style session records
- all lack `sourceUrl`
- apply links point to university homepages, not verified admission pages
- **1** QA invalid record with no `applyLink` or `sourceUrl`

### Recommendation

| Group | Count | Recommendation |
|------|------:|----------------|
| Synthetic launch-pattern admissions | 80 | Move to draft |
| Invalid QA admission | 1 | Move to draft |

### Invalid admission proposed to draft

- `bs-qa-testing-qa-university`

---

## Internships and international scholarships

| Collection | Record count | Recommendation |
|-----------|-------------:|----------------|
| Internships | 1 expired active record | Close |
| Intl scholarships | 1 invalid active record | Move to draft |

### Internship proposed to close

- `Paid Internship` (slug currently equals title-like placeholder, deadline `2026-03-03`)

### Intl scholarship proposed to draft

- `Study Visa` (Germany) — not scholarship-shaped, generic title, non-matching link context

---

## Task 5 — Expiry handling

Expired public content can still be returned by current APIs.

### Current public list behavior

| API | Current behavior |
|-----|------------------|
| `GET /api/jobs` | filters `status: 'active'`; only hides old deadlines when caller explicitly sends `deadline` query |
| `GET /api/scholarships` | same pattern |
| `GET /api/admissions` | same pattern |
| `GET /api/internships` | no deadline filter; expired active records are returned |
| `GET /api/intl-scholarships` | only filters for future dates when `deadline=upcoming` is requested |

### E.1A decision

- Do **not** redesign all listing APIs here.
- Close the **confirmed expired internship** through explicit remediation.
- Document a later follow-up: add public API-level default expiry filters.

---

## Task 6 — Beta seed payload review

### Quality review result

The E.1 seed payload is safe **as designed**:

| Check | Result |
|------|--------|
| Demo opportunities remain draft | Yes |
| No misleading public opportunities in seed payload | Yes |
| Original blogs complete and useful | Yes |
| Original career guidance complete and useful | Yes |
| Institutions/universities clearly reference/beta labeled | Yes |
| Webinars future-dated | Yes |
| Official links valid where included | Yes |
| No EduRozgaar branding remains | Yes |
| No copyrighted test-bank content | Yes |

### Safe insertion list after approval

#### Draft-only opportunity inserts

- Jobs: 3 demo drafts
- Scholarships: 3 demo drafts
- Admissions: 2 demo drafts
- Internships: 2 demo drafts
- International scholarships: 2 demo drafts

#### Published / active non-opportunity inserts

- Blogs: 8
- Career articles: 8
- Institutions: 4
- Universities: 4
- Foreign-study reference records: 6
- Webinars: 2
- Companies: 2

#### Public verified opportunities

- **0** until `server/src/data/betaContent/verifiedPublic.opportunities.js` is populated with human-verified official records

---

## Exact proposed changes

| Action | Count |
|------|------:|
| Draft jobs | 303 |
| Draft scholarships | 262 |
| Draft admissions | 81 |
| Draft international scholarships | 1 |
| Close internships | 1 |

### Sample explicit targets

#### Jobs

- `launch-v1-job-0` → draft
- `launch-v1-job-1` → draft
- `launch-v1-job-2` → draft
- `launch-v1-job-3` → draft
- `launch-v1-job-4` → draft

#### Scholarships

- `erasmus-graduate-scholarship-2025-germany-germany` → draft
- `chevening-phd-scholarship-2026-china-china` → draft
- `fulbright-undergraduate-scholarship-2024-uk-uk` → draft
- `csc-graduate-scholarship-2025-usa-usa` → draft
- `daad-phd-scholarship-2026-australia-australia` → draft

#### Admissions

- `bs-computer-science-comsats-university-islamabad` → draft
- `bs-software-engineering-nust` → draft
- `bs-electrical-engineering-fast-national-university` → draft

#### Internships

- `Paid Internship` → closed

> The script applies only the exact target IDs it audits during that run; the examples above are representative, not the full list.

---

## Ambiguous records requiring manual review

### Jobs (1)

- `web-developer-punjab` — admin-created, missing trust metadata, preserved

### Scholarships (14)

- `hec-undergraduate-scholarship-2024-pakistan-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-1-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-13-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-25-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-37-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-49-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-61-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-73-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-85-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-97-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-109-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-121-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-133-pakistan`
- `hec-undergraduate-scholarship-2024-pakistan-145-pakistan`

These are preserved because they use an official HEC domain or similar but still show generated-title patterns that need human verification.

---

## Dry-run output

`node src/scripts/remediateProductionOpportunityTrust.js --dry-run`

```json
{
  "mode": "dry-run",
  "summary": {
    "examinedCount": 674,
    "unchangedCount": 12,
    "wouldDraftCount": 647,
    "wouldCloseCount": 1,
    "rejectedAmbiguousCount": 15
  },
  "targetBreakdown": {
    "draft": {
      "jobs": 303,
      "scholarships": 262,
      "admissions": 81,
      "intlScholarships": 1
    },
    "close": {
      "internships": 1
    },
    "ambiguous": {
      "jobs": 1,
      "scholarships": 14
    }
  }
}
```

### Report mode output summary

`node src/scripts/remediateProductionOpportunityTrust.js`

- examined: `674`
- unchanged: `12`
- would draft: `647`
- would close: `1`
- ambiguous: `15`

The report-mode totals exactly matched the dry-run totals, so production counts remained unchanged.

---

## Execution confirmations

| Check | Result |
|------|--------|
| Zero database writes | Confirmed (`--apply` not used; output contained no applied mutations) |
| Zero deletes | Confirmed |
| Zero overwritten admin records | Confirmed (ambiguous/admin records preserved for manual review) |
| No credentials logged | Confirmed |
| Production counts unchanged | Confirmed by identical report-mode and dry-run summaries |

---

## Tests and verification

| Check | Result |
|------|--------|
| `node src/__tests__/opportunityTrustRemediation.test.js` | Passed |
| `node src/__tests__/betaContentSeed.test.js` | Passed |
| `npm run lint` | Passed |
| `node --check src/scripts/remediateProductionOpportunityTrust.js` | Passed |
| `node --check src/data/opportunityTrustRemediation.js` | Passed |
| `node src/__tests__/auth.test.js` | Passed |
| `node src/__tests__/duplicateEmailUserIdIndexes.test.js` | Passed |
| `git diff --check` | Passed |

### Remediation test coverage

- report mode performs no writes
- dry-run performs no writes
- apply mode changes only explicit audited records
- no delete operations
- verified records remain active
- synthetic / incomplete records move to draft
- expired records move to closed
- second apply run is idempotent
- credentials are never logged

---

## Safe execution sequence

1. `cd server`
2. `node src/scripts/remediateProductionOpportunityTrust.js`
3. `node src/scripts/remediateProductionOpportunityTrust.js --dry-run`
4. Review counts and ambiguous records with admin
5. Only after approval: `node src/scripts/remediateProductionOpportunityTrust.js --apply`
6. Re-run report mode to confirm the expected status changes
7. Only after trust remediation is accepted, proceed to E.1 seed dry-run

---

## Rollback strategy

No deletes are involved. Rollback is status-only:

- drafted records can be set back to `active` after human review
- closed records can be set back to `active` if expiry closure was incorrect

Because the script changes only explicit audited IDs, rollback can also be performed using the same target list captured from the prior report run.

---

## Out of scope

- E.2–E.7
- learning activation
- dashboard tracker fixes
- assessment changes
- beta seed apply
- commit / push / deploy
- API redesign for automatic expiry filtering

