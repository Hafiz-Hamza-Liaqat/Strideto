/** Phone: digits and common phone punctuation only. */
export function sanitizePhone(value) {
  return String(value || '')
    .replace(/[^\d+\-\s().]/g, '')
    .slice(0, 24);
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
