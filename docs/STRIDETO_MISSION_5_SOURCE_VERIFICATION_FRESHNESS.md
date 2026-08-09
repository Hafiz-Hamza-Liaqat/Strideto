# Strideto Mission 5 — Source Verification + Freshness

> **Status:** Implemented (source-complete, not deployed).
> **Scope:** Canonical source model, authority hierarchy, fact provenance,
> verification lifecycle, freshness derivation, review policies, checker boundary,
> broken-source handling, Admin freshness queue, user correction reports,
> Mission 4 integration hardening, publication policy, data quality metrics, audit.
> **Authority:** Subordinate to frozen product spec, execution roadmap,
> engineering guardrails, trust/verification policy, and Employer Release Baseline.
> Preserves Missions 0–4 unchanged.

---

## 0. Purpose & principle

Mission 5 builds the **Trust/Data-Quality layer** that makes Strideto education,
test, institution, and future scholarship information trustworthy over time.

The platform can now answer:

- Where did this fact come from?
- How authoritative is the source?
- When was it last checked?
- Is it still fresh?
- Is the source broken?
- Has someone reported a correction?
- What needs Admin review next?

**No live source checks are executed in Mission 5.** All checker boundary code
is contract-only; future scheduled checking plugs in via the injectable boundary.

---

## 1. Canonical Source Record — `server/src/models/trust/CanonicalSource.js`

One MongoDB document per unique source URL (deduplicated via `normalizedUrl`).
Suitable for: tests, test providers, institutions, programs, scholarships,
country intelligence, official announcements.

| Field | Type | Notes |
|---|---|---|
| `url` | String, required | Original URL as supplied |
| `normalizedUrl` | String, unique | Lowercase, port-stripped, fragment-free canonical form |
| `sourceType` | `SOURCE_TYPES` enum | From Mission 1 evidence contract |
| `authorityType` | `AUTHORITY_TYPES` enum | Trust tier classification |
| `publisher` | String | Authority/publisher display name |
| `countryCode` | String | ISO 3166-1 alpha-2 (optional) |
| `label` | String | Human-readable display label for public projection |
| `isOfficialDomain` | Boolean | Whether URL is on the authority's own domain |
| `status` | `SOURCE_STATUS` enum | active / redirected / unavailable / broken / retired |
| `httpStatus` | Number | Last HTTP check result code (checker boundary, no live checks in M5) |
| `httpStatusRecordedAt` | Date | When httpStatus was recorded |
| `redirectedTo` | String | Destination URL if redirected (for Admin review) |
| `firstSeenAt` | Date | Auto-set on first save |
| `lastCheckedAt` | Date | Last availability check attempt |
| `lastSuccessfulCheckAt` | Date | Last successful availability check |
| `lastVerifiedAt` | Date | Last content/fact verification |
| `nextReviewAt` | Date | Scheduled review date |
| `adminNotes` | String | **Internal only — never expose on public endpoints** |
| timestamps | | `createdAt`, `updatedAt` |

`normalizedUrl` is auto-computed on save via `normalizeSourceUrl()`. URL
deduplication prevents multiple source records for the same destination.

---

## 2. Source Authority Hierarchy

Defined in `shared/trust/sourceVerification.js` as `AUTHORITY_TYPES` and
`AUTHORITY_TIERS`. Lower tier number = higher authority.

| Tier | Token | Description |
|---|---|---|
| 1 | `government` | National/regional regulator, ministry, official body |
| 2 | `official_test_org` | ETS, British Council, College Board, etc. |
| 3 | `university` | Accredited university or college |
| 4 | `scholarship_provider` | Official scholarship body |
| 5 | `official_employer` | Company/government employer's own site |
| 6 | `verified_org` | Verified organization or agent-supplied official source |
| 7 | `trusted_secondary` | Recognized aggregator, press, directory |

`authorityTier(type)` returns the numeric tier. Hierarchy alone does not prove
factual correctness — it classifies the weight of the source.

---

## 3. Claim/Fact Provenance — `server/src/models/trust/FactProvenance.js`

Links an important factual field on any entity to one or more `CanonicalSource`
records, carrying verification lifecycle and freshness metadata.

| Field | Type | Notes |
|---|---|---|
| `targetEntityType` | String | 'Test', 'CanonicalInstitution', 'Program', etc. |
| `targetEntityId` | ObjectId | Entity being sourced |
| `claimKey` | String | The field/fact key, e.g. `'scoreRange'`, `'registrationFee'` |
| `sourceIds` | ObjectId[] → CanonicalSource | One or more source references |
| `claimedValueFingerprint` | String | Opaque digest of value at verification time |
| `verificationStatus` | enum | Full lifecycle (see §4) |
| `verifiedAt` / `verifiedBy` | Date / ObjectId | Admin who verified |
| `adminNotes` | String | **Internal — never public** |
| `supersededById` | ObjectId → FactProvenance | For superseded records |
| `policyType` | enum | original_guidance / high_value_factual / descriptive |
| `freshnessState` | enum | Cached derived freshness (see §5) |
| `dataType` | String | Review interval key (test_policy, institution_identity, …) |
| `lastVerifiedAt` / `nextReviewAt` | Date | Freshness timestamps |

