# Strideto Phase 10 — Navigation / Help / Legal / SEO Finalization

> **Status:** FROZEN  
> **Baseline after Phase 9 freeze:** `f8d82c7`  
> **Authority:** [STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md](STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md)  
> **Phase 0–9:** FROZEN (not redesigned)  
> **This phase owns:** public navbar labels/IA, public footer, human `/sitemap`, crawler `/sitemap.xml`, Help/Guidelines discoverability, Contact/Support, public legal navigation, License/source-code public presentation cleanup, metadata, canonical URLs, robots/noindex, Open Graph, truthful structured data, route-level SEO, public 404  
> **Later phases** own visual a11y (11), infrastructure/performance (12), deployment/provider activation (13–14). They may not reopen frozen portals, Job Detail, or Commerce.

Runtime at `https://localhost:8443` (Docker `edurozgaar-staging` + SEC-3F Caddy + local `appenv-align`). Worker **stopped**. Local rebuild of **frontend** after the `index.html` helmet-replaceable tags change; **api-a/api-b** already carried the sitemap/robots origin contract from the earlier Phase-10 source rebuild. Mongo/Redis/media volumes preserved. No `down -v`, no volume prune, no push, no deploy. No live Stripe, no real email/SMS/push.

Pre-Phase-10 AdminTableFilters WIP was isolated in named stash `wip: AdminTableFilters values wiring (pre-phase-10)` (`AdminDataTable.jsx`, `AdminTableFilters.jsx` only; no `-u`). Restored unstaged after freeze. Protected untracked files untouched.

---

## Final public navbar

Source of truth: `client/src/components/layout/navConfig.js` (`PRIMARY_NAV_ITEMS`). CMS header is not used for the public shell.

| Label | Path | Notes |
| --- | --- | --- |
| Home | `/` | Logo also returns Home |
| Jobs | `/jobs` | Stable URL |
| Scholarships & Funding | `/scholarships` | Label only |
| Admissions & Intakes | `/admissions` | Label only |
| Internships | `/internships` | Stable URL |
| Study & Institutions | `/program-explorer` | Mega: schools, foreign studies, intl scholarships |
| Tests & Prep | `/tests` | Mega: exam prep |
| Services | `/services` | Replaces public “More” |

Mega parents are real `Link`s. Desktop inline nav starts at `min-[1440px]`; hamburger below that. Drawer: parent navigates; submenu toggle; `role="dialog"`; Escape via `useOverlayA11y`. Guest Account menu: Login/Register. Authenticated: role help + Logout. TourAnchors (`Resume`/`Career`) remain 1px `aria-hidden` onboarding targets — not top-level IA.

## Services mapping

`/services` lists only approved discovery surfaces: `/agents`, `/agents/marketplace`, `/career-guidance`, `/resume-builder`, `/help-center`. No Admin/portal routes, no fake products, no Jobs/Scholarships dumped as “services”.

## Footer IA

Groups (real routes only):

- **Discover:** Jobs, Internships, Scholarships & Funding, Admissions & Intakes, Study & Institutions, Tests & Prep
- **Services:** Agents / professional services, marketplace, Career Guidance, Resume Builder
- **For organizations:** Employer / Agent / Institution **login** entry points (not operational dashboards)
- **Support:** Help Center, Support, Contact, Sitemap (`/sitemap`, same-origin, no new window), FAQ
- **Legal:** Privacy, Terms, Refund, Cookies, Disclaimer

Copyright sanitizer: `© 2026 Strideto`. Forbidden hrefs: GitHub, localhost, `/license`, `/admin`, roadmap/docs. CMS footer columns are not the IA source.

## Human sitemap

`/sitemap` (`HumanSitemap.jsx`): Opportunities, Education, Professional services, Student/account entry (login/register noted as auth), Organizations (portal entry notes), Help/Support, Legal. No Admin, Vault, Copilot, private IDs, localhost, License, GitHub, or roadmap.

## XML sitemap

`GET /sitemap.xml` from `seoController`: `application/xml; charset=utf-8`. Origin via `resolvePublicSiteOrigin` (production `https://strideto.com`; local `https://localhost:8443`; retired `:8080` remapped). Static indexable paths from `shared/seo/publicIndexablePages.js` (no `/license`). Dynamic URLs from public projections only (active jobs/scholarships/admissions/internships; published programs/tests/blogs; approved-org + approved-profile agents; published+approved marketplace). Slug-only. No changefreq/priority. `lastmod` only when `updatedAt`/`publishedAt` exists. Runtime sample: 98 unique URLs, 22 lastmods, no 8080/staging/license/admin/vault/dashboard/duplicates.

## Canonical origin

`shared/seo/publicSiteOrigin.js`. Empty/invalid config → `https://strideto.com`. Local Docker `SITE_URL`/`VITE_APP_URL` resolve to `https://localhost:8443` and appear in local canonicals/sitemap/robots. Production builds must not ship localhost. No hardcoded `http://localhost:8080`.

## Metadata / Open Graph

`SeoHead` + `formatPageTitle` strips `undefined`/`null`/`[object Object]`. Route titles observed: Jobs, Scholarships & Funding, Admissions & Intakes, Internships, Study & Institutions, Tests & Prep, Professional Services, entity names on Job/Program/Agent detail. `index.html` bootstrap OG/Twitter/robots/title use `data-rh="true"` so helmet replaces them (no duplicate conflicting tags after hydration). Private paths: `GlobalSeo` `noindex, nofollow`; login observed `noindex, nofollow` and no canonical. 404/License: noindex. Filter/search permutations do not invent extra canonicals beyond listing path.

## Structured data

