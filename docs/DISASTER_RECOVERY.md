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

### 3. Application rollback (normal)

Redeploy the previous known-good image/commit. Do **not** delete persistent volumes.

```bash
# Example: restart app services only. Never use `docker compose down -v`
# as a normal recovery step — it destroys Mongo, Redis, and media volumes.
docker compose up -d --no-deps --build api-a api-b frontend
```

Database migrations on the frozen track are additive/compatible. Rolling the app back does not imply dropping Mongo data. Worker, when used, must match the app contract for queue payload versions; provider webhook events are idempotent and may be replayed.

### 4. Redis loss

Redis is **not** the system of record for applications, jobs, Vault, or commerce.

It currently holds:

- access-token denylist (secure auth)
- rate-limit counters
- optional cache

Restart Redis without deleting Mongo/media volumes. Caches rebuild on demand. Rate-limit counters reset (users are not permanently locked). Sessions that relied on the denylist/refresh availability may require re-login. Do not restore Redis from backup as if it were Mongo.

## Testing Recovery

Quarterly: restore Mongo backup to staging, run `npm run verify:integration`, smoke-test admin login and public homepage.

## Contacts

Document on-call rotation and escalation paths for your organization here.
