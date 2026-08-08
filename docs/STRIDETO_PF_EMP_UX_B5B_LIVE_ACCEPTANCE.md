# PF-EMP-UX-B5B — Employer Pipeline Transition Notification Correlation, Live Acceptance

## 1. Verdict

**PF-EMP-UX-B5B LIVE ACCEPTANCE PASS**

Employer pipeline transitions now correlate every candidate-facing side effect to the
individual legacy Application — its real `_id` and its real job title — instead of passing
the raw Mongoose document to `onApplicationStatusChange`, which had collapsed every dedup
identity to the global constants `application:status:undefined:<status>` and
`email:offer:undefined`. This verdict rests on **controlled live post-deployment
transitions driven through the running Strideto API**, in which two distinct applications
moved to the same stage each produced their own application-scoped notification (proving
the global-suppression defect is gone), and a hire produced exactly one milestone
notification plus one application-scoped offer-letter email with no duplicate and no
`undefined`. The live evidence is corroborated by fixture-provisioning evidence, by the
historical forensic signature of the original defect, and by the shipped-source contract
test.

Repository authority: HEAD `426f67f4e9168fdc841ea114e906be2c5c5f10f8`
(`fix(employer): scope pipeline transition notifications`), branch `main`. No source or
test was modified during acceptance. Worker `edurozgaar-staging-worker-1` remained
**Exited (0)** throughout, so every queued email stayed undelivered.

---

## 2. Controlled live post-deployment evidence (primary)

All three transitions were issued as authenticated HTTP requests against the running
staging stack (`api-a`, `127.0.0.1:5001`), so the server-bootstrap notification
subscribers (`registerCareerNotificationHandlers()`, `index.js`) participated — not a
standalone script.

- **Authentication:** normal Employer login boundary — `POST /api/auth/employer/login`
  with the synthetic fixture employer's credentials and a trusted `Origin`
  (`https://localhost:8443`); the returned access token was used as `Authorization:
  Bearer` on each transition. No JWT was forged; `requireAuth` / `requireEmployerAuth`
  were not bypassed. Credentials and tokens are not reproduced here.
- **Endpoint:** `POST /api/employer/intelligence/candidates/<LEGACY_APPLICATION_ID>/stage`,
  body `{ "toStage": <stage> }`. Each action was sent **exactly once, no retry**.
- **Correlation contract:** B5B dedup identity keys on the **legacy Application `_id`**,
  never the OpportunityApplication `_id`.

### Action 1 — Record A → `interview`

| Check | Expected | Observed | Result |
|---|---|---|---|
| HTTP | 200, once | `200`, `changed:true`, `pipelineStage:interview` | **PASS** |
| Canonical transition | `applied → interview` | `applied → interview` | **PASS** |
| Legacy reconciliation | `submitted → interview` | `interview` | **PASS** |
| stageHistory | +1 exactly | `1 → 2`, latest `applied→interview` (`employer`, `forced:true`) | **PASS** |
| OA `updatedAt` | changes once | `19:08:08.859Z → 19:21:34.507Z` | **PASS** |
| Status side effect | exactly one | one `notification` job | **PASS** |
| Dedup key | real legacy id, no `undefined` | `application:status:6a777e98…cded:interview` | **PASS** |
| Candidate title | real job title | `Moved to interview stage: [B5B ACCEPTANCE] Pipeline Notification Fixture` | **PASS** |
| InterviewScheduled event | none | 0; `interview.scheduledAt = null` | **PASS** |
| Interview-invitation job | none | 0 | **PASS** |
| Offer-letter job | none | 0 | **PASS** |
| Record B / Offer | unchanged | unchanged | **PASS** |

### Action 2 — Record B → `interview` (distinct correlation)

| Check | Expected | Observed | Result |
|---|---|---|---|
| HTTP | 200, once | `200`, `changed:true`, `pipelineStage:interview` | **PASS** |
| Canonical transition | `applied → interview` | `applied → interview` | **PASS** |
| stageHistory | +1 exactly | `1 → 2`, latest `applied→interview` | **PASS** |
| Status side effect | exactly one | one `notification` job | **PASS** |
| Dedup key | real Record B legacy id | `application:status:6a777e99…ce01:interview` | **PASS** |
| **Distinct from A** | different key | A `…cded:interview` ≠ B `…ce01:interview` | **PASS** |
| **No global suppression** | both enqueued | both keys present (A=1, B=1) — not collapsed | **PASS** |
| `undefined` in either key | none | none | **PASS** |
| Candidate title | real job title | fixture job title | **PASS** |
| Appointment side effects | none | 0 invitation, `scheduledAt = null` | **PASS** |
| Record A (post-Action-1) | unchanged | `interview`, hist 2, `updatedAt` unchanged | **PASS** |

This is the decisive B5B proof: before the fix both applications would have written the
single global key `application:status:undefined:interview`, and global queue dedup would
have suppressed the second candidate's notification entirely. Live, each received its own
application-scoped notification.

### Action 3 — Offer Record → `accepted`

