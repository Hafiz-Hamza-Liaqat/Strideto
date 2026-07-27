# Phase E.1C — Live Render / Mongo Data-Source Alignment Audit

**Date:** 2026-07-27  
**Mode:** Read-only diagnosis (no Atlas writes, no remediation apply, no Render env changes)  
**Live API probed:** `https://strideto.onrender.com/api` (health confirms `mongo: up`, `appEnv: production`)

---

## Executive summary

| Question | Answer |
|----------|--------|
| Is “12 jobs” pagination only? | **No.** `pagination.total` is **12** with `limit=50`; the full public corpus on Render is 12 active jobs. |
| Why is NTS still public on Render? | Render’s MongoDB still has an **active** `NTS Test Invigilator 2026` with the same slug/externalId. The remediated copy is on a **different MongoDB target** (local loopback), where that record is **draft**. |
| Same DB as remediation scripts? | **No.** Local fingerprint: hostname **`127.0.0.1`**, database **`edurozgaar`**, 315 jobs. Render API implies a separate dataset (12 public jobs, scraper jobs dated 2026-07-25). |
| Duplicate active NTS on remediated connection? | **No** — exactly one match per identifier; status **draft**; **0** active duplicates. |
| Primary root-cause class | **5 — Different Atlas cluster / Mongo host** (local loopback vs Render’s configured `MONGO_URI`) |

**Recommended action (do not execute in E.1C):** **Correct application / ops Mongo target** — run remediation and audits against the **same** `MONGO_URI` Render uses (Atlas), then re-apply safe-now on that target if still needed.

---

## Task 1 — API pagination verification

### Code facts (`jobsController.js`)

| Setting | Value |
|---------|--------|
| Default page size | **10** (`DEFAULT_LIMIT`) |
| Maximum page size | **50** (`MAX_LIMIT`) |
| Pagination shape | `data`, `pagination: { page, limit, total, totalPages }`, optional `filters` (`listResponse` / `paginate`) |

### Public list filters (`buildJobQuery`)

Always applied:

- `status: 'active'`
- `approvalStatus: 'approved'` OR `approvalStatus` missing

Optional query filters: `province`, `category`, `organization`, `deadline` (≥ date), `search` (title/company/organization/location/province regex).

Plus **locale** via `withListLocaleFilter` (English includes docs with missing/null `locale`).

`getJobs` does **not** filter featured-only; no static/demo fallback in this controller.

### Frontend (`client/src/pages/Jobs/Jobs.jsx`)

- Uses `limit: 10` (`PER_PAGE`) and `page` from UI state.
- Relies on API `pagination.total` for paging.

### Production API measurements (2026-07-27)

| Request | Returned rows | `pagination.total` | `page` | `limit` | Notes |
|---------|---------------|-------------------|--------|---------|--------|
| `/api/jobs?page=1&limit=10` | 10 | **12** | 1 | 10 | Includes “NTS Test Invigilator 2026” |
| `/api/jobs?page=1&limit=50` | **12** | **12** | 1 | 50 | All public jobs on one page |
| `/api/jobs?page=2&limit=50` | 0 | 12 | 2 | 50 | Confirms total is not “page size” |

**Conclusion:** **12 is the true filtered corpus on Render**, not a pagination slice of 312.

---

## Task 2 — Duplicate-record check (remediation script connection)

Read-only queries on the connection used by `remediateProductionOpportunityTrust.js` / `server/.env` `MONGO_URI`:

| Identifier | Match count | Statuses | Notes |
|------------|-------------|----------|--------|
| Title `NTS Test Invigilator 2026` | **1** | `draft` | `source: scraper`, `locale: en` |
| Slug `nts-test-invigilator-2026-punjab` | **1** | `draft` | Same row as above |
| `externalId` `ext_NTS_m9cpm7` | **1** | `draft` | Same row as above |

- **Multiple documents sharing slug or externalId on this connection:** **No**
- **Active duplicate remaining on this connection:** **No** (`activeDuplicateNts: 0`)

