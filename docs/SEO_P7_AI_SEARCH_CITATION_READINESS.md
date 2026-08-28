# SEO-P7 — AI Search, Answer Engine, and Citation Readiness

Operational and architectural record for STRIDETO SEO phase P7. This phase improves **human-visible factual clarity** and **source attribution** on public entity pages. It does **not** implement AI ranking hacks, mass Q&A pages, or third-party AI APIs.

## Principles (current official guidance)

### Google Search / AI Overviews / AI Mode

- Generative AI search still relies on core crawl/index/snippet systems.
- Useful, original, clearly structured public content helps users and systems alike.
- There is **no special AI schema** required.
- Google Search does **not** use `llms.txt` for these systems.
- Query fan-out does **not** mean creating a separate page for every query variation.
- Rewriting content solely for AI systems is unnecessary and can be spam-risk.

### OpenAI / ChatGPT Search

- Public STRIDETO content can appear in ChatGPT search when crawlable.
- **OAI-SearchBot** (search/snippets/citations) is distinct from **GPTBot** (possible model-training use).
- STRIDETO wants public search discoverability; wildcard robots policy already allows public paths.

### Bing / Copilot

- Normal crawl/index/canonical quality and clear evidence still matter.
- P5 IndexNow continues to handle freshness acceleration.
- Bing AI Performance measurement belongs to **P8**.

## Crawler access matrix (P7 audit)

| Crawler / control | Current rule | Public content access? | Private route access? | Training vs search | P7 action |
|---|---|---|---|---|---|
| `Googlebot` | `User-agent: *` + shared disallows | Yes (non-disallowed paths) | Blocked on disallow paths | Search indexing | **No change** |
| `Bingbot` | Same wildcard policy | Yes | Blocked | Search indexing | **No change** |
| `OAI-SearchBot` | Same wildcard policy (no explicit group) | Yes | Blocked | ChatGPT search / citations | **No change** — redundant group not added |
| `GPTBot` | Same wildcard policy (no explicit group) | Yes (unless owner adds rule later) | Blocked | Possible training | **Report only — unchanged** |
| `Google-Extended` | Not configured | N/A | N/A | Separate from Search crawl | **Audit only — unchanged** |

Private paths remain aligned between `robots.txt` (`shared/seo/robotsPolicy.js`) and page-level `noindex` (`PRIVATE_SEO_PREFIXES`).

## OAI-SearchBot decision

**Keep wildcard policy.** A dedicated `User-agent: OAI-SearchBot` group is **not** added because:

1. Wildcard `Allow: /` already permits public content for all crawlers.
2. A malformed specific group could override wildcard disallows and accidentally expose private routes.

Conceptual tests live in `server/src/__tests__/seoP7AiSearchCitationReadiness.test.js` (`shared/seo/robotsCrawlerAccess.js`).

## GPTBot decision

**Unchanged.** No explicit GPTBot block or allow group was present at P7 baseline. Training opt-out remains an owner policy decision separate from ChatGPT search inclusion.

## Google-Extended decision

**Unchanged.** No explicit rule added or removed.

## llms.txt decision

**Do not create.** No `llms.txt` / `llms-full.txt` existed at baseline and no documented consumer requires it for STRIDETO.

## Snippet controls

- No `data-nosnippet`, `nosnippet`, or `max-snippet` added in P7.
- Private content stays private via auth + `noindex` + robots disallow — not snippet hiding.

## Source authority (P7 correction)

URL safety (`publicHttpUrlOrNull`) and source authority are **separate**:

| Level | Meaning | Example fields |
|---|---|---|
| `EXPLICIT_OFFICIAL` | Model/field name establishes official semantics | `CanonicalInstitution.officialWebsite`, `Program.officialProgramUrl` |
| `EXTERNAL_APPLICATION` | Public apply destination; not proven canonical official domain | `Job.applicationLink`, `Scholarship.link`, `Internship.applicationLink`, `CanonicalScholarship.applicationUrl` |
| `PUBLIC_REFERENCE` | Listing/reference URL | `Job.sourceUrl`, `Admission.sourceUrl`, `Program.admissionRequirementsUrl` |

Resolvers live in `shared/seo/sourceAuthority.js`. UI uses `PublicSourceLink` with **explicit labels** from resolvers — never inferred from URL hostname.

Labels avoid "Verified source" / "Official job source" for curated external application links.

## Answer usefulness / fact-summary policy

Shared UI:

