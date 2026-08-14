/**
 * Quote revision contract (Phase 17D-1) — contracts only, no product routes/UI.
 *
 * Sent quote: immutable revision.
 * Material change: new revision.
 * Accepted: specific revision, immutable except privileged audited correction.
 * Accept: future idempotent command. No payment side effect.
 */
import { GBS_SCHEMA_VERSION } from './constants.js';

export const QUOTE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  WITHDRAWN: 'withdrawn',
  SUPERSEDED: 'superseded',
});

const STATUS_SET = new Set(Object.values(QUOTE_STATUSES));

export const QUOTE_FEE_TYPES = Object.freeze({
  PROVIDER: 'providerFee',
  GOVERNMENT: 'governmentFee',
  THIRD_PARTY: 'thirdPartyFee',
  OPTIONAL: 'optionalFee',
});

export const IMMUTABLE_QUOTE_STATUSES = Object.freeze([
  QUOTE_STATUSES.SENT,
  QUOTE_STATUSES.ACCEPTED,
]);

export function isValidQuoteStatus(value) {
  return typeof value === 'string' && STATUS_SET.has(value);
}

export function quoteRevisionIsImmutable(status) {
  return IMMUTABLE_QUOTE_STATUSES.includes(status);
}

export function validateQuoteLineItem(item = {}) {
  const errors = [];
  if (typeof item.label !== 'string' || !item.label.trim()) errors.push('lineItem.label required');
  if (typeof item.feeType !== 'string' || !Object.values(QUOTE_FEE_TYPES).includes(item.feeType)) {
    errors.push('lineItem.feeType invalid');
  }
  if (!Number.isFinite(item.amountMinor) || item.amountMinor < 0) {
    errors.push('lineItem.amountMinor must be a non-negative number');
  }
  return errors;
}

/**
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateQuoteContract(input = {}) {
  const errors = [];
  const quoteNumber = typeof input.quoteNumber === 'string' ? input.quoteNumber.trim() : '';
  if (!quoteNumber) errors.push('quoteNumber is required');

  const revision = Number(input.revision);
  if (!Number.isInteger(revision) || revision < 1) errors.push('revision must be an integer >= 1');

  const status = input.status || QUOTE_STATUSES.DRAFT;
  if (!isValidQuoteStatus(status)) errors.push('status is invalid');

  const currency = typeof input.currency === 'string' ? input.currency.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(currency)) errors.push('currency must be ISO 4217');

  const lineItems = Array.isArray(input.lineItems) ? input.lineItems : [];
  if (lineItems.length === 0) errors.push('lineItems required');
  lineItems.forEach((item, i) => {
    for (const err of validateQuoteLineItem(item)) errors.push(`lineItems[${i}]: ${err}`);
  });

  const recordVersion = Number.isInteger(input.recordVersion) ? input.recordVersion : 0;

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      quoteNumber,
      revision,
      status,
      currency,
      lineItems,
      providerFee: Number(input.providerFee) || 0,
      governmentFee: Number(input.governmentFee) || 0,
      thirdPartyFee: Number(input.thirdPartyFee) || 0,
      optionalFee: Number(input.optionalFee) || 0,
      issuedAt: input.issuedAt || null,
      expiresAt: input.expiresAt || null,
      sourceSnapshots: input.sourceSnapshots && typeof input.sourceSnapshots === 'object'
        ? input.sourceSnapshots
        : {},
      termsSnapshot: input.termsSnapshot && typeof input.termsSnapshot === 'object'
        ? input.termsSnapshot
        : {},
      schemaVersion: input.schemaVersion || GBS_SCHEMA_VERSION,
      recordVersion,
    },
  };
}

/**
 * Material change to a sent/accepted quote must allocate a new revision.
 * Returns the next revision number; does not mutate the previous revision.
 */
export function nextQuoteRevision(existing) {
  const revision = Number(existing?.revision);
  if (!Number.isInteger(revision) || revision < 1) {
    throw Object.assign(new Error('Invalid quote revision'), { code: 'invalid_quote_revision' });
  }
  return revision + 1;
}

export function assertQuoteRevisionMutable(existing, { privilegedCorrection = false } = {}) {
  if (!existing) {
    throw Object.assign(new Error('Quote not found'), { code: 'quote_not_found', status: 404 });
  }
  if (quoteRevisionIsImmutable(existing.status) && !privilegedCorrection) {
    throw Object.assign(new Error('Quote revision is immutable'), {
      code: 'quote_revision_immutable',
      status: 409,
    });
  }
}
