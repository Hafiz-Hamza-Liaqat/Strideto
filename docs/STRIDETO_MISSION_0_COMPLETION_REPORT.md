# Strideto Mission 0 — Completion Report

> **Mission:** 0 — Existing Strideto / Employer stabilization.
> **Scope authority:** the frozen master documents committed in this session
> ([product spec](STRIDETO_MASTER_PRODUCT_SPEC.md),
> [roadmap](STRIDETO_MASTER_EXECUTION_ROADMAP.md),
> [guardrails](STRIDETO_ENGINEERING_GUARDRAILS.md),
> [trust policy](STRIDETO_TRUST_VERIFICATION_POLICY.md)) and the PF-EMP audit
> series. B1–B5B remained frozen except where a Mission 0 item explicitly
> required a change (see §Preserved).

## 1. Commits

| Purpose | Message | SHA |
|---|---|---|
| Master docs freeze | `docs(product): freeze Strideto platform roadmap` | `0e5e271` |
| Mission 0 source | `fix(employer): complete portal stabilization` | `c3af4d2` |
| Mission 0 report | `docs(product): complete Strideto mission 0` | _this commit_ |

No push. No deployment. Branch `main`.

## 2. Implemented findings

### 1. Employer public profile slug
- Added `server/src/utils/employerSlug.js`: deterministic base slug from
  company name, reserved-slug avoidance (kept in sync with the client
  `EmployerPublicGate` reserved list so a generated slug is always reachable),
  numbered collision candidates (`-2`, `-3`, …), and
  `ensureUniqueEmployerSlug(name, existsFn)` (predicate injected → unit-testable
  without a DB).
- Registration (`employerAuthController.employerRegister`) now generates a
  unique slug at creation, with a one-shot retry on the rare create-time
  duplicate-key race (the unique+sparse index remains the authority).
- `isPublicProfile` already gates reachability in `getEmployerProfile`
  (`isPublicProfile: { $ne: false }`); unchanged and confirmed.
- Settings now shows a truthful **View public profile** link (only when a slug
  exists **and** the profile is public), otherwise a hint explaining it is
  hidden.

### 2. Public profile truthfulness
- `getEmployerProfile` now filters listed active jobs (and the public
  `activeJobs` stat) by admin approval (`approvalStatus: 'approved'`, with a
  legacy `$exists:false` allowance matching `jobsController`). An
  activated-but-unapproved role can no longer appear as an open public position.
- Renamed the misleading "Hiring history" section to **Past positions**
  (these are closed roles, not confirmed hires). Server returns a truthful
  `pastPositions` field; the legacy `hiringHistory` alias is retained for
  backwards compatibility. New i18n key `profiles:pastPositions` (en/ur/ar).

### 3. Job selectors (no silent 10-cap)
- Added `GET /employer/jobs/selector` (`getJobSelectorOptions`): a bounded
  (500), minimal-projection list of **all** the employer's jobs, registered
  before `/employer/jobs/:id`. Client `employerApi.getJobOptions()` consumes it;
  Applications and Analytics dropdowns now use it instead of the paginated
  10-per-page list.

### 4. Paid draft activation → checkout
- `EmployerJobs` no longer dead-ends on the server's "planId is required"
  error. Free drafts still activate directly; **paid drafts open a plan picker**
  that loads priced plans and routes the chosen plan through the existing
  `POST /employer/jobs/:id/checkout` (Stripe) flow — no second payment system.
  Returning `?payment=success|cancelled` redirects surface a truthful banner.
  If no paid plans exist or the gateway is unconfigured, the modal reports it
  truthfully.

### 5. Application stage UI
- Confirmed already truthful from B5B: the Applications page shows the canonical
  `hiringStage` via `StageBadge` and only falls back to the legacy status label
  for historical rows. No regression introduced. (Terminology handled in §7.)

### 6. Same-status idempotency
- `updateApplicationStatus` now **no-ops** a repeated same-status update
  server-side **before** any write, tracker sync, notification, or automation
  (`isSameStatusNoOp`, extracted to `utils/applicationStatusTransition.js` for
  testability), returning `{ application, unchanged: true }`.

### 7. Hiring terminology
- The Applications quick action `hired` maps (via `PIPELINE_TO_LEGACY_STATUS` /
  `LEGACY_STATUS_TO_PIPELINE`) to the canonical **accepted** stage, not
  joined/hired. Relabeled the action **"Mark offer accepted"** so the UI matches
  the real canonical result; accepted/joined semantics are kept distinct.

### 8. Intelligence stage labels
- Added the shared, i18n-compatible `stageLabel(t, stage)` helper
  (`applications:stages.*` contract). Replaced raw enum slugs with it in the
  Hiring Pipeline column headings, the Candidates stage filter + list rows, and
  the Candidate Detail stage selector. No surface exposes `screening` /
  `negotiation` / `joined` etc. as raw slugs.

### 9. Dashboard "Recent Job Posts" count
- The count badge described `recentActivity` while the list rendered `jobs`.
  It now reports `jobs.length` (the actually-rendered list) via the new
  `employer:recentJobsCount` key.

### 10. Employer notification i18n
- Replaced the hardcoded English notifications empty-state string with
  `employer:notificationsEmptyDescription` (existing i18n system; no new
  translation system introduced).

### 11. Nav active state
- `/employer/jobs/new` previously highlighted both "My Job Posts" and "Post New
  Job" (prefix match). Active selection now uses the **longest (most specific)**
  matching path, so exactly one item is active on every route.

### 12. Settings account security
- The server change-password and logout-all APIs already exist, are bounded,
  audited, and safe (SEC-3D). Exposed both in Settings with client-side
  validation, busy/error/success states: a change-password form
  (current/new/confirm, min length, match check) and a "Sign out of all
  sessions" action (confirm dialog, uses the context `logoutAll`). Added
  `employerAuthApi.changePassword`. No new authentication architecture required.

