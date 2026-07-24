# Phase D.3 — Frontend Deployment Report

**Product:** Strideto  
**Date:** 2026-07-25  
**Target:** Vercel (root directory `client`, `vercel.json`)

---

## Verdict (D.3)

**NOT DEPLOYED**

Vercel CLI can run via `npx`, but **no credentials** exist. Interactive OAuth was started and **aborted** (no browser login completed). Apex domain currently shows Hostinger parking HTML, not the Vite SPA.

---

## Attempt summary

| Step | Result |
|------|--------|
| `client/vercel.json` | Present (SPA rewrites + security headers) |
| Local production build | **PASS** in C.12 (`vite build` exit 0) — reusable artifact locally only |
| `npx vercel whoami` | No credentials → device login prompt |
| `VERCEL_TOKEN` | Unset |
| Production deploy | **Not executed** |

---

## Verification checklist (production)

| Check | Result | Notes |
|-------|--------|-------|
| Production build (local prior) | PASS (C.12) | Not the same as Vercel deploy |
| API connectivity | **FAIL** | `api.strideto.com` unresolved; live site not SPA |
| Authentication | **UNVERIFIED** | — |
| Resume Builder | **UNVERIFIED** | — |
| Onboarding | **UNVERIFIED** | — |
| Feedback Widget | **UNVERIFIED** | — |
| Dashboard | **UNVERIFIED** | — |
| Employer Portal | **UNVERIFIED** | — |
| Admin Portal | **UNVERIFIED** | — |
| Search / Notifications / Routing | **UNVERIFIED** | — |
| PWA / manifest / icons / favicon | **FAIL on live domain** | `https://strideto.com/site.webmanifest` returns Hostinger parked HTML |

### Live origin probe

```text
GET https://strideto.com → 200
Server: hcdn
Title: Parked Domain name on Hostinger DNS system
```

---

## Exact blockers

| # | Service | Error | Recommended fix |
|---|---------|-------|-----------------|
| 1 | Vercel | Not authenticated | `npx vercel login` or set `VERCEL_TOKEN`; link project with root `client` |
| 2 | Vercel env | `VITE_*` not set on project | Set `VITE_APP_URL`, `VITE_API_URL`, career flags; rebuild |
| 3 | Backend dependency | API host missing | Deploy Render first; point `VITE_API_URL` at live API |
| 4 | DNS | Apex still Hostinger parking | After Vercel project ready, attach domain + update DNS |

---

## Application code

**No frontend application code modified.**  
Local build/PWA assets validated in C.12.

---

## What “done” looks like

1. Vercel production URL serves Strideto SPA (`index.html` from Vite dist).  
2. Custom domains `strideto.com` / `www` attached with TLS.  
3. Client calls `VITE_API_URL` without CORS errors.  
4. Manifest/icons/favicon return real assets (not parking HTML).
