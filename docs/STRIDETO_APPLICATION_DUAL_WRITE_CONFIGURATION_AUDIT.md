# STRIDETO Application Dual-Write Configuration Audit (PF-TRACK-C2A)

## 1. Verdict

**READY FOR TARGETED DUAL-WRITE ENABLEMENT AND LINK FIX**

The confirmed live defect (docs/STRIDETO_EMPLOYER_TO_USER_STAGE_SYNC_LIVE_VERIFICATION.md) has two independent, fully-understood causes, neither requiring redesign. First, `.env.staging` explicitly sets `APPLICATION_DUAL_WRITE=0`, overriding the documented default (`.env.example` ships this line commented out, with the explicit comment "unset = ON when Opportunity Applications enabled") — this reads as a stale override left from an earlier migration phase, not a current, deliberate product decision, and disabling it is not required by anything else in this environment (`OPPORTUNITY_APPLICATION_ENABLED=1` is on; nothing downstream depends on dual-write being off). Second, and independently of the flag, `careerNotificationBridge.js`'s stage-change notification link falls back to a legacy `Application` id when no linked tracker exists — a real, narrow code defect, already proven fixable using the exact pattern an existing sibling function (`onJobApplication` in `automationService.js`) already implements correctly and has a passing test for. Source-level tracing confirms enabling the flag is safe for existing data (a built-in reuse-and-link path prevents duplicate tracker records) and requires no migration, index, or worker/email dependency.

## 2. Repository authority

- HEAD: `dd2b0dc21d7b3cfd463db17720fd582c3e9a7bd8`, parent `93e396a68349e723a0370c0b662d10651dc55350`
- Branch: `main...origin/main [ahead 74]`, tracked tree clean, staged: none
- Preserved untracked: both prior reports, present and unmodified
- `.env.staging`: ignored, read-only inspected, **not modified**
- Worker: confirmed stopped, not started
- No source, test, Docker, environment, or database record was modified during this audit.

## 3. Confirmed live defect

Carried forward from the prior verification, not re-derived: Dani's real internal application to "Andoride Developer" has an Employer-facing `Application` but no linked `OpportunityApplication`; every Employer-triggered stage-change notification (`InterviewScheduled` ×2, `OfferAccepted`, `CandidateHired`) links to the legacy `Application` id instead of a resolvable User tracker route. This audit explains *why* and evaluates whether it is safe to close.

## 4. Internal apply write path

Traced `applyToJob` (`server/src/controllers/applicationsController.js:14-114`):

