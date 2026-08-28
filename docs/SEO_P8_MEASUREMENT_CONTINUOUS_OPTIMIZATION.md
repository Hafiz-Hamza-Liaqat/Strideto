# SEO-P8 — Measurement & Continuous Optimization

**Phase:** SEO-P8 (final planned SEO engineering phase)
**Status:** Implementation complete — operational credentials required for live external data
**Baseline:** SEO-P0 through SEO-P7 remain authoritative

---

## 1. Objective

STRIDETO can truthfully answer discovery, AI visibility, referral, conversion, content-group, and technical-health questions — or explicitly report when data is **not connected**, **unavailable**, or **manual**.

**Unknown data = unknown.** Absence is never displayed as zero unless the source explicitly reports zero.

---

## 2. Source-of-truth matrix

| Metric | Source | Unit | Automated? | Manual? | Update cadence | Limitations |
|--------|--------|------|------------|---------|----------------|-------------|
| Google impressions/clicks/CTR/position | GSC traditional Search (`searchanalytics.query`) | impressions/clicks/ratio/position | Yes (when configured) | — | On-demand + 5m cache | Property must be verified; non-prod gated |
| Google GenAI impressions | GSC Generative AI Performance UI | impressions | **No API** | Yes (snapshot import) | Weekly/monthly ops | No clicks/CTR/queries/prompts in official report |
| Bing search clicks/impressions | Bing Webmaster REST `GetQueryStats` | clicks/impressions | Yes (when configured) | — | On-demand + cache | Aggregated query stats only |
| Bing AI citations | Bing AI Performance UI | citations | **No API** | Yes (snapshot import) | Weekly/monthly ops | Citations ≠ clicks/visits/rank |
| ChatGPT referral sessions | First-party `AnalyticsEvent` + `utm_source=chatgpt.com` | sessions | Yes | — | Real-time ingest | No prompt/citation/impression data from OpenAI |
| Application clicks | First-party `application_click` events | events | Yes | — | Real-time | Attribution ≠ causation |
| Page-group views | First-party analytics + `classifyPageGroup` | views | Yes | — | Real-time | Facet URLs classified separately |
| Technical health | Config + shared robots/sitemap/IndexNow policy | status | Yes | — | Per dashboard load | Not a second uptime platform |

---

## 3. Google Search Console

### Traditional Search API

- **Adapter:** `server/src/services/seo/measurement/gscSearchAnalyticsService.js`
- **Scope:** `webmasters.readonly` only
- **Config (server-only):**
  - `GSC_SITE_URL` — verified property (e.g. `sc-domain:strideto.com` or `https://www.strideto.com/`)
  - `GSC_SERVICE_ACCOUNT_EMAIL` + `GSC_SERVICE_ACCOUNT_PRIVATE_KEY`, **or** `GSC_CREDENTIALS_JSON`
  - `GSC_ALLOW_NON_PRODUCTION=1` — optional dev/test override (default: production-only)
- **Never** exposed to frontend JavaScript

### Generative AI Performance report

- **UI report** covers AI Overviews and AI Mode **impressions only** (supported dimensions: pages, countries, devices, dates)
- **Rollout:** report may be unavailable to some properties (`not_available_to_property`)
- **No official `searchanalytics.query` dimension/API** for this dataset (verified SEO-P8)
- **No invented metrics:** no AI clicks, AI CTR, AI queries/prompts, or rankings
- **States:** `connected` / `not_configured` / `report_not_available` / `not_available_to_property` / `manual_import_required`
- **Manual workflow:** Export from Search Console UI → POST `/admin/seo-measurement/snapshots` (requires `admin.data_quality.manage`)
- **Export zero ambiguity:** GSC UI may show `~` or `-` for unavailable cells; exports convert those to numeric `0`. An imported `0` is **not** treated as confirmed zero unless `metricStates.<key> = "zero"` is supplied by the operator.

Example confirmed-zero import:

