# STRIDETO Employer Interview Scheduling Workflow Audit (PF-EMP-UX-B4)

## 1. Verdict

**READY FOR TARGETED INTERVIEW WORKFLOW IMPLEMENTATION**

Scheduling persists and notifies, and ownership is correctly enforced on every write — but the workflow is incomplete in ways that are actively misleading today, not merely unfinished. Three findings are confirmed against live data: moving a candidate to the `interview` **stage** emits an `InterviewScheduled` event, so the candidate is told "Interview scheduled" when no appointment exists (live: 1 such notification, `interview.scheduledAt: null`); the derived status projection reports `status: 'scheduled'` for that same appointment-less state, so the Employer's own UI agrees with the false claim; and the User's own tracker panel can **overwrite an Employer-scheduled interview**, which breaks the one-directional isolation every prior phase in this series established. Reschedule and cancel do not exist in any form, completion exists server-side with zero client callers, and `meetingUrl` is silently discarded by the Employer path. No cross-tenant or private-note exposure was found.

## 2. Repository authority

- HEAD: `3b4adbbfeaa758cd9952fba9a3f90f049c0857a9`, parent `97e5654d91f564646f878a59661d6008eb85585d`
- Branch: `main...origin/main [ahead 88]`, tracked tree clean, staged: none
- Preserved untracked reports present and unmodified; `.env.staging` ignored and untouched
- Worker: confirmed stopped
- No source, test, database, Docker, or environment change was made. No interview was scheduled, rescheduled, cancelled, or completed. No stage was moved.

## 3. Current live evidence

Candidate Usama121 / Job "Andoride Developer" (`…7124a0` legacy, `…7124a7` tracker):

| Item | Value |
|---|---|
| Canonical stage | `offer` |
| Legacy status | `interview` |
| `interview` object | `{ scheduledAt: null, mode: 'video', location: '', meetingUrl: '', notes: '', outcome: '' }` — **all defaults; never scheduled** |
| `career.InterviewScheduled` notifications | **1** |
| `career.InterviewCompleted` notifications | 0 |
| Interview timeline events | 0 |
| Queued `interviewInvitation` emails | **1** (undelivered — worker stopped) |
| Failed emails | 0 |

The candidate has **never had an appointment scheduled**, yet has received an "Interview scheduled" in-app notification and has an interview-invitation email sitting in the queue. Both were produced by a stage transition alone.

## 4. End-to-end workflow

```
Employer Candidate Detail (datetime-local + "Save interview")
  → employerApi.intelligenceScheduleInterview(id, { scheduledAt, mode: 'video' })
  → PUT /api/employer/intelligence/candidates/:id/interview
  → requireAuth + requireEmployerAuth + requireEmployerIntelligenceEnabled
  → getOwnedLegacyApplication(employerId, id)        [ownership]
  → scheduledAt parsed/validated (NaN only)
  → OpportunityApplicationRepository.setInterview(oa._id, interview)   [$set full replace]
  → conditional pushStageHistory(→ 'interview')      [auto stage move]
  → legacy application.status = 'interview' + save   [auto legacy move]
  → onApplicationStatusChange → queueEmail('interviewInvitation')  [worker-dependent]
  → emitHiringEvent('InterviewScheduled') → careerNotificationBridge → notifyUser
  → returns { interview, applicationId }
```

## 5. Route / API contract

| Action | Route | Method | Client caller | Notes |
|---|---|---|---|---|
| Schedule | `/employer/intelligence/candidates/:id/interview` | `PUT` | `EmployerCandidateDetail.onInterview` | sends only `{ scheduledAt, mode: 'video' }` |
| Complete | `/employer/intelligence/candidates/:id/interview/complete` | `POST` | **none** | service implemented, zero UI callers |
| Reschedule | — | — | — | **absent** (re-scheduling reuses the schedule route, overwriting) |
| Cancel | — | — | — | **absent entirely** |
| User upsert | `/applications/:id/interview` | `PUT` | `InterviewPanel` (User tracker) | writes the **same** subdocument |

Accepted-but-unused server payload fields on schedule: `location`, `notes`, `type` (alias for `mode`). Never sent by the Employer UI.

