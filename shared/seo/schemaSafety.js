import { publicHttpUrlOrNull } from '../publicDiscovery/safePublicUrl.js';

function forbiddenSchemaHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1'
    || host.endsWith('.local')
    || host === 'vercel.app'
    || host.endsWith('.vercel.app');
}

export function safeSchemaUrl(value) {
  const normalized = publicHttpUrlOrNull(value);
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    return forbiddenSchemaHost(url.hostname) ? undefined : normalized;
  } catch {
    return undefined;
  }
}

export function safeSchemaDate(value) {
  if (value == null || value === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function safeSchemaText(value, maxLength = 5000) {
  if (value == null) return undefined;
  const text = String(value)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/[\u0000-\u001f\u007f]/g, (character) => (
      character === '\n' || character === '\r' ? character : ''
    ))
    .trim()
    .slice(0, maxLength);
  return text || undefined;
}

/** Only explicit numeric amount + ISO 4217 currency is schema-safe. */
export function safeSchemaMonetaryValue(amount, currency) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return undefined;
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency.trim().toUpperCase())) return undefined;
  return {
    '@type': 'MonetaryAmount',
    currency: currency.trim().toUpperCase(),
    value: amount,
  };
}
