# AUTH-04 — Email Verification & Password Recovery Report

**Date:** 2026-07-26  
**Mode:** Audit first, then implement verified gaps  
**Commit/push/deploy:** Not performed (per instructions)

---

## Final verdict

**READY FOR SMTP CONFIGURATION**

Code paths for register → verify → login, resend, forgot/reset are complete against the existing link-based architecture. Live email delivery still requires Render SMTP env vars.

---

## Part 1 — Initial audit (pre-change)

### Frontend (already present)

| Area | State |
|------|--------|
| Register / Login / Forgot / Reset / Verify pages | Present |
| `authService` endpoints | Present for all auth routes |
| `AuthContext` | Registered users received tokens immediately |
| Resend UI | Profile only (authenticated) |
| Verify page | Token-from-query only; no “check your email” pending state |

### Backend (already present)

| Area | State |
|------|--------|
| `User.emailVerified` | Boolean, default `false` |
| `emailVerificationToken` / `emailVerificationExpires` | select:false fields |
| `passwordResetToken` / `passwordResetExpires` | Hashed via `hashResetToken` (SHA-256) |
| Routes | `POST register/login/forgot/reset/resend`, `GET|POST verify-email` |
| Verification method | **Clickable link** with raw token in URL; **hashed** token in MongoDB |
| Login | Did **not** enforce `emailVerified` |
| Register | Created user, called `onUserRegistered`, **issued JWT session immediately** |
| Resend | Required auth; claimed “sent” even when SMTP placeholder |
| Forgot/reset | Generic forgot message; hashed reset token; revoke refresh on reset |

### Endpoint map (confirmed)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/auth/register` | Completing verification gate |
| POST | `/api/auth/login` | Now returns `email_verification_required` when needed |
| GET/POST | `/api/auth/verify-email` | Link token in query or body |
| POST | `/api/auth/resend-verification` | Now public + optional auth |
| POST | `/api/auth/forgot-password` | Rate-limited; generic response |
| POST | `/api/auth/reset-password` | One-time hashed token |

### Gaps closed

1. Register granted full access before verification  
2. Login did not block new unverified users  
3. Resend required login (unusable if sessions withheld)  
4. Verification TTL was 24h (now 30 minutes)  
5. Welcome email sent before verification  
6. Verify links built from `SITE_URL` in automation (could miss Vercel URL)  
7. SMTP-unconfigured register/resend claimed email was queued as success  
8. Admin bootstrap did not set `emailVerified: true`  
9. No grandfather policy for legacy unverified users  

---

## Existing functionality retained

- Link-based verification (not OTP)  
- SHA-256 hashed tokens (`hashResetToken` / `hashVerificationToken`)  
- Forgot-password enumeration-safe message  
- Reset password clears token + revokes refresh sessions  
- Rate limits on auth + forgot-password  
- Branded Strideto email layout + tagline  

---

## Final flow

```
Register
  → User created (emailVerified=false)
  → Random 32-byte token issued; only SHA-256 hash stored
  → Expiry 30 minutes
  → Verification email queued if SMTP configured (truthful if not)
  → No access/refresh tokens returned
  → SPA → /auth/verify-email?pending=1&email=…

Click link
  → POST/GET /api/auth/verify-email?token=…
  → Validate hash + expiry; reject reuse/expired
  → emailVerified=true; clear token fields
  → Optional welcome email queued
  → User signs in

Login (new unverified user)
  → 403 { code: "email_verification_required", email }
  → Link to resend page

Resend
  → Public by email (generic message) or authenticated
  → Invalidates prior token; new 30-minute token
  → Rate-limited

Forgot / reset
  → Generic forgot response
  → Hashed reset token, 1-hour expiry
  → Reset clears token + revokes refresh
```

---

## Legacy / admin compatibility

| Account type | Policy |
|--------------|--------|
| `emailVerified === true` | Login allowed |
| Staff roles (`Admin`, `SuperAdmin`, `Editor`, `Moderator`) | Login allowed even if unverified |
| Users with `createdAt` **before** `AUTH_EMAIL_VERIFY_ENFORCE_FROM` (default `2026-07-26T11:00:00.000Z`) | Grandfathered — login allowed |
| New `User` accounts on/after cutoff | Must verify |
| `ensureAdminOnBoot` | Sets `emailVerified: true` |
| Invitations | Already create with `emailVerified: true` |
| Employer auth | Unchanged (separate stack) |

Override cutoff with Render env: `AUTH_EMAIL_VERIFY_ENFORCE_FROM`.

