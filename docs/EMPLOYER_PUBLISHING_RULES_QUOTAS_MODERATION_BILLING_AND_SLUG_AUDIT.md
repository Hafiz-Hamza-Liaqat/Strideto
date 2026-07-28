# Employer Publishing Rules, Quotas, Moderation, Billing and Slug Audit

**Phase:** E.1F-H
**Audit date:** 2026-07-28
**Mode:** Read-only source audit. No application code, configuration, production data, payment configuration, seeds, remediation, deployment, or git history were changed.

## Executive verdict

**NOT READY**

Strideto is not ready to implement or expose the proposed free-beta publishing policy as a small UI change. The current domain model cannot faithfully represent the required lifecycle; it has only `draft`, `active`, and `closed` job statuses, with a separate three-value approval flag. The first-free entitlement is consumed when the first draft is created, not when a valid free publication submission reaches moderation. There is no daily, active, rolling-monthly, company, or verified-organization quota enforcement. Employer verification is displayed but not enforced for activation. Expiry dates do not remove jobs from public queries and no automatic expiry transition exists. Paid checkout is visible while Stripe is unconfigured and the billing implementation lacks several production controls.

The proposed policy is feasible, but it requires an explicit publication-submission ledger, organization identity, transactional quota enforcement, a richer publication/moderation state contract, expiry processing, employer-facing usage states, and test coverage before free-beta publication should be enabled.

### Primary blockers

1. `Employer.totalJobsPosted` is incremented only for the first created draft and is used as lifetime first-free eligibility (`server/src/controllers/employerController.js:66-115`). Deleting, abandoning, or failing to publish that draft still consumes the entitlement.
2. `POST /employer/jobs/:id/activate` performs no employer-verification or quota checks and changes the job to `status=active`, `approvalStatus=pending` (`server/src/controllers/employerController.js:183-224`).
3. There are no server-side daily, weekly, monthly, maximum-active, company-level, or plan-specific publication limits.
4. Public queries require active plus approved, but do not filter `expiresAt` or `deadline`; an approved expired listing remains public until another process changes it, and no such process was found (`server/src/controllers/jobsController.js:17-21,63-86`).
5. The data model cannot distinguish pending payment, payment failed/completed, pending approval, expired, reopened, or changes-awaiting-reapproval as job states (`server/src/models/Job.js:27-29,51`).
6. Employer accounts are independent records with unique email only. There is no canonical organization/company membership key with which to enforce a company quota (`server/src/models/Employer.js:4-34`).
7. Paid controls remain actionable in the plan-selection UI; the API returns `503 "Payment gateway not configured. Contact support."` when `STRIPE_SECRET_KEY` is absent (`server/src/controllers/paymentsController.js:6-23`).
8. No employer publishing-policy, quota, billing, expiry, or moderation lifecycle tests were found. Existing employer tests cover auth realm isolation, form validation, ownership/application behavior, application counts, and dashboard conversion helpers.

## Evidence scope

This audit traced the employer routes, controllers, models, plan seed, payment service/webhook, public job reads, admin moderation endpoints, notifications, scheduler, shared slug/locale helpers, employer UI, English employer copy, RBAC, rate limiting, environment templates, and relevant tests. Findings describe repository behavior, not production database contents. Exact production plan documents, payment rows, and whether a particular employer already consumed first-free cannot be established without a prohibited production-data read. The production observation that the second draft showed Starter and Standard is therefore explained from code and response behavior but not asserted as a database inventory.

## 1. Current publishing workflow

### End-to-end trace

1. **Registration:** `POST /auth/employer/register` accepts company name, email, password and optional profile values, creates an unverified `Employer`, and immediately issues access/refresh tokens. There is no employer email/domain verification step in this flow (`server/src/routes/employer.js:10`; `server/src/controllers/employerAuthController.js:32-52`; `server/src/models/Employer.js:25-28`).
2. **Verification:** staff moderation can change employer verification fields, and automation can notify the employer. Verification is not a prerequisite in create, activate, checkout, or public-read logic.
3. **Draft creation:** `POST /employer/jobs` validates only title and company at the controller boundary, generates a slug, creates `status=draft`, `approvalStatus=pending`, and sets `planType=free` only when `totalJobsPosted===0`. The first draft atomically is **not** protected against concurrent requests because the eligibility read, job insert, and employer increment are separate operations.
4. **Draft editing:** `PATCH /employer/jobs/:id` permits listed fields for any owned job except closed. It does not regenerate the slug after title/location edits. Any edit to an active approved job changes approval to pending, regardless of significance.
5. **Plan selection:** `GET /employer/plans` returns all active `JobPlan` documents sorted by price. The browser calls it after draft creation.
6. **Free activation:** if the job already has `planType=free`, `POST /activate` needs no plan or payment. It sets active/pending. It applies no expiry because the first-free job has no `planId`; therefore its visibility duration is unlimited in the current implementation.
7. **Paid checkout:** `POST /checkout` requires an owned job and active positive-price plan, creates a pending `Payment`, then creates a Stripe Checkout Session.
8. **Payment confirmation:** `POST /api/webhooks/stripe` verifies the Stripe signature. `checkout.session.completed` marks the referenced payment completed and, if the job is not active, sets it active/pending approval with plan expiry. No employer-initiated post-success activation is required by the webhook path.
9. **Admin approval:** individual and bulk moderation endpoints set approved/active. Public list/detail queries expose only active approved jobs (and legacy jobs with no approval field).
10. **Rejection:** individual/bulk endpoints set `approvalStatus=rejected` but normally retain the existing job status. There is no rejection-reason field on `Job`; individual audit logging does not persist a supplied reason as a job moderation record, and bulk rejection has no per-job reason contract.
11. **Expiry:** checkout/activation may populate `expiresAt` and `paidUntil`. A reminder path can notify near `paidUntil`, but no job changes to expired and public reads ignore both dates.
12. **Close/reopen:** employer close changes status to closed. Reopen changes it to draft but preserves plan, approval, expiry, and rejection values. Re-activation resets approval to pending; paid reopen can reuse a previously completed matching payment because the activation verification has no consumed/renewal constraint.
13. **Renewal/reposting:** no explicit endpoint or domain contract exists. Admin duplication creates another pending job, but that is an admin content operation rather than employer renewal.

