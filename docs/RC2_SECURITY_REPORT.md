# RC-2 — Security Report

**Date:** 22 July 2026  
**Scope:** Hardening fixes only — no security redesign

---

## Final security checklist

| Control                                        | Status               | Notes                                                                            |
| ---------------------------------------------- | -------------------- | -------------------------------------------------------------------------------- |
| Helmet + CSP                                   | **PASS**             | Wired in `server/src/index.js` / `config/security.js`                            |
| Rate limiting                                  | **PASS**             | API, auth, refresh, employer auth, upload, contact                               |
| JWT access expiration                          | **PASS**             | Source-controlled 15-minute access JWT; `jti` on access tokens                   |
| Refresh rotation (User)                        | **PASS**             | Canonical seven-day HttpOnly-cookie and `RefreshSession` rotation                |
| Refresh rotation (Employer)                    | **PASS**             | Canonical seven-day HttpOnly-cookie and `RefreshSession` rotation                |
| Logout / session revoke (User)                 | **PASS**             | Refresh + access revoke (RC-1)                                                   |
| Logout / session revoke (Employer)             | **PASS**             | **RC-2**                                                                         |
| Password reset revoke                          | **PASS**             | RC-1                                                                             |
| CORS                                           | **PASS**             | Origin from `SITE_URL` / config                                                  |
| CSRF                                           | **PASS**             | State-changing cookie-auth requests enforce the trusted request-origin policy    |
| Mongo sanitize                                 | **PASS**             | `express-mongo-sanitize`                                                         |
| Environment validation                         | **PASS**             | Distinct `JWT_SECRET` / `REFRESH_SECRET` and production `REDIS_URL` are required |
| Secrets                                        | **PASS**             | No secrets committed in RC-2; `.env` local                                       |
| Cookies                                        | **PASS**             | Realm-specific HttpOnly refresh cookies; access tokens remain memory-only        |
| Authorization middleware                       | **PASS**             | `requireAuth`, `requireUserAuth`, `requireEmployerAuth`, `requireRole`           |
| RBAC (Admin / SuperAdmin / Moderator / Editor) | **PASS**             | Server RBAC + client mirrors; AdminRouteGuard coverage expanded                  |
| Audit logging                                  | **PASS**             | Employer logout audited; actorId accepts employerId                              |
| Role escalation                                | **PASS**             | Role changes admin-gated (existing)                                              |
| IDOR / broken access                           | **PASS (mitigated)** | Employer routes require employer auth; candidate routes now `requireUserAuth`    |
| Privilege escalation                           | **PASS**             | Employer JWT cannot call user-only resume/chatbot/badge routes                   |
| AI Budget                                      | **PASS**             | No paid AI; deterministic fallbacks                                              |

---

## RC-2 auth changes (detail)

### Employer session lifecycle

1. Register/Login issues a memory-only access token and sets a realm-specific HttpOnly refresh cookie.
2. Refresh validates and rotates the persisted `RefreshSession`, then issues a new access token and cookie.
3. Logout revokes the session family and deny-lists the access `jti` hash.
4. User and employer clients use the same canonical secure-auth lifecycle while retaining realm isolation.

### Candidate route hardening

`requireUserAuth` added to:

- `/resumes/*`
- `/chatbot/*` (authenticated)
- `/badges/me`, `/badges/rank`

### Admin UI guards

Fixed ineffective `perm` prop on Page Builder. Added `AdminRouteGuard` to previously unguarded admin surfaces (search, growth, import, alerts, AI generator, executive, audit).

---

## Redis note

Redis is required for session issuance and shared access-token denylisting. Production boot fails closed when `REDIS_URL` is absent; there is no process-local authentication fallback.

---

## Staging / production ops still required

| Item                                                      | Owner |
| --------------------------------------------------------- | ----- |
| Strong, distinct `JWT_SECRET` / `REFRESH_SECRET` settings | Ops   |
| SMTP for real email verification / password reset         | Ops   |
| TLS termination + DNS                                     | Ops   |
| MongoDB Atlas backups + monitoring alerts                 | Ops   |

These are operational conditions, not code P0/P1 defects.

---

## verify:security

```
Security verification: 9 passed, 0 failed
```

Includes employer refresh/logout static gates and candidate `requireUserAuth`.

---

**End of RC-2 Security Report.**
