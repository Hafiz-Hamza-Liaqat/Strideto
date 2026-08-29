/** MKT-P5 — offer view projection helpers (no service dependencies). */

export function deriveEffectiveOfferStatus(offer, now = new Date()) {
  if (!offer) return null;
  if (offer.status === 'expired') return 'expired';
  if (offer.status === 'sent' && offer.expiresAt && new Date(offer.expiresAt).getTime() < now.getTime()) {
    return 'expired';
  }
  return offer.status;
}

export function serializeOffer(doc, { includeNote = true } = {}) {
  if (!doc) return null;
  const effectiveStatus = deriveEffectiveOfferStatus(doc);
  return {
    _id: doc._id,
    status: doc.status,
    effectiveStatus,
    startDate: doc.startDate || null,
    employmentType: doc.employmentType || null,
    workMode: doc.workMode || null,
    compensationText: doc.compensationText || '',
    offerNote: includeNote ? doc.offerNote || '' : undefined,
    expiresAt: doc.expiresAt || null,
    respondedAt: doc.respondedAt || null,
    withdrawnAt: doc.withdrawnAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
