/** Canonical blog category registry — single source for Admin + public filters. */
export const BLOG_CATEGORY_REGISTRY = Object.freeze([
  { id: 'career_advice', label: 'Career Advice', legacyValues: ['Career', 'Career Advice'] },
  { id: 'scholarships', label: 'Scholarships', legacyValues: ['Scholarships'] },
  { id: 'job_preparation', label: 'Job Preparation', legacyValues: ['Jobs', 'Job Preparation'] },
  { id: 'international_study', label: 'International Study', legacyValues: ['International Study'] },
  { id: 'platform_updates', label: 'Platform Updates', legacyValues: ['Platform Updates'] },
  { id: 'admissions', label: 'Admissions', legacyValues: ['Admissions'] },
  { id: 'exam_prep', label: 'Exam Prep', legacyValues: ['Exam Prep'] },
  { id: 'opportunities', label: 'Opportunities', legacyValues: ['Opportunities'] },
]);

export function listBlogCategoryOptions() {
  return BLOG_CATEGORY_REGISTRY.map(({ id, label }) => ({ id, label }));
}

export function canonicalBlogCategoryLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const exact = BLOG_CATEGORY_REGISTRY.find((c) => c.label === raw);
  if (exact) return exact.label;
  const legacy = BLOG_CATEGORY_REGISTRY.find((c) => c.legacyValues.includes(raw));
  return legacy ? legacy.label : raw;
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
