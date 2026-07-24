# Phase C.9 — Google SEO readiness

**Product:** Strideto  
**Date:** 2026-07-24  
**Status:** Assets present — wire Search Console in Phase D

---

## Checklist

| Item | Status | Location |
|------|--------|----------|
| `robots.txt` | Ready | `client/public/robots.txt` (+ server `GET /robots.txt`) — Sitemap → `https://strideto.com/sitemap.xml` |
| `sitemap.xml` | Ready | Dynamic via `seoController` / `GET /sitemap.xml` |
| Favicon set | Ready | `favicon.ico`, `favicon.svg`, `favicon-32.png`, apple-touch, safari pinned |
| Web manifest | Ready | `client/public/site.webmanifest` — name **Strideto**, theme `#2563EB` |
| Canonical | Ready | SeoHead / `VITE_APP_URL` / brand config |
| Open Graph | Ready | `og-image.png`, `og-default.png`, branding OG assets |
| Twitter cards | Ready | Meta + `twitter-image.png` / branding |
| schema.org | Ready | `client/src/seo/schemas.js` (Organization, breadcrumbs, contact, etc.) |

## Phase D actions (do not run yet)

1. Deploy frontend with `VITE_APP_URL=https://strideto.com`
2. Confirm `https://strideto.com/robots.txt` and `/sitemap.xml`
3. Google Search Console → property `https://strideto.com` → submit sitemap
4. Optional Analytics / GA4 (consent-gated) after CookieConsent
5. Spot-check OG with Facebook/Twitter debuggers

## Notes

- Private routes already disallowed in robots (`/auth/`, `/admin`, `/employer`, dashboards)
- Prefer one canonical host (apex vs www) matching DNS checklist
