/**
 * Quote commercial contract (Phase 17D-7).
 *
 * 17D-1 placeholder evolved: opaque publicQuoteRef, integer Money helpers,
 * persisted expired, customer decline. No payment side effect.
 */
import { addMoney, fromDecimal, makeMoney, parseMoney } from '../international/money.js';
import { GBS_PRICING_MODES, GBS_PROVIDER_BOUNDS, GBS_SCHEMA_VERSION } from './constants.js';
import { FEE_AMOUNT_MODELS } from './catalogConstants.js';

export const GBS_QUOTE_SCHEMA_VERSION = '17d-7.0';

export const QUOTE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  WITHDRAWN: 'withdrawn',
  EXPIRED: 'expired',
  SUPERSEDED: 'superseded',
});

const STATUS_SET = new Set(Object.values(QUOTE_STATUSES));
export const QUOTE_STATUSES_EMITTED = Object.freeze([
  QUOTE_STATUSES.DRAFT,
  QUOTE_STATUSES.SENT,
  QUOTE_STATUSES.ACCEPTED,
  QUOTE_STATUSES.DECLINED,
  QUOTE_STATUSES.WITHDRAWN,
  QUOTE_STATUSES.EXPIRED,
]);

export const QUOTE_ACTIVE_STATUSES = Object.freeze([QUOTE_STATUSES.DRAFT, QUOTE_STATUSES.SENT]);
export const QUOTE_TERMINAL_STATUSES = Object.freeze([
  QUOTE_STATUSES.ACCEPTED,
  QUOTE_STATUSES.DECLINED,
  QUOTE_STATUSES.WITHDRAWN,
  QUOTE_STATUSES.EXPIRED,
]);

export const QUOTE_FEE_TYPES = Object.freeze({
  PROVIDER: 'providerFee',
  GOVERNMENT: 'governmentFee',
  THIRD_PARTY: 'thirdPartyFee',
  OPTIONAL: 'optionalFee',
});

export const QUOTE_FEE_CATEGORIES = Object.freeze({
  PROVIDER_SERVICE: 'provider_service',
  OFFICIAL_GOVERNMENT: 'official_government',
  THIRD_PARTY: 'third_party',
});

export const QUOTE_DECLINE_REASON_CODES = Object.freeze({
  PRICE: 'price',
  SCOPE: 'scope',
  TIMING: 'timing',
  OTHER: 'other',
});

const DECLINE_SET = new Set(Object.values(QUOTE_DECLINE_REASON_CODES));

export const GBS_QUOTE_BOUNDS = Object.freeze({
  REF_MAX: 64,
  REF_MIN: 16,
  COMMAND_ID_MAX: 120,
  TERMS_MAX: 4000,
  DECLINE_NOTE_MAX: 500,
  LABEL_MAX: 160,
  FEE_LINES_MAX: GBS_PROVIDER_BOUNDS.PROVIDER_FEE_LINES_MAX,
  INCLUDED_ITEMS_MAX: GBS_PROVIDER_BOUNDS.INCLUDED_ITEMS_MAX,
  EXCLUDED_ITEMS_MAX: GBS_PROVIDER_BOUNDS.EXCLUDED_ITEMS_MAX,
  VALID_FOR_DAYS_MIN: 1,
  VALID_FOR_DAYS_MAX: 30,
  VALID_FOR_DAYS_DEFAULT: 7,
  PAGE_DEFAULT: 20,
  PAGE_MAX: 50,
});

export const IMMUTABLE_QUOTE_STATUSES = Object.freeze([
  QUOTE_STATUSES.SENT,
  QUOTE_STATUSES.ACCEPTED,
]);

export function isValidQuoteStatus(value) {
  return typeof value === 'string' && STATUS_SET.has(value);
}

export function isEmittedQuoteStatus(value) {
  return QUOTE_STATUSES_EMITTED.includes(value);
}

export function quoteRevisionIsImmutable(status) {
  return IMMUTABLE_QUOTE_STATUSES.includes(status);
}

export function isActiveQuoteStatus(status) {
  return status === QUOTE_STATUSES.DRAFT || status === QUOTE_STATUSES.SENT;
}

