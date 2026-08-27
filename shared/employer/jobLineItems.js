/**
 * Canonical newline-per-item normalization for Job requirements,
 * responsibilities, and benefits (JOB-AUTHORING-P1A).
 *
 * UI contract: one human-readable item per line — commas inside a line are preserved.
 */

export function normalizeJobLineItems(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (raw == null || !String(raw).trim()) return [];
  return String(raw)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function jobLineItemsToText(items) {
  return Array.isArray(items) ? items.join('\n') : '';
}
