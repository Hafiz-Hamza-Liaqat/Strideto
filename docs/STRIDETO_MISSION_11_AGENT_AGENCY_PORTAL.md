# Strideto Mission 11 — Agent / Agency Portal

Mission 11 adds an isolated Agent authentication realm and the Agent/Agency portal foundation. It is additive and does not migrate or alter Employer accounts.

## Delivered

- Dedicated Agent registration, login, authenticated self, refresh, logout, logout-all, password-change, JWT audience, refresh cookie, session-state, token-version, and `requireAgentAuth` handling.
- Agent and Agency identities reuse the Mission 1 `Organization` model. Registration links an `AgentProfile` and active owner `AgentMembership` to the organization.
- Organization-scoped profiles, services, agency memberships, leads, and relationship status updates. Cross-organization reads and mutations are denied by scoped queries and active membership checks.
- Guided onboarding for identity, services, markets, agency representative information, Mission 2 verification, and restricted review state.
- Mission 2 remains the sole verification authority. Only `approved` unlocks privileged capability; pending, under-review, needs-information, rejected, suspended, revoked, and expired states do not.
- Structured draft services with category, journey/delivery mode, countries, destination countries, truthful pricing-mode foundation, duration/limitations, and rejection of guarantee claims. Service activation requires approved verification. No payments are implemented.
- Explainable profile completeness reports overall score, completed sections, missing sections, and a recommended next step. Completeness never implies verification.
- Granular trust badges are derived only from accepted Mission 2 evidence. Self-declared profile fields never create badges.
- Agency owner/admin/member and active/inactive membership foundation with organization-scoped role/status mutations. Enterprise RBAC and invitations are deferred.
- Lead/client relationship foundation exposes relationship metadata only. Agents cannot browse arbitrary Users, and relationships grant no Student Profile, Journey, application, payment, or case authority.
- Approved-only public profiles and a bounded, filterable, paginated directory. Public projections omit evidence, reviewer data, risk data, internal IDs, Vault grants, and private relationships.
- Responsive portal routes for dashboard, onboarding, profile, services, verification, team, leads, clients, and settings. Consultations, cases, payments, and earnings are shown only as unavailable future boundaries.

## Vault boundary

Agent authentication, approved verification, and lead/client relationships each grant zero implicit Vault access. Mission 10 `canAccessDocument` remains authoritative: a non-owner Agent must present an explicit active grant for the exact document, exact Agent grantee identity and grantee type, requested permission, and unexpired/unrevoked state. Rejected scanner state continues to deny download. No `Agent → User → all documents` path exists.

## Admin and audit

Agent/Agency submissions reuse the Mission 2 organization verification queue and Admin lifecycle. Important profile, onboarding, service, membership, relationship, and verification transitions use safe audit metadata without secrets or Student private data.

## Verification performed

- Mission 11 focused acceptance: 30/30 passed.
- Mission 1 international/realm regression: 13/13 passed after activating the Agent realm expectation.
- Mission 10 Vault regression executed for the shared access-policy change.
- Frontend Vite production build passed (1,102 modules transformed). Existing bundle-size and Browserslist freshness warnings remain non-blocking.

No live Agent accounts or data were created. No migration, backfill, seed, worker, email, payment, deployment, or live database operation was performed.

## Deferred

Mission 12+ owns opportunity marketplace behavior, invitations/expanded team workflows, consultations, cases, payments, earnings, and other marketplace capabilities.
