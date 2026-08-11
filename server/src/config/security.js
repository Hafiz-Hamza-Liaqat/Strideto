const isProd = process.env.NODE_ENV === 'production';
const apiOrigin = (process.env.VITE_API_URL || process.env.SITE_URL || 'http://localhost:5000').replace(/\/$/, '');
const siteOrigin = (process.env.SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

/**
 * CSP directives compatible with Google AdSense, GA, Stripe, Cloudinary, Brevo.
 * In development, relaxes script-src for Vite HMR.
 */
export function buildCspDirectives({ forApi = false } = {}) {
  const connectSrc = [
    "'self'",
    apiOrigin,
    'https://api.stripe.com',
    'https://*.cloudinary.com',
    'https://res.cloudinary.com',
    'https://www.google-analytics.com',
    'https://region1.google-analytics.com',
    'https://*.google-analytics.com',
    'https://*.brevo.com',
    'https://*.sendinblue.com',
  ];
  if (!isProd) {
    connectSrc.push('http://localhost:5000', 'http://127.0.0.1:5000', 'ws://localhost:5173', 'ws://127.0.0.1:5173');
  }

  if (forApi) {
    return {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
    };
  }

  const scriptSrc = [
    "'self'",
    'https://pagead2.googlesyndication.com',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://js.stripe.com',
    'https://cdn.brevo.com',
    'https://sibautomation.com',
  ];
  if (!isProd) {
    scriptSrc.push("'unsafe-inline'", "'unsafe-eval'");
  }

  return {
    defaultSrc: ["'self'"],
    scriptSrc,
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      'https:',
      'https://res.cloudinary.com',
      'https://*.cloudinary.com',
      'https://pagead2.googlesyndication.com',
      'https://www.google-analytics.com',
    ],
    connectSrc,
    frameSrc: [
      "'self'",
      'https://googleads.g.doubleclick.net',
      'https://tpc.googlesyndication.com',
      'https://pagead2.googlesyndication.com',
      'https://js.stripe.com',
      'https://hooks.stripe.com',
    ],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'", siteOrigin],
    frameAncestors: ["'self'"],
    upgradeInsecureRequests: isProd ? [] : null,
  };
}

export function getHelmetOptions() {
  return {
    contentSecurityPolicy: {
      directives: buildCspDirectives({ forApi: true }),
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    frameguard: { action: 'deny' },
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  };
}

export const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=()';

/** Flat CSP string for Vite dev/preview response headers. */
export function buildCspHeaderString() {
  const d = buildCspDirectives({ forApi: false });
  return Object.entries(d)
    .filter(([, v]) => v != null && v !== false)
    .map(([key, value]) => {
      const kebab = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      const list = Array.isArray(value) ? value.join(' ') : value;
      return `${kebab} ${list}`;
    })
    .join('; ');
}
