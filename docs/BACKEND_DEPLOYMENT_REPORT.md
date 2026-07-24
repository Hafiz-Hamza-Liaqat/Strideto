# Phase D.2 — Backend Deployment Report

**Product:** Strideto  
**Date:** 2026-07-25  
**Target:** Render (`strideto-api` / `strideto-worker` per `render.yaml`)  
**Constraint:** No application redesign; deployment-related fixes only

---

## Verdict (D.2)

**NOT DEPLOYED**

Backend could not be deployed from this environment: no Render authentication, no provisioned service URL, and `api.strideto.com` does not resolve.

---

## Attempt summary

| Step | Result |
|------|--------|
| Blueprint present | `render.yaml` — web + worker, health `/api/health` |
| Render CLI | Not installed |
| Render API token | Unset |
| Deploy command executed | **None** (no authenticated target) |
| Production build on host | N/A (local `npm` install already used in C.12; host build not run on Render) |

---

## Verification checklist (production)

| Check | Result | Evidence |
|-------|--------|----------|
| Production build on Render | **FAIL** / not run | No Render service |
| Health endpoint | **FAIL** | `https://api.strideto.com/api/health` — DNS NXDOMAIN |
| MongoDB connection | **UNVERIFIED** | No live API |
| Environment variables | **MISSING on host** | See infrastructure report |
| CORS | **UNVERIFIED** | Requires live API + SPA origin |
| Authentication | **UNVERIFIED** | — |
| File uploads | **UNVERIFIED** | Media provider unset |
| Email | **UNVERIFIED** | `MAIL_*` missing |
| Feedback API | **UNVERIFIED** | Route exists in code (`/api/feedback`); not live |
| Production logging | **UNVERIFIED** | — |

### DNS / HTTP probe

```text
nslookup api.strideto.com → Non-existent domain
Invoke-WebRequest https://api.strideto.com/api/health
  → The remote name could not be resolved: 'api.strideto.com'
```

---

## Exact blockers

| # | Service | Error | Recommended fix |
|---|---------|-------|-----------------|
| 1 | Render | No CLI / API credentials in agent environment | Install Render CLI or set `RENDER_API_KEY`; log in; create services from blueprint |
| 2 | Render env | Secrets not available to agent (correctly) | Operator pastes `JWT_SECRET`, `MONGO_URI`, `REDIS_URL`, `MAIL_*` in dashboard |
| 3 | DNS | `api.strideto.com` NXDOMAIN | After Render hostname exists, CNAME `api` → `*.onrender.com` |
| 4 | Atlas | Cluster not verified | Create Atlas DB; set `MONGO_URI` on Render |

---

## Application code

**No deployment-related application code defect identified.**  
C.12 validated syntax, lint, env gates, and route registration offline.

**No application code was modified in D.2.**

---

## What “done” looks like (for re-run)

1. Render web service healthy: `GET https://<service>.onrender.com/api/health` → mongo up (redis if required).  
2. Custom domain `api.strideto.com` TLS active.  
3. CORS allows `https://strideto.com`.  
4. `POST /api/feedback` rate-limited and reachable.  
5. Worker running with shared Mongo/Redis/SMTP.