1. `Employer Application` creation (line 62, `Application.create`) is **always mandatory** — it happens unconditionally for any internal Job, with no dependency on any dual-write flag.
2. `OpportunityApplication` creation is gated **solely** by `isApplicationDualWrite()`, evaluated inside `dualWriteFromLegacyJobApplication` (`ApplicationMigrationService.js:193-194`) — `APPLICATION_DUAL_WRITE` is the only flag `dualWriteFromLegacyJobApplication` itself reads.
3. `OPPORTUNITY_APPLICATION_ENABLED` affects creation **indirectly only**: `isApplicationDualWrite()` (`careerFeatureFlags.js:27-31`) falls back to `isOpportunityApplicationEnabled()` *only when `APPLICATION_DUAL_WRITE` is unset*. In this environment `APPLICATION_DUAL_WRITE=0` is explicitly set, so it short-circuits before `OPPORTUNITY_APPLICATION_ENABLED` is ever consulted for this decision.
4. Dual-write failure (of any kind — flag off, thrown exception, duplicate key) **preserves the Employer Application** — `dualWriteFromLegacyJobApplication` catches its own errors and returns `{ created: false, error }` rather than throwing; `Application.create` already committed several lines earlier and is never rolled back.
5. Duplicate prevention covers both models, by two independent mechanisms: `Application` has a unique `{userId, jobId}` index (`models/Application.js:27`); `OpportunityApplication` has a unique partial index on `{talentProfileId, opportunityRef.opportunityType, opportunityRef.opportunityId}` scoped to `status:'active'` (`models/career/OpportunityApplication.js:46-55`), **and** `migrateJobApplication` explicitly checks `findByTalentAndOpportunity` before creating — if a matching tracker entry already exists (e.g., from a prior "Track" click), it reuses and links that record instead of creating a second one (§10).
6. Linkage is created **atomically** in the normal (fresh-tracker) path — `legacyApplicationId: legacy._id` is included directly in the single `OpportunityApplicationRepository.create({...})` call (`ApplicationMigrationService.js:106`). It is created **sequentially** (a follow-up `updateById`) only in the reuse-existing-tracker path (§10) — low-risk, since that path only runs once per user/job the very first time an internal apply reconciles with a pre-existing external tracker entry.
7. New internal applications would be safe with dual-write enabled: `Application.create` is unaffected either way; the only new behavior is that `OpportunityApplication` creation would actually run instead of no-opping.
8. Manual/external tracking (`source: 'external'`, created via Track) remains fully separate — `dualWriteFromLegacyJobApplication` is never invoked from the Track flow at all (confirmed in the original role-tracking audit, unchanged).
9. **Existing applications are not automatically repaired** — `dualWriteFromLegacyJobApplication` only ever runs from inside `applyToJob`, at the moment of a fresh apply request. There is no code path that retroactively dual-writes an `Application` created while the flag was off. The separate bulk `migrateAllJobApplications` function *could* do this, but it is independently gated behind `CAREER_MIGRATION_JOBS_ENABLED`, which is **also** explicitly `0` in `.env.staging` (§6/§14).
10. No queue or worker is involved anywhere in this path — `dualWriteFromLegacyJobApplication` is awaited synchronously inside the same HTTP request as `applyToJob`.

## 5. Dual-write contract

Traced `migrateJobApplication` (`ApplicationMigrationService.js:60-126`), the function `dualWriteFromLegacyJobApplication` calls when the flag is on:

1. `findByLegacyApplicationId(legacy._id)` — if this specific legacy Application was already migrated, no-op (idempotent against re-invocation).
2. `ensureProfile(legacy.userId)` — auto-creates a `TalentProfile` for the applying User if one doesn't already exist. (This directly explains why Dani's `Application.talentProfileId` is currently `null` — with the flag off, this step never ran.)
3. `findByTalentAndOpportunity(profile._id, 'job', legacy.jobId)` — if the User already has *any* tracker entry (even an external/manual one) for this exact Job, **reuse it**: link it via `legacyApplicationId` rather than creating a duplicate.
4. Otherwise, create a fresh `OpportunityApplication` with `source: 'migration'`, `legacyApplicationId` set atomically, an initial `pipelineStage` derived from the legacy status via `mapLegacyApplicationStatus`, and one seeded `stageHistory` entry tagged `byActorType: 'system'`.

## 6. Feature-flag matrix

