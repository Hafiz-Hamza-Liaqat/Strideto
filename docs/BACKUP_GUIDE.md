# Backup Guide

## Retention Policy (recommended)

| Backup | Frequency | Retention |
|--------|-----------|-----------|
| MongoDB | Daily | 30 days |
| Media uploads | Weekly | 90 days |
| `.env` / config | On change | 1 year (encrypted store) |

## MongoDB

```bash
# Host with mongodump
MONGO_URI=mongodb://localhost:27017/strideto ./scripts/backup/mongo-backup.sh

# Docker
docker compose exec mongodb mongodump --out=/data/backup
docker cp $(docker compose ps -q mongodb):/data/backup ./backups/mongo/
```

Restore: `./scripts/backup/mongo-restore.sh <backup_dir>`

## Media

```bash
./scripts/backup/media-backup.sh
```

For S3/Supabase: enable provider-native versioning and lifecycle rules.

## Configuration

Store encrypted copies of `.env` in a secrets manager (1Password, AWS Secrets Manager, etc.). Never commit secrets.

## Restore Testing

Monthly: restore latest Mongo backup to staging, run `npm run verify:integration`.

Verify backup structure without touching live data:

```bash
./scripts/backup/verify-restore.sh ./backups/mongo/strideto_YYYYMMDD_HHMMSS
```

Cron examples: `scripts/backup/crontab.example`

Run: `npm run verify:backups`
