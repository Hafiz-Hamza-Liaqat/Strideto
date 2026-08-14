import rateLimit from 'express-rate-limit';
import { createRedisRateLimitStore } from './redisRateLimitStore.js';

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

function retryAfterHandler(_req, res, _next, options) {
  const retryAfterSec = Math.max(1, Math.ceil((options.windowMs || WINDOW_MS) / 1000));
  res.setHeader('Retry-After', String(retryAfterSec));
  res.status(options.statusCode).json(options.message);
}

const limitDefaults = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: retryAfterHandler,
};

function limiter(name, options) {
  return rateLimit({
    ...limitDefaults,
    store: createRedisRateLimitStore(name),
    ...options,
  });
}

/** Public API — auth and admin routes use dedicated limiters */
export const apiLimiter = limiter('api', {
  windowMs: WINDOW_MS,
  max: isDev ? 2000 : 500,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => authPath(req) || adminPath(req),
});

/** Login / register / reset — 5 attempts per minute (failed only) */
export const authLimiter = limiter('auth', {
  windowMs: 60 * 1000,
  max: isDev ? 50 : 5,
  skipSuccessfulRequests: true,
  message: { error: 'Too many authentication attempts. Try again later.' },
});

/** Refresh token — separate bucket; successful refreshes do not count */
export const refreshLimiter = limiter('refresh', {
  windowMs: 60 * 1000,
  max: isDev ? 100 : 30,
  skipSuccessfulRequests: true,
  message: { error: 'Too many token refresh attempts. Try again later.' },
});

export const forgotPasswordLimiter = limiter('forgot', {
  windowMs: 60 * 60 * 1000,
  max: isDev ? 20 : 5,
  message: { error: 'Too many password reset requests. Try again in an hour.' },
});

/** Verify-email attempts — bound guessing even with high-entropy tokens */
export const verifyEmailLimiter = limiter('verify-email', {
  windowMs: 15 * 60 * 1000,
  max: isDev ? 60 : 20,
  message: { error: 'Too many verification attempts. Try again later.' },
});

/** Resend verification — 5 / hour per IP in production */
export const resendVerificationLimiter = limiter('resend', {
  windowMs: 60 * 60 * 1000,
  max: isDev ? 30 : 5,
  message: { error: 'Too many verification email requests. Try again later.' },
});

/** File uploads — 20/min per IP in production */
export const uploadLimiter = limiter('upload', {
  windowMs: 60 * 1000,
  max: isDev ? 60 : 20,
  message: { error: 'Too many upload requests. Try again later.' },
});

/** Employer login/register */
export const employerAuthLimiter = limiter('employer-auth', {
  windowMs: 60 * 1000,
  max: isDev ? 50 : 5,
  skipSuccessfulRequests: true,
  message: { error: 'Too many employer authentication attempts. Try again later.' },
});

/** Public contact form — 5 submissions per hour per IP */
export const contactLimiter = limiter('contact', {
  windowMs: 60 * 60 * 1000,
  max: isDev ? 30 : 5,
  message: { error: 'Too many contact submissions. Please try again later.' },
});

/** Support ticket submission */
export const supportLimiter = limiter('support', {
  windowMs: 60 * 60 * 1000,
  max: isDev ? 30 : 10,
  message: { error: 'Too many support requests. Please try again later.' },
});

/** Global feedback widget — 8 submissions per hour per IP */
export const feedbackLimiter = limiter('feedback', {
  windowMs: 60 * 60 * 1000,
  max: isDev ? 40 : 8,
  message: { error: 'Too many feedback submissions. Please try again later.' },
});
/** Dynamic form submissions — per IP hourly */
export const formSubmissionLimiter = limiter('forms', {
  windowMs: 60 * 60 * 1000,
  max: isDev ? 60 : 10,
  message: { error: 'Too many form submissions. Please try again later.' },
});

/** Search / analytics — generous limit for normal filtering */
export const searchLimiter = limiter('search', {
  windowMs: 60 * 1000,
  max: isDev ? 120 : 60,
  message: { error: 'Too many search requests. Slow down and try again.' },
});

/** Public ad impression/click beacons */
export const adTrackingLimiter = limiter('ads', {
  windowMs: 60 * 1000,
  max: isDev ? 300 : 120,
  message: { error: 'Too many ad tracking requests. Please try again later.' },
});

/** Authenticated admin — GET 300/min */
export const adminReadLimiter = limiter('admin-read', {
  windowMs: 60 * 1000,
  max: isDev ? 600 : 300,
  message: { error: 'Too many admin read requests. Please wait a moment.' },
  skip: (req) => req.method !== 'GET',
});

/** Authenticated admin — POST/PUT/PATCH 60/min */
export const adminWriteLimiter = limiter('admin-write', {
  windowMs: 60 * 1000,
  max: isDev ? 120 : 60,
  message: { error: 'Too many admin write requests. Please wait a moment.' },
  skip: (req) => !['POST', 'PUT', 'PATCH'].includes(req.method),
});

/** Agent GBS capability claim / evidence writes */
export const gbsCapabilityWriteLimiter = limiter('gbs-capability-write', {
  windowMs: 15 * 60 * 1000,
  max: isDev ? 120 : 30,
  message: { error: 'Too many Business Services capability requests. Please wait.' },
});

/** Agent GBS listing create / update / submit */
export const gbsListingWriteLimiter = limiter('gbs-listing-write', {
  windowMs: 15 * 60 * 1000,
  max: isDev ? 120 : 40,
  message: { error: 'Too many Business Services listing requests. Please wait.' },
});

/** Agent GBS catalog / overview reads */
export const gbsProviderReadLimiter = limiter('gbs-provider-read', {
  windowMs: 60 * 1000,
  max: isDev ? 240 : 90,
  message: { error: 'Too many Business Services reads. Please wait.' },
});
export const adminDeleteLimiter = limiter('admin-delete', {
  windowMs: 60 * 1000,
  max: isDev ? 60 : 30,
  message: { error: 'Too many admin delete requests. Please wait a moment.' },
  skip: (req) => req.method !== 'DELETE',
});
