# STRIDETO PF-EMP-INT-B4 Live Acceptance — Candidate Interview Ownership & Notification Correlation

## 1. Verdict

**PASS.** The B4 build (`ea5598e`) is live on both API nodes and the frontend. Against live staging data:

- The **Candidate/User** application detail renders the Employer-owned interview appointment **strictly read-only** — status, date/time, timezone, method, meeting link, location, and outcome are shown, and there is **no Save-interview control** for this employer-linked application.
- A single controlled, Candidate-authenticated `PUT /api/applications/:id/interview` attempting to change `scheduledAt` on the employer-linked application was **rejected `403`** by the server, independent of the UI.
- The rejected request produced **zero persistence**: the `OpportunityApplication` and the appointment are **byte-identical** before and after, with **zero `updatedAt` churn**, **zero** new `InterviewScheduled` notification, **zero** new `interviewInvitation` job, **zero** stage-history change, and **no `applicationId: null` / generic `/applications` notification** created.
- The `applicationId: null` / generic `/applications` notification path is **no longer reachable** from an employer-owned Candidate interview write, because that write is now rejected before any event is emitted.

This report is committed on top of `ea5598e`. Nothing was pushed or deployed. No source or test was modified. The worker was stopped throughout, so no email was delivered.

## 2. Runtime authority

Correlation (masked): candidate `usama` (`…712420`) → OpportunityApplication `…7124a7` (`title: Andoride Developer`) → legacy Application `…7124a0` (employer-linked: `legacyApplicationId` present).

Deployment verified in-container before the run:

- `edurozgaar-staging-api-a` and `-api-b`: `OpportunityApplicationService.upsertInterview` carries the `legacyApplicationId` → `403` ownership guard **and** the `opportunityApplicationId: String(plain._id)` correlation on the emitted `InterviewScheduled` event (3 marker hits each). The Employer `scheduleInterview` / `completeInterview` handlers remain present and **untouched** by `ea5598e` (2 hits each on both nodes).
- `edurozgaar-staging-frontend-1`: the built `ApplicationDetail` chunk carries the `legacyApplicationId` → `employerOwned` gate, and the `applications` chunk carries the read-only `ReadOnlyAppointment` panel with the `interviewEmployerManaged` string.
- `edurozgaar-staging-worker-1`: **stopped** (`Exited (0)`) at every checkpoint.

All persistence verification used bounded, read-only, exactly-correlated queries through `edurozgaar-staging-mongodb-1`. No environment file was read. No database mutation was performed by this acceptance. The only server write *attempted* was the single controlled Candidate request, which the server rejected with no persistence.

## 3. Change under test (`ea5598e`)

`ea5598e` is candidate-scoped:

- **Server** — `OpportunityApplicationService.upsertInterview` rejects with `status 403` **before** the read-modify-write whenever `existing.legacyApplicationId` is set, so a blocked candidate save performs zero persistence and emits no event/invitation. Purely self-tracked applications (no `legacyApplicationId`) keep a candidate-owned appointment the candidate may still manage. On the legitimate self-tracked path, the emitted `InterviewScheduled` event now carries `opportunityApplicationId: String(plain._id)` so the notification bridge deep-links to `/applications/<id>` instead of the generic `/applications` list.
- **Client** — `InterviewPanel` renders a read-only `ReadOnlyAppointment` (status/date-time/timezone/method/link/location/outcome, appointment shown in its own stored zone) when `employerOwned`, with no Save control; `ApplicationDetail` sets `employerOwned={Boolean(application.legacyApplicationId)}`.

The Employer scheduling path (`EmployerIntelligenceService.scheduleInterview`, `PUT /employer/intelligence/candidates/:id/interview`) was **not** touched.

## 4. Checkpoint 1 — deployment + baseline

Deployment confirmed as in §2. Bounded read-only baseline (canonical, consistent with the B3 acceptance final state):

