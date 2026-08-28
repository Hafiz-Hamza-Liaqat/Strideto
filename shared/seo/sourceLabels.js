/**
 * @deprecated Import SOURCE_LINK_LABEL from sourceAuthority.js for new code.
 * Retained for tests referencing historical kind constants mapped to truthful labels.
 */
import { SOURCE_LINK_LABEL } from './sourceAuthority.js';

export const SOURCE_LINK_KINDS = Object.freeze({
  INSTITUTION_WEBSITE: 'institution_website',
  OFFICIAL_PROGRAM_PAGE: 'official_program_page',
  APPLICATION_PAGE: 'application_page',
  EXTERNAL_APPLICATION: 'external_application',
  SOURCE: 'source',
  REFERENCE: 'reference',
  ADMISSION_REQUIREMENTS: 'admission_requirements',
});

export const SOURCE_LINK_LABELS = Object.freeze({
  [SOURCE_LINK_KINDS.INSTITUTION_WEBSITE]: SOURCE_LINK_LABEL.INSTITUTION_WEBSITE,
  [SOURCE_LINK_KINDS.OFFICIAL_PROGRAM_PAGE]: SOURCE_LINK_LABEL.OFFICIAL_PROGRAM_PAGE,
  [SOURCE_LINK_KINDS.APPLICATION_PAGE]: SOURCE_LINK_LABEL.APPLICATION_PAGE,
  [SOURCE_LINK_KINDS.EXTERNAL_APPLICATION]: SOURCE_LINK_LABEL.EXTERNAL_APPLICATION,
  [SOURCE_LINK_KINDS.SOURCE]: SOURCE_LINK_LABEL.SOURCE,
  [SOURCE_LINK_KINDS.REFERENCE]: SOURCE_LINK_LABEL.REFERENCE,
  [SOURCE_LINK_KINDS.ADMISSION_REQUIREMENTS]: SOURCE_LINK_LABEL.ADMISSION_REQUIREMENTS,
});

export function sourceLinkLabelForKind(kind) {
  return SOURCE_LINK_LABELS[kind] || SOURCE_LINK_LABEL.SOURCE;
}

/** @deprecated Use explicit label from sourceAuthority resolvers. */
export function officialSourceLinkLabel(kind) {
  return sourceLinkLabelForKind(kind);
}
