import {
  isBlogPublicReady,
  isAdmissionPublicReady,
  isScholarshipPublicReady,
  isInternshipPublicReady,
  isJobPublicReady,
  isLegacyActiveSlugPublicReady,
  isPublishedSlugPublicReady,
  isWebinarPublicReady,
  VIEW_PUBLIC_HINT,
} from '@shared/cms/publicReadiness.js';

const READINESS = {
  blog: isBlogPublicReady,
  admission: isAdmissionPublicReady,
  scholarship: isScholarshipPublicReady,
  internship: isInternshipPublicReady,
  job: isJobPublicReady,
  'legacy-active': isLegacyActiveSlugPublicReady,
  'published-slug': isPublishedSlugPublicReady,
  webinar: isWebinarPublicReady,
};

const SLUG_RESOURCE_READINESS = {
  admission: isAdmissionPublicReady,
  scholarship: isScholarshipPublicReady,
  internship: isInternshipPublicReady,
  job: isJobPublicReady,
  blog: isBlogPublicReady,
  company: isLegacyActiveSlugPublicReady,
  university: isLegacyActiveSlugPublicReady,
  'foreign-study': isLegacyActiveSlugPublicReady,
  institution: isLegacyActiveSlugPublicReady,
  'career-article': isPublishedSlugPublicReady,
  'cms-page': isPublishedSlugPublicReady,
  webinar: isWebinarPublicReady,
  // Intl detail route is Mongo id-based; slug preview URLs are not public-ready.
  'intl-scholarship': () => false,
};

/**
 * Truthful Admin "View public" — disabled when anonymous route would 404.
 */
export function AdminViewPublicLink({
  type,
  record,
  href,
  ready,
  label = 'View public',
  className = 'text-xs underline',
  disabledClassName = 'text-xs text-gray-400 cursor-not-allowed no-underline',
}) {
  if (!href) return null;
  const readyFn = type ? READINESS[type] : null;
  const isReady = typeof ready === 'boolean'
    ? ready
    : (readyFn ? readyFn(record || {}) : false);
  if (!isReady) {
    return (
      <span className={disabledClassName} title={VIEW_PUBLIC_HINT}>
        {label}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}

export function isAdminPublicPreviewReady(type, record = {}, status) {
  const merged = { ...record, status: status ?? record.status };
  const fn = READINESS[type];
  return fn ? fn(merged) : false;
}

/** Maps AdminSlugField resourceType to the same readiness truth as AdminViewPublicLink. */
export function isAdminSlugPreviewReady(resourceType, record = {}, status) {
  const merged = { ...record, status: status ?? record.status };
  const fn = SLUG_RESOURCE_READINESS[resourceType];
  return fn ? fn(merged) : false;
}
