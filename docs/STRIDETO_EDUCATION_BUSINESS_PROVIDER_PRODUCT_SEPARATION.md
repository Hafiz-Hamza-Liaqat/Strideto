# STRIDETO — Education & Business Provider Product Separation

## Architecture before

- One public **Provider Portal** entry (footer → `/agent/login`).
- Shared `AgentAccount` authentication for Education and Business.
- Shared `AgentProfile` contact/presentation fields edited from both Education Profile and Business Profile (write-through risk).
- Provider Dashboard (`/agent`) as dual-domain gateway after prior IA work.
- Operational models already split (AgentService / Consultation / ProfessionalCase vs Gbs*).

## Architecture after

Public products:

| Product | Public entry | Internal workspace routes |
| --- | --- | --- |
| Education & Mobility Provider | `/providers/education-mobility` | `/agent/education/*` (unchanged names) |
| Business Formation Provider | `/providers/business-formation` | `/agent/business-services/*` (unchanged names) |

Chooser / legacy: `/providers` (does not silently pick Education).

Legacy `/agent`, `/agent/login`, `/agent/register` remain valid (compatibility).

## Auth decision

**Shared Agent authentication is preserved.**

- Same `AgentAccount`
- Same agent cookie / refresh session realm
- Same login endpoints

**Auth migration required: NO**

Documented limitation: password and session Settings remain shared under one principal. Changing password affects access to both professional products. Professional **profile data** is independent.

## Profile ownership

| Portal | Mutable presentation | Canonical operational |
| --- | --- | --- |
| Education | `AgentProfile` (+ Education specialties / destinations) via `PATCH /api/agent/profile` | AgentService, Marketplace, Availability, Consultation, ProfessionalCase |
| Business | `GbsProviderProfessionalProfile` via `GET/PATCH /api/agent/business-services/professional-profile` | ProviderCapability, jurisdictions, GbsServiceListing, Request, Quote, GbsCase |

- No Education → Business write-through
- No Business → Education write-through
- No automatic copy of contact fields between portals
- Business model: `autoIndex: false`; no staging backfill in this phase
- Legacy `AgentProfile` not deleted

## Team ownership

- Container: shared `AgentMembership` (acceptable)
- Assignments: `domainAccess[{ domainId, permissions }]`
- Education Team / Business Team UIs filter and invite per focused domain
- Removing Education access patches `domainAccess` only; does not delete membership or Business duties (inverse equally)
- Empty `domainAccess` allowed after domain removal so the membership row can remain for the other portal

## Verification ownership

- Education: existing education / OrganizationVerification path — Education-only
- Business: capability / jurisdiction / listing eligibility — Business-only
- No universal Verified flag

## Route compatibility

- Public product entries added without renaming internal `/agent/education/*` or `/agent/business-services/*`
- Legacy redirects from prior phase preserve query + hash (including `#professional-credentials`)
- Resource IDs preserved on redirects

## Migration compatibility

- No destructive AgentProfile migration
- No AgentAccount duplication
- No production/staging backfill
- Existing dual-domain accounts keep both enrollments; profiles start empty on Business until edited

## Legacy Provider Portal behavior

- Footer no longer primary-links a single Provider Portal
- `/providers` chooser + `/agent` Provider Dashboard remain **LEGACY COMPATIBILITY** for migrated accounts
- New public flows enter Education or Business directly

## Footer entries

- Employer Portal — unchanged URL
- Institution Portal — unchanged URL
- Education & Mobility Providers → `/providers/education-mobility`
- Business Formation Providers → `/providers/business-formation`

## Workflows unchanged

- Education: Consultation → ProfessionalCase consent flow preserved
- Business: Request → Quote → GbsCase preserved
- Business public marketplace remains OFF
- Student / Employer / Institution / Business Client / Admin realms not redesigned

## Deferred

- Admin professional credential review UX issues
- Separate passwords / auth realms
- Subscriptions and referrals (must be product-specific later)
- 17D-9B / Phase 18
- Staging backfill of Business presentation from Education fields (requires separate authorization)
