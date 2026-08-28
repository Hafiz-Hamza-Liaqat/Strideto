/**
 * SEO-P8 — deterministic public page-group taxonomy.
 */
import { analyzePublicUrl } from './canonicalPath.js';

export const PAGE_GROUP = Object.freeze({
  HOME: 'home',
  JOBS_COLLECTION: 'jobs_collection',
  JOB_DETAIL: 'job_detail',
  INTERNSHIPS_COLLECTION: 'internships_collection',
  INTERNSHIP_DETAIL: 'internship_detail',
  SCHOLARSHIPS_COLLECTION: 'scholarships_collection',
  SCHOLARSHIP_DETAIL: 'scholarship_detail',
  INTL_SCHOLARSHIP_DETAIL: 'intl_scholarship_detail',
  SCHOLARSHIP_INTELLIGENCE: 'scholarship_intelligence',
  INSTITUTIONS_COLLECTION: 'institutions_collection',
  INSTITUTION_DETAIL: 'institution_detail',
  PROGRAM_DETAIL: 'program_detail',
  ADMISSIONS: 'admissions',
  FOREIGN_STUDY: 'foreign_study',
  BLOG_COLLECTION: 'blog_collection',
  BLOG_ARTICLE: 'blog_article',
  CAREER_GUIDANCE: 'career_guidance',
  EXAM_PREP: 'exam_prep',
  STUDENTS_PERSONA: 'students_persona',
  EMPLOYERS_PERSONA: 'employers_persona',
  INSTITUTIONS_PERSONA: 'institutions_persona',
  PROVIDER_PAGES: 'provider_pages',
  ABOUT_TRUST: 'about_trust',
  FACET_LANDING: 'facet_landing',
  PRIVATE_DASHBOARD: 'private_dashboard',
  OTHER_PUBLIC: 'other_public',
});

const PRIVATE_PREFIXES = [
  '/admin',
  '/dashboard',
  '/profile',
  '/saved-jobs',
  '/notifications',
  '/employer',
  '/agent',
  '/auth',
  '/resume-builder',
  '/applications',
];

const SEO_LANDING_PREFIXES = [
  '/jobs-in-',
  '/scholarships-in-',
];

/**
 * @param {string} rawPathOrUrl
 * @returns {{ pageGroup: string, canonicalPath: string, isApprovedLanding: boolean }}
 */
export function classifyPageGroup(rawPathOrUrl = '') {
  const { canonicalPath, hasFacetParams } = analyzePublicUrl(rawPathOrUrl);

  if (canonicalPath === '/') {
    return { pageGroup: PAGE_GROUP.HOME, canonicalPath, isApprovedLanding: true };
  }

  for (const prefix of PRIVATE_PREFIXES) {
    if (canonicalPath === prefix || canonicalPath.startsWith(`${prefix}/`)) {
      return { pageGroup: PAGE_GROUP.PRIVATE_DASHBOARD, canonicalPath, isApprovedLanding: false };
    }
  }

  if (hasFacetParams) {
    return { pageGroup: PAGE_GROUP.FACET_LANDING, canonicalPath, isApprovedLanding: false };
  }

  for (const prefix of SEO_LANDING_PREFIXES) {
    if (canonicalPath.startsWith(prefix)) {
      return { pageGroup: PAGE_GROUP.OTHER_PUBLIC, canonicalPath, isApprovedLanding: true };
    }
  }

  if (canonicalPath === '/jobs') {
    return { pageGroup: PAGE_GROUP.JOBS_COLLECTION, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath.startsWith('/jobs/')) {
    return { pageGroup: PAGE_GROUP.JOB_DETAIL, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/internships') {
    return { pageGroup: PAGE_GROUP.INTERNSHIPS_COLLECTION, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath.startsWith('/internships/')) {
    return { pageGroup: PAGE_GROUP.INTERNSHIP_DETAIL, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/scholarships') {
    return { pageGroup: PAGE_GROUP.SCHOLARSHIPS_COLLECTION, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath.startsWith('/scholarships/intelligence')) {
    return { pageGroup: PAGE_GROUP.SCHOLARSHIP_INTELLIGENCE, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath.startsWith('/scholarships/')) {
    return { pageGroup: PAGE_GROUP.SCHOLARSHIP_DETAIL, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/intl-scholarships') {
    return { pageGroup: PAGE_GROUP.SCHOLARSHIPS_COLLECTION, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath.startsWith('/intl-scholarships/')) {
    return { pageGroup: PAGE_GROUP.INTL_SCHOLARSHIP_DETAIL, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/schools-and-colleges') {
    return { pageGroup: PAGE_GROUP.INSTITUTIONS_COLLECTION, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath.startsWith('/schools-and-colleges/')) {
    return { pageGroup: PAGE_GROUP.INSTITUTION_DETAIL, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath.startsWith('/programs/')) {
    return { pageGroup: PAGE_GROUP.PROGRAM_DETAIL, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/admissions' || canonicalPath.startsWith('/admissions/')) {
    return { pageGroup: PAGE_GROUP.ADMISSIONS, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/foreign-studies' || canonicalPath.startsWith('/foreign-studies/')) {
    return { pageGroup: PAGE_GROUP.FOREIGN_STUDY, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/blog') {
    return { pageGroup: PAGE_GROUP.BLOG_COLLECTION, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath.startsWith('/blog/')) {
    return { pageGroup: PAGE_GROUP.BLOG_ARTICLE, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/career-guidance' || canonicalPath.startsWith('/career-guidance/')) {
    return { pageGroup: PAGE_GROUP.CAREER_GUIDANCE, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/exam-prep' || canonicalPath.startsWith('/exam-prep/')) {
    return { pageGroup: PAGE_GROUP.EXAM_PREP, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/students') {
    return { pageGroup: PAGE_GROUP.STUDENTS_PERSONA, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/employers') {
    return { pageGroup: PAGE_GROUP.EMPLOYERS_PERSONA, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/for-institutions') {
    return { pageGroup: PAGE_GROUP.INSTITUTIONS_PERSONA, canonicalPath, isApprovedLanding: true };
  }
  if (canonicalPath === '/providers' || canonicalPath.startsWith('/providers/')) {
    return { pageGroup: PAGE_GROUP.PROVIDER_PAGES, canonicalPath, isApprovedLanding: true };
  }
  if (['/about', '/editorial-policy', '/press', '/privacy-policy', '/terms', '/cookie-policy', '/disclaimer', '/faq', '/help-center', '/sitemap'].includes(canonicalPath)) {
    return { pageGroup: PAGE_GROUP.ABOUT_TRUST, canonicalPath, isApprovedLanding: true };
  }

  return { pageGroup: PAGE_GROUP.OTHER_PUBLIC, canonicalPath, isApprovedLanding: !hasFacetParams };
}
