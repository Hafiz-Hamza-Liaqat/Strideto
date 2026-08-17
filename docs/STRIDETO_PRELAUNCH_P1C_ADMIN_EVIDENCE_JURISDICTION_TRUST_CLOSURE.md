# STRIDETO P1C Admin Evidence / Jurisdiction Trust Closure

## Baseline and scope

Starting HEAD: `4a6f9a457b0760ac4f13ff2f2f20811c28d787a6`.

This phase closes only substantive Admin evidence review and Business jurisdiction production-readiness enforcement. It does not activate a jurisdiction, the Business public marketplace, filing authorization, Wyoming filing packs, HSI, subscriptions, referrals, 17D-9B, or Phase 18.

## Education evidence review

The existing `OrganizationVerification` dossier remains canonical. The Admin verification detail now exposes the submitted professional credential type, profession, organization category, license issuer/number/jurisdiction/issue/expiry, accreditation body/number/expiry, representative authority reference, and the existing evidence records. HTTPS source references are explicit keyboard-accessible “Open source” links using a new tab with `noopener noreferrer`.

Evidence decisions remain staff-authoritative. Provider submission cannot set approval. Evidence references remain opaque descriptors; this phase adds no raw storage URL or key exposure and no new document-storage mechanism. Public Education projections remain unchanged.

Material resubmission continues through the canonical verification lifecycle, which clears or prevents stale approval according to the existing transition policy. Harmless public profile text is not made a professional verification input.

## Business evidence review

`ProviderCapability` remains canonical. Its Admin-only projection now retains the submitted evidence class/type, jurisdiction, protected title, reference number, issuing authority, official registry URL, effective dates, notes, decision, and Vault-reference presence. Public-safe evidence projection remains limited.

Admin detail also shows the exact Provider subject, country, jurisdiction, entity-type, and protected-title scopes. Organization verification, Education professional verification, Business capability verification, and protected-title verification remain separate authorities. Agency and Independent subjects remain exact and non-inheriting.

## Canonical jurisdiction readiness

`resolvePublicationEligibility` remains the canonical currentness policy. `projectProviderCatalog` continues to derive `currentReviewed`; the additive `resolveJurisdictionProductionReadiness` helper resolves one configured jurisdiction from that same projection. Geography/structural existence is never production authority.

Semantics:

- structural/draft: configured geography only; evidence may be collected, but no live authority;
- candidate/under review: evidence/review workflow may continue, but no live authority;
- current reviewed: eligible for production authority only when all other capability, subject, entity, evidence, protected-title, listing, and domain gates also pass;
- stale/rejected/superseded/not configured: fail closed.

Provider claims and evidence submission remain available for candidate review. Admin may accept evidence or mark it evidence-backed, but verification is denied until every scoped jurisdiction is current reviewed. Listing drafts remain possible; Admin approval, publication eligibility, public marketplace eligibility, ready-for-quote progression, and authenticated private-beta Request creation all require the same canonical readiness decision.

No catalog record or country was changed. Disposable tests inject a current-reviewed resolver explicitly; production code always resolves the source-controlled catalog.

## Privacy and authority invariants

- Admin permissions remain mandatory; Providers and Business Clients cannot review evidence or self-approve.
- Evidence is scoped to the exact Provider subject and professional domain.
- Education approval grants no Business authority, and Business approval grants no Education authority.
- Organization Verified does not grant professional or protected-title authority.
- Protected-title evidence policy remains mandatory and jurisdiction scoped.
- Business public marketplace remains OFF.
- Wyoming remains draft/draft; filing legal text remains unapproved/empty; HSI remains OFF.

## Verification evidence

Focused suites cover Admin evidence projections, safe links, Admin-only decisions, canonical readiness denial, and a disposable current-reviewed success case. Existing Education verification, P1A, P1B, auth/session, Provider separation, 17D source/UI, and disposable Mongo lifecycle suites pass. The Vite production build and touched-client ESLint pass. No dependency, migration, index, `syncIndexes`, or `dropIndexes` change was introduced.

## Runtime and acceptance

Runtime was rebuilt only for frontend, api-a, and api-b using the established staging Compose overlays and `.env.staging`; Worker was excluded. Runtime health, HTTPS, feature flags, and focused responsive smoke evidence are recorded in the final P1C report.

## Deferred Admin UX

Marketplace dark-theme polish, notification icon behavior, active-menu hover/state, and other non-authority Admin polish remain deferred. Jurisdiction legal research/activation, public Business marketplace, government filing, payments, subscriptions, referrals, load/stability certification, native 200% zoom, and real screen-reader acceptance remain outside P1C.
