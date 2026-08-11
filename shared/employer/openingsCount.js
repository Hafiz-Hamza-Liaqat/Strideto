/**
 * Canonical Employer openingsCount contract (Phase 4).
 *
 * New direct Employer jobs require an integer in [1, 10000].
 * Legacy jobs with a missing field stay unspecified — never auto-mutated.
 */

export const OPENINGS_COUNT_MIN = 1;
export const OPENINGS_COUNT_MAX = 10000;
export const OPENINGS_COUNT_UNSPECIFIED_LABEL = 'Not specified';

export function isSpecifiedOpeningsCount(value) {
  return value !== null && value !== undefined && value !== '';
}

export function parseOpeningsCount(raw, { required = false } = {}) {
  if (!isSpecifiedOpeningsCount(raw)) {
    if (required) {
      return { ok: false, code: 'OPENINGS_COUNT_REQUIRED', error: 'Number of openings is required' };
    }
    return { ok: true, specified: false, value: null };
  }
  if (typeof raw === 'boolean') {
    return { ok: false, code: 'OPENINGS_COUNT_INVALID', error: 'Number of openings must be an integer' };
  }
  if (typeof raw === 'string' && raw.trim() === '') {
    if (required) {
      return { ok: false, code: 'OPENINGS_COUNT_REQUIRED', error: 'Number of openings is required' };
    }
    return { ok: true, specified: false, value: null };
  }
  if (typeof raw === 'number' && (!Number.isFinite(raw) || !Number.isInteger(raw))) {
    return { ok: false, code: 'OPENINGS_COUNT_INVALID', error: 'Number of openings must be an integer' };
  }
  if (typeof raw === 'string' && !/^-?\d+$/.test(raw.trim())) {
    return { ok: false, code: 'OPENINGS_COUNT_INVALID', error: 'Number of openings must be an integer' };
  }
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10);
  if (!Number.isInteger(n)) {
    return { ok: false, code: 'OPENINGS_COUNT_INVALID', error: 'Number of openings must be an integer' };
  }
  if (n < OPENINGS_COUNT_MIN) {
    return { ok: false, code: 'OPENINGS_COUNT_MIN', error: `Number of openings must be at least ${OPENINGS_COUNT_MIN}` };
  }
  if (n > OPENINGS_COUNT_MAX) {
    return { ok: false, code: 'OPENINGS_COUNT_MAX', error: `Number of openings must be at most ${OPENINGS_COUNT_MAX}` };
  }
  return { ok: true, specified: true, value: n };
}

export function formatOpeningsCount(value) {
  const parsed = parseOpeningsCount(value, { required: false });
  if (!parsed.ok || !parsed.specified) return OPENINGS_COUNT_UNSPECIFIED_LABEL;
  return String(parsed.value);
}
