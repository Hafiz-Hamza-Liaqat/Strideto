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

const LOCATION_ALIASES = new Map([
  ['pakistan', ['pakistan', 'pk']],
  ['usa', ['usa', 'us', 'united states', 'united states of america']],
  ['us', ['usa', 'us', 'united states', 'united states of america']],
  ['united states', ['usa', 'us', 'united states', 'united states of america']],
  ['united states of america', ['usa', 'us', 'united states', 'united states of america']],
  ['uk', ['uk', 'gb', 'united kingdom', 'england']],
  ['united kingdom', ['uk', 'gb', 'united kingdom', 'england']],
  ['england', ['uk', 'gb', 'united kingdom', 'england']],
  ['uae', ['uae', 'ae', 'united arab emirates']],
  ['united arab emirates', ['uae', 'ae', 'united arab emirates']],
  ['india', ['india', 'in']], ['canada', ['canada', 'ca']],
  ['australia', ['australia', 'au']], ['germany', ['germany', 'de']],
  ['ireland', ['ireland', 'ie']],
]);

export function normalizeSearchIntentQuery(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveSearchIntent(value, { includeNavigation = false } = {}) {
  const normalized = normalizeSearchIntentQuery(value);
  const contextualMatch = normalized.match(/^(.+?)\s+(?:in|at|near)\s+(.+)$/);
  const entityQuery = contextualMatch ? contextualMatch[1] : normalized;
  const locationText = contextualMatch ? contextualMatch[2].trim() : '';
  const entityTypes = ENTITY_ALIASES.get(entityQuery) || null;
  const locationAliases = locationText ? (LOCATION_ALIASES.get(locationText) || [locationText]) : [];
  const navigation = includeNavigation ? NAVIGATION_ALIASES.get(normalized.replace(/^\//, '')) : null;
  return {
    normalized,
    entityQuery,
    locationText,
    remainingQuery: locationText || normalized,
    locationAliases,
    contextual: Boolean(contextualMatch && entityTypes),
    entityTypes: entityTypes ? [...entityTypes] : null,
    navigation: navigation ? { ...navigation, entityType: 'navigation', id: normalized.replace(/^\//, '') } : null,
  };
}

export { ENTITY_ALIASES, LOCATION_ALIASES, NAVIGATION_ALIASES };
