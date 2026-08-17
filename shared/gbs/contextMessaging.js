export const GBS_MESSAGE_CONTEXT_TYPES = Object.freeze({
  REQUEST: 'request',
  QUOTE: 'quote',
  CASE: 'case',
});

export const GBS_MESSAGE_ACTOR_TYPES = Object.freeze({
  BUSINESS_CLIENT: 'business_client',
  PROVIDER: 'provider',
});

export const GBS_MESSAGE_LIMITS = Object.freeze({ PAGE_DEFAULT: 20, PAGE_MAX: 50, TEXT_MAX: 4000 });

export function parseGbsMessagePage(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function parseGbsMessageLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return GBS_MESSAGE_LIMITS.PAGE_DEFAULT;
  return Math.min(parsed, GBS_MESSAGE_LIMITS.PAGE_MAX);
}
