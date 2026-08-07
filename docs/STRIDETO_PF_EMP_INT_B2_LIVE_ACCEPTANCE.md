# STRIDETO PF-EMP-INT-B2 Live Acceptance — Interview Write Integrity and Idempotency

## 1. Verdict

**PASS**, after one live defect was found and repaired mid-acceptance.

The first live attempt to accept PF-EMP-INT-B2 **failed** and exposed a real, previously unknown defect: a genuine interview appointment queued no invitation at all when the candidate's legacy status was already `interview`. That defect was fixed in `fd2954f` (PF-EMP-INT-B2C), redeployed to both API nodes, and then live-proved with one controlled reschedule followed by one immediately repeated identical save. Both the repair and the idempotency guarantee are confirmed against live staging data, not against tests alone.

## 2. Repository and runtime authority

- Fix commit: `fd2954f` — `fix(employer): queue genuine interview invitations`, parent `00090352c54c303499aa2c328848869911de6424`
- This report commits on top of `fd2954f`; branch `main...origin/main`, not pushed, not deployed beyond the staging rebuild described below
- Deployment verified live on **both** API nodes before the accepted run: `isAtInterviewStatus && (isLegacyStatusChanged || isAppointmentChanged)` present at line 633 of the in-container `EmployerIntelligenceService.js` in `edurozgaar-staging-api-a` and `edurozgaar-staging-api-b`
- Worker `edurozgaar-staging-worker-1`: **stopped throughout** (`Exited (0)`, 4 days), verified at every checkpoint. No email was delivered at any point.
- All verification used bounded, read-only, exactly-correlated queries through `edurozgaar-staging-mongodb-1`. No environment file was read. No database mutation was performed by this acceptance — the only two writes came from the operator's two manual Employer UI actions.

Correlation chain (masked): candidate `Usama121` → job `Andoride Developer` → legacy Application `…7124a0` → OpportunityApplication `…7124a7`.

## 3. The original B2 live defect

A first genuine appointment save was performed against the pre-fix build (`0009035`). It produced:

| Signal | Before | After | Expected | Result |
|---|---|---|---|---|
| `scheduledAt` | `null` | `2026-08-20T00:00:00.000Z` | set | ok |
| derived status | `none` | `scheduled` | `scheduled` | ok |
| `InterviewScheduled` notification | 1 | 2 | +1 | ok |
| **scoped `interviewInvitation` job** | **0** | **0** | **+1** | **FAIL** |

Root cause, in `EmployerIntelligenceService.scheduleInterview`: `onApplicationStatusChange` — the only call site that queues the `interviewInvitation` email — sat **inside** the `isLegacyStatusChanged` branch. The invitation was therefore gated on the legacy status *transitioning into* `interview`, not on the appointment being genuinely scheduled. This candidate's legacy status was already `interview` (set earlier by a bare stage move, the exact sequence PF-EMP-INT-B1 produces), so the branch never ran and no invitation was ever queued for a real, dated appointment.

The `InterviewScheduled` event was unaffected because it already had its own independent `isAppointmentChanged` gate.

Impact class: any candidate whose legacy status reached `interview` before a genuine appointment was scheduled would silently never receive an interview-invitation email.

## 4. The B2C fix (`fd2954f`)

The smallest correction that satisfies the contract: the status hook was moved out of the status-transition branch and given a union gate.

```js
if (isLegacyStatusChanged) {
  application.status = 'interview';
  await application.save();
}

const isAtInterviewStatus = application.status === 'interview';
if (isAtInterviewStatus && (isLegacyStatusChanged || isAppointmentChanged)) {
  await onApplicationStatusChange({ /* interviewWhen: isAppointmentChanged ? … : null */ });
}
```

Three properties are preserved by construction rather than by convention:

- **B1 truthfulness holds** — `interviewWhen` remains `isAppointmentChanged ? scheduledAt : null`, so a stage-only transition still supplies no datetime and `automationService` still withholds the invitation.
- **No duplicate stage sync** — the hook is invoked at most once per request, and its notification carries `dedupKey: application:status:<id>:<status>`, making a repeat sync a persistence-level no-op.
- **`hired` is untouched** — gating on `application.status === 'interview'` means a hired application can never reach the `offerLetter` branch from the scheduling path.

`automationService` was not redesigned. Focused tests were extended to execute all four contract cases (A stage-only, B appointment-only with status already `interview`, C appointment + stage together, D identical no-op) plus the `hired` guard and the existing 403/404 authorization cases. Six targeted suites ran green.

## 5. Live-confirmed: genuine reschedule (Checkpoint 2)

One controlled reschedule, one click, nothing else modified.

| Field | Before | After | Required | Result |
|---|---|---|---|---|
| pipeline stage | `interview` | `interview` | unchanged | pass |
| legacy status | `interview` | `interview` | unchanged | pass |
| legacy `updatedAt` | `2026-08-05T18:15:36.312Z` | `2026-08-05T18:15:36.312Z` | byte-identical (zero legacy save) | pass |
| `stageHistory` count | 37 | 37 | unchanged | pass |
| latest transition | `offer → interview` @ `19:13:54.680Z` | identical | unchanged | pass |
| `scheduledAt` | `2026-08-20T00:00:00.000Z` | `2026-08-10T00:00:00.000Z` | new instant | pass |
| OA `updatedAt` | `2026-08-07T21:38:02.505Z` | `2026-08-07T22:23:31.666Z` | changed | pass |
| derived status | `scheduled` | `scheduled` | `scheduled` | pass |
| `InterviewScheduled` notification | 2 | 3 | +1 exactly | pass |
| **scoped `interviewInvitation`** | **0** | **1** | **+1 exactly** | **pass — defect repaired** |
| `location` / `meetingUrl` / `notes` / `outcome` | all absent | all absent | no fabrication | pass |

