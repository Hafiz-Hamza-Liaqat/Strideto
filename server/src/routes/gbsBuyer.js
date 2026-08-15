import { Router } from 'express';
import { secureTrustedOrigin } from '../middleware/secureTrustedOrigin.js';
import { gbsBuyerWriteLimiter } from '../middleware/rateLimit.js';
import {
  businessClientActivateAuth,
  businessClientProductAuth,
} from '../middleware/requireUserCapability.js';
import * as buyer from '../controllers/gbsBuyerController.js';

export const gbsBuyerRouter = Router();

gbsBuyerRouter.get('/business/enabled', ...businessClientActivateAuth, buyer.getEnabled);
gbsBuyerRouter.post(
  '/business/activate',
  ...businessClientActivateAuth,
  secureTrustedOrigin,
  gbsBuyerWriteLimiter,
  buyer.activate
);
gbsBuyerRouter.get('/business/overview', ...businessClientProductAuth, buyer.overview);
gbsBuyerRouter.get('/business/requests', ...businessClientProductAuth, buyer.listRequests);
gbsBuyerRouter.post(
  '/business/requests',
  ...businessClientProductAuth,
  secureTrustedOrigin,
  gbsBuyerWriteLimiter,
  buyer.createRequest
);
gbsBuyerRouter.get('/business/requests/:requestRef', ...businessClientProductAuth, buyer.getRequest);
gbsBuyerRouter.post(
  '/business/requests/:requestRef/cancel',
  ...businessClientProductAuth,
  secureTrustedOrigin,
  gbsBuyerWriteLimiter,
  buyer.cancelRequest
);
gbsBuyerRouter.get('/business/quotes', ...businessClientProductAuth, buyer.listQuotes);
gbsBuyerRouter.get('/business/quotes/:quoteRef', ...businessClientProductAuth, buyer.getQuote);
gbsBuyerRouter.post(
  '/business/quotes/:quoteRef/accept',
  ...businessClientProductAuth,
  secureTrustedOrigin,
  gbsBuyerWriteLimiter,
  buyer.acceptQuote
);
gbsBuyerRouter.post(
  '/business/quotes/:quoteRef/decline',
  ...businessClientProductAuth,
  secureTrustedOrigin,
  gbsBuyerWriteLimiter,
  buyer.declineQuote
);
gbsBuyerRouter.post(
  '/business/quotes/:quoteRef/case',
  ...businessClientProductAuth,
  secureTrustedOrigin,
  gbsBuyerWriteLimiter,
  buyer.ensureCase
);
gbsBuyerRouter.get('/business/cases', ...businessClientActivateAuth, buyer.listCases);
gbsBuyerRouter.get('/business/cases/:caseRef', ...businessClientActivateAuth, buyer.getCase);
gbsBuyerRouter.post(
  '/business/cases/:caseRef/tasks/:taskRef/complete',
  ...businessClientProductAuth,
  secureTrustedOrigin,
  gbsBuyerWriteLimiter,
  buyer.completeCaseTask
);
gbsBuyerRouter.post(
  '/business/cases/:caseRef/cancel',
  ...businessClientProductAuth,
  secureTrustedOrigin,
  gbsBuyerWriteLimiter,
  buyer.cancelCase
);
