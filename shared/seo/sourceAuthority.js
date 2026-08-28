/**
 * Source URL authority semantics (SEO-P7).
 *
 * publicHttpUrlOrNull() proves a URL is safe to render — not that it is official.
 * Label authority comes only from field/model semantics documented here.
 */
import { publicHttpUrlOrNull } from '../publicDiscovery/safePublicUrl.js';

export const SOURCE_AUTHORITY_LEVEL = Object.freeze({
  EXPLICIT_OFFICIAL: 'explicit_official',
  EXTERNAL_APPLICATION: 'external_application',
  PUBLIC_REFERENCE: 'public_reference',
  UNSAFE_INVALID: 'unsafe_invalid',
});

/** Truthful link anchor labels — never "Verified source". */
export const SOURCE_LINK_LABEL = Object.freeze({
  INSTITUTION_WEBSITE: 'Institution website',
  OFFICIAL_PROGRAM_PAGE: 'Official program page',
  APPLICATION_PAGE: 'Application page',
  EXTERNAL_APPLICATION: 'Apply on external site',
  SOURCE: 'Source',
  REFERENCE: 'Reference',
  ADMISSION_REQUIREMENTS: 'Admission requirements',
});

export function sourceSectionTitle(level) {
  if (level === SOURCE_AUTHORITY_LEVEL.EXPLICIT_OFFICIAL) return 'Official source';
  if (level === SOURCE_AUTHORITY_LEVEL.EXTERNAL_APPLICATION) return 'Application';
  return 'Source';
}

function withUrl(raw, label, level) {
  const url = publicHttpUrlOrNull(raw);
  if (!url) return null;
  return { url, label, level };
}

/** Job.applicationLink — external apply destination; not proven official employer domain. */
export function resolveJobApplicationLink(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.APPLICATION_PAGE, SOURCE_AUTHORITY_LEVEL.EXTERNAL_APPLICATION);
}

/** Job.sourceUrl — listing/reference URL from curation/scrape; not official by name. */
export function resolveJobSourceReference(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.SOURCE, SOURCE_AUTHORITY_LEVEL.PUBLIC_REFERENCE);
}

/** Primary provenance URL for Job detail (application preferred over reference). */
export function resolveJobProvenanceLink(job) {
  const application = job?.applyType === 'external'
    ? resolveJobApplicationLink(job?.applicationLink)
    : null;
  if (application) return application;
  return resolveJobSourceReference(job?.sourceUrl);
}

/** Internship.applicationLink — external application destination only. */
export function resolveInternshipApplicationLink(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.APPLICATION_PAGE, SOURCE_AUTHORITY_LEVEL.EXTERNAL_APPLICATION);
}

/** CMS Scholarship.link — editorial application/reference URL. */
export function resolveCmsScholarshipLink(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.APPLICATION_PAGE, SOURCE_AUTHORITY_LEVEL.EXTERNAL_APPLICATION);
}

/** IntlScholarship.link — editorial application/reference URL. */
export function resolveIntlScholarshipLink(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.APPLICATION_PAGE, SOURCE_AUTHORITY_LEVEL.EXTERNAL_APPLICATION);
}

/** CanonicalScholarship.applicationUrl — structured application destination. */
export function resolveCanonicalScholarshipApplicationUrl(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.APPLICATION_PAGE, SOURCE_AUTHORITY_LEVEL.EXTERNAL_APPLICATION);
}

/** CanonicalInstitution.officialWebsite — explicit official semantics in model. */
export function resolveInstitutionOfficialWebsite(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.INSTITUTION_WEBSITE, SOURCE_AUTHORITY_LEVEL.EXPLICIT_OFFICIAL);
}

/** Program.officialProgramUrl — explicit official program page in model. */
export function resolveProgramOfficialPage(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.OFFICIAL_PROGRAM_PAGE, SOURCE_AUTHORITY_LEVEL.EXPLICIT_OFFICIAL);
}

/** Program.admissionRequirementsUrl — reference document; not official program homepage. */
export function resolveProgramAdmissionRequirementsUrl(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.ADMISSION_REQUIREMENTS, SOURCE_AUTHORITY_LEVEL.PUBLIC_REFERENCE);
}

/** Program intake.applicationUrl — per-cycle application destination. */
export function resolveProgramIntakeApplicationUrl(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.APPLICATION_PAGE, SOURCE_AUTHORITY_LEVEL.EXTERNAL_APPLICATION);
}

/** Admission.applyLink / link — application URL fields. */
export function resolveAdmissionApplicationLink(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.APPLICATION_PAGE, SOURCE_AUTHORITY_LEVEL.EXTERNAL_APPLICATION);
}

/** Admission.sourceUrl — scrape/reference URL when distinct. */
export function resolveAdmissionSourceReference(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.SOURCE, SOURCE_AUTHORITY_LEVEL.PUBLIC_REFERENCE);
}

/** Admission detail: prefer application link, else reference source. */
export function resolveAdmissionProvenanceLink(admission) {
  return resolveAdmissionApplicationLink(admission?.applyLink || admission?.link)
    || resolveAdmissionSourceReference(admission?.sourceUrl);
}

/** ForeignStudy.link — editorial reference/application URL. */
export function resolveForeignStudyLink(raw) {
  return withUrl(raw, SOURCE_LINK_LABEL.APPLICATION_PAGE, SOURCE_AUTHORITY_LEVEL.EXTERNAL_APPLICATION);
}

/** Safe URL alone does not confer official authority. */
export function isExplicitOfficialLevel(level) {
  return level === SOURCE_AUTHORITY_LEVEL.EXPLICIT_OFFICIAL;
}
