# STRIDETO PF-EMP-INT-B3 Live Acceptance — Appointment Timezone Identity, Invitation Formatting, and Completion

## 1. Verdict

**PASS.** The B3B build (`4bc113a`) is live on both API nodes and the frontend, and one controlled Employer reschedule proved, against live staging data, that an interview appointment now stores an exact UTC instant **and** the browser's IANA timezone, that both the candidate in-app notification and the queued invitation render the Employer's intended wall clock in that stored zone rather than the container's UTC, that an immediately repeated identical save is a true zero-write no-op, and that marking the interview completed records the outcome without disturbing any appointment field.

This report is committed on top of `4bc113a`. Nothing was pushed or deployed. No source or test was modified. The worker was stopped throughout, so no email was delivered.

## 2. The earlier B3 run was diagnostic only

A prior B3 pass against this same candidate was **deliberately contaminated** by three UI writes (Employer, Candidate/User, Employer) plus subsequent pipeline stage churn, and is explicitly **not** a clean acceptance. Its residue was the *starting* state for this run, not a result of it:

- appointment `scheduledAt 2026-08-12T14:30:00.000Z`, `mode video`, `meetingUrl …/strideto-interview-b3`, **no `timeZone`** (the appointment predated B3B), candidate-authored `notes` intact, empty `outcome`
- `InterviewScheduled` notifications: 6
- correctly-correlated `interviewInvitation` jobs: 3 (one B2-era key, two B3A keys sharing instant `2026-08-12T14:30` but differing by link digest)
- one malformed `email:interview:undefined` job (unrelated recipient), pending, untouched
- pipeline `stageHistory`: **41** — see §3

The side-effect counts of that diagnostic run are not treated as a clean sequence. This acceptance measures only the deltas produced by the four controlled actions below.

## 3. Baseline reconciliation — history 41, not 37

The provided known-state named `history 37`. The live value at baseline was **41**. The gap is fully explained and benign: index #36 (`offer → interview @ 2026-08-05T19:13:54.680Z`) is exactly the latest transition recorded by the B2 acceptance, i.e. 37 was the pre-churn count. The diagnostic run then added four additional *pipeline* stage transitions on 2026-08-07 (`interview→rejected→interview→offer→interview`, 23:48–23:53), landing the stage back on `interview` at count 41. The correct Checkpoint-2 invariant is therefore "history unchanged at **41** by an appointment-only reschedule," which held. Legacy `updatedAt` has been byte-identical at `2026-08-05T18:15:36.312Z` since the B2 run.

## 4. Runtime authority

Correlation (masked): candidate `Usama121` (`…712420`) → job `Andoride Developer` (`…70f66`) → legacy Application `…7124a0` → OpportunityApplication `…7124a7`.

Deployment verified in-container before the accepted run:

- `edurozgaar-staging-api-a` and `-api-b`: `utils/appointmentTime.formatAppointmentTime`, `EmployerIntelligenceService.parseTimeZone` + `interviewTimeZone` plumbing, `models/career/ApplicationContact.timeZone` field, `careerNotificationBridge.formatAppointmentTime`, and `automationService` `whenLabel` + zone-in-digest — all present on **both** nodes.
- `edurozgaar-staging-frontend-1`: the built `EmployerCandidateDetail` chunk carries `Intl.DateTimeFormat().resolvedOptions().timeZone` capture and the `interviewTimezoneHint` string.
- `edurozgaar-staging-worker-1`: **stopped** (`Exited (0)`) at every checkpoint.

All verification used bounded, read-only, exactly-correlated queries through `edurozgaar-staging-mongodb-1`. No environment file was read. No database mutation was performed by this acceptance — the only writes came from the operator's manual Employer UI actions.

## 5. Checkpoint 2 — clean reschedule (PASS)

One Employer reschedule: local `08/15/2026 06:15 PM`, device zone Asia/Karachi, Video, one click, nothing else touched.

