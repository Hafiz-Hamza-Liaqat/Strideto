# Strideto Mission 21 — Admin Super-Control Center

## Outcome

Mission 21 consolidates existing Admin and domain operations into a permission-aware control center. It adds read models and operational queues; it does not replace verification, institution, education, marketplace, trust, commerce, audit, or Copilot domain authority.

## Admin foundation

- Existing `requireAuth`, staff-role middleware, RBAC, Admin router, shell, data tables, filters, confirmation dialog, and audit service are reused.
- Moderator receives bounded inspection permissions. Admin receives operational management permissions. SuperAdmin alone receives privileged-support access and existing super-only permissions.
- Server authorization is authoritative and deny-by-default. Actor identity always comes from the authenticated request principal, never request data.
- The Admin shell adds overview, organizations, trust, commerce, data quality, AI operations, and system-readiness pages with loading, empty, error, filtering, pagination, and permission-aware actions.

## Operational surfaces

- Overview: bounded persisted counts for users, organizations, verification, reports/disputes, consultations/cases, refunds/reconciliation, institution claims, marketplace moderation, freshness/source health, AI provider state, and five safe recent audit entries. No invented trends, revenue, or success metrics.
- Users: the existing bounded Admin user surface remains authoritative and excludes authentication secrets and private domain content.
- Organizations: safe identity/status listing, bounded search with escaped literal matching, safe sorting, detail, verification summary, and explainable risk context. No broad mutation or impersonation is added.
- Verification and institution operations: existing Mission 2 verification and Mission 18 claim routers remain mounted and authoritative.
- Education/data quality: canonical education operations remain in existing routes; the new center reports freshness, stale/broken sources, conflicts, and provenance without mutating freshness on read.
- Agent/marketplace: existing marketplace moderation is reused; no Student lead/profile browser is introduced.
- Trust: bounded review, report, and dispute queues protect reporter/Student identity. Report/dispute changes require Admin authority, a reason, and audit; Moderators retain triage visibility only.
- Consultations/cases: default projections contain lifecycle and operational metadata only. Messages, meeting links, Student notes, Agent notes, full profiles, and Vault data are excluded.
- Privileged support: SuperAdmin permission, supported case/report context, purpose, reason, actor, timestamp, and audit are required. Even this endpoint returns only safe contextual metadata.
- Commerce: reconciliation, refunds, and connected-account readiness use safe read projections. Ledger editing, balance setting, paid/refunded/payout fabrication, provider secrets, bank data, and raw KYC are unavailable. Manual reconciliation review is reasoned and audited.
- AI/Budget: only in-process Copilot provider state is shown, with no provider call. Copilot conversations and Student CostPlans remain private.
- Audit/risk: the existing bounded, read-only audit explorer remains authoritative; overview audit metadata is allowlisted. Risk signals are deterministic and explainable, with no opaque AI or protected-characteristic inference.
- System/international readiness: safe backlog and provider-state summaries are exposed without environment values or secrets. Country/rollout policy remains in the shared international configuration boundary and domain-owned tables; the Admin endpoint does not claim production readiness from flags alone.
- Notifications: operational visibility is passive; no notification delivery, worker, scraper, payment, verification, or provider action is triggered.

## Privacy and security model

Centralized visibility does not grant unrestricted private-data access. All lists are paginated with hard limits and explicit filters/projections. Sensitive evidence remains purpose-bound. The control center exposes no password hashes, tokens, raw webhook bodies, Stripe/provider secrets, PAN/CVV, Vault contents, private messages, private notes, Copilot conversations, or Student budget plans. No impersonation or destructive bulk operation exists.

## Verification

- Mission 21 server files and the comprehensive test source pass Node syntax validation.
- The focused Mission 21 Jest suite could not execute because Jest is not installed or cached in the repository; no dependency was downloaded under the mission's no-network rule.
- Frontend production build passed: Vite transformed 1,138 modules and completed successfully. Existing chunk-size and dynamic/static import warnings remain non-blocking.
- No prior-domain regression suite was required because Mission 21 consumes existing domain contracts rather than changing them.

## Live-action statement

No live database mutation, migration, seed, backfill, worker, notification, provider call, verification decision, moderation action, suspension, refund, payment, payout, push, or deployment was performed.
