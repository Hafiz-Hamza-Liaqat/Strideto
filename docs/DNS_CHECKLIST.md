# DNS Checklist — Strideto (prepare only; do not deploy from this doc)

**Domain:** strideto.com  
**Date prepared:** 2026-07-24  
**Status:** Checklist only — no DNS changes applied by this phase

---

## Records to configure (at registrar / Cloudflare)

| Host | Type | Target | Purpose |
|------|------|--------|---------|
| `strideto.com` | A / ALIAS / CNAME | Vercel (or frontend host) | Apex site |
| `www.strideto.com` | CNAME | `cname.vercel-dns.com` (or Vercel guidance) | WWW → apex |
| `api.strideto.com` | CNAME / A | Render service hostname | API |
| Optional `cdn.strideto.com` | CNAME | S3/CloudFront/Supabase CDN | Media |
| Optional `staging.strideto.com` | CNAME | Staging frontend | Pre-prod |

### Apex redirect

- Prefer: `www` → apex **or** apex → `www` (pick one canonical)
- Canonical in app: `https://strideto.com` (`SITE_URL` / `VITE_APP_URL`)

### Email (when SMTP domain is ready)

| Type | Host | Value |
|------|------|-------|
| MX | `@` | Provider MX |
| TXT | `@` | SPF |
| TXT / CNAME | Provider | DKIM |
| TXT | `@` | DMARC (`v=DMARC1; p=none; ...` initially) |

---

## SSL

- [ ] Vercel auto-TLS for `strideto.com` + `www`
- [ ] Render auto-TLS for `api.strideto.com`
- [ ] Confirm HTTPS redirects (HTTP → HTTPS)

## Verification after DNS propagates (Phase D)

- [ ] `https://strideto.com` loads SPA
- [ ] `https://www.strideto.com` redirects/loads correctly
- [ ] `https://api.strideto.com/api/health` returns OK
- [ ] CORS from SPA to API succeeds
- [ ] Password-reset email links use `https://strideto.com`

## Notes

- Do **not** point production DNS until Phase D deploy is green on temporary hostnames.
- Keep TTL moderate (300–600s) during cutover, then raise.
