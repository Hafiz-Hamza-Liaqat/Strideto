/**
 * SEO-P4 — navigational content clusters (not canonical/robots/sitemap metadata).
 */
import { canonicalBlogCategoryLabel } from '../blog/taxonomy.js';
import { filterSafeInternalLinks } from './internalLinkSafety.js';

/** @typedef {{ id: string, label: string, hubPath: string, blogCategories: string[], relatedPaths: string[] }} ContentCluster */

/** @type {readonly ContentCluster[]} */
export const CONTENT_CLUSTERS = Object.freeze([
  {
    id: 'career',
    label: 'Career',
    hubPath: '/jobs',
    blogCategories: ['Career Advice', 'Job Preparation', 'Internships'],
    relatedPaths: ['/jobs', '/internships', '/career-guidance', '/resume-builder'],
  },
  {
    id: 'international-study',
    label: 'International Study',
    hubPath: '/foreign-studies',
    blogCategories: ['International Study', 'Admissions', 'Universities & Programs'],
    relatedPaths: ['/foreign-studies', '/intl-scholarships', '/scholarships', '/admissions', '/institutions', '/program-explorer'],
  },
  {
    id: 'scholarships',
    label: 'Scholarships',
    hubPath: '/scholarships',
    blogCategories: ['Scholarships', 'Opportunities'],
    relatedPaths: ['/scholarships', '/intl-scholarships', '/scholarship-intelligence', '/admissions', '/institutions'],
  },
  {
    id: 'institutions-programs',
    label: 'Institutions & Programs',
    hubPath: '/institutions',
    blogCategories: ['Universities & Programs', 'Exam Prep', 'Admissions'],
    relatedPaths: ['/institutions', '/program-explorer', '/admissions', '/scholarships', '/tests', '/exam-prep'],
  },
  {
    id: 'employer',
    label: 'Employer & Hiring',
    hubPath: '/employers',
    blogCategories: ['Employer & Hiring'],
    relatedPaths: ['/employers', '/jobs', '/blog'],
  },
  {
    id: 'exam-prep',
    label: 'Exam Preparation',
    hubPath: '/exam-prep',
    blogCategories: ['Exam Prep'],
    relatedPaths: ['/exam-prep', '/tests', '/program-explorer', '/institutions'],
  },
]);

const CLUSTER_RESOURCE_LABELS = Object.freeze({
  '/jobs': 'Browse Jobs',
  '/internships': 'Browse Internships',
  '/scholarships': 'Explore Scholarships',
  '/intl-scholarships': 'International Scholarships',
  '/scholarship-intelligence': 'Scholarship Intelligence',
  '/admissions': 'Admissions & Intakes',
  '/foreign-studies': 'Foreign Studies',
  '/institutions': 'Universities & Institutions',
  '/program-explorer': 'Program Explorer',
  '/career-guidance': 'Career Guidance',
  '/resume-builder': 'Resume Builder',
  '/blog': 'Career Blog',
  '/employers': 'For Employers',
  '/tests': 'Tests & Prep',
  '/exam-prep': 'Exam Preparation',
});

/**
 * @param {string} category
 * @returns {ContentCluster | null}
 */
export function resolveClusterForBlogCategory(category) {
  const label = canonicalBlogCategoryLabel(category);
  if (!label) return null;
  return CONTENT_CLUSTERS.find((cluster) => cluster.blogCategories.includes(label)) || null;
}

/**
 * @param {string} clusterId
 * @returns {ContentCluster | null}
 */
export function getContentCluster(clusterId) {
  return CONTENT_CLUSTERS.find((cluster) => cluster.id === clusterId) || null;
}

/**
 * @param {string} category
 * @param {{ maxItems?: number, currentPath?: string }} [options]
 * @returns {{ label: string, path: string, clusterId: string }[]}
 */
export function blogClusterResourceLinks(category, options = {}) {
  const { maxItems = 4, currentPath } = options;
  const cluster = resolveClusterForBlogCategory(category);
  if (!cluster) return [];

  const items = cluster.relatedPaths.map((path) => ({
    label: CLUSTER_RESOURCE_LABELS[path] || cluster.label,
    path,
    clusterId: cluster.id,
  }));

  return filterSafeInternalLinks(items, { currentPath }).slice(0, maxItems);
}

/**
 * @param {string} clusterId
 * @param {{ maxItems?: number, currentPath?: string }} [options]
 * @returns {{ label: string, path: string, clusterId: string }[]}
 */
export function clusterResourceLinks(clusterId, options = {}) {
  const { maxItems = 4, currentPath } = options;
  const cluster = getContentCluster(clusterId);
  if (!cluster) return [];

  const items = cluster.relatedPaths.map((path) => ({
    label: CLUSTER_RESOURCE_LABELS[path] || cluster.label,
    path,
    clusterId: cluster.id,
  }));

  return filterSafeInternalLinks(items, { currentPath }).slice(0, maxItems);
}
