# Strideto Phase 6 — Institution Final Portal

> **Status:** FROZEN  
> **Baseline after Phase 5 freeze:** `c1ac88d`  
> **Authority:** [STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md](STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md)  
> **Phase 0–5:** FROZEN (not redesigned)  
> **This phase owns:** FINAL Institution official-data portal  
> **Later phases** may integrate through accepted Institution contracts. They may not redesign the Institution portal.

Runtime at `https://localhost:8443` (Docker `edurozgaar-staging` + SEC-3F Caddy + local `appenv-align`). Worker **stopped**. Local rebuild of **frontend, api-a, api-b only** from HEAD; Mongo/Redis/media volumes preserved (`edurozgaar-staging_mongodb_data`, `_redis_data`, `_media_uploads`). No `down -v`, no volume prune, no reseed, no push, no deploy.

---

## Final Institution navigation

Single sidebar (`client/src/config/institutionNavConfig.js`). No dead entries. Onboarding redirects to Verification. Help redirects to Guidelines.

| Label | Route | Source |
|---|---|---|
| Dashboard | `/institution` | `GET /api/institution/:orgId/dashboard` |
| Organization Profile | `/institution/profile` | `GET/PATCH /api/institution/:orgId/profile` |
| Verification | `/institution/verification` | Mission 2 org verification (`/api/organizations/:orgId/verification*`) |
| Canonical Claim | `/institution/claim` | `GET/POST /api/institution/:orgId/claim` |
| Programs | `/institution/programs` | Mission 18 Program ownership |
| Intakes / Admissions | `/institution/intakes` | Program `intakes[]` date-only facts |
| Admission Applications | `/institution/applications` | Internal inbox |
| Test Acceptance | `/institution/test-acceptance` | Mission 6 institution/program scope |
| Scholarships & Funding | `/institution/scholarships` | Institution-owned CanonicalScholarship |
| Data Quality | `/institution/data-quality` | Conflicts + freshness reconfirm |
| Team | `/institution/team` | Membership + hashed invites |
| Notifications | `/institution/notifications` | Phase 1 inbox `recipientType=institution` |
| Analytics / Usage | `/institution/usage` | Dashboard metrics (tracked only) |
| Billing | `/institution/billing` | Launch Free / `not_configured` |
| Settings / Security | `/institution/settings` | Password, logout-all, links |
| Help / Guidelines | `/institution/guidelines` | Everyday use (`/institution/help` aliases) |

Public auth: `/institution/login`, `/institution/register`, `/institution/accept-invitation`.  
Student internal apply: `/apply/institution/:programId`, `/applications/institution`.

---

## Theme / branding

Phase 1 tokens: `bg-bg-main`, `dark:bg-secondary`, `Logo`, `fieldClass` (readable placeholders, visible focus), high-contrast badges, 44px targets. Light and dark. Portal chrome uses `portalIdentityLabel`: **Institution Portal** until organization verification is `approved`, then **Verified Institution**. Never “Verified Institution Portal” before approval.

---

## Profile

Official/legal name, display name, type, country, region, city, registered address, website, domain, email, phone, logo URL, public description, representative name/title/email. Save persists through `InstitutionProfile` (legacy records compatible). Completeness is not verification.

---

## Verification dossier (≠ canonical claim)

Identity, registration/accreditation, credential policy (`required | optional | not_applicable`), representative + identity/authority evidence URLs, campus evidence, Maps/Business supporting URLs, official registry/accreditation/government URLs, issue/expiry dates. Maps cannot alone verify. No live scraping. Institution cannot self-approve, set status, verifiedBy, or verifiedAt. Submit/resubmit integrates Phase 2 Admin queue. Admin outcomes fan out to Institution inbox (in-app only).

---

## Canonical claim

Answers which canonical Institution record this verified organization represents. Independent of organization verification. Candidate: existing canonical id or proposed official name/country/domain + representative authority evidence. Competing submitted/approved claims surface for manual review. Approval requires approved organization verification. Competing approved claim → 409. No silent canonical overwrite.

---

## Representative authority / team

Roles map to existing vocabulary: Owner, Admin, Admissions/Program Manager (`editor`), Viewer. Invites: hashed token, 7-day TTL, duplicate 409, email mismatch 403, expiry, revoke, last-owner protection, cross-Institution denial. Email delivery `not_configured`. Membership never grants Student/Vault/Copilot/Budget/Agent access. Representative authority for verification/claim remains explicit.

---

## Programs / intakes / admissions