One FactProvenance document per `(entityType, entityId, claimKey)` at any
point in time. Superseded records are kept (not deleted) for audit history.

---

## 4. Verification Status Lifecycle

```
unverified → pending_review → verified → needs_review → pending_review (cycle)
                           → disputed  → verified / rejected
                           → superseded (terminal)
rejected   → pending_review / unverified
```

`isValidVerificationTransition(from, to)` enforces allowed transitions.
`superseded` is terminal. `rejected` can be reopened to `pending_review`.

Full set: `unverified`, `pending_review`, `verified`, `needs_review`,
`disputed`, `superseded`, `rejected`.

---

## 5. Freshness Model

Freshness is **derived deterministically** from timestamps and source status.
It is never a single global interval.

States: `fresh`, `review_due`, `stale`, `broken`, `unknown`.

`deriveFreshness({ lastVerifiedAt, nextReviewAt, sourceStatus, reviewIntervalDays, dataType, now })`:

1. If `sourceStatus` is `broken` or `unavailable` → `broken`
2. If `lastVerifiedAt` is null/invalid → `unknown`
3. If `nextReviewAt` is set:
   - Future → `fresh`
   - 0–90 days past → `review_due`
   - >90 days past → `stale`
4. Otherwise, interval-based calculation using `reviewIntervalDays` or `dataType`:
   - < 80% of interval elapsed → `fresh`
   - 80–100% → `review_due`
   - 100–300% → `review_due`
   - > 300% → `stale`

### Configurable review intervals (days)

| Data type | Interval |
|---|---|
| `test_policy` | 90 |
| `test_date` | 60 |
| `institution_identity` | 365 |
| `scholarship` | 180 |
| `program` | 180 |
| `country_intelligence` | 270 |
| `alert` | 30 |
| `source_default` | 180 |

The clock is injectable (`now` parameter) for deterministic testing.

---

## 6. Last Verified UX Contract

`projectLastVerified(record)` produces the public-safe projection:

```js
{
  label: string,              // Source display name
  isOfficiallySourced: bool,  // Whether from an official authority
  lastVerifiedAt: Date|null,  // Last verification date
  freshnessState: string,     // one of FRESHNESS_STATES
  officialUrl: string|null,   // Only when isOfficial = true
}
```

`adminNotes` and internal identifiers are never included. `officialUrl` is only
surfaced when the source is officially classified.

Example UX display:
- Fresh: "Last verified: 8 Aug 2026 · Source: Official University Admissions · Status: Current"
- Review due: "Last verified: 11 months ago · Status: Review due — Check official source before relying"

---

## 7. Source Checker Boundary — `server/src/services/trust/sourceCheckerBoundary.js`

Defines the injectable contract for source availability checking.

```js
// Default (Mission 5) — no-op, no network calls
const result = await checkSource(url);

// Inject mock for testing
setSourceChecker(createMockSourceChecker({ 'https://ets.org': { ok: true, status: 'reachable', httpStatus: 200 } }));

// Restore default
resetSourceChecker();
```

`SourceCheckResult` shape:
```js
{ ok: boolean, status: 'reachable'|'unreachable'|'redirected'|'error',
  httpStatus?: number, canonicalUrl?: string, checkedAt: string, errorMessage?: string }
```

**No live internet checks are performed in Mission 5.** Future scheduled
checking (Mission X) will plug a real HTTP adapter via `setSourceChecker()`.

---

## 8. Broken/Redirected Source Handling

`SOURCE_STATUS`: `active`, `redirected`, `unavailable`, `broken`, `retired`.

Key separation:

- A **source check failure** (network error, 404) updates `CanonicalSource.status`
  and sets `freshnessState = broken` on linked `FactProvenance` records.
- It does **not** automatically delete or invalidate the factual claim.
  `lastVerifiedAt` and the claim record remain; Admin reviews and decides.
- **Redirect destination changes** are recorded in `redirectedTo` for Admin review
  before the source record is updated.
- Temporary network failures must not immediately destroy verified data.

---

## 9. Admin Freshness Queue — `server/src/routes/adminFreshness.js`

Admin endpoints (all require Auth + Staff):

| Method | Path | Action |
|---|---|---|
| GET | `/api/admin/trust/freshness-queue` | List FactProvenance records with filters |
| PATCH | `/api/admin/trust/freshness-queue/:id/verify` | Verify a fact record |
| PATCH | `/api/admin/trust/freshness-queue/:id/status` | Transition verification status |
| PATCH | `/api/admin/trust/freshness-queue/:id/schedule-review` | Set nextReviewAt |
| GET | `/api/admin/trust/sources` | List canonical sources |
| POST | `/api/admin/trust/sources` | Create canonical source |
| PATCH | `/api/admin/trust/sources/:id` | Update source metadata |
| GET | `/api/admin/trust/corrections` | List user correction reports |
| PATCH | `/api/admin/trust/corrections/:id/resolve` | Resolve a correction |
| GET | `/api/admin/trust/metrics` | Data quality aggregate metrics |

