import { Link } from 'react-router-dom';

/**
 * Scoped Strideto professional verification mark.
 * Never implies government, university, visa, or protected-title approval.
 */
export function StridetoVerifiedMark({
  scope = 'education_mobility',
  className = '',
}) {
  const scopeText = scope === 'business_services'
    ? 'Business Services eligibility approved for this service/capability and jurisdiction.'
    : 'Education & Mobility professional verification approved.';
  const accessibleName = `Verified by Strideto: ${scopeText}`;

  return (
    <span
      className={`inline-flex max-w-full flex-col gap-0.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-left dark:border-emerald-800 dark:bg-emerald-950/40 ${className}`}
      title={accessibleName}
    >
      <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-100" aria-hidden="true">
        Verified by Strideto
      </span>
      <span className="sr-only">{accessibleName}</span>
      <span className="text-[11px] leading-snug text-emerald-800 dark:text-emerald-200 break-words" aria-hidden="true">
        {scopeText}
      </span>
      <span className="sr-only">
        Does not mean government approval, university approval, guaranteed admission or visa, lawyer or accountant status, ACSP/CSP status, or Registered Agent status.
      </span>
    </span>
  );
}

export function EducationVerificationCta({ to, children }) {
  return (
    <Link to={to} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