## 6. Persistence model

`interviewScheduleSchema` (`ApplicationContact.js`, `{ _id: false }`), embedded as `OpportunityApplication.interview`:

| Field | Classification |
|---|---|
| `scheduledAt` | implemented and persisted |
| `mode` | persisted, but **hard-coded to `'video'`** by the Employer UI |
| `location` | accepted by API, **never sent** by Employer UI |
| `meetingUrl` | in schema, **never written by the Employer path at all** — omitted from the object `scheduleInterview` builds |
| `notes` | accepted by API, never sent by Employer UI; **shared field with the candidate** (§17) |
| `outcome` | written only by `completeInterview`, which has no UI |
| timezone / tz identity | **missing** |
| `status` enum | **missing** — derived at read time (§9) |
| `scheduledBy` | missing |
| subdoc `createdAt` / `updatedAt` | missing (`_id: false`, no timestamps) |
| `completedAt` / `cancelledAt` / cancellation reason | missing |
| `feedback` | missing |
| reminder timestamps | missing |
| candidate-visible instructions (separate from private notes) | missing |

**Full-replacement hazard:** `setInterview` performs `$set: { interview }`. `scheduleInterview` builds `{ scheduledAt, mode, location, notes, outcome: '' }` — with no `meetingUrl` — so every Employer schedule **wipes any existing `meetingUrl` and resets `outcome` to `''`**. Re-scheduling after completion silently erases the recorded outcome. (`completeInterview` correctly spreads `...oa.interview`, so it does not have this problem.)

## 7. Employer UI

`EmployerCandidateDetail.jsx`: a single `datetime-local` input plus a "Save interview" button, and a one-line status readout.

| Control | State |
|---|---|
| Date/time field | present |
| Minimum-date validation | **absent** (no `min`, no server past-date rejection) |
| Timezone disclosure | **absent** |
| Method selector | **absent** — hard-coded `mode: 'video'` |
| Video-link input | **absent** |
| Location input | **absent** |
| Phone option | **absent** |
| Candidate instructions | **absent** |
| Save vs. update distinction | **absent** — same button always overwrites |
| Loading state | shared `saving` flag |
| Error state | shared `error` banner |
| Current appointment summary | one line: status + `toLocaleString()` date |
| Reschedule / Cancel / Complete / Outcome | **absent** |
| Terminal-stage behavior | unguarded — a `rejected`/`withdrawn`/`joined` candidate can still be scheduled |

**Classification: FUNCTIONAL BUT INCOMPLETE.**

## 8. User UI

`InterviewPanel.jsx` (User tracker) is **materially richer than the Employer's**: `datetime-local`, a 4-option mode selector (`video`, `phone`, `in_person`, `other`), `location`, `meetingUrl`, and `notes` — all editable, all saved via `PUT /applications/:id/interview`.

The candidate can therefore see date, local time, method, link, location and notes, and the appointment also surfaces in `ApplicationCalendarView`. What the candidate cannot see: timezone identity, a real status enum, or any cancellation/completion state (none exist).

The inversion is the finding: the party who *schedules* interviews has the weaker form, and the party who merely attends has full edit rights over the record.

## 9. Pipeline stage versus appointment

| Rule | Current behavior | Classification |
|---|---|---|
| A. Move to Interview changes stage, does **not** fabricate an appointment | Stage changes correctly and `interview.scheduledAt` is untouched — **but** `eventForPipelineStage('interview')` returns `'InterviewScheduled'`, so the candidate is notified "Interview scheduled", and `onApplicationStatusChange` queues an `interviewInvitation` **email** | **disconnected** |
| B. Schedule stores details, notifies, does not necessarily move stage | Stores and notifies correctly, **but also auto-moves** both canonical stage and legacy status to `interview` | partially implemented |
| C. Reschedule updates once, records history, one notification, preserves stage | No distinct path; re-using schedule overwrites the record, re-emits `InterviewScheduled`, and may re-push stage history | **absent** |
| D. Cancel marks cancelled and informs the User | No endpoint, no status, no event | **absent** |
| E. Complete marks complete and records outcome | Service implemented and emits `InterviewCompleted`; **no UI caller anywhere** | disconnected |