The queued invitation carries a real appointment: `templateKey: interviewInvitation`, `when: 2026-08-10T00:00:00.000Z`, `link: ''`, status `pending` (undelivered — worker stopped). The candidate notification body rendered `Scheduled for 8/10/2026, 12:00:00 AM.`

This is the decisive evidence: the legacy status was already `interview`, so **zero** legacy saves occurred, and the invitation was still queued. That combination was impossible before `fd2954f`.

## 6. Live-confirmed: identical-save idempotency (Checkpoint 3)

The same datetime was re-saved immediately, one click, nothing changed. Every value is byte-identical to Checkpoint 2.

| Field | Checkpoint 2 | Checkpoint 3 | Result |
|---|---|---|---|
| `scheduledAt` | `2026-08-10T00:00:00.000Z` | `2026-08-10T00:00:00.000Z` | identical |
| OA `updatedAt` | `2026-08-07T22:23:31.666Z` | `2026-08-07T22:23:31.666Z` | identical — zero timestamp churn |
| legacy `updatedAt` | `2026-08-05T18:15:36.312Z` | `2026-08-05T18:15:36.312Z` | identical |
| `stageHistory` count | 37 | 37 | unchanged |
| pipeline stage / tracker | `interview` | `interview` | unchanged |
| `InterviewScheduled` notification | 3 (latest `22:23:31.693Z`) | 3 (latest `22:23:31.693Z`) | unchanged — no new notification |
| scoped `interviewInvitation` | 1 (`createdAt`/`updatedAt` `22:23:31.689Z`) | 1 (both timestamps identical) | unchanged — no new invitation |
| status-notification job (`application:status:…:interview`) | — | 1 | no duplicate stage sync |
| appointment metadata | all absent | all absent | no unrelated change |

The request succeeded and wrote nothing. The identical save is a true no-op at the persistence layer, not merely a suppressed side effect.

## 7. Evidence classification

Stating plainly what this acceptance does and does not establish.

**Live-confirmed idempotency** — an immediately repeated identical save produces zero writes, zero `updatedAt` churn on either record, zero events, zero notifications, zero invitation jobs, and zero stage or history changes. Verified directly against staging data.

**Live-confirmed invitation repair** — a genuine appointment change queues exactly one correctly-keyed invitation carrying a real datetime, independent of whether the legacy status changes. Verified directly against staging data.

**Source/test-confirmed omitted-field preservation** — `patchInterview` builds a field-scoped `$set` and filters `undefined`, so an Employer payload that omits `meetingUrl`, `location`, `notes`, or `outcome` leaves those fields intact rather than wiping them (the `$set`-full-replacement hazard from the original audit §6). This is confirmed by source inspection and focused tests. It is **not** live-confirmed here: the Employer UI never sends those fields today, so this candidate's record had all four absent before and after, which cannot distinguish preservation from absence. Live proof requires the richer Employer form arriving in PF-EMP-INT-B3.

**Email delivery — NOT tested.** The worker was stopped throughout by design. Invitations were verified as correctly-formed queued `BackgroundJob` rows only. Nothing was sent; no template rendering, transport, retry, or dead-letter behavior was exercised.

**Timezone identity — NOT tested.** The operator recorded entering `2026-08-10T12:00`; the stored instant is `2026-08-10T00:00:00.000Z` and renders as `12:00:00 AM`. The date matches and the instant round-trips self-consistently, but the Employer client still sends a raw local datetime string with no zone identity (audit §10), and this acceptance made no attempt to prove which wall-clock time the employer intended. Cross-zone and DST correctness remain unverified.

**Candidate / User interview ownership — NOT tested.** The candidate-side `PUT /applications/:id/interview` path was not exercised. Whether a User can still overwrite an Employer-scheduled appointment (audit §21, P1 item 3) is untouched by B2/B2C and remains open for PF-EMP-INT-B4.

## 8. Deferred and left untouched

- **Malformed historical job left untouched.** One pre-existing `BackgroundJob` carries the malformed dedup key `email:interview:undefined` (created `2026-08-04T20:29:14.963Z`, status `pending`). Its `createdAt` and `updatedAt` were byte-identical at all three checkpoints. It does not correlate to this application and was deliberately not cleaned up, migrated, or otherwise modified. It should be triaged separately.
- **Second genuine reschedule with an existing correctly-keyed invitation — deferred to PF-EMP-INT-B3.** The invitation `dedupKey` is `email:interview:<applicationId>`, i.e. **per application, not per appointment**. This acceptance queued the first correctly-keyed invitation for this application. A subsequent reschedule will therefore emit a fresh `InterviewScheduled` notification but will **not** queue a second email — the candidate would be notified in-app of the new time while the only queued email still carries the old one. That behavior was not exercised here and is the natural scope of the B3 reschedule work.

## 9. Scope discipline

No source was modified during the acceptance runs themselves; the only source change in this sequence is `fd2954f`, made between the defect reproduction and the accepted run, and committed separately. No tests or builds were run during acceptance. No environment file was read. No database mutation was performed except through the operator's two manual Employer UI actions. The worker was never started. Nothing was pushed or deployed.

## 10. Next

**PF-EMP-INT-B3** — Employer scheduling UI completion: method selector, meeting link, location, candidate instructions, and reschedule / cancel / complete controls, plus the per-application invitation dedup behavior noted in §8.
