/**
 * Slugs that must not be used for public content (conflict with app routes).
 */
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'employer',
  'jobs',
  'scholarships',
  'admissions',
  'internships',
  'blog',
  'contact',
  'dashboard',
  'profile',
  'settings',
  'login',
  'register',
  'notifications',
  'resume-builder',
  'exam-prep',
  'foreign-studies',
  'career-guidance',
  'webinars',
  'about',
  'services',
  'faq',
  'privacy-policy',
  'terms',
  'support',
  'help-center',
  'company',
  'university',
  'schools-and-colleges',
  'new',
  'applications',
  'analytics',
  'business-services',
  'providers',
]);

export function isReservedSlug(slug) {
  if (!slug) return false;
  return RESERVED_SLUGS.has(String(slug).toLowerCase());
}