### State table

“Not representable” means the requested state has no canonical job status; a payment row or a combination of fields may approximate it.

| Requested state | Current representation and entry | Actor / endpoint | Authorization | Quota effect | Approval / notifications |
|---|---|---|---|---|---|
| Draft | `Job.status=draft`, usually `approvalStatus=pending` | Employer, `POST /employer/jobs`; reopen also enters draft | Employer token; ownership on later reads/edits | No general draft quota; first created draft can consume lifetime first-free | No notification |
| Pending payment | Job remains draft; separate `Payment.status=pending` | Employer, `POST /employer/jobs/:id/checkout` | Employer token and owned job in payment service | None | None |
| Payment failed | Not reliably represented; `failed` exists in Payment enum but no handled webhook transition was found | No complete endpoint | N/A | None | No failure notification |
| Payment completed | `Payment.status=completed`; webhook may set job active/pending | Stripe webhook | Signature, metadata lookup | No free quota; no idempotency/event ledger | Payment-success notification is deduplicated by payment ID |
| Pending approval | Usually `status=active`, `approvalStatus=pending`; drafts also begin pending | Employer activate, payment webhook, or edit | Employer ownership / signed webhook | No publication quota | No “submitted” notification |
| Approved | `approvalStatus=approved`; individual/bulk approval also forces active | Moderator/admin endpoints | `moderate:jobs` permission | None | Bulk moderation invokes approval notification; individual `approveJob` does not invoke `onJobApproved` |
| Active | `status=active`, but may still be pending/rejected and non-public | Activate, webhook, admin approval | As above | None | Activation response says it awaits approval |
| Rejected | `approvalStatus=rejected`, status may remain active/draft | Staff individual/bulk reject | `moderate:jobs` | None | No employer rejection notification found |
| Closed | `status=closed` | Employer close; moderation report resolution may close/reject | Ownership or staff permission | None; does not restore/reset anything because quotas do not exist | No close notification |
| Expired | Not representable; only dates exist | No transition endpoint/worker found | N/A | None | Expiring reminder exists; no expired notification |
| Reopened | Not representable; immediately becomes draft | Employer `POST /reopen` | Ownership | None | Response instructs activation |
| Changes awaiting reapproval | `status=active`, `approvalStatus=pending` after **any** edit to active+approved | Employer patch | Ownership | None | Response says it “may require” reapproval; no admin/employer notification |

### Exact transition defects

- `active` conflates paid entitlement/visibility intent with public publication. Publicness is really `active AND approved`, with a legacy exception.
- Payment and moderation are separate models without one immutable publication attempt linking quota, plan entitlement, payment, moderation, activation, expiry, and idempotency.
- Approval can force a draft directly active, bypassing a separate submit/entitlement gate.
- Rejection, close, and reopen do not clear or validate stale payment/plan/expiry values.
- There is no first-listing moderation rule distinct from the existing all-activated-listings approval behavior.

## 2. Actual implemented quotas and limits

| Limit/contract | Actual implementation |
|---|---|
| Drafts per employer | Unlimited; no count or enforcement |
| Free jobs per account | One lifetime **draft eligibility**, derived from `Employer.totalJobsPosted===0`; not a robust published-job limit |
| Free jobs per company | None; no canonical company enforcement key |
| Free jobs per day/week/month | None |
| Maximum active jobs | None |
| Rolling 30-day publications | None |
| First-free eligibility | Employer-account field; first draft gets `planType=free`; field increments only in the first-job branch |
| Free listing duration | None/unbounded: free activation has no plan duration and public reads ignore expiry |
| Paid listing duration | Data-driven `JobPlan.durationDays`; seed defaults: Starter 7, Standard 30, Premium null/until filled |
| Reposting interval | None |
| Renewal behavior | No contract or endpoint |
| Verified/unverified limits | Identical; verification is not enforced |
| Account/company enforcement | Account only for ownership and first-free; no company-level quota |
| Admin-created exemptions | Admin CRUD/bulk routes do not use employer quota logic; since no quotas exist, exemption is implicit |
| Plan-specific limits | Only price, duration, features, and active flag; no submission/active counts or eligibility fields |

### Exact sources

