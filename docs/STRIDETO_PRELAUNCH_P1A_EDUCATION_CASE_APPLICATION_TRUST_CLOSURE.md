# STRIDETO Pre-Launch P1A Education Case / Application / Student Trust Closure

## Change record

- Starting HEAD: `91c4285248459d6a10c1d338b7f3dec8f1844239`
- Final HEAD: recorded in the terminal closure report. A Git commit cannot embed its own identifier, so this document records the implementation boundary and the final report records the documentation commit-inclusive HEAD.
- Product scope: Education & Mobility Provider and Student only.
- ProfessionalCase origin: unchanged. A completed Consultation is required, the Provider proposes the Case, and the Student must accept the `agent_case` consent before the Case becomes active.
- Business Services, Admin verification, Education Marketplace, auth realms, Employer, Institution, and Business Client workflows were not redesigned.

## ProfessionalCase and application relationship

`ProfessionalCase` remains the consented professional engagement and workflow container. The additive `ProfessionalCaseApplication` collection represents zero or more Provider-managed Education applications under one Case:

`ProfessionalCase 1 -> 0..N ProfessionalCaseApplication`

No existing Case requires a backfill. Guidance-only Cases may have no applications. University Application Support Cases may have multiple independent applications, including different programs or intakes at the same institution.

The application record reuses `CanonicalInstitution` and `Program`. Intake identity is validated against the canonical Program's embedded intake collection when a canonical Program is selected. A bounded institution/program/intake snapshot is allowed only for an external catalog item; it does not create a competing canonical catalog record.

## Application truthfulness

The workflow states are:

- `preparing`
- `ready_for_submission`
- `provider_attested_submitted`
- `awaiting_decision`
- `provider_recorded_offer`
- `provider_recorded_unsuccessful`
- `withdrawn`
- `completed`

These are STRIDETO workflow states maintained by the Provider. `provider_attested_submitted` requires an approved Student `external_submission` action and a truthful current submission method. It is not presented as an institution acknowledgment. Provider-recorded outcomes are not presented as official institution decisions unless an evidence reference is separately recorded.

Application IDs are opaque MongoDB ObjectIds. Creation supports a Case-scoped idempotency key while allowing legitimate repeat applications for a different program, intake, or attempt. Completed or cancelled Cases reject application mutation.

## Authority and privacy invariants

- Student ownership, Provider subject, organization, and Agency membership are derived from the parent ProfessionalCase, never from request-body owner fields.
- Student A cannot read or mutate Student B's application.
- Provider A cannot read or mutate Provider B's Case application.
- Independent Provider and Agency subject authority remains exact.
- A Business-only Provider membership cannot use Education Case authority.
- Student Case projections omit Provider membership IDs, Vault grant IDs, document storage identifiers, message sender account IDs, and private event metadata.
- Provider internal notes remain Provider-only; Students receive shared notes only.

## Provider Case operations

The Education Provider Case detail now exposes the existing Case contract in one operational view:

- Student and Education Service context
- lifecycle and workflow stage transitions
- zero or many applications, deadlines, submission state, outcome, and application history
- Student-owned and Provider-owned tasks
- exact document requests and granted-document resolution
- shared and internal notes
- high-value Student approvals
- Case outcome and consented completion
- Case-context messages
- meaningful activity timeline

It does not enumerate the Student Vault. A Provider resolves only a shared document request whose exact active grant matches the Case, Student, document, permission, and assigned Provider membership.

## Student Case tracking

The Student Case detail now answers who the Provider is, which Education Service applies, the Case status and stage, all recorded applications, institution/program/intake, application status, known deadlines, Student and Provider next actions, shared documents, approvals, Case messages, shared notes, and history.

The Student can select one owned Vault document for one Case document request, share it through the existing exact-grant service, see sharing state, and revoke it. Revocation immediately fails closed for Provider resolution. Storage keys and broad Vault access are never exposed.

## Contextual messaging

The existing ProfessionalCase thread is rendered in both Provider and Student Case detail. Consultation and Case threads remain distinct. Every message access resolves the authenticated actor through the exact parent Case; no generic social inbox or Business messaging context was introduced.

## Review, report, and dispute closure

The canonical successful ProfessionalCase lifecycle is `completed`, with `processCompleted=true` and `closedAt` recorded. Review eligibility previously checked noncanonical lifecycle `closed`; it now checks the proven canonical completed state.

Active Cases remain ineligible. Existing verified-interaction, self-review, one-review-per-interaction, Provider response, and Admin moderation authority remain in force. Student UI now exposes:

- eligibility-gated review creation for completed Consultation/ProfessionalCase interactions
- private report creation bound to the exact Provider or interaction target
- professional service dispute creation bound to an eligible interaction
- Trust Center review/report/dispute history

Professional disputes remain distinct from payment disputes.

## Data and indexes

- Migration: additive collection only; no destructive migration or backfill.
- Mongoose `autoIndex`: false on the new model.
- Index provisioning: explicit create-only critical indexes for Case ordering, status/deadline queries, and Case-scoped creation idempotency.
- Trust review/dispute uniqueness indexes are explicitly provisioned because runtime auto-indexing is disabled.
- Provisioning was verified idempotent; a second pass created no index.
- `syncIndexes`: not used.
- `dropIndexes`: not used.
- Disposable test database: `strideto_p1a_case_application_run1`, dropped by the test teardown.

## Verification evidence

- P1A disposable Mongo integration: 8/8 passed.
- P1A server source/security contract: 14/14 passed.
- P1A client source/UI contract: 14/14 passed.
- Existing ProfessionalCase contract: 55 assertions passed.
- Existing trust/review/report/dispute suites: passed.
- Existing ConsentGrant/Vault suites: passed.
- Auth/session, Provider workspace/product separation, Education verification mark, Education Marketplace free promotion, and availability/credential regressions: passed.
- Business Request, Quote, GbsCase, buyer/provider UI, and navigation source contracts: passed without Business workflow changes.
- Touched server/shared `node --check`: passed.
- Touched server and client ESLint: passed with no new errors.
- Production Vite build: passed (1,375 modules transformed); only pre-existing chunk-size and Browserslist warnings remained.
- Responsive touched-page acceptance: 60/60 cells passed at 320, 375, 768, 1024, and 1440 in Explicit Light and Explicit Dark.
- Responsive assertions: primary heading present, no page overflow, no visible unlabelled form control, no route error boundary, correct theme, and clean browser console.
- Runtime: api-a healthy, api-b healthy, frontend healthy, Caddy HTTPS 200, Mongo healthy, Redis healthy, Mailpit healthy.
- Anonymous Case read and Application create probes: 401.
- Recent runtime logs: no unexpected 5xx, unhandled exception, or critical-index provisioning failure.

## Preserved launch-safety state

- Worker: stopped; not rebuilt or started.
- Queue: undrained; 137 pending BackgroundJobs remained after verification.
- Business public marketplace: OFF.
- Wyoming requirement pack: draft/draft.
- Filing authorization production legal text: draft, unapproved, empty paragraphs.
- Filing authorization and external filing activation flags: unset/OFF.
- HSI: unset/OFF.
- `MONGO_AUTO_INDEX`: unset/OFF.
- No push or deploy was performed.

## Deferred work

- Education service taxonomy alignment remains P2.
- Admin Education professional-credential evidence review remains separate P1C/public-launch trust work.
- Provider dashboard analytics/action-queue expansion remains deferred.
- Full four-theme global acceptance and real native 200%/screen-reader acceptance remain later certification activities.
- The next implementation phase is P1B Business intake/messaging/document workflow closure; it was not started here.
