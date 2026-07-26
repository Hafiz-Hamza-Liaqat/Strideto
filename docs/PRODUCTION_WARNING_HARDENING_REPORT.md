# Phase D.7 â€” Production Proxy & Mongoose Warning Hardening

**Date:** 2026-07-26
**Scope:** Fix confirmed Render live-tail warnings only
**Commit / push / deploy:** Not performed (awaiting manual deploy)

---

## Final verdict

**READY FOR MANUAL DEPLOY**

---

## Confirmed production warnings

| Warning | Root cause |
|---------|------------|
| `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` | Express `trust proxy` was unset while Render sets `X-Forwarded-For`; `express-rate-limit` correctly refused to trust the header |
| Mongoose `` `errors` is a reserved schema pathname `` | `ScraperRun` and `NewsletterLog` declared a schema path named `errors` |

---

## 1. Trust proxy / rate-limit

### Startup order (before)

1. `express()`
2. helmet / compression / cors / json
3. `app.use('/api', apiLimiter)` â† rate-limit with no prior `trust proxy`

### Fix

- Added `server/src/config/proxy.js` â†’ `configureTrustProxy(app)`
- Production: `app.set('trust proxy', 1)` (one hop â€” Render edge)
- Non-production: unchanged (default / false)
- Called in `server/src/index.js` **immediately after** `express()` and **before** any rate-limit middleware
- Did **not** use `trust proxy = true`
- Did **not** disable `express-rate-limit` validation

### Files

- `server/src/config/proxy.js` *(new)*
- `server/src/index.js`
- `server/src/__tests__/proxyRateLimit.test.js` *(new)*

---

## 2. Mongoose reserved `errors` path

### Occurrences found

| Model | Prior path | Usage |
|-------|------------|--------|
| `ScraperRun` | `errors: [{ type: String }]` | Written by `scraperService`; returned by scraper/growth APIs |
| `NewsletterLog` | `errors: [{ type: String }]` | Written by `jobQueueService` scheduled newsletter; shown in admin monitoring/growth |

No other Mongoose schema paths named `errors`.

### Fix

- Renamed persisted field to **`errorDetails`**
- Writers updated to `errorDetails`
- Read helpers `resolveScraperErrorDetails` / `resolveNewsletterErrorDetails` fall back to legacy `errors` for older Mongo documents
- API responses still expose **`errors`** (alias) alongside `errorDetails` for client compatibility
- Did **not** use `suppressReservedKeysWarning`

### Files

- `server/src/models/ScraperRun.js`
- `server/src/models/NewsletterLog.js`
- `server/src/services/scraperService.js`
- `server/src/services/jobQueueService.js`
- `server/src/controllers/scraperController.js`
- `server/src/controllers/growthDashboardController.js`
- `server/src/controllers/admin/monitoringController.js`
- `server/src/__tests__/reservedErrorsPath.test.js` *(new)*

---

## 3. Duplicate index cleanup

| Model | Change |
|-------|--------|
| `AdSlotConfig` | Removed `index({ slotId: 1 })` â€” already covered by `unique: true` on `slotId` |
| `BadgeDefinition` | Removed `index({ badgeType: 1 })` â€” already covered by `unique: true` on `badgeType` |

Index behavior unchanged (unique indexes remain).

---

## Verification results

| Check | Result |
|-------|--------|
| `node src/__tests__/proxyRateLimit.test.js` | Pass |
| `node src/__tests__/reservedErrorsPath.test.js` | Pass |
| `node src/__tests__/auth.test.js` | Pass |
| `node src/__tests__/emailVerification.test.js` | Pass |
| `npm run lint` (server) | Pass (0 errors) |
| `node --check` on touched modules | Pass |
| `git diff --check` | Pass (CRLF warnings only) |
| Client lint/build | Skipped â€” no shared contract / client changes |

---

## Remaining notes

1. Existing Mongo documents may still contain a legacy `errors` array until overwritten; readers map both fields.
2. After Render redeploy, live tail should no longer show `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` or the reserved `errors` pathname warning on model load.
3. No commit/push/deploy in this phase.

---

## Manual deploy checklist

1. Deploy server from this working tree / a follow-up commit to Render
2. Confirm live logs after traffic: no X-Forwarded-For ValidationError; no Mongoose `errors` reserved-path warning
3. Spot-check admin scraper runs / newsletter logs still display error strings
