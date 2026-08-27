# STRIDETO — SEO / AI Search / Growth Audit (2026)

**Repository:** `D:\Projects\Web\EDU-E-Portal`
**Baseline HEAD:** `94947eab3bb847470e4e1ed5ddbbc49122c2bc7e`
**Audit date:** 2026-08-27
**Nature of this document:** Analysis and roadmap only. No broad SEO implementation in this batch.

Status vocabulary used throughout:

| Label | Meaning |
|---|---|
| **CURRENT** | Present in code/product with evidence |
| **PARTIAL** | Exists but incomplete, inconsistent, or weak |
| **MISSING** | Not present; recommended if justified |
| **NOT APPLICABLE** | Not relevant given product model |
| **DATA/OPS REQUIRED** | Needs content/data/ops work, not only code |
| **EXTERNAL CONFIG REQUIRED** | Needs Search Console / Bing / DNS / analytics setup |

Do not treat scores as vanity metrics — each score cites evidence.

---

## 1. Executive summary

STRIDETO already has a credible **technical SEO foundation** for a Vite SPA:

- Dynamic `GET /robots.txt` + `GET /sitemap.xml` (server)
- Client `SeoHead` / `GlobalSeo` (Helmet) with canonical, OG, Twitter, hreflang query alternates
- Shared JSON-LD helpers (Organization, WebSite, CollectionPage, JobPosting, BlogPosting, Course, EducationalOrganization, Scholarship, FAQ, etc.)
- Private path noindex prefixes aligned with robots disallow
- Lightweight HTML-shell prerender for **six** routes only
- Provenance / freshness UI on several education surfaces

Highest-impact gaps are not “missing meta tags.” They are:

1. **JavaScript render/index reliability** — **PARTIAL / NEEDS PRODUCTION EVIDENCE.** Most public detail HTML shells are empty until JS runs; only 6 routes prerendered. Google renders JavaScript, so this is *not automatically* an SEO defect — it is an unproven variable until rendered/indexed status is confirmed in Search Console. SSR / selective prerender is an **architectural option**, not a Google requirement.
2. **Service / persona acquisition SEO** — private dashboards correctly noindexed, but public “what STRIDETO does after signup” landings are thin/missing (`/for-*` not present).
3. **JobPosting policy risk (SEO-P0)** — JobPosting JSON-LD is emitted for listings including external apply flows. Requires (a) verification that JobPosting is emitted **only** on a single eligible job detail page, and (b) a policy gate separating employer-authorized publication from editorially curated third-party opportunities.
4. **Measurement stack** — Search Console / Bing / IndexNow / organic conversion analytics are **EXTERNAL CONFIG REQUIRED** (docs only).
5. **Content quality / production Blog data** — malformed public Blog copy observed in production; **PRODUCTION DATA INSPECTION REQUIRED**.

---

## 2. Architecture evidence (CURRENT)

| Layer | Path / behavior |
|---|---|
| SPA | Vite React client (`client/`), Helmet via `SeoHead.jsx` / `GlobalSeo.jsx` |
| Robots (API) | `shared/seo/robotsPolicy.js` → `server/src/controllers/seoController.js` `GET /robots.txt` |
| Robots (static) | `client/public/robots.txt` — **PARTIAL divergence** (`Disallow: /business` only in static file) |
| Sitemap | `seoController.getSitemap` + `shared/seo/publicIndexablePages.js` |
| Schemas | `client/src/seo/schemas.js` |
| Canonical / OG | `client/src/seo/config.js` (`buildCanonicalUrl`, `resolveOgImage`) |
| Prerender | `scripts/prerender-seo.mjs` — `/`, `/jobs`, `/scholarships`, `/admissions`, `/about`, `/contact` |
| Private SEO | `PRIVATE_SEO_PREFIXES` / `isPrivateSeoPath` |
| Social sameAs | `shared/social/officialSocialLinks.js` — LinkedIn confirmed only |

---

## 3. Technical SEO audit

| Item | Status | Evidence / notes |
|---|---|---|
| robots.txt | **CURRENT** (API) / **PARTIAL** (static diverge) | Shared policy Disallow for auth/admin/portals; static file also disallows `/business` |
| sitemap.xml | **CURRENT** | Status-filtered detail URLs + static allowlist + SEO landings; `lastmod` date-only |
| Canonical URLs | **CURRENT** | `buildCanonicalUrl`; omitted when `noindex` |
| HTTPS assumptions | **CURRENT** | Public origin from `SITE_URL` / `FRONTEND_URL` |
| www vs non-www | **EXTERNAL CONFIG REQUIRED** | Host canonicalization is deployment/DNS, not app-enforced in audit |
| Trailing slash | **PARTIAL** | App routes generally slash-free; consistency depends on host redirects |
| 404 handling | **PARTIAL** | SPA UI 404 + noindex; HTTP status often still 200 without edge config |
| Redirect behavior | **PARTIAL** | App-level; CDN/host redirects **EXTERNAL CONFIG REQUIRED** |
| JavaScript render/index reliability | **PARTIAL / PRODUCTION EVIDENCE REQUIRED** | JS-dependent content; 6-route shell prerender only. Google executes JavaScript — real status must be read from GSC URL Inspection (rendered HTML) and Page indexing reports, not assumed |
| SSR | **ARCHITECTURAL OPTION — NOT AN SEO DEFECT** | No React SSR. Absence of SSR is **not** a Google requirement violation and is not classified here as a defect. Consider selective prerender/SSR only if render/index evidence shows a real problem on money templates |
| Prerender | **PARTIAL** | Six marketing/listing shells; expansion is an option, gated on evidence |
| Authenticated pages | **CURRENT** | noindex + robots disallow |
| Admin / dashboards | **CURRENT** | Blocked / noindex |
| Search/filter URLs | **PARTIAL** | `/search` noindex; some SEO landing pages indexable. Filter/sort parameter combinations need explicit index vs noindex/canonical control to avoid crawl dilution |
| Pagination | **PARTIAL** | Google **no longer uses `rel=prev`/`rel=next`** — its absence is **not** an SEO gap. What matters: every paginated page reachable via crawlable `<a href>` links, self-referencing canonical per page (never page-N canonicalized to page-1), and controlled filter/sort URL variants |
| Query params | **PARTIAL** | Lang via `?lang=`; filter URLs vary by surface |
| Duplicate content | **REVIEW REQUIRED** | Multiple job SEO landings (`/jobs-in-*`, category, province) need quality gates |
| Canonical detail routes | **CURRENT** | Slug-based public details; fixtures excluded from sitemap |

