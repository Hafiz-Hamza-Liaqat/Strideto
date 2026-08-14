/**
 * Official-source research window for the 17D-2 thin launch catalog.
 * Facts were verified on official pages on this date. Not authorization logic.
 */
export const CATALOG_RESEARCH_DATE = '2026-08-14';
export const CATALOG_RETRIEVED_AT = '2026-08-14T12:00:00.000Z';
export const CATALOG_LAST_REVIEWED_AT = '2026-08-14T12:00:00.000Z';

/** 17D-2R1 official-source re-verification (same calendar day, later window). */
export const CATALOG_CORRECTION_RESEARCH_DATE = '2026-08-14';
export const CATALOG_CORRECTION_RETRIEVED_AT = '2026-08-14T13:30:00.000Z';
export const CATALOG_CORRECTION_LAST_REVIEWED_AT = '2026-08-14T13:30:00.000Z';

export function dueAtIso(days, from = CATALOG_LAST_REVIEWED_AT) {
  const start = new Date(from);
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