- Job and index definitions: `server/src/models/Job.js:5-75`.
- Employer eligibility counter: `server/src/models/Employer.js:25-34`.
- First-free branch: `server/src/controllers/employerController.js:66-115`.
- Activation: `server/src/controllers/employerController.js:183-224`.
- Plan schema: `server/src/models/JobPlan.js:3-13`.
- Default plan constants: `server/src/seed/jobPlans.js:3-25`.
- No quota middleware exists; only general IP API limits and employer-auth limits exist (`server/src/middleware/rateLimit.js:17-80`).
- No database index enforces a publication bucket or company quota. Job has `{employerId,status}`, `{status,approvalStatus}`, and expiry indexes, but indexes alone do not impose counts.
- Relevant tests contain no quota/publication-state assertions. `employerPostJobValidation.test.js` is form validation; `employerPortalIntegration.test.js` covers internal/external application truth and uniqueness; `employerDashboardMetrics.test.js` covers conversion helpers.

## 3. Proposed one-free-submission-per-day policy

### Time definition comparison

| Definition | Employer effect | Operations | Abuse/clarity |
|---|---|---|---|
| UTC calendar day | Reset is 05:00 PKT | Simple daily bucket | Confusing to Pakistan employers; burst at boundary permits two rapid submissions |
| Asia/Karachi calendar day | Reset at local midnight, currently UTC+05:00 | Simple bucket; timezone must be explicit | Clearest displayed reset, but boundary burst remains |
| Rolling 24 hours | Next eligibility is exactly 24 hours after consumed submission | Requires timestamp/window query | Most faithful to “one per day”; prevents boundary burst |

**Recommendation:** rolling 24 hours for beta. Display an exact Pakistan-time “Next free submission available” timestamp. It has the least exploitable meaning and matches the preferred policy. If operational simplicity outweighs that protection, use an explicitly documented `Asia/Karachi` calendar-day bucket—not server-local time and not UTC copy presented as a local day.

### Consumption point

Consume only after:

1. employer and verified organization are resolved;
2. the draft passes backend validation and safety prechecks;
3. active and rolling-30-day capacity checks pass;
4. an atomic publication-submission row is successfully inserted with state `pending_moderation`;
5. the job is transactionally linked to that row.

Draft creates/edits, validation failures, transaction/server failures, paid checkout/payment failures, and reads must not consume it. Rejection, closure, or expiry must not delete or backdate the consumption. Retrying the same logical action must return the original submission.

### Enforcement identity

Use a combination:

- primary key: immutable `verifiedOrganizationId`;
- secondary abuse key: employer account/user membership;
- risk controls: verified domain, normalized legal/company identity, phone, payment/customer fingerprint, and moderator links between duplicate organizations.

Do not use editable `companyName`, email alone, or `Employer._id` alone. The current one-account-per-employer model needs organization membership before two users can legitimately share a company quota.

### Atomicity and indexes

Add a `JobPublicationSubmission` (or equivalent entitlement ledger) with immutable fields such as `organizationId`, `employerActorId`, `jobId`, `kind`, `submittedAt`, `quotaWindowStart`, `idempotencyKey`, `state`, `planSnapshot`, `moderation`, and timestamps.

Recommended controls:

- unique `{organizationId, idempotencyKey}`;
- index `{organizationId, kind, submittedAt:-1}`;
- index `{organizationId, state, submittedAt:-1}`;
- transaction covering eligibility check, ledger insert, and job state update;
- for calendar buckets, unique partial `{organizationId, kind, localDateBucket}` for free submissions;
- for rolling 24 hours, transaction/serialized organization quota document or atomic lease because a simple unique index cannot express a rolling interval;
- retry-safe result storage and request idempotency;
- counts based on the ledger, not mutable job status;
- active-slot acquisition/release through a transaction or counter guarded by a version.

Two tabs, retries, refreshes, and multiple company users otherwise race. The current first-free implementation is vulnerable because its check and increment are not conditional/transactional.

## 4. Free plan duration and expiry

### Duration recommendation

| Duration | Employer value | Freshness/expired risk | Moderation/SEO/content volume |
|---|---|---|---|
| 7 days | Weak for many hiring cycles | Fresh, but frequent repost pressure | High renewal/moderation load; thin durable inventory |
| 15 days | Balanced for urgent roles | Better freshness | Moderate repost pressure and SEO churn |
| 30 days | Strong beta value and familiar hiring window | Requires deadline/expiry hygiene | Best early inventory and SEO continuity; lower renewal workload |

**Recommendation:** 30 days for the first six-month beta, capped by an earlier valid application deadline and backed by automatic expiry. It provides enough employer value and early content volume while the proposed 5-active/10-rolling limits contain abuse. Seven days is too punitive and moderation-heavy; 15 days is a viable later experiment.

### Required expiry contract

- A scheduled, idempotent worker changes publicly active listings to `expired` at `min(visibleUntil, deadline-end-policy)`.
- Public lists immediately exclude them; detail URLs return an archived vacancy page with “applications closed,” related live jobs, and no apply action—not a soft-live listing.
- Notify employers ahead of expiry and at expiry; keep application records, analytics, moderation, payment, and audit history.
- Preserve the canonical URL for an archive window. Use `noindex,follow` after expiry unless the archive has meaningful durable value; never canonicalize expired jobs to unrelated live jobs.
- Existing applications remain accessible and processable.
- Renewal creates a new entitlement/submission event and new visibility window; it must not silently reuse an old payment or reset quota by close/reopen.
- Reposting policy should prevent duplicate live listings and define when a materially identical expired job may be resubmitted.

Current reminder automation looks at `paidUntil` and can enqueue an expiring notification, but it does not expire jobs. Free jobs have neither date.

## 5. Moderation policy