### Discoverability of key public routes

| Route family | Sitemap / robots | Index intent |
|---|---|---|
| `/` | yes | INDEX |
| `/jobs`, `/jobs/:slug` | yes (active+slug) | INDEX |
| `/scholarships`, `/scholarships/:slug` | yes | INDEX |
| `/intl-scholarships`, detail | yes | INDEX |
| `/internships`, detail | yes | INDEX |
| `/admissions` | yes | INDEX |
| `/institutions` / legacy schools | **PARTIAL** naming (`/schools-and-colleges`, education explorers) | INDEX when public |
| `/program-explorer`, `/program-explorer/:slug` | list yes; detail when published | INDEX when published |
| `/tests`, `/tests/:slug` | yes when published | INDEX |
| `/blog`, `/blog/:slug` | yes when published | INDEX — **DATA quality risk** |
| `/foreign-studies` | yes | INDEX |
| `/agents`, marketplace | yes when approved | INDEX |
| `/business-services`, providers | **PARTIAL** | Public listings INDEX; buyer dashboards NOINDEX |
| `/admin/*`, `/dashboard/*`, portals | disallow + noindex | AUTHENTICATED / NOT CRAWLABLE |

---

## 4. Indexability / crawl architecture

| Family | Classification |
|---|---|
| Public marketing + opportunity directories + details | **INDEX** (when published/active + slug) |
| SEO landings (city/province/category/country) | **CONDITIONAL** — keep only if content density remains high |
| `/search` | **NOINDEX** (CURRENT) |
| `/auth/*`, account, applications, vault, copilot | **AUTHENTICATED / NOT CRAWLABLE** |
| `/admin/*`, `/employer/*`, `/agent/*` (portal), `/institution/*` | **AUTHENTICATED / NOT CRAWLABLE** |
| `/business/*` buyer workspace | **NOINDEX** (portal); static robots also Disallow `/business` |
| Public `/agents`, `/business-services` | **INDEX** (public acquisition) — separate from private dashboards |
| Empty listing states | **REVIEW REQUIRED** — prefer thin noindex or strong empty copy + related links |

**Policy:** Never expose private dashboards for SEO. Build **public acquisition pages** that explain post-signup value instead.

---

## 5. Meta / on-page SEO

| Template | Title/desc/canonical | H1 | Schema | Notes |
|---|---|---|---|---|
| Home | CURRENT via SeoHead/CMS | PARTIAL (hero/CMS) | Organization + WebSite | Strong brand surface |
| Jobs list/detail | CURRENT | CURRENT | CollectionPage / JobPosting | JobPosting policy gap |
| Scholarships | CURRENT | CURRENT | CollectionPage / Scholarship | |
| Intl Scholarships | CURRENT | CURRENT | CollectionPage | Listing UX fixed this batch |
| Internships | CURRENT | CURRENT | CollectionPage / JobPosting mapping | |
| Admissions | CURRENT | CURRENT | CollectionPage / WebPage | |
| Institutions / Programs / Tests | PARTIAL→CURRENT | CURRENT on explorers | EducationalOrganization / Course / acceptance UI | Canonical entity SEO opportunity |
| Blog list/detail | CURRENT | CURRENT | CollectionPage / BlogPosting | **Production content quality gap** |
| Foreign Studies | CURRENT | CURRENT | CollectionPage-ish | |
| Agents / GBS public | PARTIAL | PARTIAL | PARTIAL | Service discovery opportunity |
| About / Contact / Legal | CURRENT | CURRENT | AboutPage / ContactPage | E-E-A-T base |
| FAQ | CURRENT | CURRENT | FAQPage — **LEGACY / OPTIONAL** | Keep useful FAQ *content*; FAQPage markup carries **no current Google FAQ rich-result benefit** |

**Breadcrumbs:** Many public pages emit `BreadcrumbList` JSON-LD — **CURRENT**. Visible UI breadcrumbs are **PARTIAL**.

**Images / alt:** Lazy loading common; decorative blog images often `alt=""` — **PARTIAL**. Prefer meaningful alts when image conveys content.

