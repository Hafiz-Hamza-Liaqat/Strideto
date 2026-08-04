# STRIDETO Internal Hiring Setup Connection Audit (PF-TRACK-A2)

## 1. Verdict

**READY FOR TARGETED INTERNAL-HIRING SETUP IMPLEMENTATION**

The product's internal-apply backend (`applyToJob`, dual-write, Employer-facing `Application`, Hiring Intelligence, Dashboard — all audited and confirmed correct in prior phases) has never been exercised by a single Job in this environment, and the reason is now fully root-caused, not merely observed: the Employer Job form has **no explicit control for choosing "Apply through Strideto."** It offers two optional destination fields (an Apply Link and an Apply Email); leaving both blank is the only way to get an internal Job, and nothing in the UI presents that as an intentional choice — it is a side effect of omission, not a selection. Worse, once a Job is external, an Employer who *does* try to fix it — by clearing the Apply Link/Email fields on the edit form and saving — cannot: a confirmed, source-level defect causes the cleared values to never reach the server at all, so the stored destination and `applyType` silently remain unchanged. A separate, real security gap was also found: neither the Employer nor the Admin write path validates the Apply Link's URL scheme server-side, so a stored `javascript:` URI is possible and would render as a live, clickable `<a href>` on the public Job page. None of this requires a database migration or a semantics redesign — all three are bounded, evidence-backed, client+server fixes.

## 2. Repository authority

