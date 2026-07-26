/**
 * Configure Express trust proxy for platforms that terminate TLS
 * behind a reverse proxy (Render, Cloudflare → Render).
 *
 * Production: trust exactly one hop (Render's proxy).
 * Development: leave default (false) so local rate-limit identity stays socket-based.
 */
export function configureTrustProxy(app) {
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }
}
