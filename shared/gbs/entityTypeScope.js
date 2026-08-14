/**
 * Entity types are jurisdiction-scoped. Wyoming LLC is not a global LLC SKU.
 */
export function entityTypeMatchesJurisdiction(entityType, jurisdictionId) {
  if (!entityType || !jurisdictionId) return false;
  return entityType.jurisdictionId === jurisdictionId;
}

export function assertEntityTypeJurisdiction(entityType, jurisdictionId) {
  if (!entityTypeMatchesJurisdiction(entityType, jurisdictionId)) {
    return {
      ok: false,
      error: 'unsupported_jurisdiction_entity_combination',
    };
  }
  return { ok: true };
}

export function isGlobalEntityTypeId(entityTypeId) {
  return typeof entityTypeId === 'string' && !entityTypeId.includes(':');
}