Compounding this, `resolveInterviewStatus` reports `status: 'scheduled'` whenever the *legacy status* is `interview`, even with `scheduledAt: null` — so the projection itself conflates stage with appointment. Our live candidate is in exactly that state.

## 10. Timezone and datetime handling

Chain: `datetime-local` (no zone) → `new Date(value)` in browser-local → the Employer client sends the **raw local string** (`{ scheduledAt: interviewAt }`, unlike the User panel which sends `.toISOString()`) → server `new Date(body.scheduledAt)` → stored as a BSON `Date` (UTC instant) → displayed with `toLocaleString()` / `toLocalInput()` in each viewer's own zone.

- Browser timezone preserved: only implicitly, via the resolved instant
- UTC conversion: correct in effect for a single-zone deployment
- Timezone identity stored: **no**
- DST relevance: low for Pakistan (no DST), but the absence of a stored zone makes cross-zone or future-DST rendering unverifiable
- Past dates rejected: **no** — only `Number.isNaN` is checked
- Invalid dates rejected: yes (NaN guard)
- Seconds/ms: `datetime-local` yields minute precision; no inconsistency observed
- Silent shift on reschedule: possible in principle, since the record carries no zone and no history

Because Employer and candidate are both in one locale today and the instant round-trips correctly, this is not currently producing wrong times — but nothing in the model would prevent it.

**Classification: FUNCTIONAL WITH LIMITATIONS.**

## 11. Scheduling

Works and persists. Ownership enforced via `getOwnedLegacyApplication` before any write. Emits `InterviewScheduled`; queues `interviewInvitation` email (`dedupKey: email:interview:${applicationId}` — deduplicated per application, so a reschedule will **not** send a second email). Auto-advances stage. No past-date guard, no terminal-stage guard, no same-time no-op guard.

## 12. Rescheduling

Not modeled. Re-submitting the schedule form overwrites the subdocument wholesale (§6), emits another `InterviewScheduled` (candidate sees a second "Interview scheduled", not "rescheduled"), and may append another stage-history entry. No before/after record of the change is kept.

## 13. Cancellation

Entirely absent: no endpoint, no schema field, no status value, no event, no UI, no candidate notification. The only way to "cancel" is to leave a stale future appointment in place or overwrite it.

## 14. Completion and outcome

`completeInterview` is fully implemented server-side — spreads the existing interview, sets `outcome` (default `'completed'`), emits `InterviewCompleted`, and returns refreshed detail with `recordView: false`. It has **zero client callers** (confirmed repo-wide). `outcome` is free text; there is no enum, no `completedAt`, and no feedback field.

## 15. Notifications

| Event | Producer | Recipient | Link | Dedup | Notes |
|---|---|---|---|---|---|
| `InterviewScheduled` | `scheduleInterview` **and** `transitionPipeline`(→interview) | candidate | `/applications/<OA id>` | none | fires with no appointment when triggered by a stage move |
| `InterviewCompleted` | `completeInterview` | candidate | `/applications/<OA id>` | none | unreachable from UI |
| Rescheduled | — | — | — | — | **absent** |
| Cancelled | — | — | — | — | **absent** |
| Reminder | — | — | — | — | **absent** — no interview reminder path exists anywhere |
| `application.interview` (legacy) | `onApplicationStatusChange` | candidate | `/dashboard` | — | separate legacy notification, links to dashboard rather than the application |

Both career events route through `careerNotificationBridge`, which after PF-EMP-UX-B2 links correctly to the OpportunityApplication id. Duplicate risk is real for scheduling (no idempotency guard, no dedup key on the in-app notification).

## 16. Email / reminders and worker dependency

`interviewInvitation` exists (en/ur) and is queued — never sent synchronously. With the worker stopped, it stays pending: **1 such job is queued live right now and undelivered**. Its `dedupKey` is per-application, so only the first interview email per application will ever send. No reminder scheduling exists for interviews in `scheduler/`, `reminderJobs.js`, or `jobQueueService.js`. Retry/dead-letter behavior is the queue's generic path, unchanged by anything here.

