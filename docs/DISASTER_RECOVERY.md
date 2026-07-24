# Disaster Recovery

## RPO / RTO Targets (recommended)

| Asset | RPO | RTO |
|-------|-----|-----|
| MongoDB | 24h (daily backup) | 2h |
| Media uploads | 24h | 4h |
| Configuration (.env) | On change | 30m |

## Recovery Steps

### 1. Database loss

```bash
./scripts/backup/mongo-restore.sh ./backups/mongo/strideto_YYYYMMDD_HHMMSS
docker compose restart backend worker
```

### 2. Media loss

```bash
tar -xzf ./backups/media/uploads_YYYYMMDD.tar.gz -C ./server/
docker compose restart backend
```

### 3. Full stack rebuild

```bash
cp .env.backup .env
docker compose down -v   # caution: removes volumes if not using external DB
docker compose up -d --build
# Restore Mongo + media from backups
```

### 4. Redis loss

Redis is cache-only (except refresh tokens). Restart Redis; caches rebuild on demand. Users may need to re-login if refresh tokens were lost.

## Testing Recovery

Quarterly: restore Mongo backup to staging, run `npm run verify:integration`, smoke-test admin login and public homepage.

## Contacts

Document on-call rotation and escalation paths for your organization here.
