/**
 * SEO-P5 — IndexNow ownership key file (www.strideto.com).
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { readIndexNowConfig } from '../services/seo/indexNowConfig.js';

/**
 * GET /indexnow-key.txt — text/plain key verification for IndexNow.
 * Also reachable via Vercel rewrite from www.strideto.com/indexnow-key.txt.
 */
export const getIndexNowKeyFile = asyncHandler(async (_req, res) => {
  const config = readIndexNowConfig();
  if (!config.enabled || !config.key) {
    res.status(404).type('text/plain').send('');
    return;
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.type('text/plain').send(config.key);
});
