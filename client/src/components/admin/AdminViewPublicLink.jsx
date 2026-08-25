import { isBlogPublicReady, isAdmissionPublicReady, isScholarshipPublicReady, isInternshipPublicReady, isJobPublicReady, VIEW_PUBLIC_HINT } from '@shared/cms/publicReadiness.js';

const READINESS = {
  blog: isBlogPublicReady,
  admission: isAdmissionPublicReady,
  scholarship: isScholarshipPublicReady,
  internship: isInternshipPublicReady,
  job: isJobPublicReady,
};

/**
 * Truthful Admin "View public" — disabled when anonymous route would 404.
 */
export function AdminViewPublicLink({
  type,
  record,
  href,
  label = 'View public',
  className = 'text-xs underline',
  disabledClassName = 'text-xs text-gray-400 cursor-not-allowed no-underline',
}) {
  if (!href) return null;
  const readyFn = READINESS[type];
  const ready = readyFn ? readyFn(record || {}) : false;
  if (!ready) {
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
