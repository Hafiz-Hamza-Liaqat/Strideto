import { normalizeNationalNumberInput } from '@shared/international/phone.js';

/** Local-number digits only — canonical E.164 is built by PhoneInput. */
export function sanitizePhone(value) {
  return normalizeNationalNumberInput(value).slice(0, 15);
}

/** Calendar year: digits only, max 4. */
export function sanitizeYear(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 4);
}

/** GPA / score: digits and at most one decimal point. */
export function sanitizeGpa(value) {
  let next = String(value || '').replace(/[^\d.]/g, '');
  const firstDot = next.indexOf('.');
  if (firstDot !== -1) {
    next = `${next.slice(0, firstDot + 1)}${next.slice(firstDot + 1).replace(/\./g, '')}`;
  }
  return next.slice(0, 6);
}
