# Strideto Mission 23 — Platform Security & Abuse Audit

## Scope and method

This was a targeted, evidence-driven review of the accepted Missions 0–22 security boundaries at baseline `0973609`. The review covered authentication realms and sessions, RBAC, tenant/object ownership, mutation allowlists, query and content safety, private storage, professional-service workflows, trust and moderation, Admin, Commerce/Stripe, Copilot, Budget, browser security, logging/errors, development gates, and local dependency manifests. Searches preceded file inspection; no generic style review was performed.

No production system, live database, private Vault object, private message, provider, worker, network scanner, Stripe endpoint, AI provider, deployment, seed, or destructive operation was used.

## Attack-surface inventory

| Boundary | Authoritative implementation reviewed |
|---|---|
| Authentication/session | `middleware/auth.js`; realm JWT/session providers; trusted-origin and cookie policies; User, Employer, Agent, and Institution auth routes |
| Authorization/tenancy | `middleware/rbac.js`; organization membership services; ownership/scoped service queries; Admin permission map |
| Input/query/content | validators, Mongo sanitizer, bounded search/pagination, public serializers, React raw-HTML uses and sanitizer |
| Files/Vault | Vault routes/controller/service, upload filter, magic-byte checks, storage abstraction, exact grant policy |
| Web/platform | CORS, Helmet/CSP, rate limiters, error projection, request logger, route order and development gates |
| Professional services/trust | Agent Marketplace, consultations/messages, cases/approvals, reviews/reports/disputes |
| Payments | Commerce orders/transactions/ledger, marketplace provider boundary, raw Stripe webhooks, reconciliation/refunds/payout state |
| AI/privacy | Copilot retrieval/evidence/grounding/provider boundary and Student CostPlans |

## Findings

| ID | Severity | Evidence / exploit precondition / impact | Status and fix |
|---|---|---|---|
| M23-01 | P2 | `server/src/config/cors.js` enabled credentialed access from every HTTPS `*.vercel.app` origin by default in production. An attacker-controlled Vercel deployment could therefore receive CORS approval; cookie-origin enforcement limited some session abuse, but the origin trust was materially broader than configuration. | Fixed in `15d1771`: preview wildcard is denied unless `CORS_ALLOW_VERCEL_PREVIEWS=1`. Configured exact origins and non-browser calls remain supported. Regression covers default denial, explicit opt-in, and HTTPS-only matching. |
| M23-02 | P2 | Only the Vault download explicitly set private cache headers. Other authenticated JSON and auth/session responses could be cached by a misconfigured intermediary, risking disclosure to a later user of that cache. | Fixed in `15d1771`: centralized `private, no-store, no-cache, must-revalidate` headers apply to required/authorized bearer responses and all User auth/session routes. Vault's stronger existing download policy remains intact. |
| M23-03 | INFO | Local manifests/lockfiles provide no offline CVE database. No declared `hasInstallScript: true` or lockfile deprecation marker was found by the bounded offline search. | Deferred: online CVE, provenance, and registry verification belongs in the deployment/security pipeline. No packages were installed or upgraded. |
| M23-04 | INFO | Stripe/Connect activation, webhook secret rotation, supported jurisdictions/currencies, external AI-provider contractual controls, storage ACLs, proxy/TLS behavior, and alerting are infrastructure/provider facts not provable from source alone. | Deferred to controlled production acceptance. Source contracts fail closed and tests use synthetic/injected providers only. |

No verified P0, P1, or additional P3 finding remained. Severity was not inflated for unreachable or merely hypothetical patterns.

## Authentication, RBAC, and tenant isolation

- User, Employer, Agent, and Institution access/refresh audiences, cookies, principals, and authoritative account-state providers are distinct. Cross-realm tokens fail closed.
- Actor identity, roles, token version, session family, logout, logout-all, disabled/revoked state, and organization membership are server-derived. Caller `userId`, role, organization, verification, badge, audit actor, scanner, payment, destination, and fee values do not establish authority.
- Moderator/Admin/SuperAdmin permissions remain separated. Privileged support is SuperAdmin-only, context/reason/purpose bound, safely projected, and audited; it is not impersonation or universal private-data access.
- Employer, Agency, Institution, consultation, case, trust, Commerce, Budget, and Vault paths use authenticated owner/organization/participant scope. Guessed cross-tenant identifiers fail through scoped lookups or authoritative policy checks.

## Input, query, browser, and platform safety

