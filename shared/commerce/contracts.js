import { addMoney, makeMoney, parseMoney } from '../international/money.js';

export const OWNER_TYPES = ['user', 'employer', 'organization', 'institution', 'platform'];
export const ACCOUNT_TYPES = ['credits', 'commerce'];
export const ORDER_STATUSES = ['draft', 'pending_payment', 'payment_processing', 'paid', 'failed', 'cancelled', 'refund_pending', 'partially_refunded', 'refunded'];
export const TRANSACTION_STATUSES = ['not_configured', 'provider_pending', 'confirmed', 'failed', 'reversed'];
export const REFUND_STATUSES = ['requested', 'approved', 'provider_pending', 'partially_refunded', 'refunded', 'rejected', 'failed'];
export const LEDGER_CATEGORIES = ['credit_issued', 'credit_spent', 'credit_refunded', 'purchase', 'platform_fee', 'service_amount', 'refund', 'adjustment', 'promotional_credit', 'reversal', 'payout_future', 'other'];
export const CREDIT_TYPES = ['employer_posting', 'employer_feature', 'agent_publishing', 'agent_promotion', 'promotional', 'plan_included'];

export function assertSameCurrency(...moneyValues) {
  const parsed = moneyValues.map(parseMoney);
  if (parsed.some((value) => !value)) throw new Error('Valid Money values are required');
  if (new Set(parsed.map((value) => value.currency)).size !== 1) throw new Error('Cross-currency arithmetic is not allowed');
  return parsed;
}

export function calculateFee(amount, policy = { type: 'none' }) {
  const money = parseMoney(amount); if (!money || money.amountMinor < 0) throw new Error('Non-negative Money is required');
  if (policy.type === 'none') return makeMoney(0, money.currency);
  if (policy.type === 'fixed') { const fixed = parseMoney(policy.amount); assertSameCurrency(money, fixed); return fixed; }
  if (policy.type === 'basis_points') {
    if (!Number.isInteger(policy.basisPoints) || policy.basisPoints < 0 || policy.basisPoints > 10000) throw new Error('basisPoints must be an integer from 0 to 10000');
    return makeMoney(Math.floor((money.amountMinor * policy.basisPoints + 5000) / 10000), money.currency);
  }
  throw new Error('Unsupported fee policy');
}

export function buildPricingSnapshot(product, quantity = 1, discount = null, feePolicy = { type: 'none' }) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error('Invalid quantity');
  const unit = parseMoney(product.price); if (!unit || unit.amountMinor < 0) throw new Error('Product requires non-negative Money');
  const base = makeMoney(unit.amountMinor * quantity, unit.currency); const discountMoney = discount ? parseMoney(discount) : makeMoney(0, unit.currency); assertSameCurrency(base, discountMoney);
  if (discountMoney.amountMinor < 0 || discountMoney.amountMinor > base.amountMinor) throw new Error('Invalid discount');
  const afterDiscount = makeMoney(base.amountMinor - discountMoney.amountMinor, base.currency); const fees = calculateFee(afterDiscount, feePolicy); const total = addMoney(afterDiscount, fees);
  return Object.freeze({ productId: product._id, productVersion: product.version, description: product.name, quantity, unitPrice: unit, baseAmount: base, discount: discountMoney, fees, tax: null, total, includedFeatures: [...(product.includedFeatures || [])], includedCredits: (product.includedCredits || []).map((x) => ({ ...x })) });
}
