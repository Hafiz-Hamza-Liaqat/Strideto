/**
 * Canonical search entity types (C.7.0.4).
 */

export const SEARCH_ENTITY_TYPES = [
  'job',
  'scholarship',
  'admission',
  'university',
  'blog',
  'career-guidance',
  'intl-scholarship',
  'legacy-institution',
  'company',
  'program',
  'cms-page',
  'page-builder-page',
  'form',
  'media',
  'talent-profile',
  'credential',
  'test',
];

export const SEARCH_ENTITY_TYPE_SET = new Set(SEARCH_ENTITY_TYPES);

/** Public-facing searchable types (excludes optional admin-only indexing). */
export const PUBLIC_SEARCH_ENTITY_TYPES = [
  'job',
  'scholarship',
  'admission',
  'university',
  'blog',
  'career-guidance',
  'intl-scholarship',
  'legacy-institution',
  'company',
  'program',
  'cms-page',
  'page-builder-page',
  'test',
];

export const SUGGESTION_ENTITY_TYPES = [
  'job',
  'scholarship',
  'university',
  'blog',
  'intl-scholarship',
  'legacy-institution',
  'company',
  'program',
  'cms-page',
  'page-builder-page',
  'test',
];

export const SEARCH_SORT_OPTIONS = ['relevance', 'newest', 'oldest', 'alphabetical'];

/**
 * @param {string} type
 */
export function isSearchEntityType(type) {
  return SEARCH_ENTITY_TYPE_SET.has(type);
}

/**
 * @param {string} entityType
 */
export function entityTypeLabel(entityType) {
  const labels = {
    job: 'Jobs',
    scholarship: 'Scholarships',
    admission: 'Admissions',
    university: 'Universities',
    blog: 'Blogs',
    'career-guidance': 'Career Guidance',
    'intl-scholarship': 'International Scholarships',
    'legacy-institution': 'Legacy Institutions',
    company: 'Companies',
    program: 'Programs',
    'cms-page': 'Pages',
    'page-builder-page': 'Pages',
    test: 'Tests',
    form: 'Forms',
    media: 'Media',
    'talent-profile': 'Talent Profiles',
    credential: 'Credentials',
  };
  return labels[entityType] || entityType;
}
