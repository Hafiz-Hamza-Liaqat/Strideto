import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * STRIDETO International Country Tests — INTL-COUNTRY-01 through INTL-COUNTRY-09
 *
 * Validates:
 * - Storage contract: IntlScholarship.country stores display names ("New Zealand"), not ISO2 ("NZ")
 * - AdminIntlScholarships correctly uses coerceCountryCode to hydrate CountrySelect from display name
 * - onChange stores display name (not ISO2) for storage consistency
 * - Public pages render item.country directly (already a display name)
 * - coerceCountryCode performs three-stage resolution: ISO2 → LEGACY_NAME_TO_CODE → Intl.DisplayNames
 * - resolveDisplayNameToCode reverse lookup added to country.js
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const sharedSrc = path.resolve(here, '..', '..', '..', 'shared');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');
const readShared = (rel) => readFileSync(path.join(sharedSrc, rel), 'utf8');

const adminIntl = read('pages/Admin/AdminIntlScholarships.jsx');
const intlList = read('pages/IntlScholarships/IntlScholarships.jsx');
const intlDetail = read('pages/IntlScholarships/IntlScholarshipDetail.jsx');
const countryJs = readShared('international/country.js');

// ── INTL-COUNTRY-01: AdminIntlScholarships uses coerceCountryCode to hydrate CountrySelect ──
// Storage is display names; CountrySelect expects ISO2; coerceCountryCode bridges the gap
check(adminIntl.includes('coerceCountryCode(form.country)'), 'INTL-COUNTRY-01: CountrySelect value uses coerceCountryCode(form.country) to convert stored display name to ISO2');

// ── INTL-COUNTRY-02: onChange stores display name, not ISO2 ──────────────────
check(adminIntl.includes('countryDisplayName(code)'), 'INTL-COUNTRY-02a: onChange calls countryDisplayName(code) to convert ISO2 selection back to display name for storage');
check(!adminIntl.includes("country: code || ''"), 'INTL-COUNTRY-02b: onChange does NOT store raw ISO2 code directly');

// ── INTL-COUNTRY-03: coerceCountryCode imported in AdminIntlScholarships ─────
check(adminIntl.includes('coerceCountryCode'), 'INTL-COUNTRY-03: coerceCountryCode imported in AdminIntlScholarships (needed to hydrate CountrySelect from display-name storage)');

// ── INTL-COUNTRY-04: Public list renders item.country directly (already a display name) ─
check(!intlList.includes("countryDisplayName(item.country)"), 'INTL-COUNTRY-04a: IntlScholarships.jsx does NOT wrap item.country in countryDisplayName (storage is already display names)');
check(intlList.includes('item.country'), 'INTL-COUNTRY-04b: list renders item.country directly');

// ── INTL-COUNTRY-05: Public detail renders item.country directly ─────────────
check(!intlDetail.includes("countryDisplayName(item.country)"), 'INTL-COUNTRY-05a: IntlScholarshipDetail.jsx does NOT wrap item.country in countryDisplayName');
check(intlDetail.includes('item.country'), 'INTL-COUNTRY-05b: detail renders item.country directly');

// ── INTL-COUNTRY-06: countryDisplayName in shared uses Intl.DisplayNames ─────
check(countryJs.includes('Intl.DisplayNames'), 'INTL-COUNTRY-06: countryDisplayName (and reverse lookup) uses Intl.DisplayNames');
check(countryJs.includes("export function countryDisplayName"), 'INTL-COUNTRY-06b: countryDisplayName exported from country.js');

// ── INTL-COUNTRY-07: coerceCountryCode still exists in shared ────────────────
check(countryJs.includes("export function coerceCountryCode"), 'INTL-COUNTRY-07: coerceCountryCode exported from shared');

// ── INTL-COUNTRY-08: ISO_3166_ALPHA2 set preserved ───────────────────────────
check(countryJs.includes("export const ISO_3166_ALPHA2"), 'INTL-COUNTRY-08: ISO_3166_ALPHA2 canonical set preserved');
check(countryJs.includes("'NZ'"), 'INTL-COUNTRY-08b: NZ in ISO set (regression check for New Zealand support)');

// ── INTL-COUNTRY-09: resolveDisplayNameToCode reverse lookup added ────────────
// This is the root-cause fix: coerceCountryCode now resolves "New Zealand" → "NZ"
// via iterating ISO_3166_ALPHA2 with Intl.DisplayNames rather than a tiny hardcoded map
check(countryJs.includes('resolveDisplayNameToCode'), 'INTL-COUNTRY-09a: resolveDisplayNameToCode private function exists in country.js');
check(countryJs.includes('return resolveDisplayNameToCode'), 'INTL-COUNTRY-09b: coerceCountryCode calls resolveDisplayNameToCode as third resolution stage');

console.log(`stridetoIntlCountry.test.js: ${count} assertions passed`);
