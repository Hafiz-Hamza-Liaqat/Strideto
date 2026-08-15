import { Router } from 'express';
import { searchLimiter } from '../middleware/rateLimit.js';
import * as marketplace from '../controllers/gbsMarketplaceController.js';

export const gbsPublicRouter = Router();

gbsPublicRouter.get('/business-services/enabled', marketplace.getEnabled);
gbsPublicRouter.get('/business-services/listings', searchLimiter, marketplace.listListings);
gbsPublicRouter.get('/business-services/listings/:listingSlug', marketplace.getListing);
