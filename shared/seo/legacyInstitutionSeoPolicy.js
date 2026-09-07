/**
 * Conservative indexability policy for legacy Institution records.
 *
 * Legacy institutions have no structured provenance or launch gate. A record
 * is therefore not indexable merely because it is active and has a slug.
 * This policy is read-only and does not alter legacy data.
 */

function hasText(value, minimum = 1) {
  return typeof value === 'string' && value.trim().length >= minimum;
}

function isHttpUrl(value) {
  if (!hasText(value)) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isLegacyInstitutionIndexable(record) {
  if (!record || record.status !== 'active' || !hasText(record.slug, 2)) return false;
  if (!hasText(record.name, 3)) return false;
  if (!isHttpUrl(record.website)) return false;

  const meaningfulLocation = [record.country, record.province, record.city, record.address]
    .some((value) => hasText(value, 2));
  if (!meaningfulLocation) return false;

  const substantiveProfile = hasText(record.description, 80)
    || (Array.isArray(record.programs) && record.programs.some((item) => hasText(item, 3)));
  return substantiveProfile;
}

