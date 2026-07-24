# Phase D.4 — Domain Configuration Report

**Product:** Strideto  
**Domain:** strideto.com  
**Date:** 2026-07-25  
**Constraint:** No DNS writes performed by agent (no registrar API access)

---

## Verdict (D.4)

**NOT CONFIGURED FOR STRIDETO APP**

DNS resolves the apex to a Hostinger parking IP. HTTPS works for the parking page only. API subdomain does not exist. SSL for the app hosts is N/A until Vercel/Render domains are attached.

---

## DNS observations

| Host | Lookup | Result |
|------|--------|--------|
| `strideto.com` | A | `2.57.91.91` (Hostinger parking / hcdn) |
| `www.strideto.com` | CNAME/alias | Resolves to same apex parking |
| `api.strideto.com` | A/CNAME | **NXDOMAIN** (non-existent) |

### HTTPS

| URL | Status | Body |
|-----|--------|------|
| `https://strideto.com` | 200 | Hostinger “Parked Domain” HTML |
| `https://www.strideto.com` | 200 | Same parking page |
| `https://api.strideto.com/...` | FAIL | Name not resolved |
| `https://strideto.com/robots.txt` | 200 | Parking `Disallow: /` (not app robots) |
| `https://strideto.com/sitemap.xml` | 200 | Parking HTML (not XML sitemap) |
| `https://strideto.com/site.webmanifest` | 200 | Parking HTML |

Response header sample: `Server: hcdn`.

---

## Checklist vs target

| Requirement | Status |
|-------------|--------|
| `strideto.com` → Vercel | **NO** (Hostinger park) |
| `www.strideto.com` → Vercel / redirect | **NO** |
| DNS records for app | **NO** (still parking) |
| SSL for app | Parking TLS only; app certs not issued |
| HTTPS redirect | Parking serves HTTPS; app N/A |
| Canonical URLs (`https://strideto.com`) | Configured in app templates; **not live** |
| Production `robots.txt` | **NO** — parking robots |
| Production `sitemap.xml` | **NO** — needs API or static host after deploy |

---

## Target records (from `docs/DNS_CHECKLIST.md`) — not applied

| Host | Type | Target |
|------|------|--------|
| `@` | A / ALIAS / CNAME | Vercel guidance for apex |
| `www` | CNAME | Vercel DNS target |
| `api` | CNAME | Render service hostname |
| Email TXT/MX | SPF/DKIM/DMARC | When SMTP domain ready |

**Agent did not change DNS.** Operator must update at Hostinger (or move NS to Cloudflare/Vercel DNS).

---

## Exact blockers

| # | Service | Error | Recommended fix |
|---|---------|-------|-----------------|
| 1 | Hostinger DNS | Apex points to parking `2.57.91.91` | After Vercel domain add, replace A/CNAME with Vercel values |
| 2 | DNS | `api` missing | Create CNAME after Render hostname exists |
| 3 | SSL | No app certificates | Auto-issue once domains attached to Vercel/Render |
| 4 | SEO files | Parking overrides paths | Will resolve once SPA + API live |

---

## Application code

No domain-related code changes made.
