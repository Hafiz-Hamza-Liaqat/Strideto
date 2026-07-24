import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';
const WINDOW_MS = 15 * 60 * 1000;

function authPath(req) {
  const path = req.path || '';
  return path.startsWith('/auth/');
}

function adminPath(req) {
  const path = req.path || '';
  return path.startsWith('/admin');
}

/** Public API — auth and admin routes use dedicated limiters */
export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: isDev ? 2000 : 500,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => authPath(req) || adminPath(req),
});

/** Login / register / reset — 5 attempts per minute (failed only) */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 50 : 5,
  skipSuccessfulRequests: true,
  message: { error: 'Too many authentication attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Refresh token — separate bucket; successful refreshes do not count */
export const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 30,
  skipSuccessfulRequests: true,
  message: { error: 'Too many token refresh attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 20 : 5,
  message: { error: 'Too many password reset requests. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** File uploads — 20/min per IP in production */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 60 : 20,
  message: { error: 'Too many upload requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Employer login/register */
export const employerAuthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 50 : 5,
  skipSuccessfulRequests: true,
  message: { error: 'Too many employer authentication attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Public contact form — 5 submissions per hour per IP */
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 30 : 5,
  message: { error: 'Too many contact submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Support ticket submission */
export const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 30 : 10,
  message: { error: 'Too many support requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Global feedback widget — 8 submissions per hour per IP */
export const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 40 : 8,
  message: { error: 'Too many feedback submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
/** Dynamic form submissions — per IP hourly */
export const formSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 60 : 10,
  message: { error: 'Too many form submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Search / analytics — generous limit for normal filtering */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 120 : 60,
  message: { error: 'Too many search requests. Slow down and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Public ad impression/click beacons */
export const adTrackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 300 : 120,
  message: { error: 'Too many ad tracking requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Authenticated admin — GET 300/min */
export const adminReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 600 : 300,
  message: { error: 'Too many admin read requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'GET',
});

/** Authenticated admin — POST/PUT/PATCH 60/min */
export const adminWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 120 : 60,
  message: { error: 'Too many admin write requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !['POST', 'PUT', 'PATCH'].includes(req.method),
});

/** Authenticated admin — DELETE 30/min */
export const adminDeleteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 60 : 30,
  message: { error: 'Too many admin delete requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'DELETE',
});
