# Phase C.1 — Production Environment Report

**Product:** Strideto  
**Date:** 2026-07-24  
**Scope:** Environment variable audit for production readiness (no secrets committed)

---

## Verdict

**Ready to configure** production once secrets are filled in host dashboards (Vercel + Render/Atlas).  
Templates exist; dedicated root `.env.production.example` is the production checklist (Phase C.3).

**Blockers before go-live (ops, not code):**

1. Strong `JWT_SECRET` (≥32 chars) — API will refuse to start in production without it  
2. Real `MONGO_URI` (Atlas recommended) — not localhost  
3. SMTP (`MAIL_*`) — password reset / invites / contact will noop without it  
4. Correct `SITE_URL` / `FRONTEND_URL` / `VITE_APP_URL` / `VITE_API_URL` for `strideto.com` + API host  
5. Prefer `MEDIA_STORAGE_PROVIDER=s3|supabase` over local disk for durable uploads  
6. Set `REQUIRE_REDIS=1` + `REDIS_URL` for token revoke / cache in production  

---

## Frontend (`VITE_*`)

| Variable | Required | Default / fallback | Production notes |
|----------|----------|--------------------|------------------|
| `VITE_API_URL` | **Yes** | `http://localhost:5000/api` | Use `https://api.strideto.com/api` (or `/api` behind same-origin proxy) |
| `VITE_APP_URL` | Strongly | Brand `https://strideto.com` | Canonical / OG / admin previews |
| `VITE_ADSENSE_CLIENT_ID` | No | empty | Optional ads |
| `VITE_TALENT_PROFILE_ENABLED` | No | ON | Career flags — keep aligned with server |
| `VITE_TALENT_PROFILE_READ_CANONICAL` | No | OFF | |
| `VITE_OPPORTUNITY_APPLICATION_ENABLED` | No | ON | |
| `VITE_TIMELINE_ENABLED` | No | ON | |
| `VITE_DOCUMENTS_PLATFORM_ENABLED` | No | ON | |
| `VITE_CAREER_DASHBOARD_ENABLED` | No | ON | |
| `VITE_CAREER_DASHBOARD_V2_ENABLED` | No | ON | |
| `VITE_DASHBOARD_PERSONALIZATION_ENABLED` | No | OFF | |
| `VITE_SCORING_ENABLED` | No | ON | |
| `VITE_ASSESSMENTS_ENABLED` | No | ON | |
| `VITE_EMPLOYER_INTELLIGENCE_ENABLED` | No | ON | |
| `VITE_APPLICATION_READ_CANONICAL` | No | OFF | |

**Analytics:** First-party platform analytics only at launch. No `VITE_GA_*` required. Optional AdSense via consent.  
**Paid AI:** Do **not** set OpenAI/Anthropic keys — see `docs/AI_BUDGET_POLICY.md`.

---

## Backend (critical)

| Variable | Required in prod | Notes |
|----------|------------------|-------|
| `NODE_ENV` | **Yes** | `production` |
| `JWT_SECRET` | **Fatal** | ≥32 chars; never commit |
| `JWT_EXPIRES_IN` | No | Default `1h` |
| `REFRESH_EXPIRES_IN` | No | Default `7d` |
| `MONGO_URI` | **Fatal** | Atlas URI; DB name may remain `edurozgaar` internally (legacy) or `strideto` |
| `SITE_URL` | **Fatal** | `https://strideto.com` |
| `FRONTEND_URL` | Strongly | `https://strideto.com` (CORS) |
| `APP_URL` | Optional alias | Same as FRONTEND_URL |
| `PORT` | Host-provided | Render sets automatically |
| `REDIS_URL` | Recommended | With `REQUIRE_REDIS=1` |
| `MAIL_HOST/PORT/USER/PASS/FROM` | Strongly | Password reset / onboarding |
| `MEDIA_STORAGE_PROVIDER` | Recommended | `s3` or `supabase` |
| `CMS_SEED_ON_START` | Set `0` | Avoid accidental reseed |
| `DISABLE_QUEUE_CRON` | `1` on API if worker runs | Prevent double jobs |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | For bootstrap script | Never use defaults in prod |

### Career flags (server)

Align with client `VITE_*` counterparts. Production matrix (from docker example): dual-write OFF, migration jobs OFF, personalization OFF until validated.

### Optional

Stripe, Cloudinary, Sentry, captcha secrets, AWS/Supabase storage credentials.

---

## Feature flags / AI

| Flag family | Launch posture |
|-------------|----------------|
| Career Intelligence flags | ON for core product; dual-write/canonical reads OFF until cutover |
| Paid LLM APIs | **OFF** — deterministic fallbacks only |
| AdSense | Optional |
| Sentry | Optional but recommended |

---

## Example file map

| File | Purpose |
|------|---------|
| `.env.example` | Dev + Docker template |
| `.env.template` | Duplicate template |
| `docker/.env.production.example` | Compose production matrix |
| `.env.production.example` | **New (C.3)** — Vercel/Render host checklist |
| `docs/ENVIRONMENT_VARIABLES.md` | Human docs (keep in sync) |

---

## Host checklist (fill before deploy)

### Vercel (frontend)

- [ ] `VITE_API_URL=https://api.strideto.com/api`
- [ ] `VITE_APP_URL=https://strideto.com`
- [ ] Career `VITE_*` flags matching server
- [ ] Optional `VITE_ADSENSE_CLIENT_ID`

### Render / API host (backend)

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` (generated)
- [ ] `MONGO_URI` (Atlas)
- [ ] `SITE_URL` / `FRONTEND_URL`
- [ ] `REDIS_URL` + `REQUIRE_REDIS=1`
- [ ] SMTP set and tested
- [ ] Object storage configured
- [ ] Worker process or crons configured

---

## Remaining env debt (non-blocking)

- Internal Mongo DB name / some localStorage keys still use `edurozgaar` prefix (sessions still work; rename is a migration project)
- `REFRESH_SECRET` documented but unused for signing (refresh uses `JWT_SECRET`)
- Captcha env secrets exist but verification is stubbed — do not rely on captcha alone for spam

---

## Related docs

- `docs/SECURITY_AUDIT_REPORT.md` (C.2)  
- `.env.production.example` (C.3)  
- `docs/DNS_CHECKLIST.md` · `docs/RENDER_CONFIGURATION.md` · `docs/VERCEL_CONFIGURATION.md`
