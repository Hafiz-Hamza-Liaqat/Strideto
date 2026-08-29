import { asyncHandler } from '../utils/asyncHandler.js';
import { auditFromRequest } from '../services/auditService.js';
import { hiringOwnerIdFrom } from '../services/employer/employerOrganizationService.js';
import * as OfferService from '../services/applicationOfferService.js';
import { serializeOffer } from '../utils/applicationOfferView.js';
import { getOwnedApplicationForEmployer } from '../services/applicationCommunicationService.js';

function scopeEmployerId(req) {
  return hiringOwnerIdFrom(req);
}

function scopeUserId(req) {
  return req.user?.userId;
}

function auditCtx(req) {
  const base = auditFromRequest(req);
  return { ip: base.ip || '' };
}

export const employerListOffers = asyncHandler(async (req, res) => {
  const employerId = scopeEmployerId(req);
  await getOwnedApplicationForEmployer(employerId, req.params.id);
  const [offers, active] = await Promise.all([
    OfferService.listOffersForApplication(req.params.id),
    OfferService.findActiveOffer(req.params.id),
  ]);
  res.json({
    data: {
      offers,
      activeOffer: active ? serializeOffer(active) : null,
    },
  });
});

export const employerSendOffer = asyncHandler(async (req, res) => {
  OfferService.rejectUnexpectedBodyKeys(req.body, [
    'startDate',
    'employmentType',
    'workMode',
    'compensationText',
    'compensation',
    'offerNote',
    'note',
    'expiresAt',
    'clientCommandId',
  ]);
  const employerId = scopeEmployerId(req);
  const result = await OfferService.sendApplicationOffer(
    employerId,
    req.params.id,
    req.body,
    auditCtx(req)
  );
  res.status(result.duplicate ? 200 : 201).json({
    data: result.offer,
    duplicate: result.duplicate,
    sideEffects: result.sideEffects,
  });
});

export const employerWithdrawOffer = asyncHandler(async (req, res) => {
  OfferService.rejectUnexpectedBodyKeys(req.body, []);
  const employerId = scopeEmployerId(req);
  const result = await OfferService.withdrawApplicationOffer(
    employerId,
    req.params.id,
    req.params.offerId,
    auditCtx(req)
  );
  res.json({ data: result });
});

export const candidateRespondOffer = asyncHandler(async (req, res) => {
  OfferService.rejectUnexpectedBodyKeys(req.body, ['response', 'status']);
  const userId = scopeUserId(req);
  const result = await OfferService.respondToApplicationOffer(
    userId,
    req.params.id,
    req.params.offerId,
    req.body,
    auditCtx(req)
  );
  res.json({ data: result });
});
