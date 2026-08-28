/** Canonical blog category registry — single source for Admin + public filters. */
export const BLOG_CATEGORY_REGISTRY = Object.freeze([
  { id: 'career_advice', label: 'Career Advice', legacyValues: ['Career', 'Career Advice'] },
  { id: 'job_preparation', label: 'Job Preparation', legacyValues: ['Jobs', 'Job Preparation'] },
  { id: 'internships', label: 'Internships', legacyValues: ['Internships'] },
  { id: 'scholarships', label: 'Scholarships', legacyValues: ['Scholarships'] },
  { id: 'admissions', label: 'Admissions', legacyValues: ['Admissions'] },
  { id: 'international_study', label: 'International Study', legacyValues: ['International Study'] },
  { id: 'universities_programs', label: 'Universities & Programs', legacyValues: ['Universities & Programs'] },
  { id: 'exam_prep', label: 'Exam Prep', legacyValues: ['Exam Prep'] },
  { id: 'opportunities', label: 'Opportunities', legacyValues: ['Opportunities'] },
  { id: 'employer_hiring', label: 'Employer & Hiring', legacyValues: ['Employer & Hiring'] },
  { id: 'platform_updates', label: 'Platform Updates', legacyValues: ['Platform Updates'] },
]);

export function listBlogCategoryOptions() {
  return BLOG_CATEGORY_REGISTRY.map(({ id, label }) => ({ id, label }));
}

export function canonicalBlogCategoryLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.toLowerCase() === 'all') return '';
  const exact = BLOG_CATEGORY_REGISTRY.find((c) => c.label === raw);
  if (exact) return exact.label;
  const legacy = BLOG_CATEGORY_REGISTRY.find((c) => c.legacyValues.includes(raw));
  return legacy ? legacy.label : raw;
}

/** Longest plausible category label, in characters. */
const CATEGORY_MAX_LENGTH = 40;
/** Longest plausible category label, in words. */
const CATEGORY_MAX_WORDS = 6;

/**
 * Display guard for public cards.
 *
 * Returns the canonical registry label when the stored value is a known canonical or
 * legacy category; otherwise returns the trimmed raw value only when it is still
 * *shaped* like a category label, and '' when it cannot be one.
 */
export function displayableBlogCategoryLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const exact = BLOG_CATEGORY_REGISTRY.find((c) => c.label === raw);
  if (exact) return exact.label;
  const legacy = BLOG_CATEGORY_REGISTRY.find((c) => c.legacyValues.includes(raw));
  if (legacy) return legacy.label;
  if (raw.length > CATEGORY_MAX_LENGTH) return '';
  if (/[.!?]/.test(raw)) return '';
  if (/[\r\n]/.test(raw)) return '';
  if (raw.split(/\s+/).length > CATEGORY_MAX_WORDS) return '';
  return raw;
}

export function blogCategoryFilterValues(canonicalLabel) {
  if (!canonicalLabel) return [];
  const entry = BLOG_CATEGORY_REGISTRY.find((c) => c.label === canonicalLabel);
  if (!entry) return [canonicalLabel];
  return [entry.label, ...entry.legacyValues];
}

export function mergeBlogCategoryFilters(canonicalLabels, legacyPublished = []) {
  const set = new Set();
  for (const label of canonicalLabels) {
    for (const v of blogCategoryFilterValues(label)) set.add(v);
  }
  for (const legacy of legacyPublished) {
    const trimmed = String(legacy || '').trim();
    if (trimmed) set.add(trimmed);
  }
  return [...set];
}
