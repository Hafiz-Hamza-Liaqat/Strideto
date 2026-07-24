# Production Deployment Guide — Strideto

## Architecture

| Component | Host | Directory |
|-----------|------|-----------|
| React SPA | Vercel | `client/` |
| Node API | Render | `server/` |
| Database | MongoDB Atlas | — |
| Media | Cloudinary | — |
| Email | Brevo | — |
| Payments | Stripe | — |
| Cache (optional) | Redis (Render/Upstash) | — |

---

## 1. MongoDB Atlas

1. Create M10+ cluster in nearest region.
2. Enable **Cloud Backup** (continuous).
3. Create DB user with read/write on `strideto` database (legacy `edurozgaar` DB name still works).
4. Network access: allow Render outbound IPs or `0.0.0.0/0` with strong credentials.
5. Copy connection string → `MONGO_URI`.

---

## 2. Render (API)

1. New **Web Service** → connect repo → root directory `server`.
2. Build: `npm install`
3. Start: `npm start`
4. Health check path: `/api/health/live`

### Required environment variables

```
NODE_ENV=production
MONGO_URI=
JWT_SECRET=          # openssl rand -hex 32
REFRESH_SECRET=      # different from JWT_SECRET
SITE_URL=https://strideto.com
FRONTEND_URL=https://strideto.com
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
BREVO_API_KEY=          # optional — app uses MAIL_* SMTP; map Brevo SMTP creds to MAIL_HOST/USER/PASS
MAIL_HOST=              # Brevo: smtp-relay.brevo.com
MAIL_PORT=587           # Brevo SMTP port (587 TLS)
MAIL_USER=              # Brevo SMTP login (often your Brevo account email)
MAIL_PASS=              # Brevo SMTP key (not REST API key)
MAIL_FROM=noreply@strideto.com
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
REDIS_URL=           # optional but recommended
CMS_SEED_ON_START=   # optional — set 0 to skip insert-only CMS bootstrap on boot
```

5. Deploy → verify `GET https://api.strideto.com/api/health`.

### CMS startup seed (production-safe)

On every API boot, CMS defaults are seeded **insert-only** — existing homepage, navigation, footer, and static pages are **never overwritten**. Published content stays published after deploy/restart.

| Variable | Default | Effect |
|----------|---------|--------|
| `CMS_SEED_ON_START` | enabled | Set to `0` to skip CMS bootstrap entirely |

Job plans use the same insert-only pattern (skip when any plan exists).

### Email (Brevo / SMTP)

The API uses **Nodemailer SMTP** via `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, and `MAIL_FROM` (not `BREVO_API_KEY` directly). For Brevo, use their SMTP relay credentials as `MAIL_*` vars.

When SMTP is not configured, `/api/health` reports `email.mode: "placeholder"` — queue jobs complete but emails are logged, not sent. Admin UI surfaces **"Email queued (SMTP not configured)"** for invitations, password resets, and broadcast email notifications.

---

## 3. Vercel (Client)

1. Import repo → root directory `client`.
2. Build: `npm run build`
3. Output: `dist`
4. Environment:
   ```
   VITE_API_URL=https://api.strideto.com/api
   ```
5. Add custom domain; enable HTTPS.

---

## 4. Cloudinary

1. Create production folder prefix e.g. `strideto-prod/`.
2. Set upload preset restrictions (max size, allowed formats).
3. Add keys to Render env.

---

## 5. Brevo

1. Authenticate sending domain (SPF, DKIM, DMARC).
2. Verify transactional sender address.
3. Add `BREVO_API_KEY` to Render.

---

## 6. Stripe

1. Create live products/prices matching dev catalog.
2. Webhook endpoint: `https://api.strideto.com/api/payments/webhook`
3. Events: `checkout.session.completed`, `payment_intent.succeeded`
4. Set live keys on Render; test mode keys only in staging.

---

## 7. DNS

| Record | Target |
|--------|--------|
| `@` / `www` | Vercel |
| `api` | Render service URL |

Update `SITE_URL`, `FRONTEND_URL`, and CORS after DNS propagates.

---

## 8. Post-deploy smoke test

```bash
curl https://api.strideto.com/api/health
curl https://strideto.com/robots.txt
curl https://strideto.com/sitemap.xml
```

- Register test user on production
- Submit contact form
- Check Admin → Monitoring for queue + Redis status

---

## 9. Search & analytics

- **Google Search Console:** add property, submit `https://strideto.com/sitemap.xml`
- **Google Analytics:** add GA4 tag to client env `VITE_GA_ID`
- **Bing Webmaster Tools:** import from GSC or submit sitemap manually

---

## Related docs

- Rollback: `docs/ROLLBACK_GUIDE.md`
- Monitoring: `docs/MONITORING_GUIDE.md`
- Launch checklist: `docs/SPRINT_C5_LAUNCH_READINESS.md`
