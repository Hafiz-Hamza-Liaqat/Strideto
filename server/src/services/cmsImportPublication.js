/**
 * Shared CMS import publication helpers (CONTENT-P0A).
 * Import rows must not directly control launchEligible or fixture flags.
 */
import { deriveCmsLaunchEligible, CMS_STATUS } from '../../../shared/cms/launchEligible.js';
import { normalizeCountryCode, coerceCountryCode } from '../../../shared/international/country.js';

const CMS_STATUSES = new Set(Object.values(CMS_STATUS));

/**
 * Resolve publication status from an import row using an explicit allowlist.
 * Omitted/blank status uses defaultStatus (documented import default: active).
 * Explicit invalid values throw so the import row is recorded as an error.
 */
export function resolveImportCmsStatus(row, defaultStatus = CMS_STATUS.ACTIVE) {
  const rawField = row?.status;
  if (rawField === undefined || rawField === null || String(rawField).trim() === '') {
    return defaultStatus;
  }
  const normalized = String(rawField).trim().toLowerCase();
  if (CMS_STATUSES.has(normalized)) {
    return normalized;
  }
  throw new Error(
    `Invalid status: "${String(rawField).trim()}". Allowed values: ${[...CMS_STATUSES].sort().join(', ')}`,
  );
}

/**
 * Derive launchEligible for imported CMS content.
 * Strips any imported launchEligible hint — server policy only.
 */
export function deriveImportLaunchEligible(docSnapshot = {}, status) {
  const { launchEligible: _ignored, ...rest } = docSnapshot;
  return deriveCmsLaunchEligible(rest, status);
}

/**
 * Map optional countryCode/country from import row.
 * Returns empty string when absent or invalid — never invents a code.
 */
export function resolveImportCountryCode(row) {
  const raw = row?.countryCode ?? row?.country;
  if (raw === undefined || raw === null || String(raw).trim() === '') return '';
  return normalizeCountryCode(raw) || coerceCountryCode(raw) || '';
}

/** Fields that must never be copied from import rows into CMS documents. */
export const CMS_IMPORT_FORBIDDEN_FIELDS = Object.freeze([
  'launchEligible',
  'isFixture',
  'dataClass',
  'environment',
  'demoOnly',
  'views',
  '_id',
  'createdAt',
  'updatedAt',
]);

export { CMS_STATUS };