Approved verification + approved claim required to author Programs. Ownership enforced. Tuition is integer minor units. Published high-impact edits store conflicts instead of overwrite. Intakes: date-only YYYY-MM-DD, no timezone invention. Application modes: `internal` | `external` | `both` | `not_configured`. External labelled as happening on the Institution website; Strideto does not invent application state. Internal requires explicit Student consent to a purpose-scoped snapshot.

Institution owns authoritative states: received → under_review / needs_information / shortlisted / interview / offer / admitted / rejected; Student may withdraw where policy permits and respond to needs_information. Student cannot self-admit. Foreign applications 404. Vault browse endpoints return `VAULT_DENIED` 403. Document access still requires an exact Vault grant (not part of the snapshot).

---

## Test Acceptance

Institution and Program (and program_intake) scope only. Country-wide policy 403. History via supersession. `adminNotes` stripped from Institution list.

---

## Scholarships

Verified + canonically claimed Institution may manage **its own** institutional scholarships. Guarantee wording blocked. External/government type 403. Criteria, nationality/residence scope, cycle/deadline (date-only), source/provenance, draft lifecycle. Listing an award does not make the Institution its third-party authority.

---

## Provenance / freshness / conflicts

Official facts use `institution_official`. Page view does not mark fresh. Explicit reconfirmation writes `InstitutionChangeEvent`. Conflicts show existing vs proposed, source types, and review state. Stronger/published high-impact facts are not silently overwritten.

---

## Notifications

Phase 1 `UserNotification` with `recipientType=institution` and `institutionAccountId`. Cover verification, claim, admissions, team, data-quality. Unread, inbox, read/unread, mark all, deep links. Dedupe keys. No reviewer-note leakage. No real email. Requests with only `institution.subjectId` (no `institutionAccountId`) still 403 (Phase 5 contract preserved).

---

## Analytics / usage / billing

Tracked: programs, internal application counts and status distribution, completeness, conflicts, stale/review_due, Test Acceptance, own scholarships, verification/claim state. External application traffic: **not_tracked**. Launch plan **Free**. Included: profile, verification submission, canonical Program management, official data maintenance. Future promotion/leads/advanced analytics/paid admission: **Not configured**. Provider `not_configured`. No live Stripe. No wallet.

---

## Settings / security / guidelines

Change password, logout-all, HttpOnly refresh (tokens never displayed). Links to team, verification, claim, billing, notifications. Guidelines cover account vs verification, claim, representative authority, Programs, Test Acceptance, intakes, internal vs external, Student privacy, Vault, scholarships, provenance, freshness, conflicts, roles, notifications, launch pricing, support.

---

## Search / isolation / HTTP

Bounded `q` (80 chars, regex-escaped) on programs, intakes, applications, Test Acceptance, scholarships, data quality, team. Pagination max 50. Cross-org membership denied. Wrong realm rejected by `requireInstitutionAuth`. Student admissions use user realm. 400/401/403/404/409/422/410 used as domain errors.

---

## Responsive / accessibility

Source: mobile overlay nav, desktop sidebar, 44px targets, labels, `role=alert`, visible focus, long-name wrap, light/dark. Not a WCAG certification. Viewport matrix **was** executed on the rebuilt Phase 6 image at 320/375/768/1024/1440 plus representative 200% zoom.

---

## Executable evidence

| Pack | Result |
|---|---|
| `phase6InstitutionPortal.test.js` | **167** checks passed (163 prior + claim URL sanitizer + data-quality wrap) |
| Mission 18 `institutionPortal.test.js` | 50/50 |
| `institutionSecureAuthFlows` | 2 |
| Phase 1 foundation | 53 |
| Phase 2 Admin | 100 |
| Phase 3 Student | 62 |
| Mission 2 org verification | 17 |
| Mission 4 Education Intelligence | 41 |
| Mission 5 freshness | 51 |
| Mission 6 Test Acceptance | 40 |
| Mission 7 Scholarships | 60 |
| Mission 22 internationalFoundation | 13 |
| Mission 23 security audit | 37 (includes institutionPortal) |
| employerNotificationApiIsolation | 20 |
| skillTrustHttpInboxContracts | 10/10 (`subjectId`-only Institution still 403) |
| Phase 5 Agent | 114 |
| client `portalRuntimeDefectClosure` | 5/5 |
| Module-link integrity | ok (1618 modules, 4995 relative imports) |
| Focused lint | 0 errors (3 non-blocking react-refresh warnings) |
| Frontend `vite build` | passed |

---

## Real Docker evidence (rebuilt runtime)

