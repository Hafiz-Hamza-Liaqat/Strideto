/** Exact, deterministic search aliases. Ordinary queries remain lexical. */
const ENTITY_ALIASES = new Map([
  ['job', ['job']], ['jobs', ['job']],
  ['blog', ['blog']], ['blogs', ['blog']],
  ['admission', ['admission']], ['admissions', ['admission']],
  ['program', ['program']], ['programs', ['program']],
  ['test', ['test']], ['tests', ['test']],
  ['company', ['company']], ['companies', ['company']],
  ['university', ['university']], ['universities', ['university']],
  ['career guidance', ['career-guidance']], ['career-guidance', ['career-guidance']],
  ['scholarship', ['scholarship', 'intl-scholarship']],
  ['scholarships', ['scholarship', 'intl-scholarship']],
  ['international scholarship', ['intl-scholarship']],
  ['international scholarships', ['intl-scholarship']],
  ['intl-scholarship', ['intl-scholarship']],
  ['legacy institution', ['legacy-institution']], ['legacy institutions', ['legacy-institution']],
  ['school', ['legacy-institution']], ['schools', ['legacy-institution']],
  ['school and college', ['legacy-institution']], ['schools and colleges', ['legacy-institution']],
]);

const NAVIGATION_ALIASES = new Map([
  ['job', { label: 'Jobs', url: '/jobs' }], ['jobs', { label: 'Jobs', url: '/jobs' }],
  ['internship', { label: 'Internships', url: '/internships' }], ['internships', { label: 'Internships', url: '/internships' }],
  ['scholarship', { label: 'Scholarships', url: '/scholarships' }], ['scholarships', { label: 'Scholarships', url: '/scholarships' }],
  ['employer', { label: 'For Employers', url: '/employers' }], ['employers', { label: 'For Employers', url: '/employers' }],
]);

export function normalizeSearchIntentQuery(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveSearchIntent(value, { includeNavigation = false } = {}) {
  const normalized = normalizeSearchIntentQuery(value);
  const entityTypes = ENTITY_ALIASES.get(normalized) || null;
  const navigation = includeNavigation ? NAVIGATION_ALIASES.get(normalized.replace(/^\//, '')) : null;
  return {
    normalized,
    entityTypes: entityTypes ? [...entityTypes] : null,
    navigation: navigation ? { ...navigation, entityType: 'navigation', id: normalized.replace(/^\//, '') } : null,
  };
}

export { ENTITY_ALIASES, NAVIGATION_ALIASES };
