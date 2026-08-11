# Strideto Phase 7 — Public Discovery & Content Finalization

> **Status:** FROZEN  
> **Baseline after Phase 6 freeze:** `cb7d351`  
> **Authority:** [STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md](STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md)  
> **Phase 0–6:** FROZEN (not redesigned)  
> **This phase owns:** FINAL public discovery / content experience  
> **Later phases** may integrate navigation/SEO/Commerce/cross-role operations through accepted public contracts. They may not redesign these discovery experiences.

Runtime at `https://localhost:8443` (Docker `edurozgaar-staging` + SEC-3F Caddy + local `appenv-align`). Worker **stopped**. Local rebuild of **frontend, api-a, api-b only**. Mongo/Redis/media volumes preserved. No `down -v`, no volume prune, no reseed, no push, no deploy.

Phase 10 owns navbar labels / footer / sitemap / legal / SEO. This phase did **not** rename the public navbar.

---

## Final public route inventory

| Surface | Route | Detail |
|---|---|---|
| Jobs listing | `/jobs` | Accepted card design preserved |
| Job Detail | `/jobs/:slug` | Reused; no duplicate route |
| Internships | `/internships`, `/internships/:slug` | Public active only |
| Scholarships (CMS) | `/scholarships`, `/scholarships/:slug` | Source-backed CMS projection |
| Scholarship intelligence | `/scholarship-intelligence`, `/:slug` | Mission 7 canonical |
| Admissions (CMS) | `/admissions`, `/admissions/:slug` | Plus official intakes rail |
| Programs | `/program-explorer`, `/program-explorer/:slug` | Compare registered before `:slug` |
| Tests / Test Hub | `/tests`, `/tests/:slug` | Published catalog only |
| Institutions (canonical) | `/education/institutions` API; Program Explorer UI | Public projection |
| Agent directory | `/agents` | Approved organizations only |
| Agent profile | `/agents/:slug` | Public projection |
| Agent marketplace | `/agents/marketplace`, `/agents/marketplace/:slug` | Approved current posts only |
| Global search | `/search` | Phase 1 allowlist |

---

## Jobs listing (preserved)

Accepted card hierarchy, spacing, and listing layout kept. Narrow additions only: wrapping, job-type / apply-type filters the backend already supports, Reset, EmptyState. Openings omitted on compact cards (accepted design). No “0 openings”. No fabricated applicant counts.

Search, province/category/organization, deadline-after, type, applyType (On Strideto / official website), sort, pagination, Unicode, bounded query, combined filters, invalid/out-of-range page: live-verified.

---

## Job Detail (approved redesign)

Single existing route. Desktop `lg:` two-area layout (~67% / ~33% at 1440: main `720px`, summary `352px`). Sticky summary on desktop only. One-column below `lg` with metadata + Apply/Save before About.

Sections render only when content exists. Useful empty fields use **Not specified**. Description is text (`whitespace-pre-wrap`), not unsanitized HTML.

Compensation: amount required; currency-only is **Not specified** (not a fabricated salary).

---

## openingsCount

Canonical Phase 4 field only. Direct Employer integer ≥ 1 is server-authoritative. Public phrases: `1 opening` / `N openings`. Legacy missing: `Openings: Not specified`. Never `0 openings`. Application count does not reduce openings. Public jobs no longer attach vacancy remaining seats.

Runtime: B5B internal fixture displayed **2 openings** after disposable `openingsCount=2` alignment. External `fron-dest-operator-lahore` displayed **Openings: Not specified**.

---

## Internal vs external application

Internal: Apply uses Student contract; unauthenticated POST **401**; login CTA uses safe return path (`isSafeInternalReturnPath`). Runtime student Apply on B5B handed off to `/applications/:id` (Phase 3 surface, not redesigned).

External: CTA **Apply on official website**; disclosure **Application happens outside Strideto**; `applicationsTracked=false`; no fake internal applicants. Unsafe `javascript:` / `data:` URLs rejected. Live external link was `https` + `noopener noreferrer`.

Closed/draft/pending/rejected: public GET **404** (`p4-draft-role`, closed slug). No silent apply.

---

## Internships / Scholarships / Admissions / Programs / Tests / Agents

| Domain | Contract | Runtime |
|---|---|---|
| Internships | Active public only; internal apply only if `applyInPlatform`; no scraped/AI listings; no guarantee | Collection empty → EmptyState + no-guarantee copy |
| Scholarships | CMS = source-backed; Mission 7 intelligence = Institution-owned / source-backed; Agent advice is never scholarship authority | CMS empty; intelligence empty (canonical draft hidden); no-guarantee + verify-with-provider copy |
| Admissions / intakes | Phase 6 Institution dates date-only; missing dates ≠ “admissions open” | Official intakes rail: Fall 2026 deadline `2026-06-30` (date-only); internal + external modes on Program detail |
| Institutions / Programs | Approved public projection; tuition Money no FX; private evidence stripped | Program `p6-disposable-internal-program-…`: PKR tuition, Official Institution source, freshness Current; `organizationId` / `evidenceRef` absent |
| Test Acceptance | Institution/Program scope; no country escalation; superseded/expired filtered | Program/institution acceptance APIs 200; published test catalog empty (drafts hidden) |
| Agents / marketplace | Approved public only; Agent statement typed; no KYC/leads/clients | Directory + profile `p5-professional`; marketplace pending post **404**/empty |

