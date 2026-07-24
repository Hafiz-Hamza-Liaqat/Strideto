# Vercel Configuration — Strideto Frontend

**Status:** Prepared for Phase D (not deployed by Phase C)

Repo also includes `vercel.json` for SPA rewrites and security headers.

---

## Project settings

| Setting | Value |
|---------|-------|
| Framework | Vite |
| Root directory | `client` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |
| Node | 20.x (recommended) |

## Environment variables (Production)

| Name | Example |
|------|---------|
| `VITE_API_URL` | `https://api.strideto.com/api` |
| `VITE_APP_URL` | `https://strideto.com` |
| Career `VITE_*` flags | Match server (see `.env.production.example`) |
| `VITE_ADSENSE_CLIENT_ID` | Optional |

Rebuild after any `VITE_*` change (build-time inlining).

## Domains

- Production: `strideto.com`, `www.strideto.com`
- Preview: Vercel preview URLs for PRs

## Headers / SPA

Handled in `vercel.json`:

- SPA fallback to `index.html`
- Basic security headers (CSP-friendly; API host in connect-src via app config)

## Post-deploy checks

- [ ] Home loads
- [ ] Client calls API without CORS errors
- [ ] Auth login/register
- [ ] SEO meta / OG using `VITE_APP_URL`
- [ ] PWA manifest icons resolve