```json
{
  "provider": "google",
  "dataset": "generative_ai_performance",
  "periodStart": "2026-08-01",
  "periodEnd": "2026-08-28",
  "metrics": { "impressions": 0 },
  "metricStates": { "impressions": "zero" }
}
```

Without `metricStates.impressions: "zero"`, a numeric `0` resolves to `no_sufficient_data` (export ambiguity), not `zero`.

### Generative AI control (operational)

Owner should confirm in Search Console that STRIDETO has **not** opted out of Search generative AI features unless intentional. **No code mutates property controls.**

---

## 4. Bing Webmaster

### Traditional search

- **REST JSON only** — `GetQueryStats` at `ssl.bing.com/webmaster/api.svc/json`
- **Config:** `BING_WEBMASTER_API_KEY`, `BING_SITE_URL`
- **Legacy SOAP/POX prohibited** — not implemented

### AI Performance

- **No official REST API** for AI Performance preview data (Microsoft backlog)
- **Manual export** from [Bing Webmaster AI Performance](https://www.bing.com/webmasters/aiperformance)
- Import via snapshot API: `provider: bing`, `dataset: ai_performance`
- **Deferred:** CSV parser until sample export exists in repository

---

## 5. ChatGPT referral attribution

**Official UTM rule (primary):** `normalize(utm_source) === "chatgpt.com"` — case normalization allowed.

**Not official UTM:** `utm_source=www.chatgpt.com` is **not** treated as the documented OpenAI referral signal.

**Separate referrer-host fallback (secondary):** `chatgpt.com` or `www.chatgpt.com` host in `document.referrer` may classify attribution via `referrer_host` signal only.

- **Rejected:** loose `ai`, `gpt`, `chat`, `openai` substring matching in UTM
- **No claims:** prompts, citations, impressions, or rankings
- **Privacy:** Only `utm_source`, `utm_medium`, `utm_campaign` persisted — not full query strings
- **First-touch:** Stored in `sessionStorage` key `er_acquisition_attribution` for session window

---

## 6. KPI taxonomy

Categories: Search Discovery · AI Visibility · Acquisition · Engagement/Conversion · Content Performance · Technical Health · Freshness/Operations

Definitions: `shared/seo/measurement/kpiTaxonomy.js`

**No universal SEO score** — individual status indicators only.

---

## 7. Page groups

Classifier: `shared/seo/measurement/pageGroups.js`

Groups include: `job_detail`, `scholarship_detail`, `institution_detail`, `blog_article`, persona pages, `facet_landing` (not promoted to approved SEO landing class), `private_dashboard` (excluded).

---

## 8. Trend policy

- Comparisons: 7d / 28d / 90d vs previous period
- Divide-by-zero → `new_activity` or `not_comparable`
- Low volume (&lt;5 combined) → `insufficient_data`
- Average position: lower numeric value is better
- **No statistical significance claims**

---

## 9. Dashboard architecture

- **Admin UI:** `/admin/seo-measurement` (`AdminSeoMeasurement.jsx`)
- **API:** `GET /admin/seo-measurement` (`analytics:read`), `POST /admin/seo-measurement/snapshots` (`admin.data_quality.manage`)
- **Cache:** Redis 5-minute TTL on dashboard payload
- **Snapshots:** `SeoMetricsSnapshot` Mongo model
- **Worker:** Remains **STOPPED** — no scheduled collection dependency

---

## 10. Continuous optimization operating model

### Weekly (30–45 min)

1. Technical health (robots, sitemap, IndexNow config state)
2. IndexNow log failures (ops logs — no key rotation)
3. GSC top impression pages + high-impression/low-CTR opportunities
4. Declining important canonical pages
5. New ChatGPT landing pages (first-party)
6. Bing cited pages / grounding queries (if manual import current)
7. Google GenAI visibility (if report/import available)
8. Content freshness queue items (existing admin freshness)

**No automatic content modification.**

### Monthly (28d vs previous 28d)

Review: Google Search, Google GenAI, Bing Search, Bing AI, ChatGPT referrals, page groups, application clicks, indexability. Record observations separately from causal conclusions.

### Quarterly

Portfolio IA, entity coverage, citation patterns, trust/source quality, technical debt, crawler/platform changes. Avoid mass landing pages from single metrics.

### Opportunity priority

Deterministic buckets HIGH / MEDIUM / LOW via `contentOpportunities.js` — recommendations only.

---

## 11. GSC / Bing manual setup checklist (owner)

### Google Search Console

1. Confirm verified property matches `GSC_SITE_URL`
2. Confirm sitemap submitted
3. Confirm generative AI control (opt-in/out) intentional
4. Locate Generative AI Performance report (may be unavailable to some properties)
5. Export report when needed → manual snapshot import
6. Configure service account + API only if automated traditional Search desired

### Bing Webmaster Tools

1. Verify site
2. Confirm sitemap
3. Review Search Performance + AI Performance dashboards
4. Export AI data manually when needed
5. Configure `BING_WEBMASTER_API_KEY` for traditional stats only
6. Do not use legacy SOAP/POX APIs

---

## 12. Live acceptance checks

1. Production home/API health unchanged
2. `/robots.txt` and `/sitemap.xml` unchanged behavior
3. IndexNow key endpoint HTTP 200 when enabled; no key in reports
4. `/admin/seo-measurement` GET requires `analytics:read`; POST snapshots requires `admin.data_quality.manage`
5. No public metrics endpoints
6. GSC card shows `not_configured` when env absent (not zeros)
7. GenAI card shows manual-import truth
8. Bing AI card shows manual-import truth
9. ChatGPT parser: `utm_source=chatgpt.com` in dev test event
10. Page-group classification on landing metadata
11. `application_click` on external apply CTAs
12. Provider failure does not break public pages
13. Mobile dashboard at 320–1440px without horizontal overflow

---

## 13. SEO roadmap completion

**SEO-P0 through SEO-P8 engineering roadmap complete.**

Future SEO work categories:

- CONTENT
- OPERATIONS
- MEASUREMENT
- EXPERIMENTATION
- BUG FIX
- SEARCH-ENGINE PLATFORM CHANGE

**No SEO-P9** unless a real defect or new requirement emerges.

---

## 14. Next product phases (document only)

### NEXT #1 — JOB-AUTOFILL-P2

Strict job document extraction + correct form mapping. Extract → classify → normalize → validate → preview → explicit Apply. No guessing.

### NEXT #2 — COPILOT-P1

Student/user Copilot as STRIDETO platform brain — authorized context, discovery, recommendations, explicit confirmation for writes.

**Not implemented in SEO-P8.**

---

## 15. Intentionally deferred

- Google GenAI automated API (awaiting official API)
- Bing AI Performance automated API (awaiting official REST)
- CSV parsers without sample exports in repo
- Worker-based scheduled GSC/Bing pulls
- Email/Slack SEO alert spam
- Third-party GA4/PostHog/Plausible
- SERP scraping / synthetic AI prompt probing
- Fake universal SEO score

---

## 16. Environment variables added

| Variable | Required | Purpose |
|----------|----------|---------|
| `GSC_SITE_URL` | For GSC API | Verified property URL |
| `GSC_SERVICE_ACCOUNT_EMAIL` | For GSC API | Service account email |
| `GSC_SERVICE_ACCOUNT_PRIVATE_KEY` | For GSC API | PEM private key |
| `GSC_CREDENTIALS_JSON` | Alt to above | Full service account JSON |
| `GSC_ALLOW_NON_PRODUCTION` | Optional | Allow GSC calls outside production |
| `BING_WEBMASTER_API_KEY` | For Bing search stats | REST API key |
| `BING_SITE_URL` | For Bing | Site URL |
| `BING_ALLOW_NON_PRODUCTION` | Optional | Allow Bing calls outside production |

No secrets in documentation or client bundles.
