/**
 * Official-source research window for the 17D-2 thin launch catalog.
 * Facts were verified on official pages on this date. Not authorization logic.
 */
export const CATALOG_RESEARCH_DATE = '2026-08-14';
export const CATALOG_RETRIEVED_AT = '2026-08-14T12:00:00.000Z';
export const CATALOG_LAST_REVIEWED_AT = '2026-08-14T12:00:00.000Z';

export function dueAtIso(days) {
  const start = new Date(CATALOG_LAST_REVIEWED_AT);
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