Rebuild: `docker compose --env-file .env.staging -p edurozgaar-staging -f docker-compose.yml -f docker-compose.staging.yml -f docker-compose.sec3f-local.yml -f docker-compose.appenv-align.yml build` then `up -d --no-deps --force-recreate` for **frontend, api-a, api-b only**. Mongo/Redis remained Up ~3h (not recreated). Media volume untouched. Worker absent.

| Check | Result |
|---|---|
| Worker | Absent / stopped |
| Frontend / api-a / api-b | Recreated; api-a/api-b healthy; frontend healthy |
| Mongo / Redis / media | Preserved |
| `POST /api/auth/institution/change-password` (unauth) | **401** (no longer 404) |
| `GET /api/student/institution-admissions` (unauth) | **401** (no longer 404) |
| `GET /api/institution/usage`, `/invites` (unauth) | 401 |
| Browser login | Strideto Logo; “Institution sign in”; not “Verified Institution Portal”; privacy boundary |
| Browser register | “Strideto Institution Account”; unverified-workspace copy; readable placeholders |
| Source/runtime aligned | Yes |

### Mutation journey (disposable local records)

| Gate | Result |
|---|---|
| Auth login → protected → refresh/reload → logout → denied → login | Pass |
| Logout-all then login | Pass |
| Profile save → reload → logout/login persistence | Pass (`city` marker) |
| Verification submit → Admin queue → begin review → needs_information → Institution inbox → resubmit → Admin approve | Pass |
| Self-approval with Institution token | 401/403 |
| Maps/Business | supporting-only; registryIntegration `none` |
| Claim start while unverified (independence) → submit → Admin queue → competing submit visible → approve A → approve B 409 | Pass |
| Team invite → duplicate 409 → accept editor → role update → last-owner 409 → cross-org 403 → Vault denied | Pass |
| Program create/edit/persist/ownership/requirements; foreign program denied | Pass. Tuition integer minor units persist on PATCH (UI create-then-update). |
| Intakes date-only YYYY-MM-DD; timezone string 422; internal + external persist | Pass |
| Student consent submit → Institution inbox snapshot → Institution `under_review` → Student notification; Student cannot self-admit; Vault/students/budget/copilot denied; foreign application 404 | Pass |
| External intake labelled “Application happens on the Institution’s official website”; usage `externalApplicationTraffic=not_tracked` | Pass |
| Test Acceptance institution + program; country 403; supersession history | Pass |
| Institution-owned scholarship; government type 403; guarantee wording 422; `institution_official` source | Pass |
| Data Quality: GET does not mutate freshness; published tuition PATCH stores conflict (no silent overwrite); stale/review_due counters; explicit reconfirm | Pass |
| Notifications: verification, claim, admissions, team; unread; read; mark-all; deep `/institution` links; no reviewer-reason leak. Dedicated data-quality inbox event not separately fanned out (conflict is on Data Quality page). No real email. | Pass / INFO |
| Usage tracked programs/applications/conflicts; billing plan Free; future Not configured; provider `not_configured`; no Stripe; no wallet | Pass |
| Settings change-password exists and rotates session; logout-all; no raw token/password echo | Pass |
| Guidelines | All required topics present; no dead links |
| Unexpected 5xx | **0** |

### Light / dark / responsive

| Gate | Result |
|---|---|
| Light | Login, register, dashboard, profile, verification, claim, Programs, applications — readable headings/fields/placeholders/buttons/badges/focus. Chrome is **Verified Institution** only after approval. |
| Dark | Dashboard, verification, Program editor, applications, settings — Logo, contrast, no old “Verified Institution Portal” branding. |
| 320 / 375 / 768 / 1024 / 1440 | High-risk nav pages: no severe page-level overflow after wrap fix. Mobile hamburger nav works at 320–768. Desktop sidebar at 1024+. Long names wrap / options truncated. |
| 200% zoom | Verification, Program editor, admissions inbox, Data Quality — headings/buttons reachable; no severe overflow. Not a WCAG certification. |

Runtime defect found and fixed before freeze: claim form sent evidence **URLs** into ObjectId `authorityEvidenceRefs` (CastError 500). Sanitized to `authorityEvidenceUrls` + ObjectIds. Data Quality conflict JSON / long Program names wrapped at 320.

---

## Remaining (not freeze blockers)

Public discovery, Admin visual redesign, Student portal redesign, Employer/Agent redesign, live Stripe, real email, registry scraping, and AI/n8n fetch remain later phases.

---

## Freeze gate

Institution Phase 6 is **FROZEN**. The running `https://localhost:8443` image matches Phase 6 source. The real-browser and HTTP mutation journey passed with **0** unexpected 5xx. Do not start Phase 7 until this freeze commit is on `main`.
