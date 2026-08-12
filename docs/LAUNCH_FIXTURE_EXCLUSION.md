# Launch Fixture Exclusion Policy

## Purpose

Strideto may ship with **seed or demo fixture data** in non-production environments (development, staging, QA). That data supports local testing and demos. It must **not** be treated as live production content at launch.

This document explains how fixture records are excluded from public discovery and operational counts **without deleting underlying data**.

## What counts as fixture data

Fixture records are identified by one or more of:

- Explicit fixture flags on the document (e.g. `isFixture`, `seedSource`, `demoOnly`)
- Known seed script provenance (`server/src/scripts/archive/seed-legacy/*`, phase seed utilities)
- Admin-marked test organizations, agents, jobs, or marketplace posts used only for QA

**Do not bulk-delete fixture rows** as part of launch prep unless a separate data-retention policy requires it. Exclusion is a **visibility and eligibility** control, not a purge.

## Exclusion surfaces

| Surface | Behavior |
|---------|----------|
| Public agent directory | Only **approved** profiles with current verification; fixture/demo profiles remain in DB but are filtered out |
| Public agent marketplace | Only **moderated, published** posts; draft/fixture posts hidden |
| Public job/scholarship/admission listings | Active, non-fixture listings only |
| Search / sitemap / SEO index | Indexable paths exclude fixture-backed slugs when flagged |
| Employer/agent/institution dashboards | Fixture data may appear in admin/QA views; not mixed into production analytics |

## Agent directory & marketplace (Tracks Q/R/S)

- **Directory** (`/agents`) shows real public fields only: display name, agent type, destinations, services summary, trust badges, verification state.
- **Profile** (`/agents/:slug`) never exposes private CRM, payout, or student PII.
- **Marketplace** (`/agents/marketplace`) is for **moderated opportunity guidance** from approved agents — not a generic classifieds board. Fixture posts stay out of the public feed.

## Operational rules

1. **No silent promotion** — fixture records are not auto-published at launch.
2. **Admin review** — launch checklist verifies public feeds return only non-fixture content.
3. **Preserve audit trail** — exclusion filters are preferred over hard deletes.
4. **Reversible** — clearing fixture flags (with admin permission) can restore visibility for continued QA.

## Related code (indicative)

- Public discovery mappers: `shared/publicDiscovery/projectPublicDiscovery.js`
- Agent public routes: `server/src/routes/agent.js`, `server/src/services/agentMarketplaceService.js`
- Phase 7 public discovery tests: `server/src/__tests__/phase7PublicDiscovery.test.js`

## Residuals / not in scope

- Automated fixture sweeps or one-click purge tools
- Environment-specific seed toggles beyond existing feature flags
- Payment or entitlement changes for fixture employers

When in doubt: **hide from public, keep in database, document the flag.**
