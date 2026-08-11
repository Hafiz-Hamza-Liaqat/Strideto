# Strideto Phase 5 — Agent / Agency Final Portal

> **Status:** FROZEN (Modification Phase 5)  
> **Baseline after Phase 4 freeze:** `a8fce2d`  
> **Authority:** [STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md](STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md)  
> **Phase 0–4:** FROZEN  
> **This freeze owns:** Agent / Agency professional-services portal  
> **Later phases** may integrate Institution, Public, and Commerce through these contracts. They may not redesign the Agent portal.

Runtime accepted at `https://localhost:8443` (Docker `edurozgaar-staging` + SEC-3F Caddy, worker **stopped**).

Phases 0–4 were not redesigned. Student/Admin/Employer/Institution/Public Job Detail, navbar labels, sitemap, License, live Stripe, live email, registry scraping, and AI/n8n fetch are out of scope. Phase 1 Agent session/refresh was not reimplemented; reload was re-verified.

---

## Final Agent navigation

Single sidebar (`client/src/config/agentNavConfig.js`). Team is shown only when `agentType === 'agency'`. No dead entries.

| Label | Route | Source |
|---|---|---|
| Dashboard | `/agent` | `GET /api/agent/dashboard` |
| Profile | `/agent/profile` | `GET/PATCH /api/agent/profile` |
| Verification | `/agent/verification` | `GET /api/agent/verification` + org verification submit |
| Services | `/agent/services` | Mission 11 services |
| Marketplace | `/agent/marketplace` | Mission 12 |
| Availability | `/agent/availability` | Mission 13 |
| Leads | `/agent/leads` | Mission 11/12 interest |
| Clients | `/agent/clients` | Derived relationships |
| Consultations | `/agent/consultations` | Mission 13 |
| Cases | `/agent/cases` | Mission 14 |
| Messages | `/agent/messages` | Contextual hub only |
| Trust / Reviews | `/agent/trust` | Mission 15 |
| Team | `/agent/team` | Agency only; Mission 11 roles |
| Notifications | `/agent/notifications` | Phase 1 inbox `recipientType=agent` |
| Usage & Billing | `/agent/usage-billing` | Configured policy only |
| Commerce / Payouts | `/agent/commerce` | Mission 17 readiness (no live Stripe) |
| Settings | `/agent/settings` | Phase 1 security |
| Help / Guidelines | `/agent/guidelines` | Everyday use (Help aliases `/agent/help`) |

Public auth: `/agent/login`, `/agent/register`, `/agent/accept-invitation`.

---

## Professional vs agency

Canonical `agentType`: `agent` (individual professional) vs `agency` (organization). Shared fields: display name, country, contact, services, verification, availability. Agency adds legal entity name, registration authority/number, registered address, team. Individual adds professional name/regulator/license where jurisdiction policy is `required`. Credential policy remains `required | optional | not_applicable`. Company registration is not forced where not applicable.

---

## Theme / branding

Phase 1 semantic tokens. Strideto `Logo` on login, register, onboarding, accept-invitation, and portal chrome. Light and dark: inputs use `bg-white dark:bg-gray-900` + `text-gray-900 dark:text-gray-100` + visible placeholders. Runtime: logo present, `html.dark` true in the acceptance browser, no light-on-light login fields, no invalid-token after reload.

---

## Dashboard metric sources

Every card is sourced. Empty shows `0` / `not_configured`, never a blank card.

| Card | Source | Runtime (disposable professional) |
|---|---|---|
| Verification | OrganizationVerification.status | approved |
| Profile completeness | AgentProfile.completenessScore | 25% |
| Active services | AgentService count `status=active` | 1 |
| Marketplace published | marketplaceCounts | 0 |
| Leads | AgentLead count | 1 after consultation |
| Upcoming consultations | Consultation aggregate `confirmed` | 0 (1 requested) |
| Active cases | ProfessionalCase lifecycle | 0 |
| Student approvals | CaseApprovalRequest pending | 0 |
| Unread messages | ConsultationMessage unread | 0 after send |
| Unread notifications | UserNotification agent unread | 0 after mark-all |
| KYC / payout | MarketplaceProviderAccount + stripe config | not_configured |
| Usage & billing | GET `/api/agent/usage-billing` | not_configured |

