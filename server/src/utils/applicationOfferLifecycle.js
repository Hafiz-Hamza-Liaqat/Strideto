import { ApplicationOffer } from '../models/ApplicationOffer.js';

/** Persist past-due sent offers as expired so active-sent uniqueness is not blocked. */
export async function persistExpiredSentOffers(applicationId) {
  const now = new Date();
  await ApplicationOffer.updateMany(
    {
      applicationId,
      status: 'sent',
      expiresAt: { $lte: now },
      supersededBy: null,
    },
    { $set: { status: 'expired' } }
  );
}

export async function countActiveSentOffers(applicationId) {
  await persistExpiredSentOffers(applicationId);
  return ApplicationOffer.countDocuments({ applicationId, status: 'sent', supersededBy: null });
}