Freshness queue filters: `freshness`, `verificationStatus`, `entityType`, `dataType`.

Admin actions audit lifecycle transitions. All mutations are server-authorized.

---

## 10. User Correction/Report Workflow — `server/src/routes/corrections.js`

User endpoints (require Auth):

| Method | Path | Action |
|---|---|---|
| POST | `/api/corrections` | Submit a correction report |
| GET | `/api/corrections/mine` | List user's own corrections |

Correction types: `outdated_information`, `incorrect_information`,
`broken_official_link`, `deadline_changed`, `test_acceptance_changed`,
`other_factual_issue`.

Lifecycle: `submitted → under_review → accepted / rejected / duplicate / resolved`.

Constraints:
- Description bounded to 2000 characters.
- Duplicate guard: one open correction per user/entity/type combination.
- Users cannot directly mutate authoritative data.
- Internal `resolutionNote` and `resolvedBy` are never returned to users.
- Admin resolution is required for all corrections.

---

## 11. Organization Correction Proposals

`DataCorrection.proposedByOrgId` field supports organization-submitted corrections
(future Mission 18 Institution Portal). Org proposals follow the same workflow
as user corrections. Presence of `proposedByOrgId` grants no additional authority.
Admin review is still required.

---

## 12. Mission 4 Integration — Malformed-Source Boundary Hardening

`adminEducationController.js` `parseSources()` function was upgraded from a
silent-drop helper to a policy-aware function:

- **Draft workflows (permissive mode, default):** Invalid source entries are
  dropped. Warnings are returned but the operation succeeds. Preserves legacy
  draft data without disruption.

- **Published / high-value factual records (strict mode):** When `status = 'published'`,
  `parseSources` is called with `strict: true`. Invalid source entries cause a
  400 error with a clear message. This prevents published records from silently
  losing required source evidence.

- `null`, non-object, and array entries in `sources[]` are now safely coerced
  to `{}` before validation, preventing crashes on malformed input.

The `parseSources` contract is also exported from `shared/trust/sourceVerification.js`
for reuse by future mission controllers.

---

## 13. Publication Policy

Defined in `shared/trust/sourceVerification.js`:

| Policy type | Requirement |
|---|---|
| `original_guidance` | Strideto-authored content; no external source required |
| `descriptive` | Non-factual descriptive content; no strict source requirement |
| `high_value_factual` | Must have ≥1 source AND `verificationStatus = verified` to publish |

`checkPublicationPolicy(record, policyType)` returns `{ canPublish, reason }`.

High-value factual records in draft/unverified state remain in draft rather than
publishing silently without provenance.

Original Strideto guidance (test prep advice, original editorial content) is
explicitly exempt — it may publish without an external factual source requirement.

---

## 14. Data Quality Metrics — `GET /api/admin/trust/metrics`

Lightweight aggregate counts computed on demand:

```json
{
  "totalFactRecords": 0,
  "verified": 0,
  "unverified": 0,
  "fresh": 0,
  "reviewDue": 0,
  "stale": 0,
  "broken": 0,
  "correctionsPending": 0
}
```

No analytics warehouse. Counts aggregate over `FactProvenance` and open
`DataCorrection` records.

---

## 15. Audit

Mission 5 uses the shared `validateAuditRecord` primitive from Mission 1
(`shared/international/audit.js`) for admin actions:

- Source creation / metadata updates
- Fact verification decisions
- Verification status transitions
- Correction resolution
- Claim supersession

`adminNotes`, raw source page contents, secrets, and private user data must
never appear in audit `metadata`.

---

## 16. No Automated Claim Extraction

Mission 5 does **not** build:

- Web crawlers or scrapers
- LLM-based claim extraction
- Google/search automation
- Source ingestion bots
- Scheduled background workers

The checker boundary (`sourceCheckerBoundary.js`) exists for future missions to
plug in. The FactProvenance and CanonicalSource models are the safe landing zone
those systems will write to.

---

## 17. Deferred

- Scheduled/automated source availability checking
- Source ingestion pipelines
- AI claim extraction from source pages
- Mission 6: Test Acceptance Explorer
- Full institution correction portal (Mission 18)

---

## Tests

`server/src/__tests__/sourceVerificationFreshness.test.js`
51 assertions, no DB, no network. Run with:
```
node server/src/__tests__/sourceVerificationFreshness.test.js
```

Covers all 26 mission test requirements including:
URL normalization/dedup, authority validation, provenance contract,
lifecycle transitions (valid/invalid), freshness derivation (fresh/review_due/
stale/broken), injectable clock, public projection, adminNotes exclusion,
correction submission, publication policy, Strideto guidance exemption,
data quality metrics shape, source checker boundary mock injection,
Mission 4 malformed-source boundary hardening.

Mission 4 and Mission 3 regression suites: all green.

---

## Live source checks

**None executed.** Mission 5 builds contracts only. The checker boundary's
default implementation (`noOpSourceChecker`) returns a safe no-op result for
all calls.

## Live migrations / backfills

**None executed.** All schema changes are additive. New collections
(`CanonicalSource`, `FactProvenance`, `DataCorrection`) are created empty by
MongoDB on first write.