- HEAD: `0e72bf737361532c566b623a6b418629bdc3a412`
- Parent: `dc7bffc6c00b9bb43d51a79d0cb69e35a3810730`
- Branch: `main...origin/main [ahead 66]`
- Tracked tree: clean; staged: none
- Preserved untracked (present, unmodified): `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`, `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- `.env.staging`: ignored, untouched
- Worker: confirmed stopped
- Preflight matched every required value exactly; no stop condition triggered.

## 3. Observations reviewed

The Employer UI screenshots ("Apply method: External applications", "Applications: Not tracked", the outside-Strideto disclosure) were checked against source and are confirmed accurate and intentional display logic (§7 of the prior role-tracking audit, re-confirmed here). This audit's job was to determine *why* every Job is external, not whether the disclosure itself is correct — the disclosure is correct.

## 4. Admin role boundary

Re-confirmed unchanged from the committed role-tracking audit: `moderationController.js` (the dedicated Employer-Job-approval surface) touches only `approvalStatus`/`status`, never `applyType`/`applicationLink`/`applyEmail`, and has zero `Application`/`OpportunityApplication` references. Admin approval does not alter application method. Admin does not add Jobs to a User tracker and does not create Employer candidates merely by approving a Job. An Admin "Track Job" action would be **incorrect** and is not recommended anywhere in this report.

A second, separate Admin surface exists — `adminJobsController.js` / `client/src/pages/Admin/AdminContentJobs.jsx` (a general content-management panel for the public Jobs collection, used for both scraper-imported and Employer-submitted listings since its queries are not filtered by `source` or `employerId`). This panel **can** inspect and edit `applicationLink` (rendered as a plain text field, `AdminContentJobs.jsx:342`) but has no dedicated `applyType` control either, and its own write path has the same one-directional defect class as the Employer path (§10). This is a distinct, narrower finding from the moderation boundary and does not change the Admin-moderation-role conclusion above.

## 5. Canonical application-method contract

Single canonical resolver: `resolveJobApplyType(job)` (`server/src/services/employerApplicationCounts.js:9-13`), used consistently by the Dashboard, Hiring Intelligence, per-Job counts, and the "not tracked" disclosure (all re-confirmed unchanged since PF-TRACK-B2).

```js
if (job.applyType === 'internal' || job.applyType === 'external') return job.applyType;
if (job.applicationLink || job.applyEmail) return 'external';
return 'internal';
```

1. Canonical enum values: `'internal' | 'external'` — a two-value enum, identical on `Job.applyType` (`server/src/models/Job.js:68`, `enum: ['external','internal']`, **default `'external'`**) and in the client's `resolveApplyMode` (`employerPostJobValidation.js:49-68`).
2. Internal Jobs are identified solely by `applyType === 'internal'` (explicit) or by both `applicationLink`/`applyEmail` being falsy when `applyType` is unset.
3. URL-based external applications: `applicationLink` truthy.
4. Email applications: `applyEmail` truthy (independently of `applicationLink` — both can be set at once; `resolveJobApplyType` does not distinguish which one, only "external vs. not").
5. Default when nothing is supplied: the resolver defaults to `'internal'`; the **stored schema default** is `'external'` (§5.9) — these two defaults are not the same value, but in practice every real write path (Employer create, Admin create) always sets `applyType` explicitly, so the schema-level default is never actually reached in this codebase (verified by grep: `Job.create`/`new Job(...)` call sites in `employerController.js` and `adminJobsController.js` always pass `applyType`).
6. Legacy records: yes — the fallback branch (`applicationLink || applyEmail` presence) exists specifically to classify any Job that predates an explicit `applyType` field.
7. Create and update use the **same normalization formula** on the Employer side (`employerController.js:96` and `:153`, byte-identical ternary), but **not the same trigger conditions** — this asymmetry is the root of the edit-flow defect (§8).
8. Client and server enum values match exactly (`'internal'`/`'external'`, confirmed both sides).
9. `applicationLink`/`applyEmail` can force a Job to `'external'` **only when `applyType` itself is not already explicitly set** — an explicit `applyType: 'internal'` overrides link/email presence in the resolver.
10. Internal Jobs do **not** reject external destination fields at the model or resolver level — nothing prevents an `applyType: 'internal'` Job from also carrying a non-null `applicationLink`/`applyEmail` in storage; today this never happens only because every real write path computes `applyType` from those same two fields (an implicit invariant, not an enforced constraint — the same defense-in-depth class of gap already corrected on the Application-aggregation side in PF-TRACK-B2, here left as an observation since no live data currently violates it).

## 6. Resolver truth table

| applyType (stored) | applicationLink | applyEmail | Resolver result | Notes |
|---|---|---|---|---|
| `'internal'` | any | any | `internal` | Explicit value wins over link/email presence (§5.9) |
| `'external'` | `null`/`''` | `null`/`''` | `external` | **Possible dead-end state**: external with no destination at all — reachable via Admin's `create` (§10), which hardcodes `applyType:'external'` before any link is set |
| `'external'` | set | any | `external` | Normal external-with-URL case |
| `'external'` | `null` | set | `external` | Normal external-with-email case |
| unset | set | any | `external` | Legacy-fallback inference |
| unset | `null` | set | `external` | Legacy-fallback inference |
| unset | `null`/`''` | `null`/`''` | `internal` | Default-by-omission — the **only** path that currently produces an internal Job anywhere in this codebase |

## 7. Employer create-job flow

Traced `EmployerPostJob.jsx` (non-edit mode) → `validateEmployerPostJobForm`/`buildCreateJobPayload` (`employerPostJobValidation.js`) → `employerApi.createJob` → `employerController.createJob` → `Job.create`.

1. Is an application-method **selector** rendered? **No.** The only application-method UI is a `<fieldset>` (`EmployerPostJob.jsx:512-579`) titled "How candidates apply" containing exactly two optional text inputs — Apply Link (`type="url"`) and Apply Email (`type="email"`) — plus a read-only, `aria-live="polite"` status line that narrates whichever mode is currently *inferred* from what has been typed (`t('employer:applyModeInternalStatus')` / `applyModeExternalStatus'`, driven by `resolveApplyMode(form)`, `EmployerPostJob.jsx:110, 526-529`). There is no radio group, dropdown, or toggle anywhere that lets an Employer affirmatively pick "Apply through Strideto."
2. All three options (Strideto / URL / Email) available? Only two are represented as real fields (URL, Email); "Strideto" is not a selectable option — it is what happens when both fields are left empty.
3. Is internal Strideto hiring available? **Yes, functionally** — leaving both fields blank produces `applyType: 'internal'` end to end (verified in §5's truth table and §9's create-controller trace) — but it is not presented as an available choice anywhere in the UI copy or layout.
4. Hidden conditionally? No — the fieldset with both fields is always rendered, unconditionally.
5. Present but mislabeled? The status line and help text (`applyModeInternalHelp`: *"Leave URL and email empty to use Strideto's in-app applications. Candidates will appear in your Applications page."*) are accurate, not mislabeled — but they are a small, easy-to-miss paragraph, not a decision point an Employer is asked to engage with before or while filling in what looks like a standard "where do candidates apply" field pair.
6. Is `applyType` included in form state? **No** — `defaultForm` (`EmployerPostJob.jsx:18-30`) has no `applyType` key at all; only `applyLink`/`applyEmail`.
7. Is `applyType` included in the request payload? **No** — `buildCreateJobPayload` (`employerPostJobValidation.js:177-193`) never sets an `applyType` key; the payload contains only `applyLink`/`applyEmail` (each `|| undefined` when blank).
8. Is the backend field silently defaulted? **Yes, by design** — `employerController.js:96`: `applyType: body.applyLink || body.applyEmail ? 'external' : 'internal'`, computed unconditionally on every create, identical formula to the client's own inference.
9. Default when nothing typed: `'internal'` (confirmed both client-displayed status and server-stored value agree).
10. Are external link/email fields always populated? No — both are genuinely optional; nothing forces a value into either.
11. Does a pre-filled Employer email auto-populate `applyEmail`/force external? **No** — the only auto-prefill in this component is `companyName` from `employer.companyName` (`EmployerPostJob.jsx:102-108`); `applyEmail` is never auto-populated from the Employer's account email.
12. Is internal selection lost during serialization? Not applicable — there is no internal *selection* to lose; the empty-string state survives serialization correctly (`applyLink: applyLink || undefined` on two blank strings simply omits both keys, which the server correctly reads as "nothing supplied" on **create**, unlike update, §8).
13. Does validation reject internal Jobs? No — `validateEmployerPostJobForm` has no rule requiring either field; an all-blank submission passes validation and creates a valid internal Job.
14. Is helper text clear about tracking consequences? Partially — `applyModeInternalHelp`/`applyModeExternalHelp` do state the tracking consequence in one sentence each, but only for whichever mode is *currently already implied*, not as an upfront, always-visible comparison of both paths' consequences (§17).

