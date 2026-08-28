# SEO-P5 — IndexNow, Sitemap Freshness, and Search Console Operations

Operational steps for production discovery signaling. IndexNow is **best-effort acceleration**; the canonical sitemap at `https://www.strideto.com/sitemap.xml` remains the durable fallback.

## IndexNow (Render backend)

1. Generate an IndexNow key (8–128 alphanumeric/hyphen characters).
2. Set on **Render** (API server):
   - `INDEXNOW_ENABLED=1` (required — disabled unless explicitly set)
   - `INDEXNOW_KEY=<your-key>`
   - `INDEXNOW_ENDPOINT=https://api.indexnow.org/indexnow` (default)
   - `NODE_ENV=production` (Render production service)
   - `SITE_URL=https://www.strideto.com` (must match canonical production origin)
3. Deploy **Vercel** frontend rewrite for `/indexnow-key.txt` → `https://api.strideto.com/indexnow-key.txt` (included in `client/vercel.json`).
4. Verify: `curl -s https://www.strideto.com/indexnow-key.txt` returns `text/plain` with exact key (no HTML).
5. Publish or update one public canonical URL; check server logs for `seo.indexnow.accepted` (200/202).
6. In **Bing Webmaster Tools** → IndexNow → inspect submission activity.

IndexNow does **not** guarantee crawl or indexing.

## Google Search Console

1. Verify `https://www.strideto.com` property.
2. Submit sitemap once: `https://www.strideto.com/sitemap.xml`
3. Do **not** use the deprecated unauthenticated Google sitemap ping endpoint (not implemented).
4. No OAuth/service-account setup is required for P5.

## Bing Webmaster Tools

1. Verify/import `https://www.strideto.com`.
2. Register the same sitemap URL (optional; IndexNow handles URL change signals).
3. Monitor IndexNow dashboard for submissions.

## Worker

The background worker remains **stopped**. IndexNow does not require Redis, BullMQ, or cron.

## Local / test

IndexNow is disabled when `NODE_ENV=test` or `SITE_URL` is localhost. Tests mock HTTP and never call live IndexNow endpoints.
