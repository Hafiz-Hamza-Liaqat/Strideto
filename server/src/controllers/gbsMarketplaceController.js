import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getPublicMarketplaceEnabled,
  getPublicMarketplaceListing,
  listPublicMarketplaceListings,
} from '../services/gbs/gbsMarketplaceService.js';

function sendError(res, err) {
  const status = err.status || 500;
  if (status === 404) {
    return res.status(404).json({ error: 'not_found' });
  }
  const payload = { error: err.code || 'server_error' };
  if (err.details) payload.details = err.details;
  return res.status(status).json(payload);
}

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store');
}

export const getEnabled = asyncHandler(async (_req, res) => {
  noStore(res);
  const body = await getPublicMarketplaceEnabled();
  return res.status(200).json(body);
});

export const listListings = asyncHandler(async (req, res) => {
  noStore(res);
  try {
    const body = await listPublicMarketplaceListings(req.query, process.env);
    return res.status(200).json(body);
  } catch (err) {
    return sendError(res, err);
  }
});

export const getListing = asyncHandler(async (req, res) => {
  noStore(res);
  try {
    const item = await getPublicMarketplaceListing(req.params.listingSlug, process.env);
    return res.status(200).json({ item });
  } catch (err) {
    return sendError(res, err);
  }
});
