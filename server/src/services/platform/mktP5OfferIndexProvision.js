/**
 * MKT-P5 — create-only index provisioning for ApplicationOffer collection.
 * autoIndex remains false in production unless MONGO_AUTO_INDEX=1.
 */
import { ApplicationOffer } from '../../models/ApplicationOffer.js';
import {
  compareCriticalIndexes,
  inspectIndexesSafely,
  provisionMissingIndexes,
} from './criticalIndexProvision.js';

export const APPLICATION_OFFER_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'application_offer_app_status',
    key: Object.freeze({ applicationId: 1, status: 1, createdAt: -1 }),
  }),
  Object.freeze({
    name: 'application_offer_client_idempotency_unique',
    key: Object.freeze({ applicationId: 1, clientCommandId: 1 }),
    unique: true,
    partialFilterExpression: Object.freeze({
      clientCommandId: Object.freeze({ $type: 'string', $gt: '' }),
    }),
  }),
  Object.freeze({
    name: 'application_offer_active_sent_unique',
    key: Object.freeze({ applicationId: 1 }),
    unique: true,
    partialFilterExpression: Object.freeze({
      status: 'sent',
    }),
  }),
]);

export async function provisionMktP5OfferIndexes({
  offerCollection = ApplicationOffer.collection,
} = {}) {
  const offers = await provisionMissingIndexes({
    collection: offerCollection,
    expected: APPLICATION_OFFER_CRITICAL_INDEXES,
  });
  return { offers };
}

export async function verifyMktP5OfferIndexes({
  offerCollection = ApplicationOffer.collection,
} = {}) {
  const offerInspection = await inspectIndexesSafely(() => offerCollection.indexes());
  const offers = compareCriticalIndexes(
    APPLICATION_OFFER_CRITICAL_INDEXES,
    offerInspection.indexes
  );
  return {
    ok: offers.ok,
    offers,
  };
}
