import { Router } from 'express';
import { secureTrustedOrigin } from '../middleware/secureTrustedOrigin.js';
import { gbsBuyerWriteLimiter, gbsCaseDocumentWriteLimiter, gbsCaseDocumentUploadLimiter, gbsCaseDocumentAccessLimiter } from '../middleware/rateLimit.js';
import {
  businessClientActivateAuth,
  businessClientProductAuth,
} from '../middleware/requireUserCapability.js';
import * as buyer from '../controllers/gbsBuyerController.js';
import * as buyerDocs from '../controllers/gbsBuyerCaseDocumentController.js';
import { gbsCaseDocumentFileMiddleware } from '../middleware/gbsCaseDocumentUpload.js';

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
gbsBuyerRouter.patch(
  '/business/cases/:caseRef/requirement-facts',
  ...businessClientProductAuth,
  secureTrustedOrigin,
  gbsBuyerWriteLimiter,
  buyer.updateRequirementFact
);
gbsBuyerRouter.get(
  '/business/cases/:caseRef/document-requirements',
  ...businessClientActivateAuth,
  buyerDocs.listCaseDocumentRequirements
);
gbsBuyerRouter.post(
  '/business/cases/:caseRef/document-requirements/:requirementRef/upload/init',
  ...businessClientProductAuth,
  secureTrustedOrigin,
  gbsCaseDocumentWriteLimiter,
  buyerDocs.initializeUpload
);
gbsBuyerRouter.post(
  '/business/cases/:caseRef/document-requirements/:requirementRef/upload/complete',
  ...businessClientProductAuth,
  secureTrustedOrigin,
  gbsCaseDocumentUploadLimiter,
  gbsCaseDocumentFileMiddleware,
  buyerDocs.completeUpload
);
gbsBuyerRouter.post(
  '/business/cases/:caseRef/document-requirements/:requirementRef/replace',
  ...businessClientProductAuth,
  secureTrustedOrigin,
  gbsCaseDocumentUploadLimiter,
  gbsCaseDocumentFileMiddleware,
  buyerDocs.replaceUpload
);
gbsBuyerRouter.get(
  '/business/cases/:caseRef/document-requirements/:requirementRef/file',
  ...businessClientActivateAuth,
  gbsCaseDocumentAccessLimiter,
  buyerDocs.downloadDocument
);
gbsBuyerRouter.get(
  '/business/cases/:caseRef/filing-authorization',
  ...businessClientActivateAuth,
  buyer.getFilingAuthorization
);
gbsBuyerRouter.post(
  '/business/cases/:caseRef/filing-authorization/grant',
  ...businessClientProductAuth,
  secureTrustedOrigin,
  gbsBuyerWriteLimiter,
  buyer.grantFilingAuthorization
);
gbsBuyerRouter.post(
  '/business/cases/:caseRef/filing-authorization/revoke',
  ...businessClientActivateAuth,
  secureTrustedOrigin,
  gbsBuyerWriteLimiter,
  buyer.revokeFilingAuthorization
);