- `client/src/components/public/KeyFacts.jsx` — visible `<section>` + `<dl>` summary; omits empty/`Not specified`/`Not configured` values.
- `client/src/components/public/PublicSourceSection.jsx` — restrained source area heading.
- `client/src/components/public/PublicSourceLink.jsx` — safe external link with explicit caller label (`shared/seo/sourceAuthority.js`).
- `ProvenanceStrip` updated to require `linkLabel` with `sourceUrl`.

Rules:

- Facts come **only** from persisted/public fields.
- No LLM summaries, no fabricated salary/funding/ranking language.
- Job employer ≠ Strideto unless employer-posted truth says so.
- Scholarship provider ≠ Strideto unless data says so.
- `updatedAt` ≠ “verified today”; no “last checked” without review timestamp.

Detail pages updated to surface Key Facts near H1:

- Jobs (refactored to KeyFacts; compensation omitted when absent)
- Internships
- CMS Scholarships
- Intl Scholarships
- Canonical Scholarship Intelligence (KeyFacts + source section)
- Admissions
- Foreign Studies
- Canonical Institutions (Education explorer detail)
- Program Explorer detail

Blog (P1 architecture preserved):

- Author, published/updated, TOC, editorial policy link unchanged.
- Excerpt shown when authored; **no auto Key Takeaways**.
- Sources remain editor-authored inside article HTML.

## FAQ / AI structured data

- **No FAQPage schema** added.
- **No** `AIAnswer`, `LLMContent`, or similar invented types.

JobPosting P0 eligibility rules unchanged.

## Google Preferred Sources affordance

**Decision: DEFER**

STRIDETO is primarily an opportunities/education discovery product, not a daily publication feed. A domain-level “Add Strideto as preferred source” CTA does not yet add clear, non-intrusive user value on Blog/Press alone. Revisit if editorial volume and user demand justify it.

## ChatGPT referral readiness (P7 scope)

- No analytics or link rewriting in P7.
- Existing router/analytics must not strip `utm_source=chatgpt.com` landings (measurement in **P8**).

## Bing AI visibility

- IndexNow (P5) unchanged.
- Bing AI Performance API/dashboard deferred to **P8**.

## Live acceptance checks (post-deploy)

1. `curl -s https://www.strideto.com/robots.txt` — wildcard policy, disallows intact, sitemap line present.
2. Public URL (e.g. `/jobs/...`) — reachable; no robots conflict.
3. Private URL (e.g. `/admin`) — disallowed in robots; page `noindex` if reachable when authenticated.
4. Job detail — Key details section; employer explicit; salary omitted when absent; official job source link when URL stored.
5. Scholarship detail — provider explicit; official application link when stored.
6. Institution detail — official website + program/test counts when present.
7. Program detail — institution link + Key details; tuition only when stored.
8. Blog with Sources section in CMS — links visible and clickable in rendered HTML.
9. Blog without author — no fake byline.
10. `https://www.strideto.com/llms.txt` — should **404** (unless owner later chooses otherwise).
11. Sitemap + IndexNow regression (P5).
12. View page source / DOM — Key Facts text present without login-only gating.
13. Mobile 320px — Key Facts grid wraps; no horizontal overflow on long URLs.

## WAF / CDN note

Production Cloudflare/Vercel/Render bot mitigation cannot be proven from repo code alone. Confirm OAI-SearchBot receives HTTP 200 on public pages during operational review.

## Intentionally deferred

- P8: GSC generative reports, Bing AI Performance dashboard, ChatGPT referral dashboards, citation KPIs.
- SSR / SPA unknown-route-200 migration (global architecture).
- `llms.txt` unless a documented consumer requires it.
- Google Preferred Sources UI (DEFER).
- GPTBot / Google-Extended policy changes without owner decision.
- Mass Q&A / query-fanout routes.
- Third-party AI content optimization APIs.

## Tests

```bash
node server/src/__tests__/seoP7AiSearchCitationReadiness.test.js
```

Regression bundle (also run after P7 changes):

```bash
node server/src/__tests__/seoP7AiSearchCitationReadiness.test.js
node server/src/__tests__/seoP6EntityAuthorityTrust.test.js
node server/src/__tests__/seoP5FreshnessIndexNow.test.js
node server/src/__tests__/seoP4InternalLinkingClusters.test.js
node server/src/__tests__/seoP3SearchArchitecture.test.js
node server/src/__tests__/seoP2EntityStructuredData.test.js
node server/src/__tests__/seoP1PublicAcquisition.test.js
node server/src/__tests__/seoP0IndexabilityAndJobPostingPolicy.test.js
```
