# Phase D.1 — Production Infrastructure Report

**Product:** Strideto  
**Date:** 2026-07-25  
**Scope:** Infrastructure configuration audit only (no secrets invented or printed)  
**Reference template:** `.env.production.example`

---

## Verdict (D.1)

**NOT CONFIGURED FOR PRODUCTION DEPLOY**

Templates and blueprints exist in-repo. Live cloud services are **not** provisioned/authenticated from this agent environment. Domain `strideto.com` currently serves a **Hostinger parked page**, not the Strideto app.

---

## Service matrix

| Service | Intended role | Repo preparation | Live / agent access | Status |
|---------|---------------|------------------|---------------------|--------|
| MongoDB Atlas | Primary DB | `MONGO_URI` documented | No Atlas CLI/API session; cannot verify cluster | **UNVERIFIED** |
| Render Backend | Node API + worker | `render.yaml`, `docs/RENDER_CONFIGURATION.md` | No `render` CLI; no `RENDER_API_KEY` / token | **NOT DEPLOYED** |
| Vercel Frontend | Vite SPA | `client/vercel.json`, `docs/VERCEL_CONFIGURATION.md` | `npx vercel` available; **not logged in** (OAuth required) | **NOT DEPLOYED** |
| SMTP | Mail (reset/invite/contact) | `MAIL_*` in template + email checklist | Not set in local prod checklist; no provider verified | **MISSING** |
| Cloudinary / object storage | Media | Template prefers `MEDIA_STORAGE_PROVIDER=s3` (Cloudinary optional) | Not configured | **MISSING** |
| Redis | Cache / revoke (`REQUIRE_REDIS=1`) | Template + Render env sync:false | Not configured | **MISSING** |

---

## Required environment variables (from `.env.production.example`)

### Fatal for API boot (`validateProductionEnv`)

| Variable | Required | Agent verification |
|----------|----------|--------------------|
| `NODE_ENV=production` | Yes | Must be set on Render |
| `JWT_SECRET` (≥32, not insecure) | Fatal | Must be set on Render (sync:false) — **do not invent** |
| `SITE_URL` | Fatal | Template: `https://strideto.com` |
| `MONGO_URI` | Fatal | Atlas URI — **must be provided by operator** |

### Strongly required for closed beta

| Variable | Purpose | Status |
|----------|---------|--------|
| `FRONTEND_URL` / `APP_URL` | CORS allowlist | Template ready; host unset |
| `REDIS_URL` + `REQUIRE_REDIS=1` | Ready checks / revoke | **Missing** |
| `MAIL_HOST` `MAIL_PORT` `MAIL_USER` `MAIL_PASS` `MAIL_FROM` | SMTP | **Missing** |
| `VITE_API_URL` | Frontend → API | Template `https://api.strideto.com/api` — Vercel unset |
| `VITE_APP_URL` | Canonical / OG | Template `https://strideto.com` — Vercel unset |
| Career `VITE_*` / server flags | Feature parity | Template lists defaults |

### Media

| Variable | Status |
|----------|--------|
| `MEDIA_STORAGE_PROVIDER` | Template recommends `s3` — **not set on host** |
| AWS / Supabase / Cloudinary credentials | **Missing** (operator must supply) |

### Explicitly leave unset (AI Budget Policy)

- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.

---

## Local workspace note (not production)

`server/.env` exists for local/dev (gitignored). Key **names** observed without printing values:

| Key | Present locally |
|-----|-----------------|
| `PORT`, `NODE_ENV`, `MONGO_URI`, `JWT_SECRET`, `SITE_URL`, `FRONTEND_URL` | SET |
| `REDIS_URL`, `REQUIRE_REDIS`, `MAIL_*`, `MEDIA_STORAGE_PROVIDER` | **MISSING** |

Local `.env` is **not** a substitute for Render/Vercel dashboard secrets.

---

## Auth / tooling available to agent

| Tool | Result |
|------|--------|
| Render CLI | Not installed |
| `RENDER_API_KEY` / `RENDER_TOKEN` | Unset |
| Vercel CLI (npx) | 57.0.0 present |
| Vercel credentials | **None** — `vercel whoami` started device login (aborted; no interactive auth) |
| `VERCEL_TOKEN` | Unset |
| `gh` CLI | Not installed |

**No secrets were invented. No secret values are recorded in this report.**

---

## Missing variables (production hosts)

Until operators configure dashboards, treat as **missing on production**:

1. `JWT_SECRET` (Render)  
2. `MONGO_URI` Atlas (Render + worker)  
3. `REDIS_URL` + `REQUIRE_REDIS` (Render + worker)  
4. `MAIL_HOST` / `MAIL_USER` / `MAIL_PASS` / `MAIL_FROM` (Render + worker)  
5. `MEDIA_STORAGE_PROVIDER` + provider credentials  
6. All `VITE_*` production vars on Vercel  
7. Optional: `SENTRY_DSN`, AdSense, Stripe (only if used)

---

## Recommended operator actions (manual)

1. Create MongoDB Atlas cluster + user; whitelist Render egress IPs (or `0.0.0.0/0` with strong creds).  
2. Provision Redis (Render Redis or Upstash); set `REDIS_URL`, `REQUIRE_REDIS=1`.  
3. Create Render Web + Worker from `render.yaml` (or dashboard); paste secrets as sync:false.  
4. Create Vercel project with root `client`; set `VITE_APP_URL` / `VITE_API_URL` + career flags; deploy.  
5. Configure SMTP (Brevo/Resend/SES) + SPF/DKIM on domain.  
6. Configure S3/Cloudinary for uploads.  
7. Only then point DNS away from Hostinger parking (see Domain report).

---

## STOP (D.1)

Infrastructure **prepared in repo**, **not provisioned live**. Proceeding to D.2–D.5 will record deployment attempts as blocked without credentials.