**Malformed Blog content:** Production screenshots show non-editorial text (“I prefer this over inventing a person's name…”). Status remains **PRODUCTION DATA INSPECTION REQUIRED**. SEO impact: poor snippet quality, trust damage, possible soft demotion. Do not phrase-censor in code; fix data with editorial process.

---

## 6. Structured data audit

| Type | Status | Notes |
|---|---|---|
| Organization | CURRENT | GlobalSeo + sameAs (LinkedIn only confirmed) |
| WebSite | CURRENT | **Keep** — useful site/entity representation |
| WebSite `SearchAction` | **LEGACY / OPTIONAL** | Targets `/jobs?search=`. Google removed the sitelinks search box in 2024, so this is **not a current Google rich-result advantage** and must not be counted as one. Harmless to retain for semantic consumers |
| WebPage | CURRENT | Several static/CMS pages |
| BreadcrumbList | CURRENT | Widespread |
| Article / BlogPosting | CURRENT | Blog + career articles |
| JobPosting | **SEO-P0 / POLICY RISK** | Emitted on JobDetail (+ internships + ItemList landings). Includes curated/external jobs. **If any listing/ItemList page embeds JobPosting, classify as a P0 CODE DEFECT.** |
| EducationalOrganization | CURRENT | University profile path |
| Course | CURRENT | Exam detail mapping — validate semantic fit |
| Event | **MISSING usage** | Helper defined; webinars not wired |
| FAQPage | **LEGACY / OPTIONAL FOR SEMANTIC CONSUMERS — NO CURRENT GOOGLE FAQ RICH-RESULT BENEFIT** | Keep genuinely useful FAQ content where users need it. Do **not** recommend FAQ schema as a Google SEO growth tactic. Do not spam. |
| Person | NOT APPLICABLE unless truthful authors exist |
| Service | **MISSING / PARTIAL** | `schema.org/Service` may help semantic/entity representation for GBS/agent services, but it does **not** currently imply a Google Service rich result — no rich-result benefit is promised |

### JobPosting policy — **SEO-P0 (CRITICAL)**

**Do not treat all STRIDETO jobs as Google for Jobs eligible.** This is elevated to **SEO-P0** because incorrect emission is an eligibility/policy risk, not a growth opportunity.

#### P0 verification requirement — placement

**Required check:** `JobPosting` must be emitted **only on a single eligible job detail page**, exactly once, for that one job.

| Surface | Required behavior |
|---|---|
| Single eligible job detail page | Exactly one `JobPosting` node |
| Listing / index / `ItemList` / SEO landing (`/jobs`, `/jobs-in-*`, category, province, internships list) | **No `JobPosting` markup at all** |
| Any listing/`ItemList` page found embedding `JobPosting` | **P0 CODE DEFECT** — must be removed before any further structured-data work |

#### P0 authorization gate — two distinct classes

**A. Employer-authorized / native job publication**
- STRIDETO has authorization from the hiring organization to publish the posting
- STRIDETO is the application host (or an authorized application route)
- `JobPosting` **may** be emitted if all required fields are truthful and complete

**B. Editorially curated external opportunity**
- Sourced editorially; “Apply on official website”
- **MUST NOT** receive `JobPosting` markup unless STRIDETO has authorization to publish on behalf of that employer
- **Keep indexable as ordinary `WebPage` content** with official-source links (ProvenanceStrip)
- This preserves user value and indexability without asserting job-graph eligibility STRIDETO does not hold

| Job type | Recommendation |
|---|---|
| A — Employer-authorized post with STRIDETO as application host | `JobPosting` **may** be appropriate if fields meet Google Jobs requirements |
| B — Editorially curated external opportunity | **No `JobPosting`.** Indexable `WebPage` content + official source link |
| Closed / expired / draft | Suppressed in schema helper — CURRENT; verify expired-job behavior end to end |

Acceptance criteria for any JobPosting emission: detail-page-only placement, authorized hiring-org identity, valid `validThrough`, truthful application URL, structured-data/visible-content parity, and an explicit product-policy flag (e.g. `jobsGraphEligible`).

---

## 7. Sitemap strategy

**CURRENT:** Single `/sitemap.xml` aggregating static + dynamic URLs.

**Recommendation (when scale justifies):**

| Sitemap | Trigger |
|---|---|
| Keep single file | While URL count remains manageable |
| Sitemap index + jobs/scholarships/programs/blog/services | When XML size/latency or Update cadence needs isolation |

Always exclude: draft, archived (non-public), fixtures, private paths.
**Gap:** Deadline-expired but still `status: active` can remain in sitemap — freshness/expiry automation is **SEO-P5**.

---

## 8. Opportunity SEO model (jobs / scholarships / internships)

### Intent examples → page strategy

| Intent | Approach | Min content/data before indexing |
|---|---|---|
| “software engineering jobs in UAE” | Filtered jobs landing **only if** ≥N live jobs + unique intro | Live count, country, role taxonomy, last updated |
| “fully funded scholarships for Pakistani students” | Scholarship hub + country/eligibility facets | Funding type, eligibility, deadline, source |
| “remote internships for students” | Internship filters / landing | Work mode, paid flag, deadline |

**Do not** mass-generate thin keyword pages. Prefer:

1. Canonical entity pages (Job/Scholarship/Internship detail)
2. High-signal hubs with real counts
3. Editorial guides linking to live inventories

---

## 9. Program / university / test SEO

Map query families to entities:

| Query family | Entity | Data sufficiency |
|---|---|---|
| universities in Ireland… | CanonicalInstitution | **DATA/OPS REQUIRED** locally empty; model exists |
| CS programs in Ireland | Program | Model + explorer CURRENT; density DATA/OPS |
| universities accepting IELTS 6.5 | TestAcceptance + Institution/Program | Acceptance explorer CURRENT; public SEO pages PARTIAL |
| University X tuition / requirements | Program fields + sources | ProvenanceStrip helps; completeness DATA/OPS |

---

## 10. Service / dashboard awareness SEO

Private dashboards: **NOINDEX** (correct).

### Recommended public persona landings (MISSING — recommend only)

| Route | Audience | Real capabilities to describe | CTA |
|---|---|---|---|
| `/for-students` | Students | Jobs/scholarships/programs/tests, save, applications, resume, guidance | Sign up / explore |
| `/for-employers` | Employers | Job posting, candidates, employer workspace | Employer login/register |
| `/for-institutions` | Institutions | Programs, test acceptance, scholarships, claims | Institution portal |
| `/for-education-agents` | Agents | Profiles, marketplace, consultations | Agent portal |
| `/for-service-providers` | GBS providers | Listings, requests | Provider entry |

### Service-specific pages — only if mapped to real features

Examples that map to product surfaces: career guidance, admissions support, education consulting, document review, application support, visa **guidance** (not legal advice claims).

Each page needs: search intent, workflow explanation, trust proof, CTA, internal links — **not** indexed dashboard URLs.

Structured data: `Service` / `WebPage` where truthful; avoid fake reviews. Note: `schema.org/Service` may improve semantic/entity representation for AI and non-Google consumers, but it does **not** currently produce a Google Service rich result — do not plan it as a rich-result win.

---

## 11. Topical authority map

| Cluster | Pillar | Directory | Detail | Guides | Comparisons |
|---|---|---|---|---|---|
| Jobs | `/jobs` | SEO landings (conditional) | `/jobs/:slug` | Career blog | Role/location only if dense |
| Scholarships | `/scholarships`, `/intl-scholarships` | Country hubs | detail | Funding guides | Funding type tables |
| Internships | `/internships` | filters | detail | Student guides | Paid/remote |
| Admissions | `/admissions` | — | detail | Timeline guides | — |
| Study abroad | `/foreign-studies` | — | detail | Visa **info** (disclaimer) | Country |
| Institutions/Programs | explorers | institutions/programs | slug details | Requirement explainers | Program compare (exists) |
| Tests | `/tests` | — | detail | Prep guides | Acceptance explorer |
| Agents / GBS | `/agents`, `/business-services` | marketplace | public profiles/listings | “How hiring an agent works” | — |
| Career prep | `/career-guidance`, resume | — | articles | How-tos | — |

Internal links: opportunity ↔ institution ↔ program ↔ test ↔ guide. Prefer contextual, not stuffing.

---

## 12. E-E-A-T / trust

| Asset | Status |
|---|---|
| About / Contact | CURRENT |
| Privacy / Terms / Cookies / Disclaimer / Refund | CURRENT |
| ProvenanceStrip (source, last reviewed, freshness) | CURRENT on key education/job surfaces |
| Editorial / correction policy pages | **MISSING / PARTIAL** |
| Author/reviewer attribution on Blog | **PARTIAL / DATA REQUIRED** |
| Official social sameAs | PARTIAL (LinkedIn only confirmed — correct restraint) |
| Verification / claim language | CURRENT in product copy patterns |

Do not fabricate endorsements, university partnerships, or awards.

---

## 13. Off-page SEO strategy

| Channel | Value |
|---|---|
| University career centers, student societies, education orgs | **HIGH** |
| Employer/career publications, study-abroad publishers | **HIGH–MEDIUM** |
| Professional associations, research/data reports | **HIGH** |
| Relevant communities (non-spam) | **MEDIUM** |
| Mass directories, PBNs, paid spam links, irrelevant guest-post farms | **AVOID** |

Plan: original data reports (deadlines, acceptance patterns), partner resource pages, ethical PR — not link schemes.

---

## 14. Brand / entity SEO

| Item | Status |
|---|---|
| Organization schema | CURRENT |
| sameAs | PARTIAL (LinkedIn) |
| Consistent naming “Strideto” | CURRENT in product |
| About + founder/company identity | PARTIAL — expand only with truthful facts |
| Distinctiveness vs similarly named brands | **EXTERNAL + content** — clear About, LinkedIn, press kit |

---

## 15. Local / international search

Geography pages only when **real inventory or editorial depth** exists (Pakistan, UK, Ireland, Australia, USA, Germany, UAE, Canada, …).

Avoid doorway location spam. Prefer country facets on real directories + guides with sources.

---

## 16. Answer usefulness + AI citation readiness (AEO / GEO)

> **Clarification (important):** For **Google Search**, AEO and GEO are **not separate technical ranking systems**. AI surfaces are generated from Google's ordinary web index. **Core SEO remains foundational** — crawlable, indexable, accurate, genuinely useful pages. **No special AI markup and no AI-specific rewriting is required.** Everything below is content-usefulness and citability work, not a parallel optimization channel.

| Term | STRIDETO meaning |
|---|---|
| **SEO** | Discoverability in classic web search (crawl, index, rank) — the foundation |
| **AEO** | Answer Engine Optimization — writing concise, citable answers. **A content practice, not a Google ranking system** |
| **GEO** | Generative Engine Optimization — entity-clear, source-backed pages AI systems can quote. **A content practice, not a Google ranking system** |

**Overlap:** Fact density, official sources, freshness, structured data, clear headings, original data — all of which are ordinary good SEO.

**Citation-worthy page traits:** direct answer near top, bullet facts, tables, last verified, outbound official links, no hype guarantees.

Do not invent proprietary ranking factors for AI Overviews / Copilot / ChatGPT / Perplexity, and do not build AI-specific page variants or markup.

---

## 17. 2026 search behavior → STRIDETO mapping

| Mode | Example | Page | Needs |
|---|---|---|---|
| Short | “software jobs dubai” | Jobs + UAE filter / landing | Density gate |
| Long-tail | “software engineer jobs in dubai for pakistani graduates” | Jobs + guide | Eligibility honesty |
| Conversational | “remote software internships still accepting international students” | Internships + freshness | Live deadlines |
| Decision | “best platform for scholarships and university programs abroad” | `/for-students` + About | **MISSING landing** |
| AI assistant | fully funded CS scholarships IELTS + deadline | Intl/CMS scholarships + TestAcceptance | Structured facts |
| Service discovery | “education consultant for Ireland application” | Agents / services landings | Trust + CTA |

---

## 18. Internal linking architecture

Recommended relationships (contextual):

- Job → Company (if public) → related Jobs → career guide
- Scholarship → University/Country → Program → guide
- Institution → Programs → Accepted Tests → Scholarships
- Program → Institution → Tests → Admissions requirements
- Test → Institutions/Programs accepting it
- Blog guide → live opportunities
- Agent/GBS → service types → request/consultation flow

---

## 19. Freshness / expiry SEO

| Entity | Publish | Update | Verify | Expire behavior |
|---|---|---|---|---|
| Jobs/Internships/Scholarships | status active | updatedAt | Provenance where wired | Prefer archive/noindex/redirect when deadline passed — **PARTIAL** |
| Programs/Tests/Acceptance | PUB_STATUSES | lastVerifiedAt | freshnessState | Supersede acceptance CURRENT |
| Blog | published | updatedAt | editorial | Malformed content **DATA** |
| Events/Webinars | | | | Event schema unused |

**IndexNow:** Recommended in SEO-P5; **not implemented** (no code references). Do not implement in this batch.

---

## 20. Search Console / Bing / Analytics checklist

**EXTERNAL CONFIG REQUIRED** (unless proven live):

- [ ] Google Search Console property + domain verification
- [ ] Sitemap submit `https://strideto.com/sitemap.xml`
- [ ] URL Inspection sampling of key templates
- [ ] Core Web Vitals / Page indexing / Enhancements
- [ ] Bing Webmaster Tools + sitemap
- [ ] IndexNow key (future)
- [ ] **Google Search Console generative AI performance reporting** — AI Overviews / AI Mode traffic surfaced inside Search performance data; track as ongoing measurement
- [ ] Bing AI performance reporting where available
- [ ] Analytics: organic landings, signup attribution, Apply clicks, Save, program explore, service-request, agent consultation

Docs reference these (`docs/POST_LAUNCH.md`, `docs/SEO_PRODUCTION_CHECKLIST.md`) — not proof of live wiring.

---

## 21. Core Web Vitals / performance risks

| Risk | Evidence | Priority |
|---|---|---|
| Fonts | Google Fonts stylesheet in `index.html` | LCP/INP — medium |
| Large JS | Lazy routes help; vendor/PDF/builder chunks large | INP — medium |
| Ads | Consent-gated AdSense | CLS/INP — monitor |
| Images | Lazy + some dimension handling | CLS — partial mitigation |
| Skeletons | Common | CLS — usually OK if sized |

No broad performance refactor in this batch.

---

## 22. SEO security / spam risk

| Risk | Mitigation |
|---|---|
| UGC employer/agent/institution/provider content | Moderation + publication gates (CURRENT patterns) |
| Duplicate / thin listings | Fixture exclusion + status gates |
| Keyword stuffing / doorway pages | Density gates on SEO landings |
| Malicious links | Sanitization + trusted source fields |
| Fake testimonials | Do not invent; moderation |
| Low-quality AI Blog copy | Editorial standards + **production data inspection** |

---

## 23. STRIDETO internal SEO maturity scorecard (0–10 with evidence)

| Dimension | Score | Why |
|---|---|---|
| Technical SEO | 7 | robots/sitemap/canonical solid; JS render/index status unproven in production |
| Indexability | 7 | Private blocked well; public discovery good |
| On-page SEO | 6 | Templates exist; content quality uneven |
| Structured data | 6 | Broad helpers; JobPosting placement/authorization policy (P0) + Event unused |
| Internal linking | 5 | Some related/breadcrumbs; no systematic cluster graph |
| Content quality | 4 | Production Blog malformations; uneven depth |
| Topical authority | 5 | Strong entity model; thin public education of it |
| Freshness | 5 | Provenance good; expiry/sitemap lag |
| E-E-A-T / Trust | 6 | Legal + provenance; editorial policy thin |
| Off-page authority | 3 | Early; LinkedIn only confirmed |
| Brand/entity | 5 | Schema + LinkedIn; limited sameAs/press |
| Jobs SEO | 6 | Landings + schema; policy risk on external jobs |
| Education SEO | 6 | Canonical entities strong; public density DATA |
| Service discovery SEO | 3 | Portals private; `/for-*` missing |
| International SEO | 5 | Country facets exist; avoid thin geo spam |
| Answer usefulness / AI citation readiness | 5 | Fact/provenance culture helps; answer pages thin |
| Performance/CWV | 5 | Lazy routes; fonts/chunks/ads risks |
| Measurement tooling | 2 | Docs only — EXTERNAL CONFIG |

**STRIDETO INTERNAL SEO MATURITY:** ~**5.5 / 10**.

This is an **internal, self-assessed maturity index** defined by this document's own dimensions and evidence. It is **not** a Google score, not a Google-recognized metric, and not a comparison against any external benchmark or peer set. Use it only to track STRIDETO against itself over time. Acquisition SEO and measurement are the weakest dimensions.

**TARGET 10/10 STATE:** Crawlable public shells or selective SSR for money pages; policy-safe structured data; persona/service landings; dense canonical education graph; clean production content; IndexNow + Search Console/Bing live; ethical off-page entity strength; CWV green on LCP/INP/CLS for key templates.

### Top 5 highest-impact gaps

1. JobPosting placement + authorization policy (detail-page-only; curated external jobs unmarked) — **P0**
2. Production indexability truth: live robots/sitemap, canonical host, real 404 status, rendered/indexed evidence in GSC — **P0**
3. Public persona/service acquisition pages (`/for-*`)
4. Search Console / Bing / analytics wiring
5. Production Blog (and similar) content quality / editorial process

---

## 24. Implementation roadmap (do not implement in this batch)

### SEO-P0A — Production indexability truth

Establish what production actually does before changing architecture.

- **Live robots** — verify `https://strideto.com/robots.txt` served in production; align static `client/public/robots.txt` with `robotsPolicy.js`
- **Live sitemap** — verify `https://strideto.com/sitemap.xml` responds, is valid XML, and contains only intended URLs
- **Canonical host redirect** — one canonical host (www vs non-www) + HTTPS, enforced with 301 at host/CDN level
- **True 404 HTTP status** — unknown routes must return HTTP 404 (not 200 with SPA 404 UI)
- **Rendered / index status** — GSC URL Inspection on one URL per money template: is the *rendered* HTML complete, and is the URL indexed? Read Page indexing reports for exclusion reasons
- **GSC verification** — property verified, sitemap submitted, reports readable

Only after this evidence exists should SSR or broader prerender be considered — and then as an **architectural option**, not a defect remedy.
**Code + EXTERNAL CONFIG** | Risk: low–med | Impact: high

### SEO-P0B — Structured-data policy safety

- **JobPosting detail-page-only check** — audit every emission site; any listing/`ItemList` page embedding `JobPosting` is a **P0 CODE DEFECT**
- **Authorization gate** — emit `JobPosting` only for employer-authorized/native postings; curated external opportunities stay indexable `WebPage` content with official-source links
- **Expired-job behavior** — expired/closed/draft postings must not emit `JobPosting`; define archive / noindex / redirect behavior and sitemap removal
- **Structured-data / content parity** — every structured-data claim must be visibly present and truthful on the page

**Code + policy** | Risk: med (eligibility/policy) | Impact: high

### SEO-P1 — Public service/persona acquisition pages
- Add `/for-students|employers|institutions|education-agents|service-providers` mapped to real capabilities
**Code + content** | Risk: med | Impact: high

### SEO-P2 — Structured data / entity (beyond P0B)
- Wire `Event` for webinars if truthful; `Service` schema for public GBS carefully — for semantic/entity representation, **not** a Google rich result
- Keep `WebSite`; treat `SearchAction` as legacy/optional (no current Google benefit)
- Keep useful FAQ content; `FAQPage` markup is legacy/optional with no current Google rich-result benefit — not a growth tactic
**Code + policy** | Risk: med | Impact: med–high

### SEO-P3 — Jobs/scholarship/program search architecture
- Density gates for SEO landings; map TestAcceptance into public explainers
**Code + DATA** | Risk: thin-content if rushed | Impact: high

### SEO-P4 — Internal linking + content clusters
- Related entities components; pillar guides with sources
**Code + editorial** | Impact: med–high

### SEO-P5 — Freshness / IndexNow
- Expire/archive rules in sitemap; IndexNow on publish/unpublish
**Code + EXTERNAL** | Impact: med

### SEO-P6 — Off-page / entity authority
- Press kit, partner pages, LinkedIn cadence, selective high-value citations
**Ops** | Impact: med (slow)

### SEO-P7 — Answer usefulness + AI citation readiness
- Answer blocks, comparison tables, last-verified facts near H1
- Not a separate technical ranking system for Google; core SEO remains foundational and no AI-specific markup or rewriting is required
**Editorial + light code** | Impact: med

### SEO-P8 — Measurement / continuous optimization
- GSC/Bing/analytics dashboards; quarterly query→page reviews
- **Google Search Console generative AI performance reporting** as part of ongoing measurement
**EXTERNAL + ops** | Impact: high (enables learning)

---

## 25. DATA gaps

- Local DB often lacks canonical institutions/programs/tests — public education SEO cannot be fully behaviorally proven locally
- Production Blog malformed records: **PRODUCTION DATA INSPECTION REQUIRED**
- Country/scholarship inventory density varies by market

## 26. EXTERNAL CONFIG gaps

- Google Search Console / Bing Webmaster verification & sitemap submission
- Host-level www/HTTPS/404
- Analytics organic conversion events
- IndexNow (future)
- Broader official social profiles only when real

---

## 27. UI micro-fix note (same batch, separate from SEO implementation)

- Intl Scholarships listing: `grid gap-4 sm:grid-cols-2` so a single card occupies one column on tablet/desktop
- Blog/home fallback: brand `Icon name="document"` replaces sparkle `✦`

These do not change SEO contracts.

---

## 28. SEO-P0A / SEO-P0B implementation evidence (2026-08-27)

Implemented against baseline `a6ad681d7f13ddbf8c6c4ab7a23e279155f8df54`. Live probes were read-only; no production data was mutated. Regression coverage: `server/src/__tests__/seoP0IndexabilityAndJobPostingPolicy.test.js` (161 checks).

### Canonical host — corrected finding

Production has **already established `https://www.strideto.com`** as the canonical origin, in two independent places:

- `https://strideto.com/*` answers **308 → `https://www.strideto.com/*`** (the http apex 308s to the https apex first)
- the deployed API's generated sitemap emits `https://www.strideto.com/...`, and the deployed client bundle carries `VITE_APP_URL=https://www.strideto.com`

The repository defaults still named the **apex** host (`PRODUCTION_PUBLIC_ORIGIN`, `BRAND_SITE_URL`, `render.yaml`, the static `robots.txt` Sitemap line, `client/index.html` social URLs). Any build or deploy without the live env overrides would emit canonicals, hreflang, OG URLs and sitemap URLs pointing at a **redirecting** host. Repository defaults were aligned to the www host, and `resolvePublicSiteOrigin()` now normalizes a configured apex origin to www so stale configuration cannot reintroduce the drift. Non-SEO apex references (CORS/cookie trusted origins, email and referral link defaults) were deliberately left alone — a different contract, out of P0 scope.

### SEO-P0A — Production indexability truth

| Item | Status | Evidence |
|---|---|---|
| Live robots reachable | **CURRENT** | `https://www.strideto.com/robots.txt` → `200 text/plain`. Vercel serves the **static** `client/public/robots.txt`; the API's dynamic route is not reachable at the public origin |
| Static ↔ shared policy alignment | **FIXED** | Static file regenerated from `buildRobotsTxt(PRODUCTION_PUBLIC_ORIGIN)`; a test asserts content equality so the two can no longer drift |
| Public acquisition routes unblocked | **FIXED** | The live static robots carried `Disallow: /business`, which **also blocked public `/business-services`** (a sitemap-eligible acquisition surface). Replaced with `/business/`, matching the existing `/agent/` vs `/agents` trailing-slash convention. Added to `PRIVATE_SEO_PREFIXES` and `FORBIDDEN_SITEMAP_PATHS` so the private buyer workspace stays noindex and out of the sitemap |
| Live sitemap reachable | **FIXED (deploy required)** | `https://www.strideto.com/sitemap.xml` returned **`200 text/html` — the SPA shell**, not XML: the Vercel catch-all rewrite swallowed it, so production had **no working sitemap**. A `/sitemap.xml` rewrite to the generator was added ahead of the catch-all. The generator itself is correct — `https://api.strideto.com/sitemap.xml` returns valid XML with 111 canonical www URLs |
| Sitemap content correctness | **CURRENT** | Active/published records with a slug only, fixture-excluded, private paths guarded by `isForbiddenSitemapPath`; a single file is right at this scale (111 URLs) |
| Canonical host redirect | **CURRENT (infra) / FIXED (code)** | Apex→www 308 already enforced at the edge; repository defaults and the origin resolver aligned to it |
| True 404 HTTP status | **DEFERRED — documented, not faked** | `https://www.strideto.com/nonexistent-seo-probe-xyz` returns **200**. This cannot be fixed correctly at the edge under the current architecture: detail routes are DB-resolved slugs, so no static rewrite rule can tell a real `/jobs/<slug>` from a fake one, and narrowing the catch-all would break React routing for valid URLs. A correct 404 needs an SSR/edge function with data access — an architectural decision, not a P0 config toggle. The SPA 404 view does emit `noindex`, so bad URLs are not indexed; soft-404 handling is left to Google unless SSR is adopted |
| Rendered / index status | **PARTIAL — PRODUCTION EVIDENCE REQUIRED** | Raw shells are empty (3.1 KB, no title/canonical/JSON-LD before JS), as expected for a Vite SPA. Confirming whether Google's *rendered* HTML is complete requires GSC URL Inspection; the browser tool was unavailable in this session. Per §3 this is **not** classified as a defect |
| Shell default `robots` meta | **PARTIAL** | `client/index.html` hardcodes `index, follow`; Helmet overrides it after render (including `noindex` on private and 404 views). Pre-render crawler snapshots see the permissive default. Not changed — flipping the shell default would risk noindexing real pages if hydration fails |
| GSC verification / sitemap submission | **EXTERNAL CONFIG REQUIRED** | Not verifiable from the repository. Resubmit `https://www.strideto.com/sitemap.xml` **after** the sitemap rewrite deploys |
| Crawlable `href` pagination | **PARTIAL — DEFERRED** | `Pagination` uses buttons, and page/filter state is component state that is never pushed to the URL. Page 2+ is therefore not crawlable — but it also creates **no duplicate indexable URLs**, and every detail record is reachable from the sitemap. Making pagination crawlable requires a URL-state refactor across every listing surface, which is beyond P0A |
| Filter/sort canonical control | **CURRENT** | `/jobs` self-canonicalizes to `/jobs` regardless of query, so `?category=` / `?search=` variants never become separate index URLs. SEO landings each emit one stable canonical. `?lang=` is handled as an hreflang alternate, not a canonical |
| `rel=prev`/`rel=next` | **NOT IMPLEMENTED BY DESIGN** | Google no longer uses it (§3) |

### SEO-P0B — Structured-data policy safety

Policy is centralized in `shared/seo/jobPostingEligibility.js` — one decision point for every JobPosting emission in the product.

| Item | Status | Evidence |
|---|---|---|
| JobPosting emission inventory (before) | — | `JobDetail.jsx` (detail), `InternshipDetail.jsx` (detail), and — via `itemListSchema`'s `itemType: 'JobPosting'` default — `SEOJobsPage.jsx`, `JobsCategoryLanding.jsx`, `JobsProvinceLanding.jsx` (**ItemList landings**) |
| Listing / `ItemList` embedding JobPosting | **FIXED — was a P0 CODE DEFECT** | Three SEO landing families embedded a full `JobPosting` object per item, claiming Google for Jobs eligibility for every listed job on a collection page. `itemListSchema` no longer constructs JobPosting at all; job items are now plain summary `ListItem`s (name + detail URL). `ItemList` itself is retained |
| Detail-page-only placement | **FIXED** | `jobPostingSchema` requires an explicit `surface`; anything other than `JOB_POSTING_SURFACES.DETAIL` returns `null`, and an **omitted** surface fails closed. A repository-wide test asserts `JobDetail.jsx` is the only caller and that JobPosting is constructed in exactly one helper |
| Authorization gate | **FIXED** | Emission requires `jobsGraphEligible === true`. Authorization is **never inferred**: external apply URL, `sourceUrl`, `sourceWebsite`, employer name and `employerId` are explicitly not consulted, each covered by a negative test |
| A. Employer-authorized / native | **FIXED** | `employerController.createJob` is the single grant point — the hiring organization is authenticated there and is publishing its own vacancy. The job still has to clear moderation before it is public at all |
| B. Curated external opportunity | **FIXED** | Stays `jobsGraphEligible: false` → **no JobPosting**, while remaining fully public, canonical, crawlable and indexable as ordinary `WebPage` / CollectionPage content with its official-source link (ProvenanceStrip). No eligibility claim, no loss of discoverability |
| Default false / no back door | **FIXED** | Schema default `false`; the public projection normalizes a missing flag to `false`; the admin CMS write allowlist (`applyJobBody`) cannot set it, so no admin action implies authorization; **no migration** and no backfill — every pre-existing record stays `false` |
| Duplication safety | **FIXED** | `jobsGraphEligible` classified **RESET** in `JOB_DUPLICATE_RESET_FIELDS`: an admin fork of an employer's job was not published by that employer, so copying the flag would manufacture eligibility nobody authorized |
| Expired / closed / draft | **FIXED** | `isJobPostingPubliclyOpen` rejects non-active status, every non-public `publicationState`, `acceptingApplications: false`, non-open availability, and a past `deadline` / `applicationsCloseAt` / `visibleUntil`. Twelve cases covered |
| Structured-data / content parity | **FIXED** | Eligibility requires title, description, hiring organization, `datePosted`, `validThrough` and a location; the emitter now reads the **same** sources the gate checked. A genuinely remote job declares `jobLocationType: TELECOMMUTE` rather than a fabricated address |
| Internships | **FIXED** | The `Internship` model has **no employer linkage and no authorized-publisher workflow**, so every internship on STRIDETO is an editorially curated external opportunity and none can be authorized today. `InternshipDetail.jsx` no longer emits JobPosting; it emits `WebPage` and stays canonical and indexable. No dead eligibility field was added to the model — any future authorized-internship workflow must route through the same shared policy |

### Other structured data — audited, narrow corrections only

| Type | Action |
|---|---|
| `Organization`, `WebSite`, `BreadcrumbList`, `Article` / `BlogPosting` | **KEPT unchanged** |
| `SearchAction` | **KEPT** — legacy/optional, no change made, no Google benefit claimed |
| `FAQPage` | **KEPT** — no change; not treated as a growth tactic |
| `Service` | **KEPT** — semantic/entity value only, no rich result promised |
| `Course` / `EducationalOrganization` | **KEPT** — semantically accurate on their surfaces |
| `Scholarship` inside `ItemList` | **KEPT** — carries no Google eligibility claim, unlike JobPosting |
| `ItemList` on job landings | **NARROWED** — summary ListItems only |

### EXTERNAL CONFIG REQUIRED

- Deploy the client so the `/sitemap.xml` rewrite takes effect, then re-verify that `https://www.strideto.com/sitemap.xml` returns `application/xml`
- Google Search Console: verify the **`https://www.strideto.com`** property, resubmit the sitemap after that deploy, and read URL Inspection / Page indexing for the rendered/index evidence §3 requires
- Bing Webmaster Tools + sitemap; GSC generative AI performance reporting (§20)
- Align the deployed Render/Vercel env values with the now-www repository defaults (production is already www; `render.yaml` was the stale copy)
- A true edge 404 remains an architectural decision (SSR / edge function), not a config toggle

### DATA/OPS REQUIRED

- `jobsGraphEligible` is `false` for every existing record by design. Any employer-authorized job posted **before** this change stays ineligible until it is re-posted through the employer workflow or explicitly granted by an authorized operational process. This is deliberate: no migration may assert publication authority on an employer's behalf
- Production Blog content quality (§5) is unchanged and still requires editorial inspection

### Remaining P0 blockers

1. **Deploy and re-verify the sitemap route.** Until the rewrite ships, `https://www.strideto.com/sitemap.xml` still returns the SPA shell and production effectively has no sitemap.
2. **GSC rendered/index evidence** is still unobtained (browser tooling unavailable this session), so §3's JavaScript render/index reliability stays PARTIAL rather than CURRENT.

### Pre-existing failure noted, not introduced here

`server/src/__tests__/adminJobDuplicateBoundaryRegression.test.js` **already failed at baseline `a6ad681`**: 14 `Job` schema fields added by earlier work (`countryCode`, `region`, `workMode`, `jobFamily`, `specialization`, `openingsCount`, `submittedAt`, `chargedSubmissionAt`, `postedByEmployerId`, `isFixture`, `dataClass`, `environment`, `launchEligible`, `demoOnly`) are unclassified in the PRESERVE/RESET/FORBID inventory. `jobsGraphEligible` **was** classified, and the RESET count expectation was updated accordingly. Closing the pre-existing drift is an admin-duplication concern, out of SEO-P0 scope.

---

*End of audit document.*
