import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';
import { kindLabel, withProviderSubject, writeProviderWorkspacePref } from '../../config/providerWorkspacePref';

function persistPref(subject, domainId) {
  writeProviderWorkspacePref({
    subjectType: subject?.subjectType,
    subjectId: subject?.subjectId,
    domainId: domainId || null,
  });
}

export function ActingAsControl({
  subjects,
  current,
  activeDomainId,
  isProviderHome,
  hideBacklink,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();
  useOverlayA11y({ open, onClose: () => setOpen(false), containerRef: ref, trapFocus: true });
  const navigate = useNavigate();
  const currentLabel = current?.label || 'Provider';
  const currentKind = kindLabel(current?.kind || current?.subjectType);

  const selectSubject = (subject) => {
    const authorized = (subject.domainIds || []).filter(Boolean);
    const keepDomain = !isProviderHome && authorized.includes(activeDomainId)
      ? activeDomainId
      : null;
    persistPref(subject, keepDomain);
    setOpen(false);
    if (isProviderHome || !keepDomain) {
      navigate(withProviderSubject(`${ROUTES.AGENT_DASHBOARD}?home=1`, subject));
      return;
    }
    navigate(withProviderSubject(`${location.pathname}${location.search}`, subject));
  };

  return (
    <div className="px-2 pb-3 min-w-0">
      <p className="px-1 mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Acting as
      </p>
      {subjects.length <= 1 ? (
        <p className="px-1 text-sm text-gray-900 dark:text-white break-words">
          <span className="font-medium">{currentLabel}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">{currentKind}</span>
        </p>
      ) : (
        <>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Acting as ${currentLabel}, ${currentKind}`}
            onClick={() => setOpen((v) => !v)}
            className="w-full min-h-[44px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-left text-sm text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:focus-visible:ring-mint/50"
          >
            <span className="block font-medium break-words">{currentLabel}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">{currentKind}</span>
          </button>
          {open ? (
            <ul
              ref={ref}
              role="listbox"
              aria-label="Acting as"
              className="mt-1 max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              {subjects.map((row) => {
                const selected = current
                  && row.subjectType === current.subjectType
                  && String(row.subjectId) === String(current.subjectId);
                return (
                  <li key={`${row.subjectType}:${row.subjectId}`} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`block w-full px-3 py-2 text-left text-sm break-words focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 ${
                        selected
                          ? 'bg-primary/10 text-primary dark:text-mint font-medium'
                          : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => selectSubject(row)}
                    >
                      <span className="block font-medium break-words">{row.label}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{kindLabel(row.kind)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}
      {hideBacklink ? null : (
        <Link
          to={current ? withProviderSubject(`${ROUTES.AGENT_DASHBOARD}?home=1`, current) : `${ROUTES.AGENT_DASHBOARD}?home=1`}
          className="mt-2 inline-flex min-h-[36px] items-center px-1 text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
        >
          ← Provider Dashboard
        </Link>
      )}
    </div>
  );
}

export function AgentNavSection({ id, label, children }) {
  const headingId = `agent-nav-${id}`;
  return (
    <div className="mb-2" role="group" aria-labelledby={headingId}>
      <div className="mx-2 mb-1 border-t border-gray-200 dark:border-gray-700" aria-hidden="true" />
      <p
        id={headingId}
        className="px-2 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
      >
        {label}
      </p>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  );
}
