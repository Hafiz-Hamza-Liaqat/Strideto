# Phase E.1 — Beta Content Seed Implementation Report

**Date:** 2026-07-27  
**Mode:** Implementation complete; **production insertion not executed**  
**Commit / push / deploy:** Not performed

---

## Final verdict

**READY FOR BETA SEED DRY RUN**

**Dry-run command (from `server/`):**

```bash
npm run seed:beta -- --dry-run
```

Do **not** run without `--dry-run` on production until ops approves verified public opportunity data.

---

## Production coverage snapshot summary

Read-only report generated against Atlas via `MONGO_URI` (credentials not logged). Full detail: [`PRODUCTION_CONTENT_COVERAGE_SNAPSHOT.md`](PRODUCTION_CONTENT_COVERAGE_SNAPSHOT.md).

| Area | Total | Active / published | Notable gaps |
|------|-------|-------------------|--------------|
| Jobs | 315 | 315 active | 300 `launch-v1-*`; **303 active missing `sourceUrl`** |
| Scholarships | 276 | 276 active | 3 missing official link |
| Admissions | 81 | 81 active | **81 missing sourceUrl or applyLink** |
| Internships | 1 | 1 active | **1 past deadline** |
| Intl scholarships | 1 | 1 active | Low count |
| Blogs | 202 | 202 published | Strong |
| Career articles | 100 | 100 published | Strong |
| Institutions | **0** | 0 | **Empty** |
| Universities | 10 | 10 active | OK |
| Foreign studies | 100 | 100 active | OK |
| Webinars | **0** | 0 upcoming | **Empty** |
| Companies / employers | 22 / 16 | — | Verified subset exists |
| Exams / quizzes / MCQs | 10 / 10 / 1000 | active | Exam prep populated (audit only in E.1) |
| Assessments | 11 | 11 published | Present (E.1 does not modify) |

**Regenerate snapshot:**

```bash
cd server && node src/scripts/reportProductionContentCoverage.js --write-docs=docs/PRODUCTION_CONTENT_COVERAGE_SNAPSHOT.md
```

---

## Current gaps vs beta matrix

| Target | Status | E.1 seed approach |
|--------|--------|-------------------|
| 10 **trusted** active jobs | **Gap** — launch jobs lack `sourceUrl` | Draft demo jobs only; **public active jobs require human-verified entries** in `verifiedPublic.opportunities.js` |
| 8 active scholarships (levels + funding) | Volume OK; trust gap on links | Draft templates + verified file empty |
| 6 admissions | Volume OK; missing apply/source metadata | Draft templates |
| 4 internships | **Gap** (1 expired) | 2 draft templates |
| 4 intl scholarships | **Gap** | 2 draft templates |
| 8 blogs / 8 career (4+ categories) | **Met** in prod | +8 Strideto originals each on seed |
| 4 institutions (all types) | **Gap** (0 in prod) | 4 reference institutions on seed |
| 4 universities | Met | +4 beta reference profiles |
| 6 foreign study / 3 countries | Met in prod | +6 orientation records |
| 2 upcoming webinars | **Gap** | 2 scheduled Strideto beta sessions |
| 2 verified companies + jobs | Partial | 2 demo companies; jobs stay draft |

---

## Content matrix (E.1 seed payload)

| Bucket | Insert count (first run) | Visibility |
|--------|--------------------------|------------|
| Demo jobs | 3 | `draft`, `beta-v1-*` externalId |
| Demo scholarships | 3 | `draft` |
| Demo admissions | 2 | `draft` |
| Demo internships | 2 | `draft` |
| Demo intl scholarships | 2 | `draft` |
| Blogs | 8 | `published`, original Strideto copy |
| Career articles | 8 | `published`, original |
| Institutions | 4 | `active`, beta reference |
| Universities | 4 | `active`, beta reference |
| Foreign study | 6 | `active`, official portal links |
| Webinars | 2 | `scheduled`, future dates |
| Companies | 2 | `verified` demo shells |
| Verified public opportunities | 0 | **File empty by design** |

---

## Public vs demo policy

### Public verified (active)

- Real title and organization  
- Official `sourceUrl` / `link` / `applyLink`  
- Future deadline (validated in `validatePublicOpportunity.js`)  
- `status: active` or `published`  
- No invented salary, eligibility, or location  

Loaded only from `server/src/data/betaContent/verifiedPublic.opportunities.js`.

### Demo / admin-preview

- `status: draft` (opportunities) or clearly labeled reference copy  
- `beta-v1-` slug or `externalId`  
- Title includes `[Strideto beta demo — draft only, not a live opportunity]` where applicable  
- Excluded from public active listing queries  