### Free jobs

Adopt “every free publication submission requires admin approval” and “first listing requires approval” as explicit policy. Current activated employer jobs already require `approvalStatus=approved` to be public, but enforcement is incomplete because:

- employer verification is not required;
- approval is not a historical record;
- there is no rejection reason/SLA;
- notification behavior differs between bulk and individual approval;
- no rejection/submission notification exists;
- approved content can be edited in place and temporarily disappears from public reads;
- close/reopen retains ambiguous old approval/entitlement values.

Moderation endpoints require `PERMISSIONS.MODERATE_JOBS`, granted to Moderator, Admin, and SuperAdmin (`server/src/config/rbac.js:41,91-119`; routes at `server/src/routes/admin.js:99-100,166-167`).

### Significant edits

Major edits should create a pending revision while the last approved revision remains live when safe. Require reapproval for:

- title;
- displayed company/organization identity;
- description, responsibilities, or requirements;
- application URL/email or apply mode;
- salary/range/currency;
- city, location, remote/hybrid state;
- category/type;
- deadline;
- any field affecting legality, eligibility, or candidate destination.

Minor typo/formatting edits and non-substantive metadata may remain active, but must be audited. Do not mutate the approved public document before moderation; store a revision/diff. Current behavior sends every edit to pending and removes it from public visibility because the same record’s approval flag changes.

### Close and reopen

Close should preserve moderation history and release an active slot, not a daily/monthly publication. Reopen should never directly restore public visibility. It should validate entitlement/expiry and create a new submission/reapproval where required. A rejected job must require a corrected revision and resubmission; the rejection reason must remain visible.

### Employer labels

- **Draft:** Saved privately; editable; no quota used.
- **Awaiting approval:** Submitted successfully; not public; show submission time and review expectation.
- **Active:** Approved and public until an exact date.
- **Rejected:** Not public; show reason, appeal/support, and allowed correction action.
- **Closed:** Removed by employer/admin; applications and analytics retained.
- **Expired:** Visibility ended; show renewal/repost eligibility.
- **Changes awaiting reapproval:** Current public version remains live where policy permits; submitted changes are not live.

Define and publish a moderation target such as “normally within one business day,” without promising an SLA until staffing/monitoring supports it.

## 6. Paid publication and approval

### Model comparison

| Model | Benefit | Risk | Verdict |
|---|---|---|---|
| A: payment bypass | Fastest paid publication | Payment becomes trust; scams, phishing, impersonation, paid spam, fraud/chargebacks publish immediately | Reject |
| B: trust-based | Fast for proven organizations, retains gates | More domain and automation complexity | **Recommend** |
| C: universal approval | Safest simple launch | Moderation bottleneck and weaker paid value | Safe interim fallback |

**Recommendation:** Model B after the moderation and trust foundation exists. Until then, use Model C for any paid pilot. Payment must never confer trust.

A trusted employer should require verified organization/domain and profile, an approved first listing, clean policy history, minimum account age or enhanced review, a settled low-risk payment, a valid same-organization application destination, no suspicious content/URL flags, and no compromised-account signals.

Paid flow should be **pending automated checks**, followed by automatic publication only for a trusted organization when all checks pass. Flagged, unverified, first-time, high-risk, or ambiguous jobs remain pending manual review. Do not use provisional public publication for employment listings. If moderation/safety services are unavailable, fail closed into manual pending—not public.

Risks specifically include fake employers, phishing URLs/emails, discriminatory or illegal roles, salary deception, company impersonation, fee/investment schemes, spam, account takeover, fraudulent cards, chargebacks, and webhook/metadata abuse.

## 7. Employer job-posting rules

No dedicated employer-facing posting rules or acknowledgement was found. General Terms contains generic listing language, but it is not a complete employer policy and is not integrated into submission.

### Proposed rule inventory and enforcement

| Rule group | Checkbox | Validation | Automated moderation | Admin / verification |
|---|---:|---:|---:|---:|
| Legitimate current vacancy; accurate company identity; truthful title/description/location | Yes, per submission | Required fields/deadline | Duplicate/deception signals | Admin + organization verification |
| Salary transparency where practical; no misleading salary | Included in acknowledgement | Range/currency structure | Outlier/mismatch flags | Admin for flags |
| Valid deadline and application destination | Yes | Date, URL, email, scheme/host | redirect/domain/reputation checks | Destination ownership review |
| No candidate fees, deposits, investment, pyramid/referral-only schemes | Explicit | prohibited structured values | keyword/context classifier | Mandatory manual review when flagged |
| No unlawful discrimination except lawful occupational requirement | Explicit | avoid unsafe enums | content flags | Manual/legal escalation |
| No adult, illegal, harmful work | Explicit | blocked categories | safety classifier | Reject/escalate |
| No phishing, credentials collection, malware, prohibited URL | Explicit | URL/email validation | reputation, redirect, malware/phishing checks | Fail closed |
| No fake remote claims, duplicate spam, copied identity, fake urgency | Included | duplicate fingerprint | similarity/risk checks | Admin/repeat-offender restriction |
| No misuse of personal phone/email | Included | destination policy | domain/identity checks | Verification |
| No expired vacancy or unverifiable government claim | Included | future deadline | source/identity flags | Manual verification |

Place concise rules and acknowledgement on Post New Job and submission confirmation; summary/link on registration, dashboard onboarding, plan/usage, edit, employer terms, and rejection email; full review checklist in admin moderation. A single checkbox should link to versioned Employer Posting Rules and store the accepted version/time on each submission.