| Signal | Baseline |
|---|---|
| OA `_id` | `6a7258cedd70562f357124a7` |
| `legacyApplicationId` | `6a7258cedd70562f357124a0` (present) |
| OA `updatedAt` | `2026-08-08T01:13:01.405Z` |
| pipelineStage / OA status | `interview` / `active` |
| legacy Application status / `updatedAt` | `interview` / `2026-08-05T18:15:36.312Z` |
| `stageHistory` count / latest `_id` | `41` / `6a7670106128a755e8261b09` (`offer→interview`, employer) |
| `scheduledAt` | `2026-08-15T13:15:00.000Z` |
| `timeZone` | `Asia/Karachi` |
| `mode` | `video` |
| `meetingUrl` | `https://example.com/strideto-interview-b3` |
| `location` | `""` |
| `notes` | `"I am prepared and ready to take interview"` |
| `outcome` | `"Completed — B3 live acceptance"` |
| `InterviewScheduled` (career) count / latest | `7` / `2026-08-08T00:54:24.758Z` |
| `InterviewScheduled` with generic `/applications` link | `1` (pre-existing artifact — see §7) |
| `InterviewCompleted` count / latest | `1` / `2026-08-08T01:13:01.418Z` |
| correlated `interviewInvitation` count / latest | `4` / `…7124a0:2026-08-15T13:15:00.000Z:7479e651f90e` |
| worker | `Exited (0)` (stopped) |

## 5. Checkpoint 2 — Candidate UI read-only (PASS)

The Candidate/User application detail (`/applications/6a7258cedd70562f357124a7`) was opened manually (no devtools, no mutation):

| Field | Canonical | Candidate UI shown | Result |
|---|---|---|---|
| status (derived from outcome) | completed | Completed | pass |
| date/time | `2026-08-15T13:15:00.000Z` @ Asia/Karachi | 15 Aug 2026, 18:15 GMT+5 | pass |
| timezone | `Asia/Karachi` | Asia/Karachi | pass |
| method | video | Video | pass |
| meeting link | `…/strideto-interview-b3` | Join meeting → same URL | pass |
| location | `""` | none / not displayed | pass |
| outcome | `Completed — B3 live acceptance` | exact | pass |
| editable appointment fields | none | **No** | pass |
| Save-interview control | absent | **No** | pass |

The employer-owned appointment is visible, its scheduling fields are read-only, there is no misleading Save-interview control, and every value matches the canonical record. The application-level pipeline stage remained `Interview` (an interview `outcome` does not auto-advance the pipeline); application-level Edit/Archive controls are not interview-scheduling controls and do not violate the read-only requirement.

## 6. Checkpoint 3 — server ownership enforcement + zero side effect (PASS)

One controlled, Candidate-authenticated request was issued exactly once, using the candidate's already-authenticated browser session (fresh access token minted via the app's `POST /auth/refresh-token` httpOnly-cookie path — no environment file read, no secret exposed):

```
PUT /api/applications/6a7258cedd70562f357124a7/interview
body: {"scheduledAt":"2026-09-01T09:00:00.000Z","mode":"video"}
→ HTTP 403
```

The `403` is thrown by the `legacyApplicationId` guard **before** validation and before any read-modify-write. The baseline was frozen immediately before the request (`2026-08-08T01:58:12.293Z`) and re-read immediately after (`2026-08-08T02:01:32.101Z`):

| Signal | Frozen (pre) | After 403 | Required | Result |
|---|---|---|---|---|
| OA `updatedAt` | `2026-08-08T01:13:01.405Z` | identical | byte-identical | pass |
| legacy App `updatedAt` / status | `2026-08-05T18:15:36.312Z` / `interview` | identical | byte-identical | pass |
| pipelineStage / OA status | `interview` / `active` | identical | unchanged | pass |
| `stageHistory` count / latest `_id` | `41` / `…261b09` | identical | unchanged | pass |
| `scheduledAt` | `2026-08-15T13:15:00.000Z` | identical | byte-identical | pass |
| `timeZone` | `Asia/Karachi` | identical | byte-identical | pass |
| mode / link / location / notes / outcome | video / `…strideto-interview-b3` / `""` / preserved / `Completed — B3 live acceptance` | identical | byte-identical | pass |
| `InterviewScheduled` count / latest id | `7` / `…431b4f` | identical | +0 | pass |
| `InterviewScheduled` generic `/applications` count | `1` | `1` | no new null-correlation notification | pass |
| `InterviewCompleted` count / latest | `1` / `…9acb66` | identical | +0 | pass |
| correlated `interviewInvitation` count / latest | `4` / `…7479e651f90e` | identical | +0 | pass |
| worker | `Exited (0)` | `Exited (0)` | stopped | pass |