---

## Seed safety design

| Rule | Implementation |
|------|----------------|
| No `deleteMany` | Insert-only via `insertIfMissing`; static checks in tests |
| Stable id | `beta-v1-` prefix on `externalId` / `slug` |
| Idempotent | Skip when filter match exists — **no updates** to existing docs |
| Admin edits preserved | Existing row → skip (never `$set`) |
| Dry-run | `--dry-run` → `would_insert` counts, zero `Model.create` |
| Disable gate | `BETA_SEED_DISABLE=1` → exit 0, no DB writes |
| MONGO_URI | Required; never logged |
| Assessments | **Not seeded** in E.1 |
| n8n / trackers / auth | **Not touched** |

---

## Dry-run output (local/Atlas, 2026-07-27)

```
beta seed complete dryRun=true
jobs: inserted=3 skipped=0 rejected=0
scholarships: inserted=3 skipped=0 rejected=0
admissions: inserted=2 skipped=0 rejected=0
internships: inserted=2 skipped=0 rejected=0
intlScholarships: inserted=2 skipped=0 rejected=0
blogs: inserted=8 skipped=0 rejected=0
careerArticles: inserted=8 skipped=0 rejected=0
institutions: inserted=4 skipped=0 rejected=0
universities: inserted=4 skipped=0 rejected=0
foreignStudies: inserted=6 skipped=0 rejected=0
webinars: inserted=2 skipped=0 rejected=0
companies: inserted=2 skipped=0 rejected=0
```

Second run (after real insert): all lines show `skipped` > 0, `inserted=0`.

---

## Test results

| Check | Result |
|-------|--------|
| `node src/__tests__/betaContentSeed.test.js` | Passed |
| `npm run lint` | Passed |
| `node --check` seed + runner | Passed |
| `node src/__tests__/auth.test.js` | Passed |
| `node src/__tests__/duplicateEmailUserIdIndexes.test.js` | Passed |
| `git diff --check` | Passed (CRLF warning on package.json only) |
| Production seed execution | **Not run** |

Tests cover: dry-run no writes, duplicate skip, admin-existing skip, public validation, demo draft rules, no destructive ops in seed script, `BETA_SEED_DISABLE` gate, no MONGO_URI logging.

---

## Files changed / added

| Path | Purpose |
|------|---------|
| `server/src/scripts/reportProductionContentCoverage.js` | Read-only Atlas coverage |
| `server/src/scripts/seedBetaContent.js` | CLI entry |
| `server/src/data/betaContent/*` | Data, validation, runner |
| `server/src/__tests__/betaContentSeed.test.js` | Focused tests |
| `server/package.json` | `seed:beta` script |
| `docs/PRODUCTION_CONTENT_COVERAGE_SNAPSHOT.md` | Task 1 output |
| `docs/BETA_CONTENT_SEED_IMPLEMENTATION_REPORT.md` | This report |

---

## Future production execution (when approved)

From repository `server/` directory, with `MONGO_URI` set and **`BETA_SEED_DISABLE` unset**:

```bash
npm run seed:beta -- --dry-run
npm run seed:beta
```

Review inserted counts; re-run should show all `skipped`.

---

## Rollback / disable

| Action | Command / behavior |
|--------|---------------------|
| Disable seed | `BETA_SEED_DISABLE=1` |
| Rollback beta inserts (staging ops only) | Delete by marker: `externalId` /^`beta-v1-`/ or `slug` /^`beta-v1-`/ per collection — **manual**, not automated in E.1 |
| Editorial rollback | Delete `slug` matching `^beta-v1-` for blogs/career articles |

Do not bulk-delete `launch-v1-*` without separate ops approval.

---

## Records still requiring human-provided official data

1. **Public active jobs** — curated postings with PPSC/FPSC/employer URLs and deadlines (replace reliance on 300 launch jobs without `sourceUrl`).  
2. **Public active scholarships/admissions** — verified program pages and apply links.  
3. **Internships** — replace or close the single expired active internship.  
4. **International scholarships** — expand beyond one record with official links.  
5. **Trust/editorial pages** — out of scope for E.1 seed (Phase E.5).  

Populate `verifiedPublic.opportunities.js` after verification, then dry-run and insert.

---

## Follow-up (not in E.1)

- Listing APIs do not hide past deadlines globally — consider **E.1 follow-up** API filter if expired internships/jobs appear on public lists.  
- Exam prep: audited only; no seed changes in E.1.  
- Assessments: already published in prod; activation/testing deferred to E.3.

---

## Out of scope (confirmed)

- E.2–E.7, n8n, dashboard trackers, auth changes, assessment activation, commit, push, deploy, production seed execution.
