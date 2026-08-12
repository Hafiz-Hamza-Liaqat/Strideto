import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { PageState, humanize, primaryButton, secondaryButton } from './InstitutionUi';

export const PUBLISHING_REASON_CODES = Object.freeze({
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  CLAIM_REQUIRED: 'CLAIM_REQUIRED',
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',
});

export function resolvePublishingBlockers({ verificationStatus, claimState, role }) {
  const blockers = [];
  if (verificationStatus !== 'approved') {
    blockers.push({
      code: PUBLISHING_REASON_CODES.VERIFICATION_REQUIRED,
      message: `Organization verification is ${humanize(verificationStatus || 'draft')}. Approved verification is required to submit or publish.`,
      cta: { label: 'Open verification', to: ROUTES.INSTITUTION_VERIFICATION },
    });
  }
  if (claimState !== 'approved') {
    blockers.push({
      code: PUBLISHING_REASON_CODES.CLAIM_REQUIRED,
      message: `Canonical claim is ${humanize(claimState || 'not started')}. An approved claim is required to submit or publish.`,
      cta: { label: 'Open canonical claim', to: ROUTES.INSTITUTION_CLAIM },
    });
  }
  if (role && !['owner', 'admin', 'editor'].includes(role)) {
    blockers.push({
      code: PUBLISHING_REASON_CODES.INSUFFICIENT_ROLE,
      message: `Your role (${humanize(role)}) cannot submit official changes.`,
      cta: { label: 'Team settings', to: ROUTES.INSTITUTION_TEAM },
    });
  }
  return blockers;
}

export function canSubmitOrPublish(authority) {
  if (!authority) return false;
  return resolvePublishingBlockers({
    verificationStatus: authority.verificationStatus,
    claimState: authority.claimState,
    role: authority.membership?.role,
  }).length === 0;
}

export function canPrepareDrafts() {
  return true;
}

export default function InstitutionPublishingGate({ authority, action = 'submit or publish' }) {
  const blockers = resolvePublishingBlockers({
    verificationStatus: authority?.verificationStatus,
    claimState: authority?.claimState,
    role: authority?.membership?.role,
  });

  if (!blockers.length) return null;

  return (
    <PageState tone="warning" role="note">
      <p className="font-semibold">Publishing locked — {action} requires approved verification and an approved canonical claim.</p>
      <p className="mt-1">Private drafts may still be prepared where the server allows. Submit and publish stay blocked until authority is active.</p>
      <ul className="mt-3 space-y-2">
        {blockers.map((blocker) => (
          <li key={blocker.code} className="rounded-lg border border-amber-200/80 bg-white/60 p-3 dark:border-amber-800 dark:bg-gray-900/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">{blocker.code}</p>
            <p className="mt-1">{blocker.message}</p>
            {blocker.cta ? (
              <Link to={blocker.cta.to} className={`${secondaryButton} mt-2`}>
                {blocker.cta.label}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </PageState>
  );
}

export function PublishingActionButton({ authority, onClick, disabled, busy, children, className = '' }) {
  const blocked = !canSubmitOrPublish(authority);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy || blocked}
      title={blocked ? 'Requires approved verification and canonical claim' : undefined}
      className={className || primaryButton}
    >
      {busy ? 'Working…' : children}
    </button>
  );
}