Current HTML handling strips all HTML from employer descriptions, which reduces script injection risk (`server/src/controllers/employerController.js:99,136-137`), and global Mongo sanitization/rate limiting exists. Application URLs/emails are not subjected to the required safety/domain checks in the create path.

## 8. Employer dashboard usage guidance

The dashboard shows verification and aggregate cards, including drafts/pending/closed, but no “How Strideto employer posting works” contract or quota/expiry guidance.

Recommended concise copy:

> **How job posting works**
> Complete your company profile and verification first. Create and edit as many private drafts as you need. During Free Beta, a verified organization can submit one free job every 24 hours, keep up to 5 free jobs active, and submit up to 10 free jobs in any rolling 30 days. Each free submission is reviewed before it becomes public. Approved jobs remain visible for up to 30 days. Applications made on Strideto appear in Applications; applications sent to an external site or email are not tracked. You can close a listing at any time. Major edits, reopening, renewal, or reposting may require another review and may use quota.

Show:

- a short onboarding card on the dashboard;
- contextual rules/quota summary on Post New Job and plan selection;
- an explanatory empty state in My Jobs;
- complete counters/timestamps on functional `/employer/plans`;
- full policy in Help and Employer Terms.

## 9. Plans & Usage

There is a backend catalog endpoint at `GET /employer/plans`, but no functional employer page/route/sidebar item. It returns only active plan documents and none of the requested usage or billing fields (`server/src/routes/employer.js:23`; `server/src/controllers/employerController.js:177-180`; `client/src/pages/Employer/EmployerLayout.jsx:14-20`).

Use canonical browser route **`/employer/plans`** named **Plans & Usage**. Add it to the sidebar only when functional.

The future response/page should show:

- Free Beta plan/policy version;
- consumed daily submission and exact next eligibility;
- active free jobs used/5 and remaining slots;
- rolling 30-day submissions used/10 with window detail;
- upcoming expirations and closed jobs;
- paid plans as “Coming later” while disabled;
- billing state and payment history only when payments launch;
- failed/refunded payments, receipts/invoices, renewal state, support route;
- posting-rules link and verification blocker.

Usage must be computed from the immutable submission/entitlement ledger, not `totalJobsPosted` or mutable job status.

## 10. Payment gateway readiness

### Current contract

- Provider: Stripe (`server/src/services/paymentService.js:1-18`).
- Environment: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; `SITE_URL`/`FRONTEND_URL` build redirects (`.env.example:9-13,29-31`; `server/src/controllers/paymentsController.js:4`).
- Checkout: `POST /employer/jobs/:id/checkout`.
- Webhook: `POST /api/webhooks/stripe`, registered before JSON parsing.
- Signature: Stripe `constructEvent` using webhook secret.
- Plan validation: owned job; active plan; positive price.
- Amount/currency: server derives amount from plan and hard-codes USD in Payment and Checkout.
- Success: payment completed; job active/pending approval; plan expiry set.
- Failure/refund/chargeback/invoice: model has failed/refunded states, but no complete webhook/refund/chargeback/receipt workflow was found.

### Why production displays the error

`isStripeConfigured()` checks only `STRIPE_SECRET_KEY`. When absent, checkout returns HTTP 503 with exactly “Payment gateway not configured. Contact support.” The production environment template does not list Stripe keys at all, while the general template comments them as optional. This is consistent with an intentionally unconfigured deployment.

### Safety gaps

- no stored/unique Stripe event ID or webhook replay ledger;
- duplicate `checkout.session.completed` processing is not guarded by an event-level idempotency record;
- completion trusts metadata payment ID without rechecking session amount, currency, plan snapshot, job/employer metadata, or payment status;
- repeated checkout clicks create multiple pending Payments/Sessions;
- no checkout idempotency key;
- no explicit `payment_status==='paid'` check;
- no expiration/cancel/failure, refund, dispute/chargeback handling;
- no receipt/invoice/customer/tax contract;
- no immutable plan-price snapshot beyond amount and plan reference;
- no rule preventing reuse of a completed Payment for later activation/renewal;
- webhook activates a job before admin approval but labels its status active;
- plan currency schema is absent and comments describe price as USD/base currency, conflicting with proposed PKR.

**Classification:** incomplete and misleading; a paid-launch blocker.

**Current UI recommendation:** hide actionable paid checkout and present one Free Beta submission path. If plan comparison is strategically useful, show paid plans disabled with “Coming later”; never leave `Pay & Publish` enabled. The observed second draft showed paid plans because it was no longer first-free and the plan catalog returns active seeded/database plans; the UI filters/display behavior and production plan collection likely explain why only Starter and Standard appeared. Production contents cannot be proven from source.

## 11. Current plan contracts

Source seed defaults:

| Identifier | Name | Price/currency | Duration/features | Eligibility/free rule | Approval/activation | Readiness |
|---|---|---|---|---|---|---|
| `starter` | Starter | 1 USD | 7 days; standard listing | Any non-free owned draft after payment | Checkout + webhook or completed-payment activate; pending approval | Not production-ready |
| `standard` | Standard | 2 USD | 30 days; highlighted | Same | Same | Not production-ready |
| `premium` | Premium | 3 USD | No duration; featured, priority, analytics copy | Same | Same | Not production-ready |
| synthetic `free` | “First Job Free” UI/job flag; no JobPlan seed | PKR/USD not represented; price implicitly zero | No duration/features contract | First draft per Employer account | Activate without plan/payment; pending approval | Incorrect for proposed beta |