| Signal | Baseline | After | Required | Result |
|---|---|---|---|---|
| pipeline stage | interview | interview | unchanged | pass |
| legacy status | interview | interview | unchanged | pass |
| legacy `updatedAt` | `2026-08-05T18:15:36.312Z` | identical | byte-identical | pass |
| `stageHistory` | 41 | 41 | unchanged | pass |
| `scheduledAt` | `2026-08-12T14:30:00.000Z` | `2026-08-15T13:15:00.000Z` | 06:15 PM Asia/Karachi as UTC | pass |
| `timeZone` | absent | `Asia/Karachi` | actual browser zone | pass |
| same-browser reload | — | renders 6:15 PM | shows 18:15 local | pass |
| OA `updatedAt` | `2026-08-07T23:53:52.032Z` | `2026-08-08T00:54:24.724Z` | changes | pass |
| `notes` | candidate-authored | preserved verbatim | preserved | pass |
| `InterviewScheduled` | 6 | 7 | +1 exactly | pass |
| correlated `interviewInvitation` | 3 | 4 | +1 exactly | pass |
| historical jobs | fixed | unchanged | byte-identical | pass |
| worker | stopped | stopped | stopped | pass |

`18:15` Asia/Karachi (UTC+5, no DST) resolves to `13:15:00.000Z` — the exact stored instant.

### 5.1 Timezone notification (PASS)

The new candidate in-app `InterviewScheduled` body rendered:

> `Scheduled for Aug 15, 2026, 6:15 PM GMT+5 (Asia/Karachi).`

This is the decisive result. The same instant under the pre-B3B code path rendered in container UTC (`2:30:00 PM`-style, no zone). The body is now the Employer's intended wall clock, labelled with the stored zone — not the process zone.

### 5.2 Invitation formatting and key (PASS)

The new job key is `email:interview:…7124a0:2026-08-15T13:15:00.000Z:7479e651f90e` and its vars carry every communicated field:

- raw instant `when = 2026-08-15T13:15:00.000Z` (kept for correlation/debugging)
- `timeZone = Asia/Karachi`
- `whenLabel = Aug 15, 2026, 6:15 PM GMT+5 (Asia/Karachi)` (the only human-shown form)
- `mode = video`
- `link = https://example.com/strideto-interview-b3`

The instant stays legible in the key; mode/link/location/zone are folded into the 12-hex digest, so the raw URL never enters the key while any change to a communicated field still mints a new key.

### 5.3 Meeting-link note

The originally-suggested test link `…/strideto-b3b-final` was a *planned* value and was **not** entered; the clean Action 1 actually submitted the existing `…/strideto-interview-b3`, and acceptance follows what was actually performed. The server stored and queued exactly the submitted link, confirmed by both the persisted `meetingUrl` and the dedup digest. The *link-change* identity itself was already live-proven by the diagnostic run, where two jobs sharing instant `2026-08-12T14:30` but differing only in link produced distinct B3A digests (`53cab88e…` for an empty link vs `8a7d81…` for `…/strideto-interview-b3`) and therefore two separate invitations. That mutation was deliberately not repeated here.

## 6. Checkpoint 3 — identical save (PASS)

The exact current form state was re-saved, one click, nothing changed. Every value is byte-identical to Checkpoint 2:

| Field | Ckpt 2 | Ckpt 3 | Result |
|---|---|---|---|
| `scheduledAt` | `2026-08-15T13:15:00.000Z` | identical | identical |
| `timeZone` | `Asia/Karachi` | identical | identical |
| OA `updatedAt` | `2026-08-08T00:54:24.724Z` | identical | identical — zero churn |
| legacy `updatedAt` | `2026-08-05T18:15:36.312Z` | identical | identical |
| `stageHistory` | 41 | 41 | unchanged |
| mode / link / location / notes / outcome | video / `…strideto-interview-b3` / `""` / preserved / `""` | identical | unchanged |
| `InterviewScheduled` | 7 (latest `00:54:24.758Z`) | 7 (same id/timestamp) | no new notification |
| correlated `interviewInvitation` | 4 (latest `00:54:24.750Z`) | 4 (same `updated`) | no new invitation |

