# Phase C.2 — Security Audit Report

**Product:** Strideto  
**Date:** 2026-07-24  
**Scope:** Pre-deployment security review (read + config prep; no deploy)

---

## Verdict

**Conditionally ready for closed beta** after secrets are set and SMTP/storage are live.

Core controls (Helmet/CSP, CORS allowlist, rate limits, bcrypt, JWT env validation, mongo sanitize, upload magic-byte checks, RBAC) are present. Highest residual risks are **JWT in localStorage (XSS)** and **ops misconfiguration** (weak secrets, open CORS via wrong FRONTEND_URL, local media disk).

---

## Findings

### Pass / implemented

| Area | Status | Location |
|------|--------|----------|
| Helmet | Pass | `server/src/index.js` + `config/security.js` |
| CSP | Pass (prod tight) | `security.js`; Vite mirrors SPA headers |
| HSTS | Pass in prod | Helmet options |
| CORS | Pass | `config/cors.js` — credentials + allowlisted origins |
| Rate limiting | Pass | `middleware/rateLimit.js` — auth, upload, contact, search, admin |
| Password hashing | Pass | bcrypt cost **12** (`User` model) |
| JWT expiry | Pass | Access default `1h`, refresh `7d`; prod requires strong secret |
| Env validation | Pass | `validateEnv.js` fatals on missing JWT/MONGO/SITE in prod |
| Input sanitize | Pass | `express-mongo-sanitize`, `sanitize-html`, custom sanitize |
| File upload | Pass | Magic-byte sniff, size caps, SVG rejected (`fileValidation.js`) |
| Admin auth / RBAC | Pass | `middleware/auth.js` + `rbac.js` roles/permissions |
| Secret exposure | Pass | No server secrets under `VITE_` |
| XSS headers | Pass | Helmet defaults + CSP |

### Risks / gaps

| ID | Severity | Finding | Recommendation |
|----|----------|---------|----------------|
| S1 | **High** | Access + refresh tokens stored in **localStorage** | Prefer httpOnly Secure cookies for refresh (or short-lived access only); harden CSP; never introduce `eval` |
| S2 | Medium | `REFRESH_SECRET` unused — refresh signed with `JWT_SECRET` | Either implement separate secret or remove from docs to avoid false assurance |
| S3 | Medium | No classic CSRF middleware | Acceptable for Bearer-from-header APIs; still required if moving to cookies |
| S4 | Medium | Captcha verify is a **stub** (token presence only) | Wire real reCAPTCHA/Turnstile verify before relying on it |
| S5 | Medium | `MEDIA_STORAGE_PROVIDER=local` loses files on ephemeral disks | Use S3/Supabase for production |
| S6 | Low | Import upload uses extension filter (not magic bytes) | Align import MIME checks with `fileValidation` |
| S7 | Low | Stale claim in `docs/SECURITY_CHECKLIST.md` about httpOnly refresh cookies | Treat checklist as outdated for cookies; this report is authoritative |
| S8 | Info | Legacy `edurozgaar-*` localStorage keys | Dual-read OK; plan rename migration later |

### Admin / routes

- Admin routes behind `requireAdmin` / permission checks  
- Employer JWT separated from student JWT  
- Public routes do not expose admin CRUD without auth  

### CORS production checklist

Allowed origins must include exactly:

- `https://strideto.com`  
- `https://www.strideto.com` (if used)  

Set via `SITE_URL` / `FRONTEND_URL`. Do not leave `NODE_ENV` as development on public hosts.

### Cookie security

Current design: **no auth cookies**. Session tokens are Bearer headers. Cookie flags (Secure/HttpOnly/SameSite) apply only if/when cookie auth is introduced.

---

## Pre-deploy security checklist

- [ ] Generate `JWT_SECRET` with `openssl rand -hex 32`  
- [ ] Confirm production CORS origins  
- [ ] Confirm Helmet CSP allows only needed third parties (AdSense/Stripe if used)  
- [ ] Disable CMS seed on start  
- [ ] SMTP credentials not in git  
- [ ] Object storage credentials scoped least-privilege  
- [ ] Admin password rotated from any seed default  
- [ ] Rate limits verified under load smoke test  
- [ ] `/api/health` does not leak secrets  

---

## Related

- `docs/PRODUCTION_ENVIRONMENT_REPORT.md`  
- `docs/SECURITY_CHECKLIST.md` (legacy checklist — reconcile with this report)  
- `server/src/config/security.js`
