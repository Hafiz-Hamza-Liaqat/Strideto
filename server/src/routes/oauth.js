import { Router } from 'express';
import { privateResponse } from '../middleware/privateResponse.js';
import { oauthStartLimiter, oauthCallbackLimiter } from '../middleware/rateLimit.js';
import { googleStart, googleCallback } from '../controllers/oauthController.js';

/**
 * Social sign-in routes, mounted on the existing `/api` auth surface.
 *
 * `secureTrustedOrigin` is intentionally absent. Both endpoints are top-level
 * browser navigations — the callback is a redirect from Google's origin and
 * carries no trusted `Origin`, so an origin check would reject every real
 * login. CSRF and replay protection on this path come from `state` (compared
 * timing-safe, then burned), PKCE S256, and the `nonce` bound into the
 * `id_token`.
 *
 * The password routes in `routes/auth.js` are untouched and keep every
 * middleware they had.
 */
export const oauthRouter = Router();
oauthRouter.use(privateResponse);

oauthRouter.get('/auth/oauth/google/start', oauthStartLimiter, googleStart);
oauthRouter.get('/auth/oauth/google/callback', oauthCallbackLimiter, googleCallback);