**Classification: B — BACKEND SUPPORTED, EMPLOYER UI MISSING.** The full data path from an all-blank submission to a stored `applyType:'internal'` Job is genuinely connected and correct (verified, not assumed) — but there is no UI control that represents "internal hiring" as a thing an Employer can choose, which is precisely the product question this audit was asked to answer. This is the direct, confirmed explanation for why every Employer-created Job to date is external: filling in *some* destination is the obvious, expected action on a job-posting form, and nothing on the form ever surfaces "leave this blank on purpose" as a real option.

## 8. Employer edit-job flow

Traced `EmployerPostJob.jsx` (edit mode) → `jobToForm` (hydration) → `buildUpdateJobPayload` (= `buildCreateJobPayload`, `employerPostJobValidation.js:173-175`) → `employerApi.updateJob` (`axios.patch`, JSON body) → `employerController.updateJob` (`employerController.js:126-160`).

1. **Can an existing external Job be changed to internal? Confirmed: No — this is a real, source-level defect, not a hypothesis.** The chain:
   - `buildCreateJobPayload` sets `applyLink: applyLink || undefined` / `applyEmail: applyEmail || undefined` when the Employer clears both fields on the edit form.
   - `employerAxios` is a plain `axios.create({ headers: { 'Content-Type': 'application/json' } })` (`employerService.js:35-40`) with no custom `transformRequest` — its default body serializer is `JSON.stringify`, which **omits any key whose value is `undefined`** from the request body entirely. A cleared field therefore never appears in the PATCH request at all — not as `null`, not as `''`, simply absent.
   - Server `updateJob`'s field-copy loop only writes a field `if (body[key] !== undefined)` (`employerController.js:139-140`) — since the key is genuinely absent from the parsed JSON, `job.applicationLink`/`job.applyEmail` are left **completely untouched**, still holding their old external destination.
   - The `applyType` recomputation itself is gated identically: `if (body.applyLink !== undefined || body.applyEmail !== undefined) { job.applyType = ... }` (`employerController.js:152-153`). Since both keys are absent, this block never runs, and `job.applyType` **remains `'external'` forever**, silently, with the request still returning `200 OK` and no error of any kind.
   - **User impact:** an Employer who opens Edit, clears both the Apply Link and Apply Email fields (exactly the documented way to "use Strideto's in-app applications" per the create-form's own help text), and clicks Save, sees a success response and a Job that still shows "Apply method: External" — with no indication anything went wrong.
2. Can an internal Job be changed to external? **Yes, this direction works correctly** — typing a URL and/or email into a previously-blank field means `body.applyLink`/`body.applyEmail` *is* defined and non-empty, so both the field write and the `applyType` recompute fire correctly, storing `'external'` as intended.
3. Are link/email fields cleared when switching to internal? **No** (§8.1) — this is the defect itself.
4. Are existing values restored correctly on load? Yes — `jobToForm` (`employerPostJobValidation.js:156-171`) correctly hydrates `applyLink`/`applyEmail` from `job.applicationLink`/`job.applyEmail`, and the status line correctly reflects the Job's *current* stored state on open.
5. Does update validation accept `applyType`? Not applicable — no `applyType` field is ever sent from the client to accept or reject (§7.6-7.7 apply identically here).
6. Does the controller persist a genuine change when one is actually sent? Yes, for the external-directions covered in §8.2 — the defect is specifically and only in the clear-to-internal direction.
7. Does the resolver reflect the new (correctly-changed) value? Yes, whenever the underlying stored fields are actually updated.
8. Is there a warning about existing applications when changing methods? **No** — no confirmation dialog or warning of any kind exists for a method change in either direction, even though switching away from external could orphan candidates who already applied off-platform, or switching into internal after external Applications... (not applicable today since external Jobs never accumulate `Application` records, per PF-TRACK-A/B2).
9. Can the method change after Applications exist? Not exercised (no internal Job with real `Application` records exists in this environment to test against) — by source, nothing in `updateJob` blocks a method change based on existing `Application` count either way.
10. Does editing preserve approval status, or require re-review? **Re-review is required and correctly enforced independently of application method**: `employerController.js:155-157` — any edit to an already-`active`+`approved` Job resets `approvalStatus` to `'pending'`, unconditionally. This is unrelated to the applyType defect and functions correctly.

**Classification: C — EMPLOYER UI PRESENT, PAYLOAD DISCONNECTED**, specifically and only for the external→internal (clear-the-fields) direction. This is the second confirmed, concrete root cause behind the observed state: even an Employer who correctly reads the help text and tries to self-correct cannot succeed through the UI today.

## 9. Job duplication flow

Traced `adminJobsController.duplicate` → `buildJobDuplicateProjection` (`server/src/services/jobWriteBoundary.js`).

`applyType`, `applicationLink`, and `applyEmail` are all three listed in `JOB_DUPLICATE_PRESERVE_FIELDS` (`jobWriteBoundary.js:106-108, 116`) — copied verbatim from the source Job, with `status`/`approvalStatus`/`slug` explicitly reset and recomputed by the controller afterward (`adminJobsController.js:191-193`), matching the documented, intentional duplication contract. **No defect found.** A duplicate of an external Job stays external; a duplicate of a (currently nonexistent, but hypothetically) internal Job would stay internal.

**Classification: A — FULLY CONNECTED.**

## 10. Admin create/edit/moderation flow

Confirmed §4's moderation-only boundary is clean. Separately, `adminJobsController.js`'s general content-management path (`create`/`update`, shared `applyJobBody` helper) has its own, narrower defects:

1. Can Admin inspect application method? Yes — `getOne`/`list` return the full `Job` document including `applyType`/`applicationLink`/`applyEmail`; `AdminContentJobs.jsx` renders `applicationLink` as an editable text field (no dedicated `applyType`/`applyEmail` field was found in the admin client form itself, `AdminContentJobs.jsx:39, 342` — only `applicationLink`).
2. Can Admin correct a malformed method? **Partially, and asymmetrically.** `applyJobBody` (`adminJobsController.js:85-89`): `if (body.applicationLink !== undefined ...) { doc.applicationLink = applicationLink ? sanitized : ''; if (applicationLink) doc.applyType = 'external'; }` — setting a link correctly forces `'external'`, but **clearing it (`applicationLink: ''`) never sets `applyType` back to `'internal'`** — the identical one-directional defect class found on the Employer side (§8.1), independently present in this second code path.
3. Does Admin `create` default to external? **Yes, hardcoded and unconditional**: `adminJobsController.js:140`, `applyType: 'external'`, set **before** `applyJobBody` even runs, with no code path in `create` that ever produces `applyType: 'internal'`. Admin cannot create an internal Job through this panel at all, regardless of what is or isn't typed into the link field.
4. Does Admin duplication preserve it? Yes (§9, unaffected by this section's findings — `duplicate` uses the separate, correct `jobWriteBoundary.js` projection, not `applyJobBody`).
5. Does Admin approval accidentally overwrite it? No — confirmed in §4, `moderationController.js` never touches these fields.
6. Do Admin bulk actions alter it? No matching field write found in `bulkAction` (checked for `applyType`/`applicationLink`/`applyEmail` assignments; none present).

**Classification: F — VALIDATION/ENUM MISMATCH** for `applyJobBody`'s asymmetric clear-handling (mirrors §8's Employer-side defect); **E — DEFAULT FORCES EXTERNAL** for `adminJobsController.create`'s hardcoded value. Given this panel is not employer-source-scoped (§4), it is capable of touching an Employer-submitted Job's application method with the same silent-clear failure mode as §8 — this was not observed live (no evidence this panel is actually used to edit Employer jobs in practice), so it is reported as a confirmed source-level capability, not a confirmed live incident.

## 11. Internal Job public experience

Traced `JobDetail.jsx` (`isExternal = job.applyType === 'external'`, line 170) against the already-audited `applyToJob` controller (PF-TRACK-A).

- Internal application form: rendered whenever `!isExternal` (`JobDetail.jsx:310, 343`) — a real in-page apply flow, gated correctly on the same field the server uses.
- User authentication requirement: `!isExternal && isAuthenticated` shows the apply action; `!isAuthenticated && !isExternal` shows a sign-in prompt instead — consistent, no bypass found.
- Application record creation: `applyToJob` creates `Application` (durable, unguarded — PF-TRACK-A §6).
- `OpportunityApplication` dual-write: awaited, not fire-and-forget (PF-TRACK-A §6, unchanged, not re-verified line-by-line here per this audit's narrower scope).
- Employer visibility: immediate, synchronous (PF-TRACK-A §6).
- Duplicate prevention: unique `{userId, jobId}` index (`Application.js:27`, unchanged).
- Tracking notification: `onJobApplication(...).catch(() => {})`, fire-and-forget (PF-TRACK-A §6).

**A Job configured as internal can complete the full internal apply flow correctly** — this was already established by source in PF-TRACK-A and is reconfirmed here by the client-side gating condition matching the server-side gating condition exactly (`applyType !== 'internal'` on both sides, phrased as the same boolean from opposite directions). The reason this path has never been exercised live is entirely explained by §7-§10: no Job has ever reached `applyType: 'internal'` in this environment (§16).

## 12. External Job public experience

- Destination CTA: URL button when `applicationLink` present (`JobDetail.jsx:275-279`), falling back to a `mailto:` link when only `applyEmail` is present (`:280-286`) — **but if a Job is `applyType:'external'` with *neither* field populated (the dead-end state identified in §6's truth table, reachable via Admin's `create`), neither CTA renders**, leaving a User on an "external application" Job page with no actual destination. Not observed live (no such Job exists in this database, §16), but confirmed reachable by source.
- Optional private Track action: out of this audit's scope (already fully covered by PF-TRACK-A); unaffected by any finding here.
- No Employer-facing Application: confirmed unchanged (external Jobs cannot reach `applyToJob`, PF-TRACK-A §6).
- "Not tracked" disclosure: confirmed unchanged, correct (PF-TRACK-A §16 and §20).
- Analytics behavior: out of this audit's narrow scope; not re-traced.

## 13. Internal application lifecycle

Unchanged from PF-TRACK-A (§4-§6 of that report) — not re-audited here beyond the gating-condition cross-check in §11 above, per this audit's instruction not to reopen the complete role audit.

## 14. Employer pipeline consequences

| Job method | Employer `Application` record | User tracker (`OpportunityApplication`) | Employer Dashboard | Hiring Intelligence | Per-Job count |
|---|---|---|---|---|---|
| Internal apply | Created (dual-write, awaited) | Created (linked via `legacyApplicationId`) | Counted (internal-scoped, PF-TRACK-B2) | Counted (internal-scoped, PF-TRACK-B2) | Live count, `applicationsTracked: true` |
| External URL | Never created (`applyToJob` hard-blocks) | Only via manual Track (`source:'external'`, no link) | Not counted (by design) | Not counted (PF-TRACK-B2) | `applicationsTracked: false`, "not tracked" |
| External email | Same as External URL | Same as External URL | Same | Same | Same |
| Manual User Track (any method) | Never created | Created, private only | Never affected | Never affected | Never affected |

Admin approval alone affects none of these rows — confirmed again directly in this audit (§4, §10.5) on top of the prior audit's identical finding.

## 15. Dashboard and Analytics consequences

Out of this audit's narrow inspection list (Dashboard/Hiring Intelligence internals were fully audited in PF-TRACK-A/B2 and are unaffected by anything found here — the defects in this report are all upstream, at Job configuration time, not in how Dashboard/Hiring Intelligence read the resulting data). `EmployerAnalytics.jsx` was noted in the initial grep as referencing `applyType`/`applicationLink` but was not opened in this pass (not one of the instructed inspection targets); flagged as unexamined rather than assumed correct.

## 16. Local Job correlation

Read-only, safe-field-only Mongo queries (title, masked ID suffix, `applyType`, boolean link/email presence, masked employer ID, `status`, `approvalStatus`, `source`) — no email, URL, or credential value was printed; no write issued.

| Title | Job ID (masked) | applyType | hasApplicationLink | hasApplyEmail | Employer (masked) | status | approvalStatus | source |
|---|---|---|---|---|---|---|---|---|
| AI Engineer | `…4a81bf` | external | true | true | `…1d69b7` | active | approved | employer |
| Ads Generator | `…b075a8` | external | true | true | `…1d69b7` | active | approved | employer |
| Video Editor | `…b2606c` | external | true | true | `…1d69b7` | active | approved | employer |
| Graphic Designer | `…7bb561` | external | true | true | `…1d69b7` | active | approved | employer |
| Front Desk Operator | — | — | — | — | — | — | — | — |

"Front Desk Operator" was not found by exact title match in the local database at this HEAD — reported as a limitation, not guessed at (it may exist only in a different environment/screenshot, under a different exact title, or may have been removed since the screenshot was taken).

Database-wide aggregate: **17 total Jobs, 0 with `applyType: 'internal'`.** Breakdown: 5 `source:'employer'` (all `applyType:'external'`), 12 `source:'scraper'` (all `applyType:'external'`, expected/correct — scraped external listings are external by nature and out of this audit's concern). All four of Employer `…1d69b7`'s Jobs have **both** `applicationLink` and `applyEmail` populated — consistent with an Employer who filled in both optional destination fields on the create form exactly as a conventional job-posting form invites, with nothing on that form having surfaced "leave both blank for Strideto tracking" as a real option (§7).

- Whether `applyType` is explicitly stored: yes, for every Job checked.
- Whether legacy fallback ever produced these values: no — all are explicit, matching `source:'employer'` always setting `applyType` explicitly at create time (§7.8).
- Whether the Employer create form likely submitted these values: yes, directly consistent with §7's traced payload shape.
- Whether any internal Job exists anywhere locally: **no, zero, database-wide.** This is a systemic, product-wide gap, not a single Employer's misconfiguration.

## 17. Copy and UX

| Location | Consequence copy present? | Content |
|---|---|---|
| Create form | Partial | One-sentence help text per inferred mode (`applyModeInternalHelp`/`applyModeExternalHelp`), only visible for whichever mode is already implied by current input — not an upfront, side-by-side comparison before the Employer starts typing |
| Edit form | Same component, same partial copy | Same caveat, plus no warning about the switching defect's actual behavior (§8) |
| My Job Posts (`EmployerJobs.jsx`) | Not inspected in depth this pass (referenced applyType/applicationLink in the initial grep) | Not assessed against the required consequence list |
| Analytics (`EmployerAnalytics.jsx`) | Not inspected this pass | Not assessed |
| Applications page (`EmployerApplications.jsx`) | Yes, for the external case specifically | Confirmed in PF-TRACK-A §16: explicit disclosure message when `applyType !== 'internal'` |

**Classification: G — COPY/UX INSUFFICIENT** for the create/edit form specifically — the required information (internal Jobs get Applications/Hiring-Intelligence visibility + Employer-controlled pipeline; external Jobs get none of that, Strideto only sees views) exists in fragments but is never presented as a single, upfront, side-by-side decision aid at the one moment — Job creation — that actually determines the outcome.

## 18. Validation and security

1. **URL validation:** client-side only. `isValidHttpUrl` (`employerPostJobValidation.js:70-79`) restricts to `http:`/`https:` protocols — but this function is **never called server-side**. `employerController.createJob`/`updateJob` store `body.applyLink`/`body.applicationLink` with no sanitization or protocol check at all (`applicationLink: body.applyLink || null`, no `sanitizeString`, no scheme check). `adminJobsController.applyJobBody` calls `sanitizeString(applicationLink)` (`adminJobsController.js:87`), but `sanitizeString` (`server/src/utils/sanitize.js:5-11`) only trims, strips null bytes, and truncates length — it performs **no URL-scheme filtering whatsoever**.
2. **Consequence:** a Job's `applicationLink` can be stored as a `javascript:` (or other non-`http(s)`) URI via a direct API call to either `POST/PATCH /employer/jobs` or the Admin content-jobs endpoint, bypassing the client-only `isValidHttpUrl` check entirely. `JobDetail.jsx:276`: `<a href={applicationLink} target="_blank" rel="noopener noreferrer">` renders this value verbatim as a real, clickable anchor on the public Job page for any User who clicks "Apply." `rel="noopener noreferrer"` mitigates tab-nabbing, not scheme execution — it has no effect on a `javascript:` href.
3. **Email validation:** same story (client-only `isValidEmail`), but the consequence is low-severity — an invalid string in `applyEmail` only produces a broken `mailto:` link (`JobDetail.jsx:282`), not code execution.
4. Internal Jobs accepting unwanted external destination fields: confirmed possible at the model/resolver level (§5.10), not currently exploitable/observed live since no real write path sets them independently of `applyType` today.
5. External Jobs missing required destination: confirmed reachable (§6, §12) via Admin's hardcoded-external `create` path.
6. Client-supplied `employerId`: not accepted anywhere in `employerController.createJob`/`updateJob` (unchanged from every prior audit — ownership is always `req.employer.employerId`).
7. Changing another Employer's Job: blocked — `updateJob`'s `Job.findOne({ _id: req.params.id, employerId })` (`employerController.js:128`) scopes every edit to the authenticated Employer; confirmed no cross-Employer path exists via this controller.
8. Unsafe URL protocols: **confirmed gap, §18.1-18.2 — P0 per this audit's own stated rule ("any... unsafe-URL defect is P0").**
9. Method switching after applications exist: not currently exercisable (no internal Job with real Applications exists to test), and by source, nothing blocks it either direction once the §8 defect is eventually fixed.
10. Application-method tampering through direct API calls: confirmed feasible for the URL-scheme issue specifically (§18.1-18.2); `applyType` itself cannot be tampered with directly since neither controller ever reads a client-supplied `applyType` field at all (both always recompute it server-side from `applyLink`/`applyEmail`) — this specific tampering vector is closed.

**No cross-Employer or ownership defect was found (P0 class "ownership leak" — clean). The unsafe-URL-scheme gap is the one confirmed P0 in this audit.**

## 19. Client/server field matrix

| Concept | Client field | Client payload key | Server-read key | Stored Job field | Enum/type |
|---|---|---|---|---|---|
| Apply URL | `form.applyLink` | `applyLink` | `body.applyLink` | `applicationLink` | string, unvalidated server-side |
| Apply email | `form.applyEmail` | `applyEmail` | `body.applyEmail` | `applyEmail` | string, unvalidated server-side |
| Application method | *(none — no field exists)* | *(not sent)* | *(not read)* | `applyType` | `'internal' \| 'external'`, always server-computed |

## 20. Source-wired versus live-confirmed matrix

| Item | Source-wired | Live-confirmed this session |
|---|---|---|
| Create → internal Job when both fields blank | Yes | **Yes, indirectly** — confirmed via the exact same formula being used both client- and server-side, and via the absence of any validation blocking an all-blank submission; not exercised by actually submitting a Job (prohibited: "do not mutate Job records") |
| Edit → clear-to-internal defect | Yes | **Yes** — confirmed by direct trace of `axios`'s default `JSON.stringify` behavior (drops `undefined` keys) combined with the server's `!== undefined` gates; this is a deterministic code-path fact, not a probabilistic inference |
| Admin create → hardcoded external | Yes | Yes — literal source line, unconditional |
| Admin edit → asymmetric clear | Yes | Yes — literal source lines, same pattern as §8 |
| Duplication preserves method | Yes | Yes — literal field-list membership |
| Internal Job public apply gating | Yes | Yes — both gating conditions read and compared directly |
| Unsafe URL-scheme storage | Yes | Yes — confirmed no scheme check exists anywhere in the write path; the *rendering* consequence (`<a href>`) was confirmed by source read, not by actually storing and rendering a malicious link (prohibited scope) |
| Zero internal Jobs exist anywhere | N/A (a data fact, not a code fact) | **Yes** — confirmed by direct, read-only, safe-field database query (§16) |

## 21. Test inventory

| Test file | Executable/DB-backed | Covers | Missing cases |
|---|---|---|---|
| `employerPostJobValidation.test.js` | Yes (imports the real client validation module) | `resolveApplyMode`, `validateEmployerPostJobForm`, `isValidHttpUrl`/`isValidEmail` pure-function correctness | No assertion that the *payload* actually carries a clearing intent through serialization (would have caught §8's defect); no assertion of an explicit `applyType` selector since none exists |
| `canonicalJobWriteBoundary.test.js` | Not opened this pass (out of the narrow inspection list once its relevance to publication-state, not apply-method, was confirmed by name) | Believed to cover `CANONICAL_JOB_PUBLICATION_FIELDS`/write-boundary contract generally | Not assessed |
| `adminJobDuplicateBoundaryRegression.test.js` | Yes, schema-validation-only (no live DB) | `JOB_DUPLICATE_PRESERVE_FIELDS`/`RESET_FIELDS`/`FORBIDDEN_FIELDS` contract, confirms `applyType`/`applicationLink`/`applyEmail` preservation | Does not exercise the `applyJobBody` create/update asymmetry (§10) — different function entirely |
| `applicationDestinationContract.test.js` | Yes | A **separate, explicitly-named-"dormant"** `services/publishing/contracts/ApplicationDestinationContract.js` module — not imported by either `employerController.js` or `adminJobsController.js` (confirmed by grep of their import lists), i.e. this contract is not in either active write path traced in this audit | Its relationship to `resolveJobApplyType`/`applyJobBody` was not resolved further — flagged as a possible parked/future consolidation point, not analyzed beyond that |
| `employerApplicationFlow.test.js`, `employerDashboardMetrics.test.js`, `employerApplicationCountsEnrich.test.js` | Yes | `resolveJobApplyType` truth-table cases (already re-confirmed against source in §6) | No test covers the create/update *controllers'* derivation formulas directly (`employerController.js:96,153`) — only the standalone resolver function is tested |
| Employer application-method **selector** | **No test exists** | N/A — there is no selector to test (§7) |
| Internal-Application creation via a genuinely internal Job | **No live/integration test exists** exercising an actual `applyType:'internal'` Job end-to-end (consistent with §16: none has ever existed to test against) | — |

No test was added, changed, or run beyond what this documentation-only audit itself required (source reads and the one read-only Mongo query set, §16); no existing suite was executed.

## 22. Priority findings

- **P0:** No server-side URL-scheme validation on `applicationLink` in either the Employer (`employerController.js`) or Admin (`adminJobsController.js`) write paths — a `javascript:` (or other unsafe-scheme) URI can be stored and is rendered as a live, clickable anchor href on the public Job detail page (§18.1-18.2). No cross-Employer ownership defect was found (clean).
- **P1:** (a) No genuine UI control lets an Employer choose "Apply through Strideto" — internal is reachable only by omission, unlabeled as a choice (§7). (b) An Employer cannot switch an existing external Job back to internal through the edit form — the clear-both-fields save silently no-ops (§8.1), confirmed as a deterministic code defect, not a hypothesis.
- **P2:** Admin's general content-jobs `create` hardcodes `applyType:'external'` unconditionally, and its `update`/`applyJobBody` has the identical one-directional clear defect as the Employer path (§10). No warning is shown when switching application methods, even though it silently affects visibility (§8.8). Consequence copy exists only in fragments, not as an upfront comparison at Job-creation time (§17).
- **P3:** No test covers the create/update controllers' `applyType` derivation directly (only the standalone resolver, §21). No test exists for a selector that doesn't exist yet. `applicationDestinationContract.test.js`'s target module is confirmed dormant/unwired and its relationship to the live path is unresolved (§21). `EmployerAnalytics.jsx`/`EmployerJobs.jsx` copy was not assessed this pass (§17).

## 23. Recommended phases

**PF-HIRE-B4 — Server-side URL-scheme validation (security-first, smallest, no UX change)**
- Goal: reject (or strip to empty) any `applicationLink`/`applyLink` value whose scheme is not `http:`/`https:`, server-side, in both `employerController.createJob`/`updateJob` and `adminJobsController.applyJobBody`, closing the P0 gap before any UX work proceeds.
- Allowed files: `server/src/controllers/employerController.js`, `server/src/controllers/admin/adminJobsController.js`, one small shared validator (reuse/extract the existing client `isValidHttpUrl` logic server-side rather than reimplementing it), one focused test per controller.
- Focused tests: assert a `javascript:`/`data:`/`ftp:` scheme is rejected or stripped on create and update, for both controllers; assert `http:`/`https:` continue to pass unchanged.
- Live acceptance: attempt to create/update a Job with a non-http(s) `applicationLink` via a direct API call; confirm it is rejected or neutralized, never stored verbatim.
- Commit message: `fix(jobs): validate application link scheme server-side`
- Stop conditions: do not change `applyEmail` validation scope (email format mismatches are not a security defect, §18.3); do not touch `applyType` derivation logic in this phase.

**PF-HIRE-B1 — Explicit Employer application-method selector on Job creation**
- Goal: add a real, explicit control (e.g. a radio group: "Apply through Strideto" / "External application URL" / "Application by email") to `EmployerPostJob.jsx`'s create mode, so internal hiring is a genuine, visible choice rather than an emergent default of leaving fields blank — while keeping the existing link/email fields functionally equivalent to today for the two external modes.
- Allowed files: `client/src/pages/Employer/EmployerPostJob.jsx`, `client/src/pages/Employer/employerPostJobValidation.js`, employer i18n locale files (`en`/`ur`/`ar`) for new labels, one focused client test extending `employerPostJobValidation.test.js`.
- Focused tests: assert the new selector's state maps correctly to the existing `applyLink`/`applyEmail` payload shape (no server contract change required, since the server already derives `applyType` from those two fields) — or, if an explicit `applyType` is threaded through instead, assert the server's existing derivation is not broken by its presence.
- Live acceptance: create a Job with "Apply through Strideto" explicitly selected; confirm the resulting Job has `applyType:'internal'`, no `applicationLink`/`applyEmail`, and the public Job page renders the internal apply form.
- Commit message: `feat(employer): add explicit application-method selector to job creation`
- Stop conditions: do not change `resolveJobApplyType`, `applyToJob`, or any Dashboard/Hiring-Intelligence aggregation — this phase is client-form-only plus, at most, a additive/backward-compatible server field read.

**PF-HIRE-B2 — Fix application-method editing and safe method switching**
- Goal: make clearing the Apply Link/Email fields on the edit form actually clear them server-side and correctly recompute `applyType` back to `'internal'` — the confirmed §8.1 defect — by having the client send an explicit signal that survives JSON serialization (e.g. empty strings `''` instead of `undefined`, or an explicit `applyType` field) and having `updateJob` key its field-clear logic off that signal instead of `!== undefined`.
- Allowed files: `client/src/pages/Employer/employerPostJobValidation.js` (payload builder), `server/src/controllers/employerController.js` (`updateJob`), one focused test.
- Focused tests: assert that a payload representing "both fields cleared" results in `job.applicationLink === null`, `job.applyEmail === null`, `job.applyType === 'internal'` after `updateJob` runs against a fixture Job that started `external`.
- Live acceptance: edit an existing external Job, clear both destination fields, save; confirm the Job's stored `applyType` becomes `internal` and the public page now renders the internal apply form.
- Commit message: `fix(employer): correctly clear application destination and recompute apply type on edit`
- Stop conditions: do not add a warning/confirmation dialog in this phase (that is PF-HIRE-B3's scope); do not change the re-review-on-edit behavior (§8.10, already correct).

**PF-HIRE-B3 — Improve internal-versus-external consequences copy**
- Goal: present the full consequence comparison (Applications/Hiring-Intelligence visibility, Employer-controlled pipeline, internal analytics vs. Strideto-blind/views-only) upfront at the moment of choosing an application method on both create and edit forms, plus a brief warning when switching methods on an edit that already has an approved/live Job.
- Allowed files: `client/src/pages/Employer/EmployerPostJob.jsx`, employer i18n locale files.
- Focused tests: static-source assertion that both consequence blocks are rendered unconditionally (not just the single currently-inferred-mode sentence).
- Live acceptance: visually confirm the comparison renders correctly in both create and edit modes, in at least the `en` locale.
- Commit message: `feat(employer): clarify internal vs external hiring consequences`
- Stop conditions: do not alter `EmployerJobs.jsx`/`EmployerAnalytics.jsx` in this phase — they were not assessed (§17) and are out of this phase's evidence base; scope a follow-up audit pass for those two pages first if desired.

**PF-HIRE-C — Create one internal Job and run combined cross-role acceptance**
- Goal: after PF-HIRE-B1/B2 land, create one real internal Job (or, if those phases have not yet landed, create one via the existing blank-both-fields path, which already works today per §7), submit one real internal application to it, and run the previously-deferred `PF-TRACK-C`/`PF-EDM-C` combined acceptance (confirm `Application` + `OpportunityApplication` both created; Dashboard/Hiring-Intelligence/Applications page all reflect it; Employer stage change propagates to the User's tracker; User self-report does not propagate to the Employer).
- Allowed files: none (acceptance only, no code).
- Manual acceptance: full walk-through as described.

Not recommended: an Admin "Track Job" feature (explicitly ruled out, §4); any change to `resolveJobApplyType`'s core two-field-inference algorithm (it is correct and consistently applied everywhere it's used — the defects found are all in the *write paths feeding it*, not in the resolver itself).

## 24. Cross-role acceptance prerequisite

Unchanged conclusion from PF-TRACK-B3: `PF-TRACK-C`/`PF-EDM-C` cannot run yet, and the reason is now fully explained rather than just observed — no code path in the current Employer or Admin UI has ever produced an internal Job, because (a) internal is not an explicit, discoverable choice at creation (§7) and (b) even a deliberate attempt to fix an existing Job via editing silently fails (§8). The prerequisite is unchanged in substance (create or convert one Job to internal) but is now known to require either using the already-functional-but-hidden blank-both-fields path at creation time, or landing PF-HIRE-B1/B2 first to make that path discoverable and to make the edit-time fix actually work.

## 25. Pre-push implications

The URL-scheme validation gap (P0, §18) is a real, confirmed security gap and should be prioritized before push if any Employer accounts with API access (not just the trusted browser UI) exist in a shared/production-adjacent environment — it requires an authenticated Employer (or Admin) actor, not an anonymous one, but the resulting payload is rendered to arbitrary Users. The missing create-flow selector (P1a) and the broken edit-flow switch (P1b) are real product-completeness gaps that block the platform's own internal-hiring value proposition from ever being used, but are not data-integrity or cross-role security defects on their own. None of the findings here require a database migration or affect any already-committed PF-TRACK-A/B2/B3 work.

## 26. Final recommendation

Proceed with **PF-HIRE-B4** first (smallest, security-first, no UX dependency), then **PF-HIRE-B1** (make internal hiring a real, discoverable choice), then **PF-HIRE-B2** (fix the confirmed edit-time switching defect), then **PF-HIRE-B3** (copy), then **PF-HIRE-C** (the combined live cross-role acceptance already queued since PF-TRACK-B3/PF-EDM-C).
