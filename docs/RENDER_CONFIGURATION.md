# Render Configuration — Strideto API

**Status:** Prepared for Phase D (not deployed by Phase C)

---

## Service: Web API

| Setting | Value |
|---------|-------|
| Runtime | Node |
| Root directory | `server` (or monorepo root with adjusted commands) |
| Build command | `npm install` |
| Start command | `npm start` or `node src/index.js` |
| Health check path | `/api/health` |
| Instance | At least 1 always-on (Hobby+) for cron reliability, or separate Worker |

### Environment variables

Copy from `.env.production.example` backend section. Minimum:

- `NODE_ENV=production`
- `JWT_SECRET`
- `MONGO_URI`
- `SITE_URL=https://strideto.com`
- `FRONTEND_URL=https://strideto.com`
- `REDIS_URL` + `REQUIRE_REDIS=1`
- `MAIL_*`
- `MEDIA_STORAGE_PROVIDER` (+ provider credentials)
- Career flags
- `DISABLE_QUEUE_CRON=1` / `DISABLE_REMINDER_CRON=1` if using a Worker

### Custom domain

- `api.strideto.com` → Render service → enable TLS

---

## Service: Worker (recommended)

| Setting | Value |
|---------|-------|
| Type | Background Worker |
| Start | `node src/worker.js` (confirm script name in `server/package.json`) |
| Env | Same Mongo/Redis/SMTP as API |
| Crons | Leave queue/reminder enabled on worker; disabled on API |

---

## Health

Expected: `GET https://api.strideto.com/api/health` → `{ status: "ok", ... }` with mongo up (and redis when required).

## Notes

- Prefer MongoDB Atlas (not Render disk Mongo).
- Attach Redis (Render Redis or Upstash).
- Do not expose Mongo/Redis ports publicly.
