/**
 * CORS configuration — restrict origins in production to SITE_URL / FRONTEND_URL
 * plus optional CORS_ORIGINS and Vercel preview deployments (*.vercel.app).
 */
function normalizeOrigin(url) {
  if (!url || typeof url !== 'string') return null;
  return url.replace(/\/$/, '');
}

function parseExtraOrigins(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => normalizeOrigin(s.trim()))
    .filter(Boolean);
}

/** https://strideto.vercel.app and https://strideto-<hash>-<team>.vercel.app */
function isVercelAppOrigin(origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === 'https:' && hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

export function getCorsOptions() {
  const production = process.env.NODE_ENV === 'production';
  // Credentialed wildcard preview access must be an explicit production choice.
  const allowVercelPreviews = process.env.CORS_ALLOW_VERCEL_PREVIEWS === '1';
  const allowed = [
    normalizeOrigin(process.env.SITE_URL),
    normalizeOrigin(process.env.FRONTEND_URL),
    normalizeOrigin(process.env.APP_URL),
    ...parseExtraOrigins(process.env.CORS_ORIGINS),
    !production ? 'http://localhost:5173' : null,
    !production ? 'http://127.0.0.1:5173' : null,
    !production ? 'http://localhost' : null,
  ].filter(Boolean);

  const unique = [...new Set(allowed)];

  return {
    origin(origin, callback) {
      // Non-browser / same-origin / server-to-server
      if (!origin) return callback(null, true);
      const normalized = normalizeOrigin(origin);
      if (unique.includes(normalized)) return callback(null, true);
      if (!production) return callback(null, true);
      if (allowVercelPreviews && isVercelAppOrigin(normalized)) return callback(null, true);
      // Deny without throwing — throwing becomes unhandled_error noise in logs
      return callback(null, false);
    },
    credentials: true,
  };
}
