# STRIDETO SEO-P6 — Entity Authority & Off-Page Readiness Plan

**Status:** OPERATIONAL PLAN (not completed authority)
**Baseline:** SEO-P0 through SEO-P5 complete
**Scope:** On-site entity consistency + legitimate off-page guidance only

This document prepares future authority work. It does **not** claim listings, coverage, partnerships, or rankings already achieved unless marked **VERIFIED**.

---

## Label key

| Label | Meaning |
|-------|---------|
| **VERIFIED** | Confirmed in repository or live public site today |
| **PLANNED** | Approved direction; not executed in P6 |
| **DEFERRED** | Do not pursue until eligibility/notability exists |

---

## 1. On-site entity baseline (VERIFIED)

| Field | Value | Notes |
|-------|-------|-------|
| Brand name | Strideto | `shared/seo/organizationIdentity.js`, `client/src/design-system/brand.js` |
| Canonical URL | https://www.strideto.com | www origin; apex redirects in production |
| Organization `@id` | https://www.strideto.com/#organization | P2 frozen |
| WebSite `@id` | https://www.strideto.com/#website | P2 frozen |
| Logo (schema) | `/branding/logo-symbol.svg` | Public asset |
| Official sameAs | LinkedIn company page only | `shared/social/officialSocialLinks.js` |
| Trust pages | `/about`, `/editorial-policy`, `/press`, `/contact` | Indexable where substantive |

**Deliberately absent (DEFERRED until verified):** legalName, foundingDate, founders, headquarters, street address, public phone, public email, employee count, user metrics, awards, investor names, Wikipedia/Wikidata, Google Business Profile.

---

## 2. Social brand consistency checklist (PLANNED)

When maintaining **VERIFIED** official profiles, keep these aligned:

- [ ] Display name: **Strideto**
- [ ] Profile URL matches `organizationPublicSameAs()` in code
- [ ] Logo / avatar uses approved brand assets from `/branding/`
- [ ] Website field: https://www.strideto.com
- [ ] Short description matches factual platform scope (jobs, scholarships, admissions, career resources)
- [ ] Category/industry: education technology / career platform (platform-appropriate)
- [ ] No unverified metrics in bios (“#1”, “thousands of users”, etc.)

**Do not store** passwords, recovery emails, API tokens, or personal phone numbers in this document or the repository.

---

## 3. Allowed authority channels (PLANNED)

Pursue only when there is **real value or relationship**:

1. **Official company social profiles** — maintain confirmed URLs only (LinkedIn today).
2. **Real employer relationships** — employers linking when they list jobs or reference Strideto as a distribution channel they use.
3. **Real university/institution relationships** — when institutions genuinely reference a useful public resource page.
4. **Provider/source attribution** — scholarship bodies, boards, and employers citing accurate listing URLs.
5. **Industry/resource directories** — submit manually to relevant, human-reviewed directories (edtech, career platforms, Pakistan startup ecosystem) when criteria fit.
6. **Original research or data** — publish cite-worthy reports (e.g., admission deadline aggregations with methodology) on Strideto blog with sources.
7. **Product announcements** — launches of new public tools with genuine user benefit.
8. **Community participation** — helpful answers in education/career communities without spamming links.
9. **Earned press** — coverage from independent publishers after real news (launch, report, partnership).
10. **Partner resource pages** — links from partners who already reference Strideto in product/docs.

Mark each future action **PLANNED** until a URL or citation exists, then **VERIFIED** with evidence.

---

## 4. Prohibited / avoid (POLICY — always)

Do **not** use these methods to build authority:

- Buying backlinks or “SEO packages” (Fiverr packs, PBNs, link farms)
- Automated directory blasts or mass reciprocal-link exchanges
- Comment spam, forum signature spam, profile spam
- Fake scholarship link-building campaigns
- Expired-domain redirects for ranking transfer
- AI-generated guest-post campaigns at scale
- Mass journalist email scraping or unsolicited bulk outreach
- Paid dofollow links intended to manipulate rankings
- Fake press releases with no news value
- Fabricated awards, partners, reviews, or metrics on-site or off-site
- Self-created Wikipedia/Wikidata entries for SEO
- Guest-post / sponsored-content routes on Strideto as ranking products

---

## 5. Partnership link principle (POLICY)

A university, employer, or provider may link to Strideto when:

- There is an actual relationship or listing, **or**
- Strideto hosts a genuinely useful public resource they want to share.

Do **not** create fake partner landing pages solely to request backlinks. The link should follow value, not precede it.

---

## 6. Press outreach readiness (PLANNED)

P6 prepares assets (`/press`, brand files, About, Editorial Policy). **No automated outreach in P6.**

### When outreach is appropriate

- Real product launch or major public feature
- Original research/data with methodology
- Genuine partnership with public announcement
- Useful resource worth citing (not “please link for SEO”)

### Short template structure (manual use only)

1. **Why contacting them** — specific beat or audience fit
2. **What is new/useful** — one factual sentence
3. **Strideto context** — one sentence from `/about` or `/press`
4. **Resource link** — canonical URL to the asset or announcement
5. **Contact route** — https://www.strideto.com/contact (no fabricated media@ address)

Do not mass-personalize with invented details.

---

## 7. Directory readiness (PLANNED — manual submission only)

Candidate **categories** for future manual review (not auto-submit):

- Education technology / EdTech directories
- Career platform / job board directories
- Pakistan startup / software product directories
- International education resource lists (when relevant)

**DEFERRED:** hard-coding low-quality directory URLs into production code or sameAs.

---

## 8. Google Business Profile (DEFERRED)

**DEFERRED** unless Strideto operates an eligible customer-facing location or defined service-area business with verified address policy compliance. Do not invent a physical address for local SEO.

---

## 9. Wikipedia / Wikidata (DEFERRED)

**DEFERRED.** Independent notability and third-party coverage would be required before any encyclopedia entry. No self-promotional citations.

---

## 10. Knowledge Panel (DEFERRED expectation)

Search engines decide entity representation. P6 improves **consistency** only. No Knowledge Panel hacks or guaranteed outcomes.

---

## 11. Monitoring (SEO-P8)

Search Console dashboards, rank tracking, and KPI automation belong to **SEO-P8**, not P6.

---

## 12. Review cadence (PLANNED)

- Quarterly: verify sameAs URLs still resolve and match official profiles
- On rebrand: update `organizationIdentity.js`, press assets, and schema logo path together
- On new official social profile: add to `officialSocialLinks.js` only after URL confirmation

---

*End of SEO-P6 off-page plan.*