Public routes emit Organization + WebSite (SearchAction target is `/jobs?search={search_term_string}`). JobPosting only for active, non-closed, accepting jobs; no salary unless authoritative amount; no ratings; `validThrough` only from deadline; hiringOrganization from public fields. Closed/missing jobs do not emit JobPosting (stale sitemap slug `p9-draft-…` returned “Job not found” with no JobPosting). No fabricated FAQ/review schema.

## Robots / noindex

Runtime `/robots.txt` (`text/plain; charset=utf-8`): `Allow: /`, Disallow private prefixes including `/agent/` (does not match `/agents`), Sitemap same-origin. **Not an authorization boundary** — `/admin` and `/dashboard` still SPA-200 then auth-gated. Client `PRIVATE_SEO_PREFIXES` + page-level `noindex` on login/register/role dashboards/Admin/checkout utilities.

## Help / Contact

Public Help: `/help-center`. Role CTAs state “sign in required” and point at `/help/student`, Employer help, `/agent/guidelines`, `/institution/guidelines` without duplicating portal copy. Contact/Support: existing form only; no invented phone/address/email/SLA; failure does not claim success; tickets note authentication. Cookie banner only if AdSense client ID is configured (not shown on this runtime).

## Legal / License / copyright

Public legal: Privacy, Terms, Refund, Cookies, Disclaimer. Refund copy matches frozen Phase 9 (provider-authoritative, dispute ≠ refund, Institution launch free, no invented percentages/timelines). Cookie copy admits essential auth cookies; no “we don’t use cookies”; no cosmetic consent banner without ads. `/license` renders `NotFound` (no GitHub redirect). `LICENSE` file and third-party notices untouched. Footer brand `© 2026 Strideto` does not rewrite historical source-license holders. No GDPR/CCPA/SOC2/PCI claims.

## 404 / redirects

Branded 404: heading, Home / Jobs / Sitemap recovery, noindex, no stack/config leak. SPA architecture returns HTTP 200 for unknown paths; UI is 404. No new open redirects. No License→GitHub. Phase-8 realm-return tests still pass (71). No redirect loops introduced.

## Route classification

| Class | Examples |
| --- | --- |
| INDEXABLE PUBLIC | `/`, `/jobs`, `/jobs/:slug`, `/scholarships`, `/admissions`, `/internships`, `/program-explorer`, `/tests`, `/services`, `/agents`, `/agents/:slug`, `/help-center`, `/sitemap`, legal pages |
| PUBLIC BUT NOINDEX | `/auth/login`, `/auth/register`, 404/unknown, `/license` (NotFound) |
| AUTHENTICATED/PRIVATE | `/dashboard`, `/talent-profile`, `/applications`, `/vault`, `/budget`, `/copilot`, `/account/*`, `/employer/*`, `/agent/*`, `/institution/*`, `/help/student` |
| STAFF/ADMIN | `/admin/*` |
| LEGACY/REDIRECT | none added; License is NotFound not a redirect |
| NOT FOUND/REMOVED | `/license` as product page; unknown paths |

## SEO privacy

Sitemap/metadata use public projections. No Student names, applications, Vault, messages, Agent leads/cases, Institution applicants, Admin, payment internals, or secrets in sitemap/meta. `/agent/` robots disallow does not hide public `/agents`.

## Responsive runtime

| Width | Navbar | Overflow (shell pages) |
| --- | --- | --- |
| 320 | Hamburger; drawer 8 labels; Escape closes | none |
| 375 | Hamburger | none |
| 768 | Hamburger | none |
| 1024 | Hamburger (desktop nav `display:none`) | none |
| 1440 | Inline 8 labels unclipped; hamburger hidden | none |
| 200% (720 CSS / dpr 2) | Hamburger | none on Home |

Help, sitemap, Privacy, 404 at 320: no shell overflow. Known whole-platform 200% overflow (~61px) remains Phase 11.

## Tests executed

- `phase10PublicShell.test.js`: 73
- `phase10Seo.test.js`: 53
- `navbarHierarchy.test.js`: pass
- Phase 1 foundation: 53
- Phase 7 public discovery: 133
- Phase 8 handoff: 71
- Mission 23: 37 (+ accepted suites)
- `secureAuthClientContract.test.js`: 63
- Module-link integrity: clean
- Client lint: 0 errors / 60 pre-existing warnings (max-warnings 100)
- Client production Vite build: pass (known browserslist / react-dom overlap / >500kB chunks → Phase 12)
- Phase 9 commerce matrix: **not rerun**

## Phase 11–14 deferrals

- Phase 11: whole-platform a11y, 200% overflow elsewhere, Institution native select truncation, Admin actions-column name, TourAnchors in the a11y tree despite `aria-hidden`
- Phase 12: browserslist, chunk size, limiter UX, performance
- Phase 13–14: deployment, production provider activation
- SPA HTTP 200 for unknown routes (client 404 UI) is existing architecture, not a crawler status-code change
- XML sitemap additionally requires Agent `profileStatus: approved`; directory lists approved-org profiles (conservative crawl, not a private leak)

## Freeze gate

Navbar shows the eight approved labels on stable URLs. Services maps to real discovery. Mobile navbar works. Footer has no License/GitHub/localhost/roadmap/Admin links. `/sitemap` and `/sitemap.xml` are public-safe. Retired localhost:8080 sitemap origin is gone. Canonical origin contract holds. Metadata/OG/robots/noindex work. Structured data is truthful. Help/Contact/legal are discoverable and conservative. Public License promotion removed; repository LICENSE untouched. Cookie/refund copy is truthful. 404 works. No open redirect. No unexpected 5xx. Worker stopped. Zero unresolved BLOCKER/P0/P1/SEO-privacy-legal MAJOR.