### Schema uniqueness (`Job` model)

| Field | Uniqueness |
|-------|------------|
| `externalId` | **Unique, sparse** (`unique: true, sparse: true`) |
| `slug` | **Compound unique** with `locale`: `{ slug: 1, locale: 1 }` unique (`applySlugLocaleIndex`) |

On a **single** MongoDB deployment, two active rows cannot share `ext_NTS_m9cpm7` or the same `slug`+`locale`. Render’s live API returning **active** NTS with the same slug/externalId while this connection holds **draft** with the same identifiers implies **different MongoDB servers or databases**, not an undetected duplicate on one DB.

---

## Task 3 — Public query path

| Endpoint | Handler | Model | Collection | Connection |
|----------|---------|-------|------------|------------|
| `GET /api/jobs` | `getJobs` | `Job` | `jobs` (default Mongoose pluralization) | Single `mongoose.connect(MONGO_URI)` in `config/db.js` |
| `GET /api/jobs/:idOrSlug` | `getJobByIdOrSlug` | `Job` | `jobs` | Same |
| `GET /api/v1/jobs` | Same controllers | Same | Same | Same |
| `GET /api/trending/jobs` | `getTrendingJobs` | `Job` | `jobs` | Same; filter `status: 'active'` only (no `approvalStatus` filter) |

**Detail path:** `findLocalizedBySlug` / `findLocalizedById` with `status: 'active'` + approval filter + locale filter.

**List path:** Same base filters + locale + pagination.

**No** alternate collection, static JSON dataset, or aggregation pipeline for standard list/detail.

**Side effects:** Detail increments `views` (explains `updatedAt` changing on fetch).

**Replica / read preference:** Not configured in `db.js` (default primary).

**Can list and detail disagree on same slug?** Only if data changes between requests or locale differs; **not** different code paths. On Render, list and detail both show NTS as **active** — consistent with Render’s DB.

---

## Task 4 — Cache investigation

| Layer | Jobs list/detail | Finding |
|-------|------------------|---------|
| Redis | Trending / featured keys only | Health: **`redis: disabled`** on Render; `cacheGet` falls back to in-memory |
| In-memory trending | `trendingCache.js`, TTL **5 min** | Affects `/api/trending/jobs` only, **not** `GET /api/jobs` |
| Controller cache on `getJobs` | None | Direct `Job.find` + `countDocuments` |
| HTTP `Cache-Control` on jobs | None set in controller | No CDN cache headers from this handler |
| Search index | `SearchDocument` / `SearchIndexService` | Separate search path; public job list does not use it |

**NTS detail `updatedAt` moved during audit** → live Mongo read + view increment, **not** stale document cache.

**Would Render restart be required after Atlas status change?** Only for **in-memory trending** (max ~5 minutes). **Not** the cause here: list/detail hit Mongo directly and still show active NTS because **Render’s database row was never updated** by the safe-now script.

---

## Task 5 — Mongo target fingerprint

Utility (read-only): `server/src/scripts/mongoTargetFingerprint.js`

Prints: hostname, effective database name, explicit path flag, SHA-256 `hostname|databaseName` — **never** username, password, or full URI.

### Local remediation connection (executed 2026-07-27)

| Field | Value |
|-------|--------|
| Hostname | **`127.0.0.1`** |
| Effective database name | **`edurozgaar`** |
| Explicit DB path in URI | Yes |
| `mongoose.connection.db.databaseName` | `edurozgaar` |
| Fingerprint (SHA-256) | `7c4b35c8c0f9b9523dd13f022e962a5ce13538a95482f89d0c941e62a69828f6` |

`db.js` uses `process.env.MONGO_URI` only; **no** `dbName` override, **no** `MONGO_DB_NAME` in codebase grep, **no** second connection for public jobs.

Default fallback if unset: `mongodb://localhost:27017/edurozgaar` (same pattern).

### Safe Render fingerprint (operator, no public endpoint)