| Check | Expected | Observed | Result |
|---|---|---|---|
| HTTP | 200, once | `200`, `changed:true`, `pipelineStage:accepted` | **PASS** |
| Canonical transition | `offer → accepted` | `offer → accepted` | **PASS** |
| Legacy reconciliation | `interview → hired` | `hired` | **PASS** |
| stageHistory | +1 exactly | `2 → 3`, latest `offer→accepted` | **PASS** |
| Milestone notification | +1 exactly | one direct usernotification `career.OfferAccepted` ("Offer accepted") | **PASS** |
| Duplicate legacy in-app | none | `application:status:<offer>:*` = 0 (suppressed by `notify:false`) | **PASS** |
| Offer-letter email job | +1 exactly | one `email` job, `templateKey:offerLetter` | **PASS** |
| Offer dedup key | `email:offer:<offer legacy id>` | `email:offer:6a777e99…ce15` | **PASS** |
| `email:offer:undefined` created | none | none (the single such key is the untouched Aug-04 artifact) | **PASS** |
| Email vars | real candidate + real job title | `name: "B5B ACCEPTANCE Candidate Offer"`, `jobTitle: "[B5B ACCEPTANCE] Pipeline Notification Fixture"` | **PASS** |
| Interview appointment side effects | none | 0; `scheduledAt = null` | **PASS** |
| Record A / B | unchanged | unchanged | **PASS** |
| Delivery | not delivered (worker stopped) | offer-letter job `pending`; Mailpit holds only an unrelated pre-existing message | **PASS** |

### Global post-action invariants

| Check | Result |
|---|---|
| New `application:status:undefined:*` | **0** (count steady at 5 — the historical Aug-04 rows) |
| New `email:offer:undefined` | **0** (count steady at 1 — the historical Aug-04 row) |
| Historical undefined artifacts (5 status + 1 offer) | **untouched** |
| Source changes | none |
| Extra fixture records | none |
| Retries / duplicate requests | none (each action one POST) |
| Worker | **Exited (0)** throughout |

---

## 3. Fixture provisioning evidence (supporting)

The staging dataset lacked enough safe, non-protected employer-linked applications, so a
single bounded fixture set was provisioned under authorization, through existing
service/model/repository boundaries (no raw collection inserts): a temporary, non-repo
runner invoked `Application.create` → `ApplicationMigrationService.migrateJobApplication`
(creating each linked OpportunityApplication with a real title) →
`EmployerIntelligenceService.transitionPipeline` (to place the Offer fixture at canonical
`offer`). The runner was deleted from the container and scratchpad after execution; a
pre-clean removed one orphaned employer from an earlier failed attempt.

**Provisioned (all identities prefixed `B5B ACCEPTANCE`, all e-mails `@fixture.test`):**

- 1 synthetic employer (owner), suffix `…11cd96`
- 1 synthetic job `[B5B ACCEPTANCE] Pipeline Notification Fixture`, suffix `…11cdde`, `employerId` = the fixture employer (ownership confirmed), `applyType:internal`
- 3 synthetic candidate/legacy-Application/OpportunityApplication fixtures:

| Record | Candidate | Legacy App | OA | Baseline stage | Baseline legacy status |
|---|---|---|---|---|---|
| A | Alpha (`b5b.ca…@fixture.test`) | `6a777e98…cded` | `…cdfa` | `applied` | `submitted` |
| B | Bravo (`b5b.ca…@fixture.test`) | `6a777e99…ce01` | `…ce0e` | `applied` | `submitted` |
| Offer | Offer (`b5b.ca…@fixture.test`) | `6a777e99…ce15` | `…ce22` | `offer` | `interview` |

None reference the protected Usama121 / Andoride Developer records. Setup side effects
were limited to analytics events (`application_created` ×3, `profile_created` ×3,
`employer_offer_sent` ×1); no candidate notifications or background jobs were created for
the fixtures before the controlled actions (pristine baseline).

---

## 4. Historical forensic evidence (corroborating)

The running database still holds the untouched signature of the original defect in
`backgroundjobs`, all created **2026-08-04** (pre-fix era):

- `application:status:undefined:{applied,interview,hired,viewed,shortlisted}` — five rows, one per status value, the "one global key per status, everyone else suppressed" shape.
- `email:offer:undefined` — one row.

These six rows were left intentionally untouched; the fix corrects forward behavior only.
The live Section 2 keys (`…cded:interview`, `…ce01:interview`, `email:offer:…ce15`) cannot
collide with them, so they remain harmless residue and are not active suppressors.

---

## 5. Source / test evidence (contract)

- `node src/__tests__/employerPipelineTransitionNotification.test.js` → **41 assertions passed** — the harness re-binds the real `transitionPipeline` and real `onApplicationStatusChange` bodies against fakes, pinning the correlation, the `notify` separation, the application-scoped dedup keys, and the no-double-notify-on-hire behavior.
- Regression suite green: `employerCandidateViewEventCorrection` (36), `employerSameStageNoOpGuard` (32), `employerInterviewStageTruthfulness` (85), `employerApplicationsHiringStageClarity` (32), `employerPipelineStageCompleteness` (22).
- Source parity: both running API containers carry the shipped B5B source (`PF-EMP-UX-B5B` markers in `EmployerIntelligenceService.js` and `automationService.js`; application-scoped dedup keys; the legacy `onApplicationStatusChange(application)` raw-document call absent).

---

## 6. Scope discipline

Verification and one authorized, bounded fixture set only. Source and tests unchanged.
The three controlled transitions were authenticated HTTP requests through the normal
Employer boundary, each sent exactly once, scoped to the synthetic B5B fixtures. Protected
records (Usama121, Andoride Developer, all non-fixture accounts) and the historical
undefined artifacts were untouched. The worker stayed **Exited (0)**; no email was
delivered. Nothing was pushed or deployed.

## 7. Final recommendation

PF-EMP-UX-B5B is fully live-accepted. Employer pipeline transitions correlate every
candidate notification and offer email to the real Application, are per-candidate distinct
(no global dedup suppression), render the real job title, and do not double-notify on hire.
The legacy Applications PATCH path is behaviorally unchanged (`notify` defaults to true).
No rollback is required.

**Optional, non-blocking follow-up:** the six stale `…:undefined…` background jobs from
2026-08-04 remain `pending`; a one-time housekeeping pass could clear them. Operational
tidy-up, not a code defect.