---

## Security decisions

- No raw verification/reset tokens stored on the User document (SHA-256 hashes only)
- Sensitive templates (`emailVerification`, `passwordReset`, `staffInvitation`) send directly and are not persisted in `BackgroundJob.payload`
- Completed/dead email jobs redact residual `vars.url` / body text; email placeholder logger omits body/text
- Resend invalidates previous verification token  
- Verify is single-use (fields cleared)  
- Public resend/forgot responses do not reveal account existence  
- Register/resend tell the truth when SMTP is unavailable (register explicitly; public resend stays generic + `emailMode`)  
- Password reset revokes refresh tokens  
- Email HTML escapes dynamic name/URL/button text  
- Tokens never logged  
- Frontend does not embed SMTP secrets  

---

## Exact Render SMTP / URL variables

From `server/src/services/emailService.js` and auth link builders:

| Key | Required for live mail | Notes |
|-----|------------------------|--------|
| `MAIL_HOST` | Yes | e.g. Brevo SMTP host |
| `MAIL_PORT` | Recommended | Default `587` |
| `MAIL_USER` | Yes | SMTP username |
| `MAIL_PASS` | Yes | SMTP password / API SMTP key |
| `MAIL_FROM` | Recommended | Falls back to `MAIL_USER` |
| `MAIL_SECURE` | Optional | `'true'` for port 465 |
| `FRONTEND_URL` | Yes for correct links | Temporary: `https://strideto.vercel.app` |
| `SITE_URL` | Already used in prod | Keep; prefer `FRONTEND_URL` for auth links |
| `AUTH_EMAIL_VERIFY_ENFORCE_FROM` | Optional | ISO cutoff for legacy grandfathering |

**Temporary testing (until strideto.com DNS is live):**

```
FRONTEND_URL=https://strideto.vercel.app
SITE_URL=https://strideto.vercel.app
MAIL_HOST=…
MAIL_PORT=587
MAIL_USER=…
MAIL_PASS=…
MAIL_FROM=Strideto <noreply@your-verified-sender>
MAIL_SECURE=false
```

Do not hardcode the Vercel URL in application code (uses env).

---

## Files changed

### Server
- `server/src/utils/emailVerification.js` *(new)*
- `server/src/controllers/authController.js`
- `server/src/routes/auth.js`
- `server/src/middleware/rateLimit.js`
- `server/src/seed/ensureAdmin.js`
- `server/src/services/automationService.js`
- `server/src/templates/emailTemplates.js`
- `server/src/__tests__/auth.test.js`
- `server/src/__tests__/emailVerification.test.js` *(new)*

### Client
- `client/src/context/AuthContext.jsx`
- `client/src/services/authService.js`
- `client/src/pages/Auth/Register.jsx`
- `client/src/pages/Auth/Login.jsx`
- `client/src/pages/Auth/VerifyEmail.jsx`
- `client/src/pages/Profile/Profile.jsx`
- `client/src/i18n/locales/en/forms.json`

### Docs / env example
- `.env.production.example`
- `docs/EMAIL_VERIFICATION_AND_RECOVERY_REPORT.md` *(this file)*

---

## Tests / build results

| Check | Result |
|-------|--------|
| `node src/__tests__/auth.test.js` | Pass |
| `node src/__tests__/emailVerification.test.js` | Pass |
| Server `npm run lint` | Pass |
| Server `node --check` on changed modules | Pass |
| Client `npm run lint` | Pass (existing warnings only; 0 errors) |
| Client `npm run build` | Pass (`✓ built`) |
| Docker | Not run (per instructions) |

Focused coverage includes: unverified new-user policy, staff/legacy bypass, token hash ≠ raw, clear-after-use fields, validator basics. Full HTTP/DB integration suite is still placeholder-level (no Jest/supertest harness in repo).

---

## Remaining manual steps (ops — not done here)

1. Set Render SMTP vars (`MAIL_*`) and `FRONTEND_URL=https://strideto.vercel.app`  
2. Redeploy API (Render) + frontend (Vercel) after you choose to commit/push  
3. Confirm health `email.configured: true`  
4. Register a fresh test user → receive verify mail → click link → login  
5. Exercise forgot/reset with a real inbox  
6. After `strideto.com` DNS is live, switch `FRONTEND_URL` / `SITE_URL` to `https://strideto.com`  
7. Optionally set `AUTH_EMAIL_VERIFY_ENFORCE_FROM` explicitly to match cutover time  

---

## Verdict

**READY FOR SMTP CONFIGURATION**