- Mutation surfaces use bounded domain inputs or explicit assignments. Mongo sanitation rejects dollar/dotted operator injection; reviewed regex searches escape and bound input; sort and pagination use allowlists/hard maxima.
- User/model content is rendered as text or through the existing sanitizer. No Copilot raw-HTML rendering or unsafe eval authority was found. Guarantee-language policy remains enforced.
- Payment and onboarding return URLs are server-configured. No reachable general-purpose caller-controlled backend fetch was identified; fixed vendor endpoints and injected source-check boundaries do not form an arbitrary SSRF primitive.
- Bearer authorization is primary. Cookie-bearing sensitive auth mutations retain trusted-origin checks and SameSite/secure cookie policy. CORS now fails closed for unconfigured production origins. Helmet supplies CSP, nosniff, frame, referrer, and production HSTS policy.
- Global and specialized auth/upload/search/form/admin limits provide bounded abuse controls. Public lists reviewed have hard pagination limits. Logs use method/path/status/timing or allowlisted audit metadata rather than request bodies, credentials, webhook bodies, Vault content, messages, or Copilot context. Production errors suppress stack/internal 5xx details.
- Debug/test/seed helpers are not caller-enableable production mutation paths. No broad destructive bulk endpoint or normal API for rewriting immutable ledger/audit history was found.

## Vault and professional services

- Vault remains authenticated, Student-owned, private by default, size/type/magic-byte checked, filename/path guarded, scanner-authoritative, and backed by server-generated storage keys. Downloads enforce current owner/exact active grant, scan state, safe disposition, nosniff, and no-store behavior.
- Agent approval, consultation, case, Institution identity, or any relationship grants zero implicit Vault access. Expiry/revocation is checked on each access.
- Messaging requires exact contextual participants and thread/case scope; closed contexts are read-only and document references revalidate the current exact Vault grant. There is no universal Agent DM.
- Cases require Student consent/approval for activation, sensitive approvals, and transfer. Agents cannot approve Student requests; private Agent notes remain excluded from Student/Admin normal projections; closure preserves Student-owned data.
- Marketplace publication requires approved verification and staff moderation; tenant edits are scoped; guarantee claims and ungrounded provenance are blocked; interests require explicit Student consent and disclose no private Student profile.
- Review eligibility and `verifiedInteraction` are server-derived and duplicate guarded. Agents cannot delete reviews or self-moderate. Reporter identity and dispute participation remain private/scoped; professional disputes do not become provider chargebacks or automatic refunds.

## Commerce, payments, AI, and Student privacy

- Authoritative product snapshots determine integer Money, currency, destination, and platform fee. Orders, provider transactions, ledger entries, reconciliation, refunds, payouts, and disputes remain distinct. The ledger is append-only with compensating reversals.
- Both Stripe webhook routes receive raw bodies before JSON parsing. Signatures fail closed; provider event IDs and fingerprints enforce idempotency/conflict handling; amount/currency mismatches enter reconciliation. PaymentIntent creation/redirects do not mark paid. Admin/Agent/User APIs cannot directly set paid/refunded/payout outcomes.
- No PAN, CVV, bank account number, secret key, raw KYC document, webhook secret, or raw provider payload field was found in reviewed persistence/projections. A checkout client secret is scoped to its authenticated purchase flow and is not treated as a platform API secret.
- Copilot evidence is server-retrieved and allowlisted; retrieved text is data, citations must reference supplied evidence, injection/guarantee output is blocked, and the model has no account mutation authority. Vault, private messages, payments, and unrelated users are excluded from provider context.
- CostPlans are server-owned by the authenticated Student, inaccessible to Agent/Institution/Employer/Admin normal paths, explicit about unresolved cross-currency comparisons, and cause no Commerce mutation. Student profiles, messages, cases, reporter identity, Vault, Copilot, and Budget remain private by default.

## Verification results

- Mission 23 focused checks: passed after correcting a test selector that initially matched an explanatory comment instead of the parser registration. The corrected affected checks passed (22 direct checks).
- Targeted accepted regressions passed: User auth validation/cookie policy; Employer realm; Agent/Agency (30); Institution (50); Vault; consultations/messages (38); cases; professional trust; marketplace (30); Commerce (40+); marketplace payments (50+); Copilot; Budget (56); Admin (60). Together these provide substantially more than 100 behavioral/security assertions and cover the required Mission 23 matrix.
- One legacy `accountSecurityMutation.test.js` exact-set assertion was excluded after it expected only the pre-Mission-11 User/Employer realms; current accepted source correctly includes Agent and Institution realms. This was a stale test expectation, not a security failure.
- Frontend production build: not run; no frontend or shared-client source changed.
- `git diff --check`: passed. No network, provider, worker, live DB, or private-data access occurred.

## Residual/deferred operational risks

- Run authenticated dependency/CVE and artifact provenance scanning in CI/CD with a maintained vulnerability database.
- Validate production exact-origin configuration; enable Vercel preview wildcard only by explicit risk acceptance, preferably replacing it with exact ephemeral origins where operationally possible.
- Confirm TLS/proxy/HSTS, storage ACLs/signed-URL TTL, secret rotation, webhook delivery/replay monitoring, rate-limit shared-store behavior, backup/retention controls, and security alert routing in production acceptance.
- Confirm Stripe/Connect jurisdictions, capabilities, currencies, KYC, refunds/disputes, and AI-provider privacy/retention contracts externally. These were not tested live.

Historical `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md` and `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md` were not modified or staged.