## 17. Authorization and privacy

**No P0 issues found.**

- Employer ownership: enforced on schedule and complete via `getOwnedLegacyApplication` before any write; a different Employer gets 404.
- Candidate ownership: `getOwnedApplication(userId, id)` on the User route; a candidate cannot read or write another candidate's appointment.
- Meeting details: reachable only by the owning Employer and the owning candidate.
- Timeline/audit actors: `byActorType: 'employer'` with `byActorId` recorded on interview-triggered stage history.
- Admin: no interview access path found — correctly absent rather than accidental.

**One real design gap, not currently exploited:** `interview.notes` is a **single shared field**. The Employer API accepts `notes` and writes it to the same subdocument the candidate reads and edits. There is no separation between employer-private interview notes and candidate-visible instructions. Today the Employer UI never sends `notes`, so nothing is live-exposed — but any Employer using the API directly would have their notes rendered to the candidate. This should be treated as a boundary to fix before the field is exposed in the UI, not as an active leak.

## 18. Idempotency and concurrency

- Repeat save of an identical appointment: **no guard** — overwrites, re-emits `InterviewScheduled`, may re-push stage history. This is the same defect class PF-EMP-UX-B4A just fixed for stage transitions.
- Double-click: the button is `disabled={saving}`, giving in-flight protection only — exactly the pattern that still permitted ~23 sequential repeats in the B4A incident.
- Concurrent Employer sessions / stale overwrite: last write wins, with no version check and no history — a stale tab can silently replace a newer appointment.
- Cancel-after-complete: not applicable (no cancel).
- Reschedule race: unguarded.

**An interview equivalent of the same-stage no-op guard is required.**

## 19. Read-only live correlation

See §3. Every field of the live `interview` object is at its schema default, confirming no appointment was ever created, while one `InterviewScheduled` notification and one queued `interviewInvitation` email exist — both attributable solely to stage transitions. Zero interview timeline events exist. No data was modified during this audit.

## 20. Test inventory

| Behavior | Coverage | Smallest test needed if absent |
|---|---|---|
| Scheduling persistence | none | service test asserting the persisted subdocument shape |
| Ownership on schedule/complete | none directly | test that a non-owning employerId throws 404 before any write |
| Date validation | none | test rejecting a past `scheduledAt` |
| Timezone conversion | none | round-trip test: local input → stored instant → rendered value |
| User visibility | none | test that the candidate projection exposes date/mode/location/link |
| Notifications | indirect only (`careerNotificationLinkFallback`) | test that a stage move to `interview` does **not** emit `InterviewScheduled` once corrected |
| Rescheduling | none | test that a second schedule preserves `meetingUrl` and does not duplicate history |
| Cancellation | none | n/a until implemented |
| Completion | none | test asserting `outcome` persists and prior fields are preserved |
| Reminders | none | n/a until implemented |
| Duplicate prevention | none | interview equivalent of `employerSameStageNoOpGuard.test.js` |
| Stage independence | none | test that scheduling does/does not move the stage, per the chosen contract |
| Private-note isolation | none | test that employer-private notes are absent from the candidate projection |

No test was added or modified in this audit.

## 21. Findings by priority

- **P0:** none. No cross-tenant access, no wrong-recipient meeting details, no private-note exposure, no cross-tenant link leakage.
- **P1:**
  1. Moving a candidate to the `interview` stage emits `InterviewScheduled` and queues an interview-invitation email, telling the candidate an interview is scheduled when none exists. Confirmed live (1 notification, 1 queued email, `scheduledAt: null`).
  2. `resolveInterviewStatus` reports `status: 'scheduled'` whenever legacy status is `interview`, even with no appointment — the Employer's own UI corroborates the false claim.
  3. The User can overwrite an Employer-scheduled interview via `PUT /applications/:id/interview` (same subdocument), breaking the one-directional isolation every prior phase established.
  4. Completion cannot be performed: `completeInterview` has zero UI callers.
  5. Reschedule/cancel are disconnected — re-scheduling silently wipes `meetingUrl` and resets `outcome`, and cancellation does not exist.
