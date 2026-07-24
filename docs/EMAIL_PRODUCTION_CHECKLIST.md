# Phase C.8 — Email readiness

**Product:** Strideto  
**Date:** 2026-07-24  
**Status:** Verified in code — configure SMTP in Phase D

---

## SMTP

| Item | Status |
|------|--------|
| Transport | Nodemailer via `server/src/services/emailService.js` |
| Env keys | `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`, optional `MAIL_SECURE` |
| Queue | `queueEmail` / automation worker for durable sends |
| Fail-soft | Missing SMTP → log / skip (auth flows still complete) |

Production example: see root `.env.production.example`.

Recommended: Brevo / Resend / Amazon SES with SPF + DKIM on `strideto.com` (see `docs/DNS_CHECKLIST.md`).

---

## Templates (`server/src/templates/emailTemplates.js`)

| Template key | Purpose |
|--------------|---------|
| `welcome` | New user welcome |
| `passwordReset` | Password reset link |
| `contactConfirmation` | Contact form ack |
| `applicationReceived` | Candidate application ack |
| `interviewInvite` | Interview invite |
| `employerVerification` | Employer verification |
| `employerApplicationReceived` | Employer new applicant alert |
| `offerSelected` | Selection / offer |
| Staff invite | Admin invitation accept link |

Brand name in templates: **Strideto**.

---

## Flows to smoke-test in Phase D

- [ ] Register → welcome email (if queued)
- [ ] Forgot password → reset link uses `SITE_URL` / `FRONTEND_URL` = `https://strideto.com`
- [ ] Contact form → user confirmation + admin alert (`CONTACT_ADMIN_EMAIL` / staff notify)
- [ ] Job apply → candidate + employer notifications
- [ ] Employer invite / verification emails

## Ops notes

- Set `MAIL_FROM=Strideto <noreply@strideto.com>` after domain auth
- Keep worker running for email queue if API has crons disabled
- Do not put SMTP passwords in the client or `VITE_*`
