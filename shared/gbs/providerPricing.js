/**
 * Provider-defined pricing (Phase 17D-3).
 * Separate from government catalog fees. Currency is explicit — never inferred.
 */
import { makeMoney, parseMoney } from '../international/money.js';
import { GBS_PRICING_MODES, GBS_PROVIDER_BOUNDS } from './constants.js';

const MODE_SET = new Set(Object.values(GBS_PRICING_MODES));

export function isValidPricingMode(value) {
  return MODE_SET.has(value);
}

function parseFeeLine(line = {}, index) {
  const errors = [];
  const label = typeof line.label === 'string' ? line.label.trim() : '';
  if (!label) errors.push(`providerFeeLines[${index}].label required`);
  if (label.length > 160) errors.push(`providerFeeLines[${index}].label too long`);
  if (line.ownership && line.ownership !== 'provider') {
    errors.push(`providerFeeLines[${index}].ownership must be provider`);
  }
  if (line.feeKind === 'government' || line.ownership === 'government') {
    errors.push(`providerFeeLines[${index}] cannot be labelled as a government fee`);
  }
  const money = parseMoney({
    amountMinor: line.amountMinor,
    currency: line.currency,
  });
  if (!money) errors.push(`providerFeeLines[${index}] requires integer amountMinor + ISO currency`);
  else if (money.amountMinor < 0) errors.push(`providerFeeLines[${index}] negative amount rejected`);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      label,
      amountMinor: money.amountMinor,
      currency: money.currency,
      ownership: 'provider',
    },
  };
}

/**
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateProviderPricing(input = {}) {
  const errors = [];
  const pricingMode = input.pricingMode || GBS_PRICING_MODES.QUOTE_REQUIRED;
  if (!isValidPricingMode(pricingMode)) errors.push('pricingMode is invalid');

  const linesIn = Array.isArray(input.providerFeeLines) ? input.providerFeeLines : [];
  if (linesIn.length > GBS_PROVIDER_BOUNDS.PROVIDER_FEE_LINES_MAX) {
    errors.push('too many providerFeeLines');
  }

  const lines = [];
  for (let i = 0; i < linesIn.length; i += 1) {
    const parsed = parseFeeLine(linesIn[i], i);
    if (!parsed.ok) errors.push(...parsed.errors);
    else lines.push(parsed.value);
  }

  if (pricingMode === GBS_PRICING_MODES.QUOTE_REQUIRED) {
    // Quote-required stores no fake mandatory fixed price.
  } else if (pricingMode === GBS_PRICING_MODES.RANGE) {
    if (lines.length < 2) errors.push('range pricing requires min and max provider fee lines');
    if (lines.length >= 2 && lines[0].currency !== lines[1].currency) {
      errors.push('range min/max must share currency');
    }
    if (lines.length >= 2 && lines[0].amountMinor > lines[1].amountMinor) {
      errors.push('range min must be <= max');
    }
  } else if (
    pricingMode === GBS_PRICING_MODES.FIXED ||
    pricingMode === GBS_PRICING_MODES.STARTING_AT
  ) {
    if (lines.length < 1) errors.push(`${pricingMode} pricing requires a provider fee line with currency`);
  }

  const currencies = new Set(lines.map((l) => l.currency));
  if (currencies.size > 1) errors.push('provider fee lines must share one currency');

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      pricingMode,
      providerFeeLines: lines,
      currency: lines[0]?.currency || null,
    },
  };
}

export function formatMoneyLabel(amountMinor, currency) {
  try {
    const money = makeMoney(amountMinor, currency);
    const major = money.amountMinor / 100;
    return `${money.currency} ${major.toFixed(2)}`;
  } catch {
    return '';
  }
}
