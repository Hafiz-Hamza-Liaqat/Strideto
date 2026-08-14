/**
 * Government fee validation (Phase 17D-2).
 *
 * Government fees stay separate from provider / third-party / platform fees.
 * Unknown official amounts use not_catalogued. No invented FX truth.
 */
import {
  FEE_AMOUNT_MODELS,
  FEE_CADENCE,
  FEE_CATEGORIES,
  PROVIDER_FEE_OWNERSHIP,
  isValidFeeAmountModel,
} from './catalogConstants.js';

const ISO_CURRENCY = /^[A-Z]{3}$/;
const FEE_CATEGORY_SET = new Set(Object.values(FEE_CATEGORIES));

export function validateGovernmentFeeRecord(input = {}) {
  const errors = [];
  const ownership = input.ownership || PROVIDER_FEE_OWNERSHIP.GOVERNMENT;
  if (ownership !== PROVIDER_FEE_OWNERSHIP.GOVERNMENT) {
    errors.push('government fee ownership must be government');
  }

  const currency = typeof input.currency === 'string' ? input.currency.trim().toUpperCase() : '';
  if (!ISO_CURRENCY.test(currency)) errors.push('currency is required as ISO 4217');

  const amountModel = input.amountModel || FEE_AMOUNT_MODELS.NOT_CATALOGUED;
  if (!isValidFeeAmountModel(amountModel)) errors.push('amountModel is invalid');

  const feeCategory = input.feeCategory;
  if (!FEE_CATEGORY_SET.has(feeCategory)) errors.push('feeCategory is invalid');

  if (typeof input.fxAuthoritative === 'boolean' && input.fxAuthoritative) {
    errors.push('fx conversion is not authoritative catalog truth');
  }

  let amount = null;
  let min = null;
  let max = null;

  if (amountModel === FEE_AMOUNT_MODELS.FIXED) {
    amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0) errors.push('fixed amount must be >= 0');
  } else if (amountModel === FEE_AMOUNT_MODELS.RANGE) {
    min = Number(input.min);
    max = Number(input.max);
    if (!Number.isFinite(min) || min < 0) errors.push('range min must be >= 0');
    if (!Number.isFinite(max) || max < 0) errors.push('range max must be >= 0');
    if (Number.isFinite(min) && Number.isFinite(max) && max < min) {
      errors.push('range max must be >= min');
    }
  } else if (amountModel === FEE_AMOUNT_MODELS.NOT_CATALOGUED) {
    if (input.amount != null && input.amount !== '') {
      errors.push('not_catalogued fee must not invent an amount');
    }
  } else if (amountModel === FEE_AMOUNT_MODELS.VARIABLE) {
    if (input.amount != null && Number(input.amount) < 0) {
      errors.push('negative amount rejected');
    }
  }

  const effectiveFrom = input.effectiveFrom || null;
  const effectiveTo = input.effectiveTo || null;
  if (effectiveFrom && effectiveTo && new Date(effectiveTo) <= new Date(effectiveFrom)) {
    errors.push('effectiveTo must be after effectiveFrom');
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      feeId: input.feeId,
      jurisdictionId: input.jurisdictionId,
      authorityId: input.authorityId,
      entityTypeId: input.entityTypeId || null,
      feeCategory,
      label: input.label,
      currency,
      amountModel,
      amount: amountModel === FEE_AMOUNT_MODELS.FIXED ? amount : null,
      min: amountModel === FEE_AMOUNT_MODELS.RANGE ? min : null,
      max: amountModel === FEE_AMOUNT_MODELS.RANGE ? max : null,
      required: input.required !== false,
      cadence: input.cadence || FEE_CADENCE.ONE_TIME,
      ownership: PROVIDER_FEE_OWNERSHIP.GOVERNMENT,
      fxAuthoritative: false,
      effectiveFrom,
      effectiveTo,
      sourceId: input.sourceId,
      sourceVersion: input.sourceVersion,
      reviewStatus: input.reviewStatus,
      reviewDueAt: input.reviewDueAt,
      schemaVersion: input.schemaVersion,
      recordVersion: Number.isInteger(input.recordVersion) ? input.recordVersion : 0,
    },
  };
}