Deep links go to the owning page.

---

## Profile

Professional/agency display name, legal name (org), account type, category, country, city, address, languages, biography, official email/phone/website, specialties. Save survives refresh and logout/login (Unicode `پروفیشنل` persisted). Legacy Agent documents remain compatible.

---

## Verification dossier

Identity, business/registration, professional credential, agency representative, supporting Maps/Business URLs, official registry/regulator/accreditation URLs. Numbers alone are not proof. Maps/Business is **supporting only** and can never alone produce VERIFIED (`mapsCannotAloneVerify`, `GOOGLE_MAPS` excluded from badge map). No live registry fetch. Evidence provenance stores type, source URL, claimed authority, timestamps, reviewer history.

Configurable catalog: `shared/agent/verificationSources.js` (PK SECP/FBR illustrative URLs). Unconfigured sources: **Manual verification required**.

States unchanged: draft → email_verified → verification_pending → under_review → needs_information → enhanced_review → approved/rejected/suspended/revoked/expired.

Agent may build, submit, view state, answer needs-information, resubmit, view applicant-facing outcome. Agent may **not** approve, set status/reviewer/verifiedAt, or create badges. AI cannot approve.

Authenticated session can mark `email_verified` (account-session proof, not professional verification) so local submit is not blocked by SMTP.

Runtime (disposable): submit 200 → Admin queue items=1 evidence=6 → begin-review → needs_information → Agent inbox category=verification unread=1 → respond 200 pending → approve 200 → Agent `approved`. Self-approve with Agent token 401. No invalid-token page.

---

## Services / marketplace / leads / clients

Draft services before approval; activation requires approved verification. Integer minor-unit prices. Guarantee phrases 422. Marketplace preserves Agent statement vs official fact vs Strideto information. Student interest remains Mission 12 (no private Student leak, no Vault grant). Leads/clients are organization-scoped. **Client relationship ≠ Vault access.**

Runtime: draft service 201, guarantee 422, marketplace draft 201, submit after approve `pending`, leads=1 and clients=1 after consultation, vault grants listing returns no storage keys.

---

## Availability / consultations / cases / messages / Vault

IANA timezone required; offset `+05:00` 422; no silent Asia/Karachi default. DST follows the named zone. Double booking rejected (Mission 13). Windows use `weekday` + `startLocal`/`endLocal`.

Consultations: Agent list/detail, Student-safe identity, payment `free|payment_required|…` provider-authoritative. Missing `meetingMode` is **422** (not 500). Contextual messages only.

Cases: Student approval gates, private vs shared notes, transfer does not copy Vault grants (`vaultGrantsTransferred:false`).

Vault: exact active grant only. List endpoint projects grant id, purpose, expiry, revoked/expired flags.

Runtime: availability `Europe/London` 200; consultation booking 201 `payment=free`; Agent list 1; contextual message 201; unexpected 5xx after guard = 0.

---

## Trust / team / notifications

Mission 15 Trust page: verification state, badges, reviews, reports without reporter identity, disputes (professional ≠ financial). Agent cannot delete negative reviews.

Team reuses Mission 11 `owner | admin | member`. Invites hashed, 7-day TTL, invitable roles admin/member. Duplicate 409. Last owner cannot be deactivated. Cross-agency denied.

Notifications: `UserNotification.recipientType=agent` + `agentAccountId`. Verification, marketplace interest, consultation, case, message, trust, commerce categories. Inbox `/api/inbox/notifications` with requireAuth (employer-first then agent). No real email. Runtime: needs-info + approve produced 2 Agent notifications; mark-all unread=0. Institution inbox still denied.

---

## Usage & Billing / Commerce / KYC / payouts

`GET /api/agent/usage-billing`: configured policy only; **Commission not configured** (no invented percentage); no wallet/escrow; org-scoped orders/transactions/refunds.

