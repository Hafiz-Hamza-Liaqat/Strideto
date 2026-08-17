# Agent / Agency domain-separation blocker fixes

**Date:** 2026-08-17  
**Scope:** P1 shared Profile Education contamination + P1 Verified-by-Strideto gate  
**Related:** `docs/STRIDETO_AGENT_AGENCY_DOMAIN_WORKFLOW_VERIFICATION_AND_MARKETPLACE_GATING.md`

## Defects

### P1 A — Shared Profile Education taxonomy

`/agent/profile` rendered Education-only controls (service specialties from `AGENT_SERVICE_CATEGORIES`, destination / country expertise) regardless of Active Dashboard.

### P1 B — Unconditional Verified mark

`StridetoVerifiedMark` on `/agents/:slug` rendered without requiring server-authoritative Education professional approval.

## Fixes

### Shared Profile

- `client/src/pages/Agent/AgentProfile.jsx` keeps shared identity/basics only.
- Save no longer sends `specialties` or `destinationCountries` (DB values preserved).

### Education rehome

- Editable home: Education & Mobility → My Education Services (`AgentServices.jsx`)
- Section: **Education professional profile**
- Same `AgentProfile` fields / `PATCH /api/agent/profile` — no schema migration, no data loss.

### Verified mark

- Canonical predicate: `canExercisePrivilegedCapability` on `OrganizationVerification` status (APPROVED only) — same gate as Education Marketplace privilege / public profile visibility.
- Public projection: `educationProfessionalVerification: { verified, scope: 'education_mobility' }`
- Client renders mark only when `verified === true`.
- Component fails closed (`verified = false` → `null`).

## Taxonomies

| Domain | Source | Unchanged |
| --- | --- | --- |
| Education | `AGENT_SERVICE_CATEGORIES` | Yes |
| Business | GBS capability catalog (`businessServicesCapabilities.js`) | Yes |

No universal Provider specialty taxonomy.

## P2 (notifications)

Trivial neutral empty-state copy on shared Notifications (no API/behavior change).

## Tests

- `client/src/__tests__/agentProfileDomainSeparation.test.js`
- `server/src/__tests__/educationVerifiedMarkAuthority.test.js`
- Updated: `educationMarketplaceFreePromotion`, `agentDashboardUxSimplification`

## Safety (unchanged)

Wyoming draft/draft · filing legal text UNAPPROVED/EMPTY · Business public marketplace OFF · HSI OFF · Worker STOPPED · no push / no deploy