The seed inserts defaults **only when the collection is empty**, so source changes do not reconcile existing production documents (`server/src/seed/jobPlans.js:27-32`). The exact production plan documents are therefore unknown from this audit.

The first free job is:

- employer-account lifetime in intended backend logic;
- consumed at first draft creation;
- not company lifetime;
- non-resetting;
- backend-enforced for setting `planType=free`, but vulnerable to concurrency and multiple-account bypass;
- impossible to declare consumed for the observed employer without production data.

## 12. Analytics contract

- `Job.views` increments on every successful public detail API request after the job is found (`server/src/controllers/jobsController.js:63-86`).
- It is not deduplicated by user/session/IP. Reloads count; anonymous, employer/self, and likely bot requests count unless blocked upstream. No bot filter exists in this path.
- The response returns the incremented value optimistically; the update is not awaited for a returned updated document.
- Internal application source of truth for employer analytics is live `Application.countDocuments({jobId})`.
- External jobs return `applications=null`, `applicationsTracked=false`; UI displays “Not tracked.”
- Per-job conversion is internal applications/views × 100 to two decimals when views > 0; otherwise response says `n/a`. Dashboard helper returns null for zero views.
- No employer-job outbound application click tracking was found, so clicks must not be represented as completed applications.
- Analytics ownership is enforced by `{_id, employerId}`.
- Closed/expired records retain stored views and applications because no deletion is performed; there is no canonical expired state.

## 13. SEO slug contract

- Backend owns employer job slug creation in `createJob`; the form has no slug input/preview.
- `jobSlug(title, location)` lowercases, normalizes Unicode with NFKD, removes combining marks, keeps alphanumeric/hyphen, and uses fallback `job`. It joins title and location (`server/src/utils/slugify.js:1-18`).
- Collision check is application-level; duplicate gets `-${Date.now()}`. This is race-prone. A slug+locale unique index is applied, but save can still fail under concurrency.
- Employer company name is not included; supplied location is.
- Locale fields/indexes exist, but employer creation does not explicitly set locale. Locale query helpers resolve localized slugs.
- Title/location edits do not regenerate the slug, so published and draft slugs remain stable accidentally.
- No employer slug editing exists, which is safer than exposing arbitrary slugs.
- No job slug-history/redirect model or permanent redirect workflow was found.
- Canonical job pages use `/jobs/:slug` through page routing/SEO components, but legacy-slug preservation is absent.
- Expired/archived URL behavior is undefined because expiry/archival is undefined.

**Recommendation:** retain server-generated slugs and show a read-only URL preview. Do not allow free editing. Freeze the slug at first publication. If an authorized exceptional change is required, reserve the old slug in a redirect table and issue a permanent redirect to the new canonical URL. Use a deterministic short suffix/ID and database uniqueness retry rather than timestamps. Do not include editable company identity unless the slug-freeze/redirect contract exists.

## 14. Required UI rule and quota states

Each block must show cause, next eligibility/action, and support.

| State | Required message/action |
|---|---|
| Free quota available | “1 free submission available”; submit for review; show 30-day visibility |
| Daily exhausted | “Used in the last 24 hours”; exact next timestamp; continue editing drafts |
| Active limit reached | “5/5 free jobs active”; close an obsolete job or wait for expiry; closing does not restore daily/monthly quota |
| Rolling limit reached | “10 submissions in the last 30 days”; exact earliest release timestamp |
| Not verified | Explain verification requirement and link to verification/profile |
| Pending approval | Submission time, non-public state, expected review window |
| Rejected | Reason, editable revision/appeal path, whether resubmission uses quota |
| Payment unavailable | Paid publishing is not available; no actionable payment button |
| Paid coming later | Disabled, honest copy; Free Beta path remains primary |
| Expiring soon | Exact expiry, close/renew policy, retained applications |
| Expired | Not accepting applications; renewal/repost eligibility |
| Reapproval required | Identify changed fields and whether old version remains live |

The current UI has draft/active/closed filters and approval badges, but lacks quota, reset, active/monthly limits, verification block, expiry, billing, and actionable rejection/reapproval explanations. It also links draft/pending jobs to a public URL that returns 404, which is confusing.

## 15. Security and abuse controls

| Control | Current result |
|---|---|
| General rate limiting | Global API IP limiter; employer auth limiter. No publication-specific account/organization limiter |
| Duplicate listings | No employer duplicate-content detection; slug collision only |
| Employer identity/domain verification | Fields/status exist; registration and publication do not verify domain/organization |
| Application URL safety | No allow/deny, redirect, reputation, ownership, phishing, or malware check found |
| Email-domain validation | No company-domain match enforcement found |
| HTML sanitization | Employer description is stripped to text; global Mongo sanitization and Helmet exist |
| Prohibited keywords/content moderation | None found in employer publication path |
| Moderation audit trail | Generic AuditLog for some individual/bulk actions; no immutable per-submission moderation history/revision |
| Admin override | Staff can approve/reject/update; override policy/reason is not fully structured |
| Suspicious-account restrictions | Employer has `accountStatus`, but auth/publication enforcement of suspension needs an explicit verified contract; no risk score |
| Multi-account quota bypass | Uncontrolled; no organization identity |
| Payment fraud | Stripe payment only; no risk/trust/chargeback policy |
| Webhook replay | Signature verification exists; event-level idempotency missing |
| Plan tampering | Server loads plan and price, which is good; plan/currency/version snapshots and webhook revalidation are incomplete |
| Direct API quota bypass | Total bypass because no quota exists |