The identical save succeeded and wrote nothing at the persistence layer — a true no-op, not a suppressed side effect. This confirms the B3B additions (timezone in the effective-appointment identity) do not perturb idempotency: the same effective appointment still maps to the same key.

## 7. Checkpoint 4 — completion (PASS)

Outcome `Completed — B3 live acceptance` entered, **Mark interview completed** clicked once, appointment untouched.

| Signal | Before | After | Required | Result |
|---|---|---|---|---|
| `outcome` | `""` | `Completed — B3 live acceptance` | stored | pass |
| derived status | scheduled | completed | completed | pass |
| `scheduledAt` | `2026-08-15T13:15:00.000Z` | identical | preserved | pass |
| `timeZone` | `Asia/Karachi` | identical | preserved | pass |
| mode / link / location / notes | video / `…strideto-interview-b3` / `""` / preserved | identical | preserved | pass |
| pipeline stage / `stageHistory` | interview / 41 | interview / 41 | unchanged | pass |
| legacy status / `updatedAt` | interview / `2026-08-05T18:15:36.312Z` | identical | unchanged | pass |
| `InterviewScheduled` | 7 | 7 | zero new | pass |
| correlated `interviewInvitation` | 4 | 4 | zero new | pass |
| `InterviewCompleted` | 0 | 1 | matches contract | pass |
| worker | stopped | stopped | stopped | pass |

`completeInterview` patches only `outcome` (re-writing `notes` to its own existing value) and emits one `InterviewCompleted` event whose in-app body is `Open your application tracker for details.` It touches no appointment field and no pipeline stage. OA `updatedAt` advanced to `2026-08-08T01:13:01.405Z` as the sole effect of persisting the outcome.

## 8. Evidence classification

- **Live-confirmed** — appointment timezone identity is stored (`timeZone: Asia/Karachi`), the exact UTC instant round-trips (`18:15` local ⇄ `13:15Z`), the candidate in-app notification renders in the stored zone (`6:15 PM GMT+5 (Asia/Karachi)`) not container UTC, the queued invitation carries raw instant + zone + human `whenLabel` + mode + link, an identical save is a true zero-write no-op, and completion records the outcome while preserving every appointment field.
- **Already live-proven by the diagnostic run, not re-exercised** — a meeting-link change alone (same instant) produces a distinct B3A dedup key and a separate invitation.

## 9. Deferred and out of scope

- **Candidate/User interview ownership → PF-EMP-INT-B4.** The candidate-side `PUT /applications/:id/interview` path was not exercised. Whether a User can overwrite an Employer-scheduled appointment remains open.
- **`applicationId: null` invitation fallback → B4.** Not exercised here.
- **Historical pending-invitation cleanup → deferred.** The four pre-existing pending jobs (one malformed `email:interview:undefined`, one B2-era key, two B3A keys, and now the B3B key) were left byte-identical and untouched. A per-application invitation may still carry a superseded appointment relative to the latest in-app notification; triage remains separate.
- **Cancellation / reminders → not in scope.**
- **Actual email delivery — NOT tested.** The worker was stopped throughout by design. Invitations were verified as correctly-formed queued `BackgroundJob` rows only; no template transport, retry, or dead-letter behavior was exercised.

## 10. Scope discipline

No source or test was modified during acceptance. No test or build was run. No environment file was read. No database mutation was performed except through the operator's manual Employer UI actions (reschedule, identical save, completion). The worker was never started. Nothing was pushed or deployed. Only this report is committed.

## 11. Next

**PF-EMP-INT-B4** — Candidate/User interview ownership and the `applicationId: null` invitation fallback.