| Flag | Current local staging | Recommended local staging | Required dependency | Effect |
|---|---|---|---|---|
| `APPLICATION_DUAL_WRITE` | `0` (explicitly disabled) | `1` (or unset — both currently produce ON, since `OPPORTUNITY_APPLICATION_ENABLED=1`) | none beyond `OPPORTUNITY_APPLICATION_ENABLED` when left unset | Off: `Application` created, `OpportunityApplication` never created, no linkage. On: both created, linked, in the same request. |
| `OPPORTUNITY_APPLICATION_ENABLED` | `1` | unchanged — already correct | none | Gates the tracker feature broadly (User tracker pages, Track button, dual-write's own fallback default) |
| `APPLICATION_READ_CANONICAL` | `0` | unchanged — out of scope for this fix | `OPPORTUNITY_APPLICATION_ENABLED` | Controls whether User-facing career reads prefer `OpportunityApplication` over legacy `Application`; unrelated to whether the tracker record itself gets created |
| `CAREER_MIGRATION_JOBS_ENABLED` | `0` | unchanged — **do not enable as part of this fix** | none | Gates the separate, administrative **bulk** `migrateAllJobApplications` backfill job; leaving this off keeps Dani's (and every other pre-existing) record untouched, consistent with "do not backfill" |
| `EMPLOYER_INTELLIGENCE_ENABLED` | `1` | unchanged | none | Already correctly on; not implicated in this defect |

`.env.example`'s own documentation (lines 130-134) states the intended default explicitly: *"APPLICATION_DUAL_WRITE — unset = ON when Opportunity Applications enabled (L.2.6 Apply→Tracker). Set APPLICATION_DUAL_WRITE=0 to disable dual-write explicitly."* — with the disabling line itself shown commented out as an opt-in example, not a default. `.env.staging` uncommented and set that exact opt-out line. No compose file overrides this — both `docker-compose.staging.yml` and `docker-compose.sec3f-local.yml` pass environment purely via `env_file`, so `.env.staging` is the single, sole source of truth for this value in the running containers (confirmed matches `docker exec api-a printenv`).

## 7. Current staging configuration

`APPLICATION_DUAL_WRITE=0`, `APPLICATION_READ_CANONICAL=0`, `CAREER_MIGRATION_JOBS_ENABLED=0`, alongside `OPPORTUNITY_APPLICATION_ENABLED=1` and `EMPLOYER_INTELLIGENCE_ENABLED=1` both on. This is an internally inconsistent combination: the tracker feature and the Employer Intelligence pipeline that depends on tracker linkage are both fully enabled, while the one flag that actually populates that linkage for internal Strideto applications is off.

## 8. Recommended staging configuration

Set `APPLICATION_DUAL_WRITE=1` (or remove the line entirely, since `OPPORTUNITY_APPLICATION_ENABLED=1` already makes the unset default resolve to ON) in `.env.staging`. Leave `APPLICATION_READ_CANONICAL` and `CAREER_MIGRATION_JOBS_ENABLED` untouched — neither is required for the confirmed defect, and changing `CAREER_MIGRATION_JOBS_ENABLED` would enable a *bulk* backfill capability this audit explicitly does not want touched (§14). **This audit does not change the file** — this is a recommendation for the next implementation phase to apply deliberately, with the user's/operator's own action, not an automatic side effect of this report.

## 9. Production implications

Not directly inspected (no production environment file was read, per this audit's staging-only scope), but `.env.example`'s own documented default strongly implies dual-write is intended to be ON wherever `OPPORTUNITY_APPLICATION_ENABLED` is ON — i.e., this staging environment's `APPLICATION_DUAL_WRITE=0` override is very likely a staging-specific leftover rather than a deliberate cross-environment posture. Whether production's own env file has the same override was not checked (out of this audit's file list) and should be confirmed separately before assuming staging's fix generalizes.

## 10. Linkage and duplicate behavior

Already detailed in §4-§5. The key finding worth restating for this section specifically: enabling dual-write is **not** a blind "create everything from scratch" operation — the `findByTalentAndOpportunity` reuse check means a User who already has an external/manual tracker entry for a Job they later internally apply to will have that *same* record linked, not duplicated. This is the mechanism that makes "safe for existing data" a source-proven claim rather than an assumption.

## 11. Employer→User synchronization dependency

`EmployerIntelligenceService.transitionPipeline`'s sync step (`OpportunityApplicationRepository.findByLegacyApplicationId`, confirmed in the prior report) has **no dependency on any feature flag itself** — it is unconditional lookup code that already runs on every stage transition. It only *finds something to sync* when a linked `OpportunityApplication` exists. Enabling `APPLICATION_DUAL_WRITE` is therefore both necessary and sufficient to give this already-correct sync code something to act on for *future* internal applications; it does nothing for applications that predate the flag change (§13).

## 12. Notification-link defect

Traced the exact link construction for all three cases:

**A. `opportunityApplicationId` exists** (apply-time path, `automationService.js:100`, already correct — proven by the passing `jobApplicationNotificationLink.test.js`):
```js
link: opportunityApplicationId ? `/applications/${opportunityApplicationId}` : '/dashboard',
```

**B/C. `opportunityApplicationId` is missing, only a legacy Application id is available** (stage-change path, `careerNotificationBridge.js:93-104`, **the confirmed defect**):
```js
const applicationId = event.payload?.opportunityApplicationId
  || event.payload?.legacyApplicationId
  || event.aggregateId;
...
link: applicationId ? `/applications/${applicationId}` : '/applications',
```
This is the exact opposite of the safe pattern already proven in case A — instead of falling back to a safe generic route when the tracker id is unavailable, it falls back through TWO more candidate ids (`legacyApplicationId`, then `event.aggregateId`, which for a `HiringAction`-aggregate event is also the legacy Application id), guaranteeing a User-facing link is built from an Employer-only identifier whenever no tracker exists.

**Smallest correction:** in `careerNotificationBridge.js`, change the `applicationId` resolution to use `event.payload?.opportunityApplicationId` only, with no further fallback candidates — mirroring `onJobApplication`'s already-correct, already-tested pattern exactly:
```js
const applicationId = event.payload?.opportunityApplicationId;
...
link: applicationId ? `/applications/${applicationId}` : '/applications',
```
The `'/applications'` fallback (the User's tracker list page, not any specific record) already exists unchanged and is a safe, existing, User-owned route — satisfying "use a safe fallback such as `/applications` or `/dashboard`" without inventing a new one. No fake tracker id is created; no Employer-only route is ever exposed to the User.

Required source file: `server/src/services/career/careerNotificationBridge.js`, lines 93-95 (the `applicationId` resolution) — no other file needs to change for this specific defect.

## 13. Existing data implications

- Enabling `APPLICATION_DUAL_WRITE` only affects **future** `applyToJob` calls — it has no retroactive effect on any already-persisted `Application`.
- **Dani remains without a tracker record** even after the flag is enabled — her existing Application predates the change and nothing re-processes it automatically.
- Her four existing stage-change notifications (§14 of the prior report) remain permanently pointed at the wrong link — fixing the notification-bridge code only prevents *new* incorrectly-linked notifications; it does not repair ones already written to `usernotifications`.
- No general backfill mechanism is wired to run automatically; the only code capable of retroactively creating linkage is the explicitly-gated bulk `migrateAllJobApplications` job (`CAREER_MIGRATION_JOBS_ENABLED=0`, left off per this audit's explicit instruction not to recommend a broad backfill here).
- **Preferred acceptance strategy, matching this audit's own instruction:** do not attempt to repair Dani's specific record. Enable the flag, then submit one **fresh** internal application (a new Job/candidate pair, or Dani re-applying to a different internal Job) and verify the full chain end to end on that new record. Leave Dani's existing "Andoride Developer" application as a known, permanently-unlinked historical artifact unless a future, separately-audited backfill phase is explicitly requested.

## 14. Backfill implications

A general backfill is technically possible via `ApplicationMigrationService.migrateAllJobApplications` (already gated behind `CAREER_MIGRATION_JOBS_ENABLED`, currently `0`) but is **not recommended in or by this audit** — per the task's own explicit instruction, and because a bulk operation touching every historical `Application` document deserves its own dedicated, separately-scoped audit (verifying `ensureProfile`'s behavior at bulk scale, notification-storm risk from bulk-created `OpportunityApplication` records potentially re-triggering event handlers, and confirming no other Employer already mid-transition on a record would be disrupted). This audit only recommends leaving `CAREER_MIGRATION_JOBS_ENABLED=0` unchanged.

## 15. Test inventory

| Case | Coverage found |
|---|---|
| Dual-write enabled | No direct test; `resolveApplyMode`/`resolveJobApplyType` tests exercise unrelated logic. `dualWriteFromLegacyJobApplication`'s own behavior is not unit-tested. |
| Dual-write disabled | No direct test (the `if (!isApplicationDualWrite()) return null;` early-exit path is unexercised) |
| OpportunityApplication linkage | No direct test of `findByTalentAndOpportunity`'s reuse-and-link behavior |
| Duplicate prevention | No direct test of the unique partial index or the reuse fallback under concurrent/repeated apply attempts |
| Stage synchronization | `employerOaSyncFailure.test.js` covers the **legacy** `syncOpportunityApplicationFromLegacyStatus` failure path only, not `transitionPipeline` |
| Notification link **with** tracker ID | **Covered** — `jobApplicationNotificationLink.test.js`, 13 passing assertions, apply-time path only |
| Notification link **fallback without** tracker ID (stage-change path) | **Missing** — this is the exact gap behind the confirmed live defect |
| User→Employer isolation | Covered by source-contract checks in the prior role-tracking audits; no dedicated executable test for the specific "empty tracker cannot be overwritten" case |

No test was added or modified in this audit.

## 16. Priority findings

- **P0:** none. No ownership leak; enabling dual-write does not expose any User's data to another User or Employer (confirmed via the `talentProfileId`-scoped unique index and `userId`-scoped lookups throughout).
- **P1:** the two already-confirmed findings from the prior live verification — missing linkage (root-caused here to a stale `APPLICATION_DUAL_WRITE=0` override) and the notification-link fallback defect (root-caused here to `careerNotificationBridge.js`'s three-candidate fallback chain, with the exact fix identified and cross-referenced against an already-correct, already-tested sibling implementation).
- **P2:** none newly identified in this audit.
- **P3:** test gaps listed in §15 — most notably the missing "notification fallback without tracker ID" test, which would have caught this defect had it existed alongside the apply-time test it should have mirrored.

## 17. Recommended implementation phase

**PF-TRACK-C2B** (do not implement in this audit):
- Fix `careerNotificationBridge.js`'s `applicationId` resolution to use only `event.payload?.opportunityApplicationId`, per §12.
- Add a focused test mirroring `jobApplicationNotificationLink.test.js`'s structure, proving the stage-change link never falls back to `legacyApplicationId`/`event.aggregateId`.
- Document the exact safe local-staging change: set `APPLICATION_DUAL_WRITE=1` in `.env.staging` (or remove the line).
- Do not touch `CAREER_MIGRATION_JOBS_ENABLED` or attempt any backfill of Dani's or any other existing record.
- Rebuild `api-a`/`api-b` only (not the full stack, not the worker).
- Submit one fresh internal application as the live acceptance step, then verify linkage and Employer→User stage synchronization on that new record specifically.

## 18. Live acceptance plan

1. Set `APPLICATION_DUAL_WRITE=1` in `.env.staging`.
2. Rebuild and restart only `api-a` and `api-b`.
3. As a User, submit a **new** internal "Apply through Strideto" application to any internal Job (a fresh Job/candidate pair, not Dani/Android Developer).
4. Read-only confirm: the new `Application` and a new `OpportunityApplication` both exist, linked via `legacyApplicationId`, with `talentProfileId` populated (no longer null).
5. As the Employer, move that candidate to Interview via Hiring Intelligence.
6. Read-only confirm: the `OpportunityApplication.pipelineStage` becomes `interview`, a `stageHistory` entry with `byActorType: 'employer'` is appended, and the resulting `career.InterviewScheduled` notification's `link` points to `/applications/<the new OpportunityApplication id>` — not any Employer Application id.

## 19. Rollback plan

Setting `APPLICATION_DUAL_WRITE` back to `0` in `.env.staging` and restarting `api-a`/`api-b` immediately reverts to today's exact behavior (Employer Application still created normally; tracker creation silently skipped again) — no data migration or cleanup is required to roll back, since the flag only gates whether *new* linkage is created, never mutates or deletes anything on its own. The notification-link fix (§12), once applied, has no rollback dependency on the flag either way — it is strictly safer in both flag states (falls back to `/applications` instead of a broken Employer-id link, regardless of whether dual-write is on or off).

## 20. Final recommendation

Proceed with **PF-TRACK-C2B**: fix the confirmed notification-link defect in `careerNotificationBridge.js`, add the missing focused test, and set `APPLICATION_DUAL_WRITE=1` in `.env.staging` as a deliberate, explicit local-staging configuration action (not an automatic side effect of any code change). Verify with one fresh internal application, per §18 — do not attempt to repair Dani's existing "Andoride Developer" record, and do not enable `CAREER_MIGRATION_JOBS_ENABLED` or run any bulk backfill in this phase.