All quota and trust enforcement must be server-side. Frontend states are explanatory only.

## Decision table

| Decision | Current behavior | Proposed behavior | Recommendation | Risk |
|---|---|---|---|---|
| Free submission limit | First draft only, lifetime/account | 1 successful submission/day | Rolling 24h, ledger + atomic organization enforcement | High |
| Free listing duration | Unbounded | 30 days | 30 days, earlier deadline where applicable | High |
| Active-job limit | None | 5 | Transactional active entitlement slots | High |
| Rolling monthly limit | None | 10/rolling 30d | Ledger query/counter, do not derive from job status | High |
| Employer verification | Display-only | Required | Verified organization, not boolean-only account | Critical |
| Free admin approval | Active+pending until approval | Every free listing | Explicit submitted/review state and history | High |
| Paid admin approval | Paid also pending today | Conditional | Universal review until trust model ready | Critical |
| Trusted employer auto-publication | None | Model B | Automated prechecks then auto-publish only low-risk trusted orgs | Critical |
| Plan page | API catalog only | `/employer/plans` usage page | Build functional page before sidebar link | Medium |
| Payment-button behavior | Enabled; returns unconfigured error | Paid unavailable | Hide action; optional disabled “Coming later” cards | High |
| Slug editing | No UI | Read-only preview | Server generated, frozen, redirect on exceptional change | Medium |
| Major-edit reapproval | Every active approved edit mutates to pending | Major edits only | Revision-based reapproval; approved version stays live when safe | High |

## 16. Recommended implementation slices

No slice should proceed to production if its stop conditions fail.

### E.1F-H1 — Publishing policy and domain contracts

- **Goal:** approve versioned policy, organization identity, state machine, quota definitions, consumption/refund rules, moderation/revision and expiry contracts.
- **Allowed files:** new domain docs/ADRs; shared policy constants/types; model design/migration files only after approval.
- **Model/API:** organization/membership, publication submission/entitlement, moderation event/revision; explicit public state projection.
- **Tests:** state-transition matrix and policy invariants.
- **Migration:** map existing status/approval/payment combinations; quarantine ambiguous rows.
- **Risks:** incompatible legacy states and accidental publication.
- **Stop:** no signed decision on rolling window, rejection resubmission, reopen/renew, organization merging, or legacy mapping.

### E.1F-H2 — Free quota enforcement

- **Goal:** atomic 1/24h, 5 active, 10/rolling-30d enforcement with unlimited drafts.
- **Allowed files:** new quota models/service/migration; employer submit controller/routes; indexes; tests.
- **Model/API:** idempotency key, usage/read endpoint, exact next-eligible timestamps.
- **Tests:** concurrent tabs/accounts, retries, transaction rollback, validation/server failures, close/reject/expire semantics.
- **Migration:** initialize ledger from defensible historical publications; do not infer ambiguous drafts as consumption.
- **Risks:** race/bypass, timezone bugs, double consumption.
- **Stop:** database transactions/indexes unavailable or organization identity unresolved.

### E.1F-H3 — Admin moderation workflow

- **Goal:** per-submission review history, reasons, revisions, notifications, SLA telemetry.
- **Allowed files:** moderation models/services/routes/admin UI/automation/templates/tests.
- **Model/API:** approve/reject/request changes, reason codes/text, actor/time, revision diff.
- **Tests:** RBAC, stale revisions, bulk/individual notification parity, audit immutability.
- **Migration:** attach current pending jobs to review records where possible.
- **Risks:** approving wrong revision; PII in reasons.
- **Stop:** public read cannot pin an approved revision.

### E.1F-H4 — Employer Plans & Usage

- **Goal:** functional `/employer/plans` with canonical usage truth.
- **Allowed files:** employer usage API/service, new page/route/nav/i18n, tests.
- **Model/API:** current policy, counters, reset timestamps, expirations, billing readiness.
- **Tests:** all blocked/empty/loading/error states and ownership.
- **Migration:** none beyond H2.
- **Risks:** stale counters/misleading eligibility.
- **Stop:** counters are frontend-derived or route would be a placeholder.

### E.1F-H5 — Posting rules and guidance

- **Goal:** versioned Employer Posting Rules, acknowledgement, dashboard/form/admin/rejection guidance.
- **Allowed files:** policy docs/CMS, employer/admin UI, submission acknowledgement fields, templates/tests.
- **Model/API:** accepted policy version/time/actor.
- **Tests:** required acknowledgement, localization, accessibility, stored version.
- **Migration:** existing accounts acknowledge on next submission.
- **Risks:** generic copy treated as legal advice; untranslated divergence.
- **Stop:** rules lack policy/legal owner or support/escalation route.

### E.1F-H6 — Free-beta publishing UX

- **Goal:** one clear draft→submit→review→active journey; paid actions disabled/hidden.
- **Allowed files:** employer job form/list/dashboard/status components/i18n/API client/tests.
- **Model/API:** submit endpoint separate from draft create/activate.
- **Tests:** every state in section 14, double-click idempotency, accessibility.
- **Migration:** feature-flag legacy activate endpoint and remove bypass.
- **Risks:** UI/backend mismatch.
- **Stop:** old direct activate endpoint can bypass policy.

