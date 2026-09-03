import { SEARCH_ENTITY_TYPES, SEARCH_SORT_OPTIONS } from './entityTypes.js';
import { SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT } from './rankingWeights.js';

/**
 * @param {object} query
 * @param {{ allowEmpty?: boolean }} [options]
 */
export function validateSearchQuery(query = {}, options = {}) {
  const errors = [];
  const q = String(query.q || query.query || '').trim();
  if (!q && !query.type && !query.featured && !options.allowEmpty) {
    errors.push('q is required unless filtering by type or featured');
  }
  if (q && q.length < 2) errors.push('q must be at least 2 characters');
  if (q && q.length > 200) errors.push('q must be at most 200 characters');

  const limit = Number(query.limit);
  if (query.limit != null && (Number.isNaN(limit) || limit < 1 || limit > SEARCH_MAX_LIMIT)) {
    errors.push(`limit must be between 1 and ${SEARCH_MAX_LIMIT}`);
  }

  const page = Number(query.page);
  if (query.page != null && (Number.isNaN(page) || page < 1)) {
    errors.push('page must be >= 1');
  }

  if (query.type) {
    const types = String(query.type).split(',').map((t) => t.trim()).filter(Boolean);
    types.forEach((t) => {
      if (!SEARCH_ENTITY_TYPES.includes(t)) errors.push(`Unknown entity type: ${t}`);
    });
  }

  if (query.sort && !SEARCH_SORT_OPTIONS.includes(query.sort)) {
    errors.push(`sort must be one of: ${SEARCH_SORT_OPTIONS.join(', ')}`);
  }

  return errors;
}

/**
 * @param {object} query
 */
export function parseSearchParams(query = {}) {
  const q = String(query.q || query.query || '').trim();
  const typeRaw = String(query.type || '').trim();
  const types = typeRaw ? typeRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const limit = Math.min(SEARCH_MAX_LIMIT, Math.max(1, Number(query.limit) || SEARCH_DEFAULT_LIMIT));
  const page = Math.max(1, Number(query.page) || 1);

  return {
    q,
    types,
    category: String(query.category || '').trim(),
    province: String(query.province || '').trim(),
    country: String(query.country || query.countryCode || '').trim(),
    featured: query.featured === 'true' || query.featured === true,
    sort: SEARCH_SORT_OPTIONS.includes(query.sort) ? query.sort : 'relevance',
    limit,
    page,
    skip: (page - 1) * limit,
    locale: String(query.locale || 'en').trim() || 'en',
    includeDraft: query.includeDraft === 'true' || query.includeDraft === true,
  };
}