export function isValidQuoteDeclineReason(value) {
  return typeof value === 'string' && DECLINE_SET.has(value);
}

export function isOpaqueQuoteRef(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < GBS_QUOTE_BOUNDS.REF_MIN || trimmed.length > GBS_QUOTE_BOUNDS.REF_MAX) {
    return false;
  }
  if (/^Q(T)?-\d+$/i.test(trimmed)) return false;
  if (/^[a-f0-9]{24}$/i.test(trimmed)) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}

export function normalizeValidForDays(raw) {
  if (raw == null || raw === '') return GBS_QUOTE_BOUNDS.VALID_FOR_DAYS_DEFAULT;
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  if (n < GBS_QUOTE_BOUNDS.VALID_FOR_DAYS_MIN || n > GBS_QUOTE_BOUNDS.VALID_FOR_DAYS_MAX) return null;
  return n;
}

export function computeExpiresAt(sentAt, validForDays) {
  const days = normalizeValidForDays(validForDays);
  if (days == null || !(sentAt instanceof Date) || Number.isNaN(sentAt.getTime())) return null;
  const expires = new Date(sentAt.getTime());
  expires.setUTCDate(expires.getUTCDate() + days);
  return expires;
}

export function quoteIsEffectivelyExpired(record, now = new Date()) {
  if (!record) return false;
  if (record.status === QUOTE_STATUSES.EXPIRED) return true;
  if (record.status !== QUOTE_STATUSES.SENT) return false;
  const expiresAt = record.expiresAt ? new Date(record.expiresAt) : null;
  return Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime());
}

export function effectiveQuoteStatus(record, now = new Date()) {
  if (!record) return null;
  if (quoteIsEffectivelyExpired(record, now) && record.status === QUOTE_STATUSES.SENT) {
    return QUOTE_STATUSES.EXPIRED;
  }
  return record.status;
}

export function validateQuoteLineItem(item = {}) {
  const errors = [];
  const label = typeof item.label === 'string' ? item.label.trim() : '';
  if (!label) errors.push('lineItem.label required');
  if (label.length > GBS_QUOTE_BOUNDS.LABEL_MAX) errors.push('lineItem.label too long');
  const feeType = item.feeType || QUOTE_FEE_TYPES.PROVIDER;
  if (!Object.values(QUOTE_FEE_TYPES).includes(feeType)) errors.push('lineItem.feeType invalid');
  if (item.ownership && item.ownership !== 'provider' && feeType === QUOTE_FEE_TYPES.PROVIDER) {
    errors.push('lineItem.ownership must be provider');
  }
  const money = parseMoney({
    amountMinor: item.amountMinor,
    currency: item.currency,
  });
  if (!money) errors.push('lineItem requires integer amountMinor + ISO currency');
  else if (money.amountMinor < 0) errors.push('lineItem.amountMinor must be non-negative');
  return errors;
}

export function parseProfessionalFeeLines(linesIn, quoteCurrency) {
  const errors = [];
  const source = Array.isArray(linesIn) ? linesIn : [];
  if (source.length > GBS_QUOTE_BOUNDS.FEE_LINES_MAX) errors.push('too many professionalFeeLines');
  const lines = [];
  for (let i = 0; i < source.length; i += 1) {
    const line = source[i] || {};
    const label = typeof line.label === 'string' ? line.label.trim() : '';
    if (!label) errors.push(`professionalFeeLines[${i}].label required`);
    if (label.length > GBS_QUOTE_BOUNDS.LABEL_MAX) errors.push(`professionalFeeLines[${i}].label too long`);
    if (line.ownership && line.ownership !== 'provider') {
      errors.push(`professionalFeeLines[${i}].ownership must be provider`);
    }
    if (line.feeKind === 'government' || line.category === QUOTE_FEE_CATEGORIES.OFFICIAL_GOVERNMENT) {
      errors.push(`professionalFeeLines[${i}] cannot be labelled as a government fee`);
    }
    const money = parseMoney({ amountMinor: line.amountMinor, currency: line.currency || quoteCurrency });
    if (!money) errors.push(`professionalFeeLines[${i}] requires integer amountMinor + ISO currency`);
    else if (money.amountMinor < 0) errors.push(`professionalFeeLines[${i}] negative amount rejected`);
    else if (quoteCurrency && money.currency !== quoteCurrency) {
      errors.push('professional fee lines must share one currency');
    } else {
      lines.push({
        label,
        amountMinor: money.amountMinor,
        currency: money.currency,
        ownership: 'provider',
        category: QUOTE_FEE_CATEGORIES.PROVIDER_SERVICE,
      });
    }
  }
  const currencies = new Set(lines.map((l) => l.currency));
  if (currencies.size > 1) errors.push('professional fee lines must share one currency');
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: lines, currency: lines[0]?.currency || quoteCurrency || null };
}

