import { currencyMinorUnits, normalizeCurrency } from '../international/currency.js';
import { fromDecimal, toDecimalString } from '../international/money.js';
import { formatMoney } from '../international/dateDisplay.js';

export function educationServicePriceFromInput(amount, currency) {
  const code = normalizeCurrency(currency);
  const raw = String(amount ?? '').trim();
  if (!code) throw new Error('Choose a valid three-letter currency code.');
  if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error('Enter a non-negative currency amount.');
  const decimals = raw.includes('.') ? raw.split('.')[1].length : 0;
  const supported = currencyMinorUnits(code);
  if (decimals > supported) throw new Error(`${code} supports at most ${supported} decimal places.`);
  return fromDecimal(raw, code);
}

export function educationServicePriceInput(money) {
  return toDecimalString(money);
}

export function educationServicePublicPriceLabel({ pricingMode, price } = {}, options = {}) {
  if (pricingMode === 'free') return 'Free';
  if (pricingMode === 'contact_for_details') return 'Contact for details';
  if (pricingMode === 'paid_future' || pricingMode === 'payment_not_configured') return 'Provider-stated price; online payment is not configured';
  const formatted = formatMoney(price, options);
  const amount = formatted && price?.currency ? `${formatted} ${price.currency}` : formatted;
  if (pricingMode === 'fixed_price') return amount || 'Fixed price';
  if (pricingMode === 'starting_from') return amount ? `Starting from ${amount}` : 'Starting-from price';
  if (pricingMode === 'quote_required') return 'Quote required';
  return 'Contact for details';
}