### 13. Fixture strategy
- Added `server/src/__tests__/fixtures/employerFixtures.js`: tiny, unpersisted
  factories that tag every record with a greppable `SYNTHETIC_MARKER` and an
  `isSyntheticFixture()` detector, so future acceptance never depends on
  real-looking records. Not a seed dataset.

### 14. Queue hygiene readiness
- Added `server/src/scripts/inspectQueueHygiene.js`: **inspect by default**;
  deletion requires `--delete`, is targeted (terminal statuses older than
  `--older-than-days`, default 30), bounded (`--limit`, default 200, hard max
  1000), refuses production without `--allow-production`, and audit-logs every
  deletion. It never processes/dispatches jobs (worker stays stopped). **Not
  executed.**

### 15. Email acceptance readiness
- Confirmed the runtime is ready for a later, controlled email-delivery
  acceptance without change: `queueEmail` already gates on `isSmtpConfigured()`
  and enqueues to `BackgroundJob` rather than sending inline, and delivery only
  occurs when the (currently stopped) worker runs with SMTP configured. **No
  email sent.** See §Remaining live acceptance.

## 3. Migrations / backfill (NOT executed)

`server/src/scripts/backfillEmployerSlugs.js` assigns slugs to pre-existing
employers that lack one.

- **Dry-run by default** (reports planned slugs, writes nothing).
- `--commit` applies; refuses production without `--allow-production`.
- Only fills missing/empty slugs (never overwrites) — idempotent, re-runnable.
- Resolves collisions against both stored slugs and slugs assigned earlier in
  the run.

Run order for a later maintenance window (operator-approved):

```bash
node server/src/scripts/backfillEmployerSlugs.js            # inspect plan
node server/src/scripts/backfillEmployerSlugs.js --commit   # apply (non-prod)
```

No live DB mutation was performed during Mission 0.

## 4. Tests

- New: `server/src/__tests__/employerStabilization.test.js` — 20 assertions
  covering slug base/reserved/candidates/collision resolution, same-status
  idempotency contract, public-approved predicate, and synthetic-fixture
  detection. **Passes.**
- Updated: `employerPipelineStageCompleteness.test.js` — the two source-contract
  assertions that pinned the raw-slug rendering (`{stage}` heading, Candidate
  Detail `{s}` option) were updated to the new `stageLabel(t, …)` rendering
  required by item 8, preserving the count-integrity intent.
- Full server suite: **86/86 test files pass** (85 pre-existing + 1 new).
- Client lint on all changed files: clean. Server lint on all changed files:
  clean.

## 5. Build

- `npm run build` (client, Vite production): **success**, built in ~25s. The
  only warning is the pre-existing chunk-size advisory (unrelated to these
  changes).

## 6. Security / ownership preservation

- No `.env`/secret reads; no secrets in the diff. Scripts read only
  `process.env.NODE_ENV` for a production safety gate.
- Server-side authorization and tenant scoping unchanged: every touched
  endpoint keeps its `requireAuth`/`requireEmployerAuth` guard and its
  ownership filter (`employerId` scoping on jobs/applications; the selector
  endpoint is strictly `employerId`-scoped).
- The idempotency change strengthens safety (prevents duplicate
  notifications/automation on repeated writes).
- Account-security UI reuses existing audited server flows; no new auth
  architecture, no client-side authority.

## 7. Remaining live acceptance requirements

These require a running environment / real data and were intentionally not
performed during source implementation:

- **Slug backfill**: run the dry-run, review, then `--commit` in an
  operator-approved window; then verify existing employers' public profiles
  resolve.
- **Public profile truthfulness**: with a real activated-but-unapproved job,
  confirm it is absent from the public profile and the active-jobs stat.
- **Paid activation**: with Stripe configured in a test mode, activate a paid
  draft end-to-end (plan → checkout → webhook → active/pending-approval).
- **Idempotency**: repeat a same-status update and confirm no new
  stageHistory/notification.
- **Account security**: change password and sign-out-all against a live
  session; confirm session invalidation.
- **Email delivery**: with SMTP configured and the worker started under
  explicit authorization, run a controlled email acceptance.
- **Queue hygiene**: run inspect first; only then a bounded `--delete` in a
  non-production window.

## 8. Preserved

- **B1–B5B:** frozen. The only B5B-owned artifact changed is
  `employerPipelineStageCompleteness.test.js`, and only its two rendering
  assertions that were coupled to the raw-slug output Mission 0 item 8
  explicitly replaces; the count-integrity and stage-completeness intent is
  preserved. B5A-01 / CandidateViewed correction untouched.
- **Tenant ownership & authorization:** preserved on every touched path.
- **Worker:** stopped throughout; nothing here starts it.
- **Historical untracked docs:**
  `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md` and
  `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md` — not added, not
  edited, not deleted (still untracked).

## 9. Deferred

- **Full granular verification badge/state machine** (Trust policy §4/§6) —
  deferred to Mission 2; the interim `verified`/`verificationLevel` fields are
  unchanged.
- **International retrofit of pre-existing Pakistan-specific assumptions**
  (e.g. `addressCountry: 'PK'` in the public-profile JSON-LD, `country:
  'Pakistan'` in `listUniversities`) — these are pre-existing and belong to
  Missions 1/22; Mission 0 did not expand into them. All **new** code added here
  uses locale-agnostic/ISO-friendly contracts.
- **Applications-page canonical/legacy explanatory copy** beyond the existing
  StageBadge (B5B) — no further change needed for Mission 0.