### E.1F-H7 — Slug stability and URL preview

- **Goal:** safe server slug, read-only preview, publication freeze, redirects/archive SEO.
- **Allowed files:** slug service/models/routes, employer preview UI, SEO/sitemap/tests.
- **Model/API:** slug reservation/history/redirect; canonical/archive state.
- **Tests:** collisions, Unicode/locales, concurrent creation, edits, redirects, expired pages.
- **Migration:** reserve current published slugs; detect duplicates.
- **Risks:** broken indexed URLs and redirect loops.
- **Stop:** duplicate/ambiguous legacy slug inventory is unresolved.

### E.1F-H8 — Paid billing readiness

- **Goal:** production-grade payments without launching auto-publication.
- **Allowed files:** payment models/service/controllers/webhooks/admin/employer billing/tests/config docs.
- **Model/API:** currency/price snapshot, checkout idempotency, event ledger, refunds/disputes/receipts.
- **Tests:** official Stripe test events, replay, mismatch, failure/refund/dispute, renewal.
- **Migration:** classify/close orphan pending payments.
- **Risks:** financial loss, fraud, accidental activation.
- **Stop:** secrets/webhook endpoint/monitoring/support/refund policy or amount-currency checks are absent.

### E.1F-H9 — Trusted-employer paid auto-publication

- **Goal:** Model B only after measurable trust and automated safety gates.
- **Allowed files:** organization trust/risk/moderation services, audit/admin UI, tests.
- **Model/API:** trust criteria/version, risk decision/reasons, revocation, manual override.
- **Tests:** every fail-closed condition, account compromise, flagged URL/content, trust revocation.
- **Migration:** nobody becomes trusted solely from existing payment/verified boolean.
- **Risks:** harmful listing publication.
- **Stop:** moderation dependency outage does not fail closed, or false-negative monitoring/kill switch is absent.

### E.1F-H10 — Final production acceptance

- **Goal:** prove policy, security, operations, copy, analytics and SEO end to end.
- **Allowed files:** acceptance tests/runbooks/docs and only fixes explicitly authorized by failed gates.
- **Model/API:** no new scope.
- **Tests:** concurrency/load, RBAC, abuse, expiry, notifications, payment sandbox, analytics truth, SEO crawl, rollback.
- **Migration:** rehearsed backup, dry run, reconciliation and rollback.
- **Risks:** legacy bypass and operational gaps.
- **Stop:** any critical/high finding remains, paid buttons are actionable without readiness, or production evidence differs from contract.

## Acceptance criteria before implementation-ready status

The phase may be called ready for policy implementation only after H1 decisions are approved and the implementation plan has:

- an immutable verified organization identity;
- a transactional/idempotent submission ledger design;
- an explicit state/revision model and legacy migration;
- defined expiry/archive/renewal behavior;
- a fail-closed moderation policy;
- disabled paid publication UX;
- named owners for moderation, support, policy, security, and payment operations;
- complete test matrices for concurrency, authorization, state transitions, quota boundaries, and failure rollback.

## Decision status after Phases E.1F-H1 and E.1F-H1A

The historical findings and `NOT READY` audit verdict above remain accurate descriptions of the audited runtime. Phase E.1F-H1 approved a documentation-only target contract in `docs/FREE_BETA_PUBLISHING_POLICY_CONTRACT.md`; H1A clarified active-capacity timing, reviewer-correction charging, verification, and quota-guard identity without changing runtime behavior.

### Approved for beta

- Unlimited private drafts with no quota consumption.
- One quota-charged accepted free submission per rolling 24 hours, 10 charged submissions per rolling 30 days, 5 simultaneously active free jobs, and 30-day visibility.
- Quota consumption only on an atomic transition to `pending_review`; one narrowly qualified reviewer-requested correction may be exempt per moderation cycle; idempotent retries and no restoration after rejection, closure, or expiry.
- Submission does not reserve or require an active slot. Capacity is enforced at approval; an active major-edit submission releases its existing slot transactionally.
- `employerId` as the initial quota owner, with a replaceable owner-resolution boundary and manual same-company/domain abuse mitigation.
- Verification before submission; every free/first job and any beta paid job requires approval.
- Canonical `draft`, `pending_review`, `active`, `rejected`, `closed`, and `expired` lifecycle.
- Scheduled idempotent expiry, archived URLs, retained applications/analytics, and new submission events for renewal/repost.
- Reapproval for major edits, server-owned/frozen slugs, read-only URL preview, and reserved old-slug redirects.
- `/employer/plans` as the future Plans & Usage experience, with `/employer/plans/usage` as its proposed usage API.

### Deferred

- Paid publishing, Stripe configuration, and all paid auto-publication.
- A trusted-employer fast path.
- Keeping the last approved revision public while major edits are reviewed.

### Rejected

- Payment as proof of trust.
- Frontend-only quota enforcement.
- Using `active` for a pending-review job.
- Employer-editable slugs.
- Leaving actionable Pay & Publish controls during Free Beta.

### Requires later architecture

- Canonical organization membership and migration from employer-owned to organization-owned quotas.
- Revision/version storage for uninterrupted publication during reapproval.
- Production billing, refunds/disputes/invoices, payment-event idempotency, and trust/risk automation.

## Final verdict

**NOT READY**