`GET /api/agent/commerce/readiness`: stored Connect/KYC/charges/transfers/payout state; `liveStripeCalled:false`; secrets never returned. Onboarding remains explicit POST and fails closed when `not_configured`. Agent cannot mark paid/refunded/payout paid.

Runtime: provider `not_configured`, KYC not started, charges/transfers inactive, Payment ready: No.

---

## Settings / guidelines

Phase 1 password, logout, logout-all, HttpOnly refresh (no raw token display). Guidelines cover profile vs verification, evidence, Maps limitation, publishing, Vault, payments, disputes, privacy.

---

## Search / isolation

Bounded `q` (80 chars, regex-escaped) on services, marketplace, leads, clients, consultations, cases, team. Pagination already bounded (max 50). Cross-org verification skipped/denied; foreign agency cases returned 0; User/Employer still rejected by `requireAgentAuth`.

---

## Responsive / accessibility

Browser acceptance: 320, 375, 768, 1024 (deviceScaleFactor 2 ≈ 200% zoom), 1440. No severe overflow. Mobile overlay nav + desktop sidebar. Labels, alerts, 44px targets, visible focus ring on themed inputs. Not a WCAG certification claim.

---

## Executable evidence

| Pack | Result |
|---|---|
| `phase5AgentPortal.test.js` | **114** checks passed |
| Mission 11 agentAgencyPortal | 30/30 |
| Mission 12 marketplace | 30/30 (vault listing distinguished from marketplace grant creation) |
| Mission 13 consultations | 38/38 |
| Mission 14 cases | 55 |
| Mission 15 trust | 42 |
| Mission 17 marketplace payments | 54 |
| Mission 10 Vault | 32 |
| Mission 2 org verification | 17 |
| Phase 1 foundation | 53 |
| Phase 2 Admin | 100 |
| Phase 4 Employer | not re-run (untouched after freeze) |
| employerNotificationApiIsolation | 19 |
| skillTrustHttpInboxContracts | 10/10 (Agent still 403 without `agentAccountId`) |
| internationalFoundation | 13 |
| agentSecureAuthFlows | 3 |
| Module-link integrity | ok (1595 modules) |
| Focused lint | 0 errors (3 non-blocking warnings) |
| Frontend `vite build` | passed |

---

## Real Docker evidence

- Rebuild: `api-a`, `api-b`, `frontend` via compose yml + staging + sec3f-local + appenv-align; `--no-deps`; no `down -v`.
- Worker: **stopped** (not in `docker ps`).
- `GET /api/health` 200, `/agent/login` 200.
- Browser: login → Dashboard sourced cards → reload still Dashboard (not invalid token) → Verification approved + Maps/registry copy → Usage & Billing commission not configured → Guidelines → Commerce not_configured / Payment ready No.
- API journey: register professional + agency, profile persist, dossier submit, Admin queue, needs-information notification, resubmit, approve, services, marketplace, availability, Student consultation + message, leads/clients, team invite 201 / duplicate 409, logout 401, relogin persist.
- Unexpected 5xx after meetingMode guard: **0**. Missing meetingMode → 422.

---

## Future-phase dependencies (explicitly deferred)

- Institution final portal (Phase 6)
- Public portal / Job Detail / navbar / sitemap / License
- Live Stripe, live email/SMS/push, worker start
- Automatic official-registry fetch / Google Maps scrape
- AI / n8n opportunity fetch
- Formal WCAG certification
- Homemade wallet/escrow or invented commission

---

## Freeze gate

All Agent routes operational; session reload works; existing invalid-token failure closed; Strideto branding; sourced dashboard; professional vs agency truthful; dossier sufficient for human review; Maps not authoritative; Admin queue integration; notifications; persistence; services/marketplace/leads/availability/consultations/cases/messages/Vault/trust/team; Usage & Billing; Commerce/KYC truthful; no fake payment; guidelines; responsive; zero unresolved BLOCKER/P0/P1; zero unresolved Agent auth/privacy/trust/financial MAJOR.

**Phase 5 status: FROZEN.**
