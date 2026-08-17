# STRIDETO P2B Business Verification and Route Semantics Closure

## Canonical verification source

The Provider Business Verification summary consumes the P1C `publicCapabilityProjection`: `trustStatus`, grant `status`, canonical `scope`, `jurisdictionReadiness`, `productionAuthority`, review decision, and protected-title requirements.

Production authority is displayed only when trust is `verified`, the grant is `active`, and the canonical readiness projection says production authority is available. Evidence-submitted/evidence-backed, candidate, structural, suspended, and revoked claims remain visible but are explicitly not live.

Legacy UI fallbacks using `verificationStatus || status` and top-level `jurisdictionIds || jurisdictions` were removed. Organization verification and Education professional verification remain separate and do not grant Business authority.

## Route heading contract

Business Provider list, jurisdiction, service-authoring, verification, and detail states retain a route-specific visible `h1` during loaded, loading, empty, missing-subject, not-found, and controlled-error rendering.

The Business Client shell now presents portal identity as supporting text and derives the primary `h1` from the actual child route. This covers Overview, Request creation/list/detail, Quote list/detail, and Case list/detail without duplicate generic headings.

## Scope and deferred work

No server authority, database model, migration, jurisdiction catalog, public marketplace, HSI, filing, pagination, action queue, payment, or Business review behavior changed. Browser document-title expansion remains deferred because the existing shell has one broad SEO title and changing it would require a wider routing/SEO refactor.

P2C remains bounded-list/pagination/pre-scale closure. P2D remains dashboard/actionability and other public-launch UX work.
