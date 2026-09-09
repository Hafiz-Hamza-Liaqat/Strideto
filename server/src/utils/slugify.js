/**
 * Generate URL-safe slug from text (for SEO-friendly listing URLs).
 */
export function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    // Keep canonical slugs ASCII and make every separator/punctuation run a
    // separator.  In particular, `\w` includes `_`, which previously allowed
    // underscores through this helper even though admin slug validation only
    // accepts lowercase letters, numbers, and hyphens.
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function jobSlug(title, location) {
  return slugify([title, location].filter(Boolean).join(' '));
}

export function scholarshipSlug(title, country) {
  return slugify([title, country].filter(Boolean).join(' '));
}

export function admissionSlug(program, institution) {
  return slugify([program, institution].filter(Boolean).join(' '));
}

export function blogSlug(title) {
  return slugify(title || '');
}

export function foreignStudySlug(country, program) {
  return slugify([country, program].filter(Boolean).join(' '));
}

export function examSlug(name) {
  return slugify(name || '');
}

export function companySlug(name) {
  return slugify(name || '');
}

export function employerSlug(companyName) {
  return slugify(companyName || '');
}

export function universitySlug(name) {
  return slugify(name || '');
}

export function careerArticleSlug(title) {
  return slugify(title || '');
}