- **P2:**
  - `mode` hard-coded to `'video'`; no location, meeting-link, or instructions field in the Employer UI.
  - No timezone disclosure or stored zone identity.
  - No past-date or terminal-stage guard on scheduling.
  - No interview idempotency guard (duplicate notifications on repeat save).
  - Shared `interview.notes` field with no employer-private / candidate-visible separation.
  - No outcome UI; free-text `outcome` with no enum.
- **P3:**
  - Legacy `application.interview` notification links to `/dashboard` rather than the application.
  - No reminder preferences or interview templates.
  - Test gaps in §20.

## 22. Recommended implementation phases

**PF-EMP-INT-B1 — Separate the interview stage from the interview appointment**
- Defect: P1 items 1 and 2 — stage moves emit `InterviewScheduled` and the status projection reports `scheduled` with no appointment.
- Allowed files: `EmployerIntelligenceService.js` (`eventForPipelineStage`), `EmployerCandidateCardService.js` (`resolveInterviewStatus`), one focused test.
- Acceptance: moving to the `interview` stage produces no interview notification and no queued invitation email; status reads `none` until a real `scheduledAt` exists.
- Dependency: none. Live mutation: not required to implement; one stage move needed for live acceptance.

**PF-EMP-INT-B2 — Interview write integrity and idempotency**
- Defect: P1 item 5 and the P2 guards — `$set` full replacement wiping `meetingUrl`/`outcome`, no same-time no-op guard, no past-date or terminal-stage validation.
- Allowed files: `EmployerIntelligenceService.scheduleInterview`, `OpportunityApplicationRepository.setInterview`, one focused test.
- Acceptance: rescheduling preserves unrelated fields; an identical re-save is a no-op with no duplicate notification (mirroring PF-EMP-UX-B4A); past dates rejected.
- Dependency: none. Live mutation: not required.

**PF-EMP-INT-B3 — Employer scheduling UI completion**
- Defect: P1 item 4 and P2 UI gaps — hard-coded video, no location/link/instructions, no reschedule/cancel/complete controls.
- Allowed files: `EmployerCandidateDetail.jsx`, `employerService.js` (wire the existing complete endpoint), employer i18n, one focused test.
- Acceptance: an Employer can choose a method, supply a link or location, reschedule, and record an outcome through the UI.
- Dependency: B2 (so richer fields are not wiped). Live mutation: required only for acceptance.

**PF-EMP-INT-B4 — Interview record ownership boundary**
- Defect: P1 item 3 — the candidate can overwrite an Employer-scheduled appointment, and `notes` is a shared field.
- Allowed files: `OpportunityApplicationService.upsertInterview`, `EmployerCandidateCardService.js`, User `InterviewPanel.jsx`, one focused test.
- Acceptance: an Employer-scheduled appointment is read-only to the candidate; employer-private notes never appear in the candidate projection. **Requires a product decision** on whether candidates keep a self-managed appointment for externally-tracked applications — likely yes, which argues for distinguishing employer-authored from self-authored interviews rather than removing the User panel.
- Dependency: product sign-off. Live mutation: not required.

Not recommended yet: a reminder/notification-preferences phase. No reminder infrastructure exists for interviews, the worker is intentionally stopped, and the queued-email path is already deduplicated per application — this should follow B1–B4 rather than compete with them.

## 23. Manual acceptance prerequisites

Live acceptance for B1 needs one stage move to `interview` on a candidate with no appointment, verifying zero interview notifications and zero queued invitation emails. B2 needs one schedule, then a reschedule, verifying `meetingUrl` survives and an identical re-save writes nothing. B3 needs one full schedule → reschedule → complete cycle. Note the worker must be started to verify email behavior — deliberately out of scope for all four phases above, which are verifiable without it.

## 24. Final recommendation

Begin with **PF-EMP-INT-B1**. It is the smallest change, requires no product decision, and removes the only finding that is actively misinforming candidates today — a notification and a queued email asserting an interview that does not exist. Follow with **B2** (write integrity, which B3 depends on), then **B3** (the Employer UI), and take **B4** to product for a decision on candidate-side appointment ownership before implementing it.