1. Render Dashboard → **strideto-api** (or active web service) → **Shell**.
2. `cd server` (if needed) → `node src/scripts/mongoTargetFingerprint.js` (deploy commit must include E.1C script, or paste utility temporarily).
3. Compare **fingerprint SHA-256** and **hostname** to local value above.
4. **Do not** paste shell output containing env vars into tickets.

---

## Task 6 — Database vs API comparison

### Jobs collection fingerprint (local remediation connection)

| Metric | Local connection |
|--------|------------------|
| Total documents | 315 |
| Active | 312 |
| Draft | 3 (includes safe-now job drafts) |
| Closed | 0 |
| `launch-v1-*` externalId | 300 |
| Slug `nts-test-invigilator-2026-punjab` | 1 (**draft**) |
| Public list filter count (`active` + approval) | 312 |
| `createdAt` range | 2026-07-09 → 2026-07-11 |

### Render public API (same day)

| Metric | Render API |
|--------|------------|
| `pagination.total` (public list) | **12** |
| Active rows returned | 12 |
| NTS in list | **Yes**, `status: active` |
| NTS detail | **active**, `source: scraper`, `createdAt` **2026-07-25** (newer cohort than local job corpus) |
| Trending includes NTS | **Yes** (10 items) |

| Comparison | Result |
|------------|--------|
| Totals 312 vs 12 | **Incompatible on one database** |
| NTS same slug/externalId, different status & `createdAt` | **Different physical data** |
| Unique indexes | **Cannot coexist on one DB** → mismatch |

### Classification

**5 — Different Atlas cluster / Mongo host** (manifestation: local **`127.0.0.1`** vs Render production host; not #1 pagination, not #2 duplicate on one DB, not #3 stale cache for list/detail).

---

## Task 7 — Render deployment verification

| Item | Evidence |
|------|----------|
| Blueprint | `render.yaml`: service `strideto-api`, `rootDir: server`, `startCommand: npm start`, `healthCheckPath: /api/health` |
| Start command | `node src/index.js` (`package.json` `"start"`) |
| `NODE_ENV` | Health `/api/health/ready`: **`appEnv: production`** |
| GitHub `main` tip (local repo) | `dbe37fa` — *fix: remove remaining duplicate Mongoose indexes* (E.1/E.1B **not** on `main`; deploy commit on Render not verified — `gh` unavailable in audit environment) |
| Alternate API hosts | `api.strideto.com` did not resolve from audit network; live checks used **`strideto.onrender.com`** |
| Other services | `render.yaml` defines `strideto-worker` (same `MONGO_URI` pattern) |

---

## Task 8 — Safe remediation recommendation

**Execute exactly one (when approved, not in E.1C):**

**Correct application / ops Mongo target** — Point local and scripted remediation at the **same** `MONGO_URI` Render uses (Atlas production). Re-run fingerprint on both sides until SHA-256 matches. Then:

- Re-run `--dry-run-safe` against that target.
- Apply safe-now **only** if the 10 records still match on **that** database.
- Optionally remediate NTS on the live target if it remains in the safe manifest there.

**Do not** treat this as pagination-only, cache-only, or a same-DB duplicate.

---

## Proof of no writes in E.1C

- Only read APIs, read-only Mongoose queries, and fingerprint script.
- No `--apply-safe`, `--apply-deferred`, or `seed:beta`.
- No Render env or Atlas mutations.

---

## Final verdict

**LIVE DATA SOURCE MISMATCH CONFIRMED**

---

## E.1D — Target-safe operations (follow-up)

- Previous `--apply-safe` mutated **local** MongoDB (`127.0.0.1` / `edurozgaar`) only; Render public API unchanged for live NTS.
- Committed ObjectId manifests **removed**; use `server/.remediation-targets/<fingerprint>/` generated by `--audit-target` on Render Shell.
- Production mutations require `--expected-fingerprint`, forbid localhost, and use `docs/RENDER_PRODUCTION_DATA_OPERATIONS_RUNBOOK.md`.
- **E.1D performed zero database writes** during implementation verification (unit tests only).