---

## Source / provenance / freshness

Coherent public pattern: `PublicTrustBadge` + `ProvenanceStrip`. Labels: Employer-posted on Strideto, Official Institution source, Institution-owned scholarship, Source-backed, Agent statement, Strideto-derived recommendation. Stale / review_due / broken use caution copy. Internal reviewer IDs not shown.

---

## Public search / privacy

Phase 1 allowlist. Public search forces `includeDraft=false`, clamps types, strips `adminEditUrl`. Unknown domains fail closed (**400**): vault, messages, cases, budget, copilot, talent-profile, admin, review. Vault/messages/cases/budget/copilot/admin unauthenticated: 401/404. UI tabs: All / Jobs / Scholarships / Admissions / Universities / Blogs / Career Guidance only.

---

## Authenticated Student handoffs

Save, internal Apply, external tracker, Program “Apply on Strideto”, Agent “Request consultation”. Saving ≠ applying. Return paths cannot open-redirect. Student surfaces not redesigned.

---

## Responsive / accessibility

Job Detail measured:

| Viewport | Result |
|---|---|
| 320 | One-column; no overflow; title wraps; openings + deadline; Apply/Save 44px |
| 375 | Same |
| 768 | One-column adaptive (`lg` grid starts 1024); no crush/clip |
| 1024 | Summary aside visible; no overflow |
| 1440 | ~67/33 hierarchy; title not clipped |
| 200% | Controls reachable; ~61px document overflow (MINOR, not severe overlap) |

Semantic headings, button vs link, loading `role=status`, error `role=alert`, 44px targets. Not a WCAG certification (Phase 11).

---

## Security / public projection

Server-derived projections (`shared/publicDiscovery/projectPublicDiscovery.js`). Unpublished/private jobs 404. Unsafe URLs rejected. Job descriptions as text. Search privacy fail-closed. Agent reviews for non-public slug 404; approved slug returns empty public reviews (not a fake 404 that hid the profile).

---

## Executable evidence

| Pack | Result |
|---|---|
| `phase7PublicDiscovery.test.js` | **133** checks passed |
| Phase 1 foundation | 53 |
| Phase 3 Student | 62 |
| Phase 4 Employer | 127 |
| Phase 5 Agent | 114 |
| Phase 6 Institution | 167 |
| Mission 4 Education Intelligence | 41 |
| Mission 5 freshness | 51 |
| Mission 6 Test Acceptance | 40 |
| Mission 7 Scholarships | 60 |
| Mission 8 matching | 61 |
| Mission 12 marketplace | 30 |
| Mission 18 Institution | 50 |
| Mission 22 internationalFoundation | 13 |
| Mission 23 security audit | 37 |
| Module-link integrity | ok (1626 modules, 5041 relative imports) |
| Server lint | 0 errors |
| Client lint | 0 errors / 60 pre-existing warnings |
| Frontend `vite build` | passed |

---

## Real Docker evidence

Rebuild: `docker compose --env-file .env.staging -p edurozgaar-staging -f docker-compose.yml -f docker-compose.staging.yml -f docker-compose.sec3f-local.yml -f docker-compose.appenv-align.yml build frontend api-a api-b` then `up -d --no-deps --force-recreate` for those three only.

| Check | Result |
|---|---|
| Worker | Absent / stopped |
| frontend, api-a, api-b | Recreated; healthy |
| Mongo / Redis / media | Preserved |
| Guest/public pages | 200 SPA; discovery APIs 200 |
| Job cards | 19 public jobs; search `Andoride` → 1 |
| Job Detail A–I | Internal openings; external disclosure; legacy Not specified; long title wrap; closed/draft 404; unknown compensation Not specified; present salary `80k-120k PKR`; employer-posted badge; unpublished denied |
| Student Apply | Handoff to `/applications/:id` |
| Unexpected 5xx | **0** |

Runtime defects found and fixed before freeze:

1. Public agent reviews required `profileStatus:'published'`, so `Promise.all` 404’d the approved directory profile. Reviews now use the same visibility as `getPublicProfileBySlug`; UI loads reviews independently.
2. Currency-only compensation displayed `PKR` without an amount. Now **Not specified**.

---

## Later-phase items explicitly deferred

Admin / Student / Employer / Agent / Institution portal redesign; Employer job authoring (except this public integration); navbar rename; footer/sitemap/SEO; License page; Stripe; email worker; cross-role architecture; whole-platform a11y certification; load/backup/rollback. **Phase 8 — cross-role handoff closure.**

---

## Freeze gate

Public Discovery & Content is **FROZEN**. Later phases may integrate through these contracts only.