export function snapshotOfficialFee(fee) {
  if (!fee) return null;
  const currency = typeof fee.currency === 'string' ? fee.currency.trim().toUpperCase() : '';
  const amountModel = fee.amountModel || FEE_AMOUNT_MODELS.NOT_CATALOGUED;
  const listed = fee.eligibleCurrent === true
    && amountModel === FEE_AMOUNT_MODELS.FIXED
    && fee.amount != null
    && fee.amount !== '';
  let amountMinor = null;
  if (listed) {
    try {
      amountMinor = fromDecimal(fee.amount, currency).amountMinor;
    } catch {
      return null;
    }
  }
  return {
    feeId: fee.feeId,
    label: fee.label || 'Official/government fee',
    currency: currency || null,
    amountMinor,
    amountModel,
    cadence: fee.cadence || null,
    sourceId: fee.sourceId || fee.source?.sourceId || null,
    sourceVersion: fee.sourceVersion ?? fee.source?.sourceVersion ?? null,
    ownership: 'government',
    category: QUOTE_FEE_CATEGORIES.OFFICIAL_GOVERNMENT,
    listed: listed === true,
    min: amountModel === FEE_AMOUNT_MODELS.RANGE ? fee.min ?? null : null,
    max: amountModel === FEE_AMOUNT_MODELS.RANGE ? fee.max ?? null : null,
  };
}

export function computeQuoteTotals({ currency, professionalFeeLines = [], officialFeeLines = [] } = {}) {
  if (!currency) {
    return {
      subtotalProfessionalMinor: null,
      officialFeeGroups: [],
      totalCustomerAmountMinor: null,
    };
  }
  let professional = makeMoney(0, currency);
  for (const line of professionalFeeLines) {
    professional = addMoney(professional, makeMoney(line.amountMinor, line.currency));
  }
  const grouped = new Map();
  for (const line of officialFeeLines) {
    if (line.listed !== true || line.amountModel !== FEE_AMOUNT_MODELS.FIXED || line.amountMinor == null) {
      continue;
    }
    const prev = grouped.get(line.currency) || makeMoney(0, line.currency);
    grouped.set(line.currency, addMoney(prev, makeMoney(line.amountMinor, line.currency)));
  }
  const officialFeeGroups = [...grouped.entries()].map(([code, money]) => ({
    currency: code,
    amountMinor: money.amountMinor,
  }));
  let totalCustomerAmountMinor = null;
  if (officialFeeGroups.length === 0) {
    totalCustomerAmountMinor = professional.amountMinor;
  } else if (officialFeeGroups.length === 1 && officialFeeGroups[0].currency === currency) {
    totalCustomerAmountMinor = addMoney(
      professional,
      makeMoney(officialFeeGroups[0].amountMinor, officialFeeGroups[0].currency)
    ).amountMinor;
  }
  return {
    subtotalProfessionalMinor: professional.amountMinor,
    officialFeeGroups,
    totalCustomerAmountMinor,
  };
}