Only the snapshot's own `frozenAt` timestamp differs. The rejected request wrote **nothing** at the persistence layer — a true zero-write, zero-side-effect rejection, not a suppressed or reverted effect.

## 7. Notification-correlation issue — closed for this path

The pre-B4 defect: the candidate `upsertInterview` emitted `InterviewScheduled` without an `opportunityApplicationId`, so the notification bridge fell back to the generic `/applications` route (`applicationId: null` correlation). Exactly **one** such generic-link `InterviewScheduled` notification exists in this candidate's history (a pre-existing artifact from before the fix); it was left **byte-identical and untouched**.

B4 closes the path two ways:

1. For the **employer-owned** application, the candidate write is rejected `403` before any event is emitted, so it can **never** mint a generic/null-correlated notification. The Checkpoint-3 invariant confirms the generic-link count stayed at `1` (no new one created).
2. For the **self-tracked** path (below), the emitted event now carries `opportunityApplicationId: String(plain._id)`, so a legitimate self-tracked interview notification deep-links to `/applications/<id>`.

## 8. Self-tracked candidate branch — source/test-confirmed only

Per the B4 plan, the purely self-tracked candidate branch (no `legacyApplicationId`) was **not** live-mutated in this acceptance. Its behavior is confirmed by source and by the shipped test `server/src/__tests__/candidateInterviewOwnership.test.js`, which re-binds the shipped `upsertInterview` verbatim and asserts: the `legacyApplicationId` guard rejects with `status 403` before `setInterview` (employer-linked → zero write/emit), while the self-tracked branch proceeds and emits `InterviewScheduled` carrying `opportunityApplicationId`, and the notification bridge reads `opportunityApplicationId` for the deep link. No live candidate-owned appointment was created or edited here.

## 9. Employer ownership still functional

Verified without introducing another appointment mutation:

- `ea5598e` touched **no** employer scheduling path (candidate-scoped change only); the Employer `scheduleInterview` / `completeInterview` handlers are deployed and unchanged on both API nodes.
- The Employer Candidate Detail scheduling/rescheduling controls were live-proven against this exact build in the B3 acceptance (a real Employer reschedule, identical save, and completion all succeeded); since B4 does not touch that path, Employer ownership remains functional.
- The Candidate view remains strictly read-only (§5).

The completed B3 appointment was deliberately **not** rescheduled merely to re-demonstrate button presence.

## 10. Deferred and out of scope

- **Candidate-private notes** — a candidate-private note channel distinct from the Employer-owned appointment is deferred; not exercised here.
- **Self-tracked candidate live acceptance** — source/test-confirmed only (§8); no live self-tracked mutation performed.
- **Historical pending-invitation cleanup** — the pre-existing pending `interviewInvitation` jobs (one B2-era key, two B3A keys, one B3B key) and the single generic-link notification were left byte-identical and untouched; triage remains separate.
- **Cancellation / reminders** — not in scope.
- **Actual email delivery — NOT tested.** The worker was stopped throughout by design; no template transport, retry, or dead-letter behavior was exercised.

## 11. Scope discipline

No source or test was modified during acceptance. No test or build was run. No environment file was read. No database mutation was performed; the only server write attempted was the single controlled Candidate request, which the server rejected `403` with zero persistence. The worker was never started. Nothing was pushed or deployed. Only this report is committed.

## 12. Next

**PF-EMP-UX-B5A.**