export function assertListingPriceHonesty(listing = {}, professionalSubtotalMinor, currency) {
  const mode = listing.pricingMode || GBS_PRICING_MODES.QUOTE_REQUIRED;
  const lines = Array.isArray(listing.providerFeeLines) ? listing.providerFeeLines : [];
  const first = lines[0];
  if (mode === GBS_PRICING_MODES.QUOTE_REQUIRED) return { ok: true };
  if (!Number.isSafeInteger(professionalSubtotalMinor) || !currency) {
    return { ok: false, error: 'professional_subtotal_required' };
  }
  if (mode === GBS_PRICING_MODES.FIXED) {
    if (!first || !Number.isSafeInteger(first.amountMinor) || !first.currency) {
      return { ok: false, error: 'listing_fixed_price_missing' };
    }
    if (first.currency !== currency) return { ok: false, error: 'listing_currency_mismatch' };
    if (professionalSubtotalMinor !== first.amountMinor) return { ok: false, error: 'fixed_price_mismatch' };
    return { ok: true };
  }
  if (mode === GBS_PRICING_MODES.STARTING_AT) {
    if (!first || !Number.isSafeInteger(first.amountMinor) || !first.currency) {
      return { ok: false, error: 'listing_starting_price_missing' };
    }
    if (first.currency !== currency) return { ok: false, error: 'listing_currency_mismatch' };
    if (professionalSubtotalMinor < first.amountMinor) return { ok: false, error: 'starting_at_undercut' };
    return { ok: true };
  }
  if (mode === GBS_PRICING_MODES.RANGE) {
    const max = lines[1];
    if (!first || !max || !Number.isSafeInteger(first.amountMinor) || !Number.isSafeInteger(max.amountMinor)) {
      return { ok: false, error: 'listing_range_missing' };
    }
    if (first.currency !== currency || max.currency !== currency) {
      return { ok: false, error: 'listing_currency_mismatch' };
    }
    if (professionalSubtotalMinor < first.amountMinor || professionalSubtotalMinor > max.amountMinor) {
      return { ok: false, error: 'range_price_outside' };
    }
    return { ok: true };
  }
  return { ok: false, error: 'pricing_mode_invalid' };
}

/**
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateQuoteContract(input = {}) {
  const errors = [];
  const publicQuoteRef = typeof input.publicQuoteRef === 'string' ? input.publicQuoteRef.trim() : '';
  if (!isOpaqueQuoteRef(publicQuoteRef)) errors.push('publicQuoteRef is required and must be opaque');

  const revision = Number(input.revision ?? input.quoteRevision);
  if (!Number.isInteger(revision) || revision < 1) errors.push('revision must be an integer >= 1');

  const status = input.status || QUOTE_STATUSES.DRAFT;
  if (!isValidQuoteStatus(status)) errors.push('status is invalid');
  if (status === QUOTE_STATUSES.SUPERSEDED) errors.push('superseded is reserved and not emitted in 17D-7');

  const parsedLines = parseProfessionalFeeLines(input.professionalFeeLines || input.lineItems, input.currency);
  if (!parsedLines.ok) errors.push(...parsedLines.errors);
  const currency = parsedLines.currency || (typeof input.currency === 'string' ? input.currency.trim().toUpperCase() : '');
  if (!currency) errors.push('currency must be ISO 4217');

  if (Array.isArray(input.thirdPartyFeeLines) && input.thirdPartyFeeLines.length > 0) {
    errors.push('thirdPartyFeeLines must remain empty');
  }

  const recordVersion = Number.isInteger(input.recordVersion) ? input.recordVersion : 0;
  if (errors.length) return { ok: false, errors };

  const totals = computeQuoteTotals({
    currency,
    professionalFeeLines: parsedLines.value,
    officialFeeLines: Array.isArray(input.officialFeeLines) ? input.officialFeeLines : [],
  });

  return {
    ok: true,
    value: {
      publicQuoteRef,
      revision,
      status,
      currency,
      professionalFeeLines: parsedLines.value,
      officialFeeLines: Array.isArray(input.officialFeeLines) ? input.officialFeeLines : [],
      thirdPartyFeeLines: [],
      subtotalProfessionalMinor: totals.subtotalProfessionalMinor,
      officialFeeGroups: totals.officialFeeGroups,
      totalCustomerAmountMinor: totals.totalCustomerAmountMinor,
      issuedAt: input.issuedAt || input.sentAt || null,
      expiresAt: input.expiresAt || null,
      schemaVersion: input.schemaVersion || GBS_QUOTE_SCHEMA_VERSION || GBS_SCHEMA_VERSION,
      recordVersion,
    },
  };
}

export function nextQuoteRevision(existing) {
  const revision = Number(existing?.revision ?? existing?.quoteRevision);
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
